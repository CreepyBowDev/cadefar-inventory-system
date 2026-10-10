import test from 'node:test';
import assert from 'node:assert/strict';
import { usuarioValidator } from '../src/business/validators/usuario.validator.js';

const createData = { idRol: 3, nombreUsuario: 'correo_prueba', password: 'Segura-123' };

test('Correo es opcional y nullable en CU03 y edición administrativa', () => {
    const created = usuarioValidator.validateCreateUsuario(createData);
    assert.equal(created.success, true);
    assert.equal(Object.hasOwn(created.data, 'correo'), false);
    assert.equal(usuarioValidator.validateCreateUsuario({ ...createData, correo: null }).success, true);
    const edited = usuarioValidator.validateUpdateUsuario({ nombreUsuario: 'nuevo_nombre' });
    assert.equal(edited.success, true);
    assert.equal(Object.hasOwn(edited.data, 'correo'), false);
    const removed = usuarioValidator.validateUpdateUsuario({ correo: null });
    assert.equal(removed.success, true);
    assert.equal(removed.data.correo, null);
    assert.equal(usuarioValidator.validateUpdateUsuario({}).success, false);
});

test('Correo normaliza solo espacios exteriores y mayúsculas; conserva puntos y +', () => {
    for (const result of [
        usuarioValidator.validateCreateUsuario({ ...createData, correo: '  Persona.Nombre+CADEFAR@Example.TEST  ' }),
        usuarioValidator.validateUpdateUsuario({ correo: '\tPersona.Nombre+CADEFAR@Example.TEST\n' })
    ]) {
        assert.equal(result.success, true);
        assert.equal(result.data.correo, 'persona.nombre+cadefar@example.test');
    }
});

test('Correo vacío, espacios, formato incorrecto y tipos distintos de string/null son inválidos', () => {
    for (const correo of ['', '   ', 'persona', 'persona@', '@example.test', 'persona @example.test', 'persona@example .test', 123, true, [], {}]) {
        for (const result of [
            usuarioValidator.validateCreateUsuario({ ...createData, correo }),
            usuarioValidator.validateUpdateUsuario({ correo })
        ]) {
            assert.equal(result.success, false);
            assert.equal(result.error.issues.some(issue => issue.path[0] === 'correo'), true);
        }
    }
});

test('Correo limita a 255 caracteres después de normalizar', () => {
    const correo = `${'a'.repeat(64)}@${`${'b'.repeat(63)}.`.repeat(2)}${'c'.repeat(57)}.test`;
    assert.equal(correo.length, 255);
    const valid = usuarioValidator.validateUpdateUsuario({ correo: `  ${correo}  ` });
    assert.equal(valid.success, true);
    assert.equal(valid.data.correo.length, 255);
    const invalid = usuarioValidator.validateUpdateUsuario({ correo: `${correo}t` });
    assert.equal(invalid.success, false);
    assert.equal(invalid.error.issues.some(issue => issue.message === 'El correo no puede superar los 255 caracteres'), true);
});

test('La normalización del correo no modifica nombre ni contraseña', () => {
    const password = '  Segura-123  ';
    const result = usuarioValidator.validateCreateUsuario({ ...createData, password, nombreUsuario: ' nombre ', correo: '  Persona@EXAMPLE.TEST ' });
    assert.equal(result.success, true);
    assert.equal(result.data.password === password, true);
    assert.equal(result.data.nombreUsuario, ' nombre ');
    assert.equal(result.data.correo, 'persona@example.test');
});

test('Versión interna, correo verificado, estado y campos desconocidos no son asignables', () => {
    for (const field of ['version_credenciales', 'versionCredenciales', 'correo_verificado', 'correoVerificado', 'estado', 'idUsuario', 'passwordHash']) {
        assert.equal(usuarioValidator.validateCreateUsuario({ ...createData, [field]: 1 }).success, false);
        assert.equal(usuarioValidator.validateUpdateUsuario({ correo: 'persona@example.test', [field]: 1 }).success, false);
    }
    assert.equal(usuarioValidator.validateUpdateOwnPassword({ passwordActual: 'antigua', passwordNueva: 'Segura-123', correo: 'persona@example.test' }).success, false);
});
