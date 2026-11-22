import { pagoCompraService } from '../../business/services/pago-compra.service.js';
import { pagoCompraValidator } from '../../business/validators/pago-compra.validator.js';
import { AppError } from '../../shared/errors/app-error.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';
import { ejecutarConAuditoria } from '../../shared/utils/auditoria-http.js';

const validar = result => {
    if (!result.success) throw anotarErrorAuditoria(new AppError('Datos de pago inválidos', 400, result.error.issues),
        { tipoEvento: 'VALIDACION_RECHAZADA', causa: 'ENTRADA_INVALIDA' });
    return result.data;
};

export class pagoCompraController {
    static async autorizarPrueba(req, res, next) {
        try {
            const { idCompra, idPago } = validar(pagoCompraValidator.validatePago(req.params));
            validar(pagoCompraValidator.validateVacio(req.query));
            const { decision } = validar(pagoCompraValidator.validateAutorizacionPrueba(req.body));
            const pago = await ejecutarConAuditoria(req, auditoria => pagoCompraService.autorizarPrueba(idCompra, idPago, decision, auditoria));
            return res.set('Cache-Control', 'no-store').json({ data: pago });
        } catch (error) { next(error); }
    }
    static async consultar(req, res, next) {
        try {
            const { idCompra } = validar(pagoCompraValidator.validateCompra(req.params));
            validar(pagoCompraValidator.validateVacio(req.query));
            res.set('Cache-Control', 'no-store');
            return res.json({ data: await pagoCompraService.consultar(idCompra) });
        } catch (error) { next(error); }
    }
    static async iniciar(req, res, next) {
        try {
            const { idCompra } = validar(pagoCompraValidator.validateCompra(req.params));
            validar(pagoCompraValidator.validateVacio(req.query));
            const data = validar(pagoCompraValidator.validateIniciar(req.body));
            const pago = await ejecutarConAuditoria(req, auditoria => pagoCompraService.iniciar(idCompra, data, req.usuario.idUsuario, auditoria));
            res.set('Cache-Control', 'no-store');
            return res.status(200).json({ data: pago });
        } catch (error) { next(error); }
    }
    static async verificar(req, res, next) { return pagoCompraController.actualizar(req, res, next, false); }
    static async confirmar(req, res, next) { return pagoCompraController.actualizar(req, res, next, true); }
    static async conciliar(req, res, next) {
        try {
            const { idCompra, idPago } = validar(pagoCompraValidator.validatePago(req.params));
            validar(pagoCompraValidator.validateVacio(req.query));
            const { idExterno } = validar(pagoCompraValidator.validateConciliar(req.body));
            const pago = await ejecutarConAuditoria(req, auditoria => pagoCompraService.verificar(idCompra, idPago, false, auditoria, idExterno));
            res.set('Cache-Control', 'no-store');
            return res.json({ data: pago });
        } catch (error) { next(error); }
    }
    static async actualizar(req, res, next, capturar) {
        try {
            const { idCompra, idPago } = validar(pagoCompraValidator.validatePago(req.params));
            validar(pagoCompraValidator.validateVacio(req.query));
            validar(capturar ? pagoCompraValidator.validateConfirmar(req.body) : pagoCompraValidator.validateVacio(req.body));
            const pago = await ejecutarConAuditoria(req, auditoria => pagoCompraService.verificar(idCompra, idPago, capturar, auditoria));
            res.set('Cache-Control', 'no-store');
            return res.json({ data: pago });
        } catch (error) { next(error); }
    }
}
