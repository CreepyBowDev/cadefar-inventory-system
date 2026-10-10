import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Sequelize, DataTypes } from 'sequelize';

const require = createRequire(import.meta.url);
const migracion = require('../src/data/database/migrations/20261010120000-add-compra-existencia-snapshots.js');
const definirDetalleCompra = require('../src/data/models/detalle-compra.js');

// Verificación sin ejecutar DDL ni conectar a MySQL. La aceptación real del
// CHECK, los límites y la preservación de filas se verifican al aplicar B1
// en la base aislada que se autorice por separado.
test('B1: emite un único ALTER aditivo, con NULL históricos y par completo no negativo', async () => {
    const consultas = [];
    await migracion.up({ sequelize: { query: async sql => { consultas.push(sql); } } });
    assert.equal(consultas.length, 1, 'Columnas y CHECK se agregan en una sola sentencia');
    const [sql] = consultas;
    assert.match(sql, /^\s*ALTER TABLE `detalle_compra`/);
    assert.match(sql, /ADD COLUMN `saldo_anterior` INT NULL/);
    assert.match(sql, /ADD COLUMN `costo_promedio_anterior` DECIMAL\(14,6\) NULL/);
    assert.match(sql, /ADD CONSTRAINT `chk_detalle_compra_estado_anterior`/);
    assert.match(sql, /\(`saldo_anterior` IS NULL AND `costo_promedio_anterior` IS NULL\)/);
    assert.match(sql, /`saldo_anterior` IS NOT NULL\s+AND `costo_promedio_anterior` IS NOT NULL\s+AND `saldo_anterior` >= 0\s+AND `costo_promedio_anterior` >= 0/);
    assert.doesNotMatch(sql, /\b(?:DEFAULT|UPDATE|INSERT|DELETE|MODIFY|DROP)\b/i);
    assert.equal((sql.match(/ADD COLUMN/g) || []).length, 2);
});

test('B1: propaga un fallo DDL sin intentar modificar históricos ni completar parcialmente', async () => {
    const fallo = new Error('fallo_ddl_sintetico');
    let llamadas = 0;
    const queryInterface = { sequelize: { query: async () => { llamadas++; throw fallo; } } };
    await assert.rejects(migracion.up(queryInterface), error => error === fallo);
    assert.equal(llamadas, 1);
});

test('B1 down: conserva snapshots existentes y no emite ALTER cuando hay información', async () => {
    for (const conEstadoAnterior of [1, '2']) {
        const consultas = [];
        const queryInterface = { sequelize: { query: async (sql, options) => {
            consultas.push(sql);
            assert.equal(options.type, Sequelize.QueryTypes.SELECT);
            assert.match(sql, /WHERE `saldo_anterior` IS NOT NULL OR `costo_promedio_anterior` IS NOT NULL/);
            return [{ con_estado_anterior: conEstadoAnterior }];
        } } };
        await assert.rejects(migracion.down(queryInterface, Sequelize), /Se debe conservar esa información histórica/);
        assert.equal(consultas.length, 1);
        assert.match(consultas[0], /^SELECT /);
    }
});

test('B1 down: permite retirar solo el par sin datos y su CHECK en un único ALTER', async () => {
    const consultas = [];
    const queryInterface = { sequelize: { query: async (sql, options) => {
        consultas.push(sql);
        if (options?.type === Sequelize.QueryTypes.SELECT) return [{ con_estado_anterior: '0' }];
    } } };
    await migracion.down(queryInterface, Sequelize);
    assert.equal(consultas.length, 2);
    assert.match(consultas[1], /^\s*ALTER TABLE `detalle_compra`/);
    assert.match(consultas[1], /DROP CHECK `chk_detalle_compra_estado_anterior`/);
    assert.match(consultas[1], /DROP COLUMN `saldo_anterior`/);
    assert.match(consultas[1], /DROP COLUMN `costo_promedio_anterior`/);
    assert.doesNotMatch(consultas[1], /\b(?:UPDATE|INSERT|DELETE|DROP TABLE)\b/i);
});

test('B1 down: si falla la lectura previa, no intenta eliminar las columnas', async () => {
    const fallo = new Error('fallo_select_sintetico');
    let llamadas = 0;
    const queryInterface = { sequelize: { query: async () => { llamadas++; throw fallo; } } };
    await assert.rejects(migracion.down(queryInterface, Sequelize), error => error === fallo);
    assert.equal(llamadas, 1);
});

test('DetalleCompra: declara el par nullable sin fabricar snapshots ni cambiar tipos anteriores', async t => {
    const sequelize = new Sequelize('b1_sin_conexion', 'sintetico', 'sintetico', {
        dialect: 'mysql', logging: false
    });
    t.mock.method(sequelize.connectionManager, 'getConnection', () => {
        throw new Error('Estas pruebas no deben conectar a MySQL');
    });
    try {
        const DetalleCompra = definirDetalleCompra(sequelize, DataTypes);
        const atributos = DetalleCompra.getAttributes();
        assert.equal(atributos.saldo_anterior.type.toSql(), 'INTEGER');
        assert.equal(atributos.costo_promedio_anterior.type.toSql(), 'DECIMAL(14,6)');
        for (const campo of ['saldo_anterior', 'costo_promedio_anterior']) {
            assert.equal(atributos[campo].allowNull, true);
            assert.equal(atributos[campo].defaultValue, undefined);
        }
        assert.equal(atributos.costo_unitario.type.toSql(), 'DECIMAL(14,6)');
        assert.equal(atributos.subtotal.type.toSql(), 'DECIMAL(14,2)');
        assert.equal(atributos.id_detalle_compra.autoIncrement, true);
        assert.equal(DetalleCompra.tableName, 'detalle_compra');
        assert.equal(DetalleCompra.options.timestamps, false);
        const camposHistoricos = { id_compra: 1, id_existencia: 2, cantidad: 3,
            costo_unitario: '0.500000', subtotal: '1.50' };
        const historico = DetalleCompra.build(camposHistoricos);
        for (const campo of ['saldo_anterior', 'costo_promedio_anterior']) {
            assert.equal(historico.get(campo), undefined, 'Sin inferencia para históricos');
        }
        const desconocido = DetalleCompra.build({ ...camposHistoricos,
            saldo_anterior: null, costo_promedio_anterior: null });
        assert.equal(desconocido.get('saldo_anterior'), null);
        assert.equal(desconocido.get('costo_promedio_anterior'), null);
        const nueva = DetalleCompra.build({ ...camposHistoricos,
            saldo_anterior: 0, costo_promedio_anterior: '0.000000' });
        assert.equal(nueva.get('saldo_anterior'), 0);
        assert.equal(nueva.get('costo_promedio_anterior'), '0.000000');
        const agotada = DetalleCompra.build({ ...camposHistoricos,
            saldo_anterior: 0, costo_promedio_anterior: '99999999.999999' });
        assert.equal(agotada.get('costo_promedio_anterior'), '99999999.999999');
        const limite = DetalleCompra.build({ ...camposHistoricos,
            saldo_anterior: 2147483647, costo_promedio_anterior: '99999999.999999' });
        assert.equal(limite.get('saldo_anterior'), 2147483647);
        assert.equal(limite.get('costo_promedio_anterior'), '99999999.999999');
    } finally {
        await sequelize.close();
    }
});
