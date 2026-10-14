import { composicionMedicamentoRepository } from '../../data/repositories/composicion-medicamento.repository.js';
import { medicamentoService, toPublicComposicion } from './medicamento.service.js';
import { AppError } from '../../shared/errors/app-error.js';
import { transaccionCatalogo, bloquearProveedoresIdentidad, validarIdentidadDisponible,
    convertirErrorContencionCatalogo } from './identidad-medicamento.js';
import { bitacoraAuditoriaService } from './bitacora-auditoria.service.js';
import { snapshotComposicion } from '../../shared/utils/auditoria-catalogo.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';

const prepararModificacion = async (idMedicamento, transaction) => {
    const medicamento = await medicamentoService.getMedicamentoForUpdate(idMedicamento, transaction);
    const actual = medicamento.get({ plain: true });
    // Mantener el mismo orden que la edición de Medicamento y Compras:
    // medicamento propio -> proveedor; nunca bloquear medicamentos candidatos.
    await bloquearProveedoresIdentidad([actual.id_proveedor_laboratorio], transaction);
    await medicamentoService.validateSinHistorial(idMedicamento, transaction);
    return actual;
};

const validarResultado = async (actual, idMedicamento, transaction) => {
    const composicion = await composicionMedicamentoRepository.findAllForMedicamento({ idMedicamento, transaction });
    await validarIdentidadDisponible(actual, composicion, transaction, idMedicamento);
};

const getComposicion = async (idMedicamento, idComposicion, transaction) => {
    const composicion = await composicionMedicamentoRepository.findById({ idMedicamento, idComposicion, transaction });
    if (!composicion) throw anotarErrorAuditoria(new AppError('Composición de medicamento no encontrada', 404), { causa: 'NO_ENCONTRADO' });
    return composicion;
};

export class composicionMedicamentoService {
    static async getComposicionMedicamento(idMedicamento) {
        const medicamento = await medicamentoService.getMedicamentoById(idMedicamento);
        return medicamento.composicion;
    }

    static async createComposicion(idMedicamento, data, auditoria) {
        return bitacoraAuditoriaService.ejecutarCambio('COMPOSICION_AGREGAR', auditoria,
            { tipo: 'MEDICAMENTO', id: idMedicamento }, async seguimiento => {
                try {
                    return await transaccionCatalogo(async (transaction) => {
                        seguimiento.transaction = transaction;
                        const actual = await prepararModificacion(idMedicamento, transaction);
                        const principio = await composicionMedicamentoRepository.findPrincipioById({
                            idPrincipioActivo: data.idPrincipioActivo, transaction
                        });
                        if (!principio) throw anotarErrorAuditoria(new AppError('Principio activo no encontrado', 404), { causa: 'NO_ENCONTRADO' });
                        const existente = await composicionMedicamentoRepository.findByPrincipio({
                            idMedicamento, idPrincipioActivo: data.idPrincipioActivo, transaction
                        });
                        if (existente) throw anotarErrorAuditoria(new AppError('El principio activo ya pertenece a la composición del medicamento', 409), { causa: 'CONFLICTO' });
                        const composicion = await composicionMedicamentoRepository.create({
                            data: {
                                id_medicamento: idMedicamento,
                                id_principio_activo: data.idPrincipioActivo,
                                cantidad_principio_activo: data.cantidadPrincipioActivo,
                                unidad_principio_activo: data.unidadPrincipioActivo,
                                cantidad_referencia: data.cantidadReferencia,
                                unidad_referencia: data.unidadReferencia
                            }, transaction
                        });
                        await validarResultado(actual, idMedicamento, transaction);
                        const resultado = toPublicComposicion(await getComposicion(idMedicamento, composicion.id_composicion, transaction));
                        await bitacoraAuditoriaService.registrarCambio(seguimiento, {
                            registro: { tipo: 'COMPOSICION', id: resultado.idComposicion }, despues: snapshotComposicion(resultado),
                            referencias: [{ tipo: 'MEDICAMENTO', id: idMedicamento }]
                        }, transaction);
                        return resultado;
                    });
                } catch (error) {
                    if (error?.name === 'SequelizeUniqueConstraintError' &&
                        /uq_composicion_medicamento_principio/.test(error.parent?.sqlMessage || error.original?.sqlMessage || '')) {
                        throw anotarErrorAuditoria(new AppError('El principio activo ya pertenece a la composición del medicamento', 409), { causa: 'CONFLICTO' });
                    }
                    throw convertirErrorContencionCatalogo(error);
                }
            });
    }

    static async updateComposicion(idMedicamento, idComposicion, data, auditoria) {
        return bitacoraAuditoriaService.ejecutarCambio('COMPOSICION_MODIFICAR', auditoria,
            { tipo: 'COMPOSICION', id: idComposicion }, async seguimiento => {
                return transaccionCatalogo(async (transaction) => {
                    seguimiento.transaction = transaction;
                    const actual = await prepararModificacion(idMedicamento, transaction);
                    const antes = snapshotComposicion(toPublicComposicion(await getComposicion(idMedicamento, idComposicion, transaction)));
                    const campos = {
                        cantidadPrincipioActivo: 'cantidad_principio_activo',
                        unidadPrincipioActivo: 'unidad_principio_activo',
                        cantidadReferencia: 'cantidad_referencia',
                        unidadReferencia: 'unidad_referencia'
                    };
                    const values = Object.fromEntries(Object.entries(data).map(([campo, valor]) => [campos[campo], valor]));
                    await composicionMedicamentoRepository.update({ idMedicamento, idComposicion, data: values, transaction });
                    await validarResultado(actual, idMedicamento, transaction);
                    const resultado = toPublicComposicion(await getComposicion(idMedicamento, idComposicion, transaction));
                    await bitacoraAuditoriaService.registrarCambio(seguimiento, { antes, despues: snapshotComposicion(resultado),
                        referencias: [{ tipo: 'MEDICAMENTO', id: idMedicamento }]
                    }, transaction);
                    return resultado;
                });
            });
    }

    static async removeComposicion(idMedicamento, idComposicion, auditoria) {
        return bitacoraAuditoriaService.ejecutarCambio('COMPOSICION_RETIRAR', auditoria,
            { tipo: 'COMPOSICION', id: idComposicion }, async seguimiento => {
                return transaccionCatalogo(async (transaction) => {
                    seguimiento.transaction = transaction;
                    const actual = await prepararModificacion(idMedicamento, transaction);
                    const antes = snapshotComposicion(toPublicComposicion(await getComposicion(idMedicamento, idComposicion, transaction)));
                    await composicionMedicamentoRepository.remove({ idMedicamento, idComposicion, transaction });
                    await validarResultado(actual, idMedicamento, transaction);
                    await bitacoraAuditoriaService.registrarCambio(seguimiento, { antes, despues: null,
                        referencias: [{ tipo: 'MEDICAMENTO', id: idMedicamento }]
                    }, transaction);
                });
            });
    }
}
