import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test'; process.env.DB_NAME_TEST = 'pago_sql_sin_conexion';
const { default: db } = await import('../src/data/models/index.js');
const { pagoCompraRepository: repo } = await import('../src/data/repositories/pago-compra.repository.js');

test('Pagos: SQL real mantiene bloqueos, asociación de compra, fechas civiles y DTO sin secretos del usuario', async t => {
    let sql;
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('No se autoriza MySQL'); });
    t.mock.method(db.sequelize, 'query', async (query, options) => {
        sql = query; assert.equal(options.type, db.Sequelize.QueryTypes.SELECT);
        return options.plain ? null : [];
    });
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    await repo.findById({ idCompra: 5, idPago: 10, transaction });
    assert.match(sql, /`id_pago` = 10/); assert.match(sql, /`id_compra` = 5/); assert.match(sql, /FOR UPDATE/);
    assert.match(sql, /DATE_FORMAT\(`PagoCompra`.`fecha_registro`/);
    await repo.findAll({ idCompra: 5, transaction, lock: true });
    assert.match(sql, /ORDER BY `PagoCompra`.`id_pago` ASC FOR UPDATE/);
    await repo.findHistorial({ idCompra: 5, transaction });
    assert.match(sql, /JOIN `usuario` AS `administrador`/); assert.doesNotMatch(sql, /password_hash|correo|version_credenciales/);
    assert.match(sql, /ORDER BY `PagoCompra`.`id_pago` DESC/);
    await repo.findComprometido({ idCompra: 5, transaction });
    assert.match(sql, /'PENDIENTE', 'PROCESANDO', 'CONFIRMADO'/); assert.match(sql, /FOR UPDATE/);
    assert.equal(db.Compra.associations.pagosCompra.target, db.PagoCompra);
    assert.equal(db.PagoCompra.associations.compra.target, db.Compra);
});
