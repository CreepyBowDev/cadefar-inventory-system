import db from '../models/index.js';

const { Receta, DetalleVenta, Sequelize } = db;
const { fn, col } = Sequelize;
const atributosResumen = ['id_receta', 'id_venta', 'fecha_receta', 'modalidad',
    'resultado_revision', 'id_usuario_validador',
    ...['fecha_registro', 'fecha_validacion'].map(campo =>
        [fn('DATE_FORMAT', col(`Receta.${campo}`), '%Y-%m-%d %H:%i:%s'), campo])];

export class recetaRepository {
    static async create({ data, transaction }) {
        return Receta.create({ ...data,
            fecha_registro: fn('STR_TO_DATE', data.fecha_registro, '%Y-%m-%d %H:%i:%s')
        }, { transaction });
    }

    static async vincularDetalles({ idVenta, idsDetallesVenta, idReceta, transaction }) {
        return DetalleVenta.update({ id_receta: idReceta }, {
            where: { id_venta: idVenta, id_detalle_venta: { [Sequelize.Op.in]: idsDetallesVenta }, id_receta: null }, transaction
        });
    }

    static async findParaConfirmacion({ idVenta, idsRecetas, transaction }) {
        return Receta.findAll({ attributes: ['id_receta', 'id_venta', 'resultado_revision',
            'id_usuario_validador', 'fecha_validacion'],
            where: { id_venta: idVenta, id_receta: { [Sequelize.Op.in]: idsRecetas } },
            transaction, lock: transaction.LOCK.UPDATE, order: [['id_receta', 'ASC']] });
    }

    static async findAllByVenta({ idVenta, pagina, limite, transaction }) {
        const where = { id_venta: idVenta };
        const total = await Receta.count({ where, transaction });
        const rows = await Receta.findAll({ where, transaction, attributes: atributosResumen,
            order: [['id_receta', 'ASC']], limit: limite, offset: (pagina - 1) * limite });
        return { rows, total };
    }

    static async findByIdDeVenta({ idVenta, idReceta, transaction, lock = false }) {
        return Receta.findOne({ where: { id_venta: idVenta, id_receta: idReceta },
            attributes: [...atributosResumen, 'numero_receta', 'nombre_paciente',
                'documento_paciente', 'nombre_medico', 'observacion'], transaction,
            ...(lock ? { lock: transaction.LOCK.UPDATE } : {})
        });
    }

    static async registrarRevision({ idVenta, idReceta, resultadoRevision, idUsuario, fechaHora, observacion, transaction }) {
        return Receta.update({ resultado_revision: resultadoRevision, id_usuario_validador: idUsuario,
            fecha_validacion: fn('STR_TO_DATE', fechaHora, '%Y-%m-%d %H:%i:%s'), observacion
        }, { where: { id_venta: idVenta, id_receta: idReceta, resultado_revision: null,
            id_usuario_validador: null, fecha_validacion: null }, transaction });
    }

    static async findDetallesDeVenta({ idVenta, idsDetallesVenta, transaction }) {
        return DetalleVenta.findAll({
            attributes: ['id_detalle_venta', 'id_venta', 'id_receta'],
            where: { id_venta: idVenta, id_detalle_venta: { [Sequelize.Op.in]: idsDetallesVenta } },
            transaction, lock: transaction.LOCK.UPDATE,
            order: [['id_detalle_venta', 'ASC']]
        });
    }
}
