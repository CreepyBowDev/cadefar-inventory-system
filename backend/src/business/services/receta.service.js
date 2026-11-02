import db from '../../data/models/index.js';
import { ventaRepository } from '../../data/repositories/venta.repository.js';
import { recetaRepository } from '../../data/repositories/receta.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';
import { bitacoraAuditoriaService } from './bitacora-auditoria.service.js';
import { obtenerFechaOperacion } from '../../shared/utils/fecha-operacion.js';
import { referenciasAuditoriaAcotadas } from '../../shared/utils/auditoria-catalogo.js';

const toPlain = registro => registro.get ? registro.get({ plain: true }) : registro;
const errorRegistro = (mensaje, estado, causa, idVenta) => anotarErrorAuditoria(
    new AppError(mensaje, estado), { causa, registro: { tipo: 'VENTA', id: idVenta } });
const snapshotRevision = receta => ({ idVenta: receta.id_venta,
    resultadoRevision: receta.resultado_revision, idUsuarioValidador: receta.id_usuario_validador });

export class recetaService {
    static async getRecetas(idVenta, filtros, auditoria) {
        return bitacoraAuditoriaService.ejecutarCambio('RECETAS_CONSULTAR', auditoria,
            { tipo: 'VENTA', id: idVenta }, async seguimiento => {
                const resultado = await db.sequelize.transaction({
                    isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ
                }, async transaction => {
                    if (!await ventaRepository.findReferencia({ idVenta, transaction })) {
                        throw errorRegistro('Venta no encontrada', 404, 'NO_ENCONTRADO', idVenta);
                    }
                    return recetaRepository.findAllByVenta({ idVenta, ...filtros, transaction });
                });
                await bitacoraAuditoriaService.intentarRegistrar({ ...seguimiento.evento,
                    resultado: 'EXITO', metadatos: { cantidadResultados: resultado.rows.length } });
                return resultado;
            });
    }

    static async getRecetaById(idVenta, idReceta, auditoria) {
        return bitacoraAuditoriaService.ejecutarCambio('RECETA_CONSULTAR', auditoria,
            { tipo: 'VENTA', id: idVenta }, async seguimiento => {
                const resultado = await db.sequelize.transaction({
                    isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ
                }, async transaction => {
                    if (!await ventaRepository.findReferencia({ idVenta, transaction })) {
                        throw errorRegistro('Venta no encontrada', 404, 'NO_ENCONTRADO', idVenta);
                    }
                    const receta = await recetaRepository.findByIdDeVenta({ idVenta, idReceta, transaction });
                    if (!receta) throw errorRegistro('Receta no encontrada en la venta', 404, 'NO_ENCONTRADO', idVenta);
                    return receta;
                });
                seguimiento.evento.registro = { tipo: 'RECETA', id: idReceta };
                await bitacoraAuditoriaService.intentarRegistrar({ ...seguimiento.evento,
                    resultado: 'EXITO', metadatos: { cantidadResultados: 1 } });
                return resultado;
            });
    }

    static async revisarReceta(idVenta, idReceta, data, idUsuario, auditoria) {
        if (!Number.isInteger(idUsuario) || idUsuario <= 0 || idUsuario > 2147483647) {
            throw new AppError('No autenticado', 401);
        }
        return bitacoraAuditoriaService.ejecutarCambio('RECETA_REVISAR', auditoria,
            { tipo: 'VENTA', id: idVenta }, async seguimiento => {
                try {
                    return await db.sequelize.transaction(async transaction => {
                        seguimiento.transaction = transaction;
                        // Mismo mutex para registro, revisión, confirmación y anulación.
                        const venta = await ventaRepository.findParaReceta({ idVenta, transaction });
                        if (!venta) throw errorRegistro('Venta no encontrada', 404, 'NO_ENCONTRADO', idVenta);
                        if (toPlain(venta).estado_operacion !== 'PENDIENTE') {
                            throw errorRegistro('Solo se pueden revisar recetas de una venta pendiente', 409, 'CONFLICTO', idVenta);
                        }
                        const registro = await recetaRepository.findByIdDeVenta({ idVenta, idReceta, transaction, lock: true });
                        if (!registro) throw errorRegistro('Receta no encontrada en la venta', 404, 'NO_ENCONTRADO', idVenta);
                        seguimiento.evento.registro = { tipo: 'RECETA', id: idReceta };
                        const antes = toPlain(registro);
                        if (antes.resultado_revision !== null || antes.id_usuario_validador !== null || antes.fecha_validacion !== null) {
                            throw errorRegistro('La receta ya fue revisada o su revisión es inconsistente', 409, 'CONFLICTO', idVenta);
                        }
                        if (!['APROBADA', 'RECHAZADA'].includes(data.resultadoRevision)) {
                            throw errorRegistro('Resultado de revisión inválido', 400, 'ENTRADA_INVALIDA', idVenta);
                        }
                        const { fechaHoraComercial } = obtenerFechaOperacion();
                        const [actualizadas] = await recetaRepository.registrarRevision({ idVenta, idReceta,
                            resultadoRevision: data.resultadoRevision, idUsuario, fechaHora: fechaHoraComercial,
                            observacion: data.observacion === undefined ? antes.observacion : data.observacion, transaction });
                        if (actualizadas !== 1) throw errorRegistro('La receta no pudo revisarse en su estado actual', 409, 'CONFLICTO', idVenta);
                        const resultado = await recetaRepository.findByIdDeVenta({ idVenta, idReceta, transaction });
                        if (!resultado) throw errorRegistro('No se pudo recuperar la receta revisada', 409, 'CONFLICTO', idVenta);
                        await bitacoraAuditoriaService.registrarCambio(seguimiento, {
                            registro: { tipo: 'RECETA', id: idReceta }, antes: snapshotRevision(antes),
                            despues: snapshotRevision(toPlain(resultado)),
                            referencias: [{ tipo: 'VENTA', id: idVenta }], metadatos: { cantidadMovimientos: 0 }
                        }, transaction);
                        return resultado;
                    });
                } catch (error) {
                    const codigo = error.parent?.code || error.original?.code;
                    if (codigo === 'ER_LOCK_DEADLOCK' || codigo === 'ER_LOCK_WAIT_TIMEOUT') {
                        throw errorRegistro('La receta no pudo revisarse por contención temporal. Consulte su estado y reintente si sigue pendiente',
                            409, 'CONFLICTO', idVenta);
                    }
                    throw error;
                }
            });
    }

