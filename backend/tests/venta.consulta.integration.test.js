import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Solo MySQL local y una base temporal exclusiva. Nunca tocar bases compartidas.
dotenv.config({ quiet: true });
const baseTest = process.env.DB_NAME_TEST;
const protegidas = [process.env.DB_NAME, process.env.DB_NAME_PRODUCTION].filter(Boolean);
assert.ok(baseTest, 'Configurar DB_NAME_TEST para ejecutar integración');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), 'Usar MySQL local');
assert.equal(protegidas.some(nombre => nombre.toLowerCase() === baseTest.toLowerCase()), false);
const temporal = `${baseTest.slice(0, 25)}_ventas_${randomBytes(6).toString('hex')}`;
assert.match(temporal, /^[a-zA-Z0-9_]+$/);
assert.equal([...protegidas, baseTest].some(nombre => nombre.toLowerCase() === temporal.toLowerCase()), false);
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = temporal;
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_de_ventas_integracion';

const executeFile = promisify(execFile);
const runCli = async comando => {
    try {
        await executeFile(process.execPath, [fileURLToPath(new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url)),
            comando, '--env', 'test'], { cwd: fileURLToPath(new URL('../', import.meta.url)),
            env: { ...process.env }, timeout: 60000 });
    } catch { throw new Error(`Sequelize CLI: ${comando} falló en la base temporal de Ventas`); }
};

