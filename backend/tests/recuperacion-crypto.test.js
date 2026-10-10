import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
    generarCodigoRecuperacion, generarNonceRecuperacion, calcularCodigoHmac,
    verificarCodigoHmac, calcularClaveIpHmac, normalizarIpRecuperacion
} from '../src/shared/utils/recuperacion-crypto.js';
import { AppError } from '../src/shared/errors/app-error.js';

Object.assign(process.env, {
    NODE_ENV: 'test', RECOVERY_ENABLED: 'true', MAIL_PROVIDER: 'mock', MAIL_FROM: 'farmacia@example.test',
    MAIL_FROM_NAME: 'CADEFAR', RECOVERY_CLIENT_IP_SOURCE: 'socket',
    RECOVERY_HMAC_SECRET: randomBytes(32).toString('hex')
});
const context = { idUsuario: 7, correo: 'persona.nombre+prueba@example.test', nonce: generarNonceRecuperacion(), expiraEn: new Date('2026-10-09T12:10:00.123Z') };
const codigo = '000123';

test('Códigos de seis dígitos y nonce UUID independientes, con ceros iniciales en verificación', () => {
    for (let i = 0; i < 100; i++) {
        assert.equal(/^\d{6}$/.test(generarCodigoRecuperacion()), true);
        assert.equal(/^[a-f0-9-]{36}$/.test(generarNonceRecuperacion()), true);
    }
    const codigoHmac = calcularCodigoHmac({ ...context, codigo });
    assert.equal(/^[a-f0-9]{64}$/.test(codigoHmac), true);
    assert.equal(verificarCodigoHmac({ ...context, codigo, codigoHmac }), true);
    assert.equal(verificarCodigoHmac({ ...context, codigo: '000124', codigoHmac }), false);
});

test('HMAC vincula cuenta, correo normalizado, nonce, vencimiento preciso y código', () => {
    const codigoHmac = calcularCodigoHmac({ ...context, codigo });
    for (const changes of [{ idUsuario: 8 }, { correo: 'otra@example.test' }, { nonce: generarNonceRecuperacion() }, { expiraEn: new Date(context.expiraEn.getTime() + 1) }]) {
        assert.equal(verificarCodigoHmac({ ...context, ...changes, codigo, codigoHmac }), false);
    }
    const key = process.env.RECOVERY_HMAC_SECRET;
    try {
        process.env.RECOVERY_HMAC_SECRET = randomBytes(32).toString('hex');
        assert.equal(verificarCodigoHmac({ ...context, codigo, codigoHmac }), false);
    } finally { process.env.RECOVERY_HMAC_SECRET = key; }
});

test('Código/hash malformados fallan sin coerción ni errores de longitud', () => {
    const codigoHmac = calcularCodigoHmac({ ...context, codigo });
    for (const invalid of [undefined, null, 123, '123', ' 000123', '000123 ', '１２３４５６']) assert.equal(verificarCodigoHmac({ ...context, codigo: invalid, codigoHmac }), false);
    for (const invalid of [undefined, null, '', 'a'.repeat(63), 'a'.repeat(65), 'z'.repeat(64)]) assert.equal(verificarCodigoHmac({ ...context, codigo, codigoHmac: invalid }), false);
});

test('Cuotas unifican IPv4 mapped y agrupan IPv6 por /56, incluyendo formatos equivalentes', () => {
    assert.equal(normalizarIpRecuperacion('192.0.2.1'), normalizarIpRecuperacion('::ffff:192.0.2.1'));
    assert.equal(normalizarIpRecuperacion('192.0.2.1'), normalizarIpRecuperacion('0:0:0:0:0:ffff:c000:201'));
    assert.equal(normalizarIpRecuperacion('2001:db8:abcd:1200::1'), normalizarIpRecuperacion('2001:0db8:abcd:12ff:ffff:ffff:ffff:ffff'));
    assert.notEqual(normalizarIpRecuperacion('2001:db8:abcd:1200::1'), normalizarIpRecuperacion('2001:db8:abcd:1300::1'));
    for (const ip of [null, '', 'no_ip', '192.0.2.1, 10.0.0.1']) assert.throws(() => normalizarIpRecuperacion(ip), error => error instanceof AppError && error.statusCode === 503);
});

test('Claves IP HMAC separan propósito, ámbito e IP sin contener la dirección', () => {
    const first = calcularClaveIpHmac({ ambito: 'solicitud', ipNormalizada: '192.0.2.1' });
    assert.equal(/^[a-f0-9]{64}$/.test(first), true);
    assert.equal(first.includes('192.0.2.1'), false);
    assert.notEqual(first, calcularClaveIpHmac({ ambito: 'restablecimiento', ipNormalizada: '192.0.2.1' }));
    assert.notEqual(first, calcularClaveIpHmac({ ambito: 'solicitud', ipNormalizada: '192.0.2.2' }));
    assert.notEqual(first, calcularCodigoHmac({ ...context, codigo }));
});

test('Configuración inválida bloquea operaciones con 503 sin afectar JWT', () => {
    const key = process.env.RECOVERY_HMAC_SECRET;
    delete process.env.RECOVERY_HMAC_SECRET;
    try {
        for (const operation of [generarCodigoRecuperacion, generarNonceRecuperacion, () => calcularCodigoHmac({ ...context, codigo }), () => verificarCodigoHmac({ ...context, codigo }), () => calcularClaveIpHmac({ ambito: 'solicitud', ipNormalizada: '192.0.2.1' })]) {
            assert.throws(operation, error => error instanceof AppError && error.statusCode === 503 && !error.details);
        }
    } finally { process.env.RECOVERY_HMAC_SECRET = key; }
});
