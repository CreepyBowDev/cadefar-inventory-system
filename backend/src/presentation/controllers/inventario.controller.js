import { inventarioService } from '../../business/services/inventario.service.js';
import { inventarioValidator } from '../../business/validators/inventario.validator.js';
import { AppError } from '../../shared/errors/app-error.js';

const getValidatedData = (result) => {
    if (!result.success) throw new AppError('Datos inválidos', 400, result.error.issues);
    return result.data;
};

export class inventarioController {
    static async registrarRetiroVencimiento(req, res, next) {
        try {
            getValidatedData(inventarioValidator.validateSinFiltros(req.query));
            const datos = getValidatedData(inventarioValidator.validateRetiroVencimiento(req.body));
            const data = await inventarioService.registrarRetiroVencimiento(datos, req.usuario.idUsuario);
            return res.status(201).json({ message: 'Retiro por vencimiento registrado exitosamente', data });
        } catch (error) { next(error); }
    }

    static async registrarRetiroDano(req, res, next) {
        try {
            getValidatedData(inventarioValidator.validateSinFiltros(req.query));
            const datos = getValidatedData(inventarioValidator.validateRetiroDano(req.body));
            const data = await inventarioService.registrarRetiroDano(datos, req.usuario.idUsuario);
            return res.status(201).json({ message: 'Retiro por daño registrado exitosamente', data });
        } catch (error) { next(error); }
    }

    static async registrarAjuste(req, res, next) {
        try {
            getValidatedData(inventarioValidator.validateSinFiltros(req.query));
            const datos = getValidatedData(inventarioValidator.validateAjuste(req.body));
            const data = await inventarioService.registrarAjuste(datos, req.usuario.idUsuario);
            return res.status(data.ajusteRealizado ? 201 : 200).json({
                message: data.ajusteRealizado ? 'Ajuste registrado exitosamente' : 'No fue necesario ajustar la existencia',
                data
            });
        } catch (error) { next(error); }
    }

    static async getInventario(req, res, next) {
        try {
            const filtros = getValidatedData(inventarioValidator.validateFiltrosInventario(req.query));
            const inventario = await inventarioService.getInventario(filtros);
            return res.status(200).json(inventario);
        } catch (error) { next(error); }
    }

    static async getExistencias(req, res, next) {
        try {
            const { idMedicamento } = getValidatedData(inventarioValidator.validateId(req.params));
            getValidatedData(inventarioValidator.validateSinFiltros(req.query));
            const existencias = await inventarioService.getExistencias(idMedicamento);
            return res.status(200).json(existencias);
        } catch (error) { next(error); }
    }

    static async getMovimientos(req, res, next) {
        try {
            const filtros = getValidatedData(inventarioValidator.validateFiltrosMovimientos(req.query));
            const movimientos = await inventarioService.getMovimientos(filtros);
            return res.status(200).json({ data: movimientos });
        } catch (error) { next(error); }
    }

    static async getProximosAVencer(req, res, next) {
        try {
            const filtros = getValidatedData(inventarioValidator.validateFiltrosInventario(req.query));
            const existencias = await inventarioService.getProximosAVencer(filtros);
            return res.status(200).json(existencias);
        } catch (error) { next(error); }
    }

    static async getVencidos(req, res, next) {
        try {
            const filtros = getValidatedData(inventarioValidator.validateFiltrosInventario(req.query));
            const existencias = await inventarioService.getVencidos(filtros);
            return res.status(200).json(existencias);
        } catch (error) { next(error); }
    }

    static async getStockBajo(req, res, next) {
        try {
            const filtros = getValidatedData(inventarioValidator.validateFiltrosInventario(req.query));
            const medicamentos = await inventarioService.getStockBajo(filtros);
            return res.status(200).json(medicamentos);
        } catch (error) { next(error); }
    }
}
