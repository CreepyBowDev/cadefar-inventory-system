import db from '../models/index.js';

const { ProveedorLaboratorio } = db;

export class proveedorLaboratorioRepository {
    static async findAll() {
        return ProveedorLaboratorio.findAll({
            order: [['id_proveedor_laboratorio', 'ASC']]
        });
    }

    static async findById({ idProveedorLaboratorio }) {
        return ProveedorLaboratorio.findByPk(idProveedorLaboratorio);
    }

    static async create({ nombre, telefono, direccion, estado }) {
        return ProveedorLaboratorio.create({
            nombre,
            ...(telefono !== undefined ? { telefono } : {}),
            ...(direccion !== undefined ? { direccion } : {}),
            ...(estado !== undefined ? { estado } : {})
        });
    }

    static async update({ idProveedorLaboratorio, data }) {
        return ProveedorLaboratorio.update(data, {
            where: { id_proveedor_laboratorio: idProveedorLaboratorio }
        });
    }

    static async updateEstado({ idProveedorLaboratorio, estado }) {
        return ProveedorLaboratorio.update(
            { estado },
            { where: { id_proveedor_laboratorio: idProveedorLaboratorio } }
        );
    }
}
