import test from 'node:test';
import assert from 'node:assert/strict';

// Service real con Repositories y commit/rollback simulados en memoria.
// No demuestra aislamiento ni bloqueo real de InnoDB; no conecta a MySQL.
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'anulacion_compra_sin_conexion';
const { default: db } = await import('../src/data/models/index.js');
const { compraService } = await import('../src/business/services/compra.service.js');
const { compraRepository } = await import('../src/data/repositories/compra.repository.js');
const { existenciaMedicamentoRepository } = await import('../src/data/repositories/existencia-medicamento.repository.js');
const { movimientoInventarioRepository } = await import('../src/data/repositories/movimiento-inventario.repository.js');

test('CU27: motivos, referencias e integridad con B1/A, sin MySQL', async t => {
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => {
        throw new Error('Esta suite no permite conexiones MySQL');
    });
    const movimiento = (id, extra = {}) => ({
        id_movimiento: id, id_existencia: 3, id_usuario: 1, id_detalle_compra: null,
        id_detalle_venta: null, id_movimiento_original: null, direccion: 'ENTRADA',
        cantidad: 5, costo_unitario_aplicado: '1.000000', motivo: 'COMPRA',
        fecha_movimiento: '2026-09-05 09:00:00', observacion: null, ...extra
    });
    const fixture = () => ({
        compra: { id_compra: 20, id_usuario: 1, id_proveedor_laboratorio: 5,
            estado_operacion: 'CONFIRMADA', fecha_anulacion: null, motivo_anulacion: null,
            id_usuario_anulador: null, total: '6.00', fecha_compra: '2026-09-05',
            fecha_registro: '2026-09-05 09:00:00', clave_operacion: 'prueba-motivos' },
        detalles: [{ id_detalle_compra: 201, id_compra: 20, id_existencia: 3,
            cantidad: 3, costo_unitario: '2.000000', subtotal: '6.00',
            saldo_anterior: 5, costo_promedio_anterior: '1.000000' }],
        existencias: [{ id_existencia: 3, cantidad_fisica: 8, costo_unitario_promedio: '1.375000' }],
        movimientos: [movimiento(1, { id_detalle_compra: 101 }),
            movimiento(10, { id_detalle_compra: 201, cantidad: 3, costo_unitario_aplicado: '2.000000' })],
        referenciasCompra: [], referenciasVenta: [], reversionesExternas: []
    });
    let estado, pendiente, eventos, fallo;
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    const reset = () => { estado = fixture(); pendiente = undefined; eventos = []; fallo = undefined; };
    const dentro = args => { assert.equal(args.transaction, transaction); assert.ok(pendiente); };
    t.mock.method(db.sequelize, 'transaction', async callback => {
        pendiente = structuredClone(estado); eventos.push('START');
        try {
            const result = await callback(transaction);
            estado = pendiente; pendiente = undefined; eventos.push('COMMIT');
            return result;
        } catch (error) {
            pendiente = undefined; eventos.push('ROLLBACK'); throw error;
        }
    });
    t.mock.method(compraRepository, 'findParaAnular', async args => {
        dentro(args); eventos.push('compra');
        return args.idCompra === pendiente.compra.id_compra ? pendiente.compra : null;
    });
    t.mock.method(compraRepository, 'findDetallesParaAnular', async args => {
        dentro(args); eventos.push('detalles'); return pendiente.detalles;
    });
    t.mock.method(existenciaMedicamentoRepository, 'findByIdParaAnular', async args => {
        dentro(args); eventos.push(`existencia:${args.idExistencia}`);
        return pendiente.existencias.find(e => e.id_existencia === args.idExistencia);
    });
    t.mock.method(movimientoInventarioRepository, 'findParaAnular', async args => {
        dentro(args); eventos.push('historial'); return pendiente.movimientos;
    });
    t.mock.method(movimientoInventarioRepository, 'findReferenciasParaAnular', async args => {
        dentro(args); eventos.push('referencias');
        assert.ok(eventos.indexOf('historial') < eventos.indexOf('referencias'));
        return {
            detallesCompra: pendiente.referenciasCompra.filter(d => args.idsDetallesCompra.includes(d.id_detalle_compra)),
            detallesVenta: pendiente.referenciasVenta.filter(d => args.idsDetallesVenta.includes(d.id_detalle_venta))
        };
    });
    t.mock.method(movimientoInventarioRepository, 'findReversiones', async args => {
        dentro(args); return pendiente.reversionesExternas.filter(m => args.idsOriginales.includes(m.id_movimiento_original));
    });
    t.mock.method(existenciaMedicamentoRepository, 'updateSaldoYCosto', async args => {
        dentro(args); eventos.push('saldo');
        const e = pendiente.existencias.find(e => e.id_existencia === args.idExistencia);
        e.cantidad_fisica = args.cantidadFisica; e.costo_unitario_promedio = args.costoUnitarioPromedio;
        return [1];
    });
    t.mock.method(movimientoInventarioRepository, 'create', async args => {
        dentro(args); eventos.push('movimiento');
        if (fallo === 'movimiento') throw new Error('fallo_sintetico');
        assert.equal(args.data.motivo, 'ANULACION_COMPRA');
        pendiente.movimientos.push({ id_movimiento: 100 + pendiente.movimientos.length, ...args.data });
    });
    t.mock.method(compraRepository, 'anular', async args => {
        dentro(args); eventos.push('anular');
        Object.assign(pendiente.compra, { estado_operacion: 'ANULADA', motivo_anulacion: args.motivo,
            fecha_anulacion: args.fechaHora, id_usuario_anulador: args.idUsuario });
        return [1];
    });
    t.mock.method(compraRepository, 'findById', async (id, args) => {
        dentro(args); assert.equal(id, 20); eventos.push('respuesta');
        return { ...pendiente.compra, detallesCompra: pendiente.detalles.map(d => ({ ...d,
            existencia: { ...pendiente.existencias.find(e => e.id_existencia === d.id_existencia),
                medicamento: { id_medicamento: 1, codigo_medicamento: 'PAR', estado: false } }
        })) };
    });
    const anular = () => compraService.anularCompra(20, 'Corrección', 1);
    const rechazar = async (mensaje = /inconsistente/) => {
        const before = structuredClone(estado);
        await assert.rejects(anular(), error => error.statusCode === 409 && mensaje.test(error.message));
        assert.deepEqual(estado, before); assert.equal(pendiente, undefined);
        assert.equal(eventos.at(-1), 'ROLLBACK'); assert.ok(!eventos.includes('saldo'));
    };
    const ventaAnulada = () => {
        // Reproduce las identidades del caso histórico 18/19 y detalle 7.
        estado.movimientos.push(
            movimiento(18, { id_detalle_venta: 7, motivo: 'VENTA', direccion: 'SALIDA', cantidad: 2, costo_unitario_aplicado: '0.800000' }),
            movimiento(19, { id_detalle_venta: 7, motivo: 'ANULACION_VENTA', id_movimiento_original: 18,
                cantidad: 2, costo_unitario_aplicado: '0.800000' })
        );
        estado.referenciasVenta.push({ id_detalle_venta: 7, id_existencia: 3, id_venta: 4, cantidad: 2,
            venta: { id_venta: 4, estado_operacion: 'ANULADA' } });
    };
    const compraPreviamenteAnulada = motivo => {
        estado.movimientos.splice(1, 0,
            movimiento(2, { id_detalle_compra: 102, cantidad: 2 }),
            movimiento(3, { id_detalle_compra: 102, cantidad: 2, direccion: 'SALIDA', motivo, id_movimiento_original: 2 }));
        estado.referenciasCompra.push({ id_detalle_compra: 102, id_compra: 42, id_existencia: 3,
            cantidad: 2, costo_unitario: '1.000000', compra: { id_compra: 42, estado_operacion: 'ANULADA' } });
    };
    for (const motivo of ['COMPRA', 'Compra']) {
        await t.test(`Original ${motivo}: B1 exacta y nueva compensación ANULACION_COMPRA`, async () => {
            reset(); estado.movimientos[1].motivo = motivo;
            const before = structuredClone(estado);
            const result = await anular();
            assert.equal(result.estadoOperacion, 'ANULADA'); assert.equal(eventos.at(-1), 'COMMIT');
            assert.deepEqual(estado.existencias[0], { id_existencia: 3, cantidad_fisica: 5, costo_unitario_promedio: '1.000000' });
            assert.deepEqual(estado.detalles, before.detalles);
            assert.deepEqual(estado.movimientos.slice(0, 2), before.movimientos);
            const compensacion = estado.movimientos.at(-1), original = before.movimientos[1];
            assert.equal(compensacion.motivo, 'ANULACION_COMPRA'); assert.equal(compensacion.direccion, 'SALIDA');
            for (const campo of ['id_existencia', 'id_detalle_compra', 'cantidad', 'costo_unitario_aplicado']) {
                assert.equal(compensacion[campo], original[campo]);
            }
            assert.equal(compensacion.id_detalle_venta, null); assert.equal(compensacion.id_movimiento_original, 10);
        });
    }
    for (const motivo of ['ANULACION_COMPRA', 'Reversión']) {
        await t.test(`Compensación previa ${motivo}: reconoce exclusivamente la compra legítima`, async () => {
            reset(); compraPreviamenteAnulada(motivo);
            const before = structuredClone(estado.movimientos);
            await anular(); assert.deepEqual(estado.movimientos.slice(0, before.length), before);
            assert.equal(estado.existencias[0].cantidad_fisica, 5);
        });
    }
    await t.test('Histórico 19 compensa VENTA 18: admite A sin alterar ni eliminar ambos movimientos', async () => {
        reset(); ventaAnulada(); const before = structuredClone(estado.movimientos);
        await anular(); assert.deepEqual(estado.movimientos.slice(0, 4), before);
        assert.equal(estado.existencias[0].cantidad_fisica, 5);
        assert.equal(estado.existencias[0].costo_unitario_promedio, '1.000000');
        assert.equal(estado.movimientos.at(-1).id_movimiento_original, 10);
    });
    for (const [nombre, cambiar] of [
        ['venta como compra', () => { estado.movimientos[1].motivo = 'VENTA'; }],
        ['detalle de compra ajeno', () => { estado.movimientos[1].id_detalle_compra = 999; }],
        ['detalle pertenece a otra compra', () => { estado.detalles[0].id_compra = 99; }],
        ['cantidad', () => { estado.movimientos[1].cantidad = 4; estado.existencias[0].cantidad_fisica = 9; }],
        ['costo', () => { estado.movimientos[1].costo_unitario_aplicado = '3.000000'; }],
        ['existencia', () => { estado.movimientos[1].id_existencia = 99; }],
        ['referencias simultáneas', () => { estado.movimientos[1].id_detalle_venta = 7; }],
        ['motivo de compensación sin original', () => { estado.movimientos[1].motivo = 'ANULACION_COMPRA'; }],
        ['variante no aprobada', () => { estado.movimientos[1].motivo = 'compra'; }],
        ['saldo no conciliado', () => { estado.existencias[0].cantidad_fisica = 9; }],
        ['snapshot parcial', () => { estado.detalles[0].saldo_anterior = null; }]
    ]) {
        await t.test(`Rechaza original inconsistente: ${nombre}`, async () => { reset(); cambiar(); await rechazar(); });
    }
    for (const [nombre, cambiar] of [
        ['ANULACION_VENTA con original de compra', () => { estado.movimientos.at(-1).id_movimiento_original = 10; }],
        ['Reversión no identifica una venta', () => { estado.movimientos.at(-1).motivo = 'Reversión'; }],
        ['ANULACION_COMPRA no identifica una venta', () => { estado.movimientos.at(-1).motivo = 'ANULACION_COMPRA'; }],
        ['detalle de venta diferente', () => { estado.movimientos.at(-1).id_detalle_venta = 8; }],
        ['detalle de compra incompatible', () => { estado.movimientos.at(-1).id_detalle_compra = 201; }],
        ['original ausente', () => { estado.movimientos.at(-1).id_movimiento_original = 999; }],
        ['referencia ausente', () => { estado.movimientos.at(-1).id_movimiento_original = null; }],
        ['original de otra existencia', () => { estado.movimientos.at(-2).id_existencia = 99; }],
        ['dirección igual', () => { estado.movimientos.at(-1).direccion = 'SALIDA'; }],
        ['cantidad distinta', () => { estado.movimientos.at(-1).cantidad = 3; }],
        ['costo distinto', () => { estado.movimientos.at(-1).costo_unitario_aplicado = '0.900000'; }],
        ['detalle inexistente', () => { estado.referenciasVenta = []; }],
        ['existencia del detalle ajena', () => { estado.referenciasVenta[0].id_existencia = 99; }],
        ['cantidad del detalle distinta', () => { estado.referenciasVenta[0].cantidad = 3; }],
        ['venta no anulada', () => { estado.referenciasVenta[0].venta.estado_operacion = 'CONFIRMADA'; }],
        ['cabecera de otra venta', () => { estado.referenciasVenta[0].venta.id_venta = 99; }],
        ['doble compensación', () => { estado.movimientos.push({ ...estado.movimientos.at(-1), id_movimiento: 21 }); }]
    ]) {
        await t.test(`Rechaza compensación de venta inconsistente: ${nombre}`, async () => {
            reset(); ventaAnulada(); cambiar(); await rechazar();
        });
    }
    for (const [nombre, cambiar] of [
        ['detalle diferente', () => { estado.movimientos[2].id_detalle_compra = 999; }],
        ['detalle ausente', () => { estado.referenciasCompra = []; }],
        ['detalle de venta incompatible', () => { estado.movimientos[2].id_detalle_venta = 7; }],
        ['motivo de venta', () => { estado.movimientos[2].motivo = 'ANULACION_VENTA'; }],
        ['costo del detalle distinto', () => { estado.referenciasCompra[0].costo_unitario = '2.000000'; }],
        ['compra confirmada', () => { estado.referenciasCompra[0].compra.estado_operacion = 'CONFIRMADA'; }],
        ['cabecera de otra compra', () => { estado.referenciasCompra[0].compra.id_compra = 99; }],
        ['referencia a una reversión', () => { estado.movimientos[2].id_movimiento_original = 3; }]
    ]) {
        await t.test(`Rechaza Reversión de compra inconsistente: ${nombre}`, async () => {
            reset(); compraPreviamenteAnulada('Reversión'); cambiar(); await rechazar();
        });
    }
    await t.test('Compra ya anulada: no vuelve a revertir', async () => {
        reset(); await anular(); eventos = []; await rechazar(/ya está anulada/);
    });
    await t.test('Reversión previa enlazada fuera del historial impide otra reversión', async () => {
        reset(); estado.reversionesExternas.push(movimiento(25, { id_movimiento_original: 10, id_existencia: 99 }));
        await rechazar();
    });
    await t.test('B1 restaura el promedio anterior de una agotada y respeta un único redondeo', async () => {
        for (const [saldo, costo, compraCosto, promedioActual] of [
            [0, '5.000000', '2.000000', '2.000000'], [1, '0.000001', '0.000002', '0.000002']
        ]) {
            reset(); estado.movimientos[0].cantidad = saldo;
            if (!saldo) estado.movimientos.shift();
            estado.movimientos.at(-1).cantidad = 1; estado.movimientos.at(-1).costo_unitario_aplicado = compraCosto;
            Object.assign(estado.detalles[0], { cantidad: 1, costo_unitario: compraCosto, saldo_anterior: saldo, costo_promedio_anterior: costo });
            Object.assign(estado.existencias[0], { cantidad_fisica: saldo + 1, costo_unitario_promedio: promedioActual });
            await anular(); assert.equal(estado.existencias[0].cantidad_fisica, saldo);
            assert.equal(estado.existencias[0].costo_unitario_promedio, costo);
        }
    });
    await t.test('A conserva restricciones de stock y valoración residual', async () => {
        for (const [salida, promedio, mensaje] of [
            [6, '1.375000', /stock físico insuficiente/],
            [1, '0.100000', /valoración residual/], [5, '1.000000', /valoración residual/]
        ]) {
            reset(); estado.movimientos.push(movimiento(21, { direccion: 'SALIDA', cantidad: salida, motivo: 'DAÑO' }));
            estado.existencias[0].cantidad_fisica -= salida; estado.existencias[0].costo_unitario_promedio = promedio;
            await rechazar(mensaje);
        }
    });
    await t.test('AJUSTE oficial de entrada posterior: A conserva unidades agregadas y snapshots', async () => {
        reset();
        estado.movimientos.push(movimiento(21, { cantidad: 2, motivo: 'AJUSTE' }));
        Object.assign(estado.existencias[0], { cantidad_fisica: 10, costo_unitario_promedio: '1.300000' });
        const originales = structuredClone(estado.movimientos), snapshots = structuredClone(estado.detalles);
        await anular();
        assert.equal(estado.existencias[0].cantidad_fisica, 7);
        assert.equal(estado.existencias[0].costo_unitario_promedio, '1.000000');
        assert.deepEqual(estado.movimientos.slice(0, originales.length), originales);
        assert.deepEqual(estado.detalles, snapshots);
    });
    await t.test('AJUSTE oficial de salida posterior: A usa valoración residual, sin restaurar B1', async () => {
        reset();
        estado.movimientos.push(movimiento(21, { direccion: 'SALIDA', cantidad: 1,
            costo_unitario_aplicado: '1.375000', motivo: 'AJUSTE' }));
        estado.existencias[0].cantidad_fisica = 7;
        await anular();
        assert.equal(estado.existencias[0].cantidad_fisica, 4);
        assert.equal(estado.existencias[0].costo_unitario_promedio, '0.906250');
    });
    await t.test('AJUSTE oficial agotó saldo: rechaza CU27 por stock sin compensaciones parciales', async () => {
        reset();
        estado.movimientos.push(movimiento(21, { direccion: 'SALIDA', cantidad: 8,
            costo_unitario_aplicado: '1.375000', motivo: 'AJUSTE' }));
        estado.existencias[0].cantidad_fisica = 0;
        await rechazar(/stock físico insuficiente/);
    });
    for (const motivo of ['VENCIMIENTO', 'DAÑO']) {
        await t.test(`${motivo} posterior: A respeta el retiro y conserva movimiento/costo/snapshots`, async () => {
            reset();
            estado.movimientos.push(movimiento(21, { direccion: 'SALIDA', cantidad: 1,
                costo_unitario_aplicado: '1.375000', motivo }));
            estado.existencias[0].cantidad_fisica = 7;
            const historial = structuredClone(estado.movimientos), snapshots = structuredClone(estado.detalles);
            await anular();
            assert.equal(estado.existencias[0].cantidad_fisica, 4);
            assert.equal(estado.existencias[0].costo_unitario_promedio, '0.906250');
            assert.deepEqual(estado.movimientos.slice(0, historial.length), historial);
            assert.deepEqual(estado.detalles, snapshots);
        });
        await t.test(`${motivo} agotó saldo: CU27 rechaza sin compensaciones parciales`, async () => {
            reset();
            estado.movimientos.push(movimiento(21, { direccion: 'SALIDA', cantidad: 8,
                costo_unitario_aplicado: '1.375000', motivo }));
            estado.existencias[0].cantidad_fisica = 0;
            await rechazar(/stock físico insuficiente/);
        });
    }
    await t.test('Legado sin snapshots: motivo válido no elude B1; A permite historial posterior íntegro', async () => {
        for (const motivo of ['COMPRA', 'Compra']) {
            reset(); estado.movimientos[1].motivo = motivo;
            estado.detalles[0].saldo_anterior = null; estado.detalles[0].costo_promedio_anterior = null;
            await rechazar(/falta el estado anterior de la compra histórica/);
            eventos = []; ventaAnulada(); await anular(); assert.equal(estado.existencias[0].cantidad_fisica, 5);
        }
    });
    await t.test('Mezcla B1/A: valida ambos grupos antes de compensar y conserva originales', async () => {
        reset(); ventaAnulada();
        estado.detalles.push({ ...estado.detalles[0], id_detalle_compra: 202, id_existencia: 4,
            cantidad: 1, saldo_anterior: 0, costo_promedio_anterior: '7.000000' });
        estado.existencias.push({ id_existencia: 4, cantidad_fisica: 1, costo_unitario_promedio: '2.000000' });
        estado.movimientos.push(movimiento(20, { id_existencia: 4, id_detalle_compra: 202, cantidad: 1, costo_unitario_aplicado: '2.000000' }));
        const before = structuredClone(estado.movimientos);
        await anular(); assert.deepEqual(estado.movimientos.slice(0, before.length), before);
        assert.deepEqual(estado.existencias.map(e => [e.cantidad_fisica, e.costo_unitario_promedio]), [[5, '1.000000'], [0, '7.000000']]);
        assert.deepEqual(estado.movimientos.slice(-2).map(m => m.id_movimiento_original), [10, 20]);
    });
    await t.test('Fallo al crear la compensación revierte el saldo y permite reintentar', async () => {
        reset(); const before = structuredClone(estado); fallo = 'movimiento';
        await assert.rejects(anular(), /fallo_sintetico/); assert.deepEqual(estado, before);
        assert.equal(eventos.at(-1), 'ROLLBACK'); fallo = undefined; eventos = [];
        await anular(); assert.equal(estado.movimientos.filter(m => m.id_movimiento_original === 10).length, 1);
    });
});

