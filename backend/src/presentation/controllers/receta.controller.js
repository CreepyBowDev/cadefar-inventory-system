import { recetaService } from '../../business/services/receta.service.js';
import { recetaValidator } from '../../business/validators/receta.validator.js';
import { AppError } from '../../shared/errors/app-error.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';
import { ejecutarConAuditoria } from '../../shared/utils/auditoria-http.js';
import { toResumenReceta, toDetalleReceta } from '../dtos/receta.dto.js';

const getValidatedData = result => {
    // No devolver valores ni detalles crudos de errores de datos personales.
    if (!result.success) throw anotarErrorAuditoria(new AppError('Datos de receta inválidos', 400),
        { tipoEvento: 'VALIDACION_RECHAZADA', causa: 'ENTRADA_INVALIDA' });
    return result.data;
};

export class recetaController {
    static async getRecetas(req, res, next) {
        try {
            const { idVenta } = getValidatedData(recetaValidator.validateVentaId(req.params));
            const filtros = getValidatedData(recetaValidator.validateConsulta(req.query));
            const { rows, total } = await ejecutarConAuditoria(req, auditoria =>
                recetaService.getRecetas(idVenta, filtros, auditoria));
            res.set('Cache-Control', 'no-store');
            return res.status(200).json({ data: rows.map(toResumenReceta), paginacion: {
                pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite)
            } });
        } catch (error) { next(error); }
    }

    static async getRecetaById(req, res, next) {
        try {
            const { idVenta, idReceta } = getValidatedData(recetaValidator.validateRecetaId(req.params));
            getValidatedData(recetaValidator.validateSinFiltros(req.query));
            const receta = await ejecutarConAuditoria(req, auditoria =>
                recetaService.getRecetaById(idVenta, idReceta, auditoria));
            res.set('Cache-Control', 'no-store');
            return res.status(200).json({ data: toDetalleReceta(receta) });
        } catch (error) { next(error); }
    }

    static async revisarReceta(req, res, next) {
        try {
            const { idVenta, idReceta } = getValidatedData(recetaValidator.validateRecetaId(req.params));
            getValidatedData(recetaValidator.validateSinFiltros(req.query));
            const data = getValidatedData(recetaValidator.validateRevision(req.body));
            const receta = await ejecutarConAuditoria(req, auditoria =>
                recetaService.revisarReceta(idVenta, idReceta, data, req.usuario.idUsuario, auditoria));
            res.set('Cache-Control', 'no-store');
            return res.status(200).json({ message: 'Revisión de receta registrada exitosamente', data: toDetalleReceta(receta) });
        } catch (error) { next(error); }
    }

    static async createReceta(req, res, next) {
        try {
            const { idVenta } = getValidatedData(recetaValidator.validateVentaId(req.params));
            getValidatedData(recetaValidator.validateSinFiltros(req.query));
            const data = getValidatedData(recetaValidator.validateCreate(req.body));
            const receta = await ejecutarConAuditoria(req, auditoria => recetaService.createReceta(idVenta, data, auditoria));
            res.set('Cache-Control', 'no-store');
            return res.status(201).json({ message: 'Receta registrada exitosamente', data: toDetalleReceta(receta) });
        } catch (error) { next(error); }
    }
}
