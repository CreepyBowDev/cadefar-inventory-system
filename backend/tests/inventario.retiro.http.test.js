import test from 'node:test';
import assert from 'node:assert/strict';

// Capas y SQL Sequelize reales, transporte y estado transaccional simulados.
// No conecta ni escribe en MySQL; aislamiento/concurrencia pendientes de 3.4.
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'retiro_inventario_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_de_pruebas_retiros';
const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const { ROLES } = await import('../src/shared/constants/roles.js');
const { inventarioService } = await import('../src/business/services/inventario.service.js');

test('CU35/CU36: retiro, pérdida exacta, cortes y rollback HTTP simulados sin MySQL', async t => {
    const instante = new Date('2026-11-01T03:59:59.999Z');
    t.mock.timers.enable({ apis: ['Date'], now: instante });
    const inicial = {
        usuarios: Object.values(ROLES).map(id => ({ id_usuario: id, id_rol: id,
            nombre_usuario: `usuario${id}`, estado: true, version_credenciales: 0 })),
        medicamentos: [{ id_medicamento: 2, estado: false }],
        existencias: [{ id_existencia: 8, id_medicamento: 2, codigo_existencia: 'INA-008',
            fecha_vencimiento: '2025-01-31', precision_vencimiento: 'MES',
            cantidad_fisica: 10, costo_unitario_promedio: '1.234567' }],
        movimientos: [{ id_movimiento: 10, id_existencia: 8, id_usuario: 1,
            id_detalle_compra: 5, id_detalle_venta: null, id_movimiento_original: null,
            direccion: 'ENTRADA', cantidad: 10, costo_unitario_aplicado: '1.234567',
            fecha_movimiento: '2025-01-01 10:00:00', motivo: 'COMPRA', observacion: null }],
        snapshots: [{ id_detalle_compra: 5, saldo_anterior: 0, costo_promedio_anterior: '0.000000' }]
    };
    let estado, pendiente, fallo, actualizarCero, despuesDelMarcador, nextId, peticiones = 0;
    const queries = [];
    const reset = () => {
        estado = structuredClone(inicial); pendiente = undefined; fallo = undefined;
        actualizarCero = false; despuesDelMarcador = undefined; nextId = 100; queries.length = 0;
        t.mock.timers.setTime(instante.getTime());
    };
    reset();
    t.mock.method(console, 'error', () => {});
    t.mock.method(db.sequelize.connectionManager, 'getConnection', async () => ({ uuid: 'conexion_sintetica' }));
    t.mock.method(db.sequelize.connectionManager, 'releaseConnection', async () => {});
    t.mock.method(db.sequelize.connectionManager, 'destroyConnection', async () => {});
    t.mock.method(db.sequelize, 'query', async (input, options = {}) => {
        options = { ...options, model: options.model || options.instance?.constructor };
        const sql = typeof input === 'string' ? input : input.query;
        const bind = typeof input === 'string' ? options.bind : input.bind;
        queries.push({ sql, bind, transaction: options.transaction?.id });
        if (/^START TRANSACTION/.test(sql)) {
            assert.equal(pendiente, undefined); pendiente = structuredClone(estado); return [];
        }
        if (/^COMMIT/.test(sql)) { assert.ok(pendiente); estado = pendiente; pendiente = undefined; return []; }
        if (/^ROLLBACK/.test(sql)) { pendiente = undefined; return []; }
        assert.match(sql, /^(SELECT|UPDATE|INSERT) /);
        const current = options.transaction ? pendiente : estado;
        assert.ok(current);
        if (fallo) await fallo({ sql, options, current });
        if (options.type === db.Sequelize.QueryTypes.SELECT) {
            if (options.model === db.Usuario) {
                assert.equal(options.transaction, undefined);
                const id = Number(sql.match(/`Usuario`.`id_usuario` = (\d+)/)[1]);
                const row = current.usuarios.find(u => u.id_usuario === id);
                return row ? db.Usuario.build(row, { isNewRecord: false, raw: true }) : null;
            }
            assert.ok(options.transaction);
            assert.match(sql, /FOR UPDATE;$/);
            if (options.model === db.ExistenciaMedicamento) {
                const id = Number(sql.match(/`ExistenciaMedicamento`.`id_existencia` = (\d+)/)[1]);
                const row = current.existencias.find(e => e.id_existencia === id);
                return row ? db.ExistenciaMedicamento.build(structuredClone(row), { isNewRecord: false, raw: true }) : null;
            }
            assert.equal(options.model, db.MovimientoInventario);
            assert.match(sql, /ORDER BY `MovimientoInventario`.`id_movimiento` DESC LIMIT 1 FOR UPDATE;$/);
            const id = Number(sql.match(/`MovimientoInventario`.`id_existencia` = (\d+)/)[1]);
            const rows = current.movimientos.filter(m => m.id_existencia === id).sort((a, b) => b.id_movimiento - a.id_movimiento);
            if (despuesDelMarcador) t.mock.timers.setTime(despuesDelMarcador.getTime());
            return rows.length ? { id_movimiento: rows[0].id_movimiento } : null;
        }
        assert.ok(options.transaction);
        assert.doesNotMatch(sql, /perdida/);
        if (options.type === db.Sequelize.QueryTypes.BULKUPDATE) {
            assert.equal(options.model, db.ExistenciaMedicamento);
            if (actualizarCero) return 0;
            const value = campo => {
                const token = sql.match(new RegExp('`' + campo + '`\\s*=\\s*([^, ;]+)'))[1];
                return token.startsWith('$') ? bind[Number(token.slice(1)) - 1] : Number(token);
            };
            const row = current.existencias.find(e => e.id_existencia === Number(value('id_existencia')));
            assert.ok(row);
            assert.equal(String(value('costo_unitario_promedio')), row.costo_unitario_promedio);
            row.cantidad_fisica = Number(value('cantidad_fisica'));
            return 1;
        }
        assert.equal(options.type, db.Sequelize.QueryTypes.INSERT);
        assert.equal(options.model, db.MovimientoInventario);
        assert.match(sql, /STR_TO_DATE\(/);
        const values = Object.fromEntries(Object.entries(options.instance.get({ plain: true }))
            .map(([k, v]) => [k, v?.fn === 'STR_TO_DATE' ? v.args[0] : v]));
        assert.ok(['VENCIMIENTO', 'DAÑO'].includes(values.motivo));
        assert.equal(values.direccion, 'SALIDA');
        for (const campo of ['id_detalle_compra', 'id_detalle_venta', 'id_movimiento_original']) assert.equal(values[campo], null);
        assert.equal(values.costo_unitario_aplicado, current.existencias[0].costo_unitario_promedio);
        assert.equal(Object.hasOwn(values, 'perdida'), false);
        values.id_movimiento = nextId++;
        current.movimientos.push(values);
        options.instance.setDataValue('id_movimiento', values.id_movimiento);
        return [options.instance, 1];
    });
    const body = (extra = {}) => ({ idExistencia: 8, stockObservado: 10,
        ultimoMovimientoObservado: 10, cantidad: 3, observacion: '  Unidades retiradas  ', ...extra });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/api/inventario/retiros`;
    const request = async (tipo, data = body(), status = 201, rol = 'REGENTE',
        token = rol ? generarToken({ idUsuario: ROLES[rol], idRol: ROLES[rol], versionCredenciales: 0 }) : undefined) => {
        peticiones++;
        const response = await fetch(`${base}/${tipo}`, { method: 'POST', headers: {
            'Content-Type': 'application/json', ...(token ? { Cookie: `token=${token}` } : {})
        }, body: JSON.stringify(data), signal: AbortSignal.timeout(10000) });
        const result = await response.json();
        assert.equal(response.status, status, `${tipo}: ${JSON.stringify(result)}`);
        assert.equal(pendiente, undefined, 'La respuesta llega después del commit/rollback');
        assert.doesNotMatch(JSON.stringify(result), /password|versionCredenciales|detalle_tecnico|ER_LOCK|SELECT |INSERT /);
        return result;
    };
    const rollback = before => {
        assert.deepEqual(estado, before); assert.match(queries.at(-1).sql, /^ROLLBACK/);
        const inicio = queries.findLastIndex(q => /^START TRANSACTION/.test(q.sql));
        assert.equal(queries.slice(inicio).some(q => /^COMMIT/.test(q.sql)), false);
    };
    const sinEscrituras = () => assert.equal(queries.some(q => /^(UPDATE|INSERT) /.test(q.sql)), false);
    try {
        await t.test('Ambos motivos: salida, pérdida exacta, usuario de sesión, promedio e históricos conservados', async () => {
            for (const [tipo, motivo] of [['vencimiento', 'VENCIMIENTO'], ['dano', 'DAÑO']]) {
                reset(); const antes = structuredClone(estado);
                const result = await request(tipo);
                assert.deepEqual(result.data, { idExistencia: 8, saldoAnterior: 10,
                    cantidadRetirada: 3, stockFisico: 7, costoUnitarioPromedio: '1.234567',
                    perdida: '3.70', ultimoMovimiento: 100,
                    movimiento: { idMovimiento: 100, idExistencia: 8, idUsuario: ROLES.REGENTE,
                        idDetalleCompra: null, idDetalleVenta: null, idMovimientoOriginal: null,
                        direccion: 'SALIDA', cantidad: 3, costoUnitarioAplicado: '1.234567', motivo,
                        observacion: 'Unidades retiradas', fechaMovimiento: '2026-10-31 23:59:59' } });
                assert.equal(estado.existencias[0].cantidad_fisica, 7);
                assert.deepEqual(estado.movimientos[0], antes.movimientos[0]);
                assert.deepEqual(estado.snapshots, antes.snapshots);
                assert.deepEqual(estado.medicamentos, antes.medicamentos);
                assert.equal(estado.existencias[0].fecha_vencimiento, antes.existencias[0].fecha_vencimiento);
                const dentro = queries.filter(q => q.transaction && /^(SELECT|INSERT|UPDATE) /.test(q.sql));
                assert.match(dentro[0].sql, /FROM `existencia_medicamento`.*FOR UPDATE/);
                assert.match(dentro[1].sql, /FROM `movimiento_inventario`.*LIMIT 1 FOR UPDATE/);
                assert.equal(dentro.every(q => q.transaction === dentro[0].transaction), true);
                assert.equal(dentro.some(q => /JOIN|FROM `medicamento`|FROM `compra`/.test(q.sql)), false);
                assert.match(queries.at(-1).sql, /^COMMIT/);
            }
        });

        await t.test('Vencimiento: MES conserva el último día y permite retirar después del bloqueo que cruza el corte', async () => {
            reset(); estado.existencias[0].fecha_vencimiento = '2026-10-31';
            const antes = structuredClone(estado);
            await request('vencimiento', body(), 409); rollback(antes); sinEscrituras();
            reset(); estado.existencias[0].fecha_vencimiento = '2026-10-31';
            despuesDelMarcador = new Date('2026-11-01T04:00:00Z');
            const result = await request('vencimiento');
            assert.equal(result.data.movimiento.fechaMovimiento, '2026-11-01 00:00:00');
            assert.equal(estado.existencias[0].fecha_vencimiento, '2026-10-31');
        });

        await t.test('Vencimiento: DIA al inicio de su fecha y MES en febrero/cambio de año', async () => {
            for (const [fecha, precision, antes, despues] of [
                ['2026-11-01', 'DIA', '2026-11-01T03:59:59Z', '2026-11-01T04:00:00Z'],
                ['2024-02-29', 'MES', '2024-03-01T03:59:59Z', '2024-03-01T04:00:00Z'],
                ['2025-02-28', 'MES', '2025-03-01T03:59:59Z', '2025-03-01T04:00:00Z'],
                ['2026-12-31', 'MES', '2027-01-01T03:59:59Z', '2027-01-01T04:00:00Z']
            ]) {
                reset(); Object.assign(estado.existencias[0], { fecha_vencimiento: fecha, precision_vencimiento: precision });
                t.mock.timers.setTime(new Date(antes).getTime());
                const anterior = structuredClone(estado);
                await request('vencimiento', body(), 409); rollback(anterior); sinEscrituras();
                despuesDelMarcador = new Date(despues);
                await request('vencimiento');
            }
        });

        await t.test('Daño no exige vencimiento: admite futuras, vencidas e inactivas; observación obligatoria', async () => {
            for (const fecha of ['2025-01-31', '2026-10-31', '2030-12-31']) {
                reset(); estado.existencias[0].fecha_vencimiento = fecha;
                await request('dano');
            }
            reset(); await request('dano', body({ observacion: undefined }), 400);
            assert.equal(queries.some(q => /^START TRANSACTION/.test(q.sql)), false);
        });

        await t.test('Observación de vencimiento omitida guarda null; provista se recorta', async () => {
            reset(); const result = await request('vencimiento', body({ observacion: undefined }));
            assert.equal(result.data.movimiento.observacion, null);
            assert.equal(estado.movimientos.at(-1).observacion, null);
            reset(); assert.equal((await request('vencimiento')).data.movimiento.observacion, 'Unidades retiradas');
        });

        await t.test('Promedio cero y agotamiento: pérdida cero, saldo cero y promedio intacto', async () => {
            for (const tipo of ['vencimiento', 'dano']) for (const costo of ['0.000000', '1.234567']) {
                reset(); estado.existencias[0].costo_unitario_promedio = costo;
                const result = await request(tipo, body({ cantidad: 10 }));
                assert.equal(result.data.stockFisico, 0);
                assert.equal(result.data.costoUnitarioPromedio, costo);
                assert.equal(result.data.perdida, costo === '0.000000' ? '0.00' : '12.35');
            }
        });

        await t.test('Pérdidas: empate hacia arriba, importes pequeños y máximo sin límite artificial DECIMAL(14,2)', async () => {
            for (const [costo, cantidad, perdida] of [
                ['0.005000', 1, '0.01'], ['0.004999', 1, '0.00'], ['0.000001', 3, '0.00'],
                ['99999999.999999', 2147483647, '214748364699997852.52']
            ]) {
                reset(); estado.existencias[0].cantidad_fisica = cantidad;
                estado.existencias[0].costo_unitario_promedio = costo;
                const result = await request('dano', body({ stockObservado: cantidad, cantidad }));
                assert.equal(result.data.perdida, perdida);
                assert.equal(result.data.movimiento.costoUnitarioAplicado, costo);
                assert.equal(result.data.stockFisico, 0);
            }
        });

        await t.test('Precondiciones: saldo o marcador obsoletos, incluso saldo restaurado; otros movimientos no invalidan', async () => {
            for (const tipo of ['vencimiento', 'dano']) for (const extra of [
                { stockObservado: 9 }, { ultimoMovimientoObservado: 9 }, { ultimoMovimientoObservado: null }
            ]) {
                reset(); const antes = structuredClone(estado);
                await request(tipo, body(extra), 409); rollback(antes); sinEscrituras();
            }
            reset(); estado.movimientos.push({ ...estado.movimientos[0], id_movimiento: 11 });
            const antes = structuredClone(estado);
            await request('vencimiento', body(), 409); rollback(antes); sinEscrituras();
            reset(); estado.movimientos.push({ ...estado.movimientos[0], id_movimiento: 99, id_existencia: 9 });
            await request('dano');
            reset(); estado.movimientos = [];
            assert.equal((await request('vencimiento', body({ ultimoMovimientoObservado: null }))).data.ultimoMovimiento, 100);
        });

        await t.test('Stock insuficiente, agotada y existencia inexistente: rechazo sin efectos', async () => {
            for (const tipo of ['vencimiento', 'dano']) {
                reset(); let antes = structuredClone(estado);
                await request(tipo, body({ cantidad: 11 }), 409); rollback(antes); sinEscrituras();
                reset(); estado.existencias[0].cantidad_fisica = 0; antes = structuredClone(estado);
                await request(tipo, body({ stockObservado: 0, cantidad: 1 }), 409); rollback(antes); sinEscrituras();
                reset(); antes = structuredClone(estado);
                await request(tipo, body({ idExistencia: 2147483647 }), 404); rollback(antes);
            }
        });

        await t.test('Repetición secuencial y cruce entre motivos: 409 con precondiciones antiguas', async () => {
            for (const [primero, segundo] of [['vencimiento', 'vencimiento'], ['dano', 'dano'], ['dano', 'vencimiento']]) {
                reset(); await request(primero); const antes = structuredClone(estado);
                await request(segundo, body(), 409); rollback(antes);
                assert.equal(estado.movimientos.length, 2);
            }
        });

        await t.test('Ambas rutas exclusivamente Regente; sesión/versión inválidas y cuenta inactiva', async () => {
            for (const tipo of ['vencimiento', 'dano']) {
                for (const rol of ['ADMINISTRADOR', 'VENDEDOR']) {
                    reset(); await request(tipo, body(), 403, rol);
                    assert.equal(queries.some(q => /^START TRANSACTION/.test(q.sql)), false);
                }
                for (const token of [undefined, 'invalido', generarToken({ idUsuario: 2, idRol: 2, versionCredenciales: 1 })]) {
                    reset(); await request(tipo, body(), 401, null, token);
                    assert.equal(queries.some(q => /^START TRANSACTION/.test(q.sql)), false);
                }
                reset(); estado.usuarios.find(u => u.id_usuario === 2).estado = false;
                await request(tipo, body(), 401);
                reset(); await request(tipo, body(), 403, 'REGENTE',
                    generarToken({ idUsuario: 3, idRol: 2, versionCredenciales: 0 }));
            }
        });

        await t.test('Entrada estricta: cantidades, precondiciones, observaciones y campos calculados antes de transacción', async () => {
            for (const tipo of ['vencimiento', 'dano']) for (const extra of [
                { cantidad: 0 }, { cantidad: -1 }, { cantidad: 1.5 }, { cantidad: '1' }, { cantidad: 2147483648 },
                { ultimoMovimientoObservado: undefined }, { ultimoMovimientoObservado: 0 }, { stockObservado: undefined },
                { observacion: null }, { observacion: ' ' }, { observacion: 'a'.repeat(501) },
                { costoUnitario: '1' }, { costoUnitarioAplicado: '1' }, { motivo: 'AJUSTE' },
                { perdida: '1.00' }, { direccion: 'ENTRADA' }, { idUsuario: 1 }, { fechaMovimiento: '2025-01-01' }
            ]) {
                reset(); await request(tipo, body(extra), 400);
                assert.equal(queries.some(q => /^START TRANSACTION/.test(q.sql)), false);
            }
            for (const tipo of ['vencimiento', 'dano']) {
                reset(); await request(`${tipo}?cantidad=1`, body(), 400);
                assert.equal(queries.some(q => /^START TRANSACTION/.test(q.sql)), false);
            }
        });

        await t.test('Promedios inválidos y vencimiento incoherente: 409 sin efectos', async () => {
            for (const tipo of ['vencimiento', 'dano']) for (const promedio of ['-1', '100000000.000000', '0.1234567', 'no_decimal']) {
                reset(); estado.existencias[0].costo_unitario_promedio = promedio;
                const antes = structuredClone(estado);
                await request(tipo, body(), 409); rollback(antes); sinEscrituras();
            }
            reset(); estado.existencias[0].fecha_vencimiento = '2025-02-30';
            const antes = structuredClone(estado);
            await request('vencimiento', body(), 409); rollback(antes); sinEscrituras();
        });

        await t.test('Fallo al leer, actualizar o insertar: rollback simulado, precondiciones conservadas y reintento', async () => {
            for (const tipo of ['vencimiento', 'dano']) for (const patron of [
                /FROM `existencia_medicamento`/, /FROM `movimiento_inventario`/, /^UPDATE /, /^INSERT /
            ]) {
                reset(); const antes = structuredClone(estado);
                fallo = ({ sql }) => { if (patron.test(sql)) throw new Error('detalle_tecnico_sintetico'); };
                assert.deepEqual(await request(tipo, body(), 500), { message: 'Error interno del servidor' });
                rollback(antes); fallo = undefined;
                await request(tipo); assert.equal(estado.movimientos.length, 2);
            }
            reset(); actualizarCero = true; const antes = structuredClone(estado);
            await request('dano', body(), 409); rollback(antes);
        });

        await t.test('Timeout/deadlock: rollback completo y 409, sin reintento automático', async () => {
            for (const tipo of ['vencimiento', 'dano']) for (const code of ['ER_LOCK_WAIT_TIMEOUT', 'ER_LOCK_DEADLOCK']) {
                reset(); const antes = structuredClone(estado);
                fallo = ({ sql }) => { if (/^INSERT /.test(sql)) throw Object.assign(new Error('detalle_tecnico'), { original: { code } }); };
                const result = await request(tipo, body(), 409);
                assert.match(result.message, /contención temporal/); rollback(antes);
                assert.equal(queries.filter(q => /^START TRANSACTION/.test(q.sql)).length, 1);
            }
        });

        await t.test('Responsable inválido: rechazo en el Service antes de abrir transacción', async () => {
            reset();
            for (const registrar of [inventarioService.registrarRetiroVencimiento, inventarioService.registrarRetiroDano]) {
                for (const id of [undefined, null, 0, -1, '2', 2147483648]) {
                    await assert.rejects(registrar(body(), id), error => error.statusCode === 401);
                }
            }
            assert.equal(queries.length, 0);
        });
        t.diagnostic(`${peticiones} comprobaciones HTTP; SQL real generado y transporte/rollback simulados, sin MySQL.`);
    } finally {
        await new Promise(resolve => server.close(resolve));
        await db.sequelize.close();
    }
});
