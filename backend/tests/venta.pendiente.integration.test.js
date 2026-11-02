import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Crear y eliminar únicamente una base temporal exclusiva en MySQL local.
dotenv.config({ quiet: true });
const baseTest = process.env.DB_NAME_TEST;
const protegidas = [process.env.DB_NAME, process.env.DB_NAME_PRODUCTION].filter(Boolean);
assert.ok(baseTest, 'Configurar DB_NAME_TEST para ejecutar integración');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), 'Usar MySQL local');
assert.equal(protegidas.some(nombre => nombre.toLowerCase() === baseTest.toLowerCase()), false);
const temporal = `${baseTest.slice(0, 20)}_venta_pend_${randomBytes(6).toString('hex')}`;
assert.match(temporal, /^[a-zA-Z0-9_]+$/);
assert.equal([...protegidas, baseTest].some(nombre => nombre.toLowerCase() === temporal.toLowerCase()), false);
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = temporal;
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_de_venta_pendiente';
const executeFile = promisify(execFile);
const runCli = async comando => {
    try {
        await executeFile(process.execPath, [fileURLToPath(new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url)),
            comando, '--env', 'test'], { cwd: fileURLToPath(new URL('../', import.meta.url)),
            env: { ...process.env }, timeout: 60000 });
    } catch { throw new Error(`Sequelize CLI: ${comando} falló en la base temporal de Venta pendiente`); }
};

