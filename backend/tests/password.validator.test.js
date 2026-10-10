import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import bcrypt from 'bcrypt';
import { newPasswordSchema } from '../src/business/validators/password.schema.js';
import { usuarioValidator } from '../src/business/validators/usuario.validator.js';
import { authValidator } from '../src/business/validators/auth.validator.js';

const password72 = `Aa1!${'x'.repeat(68)}`;
const password73 = `${password72}x`;
const historicalPassword = `${password72}histórica`;
const byteMessage = 'La contraseña no puede superar los 72 bytes en UTF-8';

const assertIssue = (result, message, path = []) => {
    assert.equal(result.success, false);
    assert.equal(result.error.issues.some(issue => (
        issue.message === message && JSON.stringify(issue.path) === JSON.stringify(path)
    )), true, 'Debe conservar el mensaje y la ruta de validación esperados');
};

test('Contraseña válida inferior a 72 bytes', () => {
    assert.equal(newPasswordSchema.safeParse('Segura-123').success, true);
});

test('Frontera UTF-8: exactamente 72 bytes aceptados y 73 rechazados', () => {
    for (const password of [password72, `Aa1!${'é'.repeat(34)}`]) {
        assert.equal(Buffer.byteLength(password, 'utf8'), 72);
        assert.equal(newPasswordSchema.safeParse(password).success, true);
    }
    for (const password of [password73, `Aa1!${'é'.repeat(34)}x`]) {
        assert.equal(Buffer.byteLength(password, 'utf8'), 73);
        assertIssue(newPasswordSchema.safeParse(password), byteMessage);
    }
});

test('Unicode: menos de 72 caracteres puede superar 72 bytes', () => {
    const password = `Aa1!${'🔐'.repeat(18)}`;
    assert.equal(password.length < 72, true);
    assert.equal(Buffer.byteLength(password, 'utf8') > 72, true);
    assertIssue(newPasswordSchema.safeParse(password), byteMessage);
    assert.equal(newPasswordSchema.safeParse('Áé٣🔐abcd').success, true);
});

test('Complejidad: se conservan las cuatro categorías y sus mensajes', () => {
    for (const [password, message] of [
        ['segura-123', 'La contraseña debe contener al menos una letra mayúscula'],
        ['SEGURA-123', 'La contraseña debe contener al menos una letra minúscula'],
        ['Segura-abc', 'La contraseña debe contener al menos un número'],
        ['Segura123', 'La contraseña debe contener al menos un carácter especial']
    ]) {
        assertIssue(newPasswordSchema.safeParse(password), message);
    }
});

test('Se conservan los límites de 8 y 100 caracteres y sus mensajes', () => {
    assertIssue(newPasswordSchema.safeParse('Aa1!xxx'), 'La contraseña debe tener al menos 8 caracteres');
    assert.equal(newPasswordSchema.safeParse('Aa1!xxxx').success, true);
    assertIssue(newPasswordSchema.safeParse(`Aa1!${'x'.repeat(97)}`), 'La contraseña no puede superar los 100 caracteres');
});

test('Contraseñas no se recortan, normalizan ni transforman', () => {
    for (const password of ['  Áa1!abcd  ', 'A\u0301a1!abcd', password72]) {
        const result = newPasswordSchema.safeParse(password);
        assert.equal(result.success, true);
        assert.equal(result.data === password, true);
    }
    assertIssue(newPasswordSchema.safeParse(` ${password72}`), byteMessage);
});

test('CU03 y ambas variantes de CU08 comparten la política nueva', () => {
    const validators = [
        [password => usuarioValidator.validateCreateUsuario({ idRol: 3, nombreUsuario: 'prueba01', password }), 'password'],
        [password => usuarioValidator.validateUpdatePassword({ password }), 'password'],
        [passwordNueva => usuarioValidator.validateUpdateOwnPassword({ passwordActual: historicalPassword, passwordNueva }), 'passwordNueva']
    ];
    for (const [validate, property] of validators) {
        assert.equal(validate('Segura-123').success, true);
        assert.equal(validate(password72).success, true);
        assertIssue(validate(password73), byteMessage, [property]);
        assertIssue(validate(`Aa1!${'é'.repeat(35)}`), byteMessage, [property]);
        for (const password of [undefined, null, 12345678, '', 'Aa1!xxx', 'SinNumero!']) {
            assert.equal(validate(password).success, false);
        }
    }
});

