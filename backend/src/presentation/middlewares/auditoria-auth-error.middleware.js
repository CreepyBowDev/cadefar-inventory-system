import { bitacoraAuditoriaService } from '../../business/services/bitacora-auditoria.service.js';
import { obtenerErrorAuditoria, marcarErrorAuditoriaGestionado,
    clasificarErrorTecnicoAuditoria } from '../../shared/utils/auditoria-error.js';
import { identificarOperacionAuditoria } from '../../shared/constants/auditoria-operaciones.js';
import { AppError } from '../../shared/errors/app-error.js';

export const auditoriaAuthErrorMiddleware = async (error, req, res, next) => {
    const operacionOrigen = identificarOperacionAuditoria(req.method, req.path);
    const privado = obtenerErrorAuditoria(error);
    if (!operacionOrigen || !req.contextoAuditoria || privado?.gestionado) return next(error);

    const parserInvalido = (error.type === 'entity.parse.failed' && error.status === 400) ||
        (error.type === 'entity.too.large' && error.status === 413);
    // Un AppError de negocio sin contrato privado pertenece a la integración
    // de su módulo. No inferir su causa por mensaje o código HTTP.
    if (error instanceof AppError && !privado?.causa && !parserInvalido) return next(error);
    const tipoEvento = privado?.tipoEvento ?? (privado?.causa === 'RECUPERACION_NO_HABILITADA'
        ? operacionOrigen.endsWith('SOLICITAR_RECUPERACION') ? 'RECUPERACION_SOLICITAR' : 'PASSWORD_RESTABLECER_RECUPERACION'
        : parserInvalido ? 'VALIDACION_RECHAZADA' : privado?.causa ? 'OPERACION_RECHAZADA' : 'ERROR_TECNICO');
    const causa = privado?.causa ?? (parserInvalido ? 'ENTRADA_INVALIDA' : clasificarErrorTecnicoAuditoria(error));
    const confirmado = req.resultadoAuditoriaAuth;
    const responsable = confirmado?.responsable ?? (req.usuario ? { idUsuario: req.usuario.idUsuario,
        nombreUsuario: req.usuario.nombreUsuario, idRol: req.usuario.idRol } : undefined);
    const cuentaObjetivo = privado?.cuentaObjetivo ?? confirmado?.cuentaObjetivo ?? confirmado?.responsable;
    // Marcar antes de persistir. Un fallo de auditoría no genera otro evento
    // sobre sí mismo ni sustituye el error de autenticación/HTTP original.
    marcarErrorAuditoriaGestionado(error);
    await bitacoraAuditoriaService.intentarRegistrar({
        contexto: req.contextoAuditoria, tipoEvento, causa,
        resultado: tipoEvento === 'ERROR_TECNICO' ? 'FALLO' : 'RECHAZADO',
        responsable,
        cuentaObjetivo,
        registro: privado?.registro ?? confirmado?.registro ??
            (cuentaObjetivo ? { tipo: 'USUARIO', id: cuentaObjetivo.idUsuario } : undefined),
        metadatos: { operacionOrigen, efecto: confirmado?.efecto ??
            (tipoEvento === 'ERROR_TECNICO' && req.method !== 'GET' &&
                !operacionOrigen.startsWith('AUTENTICACION.') ? 'INCIERTO' : 'NO_APLICA'),
            etapa: confirmado?.etapa ?? 'VERIFICACION' }
    });
    return next(error);
};
