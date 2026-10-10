import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { crearTransporteRecuperacion } from '../src/shared/utils/recuperacion-mail.js';
import { RECOVERY_SECURITY, RECOVERY_MAIL_RESULT as RESULT } from '../src/shared/constants/recuperacion-password.js';
import { AppError } from '../src/shared/errors/app-error.js';

Object.assign(process.env, {
    NODE_ENV: 'test', RECOVERY_ENABLED: 'true', MAIL_PROVIDER: 'mock', MAIL_FROM: 'farmacia@example.test',
    MAIL_FROM_NAME: 'CADEFAR', RECOVERY_CLIENT_IP_SOURCE: 'socket', RECOVERY_HMAC_SECRET: randomBytes(32).toString('hex'),
    BREVO_API_KEY: 'clave_sintetica_sin_validez'
});
const payload = { to: 'persona.nombre+prueba@example.test', subject: 'CADEFAR', text: 'Código sintético 000123. Unicode á🔐.' };
const fail = operation => assert.rejects(async () => operation(), error => error instanceof AppError && error.statusCode === 503 && !error.details);

test('Mock no usa red/logs y solo permite observación por referencia privada de prueba', async t => {
    let network = 0, logs = 0, observed;
    t.mock.method(globalThis, 'fetch', () => { network++; throw new Error('Sin red'); });
    for (const method of ['info', 'log', 'warn', 'error', 'debug']) t.mock.method(console, method, () => { logs++; });
    const transport = crearTransporteRecuperacion({ resolverMock: message => { observed = message; return { estado: RESULT.ACCEPTED }; } });
    assert.deepEqual(await transport.enviar(payload), { estado: RESULT.ACCEPTED });
    assert.equal(Object.isFrozen(observed), true);
    assert.equal(observed.text === payload.text && observed.to === payload.to, true);
    assert.equal(observed.from === process.env.MAIL_FROM, true);
    assert.equal(network, 0); assert.equal(logs, 0);
    assert.deepEqual(Object.keys(transport), ['enviar']);
});

test('Resultados/excepciones se sanitizan y cada llamada realiza un solo intento', async () => {
    for (const estado of Object.values(RESULT)) {
        let calls = 0;
        const transport = crearTransporteRecuperacion({ resolverMock: () => { calls++; return { estado, payload, codigo: '000123' }; } });
        assert.deepEqual(await transport.enviar(payload), { estado }); assert.equal(calls, 1);
    }
    for (const resolverMock of [() => { throw new Error(payload.text); }, async () => { throw new Error(payload.text); }, () => ({ estado: 'desconocido' })]) {
        assert.deepEqual(await crearTransporteRecuperacion({ resolverMock }).enviar(payload), { estado: RESULT.AMBIGUOUS });
    }
});

test('Brevo usa HTTPS fetch, remitente configurado, contenido íntegro y aceptación confirmada', async t => {
    process.env.MAIL_PROVIDER = 'brevo';
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls++;
        assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
        assert.equal(options.method, 'POST');
        assert.equal(options.headers['api-key'] === process.env.BREVO_API_KEY, true);
        const body = JSON.parse(options.body);
        assert.equal(body.textContent === payload.text && body.to[0].email === payload.to, true);
        assert.equal(body.sender.email === process.env.MAIL_FROM, true);
        assert.equal(options.signal instanceof AbortSignal, true);
        return new Response(JSON.stringify({ messageId: '<sintetico@example.test>' }), { status: 201 });
    });
    try { assert.deepEqual(await crearTransporteRecuperacion().enviar(payload), { estado: RESULT.ACCEPTED }); assert.equal(calls, 1); }
    finally { process.env.MAIL_PROVIDER = 'mock'; }
});

