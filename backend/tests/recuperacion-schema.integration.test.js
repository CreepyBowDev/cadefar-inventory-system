import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
const configuredTestDatabase = process.env.DB_NAME_TEST;
const protectedDatabases = [process.env.DB_NAME, process.env.DB_NAME_PRODUCTION].filter(Boolean);
assert.equal(Boolean(configuredTestDatabase), true, 'Configurar DB_NAME_TEST para ejecutar integración');
assert.equal(protectedDatabases.some(name => name.toLowerCase() === configuredTestDatabase.toLowerCase()), false, 'La base de pruebas debe ser distinta de desarrollo y producción');
assert.equal(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), true, 'La prueba de migraciones requiere MySQL local');

// Base temporal exclusiva de esta suite. No reconstruye cadefar_test ni hace
// rollback de migraciones aplicadas en bases compartidas.
const temporaryDatabase = `${configuredTestDatabase.slice(0, 40)}_cu09_${randomBytes(6).toString('hex')}`;
assert.equal([configuredTestDatabase, ...protectedDatabases].some(name => name.toLowerCase() === temporaryDatabase.toLowerCase()), false);
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = temporaryDatabase;

const executeFile = promisify(execFile);
const backendPath = fileURLToPath(new URL('../', import.meta.url));
const cliPath = fileURLToPath(new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url));
const previousMigration = '20261003120100-add-pending-venta-state.js';
const newMigrations = [
    '20261009120000-add-recovery-fields-to-usuario.js',
    '20261009120100-create-recuperacion-password.js',
    '20261009120200-create-limite-recuperacion-ip.js',
    '20261009120300-simplify-recuperacion-password.js'
];

const runCli = async (...args) => {
    try {
        await executeFile(process.execPath, [cliPath, ...args, '--env', 'test'], {
            cwd: backendPath, env: { ...process.env }, timeout: 30000
        });
    } catch {
        // Evitar imprimir SQL, parámetros o errores completos del subprocess.
        throw new Error(`Sequelize CLI: ${args[0]} falló en la base temporal de pruebas`);
    }
};

const expectDatabaseError = async (operation, expectedName) => {
    let name = null;
    try {
        await operation();
    } catch (error) {
        name = error.name;
    }
    assert.equal(name, expectedName, 'MySQL debe rechazar la operación por la restricción indicada');
};

