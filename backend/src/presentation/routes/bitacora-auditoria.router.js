import { Router } from 'express';
import { bitacoraAuditoriaController } from '../controllers/bitacora-auditoria.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';

export const bitacoraAuditoriaRouter = Router();
bitacoraAuditoriaRouter.use(authMiddleware, requireRole(ROLES.ADMINISTRADOR));
bitacoraAuditoriaRouter.get('/', bitacoraAuditoriaController.consultar);
bitacoraAuditoriaRouter.get('/:idEvento', bitacoraAuditoriaController.consultarEvento);
