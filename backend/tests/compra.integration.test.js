import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Estas pruebas crean, migran, escriben y eliminan una base local exclusiva.
// Nunca usar la base configurada de desarrollo, producción o pruebas compartidas.
dotenv.config({ quiet: true });
const testDatabase = process.env.DB_NAME_TEST;
const protectedDatabases = [process.env.DB_NAME, process.env.DB_NAME_PRODUCTION].filter(Boolean);
assert.ok(testDatabase, 'Configurar DB_NAME_TEST para ejecutar integración');
assert.equal(protectedDatabases.some(name => name.toLowerCase() === testDatabase.toLowerCase()), false);
assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), 'Usar MySQL local');
const temporaryDatabase = `${testDatabase.slice(0, 25)}_compras_${randomBytes(6).toString('hex')}`;
assert.match(temporaryDatabase, /^[a-zA-Z0-9_]+$/);
assert.equal([testDatabase, ...protectedDatabases].some(name => name.toLowerCase() === temporaryDatabase.toLowerCase()), false);
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = temporaryDatabase;
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_de_integracion_compras';

const executeFile = promisify(execFile);
const cliPath = fileURLToPath(new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url));
const runCli = async command => {
    try {
        await executeFile(process.execPath, [cliPath, command, '--env', 'test'], {
            cwd: fileURLToPath(new URL('../', import.meta.url)), env: { ...process.env }, timeout: 60000
        });
    } catch { throw new Error(`Sequelize CLI: ${command} falló en la base temporal de Compras`); }
};
const require = createRequire(import.meta.url);
const migracionB1 = require('../src/data/database/migrations/20261010120000-add-compra-existencia-snapshots.js');

