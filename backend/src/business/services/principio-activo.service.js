import db from '../../data/models/index.js';
import { principioActivoRepository } from '../../data/repositories/principio-activo.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { bitacoraAuditoriaService } from './bitacora-auditoria.service.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';
import { snapshotPrincipio, camposModificadosAuditoria } from '../../shared/utils/auditoria-catalogo.js';

const toPublicPrincipioActivo = (principio) => {
    const data = principio.get ? principio.get({ plain: true }) : principio;
    return {
        idPrincipioActivo: data.id_principio_activo,
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        estado: Boolean(data.estado)
    };
};

const validateNombreDisponible = async (nombre, transaction, idPrincipioActivo) => {
    const existente = await principioActivoRepository.findByNombre({ nombre, transaction });
    if (existente && existente.id_principio_activo !== idPrincipioActivo) {
        throw anotarErrorAuditoria(new AppError('El nombre de principio activo ya está en uso', 409), { causa: 'CONFLICTO' });
    }
};

const handleDuplicateDatabaseError = (error) => {
    if (error?.name === 'SequelizeUniqueConstraintError') {
        throw anotarErrorAuditoria(new AppError('El nombre de principio activo ya está en uso', 409), { causa: 'CONFLICTO' });
    }
    throw error;
};

export class principioActivoService {
    static async getPrincipiosActivos() {
        const principios = await principioActivoRepository.findAll();
        return principios.map(toPublicPrincipioActivo);
    }

    static async getPrincipioActivoById(idPrincipioActivo, transaction = undefined) {
        const principio = await principioActivoRepository.findById({ idPrincipioActivo, transaction });
        if (!principio) throw anotarErrorAuditoria(new AppError('Principio activo no encontrado', 404), {
            causa: 'NO_ENCONTRADO', registro: { tipo: 'PRINCIPIO_ACTIVO', id: idPrincipioActivo }
        });
        return toPublicPrincipioActivo(principio);
    }

    static async createPrincipioActivo(data, auditoria) {
        return bitacoraAuditoriaService.ejecutarCambio('PRINCIPIO_ACTIVO_CREAR', auditoria, undefined, async seguimiento => {
            try {
                return await db.sequelize.transaction(async (transaction) => {
                    seguimiento.transaction = transaction;
                    await validateNombreDisponible(data.nombre, transaction);
                    const principio = await principioActivoRepository.create({ data, transaction });
                    const resultado = toPublicPrincipioActivo(principio);
                    await bitacoraAuditoriaService.registrarCambio(seguimiento, {
                        registro: { tipo: 'PRINCIPIO_ACTIVO', id: resultado.idPrincipioActivo }, despues: snapshotPrincipio(resultado)
                    }, transaction);
                    return resultado;
                });
            } catch (error) {
                handleDuplicateDatabaseError(error);
            }
        });
    }

    static async updatePrincipioActivo(idPrincipioActivo, data, auditoria) {
        return bitacoraAuditoriaService.ejecutarCambio('PRINCIPIO_ACTIVO_MODIFICAR', auditoria,
            { tipo: 'PRINCIPIO_ACTIVO', id: idPrincipioActivo }, async seguimiento => {
                try {
                    return await db.sequelize.transaction(async (transaction) => {
                        seguimiento.transaction = transaction;
                        const principio = await principioActivoRepository.findById({ idPrincipioActivo, transaction, lock: true });
                        if (!principio) throw anotarErrorAuditoria(new AppError('Principio activo no encontrado', 404), { causa: 'NO_ENCONTRADO' });
                        const previo = toPublicPrincipioActivo(principio);
                        if (data.nombre !== undefined) await validateNombreDisponible(data.nombre, transaction, idPrincipioActivo);
                        await principioActivoRepository.update({ idPrincipioActivo, data, transaction });
                        const resultado = await this.getPrincipioActivoById(idPrincipioActivo, transaction);
                        const antes = snapshotPrincipio(previo), despues = snapshotPrincipio(resultado);
                        await bitacoraAuditoriaService.registrarCambio(seguimiento, { antes, despues,
                            camposModificados: camposModificadosAuditoria(antes, despues,
                                previo.descripcion !== resultado.descripcion ? ['descripcion'] : [])
                        }, transaction);
                        return resultado;
                    });
                } catch (error) {
                    handleDuplicateDatabaseError(error);
                }
            });
    }

    static async updateEstado(idPrincipioActivo, { estado }, auditoria) {
        return bitacoraAuditoriaService.ejecutarCambio('PRINCIPIO_ACTIVO_ESTADO', auditoria,
            { tipo: 'PRINCIPIO_ACTIVO', id: idPrincipioActivo }, async seguimiento =>
                db.sequelize.transaction(async (transaction) => {
                    seguimiento.transaction = transaction;
                    const principio = await principioActivoRepository.findById({ idPrincipioActivo, transaction, lock: true });
                    if (!principio) throw anotarErrorAuditoria(new AppError('Principio activo no encontrado', 404), { causa: 'NO_ENCONTRADO' });
                    const antes = snapshotPrincipio(toPublicPrincipioActivo(principio));
                    await principioActivoRepository.updateEstado({ idPrincipioActivo, estado, transaction });
                    const resultado = await this.getPrincipioActivoById(idPrincipioActivo, transaction);
                    await bitacoraAuditoriaService.registrarCambio(seguimiento, { antes, despues: snapshotPrincipio(resultado) }, transaction);
                    return resultado;
                }));
    }
}
