import { bitacoraAuditoriaService } from '../../business/services/bitacora-auditoria.service.js';
import { validarConsultaAuditoriaHttp, validarIdEventoAuditoriaHttp,
    validarDetalleAuditoriaHttp } from '../../business/validators/auditoria.validator.js';
import { toResumenBitacora, toDetalleBitacora } from '../dtos/bitacora-auditoria.dto.js';
import { AppError } from '../../shared/errors/app-error.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';

const validarEntrada = operacion => {
    try { return operacion(); }
    catch (error) {
        if (error.name !== 'ZodError' && !(error instanceof TypeError)) throw error;
        throw anotarErrorAuditoria(new AppError('Filtros, paginación o identificador de Bitácora inválidos', 400),
            { tipoEvento: 'VALIDACION_RECHAZADA', causa: 'ENTRADA_INVALIDA' });
    }
};

const datosAuditoria = req => ({ contexto: req.contextoAuditoria, responsable: {
    idUsuario: req.usuario.idUsuario, idRol: req.usuario.idRol, nombreUsuario: req.usuario.nombreUsuario
} });

export class bitacoraAuditoriaController {
    static async consultar(req, res, next) {
        try {
            const filtros = validarEntrada(() => validarConsultaAuditoriaHttp(req.query));
            const resultado = await bitacoraAuditoriaService.consultar(filtros, datosAuditoria(req));
            req.resultadoAuditoriaAuth = { efecto: 'NO_APLICA', etapa: 'RESPUESTA' };
            return res.status(200).json({ data: resultado.rows.map(toResumenBitacora), paginacion: {
                pagina: resultado.pagina, limite: resultado.limite,
                total: resultado.total, totalPaginas: resultado.totalPaginas
            } });
        } catch (error) { next(error); }
    }

    static async consultarEvento(req, res, next) {
        try {
            const idEvento = validarEntrada(() => {
                validarDetalleAuditoriaHttp(req.query);
                return validarIdEventoAuditoriaHttp(req.params);
            });
            const evento = await bitacoraAuditoriaService.consultarEvento(idEvento, datosAuditoria(req));
            req.resultadoAuditoriaAuth = { efecto: 'NO_APLICA', etapa: 'RESPUESTA', registro: { tipo: 'BITACORA', id: idEvento } };
            return res.status(200).json({ data: toDetalleBitacora(evento) });
        } catch (error) { next(error); }
    }
}
