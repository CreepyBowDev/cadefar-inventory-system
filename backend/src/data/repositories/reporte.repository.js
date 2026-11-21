import db from '../models/index.js';
import { criteriosVentas, criteriosCompras, criteriosPerdidas, categoriaVenta as categoria,
    fechaReferenciaVenta as fechaReferencia, perdidaIndividual } from './reporte.criterios.js';
import { antesSelectReporte } from './reporte-plazo-sql.js';

const { Venta, Compra, MovimientoInventario, ExistenciaMedicamento, Medicamento, Sequelize } = db;
const { fn, col, cast } = Sequelize;

export class reporteRepository {
    static async estadisticasPerdidas(filtros, { transaction }) {
        const where = criteriosPerdidas(filtros);
        const formato = { DIA: '%Y-%m-%d', MES: '%Y-%m', ANIO: '%Y' }[filtros.granularidad];
        if (!formato) throw new RangeError('Granularidad inválida');
        const temporal = fn('DATE_FORMAT', col('fecha_movimiento'), formato);
        // Movimientos originales únicos, sin joins. RN91 compartida con el reporte vigente.
        const medidas = [[cast(fn('COUNT', col('id_movimiento')), 'CHAR'), 'cantidad_retiros'],
            [cast(fn('SUM', col('cantidad')), 'CHAR'), 'cantidad_retirada'],
            [cast(fn('SUM', perdidaIndividual), 'CHAR'), 'perdida']];
        await antesSelectReporte(transaction);
        const grupos = await MovimientoInventario.findAll({ where, transaction, raw: true,
            attributes: ['motivo', ...medidas], group: ['motivo'] });
        await antesSelectReporte(transaction);
        const temporales = await MovimientoInventario.findAll({ where, transaction, raw: true,
            attributes: ['motivo', [temporal, 'etiqueta'], ...medidas],
            group: ['motivo', temporal], order: [[temporal, 'ASC']] });
        return { grupos, temporales };
    }

    static async estadisticasVentas(filtros, { transaction }) {
        return agregarEstadisticas(Venta, criteriosVentas(filtros), categoria, fechaReferencia,
            'id_venta', 'categoria', filtros.granularidad, transaction);
    }

    static async estadisticasCompras(filtros, { transaction }) {
        return agregarEstadisticas(Compra, criteriosCompras(filtros), col('estado_operacion'),
            col('fecha_compra'), 'id_compra', 'estado_operacion', filtros.granularidad, transaction);
    }

    static async consultarPerdidas({ desdeFechaHora, hastaFechaHora, motivo, pagina, limite }, { transaction }) {
        const where = criteriosPerdidas({ desdeFechaHora, hastaFechaHora, motivo });
        // INTEGER × DECIMAL permanece exacto. ROUND de un valor exacto no negativo
        // equivale a dividirYRedondear(Q * costoEnMillonesimas, 10000n).
        // Redondear ANTES de SUM; no estrechar el resultado al tamaño de una columna.
        const grupos = await consultarResumenPerdidas(where, transaction);
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
        const where = criteriosCompras({ periodo, estadoOperacion });
        // Cabeceras históricas, sin joins ni restricciones por actividad del proveedor.
        // El conteo completo sale de los mismos grupos que el resumen, no de la página.
        const grupos = await consultarResumenCompras(where, transaction);
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
        const where = criteriosVentas({ desdeFechaHora, hastaFechaHora, estadoOperacion });
        // Solo cabeceras: COUNT y SUM no dependen de detalles, recetas o catálogo.
        // CAST preserva el transporte textual de DECIMAL, incluso en sumas grandes.
        const grupos = await consultarResumenVentas(where, transaction);
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

// Agregados compartidos por GET y extracción completa; no página ni auditoría.
const contarResumen = (campo, textual) => textual ? cast(fn('COUNT', col(campo)), 'CHAR') : fn('COUNT', col(campo));
export const consultarResumenVentas = async (where, transaction, textual = false) => {
    await antesSelectReporte(transaction);
    return Venta.findAll({ where, transaction, raw: true,
        attributes: [[categoria, 'categoria'], [contarResumen('id_venta', textual), 'cantidad'],
            [cast(fn('SUM', col('total')), 'CHAR'), 'importe']], group: [categoria] });
};
export const consultarResumenCompras = async (where, transaction, textual = false) => {
    await antesSelectReporte(transaction);
    return Compra.findAll({ where, transaction, raw: true,
        attributes: ['estado_operacion', [contarResumen('id_compra', textual), 'cantidad'],
            [cast(fn('SUM', col('total')), 'CHAR'), 'importe']], group: ['estado_operacion'] });
};
export const consultarResumenPerdidas = async (where, transaction, textual = false) => {
    await antesSelectReporte(transaction);
    return MovimientoInventario.findAll({ where, transaction, raw: true,
        attributes: ['motivo', [contarResumen('id_movimiento', textual), 'cantidad_retiros'],
            [cast(fn('SUM', col('cantidad')), 'CHAR'), 'cantidad_retirada'],
            [cast(fn('SUM', perdidaIndividual), 'CHAR'), 'perdida']], group: ['motivo'] });
};

// Solo dos agregados de cabeceras: ninguna lectura de detalle ni join hasMany.
const agregarEstadisticas = async (modelo, where, categoria, fecha, id, campoCategoria, granularidad, transaction) => {
    const formato = { DIA: '%Y-%m-%d', MES: '%Y-%m', ANIO: '%Y' }[granularidad];
    if (!formato) throw new RangeError('Granularidad inválida');
    const temporal = fn('DATE_FORMAT', fecha, formato);
    const medidas = [[cast(fn('COUNT', col(id)), 'CHAR'), 'cantidad'],
        [cast(fn('SUM', col('total')), 'CHAR'), 'importe']];
    await antesSelectReporte(transaction);
    const grupos = await modelo.findAll({ where, transaction, raw: true,
        attributes: [[categoria, campoCategoria], ...medidas], group: [categoria] });
    await antesSelectReporte(transaction);
    const temporales = await modelo.findAll({ where, transaction, raw: true,
        attributes: [[categoria, campoCategoria], [temporal, 'etiqueta'], ...medidas],
        group: [categoria, temporal], order: [[temporal, 'ASC']] });
    return { grupos, temporales };
};
