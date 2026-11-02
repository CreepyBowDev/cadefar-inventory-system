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
const temporal = `${baseTest.slice(0, 20)}_confirmar_${randomBytes(6).toString('hex')}`;
assert.match(temporal, /^[a-zA-Z0-9_]+$/);
assert.equal([...protegidas, baseTest].some(nombre => nombre.toLowerCase() === temporal.toLowerCase()), false);
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = temporal;
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_de_confirmacion_ventas';
const executeFile = promisify(execFile);
const runCli = async comando => {
    try {
        await executeFile(process.execPath, [fileURLToPath(new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url)),
            comando, '--env', 'test'], { cwd: fileURLToPath(new URL('../', import.meta.url)),
            env: { ...process.env }, timeout: 60000 });
    } catch { throw new Error(`Sequelize CLI: ${comando} falló en la base temporal de Confirmación de ventas`); }
};

test('CU28: confirmación LIBRE/RECETA_MEDICA HTTP/MySQL, FEFO, RN58, concurrencia y rollback', { timeout: 180000 }, async t => {
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
        const { existenciaMedicamentoRepository } = await import('../src/data/repositories/existencia-medicamento.repository.js');
        const { movimientoInventarioRepository } = await import('../src/data/repositories/movimiento-inventario.repository.js');
        const { bitacoraAuditoriaRepository } = await import('../src/data/repositories/bitacora-auditoria.repository.js');
        const relojInicial = Date.parse('2026-10-31T16:00:00Z');
        t.mock.timers.enable({ apis: ['Date'], now: relojInicial });
        t.mock.method(console, 'error', () => {});
        await db.Rol.bulkCreate(Object.entries(ROLES).map(([nombre, id_rol]) => ({ nombre, id_rol })));
        const usuarios = {};
        for (const [rol, idRol] of Object.entries(ROLES)) usuarios[rol] = await db.Usuario.create({
            id_rol: idRol, nombre_usuario: `confirmar_${rol}`, password_hash: 'hash_sintetico_sin_login' });
        const proveedor = await db.ProveedorLaboratorio.create({ nombre: 'Proveedor sintético' });
        let secuencia = 0;
        const crearMedicamento = (extra = {}) => db.Medicamento.create({ id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio,
            codigo_medicamento: `CF${++secuencia}`, nombre_comercial: `Producto ${secuencia}`, forma_farmaceutica: 'Tableta',
            presentacion: '500 mg', unidad_inventario: 'tableta', condicion_venta: 'LIBRE',
            via_administracion: 'Oral', tipo_liberacion: 'Inmediata', ...extra });
        let codigoExistencia = 0;
        const crearExistencia = (med, fecha = '2027-01-01', precision = 'DIA', cantidad = 10, costo = '1.000000') =>
            db.ExistenciaMedicamento.create({ id_medicamento: med.id_medicamento, codigo_existencia: `CF-EX-${++codigoExistencia}`,
                fecha_vencimiento: fecha, precision_vencimiento: precision, cantidad_fisica: cantidad, costo_unitario_promedio: costo });
        const civil = fecha => db.Sequelize.fn('STR_TO_DATE', fecha, '%Y-%m-%d %H:%i:%s');
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const request = async (method, path, body, status = 200, rol = 'VENDEDOR') => {
            const token = rol ? generarToken({ idUsuario: usuarios[rol].id_usuario, idRol: ROLES[rol], versionCredenciales: 0 }) : null;
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ventas${path}`, {
                method, headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `token=${token}` } : {}) },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000)
            });
            const result = await response.json();
            if (status !== null) assert.equal(response.status, status, JSON.stringify(result));
            assert.doesNotMatch(JSON.stringify(result), /PII_|ARCHIVO_PRIVADO|password|sqlMessage|INSERT INTO|UPDATE `/);
            return { status: response.status, ...result };
        };
        const linea = (med, existencia, cantidad = 1, precioUnitario = '0.10') => ({
            idMedicamento: med.id_medicamento, idExistencia: existencia.id_existencia, cantidad, precioUnitario });
        const pendiente = async (claveOperacion, detalles) => (await request('POST', '', { claveOperacion, detalles }, 201)).data;
        const confirmar = (idVenta, status = 200, rol = 'VENDEDOR', body = {}, query = '') =>
            request('POST', `/${idVenta}/confirmar${query}`, body, status, rol);
        const stock = async e => (await db.ExistenciaMedicamento.findByPk(e.id_existencia)).cantidad_fisica;
        const snapshot = async () => JSON.stringify(await Promise.all([
            db.Venta, db.DetalleVenta, db.ExistenciaMedicamento, db.MovimientoInventario, db.Receta
        ].map(model => model.findAll({ raw: true, order: [[model.primaryKeyAttribute, 'ASC']] }))));
        const exitos = idVenta => db.BitacoraAuditoria.count({ where: {
            tipo_evento: 'VENTA_CONFIRMAR', resultado: 'EXITO', id_registro: idVenta } });
        const movimientosVenta = async idVenta => {
            const detalles = await db.DetalleVenta.findAll({ where: { id_venta: idVenta }, raw: true });
            return db.MovimientoInventario.findAll({ where: { id_detalle_venta: {
                [db.Sequelize.Op.in]: detalles.map(d => d.id_detalle_venta) } }, raw: true, order: [['id_movimiento', 'ASC']] });
        };

        await t.test('FEFO mixto, desempate por ID y división conservan detalle original, importes y costos', async () => {
            const med = await crearMedicamento();
            const lejana = await crearExistencia(med, '2028-01-01', 'DIA', 100, '3.456789');
            const vencida = await crearExistencia(med, '2026-10-31', 'DIA', 100);
            const mes = await crearExistencia(med, '2026-10-01', 'MES', 2, '1.234567');
            const dia = await crearExistencia(med, '2026-11-01', 'DIA', 3, '2.345678');
            const agotada = await crearExistencia(med, '2026-11-02', 'DIA', 0);
            const venta = await pendiente('fefo-mixto', [linea(med, vencida, 6)]);
            const idOriginal = venta.detalles[0].idDetalleVenta;
            const { data } = await confirmar(venta.idVenta);
            assert.equal(data.estadoOperacion, 'CONFIRMADA');
            assert.equal(data.fechaVenta, '2026-10-31 12:00:00');
            assert.equal(data.fechaRegistro, venta.fechaRegistro);
            assert.equal(data.claveOperacion, venta.claveOperacion);
            assert.equal(data.total, '0.60');
            assert.deepEqual(data.detalles.map(d => [d.idExistencia, d.cantidad, d.subtotal]), [
                [mes.id_existencia, 2, '0.20'], [dia.id_existencia, 3, '0.30'], [lejana.id_existencia, 1, '0.10']
            ]);
            assert.equal(data.detalles[0].idDetalleVenta, idOriginal);
            assert.equal(await stock(mes), 0); assert.equal(await stock(dia), 0);
            assert.equal(await stock(lejana), 99); assert.equal(await stock(vencida), 100); assert.equal(await stock(agotada), 0);
            assert.equal((await db.ExistenciaMedicamento.findByPk(mes.id_existencia)).fecha_vencimiento, '2026-10-01');
            const movimientos = await movimientosVenta(venta.idVenta);
            assert.deepEqual(movimientos.map(m => [m.id_existencia, m.cantidad, m.costo_unitario_aplicado]), [
                [mes.id_existencia, 2, '1.234567'], [dia.id_existencia, 3, '2.345678'], [lejana.id_existencia, 1, '3.456789']
            ]);
            for (const m of movimientos) {
                assert.equal(m.direccion, 'SALIDA'); assert.equal(m.motivo, 'VENTA');
                assert.equal(m.id_usuario, usuarios.VENDEDOR.id_usuario);
                assert.equal(m.id_detalle_compra, null); assert.equal(m.id_movimiento_original, null);
            }
            const evento = await db.BitacoraAuditoria.findOne({ where: {
                tipo_evento: 'VENTA_CONFIRMAR', resultado: 'EXITO', id_registro: venta.idVenta }, raw: true });
            assert.deepEqual(evento.antes, { estadoOperacion: 'PENDIENTE', total: '0.60', cantidadDetalles: 1 });
            assert.deepEqual(evento.despues, { estadoOperacion: 'CONFIRMADA', total: '0.60', cantidadDetalles: 3 });
            assert.equal(evento.metadatos.cantidadMovimientos, 3);
            assert.equal(evento.referencias.filter(r => r.tipo === 'MOVIMIENTO').length, 3);
        });
        await t.test('Varias líneas del mismo medicamento comparten stock sin perder precios ni IDs', async () => {
            const med = await crearMedicamento(), e1 = await crearExistencia(med, '2027-01-01', 'DIA', 3),
                e2 = await crearExistencia(med, '2027-02-01', 'DIA', 4);
            const venta = await pendiente('precios-distintos', [linea(med, e2, 2, '0.10'), linea(med, e2, 4, '0.20')]);
            const { data } = await confirmar(venta.idVenta);
            assert.equal(data.total, '1.00');
            for (const d of venta.detalles) assert.ok(data.detalles.some(final => final.idDetalleVenta === d.idDetalleVenta));
            assert.deepEqual((await movimientosVenta(venta.idVenta)).map(m => m.cantidad), [2, 1, 3]);
            assert.equal(await stock(e1), 0); assert.equal(await stock(e2), 1);
            assert.equal(data.detalles.filter(d => d.precioUnitario === '0.10').reduce((s, d) => s + d.cantidad, 0), 2);
            assert.equal(data.detalles.filter(d => d.precioUnitario === '0.20').reduce((s, d) => s + d.cantidad, 0), 4);
        });
        await t.test('Una asignación sin cambios y precio cero se confirma; costo vigente no se recalcula', async () => {
            const med = await crearMedicamento(), e = await crearExistencia(med);
            const venta = await pendiente('costo-actual', [linea(med, e, 1, '0')]);
            await db.ExistenciaMedicamento.update({ costo_unitario_promedio: '8.123456' }, { where: { id_existencia: e.id_existencia } });
            const { data } = await request('POST', `/${venta.idVenta}/confirmar`, undefined);
            assert.equal(data.total, '0.00'); assert.equal(data.detalles[0].idDetalleVenta, venta.detalles[0].idDetalleVenta);
            assert.equal((await movimientosVenta(venta.idVenta))[0].costo_unitario_aplicado, '8.123456');
            assert.equal((await db.ExistenciaMedicamento.findByPk(e.id_existencia)).costo_unitario_promedio, '8.123456');
        });
        await t.test('Solo Vendedor confirma; rechaza cuerpo/query arbitrarios y venta ausente', async () => {
            const med = await crearMedicamento(), e = await crearExistencia(med);
            const venta = await pendiente('permisos-confirmacion', [linea(med, e)]), antes = await snapshot();
            await confirmar(venta.idVenta, 401, null);
            for (const rol of ['ADMINISTRADOR', 'REGENTE']) await confirmar(venta.idVenta, 403, rol);
            for (const body of [{ total: '0.00' }, { idExistencia: e.id_existencia }, { idReceta: 1 }, { fechaVenta: '2026-10-31' }]) {
                await confirmar(venta.idVenta, 400, 'VENDEDOR', body);
            }
            await confirmar(venta.idVenta, 400, 'VENDEDOR', {}, '?otro=1');
            await confirmar(0, 400); await confirmar(2147483647, 404);
            assert.equal(await snapshot(), antes);
        });
        await t.test('RN58 bloquea valores desconocidos sin normalizar valores sintéticos', async () => {
            for (const condicion of ['Libre', 'Venta libre', 'CON RECETA', 'LIBRE ', 'receta_medica', 'DESCONOCIDA']) {
                const med = await crearMedicamento({ condicion_venta: condicion }), e = await crearExistencia(med);
                const venta = await pendiente(`condicion-${med.id_medicamento}`, [linea(med, e)]), antes = await snapshot();
                await confirmar(venta.idVenta, 409);
                assert.equal(await snapshot(), antes);
                assert.equal((await db.Medicamento.findByPk(med.id_medicamento)).condicion_venta, condicion);
            }
        });
        await t.test('RN58 bloquea recetas inexistentes, pendientes, rechazadas o ajenas y permite una aprobada', async () => {
            const med = await crearMedicamento({ condicion_venta: 'RECETA_MEDICA' }), e = await crearExistencia(med);
            for (const estado of ['SIN_RECETA', null, 'RECHAZADA', 'APROBADA']) {
                const venta = await pendiente(`receta-${estado ?? 'pendiente'}`, [linea(med, e)]);
                if (estado !== 'SIN_RECETA') {
                    const receta = await db.Receta.create({ id_venta: venta.idVenta, fecha_receta: '2026-10-31',
                        nombre_paciente: 'PII_PACIENTE', documento_paciente: 'PII_DOCUMENTO', nombre_medico: 'PII_MEDICO',
                        archivo_receta: null, modalidad: 'Presentada', resultado_revision: estado,
                        id_usuario_validador: estado ? usuarios.REGENTE.id_usuario : null,
                        fecha_validacion: estado ? civil('2026-10-31 11:00:00') : null });
                    await db.DetalleVenta.update({ id_receta: receta.id_receta }, { where: { id_venta: venta.idVenta } });
                }
                const antes = await snapshot();
                const resultado = await confirmar(venta.idVenta, estado === 'APROBADA' ? 200 : 409);
                if (estado === 'APROBADA') {
                    assert.equal(resultado.data.estadoOperacion, 'CONFIRMADA');
                    assert.ok(resultado.data.detalles[0].idReceta);
                } else assert.equal(await snapshot(), antes);
            }
            const venta = await pendiente('receta-ajena-confirmacion', [linea(med, e)]);
            const recetaAjena = await db.Receta.findOne({ where: { resultado_revision: 'APROBADA' } });
            await db.DetalleVenta.update({ id_receta: recetaAjena.id_receta }, { where: { id_venta: venta.idVenta } });
            const antes = await snapshot();
            await confirmar(venta.idVenta, 409);
            assert.equal(await snapshot(), antes);
        });
        await t.test('Stock físico vencido y medicamento desactivado no son vendibles', async () => {
            const med = await crearMedicamento(), e = await crearExistencia(med, '2026-10-31', 'DIA', 100);
            const venta = await pendiente('solo-vencidas', [linea(med, e)]), antes = await snapshot();
            await confirmar(venta.idVenta, 409); assert.equal(await snapshot(), antes);
            const otroMed = await crearMedicamento(), otra = await crearExistencia(otroMed);
            const inactiva = await pendiente('inactivo-al-confirmar', [linea(otroMed, otra)]);
            await db.Medicamento.update({ estado: false }, { where: { id_medicamento: otroMed.id_medicamento } });
            const despues = await snapshot();
            await confirmar(inactiva.idVenta, 409); assert.equal(await snapshot(), despues);
        });
        await t.test('Una receta aprobada de la misma venta puede respaldar también un LIBRE sin exigir adjunto', async () => {
            const med = await crearMedicamento(), e = await crearExistencia(med);
            const venta = await pendiente('libre-con-receta-historica', [linea(med, e)]);
            const receta = await db.Receta.create({ id_venta: venta.idVenta, fecha_receta: '2026-10-31',
                nombre_paciente: 'PII_PACIENTE', documento_paciente: 'PII_DOCUMENTO', nombre_medico: 'PII_MEDICO',
                archivo_receta: null, modalidad: 'Presentada', resultado_revision: 'APROBADA',
                id_usuario_validador: usuarios.REGENTE.id_usuario, fecha_validacion: civil('2026-10-31 11:00:00') });
            await db.DetalleVenta.update({ id_receta: receta.id_receta }, { where: { id_venta: venta.idVenta } });
            const { data } = await confirmar(venta.idVenta);
            assert.equal(data.detalles[0].idReceta, receta.id_receta);
        });
        await t.test('Una receta registrada y aprobada por HTTP respalda varios medicamentos y detalles divididos por FEFO', async () => {
            const med1 = await crearMedicamento({ condicion_venta: 'RECETA_MEDICA' }),
                med2 = await crearMedicamento({ condicion_venta: 'RECETA_MEDICA' });
            const e1 = await crearExistencia(med1, '2027-01-01', 'DIA', 2),
                e2 = await crearExistencia(med1, '2027-02-01', 'DIA', 4), e3 = await crearExistencia(med2, '2027-01-01', 'DIA', 3);
            const venta = await pendiente('receta-varios-detalles', [linea(med1, e2, 3, '1.10'), linea(med1, e2, 1, '2.00'), linea(med2, e3, 2, '0.30')]);
            const { data: receta } = await request('POST', `/${venta.idVenta}/recetas`, {
                fechaReceta: '2026-10-31', nombrePaciente: 'Paciente sintético', documentoPaciente: 'DOC-TEST',
                nombreMedico: 'Médico sintético', modalidad: 'Presentada', idsDetallesVenta: venta.detalles.map(d => d.idDetalleVenta)
            }, 201);
            assert.equal(receta.resultadoRevision, null);
            const revisar = `/${venta.idVenta}/recetas/${receta.idReceta}/revisar`;
            await request('POST', revisar, { resultadoRevision: 'APROBADA' }, 403);
            await request('POST', revisar, { resultadoRevision: 'APROBADA' }, 200, 'REGENTE');
            assert.equal(await stock(e1), 2); assert.equal(await stock(e2), 4); assert.equal(await stock(e3), 3);
            const antes = await snapshot(), original = movimientoInventarioRepository.create.bind(movimientoInventarioRepository);
            const mock = t.mock.method(movimientoInventarioRepository, 'create', async options => {
                await original(options); throw new Error('fallo_salida_con_receta');
            });
            try { await confirmar(venta.idVenta, 500); } finally { mock.mock.restore(); }
            assert.equal(await snapshot(), antes);
            const { data } = await confirmar(venta.idVenta);
            assert.equal(data.total, '5.90'); assert.equal(data.detalles.length, 4);
            assert.ok(data.detalles.every(d => d.idReceta === receta.idReceta));
            for (const d of venta.detalles) assert.ok(data.detalles.some(final => final.idDetalleVenta === d.idDetalleVenta));
            assert.equal(await stock(e1), 0); assert.equal(await stock(e2), 2); assert.equal(await stock(e3), 1);
            assert.equal((await db.Receta.findByPk(receta.idReceta)).resultado_revision, 'APROBADA');
            assert.equal(await exitos(venta.idVenta), 1);
        });
        for (const primeraOperacion of ['aprobar', 'confirmar']) {
            await t.test(`Carrera receta/venta: forzar ${primeraOperacion} primero con bloqueos reales`, async () => {
                const med = await crearMedicamento({ condicion_venta: 'RECETA_MEDICA' }), e = await crearExistencia(med, '2027-01-01', 'DIA', 5);
                const venta = await pendiente(`receta-carrera-${primeraOperacion}`, [linea(med, e)]);
                const { data: receta } = await request('POST', `/${venta.idVenta}/recetas`, {
                    fechaReceta: '2026-10-31', nombrePaciente: 'Paciente sintético', documentoPaciente: 'DOC-TEST',
                    nombreMedico: 'Médico sintético', modalidad: 'Presentada', idsDetallesVenta: [venta.detalles[0].idDetalleVenta]
                }, 201);
                const aprobar = () => request('POST', `/${venta.idVenta}/recetas/${receta.idReceta}/revisar`,
                    { resultadoRevision: 'APROBADA' }, 200, 'REGENTE');
                const primero = primeraOperacion === 'aprobar' ? 'findParaReceta' : 'findParaConfirmar',
                    segundo = primeraOperacion === 'aprobar' ? 'findParaConfirmar' : 'findParaReceta';
                const originalPrimero = ventaRepository[primero].bind(ventaRepository), originalSegundo = ventaRepository[segundo].bind(ventaRepository);
                let marcarBloqueada, marcarEspera, liberar;
                const bloqueada = new Promise(resolve => { marcarBloqueada = resolve; });
                const espera = new Promise(resolve => { marcarEspera = resolve; });
                const continuar = new Promise(resolve => { liberar = resolve; });
                const mockPrimero = t.mock.method(ventaRepository, primero, async options => {
                    const registro = await originalPrimero(options); marcarBloqueada(); await continuar; return registro;
                });
                const mockSegundo = t.mock.method(ventaRepository, segundo, options => { marcarEspera(); return originalSegundo(options); });
                let a, b;
                try {
                    a = primeraOperacion === 'aprobar' ? aprobar() : confirmar(venta.idVenta, 409);
                    a.catch(() => {}); await bloqueada;
                    b = primeraOperacion === 'aprobar' ? confirmar(venta.idVenta) : aprobar();
                    b.catch(() => {}); await espera; liberar(); await Promise.all([a, b]);
                } finally {
                    liberar(); mockPrimero.mock.restore(); mockSegundo.mock.restore();
                    if (a) await a.catch(() => {}); if (b) await b.catch(() => {});
                }
                if (primeraOperacion === 'confirmar') {
                    assert.equal(await stock(e), 5); assert.equal((await movimientosVenta(venta.idVenta)).length, 0);
                    await confirmar(venta.idVenta);
                }
                assert.equal(await stock(e), 4); assert.equal(await exitos(venta.idVenta), 1);
            });
        }
        await t.test('Stock insuficiente en la última línea no deja descuentos de la primera', async () => {
            const med1 = await crearMedicamento(), e1 = await crearExistencia(med1),
                med2 = await crearMedicamento(), e2 = await crearExistencia(med2, '2027-01-01', 'DIA', 1);
            const venta = await pendiente('insuficiente-multimed', [linea(med1, e1, 2), linea(med2, e2, 2)]), antes = await snapshot();
            await confirmar(venta.idVenta, 409);
            assert.equal(await snapshot(), antes); assert.equal(await exitos(venta.idVenta), 0);
        });
        await t.test('Estados, cantidades monetarias e historial previo inconsistentes no se sobrescriben', async () => {
            const vacia = await db.Venta.create({ id_usuario: usuarios.VENDEDOR.id_usuario,
                clave_operacion: 'vacia', estado_operacion: 'PENDIENTE', total: '0.00' });
            await confirmar(vacia.id_venta, 409);
            const med = await crearMedicamento(), e = await crearExistencia(med);
            for (const caso of ['ANULADA', 'fecha', 'total', 'subtotal', 'movimiento']) {
                const venta = await pendiente(`inconsistencia-${caso}`, [linea(med, e)]);
                if (caso === 'ANULADA') await db.Venta.update({ estado_operacion: 'ANULADA' }, { where: { id_venta: venta.idVenta } });
                if (caso === 'fecha') await db.Venta.update({ fecha_venta: civil('2026-10-31 10:00:00') }, { where: { id_venta: venta.idVenta } });
                if (caso === 'total') await db.Venta.update({ total: '99.00' }, { where: { id_venta: venta.idVenta } });
                if (caso === 'subtotal') await db.DetalleVenta.update({ subtotal: '99.00' }, { where: { id_venta: venta.idVenta } });
                if (caso === 'movimiento') await db.MovimientoInventario.create({ id_usuario: usuarios.VENDEDOR.id_usuario,
                    id_existencia: e.id_existencia, id_detalle_venta: venta.detalles[0].idDetalleVenta,
                    direccion: 'SALIDA', cantidad: 1, costo_unitario_aplicado: '1.000000', motivo: 'VENTA' });
                const antes = await snapshot(); await confirmar(venta.idVenta, 409); assert.equal(await snapshot(), antes);
            }
        });

        await t.test('Doble confirmación simultánea: un commit, una salida y un único éxito', async () => {
            const med = await crearMedicamento(), e = await crearExistencia(med, '2027-01-01', 'DIA', 5);
            const venta = await pendiente('doble-confirmacion', [linea(med, e, 2)]);
            const respuestas = await Promise.all([confirmar(venta.idVenta, null), confirmar(venta.idVenta, null)]);
            assert.deepEqual(respuestas.map(r => r.status).sort(), [200, 409]);
            assert.equal(await stock(e), 3); assert.equal((await movimientosVenta(venta.idVenta)).length, 1);
            assert.equal(await exitos(venta.idVenta), 1);
            const antes = await snapshot(); await confirmar(venta.idVenta, 409); assert.equal(await snapshot(), antes);
        });
        await t.test('Dos ventas simultáneas sobre stock insuficiente no producen sobreventa', async () => {
            const med = await crearMedicamento(), e = await crearExistencia(med, '2027-01-01', 'DIA', 5);
            const a = await pendiente('competencia-a', [linea(med, e, 4)]),
                b = await pendiente('competencia-b', [linea(med, e, 4)]);
            const resultados = await Promise.all([confirmar(a.idVenta, null), confirmar(b.idVenta, null)]);
            assert.deepEqual(resultados.map(r => r.status).sort(), [200, 409]);
            assert.equal(await stock(e), 1);
            const ganadora = resultados[0].status === 200 ? a : b, perdedora = ganadora === a ? b : a;
            assert.equal((await movimientosVenta(ganadora.idVenta)).length, 1);
            assert.equal((await movimientosVenta(perdedora.idVenta)).length, 0);
            const pendienteIntacta = (await request('GET', `/${perdedora.idVenta}`)).data;
            assert.equal(pendienteIntacta.estadoOperacion, 'PENDIENTE');
            assert.equal(pendienteIntacta.fechaVenta, null);
            assert.deepEqual(pendienteIntacta.detalles, perdedora.detalles);
        });
        const medRollback = await crearMedicamento(), eRollback1 = await crearExistencia(medRollback, '2027-01-01', 'DIA', 1),
            eRollback2 = await crearExistencia(medRollback, '2027-02-01', 'DIA', 3);
        const ventaRollback = await pendiente('rollback-confirmacion', [linea(medRollback, eRollback2, 3)]);
        const fallos = [
            ['segundo descuento', existenciaMedicamentoRepository, 'descontarParaVenta', 'segundo', 500],
            ['descuento sin efecto', existenciaMedicamentoRepository, 'descontarParaVenta', 'cero', 409],
            ['detalle original sin efecto', ventaRepository, 'finalizarDetalle', 'cero', 409],
            ['detalle adicional', ventaRepository, 'createDetalle', 'siempre', 500],
            ['segundo movimiento', movimientoInventarioRepository, 'create', 'segundo', 500],
            ['cabecera sin efecto', ventaRepository, 'confirmar', 'cero', 409],
            ['lectura de respuesta', ventaRepository, 'findById', 'siempre', 500],
            ['auditoría obligatoria ya insertada', bitacoraAuditoriaRepository, 'create', 'auditoria', 503]
        ];
        for (const [nombre, repositorio, metodo, modo, estado] of fallos) {
            await t.test(`Rollback completo al fallar ${nombre}`, async () => {
                const antes = await snapshot(), original = repositorio[metodo].bind(repositorio);
                let llamadas = 0;
                const mock = t.mock.method(repositorio, metodo, async options => {
                    llamadas++;
                    if (modo === 'auditoria') {
                        if (options.data.tipo_evento === 'VENTA_CONFIRMAR' && options.data.resultado === 'EXITO') {
                            assert.ok(options.transaction);
                            await original(options);
                            throw new Error('fallo_sintetico_auditoria');
                        }
                        return original(options);
                    }
                    if (modo === 'cero') return [0];
                    if (modo === 'siempre' || llamadas === 2) throw new Error('fallo_sintetico_persistencia');
                    return original(options);
                });
                try { await confirmar(ventaRollback.idVenta, estado); }
                finally { mock.mock.restore(); }
                assert.equal(await snapshot(), antes);
                assert.equal(await exitos(ventaRollback.idVenta), 0);
            });
        }
        await t.test('Tras los rollbacks la misma pendiente puede confirmarse sin efectos residuales', async () => {
            await confirmar(ventaRollback.idVenta);
            assert.equal(await stock(eRollback1), 0); assert.equal(await stock(eRollback2), 1);
            assert.equal(await exitos(ventaRollback.idVenta), 1);
            assert.equal((await movimientosVenta(ventaRollback.idVenta)).length, 2);
        });
        await t.test('Timeout real esperando existencia devuelve 409 y no conserva cambios', async () => {
            const med = await crearMedicamento(), e = await crearExistencia(med);
            const venta = await pendiente('confirmar-timeout', [linea(med, e)]), antes = await snapshot();
            const bloqueador = await db.sequelize.transaction();
            const original = existenciaMedicamentoRepository.findParaConfirmarVenta.bind(existenciaMedicamentoRepository);
            const mock = t.mock.method(existenciaMedicamentoRepository, 'findParaConfirmarVenta', async options => {
                await db.sequelize.query('SET SESSION innodb_lock_wait_timeout = 1', { transaction: options.transaction });
                return original(options);
            });
            try {
                await db.ExistenciaMedicamento.findByPk(e.id_existencia, { transaction: bloqueador, lock: bloqueador.LOCK.UPDATE });
                assert.match((await confirmar(venta.idVenta, 409)).message, /contención temporal/);
                assert.equal(await snapshot(), antes);
            } finally {
                mock.mock.restore();
                await bloqueador.rollback();
            }
        });
        await t.test('Vencimiento se reevalúa con el día comercial observado después de esperar los bloqueos', async () => {
            const med = await crearMedicamento(), vence = await crearExistencia(med, '2026-11-01', 'DIA', 5),
                siguiente = await crearExistencia(med, '2027-01-01', 'DIA', 1);
            const venta = await pendiente('vence-al-esperar', [linea(med, vence)]);
            const bloqueador = await db.sequelize.transaction();
            const original = existenciaMedicamentoRepository.findParaConfirmarVenta.bind(existenciaMedicamentoRepository);
            let resolverEntrada;
            const entrada = new Promise(resolve => { resolverEntrada = resolve; });
            const mock = t.mock.method(existenciaMedicamentoRepository, 'findParaConfirmarVenta', options => {
                resolverEntrada(); return original(options);
            });
            let solicitud;
            try {
                await db.ExistenciaMedicamento.findByPk(vence.id_existencia, { transaction: bloqueador, lock: bloqueador.LOCK.UPDATE });
                solicitud = confirmar(venta.idVenta); solicitud.catch(() => {});
                await entrada;
                t.mock.timers.setTime(Date.parse('2026-11-01T04:00:00Z'));
                await bloqueador.rollback();
                const { data } = await solicitud;
                assert.equal(data.fechaVenta, '2026-11-01 00:00:00');
                assert.equal(data.detalles[0].idExistencia, siguiente.id_existencia);
                assert.equal(await stock(vence), 5); assert.equal(await stock(siguiente), 0);
            } finally {
                mock.mock.restore();
                if (!bloqueador.finished) await bloqueador.rollback();
                if (solicitud) await solicitud.catch(() => {});
                t.mock.timers.setTime(relojInicial);
            }
        });
        const eventos = await db.BitacoraAuditoria.findAll({ raw: true });
        assert.doesNotMatch(JSON.stringify(eventos), /PII_|ARCHIVO_PRIVADO/);
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (db) await db.sequelize.close();
        if (creada) await runCli('db:drop');
    }
});
