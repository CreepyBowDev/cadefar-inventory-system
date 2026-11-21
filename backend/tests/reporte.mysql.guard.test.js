import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { crearEntornoReportes } from './helpers/reportes-mysql.js';

test('F10 guardas fail-closed: sin autorización, remoto, puerto y producción nunca conectan', async t => {
    const anterior = { ...process.env };
    let conexiones = 0;
    t.mock.method(mysql, 'createConnection', () => { conexiones++; assert.fail('Conexión prohibida en prueba de guardas'); });
    try {
        delete process.env.REPORTES_MYSQL_ACCEPTANCE;
        await assert.rejects(crearEntornoReportes(t), /Falta autorización explícita/);
        process.env.REPORTES_MYSQL_ACCEPTANCE = 'CREAR_MIGRAR_FIXTURES_ELIMINAR_LOCAL';
        process.env.DB_HOST = 'example.invalid';
        await assert.rejects(crearEntornoReportes(t), /no local/);
        process.env.DB_HOST = '127.0.0.1'; process.env.DB_PORT = '3307';
        await assert.rejects(crearEntornoReportes(t), /Puerto no autorizado/);
        process.env.DB_PORT = '3306'; process.env.NODE_ENV = 'production';
        await assert.rejects(crearEntornoReportes(t), /producción/);
        process.env.NODE_ENV = 'test'; process.env.RAILWAY_GUARD_TEST = 'presente';
        await assert.rejects(crearEntornoReportes(t), /Configuración remota incompatible/);
        assert.equal(conexiones, 0);
    } finally {
        for (const k of Object.keys(process.env)) if (!(k in anterior)) delete process.env[k];
        Object.assign(process.env, anterior);
    }
});