test('Referencias de compensaciones: SQL y asociaciones reales con transporte simulado', async t => {
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('No conectar a MySQL'); });
    // Sequelize clona opciones planas; una transacción real es una instancia.
    class TransaccionSimulada { LOCK = { UPDATE: 'UPDATE' }; }
    const consultas = [], transaction = new TransaccionSimulada();
    t.mock.method(db.sequelize, 'query', async (sql, options) => {
        consultas.push(sql); assert.match(sql, /^SELECT /); assert.equal(options.transaction, transaction);
        assert.doesNotMatch(sql, /FOR UPDATE|LOCK IN SHARE MODE/);
        const rows = options.model.name === 'DetalleCompra' ? [{ id_detalle_compra: 102, id_compra: 42,
            id_existencia: 3, cantidad: 2, costo_unitario: '1.000000', compra: { id_compra: 42, estado_operacion: 'ANULADA' } }]
            : [{ id_detalle_venta: 7, id_venta: 4, id_existencia: 3, cantidad: 2, venta: { id_venta: 4, estado_operacion: 'ANULADA' } }];
        return rows.map(row => options.model.build(row, { isNewRecord: false, raw: true, include: options.include }));
    });
    const result = await movimientoInventarioRepository.findReferenciasParaAnular({ idsDetallesCompra: [102], idsDetallesVenta: [7], transaction });
    assert.equal(result.detallesCompra[0].get({ plain: true }).compra.estado_operacion, 'ANULADA');
    assert.equal(result.detallesVenta[0].get({ plain: true }).venta.id_venta, 4);
    assert.match(consultas[0], /JOIN `compra` AS `compra` ON `DetalleCompra`.`id_compra` = `compra`.`id_compra`/);
    assert.match(consultas[0], /`DetalleCompra`.`id_detalle_compra` IN \(102\)/);
    assert.match(consultas[1], /JOIN `venta` AS `venta` ON `DetalleVenta`.`id_venta` = `venta`.`id_venta`/);
    assert.match(consultas[1], /`DetalleVenta`.`id_detalle_venta` IN \(7\)/);
    assert.deepEqual(await movimientoInventarioRepository.findReferenciasParaAnular({ idsDetallesCompra: [], idsDetallesVenta: [], transaction }),
        { detallesCompra: [], detallesVenta: [] });
    assert.equal(consultas.length, 2);
    await db.sequelize.close();
});
