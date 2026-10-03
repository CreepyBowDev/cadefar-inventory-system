import { Router } from 'express';
import { principioActivoController } from '../controllers/principio-activo.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';

export const principioActivoRouter = Router();
principioActivoRouter.use(authMiddleware);
principioActivoRouter.get('/', requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE), principioActivoController.getPrincipiosActivos);
principioActivoRouter.get('/:idPrincipioActivo', requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE), principioActivoController.getPrincipioActivoById);
principioActivoRouter.post('/', requireRole(ROLES.REGENTE), principioActivoController.createPrincipioActivo);
principioActivoRouter.patch('/:idPrincipioActivo', requireRole(ROLES.REGENTE), principioActivoController.updatePrincipioActivo);
principioActivoRouter.patch('/:idPrincipioActivo/estado', requireRole(ROLES.REGENTE), principioActivoController.updateEstado);
