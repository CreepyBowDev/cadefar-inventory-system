import { Router } from 'express';
import { reporteController } from '../controllers/reporte.controller.js';
import { reporteExportacionController } from '../controllers/reporte-exportacion.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';

export const reporteRouter = Router();
for (const fuente of ['ventas', 'compras', 'perdidas']) {
    const roles = fuente === 'perdidas' ? [ROLES.ADMINISTRADOR, ROLES.REGENTE] : [ROLES.ADMINISTRADOR];
    reporteRouter.head(`/${fuente}/exportar`, authMiddleware, requireRole(...roles),
        (req, res) => res.set('Allow', 'GET').status(405).end());
    reporteRouter.get(`/${fuente}/exportar`, authMiddleware, requireRole(...roles), reporteExportacionController[fuente]);
}
// Antes de GET: Express no debe ejecutar estadísticas automáticamente para HEAD.
for (const fuente of ['ventas', 'compras']) {
    reporteRouter.head(`/${fuente}/estadisticas`, authMiddleware, requireRole(ROLES.ADMINISTRADOR),
        (req, res) => res.set('Allow', 'GET').status(405).end());
}
reporteRouter.get('/ventas/estadisticas', authMiddleware, requireRole(ROLES.ADMINISTRADOR), reporteController.estadisticasVentas);
reporteRouter.get('/compras/estadisticas', authMiddleware, requireRole(ROLES.ADMINISTRADOR), reporteController.estadisticasCompras);
reporteRouter.head('/perdidas/estadisticas', authMiddleware, requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE),
    (req, res) => res.set('Allow', 'GET').status(405).end());
reporteRouter.get('/perdidas/estadisticas', authMiddleware, requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE), reporteController.estadisticasPerdidas);
reporteRouter.get('/ventas', authMiddleware, requireRole(ROLES.ADMINISTRADOR), reporteController.consultarVentas);
reporteRouter.get('/compras', authMiddleware, requireRole(ROLES.ADMINISTRADOR), reporteController.consultarCompras);
reporteRouter.get('/perdidas', authMiddleware, requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE), reporteController.consultarPerdidas);
