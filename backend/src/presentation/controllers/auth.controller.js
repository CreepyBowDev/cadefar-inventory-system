import { authService } from "../../business/services/auth.service.js";
import { authValidator } from "../../business/validators/auth.validator.js";

export class authController {
    static async login(req, res, next) {
        try {
            const validationResult = authValidator.validateLogin(req.body);

            if (!validationResult.success) {
                throw new AppError(
                    'Datos de inicio de sesión inválidos',
                    400
                );
            }

            const resultado = await authService.login(validationResult.data);

            res.cookie('token', resultado.token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 1 * 60 * 60 * 1000
            });

            return res.status(200).json({
                // token: resultado.token, // Solo para el testeo
                message: 'Inicio de sesión exitoso',
                data: resultado
            });
        } catch (error) {
            next(error);
        }
    }

    static async logout(req, res, next) {
        try {
            await authService.logout(req, res, next);
        } catch (error) {
            next(error);
        }
    }
}