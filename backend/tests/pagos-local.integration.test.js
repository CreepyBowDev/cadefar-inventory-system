import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { huellaBase } from './helpers/huella-pagos.js';

test('Pagos locales: Express/MySQL reales, aislamiento, roles, auditoría y escenarios financieros', {
    skip: process.env.CADEFAR_AUTORIZAR_PAGOS_LOCAL !== '1', timeout: 120000
}, async t => {
    dotenv.config({ quiet: true });
    const { default: entorno } = await import('../src/shared/utils/pagos-entorno.cjs');
    assert.equal(entorno.esPruebaLocal(), true);
    const { default: db } = await import('../src/data/models/index.js');
    assert.equal(db.sequelize.config.database, entorno.BASE_PRUEBAS);
    const [baseActiva] = await db.sequelize.query('SELECT DATABASE() AS nombre');
    assert.equal(baseActiva[0].nombre, entorno.BASE_PRUEBAS);
    const protectedConnection = await mysql.createConnection({ host: process.env.DB_HOST,
        user: process.env.DB_USER, password: process.env.PASSWORD_DB });
    const baseline = await huellaBase(protectedConnection, 'cadefarexamen');
    const { app } = await import('../src/app.js');
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const fetchReal = globalThis.fetch;
    let externalCalls = 0;
    t.mock.method(globalThis, 'fetch', (url, options) => {
        if (!String(url).startsWith(`${base}/`)) { externalCalls++; throw new Error('Red externa prohibida'); }
        return fetchReal(url, options);
    });
    const request = async (path, method = 'GET', body, cookie, origin = 'http://localhost:5173') => {
        const response = await fetch(`${base}/api${path}`, { method, headers: {
            ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}),
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
    };
    const random = randomBytes(6).toString('hex');
    const credentials = [];
    try {
        const { generarToken } = await import('../src/shared/utils/jwt.js');
        for (const idRol of [1, 2, 3]) {
            // Sesiones del arnés, firmadas y verificadas normalmente. Solo se
            // consultan identidades existentes; jamás cuentas/contraseñas nuevas.
            const usuario = await db.Usuario.findOne({ where: { id_rol: idRol, estado: true,
                ...(idRol === 1 ? { nombre_usuario: 'admin_demo' } : {}) },
                attributes: ['id_usuario', 'id_rol', 'nombre_usuario', 'estado', 'version_credenciales'], logging: false });
            assert.ok(usuario, 'Se requiere una identidad existente para comprobar el rol');
            credentials.push(`token=${generarToken({ idUsuario: usuario.id_usuario, idRol: usuario.id_rol, versionCredenciales: usuario.version_credenciales })}`);
        }
        const [admin, regente, vendedor] = credentials;
        await t.test('Sesión existente, vista pública no actualizable y cero usuarios/roles copiados', async () => {
            const me = await request('/auth/me', 'GET', undefined, admin);
            assert.equal(me.status, 200); assert.equal(me.data.data.nombreUsuario, 'admin_demo');
            const [users] = await db.sequelize.query('SELECT COUNT(*) AS cantidad FROM usuario');
            const [roles] = await db.sequelize.query('SELECT COUNT(*) AS cantidad FROM rol');
            assert.equal(Number(users[0].cantidad), 0); assert.equal(Number(roles[0].cantidad), 0);
            const [views] = await db.sequelize.query("SELECT IS_UPDATABLE FROM information_schema.VIEWS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='usuario_sesion_local'");
            assert.equal(views[0].IS_UPDATABLE, 'NO');
            const [columns] = await db.sequelize.query('SHOW COLUMNS FROM usuario_sesion_local');
            assert.deepEqual(columns.map(c => c.Field), ['id_usuario', 'id_rol', 'nombre_usuario', 'estado', 'version_credenciales']);
            assert.equal((await request('/auth/login', 'POST', {}, undefined)).status, 400);
            const usuarios = await request('/usuarios', 'GET', undefined, admin);
            assert.equal(usuarios.status, 200);
            const publico = usuarios.data.data.find(u => u.nombreUsuario === 'admin_demo');
            assert.ok(publico); assert.equal(publico.rol.idRol, 1);
            assert.equal((await request(`/usuarios/${publico.idUsuario}`, 'GET', undefined, admin)).status, 200);
            assert.equal((await request('/usuarios', 'GET')).status, 401);
            assert.equal((await request('/usuarios', 'GET', undefined, regente)).status, 403);
            assert.ok(usuarios.data.data.every(u => !('password_hash' in u) && !('version_credenciales' in u)));
            for (const [path, method] of [['/auth/recuperacion/solicitar', 'POST'], ['/usuarios/1/password', 'PATCH'], ['/usuarios', 'POST']]) {
                assert.equal((await request(path, method, {}, admin)).status, 409);
            }
        });
        const { obtenerFechaOperacion } = await import('../src/shared/utils/fecha-operacion.js');
        const medicamento = await db.Medicamento.findOne({ where: { codigo_medicamento: 'PRU001' } });
        let sequence = 0;
        const compra = async () => {
            const r = await request('/compras', 'POST', { claveOperacion: `aceptacion-${random}-${++sequence}`,
                fechaCompra: obtenerFechaOperacion().fechaComercial, detalles: [{ idMedicamento: medicamento.id_medicamento,
                    cantidad: 10, costoUnitario: '50.000000', precisionVencimiento: 'DIA', fechaVencimiento: '2099-12-31' }] }, admin);
            assert.equal(r.status, 201); assert.equal(r.data.data.total, '500.00');
            return r.data.data.idCompra;
        };
        const resumen = async id => { const r = await request(`/compras/${id}/pagos`, 'GET', undefined, admin); assert.equal(r.status, 200); return r.data.data; };
        const iniciar = async (id, importe, metodo = 'TARJETA', key = `pago-${random}-${++sequence}`) => request(`/compras/${id}/pagos`, 'POST', { importe, metodo, claveOperacion: key, autorizarPago: true }, admin);
        const accion = (id, pago, name, body = {}) => request(`/compras/${id}/pagos/${pago}/${name}`, 'POST', body, admin);
        const pagar = async (id, importe, metodo = 'TARJETA') => {
            const r = await iniciar(id, importe, metodo); assert.equal(r.status, 200);
            const p = r.data.data; assert.equal(p.procesador, 'PRUEBA_LOCAL');
            assert.equal((await accion(id, p.idPago, 'autorizar-prueba', { decision: 'APROBAR' })).status, 200);
            const check = await accion(id, p.idPago, 'verificar');
            assert.equal(check.data.data.estado, metodo === 'TARJETA' ? 'CONFIRMADO' : 'PROCESANDO');
            if (metodo === 'PAYPAL') assert.equal((await accion(id, p.idPago, 'confirmar', { autorizarPago: true })).data.data.estado, 'CONFIRMADO');
            return p;
        };
        await t.test('Pago completo, comprobante y reintentos idempotentes', async () => {
            const id = await compra(); const p = await pagar(id, '500.00');
            const r = await resumen(id);
            assert.equal(r.totalPagado, '500.00'); assert.equal(r.saldoPendiente, '0.00'); assert.equal(r.estadoFinanciero, 'PAGADO');
            assert.match(r.pagos[0].referenciaExterna, /^PRUEBA_LOCAL_REF_/);
            await accion(id, p.idPago, 'verificar'); await accion(id, p.idPago, 'autorizar-prueba', { decision: 'APROBAR' });
            assert.equal((await resumen(id)).totalPagado, '500.00');
        });
        await t.test('BOB 500: abono tarjeta 200, saldo 300, abono PayPal 300 y saldo 0 sin tocar stock', async () => {
            const id = await compra();
            const stock = () => db.sequelize.query('SELECT id_existencia,cantidad_fisica,costo_unitario_promedio FROM existencia_medicamento ORDER BY id_existencia', { type: db.Sequelize.QueryTypes.SELECT });
            const before = await stock();
            await pagar(id, '200.00'); assert.equal((await resumen(id)).saldoPendiente, '300.00');
            await pagar(id, '300.00', 'PAYPAL');
            const r = await resumen(id); assert.equal(r.saldoPendiente, '0.00'); assert.equal(r.pagos.length, 2);
            assert.deepEqual(await stock(), before);
        });
        await t.test('Rechazo y cancelación liberan reserva sin sumar pagos', async () => {
            const id = await compra();
            for (const decision of ['RECHAZAR', 'CANCELAR']) {
                const r = await iniciar(id, '100.00', decision === 'CANCELAR' ? 'PAYPAL' : 'TARJETA');
                const a = await accion(id, r.data.data.idPago, 'autorizar-prueba', { decision });
                assert.equal(a.data.data.estado, 'RECHAZADO');
                if (decision === 'CANCELAR') assert.equal(a.data.data.resultadoProveedor, 'PRUEBA_LOCAL_CANCELADO');
                const state = await resumen(id); assert.equal(state.totalPagado, '0.00'); assert.equal(state.saldoDisponible, '500.00');
            }
        });
        await t.test('Pendiente persiste, conserva reserva y exige resolución antes de otro abono', async () => {
            const id = await compra(); const r = await iniciar(id, '200.00'); const p = r.data.data.idPago;
            await accion(id, p, 'autorizar-prueba', { decision: 'PENDIENTE' });
            assert.equal((await accion(id, p, 'verificar')).data.data.estado, 'PROCESANDO');
            assert.equal((await resumen(id)).importeReservado, '200.00');
            assert.equal((await iniciar(id, '300.00')).status, 409);
            await accion(id, p, 'autorizar-prueba', { decision: 'APROBAR' }); await accion(id, p, 'verificar');
            assert.equal((await resumen(id)).saldoPendiente, '300.00');
        });
        await t.test('Autorización no confirmada se puede cancelar; cancelación y confirmación no se duplican', async () => {
            for (const metodo of ['TARJETA', 'PAYPAL']) {
                const id = await compra(); const r = await iniciar(id, '200.00', metodo); const p = r.data.data.idPago;
                await accion(id, p, 'autorizar-prueba', { decision: 'APROBAR' });
                const cancelaciones = await Promise.all([1, 2].map(() => accion(id, p, 'autorizar-prueba', { decision: 'CANCELAR' })));
                assert.ok(cancelaciones.every(r => r.data.data.resultadoProveedor === 'PRUEBA_LOCAL_CANCELADO'));
                assert.equal((await accion(id, p, 'confirmar', { autorizarPago: true })).data.data.estado, 'RECHAZADO');
                const rFinal = await resumen(id);
                assert.equal(rFinal.totalPagado, '0.00'); assert.equal(rFinal.saldoDisponible, '500.00'); assert.equal(rFinal.pagos.length, 1);
            }
        });
        await t.test('Sobrepago, cero, negativos y resultados falsificados no generan pagos', async () => {
            const id = await compra();
            for (const value of ['0', '-1', '1.001']) assert.equal((await iniciar(id, value)).status, 400);
            assert.equal((await iniciar(id, '500.01')).status, 409);
            const forged = await request(`/compras/${id}/pagos`, 'POST', { claveOperacion: `falso-${random}-operacion`, metodo: 'TARJETA', importe: '10.00', autorizarPago: true, estado: 'CONFIRMADO' }, admin);
            assert.equal(forged.status, 400); assert.equal((await resumen(id)).pagos.length, 0);
        });
        await t.test('Doble envío y concurrencia no duplican ni exceden saldo', async () => {
            const id = await compra(); const key = `duplicado-${random}-operacion`;
            const responses = await Promise.all([iniciar(id, '200.00', 'TARJETA', key), iniciar(id, '200.00', 'TARJETA', key)]);
            assert.ok(responses.every(r => r.status === 200));
            assert.equal((await resumen(id)).pagos.length, 1);
            assert.equal((await iniciar(id, '201.00', 'TARJETA', key)).status, 409);
        });
        await t.test('Administrador obligatorio, CSRF, contratos estrictos y auditoría local', async () => {
            const id = await compra(); const r = await iniciar(id, '200.00'); const p = r.data.data.idPago;
            for (const cookie of [undefined, regente, vendedor]) {
                const expected = cookie ? 403 : 401;
                assert.equal((await request(`/compras/${id}/pagos`, 'GET', undefined, cookie)).status, expected);
                assert.equal((await request(`/compras/${id}/pagos/${p}/autorizar-prueba`, 'POST', { decision: 'APROBAR' }, cookie)).status, expected);
            }
            assert.equal((await request(`/compras/${id}/pagos/${p}/autorizar-prueba`, 'POST', { decision: 'APROBAR' }, admin, '')).status, 403);
            assert.equal((await accion(id, p, 'autorizar-prueba', { decision: 'APROBAR', numeroTarjeta: 'NO_ADMITIDO' })).status, 400);
            await accion(id, p, 'autorizar-prueba', { decision: 'APROBAR' }); await accion(id, p, 'verificar');
            const [events] = await db.sequelize.query("SELECT tipo_evento,despues FROM bitacora_auditoria WHERE tipo_registro='PAGO_COMPRA' AND id_registro=:id AND resultado='EXITO' ORDER BY id_evento", { replacements: { id: p } });
            assert.ok(events.some(e => e.tipo_evento === 'PAGO_COMPRA_AUTORIZAR_PRUEBA'));
            assert.ok(events.every(e => e.despues.procesador === 'PRUEBA_LOCAL'));
        });
        assert.equal(externalCalls, 0);
        assert.equal(await huellaBase(protectedConnection, 'cadefarexamen'), baseline);
        t.diagnostic('Cero peticiones externas. Huella de esquema/datos de cadefarexamen sin cambios.');
    } finally {
        await new Promise(resolve => server.close(resolve));
        await db.sequelize.close(); await protectedConnection.end();
    }
});
