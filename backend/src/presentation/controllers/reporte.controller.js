import { reporteService } from '../../business/services/reporte.service.js';
import { reporteValidator } from '../../business/validators/reporte.validator.js';
import { AppError } from '../../shared/errors/app-error.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';
import { ejecutarConAuditoria } from '../../shared/utils/auditoria-http.js';

export class reporteController {
    static async estadisticasPerdidas(req, res, next) {
        return consultarEstadisticas('Perdidas', req, res, next);
    }

    static async estadisticasVentas(req, res, next) {
        return consultarEstadisticas('Ventas', req, res, next);
    }

    static async estadisticasCompras(req, res, next) {
        return consultarEstadisticas('Compras', req, res, next);
    }

    static async consultarPerdidas(req, res, next) {
        try {
            const validacion = reporteValidator.validatePerdidas(req.query);
            if (!validacion.success) throw anotarErrorAuditoria(
                new AppError('Datos inválidos', 400, validacion.error.issues),
                { tipoEvento: 'VALIDACION_RECHAZADA', causa: 'ENTRADA_INVALIDA' });
            const resultado = await ejecutarConAuditoria(req, auditoria =>
                reporteService.consultarPerdidas(validacion.data, auditoria));
            return res.status(200).json(resultado);
        } catch (error) { next(error); }
    }

    static async consultarCompras(req, res, next) {
        try {
            const validacion = reporteValidator.validateCompras(req.query);
            if (!validacion.success) throw anotarErrorAuditoria(
                new AppError('Datos inválidos', 400, validacion.error.issues),
                { tipoEvento: 'VALIDACION_RECHAZADA', causa: 'ENTRADA_INVALIDA' });
            const resultado = await ejecutarConAuditoria(req, auditoria =>
                reporteService.consultarCompras(validacion.data, auditoria));
            return res.status(200).json(resultado);
        } catch (error) { next(error); }
    }

    static async consultarVentas(req, res, next) {
        try {
            const validacion = reporteValidator.validateVentas(req.query);
            if (!validacion.success) throw anotarErrorAuditoria(
                new AppError('Datos inválidos', 400, validacion.error.issues),
                { tipoEvento: 'VALIDACION_RECHAZADA', causa: 'ENTRADA_INVALIDA' });
            const resultado = await ejecutarConAuditoria(req, auditoria =>
                reporteService.consultarVentas(validacion.data, auditoria));
            return res.status(200).json(resultado);
        } catch (error) { next(error); }
    }
}

const consultarEstadisticas = async (fuente, req, res, next) => {
    try {
        const validacion = reporteValidator[`validateEstadisticas${fuente}`](req.query);
        if (!validacion.success) {
            const limite = validacion.error.issues.find(issue => issue.params?.limiteIntervalos);
            throw anotarErrorAuditoria(new AppError(limite ? limite.message : 'Datos inválidos',
                400, validacion.error.issues), { tipoEvento: 'VALIDACION_RECHAZADA', causa: 'ENTRADA_INVALIDA' });
        }
        const resultado = await ejecutarConAuditoria(req, auditoria =>
            reporteService[`estadisticas${fuente}`](validacion.data, auditoria));
        return res.status(200).json(resultado);
    } catch (error) { next(error); }
};