test('Compras CU25–CU27: HTTP/MySQL, persistencia, rollback y concurrencia en base temporal', { timeout: 240000 }, async t => {
    let databaseCreated = false, db, server, requests = 0;
    const queries = [];
    try {
        await runCli('db:create'); databaseCreated = true;
        await runCli('db:migrate');
        ({ default: db } = await import('../src/data/models/index.js'));
        assert.equal(db.sequelize.config.database, temporaryDatabase);
        db.sequelize.options.logging = false;
        const { app } = await import('../src/app.js');
        const { generarToken } = await import('../src/shared/utils/jwt.js');
        const { ROLES } = await import('../src/shared/constants/roles.js');
        const { compraRepository } = await import('../src/data/repositories/compra.repository.js');
        const { medicamentoRepository } = await import('../src/data/repositories/medicamento.repository.js');
        const { existenciaMedicamentoRepository } = await import('../src/data/repositories/existencia-medicamento.repository.js');
        const { movimientoInventarioRepository } = await import('../src/data/repositories/movimiento-inventario.repository.js');
        const { decimalAEntero, dividirYRedondear, enteroADecimal } = await import('../src/shared/utils/decimal.js');
        const queryInterface = db.sequelize.getQueryInterface();
        const select = (sql, extra = {}) => db.sequelize.query(sql, { type: db.Sequelize.QueryTypes.SELECT, ...extra });
        const originalQuery = db.sequelize.query.bind(db.sequelize);
        t.mock.method(db.sequelize, 'query', (sql, options) => {
            assert.equal(db.sequelize.config.database, temporaryDatabase);
            queries.push(typeof sql === 'string' ? sql : sql.query);
            return originalQuery(sql, options);
        });
        t.mock.method(console, 'error', () => {});
        await db.Rol.bulkCreate(Object.entries(ROLES).map(([nombre, id_rol]) => ({ id_rol, nombre })));
        const hash = await bcrypt.hash('Sintetica-Compras-123!', 4);
        const usuarios = {};
        for (const [rol, idRol] of Object.entries(ROLES)) {
            usuarios[rol] = await db.Usuario.create({ id_rol: idRol, nombre_usuario: `compras_${rol}`, password_hash: hash });
        }
        usuarios.OTRO_ADMIN = await db.Usuario.create({ id_rol: ROLES.ADMINISTRADOR,
            nombre_usuario: 'compras_otro_admin', password_hash: hash });
        const proveedor = await db.ProveedorLaboratorio.create({ nombre: 'Proveedor sintético de Compras' });
        const otroProveedor = await db.ProveedorLaboratorio.create({ nombre: 'Otro proveedor sintético' });
        const crearMedicamento = (codigo, extra = {}) => db.Medicamento.create({
            id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio, codigo_medicamento: codigo,
            nombre_comercial: `Producto ${codigo}`, forma_farmaceutica: 'Tableta', presentacion: '500 mg',
            unidad_inventario: 'tableta', stock_minimo: 10, condicion_venta: 'Venta libre',
            via_administracion: 'Oral', tipo_liberacion: 'Inmediata', ...extra
        });
        const civil = fecha => db.Sequelize.fn('STR_TO_DATE', fecha, '%Y-%m-%d %H:%i:%s');
        const movimientoFixture = (existencia, cantidad, direccion = 'ENTRADA', extra = {}) => db.MovimientoInventario.create({
            id_existencia: existencia.id_existencia, id_usuario: usuarios.REGENTE.id_usuario,
            cantidad, direccion, costo_unitario_aplicado: existencia.costo_unitario_promedio,
            motivo: 'Ajuste', fecha_movimiento: civil('2026-10-01 08:00:00'), ...extra
        });
        const crearExistencia = async (medicamento, codigo, fecha, precision, cantidad, costo) => {
            const existencia = await db.ExistenciaMedicamento.create({ id_medicamento: medicamento.id_medicamento,
                codigo_existencia: codigo, fecha_vencimiento: fecha, precision_vencimiento: precision,
                cantidad_fisica: cantidad, costo_unitario_promedio: costo });
            if (cantidad) await movimientoFixture(existencia, cantidad);
            return existencia;
        };
        const agrupado = await crearMedicamento('AGR');
        const existente = await crearExistencia(agrupado, 'AGR-008', '2027-03-31', 'MES', 100, '0.500000');
        const agotada = await crearExistencia(agrupado, 'AGR-002', '2028-01-01', 'DIA', 0, '5.000000');
        await movimientoFixture(agotada, 1); await movimientoFixture(agotada, 1, 'SALIDA');
        await crearExistencia(agrupado, 'AGR-010', '2030-01-01', 'DIA', 0, '0.400000');
        const historico = await crearMedicamento('HIS');
        const existenciaHistorica = await db.ExistenciaMedicamento.create({ id_medicamento: historico.id_medicamento,
            codigo_existencia: 'HIS-001', fecha_vencimiento: '2027-04-15', precision_vencimiento: 'MES',
            cantidad_fisica: 3, costo_unitario_promedio: '0.123456' });
        const compraHistorica = await db.Compra.create({ id_usuario: usuarios.ADMINISTRADOR.id_usuario,
            id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio, fecha_compra: '2026-10-01',
            fecha_registro: civil('2026-10-01 08:00:00'), clave_operacion: 'LEGADO-Mayusculas', total: '0.37' });
        const detalleHistorico = await db.DetalleCompra.create({ id_compra: compraHistorica.id_compra,
            id_existencia: existenciaHistorica.id_existencia, cantidad: 3, costo_unitario: '0.123456', subtotal: '0.37' });
        await movimientoFixture(existenciaHistorica, 3, 'ENTRADA', { motivo: 'Compra', id_detalle_compra: detalleHistorico.id_detalle_compra });
        const anuladaMed = await crearMedicamento('ANU');
        const anuladaExistencia = await crearExistencia(anuladaMed, 'ANU-001', '2027-05-31', 'MES', 0, '2.000000');
        const compraAnulada = await db.Compra.create({ id_usuario: usuarios.OTRO_ADMIN.id_usuario,
            id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio, clave_operacion: 'clave-anulada',
            fecha_compra: '2026-10-01', fecha_registro: civil('2026-10-01 08:00:00'), total: '2.00',
            estado_operacion: 'ANULADA', fecha_anulacion: civil('2026-10-31 12:34:56'),
            motivo_anulacion: 'Anulación histórica sintética', id_usuario_anulador: usuarios.ADMINISTRADOR.id_usuario });
        const detalleAnulado = await db.DetalleCompra.create({ id_compra: compraAnulada.id_compra,
            id_existencia: anuladaExistencia.id_existencia, cantidad: 1, costo_unitario: '2.000000', subtotal: '2.00' });
        const originalAnulado = await movimientoFixture(anuladaExistencia, 1, 'ENTRADA', {
            motivo: 'Compra', id_detalle_compra: detalleAnulado.id_detalle_compra });
        await movimientoFixture(anuladaExistencia, 1, 'SALIDA', { motivo: 'Reversión',
            id_detalle_compra: detalleAnulado.id_detalle_compra,
            id_movimiento_original: originalAnulado.id_movimiento, fecha_movimiento: civil('2026-10-31 12:34:56') });
        const snapshot = async () => {
            const result = {};
            for (const model of [db.Compra, db.DetalleCompra, db.ExistenciaMedicamento, db.MovimientoInventario]) {
                result[model.name] = await model.findAll({ raw: true, order: [[model.primaryKeyAttribute, 'ASC']] });
            }
            return result;
        };
        const detallesCompra = id => db.DetalleCompra.findAll({ where: { id_compra: id }, raw: true, order: [['id_detalle_compra', 'ASC']] });
        const movimientosCompra = id => select('SELECT m.* FROM movimiento_inventario m JOIN detalle_compra d ON d.id_detalle_compra = m.id_detalle_compra WHERE d.id_compra = :id ORDER BY m.id_movimiento', { replacements: { id } });
        const instante = new Date('2026-11-01T04:15:00Z');
        t.mock.timers.enable({ apis: ['Date'], now: instante });
        const tokens = Object.fromEntries(Object.entries(usuarios).map(([rol, usuario]) => [rol,
            generarToken({ idUsuario: usuario.id_usuario, idRol: usuario.id_rol, versionCredenciales: 0 })]));
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
        const base = `http://127.0.0.1:${server.address().port}/api`;
        const request = async (method, path, status, body, rol = 'ADMINISTRADOR', token = tokens[rol]) => {
            const response = await fetch(`${base}${path}`, { method, headers: {
                ...(token ? { Cookie: `token=${token}` } : {}),
                ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
            }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000) });
            requests++;
            const result = await response.json();
            assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`);
            assert.equal(/"(?:password|password_hash|passwordHash|token|correo|versionCredenciales|version_credenciales)"\s*:/.test(JSON.stringify(result)), false);
            return result;
        };
        const linea = (med = agrupado, extra = {}) => ({ idMedicamento: med.id_medicamento, cantidad: 100,
            costoUnitario: '0.7', precisionVencimiento: 'MES', fechaVencimiento: '2027-03', ...extra });
        const body = (claveOperacion, detalles = [linea()], extra = {}) => ({ claveOperacion, fechaCompra: '2026-10-01', detalles, ...extra });
        const post = (data, status = 201, rol = 'ADMINISTRADOR') => request('POST', '/compras', status, data, rol);
        const waitForBlocker = async transaction => {
            const [{ id }] = await select('SELECT CONNECTION_ID() AS id', { transaction });
            const deadline = performance.now() + 10000;
            while (performance.now() < deadline) {
                const [{ total }] = await select('SELECT COUNT(*) AS total FROM performance_schema.data_lock_waits w JOIN performance_schema.threads th ON th.THREAD_ID = w.BLOCKING_THREAD_ID WHERE th.PROCESSLIST_ID = :id', { replacements: { id } });
                if (Number(total) > 0) return;
                await delay(20);
            }
            assert.fail('No se observó una espera real de InnoDB sobre el bloqueo preparado');
        };

        await t.test('B1 real: migración aditiva preserva históricos y CHECK rechaza pares incompletos o negativos', async () => {
            const original = await select('SELECT id_detalle_compra, id_compra, id_existencia, cantidad, costo_unitario, subtotal FROM detalle_compra ORDER BY id_detalle_compra');
            // En esta base exclusiva no hay snapshots: ejercer down/up sin backfill.
            await migracionB1.down(queryInterface, db.Sequelize);
            assert.deepEqual(await select('SELECT * FROM detalle_compra ORDER BY id_detalle_compra'), original);
            await migracionB1.up(queryInterface);
            const rows = await detallesCompra(compraHistorica.id_compra);
            assert.equal(rows[0].saldo_anterior, null); assert.equal(rows[0].costo_promedio_anterior, null);
            for (const [saldo, costo] of [[null, '0.000000'], [0, null], [-1, '0.000000'], [0, '-0.000001'], [-1, null], [null, '-0.000001']]) {
                await assert.rejects(db.DetalleCompra.update({ saldo_anterior: saldo, costo_promedio_anterior: costo },
                    { where: { id_detalle_compra: detalleHistorico.id_detalle_compra } }),
                error => error.parent?.code === 'ER_CHECK_CONSTRAINT_VIOLATED' && /chk_detalle_compra_estado_anterior/.test(error.parent.sqlMessage));
            }
            const transaction = await db.sequelize.transaction();
            try {
                await db.DetalleCompra.update({ saldo_anterior: 2147483647, costo_promedio_anterior: '99999999.999999' },
                    { where: { id_detalle_compra: detalleHistorico.id_detalle_compra }, transaction });
                const row = await db.DetalleCompra.findByPk(detalleHistorico.id_detalle_compra, { transaction });
                assert.equal(row.saldo_anterior, 2147483647); assert.equal(row.costo_promedio_anterior, '99999999.999999');
            } finally { await transaction.rollback(); }
            assert.deepEqual(await select('SELECT id_detalle_compra, id_compra, id_existencia, cantidad, costo_unitario, subtotal FROM detalle_compra ORDER BY id_detalle_compra'), original);
        });

        let primeraCompra;
        await t.test('Registro real: promedio agrupado, snapshots comunes y misma hora civil a las 00:15 de La Paz', async () => {
            const { data } = await post(body('Compra-Temporal', [linea(), linea(agrupado, { cantidad: 50, costoUnitario: '0.9' })]));
            primeraCompra = data;
            assert.equal(data.total, '115.00'); assert.equal(data.claveOperacion, 'compra-temporal');
            assert.equal(data.fechaCompra, '2026-10-01'); assert.equal(data.fechaRegistro, '2026-11-01 00:15:00');
            const e = await db.ExistenciaMedicamento.findByPk(existente.id_existencia);
            assert.equal(e.cantidad_fisica, 250); assert.equal(e.costo_unitario_promedio, '0.660000');
            const detalles = await detallesCompra(data.idCompra);
            assert.deepEqual(detalles.map(d => [d.saldo_anterior, d.costo_promedio_anterior]), [[100, '0.500000'], [100, '0.500000']]);
            const horas = await select("SELECT DATE_FORMAT(c.fecha_registro, '%Y-%m-%d %H:%i:%s') AS registro, DATE_FORMAT(m.fecha_movimiento, '%Y-%m-%d %H:%i:%s') AS movimiento FROM compra c JOIN detalle_compra d ON d.id_compra = c.id_compra JOIN movimiento_inventario m ON m.id_detalle_compra = d.id_detalle_compra WHERE c.id_compra = :id", { replacements: { id: data.idCompra } });
            assert.equal(horas.length, 2);
            assert.ok(horas.every(h => h.registro === '2026-11-01 00:15:00' && h.movimiento === h.registro));
            const originales = await movimientosCompra(data.idCompra);
            assert.deepEqual(originales.map(m => [m.cantidad, m.costo_unitario_aplicado, m.id_existencia]),
                [[100, '0.700000', existente.id_existencia], [50, '0.900000', existente.id_existencia]]);
            assert.ok(originales.every(m => m.direccion === 'ENTRADA' && m.motivo === 'COMPRA' && m.id_detalle_venta === null && m.id_movimiento_original === null));
            assert.deepEqual(originales.map(m => m.id_detalle_compra), detalles.map(d => d.id_detalle_compra));
            const [{ zonaSesion }] = await select('SELECT @@SESSION.time_zone AS zonaSesion');
            assert.equal(zonaSesion, '+00:00', 'La escritura civil no cambia el timezone global de Sequelize');
            await assert.rejects(migracionB1.down(queryInterface, db.Sequelize), /Se debe conservar esa información histórica/);
        });

        await t.test('Reutiliza agotadas y crea desde el mayor correlativo sin corregir MES histórico', async () => {
            const recibida = (await post(body('agotada', [linea(agrupado, { cantidad: 20, costoUnitario: '8', precisionVencimiento: 'DIA', fechaVencimiento: '2028-01-01' })]))).data;
            assert.equal(recibida.detalles[0].idExistencia, agotada.id_existencia);
            const [detalle] = await detallesCompra(recibida.idCompra);
            assert.equal(detalle.saldo_anterior, 0); assert.equal(detalle.costo_promedio_anterior, '5.000000');
            assert.equal((await db.ExistenciaMedicamento.findByPk(agotada.id_existencia)).costo_unitario_promedio, '8.000000');
            const l = linea(agrupado, { cantidad: 1, costoUnitario: '0.005', precisionVencimiento: 'DIA', fechaVencimiento: '2027-03-15' });
            const nueva = (await post(body('nueva-centavos', [l, l, l]))).data;
            assert.equal(nueva.total, '0.03'); assert.equal(nueva.detalles[0].existencia.codigoExistencia, 'AGR-011');
            assert.ok((await detallesCompra(nueva.idCompra)).every(d => d.saldo_anterior === 0 && d.costo_promedio_anterior === '0.000000'));
            await post(body('mes-canonico', [linea(historico, { fechaVencimiento: '2027-04' })]));
            assert.equal((await db.ExistenciaMedicamento.findByPk(existenciaHistorica.id_existencia)).fecha_vencimiento, '2027-04-15');
            const historicas = await request('GET', `/inventario/medicamentos/${historico.id_medicamento}/existencias`, 200);
            assert.deepEqual(historicas.data.map(e => e.fechaVencimiento).sort(), ['2027-04-15', '2027-04-30']);
            assert.equal((await detallesCompra(compraHistorica.id_compra))[0].saldo_anterior, null);
        });

        await t.test('Redondeo agrupado real es independiente del orden y conserva costos diminutos', async () => {
            for (const [codigo, costos] of [['RD1', ['0.000002', '0.000001']], ['RD2', ['0.000001', '0.000002']]]) {
                const med = await crearMedicamento(codigo);
                const e = await crearExistencia(med, `${codigo}-001`, '2027-03-31', 'MES', 1, '0.000001');
                const datos = (await post(body(codigo, costos.map(costoUnitario => linea(med, { cantidad: 1, costoUnitario }))))).data;
                const actual = await db.ExistenciaMedicamento.findByPk(e.id_existencia);
                assert.equal(actual.cantidad_fisica, 3); assert.equal(actual.costo_unitario_promedio, '0.000001');
                assert.equal(datos.total, '0.00');
            }
        });

        await t.test('DIA/MES de la misma fecha son existencias distintas; MES conserva el último día inclusive', async () => {
            const med = await crearMedicamento('DYM');
            const recibida = (await post(body('precision-mixta', [
                linea(med, { cantidad: 2, costoUnitario: '1', fechaVencimiento: '2027-03' }),
                linea(med, { cantidad: 2, costoUnitario: '2', precisionVencimiento: 'DIA', fechaVencimiento: '2027-03-31' })
            ]))).data;
            assert.notEqual(recibida.detalles[0].idExistencia, recibida.detalles[1].idExistencia);
            assert.ok(recibida.detalles.every(d => d.existencia.fechaVencimiento === '2027-03-31'));
            const ultimo = await crearMedicamento('ULTMES');
            try {
                t.mock.timers.setTime(new Date('2026-11-01T03:59:59Z').getTime());
                const mes = (await post(body('ultimo-dia-mes', [linea(ultimo, { cantidad: 3, fechaVencimiento: '2026-10' })]))).data;
                assert.equal(mes.fechaRegistro, '2026-10-31 23:59:59');
                const before = await snapshot();
                await post(body('ultimo-dia-exacto', [linea(ultimo, { precisionVencimiento: 'DIA', fechaVencimiento: '2026-10-31' })]), 409);
                assert.deepEqual(await snapshot(), before);
                t.mock.timers.setTime(instante.getTime());
                const inventario = (await request('GET', `/inventario?idMedicamento=${ultimo.id_medicamento}`, 200)).data[0];
                assert.equal(inventario.stockFisico, 3); assert.equal(inventario.stockVendible, 0);
            } finally { t.mock.timers.setTime(instante.getTime()); }
        });

        await t.test('Límites reales de INT/DECIMAL y rechazo de desbordamientos sin efectos parciales', async () => {
            const med = await crearMedicamento('LIM');
            const maxima = (await post(body('limite-int', [linea(med, { cantidad: 2147483647, costoUnitario: '0.000001' })]))).data;
            assert.equal(maxima.total, '2147.48');
            assert.equal((await db.ExistenciaMedicamento.findByPk(maxima.detalles[0].idExistencia)).cantidad_fisica, 2147483647);
            const costosa = (await post(body('limite-costo', [linea(med, { cantidad: 1, costoUnitario: '99999999.999999', fechaVencimiento: '2027-04' })]))).data;
            assert.equal((await db.ExistenciaMedicamento.findByPk(costosa.detalles[0].idExistencia)).costo_unitario_promedio, '99999999.999999');
            const before = await snapshot();
            for (const [clave, detalles, status] of [
                ['exceso-saldo', [linea(med, { cantidad: 1, costoUnitario: '0.000001' })], 409],
                ['exceso-subtotal', [linea(med, { cantidad: 2147483647, costoUnitario: '99999999.999999' })], 400],
                ['exceso-total', [linea(med, { cantidad: 10000, costoUnitario: '50000000' }), linea(med, { cantidad: 10000, costoUnitario: '50000000' })], 400],
                ['exceso-grupo', [linea(med, { cantidad: 2147483647, costoUnitario: '0.000001' }), linea(med, { cantidad: 1, costoUnitario: '0.000001' })], 400]
            ]) await post(body(clave, detalles), status);
            assert.deepEqual(await snapshot(), before);
        });

        await t.test('Proveedor único, activos, fechas, permisos y formatos inválidos no escriben compras', async () => {
            const inactivo = await crearMedicamento('INA', { estado: false });
            const mixto = await crearMedicamento('MIX', { id_proveedor_laboratorio: otroProveedor.id_proveedor_laboratorio });
            const before = await snapshot();
            await post(body('inactivo', [linea(inactivo)]), 409);
            await post(body('mixto', [linea(), linea(mixto)]), 409);
            await post(body('no-existe', [linea({ id_medicamento: 2147483647 })]), 404);
            await post(body('futura', [linea()], { fechaCompra: '2026-11-02' }), 400);
            await post(body('mes-vencido', [linea(agrupado, { fechaVencimiento: '2026-10' })], { fechaCompra: '1000-01-01' }), 409);
            await post(body('dia-vencido', [linea(agrupado, { precisionVencimiento: 'DIA', fechaVencimiento: '2026-11-01' })]), 409);
            for (const rol of ['REGENTE', 'VENDEDOR']) await post(body(`rol-${rol}`), 403, rol);
            await post(body('sin-sesion'), 401, null);
            for (const datos of [body('precision', [linea(agrupado, { costoUnitario: '0.7000000' })]),
                body('numero', [linea(agrupado, { costoUnitario: 0.7 })]), body('proveedor', [linea()], { idProveedorLaboratorio: 1 }),
                body('snapshot', [linea(agrupado, { saldoAnterior: 0 })]), body('vacia', [])]) await post(datos, 400);
            assert.deepEqual(await snapshot(), before);
        });

        await t.test('Consulta real conserva historial y recupera por clave exclusivamente al usuario de sesión', async () => {
            const ajena = (await post(body('clave-otro-admin', [linea()], { fechaCompra: '2026-11-01' }), 201, 'OTRO_ADMIN')).data;
            assert.deepEqual((await request('GET', '/compras?claveOperacion=CLAVE-OTRO-ADMIN', 200)).data, []);
            assert.deepEqual((await request('GET', '/compras?claveOperacion=clave-otro-admin', 200, undefined, 'OTRO_ADMIN')).data.map(c => c.idCompra), [ajena.idCompra]);
            assert.deepEqual((await request('GET', '/compras?claveOperacion=clave-otro-admin', 200, undefined, 'REGENTE')).data, []);
            assert.equal((await request('GET', `/compras/${ajena.idCompra}`, 200, undefined, 'REGENTE')).data.idUsuario, usuarios.OTRO_ADMIN.id_usuario);
            assert.deepEqual((await request('GET', `/compras?desde=2026-11-01&hasta=2026-11-01&idProveedorLaboratorio=${proveedor.id_proveedor_laboratorio}&estadoOperacion=CONFIRMADA&claveOperacion=CLAVE-OTRO-ADMIN`, 200, undefined, 'OTRO_ADMIN')).data.map(c => c.idCompra), [ajena.idCompra]);
            await request('GET', '/compras/2147483647', 404);
            await request('GET', '/compras', 403, undefined, 'VENDEDOR');
            const anuladas = (await request('GET', '/compras?estadoOperacion=ANULADA', 200, undefined, 'REGENTE')).data;
            assert.deepEqual(anuladas.map(c => c.idCompra), [compraAnulada.id_compra]);
            assert.equal(anuladas[0].fechaAnulacion, '2026-10-31 12:34:56');
            assert.equal(anuladas[0].motivoAnulacion, 'Anulación histórica sintética');
            assert.equal(anuladas[0].usuarioAnulador.idUsuario, usuarios.ADMINISTRADOR.id_usuario);
            assert.deepEqual((await request('GET', '/compras?claveOperacion=clave-anulada', 200)).data, []);
            assert.deepEqual((await request('GET', '/compras?claveOperacion=clave-anulada', 200, undefined, 'OTRO_ADMIN')).data.map(c => c.idCompra), [compraAnulada.id_compra]);
            const before = await snapshot();
            assert.deepEqual(await post(body('CLAVE-OTRO-ADMIN'), 409), { message: 'La clave de operación ya está registrada' });
            assert.deepEqual(await post(body('CLAVE-ANULADA'), 409), { message: 'La clave de operación ya está registrada' });
            await db.Medicamento.update({ estado: false }, { where: { id_medicamento: agrupado.id_medicamento } });
            await db.ProveedorLaboratorio.update({ estado: false }, { where: { id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio } });
            try {
                const historica = (await request('GET', `/compras/${primeraCompra.idCompra}`, 200)).data;
                assert.equal(historica.proveedorLaboratorio.estado, false);
                assert.equal(historica.detalles[0].existencia.medicamento.estado, false);
                await post(body('proveedor-inactivo', [linea(historico)]), 409);
            } finally {
                await db.Medicamento.update({ estado: true }, { where: { id_medicamento: agrupado.id_medicamento } });
                await db.ProveedorLaboratorio.update({ estado: true }, { where: { id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio } });
            }
            assert.deepEqual(await snapshot(), before);
        });

        await t.test('Fallos después de escrituras reales en cada etapa revierten todo y permiten la misma clave', async () => {
            const casos = [[compraRepository, 'create', 1], [existenciaMedicamentoRepository, 'updateSaldoYCosto', 1],
                [existenciaMedicamentoRepository, 'create', 1], [compraRepository, 'createDetalle', 2],
                [movimientoInventarioRepository, 'create', 2], [compraRepository, 'findById', 1]];
            for (let i = 0; i < casos.length; i++) {
                const [repository, metodo, numero] = casos[i];
                const original = repository[metodo].bind(repository);
                const datos = body(`rollback-${i}`, [linea(), linea(agrupado, { precisionVencimiento: 'DIA', fechaVencimiento: `2028-02-${String(i + 1).padStart(2, '0')}` })]);
                const before = await snapshot(); let llamadas = 0;
                const mocked = t.mock.method(repository, metodo, async (...args) => {
                    const result = await original(...args);
                    if (++llamadas === numero) throw new Error('Fallo sintético tras ejecutar SQL real');
                    return result;
                });
                try {
                    await post(datos, 500);
                    assert.equal(llamadas, numero);
                    assert.deepEqual(await snapshot(), before, `Rollback real de ${metodo}`);
                    assert.equal(await db.Compra.count({ where: { clave_operacion: datos.claveOperacion } }), 0);
                } finally { mocked.mock.restore(); }
                const retry = (await post(datos)).data;
                assert.equal((await detallesCompra(retry.idCompra)).length, 2);
                assert.equal((await movimientosCompra(retry.idCompra)).length, 2);
            }
        });

        await t.test('Un error FK real después de movimientos previos revierte saldos, cabecera y detalles', async () => {
            const datos = body('rollback-fk', [linea(), linea()]);
            const before = await snapshot(); let llamadas = 0;
            const original = movimientoInventarioRepository.create.bind(movimientoInventarioRepository);
            const mocked = t.mock.method(movimientoInventarioRepository, 'create', async args => {
                if (++llamadas === 2) return original({ ...args, data: { ...args.data, id_usuario: 2147483647 } });
                return original(args);
            });
            try { await post(datos, 500); assert.deepEqual(await snapshot(), before); }
            finally { mocked.mock.restore(); }
            await post(datos);
        });

        await t.test('Carrera de misma clave: ambos prechecks vacíos, solo un commit y el UNIQUE devuelve 409', async () => {
            const med = await crearMedicamento('CCKEY');
            const datos = [body('carrera-clave', [linea(med, { cantidad: 1, costoUnitario: '1.2' })]),
                body('CARRERA-CLAVE', [linea(med, { cantidad: 2, costoUnitario: '2.3' })])];
            const original = compraRepository.findByClave.bind(compraRepository);
            let llegadas = 0, liberar;
            const barrera = new Promise(resolve => { liberar = resolve; });
            const mocked = t.mock.method(compraRepository, 'findByClave', async args => {
                const result = await original(args);
                if (args.claveOperacion === 'carrera-clave') {
                    assert.equal(result, null); if (++llegadas === 2) liberar(); await barrera;
                }
                return result;
            });
            // Aquí los códigos se comprueban conjuntamente porque el ganador
            // depende del planificador, no de cuál solicitud se envió primero.
            const competir = async data => {
                const response = await fetch(`${base}/compras`, { method: 'POST', headers: {
                    Cookie: `token=${tokens.ADMINISTRADOR}`, 'Content-Type': 'application/json'
                }, body: JSON.stringify(data), signal: AbortSignal.timeout(25000) });
                requests++; return { status: response.status, body: await response.json() };
            };
            let resultados;
            try { resultados = await Promise.all(datos.map(competir)); }
            finally { liberar(); mocked.mock.restore(); }
            assert.equal(llegadas, 2);
            assert.deepEqual(resultados.map(r => r.status).sort(), [201, 409]);
            const ganador = resultados.findIndex(r => r.status === 201);
            assert.deepEqual(resultados[1 - ganador].body, { message: 'La clave de operación ya está registrada' });
            assert.equal(await db.Compra.count({ where: { clave_operacion: 'carrera-clave' } }), 1);
            const existencias = await db.ExistenciaMedicamento.findAll({ where: { id_medicamento: med.id_medicamento } });
            assert.equal(existencias.length, 1); assert.equal(existencias[0].cantidad_fisica, datos[ganador].detalles[0].cantidad);
            assert.equal((await movimientosCompra(resultados[ganador].body.data.idCompra)).length, 1);
        });

        await t.test('Claves distintas sobre la misma existencia serializan snapshots sin perder stock ni valoración', async () => {
            const med = await crearMedicamento('CCEX');
            const e = await crearExistencia(med, 'CCEX-001', '2027-03-31', 'MES', 100, '0.500000');
            const compras = await Promise.all([post(body('concurrente-a', [linea(med)])),
                post(body('concurrente-b', [linea(med, { cantidad: 50, costoUnitario: '0.9' })]))]);
            const actual = await db.ExistenciaMedicamento.findByPk(e.id_existencia);
            assert.equal(actual.cantidad_fisica, 250); assert.equal(actual.costo_unitario_promedio, '0.660000');
            const grupos = await Promise.all(compras.map(c => detallesCompra(c.data.idCompra)));
            const ordenadas = grupos.flat().sort((a, b) => a.saldo_anterior - b.saldo_anterior);
            assert.equal(ordenadas[0].saldo_anterior, 100); assert.equal(ordenadas[0].costo_promedio_anterior, '0.500000');
            assert.equal(ordenadas[1].saldo_anterior, 100 + ordenadas[0].cantidad);
            const promedioEsperado = enteroADecimal(dividirYRedondear(100n * decimalAEntero('0.5', 6) +
                BigInt(ordenadas[0].cantidad) * decimalAEntero(ordenadas[0].costo_unitario, 6), BigInt(ordenadas[1].saldo_anterior)), 6);
            assert.equal(ordenadas[1].costo_promedio_anterior, promedioEsperado);
            assert.equal(await db.ExistenciaMedicamento.count({ where: { id_medicamento: med.id_medicamento } }), 1);
        });

        await t.test('Creación concurrente de existencias usa correlativos únicos y bloqueos de medicamentos en orden estable', async () => {
            const med = await crearMedicamento('CCNEW');
            const nuevas = await Promise.all([post(body('nueva-a', [linea(med, { fechaVencimiento: '2027-04' })])),
                post(body('nueva-b', [linea(med, { fechaVencimiento: '2027-05' })]))]);
            assert.deepEqual(nuevas.map(c => c.data.detalles[0].existencia.codigoExistencia).sort(), ['CCNEW-001', 'CCNEW-002']);
            const a = await crearMedicamento('ORD1'), b = await crearMedicamento('ORD2');
            await Promise.all([post(body('orden-a', [linea(b), linea(a)])), post(body('orden-b', [linea(a), linea(b)]))]);
            for (const m of [a, b]) {
                const [e] = await db.ExistenciaMedicamento.findAll({ where: { id_medicamento: m.id_medicamento } });
                assert.equal(e.cantidad_fisica, 200); assert.equal(e.costo_unitario_promedio, '0.700000');
            }
        });

        await t.test('Espera real que cruza medianoche vuelve a validar MES con el instante posterior al bloqueo', async () => {
            const med = await crearMedicamento('CORTE');
            const blocker = await db.sequelize.transaction(); let pending;
            const before = await snapshot();
            try {
                await medicamentoRepository.findById({ idMedicamento: med.id_medicamento, transaction: blocker, lock: true });
                t.mock.timers.setTime(new Date('2026-11-01T03:59:59Z').getTime());
                pending = post(body('corte-espera', [linea(med, { fechaVencimiento: '2026-10' })]), 409);
                pending.catch(() => {});
                await waitForBlocker(blocker);
                t.mock.timers.setTime(instante.getTime());
                await blocker.commit();
                assert.match((await pending).message, /vencida/);
                assert.deepEqual(await snapshot(), before);
            } finally {
                t.mock.timers.setTime(instante.getTime());
                if (!blocker.finished) await blocker.rollback();
                if (pending) await pending.catch(() => {});
            }
        });

        await t.test('Inactivación concurrente de medicamento o proveedor se observa bajo bloqueo', async () => {
            for (const tipo of ['medicamento', 'proveedor']) {
                const med = await crearMedicamento(tipo === 'medicamento' ? 'ESTM' : 'ESTP');
                const blocker = await db.sequelize.transaction(); let pending;
                const before = await snapshot();
                try {
                    if (tipo === 'medicamento') await db.Medicamento.update({ estado: false }, { where: { id_medicamento: med.id_medicamento }, transaction: blocker });
                    else await db.ProveedorLaboratorio.update({ estado: false }, { where: { id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio }, transaction: blocker });
                    pending = post(body(`estado-${tipo}`, [linea(med)]), 409); pending.catch(() => {});
                    await waitForBlocker(blocker); await blocker.commit();
                    assert.match((await pending).message, /inactivo/);
                    assert.deepEqual(await snapshot(), before);
                } finally {
                    if (!blocker.finished) await blocker.rollback();
                    if (pending) await pending.catch(() => {});
                    if (tipo === 'medicamento') await db.Medicamento.update({ estado: true }, { where: { id_medicamento: med.id_medicamento } });
                    else await db.ProveedorLaboratorio.update({ estado: true }, { where: { id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio } });
                }
            }
        });

        await t.test('Lock wait timeout real devuelve contención, libera la operación y admite reintento de la clave', async () => {
            const med = await crearMedicamento('TIMEOUT');
            const blocker = await db.sequelize.transaction(); let pending;
            const before = await snapshot();
            const original = medicamentoRepository.findById.bind(medicamentoRepository);
            const mocked = t.mock.method(medicamentoRepository, 'findById', async args => {
                if (args.idMedicamento !== med.id_medicamento || !args.lock) return original(args);
                const [{ limite }] = await select('SELECT @@SESSION.innodb_lock_wait_timeout AS limite', { transaction: args.transaction });
                await db.sequelize.query('SET SESSION innodb_lock_wait_timeout = 1', { transaction: args.transaction });
                try { return await original(args); }
                finally { if (!args.transaction.finished) await db.sequelize.query(`SET SESSION innodb_lock_wait_timeout = ${Number(limite)}`, { transaction: args.transaction }); }
            });
            try {
                // Usar el método original para no cambiar el timeout del bloqueador.
                await original({ idMedicamento: med.id_medicamento, transaction: blocker, lock: true });
                pending = post(body('timeout-real', [linea(med)]), 409); pending.catch(() => {});
                await waitForBlocker(blocker);
                assert.match((await pending).message, /contención temporal/);
                assert.deepEqual(await snapshot(), before);
            } finally {
                mocked.mock.restore(); if (!blocker.finished) await blocker.rollback();
                if (pending) await pending.catch(() => {});
            }
            await post(body('timeout-real', [linea(med)]));
        });

        await t.test('Deadlock real revierte la compra elegida como víctima y no se confunde con un duplicado', async () => {
            const a = await crearMedicamento('DL1'), b = await crearMedicamento('DL2');
            const peso = [];
            for (let i = 0; i < 30; i++) peso.push((await crearMedicamento(`DLP${i}`)).id_medicamento);
            const blocker = await db.sequelize.transaction(); let pending;
            const before = await snapshot();
            try {
                // Provocar un ciclo exclusivamente en la base aislada. Dar mayor
                // peso al bloqueador para que InnoDB elija la compra como víctima.
                // Igualdad por PK evita un plan de UPDATE con barrido que podría
                // bloquear también a antes de construir el ciclo deliberado.
                for (const id of [b.id_medicamento, ...peso]) {
                    await db.Medicamento.update({ nombre_comercial: 'Peso sintético de deadlock' }, {
                        where: { id_medicamento: id }, transaction: blocker
                    });
                }
                pending = post(body('deadlock-real', [linea(a), linea(b)]), 409); pending.catch(() => {});
                await waitForBlocker(blocker);
                await medicamentoRepository.findById({ idMedicamento: a.id_medicamento, transaction: blocker, lock: true });
                assert.match((await pending).message, /contención temporal/);
                await blocker.rollback();
                assert.deepEqual(await snapshot(), before);
            } finally {
                if (!blocker.finished) await blocker.rollback();
                if (pending) await pending.catch(() => {});
            }
            await post(body('deadlock-real', [linea(a), linea(b)]));
        });

        await t.test('Conflicto UNIQUE de código histórico se informa separado de la clave y hace rollback', async () => {
            const anterior = await crearMedicamento('COL');
            await crearExistencia(anterior, 'COL-001', '2027-03-31', 'MES', 0, '0.000000');
            // Un medicamento sin movimientos puede cambiar su identidad; el
            // código de existencia ya conservado no se renombra ni reutiliza.
            await db.Medicamento.update({ codigo_medicamento: 'ANTCOL' }, { where: { id_medicamento: anterior.id_medicamento } });
            const nuevo = await crearMedicamento('COL'); const before = await snapshot();
            assert.match((await post(body('codigo-colision', [linea(nuevo)]), 409)).message, /código de existencia/);
            assert.deepEqual(await snapshot(), before);
        });

        await t.test('Historial para futura B1/A distingue posteriores por ID aunque todas las horas sean iguales', async () => {
            const med = await crearMedicamento('HISTID');
            const primera = (await post(body('hist-id-1', [linea(med, { cantidad: 1, costoUnitario: '1' }), linea(med, { cantidad: 2, costoUnitario: '2' })]))).data;
            const originales = await movimientosCompra(primera.idCompra);
            const posteriores = () => select('SELECT * FROM movimiento_inventario WHERE id_existencia = :existencia AND id_movimiento > :menor AND id_movimiento NOT IN (:originales) ORDER BY id_movimiento', {
                replacements: { existencia: primera.detalles[0].idExistencia, menor: originales[0].id_movimiento, originales: originales.map(m => m.id_movimiento) }
            });
            assert.deepEqual(await posteriores(), []);
            await post(body('hist-id-otra-existencia', [linea(med, { fechaVencimiento: '2027-04' })]));
            assert.deepEqual(await posteriores(), [], 'Movimientos de otras existencias no invalidan B1');
            const existencia = await db.ExistenciaMedicamento.findByPk(primera.detalles[0].idExistencia);
            const saldoPrevio = existencia.cantidad_fisica, costoPrevio = existencia.costo_unitario_promedio;
            await db.sequelize.transaction(async transaction => {
                await db.ExistenciaMedicamento.findByPk(existencia.id_existencia, { transaction, lock: transaction.LOCK.UPDATE });
                // Historia sintética de salida/entrada compensadas bajo el mismo
                // bloqueo. No se implementa aquí un caso de uso de ajustes.
                for (const direccion of ['SALIDA', 'ENTRADA']) {
                    await db.ExistenciaMedicamento.update({ cantidad_fisica: direccion === 'SALIDA' ? saldoPrevio - 1 : saldoPrevio },
                        { where: { id_existencia: existencia.id_existencia }, transaction });
                    await db.MovimientoInventario.create({ id_existencia: existencia.id_existencia,
                        id_usuario: usuarios.REGENTE.id_usuario, direccion, cantidad: 1, motivo: 'Ajuste',
                        costo_unitario_aplicado: costoPrevio, fecha_movimiento: civil('2026-11-01 00:15:00') }, { transaction });
                }
            });
            const compensada = await db.ExistenciaMedicamento.findByPk(existencia.id_existencia);
            assert.equal(compensada.cantidad_fisica, saldoPrevio); assert.equal(compensada.costo_unitario_promedio, costoPrevio);
            assert.equal((await posteriores()).length, 2, 'El mismo saldo no demuestra ausencia de movimientos posteriores');
            const segunda = (await post(body('hist-id-2', [linea(med, { cantidad: 1, costoUnitario: '1' })]))).data;
            const externos = await posteriores(); assert.equal(externos.length, 3);
            assert.equal(externos[0].fecha_movimiento.getTime(), originales[0].fecha_movimiento.getTime());
            const detalles = await detallesCompra(primera.idCompra);
            assert.ok(detalles.every(d => d.saldo_anterior === 0 && d.costo_promedio_anterior === '0.000000'));
            assert.equal((await detallesCompra(segunda.idCompra))[0].saldo_anterior, 3);
            assert.ok(externos[0].id_movimiento > originales.at(-1).id_movimiento);
        });

        await t.test('Compras nuevas concilian saldo físico, detalles, movimientos y consultas de Inventario', async () => {
            const saldos = await select("SELECT e.id_existencia, e.cantidad_fisica, COALESCE(SUM(CASE WHEN m.direccion = 'ENTRADA' THEN m.cantidad ELSE -m.cantidad END), 0) AS saldo_movimientos FROM existencia_medicamento e LEFT JOIN movimiento_inventario m ON m.id_existencia = e.id_existencia GROUP BY e.id_existencia, e.cantidad_fisica");
            for (const saldo of saldos) assert.equal(BigInt(saldo.cantidad_fisica), BigInt(saldo.saldo_movimientos));
            const originales = await select("SELECT d.id_detalle_compra, d.cantidad, d.costo_unitario, COUNT(m.id_movimiento) AS originales, MAX(m.cantidad) AS cantidad_movimiento, MAX(m.costo_unitario_aplicado) AS costo_movimiento FROM detalle_compra d LEFT JOIN movimiento_inventario m ON m.id_detalle_compra = d.id_detalle_compra AND m.id_movimiento_original IS NULL GROUP BY d.id_detalle_compra, d.cantidad, d.costo_unitario");
            for (const row of originales) {
                assert.equal(Number(row.originales), 1); assert.equal(row.cantidad_movimiento, row.cantidad);
                assert.equal(row.costo_movimiento, row.costo_unitario);
            }
            const inventario = await request('GET', `/inventario?idMedicamento=${agrupado.id_medicamento}`, 200, undefined, 'VENDEDOR');
            const actual = await db.ExistenciaMedicamento.findAll({ where: { id_medicamento: agrupado.id_medicamento }, raw: true });
            assert.equal(inventario.data[0].stockFisico, actual.reduce((sum, e) => sum + e.cantidad_fisica, 0));
            for (const path of ['/inventario/proximos-a-vencer', '/inventario/vencidos', '/inventario/stock-bajo']) {
                await request('GET', `${path}?idMedicamento=${agrupado.id_medicamento}`, 200, undefined, 'REGENTE');
            }
            const historial = await request('GET', `/inventario/movimientos?idExistencia=${existente.id_existencia}`, 200, undefined, 'REGENTE');
            assert.ok(historial.data.some(m => m.compra?.idCompra === primeraCompra.idCompra));
            const legado = await detallesCompra(compraHistorica.id_compra);
            assert.equal(legado[0].saldo_anterior, null); assert.equal(legado[0].costo_promedio_anterior, null);
        });
        const anular = (compra, status = 200, motivo = ' Corrección de compra ', rol = 'ADMINISTRADOR') =>
            request('POST', `/compras/${compra.idCompra}/anular`, status, { motivo }, rol);
        let secuenciaAnulacion = 0;
        const prepararAnulacion = async (costos = ['2'], saldo = 0, promedio = '5.000000') => {
            const codigo = `AC${++secuenciaAnulacion}`;
            const med = await crearMedicamento(codigo);
            const e = await crearExistencia(med, `${codigo}-001`, '2027-03-31', 'MES', saldo, promedio);
            const compra = (await post(body(codigo, costos.map(costoUnitario => linea(med, { cantidad: 1, costoUnitario }))))).data;
            return { med, e, compra };
        };
        const posterior = async (e, direccion, cantidad, costo, promedioFinal) => {
            await db.sequelize.transaction(async transaction => {
                const actual = await db.ExistenciaMedicamento.findByPk(e.id_existencia, { transaction, lock: transaction.LOCK.UPDATE });
                await db.ExistenciaMedicamento.update({ cantidad_fisica: actual.cantidad_fisica + (direccion === 'ENTRADA' ? cantidad : -cantidad),
                    costo_unitario_promedio: promedioFinal ?? actual.costo_unitario_promedio }, { where: { id_existencia: e.id_existencia }, transaction });
                await db.MovimientoInventario.create({ id_existencia: e.id_existencia, id_usuario: usuarios.REGENTE.id_usuario,
                    direccion, cantidad, costo_unitario_aplicado: costo, motivo: 'Ajuste', fecha_movimiento: civil('2026-11-01 00:15:00') }, { transaction });
            });
        };

        // Fixtures exclusivas de esta base: no implementan endpoints de Ventas.
        const ventaCompensada = async e => db.sequelize.transaction(async transaction => {
            const actual = await db.ExistenciaMedicamento.findByPk(e.id_existencia, { transaction, lock: transaction.LOCK.UPDATE });
            assert.ok(actual.cantidad_fisica >= 1);
            const venta = await db.Venta.create({ id_usuario: usuarios.VENDEDOR.id_usuario,
                clave_operacion: `fixture-venta-${e.id_existencia}`,
                fecha_registro: civil('2026-11-01 00:15:00'), fecha_venta: civil('2026-11-01 00:15:00'),
                estado_operacion: 'ANULADA', total: '2.00', motivo_anulacion: 'Fixture de venta compensada',
                fecha_anulacion: civil('2026-11-01 00:15:00'), id_usuario_anulador: usuarios.ADMINISTRADOR.id_usuario }, { transaction });
            const detalle = await db.DetalleVenta.create({ id_venta: venta.id_venta, id_existencia: e.id_existencia,
                cantidad: 1, precio_unitario: '2.00', subtotal: '2.00' }, { transaction });
            const datos = { id_existencia: e.id_existencia, id_usuario: usuarios.VENDEDOR.id_usuario,
                id_detalle_compra: null, id_detalle_venta: detalle.id_detalle_venta, cantidad: 1,
                costo_unitario_aplicado: actual.costo_unitario_promedio, fecha_movimiento: civil('2026-11-01 00:15:00') };
            const original = await db.MovimientoInventario.create({ ...datos, direccion: 'SALIDA', motivo: 'VENTA' }, { transaction });
            const compensacion = await db.MovimientoInventario.create({ ...datos, direccion: 'ENTRADA',
                motivo: 'ANULACION_VENTA', id_movimiento_original: original.id_movimiento }, { transaction });
            return { venta, detalle, original, compensacion };
        });

        await t.test('Motivos: COMPRA/Compra en B1 y legado sin snapshots mantienen identificación y límites', async () => {
            for (const motivo of ['COMPRA', 'Compra']) {
                const primera = await prepararAnulacion(['2'], 1, '2.000000');
                const [original] = await movimientosCompra(primera.compra.idCompra);
                await db.MovimientoInventario.update({ motivo }, { where: { id_movimiento: original.id_movimiento } });
                const antes = await db.MovimientoInventario.findByPk(original.id_movimiento, { raw: true });
                await anular(primera.compra);
                assert.deepEqual(await db.MovimientoInventario.findByPk(original.id_movimiento, { raw: true }), antes);
                const reversa = await db.MovimientoInventario.findOne({ where: { id_movimiento_original: original.id_movimiento } });
                assert.equal(reversa.motivo, 'ANULACION_COMPRA');
                const legado = await prepararAnulacion(['2'], 1, '2.000000');
                await db.MovimientoInventario.update({ motivo }, { where: { id_detalle_compra: legado.compra.detalles[0].idDetalleCompra } });
                await db.DetalleCompra.update({ saldo_anterior: null, costo_promedio_anterior: null }, { where: { id_compra: legado.compra.idCompra } });
                const before = await snapshot();
                assert.match((await anular(legado.compra, 409)).message, /falta el estado anterior/);
                assert.deepEqual(await snapshot(), before);
                await posterior(legado.e, 'ENTRADA', 1, '2.000000');
                await anular(legado.compra);
                assert.equal((await detallesCompra(legado.compra.idCompra))[0].saldo_anterior, null);
            }
        });

        await t.test('Motivos: historial con ANULACION_COMPRA/Reversión legítima permite otra anulación sin reescribirlo', async () => {
            for (const motivo of ['ANULACION_COMPRA', 'Reversión']) {
                const { med, e, compra } = await prepararAnulacion(['2'], 1, '2.000000');
                await anular(compra);
                const [original] = (await movimientosCompra(compra.idCompra)).filter(m => m.id_movimiento_original === null);
                await db.MovimientoInventario.update({ motivo }, { where: { id_movimiento_original: original.id_movimiento } });
                const anterior = await movimientosCompra(compra.idCompra);
                const segunda = (await post(body(`compatibilidad-${motivo === 'Reversión' ? 'legado' : 'oficial'}`,
                    [linea(med, { cantidad: 1, costoUnitario: '2' })]))).data;
                await anular(segunda);
                assert.deepEqual(await movimientosCompra(compra.idCompra), anterior);
                assert.equal((await db.ExistenciaMedicamento.findByPk(e.id_existencia)).cantidad_fisica, 1);
                const before = await snapshot(); await anular(compra, 409); assert.deepEqual(await snapshot(), before);
            }
        });

        await t.test('Motivos: ANULACION_VENTA legítima permite A, conserva venta y movimientos e impide doble reversión', async () => {
            const { e, compra } = await prepararAnulacion(['2'], 1, '2.000000');
            const { venta, detalle, original, compensacion } = await ventaCompensada(e);
            const antes = await db.MovimientoInventario.findAll({ where: { id_detalle_venta: detalle.id_detalle_venta }, raw: true, order: [['id_movimiento', 'ASC']] });
            const ventaAntes = await db.Venta.findByPk(venta.id_venta, { raw: true });
            const detalleAntes = await db.DetalleVenta.findByPk(detalle.id_detalle_venta, { raw: true });
            await anular(compra);
            assert.deepEqual(await db.MovimientoInventario.findAll({ where: { id_detalle_venta: detalle.id_detalle_venta }, raw: true, order: [['id_movimiento', 'ASC']] }), antes);
            assert.deepEqual(await db.Venta.findByPk(venta.id_venta, { raw: true }), ventaAntes);
            assert.deepEqual(await db.DetalleVenta.findByPk(detalle.id_detalle_venta, { raw: true }), detalleAntes);
            const before = await snapshot();
            await assert.rejects(db.MovimientoInventario.create({ id_usuario: usuarios.ADMINISTRADOR.id_usuario,
                id_existencia: e.id_existencia, id_detalle_venta: detalle.id_detalle_venta,
                id_movimiento_original: original.id_movimiento, direccion: 'ENTRADA', cantidad: 1,
                costo_unitario_aplicado: compensacion.costo_unitario_aplicado, motivo: 'ANULACION_VENTA' }),
            error => error.name === 'SequelizeUniqueConstraintError');
            assert.deepEqual(await snapshot(), before);
        });

        await t.test('Motivos: compensaciones de venta con identidad, referencias o estado incompatibles rechazan toda CU27', async () => {
            for (const tipo of ['motivo-compra', 'motivo-legado', 'referencia-detalle', 'estado-venta']) {
                const { e, compra } = await prepararAnulacion(['2'], 1, '2.000000');
                const { venta, detalle, compensacion } = await ventaCompensada(e);
                if (tipo === 'motivo-compra' || tipo === 'motivo-legado') {
                    await db.MovimientoInventario.update({ motivo: tipo === 'motivo-compra' ? 'ANULACION_COMPRA' : 'Reversión' },
                        { where: { id_movimiento: compensacion.id_movimiento } });
                }
                if (tipo === 'referencia-detalle') {
                    const otro = await db.DetalleVenta.create({ id_venta: venta.id_venta, id_existencia: e.id_existencia,
                        cantidad: detalle.cantidad, precio_unitario: '2.00', subtotal: '2.00' });
                    await db.MovimientoInventario.update({ id_detalle_venta: otro.id_detalle_venta }, { where: { id_movimiento: compensacion.id_movimiento } });
                }
                if (tipo === 'estado-venta') await db.Venta.update({ estado_operacion: 'CONFIRMADA' }, { where: { id_venta: venta.id_venta } });
                const before = await snapshot();
                assert.match((await anular(compra, 409)).message, /inconsistente/);
                assert.deepEqual(await snapshot(), before);
            }
        });

        await t.test('CU27 B1 restaura exactamente promedio redondeado, agotada histórica y existencia nueva; conserva originales', async () => {
            for (const [costos, saldo, promedio] of [[['0.000002'], 1, '0.000001'], [['8', '9'], 0, '5.000000'], [['2'], 0, '0.000000']]) {
                const { e, compra } = await prepararAnulacion(costos, saldo, promedio);
                const detallesAntes = await detallesCompra(compra.idCompra);
                const originales = await movimientosCompra(compra.idCompra);
                const response = await anular(compra);
                assert.equal(response.message, 'Compra anulada exitosamente');
                assert.equal(response.data.estadoOperacion, 'ANULADA');
                assert.equal(response.data.fechaAnulacion, '2026-11-01 00:15:00');
                assert.equal(response.data.motivoAnulacion, 'Corrección de compra');
                assert.equal(response.data.idUsuarioAnulador, usuarios.ADMINISTRADOR.id_usuario);
                assert.equal(response.data.total, compra.total); assert.equal(response.data.fechaCompra, compra.fechaCompra);
                const actual = await db.ExistenciaMedicamento.findByPk(e.id_existencia);
                assert.equal(actual.cantidad_fisica, saldo); assert.equal(actual.costo_unitario_promedio, promedio);
                assert.deepEqual(await detallesCompra(compra.idCompra), detallesAntes);
                for (const original of originales) {
                    assert.deepEqual((await db.MovimientoInventario.findByPk(original.id_movimiento, { raw: true })), original);
                    const reversion = await db.MovimientoInventario.findOne({ where: { id_movimiento_original: original.id_movimiento }, raw: true });
                    assert.equal(reversion.direccion, 'SALIDA'); assert.equal(reversion.cantidad, original.cantidad);
                    assert.equal(reversion.motivo, 'ANULACION_COMPRA');
                    assert.equal(reversion.costo_unitario_aplicado, original.costo_unitario_aplicado);
                    assert.equal(reversion.id_existencia, original.id_existencia); assert.equal(reversion.id_detalle_compra, original.id_detalle_compra);
                    assert.equal(reversion.id_usuario, usuarios.ADMINISTRADOR.id_usuario); assert.equal(reversion.observacion, 'Corrección de compra');
                    const [{ fecha }] = await select("SELECT DATE_FORMAT(fecha_movimiento, '%Y-%m-%d %H:%i:%s') AS fecha FROM movimiento_inventario WHERE id_movimiento = :id", { replacements: { id: reversion.id_movimiento } });
                    assert.equal(fecha, response.data.fechaAnulacion);
                }
                const before = await snapshot();
                await anular(compra, 409); await post(body(compra.claveOperacion), 409);
                assert.deepEqual(await snapshot(), before);
            }
        });

        await t.test('CU27 A por existencia permite mezcla con B1, posteriores de igual hora y legado sin snapshots', async () => {
            const med = await crearMedicamento('ACMIX');
            const e = await crearExistencia(med, 'ACMIX-001', '2027-03-31', 'MES', 10, '1.000000');
            const compra = (await post(body('anular-mixta', [linea(med, { cantidad: 10, costoUnitario: '3' }),
                linea(med, { cantidad: 1, costoUnitario: '4', fechaVencimiento: '2027-04' })]))).data;
            const otra = (await post(body('posterior-mixta', [linea(med, { cantidad: 10, costoUnitario: '5' })]))).data;
            const posteriorAntes = await detallesCompra(otra.idCompra);
            await anular(compra);
            const actual = await db.ExistenciaMedicamento.findByPk(e.id_existencia);
            assert.equal(actual.cantidad_fisica, 20); assert.equal(actual.costo_unitario_promedio, '3.000000');
            const nueva = await db.ExistenciaMedicamento.findByPk(compra.detalles[1].idExistencia);
            assert.equal(nueva.cantidad_fisica, 0); assert.equal(nueva.costo_unitario_promedio, '0.000000');
            assert.deepEqual(await detallesCompra(otra.idCompra), posteriorAntes);
            const legacy = await prepararAnulacion(['2'], 1, '2.000000');
            await db.DetalleCompra.update({ saldo_anterior: null, costo_promedio_anterior: null }, { where: { id_compra: legacy.compra.idCompra } });
            const before = await snapshot();
            assert.match((await anular(legacy.compra, 409)).message, /falta el estado anterior/);
            assert.deepEqual(await snapshot(), before);
            await posterior(legacy.e, 'ENTRADA', 1, '2.000000');
            await anular(legacy.compra);
            assert.equal((await db.ExistenciaMedicamento.findByPk(legacy.e.id_existencia)).cantidad_fisica, 2);
            assert.equal((await detallesCompra(legacy.compra.idCompra))[0].saldo_anterior, null);
        });

        await t.test('CU27 rechaza stock insuficiente, residual negativo/no nulo a saldo cero y promedio desbordado', async () => {
            for (const tipo of ['stock', 'residual', 'cero', 'maximo']) {
                const { e, compra } = await prepararAnulacion(tipo === 'stock' ? ['2', '2'] : ['2'], tipo === 'maximo' ? 1 : 0, '2.000000');
                if (tipo === 'stock') await posterior(e, 'SALIDA', 1, '2.000000');
                if (tipo === 'residual') await posterior(e, 'ENTRADA', 1, '0.000001', '0.000001');
                if (tipo === 'cero') {
                    await posterior(e, 'ENTRADA', 1, '3.000000', '2.500000');
                    await posterior(e, 'SALIDA', 1, '2.500000');
                }
                if (tipo === 'maximo') {
                    await posterior(e, 'ENTRADA', 1, '99999999.999999', '99999999.999999');
                    await posterior(e, 'SALIDA', 1, '99999999.999999');
                }
                const before = await snapshot(); const response = await anular(compra, 409);
                assert.match(response.message, tipo === 'stock' ? /stock físico/ : tipo === 'maximo' ? /máximo/ : /valoración residual/);
                assert.deepEqual(await snapshot(), before);
            }
            const cero = await prepararAnulacion(['2'], 0, '0.000000');
            await posterior(cero.e, 'ENTRADA', 1, '2.000000'); await posterior(cero.e, 'SALIDA', 1, '2.000000');
            await anular(cero.compra);
            const actual = await db.ExistenciaMedicamento.findByPk(cero.e.id_existencia);
            assert.equal(actual.cantidad_fisica, 0); assert.equal(actual.costo_unitario_promedio, '2.000000');
        });

        await t.test('CU27 integridad: snapshots contradictorios, originales erróneos, saldo/promedio alterados y reversión previa', async () => {
            for (const tipo of ['snapshot', 'snapshot-nulo', 'original', 'original-ausente', 'saldo', 'promedio', 'reversion']) {
                const { e, compra } = await prepararAnulacion(['2', '2'], 1, '2.000000');
                const detalles = await detallesCompra(compra.idCompra), originales = await movimientosCompra(compra.idCompra);
                if (tipo === 'snapshot') {
                    await db.DetalleCompra.update({ saldo_anterior: 2 }, { where: { id_detalle_compra: detalles[1].id_detalle_compra } });
                    await posterior(e, 'ENTRADA', 1, '2.000000');
                }
                if (tipo === 'original') await db.MovimientoInventario.update({ costo_unitario_aplicado: '3.000000' }, { where: { id_movimiento: originales[0].id_movimiento } });
                if (tipo === 'snapshot-nulo') await db.DetalleCompra.update({ saldo_anterior: null, costo_promedio_anterior: null },
                    { where: { id_detalle_compra: detalles[1].id_detalle_compra } });
                if (tipo === 'original-ausente') await db.MovimientoInventario.destroy({ where: { id_movimiento: originales[0].id_movimiento } });
                if (tipo === 'saldo') await db.ExistenciaMedicamento.update({ cantidad_fisica: 4 }, { where: { id_existencia: e.id_existencia } });
                if (tipo === 'promedio') await db.ExistenciaMedicamento.update({ costo_unitario_promedio: '3.000000' }, { where: { id_existencia: e.id_existencia } });
                if (tipo === 'reversion') {
                    await db.ExistenciaMedicamento.update({ cantidad_fisica: 2 }, { where: { id_existencia: e.id_existencia } });
                    await movimientoFixture(e, 1, 'SALIDA', { motivo: 'Reversión', id_movimiento_original: originales[0].id_movimiento,
                        id_detalle_compra: null, costo_unitario_aplicado: '2.000000' });
                }
                const before = await snapshot(); assert.match((await anular(compra, 409)).message, /inconsistente/);
                assert.deepEqual(await snapshot(), before);
            }
            const incompleta = await prepararAnulacion();
            const original = compraRepository.findDetallesParaAnular.bind(compraRepository);
            const mocked = t.mock.method(compraRepository, 'findDetallesParaAnular', async args => {
                const rows = await original(args); rows[0].setDataValue('saldo_anterior', null); return rows;
            });
            try { await anular(incompleta.compra, 409); } finally { mocked.mock.restore(); }
        });

        await t.test('CU27 rechaza intercalación ajena entre originales sin eludirla con modalidad A', async () => {
            const med = await crearMedicamento('ACINTER'); let llamadas = 0;
            const original = movimientoInventarioRepository.create.bind(movimientoInventarioRepository);
            const mocked = t.mock.method(movimientoInventarioRepository, 'create', async args => {
                if (++llamadas === 2) {
                    await db.ExistenciaMedicamento.increment('cantidad_fisica', { by: 1, where: { id_existencia: args.data.id_existencia }, transaction: args.transaction });
                    await original({ transaction: args.transaction, data: { ...args.data, id_detalle_compra: null, motivo: 'Ajuste' } });
                }
                return original(args);
            });
            let compra;
            try { compra = (await post(body('intercalada', [linea(med, { cantidad: 1, costoUnitario: '2' }), linea(med, { cantidad: 1, costoUnitario: '2' })]))).data; }
            finally { mocked.mock.restore(); }
            const before = await snapshot(); await anular(compra, 409); assert.deepEqual(await snapshot(), before);
        });

        await t.test('CU27 permisos, entrada estricta e históricos vencidos/inactivos', async () => {
            const { med, e, compra } = await prepararAnulacion();
            const before = await snapshot();
            for (const rol of ['REGENTE', 'VENDEDOR']) await anular(compra, 403, 'Motivo', rol);
            await anular(compra, 401, 'Motivo', null);
            for (const datos of [{}, { motivo: '' }, { motivo: '  ' }, { motivo: 1 }, { motivo: 'a'.repeat(256) },
                { motivo: 'Motivo', idUsuario: 1 }, { motivo: 'Motivo', fechaAnulacion: '2026-11-01' }]) {
                await request('POST', `/compras/${compra.idCompra}/anular`, 400, datos);
            }
            await request('POST', `/compras/${compra.idCompra}/anular?estado=ANULADA`, 400, { motivo: 'Motivo' });
            await request('POST', '/compras/0/anular', 400, { motivo: 'Motivo' });
            await request('POST', '/compras/2147483647/anular', 404, { motivo: 'Motivo' });
            assert.deepEqual(await snapshot(), before);
            await db.Medicamento.update({ estado: false }, { where: { id_medicamento: med.id_medicamento } });
            await db.ExistenciaMedicamento.update({ fecha_vencimiento: '2026-01-31' }, { where: { id_existencia: e.id_existencia } });
            await db.ProveedorLaboratorio.update({ estado: false }, { where: { id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio } });
            try {
                await anular(compra);
                const consultada = (await request('GET', `/compras/${compra.idCompra}`, 200, undefined, 'REGENTE')).data;
                assert.equal(consultada.estadoOperacion, 'ANULADA'); assert.equal(consultada.proveedorLaboratorio.estado, false);
                const historial = (await request('GET', `/inventario/movimientos?idExistencia=${e.id_existencia}`, 200, undefined, 'REGENTE')).data;
                assert.ok(historial.some(m => m.motivo === 'ANULACION_COMPRA'));
            } finally { await db.ProveedorLaboratorio.update({ estado: true }, { where: { id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio } }); }
        });

        await t.test('CU27 rollback real en saldo, reversión, estado y lectura final permite reintentar sin duplicar', async () => {
            for (const [repository, metodo, numero] of [[existenciaMedicamentoRepository, 'updateSaldoYCosto', 1],
                [movimientoInventarioRepository, 'create', 2], [compraRepository, 'anular', 1], [compraRepository, 'findById', 1]]) {
                const { compra } = await prepararAnulacion(['2', '3']);
                const before = await snapshot(); let llamadas = 0;
                const original = repository[metodo].bind(repository);
                const mocked = t.mock.method(repository, metodo, async (...args) => {
                    const result = await original(...args);
                    if (++llamadas === numero) throw new Error('Fallo sintético posterior a SQL real de anulación');
                    return result;
                });
                try { await anular(compra, 500); assert.equal(llamadas, numero); assert.deepEqual(await snapshot(), before); }
                finally { mocked.mock.restore(); }
                await anular(compra);
                const rows = await movimientosCompra(compra.idCompra);
                assert.equal(rows.filter(m => m.id_movimiento_original !== null).length, 2);
            }
        });

        await t.test('CU27 dos anulaciones simultáneas permiten un solo commit y una reversión por original', async () => {
            const { compra } = await prepararAnulacion(['2', '2']);
            const competir = async () => {
                const response = await fetch(`${base}/compras/${compra.idCompra}/anular`, { method: 'POST', headers: {
                    Cookie: `token=${tokens.ADMINISTRADOR}`, 'Content-Type': 'application/json'
                }, body: JSON.stringify({ motivo: 'Carrera anulación' }), signal: AbortSignal.timeout(25000) });
                requests++; return { status: response.status, body: await response.json() };
            };
            const resultados = await Promise.all([competir(), competir()]);
            assert.deepEqual(resultados.map(r => r.status).sort(), [200, 409]);
            assert.match(resultados.find(r => r.status === 409).body.message, /ya está anulada/);
            assert.equal((await movimientosCompra(compra.idCompra)).filter(m => m.id_movimiento_original !== null).length, 2);
        });

        await t.test('CU27 espera a una compra concurrente y lee sus posteriores actuales antes de compensar', async () => {
            const { med, e, compra } = await prepararAnulacion(['2'], 1, '2.000000');
            let liberar, escrita;
            const barrera = new Promise(resolve => { liberar = resolve; });
            const llego = new Promise(resolve => { escrita = resolve; });
            const original = compraRepository.createDetalle.bind(compraRepository);
            let transactionConcurrente;
            const mocked = t.mock.method(compraRepository, 'createDetalle', async args => {
                const result = await original(args); transactionConcurrente = args.transaction;
                escrita(); await barrera; return result;
            });
            const nueva = post(body('compra-con-anulacion', [linea(med, { cantidad: 1, costoUnitario: '2' })])); nueva.catch(() => {});
            let pendiente;
            try {
                await llego;
                pendiente = anular(compra); pendiente.catch(() => {});
                await waitForBlocker(transactionConcurrente);
                liberar(); await nueva; await pendiente;
                const actual = await db.ExistenciaMedicamento.findByPk(e.id_existencia);
                assert.equal(actual.cantidad_fisica, 2); assert.equal(actual.costo_unitario_promedio, '2.000000');
            } finally { liberar(); mocked.mock.restore(); await nueva.catch(() => {}); if (pendiente) await pendiente.catch(() => {}); }
        });

        await t.test('CU27 anulación de compras distintas sobre una existencia se serializa sin saldos negativos', async () => {
            const { med, e, compra } = await prepararAnulacion(['2'], 1, '2.000000');
            const segunda = (await post(body('otra-a-anular', [linea(med, { cantidad: 1, costoUnitario: '2' })]))).data;
            await Promise.all([anular(compra), anular(segunda)]);
            const actual = await db.ExistenciaMedicamento.findByPk(e.id_existencia);
            assert.equal(actual.cantidad_fisica, 1); assert.equal(actual.costo_unitario_promedio, '2.000000');
        });

        await t.test('Motivos: espera a otra anulación y lee la compensación y su cabecera ANULADA después del commit', async () => {
            const { med, e, compra } = await prepararAnulacion(['2'], 1, '2.000000');
            const segunda = (await post(body('espera-referencia-anulada', [linea(med, { cantidad: 1, costoUnitario: '2' })]))).data;
            let liberar, escrita, transactionConcurrente;
            const barrera = new Promise(resolve => { liberar = resolve; });
            const llego = new Promise(resolve => { escrita = resolve; });
            const original = compraRepository.anular.bind(compraRepository);
            const mocked = t.mock.method(compraRepository, 'anular', async args => {
                const result = await original(args);
                if (args.idCompra === compra.idCompra) {
                    transactionConcurrente = args.transaction; escrita(); await barrera;
                }
                return result;
            });
            const primera = anular(compra); primera.catch(() => {}); let pendiente;
            try {
                await llego;
                pendiente = anular(segunda); pendiente.catch(() => {});
                await waitForBlocker(transactionConcurrente);
                liberar(); await primera; await pendiente;
                const actual = await db.ExistenciaMedicamento.findByPk(e.id_existencia);
                assert.equal(actual.cantidad_fisica, 1); assert.equal(actual.costo_unitario_promedio, '2.000000');
                for (const c of [compra, segunda]) {
                    assert.equal((await db.Compra.findByPk(c.idCompra)).estado_operacion, 'ANULADA');
                    const rows = await movimientosCompra(c.idCompra);
                    assert.equal(rows.filter(m => m.id_movimiento_original !== null && m.motivo === 'ANULACION_COMPRA').length, 1);
                }
            } finally {
                liberar(); mocked.mock.restore(); await primera.catch(() => {}); if (pendiente) await pendiente.catch(() => {});
            }
        });

        await t.test('CU27 un grupo inválido impide toda anulación; A redondea empate hacia arriba una sola vez', async () => {
            const med = await crearMedicamento('ACATOM');
            const compra = (await post(body('anulacion-atomica', [linea(med, { cantidad: 1, costoUnitario: '2' }),
                linea(med, { cantidad: 1, costoUnitario: '2', fechaVencimiento: '2027-04' })]))).data;
            const e = await db.ExistenciaMedicamento.findByPk(compra.detalles[1].idExistencia);
            await posterior(e, 'SALIDA', 1, '2.000000');
            const before = await snapshot(); await anular(compra, 409); assert.deepEqual(await snapshot(), before);
            const redondeada = await prepararAnulacion(['2'], 1, '1.000000');
            await posterior(redondeada.e, 'ENTRADA', 1, '1.000000', '1.333333');
            await anular(redondeada.compra);
            const actual = await db.ExistenciaMedicamento.findByPk(redondeada.e.id_existencia);
            assert.equal(actual.cantidad_fisica, 2); assert.equal(actual.costo_unitario_promedio, '1.000000');
        });

        await t.test('CU27 timeout real se traduce a contención después del rollback, sin reintento automático', async () => {
            const { e, compra } = await prepararAnulacion();
            const blocker = await db.sequelize.transaction(); let pendiente, llamadas = 0;
            const before = await snapshot();
            const original = existenciaMedicamentoRepository.findByIdParaAnular.bind(existenciaMedicamentoRepository);
            const mocked = t.mock.method(existenciaMedicamentoRepository, 'findByIdParaAnular', async args => {
                llamadas++;
                const [{ limite }] = await select('SELECT @@SESSION.innodb_lock_wait_timeout AS limite', { transaction: args.transaction });
                await db.sequelize.query('SET SESSION innodb_lock_wait_timeout = 1', { transaction: args.transaction });
                try { return await original(args); }
                finally { if (!args.transaction.finished) await db.sequelize.query(`SET SESSION innodb_lock_wait_timeout = ${Number(limite)}`, { transaction: args.transaction }); }
            });
            try {
                await original({ idExistencia: e.id_existencia, transaction: blocker });
                pendiente = anular(compra, 409); pendiente.catch(() => {});
                await waitForBlocker(blocker);
                assert.match((await pendiente).message, /contención temporal/);
                assert.equal(llamadas, 1); assert.deepEqual(await snapshot(), before);
            } finally {
                mocked.mock.restore(); if (!blocker.finished) await blocker.rollback();
                if (pendiente) await pendiente.catch(() => {});
            }
            await anular(compra);
        });

        await t.test('CU27 deadlock InnoDB real devuelve contención y conserva toda la compra para reintento', async () => {
            const med = await crearMedicamento('ACDEAD');
            const compra = (await post(body('anulacion-deadlock', [linea(med, { cantidad: 1, costoUnitario: '2' }),
                linea(med, { cantidad: 1, costoUnitario: '2', fechaVencimiento: '2027-04' })]))).data;
            const blocker = await db.sequelize.transaction(); let pendiente;
            const before = await snapshot();
            try {
                await existenciaMedicamentoRepository.findByIdParaAnular({ idExistencia: compra.detalles[1].idExistencia, transaction: blocker });
                // El peso sintético hace que la transacción de anulación sea
                // víctima del ciclo deliberado, como en la prueba de registro.
                const pesos = await db.Medicamento.findAll({ where: { codigo_medicamento: { [db.Sequelize.Op.like]: 'DLP%' } }, raw: true });
                for (const m of pesos) await db.Medicamento.update({ nombre_comercial: 'Peso de deadlock CU27' },
                    { where: { id_medicamento: m.id_medicamento }, transaction: blocker });
                pendiente = anular(compra, 409); pendiente.catch(() => {});
                await waitForBlocker(blocker);
                await existenciaMedicamentoRepository.findByIdParaAnular({ idExistencia: compra.detalles[0].idExistencia, transaction: blocker });
                assert.match((await pendiente).message, /contención temporal/);
                await blocker.rollback(); assert.deepEqual(await snapshot(), before);
            } finally { if (!blocker.finished) await blocker.rollback(); if (pendiente) await pendiente.catch(() => {}); }
            await anular(compra);
        });
        t.diagnostic(`${requests} comprobaciones HTTP, ${queries.length} sentencias reales observadas en ${temporaryDatabase}; registro, anulación, bloqueos, restricciones y rollback verificados.`);
    } finally {
        try {
            if (server) await new Promise(resolve => server.close(resolve));
            if (db) await db.sequelize.close();
        } finally {
            if (databaseCreated) { await runCli('db:drop'); t.diagnostic(`Base temporal eliminada: ${temporaryDatabase}`); }
        }
    }
});
