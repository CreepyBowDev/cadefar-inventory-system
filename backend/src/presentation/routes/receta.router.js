import { Router } from 'express';
import { recetaController } from '../controllers/receta.controller.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';

// ventaRouter autentica antes de montar este router.
export const recetaRouter = Router({ mergeParams: true });
recetaRouter.post('/', requireRole(ROLES.REGENTE, ROLES.VENDEDOR), recetaController.createReceta);
recetaRouter.get('/', requireRole(ROLES.REGENTE), recetaController.getRecetas);
recetaRouter.get('/:idReceta', requireRole(ROLES.REGENTE), recetaController.getRecetaById);
recetaRouter.post('/:idReceta/revisar', requireRole(ROLES.REGENTE), recetaController.revisarReceta);
