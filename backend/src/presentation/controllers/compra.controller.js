import { compraService } from '../../business/services/compra.service.js';
import { compraValidator } from '../../business/validators/compra.validator.js';
import { AppError } from '../../shared/errors/app-error.js';

const getValidatedData = (result) => {
    if (!result.success) throw new AppError('Datos inválidos', 400, result.error.issues);
    return result.data;
};

export class compraController {
    static async anularCompra(req, res, next) {
        try {
            const { idCompra } = getValidatedData(compraValidator.validateId(req.params));
            getValidatedData(compraValidator.validateSinFiltros(req.query));
            const { motivo } = getValidatedData(compraValidator.validateAnular(req.body));
            const compra = await compraService.anularCompra(idCompra, motivo, req.usuario.idUsuario);
            return res.status(200).json({ message: 'Compra anulada exitosamente', data: compra });
        } catch (error) { next(error); }
    }

    static async createCompra(req, res, next) {
        try {
            getValidatedData(compraValidator.validateSinFiltros(req.query));
            const data = getValidatedData(compraValidator.validateCreate(req.body));
            const compra = await compraService.createCompra(data, req.usuario.idUsuario);
            return res.status(201).json({ message: 'Compra registrada exitosamente', data: compra });
        } catch (error) { next(error); }
    }

    static async getCompras(req, res, next) {
        try {
            const filtros = getValidatedData(compraValidator.validateFiltros(req.query));
            const compras = await compraService.getCompras(filtros, req.usuario.idUsuario);
            return res.status(200).json({ data: compras });
        } catch (error) { next(error); }
    }

    static async getCompraById(req, res, next) {
        try {
            const { idCompra } = getValidatedData(compraValidator.validateId(req.params));
            getValidatedData(compraValidator.validateSinFiltros(req.query));
            const compra = await compraService.getCompraById(idCompra);
            return res.status(200).json({ data: compra });
        } catch (error) { next(error); }
    }
}
