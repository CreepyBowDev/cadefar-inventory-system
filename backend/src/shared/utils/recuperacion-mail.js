import { AppError } from '../errors/app-error.js';
import { z } from 'zod';
import { RECOVERY_SECURITY, RECOVERY_MAIL_RESULT as RESULT } from '../constants/recuperacion-password.js';
import { exigirRecuperacionHabilitada } from './recuperacion-config.js';

const messageSchema = z.object({ to: z.string().max(255).email(), subject: z.string().min(1), text: z.string().min(1) }).strict();

const unavailable = () => new AppError('La recuperación de contraseña no está disponible', 503);
const invalidTransport = () => new AppError('No se pudo procesar la recuperación de contraseña', 500);
const resultFor = estado => Object.freeze({ estado });
const acceptedMock = () => resultFor(RESULT.ACCEPTED);

const sendBrevo = async (message, { signal }, config) => {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', signal, redirect: 'error',
        headers: { 'api-key': config.brevoApiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sender: { email: message.from, name: message.fromName },
            to: [{ email: message.to }], subject: message.subject, textContent: message.text })
    });
    if (response.ok) {
        const body = await response.json();
        return resultFor(typeof body?.messageId === 'string' && body.messageId ? RESULT.ACCEPTED : RESULT.AMBIGUOUS);
    }
    // Un 4xx explícito (excepto timeout) confirma rechazo. 5xx, 408 y
    // respuestas inesperadas se conservan ambiguas; nunca se reintenta aquí.
    return resultFor(response.status >= 400 && response.status < 500 && response.status !== 408 ? RESULT.REJECTED : RESULT.AMBIGUOUS);
};

const sendWithDeadline = (payload, resolver, externalSignal) => {
    if (externalSignal?.aborted) return Promise.resolve(resultFor(RESULT.REJECTED));

    return new Promise(resolve => {
        const controller = new AbortController();
        let settled = false, started = false;
        const finish = estado => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            externalSignal?.removeEventListener('abort', onAbort);
            resolve(resultFor(estado));
        };
        const cancel = () => {
            // Una cancelación posterior al inicio no demuestra rechazo. Resolver
            // primero impide que un callback de abort cambie ese resultado.
            finish(started ? RESULT.AMBIGUOUS : RESULT.REJECTED);
            controller.abort(); // No propagar razones externas potencialmente sensibles.
        };
        const onAbort = () => cancel();
        const timer = setTimeout(cancel, RECOVERY_SECURITY.MAIL_TIMEOUT_MS);
        externalSignal?.addEventListener('abort', onAbort, { once: true });

        // El timeout termina nuestra espera aun si el adaptador ignora abort.
        // Sus resultados/rechazos tardíos se observan, pero no alteran el estado.
        Promise.resolve().then(async () => {
            if (settled) return;
            started = true;
            try {
                const raw = await resolver(payload, { signal: controller.signal });
                const estado = Object.values(RESULT).includes(raw?.estado) ? raw.estado : RESULT.AMBIGUOUS;
                finish(estado);
            } catch {
                // Nunca devolver excepciones, cuerpos del proveedor ni el mensaje.
                finish(RESULT.AMBIGUOUS);
            }
        });
    });
};

// Un solo intento, sin persistencia ni reintentos. El mock solo se observa
// mediante la función resolverMock inyectada desde pruebas.
export const crearTransporteRecuperacion = ({ resolverMock } = {}) => {
    const config = exigirRecuperacionHabilitada();
    if (resolverMock !== undefined &&
        (config.mailProvider !== 'mock' || process.env.NODE_ENV !== 'test' || typeof resolverMock !== 'function')) throw unavailable();

    return Object.freeze({
        async enviar(payload, { signal } = {}) {
            const current = exigirRecuperacionHabilitada();
            if (current.mailProvider !== config.mailProvider ||
                (resolverMock !== undefined && process.env.NODE_ENV !== 'test')) throw unavailable();
            if (signal !== undefined && !(signal instanceof AbortSignal)) throw invalidTransport();
            const parsed = messageSchema.safeParse(payload);
            if (!parsed.success) throw invalidTransport();
            const message = Object.freeze({ ...parsed.data, from: config.mailFrom, fromName: config.mailFromName });
            const resolver = config.mailProvider === 'mock' ? (resolverMock ?? acceptedMock) :
                (message, options) => sendBrevo(message, options, config);
            return sendWithDeadline(message, resolver, signal);
        }
    });
};
