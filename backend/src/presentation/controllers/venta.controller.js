import { ventaService } from '../../business/services/venta.service.js';
import { ventaValidator } from '../../business/validators/venta.validator.js';
import { toResumenVenta, toDetalleVenta } from '../dtos/venta.dto.js';
import { AppError } from '../../shared/errors/app-error.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';
import { ejecutarConAuditoria } from '../../shared/utils/auditoria-http.js';

const getValidatedData = result => {
    if (!result.success) throw anotarErrorAuditoria(new AppError('Datos inválidos', 400, result.error.issues),
        { tipoEvento: 'VALIDACION_RECHAZADA', causa: 'ENTRADA_INVALIDA' });
    return result.data;
};

export class ventaController {
    static async anularVenta(req, res, next) {
        try {
            const { idVenta } = getValidatedData(ventaValidator.validateId(req.params));
            getValidatedData(ventaValidator.validateSinFiltros(req.query));
            const { motivo } = getValidatedData(ventaValidator.validateAnular(req.body));
            const venta = await ejecutarConAuditoria(req, auditoria =>
                ventaService.anularVenta(idVenta, motivo, req.usuario.idUsuario, auditoria));
            return res.status(200).json({ message: 'Venta anulada exitosamente', data: toDetalleVenta(venta) });
        } catch (error) { next(error); }
    }

    static async confirmarVenta(req, res, next) {
        try {
            const { idVenta } = getValidatedData(ventaValidator.validateId(req.params));
            getValidatedData(ventaValidator.validateSinFiltros(req.query));
            getValidatedData(ventaValidator.validateConfirmar(req.body));
            const venta = await ejecutarConAuditoria(req, auditoria =>
                ventaService.confirmarVenta(idVenta, req.usuario.idUsuario, auditoria));
            return res.status(200).json({ message: 'Venta confirmada exitosamente', data: toDetalleVenta(venta) });
        } catch (error) { next(error); }
    }

    static async createVenta(req, res, next) {
        try {
            getValidatedData(ventaValidator.validateSinFiltros(req.query));
            const data = getValidatedData(ventaValidator.validateCreate(req.body));
            const venta = await ejecutarConAuditoria(req, auditoria =>
                ventaService.createVenta(data, req.usuario.idUsuario, auditoria));
            return res.status(201).json({ message: 'Venta pendiente registrada exitosamente', data: toDetalleVenta(venta) });
        } catch (error) { next(error); }
    }

    static async getVentas(req, res, next) {
        try {
            const filtros = getValidatedData(ventaValidator.validateFiltros(req.query));
            const { rows, total } = await ventaService.getVentas(filtros);
            return res.status(200).json({ data: rows.map(toResumenVenta), paginacion: {
                pagina: filtros.pagina, limite: filtros.limite, total,
                totalPaginas: Math.ceil(total / filtros.limite)
            } });
        } catch (error) { next(error); }
    }

    static async getVentaById(req, res, next) {
        try {
            const { idVenta } = getValidatedData(ventaValidator.validateId(req.params));
            getValidatedData(ventaValidator.validateSinFiltros(req.query));
            const venta = await ventaService.getVentaById(idVenta);
            return res.status(200).json({ data: toDetalleVenta(venta) });
        } catch (error) { next(error); }
    }
}
