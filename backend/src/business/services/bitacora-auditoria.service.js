import db from '../../data/models/index.js';
import { bitacoraAuditoriaRepository } from '../../data/repositories/bitacora-auditoria.repository.js';
import { prepararEventoAuditoria } from '../validators/auditoria.validator.js';
import { CATALOGO_AUDITORIA, RESULTADOS_AUDITORIA } from '../../shared/constants/auditoria.js';
import { AppError } from '../../shared/errors/app-error.js';
import { marcarErrorAuditoriaGestionado, obtenerErrorAuditoria, anotarErrorAuditoria,
    clasificarErrorTecnicoAuditoria } from '../../shared/utils/auditoria-error.js';
import { crearContextoAuditoriaConexion } from '../../shared/utils/auditoria-contexto.js';
import { camposModificadosAuditoria } from '../../shared/utils/auditoria-catalogo.js';

const requiereTransaccionNegocio = evento => evento?.resultado === RESULTADOS_AUDITORIA.EXITO &&
    Object.hasOwn(CATALOGO_AUDITORIA, evento?.tipoEvento ?? '') &&
    CATALOGO_AUDITORIA[evento.tipoEvento].transaccionExito;

const diagnosticar = (error, eventos) => {
    // Clasificación acotada. No copiar message, stack, sql, parameters, details,
    // originales de Sequelize ni siquiera un error.name desconocido.
    const nombres = {
        ZodError: 'CONTRATO_INVALIDO', TypeError: 'CONTRATO_INVALIDO',
        SequelizeConnectionError: 'CONEXION', SequelizeConnectionRefusedError: 'CONEXION',
        SequelizeConnectionAcquireTimeoutError: 'CONEXION',
        SequelizeDatabaseError: 'PERSISTENCIA', SequelizeValidationError: 'PERSISTENCIA',
        SequelizeUniqueConstraintError: 'PERSISTENCIA'
    };
    // Un error de conexión durante COMMIT puede dejar un resultado incierto.
    // El diagnóstico no afirma que el evento esté ausente del almacenamiento.
    console.error({ categoria: 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA', causa: Object.hasOwn(nombres, error?.name ?? '') ? nombres[error.name] : 'INTERNO',
        tiposEvento: Array.isArray(eventos) ? eventos.map(e =>
            Object.hasOwn(CATALOGO_AUDITORIA, e?.tipoEvento ?? '') ? e.tipoEvento : 'DESCONOCIDO') : [] });
};

const persistir = async (eventos, transaction) => {
    if (!Array.isArray(eventos) || !eventos.length || eventos.length > 10) {
        throw new TypeError('Se requiere un grupo acotado de eventos de auditoría');
    }
    if (eventos.some(requiereTransaccionNegocio) && !transaction) {
        throw new TypeError('El éxito crítico requiere la transacción de negocio');
    }
    if (transaction && (!(transaction instanceof db.Sequelize.Transaction) ||
        transaction.sequelize !== db.sequelize || transaction.finished)) {
        throw new TypeError('Transacción de auditoría inválida');
    }
    const instante = new Date();
    const datos = eventos.map(evento => prepararEventoAuditoria(evento, instante));
    // Un tipo por solicitud lógica. No es idempotencia de negocio: una nueva
    // solicitud recibe otra correlación. El UNIQUE también cubre otras capas.
    const claves = datos.map(data => `${data.correlacion}:${data.tipo_evento}`);
    if (new Set(claves).size !== claves.length) throw new TypeError('Evento duplicado en la misma solicitud');
    const insertar = async tx => {
        const ids = [];
        for (const data of datos) ids.push(await bitacoraAuditoriaRepository.create({ data, transaction: tx }));
        return ids;
    };
    // Rechazos/hechos posteriores pueden confirmarse en una transacción propia,
    // independiente de la transacción de negocio ya terminada o revertida.
    return transaction ? insertar(transaction) : db.sequelize.transaction(insertar);
};

export class bitacoraAuditoriaService {
    static async ejecutarCambio(tipoEvento, auditoria = {}, registro, operacion) {
        return this.ejecutarSeguridad({ tipoEvento, registro,
            contexto: auditoria.contexto ?? crearContextoAuditoriaConexion(), responsable: auditoria.responsable
        }, async seguimiento => {
            const resultado = await operacion(seguimiento);
            // Solo después de que la operación haya terminado su commit. El
            // Controller conserva este contexto para errores HTTP posteriores.
            auditoria.resultado = { efecto: 'CONFIRMADO', responsable: seguimiento.evento.responsable,
                cuentaObjetivo: seguimiento.evento.cuentaObjetivo, registro: seguimiento.evento.registro };
            return resultado;
        });
    }

