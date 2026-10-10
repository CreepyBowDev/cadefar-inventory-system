import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Seleccionar una base local exclusiva antes de importar modelos o la app.
// Las migraciones y los fixtures se ejecutan solo allí; se elimina al finalizar.
dotenv.config({ quiet: true });
const testDatabase = process.env.DB_NAME_TEST;
const protectedDatabases = [process.env.DB_NAME, process.env.DB_NAME_PRODUCTION].filter(Boolean);
assert.ok(testDatabase, 'Configurar DB_NAME_TEST para ejecutar integración');
assert.equal(protectedDatabases.some(name => name.toLowerCase() === testDatabase.toLowerCase()), false,
    'La base de pruebas debe ser distinta de desarrollo y producción');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), 'Usar MySQL local');
const temporaryDatabase = `${testDatabase.slice(0, 30)}_inv_${randomBytes(6).toString('hex')}`;
assert.match(temporaryDatabase, /^[a-zA-Z0-9_]+$/);
assert.equal([testDatabase, ...protectedDatabases].some(name => name.toLowerCase() === temporaryDatabase.toLowerCase()), false);
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = temporaryDatabase;
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_de_integracion_inventario';

const executeFile = promisify(execFile);
const cliPath = fileURLToPath(new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url));
const runCli = async (command) => {
    try {
        await executeFile(process.execPath, [cliPath, command, '--env', 'test'], {
            cwd: fileURLToPath(new URL('../', import.meta.url)), env: { ...process.env }, timeout: 60000
        });
    } catch { throw new Error(`Sequelize CLI: ${command} falló en la base temporal de Inventario`); }
};

