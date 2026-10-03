import { composicionMedicamentoService } from '../../business/services/composicion-medicamento.service.js';
import { composicionMedicamentoValidator } from '../../business/validators/composicion-medicamento.validator.js';
import { AppError } from '../../shared/errors/app-error.js';

const getValidatedData = (result) => {
    if (!result.success) throw new AppError('Datos inválidos', 400, result.error.issues);
    return result.data;
};

export class composicionMedicamentoController {
    static async getComposicionMedicamento(req, res, next) {
        try {
            const { idMedicamento } = getValidatedData(composicionMedicamentoValidator.validateMedicamentoId(req.params));
            const composicion = await composicionMedicamentoService.getComposicionMedicamento(idMedicamento);
            return res.status(200).json({ data: composicion });
        } catch (error) { next(error); }
    }

    static async createComposicion(req, res, next) {
        try {
            const { idMedicamento } = getValidatedData(composicionMedicamentoValidator.validateMedicamentoId(req.params));
            const data = getValidatedData(composicionMedicamentoValidator.validateCreate(req.body));
            const composicion = await composicionMedicamentoService.createComposicion(idMedicamento, data);
            return res.status(201).json({ message: 'Composición registrada exitosamente', data: composicion });
        } catch (error) { next(error); }
    }

    static async updateComposicion(req, res, next) {
        try {
            const { idMedicamento, idComposicion } = getValidatedData(composicionMedicamentoValidator.validateId(req.params));
            const data = getValidatedData(composicionMedicamentoValidator.validateUpdate(req.body));
            const composicion = await composicionMedicamentoService.updateComposicion(idMedicamento, idComposicion, data);
            return res.status(200).json({ message: 'Composición modificada exitosamente', data: composicion });
        } catch (error) { next(error); }
    }

    static async removeComposicion(req, res, next) {
        try {
            const { idMedicamento, idComposicion } = getValidatedData(composicionMedicamentoValidator.validateId(req.params));
            await composicionMedicamentoService.removeComposicion(idMedicamento, idComposicion);
            return res.status(200).json({ message: 'Relación de composición retirada exitosamente' });
        } catch (error) { next(error); }
    }
}
