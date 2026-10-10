import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { obtenerConfiguracionRecuperacion, exigirRecuperacionHabilitada } from '../src/shared/utils/recuperacion-config.js';
import { RECOVERY_SECURITY } from '../src/shared/constants/recuperacion-password.js';
import { AppError } from '../src/shared/errors/app-error.js';
import { generarToken, verificarToken } from '../src/shared/utils/jwt.js';

const env = {
    NODE_ENV: 'test', RECOVERY_ENABLED: 'true', MAIL_PROVIDER: 'mock',
    MAIL_FROM: '  CADEFAR+Prueba@EXAMPLE.TEST  ', MAIL_FROM_NAME: ' CADEFAR ',
    RECOVERY_CLIENT_IP_SOURCE: 'socket',
    JWT_SECRET: 'jwt_sintetico_independiente_para_pruebas',
    RECOVERY_HMAC_SECRET: randomBytes(32).toString('hex')
};
const withEnv = (values, operation) => {
    const before = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
    try {
        for (const [key, value] of Object.entries(values)) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
        return operation();
    } finally {
        for (const [key, value] of Object.entries(before)) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
    }
};

test('CU09 está deshabilitado por defecto y exige activación explícita', () => {
    for (const RECOVERY_ENABLED of [undefined, '', 'false', 'TRUE', '1']) {
        assert.deepEqual(obtenerConfiguracionRecuperacion({ ...env, RECOVERY_ENABLED }), { habilitada: false });
    }
    assert.deepEqual(obtenerConfiguracionRecuperacion({}), { habilitada: false });
});

test('Mock local/test válido sin Brevo; configuración normaliza remitente y conserva claves', () => {
    for (const NODE_ENV of ['development', 'test']) {
        const config = obtenerConfiguracionRecuperacion({ ...env, NODE_ENV });
        assert.equal(config.habilitada, true);
        assert.equal(config.mailProvider, 'mock');
        assert.equal(config.mailFrom, 'cadefar+prueba@example.test');
        assert.equal(config.mailFromName, 'CADEFAR');
        assert.equal(config.clientIpSource, 'socket');
        assert.equal(config.hmacSecret === env.RECOVERY_HMAC_SECRET, true);
        assert.equal(Object.hasOwn(config, 'brevoApiKey'), false);
    }
});

test('Producción prohíbe mock y proveedores, entornos o fuentes IP desconocidos', () => {
    for (const changes of [
        { NODE_ENV: 'production' }, { NODE_ENV: 'desconocido' },
        { MAIL_PROVIDER: undefined }, { MAIL_PROVIDER: 'smtp' },
        { RECOVERY_CLIENT_IP_SOURCE: undefined }, { RECOVERY_CLIENT_IP_SOURCE: 'x-forwarded-for' },
        { RECOVERY_CLIENT_IP_SOURCE: 'railway' }
    ]) assert.deepEqual(obtenerConfiguracionRecuperacion({ ...env, ...changes }), { habilitada: false });
});

test('Configuración Brevo exige clave explícita; no realiza llamadas de red', () => {
    for (const BREVO_API_KEY of [undefined, '', '   ', 'valor con espacios']) {
        assert.equal(obtenerConfiguracionRecuperacion({ ...env, MAIL_PROVIDER: 'brevo', BREVO_API_KEY }).habilitada, false);
    }
    const config = obtenerConfiguracionRecuperacion({ ...env, NODE_ENV: 'production', MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'clave_sintetica_no_real_brevo' });
    assert.equal(config.habilitada, true);
    assert.equal(config.mailProvider, 'brevo');
});

test('Remitente y nombre incompletos o con caracteres de control deshabilitan CU09', () => {
    for (const changes of [
        { MAIL_FROM: undefined }, { MAIL_FROM: '' }, { MAIL_FROM: 'correo-invalido' },
        { MAIL_FROM_NAME: undefined }, { MAIL_FROM_NAME: '' }, { MAIL_FROM_NAME: '  ' },
        { MAIL_FROM_NAME: 'CADEFAR\r\nOtro' }
    ]) assert.equal(obtenerConfiguracionRecuperacion({ ...env, ...changes }).habilitada, false);
});

test('HMAC exige mínimo 32 bytes de secreto explícito', () => {
    for (const RECOVERY_HMAC_SECRET of [undefined, '', ' '.repeat(40), 'x'.repeat(31)]) {
        assert.equal(obtenerConfiguracionRecuperacion({ ...env, RECOVERY_HMAC_SECRET }).habilitada, false);
    }
});

test('Secreto HMAC es independiente de JWT', () => {
    assert.equal(obtenerConfiguracionRecuperacion({ ...env, RECOVERY_HMAC_SECRET: env.JWT_SECRET }).habilitada, false);
});

test('Disponibilidad falla con 503 uniforme, sin secretos, detalles o generación de valores', () => {
    for (const changes of [{ RECOVERY_ENABLED: 'false' }, { RECOVERY_HMAC_SECRET: undefined }, { NODE_ENV: 'production' }]) {
        withEnv({ ...env, ...changes }, () => {
            let caught;
            try { exigirRecuperacionHabilitada(); } catch (error) { caught = error; }
            assert.equal(caught instanceof AppError, true);
            assert.equal(caught.statusCode, 503);
            assert.equal(caught.message, 'La recuperación de contraseña no está disponible');
            assert.equal(caught.details, undefined);
        });
    }
});

test('Configuración inválida de CU09 no impide emitir ni verificar JWT de autenticación', () => {
    withEnv({ ...env, RECOVERY_HMAC_SECRET: undefined }, () => {
        assert.equal(obtenerConfiguracionRecuperacion().habilitada, false);
        const token = generarToken({ idUsuario: 1, idRol: 3, versionCredenciales: 0 });
        assert.equal(verificarToken(token).versionCredenciales, 0);
    });
});

test('Lecturas independientes de la misma configuración conservan el material criptográfico', () => {
    const first = obtenerConfiguracionRecuperacion(env);
    const second = obtenerConfiguracionRecuperacion({ ...env });
    assert.equal(first.hmacSecret === second.hmacSecret, true);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(RECOVERY_SECURITY), true);
});
