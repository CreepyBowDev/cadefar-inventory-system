import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { crearEntornoReportes } from './helpers/reportes-mysql.js';

test('Guardas Fase 6: sin opt-in, servidor remoto o puerto distinto no hay conexión', async t => {
    const previa = { ...process.env };
    let conexiones = 0;
    t.mock.method(mysql, 'createConnection', () => { conexiones++; throw new Error('Conexión prohibida en esta regresión'); });
    try {
        delete process.env.REPORTES_MYSQL_ACCEPTANCE;
        await assert.rejects(crearEntornoReportes(t), /Falta autorización explícita/);
        process.env.REPORTES_MYSQL_ACCEPTANCE = 'CREAR_MIGRAR_FIXTURES_ELIMINAR_LOCAL';
        process.env.DB_HOST = 'servidor-remoto.invalid';
        await assert.rejects(crearEntornoReportes(t), /Destino configurado no local/);
        process.env.DB_HOST = '127.0.0.1';
        process.env.DB_PORT = '3307';
        await assert.rejects(crearEntornoReportes(t), /Puerto no autorizado/);
        assert.equal(conexiones, 0);
    } finally {
        for (const clave of Object.keys(process.env)) if (!Object.hasOwn(previa, clave)) delete process.env[clave];
        Object.assign(process.env, previa);
    }
});
