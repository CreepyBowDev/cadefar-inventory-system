import { AppError } from '../../shared/errors/app-error.js';

// CORS no impide CSRF. Las escrituras financieras exigen JSON y el origen
// configurado; un retorno de la pasarela nunca confirma por sí solo un pago.
export const pagoOrigenMiddleware = (req, res, next) => {
    let origen;
    try { origen = new URL(process.env.FRONTEND_URL).origin; } catch { return next(new AppError('El servicio de pagos no está disponible.', 503)); }
    if (req.get('origin') !== origen || !req.is('application/json')) {
        return next(new AppError('Solicitud de pago no autorizada desde este origen.', 403));
    }
    next();
};
