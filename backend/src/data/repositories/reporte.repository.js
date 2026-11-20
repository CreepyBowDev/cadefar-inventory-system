import db from '../models/index.js';
import { MOTIVOS_MOVIMIENTO } from '../../shared/constants/motivos-movimiento.js';

const { Venta, Compra, MovimientoInventario, ExistenciaMedicamento, Medicamento, Sequelize } = db;
const { Op, fn, col, literal, cast } = Sequelize;
const categoria = literal(`CASE WHEN estado_operacion = 'ANULADA' THEN
    CASE WHEN fecha_venta IS NULL THEN 'ANULADA_SIN_CONFIRMAR' ELSE 'ANULADA_CONFIRMADA' END
    ELSE estado_operacion END`);
const fechaReferencia = literal(`CASE WHEN estado_operacion = 'PENDIENTE'
    OR (estado_operacion = 'ANULADA' AND fecha_venta IS NULL)
    THEN fecha_registro ELSE fecha_venta END`);

export class reporteRepository {
    static async consultarPerdidas({ desdeFechaHora, hastaFechaHora, motivo, pagina, limite }, { transaction }) {
        const where = { direccion: 'SALIDA', motivo: motivo ?? { [Op.in]: [MOTIVOS_MOVIMIENTO.VENCIMIENTO, MOTIVOS_MOVIMIENTO.DANO] },
            id_movimiento_original: null, fecha_movimiento: {
                [Op.gte]: fn('STR_TO_DATE', desdeFechaHora, '%Y-%m-%d %H:%i:%s'),
                [Op.lte]: fn('STR_TO_DATE', hastaFechaHora, '%Y-%m-%d %H:%i:%s.%f')
            } };
        // INTEGER × DECIMAL permanece exacto. ROUND de un valor exacto no negativo
        // equivale a dividirYRedondear(Q * costoEnMillonesimas, 10000n).
        // Redondear ANTES de SUM; no estrechar el resultado al tamaño de una columna.
        const perdidaIndividual = literal('ROUND(CAST(`MovimientoInventario`.`cantidad` AS DECIMAL(10,0)) * `MovimientoInventario`.`costo_unitario_aplicado`, 2)');
        const grupos = await MovimientoInventario.findAll({ where, transaction, raw: true,
            attributes: ['motivo', [fn('COUNT', col('id_movimiento')), 'cantidad_retiros'],
                [cast(fn('SUM', col('cantidad')), 'CHAR'), 'cantidad_retirada'],
                [cast(fn('SUM', perdidaIndividual), 'CHAR'), 'perdida']], group: ['motivo'] });
        // Solo belongsTo/hasOne únicos; el agregado anterior no contiene joins.
        const rows = await MovimientoInventario.findAll({ where, transaction, raw: true,
            attributes: ['id_movimiento', 'id_existencia', 'id_usuario', 'motivo', 'cantidad',
                [cast(col('MovimientoInventario.costo_unitario_aplicado'), 'CHAR'), 'costo_unitario_aplicado'],
                [fn('DATE_FORMAT', col('MovimientoInventario.fecha_movimiento'), '%Y-%m-%d %H:%i:%s'), 'fecha_movimiento'],
                [col('existencia.id_medicamento'), 'id_medicamento'],
                [col('existencia.codigo_existencia'), 'codigo_existencia'],
                [col('existencia.medicamento.codigo_medicamento'), 'codigo_medicamento'],
                [col('existencia.medicamento.nombre_comercial'), 'nombre_comercial'],
                [col('movimientoReversion.id_movimiento'), 'id_movimiento_reversion']],
            include: [{ model: ExistenciaMedicamento, as: 'existencia', attributes: [],
                include: [{ model: Medicamento, as: 'medicamento', attributes: [] }] },
            { model: MovimientoInventario, as: 'movimientoReversion', attributes: [] }],
            limit: limite, offset: (pagina - 1) * limite,
            order: [[col('MovimientoInventario.fecha_movimiento'), 'DESC'], ['id_movimiento', 'DESC']] });
        return { grupos, rows };
    }

    static async consultarCompras({ periodo, estadoOperacion, pagina, limite }, { transaction }) {
        const where = { fecha_compra: { [Op.gte]: periodo.desde, [Op.lte]: periodo.hasta } };
        if (estadoOperacion !== undefined) where.estado_operacion = estadoOperacion;
        // Cabeceras históricas, sin joins ni restricciones por actividad del proveedor.
        // El conteo completo sale de los mismos grupos que el resumen, no de la página.
        const grupos = await Compra.findAll({ where, transaction, raw: true,
            attributes: ['estado_operacion', [fn('COUNT', col('id_compra')), 'cantidad'],
                [cast(fn('SUM', col('total')), 'CHAR'), 'importe']], group: ['estado_operacion'] });
        const rows = await Compra.findAll({ where, transaction, raw: true,
            attributes: ['id_compra', 'id_proveedor_laboratorio', 'estado_operacion',
                [fn('DATE_FORMAT', col('fecha_compra'), '%Y-%m-%d'), 'fecha_compra'],
                ...['fecha_registro', 'fecha_anulacion'].map(campo =>
                    [fn('DATE_FORMAT', col(campo), '%Y-%m-%d %H:%i:%s'), campo]),
                [cast(col('total'), 'CHAR'), 'total']],
            limit: limite, offset: (pagina - 1) * limite,
            order: [[col('Compra.fecha_compra'), 'DESC'], ['id_compra', 'DESC']] });
        return { grupos, rows };
    }

    static async consultarVentas({ desdeFechaHora, hastaFechaHora, estadoOperacion, pagina, limite }, { transaction }) {
        const rango = () => ({
            [Op.gte]: fn('STR_TO_DATE', desdeFechaHora, '%Y-%m-%d %H:%i:%s'),
            [Op.lte]: fn('STR_TO_DATE', hastaFechaHora, '%Y-%m-%d %H:%i:%s.%f')
        });
        const where = { [Op.or]: [
            { estado_operacion: 'CONFIRMADA', fecha_venta: rango() },
            { estado_operacion: 'PENDIENTE', fecha_registro: rango() },
            { estado_operacion: 'ANULADA', fecha_venta: { [Op.ne]: null, ...rango() } },
            { estado_operacion: 'ANULADA', fecha_venta: null, fecha_registro: rango() }
        ] };
        if (estadoOperacion !== undefined) where.estado_operacion = estadoOperacion;
        // Solo cabeceras: COUNT y SUM no dependen de detalles, recetas o catálogo.
        // CAST preserva el transporte textual de DECIMAL, incluso en sumas grandes.
        const grupos = await Venta.findAll({ where, transaction, raw: true,
            attributes: [[categoria, 'categoria'], [fn('COUNT', col('id_venta')), 'cantidad'],
                [cast(fn('SUM', col('total')), 'CHAR'), 'importe']], group: [categoria] });
        const rows = await Venta.findAll({ where, transaction, raw: true,
            attributes: ['id_venta', 'estado_operacion', [categoria, 'categoria'],
                [fn('DATE_FORMAT', fechaReferencia, '%Y-%m-%d %H:%i:%s'), 'fecha_referencia'],
                ...['fecha_registro', 'fecha_venta', 'fecha_anulacion'].map(campo =>
                    [fn('DATE_FORMAT', col(campo), '%Y-%m-%d %H:%i:%s'), campo]),
                [cast(col('total'), 'CHAR'), 'total']],
            limit: limite, offset: (pagina - 1) * limite,
            order: [[fechaReferencia, 'DESC'], ['id_venta', 'DESC']] });
        return { grupos, rows };
    }
}
