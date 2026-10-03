import { Router } from 'express';
import { medicamentoController } from '../controllers/medicamento.controller.js';
import { composicionMedicamentoRouter } from './composicion-medicamento.router.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';

export const medicamentoRouter = Router();
medicamentoRouter.use(authMiddleware);
medicamentoRouter.use('/:idMedicamento/composicion', composicionMedicamentoRouter);

medicamentoRouter.get('/',
    requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE, ROLES.VENDEDOR),
    medicamentoController.getMedicamentos);
medicamentoRouter.get('/:idMedicamento',
    requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE, ROLES.VENDEDOR),
    medicamentoController.getMedicamentoById);
medicamentoRouter.post('/', requireRole(ROLES.REGENTE), medicamentoController.createMedicamento);
medicamentoRouter.patch('/:idMedicamento', requireRole(ROLES.REGENTE), medicamentoController.updateMedicamento);
medicamentoRouter.patch('/:idMedicamento/estado', requireRole(ROLES.REGENTE), medicamentoController.updateEstado);
