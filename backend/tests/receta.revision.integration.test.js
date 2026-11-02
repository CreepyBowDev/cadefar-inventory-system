import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Integración exclusivamente en MySQL local, con esquema temporal aleatorio.
dotenv.config({ quiet: true });
const baseTest = process.env.DB_NAME_TEST;
const protegidas = [process.env.DB_NAME, process.env.DB_NAME_PRODUCTION].filter(Boolean);
assert.ok(baseTest, 'Configurar DB_NAME_TEST para integración');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), 'Usar MySQL local');
assert.equal(protegidas.some(nombre => nombre.toLowerCase() === baseTest.toLowerCase()), false);
const temporal = `${baseTest.slice(0, 20)}_revision_${randomBytes(6).toString('hex')}`;
assert.match(temporal, /^[a-zA-Z0-9_]+$/);
assert.equal([...protegidas, baseTest].some(nombre => nombre.toLowerCase() === temporal.toLowerCase()), false);
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = temporal;
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_de_revision_receta';
const executeFile = promisify(execFile);
const runCli = async comando => {
    try {
        await executeFile(process.execPath, [fileURLToPath(new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url)),
            comando, '--env', 'test'], { cwd: fileURLToPath(new URL('../', import.meta.url)),
            env: { ...process.env }, timeout: 60000 });
    } catch { throw new Error(`Sequelize CLI: ${comando} falló en la base temporal de Revisión de recetas`); }
};

