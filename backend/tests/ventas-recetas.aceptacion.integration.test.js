import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// No se utiliza ninguna base compartida: la aceptación crea y elimina solo
// su esquema aleatorio local. No se ejecutan seeders sobre datos existentes.
dotenv.config({ quiet: true });
const baseTest = process.env.DB_NAME_TEST;
const protegidas = [process.env.DB_NAME, process.env.DB_NAME_PRODUCTION].filter(Boolean);
assert.ok(baseTest, 'Configurar DB_NAME_TEST para integración');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), 'Usar MySQL local');
assert.equal(protegidas.some(nombre => nombre.toLowerCase() === baseTest.toLowerCase()), false);
const temporal = `${baseTest.slice(0, 20)}_ventas_ac_${randomBytes(6).toString('hex')}`;
assert.match(temporal, /^[a-zA-Z0-9_]+$/);
assert.equal([...protegidas, baseTest].some(nombre => nombre.toLowerCase() === temporal.toLowerCase()), false);
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = temporal;
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_de_aceptacion_ventas';
const executeFile = promisify(execFile);
const runCli = async comando => {
    try {
        await executeFile(process.execPath, [fileURLToPath(new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url)),
            comando, '--env', 'test'], { cwd: fileURLToPath(new URL('../', import.meta.url)),
            env: { ...process.env }, timeout: 60000 });
    } catch { throw new Error(`Sequelize CLI: ${comando} falló en la base temporal de aceptación de Ventas/Recetas`); }
};

