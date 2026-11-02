import { Router } from 'express';
import { ventaController } from '../controllers/venta.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { recetaRouter } from './receta.router.js';

export const ventaRouter = Router();
ventaRouter.use(authMiddleware);
ventaRouter.use(requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE, ROLES.VENDEDOR));
ventaRouter.use('/:idVenta/recetas', recetaRouter);
ventaRouter.get('/', ventaController.getVentas);
ventaRouter.get('/:idVenta', ventaController.getVentaById);
ventaRouter.post('/', requireRole(ROLES.VENDEDOR), ventaController.createVenta);
ventaRouter.post('/:idVenta/confirmar', requireRole(ROLES.VENDEDOR), ventaController.confirmarVenta);
ventaRouter.post('/:idVenta/anular', requireRole(ROLES.ADMINISTRADOR), ventaController.anularVenta);