    static async registrarCambio(seguimiento, datos, transaction) {
        const { antes, despues, camposModificados, ...resto } = datos;
        seguimiento.evento = { ...seguimiento.evento, ...resto, antes, despues, fechaEvento: new Date() };
        seguimiento.etapa = 'AUDITORIA';
        await this.registrar({ ...seguimiento.evento, resultado: 'EXITO', metadatos: {
            ...seguimiento.evento.metadatos, efecto: 'CONFIRMADO',
            ...(antes && despues ? { camposModificados: camposModificados ?? camposModificadosAuditoria(antes, despues) } : {})
        } }, { transaction });
        seguimiento.etapa = 'CONFIRMACION';
    }

    static async consultar(filtros, { contexto, responsable }) {
        // Página y total de esta solicitud comparten snapshot. Nuevas páginas
        // son consultas nuevas; no se garantiza un snapshot entre solicitudes.
        const resultado = await db.sequelize.transaction({
            isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ
        }, transaction => bitacoraAuditoriaRepository.findAll(filtros, { transaction }));
        await this.intentarRegistrar({ contexto, responsable, tipoEvento: 'BITACORA_CONSULTAR',
            resultado: 'EXITO', metadatos: { cantidadResultados: resultado.rows.length } });
        return { ...resultado, pagina: filtros.pagina, limite: filtros.limite,
            totalPaginas: Math.ceil(resultado.total / filtros.limite) };
    }

    static async consultarEvento(idEvento, { contexto, responsable }) {
        const evento = await bitacoraAuditoriaRepository.findById({ idEvento });
        if (!evento) throw anotarErrorAuditoria(new AppError('Evento de Bitácora no encontrado', 404), {
            tipoEvento: 'BITACORA_EVENTO_CONSULTAR', causa: 'NO_ENCONTRADO',
            registro: { tipo: 'BITACORA', id: idEvento }
        });
        await this.intentarRegistrar({ contexto, responsable, tipoEvento: 'BITACORA_EVENTO_CONSULTAR',
            resultado: 'EXITO', registro: { tipo: 'BITACORA', id: idEvento }, metadatos: { cantidadResultados: 1 } });
        return evento;
    }

    // Seguimiento interno para procesos de seguridad. No recibe objetos HTTP.
    // El proceso captura cuenta/contadores bajo bloqueo y señala la última
    // transacción: commit sin respuesta se expresa como incierto, sin reintento.
    static async ejecutarSeguridad(evento, operacion) {
        const seguimiento = { evento, etapa: 'VERIFICACION', efecto: 'NO_APLICA' };
        try {
            return await operacion(seguimiento);
        } catch (error) {
            const privado = obtenerErrorAuditoria(error);
            if (!privado?.gestionado) {
                const esperado = Boolean(privado?.causa) && privado?.tipoEvento !== 'ERROR_TECNICO';
                await this.intentarRegistrar({ ...seguimiento.evento,
                    tipoEvento: esperado ? privado.tipoEvento ?? evento.tipoEvento : 'ERROR_TECNICO',
                    resultado: esperado ? 'RECHAZADO' : 'FALLO',
                    causa: privado?.causa ?? clasificarErrorTecnicoAuditoria(error),
                    metadatos: { ...seguimiento.evento.metadatos,
                        operacionOrigen: `${CATALOGO_AUDITORIA[evento.tipoEvento].modulo}.${CATALOGO_AUDITORIA[evento.tipoEvento].accion}`,
                        etapa: seguimiento.etapa, efecto: seguimiento.transaction?.finished === 'commit' &&
                            seguimiento.efecto !== 'CONFIRMADO' ? 'INCIERTO' : seguimiento.efecto }
                });
            }
            throw marcarErrorAuditoriaGestionado(error);
        }
    }

    static async registrar(evento, opciones = {}) {
        const [idEvento] = await this.registrarEventos([evento], opciones);
        return idEvento;
    }

    // Con transaction: el caller confirma o revierte negocio + auditoría.
    // Sin transaction: solo eventos no obligatorios de éxito crítico; se crea
    // una transacción propia. No modifica contadores, bloqueos ni cookies.
    static async registrarEventos(eventos, { transaction } = {}) {
        try {
            return await persistir(eventos, transaction);
        } catch (error) {
            diagnosticar(error, eventos);
            throw marcarErrorAuditoriaGestionado(new AppError('No se pudo completar el registro de auditoría', 503));
        }
    }

    // Usar después de confirmar seguridad o terminar un rollback. No acepta
    // transacciones externas: fallar aquí jamás debe revertir esa protección.
    static async intentarRegistrar(eventos) {
        const grupo = Array.isArray(eventos) ? eventos : [eventos];
        if (grupo.some(requiereTransaccionNegocio)) {
            throw new AppError('El éxito crítico requiere auditoría transaccional', 503);
        }
        try {
            const ids = await persistir(grupo);
            return { registrado: true, estado: 'CONFIRMADO', ids };
        } catch (error) {
            diagnosticar(error, grupo);
            // false significa que no se confirmó; no garantiza ausencia tras
            // una pérdida de respuesta del COMMIT. Nunca reintentar aquí.
            return { registrado: false, estado: 'NO_CONFIRMADO', ids: [] };
        }
    }
}
