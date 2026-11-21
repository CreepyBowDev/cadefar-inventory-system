import { Op, col, where } from 'sequelize';

// Mismos filtros civiles de CU40; sin reglas operativas ni reconstrucción de saldo.
export const criteriosMovimientos = ({ idExistencia, desde, hasta, direccion, motivo } = {}) => {
    const filtros = {};
    if (idExistencia !== undefined) filtros.id_existencia = idExistencia;
    if (direccion !== undefined) filtros.direccion = direccion;
    if (motivo !== undefined) filtros.motivo = motivo;
    const fechas = [];
    if (desde !== undefined) fechas.push(where(col('MovimientoInventario.fecha_movimiento'), Op.gte, `${desde} 00:00:00`));
    if (hasta !== undefined) fechas.push(where(col('MovimientoInventario.fecha_movimiento'), Op.lte, `${hasta} 23:59:59.999999`));
    if (fechas.length) filtros[Op.and] = fechas;
    return filtros;
};
