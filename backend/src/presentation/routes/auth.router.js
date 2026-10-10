import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

export const authRouter = Router();

authRouter.post('/login', authController.login);
authRouter.post('/recuperacion/solicitar', authController.solicitarRecuperacion);
authRouter.post('/recuperacion/restablecer', authController.restablecerPassword);
authRouter.post('/logout', authMiddleware, authController.logout);
authRouter.get('/me', authMiddleware, authController.me);
