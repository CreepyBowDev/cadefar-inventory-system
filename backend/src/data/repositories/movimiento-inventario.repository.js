import db from '../models/index.js';

const { MovimientoInventario, ExistenciaMedicamento, Medicamento, Usuario,
    DetalleCompra, DetalleVenta, Sequelize } = db;
const { Op, fn, col, where } = Sequelize;

export class movimientoInventarioRepository {
    static async findAll({ idMedicamento, idExistencia, desde, hasta, direccion, motivo } = {}) {
        const filtros = {};
        if (idExistencia !== undefined) filtros.id_existencia = idExistencia;
        if (direccion !== undefined) filtros.direccion = direccion;
        if (motivo !== undefined) filtros.motivo = motivo;

        // Comparar texto civil con el DATETIME guardado, sin convertirlo a UTC.
        // Los días desde/hasta son inclusivos según la fecha almacenada. La
        // convención histórica de esas horas aún requiere verificación en MySQL.
        const fechas = [];
        if (desde !== undefined) fechas.push(where(col('MovimientoInventario.fecha_movimiento'),
            Op.gte, `${desde} 00:00:00`));
        if (hasta !== undefined) fechas.push(where(col('MovimientoInventario.fecha_movimiento'),
            Op.lte, `${hasta} 23:59:59.999999`));
        if (fechas.length) filtros[Op.and] = fechas;

        return MovimientoInventario.findAll({
            attributes: ['id_movimiento', 'id_usuario', 'id_existencia', 'id_detalle_compra',
                'id_detalle_venta', 'id_movimiento_original', 'direccion', 'cantidad', 'motivo',
                'observacion', 'costo_unitario_aplicado',
                [fn('DATE_FORMAT', col('MovimientoInventario.fecha_movimiento'), '%Y-%m-%d %H:%i:%s'), 'fecha_movimiento']],
            where: filtros,
            include: [
                { model: Usuario, as: 'usuario', attributes: ['id_usuario', 'nombre_usuario'] },
                { model: ExistenciaMedicamento, as: 'existencia', required: true,
                    ...(idMedicamento !== undefined ? { where: { id_medicamento: idMedicamento } } : {}),
                    attributes: ['id_existencia', 'id_medicamento', 'codigo_existencia'],
                    include: [{ model: Medicamento, as: 'medicamento',
                        attributes: ['id_medicamento', 'codigo_medicamento', 'nombre_comercial', 'estado'] }] },
                { model: DetalleCompra, as: 'detalleCompra', attributes: ['id_detalle_compra', 'id_compra'] },
                { model: DetalleVenta, as: 'detalleVenta', attributes: ['id_detalle_venta', 'id_venta'] },
                { model: MovimientoInventario, as: 'movimientoReversion', attributes: ['id_movimiento'] }
            ],
            order: [['fecha_movimiento', 'DESC'], ['id_movimiento', 'DESC']]
        });
    }
}
