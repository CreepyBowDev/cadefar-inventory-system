import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { generarToken, verificarToken, esVersionCredencialesValida } from '../src/shared/utils/jwt.js';
import { errorHandler } from '../src/presentation/middlewares/error.middleware.js';
import { AppError } from '../src/shared/errors/app-error.js';

process.env.JWT_SECRET = 'clave_sintetica_exclusiva_de_pruebas_jwt';
const payload = { idUsuario: 1, idRol: 3, versionCredenciales: 0 };
const assertError = (operation, statusCode) => {
    let caught;
    try { operation(); } catch (error) { caught = error; }
    assert.equal(caught instanceof AppError, true);
    assert.equal(caught?.statusCode, statusCode);
};

test('JWT firmado incluye versión explícita y mantiene ocho horas sin datos adicionales', () => {
    for (const versionCredenciales of [0, 1, 4294967295]) {
        const token = generarToken({ ...payload, versionCredenciales, correo: 'no_incluir@example.test', password: 'no_incluir' });
        const verified = verificarToken(token);
        assert.equal(verified.versionCredenciales, versionCredenciales);
        assert.equal(verified.exp - verified.iat, 8 * 60 * 60);
        assert.deepEqual(Object.keys(verified).sort(), ['exp', 'iat', 'idRol', 'idUsuario', 'versionCredenciales']);
    }
});

test('Versión obligatoria, entera y unsigned: no hay valor por defecto ni transición', () => {
    for (const versionCredenciales of [undefined, null, '0', -1, 1.5, 4294967296, NaN, Infinity, true]) {
        assert.equal(esVersionCredencialesValida(versionCredenciales), false);
        assertError(() => generarToken({ ...payload, versionCredenciales }), 500);
        const token = jwt.sign({ ...payload, versionCredenciales }, process.env.JWT_SECRET);
        assertError(() => verificarToken(token), 401);
    }
    const oldToken = jwt.sign({ idUsuario: 1, idRol: 3 }, process.env.JWT_SECRET, { expiresIn: '8h' });
    assertError(() => verificarToken(oldToken), 401);
});

test('Payload inválido, expiración y firma incorrecta siguen siendo rechazados', () => {
    for (const changed of [{ idUsuario: '1' }, { idUsuario: 0 }, { idRol: -1 }]) {
        assertError(() => verificarToken(jwt.sign({ ...payload, ...changed }, process.env.JWT_SECRET)), 401);
    }
    let expired, invalid;
    try { verificarToken(jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: -1 })); } catch (error) { expired = error.name; }
    try { verificarToken(jwt.sign(payload, 'otra_clave_sintetica')); } catch (error) { invalid = error.name; }
    assert.equal(expired, 'TokenExpiredError');
    assert.equal(invalid, 'JsonWebTokenError');
});

test('Opciones de cookie conservan HttpOnly, seguridad por entorno y duración común', async () => {
    const previous = process.env.NODE_ENV;
    try {
        for (const env of ['test', 'production']) {
            process.env.NODE_ENV = env;
            const { AUTH_COOKIE_OPTIONS, AUTH_COOKIE_MAX_AGE } = await import(`../src/shared/constants/auth-cookie.js?env=${env}`);
            assert.deepEqual(AUTH_COOKIE_OPTIONS, { httpOnly: true, secure: env === 'production', sameSite: env === 'production' ? 'none' : 'lax' });
            assert.equal(AUTH_COOKIE_MAX_AGE, 8 * 60 * 60 * 1000);
        }
    } finally {
        if (previous === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previous;
    }
});

test('Manejo centralizado no registra SQL, hashes, tokens ni parámetros de errores técnicos', () => {
    const previous = console.error;
    const logged = [];
    let body, status;
    const marker = 'valor_sintetico_privado_no_registrar';
    const error = new Error(marker);
    error.name = 'SequelizeDatabaseError';
    error.sql = `UPDATE usuario SET password_hash = '${marker}'`;
    error.parameters = [marker];
    console.error = value => logged.push(value);
    try {
        errorHandler(error, {}, {
            status(value) { status = value; return this; },
            json(value) { body = value; }
        }, () => {});
    } finally { console.error = previous; }
    assert.equal(status, 500);
    assert.deepEqual(body, { message: 'Error interno del servidor' });
    assert.equal(JSON.stringify(logged).includes(marker), false);
    assert.equal(logged[0].name, 'SequelizeDatabaseError');
});
