import { medicamentoService } from '../../business/services/medicamento.service.js';
import { medicamentoValidator } from '../../business/validators/medicamento.validator.js';
import { AppError } from '../../shared/errors/app-error.js';

const getValidatedData = (result) => {
    if (!result.success) throw new AppError('Datos inválidos', 400, result.error.issues);
    return result.data;
};
const getIdMedicamento = (params) => getValidatedData(medicamentoValidator.validateId(params)).idMedicamento;

export class medicamentoController {
    static async getMedicamentos(req, res, next) {
        try {
            const filtros = getValidatedData(medicamentoValidator.validateFiltros(req.query));
            const medicamentos = await medicamentoService.getMedicamentos(filtros);
            return res.status(200).json({ data: medicamentos });
        } catch (error) { next(error); }
    }

    static async getMedicamentoById(req, res, next) {
        try {
            const medicamento = await medicamentoService.getMedicamentoById(getIdMedicamento(req.params));
            return res.status(200).json({ data: medicamento });
        } catch (error) { next(error); }
    }

    static async createMedicamento(req, res, next) {
        try {
            const data = getValidatedData(medicamentoValidator.validateCreate(req.body));
            const medicamento = await medicamentoService.createMedicamento(data);
            return res.status(201).json({ message: 'Medicamento creado exitosamente', data: medicamento });
        } catch (error) { next(error); }
    }

    static async updateMedicamento(req, res, next) {
        try {
            const idMedicamento = getIdMedicamento(req.params);
            const data = getValidatedData(medicamentoValidator.validateUpdate(req.body));
            const medicamento = await medicamentoService.updateMedicamento(idMedicamento, data);
            return res.status(200).json({ message: 'Medicamento modificado exitosamente', data: medicamento });
        } catch (error) { next(error); }
    }

    static async updateEstado(req, res, next) {
        try {
            const idMedicamento = getIdMedicamento(req.params);
            const data = getValidatedData(medicamentoValidator.validateUpdateEstado(req.body));
            const medicamento = await medicamentoService.updateEstado(idMedicamento, data);
            return res.status(200).json({
                message: data.estado ? 'Medicamento activado exitosamente' : 'Medicamento desactivado exitosamente',
                data: medicamento
            });
        } catch (error) { next(error); }
    }
}
