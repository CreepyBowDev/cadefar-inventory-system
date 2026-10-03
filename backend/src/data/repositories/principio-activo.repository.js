import db from '../models/index.js';

const { PrincipioActivo } = db;

export class principioActivoRepository {
    static async findAll() {
        return PrincipioActivo.findAll({ order: [['id_principio_activo', 'ASC']] });
    }

    static async findById({ idPrincipioActivo, transaction, lock = false }) {
        return PrincipioActivo.findByPk(idPrincipioActivo, {
            transaction,
            ...(lock ? { lock: transaction.LOCK.UPDATE } : {})
        });
    }

    static async findByNombre({ nombre, transaction }) {
        return PrincipioActivo.findOne({ where: { nombre }, transaction });
    }

    static async create({ data, transaction }) {
        return PrincipioActivo.create(data, { transaction });
    }

    static async update({ idPrincipioActivo, data, transaction }) {
        return PrincipioActivo.update(data, { where: { id_principio_activo: idPrincipioActivo }, transaction });
    }

    static async updateEstado({ idPrincipioActivo, estado, transaction }) {
        return this.update({ idPrincipioActivo, data: { estado }, transaction });
    }
}
