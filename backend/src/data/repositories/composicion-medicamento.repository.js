import db from '../models/index.js';

const { ComposicionMedicamento, PrincipioActivo } = db;
const principioInclude = { model: PrincipioActivo, as: 'principioActivo',
    attributes: ['id_principio_activo', 'nombre'] };

export class composicionMedicamentoRepository {
    static async findById({ idMedicamento, idComposicion, transaction }) {
        return ComposicionMedicamento.findOne({
            where: { id_medicamento: idMedicamento, id_composicion: idComposicion },
            include: [principioInclude],
            transaction
        });
    }

    static async findByPrincipio({ idMedicamento, idPrincipioActivo, transaction }) {
        return ComposicionMedicamento.findOne({
            where: { id_medicamento: idMedicamento, id_principio_activo: idPrincipioActivo },
            transaction
        });
    }

    static async findPrincipioById({ idPrincipioActivo, transaction }) {
        return PrincipioActivo.findByPk(idPrincipioActivo, {
            attributes: ['id_principio_activo'], transaction, lock: transaction.LOCK.SHARE
        });
    }

    static async create({ data, transaction }) {
        return ComposicionMedicamento.create(data, { transaction });
    }

    static async update({ idMedicamento, idComposicion, data, transaction }) {
        return ComposicionMedicamento.update(data, {
            where: { id_medicamento: idMedicamento, id_composicion: idComposicion }, transaction
        });
    }

    static async remove({ idMedicamento, idComposicion, transaction }) {
        return ComposicionMedicamento.destroy({
            where: { id_medicamento: idMedicamento, id_composicion: idComposicion }, transaction
        });
    }
}
