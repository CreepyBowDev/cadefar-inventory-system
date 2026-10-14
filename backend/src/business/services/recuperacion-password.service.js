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
import { bitacoraAuditoriaService } from './bitacora-auditoria.service.js';
import { crearContextoAuditoriaConexion } from '../../shared/utils/auditoria-contexto.js';
import { anotarErrorAuditoria, clasificarErrorTecnicoAuditoria } from '../../shared/utils/auditoria-error.js';
import {
    generarCodigoRecuperacion, generarNonceRecuperacion, calcularCodigoHmac,
    verificarCodigoHmac, calcularClaveIpHmac, normalizarIpRecuperacion
} from '../../shared/utils/recuperacion-crypto.js';

const solicitudResponse = Object.freeze({ message: 'Si el correo corresponde a una cuenta habilitada, recibirás un código de recuperación' });
const verificationError = (causa = 'CODIGO_INVALIDO') => anotarErrorAuditoria(
    new AppError('El código de recuperación no es válido o ha vencido', 400), { causa });
const identidadAuditoria = usuario => ({ idUsuario: usuario.id_usuario,
    nombreUsuario: usuario.nombre_usuario, idRol: usuario.id_rol });
const observarCuenta = (seguimiento, usuario) => {
    if (!usuario) return;
    seguimiento.evento.cuentaObjetivo = identidadAuditoria(usuario);
    seguimiento.evento.registro = { tipo: 'USUARIO', id: usuario.id_usuario };
    seguimiento.evento.fechaEvento = new Date();
};
const causaRecuperacion = (recovery, ahora) => !recovery ? 'CODIGO_INVALIDO' :
    recovery.consumida_en ? 'CODIGO_UTILIZADO' : recovery.expira_en <= ahora ? 'CODIGO_VENCIDO' : 'CODIGO_INVALIDO';
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