test('CU28 parcial: registro pendiente HTTP/MySQL, auditoría, rollback y duplicados concurrentes',
    { timeout: 120000 }, async t => {
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
        const { medicamentoRepository } = await import('../src/data/repositories/medicamento.repository.js');
        const { existenciaMedicamentoRepository } = await import('../src/data/repositories/existencia-medicamento.repository.js');
        const { bitacoraAuditoriaRepository } = await import('../src/data/repositories/bitacora-auditoria.repository.js');
        t.mock.method(console, 'error', () => {});
        await db.Rol.bulkCreate(Object.entries(ROLES).map(([nombre, id_rol]) => ({ nombre, id_rol })));
        const usuarios = {};
        for (const [rol, idRol] of Object.entries(ROLES)) usuarios[rol] = await db.Usuario.create({
            id_rol: idRol, nombre_usuario: `pendiente_${rol}`, password_hash: 'hash_sintetico_no_login' });
        const proveedor = await db.ProveedorLaboratorio.create({ nombre: 'Proveedor sintético' });
        const crearMedicamento = (codigo, extra = {}) => db.Medicamento.create({
            id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio, codigo_medicamento: codigo,
            nombre_comercial: `Producto ${codigo}`, forma_farmaceutica: 'Tableta', presentacion: '500 mg',
            unidad_inventario: 'tableta', condicion_venta: 'LIBRE', via_administracion: 'Oral',
            tipo_liberacion: 'Inmediata', ...extra });
        const libre = await crearMedicamento('VP1');
        const conReceta = await crearMedicamento('VP2', { condicion_venta: 'RECETA_MEDICA' });
        const desconocido = await crearMedicamento('VP3', { condicion_venta: 'sintetico_desconocido' });
        const inactivo = await crearMedicamento('VP4', { estado: false });
        const crearExistencia = (med, cantidad = 0) => db.ExistenciaMedicamento.create({
            id_medicamento: med.id_medicamento, codigo_existencia: `${med.codigo_medicamento}-001`,
            fecha_vencimiento: '2020-01-01', precision_vencimiento: 'DIA', cantidad_fisica: cantidad,
            costo_unitario_promedio: '0.500000' });
        const eLibre = await crearExistencia(libre, 5);
        const eReceta = await crearExistencia(conReceta);
        const eDesconocido = await crearExistencia(desconocido);
        const eInactivo = await crearExistencia(inactivo);
        const linea = (med = libre, existencia = eLibre, extra = {}) => ({ idMedicamento: med.id_medicamento,
            idExistencia: existencia.id_existencia, cantidad: 3, precioUnitario: '0.10', ...extra });
        const body = (claveOperacion, detalles = [linea()]) => ({ claveOperacion, detalles });
        const snapshot = async (soloInventario = false) => JSON.stringify(await Promise.all(
            (soloInventario ? [db.ExistenciaMedicamento, db.MovimientoInventario] :
                [db.Venta, db.DetalleVenta, db.Receta, db.ExistenciaMedicamento, db.MovimientoInventario])
                .map(model => model.findAll({ raw: true, order: [[model.primaryKeyAttribute, 'ASC']] }))));
        const inventarioInicial = await snapshot(true);
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const post = async (data, status = 201, rol = 'VENDEDOR', path = '') => {
            const token = rol ? generarToken({ idUsuario: usuarios[rol].id_usuario,
                idRol: ROLES[rol], versionCredenciales: 0 }) : null;
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ventas${path}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `token=${token}` } : {}) },
                body: JSON.stringify(data), signal: AbortSignal.timeout(15000)
            });
            const result = await response.json();
            if (status !== null) assert.equal(response.status, status, JSON.stringify(result));
            assert.doesNotMatch(JSON.stringify(result), /password_hash|sqlMessage|INSERT INTO|UPDATE `|hash_sintetico/);
            return { status: response.status, ...result };
        };
        const exitos = () => db.BitacoraAuditoria.count({ where: { tipo_evento: 'VENTA_REGISTRAR_PENDIENTE', resultado: 'EXITO' } });

        await t.test('Guarda cabecera, detalles exactos y auditoría sin descontar stock', async () => {
            const { data } = await post(body('PENDIENTE-EXACTA', [linea(), linea(libre, eLibre, { cantidad: 7, precioUnitario: '0.20' })]));
            assert.equal(data.estadoOperacion, 'PENDIENTE');
            assert.equal(data.fechaVenta, null);
            assert.match(data.fechaRegistro, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
            assert.equal(data.total, '1.70');
            assert.equal(data.claveOperacion, 'pendiente-exacta');
            assert.equal(data.idUsuario, usuarios.VENDEDOR.id_usuario);
            assert.deepEqual(data.detalles.map(d => d.subtotal), ['0.30', '1.40']);
            assert.deepEqual(data.detalles.map(d => d.idReceta), [null, null]);
            assert.deepEqual(data.recetas, []);
            const evento = await db.BitacoraAuditoria.findOne({ where: { tipo_evento: 'VENTA_REGISTRAR_PENDIENTE',
                resultado: 'EXITO', id_registro: data.idVenta }, raw: true });
            assert.equal(evento.tipo_registro, 'VENTA');
            assert.equal(evento.id_usuario_responsable, usuarios.VENDEDOR.id_usuario);
            assert.deepEqual(evento.despues, { estadoOperacion: 'PENDIENTE', total: '1.70', cantidadDetalles: 2 });
            assert.equal(evento.metadatos.cantidadMovimientos, 0);
            assert.equal(evento.referencias.filter(r => r.tipo === 'DETALLE_VENTA').length, 2);
            assert.equal(await snapshot(true), inventarioInicial);
        });
        await t.test('Provisional permite agotadas/vencidas y condición de receta sin confirmar ni reservar', async () => {
            for (const [med, existencia, clave] of [[libre, eLibre, 'sin-reserva'],
                [conReceta, eReceta, 'receta-pendiente'], [desconocido, eDesconocido, 'condicion-pendiente']]) {
                const { data } = await post(body(clave, [linea(med, existencia, { cantidad: 100, precioUnitario: '0' })]));
                assert.equal(data.total, '0.00');
                assert.equal(data.fechaVenta, null);
                assert.equal(data.estadoOperacion, 'PENDIENTE');
            }
            assert.equal(await snapshot(true), inventarioInicial);
        });
        await t.test('Solo Vendedor registra; no se confía en identidad o campos del cliente', async () => {
            const antes = await snapshot();
            await post(body('sin-sesion'), 401, null);
            await post(body('admin-denegado'), 403, 'ADMINISTRADOR');
            await post(body('regente-denegado'), 403, 'REGENTE');
            for (const extra of [{ idUsuario: 1 }, { estadoOperacion: 'CONFIRMADA' }, { total: '0.00' },
                { fechaVenta: '2026-11-01' }, { recetas: [] }]) await post({ ...body('entrada-invalida'), ...extra }, 400);
            await post(body('query-invalida'), 400, 'VENDEDOR', '?otro=1');
            await post(body('receta-ajena', [{ ...linea(), idReceta: 1 }]), 400);
            assert.equal(await snapshot(), antes);
        });
        await t.test('Medicamento activo, existencia real y pertenencia se comprueban antes de escribir', async () => {
            const antes = await snapshot();
            await post(body('inactivo', [linea(inactivo, eInactivo)]), 409);
            await post(body('med-ausente', [{ ...linea(), idMedicamento: 2147483647 }]), 404);
            await post(body('existencia-ausente', [{ ...linea(), idExistencia: 2147483647 }]), 404);
            await post(body('existencia-ajena', [linea(libre, eReceta)]), 409);
            assert.equal(await snapshot(), antes);
        });
        await t.test('Desborde de subtotal o total se rechaza sin persistencia parcial', async () => {
            const antes = await snapshot();
            await post(body('subtotal-desborde', [linea(libre, eLibre, { precioUnitario: '999999999999.99' })]), 400);
            const max = linea(libre, eLibre, { cantidad: 1, precioUnitario: '999999999999.99' });
            await post(body('total-desborde', [max, linea()]), 400);
            assert.equal(await snapshot(), antes);
            assert.equal((await post(body('maximo-exacto', [max]))).data.total, '999999999999.99');
        });
        await t.test('Duplicado secuencial no modifica venta ni registra otro éxito', async () => {
            const antes = await snapshot(), cantidadExitos = await exitos();
            await post(body('PENDIENTE-EXACTA'), 409);
            assert.equal(await snapshot(), antes);
            assert.equal(await exitos(), cantidadExitos);
        });
        await t.test('UNIQUE real evita duplicados concurrentes aun superando la consulta auxiliar', async () => {
            const mock = t.mock.method(ventaRepository, 'findByClave', async () => null);
            const previos = await exitos();
            let resultados;
            try { resultados = await Promise.all([post(body('concurrente'), null), post(body('CONCURRENTE'), null)]); }
            finally { mock.mock.restore(); }
            assert.deepEqual(resultados.map(r => r.status).sort(), [201, 409]);
            assert.equal(await db.Venta.count({ where: { clave_operacion: 'concurrente' } }), 1);
            assert.equal(await exitos(), previos + 1);
            assert.equal(await snapshot(true), inventarioInicial);
        });
        await t.test('Medicamentos y existencias se bloquean en orden determinista', async () => {
            const orden = [], originalMed = medicamentoRepository.findById.bind(medicamentoRepository),
                originalExistencia = existenciaMedicamentoRepository.findByIdParaVenta.bind(existenciaMedicamentoRepository);
            const medMock = t.mock.method(medicamentoRepository, 'findById', async options => {
                assert.equal(options.lock, true); orden.push(`M${options.idMedicamento}`); return originalMed(options);
            });
            const exMock = t.mock.method(existenciaMedicamentoRepository, 'findByIdParaVenta', async options => {
                orden.push(`E${options.idExistencia}`); return originalExistencia(options);
            });
            try { await post(body('orden-bloqueos', [linea(conReceta, eReceta), linea(), linea()])); }
            finally { medMock.mock.restore(); exMock.mock.restore(); }
            assert.deepEqual(orden, [`M${libre.id_medicamento}`, `M${conReceta.id_medicamento}`,
                `E${eLibre.id_existencia}`, `E${eReceta.id_existencia}`]);
        });
        await t.test('Fallo del segundo detalle revierte cabecera y primer detalle, permite reintentar clave', async () => {
            const antes = await snapshot(), cantidadExitos = await exitos();
            let llamadas = 0;
            const original = ventaRepository.createDetalle.bind(ventaRepository);
            const mock = t.mock.method(ventaRepository, 'createDetalle', async options => {
                if (++llamadas === 2) throw new Error('fallo_sintetico_segundo_detalle');
                return original(options);
            });
            try { await post(body('fallo-detalle', [linea(), linea()]), 500); }
            finally { mock.mock.restore(); }
            assert.equal(await snapshot(), antes);
            assert.equal(await exitos(), cantidadExitos);
            await post(body('fallo-detalle'));
        });
        await t.test('Fallo al materializar la respuesta revierte toda la venta', async () => {
            const antes = await snapshot();
            const mock = t.mock.method(ventaRepository, 'findById', async () => { throw new Error('fallo_lectura_respuesta'); });
            try { await post(body('fallo-respuesta'), 500); }
            finally { mock.mock.restore(); }
            assert.equal(await snapshot(), antes);
        });
        await t.test('Auditoría obligatoria fallida revierte venta; el éxito nunca queda fuera de transacción', async () => {
            const antes = await snapshot(), cantidadExitos = await exitos();
            const original = bitacoraAuditoriaRepository.create.bind(bitacoraAuditoriaRepository);
            const mock = t.mock.method(bitacoraAuditoriaRepository, 'create', async options => {
                if (options.data.tipo_evento === 'VENTA_REGISTRAR_PENDIENTE' && options.data.resultado === 'EXITO') {
                    assert.ok(options.transaction);
                    await original(options);
                    throw new Error('fallo_auditoria_obligatoria');
                }
                return original(options);
            });
            try { await post(body('fallo-auditoria'), 503); }
            finally { mock.mock.restore(); }
            assert.equal(await snapshot(), antes);
            assert.equal(await exitos(), cantidadExitos);
            await post(body('fallo-auditoria'));
        });
        await t.test('Timeout real de InnoDB devuelve conflicto controlado sin cambios parciales', async () => {
            const antes = await snapshot();
            const bloqueador = await db.sequelize.transaction();
            const original = medicamentoRepository.findById.bind(medicamentoRepository);
            const mock = t.mock.method(medicamentoRepository, 'findById', async options => {
                await db.sequelize.query('SET SESSION innodb_lock_wait_timeout = 1', { transaction: options.transaction });
                return original(options);
            });
            try {
                await db.Medicamento.findByPk(libre.id_medicamento, {
                    transaction: bloqueador, lock: bloqueador.LOCK.UPDATE
                });
                const resultado = await post(body('timeout-real'), 409);
                assert.match(resultado.message, /contención temporal/);
                assert.equal(await snapshot(), antes);
            } finally {
                mock.mock.restore();
                await bloqueador.rollback();
            }
            await post(body('timeout-real'));
        });
        assert.equal(await snapshot(true), inventarioInicial);
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (db) await db.sequelize.close();
        if (creada) await runCli('db:drop');
    }
});
