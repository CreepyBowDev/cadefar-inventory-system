import bcrypt from 'bcrypt';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import db from '../../data/models/index.js';
import { usuarioRepository } from '../../data/repositories/usuario.repository.js';
import { recuperacionPasswordRepository as recoveryRepository } from '../../data/repositories/recuperacion-password.repository.js';
import { recuperacionPasswordValidator } from '../validators/recuperacion-password.validator.js';
import { AppError } from '../../shared/errors/app-error.js';
import { RECOVERY_SECURITY as SECURITY, RECOVERY_MAIL_RESULT as MAIL_RESULT } from '../../shared/constants/recuperacion-password.js';
import { crearTransporteRecuperacion } from '../../shared/utils/recuperacion-mail.js';
import { exigirRecuperacionHabilitada } from '../../shared/utils/recuperacion-config.js';
import { siguienteVersionCredenciales } from '../../shared/utils/credenciales.js';
import {
    generarCodigoRecuperacion, generarNonceRecuperacion, calcularCodigoHmac,
    verificarCodigoHmac, calcularClaveIpHmac, normalizarIpRecuperacion
} from '../../shared/utils/recuperacion-crypto.js';

const solicitudResponse = Object.freeze({ message: 'Si el correo corresponde a una cuenta habilitada, recibirás un código de recuperación' });
const verificationError = () => new AppError('El código de recuperación no es válido o ha vencido', 400);
const contextFor = (usuario, recovery) => ({
    idUsuario: usuario.id_usuario, correo: usuario.correo, nonce: recovery.nonce, expiraEn: recovery.expira_en
});
const matchesCode = (usuario, recovery, codigo) => verificarCodigoHmac({
    ...contextFor(usuario, recovery), codigo, codigoHmac: recovery.codigo_hmac
});

const findCurrentUsuario = async (idUsuario, correo, transaction) => {
    const usuario = await usuarioRepository.findByIdForRecovery({ idUsuario, transaction });
    return usuario?.estado && usuario.correo === correo ? usuario : null;
};

const isUsable = async (recovery, ahora, transaction) => {
    if (!recovery || recovery.consumida_en || recovery.invalidada_en) return false;
    if (recovery.expira_en <= ahora || recovery.intentos_fallidos >= SECURITY.MAX_FAILED_ATTEMPTS) {
        await recoveryRepository.updateById({
            idRecuperacion: recovery.id_recuperacion,
            values: { invalidada_en: ahora }, transaction
        });
        return false;
    }
    return true;
};

const generateNonRepeatedCode = (usuario, history, ahora) => {
    // El HMAC de las emisiones aún dentro de su vigencia original permite
    // descartar repeticiones para el mismo correo, aun después de invalidarlas.
    const recent = history.filter(row => row.expira_en > ahora);
    for (let attempt = 0; attempt < 32; attempt++) {
        const codigo = generarCodigoRecuperacion();
        if (!recent.some(row => matchesCode(usuario, row, codigo))) return codigo;
    }
    throw new AppError('No se pudo procesar la recuperación de contraseña', 500);
};

export class recuperacionPasswordService {
    static async verificarLimiteIp(ambito, ip) {
        const claveIpHmac = calcularClaveIpHmac({ ambito, ipNormalizada: normalizarIpRecuperacion(ip) });
        const cantidad = await db.sequelize.transaction({ logging: false }, async transaction => {
            const ahora = await recoveryRepository.getCurrentDate({ transaction });
            const row = await recoveryRepository.incrementIpQuota({ ambito, claveIpHmac, ahora,
                ventanaHasta: new Date(ahora.getTime() + SECURITY.IP_WINDOW_MS), transaction });
            return row.cantidad;
        });
        const maximo = ambito === 'solicitud' ? SECURITY.IP_MAX_REQUESTS : SECURITY.IP_MAX_RESETS;
        if (cantidad > maximo) throw new AppError('Demasiadas solicitudes. Intenta nuevamente más tarde', 429);
    }

    static async esperarRespuesta(inicio) {
        // Reduce la diferencia evidente entre no enviar y agotar el timeout.
        // No garantiza tiempo constante: MySQL y HTTPS pueden añadir latencia.
        await delay(Math.max(0, SECURITY.PUBLIC_RESPONSE_MIN_MS - (performance.now() - inicio)));
    }

    static async invalidarEnvioRechazado({ idUsuario, idRecuperacion, nonce }) {
        await db.sequelize.transaction({ logging: false }, async transaction => {
            await usuarioRepository.findByIdForRecovery({ idUsuario, transaction });
            const row = await recoveryRepository.findByIdForUpdate({ idUsuario, idRecuperacion, transaction });
            if (row && row.nonce === nonce && !row.consumida_en && !row.invalidada_en) {
                await recoveryRepository.updateById({ idRecuperacion,
                    values: { invalidada_en: await recoveryRepository.getCurrentDate({ transaction }) }, transaction });
            }
        });
    }

