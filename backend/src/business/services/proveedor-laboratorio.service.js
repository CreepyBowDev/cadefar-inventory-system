import { proveedorLaboratorioRepository } from '../../data/repositories/proveedor-laboratorio.repository.js';
import { AppError } from '../../shared/errors/app-error.js';

const toPublicProveedorLaboratorio = (proveedorLaboratorio) => {
    const data = proveedorLaboratorio.get
        ? proveedorLaboratorio.get({ plain: true })
        : proveedorLaboratorio;

    return {
        idProveedorLaboratorio: data.id_proveedor_laboratorio,
        nombre: data.nombre,
        telefono: data.telefono ?? null,
        direccion: data.direccion ?? null,
        estado: Boolean(data.estado)
    };
};

export class proveedorLaboratorioService {
    static async createProveedorLaboratorio(data) {
        const proveedorLaboratorio = await proveedorLaboratorioRepository.create(data);
        return toPublicProveedorLaboratorio(proveedorLaboratorio);
    }

    static async getProveedoresLaboratorios() {
        const proveedores = await proveedorLaboratorioRepository.findAll();
        return proveedores.map(toPublicProveedorLaboratorio);
    }

    static async getProveedorLaboratorioById(idProveedorLaboratorio) {
        const proveedorLaboratorio = await proveedorLaboratorioRepository.findById({
            idProveedorLaboratorio
        });

        if (!proveedorLaboratorio) {
            throw new AppError('Proveedor o laboratorio no encontrado', 404);
        }

        return toPublicProveedorLaboratorio(proveedorLaboratorio);
    }

    static async updateProveedorLaboratorio(idProveedorLaboratorio, data) {
        await this.getProveedorLaboratorioById(idProveedorLaboratorio);
        await proveedorLaboratorioRepository.update({ idProveedorLaboratorio, data });
        return this.getProveedorLaboratorioById(idProveedorLaboratorio);
    }

    static async updateEstado(idProveedorLaboratorio, { estado }) {
        await this.getProveedorLaboratorioById(idProveedorLaboratorio);
        await proveedorLaboratorioRepository.updateEstado({
            idProveedorLaboratorio,
            estado
        });
        return this.getProveedorLaboratorioById(idProveedorLaboratorio);
    }
}