test('Fases 1A/1B: integración real HTTP/MySQL en base temporal aislada', { timeout: 180000 }, async t => {
    let databaseCreated = false, db, server;
    try {
        await runCli('db:create');
        databaseCreated = true;
        await runCli('db:migrate');
        ({ default: db } = await import('../src/data/models/index.js'));
        db.sequelize.options.logging = false;
        assert.equal(db.sequelize.config.database, temporaryDatabase);
        const { app } = await import('../src/app.js');
        const { generarToken } = await import('../src/shared/utils/jwt.js');
        const { ROLES } = await import('../src/shared/constants/roles.js');

        await db.Rol.bulkCreate([
            { id_rol: ROLES.ADMINISTRADOR, nombre: 'Administrador' },
            { id_rol: ROLES.REGENTE, nombre: 'Regente' },
            { id_rol: ROLES.VENDEDOR, nombre: 'Vendedor' }
        ]);
        const hash = await bcrypt.hash('Sintetica-123!', 4);
        const usuarios = {};
        for (const [rol, idRol] of Object.entries(ROLES)) {
            usuarios[rol] = await db.Usuario.create({ id_rol: idRol, nombre_usuario: `integracion_${rol}`, password_hash: hash });
        }
        const usuarioInactivo = await db.Usuario.create({
            id_rol: ROLES.VENDEDOR, nombre_usuario: 'integracion_inactivo', password_hash: hash, estado: false
        });
        const usuarioRevocado = await db.Usuario.create({
            id_rol: ROLES.VENDEDOR, nombre_usuario: 'integracion_revocado', password_hash: hash, version_credenciales: 1
        });
        const proveedor = await db.ProveedorLaboratorio.create({ nombre: 'Proveedor sintético de Inventario' });
        const crearMedicamento = (codigo, nombre, estado = true, stockMinimo = 10) => db.Medicamento.create({
            id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio,
            codigo_medicamento: codigo, nombre_comercial: nombre, estado,
            forma_farmaceutica: 'Tableta', presentacion: '500 mg', unidad_inventario: 'tableta',
            stock_minimo: stockMinimo, condicion_venta: 'Venta libre', via_administracion: 'Oral', tipo_liberacion: 'Inmediata'
        });
        const activo = await crearMedicamento('PAR', 'Paracetamol de prueba');
        const inactivo = await crearMedicamento('INA', 'Medicamento inactivo', false);
        const sinExistencias = await crearMedicamento('SIN', 'Sin existencias');
        const literal = await crearMedicamento('PAR%_LIT', 'Producto 100%_ literal', true, 6);
        const historico = await crearMedicamento('HIS', 'MES histórico no canónico');
        const alertas = await crearMedicamento('ALR', 'Límites de alertas', true, 0);
        const alertasInactivo = await crearMedicamento('ALI', 'Alertas de inactivo', false);
        const crearExistencia = (medicamento, correlativo, fecha, precision, saldo, costo = '1.250000') =>
            db.ExistenciaMedicamento.create({
                id_medicamento: medicamento.id_medicamento,
                codigo_existencia: `${medicamento.codigo_medicamento}-${correlativo}`,
                fecha_vencimiento: fecha, precision_vencimiento: precision,
                cantidad_fisica: saldo, costo_unitario_promedio: costo
            });
        const mes = await crearExistencia(activo, '001', '2026-10-31', 'MES', 5, '12345678.123456');
        const dia = await crearExistencia(activo, '002', '2026-10-31', 'DIA', 7);
        const siguienteDia = await crearExistencia(activo, '003', '2026-11-01', 'DIA', 4);
        const vencida = await crearExistencia(activo, '004', '2026-10-30', 'DIA', 3);
        const agotada = await crearExistencia(activo, '005', '2027-01-01', 'DIA', 0);
        const existenciaInactiva = await crearExistencia(inactivo, '001', '2028-01-31', 'MES', 8);
        const existenciaLiteral = await crearExistencia(literal, '001', '2028-01-31', 'MES', 6);
        const existenciaHistorica = await crearExistencia(historico, '001', '2026-10-01', 'MES', 2);
        const limiteDia = await crearExistencia(alertas, '001', '2027-01-31', 'DIA', 1);
        const limiteMes = await crearExistencia(alertas, '002', '2027-01-31', 'MES', 1);
        const fueraDia = await crearExistencia(alertas, '003', '2027-02-01', 'DIA', 1);
        const fueraMes = await crearExistencia(alertas, '004', '2027-02-28', 'MES', 1);
        const masDe90Dias = await crearExistencia(alertas, '005', '2027-01-30', 'DIA', 1);
        const agotadaMes = await crearExistencia(alertas, '006', '2026-10-31', 'MES', 0);
        const agotadaVencida = await crearExistencia(alertas, '007', '2026-10-30', 'DIA', 0);
        const proximaInactiva = await crearExistencia(alertasInactivo, '001', '2026-10-31', 'MES', 2);
        const vencidaInactiva = await crearExistencia(alertasInactivo, '002', '2026-10-30', 'DIA', 3);

        // Horas civiles sintéticas exactas: no pasar estos DATETIME por Date.
        // Son fixtures históricos, no una implementación de operaciones de escritura.
        const fechaLiteral = fecha => db.Sequelize.literal(db.sequelize.escape(fecha));
        const crearMovimiento = (existencia, direccion, cantidad, fecha, extra = {}) => db.MovimientoInventario.create({
            id_existencia: existencia.id_existencia, id_usuario: usuarios.REGENTE.id_usuario,
            direccion, cantidad, fecha_movimiento: fechaLiteral(fecha), motivo: 'Ajuste',
            costo_unitario_aplicado: existencia.costo_unitario_promedio, ...extra
        });
        for (const existencia of [mes, dia, siguienteDia, vencida, existenciaLiteral, existenciaHistorica,
            limiteDia, limiteMes, fueraDia, fueraMes, masDe90Dias, proximaInactiva, vencidaInactiva]) {
            await crearMovimiento(existencia, 'ENTRADA', existencia.cantidad_fisica, '2026-09-01 08:00:00');
        }
        await crearMovimiento(agotada, 'ENTRADA', 1, '2026-09-01 08:00:00');
        await crearMovimiento(agotada, 'SALIDA', 1, '2026-09-02 08:00:00');
        const compra = await db.Compra.create({
            id_usuario: usuarios.ADMINISTRADOR.id_usuario,
            id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio,
            fecha_compra: '2026-10-01', clave_operacion: 'compra_sintetica_inventario', total: '10.00',
            estado_operacion: 'ANULADA', fecha_anulacion: fechaLiteral('2026-10-31 23:59:59'),
            motivo_anulacion: 'Fixture de historial', id_usuario_anulador: usuarios.ADMINISTRADOR.id_usuario
        });
        const detalleCompra = await db.DetalleCompra.create({
            id_compra: compra.id_compra, id_existencia: existenciaInactiva.id_existencia,
            cantidad: 8, costo_unitario: '1.250000', subtotal: '10.00'
        });
        const original = await crearMovimiento(existenciaInactiva, 'ENTRADA', 8, '2026-10-01 00:00:00', {
            motivo: 'Compra', id_detalle_compra: detalleCompra.id_detalle_compra
        });
        const reversion = await crearMovimiento(existenciaInactiva, 'SALIDA', 8, '2026-10-31 23:59:59', {
            motivo: 'Reversión', id_movimiento_original: original.id_movimiento, observacion: 'Fixture de anulación'
        });
        const ajuste = await crearMovimiento(existenciaInactiva, 'ENTRADA', 10, '2026-10-31 23:59:59');
        const venta = await db.Venta.create({
            id_usuario: usuarios.VENDEDOR.id_usuario, clave_operacion: 'venta_sintetica_inventario',
            total: '7.50', estado_operacion: 'CONFIRMADA', fecha_venta: fechaLiteral('2026-11-01 00:00:00')
        });
        const detalleVenta = await db.DetalleVenta.create({
            id_venta: venta.id_venta, id_existencia: existenciaInactiva.id_existencia,
            cantidad: 2, precio_unitario: '3.750000', subtotal: '7.50'
        });
        const salidaVenta = await crearMovimiento(existenciaInactiva, 'SALIDA', 2, '2026-11-01 00:00:00', {
            motivo: 'Venta', id_detalle_venta: detalleVenta.id_detalle_venta
        });

        const snapshot = async () => {
            const state = {};
            for (const model of [db.Medicamento, db.ExistenciaMedicamento, db.MovimientoInventario,
                db.Compra, db.DetalleCompra, db.Venta, db.DetalleVenta]) {
                state[model.name] = await model.findAll({ raw: true, order: [[model.primaryKeyAttribute, 'ASC']] });
            }
            return state;
        };
        const before = await snapshot();
        const queries = [];
        const originalQuery = db.sequelize.query.bind(db.sequelize);
        t.mock.method(db.sequelize, 'query', (sql, options) => {
            // De aquí al cierre solo se permiten SELECT reales sobre la base aislada.
            assert.equal(options.type, db.Sequelize.QueryTypes.SELECT);
            assert.match(sql, /^SELECT /);
            queries.push(sql);
            return originalQuery(sql, options);
        });
        t.mock.method(console, 'error', error => { assert.equal(error.name, 'AppError'); });
        t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-01T03:59:59Z') });
        const tokenUsuario = (usuario, versionCredenciales = usuario.version_credenciales, idRol = usuario.id_rol) =>
            generarToken({ idUsuario: usuario.id_usuario, idRol, versionCredenciales });
        const tokens = Object.fromEntries(Object.entries(usuarios).map(([rol, usuario]) => [rol, tokenUsuario(usuario)]));
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
        const base = `http://127.0.0.1:${server.address().port}/api/inventario`;
        let requests = 0;
        const request = async (rol, path, status = 200, token = tokens[rol]) => {
            const response = await fetch(`${base}${path}`, {
                headers: token ? { Cookie: `token=${token}` } : {}, signal: AbortSignal.timeout(15000)
            });
            const result = await response.json();
            requests++;
            assert.equal(response.status, status, `${rol ?? 'sin sesión'} ${path}: ${JSON.stringify(result)}`);
            assert.equal(/"(?:password|password_hash|passwordHash|token|correo|versionCredenciales|version_credenciales)"\s*:/.test(JSON.stringify(result)), false);
            return result;
        };
        const existenciasPath = id => `/medicamentos/${id}/existencias`;
        const movimientosPath = `/movimientos?idExistencia=${existenciaInactiva.id_existencia}`;

        await t.test('Inventario: LEFT JOIN, totales, fechas civiles y DECIMAL sin pérdida', async () => {
            const result = await request('VENDEDOR', '');
            assert.deepEqual(result.meta, { fechaComercial: '2026-10-31', zonaHoraria: 'America/La_Paz' });
            assert.equal(result.data.length, 7);
            const producto = result.data.find(m => m.idMedicamento === activo.id_medicamento);
            assert.equal(producto.stockFisico, 19);
            assert.equal(producto.stockVendible, 9);
            assert.deepEqual(producto.existencias.map(e => e.idExistencia),
                [vencida, dia, mes, siguienteDia, agotada].map(e => e.id_existencia));
            const existenciaMes = producto.existencias.find(e => e.idExistencia === mes.id_existencia);
            assert.equal(existenciaMes.costoUnitarioPromedio, '12345678.123456');
            assert.equal(existenciaMes.fechaVencimiento, '2026-10-31');
            assert.equal(existenciaMes.fechaEfectivaVencimiento, '2026-11-01');
            assert.equal(existenciaMes.vencida, false);
            assert.equal(producto.existencias.find(e => e.idExistencia === dia.id_existencia).vencida, true);
            assert.equal(producto.existencias.find(e => e.idExistencia === agotada.id_existencia).stockFisico, 0);
            const sin = result.data.find(m => m.idMedicamento === sinExistencias.id_medicamento);
            assert.deepEqual(sin.existencias, []);
            assert.equal(sin.stockFisico, 0);
            assert.equal(sin.stockVendible, 0);
        });

        await t.test('Inactivos conservan saldo físico e historial y tienen vendible cero', async () => {
            const result = await request('REGENTE', `?idMedicamento=${inactivo.id_medicamento}`);
            assert.equal(result.data.length, 1);
            assert.equal(result.data[0].estado, false);
            assert.equal(result.data[0].stockFisico, 8);
            assert.equal(result.data[0].stockVendible, 0);
            assert.equal(result.data[0].existencias[0].vencida, false);
            assert.equal((await request('REGENTE', movimientosPath)).data.length, 4);
        });

        await t.test('Existente vacío devuelve 200; inexistente 404; filtros sin coincidencias devuelven []', async () => {
            assert.deepEqual((await request('REGENTE', existenciasPath(sinExistencias.id_medicamento))).data, []);
            await request('REGENTE', existenciasPath(2147483647), 404);
            assert.deepEqual((await request('VENDEDOR', '?idMedicamento=2147483647')).data, []);
            assert.deepEqual((await request('REGENTE', '/movimientos?idExistencia=2147483647')).data, []);
            const data = (await request('VENDEDOR', existenciasPath(activo.id_medicamento))).data;
            assert.equal(data.length, 5);
        });

        await t.test('Matriz completa de roles y errores de sesión utiliza JWT y usuarios reales', async () => {
            for (const rol of Object.keys(ROLES)) {
                await request(rol, '');
                await request(rol, existenciasPath(activo.id_medicamento));
                await request(rol, '/movimientos', rol === 'VENDEDOR' ? 403 : 200);
            }
            for (const path of ['', existenciasPath(activo.id_medicamento), '/movimientos']) {
                await request(null, path, 401);
                await request(null, path, 401, 'invalido');
            }
            await request(null, '', 401, tokenUsuario(usuarioInactivo));
            await request(null, '', 401, tokenUsuario(usuarioRevocado, 0));
            await request(null, '/movimientos', 403, tokenUsuario(usuarios.VENDEDOR, 0, ROLES.ADMINISTRADOR));
        });

        await t.test('Filtros de código/nombre tratan % y _ como texto y combinan condiciones', async () => {
            for (const query of ['codigoMedicamento=PAR%25_', 'nombreComercial=100%25_']) {
                assert.deepEqual((await request('VENDEDOR', `?${query}`)).data.map(m => m.idMedicamento), [literal.id_medicamento]);
            }
            assert.equal((await request('REGENTE', '?codigoMedicamento=PAR')).data.length, 2);
            const result = await request('REGENTE', `?idMedicamento=${activo.id_medicamento}&codigoMedicamento=PAR&nombreComercial=Paracetamol`);
            assert.deepEqual(result.data.map(m => m.idMedicamento), [activo.id_medicamento]);
            assert.deepEqual((await request('REGENTE', `?codigoMedicamento=${encodeURIComponent("%' OR 1=1 --")}`)).data, []);
        });

        await t.test('Historial conserva fuentes, originales y reversiones; orden estable para horas iguales', async () => {
            const result = await request('ADMINISTRADOR', movimientosPath);
            assert.deepEqual(result.data.map(m => m.idMovimiento),
                [salidaVenta, ajuste, reversion, original].map(m => m.id_movimiento));
            const originalPublico = result.data.find(m => m.idMovimiento === original.id_movimiento);
            const reversionPublica = result.data.find(m => m.idMovimiento === reversion.id_movimiento);
            assert.equal(originalPublico.idMovimientoReversion, reversion.id_movimiento);
            assert.equal(reversionPublica.idMovimientoOriginal, original.id_movimiento);
            assert.equal(reversionPublica.cantidad, originalPublico.cantidad);
            assert.equal(reversionPublica.costoUnitarioAplicado, originalPublico.costoUnitarioAplicado);
            assert.deepEqual(originalPublico.compra, { idCompra: compra.id_compra, idDetalleCompra: detalleCompra.id_detalle_compra });
            assert.deepEqual(result.data[0].venta, { idVenta: venta.id_venta, idDetalleVenta: detalleVenta.id_detalle_venta });
            assert.equal(originalPublico.existencia.medicamento.estado, false);
            assert.deepEqual(Object.keys(originalPublico.usuario).sort(), ['idUsuario', 'nombreUsuario']);
            assert.equal(result.data[0].fechaMovimiento, '2026-11-01 00:00:00');
            assert.equal(reversionPublica.fechaMovimiento, '2026-10-31 23:59:59');
        });

        await t.test('Filtros de historial incluyen ambos extremos civiles y no desplazan DATETIME', async () => {
            const delDia = await request('REGENTE', `${movimientosPath}&desde=2026-10-31&hasta=2026-10-31`);
            assert.deepEqual(delDia.data.map(m => m.idMovimiento), [ajuste.id_movimiento, reversion.id_movimiento]);
            const delMes = await request('REGENTE', `${movimientosPath}&desde=2026-10-01&hasta=2026-10-31`);
            assert.equal(delMes.data.length, 3);
            assert.equal(delMes.data.at(-1).fechaMovimiento, '2026-10-01 00:00:00');
            assert.deepEqual((await request('REGENTE', `${movimientosPath}&desde=2026-11-01`)).data.map(m => m.idMovimiento), [salidaVenta.id_movimiento]);
            assert.deepEqual((await request('REGENTE', `${movimientosPath}&hasta=2026-10-01`)).data.map(m => m.idMovimiento), [original.id_movimiento]);
            assert.deepEqual((await request('REGENTE', `${movimientosPath}&direccion=SALIDA&motivo=${encodeURIComponent('Reversión')}`)).data.map(m => m.idMovimiento), [reversion.id_movimiento]);
            assert.equal((await request('REGENTE', `/movimientos?idMedicamento=${inactivo.id_medicamento}`)).data.length, 4);
            assert.deepEqual((await request('REGENTE', `${movimientosPath}&idMedicamento=${activo.id_medicamento}`)).data, []);
        });

        await t.test('Validación real rechaza IDs, campos desconocidos, fechas imposibles y rangos invertidos', async () => {
            for (const path of ['?estado=true', '?idMedicamento=1e2', '?idMedicamento=1&idMedicamento=2',
                '/medicamentos/0/existencias', '/medicamentos/abc/existencias',
                `${existenciasPath(activo.id_medicamento)}?stockBajo=true`,
                '/movimientos?desde=2026-02-29', '/movimientos?desde=2026-11-01&hasta=2026-10-31',
                '/movimientos?direccion=salida', '/movimientos?idExistencia=1%20OR%201=1',
                '/movimientos?idUsuario=1']) {
                await request('REGENTE', path, 400);
            }
        });

        await t.test('MES histórico se devuelve sin normalizar su fecha guardada', async () => {
            const result = await request('REGENTE', existenciasPath(historico.id_medicamento));
            assert.equal(result.data[0].fechaVencimiento, '2026-10-01');
            assert.equal(result.data[0].fechaEfectivaVencimiento, '2026-11-01');
            assert.equal(result.data[0].stockVendible, 2);
        });

        await t.test('Fase 1B: próximos incluyen límite exacto, más de 90 días e inactivos con saldo', async () => {
            const result = await request('REGENTE', '/proximos-a-vencer');
            assert.deepEqual(result.meta, {
                fechaComercial: '2026-10-31', zonaHoraria: 'America/La_Paz', fechaHasta: '2027-01-31'
            });
            assert.deepEqual(result.data.map(e => e.idExistencia),
                [mes, existenciaHistorica, proximaInactiva, siguienteDia, masDe90Dias, limiteDia, limiteMes]
                    .map(e => e.id_existencia));
            const mensualLimite = result.data.find(e => e.idExistencia === limiteMes.id_existencia);
            assert.equal(mensualLimite.fechaEtiquetaNormalizada, '2027-01-31');
            assert.equal(mensualLimite.fechaEfectivaVencimiento, '2027-02-01');
            const historica = result.data.find(e => e.idExistencia === existenciaHistorica.id_existencia);
            assert.equal(historica.fechaVencimiento, '2026-10-01');
            assert.equal(historica.fechaEtiquetaNormalizada, '2026-10-31');
            const inactiva = result.data.find(e => e.idExistencia === proximaInactiva.id_existencia);
            assert.equal(inactiva.medicamento.estado, false);
            assert.equal(inactiva.stockFisico, 2);
            assert.equal(inactiva.stockVendible, 0);
            assert.equal(result.data.every(e => e.stockFisico > 0 && !e.vencida), true);
            for (const excluida of [dia, vencida, fueraDia, fueraMes, agotadaMes, agotadaVencida, vencidaInactiva]) {
                assert.equal(result.data.some(e => e.idExistencia === excluida.id_existencia), false);
            }
        });

        await t.test('Fase 1B: vencidos incluyen inactivos y excluyen saldos cero y MES aún vendible', async () => {
            const result = await request('ADMINISTRADOR', '/vencidos');
            assert.deepEqual(result.data.map(e => e.idExistencia), [vencida, vencidaInactiva, dia].map(e => e.id_existencia));
            assert.equal(result.data.every(e => e.stockFisico > 0 && e.vencida && e.stockVendible === 0), true);
            assert.equal(result.data.find(e => e.idExistencia === vencidaInactiva.id_existencia).medicamento.estado, false);
        });

        await t.test('Fase 1B: stock bajo utiliza suma vendible, incluye igualdad y productos sin existencias', async () => {
            const result = await request('VENDEDOR', '/stock-bajo');
            assert.deepEqual(result.data.map(m => m.idMedicamento),
                [activo, sinExistencias, literal, historico].map(m => m.id_medicamento));
            const producto = result.data.find(m => m.idMedicamento === activo.id_medicamento);
            assert.equal(producto.stockFisico, 19);
            assert.equal(producto.stockVendible, 9);
            const igualdad = result.data.find(m => m.idMedicamento === literal.id_medicamento);
            assert.equal(igualdad.stockVendible, igualdad.stockMinimo);
            assert.equal(result.data.every(m => m.estado && m.stockVendible <= m.stockMinimo), true);
            assert.deepEqual((await request('REGENTE', `/stock-bajo?idMedicamento=${alertas.id_medicamento}`)).data, []);
            assert.deepEqual((await request('REGENTE', `/stock-bajo?idMedicamento=${alertasInactivo.id_medicamento}`)).data, []);
        });

        await t.test('Fase 1B: roles, búsquedas literales, filtros desconocidos y listas vacías', async () => {
            for (const path of ['/proximos-a-vencer', '/vencidos', '/stock-bajo']) {
                for (const rol of Object.keys(ROLES)) {
                    await request(rol, path, rol === 'VENDEDOR' && path !== '/stock-bajo' ? 403 : 200);
                }
                await request(null, path, 401);
                await request('REGENTE', `${path}?estado=true`, 400);
                await request('REGENTE', `${path}?meses=6`, 400);
                await request('REGENTE', `${path}?idMedicamento=1&idMedicamento=2`, 400);
                assert.deepEqual((await request('REGENTE', `${path}?idMedicamento=2147483647`)).data, []);
            }
            const inactivosProximos = await request('REGENTE', `/proximos-a-vencer?idMedicamento=${alertasInactivo.id_medicamento}`);
            assert.deepEqual(inactivosProximos.data.map(e => e.idExistencia), [proximaInactiva.id_existencia]);
            const inactivosVencidos = await request('REGENTE', `/vencidos?codigoMedicamento=ALI&nombreComercial=Alertas`);
            assert.deepEqual(inactivosVencidos.data.map(e => e.idExistencia), [vencidaInactiva.id_existencia]);
            const literalBajo = await request('VENDEDOR', '/stock-bajo?codigoMedicamento=PAR%25_');
            assert.deepEqual(literalBajo.data.map(m => m.idMedicamento), [literal.id_medicamento]);
        });

        await t.test('Fase 1B: tres meses desde noviembre ajustan a febrero sin usar 90 días', async () => {
            t.mock.timers.setTime(new Date('2026-12-01T03:59:59Z').getTime());
            const token = tokenUsuario(usuarios.REGENTE);
            const result = await request('REGENTE', `/proximos-a-vencer?idMedicamento=${alertas.id_medicamento}`, 200, token);
            assert.equal(result.meta.fechaComercial, '2026-11-30');
            assert.equal(result.meta.fechaHasta, '2027-02-28');
            assert.deepEqual(result.data.map(e => e.idExistencia),
                [masDe90Dias, limiteDia, limiteMes, fueraDia, fueraMes].map(e => e.id_existencia));
            t.mock.timers.setTime(new Date('2026-11-01T03:59:59Z').getTime());
        });

        await t.test('Medianoche en La Paz cambia vendibilidad y conserva todos los saldos', async () => {
            t.mock.timers.setTime(new Date('2026-11-01T04:00:00Z').getTime());
            const result = await request('VENDEDOR', `?idMedicamento=${activo.id_medicamento}`);
            assert.equal(result.meta.fechaComercial, '2026-11-01');
            assert.equal(result.data[0].stockFisico, 19);
            assert.equal(result.data[0].stockVendible, 0);
            const nuevosVencidos = await request('REGENTE', `/vencidos?idMedicamento=${alertasInactivo.id_medicamento}`);
            assert.deepEqual(nuevosVencidos.data.map(e => e.idExistencia),
                [vencidaInactiva, proximaInactiva].map(e => e.id_existencia));
            assert.deepEqual((await request('REGENTE', `/proximos-a-vencer?idMedicamento=${alertasInactivo.id_medicamento}`)).data, []);
            assert.deepEqual((await request('VENDEDOR', `/stock-bajo?idMedicamento=${inactivo.id_medicamento}`)).data, []);
            const after = await snapshot();
            assert.deepEqual(after, before, 'Todas las consultas deben conservar registros, fechas, saldos y costos');
            const saldos = await db.sequelize.query("SELECT e.id_existencia, e.cantidad_fisica, COALESCE(SUM(CASE WHEN m.direccion = 'ENTRADA' THEN m.cantidad ELSE -m.cantidad END),0) AS saldo_movimientos FROM existencia_medicamento e LEFT JOIN movimiento_inventario m ON m.id_existencia = e.id_existencia GROUP BY e.id_existencia, e.cantidad_fisica", { type: db.Sequelize.QueryTypes.SELECT });
            for (const saldo of saldos) assert.equal(saldo.cantidad_fisica, Number(saldo.saldo_movimientos));
        });
        t.diagnostic(`${requests} comprobaciones HTTP y ${queries.length} SELECT reales; datos sintéticos conciliados y base temporal eliminada al finalizar.`);
    } finally {
        try {
            if (server) await new Promise(resolve => server.close(resolve));
            if (db) await db.sequelize.close();
        } finally {
            if (databaseCreated) await runCli('db:drop');
        }
    }
});
