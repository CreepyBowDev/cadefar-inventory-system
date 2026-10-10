import { Router } from 'express';
import { compraController } from '../controllers/compra.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';

export const compraRouter = Router();
compraRouter.use(authMiddleware);

compraRouter.get('/', requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE), compraController.getCompras);
compraRouter.get('/:idCompra', requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE), compraController.getCompraById);
compraRouter.post('/', requireRole(ROLES.ADMINISTRADOR), compraController.createCompra);
compraRouter.post('/:idCompra/anular', requireRole(ROLES.ADMINISTRADOR), compraController.anularCompra);
