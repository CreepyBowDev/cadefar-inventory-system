import test from 'node:test';
import assert from 'node:assert/strict';

// HTTP, Services, Repositories, modelos, SQL y transacciones gestionadas reales.
// Se simula el transporte SQL y su estado transaccional; no hay conexión MySQL.
// Esto no acredita concurrencia, persistencia temporal ni rollback de InnoDB.
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'registro_compra_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_de_pruebas_registro_compra';
const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const { ROLES } = await import('../src/shared/constants/roles.js');

test('Fase 2.3: registro completo, reglas, SQL y rollback simulado sin MySQL', async t => {
    const instanteInicial = new Date('2026-11-01T03:59:59.999Z');
    t.mock.timers.enable({ apis: ['Date'], now: instanteInicial });
    const medicamento = (id, codigo, proveedor = 5) => ({
        id_medicamento: id, codigo_medicamento: codigo, id_proveedor_laboratorio: proveedor,
        nombre_comercial: codigo, forma_farmaceutica: 'Tableta', presentacion: '500 mg',
        unidad_inventario: 'tableta', estado: true
    });
    const existencia = (id, codigo, fecha, precision, cantidad, costo) => ({
        id_existencia: id, id_medicamento: 1, codigo_existencia: codigo,
        fecha_vencimiento: fecha, precision_vencimiento: precision,
        cantidad_fisica: cantidad, costo_unitario_promedio: costo
    });
    const inicial = {
        usuarios: [...Object.values(ROLES).map(id => ({ id_usuario: id, id_rol: id,
            nombre_usuario: `usuario${id}`, estado: true, version_credenciales: 0 })),
        { id_usuario: 4, id_rol: ROLES.ADMINISTRADOR, nombre_usuario: 'otroAdmin', estado: true, version_credenciales: 0 }],
        medicamentos: [medicamento(1, 'PAR'), medicamento(2, 'IBU'), medicamento(3, 'OTRO', 6)],
        proveedores: [{ id_proveedor_laboratorio: 5, nombre: 'Proveedor', estado: true },
            { id_proveedor_laboratorio: 6, nombre: 'Otro proveedor', estado: true }],
        existencias: [existencia(8, 'PAR-008', '2027-03-31', 'MES', 100, '0.500000'),
            existencia(9, 'PAR-002', '2028-01-01', 'DIA', 0, '5.000000'),
            existencia(10, 'PAR-010', '2030-01-01', 'DIA', 0, '0.400000'),
            existencia(11, 'PAR-004', '2027-04-15', 'MES', 3, '0.123456')],
        compras: [], detalles: [], movimientos: []
    };
    let estado, pendiente, fallo, cambiarDiaBajoBloqueo = false;
    let counters, peticiones = 0, conexionesSimuladas = 0;
    const queries = [];
    const reset = () => {
        estado = structuredClone(inicial); pendiente = undefined; fallo = undefined;
        cambiarDiaBajoBloqueo = false; queries.length = 0;
        counters = { Compra: 100, ExistenciaMedicamento: 100, DetalleCompra: 100, MovimientoInventario: 100 };
        t.mock.timers.setTime(instanteInicial.getTime());
    };
    reset();
    const tabla = { Compra: 'compras', ExistenciaMedicamento: 'existencias',
        DetalleCompra: 'detalles', MovimientoInventario: 'movimientos' };
    const build = (options, rows) => {
        const result = rows.map(row => options.model.build(structuredClone(row), {
            isNewRecord: false, raw: true, include: options.include
        }));
        return options.plain ? result[0] ?? null : result;
    };
    const civil = valor => valor?.fn === 'STR_TO_DATE' ? valor.args[0] : valor;
    const unique = (indice, campos = {}) => new db.Sequelize.UniqueConstraintError({
        fields: campos, parent: { code: 'ER_DUP_ENTRY',
            sqlMessage: `Duplicate entry 'valor_sintetico' for key 'tabla.${indice}'` }
    });
    t.mock.method(db.sequelize.connectionManager, 'getConnection', async () => {
        conexionesSimuladas++;
        return { uuid: 'conexion_sintetica' };
    });
    t.mock.method(db.sequelize.connectionManager, 'releaseConnection', async () => {});
    t.mock.method(db.sequelize.connectionManager, 'destroyConnection', async () => {});
    t.mock.method(console, 'error', () => {});
    t.mock.method(db.sequelize, 'query', async (input, options = {}) => {
        // Sequelize.query deriva el modelo desde instance para INSERT.
        // Reproducir solo esa preparación al sustituir el transporte SQL.
        options = { ...options, model: options.model || options.instance?.constructor };
        const sql = typeof input === 'string' ? input : input.query;
        const bind = typeof input === 'string' ? options.bind : input.bind;
        queries.push({ sql, bind, type: options.type, model: options.model?.name,
            transaction: options.transaction?.id });
        if (/^START TRANSACTION/.test(sql)) {
            assert.equal(pendiente, undefined);
            pendiente = structuredClone(estado);
            return [];
        }
        if (/^COMMIT/.test(sql)) { assert.ok(pendiente); estado = pendiente; pendiente = undefined; return []; }
        if (/^ROLLBACK/.test(sql)) { pendiente = undefined; return []; }
        assert.match(sql, /^(?:SELECT|INSERT|UPDATE) /, sql);
        const current = options.transaction ? pendiente : estado;
        assert.ok(current, 'Las consultas transaccionales deben ejecutarse dentro de START/COMMIT');
        if (fallo) await fallo({ sql, options, current });
        const name = options.model?.name;
        if (options.type === db.Sequelize.QueryTypes.SELECT) {
            let rows;
            if (name === 'Usuario') {
                const id = Number(sql.match(/`Usuario`.`id_usuario` = (\d+)/)[1]);
                rows = current.usuarios.filter(row => row.id_usuario === id);
            } else if (name === 'Medicamento') {
                assert.match(sql, /FOR UPDATE/);
                const id = Number(sql.match(/`Medicamento`.`id_medicamento` = (\d+)/)[1]);
                rows = current.medicamentos.filter(row => row.id_medicamento === id);
            } else if (name === 'ProveedorLaboratorio') {
                assert.match(sql, /LOCK IN SHARE MODE/);
                const id = Number(sql.match(/`ProveedorLaboratorio`.`id_proveedor_laboratorio` = (\d+)/)[1]);
                rows = current.proveedores.filter(row => row.id_proveedor_laboratorio === id);
            } else if (name === 'ExistenciaMedicamento') {
                assert.match(sql, /FOR UPDATE/);
                const id = Number(sql.match(/`ExistenciaMedicamento`.`id_medicamento` = (\d+)/)[1]);
                rows = current.existencias.filter(row => row.id_medicamento === id);
                if (cambiarDiaBajoBloqueo) t.mock.timers.setTime(new Date('2026-11-01T04:15:00Z').getTime());
            } else if (name === 'Compra') {
                const clave = sql.match(/`Compra`.`clave_operacion` = '([^']+)'/)?.[1];
                const id = sql.match(/`Compra`.`id_compra` = (\d+)/)?.[1];
                rows = current.compras.filter(row => clave ? row.clave_operacion.toLowerCase() === clave.toLowerCase() : row.id_compra === Number(id));
                if (options.include?.length) rows = rows.map(row => ({ ...row,
                    proveedorLaboratorio: current.proveedores.find(p => p.id_proveedor_laboratorio === row.id_proveedor_laboratorio),
                    usuarioRegistrador: current.usuarios.find(u => u.id_usuario === row.id_usuario), usuarioAnulador: null,
                    detallesCompra: current.detalles.filter(d => d.id_compra === row.id_compra).map(d => {
                        const e = current.existencias.find(e => e.id_existencia === d.id_existencia);
                        return { ...d, existencia: { ...e, medicamento: current.medicamentos.find(m => m.id_medicamento === e.id_medicamento) } };
                    })
                }));
            } else throw new Error(`SELECT inesperado ${name}`);
            return build(options, rows);
        }
        assert.ok(options.transaction, 'Toda escritura debe incluir la transacción');
        if (options.type === db.Sequelize.QueryTypes.INSERT) {
            const model = options.model, pk = model.primaryKeyAttribute;
            const values = Object.fromEntries(Object.entries(options.instance.get({ plain: true }))
                .map(([key, value]) => [key, civil(value)]));
            if (name === 'Compra' && current.compras.some(row => row.clave_operacion.toLowerCase() === values.clave_operacion.toLowerCase())) {
                throw unique('uq_compra_clave_operacion', { clave_operacion: values.clave_operacion });
            }
            values[pk] = counters[name]++;
            if (name === 'Compra') Object.assign(values, { fecha_anulacion: null, motivo_anulacion: null, id_usuario_anulador: null });
            current[tabla[name]].push(values);
            options.instance.setDataValue(pk, values[pk]);
            return [options.instance, 1];
        }
        assert.equal(options.type, db.Sequelize.QueryTypes.BULKUPDATE);
        const value = campo => {
            const token = sql.match(new RegExp('`' + campo + '`\\s*=\\s*([^, ;]+)'))[1];
            return token.startsWith('$') ? bind[Number(token.slice(1)) - 1] : Number(token);
        };
        const row = current.existencias.find(row => row.id_existencia === Number(value('id_existencia')));
        assert.ok(row, JSON.stringify({ sql, bind }));
        row.cantidad_fisica = Number(value('cantidad_fisica'));
        row.costo_unitario_promedio = String(value('costo_unitario_promedio'));
        return 1;
    });
    const tokens = Object.fromEntries(Object.entries(ROLES).map(([rol, id]) => [rol,
        generarToken({ idUsuario: id, idRol: id, versionCredenciales: 0 })]));
    tokens.OTRO_ADMIN = generarToken({ idUsuario: 4, idRol: ROLES.ADMINISTRADOR, versionCredenciales: 0 });
    const linea = (extra = {}) => ({ idMedicamento: 1, cantidad: 100, costoUnitario: '0.7',
        precisionVencimiento: 'MES', fechaVencimiento: '2027-03', ...extra });
    const body = (detalles = [linea()], extra = {}) => ({ claveOperacion: 'Compra-ABC_123',
        fechaCompra: '2026-10-01', detalles, ...extra });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/api/compras`;
    const request = async (data, status = 201, rol = 'ADMINISTRADOR', path = '', token = tokens[rol]) => {
        peticiones++;
        const response = await fetch(`${base}${path}`, { method: 'POST', headers: {
            'Content-Type': 'application/json', ...(token ? { Cookie: `token=${token}` } : {})
        }, body: JSON.stringify(data), signal: AbortSignal.timeout(10000) });
        const result = await response.json();
        assert.equal(response.status, status, JSON.stringify(result));
        assert.doesNotMatch(JSON.stringify(result), /password|versionCredenciales|valor_sintetico|ER_LOCK|SELECT |INSERT /);
        assert.equal(pendiente, undefined, 'La respuesta llega después del commit o rollback');
        return result;
    };
    const rollback = before => {
        assert.deepEqual(estado, before);
        assert.match(queries.at(-1).sql, /^ROLLBACK/);
    };
    try {
        await t.test('Promedio agrupado y snapshots comunes; conserva cada detalle/movimiento y hora no retroactiva', async () => {
            reset();
            const result = await request(body([linea(), linea({ cantidad: 50, costoUnitario: '0.9' })]), 201, 'OTRO_ADMIN');
            assert.equal(result.message, 'Compra registrada exitosamente');
            assert.equal(result.data.idUsuario, 4);
            assert.equal(result.data.total, '115.00');
            assert.equal(result.data.fechaCompra, '2026-10-01');
            assert.equal(result.data.fechaRegistro, '2026-10-31 23:59:59');
            const e = estado.existencias.find(e => e.id_existencia === 8);
            assert.equal(e.cantidad_fisica, 250);
            assert.equal(e.costo_unitario_promedio, '0.660000');
            assert.deepEqual(estado.detalles.map(d => [d.saldo_anterior, d.costo_promedio_anterior]),
                [[100, '0.500000'], [100, '0.500000']]);
            assert.deepEqual(estado.movimientos.map(m => [m.id_usuario, m.id_existencia, m.cantidad,
                m.costo_unitario_aplicado, m.fecha_movimiento, m.direccion, m.motivo]),
            [[4, 8, 100, '0.700000', '2026-10-31 23:59:59', 'ENTRADA', 'Compra'],
                [4, 8, 50, '0.900000', '2026-10-31 23:59:59', 'ENTRADA', 'Compra']]);
            assert.deepEqual(estado.movimientos.map(m => m.id_detalle_compra), estado.detalles.map(d => d.id_detalle_compra));
            assert.ok(estado.movimientos.every(m => m.id_detalle_venta === null && m.id_movimiento_original === null));
            assert.match(queries.at(-1).sql, /^COMMIT/);
            for (const name of ['Compra', 'MovimientoInventario']) {
                const inserts = queries.filter(q => q.model === name && q.type === db.Sequelize.QueryTypes.INSERT);
                assert.ok(inserts.length);
                assert.ok(inserts.every(q => q.sql.includes("STR_TO_DATE('2026-10-31 23:59:59', '%Y-%m-%d %H:%i:%s')")));
            }
            const snapSql = queries.find(q => q.model === 'DetalleCompra' && q.type === db.Sequelize.QueryTypes.INSERT);
            assert.match(snapSql.sql, /`saldo_anterior`,`costo_promedio_anterior`/);
        });

        await t.test('Orden inverso de líneas conserva promedio; una única actualización por existencia', async () => {
            reset();
            await request(body([linea({ cantidad: 50, costoUnitario: '0.9' }), linea()]));
            assert.equal(estado.existencias.find(e => e.id_existencia === 8).costo_unitario_promedio, '0.660000');
            assert.equal(queries.filter(q => q.type === db.Sequelize.QueryTypes.BULKUPDATE).length, 1);
        });

        await t.test('Reutiliza agotadas, conserva su promedio anterior y calcula solo el valor nuevo', async () => {
            reset();
            await request(body([linea({ cantidad: 20, costoUnitario: '8', precisionVencimiento: 'DIA', fechaVencimiento: '2028-01-01' })]));
            assert.equal(estado.existencias.length, inicial.existencias.length);
            assert.equal(estado.detalles[0].id_existencia, 9);
            assert.equal(estado.detalles[0].saldo_anterior, 0);
            assert.equal(estado.detalles[0].costo_promedio_anterior, '5.000000');
            assert.equal(estado.existencias.find(e => e.id_existencia === 9).costo_unitario_promedio, '8.000000');
        });

        await t.test('Agrupa antes de redondear: evita un promedio distinto por redondeos intermedios', async () => {
            const lineas = [linea({ cantidad: 1, costoUnitario: '0.000002' }),
                linea({ cantidad: 1, costoUnitario: '0.000001' })];
            for (const orden of [lineas, [...lineas].reverse()]) {
                reset();
                estado.existencias[0].cantidad_fisica = 1;
                estado.existencias[0].costo_unitario_promedio = '0.000001';
                await request(body(orden));
                assert.equal(estado.existencias[0].cantidad_fisica, 3);
                // (1 + 2 + 1) / 3 = 1.333... millonésimas. Redondear tras la
                // primera línea produciría 2 millonésimas en uno de los órdenes.
                assert.equal(estado.existencias[0].costo_unitario_promedio, '0.000001');
                assert.ok(estado.detalles.every(d => d.saldo_anterior === 1 && d.costo_promedio_anterior === '0.000001'));
            }
        });

        await t.test('Nueva existencia usa mayor correlativo conservado, snapshot cero y suma de subtotales redondeados', async () => {
            reset();
            const detalle = linea({ cantidad: 1, costoUnitario: '0.005', precisionVencimiento: 'DIA', fechaVencimiento: '2027-03-15' });
            const result = await request(body([detalle, detalle, detalle]));
            assert.equal(result.data.total, '0.03');
            assert.equal(result.data.detalles.length, 3);
            assert.equal(estado.existencias.at(-1).codigo_existencia, 'PAR-011');
            assert.equal(estado.existencias.at(-1).cantidad_fisica, 3);
            assert.equal(estado.existencias.at(-1).costo_unitario_promedio, '0.005000');
            assert.ok(estado.detalles.every(d => d.saldo_anterior === 0 && d.costo_promedio_anterior === '0.000000'));
            assert.deepEqual(estado.existencias.find(e => e.id_existencia === 11), inicial.existencias[3]);
        });

        await t.test('Mantiene DIA/MES separados, fin de mes canónico y distintos correlativos en una compra', async () => {
            reset();
            await request(body([linea({ fechaVencimiento: '2027-04' }),
                linea({ precisionVencimiento: 'DIA', fechaVencimiento: '2027-04-30' })]));
            assert.deepEqual(estado.existencias.slice(-2).map(e => [e.codigo_existencia, e.fecha_vencimiento, e.precision_vencimiento]),
                [['PAR-011', '2027-04-30', 'MES'], ['PAR-012', '2027-04-30', 'DIA']]);
        });

        await t.test('Bloqueos estables por ID, proveedor compartido y todas las existencias antes de INSERT', async () => {
            reset();
            await request(body([linea({ idMedicamento: 2 }), linea()]));
            const med = queries.filter(q => q.model === 'Medicamento');
            assert.deepEqual(med.map(q => Number(q.sql.match(/`id_medicamento` = (\d+)/)[1])), [1, 2]);
            const firstInsert = queries.findIndex(q => q.type === db.Sequelize.QueryTypes.INSERT);
            const locks = queries.filter(q => q.model === 'ExistenciaMedicamento' && q.type === db.Sequelize.QueryTypes.SELECT);
            assert.equal(locks.length, 2);
            assert.ok(locks.every(q => queries.indexOf(q) < firstInsert && /FOR UPDATE/.test(q.sql)));
            assert.match(queries.find(q => q.model === 'ProveedorLaboratorio').sql, /LOCK IN SHARE MODE/);
        });

        await t.test('Límites representables: saldo INT máximo, costo DECIMAL máximo y subtotal 0.00', async () => {
            reset();
            await request(body([linea({ cantidad: 2147483647, costoUnitario: '0.000001', fechaVencimiento: '2027-05' })]));
            assert.equal(estado.existencias.at(-1).cantidad_fisica, 2147483647);
            assert.equal(estado.compras[0].total, '2147.48');
            reset();
            await request(body([linea({ cantidad: 1, costoUnitario: '99999999.999999', fechaVencimiento: '2027-05' })]));
            assert.equal(estado.existencias.at(-1).costo_unitario_promedio, '99999999.999999');
            reset();
            const result = await request(body([linea({ cantidad: 1, costoUnitario: '0.000001' })]));
            assert.equal(result.data.total, '0.00');
            assert.equal(estado.movimientos[0].costo_unitario_aplicado, '0.000001');
        });

        await t.test('Desbordamientos de subtotal, total y cantidades agrupadas se rechazan sin abrir transacción', async () => {
            for (const detalles of [
                [linea({ cantidad: 2147483647, costoUnitario: '99999999.999999' })],
                [linea({ cantidad: 10000, costoUnitario: '50000000' }), linea({ cantidad: 10000, costoUnitario: '50000000' })],
                [linea({ cantidad: 2147483647, costoUnitario: '0.000001' }), linea({ cantidad: 1, costoUnitario: '0.000001' })]
            ]) {
                reset(); const before = structuredClone(estado);
                await request(body(detalles), 400);
                assert.deepEqual(estado, before);
                assert.ok(!queries.some(q => /^START TRANSACTION/.test(q.sql)));
            }
            reset(); const before = structuredClone(estado);
            await request(body([linea({ cantidad: 2147483647, costoUnitario: '0.000001' })]), 409);
            rollback(before);
        });

        await t.test('Referencias inexistentes, inactivos y proveedores mixtos rechazan la compra completa', async () => {
            for (const [prepare, detalles, status] of [
                [() => {}, [linea({ idMedicamento: 99 })], 404],
                [() => { estado.medicamentos[0].estado = false; }, [linea()], 409],
                [() => { estado.proveedores = []; }, [linea()], 404],
                [() => { estado.proveedores[0].estado = false; }, [linea()], 409],
                [() => {}, [linea(), linea({ idMedicamento: 3 })], 409]
            ]) {
                reset(); prepare(); const before = structuredClone(estado);
                await request(body(detalles), status);
                rollback(before);
                assert.ok(!queries.some(q => q.type === db.Sequelize.QueryTypes.INSERT));
            }
        });

        await t.test('Fecha futura, DIA vencido y espera que cruza el corte MES usan el instante bajo bloqueo', async () => {
            for (const [detalles, fechaCompra, cruzar, status] of [
                [[linea()], '2026-11-01', false, 400],
                [[linea({ precisionVencimiento: 'DIA', fechaVencimiento: '2026-10-31' })], '1000-01-01', false, 409],
                [[linea({ fechaVencimiento: '2026-10' })], '2026-10-01', true, 409],
                [[linea(), linea({ fechaVencimiento: '2026-09' })], '2026-10-01', false, 409]
            ]) {
                reset(); cambiarDiaBajoBloqueo = cruzar; const before = structuredClone(estado);
                await request(body(detalles, { fechaCompra }), status);
                rollback(before);
                assert.ok(!queries.some(q => q.type === db.Sequelize.QueryTypes.INSERT));
            }
            reset();
            await request(body([linea({ fechaVencimiento: '2026-10' })], { fechaCompra: '1000-01-01' }));
            assert.equal(estado.existencias.at(-1).fecha_vencimiento, '2026-10-31');
        });

        await t.test('Longitud de código se comprueba sin reutilizar correlativos ni modificar históricos', async () => {
            reset();
            estado.medicamentos[0].codigo_medicamento = 'X'.repeat(20);
            estado.existencias[2].codigo_existencia = 'X'.repeat(20) + '-999999999';
            const before = structuredClone(estado);
            await request(body([linea({ fechaVencimiento: '2027-05' })]), 409);
            rollback(before);
        });

        await t.test('Una clave confirmada o anulada devuelve 409 sin recuperación ni datos de la compra previa', async () => {
            reset();
            await request(body());
            let before = structuredClone(estado);
            let count = queries.length;
            const repeated = await request(body([linea({ costoUnitario: '0.9' })]), 409, 'OTRO_ADMIN');
            assert.deepEqual(repeated, { message: 'La clave de operación ya está registrada' });
            assert.deepEqual(estado, before);
            assert.ok(queries.slice(count).every(q => q.type === db.Sequelize.QueryTypes.SELECT));
            estado.compras[0].estado_operacion = 'ANULADA';
            before = structuredClone(estado);
            count = queries.length;
            await request(body(), 409);
            assert.deepEqual(estado, before);
            assert.ok(queries.slice(count).every(q => q.type === db.Sequelize.QueryTypes.SELECT));
        });

        await t.test('UNIQUE específico y contención se traducen después del rollback; otros UNIQUE son independientes', async () => {
            for (const [error, status, mensaje] of [
                [unique('uq_compra_clave_operacion', { clave_operacion: 'privada' }), 409, /clave de operación ya/],
                [unique('uq_existencia_codigo'), 409, /código de existencia/],
                [unique('uq_existencia_medicamento_vencimiento_precision'), 409, /identificar la existencia/],
                [unique('indice_desconocido', { clave_operacion: 'privada' }), 500, /Error interno del servidor/],
                [new db.Sequelize.DatabaseError({ code: 'ER_LOCK_DEADLOCK', message: 'sintetico' }), 409, /contención temporal/],
                [new db.Sequelize.DatabaseError({ code: 'ER_LOCK_WAIT_TIMEOUT', message: 'sintetico' }), 409, /contención temporal/]
            ]) {
                reset(); const before = structuredClone(estado);
                fallo = ({ options }) => { if (options.type === db.Sequelize.QueryTypes.INSERT) throw error; };
                const result = await request(body(), status);
                assert.match(result.message, mensaje);
                rollback(before);
            }
        });

        await t.test('Fallo en cada etapa o en la lectura final revierte todo y permite reintentar la misma clave', async () => {
            for (const [model, type, numero] of [
                ['Compra', 'INSERT', 1], ['ExistenciaMedicamento', 'BULKUPDATE', 1],
                ['ExistenciaMedicamento', 'INSERT', 1], ['DetalleCompra', 'INSERT', 2],
                ['MovimientoInventario', 'INSERT', 2], ['Compra', 'SELECT', 2]
            ]) {
                reset(); const before = structuredClone(estado); let llamadas = 0;
                const datos = body([linea(), linea({ precisionVencimiento: 'DIA', fechaVencimiento: '2027-03-15' })]);
                fallo = ({ options }) => {
                    if (options.model?.name === model && options.type === db.Sequelize.QueryTypes[type] && ++llamadas === numero) {
                        throw new Error('fallo_tecnico_sintetico');
                    }
                };
                await request(datos, 500);
                rollback(before);
                fallo = undefined;
                await request(datos);
                assert.equal(estado.compras.length, 1);
                assert.equal(estado.detalles.length, 2);
                assert.equal(estado.movimientos.length, 2);
            }
        });

        await t.test('Autorización y validación HTTP bloquean cuerpos inválidos antes de abrir transacción', async () => {
            reset();
            for (const rol of ['REGENTE', 'VENDEDOR']) await request(body(), 403, rol);
            await request(body(), 401, null);
            await request(body(), 401, null, '', 'invalido');
            await request(body(), 401, 'ADMINISTRADOR', '',
                generarToken({ idUsuario: 1, idRol: 1, versionCredenciales: 1 }));
            for (const datos of [body([], {}), body([linea({ costoUnitario: '0' })]),
                body([linea({ costoUnitario: '0.0000001' })]), body([linea({ idExistencia: 8 })]),
                body([linea()], { idProveedorLaboratorio: 5 }), body([linea()], { idUsuario: 4 }),
                body([linea()], { total: '0.00' }), body([linea({ saldoAnterior: 1 })])]) {
                await request(datos, 400);
            }
            await request(body(), 400, 'ADMINISTRADOR', '?idUsuario=4');
            assert.ok(!queries.some(q => /^START TRANSACTION/.test(q.sql)));
        });
        t.diagnostic(`${peticiones} comprobaciones HTTP; SQL y transacciones gestionadas reales con transporte simulado (${conexionesSimuladas} conexiones sintéticas), sin MySQL.`);
    } finally {
        await new Promise(resolve => server.close(resolve));
        await db.sequelize.close();
    }
});
