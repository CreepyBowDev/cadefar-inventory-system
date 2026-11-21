import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const migration = require('../src/data/database/migrations/20261121120000-create-pago-compra.js');
const Sequelize = require('sequelize');

test('Migración aditiva: FK restrictivas, importes exactos, referencias únicas y ningún dato insertado', async () => {
    const llamadas = [], tablas = [];
    const qi = { createTable: async (nombre, atributos) => tablas.push({ nombre, atributos }),
        addIndex: async (...args) => llamadas.push(args), sequelize: { query: async sql => llamadas.push(sql) } };
    await migration.up(qi, Sequelize);
    assert.equal(tablas.length, 1); assert.equal(tablas[0].nombre, 'pago_compra');
    assert.equal(tablas[0].atributos.id_pago.autoIncrement, true);
    for (const field of ['id_compra', 'id_usuario']) assert.equal(tablas[0].atributos[field].onDelete, 'RESTRICT');
    assert.equal(llamadas.filter(x => Array.isArray(x) && x[2].unique).length, 3);
    assert.doesNotMatch(JSON.stringify(llamadas), /INSERT|UPDATE|DELETE|ALTER TABLE compra /i);
    assert.match(llamadas.at(-1), /fecha_verificacion IS NOT NULL/);
});
test('Rollback de la migración nunca borra historial financiero', async () => {
    let eliminada = false;
    const qi = { sequelize: { query: async () => [[{ cantidad: 1 }]] }, dropTable: async () => { eliminada = true; } };
    await assert.rejects(migration.down(qi), /historial/); assert.equal(eliminada, false);
    qi.sequelize.query = async () => [[{ cantidad: 0 }]]; await migration.down(qi); assert.equal(eliminada, true);
});
