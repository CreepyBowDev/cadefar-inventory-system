import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Cada ejecución utiliza solo su esquema temporal en MySQL local.
dotenv.config({ quiet: true });
const baseTest = process.env.DB_NAME_TEST;
const protegidas = [process.env.DB_NAME, process.env.DB_NAME_PRODUCTION].filter(Boolean);
assert.ok(baseTest, 'Configurar DB_NAME_TEST para integración');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), 'Usar MySQL local');
assert.equal(protegidas.some(nombre => nombre.toLowerCase() === baseTest.toLowerCase()), false);
const temporal = `${baseTest.slice(0, 20)}_anularv_${randomBytes(6).toString('hex')}`;
assert.match(temporal, /^[a-zA-Z0-9_]+$/);
assert.equal([...protegidas, baseTest].some(nombre => nombre.toLowerCase() === temporal.toLowerCase()), false);
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = temporal;
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_de_anulacion_ventas';
const executeFile = promisify(execFile);
const runCli = async comando => {
    try {
        await executeFile(process.execPath, [fileURLToPath(new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url)),
            comando, '--env', 'test'], { cwd: fileURLToPath(new URL('../', import.meta.url)),
            env: { ...process.env }, timeout: 60000 });
    } catch { throw new Error(`Sequelize CLI: ${comando} falló en la base temporal de Anulación de ventas`); }
};

