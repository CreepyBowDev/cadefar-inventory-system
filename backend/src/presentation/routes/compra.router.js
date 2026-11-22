import { Router } from 'express';
import { compraController } from '../controllers/compra.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { pagoCompraController } from '../controllers/pago-compra.controller.js';
import { pagoOrigenMiddleware } from '../middlewares/pago-origen.middleware.js';
import { pagosLocalMiddleware } from '../middlewares/pagos-local.middleware.js';
import { compraComprobanteController } from '../controllers/compra-comprobante.controller.js';

export const compraRouter = Router();
compraRouter.use(authMiddleware);

// Los comprobantes contienen información financiera: conservan el permiso de Pagos.
compraRouter.get('/:idCompra/comprobante', requireRole(ROLES.ADMINISTRADOR), compraComprobanteController.compra);
compraRouter.get('/:idCompra/comprobante.pdf', requireRole(ROLES.ADMINISTRADOR), compraComprobanteController.compraPdf);
compraRouter.get('/:idCompra/pagos/:idPago/comprobante', requireRole(ROLES.ADMINISTRADOR), compraComprobanteController.pago);
compraRouter.get('/:idCompra/pagos/:idPago/comprobante.pdf', requireRole(ROLES.ADMINISTRADOR), compraComprobanteController.pagoPdf);

compraRouter.get('/:idCompra/pagos', requireRole(ROLES.ADMINISTRADOR), pagoCompraController.consultar);
compraRouter.post('/:idCompra/pagos/:idPago/autorizar-prueba', requireRole(ROLES.ADMINISTRADOR), pagosLocalMiddleware, pagoOrigenMiddleware, pagoCompraController.autorizarPrueba);
compraRouter.post('/:idCompra/pagos', requireRole(ROLES.ADMINISTRADOR), pagoOrigenMiddleware, pagoCompraController.iniciar);
compraRouter.post('/:idCompra/pagos/:idPago/verificar', requireRole(ROLES.ADMINISTRADOR), pagoOrigenMiddleware, pagoCompraController.verificar);
compraRouter.post('/:idCompra/pagos/:idPago/confirmar', requireRole(ROLES.ADMINISTRADOR), pagoOrigenMiddleware, pagoCompraController.confirmar);
compraRouter.post('/:idCompra/pagos/:idPago/conciliar', requireRole(ROLES.ADMINISTRADOR), pagoOrigenMiddleware, pagoCompraController.conciliar);

compraRouter.get('/', requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE), compraController.getCompras);
compraRouter.get('/:idCompra', requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE), compraController.getCompraById);
compraRouter.post('/', requireRole(ROLES.ADMINISTRADOR), compraController.createCompra);
compraRouter.post('/:idCompra/anular', requireRole(ROLES.ADMINISTRADOR), compraController.anularCompra);
