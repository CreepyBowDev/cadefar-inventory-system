import { composicionMedicamentoService } from '../../business/services/composicion-medicamento.service.js';
import { composicionMedicamentoValidator } from '../../business/validators/composicion-medicamento.validator.js';
import { AppError } from '../../shared/errors/app-error.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';
import { ejecutarConAuditoria } from '../../shared/utils/auditoria-http.js';

const getValidatedData = (result) => {
    if (!result.success) throw anotarErrorAuditoria(new AppError('Datos inválidos', 400, result.error.issues),
        { tipoEvento: 'VALIDACION_RECHAZADA', causa: 'ENTRADA_INVALIDA' });
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
            const composicion = await ejecutarConAuditoria(req, auditoria => composicionMedicamentoService.createComposicion(idMedicamento, data, auditoria));
            return res.status(201).json({ message: 'Composición registrada exitosamente', data: composicion });
        } catch (error) { next(error); }
    }

    static async updateComposicion(req, res, next) {
        try {
            const { idMedicamento, idComposicion } = getValidatedData(composicionMedicamentoValidator.validateId(req.params));
            const data = getValidatedData(composicionMedicamentoValidator.validateUpdate(req.body));
            const composicion = await ejecutarConAuditoria(req, auditoria => composicionMedicamentoService.updateComposicion(idMedicamento, idComposicion, data, auditoria));
            return res.status(200).json({ message: 'Composición modificada exitosamente', data: composicion });
        } catch (error) { next(error); }
    }

    static async removeComposicion(req, res, next) {
        try {
            const { idMedicamento, idComposicion } = getValidatedData(composicionMedicamentoValidator.validateId(req.params));
            await ejecutarConAuditoria(req, auditoria => composicionMedicamentoService.removeComposicion(idMedicamento, idComposicion, auditoria));
            return res.status(200).json({ message: 'Relación de composición retirada exitosamente' });
        } catch (error) { next(error); }
    }
}
