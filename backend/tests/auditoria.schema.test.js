import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Sequelize, DataTypes } from 'sequelize';

const require = createRequire(import.meta.url);
const migracion = require('../src/data/database/migrations/20261013120000-create-bitacora-auditoria.js');
const definirModelo = require('../src/data/models/bitacora-auditoria.js');

test('Esquema Fase 1: DDL único con índices, UTC milisegundos, sin FKs ni tareas de borrado', async t => {
    const sql = [];
    await migracion.up({ sequelize: { query: async consulta => sql.push(consulta) } });
    assert.equal(sql.length, 1);
    assert.match(sql[0], /^\s*CREATE TABLE `bitacora_auditoria`/);
    assert.match(sql[0], /ENGINE=InnoDB/);
    assert.doesNotMatch(sql[0], /FOREIGN KEY|CASCADE|\bENUM\b|CREATE EVENT|DELETE FROM|TRIGGER/i);
    assert.match(sql[0], /UNIQUE KEY `uq_bitacora_solicitud_tipo` \(`correlacion`, `tipo_evento`\)/);
    assert.match(sql[0], /CHECK \(`resultado` IN \('EXITO', 'RECHAZADO', 'FALLO'\)\)/);
    const sequelize = new Sequelize('auditoria_esquema_sin_conexion', 'sintetico', 'sintetico', {
        dialect: 'mysql', logging: false
    });
    t.mock.method(sequelize.connectionManager, 'getConnection', () => {
        throw new Error('Esta prueba no conecta a MySQL');
    });
    try {
        const modelo = definirModelo(sequelize, DataTypes);
        const atributos = modelo.getAttributes();
        const columnas = [...sql[0].matchAll(/^\s*`(\w+)`\s+(INT|VARCHAR\(\d+\)|CHAR\(\d+\)|DATETIME\(3\)|SMALLINT UNSIGNED|JSON)\s+(NOT NULL|NULL)/gm)];
        assert.deepEqual(columnas.map(m => m[1]).sort(), Object.keys(atributos).sort());
        for (const [, campo, tipo, nulabilidad] of columnas) {
            const tipoModelo = atributos[campo].type.toSql().replace('INTEGER', 'INT');
            assert.equal(tipoModelo, tipo, campo);
            assert.equal(atributos[campo].allowNull, nulabilidad === 'NULL', campo);
            assert.equal(atributos[campo].references, undefined, campo);
        }
        assert.equal(atributos.id_evento.autoIncrement, true);
        assert.equal(modelo.options.timestamps, false);
        assert.equal(modelo.tableName, 'bitacora_auditoria');
        for (const indice of modelo.options.indexes) {
            assert.ok(sql[0].includes(`KEY \`${indice.name}\` (${indice.fields.map(campo => `\`${campo}\``).join(', ')})`));
        }
    } finally { await sequelize.close(); }
});

test('Esquema: un fallo DDL se propaga sin escrituras auxiliares o creación parcial posterior', async () => {
    const error = new Error('fallo_ddl_sintetico');
    let llamadas = 0;
    await assert.rejects(migracion.up({ sequelize: { query: async () => { llamadas++; throw error; } } }),
        recibido => recibido === error);
    assert.equal(llamadas, 1);
});

test('Conservación: down no borra ni consulta, aunque se intente deshacer la migración', async () => {
    await assert.rejects(migracion.down({ sequelize: { query: () => assert.fail('No debe emitir SQL') },
        dropTable: () => assert.fail('No debe borrar Bitácora') }), /60 meses/);
});

test('Modelo append-only: bloquea updates, destroy, truncate, save de históricos y upsert por ORM', async t => {
    const sequelize = new Sequelize('auditoria_hooks_sin_conexion', 'sintetico', 'sintetico', {
        dialect: 'mysql', logging: false
    });
    t.mock.method(sequelize.connectionManager, 'getConnection', () => assert.fail('No debe conectar a MySQL'));
    try {
        const modelo = definirModelo(sequelize, DataTypes);
        const data = { id_evento: 1, tipo_evento: 'LOGOUT', modulo: 'AUTENTICACION', accion: 'LOGOUT',
            resultado: 'EXITO', fecha_registro: new Date(), fecha_evento: new Date(),
            procedencia_ip: 'NO_DISPONIBLE', correlacion: 'a'.repeat(32) };
        const historico = modelo.build(data, { isNewRecord: false, raw: true });
        for (const operacion of [
            () => modelo.update({ accion: 'OTRA' }, { where: { id_evento: 1 } }),
            () => modelo.destroy({ where: { id_evento: 1 } }),
            () => modelo.truncate(), () => historico.destroy(),
            () => modelo.upsert(data),
            () => { historico.set('accion', 'OTRA'); return historico.save(); }
        ]) await assert.rejects(operacion(), /no admiten modificación/);
    } finally { await sequelize.close(); }
});
