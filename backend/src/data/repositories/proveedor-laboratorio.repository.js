import db from '../models/index.js';

const { ProveedorLaboratorio } = db;

export class proveedorLaboratorioRepository {
    static async findAll() {
        return ProveedorLaboratorio.findAll({
            order: [['id_proveedor_laboratorio', 'ASC']]
        });
    }

    static async findById({ idProveedorLaboratorio, transaction, lock = false }) {
        return ProveedorLaboratorio.findByPk(idProveedorLaboratorio, { transaction,
            ...(transaction && lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    }

    static async create({ nombre, telefono, direccion, estado }, { transaction } = {}) {
        return ProveedorLaboratorio.create({
            nombre,
            ...(telefono !== undefined ? { telefono } : {}),
            ...(direccion !== undefined ? { direccion } : {}),
            ...(estado !== undefined ? { estado } : {})
        }, { transaction });
    }

    static async update({ idProveedorLaboratorio, data, transaction }) {
        return ProveedorLaboratorio.update(data, {
            where: { id_proveedor_laboratorio: idProveedorLaboratorio }, transaction
        });
    }

    static async updateEstado({ idProveedorLaboratorio, estado, transaction }) {
        return ProveedorLaboratorio.update(
            { estado },
            { where: { id_proveedor_laboratorio: idProveedorLaboratorio }, transaction }
        );
    }
}