const isUsable = async (recovery, ahora, transaction, seguimiento) => {
    if (!recovery || recovery.consumida_en || recovery.invalidada_en) return false;
    if (recovery.expira_en <= ahora || recovery.intentos_fallidos >= SECURITY.MAX_FAILED_ATTEMPTS) {
        await recoveryRepository.updateById({
            idRecuperacion: recovery.id_recuperacion,
            values: { invalidada_en: ahora }, transaction
        });
        seguimiento.proteccionActualizada = true;
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
        if (cantidad > maximo) throw anotarErrorAuditoria(
            new AppError('Demasiadas solicitudes. Intenta nuevamente más tarde', 429), { causa: 'LIMITE_IP' });
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

    static async solicitarRecuperacion(data, ip, mailOptions = {}, contexto = crearContextoAuditoriaConexion(ip)) {
        return bitacoraAuditoriaService.ejecutarSeguridad({ contexto, tipoEvento: 'RECUPERACION_SOLICITAR' }, async seguimiento => {
            exigirRecuperacionHabilitada();
            const parsed = recuperacionPasswordValidator.validateSolicitud(data);
            if (!parsed.success) throw anotarErrorAuditoria(new AppError('Datos de recuperación inválidos', 400),
                { tipoEvento: 'VALIDACION_RECHAZADA', causa: 'ENTRADA_INVALIDA' });
            await this.verificarLimiteIp('solicitud', ip);
            const inicio = performance.now();
            const transport = crearTransporteRecuperacion(mailOptions);
            const { correo } = parsed.data;
            try {
                const found = await usuarioRepository.findByCorreo({ correo });
                if (!found) {
                    await bitacoraAuditoriaService.intentarRegistrar({ ...seguimiento.evento,
                        resultado: 'RECHAZADO', causa: 'USUARIO_INEXISTENTE' });
                    return solicitudResponse;
                }
                let causaSupresion = 'USUARIO_INACTIVO';
                const recovery = await db.sequelize.transaction({ logging: false }, async transaction => {
                    seguimiento.transaction = transaction;
                    const usuario = await usuarioRepository.findByIdForRecovery({ idUsuario: found.id_usuario, transaction });
                    observarCuenta(seguimiento, usuario);
                    if (!usuario?.estado || usuario.correo !== correo) {
                        causaSupresion = !usuario ? 'USUARIO_INEXISTENTE' : usuario.correo !== correo ? 'CORREO_NO_DISPONIBLE' : 'USUARIO_INACTIVO';
                        return;
                    }
                    const ahora = await recoveryRepository.getCurrentDate({ transaction });
                    const history = await recoveryRepository.findHistoryByUsuario({
                        idUsuario: usuario.id_usuario, desde: new Date(ahora.getTime() - SECURITY.ACCOUNT_WINDOW_MS), transaction
                    });
                    if (history.length >= SECURITY.ACCOUNT_MAX_REQUESTS ||
                        (history[0] && ahora - history[0].fecha_solicitud < SECURITY.ACCOUNT_INTERVAL_MS)) {
                        causaSupresion = 'LIMITE_CUENTA';
                        return;
                    }

                    const codigo = generateNonRepeatedCode(usuario, history, ahora);
                    const nonce = generarNonceRecuperacion();
                    const expiraEn = new Date(ahora.getTime() + SECURITY.CODE_TTL_MS);
                    const context = { idUsuario: usuario.id_usuario, correo, nonce, expiraEn };
                    const codigoHmac = calcularCodigoHmac({ ...context, codigo });
                    const payload = {
                        to: correo, subject: 'Código de recuperación CADEFAR',
                        text: `Tu código de recuperación es ${codigo}. Vence en 10 minutos, el ${expiraEn.toISOString()}. Si no solicitaste el cambio, ignora este mensaje.`
                    };
                    seguimiento.etapa = 'SEGURIDAD';
                    await recoveryRepository.invalidatePendingByUsuario({ idUsuario: usuario.id_usuario, invalidadaEn: ahora, transaction });
                    const row = await recoveryRepository.create({ values: {
                        id_usuario: usuario.id_usuario, codigo_hmac: codigoHmac, nonce,
                        fecha_solicitud: ahora, expira_en: expiraEn
                    }, transaction });
                    seguimiento.evento.fechaEvento = ahora;
                    seguimiento.etapa = 'CONFIRMACION';
                    return { idUsuario: usuario.id_usuario, idRecuperacion: row.id_recuperacion, nonce, payload };
                });
                seguimiento.efecto = recovery ? 'CONFIRMADO' : 'NO_APLICA';
                seguimiento.transaction = undefined;
                await bitacoraAuditoriaService.intentarRegistrar({ ...seguimiento.evento,
                    resultado: recovery ? 'EXITO' : 'RECHAZADO', causa: recovery ? undefined : causaSupresion,
                    metadatos: { efecto: seguimiento.efecto } });
                if (recovery) {
                    // Emisión ya confirmada: el auditor no deshace cuotas ni impide
                    // el único intento de envío. No conservar nonce, HMAC o payload.
                    await bitacoraAuditoriaService.intentarRegistrar({ ...seguimiento.evento,
                        tipoEvento: 'RECUPERACION_EMITIR', resultado: 'EXITO', metadatos: { efecto: 'CONFIRMADO' } });
                    let estado = MAIL_RESULT.AMBIGUOUS;
                    try { ({ estado } = await transport.enviar(recovery.payload)); }
                    catch { /* Resultado incierto o configuración cambiada: sin reintento. */ }
                    console.info({ name: 'RecoveryMail', estado });
                    if (estado === MAIL_RESULT.REJECTED) {
                        try { await this.invalidarEnvioRechazado(recovery); }
                        catch (error) {
                            console.error({ name: 'RecoveryMail', message: 'No se pudo invalidar una recuperación tras un rechazo de envío' });
                            await bitacoraAuditoriaService.intentarRegistrar({ ...seguimiento.evento,
                                tipoEvento: 'ERROR_TECNICO', resultado: 'FALLO', causa: clasificarErrorTecnicoAuditoria(error),
                                metadatos: { operacionOrigen: 'AUTENTICACION.ENVIAR_RECUPERACION',
                                    etapa: 'SEGURIDAD', efecto: 'CONFIRMADO' } });
                        }
                    }
                    await bitacoraAuditoriaService.intentarRegistrar({ ...seguimiento.evento, fechaEvento: new Date(),
                        tipoEvento: 'RECUPERACION_ENVIO', resultado: estado === MAIL_RESULT.ACCEPTED ? 'EXITO' : 'FALLO',
                        causa: estado === MAIL_RESULT.ACCEPTED ? undefined : estado === MAIL_RESULT.REJECTED ? 'ENVIO_RECHAZADO' : 'ENVIO_INCIERTO',
                        metadatos: { efecto: 'CONFIRMADO', estadoEnvio: estado === MAIL_RESULT.AMBIGUOUS ? 'INCIERTO' : estado } });
                }
                return solicitudResponse;
            } finally { await this.esperarRespuesta(inicio); }
        });
    }

    static async restablecerPassword(data, ip, contexto = crearContextoAuditoriaConexion(ip)) {
        return bitacoraAuditoriaService.ejecutarSeguridad({ contexto, tipoEvento: 'PASSWORD_RESTABLECER_RECUPERACION' }, async seguimiento => {
            exigirRecuperacionHabilitada();
            const parsed = recuperacionPasswordValidator.validateRestablecimiento(data);
            if (!parsed.success) throw anotarErrorAuditoria(new AppError('Datos de recuperación inválidos', 400),
                { tipoEvento: 'VALIDACION_RECHAZADA', causa: 'ENTRADA_INVALIDA' });
            await this.verificarLimiteIp('restablecimiento', ip);
            const { correo, codigo, passwordNueva } = parsed.data;
            const found = await usuarioRepository.findByCorreo({ correo });
            if (!found) throw verificationError('USUARIO_INEXISTENTE');

            let causaRechazo = 'CODIGO_INVALIDO';
            const verified = await db.sequelize.transaction({ logging: false }, async transaction => {
                seguimiento.transaction = transaction;
                const usuario = await usuarioRepository.findByIdForRecovery({ idUsuario: found.id_usuario, transaction });
                observarCuenta(seguimiento, usuario);
                if (!usuario?.estado || usuario.correo !== correo) {
                    causaRechazo = !usuario ? 'USUARIO_INEXISTENTE' : !usuario.estado ? 'USUARIO_INACTIVO' : 'CORREO_NO_DISPONIBLE';
                    return null;
                }
                const recovery = await recoveryRepository.findLatestByUsuario({ idUsuario: usuario.id_usuario, transaction });
                const ahora = await recoveryRepository.getCurrentDate({ transaction });
                seguimiento.evento.fechaEvento = ahora;
                causaRechazo = causaRecuperacion(recovery, ahora);
                if (recovery) seguimiento.evento.metadatos = { intentosCodigoFallidos: recovery.intentos_fallidos };
                if (!await isUsable(recovery, ahora, transaction, seguimiento)) return null;
                if (!matchesCode(usuario, recovery, codigo)) {
                    const intentos = recovery.intentos_fallidos + 1;
                    await recoveryRepository.updateById({ idRecuperacion: recovery.id_recuperacion, values: {
                        intentos_fallidos: intentos,
                        ...(intentos >= SECURITY.MAX_FAILED_ATTEMPTS ? { invalidada_en: ahora } : {})
                    }, transaction });
                    seguimiento.evento.metadatos = { intentosCodigoFallidos: intentos };
                    seguimiento.proteccionActualizada = true;
                    return null; // Commit del fallo ANTES de producir el error público.
                }
                return { idRecuperacion: recovery.id_recuperacion, versionCredenciales: usuario.version_credenciales };
            });
            seguimiento.efecto = seguimiento.proteccionActualizada ? 'CONFIRMADO' : 'NO_APLICA';
            seguimiento.transaction = undefined;
            if (!verified) throw verificationError(causaRechazo);

            const passwordHash = await bcrypt.hash(passwordNueva, 10);
            const consumed = await db.sequelize.transaction({ logging: false }, async transaction => {
                seguimiento.transaction = transaction;
                seguimiento.efecto = 'NO_APLICA';
                seguimiento.proteccionActualizada = false;
                exigirRecuperacionHabilitada();
                const usuario = await findCurrentUsuario(found.id_usuario, correo, transaction);
                if (!usuario) return false;
                observarCuenta(seguimiento, usuario);
                const recovery = await recoveryRepository.findLatestByUsuario({ idUsuario: usuario.id_usuario, transaction });
                const ahora = await recoveryRepository.getCurrentDate({ transaction });
                seguimiento.evento.fechaEvento = ahora;
                if (!await isUsable(recovery, ahora, transaction, seguimiento) ||
                    recovery.id_recuperacion !== verified.idRecuperacion ||
                    usuario.version_credenciales !== verified.versionCredenciales || !matchesCode(usuario, recovery, codigo)) return false;

                seguimiento.etapa = 'SEGURIDAD';
                await usuarioRepository.updatePassword({
                    idUsuario: usuario.id_usuario, passwordHash,
                    versionCredenciales: siguienteVersionCredenciales(usuario), transaction
                });
                await recoveryRepository.updateById({ idRecuperacion: recovery.id_recuperacion,
                    values: { consumida_en: ahora }, transaction });
                await recoveryRepository.invalidatePendingByUsuario({ idUsuario: usuario.id_usuario, invalidadaEn: ahora, transaction });
                seguimiento.etapa = 'AUDITORIA';
                await bitacoraAuditoriaService.registrar({ ...seguimiento.evento, resultado: 'EXITO',
                    metadatos: { efecto: 'CONFIRMADO' } }, { transaction });
                seguimiento.etapa = 'CONFIRMACION';
                return true;
            });
            seguimiento.transaction = undefined;
            seguimiento.efecto = consumed || seguimiento.proteccionActualizada ? 'CONFIRMADO' : 'NO_APLICA';
            if (!consumed) throw verificationError('PRECONDICIONES_DESACTUALIZADAS');
            return { message: 'Contraseña restablecida exitosamente' };
        });
    }
}
