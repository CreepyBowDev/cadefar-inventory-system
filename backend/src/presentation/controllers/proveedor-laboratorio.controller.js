import { proveedorLaboratorioService } from '../../business/services/proveedor-laboratorio.service.js';
import { proveedorLaboratorioValidator } from '../../business/validators/proveedor-laboratorio.validator.js';
import { AppError } from '../../shared/errors/app-error.js';

const getValidatedData = (result) => {
    if (!result.success) {
        throw new AppError('Datos inválidos', 400, result.error.issues);
    }

    return result.data;
};

const getIdProveedorLaboratorio = (params) => getValidatedData(
    proveedorLaboratorioValidator.validateId(params)
).idProveedorLaboratorio;

export class proveedorLaboratorioController {
    static async createProveedorLaboratorio(req, res, next) {
        try {
            const data = getValidatedData(
                proveedorLaboratorioValidator.validateCreate(req.body)
            );
            const proveedor = await proveedorLaboratorioService.createProveedorLaboratorio(data);

            return res.status(201).json({
                message: 'Proveedor o laboratorio creado exitosamente',
                data: proveedor
            });
        } catch (error) {
            next(error);
        }
    }

    static async getProveedoresLaboratorios(req, res, next) {
        try {
            const proveedores = await proveedorLaboratorioService.getProveedoresLaboratorios();
            return res.status(200).json({ data: proveedores });
        } catch (error) {
            next(error);
        }
    }

    static async getProveedorLaboratorioById(req, res, next) {
        try {
            const idProveedorLaboratorio = getIdProveedorLaboratorio(req.params);
            const proveedor = await proveedorLaboratorioService.getProveedorLaboratorioById(
                idProveedorLaboratorio
            );
            return res.status(200).json({ data: proveedor });
        } catch (error) {
            next(error);
        }
    }

    static async updateProveedorLaboratorio(req, res, next) {
        try {
            const idProveedorLaboratorio = getIdProveedorLaboratorio(req.params);
            const data = getValidatedData(
                proveedorLaboratorioValidator.validateUpdate(req.body)
            );
            const proveedor = await proveedorLaboratorioService.updateProveedorLaboratorio(
                idProveedorLaboratorio,
                data
            );

            return res.status(200).json({
                message: 'Proveedor o laboratorio modificado exitosamente',
                data: proveedor
            });
        } catch (error) {
            next(error);
        }
    }

    static async updateEstado(req, res, next) {
        try {
            const idProveedorLaboratorio = getIdProveedorLaboratorio(req.params);
            const data = getValidatedData(
                proveedorLaboratorioValidator.validateUpdateEstado(req.body)
            );
            const proveedor = await proveedorLaboratorioService.updateEstado(
                idProveedorLaboratorio,
                data
            );

            return res.status(200).json({
                message: data.estado
                    ? 'Proveedor o laboratorio activado exitosamente'
                    : 'Proveedor o laboratorio desactivado exitosamente',
                data: proveedor
            });
        } catch (error) {
            next(error);
        }
    }
}
