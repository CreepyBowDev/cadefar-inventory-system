import { proveedorLaboratorioRepository } from '../../data/repositories/proveedor-laboratorio.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import db from '../../data/models/index.js';
import { bitacoraAuditoriaService } from './bitacora-auditoria.service.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';
import { snapshotProveedor, camposModificadosAuditoria } from '../../shared/utils/auditoria-catalogo.js';

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
    static async createProveedorLaboratorio(data, auditoria) {
        return bitacoraAuditoriaService.ejecutarCambio('PROVEEDOR_LABORATORIO_CREAR', auditoria, undefined, async seguimiento =>
            db.sequelize.transaction(async transaction => {
                seguimiento.transaction = transaction;
                const proveedor = await proveedorLaboratorioRepository.create(data, { transaction });
                const resultado = toPublicProveedorLaboratorio(proveedor);
                await bitacoraAuditoriaService.registrarCambio(seguimiento, {
                    registro: { tipo: 'PROVEEDOR_LABORATORIO', id: resultado.idProveedorLaboratorio },
                    despues: snapshotProveedor(resultado)
                }, transaction);
                return resultado;
            }));
    }

    static async getProveedoresLaboratorios() {
        const proveedores = await proveedorLaboratorioRepository.findAll();
        return proveedores.map(toPublicProveedorLaboratorio);
    }

    static async getProveedorLaboratorioById(idProveedorLaboratorio, transaction = undefined, lock = false) {
        const proveedorLaboratorio = await proveedorLaboratorioRepository.findById({
            idProveedorLaboratorio, transaction, lock
        });

        if (!proveedorLaboratorio) {
            throw anotarErrorAuditoria(new AppError('Proveedor o laboratorio no encontrado', 404), {
                causa: 'NO_ENCONTRADO', registro: { tipo: 'PROVEEDOR_LABORATORIO', id: idProveedorLaboratorio }
            });
        }

        return toPublicProveedorLaboratorio(proveedorLaboratorio);
    }

    static async updateProveedorLaboratorio(idProveedorLaboratorio, data, auditoria) {
        return bitacoraAuditoriaService.ejecutarCambio('PROVEEDOR_LABORATORIO_MODIFICAR', auditoria,
            { tipo: 'PROVEEDOR_LABORATORIO', id: idProveedorLaboratorio }, async seguimiento =>
                db.sequelize.transaction(async transaction => {
                    seguimiento.transaction = transaction;
                    const previo = await this.getProveedorLaboratorioById(idProveedorLaboratorio, transaction, true);
                    await proveedorLaboratorioRepository.update({ idProveedorLaboratorio, data, transaction });
                    const resultado = await this.getProveedorLaboratorioById(idProveedorLaboratorio, transaction);
                    const antes = snapshotProveedor(previo), despues = snapshotProveedor(resultado);
                    await bitacoraAuditoriaService.registrarCambio(seguimiento, { antes, despues,
                        camposModificados: camposModificadosAuditoria(antes, despues,
                            ['telefono', 'direccion'].filter(campo => previo[campo] !== resultado[campo]))
                    }, transaction);
                    return resultado;
                }));
    }

    static async updateEstado(idProveedorLaboratorio, { estado }, auditoria) {
        return bitacoraAuditoriaService.ejecutarCambio('PROVEEDOR_LABORATORIO_ESTADO', auditoria,
            { tipo: 'PROVEEDOR_LABORATORIO', id: idProveedorLaboratorio }, async seguimiento =>
                db.sequelize.transaction(async transaction => {
                    seguimiento.transaction = transaction;
                    const previo = await this.getProveedorLaboratorioById(idProveedorLaboratorio, transaction, true);
                    await proveedorLaboratorioRepository.updateEstado({ idProveedorLaboratorio, estado, transaction });
                    const resultado = await this.getProveedorLaboratorioById(idProveedorLaboratorio, transaction);
                    await bitacoraAuditoriaService.registrarCambio(seguimiento, {
                        antes: snapshotProveedor(previo), despues: snapshotProveedor(resultado)
                    }, transaction);
                    return resultado;
                }));
    }
}