test('CU32: consulta, aprobación/rechazo atómicos y sin efectos de inventario', { timeout: 120000 }, async t => {
    let creada = false, db, server;
    try {
        await runCli('db:create'); creada = true;
        await runCli('db:migrate');
        ({ default: db } = await import('../src/data/models/index.js'));
        assert.equal(db.sequelize.config.database, temporal);
        const { app } = await import('../src/app.js');
        const { generarToken } = await import('../src/shared/utils/jwt.js');
        const { ROLES } = await import('../src/shared/constants/roles.js');
        const { recetaRepository } = await import('../src/data/repositories/receta.repository.js');
        const { ventaRepository } = await import('../src/data/repositories/venta.repository.js');
        const { bitacoraAuditoriaRepository } = await import('../src/data/repositories/bitacora-auditoria.repository.js');
        const { obtenerFechaOperacion } = await import('../src/shared/utils/fecha-operacion.js');
        t.mock.method(console, 'error', () => {});
        await db.Rol.bulkCreate(Object.entries(ROLES).map(([nombre, id_rol]) => ({ nombre, id_rol })));
        const usuarios = {};
        for (const [rol, idRol] of Object.entries(ROLES)) usuarios[rol] = await db.Usuario.create({
            id_rol: idRol, nombre_usuario: `revision_${rol}`, password_hash: 'hash_sintetico_sin_login' });
        const proveedor = await db.ProveedorLaboratorio.create({ nombre: 'Proveedor sintético' });
        const medicamento = await db.Medicamento.create({ id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio,
            codigo_medicamento: 'RV', nombre_comercial: 'Producto sintético', forma_farmaceutica: 'Tableta',
            presentacion: '500 mg', unidad_inventario: 'tableta', condicion_venta: 'RECETA_MEDICA',
            via_administracion: 'Oral', tipo_liberacion: 'Inmediata' });
        const existencia = await db.ExistenciaMedicamento.create({ id_medicamento: medicamento.id_medicamento,
            codigo_existencia: 'RV-001', fecha_vencimiento: '2028-01-01', precision_vencimiento: 'DIA',
            cantidad_fisica: 10, costo_unitario_promedio: '1.000000' });
        const civil = fecha => db.Sequelize.fn('STR_TO_DATE', fecha, '%Y-%m-%d %H:%i:%s');
        const ventas = {};
        for (const [clave, estado] of [['pendiente', 'PENDIENTE'], ['otra', 'PENDIENTE'],
            ['confirmada', 'CONFIRMADA'], ['anulada', 'ANULADA'], ['sinRecetas', 'PENDIENTE']]) {
            ventas[clave] = await db.Venta.create({ id_usuario: usuarios.VENDEDOR.id_usuario,
                estado_operacion: estado, clave_operacion: `revision-${clave}`, total: '1.00',
                fecha_venta: estado === 'CONFIRMADA' ? civil('2026-11-01 12:00:00') : null });
        }
        const crearReceta = (venta = ventas.pendiente, extra = {}) => db.Receta.create({ id_venta: venta.id_venta,
            fecha_receta: '2026-11-01', nombre_paciente: 'PII_PACIENTE', documento_paciente: 'PII_DOCUMENTO',
            nombre_medico: 'PII_MEDICO', observacion: 'PII_OBSERVACION_INICIAL', modalidad: 'Presentada',
            archivo_receta: 'ARCHIVO_INTERNO_NO_VERIFICADO.pdf', ...extra });
        const consulta = await crearReceta(), rechazo = await crearReceta(), ajena = await crearReceta(ventas.otra);
        const recetaConfirmada = await crearReceta(ventas.confirmada), recetaAnulada = await crearReceta(ventas.anulada);
        await db.DetalleVenta.create({ id_venta: ventas.pendiente.id_venta, id_existencia: existencia.id_existencia,
            id_receta: rechazo.id_receta, cantidad: 1, precio_unitario: '1.00', subtotal: '1.00' });
        const snapshotNegocio = async () => JSON.stringify(await Promise.all([
            db.Venta, db.DetalleVenta, db.ExistenciaMedicamento, db.MovimientoInventario
        ].map(model => model.findAll({ raw: true, order: [[model.primaryKeyAttribute, 'ASC']] }))));
        const negocioAntes = await snapshotNegocio();
        const leerReceta = id => db.Receta.findByPk(id, { raw: true });
        const exitos = id => db.BitacoraAuditoria.count({ where: { tipo_evento: 'RECETA_REVISAR', resultado: 'EXITO', id_registro: id } });
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const request = async (method, path, status = 200, rol = 'REGENTE', body) => {
            const token = rol ? generarToken({ idUsuario: usuarios[rol].id_usuario, idRol: ROLES[rol], versionCredenciales: 0 }) : null;
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ventas${path}`, {
                method, headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `token=${token}` } : {}) },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000)
            });
            const result = await response.json();
            if (status !== null) assert.equal(response.status, status, JSON.stringify(result));
            assert.doesNotMatch(JSON.stringify(result), /ARCHIVO_INTERNO|archivo_receta|archivoReceta|password|sqlMessage/);
            if (response.ok && /\/recetas/.test(path)) assert.equal(response.headers.get('cache-control'), 'no-store');
            return { status: response.status, ...result };
        };
        const ruta = (idReceta, idVenta = ventas.pendiente.id_venta) => `/${idVenta}/recetas/${idReceta}`;
        const revisar = (idReceta, datos = { resultadoRevision: 'RECHAZADA' }, status = 200,
            idVenta = ventas.pendiente.id_venta, rol = 'REGENTE') => request('POST', `${ruta(idReceta, idVenta)}/revisar`, status, rol, datos);

        await t.test('Lista paginada y detalle de metadatos solo para Regente, sin revelar el archivo', async () => {
            const lista = await request('GET', `/${ventas.pendiente.id_venta}/recetas?limite=1`);
            assert.equal(lista.paginacion.total, 2);
            assert.equal(lista.paginacion.totalPaginas, 2);
            assert.deepEqual(lista.data.map(r => r.idReceta), [consulta.id_receta]);
            assert.doesNotMatch(JSON.stringify(lista), /PII_|nombrePaciente|observacion/);
            const { data } = await request('GET', ruta(consulta.id_receta));
            assert.equal(data.nombrePaciente, 'PII_PACIENTE');
            assert.equal(data.numeroReceta, null);
            assert.equal(data.resultadoRevision, null);
            assert.equal(data.idUsuarioValidador, null);
            assert.equal(data.fechaValidacion, null);
            assert.equal(data.fechaReceta, '2026-11-01');
            const sinRecetas = await request('GET', `/${ventas.sinRecetas.id_venta}/recetas`);
            assert.deepEqual(sinRecetas.data, []);
            assert.equal(sinRecetas.paginacion.total, 0);
            // Consultar historial no equivale a permitir una revisión sobre él.
            await request('GET', ruta(recetaConfirmada.id_receta, ventas.confirmada.id_venta));
        });
        await t.test('Administrador/Vendedor no consultan datos personales ni revisan; sesión ausente da 401', async () => {
            for (const rol of ['ADMINISTRADOR', 'VENDEDOR']) {
                await request('GET', `/${ventas.pendiente.id_venta}/recetas`, 403, rol);
                await request('GET', ruta(consulta.id_receta), 403, rol);
                await revisar(consulta.id_receta, { resultadoRevision: 'RECHAZADA' }, 403, undefined, rol);
                const venta = await request('GET', `/${ventas.pendiente.id_venta}`, 200, rol);
                assert.doesNotMatch(JSON.stringify(venta), /PII_|nombrePaciente|documentoPaciente/);
            }
            await request('GET', ruta(consulta.id_receta), 401, null);
        });
        await t.test('Receta ajena y ausente no revelan pertenencia ni pueden revisarse', async () => {
            const extranjera = await request('GET', ruta(ajena.id_receta), 404);
            const ausente = await request('GET', ruta(2147483647), 404);
            assert.deepEqual(extranjera, ausente);
            await revisar(ajena.id_receta, { resultadoRevision: 'RECHAZADA' }, 404);
            await revisar(2147483647, { resultadoRevision: 'RECHAZADA' }, 404);
            await request('GET', '/2147483647/recetas', 404);
        });
        await t.test('Entradas inválidas no aceptan responsable, fechas, archivo o un estado inventado', async () => {
            for (const extra of [{ idUsuarioValidador: 1 }, { fechaValidacion: '2026-11-01' },
                { archivoReceta: 'arbitrario' }, { resultadoRevision: 'PENDIENTE' }, { observacion: 'x'.repeat(501) }]) {
                await revisar(consulta.id_receta, { resultadoRevision: 'RECHAZADA', ...extra }, 400);
            }
            await request('GET', `/${ventas.pendiente.id_venta}/recetas?limite=101`, 400);
            await request('GET', `${ruta(consulta.id_receta)}?otro=1`, 400);
            await request('GET', `/${ventas.pendiente.id_venta}/recetas/0`, 400);
            await request('POST', `${ruta(consulta.id_receta)}/revisar?otro=1`, 400, 'REGENTE', { resultadoRevision: 'RECHAZADA' });
        });
        await t.test('Regente aprueba una receta de formulario sin exigir archivo', async () => {
            const receta = await crearReceta(ventas.pendiente, { archivo_receta: null });
            const { data } = await revisar(receta.id_receta, { resultadoRevision: 'APROBADA' });
            assert.equal(data.resultadoRevision, 'APROBADA');
            assert.equal(data.idUsuarioValidador, usuarios.REGENTE.id_usuario);
            assert.ok(data.fechaValidacion);
            assert.equal((await leerReceta(receta.id_receta)).archivo_receta, null);
            assert.equal(await exitos(receta.id_receta), 1);
            await revisar(receta.id_receta, { resultadoRevision: 'RECHAZADA' }, 409);
        });
        await t.test('Rechazo guarda resultado, Regente, fecha comercial y observación con auditoría atómica', async () => {
            const antes = await leerReceta(rechazo.id_receta), fechaAntes = obtenerFechaOperacion().fechaHoraComercial;
            const { data } = await revisar(rechazo.id_receta, { resultadoRevision: 'RECHAZADA', observacion: 'PII_MOTIVO_RECHAZO' });
            const fechaDespues = obtenerFechaOperacion().fechaHoraComercial;
            assert.equal(data.resultadoRevision, 'RECHAZADA');
            assert.equal(data.idUsuarioValidador, usuarios.REGENTE.id_usuario);
            assert.ok(data.fechaValidacion >= fechaAntes && data.fechaValidacion <= fechaDespues);
            assert.equal(data.observacion, 'PII_MOTIVO_RECHAZO');
            const despues = await leerReceta(rechazo.id_receta);
            for (const campo of ['resultado_revision', 'id_usuario_validador', 'fecha_validacion', 'observacion']) {
                delete antes[campo]; delete despues[campo];
            }
            assert.deepEqual(despues, antes);
            const evento = await db.BitacoraAuditoria.findOne({ where: { tipo_evento: 'RECETA_REVISAR',
                resultado: 'EXITO', id_registro: rechazo.id_receta }, raw: true });
            assert.deepEqual(evento.antes, { idVenta: ventas.pendiente.id_venta, resultadoRevision: null, idUsuarioValidador: null });
            assert.deepEqual(evento.despues, { idVenta: ventas.pendiente.id_venta,
                resultadoRevision: 'RECHAZADA', idUsuarioValidador: usuarios.REGENTE.id_usuario });
            assert.equal(evento.metadatos.cantidadMovimientos, 0);
            assert.equal(await snapshotNegocio(), negocioAntes);
        });
        await t.test('No permite repetición, cambio de decisión ni ventas confirmadas o anuladas', async () => {
            const antes = await leerReceta(rechazo.id_receta);
            for (const resultadoRevision of ['APROBADA', 'RECHAZADA']) {
                await revisar(rechazo.id_receta, { resultadoRevision }, 409);
            }
            assert.deepEqual(await leerReceta(rechazo.id_receta), antes);
            assert.equal(await exitos(rechazo.id_receta), 1);
            await revisar(recetaConfirmada.id_receta, { resultadoRevision: 'RECHAZADA' }, 409, ventas.confirmada.id_venta);
            await revisar(recetaAnulada.id_receta, { resultadoRevision: 'RECHAZADA' }, 409, ventas.anulada.id_venta);
            for (const extra of [{ resultado_revision: 'APROBADA' }, { id_usuario_validador: usuarios.REGENTE.id_usuario },
                { fecha_validacion: civil('2026-11-01 12:00:00') }]) {
                const inconsistente = await crearReceta(ventas.pendiente, extra);
                await revisar(inconsistente.id_receta, { resultadoRevision: 'RECHAZADA' }, 409);
            }
        });
        await t.test('Aprobar y rechazar simultáneamente producen un único resultado y un único éxito', async () => {
            const receta = await crearReceta();
            const resultados = await Promise.all([revisar(receta.id_receta, { resultadoRevision: 'APROBADA' }, null),
                revisar(receta.id_receta, { resultadoRevision: 'RECHAZADA' }, null)]);
            assert.deepEqual(resultados.map(r => r.status).sort(), [200, 409]);
            assert.equal(await exitos(receta.id_receta), 1);
            assert.ok(['APROBADA', 'RECHAZADA'].includes((await leerReceta(receta.id_receta)).resultado_revision));
            assert.equal((await leerReceta(receta.id_receta)).observacion, 'PII_OBSERVACION_INICIAL');
        });
        await t.test('Rollback incluye UPDATE y auditoría ya insertada si falla el auditor obligatorio', async () => {
            const receta = await crearReceta(), antes = await leerReceta(receta.id_receta);
            const original = bitacoraAuditoriaRepository.create.bind(bitacoraAuditoriaRepository);
            const mock = t.mock.method(bitacoraAuditoriaRepository, 'create', async options => {
                if (options.data.tipo_evento === 'RECETA_REVISAR' && options.data.resultado === 'EXITO') {
                    assert.ok(options.transaction);
                    await original(options);
                    throw new Error('fallo_auditoria_obligatoria');
                }
                return original(options);
            });
            try { await revisar(receta.id_receta, { resultadoRevision: 'RECHAZADA' }, 503); }
            finally { mock.mock.restore(); }
            assert.deepEqual(await leerReceta(receta.id_receta), antes);
            assert.equal(await exitos(receta.id_receta), 0);
            await revisar(receta.id_receta);
        });
        await t.test('Fallo al materializar respuesta y UPDATE sin efecto revierten completamente la revisión', async () => {
            const receta = await crearReceta(), antes = await leerReceta(receta.id_receta);
            const original = recetaRepository.findByIdDeVenta.bind(recetaRepository);
            const mock = t.mock.method(recetaRepository, 'findByIdDeVenta', async options => {
                if (!options.lock) throw new Error('fallo_lectura_con_PII_PACIENTE');
                return original(options);
            });
            try { await revisar(receta.id_receta, { resultadoRevision: 'RECHAZADA' }, 500); }
            finally { mock.mock.restore(); }
            assert.deepEqual(await leerReceta(receta.id_receta), antes);
            const updateMock = t.mock.method(recetaRepository, 'registrarRevision', async () => [0]);
            try { await revisar(receta.id_receta, { resultadoRevision: 'RECHAZADA' }, 409); }
            finally { updateMock.mock.restore(); }
            assert.deepEqual(await leerReceta(receta.id_receta), antes);
            assert.equal(await exitos(receta.id_receta), 0);
        });
        await t.test('Una aprobación también se revierte si falla su auditoría obligatoria', async () => {
            const receta = await crearReceta(ventas.pendiente, { archivo_receta: null });
            const antes = await leerReceta(receta.id_receta), original = bitacoraAuditoriaRepository.create.bind(bitacoraAuditoriaRepository);
            const mock = t.mock.method(bitacoraAuditoriaRepository, 'create', async options => {
                const resultado = await original(options);
                if (options.data.tipo_evento === 'RECETA_REVISAR' && options.data.resultado === 'EXITO') {
                    throw new Error('fallo_auditoria_aprobacion');
                }
                return resultado;
            });
            try { await revisar(receta.id_receta, { resultadoRevision: 'APROBADA' }, 503); }
            finally { mock.mock.restore(); }
            assert.deepEqual(await leerReceta(receta.id_receta), antes);
            assert.equal(await exitos(receta.id_receta), 0);
        });
        await t.test('Total y página de recetas comparten snapshot ante inserción concurrente', async () => {
            const esperado = await db.Receta.count({ where: { id_venta: ventas.pendiente.id_venta } });
            const original = db.Receta.count.bind(db.Receta);
            const mock = t.mock.method(db.Receta, 'count', async options => {
                const total = await original(options);
                assert.ok(options.transaction);
                await crearReceta();
                return total;
            });
            try {
                const resultado = await request('GET', `/${ventas.pendiente.id_venta}/recetas?limite=100`);
                assert.equal(resultado.paginacion.total, esperado);
                assert.equal(resultado.data.length, esperado);
            } finally { mock.mock.restore(); }
        });
        await t.test('Cambio concurrente de estado de venta impide revisión al liberar su bloqueo', async () => {
            const receta = await crearReceta(), antes = await leerReceta(receta.id_receta);
            const bloqueador = await db.sequelize.transaction();
            const original = ventaRepository.findParaReceta.bind(ventaRepository);
            let resolverEntrada;
            const entrada = new Promise(resolve => { resolverEntrada = resolve; });
            const mock = t.mock.method(ventaRepository, 'findParaReceta', options => { resolverEntrada(); return original(options); });
            let solicitud;
            try {
                await db.Venta.update({ estado_operacion: 'ANULADA' }, {
                    where: { id_venta: ventas.pendiente.id_venta }, transaction: bloqueador
                });
                solicitud = revisar(receta.id_receta, { resultadoRevision: 'RECHAZADA' }, 409); solicitud.catch(() => {});
                await entrada; await bloqueador.commit(); await solicitud;
            } finally {
                mock.mock.restore();
                if (!bloqueador.finished) await bloqueador.rollback();
                if (solicitud) await solicitud.catch(() => {});
                await db.Venta.update({ estado_operacion: 'PENDIENTE' }, { where: { id_venta: ventas.pendiente.id_venta } });
            }
            assert.deepEqual(await leerReceta(receta.id_receta), antes);
        });
        await t.test('Fallo exclusivo del auditor de consulta conserva el detalle autorizado; fallo de lectura da 500', async () => {
            const mock = t.mock.method(bitacoraAuditoriaRepository, 'create', async () => { throw new Error('auditor_caido'); });
            try {
                assert.equal((await request('GET', ruta(consulta.id_receta))).data.nombrePaciente, 'PII_PACIENTE');
            } finally { mock.mock.restore(); }
            const lectura = t.mock.method(recetaRepository, 'findByIdDeVenta', async () => { throw new Error('PII_PACIENTE'); });
            try {
                assert.equal((await request('GET', ruta(consulta.id_receta), 500)).message, 'Error interno del servidor');
            } finally { lectura.mock.restore(); }
        });
        const eventos = await db.BitacoraAuditoria.findAll({ raw: true });
        assert.doesNotMatch(JSON.stringify(eventos), /PII_|ARCHIVO_INTERNO|archivo_receta|archivoReceta/);
        assert.ok(eventos.some(e => e.tipo_evento === 'RECETA_CONSULTAR' && e.resultado === 'EXITO'));
        assert.ok(eventos.some(e => e.tipo_evento === 'RECETAS_CONSULTAR' && e.resultado === 'EXITO'));
        assert.equal(await snapshotNegocio(), negocioAntes, 'Las revisiones no alteran ventas, detalles, stock ni movimientos');
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (db) await db.sequelize.close();
        if (creada) await runCli('db:drop');
    }
});
