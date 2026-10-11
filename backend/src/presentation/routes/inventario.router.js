import { Router } from 'express';
import { inventarioController } from '../controllers/inventario.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';

export const inventarioRouter = Router();
inventarioRouter.use(authMiddleware);

inventarioRouter.post('/ajustes', requireRole(ROLES.REGENTE), inventarioController.registrarAjuste);
inventarioRouter.post('/retiros/vencimiento', requireRole(ROLES.REGENTE), inventarioController.registrarRetiroVencimiento);
inventarioRouter.post('/retiros/dano', requireRole(ROLES.REGENTE), inventarioController.registrarRetiroDano);

inventarioRouter.get('/',
    requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE, ROLES.VENDEDOR),
    inventarioController.getInventario);
inventarioRouter.get('/medicamentos/:idMedicamento/existencias',
    requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE, ROLES.VENDEDOR),
    inventarioController.getExistencias);
inventarioRouter.get('/movimientos',
    requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE),
    inventarioController.getMovimientos);
inventarioRouter.get('/proximos-a-vencer',
    requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE),
    inventarioController.getProximosAVencer);
inventarioRouter.get('/vencidos',
    requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE),
    inventarioController.getVencidos);
inventarioRouter.get('/stock-bajo',
    requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE, ROLES.VENDEDOR),
    inventarioController.getStockBajo);