    static async createReceta(idVenta, data, auditoria) {
        return bitacoraAuditoriaService.ejecutarCambio('RECETA_REGISTRAR', auditoria,
            { tipo: 'VENTA', id: idVenta }, seguimiento => this.#createReceta(idVenta, data, seguimiento));
    }

    static async #createReceta(idVenta, data, seguimiento) {
        try {
            return await db.sequelize.transaction(async transaction => {
                seguimiento.transaction = transaction;
                const venta = await ventaRepository.findParaReceta({ idVenta, transaction });
                if (!venta) throw errorRegistro('Venta no encontrada', 404, 'NO_ENCONTRADO', idVenta);
                if (toPlain(venta).estado_operacion !== 'PENDIENTE') {
                    throw errorRegistro('Solo se pueden registrar recetas en una venta pendiente', 409, 'CONFLICTO', idVenta);
                }
                if (data.idsDetallesVenta) {
                    const detalles = await recetaRepository.findDetallesDeVenta({ idVenta,
                        idsDetallesVenta: data.idsDetallesVenta, transaction });
                    if (detalles.length !== data.idsDetallesVenta.length) {
                        throw errorRegistro('Uno o más detalles no pertenecen a la venta', 404, 'NO_ENCONTRADO', idVenta);
                    }
                    if (detalles.map(toPlain).some(detalle => detalle.id_receta !== null)) {
                        throw errorRegistro('Uno o más detalles ya tienen una receta vinculada', 409, 'CONFLICTO', idVenta);
                    }
                }
                const { fechaHoraComercial } = obtenerFechaOperacion();
                const receta = await recetaRepository.create({ transaction, data: {
                    id_venta: idVenta, numero_receta: data.numeroReceta ?? null, fecha_receta: data.fechaReceta,
                    nombre_paciente: data.nombrePaciente, documento_paciente: data.documentoPaciente,
                    nombre_medico: data.nombreMedico, modalidad: data.modalidad, observacion: data.observacion ?? null,
                    archivo_receta: null, resultado_revision: null, id_usuario_validador: null,
                    fecha_validacion: null, fecha_registro: fechaHoraComercial
                } });
                if (data.idsDetallesVenta) {
                    const [vinculados] = await recetaRepository.vincularDetalles({ idVenta,
                        idsDetallesVenta: data.idsDetallesVenta, idReceta: receta.id_receta, transaction });
                    if (vinculados !== data.idsDetallesVenta.length) {
                        throw errorRegistro('No se pudieron vincular todos los detalles a la receta', 409, 'CONFLICTO', idVenta);
                    }
                }
                const resultado = await recetaRepository.findByIdDeVenta({ idVenta, idReceta: receta.id_receta, transaction });
                if (!resultado) throw errorRegistro('No se pudo recuperar la receta registrada', 409, 'CONFLICTO', idVenta);
                const referencias = referenciasAuditoriaAcotadas([{ tipo: 'VENTA', id: idVenta },
                    ...(data.idsDetallesVenta ?? []).map(id => ({ tipo: 'DETALLE_VENTA', id }))]);
                await bitacoraAuditoriaService.registrarCambio(seguimiento, {
                    registro: { tipo: 'RECETA', id: receta.id_receta }, despues: snapshotRevision(toPlain(resultado)),
                    referencias: referencias.referencias, metadatos: { cantidadDetalles: data.idsDetallesVenta?.length ?? 0,
                        cantidadMovimientos: 0, cantidadReferenciasOmitidas: referencias.cantidadReferenciasOmitidas }
                }, transaction);
                return resultado;
            });
        } catch (error) {
            const codigo = error.parent?.code || error.original?.code;
            if (codigo === 'ER_LOCK_DEADLOCK' || codigo === 'ER_LOCK_WAIT_TIMEOUT') {
                throw errorRegistro('No se pudo registrar la receta por contención temporal. Consulte la venta antes de reintentar',
                    409, 'CONFLICTO', idVenta);
            }
            throw error;
        }
    }
}
