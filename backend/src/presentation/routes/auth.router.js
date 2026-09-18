import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

export const authRouter = Router();

authRouter.post('/login', authController.login);
authRouter.post('/logout', authController.logout);


//Middleware para testear la autenticación
/*authRouter.get(
    '/test',
    authMiddleware,
    (req, res) => {
        res.json({
            message: 'Usuario autenticado',
            usuario: req.usuario
        });
    }
);*/