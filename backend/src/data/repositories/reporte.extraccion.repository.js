import db from '../models/index.js';
import { criteriosVentas, criteriosCompras, criteriosPerdidas, categoriaVenta,
    fechaReferenciaVenta } from './reporte.criterios.js';
import { criteriosMovimientos } from './movimiento.criterios.js';
import { consultarResumenVentas, consultarResumenCompras, consultarResumenPerdidas } from './reporte.repository.js';

const { Venta, Compra, MovimientoInventario, ExistenciaMedicamento, Medicamento,
    Usuario, DetalleCompra, DetalleVenta, Sequelize } = db;
const { Op, fn, col, cast, where } = Sequelize;
const texto = (expresion, nombre) => [cast(expresion, 'CHAR'), nombre];
const fecha = (campo, nombre = campo, formato = '%Y-%m-%d %H:%i:%s') => [fn('DATE_FORMAT', col(campo), formato), nombre];
const existencia = filtros => ({ model: ExistenciaMedicamento, as: 'existencia', attributes: [],
    ...(filtros ? { required: true, ...(filtros.idMedicamento === undefined ? {} : { where: { id_medicamento: filtros.idMedicamento } }) } : {}),
    include: [{ model: Medicamento, as: 'medicamento', attributes: [] }] });
const catalogo = [[col('existencia.id_medicamento'), 'id_medicamento'],
    [col('existencia.codigo_existencia'), 'codigo_existencia'],
    [col('existencia.medicamento.codigo_medicamento'), 'codigo_medicamento'],
    [col('existencia.medicamento.nombre_comercial'), 'nombre_comercial'],
    [col('movimientoReversion.id_movimiento'), 'id_movimiento_reversion']];
const reversion = { model: MovimientoInventario, as: 'movimientoReversion', attributes: [] };
const seleccion = (fuente, filtros) => {
    if (fuente === 'VENTAS') return { modelo: Venta, where: criteriosVentas(filtros),
        fecha: fechaReferenciaVenta, id: col('Venta.id_venta'),
        atributos: ['id_venta', 'estado_operacion', [categoriaVenta, 'categoria'],
            [fn('DATE_FORMAT', fechaReferenciaVenta, '%Y-%m-%d %H:%i:%s'), 'fecha_referencia'],
            ...['fecha_registro', 'fecha_venta', 'fecha_anulacion'].map(c => fecha(c)), texto(col('total'), 'total')] };
    if (fuente === 'COMPRAS') return { modelo: Compra, where: criteriosCompras(filtros),
        fecha: col('Compra.fecha_compra'), id: col('Compra.id_compra'), civil: true,
        atributos: ['id_compra', 'id_proveedor_laboratorio', 'estado_operacion', fecha('fecha_compra', 'fecha_compra', '%Y-%m-%d'),
            fecha('fecha_registro'), fecha('fecha_anulacion'), texto(col('total'), 'total')] };
    if (!['PERDIDAS', 'MOVIMIENTOS'].includes(fuente)) throw new TypeError('Fuente inválida');
    const movimiento = fuente === 'MOVIMIENTOS';
    return { modelo: MovimientoInventario, where: movimiento ? criteriosMovimientos(filtros) : criteriosPerdidas(filtros),
        fecha: col('MovimientoInventario.fecha_movimiento'), id: col('MovimientoInventario.id_movimiento'),
        atributos: ['id_movimiento', 'id_existencia', 'id_usuario', 'motivo', texto(col('MovimientoInventario.cantidad'), 'cantidad'),
            texto(col('MovimientoInventario.costo_unitario_aplicado'), 'costo_unitario_aplicado'),
            fecha('MovimientoInventario.fecha_movimiento', 'fecha_movimiento'), ...catalogo,
            ...(movimiento ? ['direccion', 'id_detalle_compra', 'id_detalle_venta', 'id_movimiento_original',
                [col('usuario.nombre_usuario'), 'nombre_usuario'], [col('detalleCompra.id_compra'), 'id_compra'],
                [col('detalleVenta.id_venta'), 'id_venta']] : [])],
        include: [existencia(movimiento ? filtros : null), reversion,
            ...(movimiento ? [{ model: Usuario, as: 'usuario', attributes: [] },
                { model: DetalleCompra, as: 'detalleCompra', attributes: [] }, { model: DetalleVenta, as: 'detalleVenta', attributes: [] }] : [])],
        includeConteo: movimiento ? [existencia(filtros)] : undefined };
};

// No abre transacciones ni audita. El llamante conserva una conexión/snapshot.
export class reporteExtraccionRepository {
    static async resumen(fuente, filtros, { transaction }) {
        if (!transaction) throw new TypeError('Snapshot obligatorio');
        const s = seleccion(fuente, filtros);
        if (fuente !== 'MOVIMIENTOS') return { VENTAS: consultarResumenVentas,
            COMPRAS: consultarResumenCompras, PERDIDAS: consultarResumenPerdidas }[fuente](s.where, transaction, true);
        return s.modelo.findAll({ attributes: [texto(fn('COUNT', s.id), 'cantidad')], where: s.where,
            include: s.includeConteo, transaction, raw: true });
    }

    static async bloque(fuente, filtros, { transaction, cursor = null, limite = 1000 }) {
        if (!transaction || !Number.isInteger(limite) || limite < 1 || limite > 1000) throw new TypeError('Bloque inválido');
        const s = seleccion(fuente, filtros);
        // DATE_FORMAT(...%f) produce texto exacto del motor; nunca Date JS o DTO a segundos.
        const clave = fn('DATE_FORMAT', s.fecha, s.civil ? '%Y-%m-%d' : '%Y-%m-%d %H:%i:%s.%f');
        let predicado = s.where;
        if (cursor) {
            if (!/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2}\.\d{6})?$/.test(cursor.fecha) || !/^[1-9]\d*$/.test(cursor.id)) throw new TypeError('Cursor inválido');
            const valor = s.civil ? cursor.fecha : fn('STR_TO_DATE', cursor.fecha, '%Y-%m-%d %H:%i:%s.%f');
            predicado = { [Op.and]: [s.where, { [Op.or]: [where(s.fecha, Op.lt, valor),
                { [Op.and]: [where(s.fecha, Op.eq, valor), where(s.id, Op.lt, cursor.id)] }] }] };
        }
        return s.modelo.findAll({ attributes: [...s.atributos, [clave, '_cursor_fecha'], texto(s.id, '_cursor_id')],
            where: predicado, include: s.include, transaction, raw: true, limit: limite,
            order: [[s.fecha, 'DESC'], [s.id, 'DESC']] });
    }
}
