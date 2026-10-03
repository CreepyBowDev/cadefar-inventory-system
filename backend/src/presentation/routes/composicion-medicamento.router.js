import { Router } from 'express';
import { composicionMedicamentoController } from '../controllers/composicion-medicamento.controller.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';

// Montado bajo medicamentoRouter, que aplica authMiddleware antes de entrar.
export const composicionMedicamentoRouter = Router({ mergeParams: true });
composicionMedicamentoRouter.get('/',
    requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE, ROLES.VENDEDOR),
    composicionMedicamentoController.getComposicionMedicamento);
composicionMedicamentoRouter.post('/', requireRole(ROLES.REGENTE), composicionMedicamentoController.createComposicion);
composicionMedicamentoRouter.patch('/:idComposicion', requireRole(ROLES.REGENTE), composicionMedicamentoController.updateComposicion);
composicionMedicamentoRouter.delete('/:idComposicion', requireRole(ROLES.REGENTE), composicionMedicamentoController.removeComposicion);