    static async solicitarRecuperacion(data, ip, mailOptions = {}) {
        exigirRecuperacionHabilitada();
        const parsed = recuperacionPasswordValidator.validateSolicitud(data);
        if (!parsed.success) throw new AppError('Datos de recuperación inválidos', 400);
        await this.verificarLimiteIp('solicitud', ip);
        const inicio = performance.now();
        const transport = crearTransporteRecuperacion(mailOptions);
        const { correo } = parsed.data;
        try {
            const found = await usuarioRepository.findByCorreo({ correo });
            if (!found) return solicitudResponse;

            const recovery = await db.sequelize.transaction({ logging: false }, async transaction => {
                const usuario = await findCurrentUsuario(found.id_usuario, correo, transaction);
                if (!usuario) return;
                const ahora = await recoveryRepository.getCurrentDate({ transaction });
                const history = await recoveryRepository.findHistoryByUsuario({
                    idUsuario: usuario.id_usuario, desde: new Date(ahora.getTime() - SECURITY.ACCOUNT_WINDOW_MS), transaction
                });
                if (history.length >= SECURITY.ACCOUNT_MAX_REQUESTS ||
                    (history[0] && ahora - history[0].fecha_solicitud < SECURITY.ACCOUNT_INTERVAL_MS)) return;

                const codigo = generateNonRepeatedCode(usuario, history, ahora);
                const nonce = generarNonceRecuperacion();
                const expiraEn = new Date(ahora.getTime() + SECURITY.CODE_TTL_MS);
                const context = { idUsuario: usuario.id_usuario, correo, nonce, expiraEn };
                const codigoHmac = calcularCodigoHmac({ ...context, codigo });
                const payload = {
                    to: correo, subject: 'Código de recuperación CADEFAR',
                    text: `Tu código de recuperación es ${codigo}. Vence en 10 minutos, el ${expiraEn.toISOString()}. Si no solicitaste el cambio, ignora este mensaje.`
                };
                await recoveryRepository.invalidatePendingByUsuario({ idUsuario: usuario.id_usuario, invalidadaEn: ahora, transaction });
                const row = await recoveryRepository.create({ values: {
                    id_usuario: usuario.id_usuario, codigo_hmac: codigoHmac, nonce,
                    fecha_solicitud: ahora, expira_en: expiraEn
                }, transaction });
                return { idUsuario: usuario.id_usuario, idRecuperacion: row.id_recuperacion, nonce, payload };
            });
            if (recovery) {
                let estado = MAIL_RESULT.AMBIGUOUS;
                try { ({ estado } = await transport.enviar(recovery.payload)); }
                catch { /* Resultado incierto o configuración cambiada: sin reintento. */ }
                console.info({ name: 'RecoveryMail', estado });
                if (estado === MAIL_RESULT.REJECTED) {
                    try { await this.invalidarEnvioRechazado(recovery); }
                    catch { console.error({ name: 'RecoveryMail', message: 'No se pudo invalidar una recuperación tras un rechazo de envío' }); }
                }
            }
            return solicitudResponse;
        } finally { await this.esperarRespuesta(inicio); }
    }

    static async restablecerPassword(data, ip) {
        exigirRecuperacionHabilitada();
        const parsed = recuperacionPasswordValidator.validateRestablecimiento(data);
        if (!parsed.success) throw new AppError('Datos de recuperación inválidos', 400);
        await this.verificarLimiteIp('restablecimiento', ip);
        const { correo, codigo, passwordNueva } = parsed.data;
        const found = await usuarioRepository.findByCorreo({ correo });
        if (!found) throw verificationError();

        const verified = await db.sequelize.transaction({ logging: false }, async transaction => {
            const usuario = await findCurrentUsuario(found.id_usuario, correo, transaction);
            if (!usuario) return null;
            const recovery = await recoveryRepository.findLatestByUsuario({ idUsuario: usuario.id_usuario, transaction });
            const ahora = await recoveryRepository.getCurrentDate({ transaction });
            if (!await isUsable(recovery, ahora, transaction)) return null;
            if (!matchesCode(usuario, recovery, codigo)) {
                const intentos = recovery.intentos_fallidos + 1;
                await recoveryRepository.updateById({ idRecuperacion: recovery.id_recuperacion, values: {
                    intentos_fallidos: intentos,
                    ...(intentos >= SECURITY.MAX_FAILED_ATTEMPTS ? { invalidada_en: ahora } : {})
                }, transaction });
                return null; // Commit del fallo ANTES de producir el error público.
            }
            return { idRecuperacion: recovery.id_recuperacion, versionCredenciales: usuario.version_credenciales };
        });
        if (!verified) throw verificationError();

        const passwordHash = await bcrypt.hash(passwordNueva, 10);
        const consumed = await db.sequelize.transaction({ logging: false }, async transaction => {
            exigirRecuperacionHabilitada();
            const usuario = await findCurrentUsuario(found.id_usuario, correo, transaction);
            if (!usuario) return false;
            const recovery = await recoveryRepository.findLatestByUsuario({ idUsuario: usuario.id_usuario, transaction });
            const ahora = await recoveryRepository.getCurrentDate({ transaction });
            if (!await isUsable(recovery, ahora, transaction) ||
                recovery.id_recuperacion !== verified.idRecuperacion ||
                usuario.version_credenciales !== verified.versionCredenciales || !matchesCode(usuario, recovery, codigo)) return false;

            await usuarioRepository.updatePassword({
                idUsuario: usuario.id_usuario, passwordHash,
                versionCredenciales: siguienteVersionCredenciales(usuario), transaction
            });
            await recoveryRepository.updateById({ idRecuperacion: recovery.id_recuperacion,
                values: { consumida_en: ahora }, transaction });
            await recoveryRepository.invalidatePendingByUsuario({ idUsuario: usuario.id_usuario, invalidadaEn: ahora, transaction });
            return true;
        });
        if (!consumed) throw verificationError();
        return { message: 'Contraseña restablecida exitosamente' };
    }
}
