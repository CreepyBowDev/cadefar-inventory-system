import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
const baseTest = process.env.DB_NAME_TEST;
const protegidas = [process.env.DB_NAME, process.env.DB_NAME_PRODUCTION].filter(Boolean);
assert.ok(baseTest, 'Configurar DB_NAME_TEST para integración');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), 'Usar MySQL local');
assert.equal(protegidas.some(nombre => nombre.toLowerCase() === baseTest.toLowerCase()), false);
const temporal = `${baseTest.slice(0, 20)}_receta_ddl_${randomBytes(6).toString('hex')}`;
assert.match(temporal, /^[a-zA-Z0-9_]+$/);
assert.equal([...protegidas, baseTest].some(nombre => nombre.toLowerCase() === temporal.toLowerCase()), false);
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = temporal;
const executeFile = promisify(execFile);
const runCli = async (comando, extra = []) => {
    try {
        await executeFile(process.execPath, [fileURLToPath(new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url)),
            comando, '--env', 'test', ...extra], { cwd: fileURLToPath(new URL('../', import.meta.url)),
            env: { ...process.env }, timeout: 60000 });
    } catch { throw new Error(`Sequelize CLI: ${comando} falló en la base temporal de migración de Recetas`); }
};
const require = createRequire(import.meta.url);
const migracion = require('../src/data/database/migrations/20261101120000-allow-null-receta-archivo.js');

test('Receta: migración aditiva de nulabilidad conserva legado y protege la reversión', { timeout: 120000 }, async t => {
    let creada = false, db;
    try {
        await runCli('db:create'); creada = true;
        await runCli('db:migrate', ['--to', '20261013120000-create-bitacora-auditoria.js']);
        ({ default: db } = await import('../src/data/models/index.js'));
        assert.equal(db.sequelize.config.database, temporal);
        const qi = db.sequelize.getQueryInterface();
        await db.Rol.create({ id_rol: 3, nombre: 'Vendedor' });
        const usuario = await db.Usuario.create({ id_rol: 3, nombre_usuario: 'receta_ddl', password_hash: 'sintetico_sin_login' });
        const venta = await db.Venta.create({ id_usuario: usuario.id_usuario, clave_operacion: 'receta-ddl', total: '0.00' });
        const base = { id_venta: venta.id_venta, fecha_receta: '2026-10-31', nombre_paciente: 'Paciente sintético',
            documento_paciente: 'DOC-TEST', nombre_medico: 'Médico sintético', modalidad: 'Presentada' };
        const legada = await db.Receta.create({ ...base, archivo_receta: 'referencia_historica.pdf' });
        const antes = await db.Receta.findByPk(legada.id_receta, { raw: true });
        const esquemaAntes = await qi.describeTable('receta');
        await t.test('Up cambia solo nulabilidad, sin alterar datos ni otros campos', async () => {
            assert.equal(esquemaAntes.archivo_receta.allowNull, false);
            await migracion.up(qi, db.Sequelize);
            const despues = await qi.describeTable('receta');
            assert.equal(despues.archivo_receta.allowNull, true);
            for (const campo of Object.keys(esquemaAntes).filter(c => c !== 'archivo_receta')) {
                assert.deepEqual(despues[campo], esquemaAntes[campo]);
            }
            assert.deepEqual(await db.Receta.findByPk(legada.id_receta, { raw: true }), antes);
        });
        await t.test('Down es reversible con datos compatibles y conserva la referencia histórica', async () => {
            await migracion.down(qi, db.Sequelize);
            assert.equal((await qi.describeTable('receta')).archivo_receta.allowNull, false);
            assert.deepEqual(await db.Receta.findByPk(legada.id_receta, { raw: true }), antes);
            await migracion.up(qi, db.Sequelize);
        });
        await t.test('NULL concurrente entre comprobación y ALTER nunca se convierte en una ruta ficticia', async () => {
            const original = db.sequelize.query.bind(db.sequelize);
            let nueva;
            const mock = t.mock.method(db.sequelize, 'query', async (sql, options) => {
                if (typeof sql === 'string' && /ALTER TABLE `receta`/.test(sql) && /NOT NULL/.test(sql)) {
                    nueva = await db.Receta.create({ ...base, archivo_receta: null });
                }
                return original(sql, options);
            });
            try { await assert.rejects(migracion.down(qi, db.Sequelize)); }
            finally { mock.mock.restore(); }
            assert.ok(nueva);
            assert.equal((await db.Receta.findByPk(nueva.id_receta)).archivo_receta, null);
            assert.equal((await qi.describeTable('receta')).archivo_receta.allowNull, true);
        });
        await t.test('Down rechaza recetas nuevas sin archivo antes de modificar el esquema', async () => {
            const filasAntes = await db.Receta.findAll({ raw: true, order: [['id_receta', 'ASC']] });
            await assert.rejects(migracion.down(qi, db.Sequelize), /existen recetas sin archivo/);
            assert.deepEqual(await db.Receta.findAll({ raw: true, order: [['id_receta', 'ASC']] }), filasAntes);
            assert.deepEqual(await db.Receta.findByPk(legada.id_receta, { raw: true }), antes);
            assert.equal((await qi.describeTable('receta')).archivo_receta.allowNull, true);
        });
    } finally {
        if (db) await db.sequelize.close();
        if (creada) await runCli('db:drop');
    }
});
