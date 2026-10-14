import { principioActivoService } from '../../business/services/principio-activo.service.js';
import { principioActivoValidator } from '../../business/validators/principio-activo.validator.js';
import { AppError } from '../../shared/errors/app-error.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';
import { ejecutarConAuditoria } from '../../shared/utils/auditoria-http.js';

const getValidatedData = (result) => {
    if (!result.success) throw anotarErrorAuditoria(new AppError('Datos inválidos', 400, result.error.issues),
        { tipoEvento: 'VALIDACION_RECHAZADA', causa: 'ENTRADA_INVALIDA' });
    return result.data;
};
const getIdPrincipioActivo = (params) => getValidatedData(principioActivoValidator.validateId(params)).idPrincipioActivo;

export class principioActivoController {
    static async getPrincipiosActivos(req, res, next) {
        try {
            const principios = await principioActivoService.getPrincipiosActivos();
            return res.status(200).json({ data: principios });
        } catch (error) { next(error); }
    }

    static async getPrincipioActivoById(req, res, next) {
        try {
            const principio = await principioActivoService.getPrincipioActivoById(getIdPrincipioActivo(req.params));
            return res.status(200).json({ data: principio });
        } catch (error) { next(error); }
    }

    static async createPrincipioActivo(req, res, next) {
        try {
            const data = getValidatedData(principioActivoValidator.validateCreate(req.body));
            const principio = await ejecutarConAuditoria(req, auditoria => principioActivoService.createPrincipioActivo(data, auditoria));
            return res.status(201).json({ message: 'Principio activo creado exitosamente', data: principio });
        } catch (error) { next(error); }
    }

    static async updatePrincipioActivo(req, res, next) {
        try {
            const idPrincipioActivo = getIdPrincipioActivo(req.params);
            const data = getValidatedData(principioActivoValidator.validateUpdate(req.body));
            const principio = await ejecutarConAuditoria(req, auditoria => principioActivoService.updatePrincipioActivo(idPrincipioActivo, data, auditoria));
            return res.status(200).json({ message: 'Principio activo modificado exitosamente', data: principio });
        } catch (error) { next(error); }
    }

    static async updateEstado(req, res, next) {
        try {
            const idPrincipioActivo = getIdPrincipioActivo(req.params);
            const data = getValidatedData(principioActivoValidator.validateUpdateEstado(req.body));
            const principio = await ejecutarConAuditoria(req, auditoria => principioActivoService.updateEstado(idPrincipioActivo, data, auditoria));
            return res.status(200).json({
                message: data.estado ? 'Principio activo activado exitosamente' : 'Principio activo desactivado exitosamente',
                data: principio
            });
        } catch (error) { next(error); }
    }
}
