import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
const baseTest = process.env.DB_NAME_TEST;
const protegidas = [process.env.DB_NAME, process.env.DB_NAME_PRODUCTION].filter(Boolean);
assert.ok(baseTest, 'Configurar DB_NAME_TEST para integración');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), 'Usar MySQL local');
assert.equal(protegidas.some(nombre => nombre.toLowerCase() === baseTest.toLowerCase()), false);
const temporal = `${baseTest.slice(0, 20)}_receta_${randomBytes(6).toString('hex')}`;
assert.match(temporal, /^[a-zA-Z0-9_]+$/);
assert.equal([...protegidas, baseTest].some(nombre => nombre.toLowerCase() === temporal.toLowerCase()), false);
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = temporal;
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_de_registro_receta';
const executeFile = promisify(execFile);
const runCli = async comando => {
    try {
        await executeFile(process.execPath, [fileURLToPath(new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url)),
            comando, '--env', 'test'], { cwd: fileURLToPath(new URL('../', import.meta.url)),
            env: { ...process.env }, timeout: 60000 });
    } catch { throw new Error(`Sequelize CLI: ${comando} falló en la base temporal de Recetas`); }
};

test('CU31: formulario sin archivos, vínculos, auditoría y rollback en MySQL local', { timeout: 120000 }, async t => {
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
        const { recetaRepository } = await import('../src/data/repositories/receta.repository.js');
        const { bitacoraAuditoriaRepository } = await import('../src/data/repositories/bitacora-auditoria.repository.js');
        t.mock.method(console, 'error', () => {});
        await db.Rol.bulkCreate(Object.entries(ROLES).map(([nombre, id_rol]) => ({ nombre, id_rol })));
        const usuarios = {};
        for (const [rol, idRol] of Object.entries(ROLES)) usuarios[rol] = await db.Usuario.create({
            id_rol: idRol, nombre_usuario: `receta_${rol}`, password_hash: 'hash_sintetico_sin_login' });
        const proveedor = await db.ProveedorLaboratorio.create({ nombre: 'Proveedor sintético' });
        const medicamento = await db.Medicamento.create({ id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio,
            codigo_medicamento: 'RR', nombre_comercial: 'Producto sintético', forma_farmaceutica: 'Tableta',
            presentacion: '500 mg', unidad_inventario: 'tableta', condicion_venta: 'RECETA_MEDICA',
            via_administracion: 'Oral', tipo_liberacion: 'Inmediata' });
        const existencia = await db.ExistenciaMedicamento.create({ id_medicamento: medicamento.id_medicamento,
            codigo_existencia: 'RR-001', fecha_vencimiento: '2028-01-01', precision_vencimiento: 'DIA',
            cantidad_fisica: 10, costo_unitario_promedio: '1.000000' });
        const civil = fecha => db.Sequelize.fn('STR_TO_DATE', fecha, '%Y-%m-%d %H:%i:%s');
        const ventas = {};
        for (const [clave, estado] of [['pendiente', 'PENDIENTE'], ['otra', 'PENDIENTE'],
            ['confirmada', 'CONFIRMADA'], ['anulada', 'ANULADA']]) {
            ventas[clave] = await db.Venta.create({ id_usuario: usuarios.VENDEDOR.id_usuario,
                estado_operacion: estado, clave_operacion: `receta-${clave}`, total: '1.00',
                fecha_venta: estado === 'CONFIRMADA' ? civil('2026-11-01 12:00:00') : null });
        }
        const detalles = {};
        for (const clave of ['pendiente', 'otra']) detalles[clave] = await db.DetalleVenta.create({
            id_venta: ventas[clave].id_venta, id_existencia: existencia.id_existencia,
            cantidad: 1, precio_unitario: '1.00', subtotal: '1.00' });
        const personal = { nombrePaciente: 'PACIENTE_PRIVADO_SINTETICO', documentoPaciente: 'DOCUMENTO_PRIVADO_SINTETICO',
            nombreMedico: 'MEDICO_PRIVADO_SINTETICO', observacion: 'OBSERVACION_PRIVADA_SINTETICA' };
        // Referencia sintética insertada solo como fixture; jamás aceptada por HTTP.
        const legada = await db.Receta.create({ id_venta: ventas.otra.id_venta, fecha_receta: '2026-11-01',
            nombre_paciente: personal.nombrePaciente, documento_paciente: personal.documentoPaciente,
            nombre_medico: personal.nombreMedico, archivo_receta: 'PRIVADO_SOLO_FIXTURE.pdf', modalidad: 'Presentada' });
        const datos = () => ({ ...personal, numeroReceta: null, fechaReceta: '2026-11-01', modalidad: 'Presentada' });
        const snapshot = async () => JSON.stringify(await Promise.all([
            db.Venta, db.DetalleVenta, db.Receta, db.ExistenciaMedicamento, db.MovimientoInventario
        ].map(model => model.findAll({ raw: true, order: [[model.primaryKeyAttribute, 'ASC']] }))));
        const inventarioAntes = JSON.stringify(await db.ExistenciaMedicamento.findAll({ raw: true }));
        const legadoAntes = await db.Receta.findByPk(legada.id_receta, { raw: true });
        const consultas = [];
        const originalQuery = db.sequelize.query.bind(db.sequelize);
        t.mock.method(db.sequelize, 'query', (sql, options) => {
            consultas.push(typeof sql === 'string' ? sql : sql.query);
            return originalQuery(sql, options);
        });
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const post = async (data = datos(), status = 201, rol = 'VENDEDOR', idVenta = ventas.pendiente.id_venta, query = '') => {
            const token = rol ? generarToken({ idUsuario: usuarios[rol].id_usuario, idRol: ROLES[rol], versionCredenciales: 0 }) : null;
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ventas/${idVenta}/recetas${query}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `token=${token}` } : {}) },
                body: JSON.stringify(data), signal: AbortSignal.timeout(15000)
            });
            const result = await response.json();
            if (status !== null) assert.equal(response.status, status, JSON.stringify(result));
            assert.doesNotMatch(JSON.stringify(result), /PRIVADO_SOLO_FIXTURE|archivo_receta|archivoReceta|password|sqlMessage/);
            if (!response.ok) assert.doesNotMatch(JSON.stringify(result), /PACIENTE_PRIVADO|DOCUMENTO_PRIVADO|MEDICO_PRIVADO|OBSERVACION_PRIVADA/);
            return status === null ? { status: response.status, ...result } : result;
        };

        await t.test('Vendedor y Regente registran sin archivo y sin aprobación automática', async () => {
            for (const rol of ['VENDEDOR', 'REGENTE']) {
                const { data } = await post(datos(), 201, rol);
                assert.equal(data.idVenta, ventas.pendiente.id_venta);
                assert.equal(data.resultadoRevision, null); assert.equal(data.fechaValidacion, null);
                assert.equal(data.idUsuarioValidador, null); assert.equal(data.numeroReceta, null);
                assert.equal(data.nombrePaciente, personal.nombrePaciente);
                const almacenada = await db.Receta.findByPk(data.idReceta);
                assert.equal(almacenada.archivo_receta, null);
                assert.equal(almacenada.observacion, personal.observacion);
            }
        });
        await t.test('Venta pendiente existente y detalles de esa misma venta se exigen bajo bloqueo', async () => {
            await post(datos(), 404, 'VENDEDOR', 2147483647);
            for (const clave of ['confirmada', 'anulada']) await post(datos(), 409, 'REGENTE', ventas[clave].id_venta);
            await post({ ...datos(), idsDetallesVenta: [detalles.pendiente.id_detalle_venta] });
            const vinculado = await db.DetalleVenta.findByPk(detalles.pendiente.id_detalle_venta);
            assert.ok(vinculado.id_receta);
            const antes = await snapshot();
            await post({ ...datos(), idsDetallesVenta: [detalles.pendiente.id_detalle_venta] }, 409);
            assert.equal(await snapshot(), antes);
            const queryDetalle = consultas.find(sql => /FROM `detalle_venta`/.test(sql) && /FOR UPDATE/.test(sql));
            assert.ok(queryDetalle);
            assert.match(queryDetalle, /`DetalleVenta`.`id_venta` = \d+/);
            assert.match(queryDetalle, /ORDER BY `DetalleVenta`.`id_detalle_venta` ASC/);
            assert.ok(consultas.some(sql => /FROM `venta`/.test(sql) && /FOR UPDATE/.test(sql)));
            const ajeno = await post({ ...datos(), idsDetallesVenta: [detalles.otra.id_detalle_venta] }, 404);
            const ausente = await post({ ...datos(), idsDetallesVenta: [2147483647] }, 404);
            assert.deepEqual(ajeno, ausente);
            await post({ ...datos(), idsDetallesVenta: [detalles.pendiente.id_detalle_venta, detalles.otra.id_detalle_venta] }, 404);
        });
        await t.test('Autenticación y roles se comprueban antes de acceder a venta o datos personales', async () => {
            await post(datos(), 401, null);
            await post(datos(), 403, 'ADMINISTRADOR');
        });
        await t.test('No admite archivos arbitrarios, vínculos cruzados ni aprobación enviada por cliente', async () => {
            for (const extra of [{ archivoReceta: 'https://example.test/receta.pdf' },
                { archivo_receta: '../archivo.pdf' }, { idArchivo: 'supuestamente-verificado' },
                { idVenta: ventas.otra.id_venta }, { idReceta: 1 }, { resultadoRevision: 'APROBADA' },
                { idUsuarioValidador: usuarios.REGENTE.id_usuario }, { fechaValidacion: '2026-11-01' }]) {
                await post({ ...datos(), ...extra }, 400);
            }
            await post({ ...datos(), nombrePaciente: '' }, 400);
            await post({ ...datos(), fechaReceta: '2026-02-29' }, 400);
            await post({ ...datos(), idsDetallesVenta: [1, 1] }, 400);
            await post(datos(), 400, 'VENDEDOR', '0');
            await post(datos(), 400, 'VENDEDOR', ventas.pendiente.id_venta, '?archivo=arbitrario');
        });
        await t.test('La venta se relee con bloqueo y no se registra si cambió de estado concurrentemente', async () => {
            const bloqueador = await db.sequelize.transaction();
            const original = ventaRepository.findParaReceta.bind(ventaRepository);
            let resolverEntrada;
            const entrada = new Promise(resolve => { resolverEntrada = resolve; });
            const mock = t.mock.method(ventaRepository, 'findParaReceta', options => {
                resolverEntrada(); return original(options);
            });
            let solicitud;
            try {
                await db.Venta.update({ estado_operacion: 'ANULADA' }, {
                    where: { id_venta: ventas.pendiente.id_venta }, transaction: bloqueador
                });
                solicitud = post(datos(), 409); solicitud.catch(() => {});
                await entrada;
                await bloqueador.commit();
                await solicitud;
            } finally {
                mock.mock.restore();
                if (!bloqueador.finished) await bloqueador.rollback();
                if (solicitud) await solicitud.catch(() => {});
                await db.Venta.update({ estado_operacion: 'PENDIENTE' }, { where: { id_venta: ventas.pendiente.id_venta } });
            }
        });
        await t.test('Fallo técnico y contención se informan sin exponer datos personales', async () => {
            let transactionObserved;
            const mock = t.mock.method(recetaRepository, 'findDetallesDeVenta', async options => {
                transactionObserved = options.transaction;
                throw new Error('Fallo técnico sintético con PACIENTE_PRIVADO_SINTETICO');
            });
            try {
                assert.deepEqual(await post({ ...datos(), idsDetallesVenta: [detalles.pendiente.id_detalle_venta] }, 500),
                    { message: 'Error interno del servidor' });
            } finally { mock.mock.restore(); }
            assert.equal(transactionObserved.finished, 'rollback');
            const lockMock = t.mock.method(ventaRepository, 'findParaReceta', async () => {
                throw Object.assign(new Error('timeout_sintetico'), { parent: { code: 'ER_LOCK_WAIT_TIMEOUT' } });
            });
            try { assert.match((await post(datos(), 409)).message, /contención temporal/); }
            finally { lockMock.mock.restore(); }
        });
        await t.test('Éxitos y rechazos auditados sin datos personales ni referencias a archivos', async () => {
            const eventos = await db.BitacoraAuditoria.findAll({ raw: true });
            assert.doesNotMatch(JSON.stringify(eventos), /PACIENTE_PRIVADO|DOCUMENTO_PRIVADO|MEDICO_PRIVADO|OBSERVACION_PRIVADA|PRIVADO_SOLO_FIXTURE/);
            const exito = eventos.find(e => e.tipo_evento === 'RECETA_REGISTRAR' && e.resultado === 'EXITO');
            assert.ok(exito); assert.equal(exito.tipo_registro, 'RECETA');
            assert.equal(exito.despues.idVenta, ventas.pendiente.id_venta);
            assert.equal(exito.despues.resultadoRevision, null);
            assert.ok(eventos.some(e => e.tipo_evento === 'RECETA_REGISTRAR' && e.resultado === 'RECHAZADO'));
            assert.equal(eventos.some(e => e.causa === 'ALMACENAMIENTO_NO_CONFIGURADO'), false);
        });
        await t.test('Fallo obligatorio del auditor devuelve 503 y revierte la receta', async () => {
            const antes = await snapshot();
            const original = bitacoraAuditoriaRepository.create.bind(bitacoraAuditoriaRepository);
            const mock = t.mock.method(bitacoraAuditoriaRepository, 'create', async options => {
                const resultado = await original(options);
                if (options.data.tipo_evento === 'RECETA_REGISTRAR' && options.data.resultado === 'EXITO') {
                    assert.ok(options.transaction); throw new Error('auditor_no_disponible');
                }
                return resultado;
            });
            try { await post(datos(), 503); }
            finally { mock.mock.restore(); }
            assert.equal(await snapshot(), antes);
        });
        await t.test('Registros simultáneos no sustituyen una receta ya vinculada', async () => {
            const body = { ...datos(), idsDetallesVenta: [detalles.otra.id_detalle_venta] };
            const resultados = await Promise.all([post(body, null, 'VENDEDOR', ventas.otra.id_venta), post(body, null, 'REGENTE', ventas.otra.id_venta)]);
            assert.deepEqual(resultados.map(r => r.status).sort(), [201, 409]);
            const receta = await db.DetalleVenta.findByPk(detalles.otra.id_detalle_venta);
            assert.equal(receta.id_receta, resultados.find(r => r.status === 201).data.idReceta);
        });
        for (const paso of ['create', 'vincularDetalles', 'findByIdDeVenta']) {
            await t.test(`Fallo tras ${paso} revierte receta y vínculos`, async () => {
                const detalle = await db.DetalleVenta.create({ id_venta: ventas.pendiente.id_venta, id_existencia: existencia.id_existencia,
                    cantidad: 1, precio_unitario: '1.00', subtotal: '1.00' });
                const antes = await snapshot(), original = recetaRepository[paso].bind(recetaRepository);
                const mock = t.mock.method(recetaRepository, paso, async options => {
                    await original(options); throw new Error('fallo_sintetico_registro');
                });
                try { await post({ ...datos(), idsDetallesVenta: [detalle.id_detalle_venta] }, 500); }
                finally { mock.mock.restore(); }
                assert.equal(await snapshot(), antes);
            });
        }
        assert.equal(JSON.stringify(await db.ExistenciaMedicamento.findAll({ raw: true })), inventarioAntes);
        assert.equal(await db.MovimientoInventario.count(), 0);
        assert.deepEqual(await db.Receta.findByPk(legada.id_receta, { raw: true }), legadoAntes);
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (db) await db.sequelize.close();
        if (creada) await runCli('db:drop');
    }
});