test('CU30: anulación pendiente/confirmada, promedio ponderado, reversiones, rollback y concurrencia',
    { timeout: 180000 }, async t => {
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
        t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-31T16:00:00Z') });
        t.mock.method(console, 'error', () => {});
        await db.Rol.bulkCreate(Object.entries(ROLES).map(([nombre, id_rol]) => ({ nombre, id_rol })));
        const usuarios = {};
        for (const [rol, idRol] of Object.entries(ROLES)) usuarios[rol] = await db.Usuario.create({
            id_rol: idRol, nombre_usuario: `anularv_${rol}`, password_hash: 'hash_sintetico_sin_login' });
        const proveedor = await db.ProveedorLaboratorio.create({ nombre: 'Proveedor sintético' });
        let secuencia = 0, codigoExistencia = 0;
        const crearMed = (extra = {}) => db.Medicamento.create({ id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio,
            codigo_medicamento: `AV${++secuencia}`, nombre_comercial: `Producto ${secuencia}`, forma_farmaceutica: 'Tableta',
            presentacion: '500 mg', unidad_inventario: 'tableta', condicion_venta: 'LIBRE',
            via_administracion: 'Oral', tipo_liberacion: 'Inmediata', ...extra });
        const civil = fecha => db.Sequelize.fn('STR_TO_DATE', fecha, '%Y-%m-%d %H:%i:%s');
        const crearExistencia = async (med, cantidad = 10, costo = '1.000000', fecha = '2027-01-01') => {
            const existencia = await db.ExistenciaMedicamento.create({ id_medicamento: med.id_medicamento,
                codigo_existencia: `AV-EX-${++codigoExistencia}`, fecha_vencimiento: fecha, precision_vencimiento: 'DIA',
                cantidad_fisica: cantidad, costo_unitario_promedio: costo });
            if (cantidad) await db.MovimientoInventario.create({ id_existencia: existencia.id_existencia,
                id_usuario: usuarios.REGENTE.id_usuario, direccion: 'ENTRADA', cantidad, motivo: 'AJUSTE',
                costo_unitario_aplicado: costo, fecha_movimiento: civil('2026-10-01 10:00:00') });
            return existencia;
        };
        const leerExistencia = e => db.ExistenciaMedicamento.findByPk(e.id_existencia, { raw: true });
        const snapshot = async () => JSON.stringify(await Promise.all([
            db.Venta, db.DetalleVenta, db.ExistenciaMedicamento, db.MovimientoInventario, db.Receta
        ].map(model => model.findAll({ raw: true, order: [[model.primaryKeyAttribute, 'ASC']] }))));
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const request = async (method, path, body, status = 200, rol = 'ADMINISTRADOR') => {
            const token = rol ? generarToken({ idUsuario: usuarios[rol].id_usuario, idRol: ROLES[rol], versionCredenciales: 0 }) : null;
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
                method, headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `token=${token}` } : {}) },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000)
            });
            const result = await response.json();
            if (status !== null) assert.equal(response.status, status, JSON.stringify(result));
            assert.doesNotMatch(JSON.stringify(result), /PII_|ARCHIVO_PRIVADO|password|sqlMessage|INSERT INTO|UPDATE `/);
            return { status: response.status, ...result };
        };
        const linea = (med, e, cantidad = 1, precioUnitario = '2.00') => ({
            idMedicamento: med.id_medicamento, idExistencia: e.id_existencia, cantidad, precioUnitario });
        const pendiente = async (claveOperacion, detalles) => (await request('POST', '/ventas', { claveOperacion, detalles }, 201, 'VENDEDOR')).data;
        const confirmar = (idVenta, status = 200) => request('POST', `/ventas/${idVenta}/confirmar`, {}, status, 'VENDEDOR');
        const anular = (idVenta, status = 200, rol = 'ADMINISTRADOR', body = { motivo: 'Error de registro' }, query = '') =>
            request('POST', `/ventas/${idVenta}/anular${query}`, body, status, rol);
        const movimientos = async idVenta => {
            const ids = (await db.DetalleVenta.findAll({ where: { id_venta: idVenta }, raw: true })).map(d => d.id_detalle_venta);
            return db.MovimientoInventario.findAll({ where: { id_detalle_venta: { [db.Sequelize.Op.in]: ids } },
                raw: true, order: [['id_movimiento', 'ASC']] });
        };
        const exitos = idVenta => db.BitacoraAuditoria.count({ where: { tipo_evento: 'VENTA_ANULAR', resultado: 'EXITO', id_registro: idVenta } });

        await t.test('Anula pendiente conservando detalles, recetas y fecha de venta nula, sin tocar inventario', async () => {
            const med = await crearMed({ condicion_venta: 'RECETA_MEDICA' }), e = await crearExistencia(med, 0, '3.000000', '2020-01-01');
            const venta = await pendiente('pendiente-anulable', [linea(med, e, 100)]);
            const receta = await db.Receta.create({ id_venta: venta.idVenta, fecha_receta: '2026-10-31',
                nombre_paciente: 'PII_PACIENTE', documento_paciente: 'PII_DOCUMENTO', nombre_medico: 'PII_MEDICO',
                archivo_receta: 'ARCHIVO_PRIVADO_FIXTURE.pdf', modalidad: 'Presentada' });
            await db.DetalleVenta.update({ id_receta: receta.id_receta }, { where: { id_venta: venta.idVenta } });
            const recetaAntes = await db.Receta.findByPk(receta.id_receta, { raw: true }), existenciaAntes = await leerExistencia(e);
            const mock = t.mock.method(existenciaMedicamentoRepository, 'findByIdParaAnular', () => { throw new Error('No consultar inventario de una pendiente'); });
            let data;
            try { ({ data } = await anular(venta.idVenta)); } finally { mock.mock.restore(); }
            assert.equal(data.estadoOperacion, 'ANULADA'); assert.equal(data.fechaVenta, null);
            assert.equal(data.fechaRegistro, venta.fechaRegistro); assert.equal(data.total, venta.total);
            assert.equal(data.claveOperacion, venta.claveOperacion); assert.equal(data.idUsuarioAnulador, usuarios.ADMINISTRADOR.id_usuario);
            assert.equal(data.fechaAnulacion, '2026-10-31 12:00:00');
            assert.equal(data.detalles[0].idDetalleVenta, venta.detalles[0].idDetalleVenta);
            assert.equal(data.detalles[0].idReceta, receta.id_receta);
            assert.equal((await movimientos(venta.idVenta)).length, 0);
            assert.deepEqual(await leerExistencia(e), existenciaAntes);
            assert.deepEqual(await db.Receta.findByPk(receta.id_receta, { raw: true }), recetaAntes);
            const evento = await db.BitacoraAuditoria.findOne({ where: { tipo_evento: 'VENTA_ANULAR', resultado: 'EXITO', id_registro: venta.idVenta }, raw: true });
            assert.equal(evento.metadatos.cantidadMovimientos, 0); assert.equal(evento.metadatos.cantidadExistencias, 0);
        });
        await t.test('Confirmada dividida: devuelve a cada existencia y conserva íntegros originales y detalles', async () => {
            const med = await crearMed(), e1 = await crearExistencia(med, 2, '1.234567'),
                e2 = await crearExistencia(med, 3, '2.345678', '2027-02-01');
            const venta = await pendiente('confirmada-dividida', [linea(med, e2, 4)]);
            const confirmada = (await confirmar(venta.idVenta)).data;
            const originales = await movimientos(venta.idVenta);
            await db.Medicamento.update({ estado: false }, { where: { id_medicamento: med.id_medicamento } });
            await db.ExistenciaMedicamento.update({ fecha_vencimiento: '2020-01-01' }, { where: { id_existencia: e1.id_existencia } });
            const detallesAntes = await db.DetalleVenta.findAll({ where: { id_venta: venta.idVenta }, raw: true, order: [['id_detalle_venta', 'ASC']] });
            t.mock.timers.setTime(Date.parse('2026-10-31T17:00:00Z'));
            const { data } = await anular(venta.idVenta, 200, 'ADMINISTRADOR', { motivo: '  MOTIVO_PRIVADO_DOMINIO  ' });
            assert.equal(data.fechaVenta, confirmada.fechaVenta); assert.equal(data.fechaRegistro, venta.fechaRegistro);
            assert.notEqual(data.fechaAnulacion, data.fechaVenta);
            assert.equal(data.estadoOperacion, 'ANULADA'); assert.equal(data.motivoAnulacion, 'MOTIVO_PRIVADO_DOMINIO');
            assert.equal(data.total, confirmada.total); assert.equal(data.claveOperacion, confirmada.claveOperacion);
            const historial = await movimientos(venta.idVenta), reversiones = historial.filter(m => m.id_movimiento_original !== null);
            assert.deepEqual(historial.filter(m => m.id_movimiento_original === null), originales);
            assert.equal(reversiones.length, originales.length);
            for (const original of originales) {
                const r = reversiones.find(m => m.id_movimiento_original === original.id_movimiento);
                assert.equal(r.id_existencia, original.id_existencia); assert.equal(r.cantidad, original.cantidad);
                assert.equal(r.costo_unitario_aplicado, original.costo_unitario_aplicado);
                assert.equal(r.direccion, 'ENTRADA'); assert.equal(r.motivo, 'ANULACION_VENTA');
                assert.equal(r.id_detalle_venta, original.id_detalle_venta); assert.equal(r.id_detalle_compra, null);
                assert.equal(r.id_usuario, usuarios.ADMINISTRADOR.id_usuario); assert.equal(r.observacion, data.motivoAnulacion);
            }
            assert.deepEqual(await db.DetalleVenta.findAll({ where: { id_venta: venta.idVenta }, raw: true, order: [['id_detalle_venta', 'ASC']] }), detallesAntes);
            assert.equal((await leerExistencia(e1)).cantidad_fisica, 2); assert.equal((await leerExistencia(e2)).cantidad_fisica, 3);
            assert.equal((await leerExistencia(e1)).costo_unitario_promedio, '1.234567');
            const [fecha] = await db.sequelize.query("SELECT DATE_FORMAT(fecha_movimiento, '%Y-%m-%d %H:%i:%s') AS fecha FROM movimiento_inventario WHERE id_movimiento = :id", {
                replacements: { id: reversiones[0].id_movimiento }, type: db.Sequelize.QueryTypes.SELECT });
            assert.equal(fecha.fecha, data.fechaAnulacion);
        });
        await t.test('Compra posterior: promedio aprobado 1.833333; las reversiones siguen al costo original 1', async () => {
            const med = await crearMed(), e = await crearExistencia(med, 4, '1.000000');
            const venta = await pendiente('venta-antes-compra', [linea(med, e, 2)]); await confirmar(venta.idVenta);
            const compra = (await request('POST', '/compras', { claveOperacion: 'compra-despues-venta', fechaCompra: '2026-10-31',
                detalles: [{ idMedicamento: med.id_medicamento, cantidad: 8, costoUnitario: '2.250000',
                    precisionVencimiento: 'DIA', fechaVencimiento: '2027-01-01' }] }, 201)).data;
            assert.equal((await leerExistencia(e)).cantidad_fisica, 10);
            assert.equal((await leerExistencia(e)).costo_unitario_promedio, '2.000000');
            await anular(venta.idVenta);
            assert.equal((await leerExistencia(e)).cantidad_fisica, 12);
            assert.equal((await leerExistencia(e)).costo_unitario_promedio, '1.833333');
            assert.equal((await movimientos(venta.idVenta)).find(m => m.id_movimiento_original !== null).costo_unitario_aplicado, '1.000000');
            // CU27 existente reconoce la reversión legítima de venta como posterior.
            await request('POST', `/compras/${compra.idCompra}/anular`, { motivo: 'Corrección posterior de compra' });
            assert.equal((await leerExistencia(e)).cantidad_fisica, 4);
            assert.equal((await leerExistencia(e)).costo_unitario_promedio, '0.999999');
        });
        await t.test('Saldo cero ignora el promedio histórico; redondeo half-up y límites se mantienen exactos', async () => {
            const med = await crearMed(), e = await crearExistencia(med, 1, '0.000001');
            const venta = await pendiente('agotada-promedio', [linea(med, e)]); await confirmar(venta.idVenta);
            await db.ExistenciaMedicamento.update({ costo_unitario_promedio: '99.000000' }, { where: { id_existencia: e.id_existencia } });
            await anular(venta.idVenta);
            assert.equal((await leerExistencia(e)).costo_unitario_promedio, '0.000001');
            const maxMed = await crearMed(), maxE = await crearExistencia(maxMed, 2147483647, '99999999.999999');
            const maxVenta = await pendiente('limites-exactos', [linea(maxMed, maxE, 2147483646, '0.00')]);
            await confirmar(maxVenta.idVenta); await anular(maxVenta.idVenta);
            assert.equal((await leerExistencia(maxE)).cantidad_fisica, 2147483647);
            assert.equal((await leerExistencia(maxE)).costo_unitario_promedio, '99999999.999999');
        });
        await t.test('Solo Administrador, motivo obligatorio y contrato estricto; errores no alteran negocio', async () => {
            const med = await crearMed(), e = await crearExistencia(med);
            const venta = await pendiente('permisos-anular', [linea(med, e)]), antes = await snapshot();
            await anular(venta.idVenta, 401, null);
            for (const rol of ['VENDEDOR', 'REGENTE']) await anular(venta.idVenta, 403, rol);
            for (const body of [{}, { motivo: '' }, { motivo: 'x'.repeat(256) }, { motivo: 'Error', idUsuarioAnulador: 3 },
                { motivo: 'Error', fechaAnulacion: '2026-10-31' }, { motivo: 'Error', costoUnitarioPromedio: '0' }]) {
                await anular(venta.idVenta, 400, 'ADMINISTRADOR', body);
            }
            await anular(venta.idVenta, 400, 'ADMINISTRADOR', { motivo: 'Error' }, '?otro=1');
            await anular(0, 400); await anular(2147483647, 404);
            assert.equal(await snapshot(), antes);
        });

        const historica = async (costos, saldoActual = 1, promedioActual = '0.000001') => {
            const med = await crearMed(), e = await crearExistencia(med, saldoActual + costos.length, promedioActual);
            const venta = await db.Venta.create({ id_usuario: usuarios.VENDEDOR.id_usuario,
                clave_operacion: `historica-${med.id_medicamento}`, estado_operacion: 'CONFIRMADA',
                fecha_venta: civil('2026-10-10 10:00:00'), total: `${costos.length * 7}.00` });
            for (const costo of costos) {
                const detalle = await db.DetalleVenta.create({ id_venta: venta.id_venta, id_existencia: e.id_existencia,
                    cantidad: 1, precio_unitario: '7.00', subtotal: '7.00' });
                await db.MovimientoInventario.create({ id_usuario: usuarios.VENDEDOR.id_usuario, id_existencia: e.id_existencia,
                    id_detalle_venta: detalle.id_detalle_venta, direccion: 'SALIDA', cantidad: 1, motivo: 'VENTA',
                    costo_unitario_aplicado: costo, fecha_movimiento: civil('2026-10-10 10:00:00') });
            }
            await db.ExistenciaMedicamento.update({ cantidad_fisica: saldoActual }, { where: { id_existencia: e.id_existencia } });
            return { idVenta: venta.id_venta, e };
        };
        await t.test('Agrupa costos originales distintos con un único redondeo, independiente del orden', async () => {
            for (const costos of [['0.000002', '0.000001'], ['0.000001', '0.000002']]) {
                const { idVenta, e } = await historica(costos);
                await anular(idVenta);
                assert.equal((await leerExistencia(e)).cantidad_fisica, 3);
                assert.equal((await leerExistencia(e)).costo_unitario_promedio, '0.000001');
                assert.deepEqual((await movimientos(idVenta)).filter(m => m.id_movimiento_original !== null)
                    .map(m => m.costo_unitario_aplicado), costos);
            }
            const { idVenta, e } = await historica(['0.000001'], 1, '0.000000');
            await anular(idVenta);
            assert.equal((await leerExistencia(e)).costo_unitario_promedio, '0.000001'); // 0.0000005, empate hacia arriba.
        });
        await t.test('Pendiente sin detalles puede cerrarse sin efectos; fecha o anulación previa incoherentes se rechazan', async () => {
            const vacia = await db.Venta.create({ id_usuario: usuarios.VENDEDOR.id_usuario,
                clave_operacion: 'pendiente-vacia', total: '0.00' });
            assert.equal((await anular(vacia.id_venta)).data.fechaVenta, null);
            const med = await crearMed(), e = await crearExistencia(med);
            for (const [nombre, campos] of [['fecha', { fecha_venta: civil('2026-10-31 10:00:00') }],
                ['anulacion', { motivo_anulacion: 'Previa inconsistente' }]]) {
                const venta = await pendiente(`inconsistencia-${nombre}`, [linea(med, e)]);
                await db.Venta.update(campos, { where: { id_venta: venta.idVenta } });
                const antes = await snapshot(); await anular(venta.idVenta, 409); assert.equal(await snapshot(), antes);
            }
        });
        await t.test('Pendiente con movimientos y confirmada sin originales no se compensan parcialmente', async () => {
            const med = await crearMed(), e = await crearExistencia(med);
            const venta = await pendiente('pendiente-con-salida', [linea(med, e)]);
            await db.MovimientoInventario.create({ id_existencia: e.id_existencia, id_usuario: usuarios.VENDEDOR.id_usuario,
                id_detalle_venta: venta.detalles[0].idDetalleVenta, direccion: 'SALIDA', cantidad: 1,
                motivo: 'VENTA', costo_unitario_aplicado: '1.000000' });
            const antes = await snapshot(); await anular(venta.idVenta, 409); assert.equal(await snapshot(), antes);
            const sinOriginal = await pendiente('original-incompleto', [linea(med, e)]); await confirmar(sinOriginal.idVenta);
            const confirmadoAntes = await snapshot();
            const mock = t.mock.method(movimientoInventarioRepository, 'findParaAnularVenta', async () => []);
            try { await anular(sinOriginal.idVenta, 409); } finally { mock.mock.restore(); }
            assert.equal(await snapshot(), confirmadoAntes);
        });
        await t.test('Dirección, motivo, cantidad, existencia y duplicación de originales se validan estrictamente', async () => {
            const med = await crearMed(), e = await crearExistencia(med, 20), otra = await crearExistencia(med, 0, '1.000000', '2028-01-01');
            for (const [nombre, cambios] of [['direccion', { direccion: 'ENTRADA' }], ['motivo', { motivo: 'AJUSTE' }],
                ['cantidad', { cantidad: 2 }], ['existencia', { id_existencia: otra.id_existencia }], ['duplicado', null]]) {
                const venta = await pendiente(`original-${nombre}`, [linea(med, e)]); await confirmar(venta.idVenta);
                const original = (await movimientos(venta.idVenta))[0];
                if (cambios) await db.MovimientoInventario.update(cambios, { where: { id_movimiento: original.id_movimiento } });
                else {
                    const { id_movimiento, ...copia } = original;
                    await db.MovimientoInventario.create(copia);
                }
                const antes = await snapshot(); await anular(venta.idVenta, 409); assert.equal(await snapshot(), antes);
            }
        });
        await t.test('Reversión previa fuera del detalle se detecta; UNIQUE real impide duplicarla incluso sin precheck', async () => {
            const med = await crearMed(), e = await crearExistencia(med);
            const venta = await pendiente('reversion-previa', [linea(med, e)]); await confirmar(venta.idVenta);
            const original = (await movimientos(venta.idVenta))[0];
            await db.MovimientoInventario.create({ id_usuario: usuarios.ADMINISTRADOR.id_usuario,
                id_existencia: e.id_existencia, id_movimiento_original: original.id_movimiento,
                id_detalle_venta: null, direccion: 'ENTRADA', cantidad: original.cantidad,
                costo_unitario_aplicado: original.costo_unitario_aplicado, motivo: 'ANULACION_VENTA' });
            const antes = await snapshot(); await anular(venta.idVenta, 409); assert.equal(await snapshot(), antes);
            const mock = t.mock.method(movimientoInventarioRepository, 'findReversiones', async () => []);
            try { await anular(venta.idVenta, 409); } finally { mock.mock.restore(); }
            assert.equal(await snapshot(), antes); assert.equal(await exitos(venta.idVenta), 0);
        });
        await t.test('Un reintegro que excede INT se rechaza sin modificar saldo, costo ni venta', async () => {
            const med = await crearMed(), e = await crearExistencia(med);
            const venta = await pendiente('saldo-desbordado', [linea(med, e)]); await confirmar(venta.idVenta);
            await db.ExistenciaMedicamento.update({ cantidad_fisica: 2147483647 }, { where: { id_existencia: e.id_existencia } });
            const antes = await snapshot(); await anular(venta.idVenta, 409); assert.equal(await snapshot(), antes);
        });
        await t.test('Doble anulación simultánea de pendientes y confirmadas produce un solo éxito', async () => {
            for (const confirmarPrimero of [false, true]) {
                const med = await crearMed(), e = await crearExistencia(med, 5);
                const venta = await pendiente(`anulacion-simultanea-${confirmarPrimero}`, [linea(med, e, 2)]);
                if (confirmarPrimero) await confirmar(venta.idVenta);
                const respuestas = await Promise.all([anular(venta.idVenta, null), anular(venta.idVenta, null)]);
                assert.deepEqual(respuestas.map(r => r.status).sort(), [200, 409]);
                assert.equal((await leerExistencia(e)).cantidad_fisica, 5);
                assert.equal((await movimientos(venta.idVenta)).length, confirmarPrimero ? 2 : 0);
                assert.equal(await exitos(venta.idVenta), 1);
                const antes = await snapshot(); await anular(venta.idVenta, 409); await confirmar(venta.idVenta, 409);
                assert.equal(await snapshot(), antes);
            }
        });
        for (const primeraOperacion of ['confirmar', 'anular']) {
            await t.test(`Carrera confirmación/anulación: forzar ${primeraOperacion} primero bajo el bloqueo real`, async () => {
                const med = await crearMed(), e = await crearExistencia(med, 5);
                const venta = await pendiente(`carrera-primero-${primeraOperacion}`, [linea(med, e, 2)]);
                const metodoPrimero = primeraOperacion === 'confirmar' ? 'findParaConfirmar' : 'findParaAnular';
                const metodoSegundo = primeraOperacion === 'confirmar' ? 'findParaAnular' : 'findParaConfirmar';
                const originalPrimero = ventaRepository[metodoPrimero].bind(ventaRepository),
                    originalSegundo = ventaRepository[metodoSegundo].bind(ventaRepository);
                let indicarBloqueo, indicarEspera, liberar;
                const bloqueada = new Promise(resolve => { indicarBloqueo = resolve; });
                const espera = new Promise(resolve => { indicarEspera = resolve; });
                const continuar = new Promise(resolve => { liberar = resolve; });
                const mockPrimero = t.mock.method(ventaRepository, metodoPrimero, async options => {
                    const ventaBloqueada = await originalPrimero(options);
                    indicarBloqueo(); await continuar; return ventaBloqueada;
                });
                const mockSegundo = t.mock.method(ventaRepository, metodoSegundo, options => {
                    indicarEspera(); return originalSegundo(options);
                });
                let primera, segunda;
                try {
                    primera = primeraOperacion === 'confirmar' ? confirmar(venta.idVenta) : anular(venta.idVenta);
                    primera.catch(() => {}); await bloqueada;
                    segunda = primeraOperacion === 'confirmar' ? anular(venta.idVenta) : confirmar(venta.idVenta, 409);
                    segunda.catch(() => {}); await espera; liberar();
                    const resultados = await Promise.all([primera, segunda]);
                    const anulacion = resultados[primeraOperacion === 'anular' ? 0 : 1];
                    assert.equal(anulacion.data.estadoOperacion, 'ANULADA');
                    assert.equal(anulacion.data.fechaVenta === null, primeraOperacion === 'anular');
                } finally {
                    liberar(); mockPrimero.mock.restore(); mockSegundo.mock.restore();
                    if (primera) await primera.catch(() => {});
                    if (segunda) await segunda.catch(() => {});
                }
                assert.equal((await leerExistencia(e)).cantidad_fisica, 5);
                assert.equal((await movimientos(venta.idVenta)).length, primeraOperacion === 'confirmar' ? 2 : 0);
                assert.equal(await exitos(venta.idVenta), 1);
            });
        }
        await t.test('Devolución y otra venta concurrentes se serializan sin sobreventa ni pérdida de unidades', async () => {
            const med = await crearMed(), e = await crearExistencia(med, 5);
            const original = await pendiente('devolucion-origen', [linea(med, e, 4)]); await confirmar(original.idVenta);
            const consumidora = await pendiente('consumidora-concurrente', [linea(med, e, 4)]);
            const [devolucion, consumo] = await Promise.all([anular(original.idVenta), confirmar(consumidora.idVenta, null)]);
            assert.equal(devolucion.data.estadoOperacion, 'ANULADA'); assert.ok([200, 409].includes(consumo.status));
            assert.equal((await leerExistencia(e)).cantidad_fisica, consumo.status === 200 ? 1 : 5);
            assert.equal((await movimientos(original.idVenta)).length, 2);
            assert.equal((await movimientos(consumidora.idVenta)).length, consumo.status === 200 ? 1 : 0);
        });
        const medRollback = await crearMed(), er1 = await crearExistencia(medRollback, 1), er2 = await crearExistencia(medRollback, 3, '2.000000', '2027-02-01');
        const ventaRollback = await pendiente('anulacion-rollback', [linea(medRollback, er2, 3)]); await confirmar(ventaRollback.idVenta);
        for (const [nombre, repositorio, metodo, modo, estado] of [
            ['segundo reintegro', existenciaMedicamentoRepository, 'reintegrarPorAnulacionVenta', 'segundo', 500],
            ['reintegro sin efecto', existenciaMedicamentoRepository, 'reintegrarPorAnulacionVenta', 'cero', 409],
            ['segunda reversión', movimientoInventarioRepository, 'create', 'segundo', 500],
            ['cabecera sin efecto', ventaRepository, 'anular', 'cero', 409],
            ['lectura de respuesta', ventaRepository, 'findById', 'siempre', 500],
            ['auditoría ya insertada', bitacoraAuditoriaRepository, 'create', 'auditoria', 503]
        ]) {
            await t.test(`Rollback completo tras fallo de ${nombre}`, async () => {
                const antes = await snapshot(), original = repositorio[metodo].bind(repositorio);
                let llamadas = 0;
                const mock = t.mock.method(repositorio, metodo, async options => {
                    llamadas++;
                    if (modo === 'auditoria') {
                        if (options.data.tipo_evento === 'VENTA_ANULAR' && options.data.resultado === 'EXITO') {
                            assert.ok(options.transaction); await original(options); throw new Error('fallo_auditoria_obligatoria');
                        }
                        return original(options);
                    }
                    if (modo === 'cero') return [0];
                    if (modo === 'siempre' || llamadas === 2) throw new Error('fallo_sintetico_persistencia');
                    return original(options);
                });
                try { await anular(ventaRollback.idVenta, estado); } finally { mock.mock.restore(); }
                assert.equal(await snapshot(), antes); assert.equal(await exitos(ventaRollback.idVenta), 0);
            });
        }
        await t.test('La venta sigue confirmada tras fallos y se puede anular luego sin reversiones residuales', async () => {
            await anular(ventaRollback.idVenta);
            assert.equal((await leerExistencia(er1)).cantidad_fisica, 1); assert.equal((await leerExistencia(er2)).cantidad_fisica, 3);
            assert.equal((await movimientos(ventaRollback.idVenta)).length, 4); assert.equal(await exitos(ventaRollback.idVenta), 1);
        });
        await t.test('Fallo del auditor al anular pendiente también revierte estado y metadatos', async () => {
            const med = await crearMed(), e = await crearExistencia(med);
            const venta = await pendiente('pendiente-auditoria-rollback', [linea(med, e)]), antes = await snapshot();
            const original = bitacoraAuditoriaRepository.create.bind(bitacoraAuditoriaRepository);
            const mock = t.mock.method(bitacoraAuditoriaRepository, 'create', async options => {
                if (options.data.tipo_evento === 'VENTA_ANULAR' && options.data.resultado === 'EXITO') {
                    await original(options); throw new Error('fallo_auditoria_pendiente');
                }
                return original(options);
            });
            try { await anular(venta.idVenta, 503); } finally { mock.mock.restore(); }
            assert.equal(await snapshot(), antes); assert.equal(await exitos(venta.idVenta), 0);
        });
        await t.test('Timeout real de InnoDB devuelve conflicto controlado sin confirmar cambios parciales', async () => {
            const med = await crearMed(), e = await crearExistencia(med);
            const venta = await pendiente('anulacion-timeout', [linea(med, e)]); await confirmar(venta.idVenta);
            const antes = await snapshot(), bloqueador = await db.sequelize.transaction();
            const original = existenciaMedicamentoRepository.findByIdParaAnular.bind(existenciaMedicamentoRepository);
            const mock = t.mock.method(existenciaMedicamentoRepository, 'findByIdParaAnular', async options => {
                await db.sequelize.query('SET SESSION innodb_lock_wait_timeout = 1', { transaction: options.transaction });
                return original(options);
            });
            try {
                await db.ExistenciaMedicamento.findByPk(e.id_existencia, { transaction: bloqueador, lock: bloqueador.LOCK.UPDATE });
                assert.match((await anular(venta.idVenta, 409)).message, /contención temporal/);
                assert.equal(await snapshot(), antes);
            } finally { mock.mock.restore(); await bloqueador.rollback(); }
        });
        const eventos = await db.BitacoraAuditoria.findAll({ raw: true });
        assert.doesNotMatch(JSON.stringify(eventos), /PII_|ARCHIVO_PRIVADO|MOTIVO_PRIVADO_DOMINIO/);
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (db) await db.sequelize.close();
        if (creada) await runCli('db:drop');
    }
});