test('Brevo distingue rechazo explícito de timeout/5xx/respuesta incierta sin devolver cuerpo del proveedor', async t => {
    process.env.MAIL_PROVIDER = 'brevo';
    const transport = crearTransporteRecuperacion();
    try {
        for (const [status, expected] of [[400, RESULT.REJECTED], [401, RESULT.REJECTED], [422, RESULT.REJECTED], [429, RESULT.REJECTED], [408, RESULT.AMBIGUOUS], [500, RESULT.AMBIGUOUS], [503, RESULT.AMBIGUOUS], [302, RESULT.AMBIGUOUS], [201, RESULT.AMBIGUOUS]]) {
            t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: payload.text }), { status }));
            assert.deepEqual(await transport.enviar(payload), { estado: expected });
            t.mock.restoreAll();
        }
        t.mock.method(globalThis, 'fetch', async () => { throw new Error(payload.text); });
        assert.deepEqual(await transport.enviar(payload), { estado: RESULT.AMBIGUOUS });
    } finally { process.env.MAIL_PROVIDER = 'mock'; }
});

test('Deadline de 5 segundos termina la espera y maneja aceptación/rechazo tardíos sin reenvío', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let signal, late, calls = 0;
    const transport = crearTransporteRecuperacion({ resolverMock: (message, options) => {
        calls++; signal = options.signal; return new Promise(resolve => { late = resolve; });
    } });
    const pending = transport.enviar(payload);
    await Promise.resolve(); await Promise.resolve();
    t.mock.timers.tick(RECOVERY_SECURITY.MAIL_TIMEOUT_MS);
    const result = await pending;
    assert.deepEqual(result, { estado: RESULT.AMBIGUOUS }); assert.equal(signal.aborted, true);
    late({ estado: RESULT.ACCEPTED }); await Promise.resolve();
    assert.deepEqual(result, { estado: RESULT.AMBIGUOUS }); assert.equal(calls, 1);
});

test('Cancelación antes/durante envío distingue rechazo previo de resultado ambiguo', async () => {
    const first = new AbortController(); first.abort();
    let calls = 0;
    const transport = crearTransporteRecuperacion({ resolverMock: (message, { signal }) => {
        calls++; return new Promise(resolve => signal.addEventListener('abort', () => resolve({ estado: RESULT.REJECTED }), { once: true }));
    } });
    assert.deepEqual(await transport.enviar(payload, { signal: first.signal }), { estado: RESULT.REJECTED }); assert.equal(calls, 0);
    const second = new AbortController(), pending = transport.enviar(payload, { signal: second.signal });
    await Promise.resolve(); second.abort(new Error(payload.text));
    assert.deepEqual(await pending, { estado: RESULT.AMBIGUOUS }); assert.equal(calls, 1);
});

test('Configuración inválida/proveedor cambiado/producción mock impiden envío; no hay fallback', async () => {
    const transport = crearTransporteRecuperacion(), key = process.env.RECOVERY_HMAC_SECRET;
    try {
        delete process.env.RECOVERY_HMAC_SECRET;
        await fail(() => crearTransporteRecuperacion()); await fail(() => transport.enviar(payload));
        process.env.RECOVERY_HMAC_SECRET = key; process.env.NODE_ENV = 'production';
        await fail(() => crearTransporteRecuperacion());
        process.env.NODE_ENV = 'test'; process.env.MAIL_PROVIDER = 'brevo';
        await fail(() => transport.enviar(payload));
        await fail(() => crearTransporteRecuperacion({ resolverMock: () => ({ estado: RESULT.ACCEPTED }) }));
    } finally { process.env.RECOVERY_HMAC_SECRET = key; process.env.NODE_ENV = 'test'; process.env.MAIL_PROVIDER = 'mock'; }
});

test('Payload estricto y snapshot evitan campos privados adicionales y modificaciones durante envío', async () => {
    let observed;
    const transport = crearTransporteRecuperacion({ resolverMock: message => { observed = message; return { estado: RESULT.ACCEPTED }; } });
    const mutable = { ...payload }, pending = transport.enviar(mutable); mutable.text = 'alterado'; await pending;
    assert.equal(observed.text === payload.text, true);
    for (const invalid of [{ ...payload, password: 'prohibida' }, { ...payload, to: 'invalido' }, null]) {
        await assert.rejects(transport.enviar(invalid), error => error instanceof AppError && error.statusCode === 500 && !error.details);
    }
});
