import { compraComprobanteService } from '../../business/services/compra-comprobante.service.js';
import { pagoCompraValidator } from '../../business/validators/pago-compra.validator.js';
import { generarComprobantePdf } from '../../shared/utils/compra-comprobante-pdf.js';
import { AppError } from '../../shared/errors/app-error.js';

const responder = async (req, res, next, esPago, pdf) => {
    try {
        const params = esPago ? pagoCompraValidator.validatePago(req.params) : pagoCompraValidator.validateCompra(req.params);
        const query = pagoCompraValidator.validateVacio(req.query);
        if (!params.success || !query.success) throw new AppError('Datos del comprobante inválidos', 400);
        const documento = await compraComprobanteService.consultar(params.data.idCompra, params.data.idPago);
        res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        if (!pdf) return res.json({ data: documento });
        const archivo = await generarComprobantePdf(documento);
        return res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="CADEFAR-${documento.numero}.pdf"` }).send(archivo);
    } catch (error) { next(error); }
};

export class compraComprobanteController {
    static compra(req, res, next) { return responder(req, res, next, false, false); }
    static compraPdf(req, res, next) { return responder(req, res, next, false, true); }
    static pago(req, res, next) { return responder(req, res, next, true, false); }
    static pagoPdf(req, res, next) { return responder(req, res, next, true, true); }
}
