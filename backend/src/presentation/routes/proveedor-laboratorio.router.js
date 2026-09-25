import { Router } from 'express';
import { proveedorLaboratorioController } from '../controllers/proveedor-laboratorio.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';

export const proveedorLaboratorioRouter = Router();

proveedorLaboratorioRouter.use(authMiddleware);

proveedorLaboratorioRouter.get(
    '/',
    requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE),
    proveedorLaboratorioController.getProveedoresLaboratorios
);
proveedorLaboratorioRouter.get(
    '/:idProveedorLaboratorio',
    requireRole(ROLES.ADMINISTRADOR, ROLES.REGENTE),
    proveedorLaboratorioController.getProveedorLaboratorioById
);
proveedorLaboratorioRouter.post(
    '/',
    requireRole(ROLES.ADMINISTRADOR),
    proveedorLaboratorioController.createProveedorLaboratorio
);
proveedorLaboratorioRouter.patch(
    '/:idProveedorLaboratorio',
    requireRole(ROLES.ADMINISTRADOR),
    proveedorLaboratorioController.updateProveedorLaboratorio
);
proveedorLaboratorioRouter.patch(
    '/:idProveedorLaboratorio/estado',
    requireRole(ROLES.ADMINISTRADOR),
    proveedorLaboratorioController.updateEstado
);
