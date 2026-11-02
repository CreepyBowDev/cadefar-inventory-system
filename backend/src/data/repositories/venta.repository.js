import db from '../models/index.js';

const { Venta, DetalleVenta, ExistenciaMedicamento, Medicamento, Receta, Usuario, Sequelize } = db;
const { Op, fn, col } = Sequelize;
const atributosVenta = [
    'id_venta', 'id_usuario', 'estado_operacion', 'clave_operacion', 'total',
    'motivo_anulacion', 'id_usuario_anulador',
    ...['fecha_registro', 'fecha_venta', 'fecha_anulacion'].map(campo =>
        [fn('DATE_FORMAT', col(`Venta.${campo}`), '%Y-%m-%d %H:%i:%s'), campo])
];
const relacionesCabecera = () => [
    { model: Usuario, as: 'usuarioRegistrador', attributes: ['id_usuario', 'nombre_usuario'] },
    { model: Usuario, as: 'usuarioAnulador', attributes: ['id_usuario', 'nombre_usuario'] }
];

export class ventaRepository {
    static async findParaAnular({ idVenta, transaction }) {
        return Venta.findByPk(idVenta, { transaction, lock: transaction.LOCK.UPDATE });
    }

    static async findDetallesParaAnular({ idVenta, transaction }) {
        return DetalleVenta.findAll({ where: { id_venta: idVenta }, transaction,
            lock: transaction.LOCK.UPDATE, order: [['id_detalle_venta', 'ASC']] });
    }

    static async anular({ idVenta, estadoAnterior, motivo, idUsuario, fechaHora, transaction }) {
        return Venta.update({ estado_operacion: 'ANULADA', motivo_anulacion: motivo,
            id_usuario_anulador: idUsuario,
            fecha_anulacion: fn('STR_TO_DATE', fechaHora, '%Y-%m-%d %H:%i:%s')
        }, { where: { id_venta: idVenta, estado_operacion: estadoAnterior,
            fecha_anulacion: null, motivo_anulacion: null, id_usuario_anulador: null }, transaction });
    }

    static async findParaConfirmar({ idVenta, transaction }) {
        return Venta.findByPk(idVenta, { transaction, lock: transaction.LOCK.UPDATE });
    }

    static async findDetallesParaConfirmar({ idVenta, transaction }) {
        return DetalleVenta.findAll({ where: { id_venta: idVenta }, transaction,
            lock: transaction.LOCK.UPDATE, order: [['id_detalle_venta', 'ASC']] });
    }

    static async finalizarDetalle({ idVenta, idDetalleVenta, data, transaction }) {
        return DetalleVenta.update(data, { where: { id_venta: idVenta, id_detalle_venta: idDetalleVenta }, transaction });
    }

    static async confirmar({ idVenta, total, fechaHora, transaction }) {
        return Venta.update({ estado_operacion: 'CONFIRMADA', total,
            fecha_venta: fn('STR_TO_DATE', fechaHora, '%Y-%m-%d %H:%i:%s')
        }, { where: { id_venta: idVenta, estado_operacion: 'PENDIENTE', fecha_venta: null }, transaction });
    }

    static async findReferencia({ idVenta, transaction }) {
        return Venta.findByPk(idVenta, { attributes: ['id_venta', 'estado_operacion'], transaction });
    }

    static async findParaReceta({ idVenta, transaction }) {
        return Venta.findByPk(idVenta, {
            attributes: ['id_venta', 'estado_operacion'],
            transaction, lock: transaction.LOCK.UPDATE
        });
    }

    static async findByClave({ claveOperacion }) {
        return Venta.findOne({ attributes: ['id_venta'], where: { clave_operacion: claveOperacion } });
    }

    static async create({ data, transaction }) {
        return Venta.create({ ...data,
            fecha_registro: fn('STR_TO_DATE', data.fecha_registro, '%Y-%m-%d %H:%i:%s')
        }, { transaction });
    }

    static async createDetalle({ data, transaction }) {
        return DetalleVenta.create(data, { transaction });
    }

    static async findAll({ idVenta, idUsuario, estadoOperacion, campoFecha,
        desde, hasta, pagina, limite }, { transaction }) {
        const where = {};
        if (idVenta !== undefined) where.id_venta = idVenta;
        if (idUsuario !== undefined) where.id_usuario = idUsuario;
        if (estadoOperacion !== undefined) where.estado_operacion = estadoOperacion;
        if (desde !== undefined || hasta !== undefined) {
            // DATETIME civil comercial, como Compras. No convertir históricos a UTC.
            const campo = campoFecha === 'fechaVenta' ? 'fecha_venta' : 'fecha_registro';
            where[campo] = {};
            if (desde !== undefined) where[campo][Op.gte] = fn('STR_TO_DATE',
                `${desde} 00:00:00`, '%Y-%m-%d %H:%i:%s');
            if (hasta !== undefined) where[campo][Op.lte] = fn('STR_TO_DATE',
                `${hasta} 23:59:59.999999`, '%Y-%m-%d %H:%i:%s.%f');
        }
        // Conteo sin relaciones hasMany: no duplicar ventas por detalle o receta.
        const total = await Venta.count({ where, transaction });
        const rows = await Venta.findAll({ where, transaction, attributes: atributosVenta,
            include: relacionesCabecera(), limit: limite, offset: (pagina - 1) * limite,
            order: [['fecha_registro', 'DESC'], ['id_venta', 'DESC']] });
        return { rows, total };
    }

    static async findById(idVenta, { transaction } = {}) {
        return Venta.findByPk(idVenta, {
            transaction,
            attributes: atributosVenta,
            include: [...relacionesCabecera(), {
                model: DetalleVenta, as: 'detallesVenta',
                attributes: ['id_detalle_venta', 'id_venta', 'id_existencia', 'id_receta',
                    'cantidad', 'precio_unitario', 'subtotal'],
                include: [{ model: ExistenciaMedicamento, as: 'existencia',
                    attributes: ['id_existencia', 'id_medicamento', 'codigo_existencia',
                        'fecha_vencimiento', 'precision_vencimiento'],
                    include: [{ model: Medicamento, as: 'medicamento',
                        attributes: ['id_medicamento', 'codigo_medicamento', 'nombre_comercial',
                            'forma_farmaceutica', 'presentacion', 'unidad_inventario', 'estado'] }]
                }]
            }, {
                // Solo referencias y estado de revisión, nunca pacientes ni archivos.
                model: Receta, as: 'recetas', attributes: ['id_receta', 'id_venta', 'resultado_revision']
            }],
            order: [[{ model: DetalleVenta, as: 'detallesVenta' }, 'id_detalle_venta', 'ASC'],
                [{ model: Receta, as: 'recetas' }, 'id_receta', 'ASC']]
        });
    }
}
