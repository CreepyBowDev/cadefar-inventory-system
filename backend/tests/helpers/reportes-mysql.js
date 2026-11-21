import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

// Revisar y autorizar en cada sesión. El opt-in NO se obtiene de .env.
// Importar este archivo no conecta ni modifica la configuración de la aplicación.
export async function crearEntornoReportes(t) {
    assert.equal(process.env.REPORTES_MYSQL_ACCEPTANCE, 'CREAR_MIGRAR_FIXTURES_ELIMINAR_LOCAL',
        'Falta autorización explícita para integración local de Reportes');
    dotenv.config({ quiet: true });
    assert.ok(['localhost', '127.0.0.1'].includes(process.env.DB_HOST), 'Destino configurado no local');
    assert.ok(!process.env.DB_PORT || process.env.DB_PORT === '3306', 'Puerto no autorizado');
    assert.ok(process.env.DB_USER && typeof process.env.PASSWORD_DB === 'string', 'Falta configuración MySQL local');
    assert.notEqual(process.env.NODE_ENV, 'production', 'No ejecutar integración desde producción');
    assert.ok(!Object.keys(process.env).some(k => /RAILWAY|DATABASE_URL|MYSQL_URL/.test(k)), 'Configuración remota incompatible');
    const database = `cadefar_reportes_f6_${randomBytes(8).toString('hex')}`;
    assert.match(database, /^cadefar_reportes_f6_[a-f0-9]{16}$/);
    assert.ok(![process.env.DB_NAME, process.env.DB_NAME_TEST, process.env.DB_NAME_PRODUCTION]
        .filter(Boolean).some(n => n.toLowerCase() === database.toLowerCase()));
    // Fijar el destino expresamente autorizado, no resolver localhost a otro servidor.
    Object.assign(process.env, { NODE_ENV: 'test', DB_HOST: '127.0.0.1', DB_NAME_TEST: database,
        JWT_SECRET: randomBytes(32).toString('hex'), DOTENV_CONFIG_QUIET: 'true' });
    let admin, creada = false, db;
    const cerrar = async () => {
        try { if (db) await db.sequelize.close(); }
        finally {
            try {
                if (creada) {
                    await admin.query(`DROP DATABASE \`${database}\``);
                    const [rows] = await admin.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [database]);
                    assert.equal(rows.length, 0);
                    t.diagnostic(`Limpieza verificada: ${database} eliminada`);
                }
            } finally { if (admin) await admin.end(); }
        }
    };
    try {
        try {
            admin = await mysql.createConnection({ host: '127.0.0.1', port: 3306,
                user: process.env.DB_USER, password: process.env.PASSWORD_DB, connectTimeout: 10000 });
        } catch { throw new Error('Conexión MySQL local autorizada no disponible (diagnóstico sin credenciales)'); }
        const [[motor]] = await admin.query('SELECT VERSION() AS version, @@version_comment AS comentario');
        t.diagnostic(`Destino 127.0.0.1:3306; motor ${motor.version}; ${motor.comentario}`);
        assert.doesNotMatch(motor.version, /mariadb/i);
        assert.match(motor.comentario, /mysql/i);
        const [[config]] = await admin.query('SELECT @@transaction_isolation AS aislamiento, @@sql_mode AS modo, @@time_zone AS zona, @@character_set_server AS charset, @@collation_server AS collation');
        t.diagnostic(`Configuración motor: ${JSON.stringify(config)}`);
        // Sin IF NOT EXISTS: nunca migrar ni limpiar una base preexistente.
        await admin.query(`CREATE DATABASE \`${database}\``);
        creada = true;
        t.diagnostic(`Base nueva: ${database}`);
        const cli = fileURLToPath(new URL('../../node_modules/sequelize-cli/lib/sequelize', import.meta.url));
        try {
            await promisify(execFile)(process.execPath, [cli, 'db:migrate', '--env', 'test'], {
                cwd: fileURLToPath(new URL('../../', import.meta.url)), env: { ...process.env }, timeout: 90000 });
        } catch { throw new Error('Migración de la base temporal de Reportes falló (salida privada omitida)'); }
        ({ default: db } = await import('../../src/data/models/index.js'));
        assert.equal(db.sequelize.config.database, database);
        assert.equal(db.sequelize.config.host, '127.0.0.1');
        const [tablas] = await admin.query('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?', [database]);
        assert.ok(tablas.length > 0 && tablas.every(f => f.ENGINE === 'InnoDB'));
        t.diagnostic(`Migraciones aplicadas; ${tablas.length} tablas InnoDB`);
        return { db, database, cerrar };
    } catch (error) {
        await cerrar();
        throw error;
    }
}
