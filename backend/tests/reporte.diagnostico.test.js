import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { marcarDiagnosticoReporte, diagnosticarErrorReporte } from '../src/shared/utils/reporte-diagnostico.js';

process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'diagnostico_sin_conexion';
const { default: db } = await import('../src/data/models/index.js');
const { conPlazoSqlReporte, antesSelectReporte } = await import('../src/data/repositories/reporte-plazo-sql.js');
const { reporteExportacionService: servicio } = await import('../src/business/services/reporte.exportacion.service.js');
const { reporteExtraccionRepository: extraccion } = await import('../src/data/repositories/reporte.extraccion.repository.js');
const { bitacoraAuditoriaService: auditor } = await import('../src/business/services/bitacora-auditoria.service.js');
const { reporteValidator } = await import('../src/business/validators/reporte.validator.js');
const { entornoExportacionRailway } = await import('../src/shared/utils/reporte-railway.js');

test.beforeEach(t => t.mock.method(db.sequelize.connectionManager, 'getConnection', () => assert.fail('MySQL prohibido')));
const evento = error => { const events = []; diagnosticarErrorReporte(error, 'EXTRACCION', e => events.push(e)); return events[0]; };

test('Resultado SELECT de Sequelize/MySQL real sin transporte: filas directas, decimales textuales y valores numéricos', async t => {
    const connection = { query: (opts, callback) => {
        queueMicrotask(() => callback(null, [{ motor: '8.0.46', ejecucion: 0, espera: '31536000' }]));
        return new EventEmitter();
    } };
    const query = new db.sequelize.dialect.Query(connection, db.sequelize, { type: db.Sequelize.QueryTypes.SELECT, raw: true, logging: false });
    const rows = await query.run('SELECT 1');
    assert.deepEqual(rows, [{ motor: '8.0.46', ejecucion: 0, espera: '31536000' }]);
    const sentencias = [], tx = {};
    t.mock.method(db.sequelize, 'query', async (sql, opts) => {
        assert.equal(opts.transaction, tx); assert.equal(opts.logging, false); sentencias.push(sql);
        return opts.type === db.Sequelize.QueryTypes.SELECT ? rows : [[], {}];
    });
    await conPlazoSqlReporte(tx, () => 5000, () => antesSelectReporte(tx));
    assert.equal(sentencias.length, 3);
    assert.equal(sentencias.at(-1), 'SET SESSION max_execution_time = 0, lock_wait_timeout = 31536000');
});

test('Versiones y tipos no acreditados: rechazo intacto, diagnóstico preciso sin publicar respuesta/version', async t => {
    for (const [rows, causa] of [
        [[], 'RESPUESTA_CONTROL_SQL_INVALIDA'], [[[], {}], 'RESPUESTA_CONTROL_SQL_INVALIDA'],
        [null, 'RESPUESTA_CONTROL_SQL_INVALIDA'], [[{ motor: '9.0-sintetico', ejecucion: 0, espera: 30 }], 'MOTOR_NO_ADMITIDO'],
        [[{ motor: '8.0-MariaDB', ejecucion: 0, espera: 30 }], 'MOTOR_NO_ADMITIDO'],
        [[{ motor: { secreto: 'no-publicar' }, ejecucion: 0, espera: 30 }], 'MOTOR_NO_ADMITIDO'],
        [[{ motor: '8.0.46', ejecucion: 'invalido', espera: 30 }], 'VALORES_SESION_INVALIDOS'],
        [[{ motor: '8.0.46', ejecucion: 0, espera: null }], 'VALORES_SESION_INVALIDOS']
    ]) {
        t.mock.method(db.sequelize, 'query', async () => rows);
        await assert.rejects(conPlazoSqlReporte({}, () => 1000, () => assert.fail('No leer sin acreditar')), error => {
            assert.deepEqual(evento(error), { codigo: 'EXPORTACION_RAILWAY_ERROR', etapa: 'CONTROL_SQL', causa }); return true;
        });
    }
});

test('Fallo de control, SET o restauración: etapa precisa y clasificación allowlist sin SQL/stack/code arbitrarios', async t => {
    for (const [paso, etapa, causa] of [
        ['control', 'CONTROL_SQL', 'SQL_VARIABLE_NO_ADMITIDA'],
        ['set', 'LIMITES_SQL', 'SQL_PERMISO_DENEGADO'],
        ['restaurar', 'RESTAURACION_SQL', 'RESTAURACION_SESION_FALLIDA']
    ]) {
        let descartada = false;
        const tx = { forceCleanup: async () => { descartada = true; } };
        const fallo = Object.assign(new Error('NO_PUBLICAR SQL /ruta contraseña'), { original: { errno: paso === 'control' ? 1193 : 1227 }, sql: 'NO_PUBLICAR', parameters: ['NO_PUBLICAR'] });
        t.mock.method(db.sequelize, 'query', async sql => {
            if (sql.startsWith('SELECT')) { if (paso === 'control') throw fallo; return [{ motor: '8.0.46', ejecucion: 0, espera: 30 }]; }
            if (paso === 'set' && sql.includes('= 1000,')) throw fallo;
            if (paso === 'restaurar' && sql.includes('= 0,')) throw fallo;
            return [[], {}];
        });
        await assert.rejects(conPlazoSqlReporte(tx, () => 1000, () => antesSelectReporte(tx)), error => {
            assert.deepEqual(evento(error), { codigo: 'EXPORTACION_RAILWAY_ERROR', etapa, causa }); return true;
        });
        assert.equal(descartada, paso === 'restaurar');
    }
});

