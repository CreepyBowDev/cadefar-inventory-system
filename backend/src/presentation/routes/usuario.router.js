import { Router } from 'express';
import { usuarioController } from '../controllers/usuario.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';

export const usuarioRouter = Router();

usuarioRouter.patch(
    '/me/password',
    authMiddleware,
    usuarioController.updateOwnPassword
);

usuarioRouter.use(
    authMiddleware,
    requireRole(ROLES.ADMINISTRADOR)
);

usuarioRouter.get('/', usuarioController.getUsuarios);
usuarioRouter.get('/:idUsuario', usuarioController.getUsuarioById);
usuarioRouter.post('/', usuarioController.createUsuario);
usuarioRouter.patch('/:idUsuario', usuarioController.updateUsuario);
usuarioRouter.patch('/:idUsuario/estado', usuarioController.updateEstado);
usuarioRouter.patch('/:idUsuario/password', usuarioController.updatePassword);
