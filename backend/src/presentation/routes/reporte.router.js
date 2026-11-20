import { Router } from 'express';
import { reporteController } from '../controllers/reporte.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';

export const reporteRouter = Router();
reporteRouter.get('/ventas', authMiddleware, requireRole(ROLES.ADMINISTRADOR), reporteController.consultarVentas);
reporteRouter.get('/compras', authMiddleware, requireRole(ROLES.ADMINISTRADOR), reporteController.consultarCompras);
reporteRouter.get('/perdidas', authMiddleware, requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE), reporteController.consultarPerdidas);
