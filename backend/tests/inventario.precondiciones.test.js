import test from 'node:test';
import assert from 'node:assert/strict';

// SQL generado por Sequelize, sin abrir transacciones ni conexiones reales.
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'inventario_precondiciones_sin_conexion';

const { default: db } = await import('../src/data/models/index.js');
const { existenciaMedicamentoRepository } = await import('../src/data/repositories/existencia-medicamento.repository.js');
const { movimientoInventarioRepository } = await import('../src/data/repositories/movimiento-inventario.repository.js');

test('Fase 3.1: lecturas de precondiciones con SQL real generado y resultados simulados', async t => {
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => {
        throw new Error('La Fase 3.1 no conecta a MySQL');
    });
    // Solo el objeto de transacción; no se llama prepareEnvironment ni BEGIN.
    const transaction = new db.Sequelize.Transaction(db.sequelize);
    const queries = [];
    let existencia = { id_existencia: 5, id_medicamento: 2, codigo_existencia: 'INA-005',
        fecha_vencimiento: '2025-01-31', precision_vencimiento: 'MES',
        cantidad_fisica: 0, costo_unitario_promedio: '0.123456' };
    let movimiento = { id_movimiento: 2147483647 };
    t.mock.method(db.sequelize, 'query', async (sql, options) => {
        assert.match(sql, /^SELECT /);
        assert.equal(options.type, db.Sequelize.QueryTypes.SELECT);
        assert.equal(options.transaction, transaction);
        queries.push(sql);
        if (options.model === db.ExistenciaMedicamento) {
            return existencia ? db.ExistenciaMedicamento.build(existencia, { isNewRecord: false, raw: true }) : null;
        }
        assert.equal(options.model, db.MovimientoInventario);
        assert.equal(options.raw, true);
        return movimiento;
    });
    try {
        await t.test('Bloquea por PK sin filtro de saldo, actividad, medicamento ni vencimiento', async () => {
            const result = await existenciaMedicamentoRepository.findByIdParaMovimiento({ idExistencia: 5, transaction });
            assert.equal(result.cantidad_fisica, 0);
            assert.equal(result.costo_unitario_promedio, '0.123456');
            assert.match(queries.at(-1), /WHERE `ExistenciaMedicamento`.`id_existencia` = 5/);
            assert.match(queries.at(-1), /FOR UPDATE;$/);
            assert.doesNotMatch(queries.at(-1), /JOIN|`estado` =|`cantidad_fisica` [<>]|`fecha_vencimiento` [<>]/);
            existencia = null;
            assert.equal(await existenciaMedicamentoRepository.findByIdParaMovimiento({ idExistencia: 5, transaction }), null);
        });

        await t.test('Último ID: lectura actual FOR UPDATE, orden por ID y LIMIT 1, sin MAX de snapshot', async () => {
            assert.equal(await movimientoInventarioRepository.findUltimoIdParaExistencia({ idExistencia: 5, transaction }), 2147483647);
            assert.match(queries.at(-1), /^SELECT `id_movimiento` FROM `movimiento_inventario`/);
            assert.match(queries.at(-1), /WHERE `MovimientoInventario`.`id_existencia` = 5/);
            assert.match(queries.at(-1), /ORDER BY `MovimientoInventario`.`id_movimiento` DESC LIMIT 1 FOR UPDATE;$/);
            assert.doesNotMatch(queries.at(-1), /MAX\(|JOIN|fecha_movimiento|motivo|direccion/);
            movimiento = null;
            assert.equal(await movimientoInventarioRepository.findUltimoIdParaExistencia({ idExistencia: 5, transaction }), null);
            movimiento = { id_movimiento: 1 };
            assert.equal(await movimientoInventarioRepository.findUltimoIdParaExistencia({ idExistencia: 6, transaction }), 1);
            assert.match(queries.at(-1), /`id_existencia` = 6/);
        });

        await t.test('Sin transacción no se degrada a una lectura ordinaria', async () => {
            const count = queries.length;
            for (const leer of [existenciaMedicamentoRepository.findByIdParaMovimiento,
                movimientoInventarioRepository.findUltimoIdParaExistencia]) {
                await assert.rejects(leer({ idExistencia: 5 }), TypeError);
            }
            assert.equal(queries.length, count);
        });
        t.diagnostic(`${queries.length} SELECT generados; sin transacciones ni conexiones MySQL. La concurrencia real sigue pendiente en 3.4.`);
    } finally {
        await db.sequelize.close();
    }
});
