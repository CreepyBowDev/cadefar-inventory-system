import db from '../models/index.js';

const { MovimientoInventario, ExistenciaMedicamento, Medicamento, Usuario,
    DetalleCompra, DetalleVenta, Compra, Venta, Sequelize } = db;
const { Op, fn, col, where } = Sequelize;

export class movimientoInventarioRepository {
    static async findParaAnular({ idsExistencias, idsDetalles, transaction }) {
        // Lectura actual bajo bloqueo, incluso si la transacción esperó otra
        // compra. Incluir enlaces a detalles fuera de su existencia detecta
        // originales mal asociados, en vez de ignorarlos.
        return MovimientoInventario.findAll({ where: { [Op.or]: [
            { id_existencia: { [Op.in]: idsExistencias } },
            { id_detalle_compra: { [Op.in]: idsDetalles } }
        ] }, transaction, lock: transaction.LOCK.UPDATE, order: [['id_movimiento', 'ASC']] });
    }

    static async findReversiones({ idsOriginales, transaction }) {
        return MovimientoInventario.findAll({ where: { id_movimiento_original: { [Op.in]: idsOriginales } },
            transaction, lock: transaction.LOCK.UPDATE, order: [['id_movimiento', 'ASC']] });
    }

    static async findReferenciasParaAnular({ idsDetallesCompra, idsDetallesVenta, transaction }) {
        // Se consulta después de bloquear existencias e historial. Es la primera
        // lectura consistente de CU27; no añade bloqueos de otras cabeceras al
        // protocolo existente. Las anulaciones confirman estado y movimientos
        // atómicamente, manteniendo el bloqueo de la existencia hasta el commit.
        const detallesCompra = idsDetallesCompra.length ? await DetalleCompra.findAll({
            where: { id_detalle_compra: { [Op.in]: idsDetallesCompra } }, transaction,
            attributes: ['id_detalle_compra', 'id_compra', 'id_existencia', 'cantidad', 'costo_unitario'],
            include: [{ model: Compra, as: 'compra', attributes: ['id_compra', 'estado_operacion'] }]
        }) : [];
        const detallesVenta = idsDetallesVenta.length ? await DetalleVenta.findAll({
            where: { id_detalle_venta: { [Op.in]: idsDetallesVenta } }, transaction,
            attributes: ['id_detalle_venta', 'id_venta', 'id_existencia', 'cantidad'],
            include: [{ model: Venta, as: 'venta', attributes: ['id_venta', 'estado_operacion'] }]
        }) : [];
        return { detallesCompra, detallesVenta };
    }

    static async create({ data, transaction }) {
        return MovimientoInventario.create({ ...data,
            fecha_movimiento: fn('STR_TO_DATE', data.fecha_movimiento, '%Y-%m-%d %H:%i:%s')
        }, { transaction });
    }

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