test('CU09 fase 2: migraciones, integridad y asociaciones en MySQL temporal', { timeout: 120000 }, async (t) => {
    let databaseCreated = false, db;
    try {
        await runCli('db:create');
        databaseCreated = true;
        await runCli('db:migrate', '--to', previousMigration);
        await runCli('db:seed', '--seed', '20260914181926-seed-rol.js');
        ({ default: db } = await import('../src/data/models/index.js'));
        db.sequelize.options.logging = false;
        assert.equal(db.sequelize.config.database === temporaryDatabase, true);
        const queryInterface = db.sequelize.getQueryInterface();
        const oldTables = await queryInterface.showAllTables();
        const oldColumns = Object.keys(await queryInterface.describeTable('usuario'));
        const oldHash = await bcrypt.hash('Historica-123', 10);
        await queryInterface.bulkInsert('usuario', [{
            id_rol: 3, nombre_usuario: 'usuario_anterior_cu09', password_hash: oldHash,
            estado: true, intentos_fallidos_login: 2, bloqueado_hasta: null
        }]);
        const legacySnapshot = async () => {
            const [row] = await db.sequelize.query(
                'SELECT id_usuario, id_rol, nombre_usuario, password_hash, estado, intentos_fallidos_login, bloqueado_hasta FROM usuario WHERE nombre_usuario = :nombre',
                { replacements: { nombre: 'usuario_anterior_cu09' }, type: db.Sequelize.QueryTypes.SELECT }
            );
            return row;
        };
        const before = await legacySnapshot();
        const assertLegacyPreserved = async () => {
            const after = await legacySnapshot();
            assert.equal(after.password_hash === before.password_hash, true, 'Conservar el hash histórico');
            for (const field of oldColumns.filter(field => field !== 'password_hash')) {
                assert.equal(after[field], before[field], `Conservar ${field} del usuario anterior`);
            }
        };

        await runCli('db:migrate', '--to', '20261009120200-create-limite-recuperacion-ip.js');
        const historicalNonce = randomUUID();
        await queryInterface.bulkInsert('recuperacion_password', [{
            id_usuario: before.id_usuario, codigo_hmac: 'd'.repeat(64), nonce: historicalNonce,
            fecha_solicitud: '2026-10-01 12:00:00.123', expira_en: '2026-10-01 12:10:00.123',
            invalidada_en: '2026-10-01 12:01:00.123', envio_intentos: 1
        }], { logging: false });
        await t.test('Correctiva detiene DDL si existen datos de envío y conserva el historial', async () => {
            await assert.rejects(runCli('db:migrate'));
            assert.equal(Object.keys(await queryInterface.describeTable('recuperacion_password')).length, 13);
            assert.equal(await db.RecuperacionPassword.count(), 1);
            // Solo fixture sintético en base temporal autorizada.
            await queryInterface.bulkUpdate('recuperacion_password', { envio_intentos: 0 }, { nonce: historicalNonce }, { logging: false });
        });
        await runCli('db:migrate');

        await t.test('Migraciones históricas y correctiva conservan usuarios y recuperaciones previos', async () => {
            await assertLegacyPreserved();
            const usuario = await db.Usuario.findByPk(before.id_usuario);
            assert.equal(usuario.correo, null);
            assert.equal(usuario.version_credenciales, 0);
            const usuarioColumns = Object.keys(await queryInterface.describeTable('usuario'));
            assert.deepEqual(usuarioColumns.filter(field => !oldColumns.includes(field)).sort(), ['correo', 'version_credenciales']);
            const tables = await queryInterface.showAllTables();
            assert.deepEqual(tables.filter(table => !oldTables.includes(table)).sort(), ['limite_recuperacion_ip', 'recuperacion_password']);
            const migrations = await db.sequelize.query('SELECT name FROM SequelizeMeta ORDER BY name', { type: db.Sequelize.QueryTypes.SELECT });
            assert.deepEqual(migrations.slice(-4).map(row => row.name), newMigrations);
            const historical = await db.RecuperacionPassword.findOne({ where: { nonce: historicalNonce } });
            assert.equal(historical.invalidada_en.toISOString(), '2026-10-01T12:01:00.123Z');
            assert.equal(historical.codigo_hmac === 'd'.repeat(64), true);
        });

        await t.test('Tipos, nulabilidad, precisión de fechas, unsigned y collation coinciden con el contrato', async () => {
            const columns = await db.sequelize.query(`
                SELECT TABLE_NAME AS tabla, COLUMN_NAME AS campo, COLUMN_TYPE AS tipo,
                       IS_NULLABLE AS nullable, COLUMN_DEFAULT AS predeterminado,
                       COLLATION_NAME AS collation, EXTRA AS extra
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = :schema AND TABLE_NAME IN ('usuario', 'recuperacion_password', 'limite_recuperacion_ip')
            `, { replacements: { schema: temporaryDatabase }, type: db.Sequelize.QueryTypes.SELECT });
            const column = (table, field) => columns.find(row => row.tabla === table && row.campo === field);
            assert.equal(column('usuario', 'correo').tipo, 'varchar(255)');
            assert.equal(column('usuario', 'correo').nullable, 'YES');
            assert.equal(column('usuario', 'correo').collation, 'utf8mb4_bin');
            assert.equal(column('usuario', 'version_credenciales').tipo, 'int unsigned');
            assert.equal(column('usuario', 'version_credenciales').nullable, 'NO');
            assert.equal(String(column('usuario', 'version_credenciales').predeterminado), '0');
            for (const [table, model] of [['recuperacion_password', db.RecuperacionPassword], ['limite_recuperacion_ip', db.LimiteRecuperacionIp]]) {
                const fields = Object.keys(model.rawAttributes);
                assert.equal(fields.every(field => column(table, field)), true);
                assert.equal(model.options.timestamps, false);
            }
            assert.deepEqual(Object.keys(db.RecuperacionPassword.rawAttributes).sort(), [
                'id_recuperacion', 'id_usuario', 'codigo_hmac', 'nonce', 'fecha_solicitud',
                'expira_en', 'intentos_fallidos', 'consumida_en', 'invalidada_en'
            ].sort());
            assert.equal(columns.filter(row => row.tabla === 'recuperacion_password').length, 9);
            assert.equal(columns.filter(row => row.tabla === 'limite_recuperacion_ip').length, 4);
            assert.equal(column('recuperacion_password', 'id_recuperacion').extra, 'auto_increment');
            assert.equal(column('recuperacion_password', 'codigo_hmac').tipo, 'char(64)');
            assert.equal(column('recuperacion_password', 'nonce').tipo, 'char(36)');
            for (const field of ['intentos_fallidos']) {
                assert.equal(column('recuperacion_password', field).tipo, 'tinyint unsigned');
                assert.equal(String(column('recuperacion_password', field).predeterminado), '0');
            }
            for (const field of ['fecha_solicitud', 'expira_en', 'consumida_en', 'invalidada_en']) {
                assert.equal(column('recuperacion_password', field).tipo, 'datetime(3)');
                assert.equal(column('recuperacion_password', field).nullable, ['fecha_solicitud', 'expira_en'].includes(field) ? 'NO' : 'YES');
            }
            assert.equal(column('limite_recuperacion_ip', 'ambito').tipo, 'varchar(24)');
            assert.equal(column('limite_recuperacion_ip', 'clave_ip_hmac').tipo, 'char(64)');
            assert.equal(column('limite_recuperacion_ip', 'ventana_hasta').tipo, 'datetime(3)');
            assert.equal(column('limite_recuperacion_ip', 'cantidad').tipo, 'int unsigned');
        });

        await t.test('Correo admite múltiples NULL y exige unicidad binaria sin alterar puntos ni +', async () => {
            const usuarioData = nombre => ({ id_rol: 3, nombre_usuario: nombre, password_hash: oldHash });
            const second = await db.Usuario.create(usuarioData('sin_correo_cu09'));
            await second.reload();
            assert.equal(second.correo, null);
            const correo = 'persona.nombre+prueba@example.test';
            await db.Usuario.update({ correo }, { where: { id_usuario: before.id_usuario } });
            await expectDatabaseError(() => queryInterface.bulkInsert('usuario', [{
                ...usuarioData('correo_duplicado_cu09'), correo
            }]), 'SequelizeUniqueConstraintError');
            const distinct = await db.Usuario.create({
                ...usuarioData('correo_distinto_cu09'), correo: 'persona.nombre+pruéba@example.test'
            });
            assert.equal(distinct.correo.includes('+'), true);
            assert.equal((await db.Usuario.findByPk(before.id_usuario)).correo === correo, true);
            await expectDatabaseError(() => queryInterface.bulkUpdate('usuario', { version_credenciales: -1 }, { id_usuario: before.id_usuario }), 'SequelizeDatabaseError');
        });

        await t.test('Recuperaciones: defaults, milisegundos, nonce único y asociaciones bidireccionales', async () => {
            const fecha = new Date('2026-10-09T12:00:00.123Z');
            const data = {
                id_usuario: before.id_usuario, codigo_hmac: 'a'.repeat(64), nonce: randomUUID(),
                fecha_solicitud: fecha, expira_en: new Date(fecha.getTime() + 600000)
            };
            const recovery = await db.RecuperacionPassword.create(data);
            await recovery.reload();
            assert.equal(Number.isInteger(recovery.id_recuperacion), true);
            assert.equal(recovery.intentos_fallidos, 0);
            for (const field of ['consumida_en', 'invalidada_en']) {
                assert.equal(recovery[field], null);
            }
            assert.equal(recovery.fecha_solicitud.getTime(), fecha.getTime());
            assert.equal(recovery.expira_en.getTime(), fecha.getTime() + 600000);
            await expectDatabaseError(() => queryInterface.bulkInsert('recuperacion_password', [data]), 'SequelizeUniqueConstraintError');
            const included = await db.RecuperacionPassword.findByPk(recovery.id_recuperacion, {
                include: [{ model: db.Usuario, as: 'usuario', attributes: ['id_usuario'] }]
            });
            assert.equal(included.usuario.id_usuario, before.id_usuario);
            const usuario = await db.Usuario.findByPk(before.id_usuario, {
                include: [{ model: db.RecuperacionPassword, as: 'recuperacionesPassword' }]
            });
            assert.equal(usuario.recuperacionesPassword.length, 2);
            assert.equal(usuario.recuperacionesPassword.some(row => row.id_recuperacion === recovery.id_recuperacion), true);
        });

        await t.test('FK RESTRICT impide recuperaciones huérfanas y borrar o renumerar al usuario', async () => {
            const foreignKeys = await db.sequelize.query(`
                SELECT DELETE_RULE AS borrado, UPDATE_RULE AS actualizacion
                FROM information_schema.REFERENTIAL_CONSTRAINTS
                WHERE CONSTRAINT_SCHEMA = :schema AND TABLE_NAME = 'recuperacion_password'
            `, { replacements: { schema: temporaryDatabase }, type: db.Sequelize.QueryTypes.SELECT });
            assert.deepEqual(foreignKeys, [{ borrado: 'RESTRICT', actualizacion: 'RESTRICT' }]);
            await expectDatabaseError(() => queryInterface.bulkInsert('recuperacion_password', [{
                id_usuario: 0, codigo_hmac: 'b'.repeat(64), nonce: randomUUID(),
                fecha_solicitud: new Date(), expira_en: new Date(Date.now() + 600000)
            }]), 'SequelizeForeignKeyConstraintError');
            await expectDatabaseError(() => queryInterface.bulkDelete('usuario', { id_usuario: before.id_usuario }), 'SequelizeForeignKeyConstraintError');
            await expectDatabaseError(() => queryInterface.bulkUpdate('usuario', { id_usuario: 1000000 }, { id_usuario: before.id_usuario }), 'SequelizeForeignKeyConstraintError');
            await assertLegacyPreserved();
        });

        await t.test('Cuotas IP: clave compuesta por ámbito y HMAC, sin id/FK, cantidad unsigned', async () => {
            const data = { ambito: 'solicitud', clave_ip_hmac: 'c'.repeat(64), ventana_hasta: new Date('2026-10-09T12:15:00.456Z'), cantidad: 1 };
            const limit = await db.LimiteRecuperacionIp.create(data);
            await limit.reload();
            assert.equal(limit.ventana_hasta.getUTCMilliseconds(), 456);
            assert.deepEqual(db.LimiteRecuperacionIp.primaryKeyAttributes, ['ambito', 'clave_ip_hmac']);
            assert.equal(Object.keys(db.LimiteRecuperacionIp.associations).length, 0);
            await expectDatabaseError(() => queryInterface.bulkInsert('limite_recuperacion_ip', [data]), 'SequelizeUniqueConstraintError');
            await db.LimiteRecuperacionIp.create({ ...data, ambito: 'restablecimiento' });
            assert.equal(await db.LimiteRecuperacionIp.count(), 2);
            await expectDatabaseError(() => queryInterface.bulkInsert('limite_recuperacion_ip', [{ ...data, ambito: 'negativo', cantidad: -1 }]), 'SequelizeDatabaseError');
            const references = await queryInterface.getForeignKeyReferencesForTable('limite_recuperacion_ip');
            assert.equal(references.length, 0);
        });

        await t.test('Índices de unicidad, cuenta, expiración y ventana están presentes en MySQL', async () => {
            for (const [table, expected] of [
                ['usuario', [{ name: 'uq_usuario_correo', unique: true, fields: ['correo'] }]],
                ['recuperacion_password', db.RecuperacionPassword.options.indexes],
                ['limite_recuperacion_ip', [{ name: 'PRIMARY', unique: true, fields: ['ambito', 'clave_ip_hmac'] }, ...db.LimiteRecuperacionIp.options.indexes]]
            ]) {
                const indexes = await queryInterface.showIndex(table);
                assert.equal(indexes.some(index => index.name === 'idx_recuperacion_envio_proximo'), false);
                for (const definition of expected) {
                    const index = indexes.find(item => item.name === definition.name);
                    assert.equal(Boolean(index), true, `Existe ${definition.name}`);
                    assert.equal(index.unique, Boolean(definition.unique));
                    assert.deepEqual(index.fields.map(field => field.attribute), definition.fields);
                }
            }
        });

        await t.test('CLI no reaplica migraciones ejecutadas y conserva registros históricos', async () => {
            await runCli('db:migrate');
            assert.equal(await db.RecuperacionPassword.count(), 2);
            await assertLegacyPreserved();
        });
        t.diagnostic('Migraciones históricas y modelo funcional de nueve atributos comprobados en base temporal; sin rollbacks ni cambios en bases compartidas.');
    } finally {
        try {
            if (db) await db.sequelize.close();
        } finally {
            if (databaseCreated) await runCli('db:drop');
        }
    }
});