test('Fase 7: aceptación HTTP/MySQL con login real, cookies, Ventas/Recetas e inventario conciliado',
    { timeout: 180000 }, async t => {
    let creada = false, db, server;
    try {
        await runCli('db:create'); creada = true;
        await runCli('db:migrate');
        ({ default: db } = await import('../src/data/models/index.js'));
        assert.equal(db.sequelize.config.database, temporal);
        const { app } = await import('../src/app.js');
        const { ROLES } = await import('../src/shared/constants/roles.js');
        t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-31T16:00:00Z') });
        t.mock.method(console, 'error', () => {});
        const password = 'Sintetica-Ventas-123!';
        const hash = await bcrypt.hash(password, 4);
        await db.Rol.bulkCreate(Object.entries(ROLES).map(([nombre, id_rol]) => ({ nombre, id_rol })));
        const usuarios = {};
        for (const [rol, idRol] of Object.entries(ROLES)) usuarios[rol] = await db.Usuario.create({
            id_rol: idRol, nombre_usuario: `aceptacion_${rol.toLowerCase()}`, password_hash: hash });
        const proveedor = await db.ProveedorLaboratorio.create({ nombre: 'Proveedor sintético de aceptación' });
        const crearMed = (codigo, condicion) => db.Medicamento.create({ id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio,
            codigo_medicamento: codigo, nombre_comercial: `Producto ${codigo}`, forma_farmaceutica: 'Tableta',
            presentacion: '500 mg', unidad_inventario: 'tableta', condicion_venta: condicion,
            via_administracion: 'Oral', tipo_liberacion: 'Inmediata' });
        const libre = await crearMed('ACL', 'LIBRE'), medico = await crearMed('ACR', 'RECETA_MEDICA'),
            desconocido = await crearMed('ACD', 'Libre');
        const crearExistencia = async (med, codigo, fecha, cantidad, costo) => {
            const e = await db.ExistenciaMedicamento.create({ id_medicamento: med.id_medicamento,
                codigo_existencia: codigo, fecha_vencimiento: fecha, precision_vencimiento: 'DIA',
                cantidad_fisica: cantidad, costo_unitario_promedio: costo });
            await db.MovimientoInventario.create({ id_usuario: usuarios.REGENTE.id_usuario,
                id_existencia: e.id_existencia, direccion: 'ENTRADA', motivo: 'AJUSTE', cantidad,
                costo_unitario_aplicado: costo,
                fecha_movimiento: db.Sequelize.fn('STR_TO_DATE', '2026-10-01 10:00:00', '%Y-%m-%d %H:%i:%s') });
            return e;
        };
        // La primera existencia creada no es la primera FEFO.
        const lejana = await crearExistencia(libre, 'ACL-001', '2027-01-01', 2, '1.111111');
        const cercana = await crearExistencia(libre, 'ACL-002', '2026-11-01', 3, '2.222222');
        const eMedico = await crearExistencia(medico, 'ACR-001', '2027-01-01', 5, '3.000000');
        const eDesconocido = await crearExistencia(desconocido, 'ACD-001', '2027-01-01', 1, '1.000000');
        const inventario = () => db.ExistenciaMedicamento.findAll({ raw: true, order: [['id_existencia', 'ASC']] });
        const inventarioInicial = await inventario();
        const cookies = new Map();
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const base = `http://127.0.0.1:${server.address().port}/api`;
        const request = async (method, path, rol, body, status = 200) => {
            const response = await fetch(`${base}${path}`, { method,
                headers: { 'Content-Type': 'application/json', ...(cookies.has(rol) ? { Cookie: cookies.get(rol) } : {}) },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
            const result = await response.json();
            assert.equal(response.status, status, JSON.stringify(result));
            assert.doesNotMatch(JSON.stringify(result), /password|password_hash|ARCHIVO_INTERNO_ACEPTACION|archivo_receta|archivoReceta/);
            return result;
        };
        const linea = (med, e, cantidad = 1) => ({ idMedicamento: med.id_medicamento,
            idExistencia: e.id_existencia, cantidad, precioUnitario: '0.10' });
        const preparar = async (claveOperacion, detalles) =>
            (await request('POST', '/ventas', 'VENDEDOR', { claveOperacion, detalles }, 201)).data;
        let ventaLibre, ventaMedica, recetaFormulario;

        await t.test('Login de los tres roles produce cookie HttpOnly; la sesión real permite consultar ventas', async () => {
            for (const rol of Object.keys(ROLES)) {
                const response = await fetch(`${base}/auth/login`, { method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombreUsuario: usuarios[rol].nombre_usuario, password }), signal: AbortSignal.timeout(15000) });
                assert.equal(response.status, 200);
                const cookie = response.headers.get('set-cookie');
                assert.ok(cookie?.includes('HttpOnly')); assert.ok(cookie?.includes('SameSite=Lax'));
                cookies.set(rol, cookie.split(';')[0]);
                const body = await response.json();
                assert.equal(body.data.idRol, ROLES[rol]);
                assert.equal(Object.hasOwn(body, 'token'), false);
                assert.equal(Object.hasOwn(body.data, 'passwordHash'), false);
                const sesion = await request('GET', '/auth/me', rol);
                assert.equal(sesion.data.idUsuario, usuarios[rol].id_usuario);
                assert.deepEqual((await request('GET', '/ventas', rol)).data, []);
            }
            await request('GET', '/ventas', null, undefined, 401);
        });
        await t.test('Guardar y consultar pendiente no reserva stock; duplicados y permisos se rechazan', async () => {
            ventaLibre = await preparar('aceptacion-libre', [linea(libre, lejana, 4)]);
            assert.equal(ventaLibre.estadoOperacion, 'PENDIENTE'); assert.equal(ventaLibre.fechaVenta, null);
            assert.equal(ventaLibre.total, '0.40'); assert.deepEqual(await inventario(), inventarioInicial);
            for (const rol of Object.keys(ROLES)) {
                const lista = await request('GET', `/ventas?estadoOperacion=PENDIENTE&idUsuario=${usuarios.VENDEDOR.id_usuario}`, rol);
                assert.deepEqual(lista.data.map(v => v.idVenta), [ventaLibre.idVenta]);
                assert.equal((await request('GET', `/ventas/${ventaLibre.idVenta}`, rol)).data.fechaRegistro, ventaLibre.fechaRegistro);
            }
            await request('POST', '/ventas', 'VENDEDOR', { claveOperacion: 'ACEPTACION-LIBRE', detalles: [linea(libre, lejana)] }, 409);
            for (const rol of ['ADMINISTRADOR', 'REGENTE']) {
                await request('POST', '/ventas', rol, { claveOperacion: 'rol-invalido', detalles: [linea(libre, lejana)] }, 403);
                await request('POST', `/ventas/${ventaLibre.idVenta}/confirmar`, rol, {}, 403);
            }
        });
        await t.test('Confirmación real aplica FEFO y anulación devuelve unidades sin destruir historial', async () => {
            const confirmada = (await request('POST', `/ventas/${ventaLibre.idVenta}/confirmar`, 'VENDEDOR', {})).data;
            assert.equal(confirmada.estadoOperacion, 'CONFIRMADA'); assert.equal(confirmada.total, '0.40');
            assert.equal(confirmada.fechaRegistro, ventaLibre.fechaRegistro);
            assert.deepEqual(confirmada.detalles.map(d => [d.idExistencia, d.cantidad]), [[cercana.id_existencia, 3], [lejana.id_existencia, 1]]);
            assert.equal(confirmada.detalles[0].idDetalleVenta, ventaLibre.detalles[0].idDetalleVenta);
            await request('POST', `/ventas/${ventaLibre.idVenta}/confirmar`, 'VENDEDOR', {}, 409);
            await request('POST', `/ventas/${ventaLibre.idVenta}/anular`, 'VENDEDOR', { motivo: 'No autorizado' }, 403);
            const anulada = (await request('POST', `/ventas/${ventaLibre.idVenta}/anular`, 'ADMINISTRADOR', { motivo: 'Corrección sintética' })).data;
            assert.equal(anulada.estadoOperacion, 'ANULADA'); assert.equal(anulada.fechaVenta, confirmada.fechaVenta);
            assert.deepEqual(anulada.detalles, confirmada.detalles);
            assert.deepEqual(await inventario(), inventarioInicial);
            await request('POST', `/ventas/${ventaLibre.idVenta}/anular`, 'ADMINISTRADOR', { motivo: 'Repetida' }, 409);
        });
        await t.test('CU31 registra formulario sin archivos y vincula detalles, sin aprobar ni descontar stock', async () => {
            ventaMedica = await preparar('aceptacion-medica', [linea(medico, eMedico), linea(libre, lejana)]);
            await request('POST', `/ventas/${ventaMedica.idVenta}/confirmar`, 'VENDEDOR', {}, 409);
            const datos = { fechaReceta: '2026-10-31', nombrePaciente: 'PII_ACEPTACION_PACIENTE',
                documentoPaciente: 'PII_ACEPTACION_DOCUMENTO', nombreMedico: 'PII_ACEPTACION_MEDICO', modalidad: 'Presentada',
                idsDetallesVenta: [ventaMedica.detalles[0].idDetalleVenta] };
            recetaFormulario = (await request('POST', `/ventas/${ventaMedica.idVenta}/recetas`, 'REGENTE', datos, 201)).data;
            assert.equal(recetaFormulario.resultadoRevision, null); assert.equal(recetaFormulario.fechaValidacion, null);
            assert.equal((await db.Receta.findByPk(recetaFormulario.idReceta)).archivo_receta, null);
            await request('POST', `/ventas/${ventaMedica.idVenta}/recetas`, 'VENDEDOR',
                { ...datos, archivoReceta: 'https://example.test/receta.pdf' }, 400);
            assert.equal(await db.Receta.count(), 1);
            await request('POST', `/ventas/${ventaMedica.idVenta}/confirmar`, 'VENDEDOR', {}, 409);
            assert.deepEqual(await inventario(), inventarioInicial);
        });
        await t.test('CU32 y CU28: consulta autorizada, aprobación física registrada y venta con receta, todo por HTTP', async () => {
            const ruta = `/ventas/${ventaMedica.idVenta}/recetas/${recetaFormulario.idReceta}`;
            for (const rol of ['ADMINISTRADOR', 'VENDEDOR']) {
                await request('GET', ruta, rol, undefined, 403);
                assert.doesNotMatch(JSON.stringify(await request('GET', `/ventas/${ventaMedica.idVenta}`, rol)), /PII_ACEPTACION/);
            }
            assert.equal((await request('GET', ruta, 'REGENTE')).data.nombrePaciente, 'PII_ACEPTACION_PACIENTE');
            await request('GET', `/ventas/${ventaLibre.idVenta}/recetas/${recetaFormulario.idReceta}`, 'REGENTE', undefined, 404);
            const aprobada = (await request('POST', `${ruta}/revisar`, 'REGENTE', {
                resultadoRevision: 'APROBADA', observacion: 'PII_ACEPTACION_OBSERVACION' })).data;
            assert.equal(aprobada.resultadoRevision, 'APROBADA'); assert.equal(aprobada.idUsuarioValidador, usuarios.REGENTE.id_usuario);
            assert.ok(aprobada.fechaValidacion);
            assert.deepEqual(await inventario(), inventarioInicial);
            await request('POST', `${ruta}/revisar`, 'REGENTE', { resultadoRevision: 'RECHAZADA' }, 409);
            const confirmada = (await request('POST', `/ventas/${ventaMedica.idVenta}/confirmar`, 'VENDEDOR', {})).data;
            assert.equal(confirmada.estadoOperacion, 'CONFIRMADA');
            assert.equal(confirmada.detalles[0].idReceta, recetaFormulario.idReceta);
            assert.equal(confirmada.detalles[1].idReceta, null); // LIBRE no exige receta en una venta mixta.
            const anulada = (await request('POST', `/ventas/${ventaMedica.idVenta}/anular`, 'ADMINISTRADOR', { motivo: 'Corrección de venta con receta' })).data;
            assert.equal(anulada.fechaVenta, confirmada.fechaVenta);
            assert.deepEqual(await inventario(), inventarioInicial);
        });
        await t.test('Receta rechazada por Regente no autoriza venta; Vendedor no puede aprobarla', async () => {
            const venta = await preparar('aceptacion-rechazada', [linea(medico, eMedico)]);
            const receta = (await request('POST', `/ventas/${venta.idVenta}/recetas`, 'VENDEDOR', {
                fechaReceta: '2026-10-31', nombrePaciente: 'PII_ACEPTACION_PACIENTE', documentoPaciente: 'PII_ACEPTACION_DOCUMENTO',
                nombreMedico: 'PII_ACEPTACION_MEDICO', modalidad: 'Presentada', idsDetallesVenta: venta.detalles.map(d => d.idDetalleVenta)
            }, 201)).data;
            const ruta = `/ventas/${venta.idVenta}/recetas/${receta.idReceta}/revisar`;
            await request('POST', ruta, 'VENDEDOR', { resultadoRevision: 'APROBADA' }, 403);
            await request('POST', ruta, 'REGENTE', { resultadoRevision: 'RECHAZADA' });
            await request('POST', `/ventas/${venta.idVenta}/confirmar`, 'VENDEDOR', {}, 409);
            const anulada = (await request('POST', `/ventas/${venta.idVenta}/anular`, 'ADMINISTRADOR', { motivo: 'Receta rechazada' })).data;
            assert.equal(anulada.fechaVenta, null); assert.deepEqual(await inventario(), inventarioInicial);
        });
        await t.test('Condición desconocida no se normaliza ni confirma, y permite cerrar la pendiente', async () => {
            const venta = await preparar('aceptacion-desconocida', [linea(desconocido, eDesconocido)]);
            await request('POST', `/ventas/${venta.idVenta}/confirmar`, 'VENDEDOR', {}, 409);
            assert.equal((await db.Medicamento.findByPk(desconocido.id_medicamento)).condicion_venta, 'Libre');
            await request('POST', `/ventas/${venta.idVenta}/anular`, 'ADMINISTRADOR', { motivo: 'Condición pendiente de corrección' });
            assert.equal((await request('GET', '/ventas?estadoOperacion=ANULADA', 'ADMINISTRADOR')).paginacion.total, 4);
            assert.deepEqual((await request('GET', '/ventas?estadoOperacion=CONFIRMADA', 'VENDEDOR')).data, []);
        });
        await t.test('Conciliación final SQL: saldos físicos, trazabilidad, reversiones únicas y auditoría sin datos personales', async () => {
            const select = sql => db.sequelize.query(sql, { type: db.Sequelize.QueryTypes.SELECT });
            assert.deepEqual(await select(`SELECT e.id_existencia FROM existencia_medicamento e
                LEFT JOIN movimiento_inventario m ON m.id_existencia = e.id_existencia
                GROUP BY e.id_existencia, e.cantidad_fisica
                HAVING e.cantidad_fisica < 0 OR e.cantidad_fisica <>
                    COALESCE(SUM(CASE WHEN m.direccion = 'ENTRADA' THEN m.cantidad ELSE -m.cantidad END), 0)`), []);
            assert.deepEqual(await select(`SELECT r.id_movimiento FROM movimiento_inventario r
                LEFT JOIN movimiento_inventario o ON o.id_movimiento = r.id_movimiento_original
                WHERE r.id_movimiento_original IS NOT NULL AND (o.id_movimiento IS NULL
                    OR r.id_existencia <> o.id_existencia OR r.cantidad <> o.cantidad
                    OR r.costo_unitario_aplicado <> o.costo_unitario_aplicado OR r.direccion = o.direccion
                    OR NOT (r.id_detalle_venta <=> o.id_detalle_venta) OR r.id_detalle_compra IS NOT NULL)`), []);
            assert.deepEqual(await select(`SELECT id_movimiento_original FROM movimiento_inventario
                WHERE id_movimiento_original IS NOT NULL GROUP BY id_movimiento_original HAVING COUNT(*) > 1`), []);
            assert.deepEqual(await inventario(), inventarioInicial);
            const eventos = await db.BitacoraAuditoria.findAll({ raw: true });
            assert.doesNotMatch(JSON.stringify(eventos), /PII_ACEPTACION|ARCHIVO_INTERNO_ACEPTACION|Sintetica-Ventas|password_hash/);
            for (const [tipo, cantidad] of [['LOGIN_EXITO', 3], ['VENTA_REGISTRAR_PENDIENTE', 4], ['VENTA_CONFIRMAR', 2],
                ['VENTA_ANULAR', 4], ['RECETA_REGISTRAR', 2], ['RECETA_REVISAR', 2]]) {
                assert.equal(eventos.filter(e => e.tipo_evento === tipo && e.resultado === 'EXITO').length, cantidad);
            }
            assert.equal(eventos.some(e => e.causa === 'ALMACENAMIENTO_NO_CONFIGURADO'), false);
            assert.equal(await db.Venta.count(), 4); assert.equal(await db.Receta.count(), 2);
            assert.equal((await db.Receta.findByPk(recetaFormulario.idReceta)).resultado_revision, 'APROBADA');
        });
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (db) await db.sequelize.close();
        if (creada) await runCli('db:drop');
    }
});
