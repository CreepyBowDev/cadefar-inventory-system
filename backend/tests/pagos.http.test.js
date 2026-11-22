import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test'; process.env.DB_NAME_TEST = 'pagos_http_sin_conexion';
process.env.JWT_SECRET = 'fixture_sintetico_exclusivo_para_http_pagos';
process.env.FRONTEND_URL = 'https://cadefar.example.test';
const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const { usuarioRepository } = await import('../src/data/repositories/usuario.repository.js');
const { pagoCompraService } = await import('../src/business/services/pago-compra.service.js');
const { compraComprobanteService } = await import('../src/business/services/compra-comprobante.service.js');
const { simularAuditoriaTransversal } = await import('./helpers/auditoria-transversal.js');

test('Pagos HTTP: sesión, rol Administrador, CSRF, validación estricta y ausencia de secretos', async t => {
    simularAuditoriaTransversal(t); t.mock.method(console, 'error', () => {});
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('No se autoriza MySQL'); });
    t.mock.method(usuarioRepository, 'findByIdForSession', async ({ idUsuario }) => ({ id_usuario: idUsuario,
        id_rol: idUsuario, nombre_usuario: `usuario${idUsuario}`, estado: true, version_credenciales: 0 }));
    let llamadas = [];
    t.mock.method(compraComprobanteService, 'consultar', async () => ({ titulo: 'Comprobante de compra', numero: 'COMPRA-1', esPrueba: true, datos: [['Compra', '#1']], columnas: [], filas: [], totales: [['Saldo pendiente', '100,00 BOB']], notas: ['Prueba local'] }));
    for (const metodo of ['consultar', 'iniciar', 'verificar']) t.mock.method(pagoCompraService, metodo, async (...args) => {
        llamadas.push({ metodo, args }); return { estado: 'PENDIENTE' };
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/compras`;
    const request = async (path, method = 'GET', body, rol = 1, origen = process.env.FRONTEND_URL) => {
        const token = rol ? generarToken({ idUsuario: rol, idRol: rol, versionCredenciales: 0 }) : null;
        const response = await fetch(`${base}${path}`, { method, headers: {
            ...(token ? { Cookie: `token=${token}` } : {}), ...(origen ? { Origin: origen } : {}),
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        const json = await response.json();
        assert.doesNotMatch(JSON.stringify(json), /password_hash|clientSecret|secretKey/);
        return { status: response.status, data: json, headers: response.headers };
    };
    const body = { claveOperacion: 'pago-operacion-http-001', metodo: 'TARJETA', importe: '1.00', autorizarPago: true };
    try {
        await t.test('Comprobantes JSON/PDF protegidos, IDs y consultas estrictos, PDF real no cacheable', async () => {
            for (const path of ['/1/comprobante', '/1/comprobante.pdf', '/1/pagos/2/comprobante', '/1/pagos/2/comprobante.pdf']) {
                for (const rol of [null, 2, 3]) assert.equal((await request(path, 'GET', undefined, rol)).status, rol ? 403 : 401);
                assert.equal((await request(`${path}?extra=1`)).status, 400);
                assert.equal((await request(path.replace('/1/', '/01/'))).status, 400);
            }
            assert.equal((await request('/1/comprobante')).status, 200);
            const response = await fetch(`${base}/1/comprobante.pdf`, { headers: { Cookie: `token=${generarToken({ idUsuario: 1, idRol: 1, versionCredenciales: 0 })}` } });
            assert.equal(response.status, 200);
            assert.equal(response.headers.get('content-type'), 'application/pdf');
            assert.equal(response.headers.get('cache-control'), 'no-store');
            assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
            assert.match(response.headers.get('content-disposition'), /CADEFAR-COMPRA-1.pdf/);
            assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
        });
        for (const [path, method, payload] of [['/1/pagos', 'GET'], ['/1/pagos', 'POST', body],
            ['/1/pagos/2/verificar', 'POST', {}], ['/1/pagos/2/confirmar', 'POST', { autorizarPago: true }],
            ['/1/pagos/2/conciliar', 'POST', { idExterno: 'cs_live_recuperada' }]]) {
            for (const rol of [null, 2, 3]) {
                const result = await request(path, method, payload, rol);
                assert.equal(result.status, rol ? 403 : 401);
            }
        }
        assert.equal(llamadas.length, 0);
        assert.equal((await request('/1/pagos/2/autorizar-prueba', 'POST', { decision: 'APROBAR' })).status, 404,
            'La autorización ficticia no está disponible fuera del modo local');
        assert.equal(llamadas.length, 0);
        for (const origen of ['', 'https://ajeno.example.test']) assert.equal((await request('/1/pagos', 'POST', body, 1, origen)).status, 403);
        for (const invalido of [{ ...body, importe: '1e2' }, { ...body, importe: '1.001' }, { ...body, estado: 'CONFIRMADO' },
            { ...body, numeroTarjeta: 'no-permitido' }, { ...body, autorizarPago: false }]) {
            assert.equal((await request('/1/pagos', 'POST', invalido)).status, 400);
        }
        assert.equal(llamadas.length, 0);
        assert.equal((await request('/01/pagos')).status, 400);
        assert.equal((await request('/1/pagos?estado=CONFIRMADO')).status, 400);
        assert.equal((await request('/1/pagos/2/confirmar', 'POST', {})).status, 400);
        const result = await request('/1/pagos'); assert.equal(result.status, 200); assert.equal(result.headers.get('cache-control'), 'no-store');
        assert.equal((await request('/1/pagos', 'POST', body)).status, 200);
        assert.equal(llamadas.at(-1).args[2], 1, 'El responsable proviene de la sesión');
        assert.equal((await request('/1/pagos/2/verificar', 'POST', {})).status, 200);
        assert.equal(llamadas.at(-1).args[2], false, 'Verificar no autoriza una captura');
        assert.equal((await request('/1/pagos/2/confirmar', 'POST', { autorizarPago: true })).status, 200);
        assert.equal(llamadas.at(-1).args[2], true);
        assert.equal((await request('/1/pagos/2/conciliar', 'POST', { idExterno: 'https://ajeno.test' })).status, 400);
        assert.equal((await request('/1/pagos/2/conciliar', 'POST', { idExterno: 'cs_live_recuperada' })).status, 200);
        assert.equal(llamadas.at(-1).args[2], false);
        assert.equal(llamadas.at(-1).args[4], 'cs_live_recuperada');
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
