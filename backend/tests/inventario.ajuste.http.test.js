import test from 'node:test';
import assert from 'node:assert/strict';

// HTTP, Service, Repositories y SQL de Sequelize reales; transporte y estado
// transaccional simulados. No conecta a MySQL ni acredita concurrencia InnoDB.
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'ajuste_inventario_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_de_pruebas_ajustes';
const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const { ROLES } = await import('../src/shared/constants/roles.js');
const { inventarioService } = await import('../src/business/services/inventario.service.js');

test('CU23: registro y conciliación HTTP con SQL y rollback simulados, sin MySQL', async t => {
    const instante = new Date('2026-11-01T03:59:59.999Z');
    t.mock.timers.enable({ apis: ['Date'], now: instante });
    const inicial = {
        usuarios: Object.values(ROLES).map(id => ({ id_usuario: id, id_rol: id,
            nombre_usuario: `usuario${id}`, estado: true, version_credenciales: 0 })),
        medicamentos: [{ id_medicamento: 2, estado: false }],
        existencias: [{ id_existencia: 8, id_medicamento: 2, codigo_existencia: 'INA-008',
            fecha_vencimiento: '2025-01-31', precision_vencimiento: 'MES',
            cantidad_fisica: 10, costo_unitario_promedio: '1.000000' }],
        movimientos: [{ id_movimiento: 10, id_existencia: 8, id_usuario: 1,
            id_detalle_compra: 5, id_detalle_venta: null, id_movimiento_original: null,
            direccion: 'ENTRADA', cantidad: 10, costo_unitario_aplicado: '1.000000',
            fecha_movimiento: '2025-01-01 10:00:00', motivo: 'COMPRA', observacion: null }],
        snapshots: [{ id_detalle_compra: 5, saldo_anterior: 0, costo_promedio_anterior: '0.000000' }]
    };
    let estado, pendiente, fallo, actualizarCero, avanzarDia, nextId, peticiones = 0;
    const queries = [];
    const reset = () => {
        estado = structuredClone(inicial); pendiente = undefined; fallo = undefined;
        actualizarCero = false; avanzarDia = false; nextId = 100; queries.length = 0;
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
            assert.equal(pendiente, undefined);
            pendiente = structuredClone(estado); return [];
        }
        if (/^COMMIT/.test(sql)) {
            assert.ok(pendiente); estado = pendiente; pendiente = undefined; return [];
        }
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
            if (avanzarDia) t.mock.timers.setTime(new Date('2026-11-01T04:15:00Z').getTime());
            return rows.length ? { id_movimiento: rows[0].id_movimiento } : null;
        }
        assert.ok(options.transaction, 'Toda escritura usa la misma transacción que los bloqueos');
        if (options.type === db.Sequelize.QueryTypes.BULKUPDATE) {
            assert.equal(options.model, db.ExistenciaMedicamento);
            if (actualizarCero) return 0;
            const value = campo => {
                const token = sql.match(new RegExp('`' + campo + '`\\s*=\\s*([^, ;]+)'))[1];
                return token.startsWith('$') ? bind[Number(token.slice(1)) - 1] : Number(token);
            };
            const row = current.existencias.find(e => e.id_existencia === Number(value('id_existencia')));
            assert.ok(row);
            row.cantidad_fisica = Number(value('cantidad_fisica'));
            row.costo_unitario_promedio = String(value('costo_unitario_promedio'));
            return 1;
        }
        assert.equal(options.type, db.Sequelize.QueryTypes.INSERT);
        assert.equal(options.model, db.MovimientoInventario);
        assert.match(sql, /STR_TO_DATE\(/);
        const values = Object.fromEntries(Object.entries(options.instance.get({ plain: true }))
            .map(([k, v]) => [k, v?.fn === 'STR_TO_DATE' ? v.args[0] : v]));
        assert.equal(values.motivo, 'AJUSTE');
        for (const campo of ['id_detalle_compra', 'id_detalle_venta', 'id_movimiento_original']) assert.equal(values[campo], null);
        values.id_movimiento = nextId++;
        current.movimientos.push(values);
        options.instance.setDataValue('id_movimiento', values.id_movimiento);
        return [options.instance, 1];
    });
    const tokens = Object.fromEntries(Object.entries(ROLES).map(([rol, id]) => [rol,
        generarToken({ idUsuario: id, idRol: id, versionCredenciales: 0 })]));
    const body = (extra = {}) => ({ idExistencia: 8, stockObservado: 10,
        ultimoMovimientoObservado: 10, saldoContado: 20, costoUnitario: '2',
        observacion: '  Conteo físico  ', ...extra });
    const salida = (saldoContado = 0, extra = {}) => {
        const { costoUnitario, ...data } = body({ saldoContado, ...extra }); return data;
    };
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/api/inventario/ajustes`;
    const request = async (data, status = 201, rol = 'REGENTE', path = '', token = tokens[rol]) => {
        peticiones++;
        const response = await fetch(`${base}${path}`, { method: 'POST', headers: {
            'Content-Type': 'application/json', ...(token ? { Cookie: `token=${token}` } : {})
        }, body: JSON.stringify(data), signal: AbortSignal.timeout(10000) });
        const result = await response.json();
        assert.equal(response.status, status, JSON.stringify(result));
        assert.equal(pendiente, undefined, 'Se responde solo después de commit/rollback');
        assert.doesNotMatch(JSON.stringify(result), /password|versionCredenciales|detalle_tecnico|ER_LOCK|SELECT |INSERT /);
        return result;
    };
    const rollback = before => {
        assert.deepEqual(estado, before);
        assert.match(queries.at(-1).sql, /^ROLLBACK/);
    };
    const comprobarProtocolo = () => {
        const inicio = queries.findIndex(q => /^START TRANSACTION/.test(q.sql));
        const dentro = queries.slice(inicio + 1, -1);
        assert.match(dentro[0].sql, /FROM `existencia_medicamento`.*FOR UPDATE/);
        assert.match(dentro[1].sql, /FROM `movimiento_inventario`.*LIMIT 1 FOR UPDATE/);
        const id = dentro[0].transaction;
        assert.ok(id);
        assert.equal(dentro.every(q => q.transaction === id), true);
        assert.equal(dentro.some(q => /JOIN|FROM `medicamento`|FROM `compra`/.test(q.sql)), false);
        assert.match(queries.at(-1).sql, /^COMMIT/);
    };
    try {
        await t.test('Entrada: promedio exacto, motivo oficial, responsable de sesión y fecha civil', async () => {
            reset(); avanzarDia = true;
            const antes = structuredClone(estado);
            const result = await request(body());
            assert.equal(result.message, 'Ajuste registrado exitosamente');
            assert.deepEqual(result.data, { ajusteRealizado: true, idExistencia: 8,
                saldoAnterior: 10, saldoContado: 20, diferencia: 10, stockFisico: 20,
                costoUnitarioPromedio: '1.500000', ultimoMovimiento: 100,
                movimiento: { idMovimiento: 100, idExistencia: 8, idUsuario: ROLES.REGENTE,
                    idDetalleCompra: null, idDetalleVenta: null, idMovimientoOriginal: null,
                    direccion: 'ENTRADA', cantidad: 10, costoUnitarioAplicado: '2.000000', motivo: 'AJUSTE',
                    observacion: 'Conteo físico', fechaMovimiento: '2026-11-01 00:15:00' } });
            assert.equal(estado.existencias[0].cantidad_fisica, 20);
            assert.equal(estado.existencias[0].costo_unitario_promedio, '1.500000');
            assert.deepEqual(estado.movimientos[0], antes.movimientos[0]);
            assert.deepEqual(estado.snapshots, antes.snapshots);
            assert.deepEqual(estado.medicamentos, antes.medicamentos);
            assert.equal(estado.existencias[0].fecha_vencimiento, antes.existencias[0].fecha_vencimiento);
            comprobarProtocolo();
        });

        await t.test('Entrada sobre agotada: no aporta el promedio histórico', async () => {
            reset(); estado.existencias[0].cantidad_fisica = 0;
            estado.existencias[0].costo_unitario_promedio = '99999999.999999';
            const result = await request(body({ stockObservado: 0, saldoContado: 3, costoUnitario: '0.000001' }));
            assert.equal(result.data.costoUnitarioPromedio, '0.000001');
            assert.equal(result.data.movimiento.cantidad, 3);
        });

        await t.test('Un único redondeo a seis decimales, con empate hacia arriba', async () => {
            reset(); estado.existencias[0].cantidad_fisica = 1;
            estado.existencias[0].costo_unitario_promedio = '0.000001';
            const result = await request(body({ stockObservado: 1, saldoContado: 2, costoUnitario: '0.000002' }));
            assert.equal(result.data.costoUnitarioPromedio, '0.000002');
            assert.equal(result.data.movimiento.costoUnitarioAplicado, '0.000002');
        });

        await t.test('Saldo y costo máximos: productos exactos por encima del entero seguro de Number', async () => {
            reset(); estado.existencias[0].cantidad_fisica = 2147483646;
            estado.existencias[0].costo_unitario_promedio = '99999999.999999';
            const result = await request(body({ stockObservado: 2147483646,
                saldoContado: 2147483647, costoUnitario: '99999999.999999' }));
            assert.equal(result.data.stockFisico, 2147483647);
            assert.equal(result.data.costoUnitarioPromedio, '99999999.999999');
            assert.equal(result.data.movimiento.cantidad, 1);
        });

        await t.test('Salidas parciales y totales: costo vigente incluso cero, promedio conservado', async () => {
            for (const promedio of ['1.234567', '0.000000']) for (const saldo of [4, 0]) {
                reset(); estado.existencias[0].costo_unitario_promedio = promedio;
                const result = await request(salida(saldo));
                assert.equal(result.data.diferencia, saldo - 10);
                assert.equal(result.data.costoUnitarioPromedio, promedio);
                assert.equal(result.data.movimiento.costoUnitarioAplicado, promedio);
                assert.equal(result.data.movimiento.direccion, 'SALIDA');
                assert.equal(result.data.movimiento.cantidad, 10 - saldo);
                assert.equal(estado.existencias[0].costo_unitario_promedio, promedio);
            }
        });

        await t.test('Sin diferencia: dos conciliaciones 200, precondiciones comprobadas, ningún historial o UPDATE', async () => {
            reset(); const antes = structuredClone(estado);
            for (let i = 0; i < 2; i++) {
                const result = await request(salida(10), 200);
                assert.equal(result.data.ajusteRealizado, false);
                assert.equal(result.data.diferencia, 0);
                assert.equal(result.data.movimiento, null);
                assert.equal(result.data.ultimoMovimiento, 10);
                assert.equal(Object.hasOwn(result.data, 'observacion'), false);
                assert.match(result.message, /No fue necesario/);
                assert.deepEqual(estado, antes);
            }
            assert.equal(queries.some(q => /^(INSERT|UPDATE) /.test(q.sql)), false);
        });

        await t.test('Sin movimientos: marcador null para conciliación y primera entrada', async () => {
            reset(); estado.movimientos = []; estado.existencias[0].cantidad_fisica = 0;
            const antes = structuredClone(estado);
            const sinCambio = await request(salida(0, { stockObservado: 0, ultimoMovimientoObservado: null }), 200);
            assert.equal(sinCambio.data.ultimoMovimiento, null);
            assert.deepEqual(estado, antes);
            const entrada = await request(body({ stockObservado: 0, ultimoMovimientoObservado: null }));
            assert.equal(entrada.data.ultimoMovimiento, 100);
            assert.equal(estado.movimientos.length, 1);
        });

        await t.test('Cambio de saldo o marcador: 409 antes de escrituras, incluso si no habría diferencia', async () => {
            for (const extra of [
                { stockObservado: 9 }, { ultimoMovimientoObservado: 9 }, { ultimoMovimientoObservado: null }
            ]) for (const sinDiferencia of [false, true]) {
                reset(); const antes = structuredClone(estado);
                // El cuerpo debe ser válido respecto al saldo observado. Aunque
                // el conteo coincida con el saldo actual, un observado menor
                // exige costo; primero se rechazará por precondiciones.
                const solicitud = body({ ...extra, ...(sinDiferencia ? { saldoContado: 10 } : {}) });
                if (solicitud.saldoContado <= solicitud.stockObservado) delete solicitud.costoUnitario;
                await request(solicitud, 409);
                rollback(antes);
                assert.equal(queries.some(q => /^(INSERT|UPDATE) /.test(q.sql)), false);
            }
        });

        await t.test('Saldo restaurado con nuevo historial: rechaza; movimiento en otra existencia no invalida', async () => {
            reset(); estado.movimientos.push({ ...estado.movimientos[0], id_movimiento: 11 });
            const antes = structuredClone(estado);
            await request(body(), 409); rollback(antes);
            reset(); estado.movimientos.push({ ...estado.movimientos[0], id_movimiento: 99, id_existencia: 9 });
            assert.equal((await request(body())).data.ultimoMovimiento, 100);
        });

        await t.test('Repetición después del commit: precondiciones obsoletas, sin segundo movimiento', async () => {
            reset(); await request(body()); const antes = structuredClone(estado);
            await request(body(), 409); rollback(antes);
            assert.equal(estado.movimientos.length, 2);
        });

        await t.test('Existencia inexistente 404 y costos históricos inválidos 409 sin efectos', async () => {
            reset(); const antes = structuredClone(estado);
            await request(body({ idExistencia: 2147483647 }), 404); rollback(antes);
            for (const promedio of ['-1', '100000000.000000', '0.1234567', 'no_decimal']) {
                reset(); estado.existencias[0].costo_unitario_promedio = promedio;
                const anterior = structuredClone(estado);
                await request(body(), 409); rollback(anterior);
            }
        });

        await t.test('Autorización exclusivamente Regente; sesión inválida y usuario inactivo', async () => {
            for (const rol of ['ADMINISTRADOR', 'VENDEDOR']) {
                reset(); await request(body(), 403, rol);
                assert.equal(queries.some(q => /^START TRANSACTION/.test(q.sql)), false);
            }
            for (const token of [undefined, 'invalido', generarToken({ idUsuario: 2, idRol: 2, versionCredenciales: 1 })]) {
                reset(); await request(body(), 401, null, '', token);
                assert.equal(queries.some(q => /^START TRANSACTION/.test(q.sql)), false);
            }
            reset(); estado.usuarios.find(u => u.id_usuario === 2).estado = false;
            await request(body(), 401);
            reset(); await request(body(), 403, 'REGENTE', '',
                generarToken({ idUsuario: 3, idRol: 2, versionCredenciales: 0 }));
        });

        await t.test('Entrada y query estrictas: se rechazan antes de abrir transacción', async () => {
            for (const data of [body({ saldoContado: -1 }), body({ costoUnitario: '1.0000001' }),
                body({ costoUnitario: 2 }), body({ costoUnitario: '0' }), body({ idUsuario: 1 }),
                body({ direccion: 'SALIDA' }), body({ motivo: 'DAÑO' }), body({ observacion: ' ' }),
                body({ ultimoMovimientoObservado: 0 }), body({ ultimoMovimientoObservado: undefined }),
                body({ costoUnitario: undefined }), body({ saldoContado: 2147483648 }),
                { ...salida(10), costoUnitario: '1' }]) {
                reset(); await request(data, 400);
                assert.equal(queries.some(q => /^START TRANSACTION/.test(q.sql)), false);
            }
            reset(); await request(body(), 400, 'REGENTE', '?idUsuario=1');
            assert.equal(queries.some(q => /^START TRANSACTION/.test(q.sql)), false);
            reset(); await request({ ...salida(10), observacion: undefined }, 400);
            assert.equal(queries.some(q => /^START TRANSACTION/.test(q.sql)), false);
        });

        await t.test('Fallo en lectura, UPDATE o INSERT: rollback íntegro y reintento con precondiciones originales', async () => {
            for (const patron of [/FROM `existencia_medicamento`/, /FROM `movimiento_inventario`/, /^UPDATE /, /^INSERT /]) {
                reset(); const antes = structuredClone(estado);
                fallo = ({ sql }) => { if (patron.test(sql)) throw new Error('detalle_tecnico_sintetico'); };
                assert.deepEqual(await request(body(), 500), { message: 'Error interno del servidor' });
                rollback(antes);
                fallo = undefined;
                await request(body());
                assert.equal(estado.movimientos.length, 2);
            }
            reset(); actualizarCero = true; const antes = structuredClone(estado);
            await request(body(), 409); rollback(antes);
        });

        await t.test('Timeout y deadlock: 409 después del rollback, sin reintento automático', async () => {
            for (const code of ['ER_LOCK_WAIT_TIMEOUT', 'ER_LOCK_DEADLOCK']) {
                reset(); const antes = structuredClone(estado);
                fallo = ({ sql }) => { if (/^INSERT /.test(sql)) throw Object.assign(new Error('detalle_tecnico'), { parent: { code } }); };
                const result = await request(body(), 409);
                assert.match(result.message, /contención temporal/); rollback(antes);
                assert.equal(queries.filter(q => /^START TRANSACTION/.test(q.sql)).length, 1);
            }
        });

        await t.test('Service rechaza responsable inválido antes de abrir una transacción', async () => {
            reset();
            for (const id of [undefined, null, 0, -1, '2', 2147483648]) {
                await assert.rejects(inventarioService.registrarAjuste(body(), id), error => error.statusCode === 401);
            }
            assert.equal(queries.length, 0);
        });
        t.diagnostic(`${peticiones} comprobaciones HTTP; transporte y commit/rollback simulados, sin MySQL. Concurrencia real pendiente en 3.4.`);
    } finally {
        await new Promise(resolve => server.close(resolve));
        await db.sequelize.close();
    }
});
