import test from 'node:test';
import assert from 'node:assert/strict';

// Pruebas sin conexión ni preparación de MySQL. Ejecutar las capas HTTP,
// autenticación, Service, Repository y generación SQL reales; simular únicamente
// el resultado de SELECT. La integración contra MySQL se verifica por separado.
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'inventario_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_de_pruebas_inventario';

const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const { ROLES } = await import('../src/shared/constants/roles.js');

test('Fase 1A: HTTP, permisos, disponibilidad e historial sin escribir ni conectar a MySQL', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-01T03:59:59Z') });
    const existencia = (id, fecha, precision, cantidad, costo = '1.250000') => ({
        id_existencia: id, id_medicamento: 1, codigo_existencia: `PAR-${id}`,
        fecha_vencimiento: fecha, precision_vencimiento: precision,
        cantidad_fisica: cantidad, costo_unitario_promedio: costo
    });
    const medicamentos = [{
        id_medicamento: 1, codigo_medicamento: 'PAR', nombre_comercial: 'Paracetamol',
        forma_farmaceutica: 'Tableta', presentacion: '500 mg', unidad_inventario: 'tableta',
        stock_minimo: 10, estado: true,
        existencias: [existencia(1, '2026-10-31', 'MES', 5, '12345678.123456'),
            existencia(2, '2026-10-31', 'DIA', 7), existencia(3, '2026-11-01', 'DIA', 4),
            existencia(4, '2026-10-30', 'DIA', 3), existencia(5, '2027-01-01', 'DIA', 0)]
    }, {
        id_medicamento: 2, codigo_medicamento: 'INA', nombre_comercial: 'Inactivo',
        forma_farmaceutica: 'Tableta', presentacion: '100 mg', unidad_inventario: 'tableta',
        stock_minimo: 5, estado: false,
        existencias: [{ ...existencia(6, '2028-01-31', 'MES', 8), id_medicamento: 2 }]
    }, {
        id_medicamento: 3, codigo_medicamento: 'SIN', nombre_comercial: 'Sin existencias',
        forma_farmaceutica: 'Tableta', presentacion: '100 mg', unidad_inventario: 'tableta',
        stock_minimo: 0, estado: true, existencias: []
    }];
    const historialExistencia = {
        id_existencia: 6, id_medicamento: 2, codigo_existencia: 'INA-6',
        medicamento: { id_medicamento: 2, codigo_medicamento: 'INA', nombre_comercial: 'Inactivo', estado: false }
    };
    const historialUsuario = { id_usuario: 1, nombre_usuario: 'administrador',
        password_hash: 'dato_sintetico_privado', correo: 'privado@example.test' };
    const movimientos = [{
        id_movimiento: 20, id_existencia: 6, id_usuario: 1,
        id_detalle_compra: null, id_detalle_venta: null, id_movimiento_original: 10,
        direccion: 'SALIDA', cantidad: 8, fecha_movimiento: '2026-10-31 23:59:59',
        motivo: 'Reversión', observacion: 'Anulación', costo_unitario_aplicado: '12345678.123456',
        usuario: historialUsuario, existencia: historialExistencia,
        detalleCompra: null, detalleVenta: null, movimientoReversion: null
    }, {
        id_movimiento: 10, id_existencia: 6, id_usuario: 1,
        id_detalle_compra: 100, id_detalle_venta: null, id_movimiento_original: null,
        direccion: 'ENTRADA', cantidad: 8, fecha_movimiento: '2026-10-01 00:00:00',
        motivo: 'Compra', observacion: null, costo_unitario_aplicado: '12345678.123456',
        usuario: historialUsuario, existencia: historialExistencia,
        detalleCompra: { id_detalle_compra: 100, id_compra: 50 },
        detalleVenta: null, movimientoReversion: { id_movimiento: 20 }
    }];
    const before = structuredClone({ medicamentos, movimientos });
    const usuarios = Object.values(ROLES).map(idRol => ({
        id_usuario: idRol, id_rol: idRol, nombre_usuario: `usuario${idRol}`,
        estado: true, version_credenciales: 0
    }));
    const tokens = Object.fromEntries(Object.entries(ROLES).map(([rol, idRol]) => [rol,
        generarToken({ idUsuario: idRol, idRol, versionCredenciales: 0 })]));
    const queries = [];
    let selectedMedicamentos = medicamentos, selectedMovimientos = movimientos;
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => {
        throw new Error('Estas pruebas no deben conectar a MySQL');
    });
    t.mock.method(db.sequelize, 'query', async (sql, options) => {
        assert.equal(options.type, db.Sequelize.QueryTypes.SELECT);
        assert.match(sql, /^SELECT /);
        queries.push(sql);
        let rows;
        if (options.model === db.Usuario) {
            const idUsuario = Number(sql.match(/`Usuario`.`id_usuario` = (\d+)/)[1]);
            rows = usuarios.filter(u => u.id_usuario === idUsuario);
        } else if (options.model === db.Medicamento) {
            const idMedicamento = options.plain ? Number(sql.match(/`Medicamento`.`id_medicamento` = (\d+)/)[1]) : null;
            rows = options.plain ? medicamentos.filter(m => m.id_medicamento === idMedicamento) : selectedMedicamentos;
        } else if (options.model === db.MovimientoInventario) {
            rows = selectedMovimientos;
        } else throw new Error('Consulta inesperada');
        const instances = rows.map(row => options.model.build(structuredClone(row), {
            isNewRecord: false, raw: true, include: options.include
        }));
        return options.plain ? instances[0] ?? null : instances;
    });
    t.mock.method(console, 'error', () => {});

    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/api/inventario`;
    const request = async (rol, path, expectedStatus = 200, token = tokens[rol]) => {
        const response = await fetch(`${base}${path}`, {
            headers: token ? { Cookie: `token=${token}` } : {}, signal: AbortSignal.timeout(10000)
        });
        const result = await response.json();
        assert.equal(response.status, expectedStatus, `${rol ?? 'sin sesión'} ${path}: ${JSON.stringify(result)}`);
        assert.equal(/password|privado@example|versionCredenciales/.test(JSON.stringify(result)), false);
        return result;
    };
    try {
        await t.test('Inventario conserva agotadas, vencidas, inactivos y productos sin existencias', async () => {
            const result = await request('VENDEDOR', '');
            assert.deepEqual(result.meta, { fechaComercial: '2026-10-31', zonaHoraria: 'America/La_Paz' });
            assert.equal(result.data.length, 3);
            const [activo, inactivo, sinExistencias] = result.data;
            assert.equal(activo.stockFisico, 19);
            assert.equal(activo.stockVendible, 9);
            assert.deepEqual(activo.existencias.map(e => e.idExistencia), [4, 2, 1, 3, 5]);
            assert.equal(activo.existencias.find(e => e.idExistencia === 1).costoUnitarioPromedio, '12345678.123456');
            assert.equal(activo.existencias.find(e => e.idExistencia === 2).vencida, true);
            assert.equal(activo.existencias.find(e => e.idExistencia === 1).vencida, false);
            assert.equal(inactivo.stockFisico, 8);
            assert.equal(inactivo.stockVendible, 0);
            assert.equal(inactivo.existencias[0].vencida, false);
            assert.equal(inactivo.existencias[0].stockVendible, 0);
            assert.deepEqual(sinExistencias.existencias, []);
            assert.equal(sinExistencias.stockFisico, 0);
            assert.equal(sinExistencias.stockVendible, 0);
            const sql = queries.at(-1);
            assert.match(sql, /LEFT OUTER JOIN `existencia_medicamento`/);
            assert.doesNotMatch(sql, /WHERE|cantidad_fisica`\s*>/);
        });

        await t.test('Existencias: medicamento inexistente 404; existente sin existencias 200 y lista vacía', async () => {
            const result = await request('REGENTE', '/medicamentos/1/existencias');
            assert.equal(result.data.length, 5);
            assert.equal(result.meta.fechaComercial, '2026-10-31');
            assert.deepEqual((await request('REGENTE', '/medicamentos/3/existencias')).data, []);
            await request('REGENTE', '/medicamentos/2147483647/existencias', 404);
        });

        await t.test('Matriz de roles, sin sesión, token inválido, versión revocada y cuenta inactiva', async () => {
            for (const rol of Object.keys(ROLES)) {
                await request(rol, '');
                await request(rol, '/medicamentos/1/existencias');
                await request(rol, '/movimientos', rol === 'VENDEDOR' ? 403 : 200);
            }
            for (const path of ['', '/medicamentos/1/existencias', '/movimientos']) {
                await request(null, path, 401);
                await request(null, path, 401, 'invalido');
            }
            await request('ADMINISTRADOR', '', 401, generarToken({ idUsuario: 1, idRol: 1, versionCredenciales: 1 }));
            usuarios[0].estado = false;
            await request('ADMINISTRADOR', '', 401);
            usuarios[0].estado = true;
            // El rol de la cuenta, no el indicado en el JWT, gobierna la autorización.
            await request('ADMINISTRADOR', '/movimientos', 403,
                generarToken({ idUsuario: ROLES.VENDEDOR, idRol: ROLES.ADMINISTRADOR, versionCredenciales: 0 }));
        });

        await t.test('Filtros válidos generan SQL escapado; IDs y rangos no se interpolan como SQL', async () => {
            await request('REGENTE', '?idMedicamento=1&codigoMedicamento=PAR&nombreComercial=Paracetamol');
            assert.match(queries.at(-1), /`Medicamento`.`id_medicamento` = 1/);
            assert.match(queries.at(-1), /`codigo_medicamento` LIKE '%PAR%'/);
            assert.match(queries.at(-1), /`nombre_comercial` LIKE '%Paracetamol%'/);
            await request('REGENTE', `?codigoMedicamento=${encodeURIComponent("%' OR 1=1 --_")}`);
            const sql = queries.at(-1);
            assert.match(sql, /LIKE '/);
            assert.equal(sql.includes("\\' OR 1=1"), true);
            assert.equal(sql.includes('\\\\%'), true);
            assert.equal(sql.includes('\\\\_'), true);
            await request('REGENTE', '/movimientos?idMedicamento=2&idExistencia=6&desde=2026-10-01&hasta=2026-10-31&direccion=ENTRADA&motivo=Compra');
            const movementSql = queries.at(-1);
            assert.match(movementSql, /`existencia`.`id_medicamento` = 2/);
            assert.match(movementSql, /`MovimientoInventario`.`id_existencia` = 6/);
            assert.match(movementSql, /`fecha_movimiento` >= '2026-10-01 00:00:00'/);
            assert.match(movementSql, /`fecha_movimiento` <= '2026-10-31 23:59:59.999999'/);
            assert.match(movementSql, /`direccion` = 'ENTRADA'/);
            assert.match(movementSql, /`motivo` = 'Compra'/);
            assert.doesNotMatch(movementSql, /password_hash|version_credenciales|`correo`/);
        });

        await t.test('Validación HTTP estricta rechaza datos antes de consultar inventario', async () => {
            for (const path of ['?estado=true', '?idMedicamento=1e2', '?idMedicamento=1&idMedicamento=2',
                '?codigoMedicamento=', '?nombreComercial=a&nombreComercial=b',
                '/medicamentos/0/existencias', '/medicamentos/abc/existencias',
                '/medicamentos/1/existencias?estado=true',
                '/movimientos?desde=2026-02-29', '/movimientos?desde=2026-11-01&hasta=2026-10-31',
                '/movimientos?direccion=salida', '/movimientos?idExistencia=1%20OR%201=1',
                '/movimientos?idUsuario=1']) {
                const count = queries.length;
                await request('REGENTE', path, 400);
                assert.equal(queries.length, count + 1, 'Solo se consulta la sesión antes del rechazo');
            }
        });

        await t.test('Historial conserva originales, reversiones, costos y DATETIME sin sufijo UTC', async () => {
            const result = await request('ADMINISTRADOR', '/movimientos');
            assert.deepEqual(result.data.map(m => m.idMovimiento), [20, 10]);
            assert.equal(result.data[0].idMovimientoOriginal, 10);
            assert.equal(result.data[1].idMovimientoReversion, 20);
            assert.equal(result.data[0].costoUnitarioAplicado, '12345678.123456');
            assert.equal(result.data[0].fechaMovimiento, '2026-10-31 23:59:59');
            assert.deepEqual(result.data[1].compra, { idCompra: 50, idDetalleCompra: 100 });
            assert.deepEqual(result.data[0].usuario, { idUsuario: 1, nombreUsuario: 'administrador' });
            assert.equal(result.data[0].existencia.medicamento.estado, false);
            assert.match(queries.at(-1), /DATE_FORMAT\(`MovimientoInventario`.`fecha_movimiento`, '%Y-%m-%d %H:%i:%s'\)/);
            selectedMovimientos = [];
            assert.deepEqual((await request('REGENTE', '/movimientos')).data, []);
            selectedMovimientos = movimientos;
        });

        await t.test('Fase 1B: alertas reutilizan disponibilidad y distinguen etiqueta y fecha efectiva', async () => {
            const proximos = await request('REGENTE', '/proximos-a-vencer');
            assert.deepEqual(proximos.meta, {
                fechaComercial: '2026-10-31', zonaHoraria: 'America/La_Paz', fechaHasta: '2027-01-31'
            });
            assert.deepEqual(proximos.data.map(e => e.idExistencia), [1, 3]);
            assert.equal(proximos.data[0].fechaEtiquetaNormalizada, '2026-10-31');
            assert.equal(proximos.data[0].fechaEfectivaVencimiento, '2026-11-01');
            assert.equal(proximos.data[0].medicamento.nombreComercial, 'Paracetamol');
            const vencidos = await request('ADMINISTRADOR', '/vencidos');
            assert.deepEqual(vencidos.data.map(e => e.idExistencia), [4, 2]);
            assert.equal(vencidos.data.every(e => e.stockFisico > 0 && e.vencida), true);
            const bajos = await request('VENDEDOR', '/stock-bajo');
            assert.deepEqual(bajos.data.map(m => m.idMedicamento), [1, 3]);
            assert.equal(bajos.data[1].stockVendible, bajos.data[1].stockMinimo);
            assert.equal(bajos.data.every(m => m.estado), true);
        });

        await t.test('Fase 1B: permisos y filtros estrictos de las tres consultas', async () => {
            for (const path of ['/proximos-a-vencer', '/vencidos', '/stock-bajo']) {
                for (const rol of Object.keys(ROLES)) {
                    await request(rol, path, rol === 'VENDEDOR' && path !== '/stock-bajo' ? 403 : 200);
                }
                await request(null, path, 401);
                await request('REGENTE', `${path}?estado=true`, 400);
                await request('REGENTE', `${path}?meses=6`, 400);
                await request('REGENTE', `${path}?idMedicamento=1&idMedicamento=2`, 400);
            }
        });

        await t.test('Cambio de día comercial retira vendibilidad sin alterar el saldo físico', async () => {
            t.mock.timers.setTime(new Date('2026-11-01T04:00:00Z').getTime());
            const result = await request('VENDEDOR', '');
            assert.equal(result.meta.fechaComercial, '2026-11-01');
            assert.equal(result.data[0].stockFisico, 19);
            assert.equal(result.data[0].stockVendible, 0);
            assert.equal(result.data[0].existencias.find(e => e.idExistencia === 1).vencida, true);
            assert.deepEqual((await request('REGENTE', '/proximos-a-vencer')).data, []);
            assert.deepEqual((await request('REGENTE', '/vencidos')).data.map(e => e.idExistencia), [4, 2, 1, 3]);
            assert.deepEqual({ medicamentos, movimientos }, before);
        });

        await t.test('Sin coincidencias devuelve lista vacía; errores técnicos conservan respuesta 500 genérica', async () => {
            selectedMedicamentos = [];
            assert.deepEqual((await request('VENDEDOR', '?codigoMedicamento=NOEXISTE')).data, []);
            const queryMock = t.mock.method(db.Medicamento, 'findAll', () => {
                throw new Error('detalle_tecnico_sintetico_no_exponer');
            });
            const result = await request('REGENTE', '', 500);
            assert.deepEqual(result, { message: 'Error interno del servidor' });
            queryMock.mock.restore();
        });
        t.diagnostic(`${queries.length} SELECT generados por Sequelize; sin conexiones ni escrituras MySQL.`);
    } finally {
        await new Promise(resolve => server.close(resolve));
        await db.sequelize.close();
    }
});
