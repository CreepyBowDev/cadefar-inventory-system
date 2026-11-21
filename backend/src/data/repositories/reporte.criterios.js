import { Op, fn, literal } from 'sequelize';
import { MOTIVOS_MOVIMIENTO } from '../../shared/constants/motivos-movimiento.js';

// Expresiones exclusivamente servidor. El cursor futuro debe usar la expresión
// original, nunca el DATE_FORMAT a segundos de la representación pública.
export const categoriaVenta = literal(`CASE WHEN estado_operacion = 'ANULADA' THEN
    CASE WHEN fecha_venta IS NULL THEN 'ANULADA_SIN_CONFIRMAR' ELSE 'ANULADA_CONFIRMADA' END
    ELSE estado_operacion END`);
export const fechaReferenciaVenta = literal(`CASE WHEN estado_operacion = 'PENDIENTE'
    OR (estado_operacion = 'ANULADA' AND fecha_venta IS NULL)
    THEN fecha_registro ELSE fecha_venta END`);
// RN91: exactitud DECIMAL y redondeo individual ANTES de SUM.
export const perdidaIndividual = literal('ROUND(CAST(`MovimientoInventario`.`cantidad` AS DECIMAL(10,0)) * `MovimientoInventario`.`costo_unitario_aplicado`, 2)');

const rangoFechaHora = ({ desdeFechaHora, hastaFechaHora }) => ({
    [Op.gte]: fn('STR_TO_DATE', desdeFechaHora, '%Y-%m-%d %H:%i:%s'),
    [Op.lte]: fn('STR_TO_DATE', hastaFechaHora, '%Y-%m-%d %H:%i:%s.%f')
});

export const criteriosVentas = filtros => {
    const rango = () => rangoFechaHora(filtros);
    const where = { [Op.or]: [
        { estado_operacion: 'CONFIRMADA', fecha_venta: rango() },
        { estado_operacion: 'PENDIENTE', fecha_registro: rango() },
        { estado_operacion: 'ANULADA', fecha_venta: { [Op.ne]: null, ...rango() } },
        { estado_operacion: 'ANULADA', fecha_venta: null, fecha_registro: rango() }
    ] };
    if (filtros.estadoOperacion !== undefined) where.estado_operacion = filtros.estadoOperacion;
    return where;
};

export const criteriosCompras = ({ periodo, estadoOperacion }) => {
    const where = { fecha_compra: { [Op.gte]: periodo.desde, [Op.lte]: periodo.hasta } };
    if (estadoOperacion !== undefined) where.estado_operacion = estadoOperacion;
    return where;
};

export const criteriosPerdidas = filtros => ({
    direccion: 'SALIDA',
    motivo: filtros.motivo ?? { [Op.in]: [MOTIVOS_MOVIMIENTO.VENCIMIENTO, MOTIVOS_MOVIMIENTO.DANO] },
    id_movimiento_original: null,
    fecha_movimiento: rangoFechaHora(filtros)
});
