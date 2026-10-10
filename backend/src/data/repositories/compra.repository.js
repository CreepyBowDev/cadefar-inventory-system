import db from '../models/index.js';

const { Compra, DetalleCompra, ExistenciaMedicamento, Medicamento,
    ProveedorLaboratorio, Usuario, Sequelize } = db;
const { Op, fn, col } = Sequelize;

const atributosCompra = [
    'id_compra', 'id_usuario', 'id_proveedor_laboratorio', 'estado_operacion',
    'clave_operacion', 'total', 'motivo_anulacion', 'id_usuario_anulador',
    [fn('DATE_FORMAT', col('Compra.fecha_compra'), '%Y-%m-%d'), 'fecha_compra'],
    [fn('DATE_FORMAT', col('Compra.fecha_registro'), '%Y-%m-%d %H:%i:%s'), 'fecha_registro'],
    [fn('DATE_FORMAT', col('Compra.fecha_anulacion'), '%Y-%m-%d %H:%i:%s'), 'fecha_anulacion']
];
const relacionesCabecera = () => [
    { model: ProveedorLaboratorio, as: 'proveedorLaboratorio',
        attributes: ['id_proveedor_laboratorio', 'nombre', 'estado'] },
    { model: Usuario, as: 'usuarioRegistrador', attributes: ['id_usuario', 'nombre_usuario'] },
    { model: Usuario, as: 'usuarioAnulador', attributes: ['id_usuario', 'nombre_usuario'] }
];

export class compraRepository {
    static async findParaAnular({ idCompra, transaction }) {
        return Compra.findByPk(idCompra, { transaction, lock: transaction.LOCK.UPDATE });
    }

    static async findDetallesParaAnular({ idCompra, transaction }) {
        return DetalleCompra.findAll({ where: { id_compra: idCompra }, transaction,
            lock: transaction.LOCK.UPDATE, order: [['id_detalle_compra', 'ASC']] });
    }

    static async anular({ idCompra, motivo, idUsuario, fechaHora, transaction }) {
        return Compra.update({ estado_operacion: 'ANULADA', motivo_anulacion: motivo,
            id_usuario_anulador: idUsuario,
            fecha_anulacion: fn('STR_TO_DATE', fechaHora, '%Y-%m-%d %H:%i:%s')
        }, { where: { id_compra: idCompra, estado_operacion: 'CONFIRMADA' }, transaction });
    }

    static async findByClave({ claveOperacion, transaction }) {
        return Compra.findOne({ attributes: ['id_compra'],
            where: { clave_operacion: claveOperacion }, transaction });
    }

    static async create({ data, transaction }) {
        return Compra.create({ ...data,
            fecha_registro: fn('STR_TO_DATE', data.fecha_registro, '%Y-%m-%d %H:%i:%s')
        }, { transaction });
    }

    static async createDetalle({ data, transaction }) {
        return DetalleCompra.create(data, { transaction });
    }

    static async findAll({ desde, hasta, idProveedorLaboratorio, estadoOperacion,
        claveOperacion, idUsuario } = {}) {
        const filtros = {};
        if (desde !== undefined || hasta !== undefined) {
            filtros.fecha_compra = {};
            if (desde !== undefined) filtros.fecha_compra[Op.gte] = desde;
            if (hasta !== undefined) filtros.fecha_compra[Op.lte] = hasta;
        }
        if (idProveedorLaboratorio !== undefined) filtros.id_proveedor_laboratorio = idProveedorLaboratorio;
        if (estadoOperacion !== undefined) filtros.estado_operacion = estadoOperacion;
        if (claveOperacion !== undefined) filtros.clave_operacion = claveOperacion;
        if (idUsuario !== undefined) filtros.id_usuario = idUsuario;

        return Compra.findAll({
            attributes: atributosCompra,
            where: filtros,
            include: relacionesCabecera(),
            order: [['fecha_compra', 'DESC'], ['id_compra', 'DESC']]
        });
    }

    static async findById(idCompra, { transaction } = {}) {
        return Compra.findByPk(idCompra, {
            transaction,
            attributes: atributosCompra,
            include: [...relacionesCabecera(), {
                model: DetalleCompra, as: 'detallesCompra',
                attributes: ['id_detalle_compra', 'id_compra', 'id_existencia',
                    'cantidad', 'costo_unitario', 'subtotal'],
                include: [{
                    model: ExistenciaMedicamento, as: 'existencia',
                    attributes: ['id_existencia', 'id_medicamento', 'codigo_existencia',
                        'fecha_vencimiento', 'precision_vencimiento'],
                    include: [{ model: Medicamento, as: 'medicamento',
                        attributes: ['id_medicamento', 'codigo_medicamento', 'nombre_comercial',
                            'forma_farmaceutica', 'presentacion', 'unidad_inventario', 'estado'] }]
                }]
            }],
            order: [[{ model: DetalleCompra, as: 'detallesCompra' }, 'id_detalle_compra', 'ASC']]
        });
    }
}
