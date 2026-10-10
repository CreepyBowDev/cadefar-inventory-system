import { createHmac, timingSafeEqual, randomInt, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { RECOVERY_SECURITY } from '../constants/recuperacion-password.js';
import { exigirRecuperacionHabilitada } from './recuperacion-config.js';

const contextSchema = z.object({
    idUsuario: z.number().int().positive(),
    correo: z.string().max(255).email().refine(value => value === value.trim().toLowerCase()),
    nonce: z.uuid(), expiraEn: z.date()
}).strict();
const cryptoError = () => new AppError('No se pudo procesar la recuperación de contraseña', 500);
const validateContext = value => {
    const result = contextSchema.safeParse(value);
    if (!result.success) throw cryptoError();
    return result.data;
};
const codeHmac = (codigo, context, key) => createHmac('sha256', key)
    .update(JSON.stringify(['cadefar:recuperacion-password:codigo:v1', context.idUsuario,
        context.correo, context.nonce, context.expiraEn.getTime(), codigo]), 'utf8').digest();

export const generarCodigoRecuperacion = () => {
    exigirRecuperacionHabilitada();
    return randomInt(0, 10 ** RECOVERY_SECURITY.CODE_DIGITS).toString().padStart(RECOVERY_SECURITY.CODE_DIGITS, '0');
};
export const generarNonceRecuperacion = () => {
    exigirRecuperacionHabilitada();
    return randomUUID();
};
export const calcularCodigoHmac = ({ codigo, ...metadata } = {}) => {
    const config = exigirRecuperacionHabilitada(), context = validateContext(metadata);
    if (typeof codigo !== 'string' || !/^\d{6}$/.test(codigo)) throw cryptoError();
    return codeHmac(codigo, context, config.hmacSecret).toString('hex');
};
export const verificarCodigoHmac = ({ codigo, codigoHmac, ...metadata } = {}) => {
    const config = exigirRecuperacionHabilitada(), context = validateContext(metadata);
    if (typeof codigo !== 'string' || !/^\d{6}$/.test(codigo) ||
        typeof codigoHmac !== 'string' || !/^[0-9a-f]{64}$/.test(codigoHmac)) return false;
    return timingSafeEqual(Buffer.from(codigoHmac, 'hex'), codeHmac(codigo, context, config.hmacSecret));
};

// IPv4 individual; IPv6 agrupada por /56 para evitar eludir cuotas cambiando
// solo la parte local. También unifica IPv4 y su representación IPv6 mapped.
export const normalizarIpRecuperacion = ip => {
    const family = typeof ip === 'string' ? isIP(ip) : 0;
    if (!family) throw new AppError('La recuperación de contraseña no está disponible', 503);
    if (family === 4) return ip;
    let value = ip.toLowerCase().split('%')[0];
    if (value.includes('.')) {
        const lastColon = value.lastIndexOf(':');
        const bytes = value.slice(lastColon + 1).split('.').map(Number);
        value = `${value.slice(0, lastColon)}:${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`;
    }
    const [left, right] = value.split('::');
    const start = left ? left.split(':') : [], end = right ? right.split(':') : [];
    const words = (right !== undefined ? [...start, ...Array(8 - start.length - end.length).fill('0'), ...end] : start).map(word => parseInt(word, 16));
    if (words.slice(0, 5).every(word => word === 0) && words[5] === 0xffff) {
        return `${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`;
    }
    return [...words.slice(0, 3), words[3] & 0xff00, 0, 0, 0, 0].map(word => word.toString(16)).join(':') + '/56';
};
export const calcularClaveIpHmac = ({ ambito, ipNormalizada } = {}) => {
    const config = exigirRecuperacionHabilitada();
    if (!['solicitud', 'restablecimiento'].includes(ambito) || typeof ipNormalizada !== 'string' || !ipNormalizada) throw cryptoError();
    return createHmac('sha256', config.hmacSecret)
        .update(JSON.stringify(['cadefar:recuperacion-password:ip:v1', ambito, ipNormalizada]), 'utf8').digest('hex');
};