test('CU29: consultas HTTP/MySQL en base local aislada', { timeout: 120000 }, async t => {
    let creada = false, db, server;
    try {
        await runCli('db:create'); creada = true;
        await runCli('db:migrate');
        ({ default: db } = await import('../src/data/models/index.js'));
        assert.equal(db.sequelize.config.database, temporal);
        const { app } = await import('../src/app.js');
        const { generarToken } = await import('../src/shared/utils/jwt.js');
        const { ROLES } = await import('../src/shared/constants/roles.js');
        const { ventaRepository } = await import('../src/data/repositories/venta.repository.js');
        const { ventaService } = await import('../src/business/services/venta.service.js');
        const { ventaValidator } = await import('../src/business/validators/venta.validator.js');
        t.mock.method(console, 'error', () => {});
        await db.Rol.bulkCreate(Object.entries(ROLES).map(([nombre, id_rol]) => ({ nombre, id_rol })));
        const usuarios = {};
        for (const [rol, idRol] of Object.entries(ROLES)) {
            usuarios[rol] = await db.Usuario.create({ id_rol: idRol, nombre_usuario: `ventas_${rol}`,
                password_hash: 'hash_sintetico_no_utilizado_para_login' });
        }
        const civil = fecha => db.Sequelize.fn('STR_TO_DATE', fecha, '%Y-%m-%d %H:%i:%s');
        const proveedor = await db.ProveedorLaboratorio.create({ nombre: 'Proveedor sintético' });
        const medicamento = await db.Medicamento.create({ id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio,
            codigo_medicamento: 'VC', nombre_comercial: 'Producto histórico', forma_farmaceutica: 'Tableta',
            presentacion: '500 mg', unidad_inventario: 'tableta', condicion_venta: 'LIBRE',
            via_administracion: 'Oral', tipo_liberacion: 'Inmediata', estado: false });
        const existencia = await db.ExistenciaMedicamento.create({ id_medicamento: medicamento.id_medicamento,
            codigo_existencia: 'VC-001', fecha_vencimiento: '2026-10-15', precision_vencimiento: 'MES',
            cantidad_fisica: 0, costo_unitario_promedio: '0.500000' });
        const pendiente = await db.Venta.create({ id_usuario: usuarios.VENDEDOR.id_usuario,
            fecha_registro: civil('2026-11-01 23:59:59'), fecha_venta: null,
            estado_operacion: 'PENDIENTE', clave_operacion: 'consulta-pendiente', total: '4.50' });
        const confirmada = await db.Venta.create({ id_usuario: usuarios.VENDEDOR.id_usuario,
            fecha_registro: civil('2026-11-01 23:59:59'), fecha_venta: civil('2026-11-02 00:00:00'),
            estado_operacion: 'CONFIRMADA', clave_operacion: 'consulta-confirmada', total: '999999999999.99' });
        const anulada = await db.Venta.create({ id_usuario: usuarios.REGENTE.id_usuario,
            fecha_registro: civil('2026-10-31 12:00:00'), fecha_venta: civil('2026-11-01 12:00:00'),
            estado_operacion: 'ANULADA', clave_operacion: 'consulta-anulada', total: '0.00',
            fecha_anulacion: civil('2026-11-02 12:00:00'), motivo_anulacion: 'Registro histórico sintético',
            id_usuario_anulador: usuarios.ADMINISTRADOR.id_usuario });
        const receta = await db.Receta.create({ id_venta: pendiente.id_venta, fecha_receta: '2026-11-01',
            nombre_paciente: 'Paciente privado', documento_paciente: 'documento_privado', nombre_medico: 'Medico privado',
            archivo_receta: 'fixture_privado_no_es_almacenamiento.pdf', modalidad: 'Fixture' });
        for (let i = 0; i < 2; i++) await db.DetalleVenta.create({ id_venta: pendiente.id_venta,
            id_existencia: existencia.id_existencia, id_receta: receta.id_receta,
            cantidad: i + 1, precio_unitario: '1.50', subtotal: i ? '3.00' : '1.50' });

        const snapshot = async () => JSON.stringify(await Promise.all([
            db.Venta, db.DetalleVenta, db.Receta, db.ExistenciaMedicamento, db.MovimientoInventario
        ].map(model => model.findAll({ raw: true, order: [[model.primaryKeyAttribute, 'ASC']] }))));
        const antes = await snapshot();
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const request = async (rol, path = '', status = 200) => {
            const idRol = ROLES[rol];
            const token = rol ? generarToken({ idUsuario: usuarios[rol].id_usuario, idRol, versionCredenciales: 0 }) : null;
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ventas${path}`, {
                headers: token ? { Cookie: `token=${token}` } : {}, signal: AbortSignal.timeout(10000)
            });
            const body = await response.json();
            assert.equal(response.status, status, JSON.stringify(body));
            assert.doesNotMatch(JSON.stringify(body), /password|archivo_receta|archivoReceta|Paciente privado|documento_privado|Medico privado/);
            return body;
        };

        await t.test('Tres roles consultan todos los estados, conteo y orden estables', async () => {
            for (const rol of Object.keys(ROLES)) {
                const body = await request(rol);
                assert.deepEqual(body.data.map(v => v.idVenta), [confirmada.id_venta, pendiente.id_venta, anulada.id_venta]);
                assert.equal(body.paginacion.total, 3);
                assert.equal(body.data[0].total, '999999999999.99');
                assert.equal(body.data[1].fechaVenta, null);
                assert.equal(body.data[1].fechaRegistro, '2026-11-01 23:59:59');
            }
        });
        await t.test('Paginación real no duplica ventas por sus detalles', async () => {
            for (let pagina = 1; pagina <= 3; pagina++) {
                const body = await request('VENDEDOR', `?pagina=${pagina}&limite=1`);
                assert.equal(body.data.length, 1);
                assert.deepEqual(body.paginacion, { pagina, limite: 1, total: 3, totalPaginas: 3 });
            }
            const body = await request('REGENTE', '?pagina=4&limite=1');
            assert.deepEqual(body.data, []);
            assert.equal(body.paginacion.total, 3);
        });
        await t.test('Fechas de registro y venta efectiva, límites inclusivos y responsable', async () => {
            const registro = await request('ADMINISTRADOR', '?desde=2026-11-01&hasta=2026-11-01');
            assert.deepEqual(registro.data.map(v => v.idVenta), [confirmada.id_venta, pendiente.id_venta]);
            const efectiva = await request('REGENTE', '?campoFecha=fechaVenta&desde=2026-11-01&hasta=2026-11-01');
            assert.deepEqual(efectiva.data.map(v => v.idVenta), [anulada.id_venta]);
            const filtrada = await request('VENDEDOR', '?campoFecha=fechaVenta&desde=2026-11-02&hasta=2026-11-02' +
                `&estadoOperacion=CONFIRMADA&idUsuario=${usuarios.VENDEDOR.id_usuario}&idVenta=${confirmada.id_venta}`);
            assert.deepEqual(filtrada.data.map(v => v.idVenta), [confirmada.id_venta]);
            for (const estado of ['PENDIENTE', 'CONFIRMADA', 'ANULADA']) {
                const body = await request('REGENTE', `?estadoOperacion=${estado}`);
                assert.equal(body.paginacion.total, 1);
                assert.equal(body.data[0].estadoOperacion, estado);
            }
        });
        await t.test('Detalle público, referencias y ausencia de coincidencias', async () => {
            const { data } = await request('VENDEDOR', `/${pendiente.id_venta}`);
            assert.equal(data.detalles.length, 2);
            assert.equal(data.detalles[0].precioUnitario, '1.50');
            assert.equal(data.detalles[0].existencia.fechaVencimiento, '2026-10-15');
            assert.equal(data.detalles[0].existencia.medicamento.estado, false);
            assert.deepEqual(data.recetas, [{ idReceta: receta.id_receta, idVenta: pendiente.id_venta, resultadoRevision: null }]);
            const historica = (await request('ADMINISTRADOR', `/${anulada.id_venta}`)).data;
            assert.equal(historica.fechaVenta, '2026-11-01 12:00:00');
            assert.equal(historica.usuarioAnulador.idUsuario, usuarios.ADMINISTRADOR.id_usuario);
            assert.deepEqual((await request('REGENTE', '?idVenta=2147483647')).data, []);
            await request('REGENTE', '/2147483647', 404);
        });
        await t.test('Sin sesión y entradas inválidas se rechazan', async () => {
            await request(null, '', 401);
            for (const path of ['?limite=101', '?desde=2026-02-29', '?pagina=0',
                '?idUsuario=1&idUsuario=2', '/0', `/${pendiente.id_venta}?otro=1`]) {
                await request('VENDEDOR', path, 400);
            }
        });
        await t.test('Conteo y página usan un mismo snapshot ante escritura concurrente', async () => {
            const originalCount = db.Venta.count.bind(db.Venta);
            let transactionObserved;
            const mocked = t.mock.method(db.Venta, 'count', async options => {
                transactionObserved = options.transaction;
                const total = await originalCount(options);
                await db.Venta.create({ id_usuario: usuarios.VENDEDOR.id_usuario,
                    fecha_registro: civil('2026-11-03 12:00:00'), estado_operacion: 'PENDIENTE',
                    clave_operacion: 'concurrente-solo-fixture', total: '0.00' });
                return total;
            });
            let resultado;
            try {
                resultado = await ventaService.getVentas(ventaValidator.validateFiltros({}).data);
            } finally { mocked.mock.restore(); }
            assert.equal(resultado.total, 3);
            assert.equal(resultado.rows.length, 3);
            assert.equal(transactionObserved.finished, 'commit');
            // Limpiar exclusivamente el fixture concurrente creado en esta base temporal.
            await db.Venta.destroy({ where: { clave_operacion: 'concurrente-solo-fixture' } });
        });
        await t.test('Fallo de lectura revierte la transacción y devuelve error, no lista vacía', async () => {
            let transactionObserved;
            const mocked = t.mock.method(ventaRepository, 'findAll', async (filtros, { transaction }) => {
                transactionObserved = transaction;
                throw new Error('Fallo técnico sintético privado');
            });
            try {
                assert.deepEqual(await request('ADMINISTRADOR', '', 500), { message: 'Error interno del servidor' });
            } finally { mocked.mock.restore(); }
            assert.equal(transactionObserved.finished, 'rollback');
        });
        assert.equal(await snapshot(), antes, 'Las consultas no alteran ventas, recetas ni inventario');
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (db) await db.sequelize.close();
        if (creada) await runCli('db:drop');
    }
});
