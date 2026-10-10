import { Buffer } from 'node:buffer';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';

const correoSchema = z.string().trim().toLowerCase().max(255).email();
const disabled = Object.freeze({ habilitada: false });

// Lectura explícita, sin caché ni generación de secretos. Los valores sensibles
// del resultado son exclusivamente internos: no enviar ni registrar este objeto.
export const obtenerConfiguracionRecuperacion = (env = process.env) => {
    if (env.RECOVERY_ENABLED !== 'true') return disabled;

    const nodeEnv = env.NODE_ENV ?? 'development';
    const mailProvider = env.MAIL_PROVIDER;
    if (!['development', 'test', 'production'].includes(nodeEnv) ||
        !['mock', 'brevo'].includes(mailProvider) ||
        (nodeEnv === 'production' && mailProvider === 'mock') ||
        env.RECOVERY_CLIENT_IP_SOURCE !== 'socket') return disabled;

    const sender = correoSchema.safeParse(env.MAIL_FROM);
    const mailFromName = env.MAIL_FROM_NAME;
    if (!sender.success || typeof mailFromName !== 'string' || !mailFromName.trim() ||
        /[\u0000-\u001f\u007f]/.test(mailFromName)) return disabled;

    const hmacSecret = env.RECOVERY_HMAC_SECRET;
    if (typeof hmacSecret !== 'string' || !hmacSecret.trim() ||
        Buffer.byteLength(hmacSecret, 'utf8') < 32 || hmacSecret === env.JWT_SECRET) return disabled;

    if (mailProvider === 'brevo' &&
        (typeof env.BREVO_API_KEY !== 'string' || !env.BREVO_API_KEY.trim() || /\s/.test(env.BREVO_API_KEY))) return disabled;

    return Object.freeze({
        habilitada: true,
        mailProvider,
        mailFrom: sender.data,
        mailFromName: mailFromName.trim(),
        clientIpSource: 'socket',
        hmacSecret,
        ...(mailProvider === 'brevo' ? { brevoApiKey: env.BREVO_API_KEY } : {})
    });
};

export const exigirRecuperacionHabilitada = () => {
    const config = obtenerConfiguracionRecuperacion();
    if (!config.habilitada) {
        throw new AppError('La recuperación de contraseña no está disponible', 503);
    }
    return config;
};