test('Login y passwordActual permiten contraseñas históricas sin exigir complejidad nueva', () => {
    for (const password of [historicalPassword, 'x', 'x'.repeat(100)]) {
        assert.equal(authValidator.validateLogin({ nombreUsuario: 'prueba01', password }).success, true);
        assert.equal(usuarioValidator.validateUpdateOwnPassword({ passwordActual: password, passwordNueva: 'Segura-123' }).success, true);
    }
    for (const password of ['', 'x'.repeat(101), null, 123]) {
        assert.equal(authValidator.validateLogin({ nombreUsuario: 'prueba01', password }).success, false);
        assert.equal(usuarioValidator.validateUpdateOwnPassword({ passwordActual: password, passwordNueva: 'Segura-123' }).success, false);
    }
});

test('Bcrypt sigue verificando un hash histórico mayor de 72 bytes', async () => {
    const hash = await bcrypt.hash(historicalPassword, 10);
    assert.equal(await bcrypt.compare(historicalPassword, hash), true);
    // Evidencia de la truncación histórica que la política NUEVA evita.
    assert.equal(await bcrypt.compare(`${password72}otro-sufijo`, hash), true);
    assert.equal(await bcrypt.compare(`B${historicalPassword.slice(1)}`, hash), false);
    assertIssue(newPasswordSchema.safeParse(historicalPassword), byteMessage);
});

test('Regresión: IDs, roles, nombres, estado, campos estrictos y PATCH sin datos', () => {
    assert.equal(usuarioValidator.validateIdUsuario({ idUsuario: '3' }).data.idUsuario, 3);
    for (const idUsuario of [0, -1, 1.5, 'abc']) {
        assert.equal(usuarioValidator.validateIdUsuario({ idUsuario }).success, false);
    }
    const create = { idRol: 3, nombreUsuario: 'prueba01', password: 'Segura-123' };
    for (const data of [
        { ...create, idRol: '3' }, { ...create, idRol: 0 },
        { ...create, nombreUsuario: 'ab' }, { ...create, nombreUsuario: 'x'.repeat(61) },
        { ...create, estado: true }, { ...create, idUsuario: 1 }, { ...create, passwordHash: 'prohibido' }
    ]) {
        assert.equal(usuarioValidator.validateCreateUsuario(data).success, false);
    }
    assert.equal(usuarioValidator.validateUpdateUsuario({ nombreUsuario: 'prueba02' }).success, true);
    assert.equal(usuarioValidator.validateUpdateUsuario({ idRol: 2 }).success, true);
    assert.equal(usuarioValidator.validateUpdateUsuario({}).success, false);
    assert.equal(usuarioValidator.validateUpdateUsuario({ password: 'Segura-123' }).success, false);
    assert.equal(usuarioValidator.validateUpdateEstado({ estado: false }).success, true);
    assert.equal(usuarioValidator.validateUpdateEstado({ estado: 'false' }).success, false);
    assert.equal(usuarioValidator.validateUpdatePassword({ password: 'Segura-123', idRol: 1 }).success, false);
    assert.equal(usuarioValidator.validateUpdateOwnPassword({ passwordActual: 'x', passwordNueva: 'Segura-123', estado: true }).success, false);
    assert.equal(authValidator.validateLogin({ nombreUsuario: 'prueba01', password: 'x', estado: true }).success, false);
    assert.equal(authValidator.validateLogin({ nombreUsuario: 'ab', password: 'x' }).success, false);
});