test('Privacidad exacta, no duplicar, logger roto y no registrar rechazos HTTP esperados', () => {
    const error = Object.assign(new Error('NO_PUBLICAR'), { code: 'NO_PUBLICAR', sql: 'NO_PUBLICAR', response: { contenido: 'NO_PUBLICAR' }, causa: 'NO_PUBLICAR', etapa: 'NO_PUBLICAR' });
    const events = [];
    diagnosticarErrorReporte(error, 'NO_PUBLICAR', e => events.push(e));
    diagnosticarErrorReporte(error, 'ENTREGA', e => events.push(e));
    assert.deepEqual(events, [{ codigo: 'EXPORTACION_RAILWAY_ERROR', etapa: 'EXTRACCION', causa: 'FALLO_NO_CLASIFICADO' }]);
    assert.ok(!JSON.stringify(events).includes('NO_PUBLICAR'));
    assert.deepEqual(Object.keys(error).sort(), ['causa', 'code', 'etapa', 'response', 'sql']);
    for (const statusCode of [400, 401, 403, 413, 503]) assert.equal(evento(Object.assign(new Error(), { statusCode })), undefined);
    assert.doesNotThrow(() => diagnosticarErrorReporte(new Error(), 'ENTREGA', () => { throw new Error('logger'); }));
    const tagged = marcarDiagnosticoReporte(new Error(), 'NO_PUBLICAR', 'NO_PUBLICAR');
    assert.equal(evento(tagged).causa, 'FALLO_NO_CLASIFICADO');
    for (const [original, causa] of [[{ errno: 1064 }, 'SQL_SINTAXIS_RECHAZADA'], [{ errno: 2013 }, 'SQL_CONEXION_PERDIDA'], [{ errno: 1, message: 'NO_PUBLICAR' }, 'SQL_CONSULTA_FALLIDA']]) {
        assert.equal(evento(Object.assign(new Error('NO_PUBLICAR'), { original })).causa, causa);
    }
});

test('Etapas de archivos/generación/entrega: causas de SO acotadas y fallback, sin copiar valores arbitrarios', () => {
    for (const etapa of ['TEMPORALES', 'GENERACION', 'VERIFICACION_ARCHIVO', 'ENTREGA']) {
        for (const [code, causa] of [['ENOSPC', 'ARCHIVO_SIN_ESPACIO'], ['EACCES', 'ARCHIVO_PERMISO_DENEGADO'],
            ['EPERM', 'ARCHIVO_PERMISO_DENEGADO'], ['ENOENT', 'ARCHIVO_NO_ENCONTRADO'], ['NO_PUBLICAR', 'FALLO_NO_CLASIFICADO']]) {
            const events = [];
            diagnosticarErrorReporte(Object.assign(new Error('NO_PUBLICAR'), { code, path: 'NO_PUBLICAR' }), etapa, e => events.push(e));
            assert.deepEqual(events, [{ codigo: 'EXPORTACION_RAILWAY_ERROR', etapa, causa }]);
        }
    }
});

test('Pipeline por etapas: control previo común a todos los formatos y mensajes/auditoría sin datos técnicos', async t => {
    const raiz = await mkdtemp(join(process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir(), 'cadefar-diagnostico-'));
    const log = [], events = [];
    t.mock.method(console, 'error', e => log.push(e));
    t.mock.method(servicio, 'comprobarDisponibilidad', async () => ({ perfil: 'RAILWAY', raizPrivada: raiz }));
    t.mock.method(entornoExportacionRailway, 'vigilar', () => ({ comprobar() {}, liberar() {} }));
    let modo = 'version';
    t.mock.method(db.sequelize, 'transaction', async (opts, cb) => {
        if (modo === 'apertura') throw Object.assign(new Error('NO_PUBLICAR'), { original: { errno: 2013 } });
        const result = await cb({});
        if (modo === 'cierre') throw new Error('NO_PUBLICAR');
        return result;
    });
    t.mock.method(db.sequelize, 'query', async sql => sql.startsWith('SELECT') ? [{ motor: modo === 'version' ? '9.0-sintetico' : '8.0.46', ejecucion: 0, espera: 30 }] : [[], {}]);
    t.mock.method(extraccion, 'resumen', async () => { if (modo === 'extraccion') throw Object.assign(new Error('NO_PUBLICAR'), { original: { errno: 1064 } }); return []; });
    t.mock.method(extraccion, 'bloque', async () => []);
    t.mock.method(auditor, 'intentarRegistrar', async event => events.push(event));
    const audit = { contexto: { correlacion: 'a'.repeat(32) }, responsable: { idUsuario: 1, idRol: 1 } };
    try {
        for (const [caso, etapa, causa] of [
            ['version', 'CONTROL_SQL', 'MOTOR_NO_ADMITIDO'], ['apertura', 'APERTURA_SNAPSHOT', 'SQL_CONEXION_PERDIDA'],
            ['extraccion', 'EXTRACCION', 'SQL_SINTAXIS_RECHAZADA'], ['cierre', 'CIERRE_SNAPSHOT', 'FALLO_NO_CLASIFICADO']
        ]) for (const formato of ['CSV', 'XLSX', 'PDF']) {
            modo = caso;
            const f = reporteValidator.validateExportacionVentas({ dia: '2026-11-20', presentacion: 'TABULAR', formato }).data;
            const antes = log.length;
            await assert.rejects(servicio.preparar('VENTAS', f, audit));
            assert.deepEqual(log.slice(antes), [{ codigo: 'EXPORTACION_RAILWAY_ERROR', etapa, causa }]);
            assert.equal(events.at(-1).resultado, 'FALLO');
            assert.deepEqual(await readdir(raiz), []);
        }
        assert.ok(!JSON.stringify(events).includes('NO_PUBLICAR')); assert.equal(events.length, 12);
    } finally { await rm(raiz, { recursive: true }); }
});
