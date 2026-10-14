import bcrypt from 'bcrypt';
import db from '../../data/models/index.js';
import { usuarioRepository } from '../../data/repositories/usuario.repository.js';
import { LOGIN_SECURITY } from '../../shared/constants/security.js';
import { AppError } from '../../shared/errors/app-error.js';
import { generarToken, esVersionCredencialesValida } from '../../shared/utils/jwt.js';
import { bitacoraAuditoriaService } from './bitacora-auditoria.service.js';
import { crearContextoAuditoriaConexion } from '../../shared/utils/auditoria-contexto.js';
import { anotarErrorAuditoria, obtenerErrorAuditoria, marcarErrorAuditoriaGestionado,
    clasificarErrorTecnicoAuditoria } from '../../shared/utils/auditoria-error.js';

const { sequelize } = db;

const LOGIN_RESULT = Object.freeze({
    SUCCESS: 'SUCCESS',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    INACTIVE: 'INACTIVE',
    BLOCKED: 'BLOCKED'
});

const toSessionUsuario = (usuario) => ({
    idUsuario: usuario.id_usuario,
    idRol: usuario.id_rol,
    nombreUsuario: usuario.nombre_usuario
});

const getBlockedMessage = (bloqueadoHasta) => {
    const remainingMilliseconds = bloqueadoHasta.getTime() - Date.now();
    const remainingMinutes = Math.max(
        1,
        Math.ceil(remainingMilliseconds / (60 * 1000))
    );

    return `Cuenta bloqueada temporalmente. Intenta nuevamente en ${remainingMinutes} ${remainingMinutes === 1 ? 'minuto' : 'minutos'
        }`;
};

export class authService {
    static async login({ nombreUsuario, password }, contexto = crearContextoAuditoriaConexion()) {
        let transaccionLogin;
        let etapa = 'VERIFICACION';
        let datosEvento = { contexto, nombreIngresado: nombreUsuario, fechaEvento: new Date() };
        let result;
        try {
            result = await sequelize.transaction(async (transaction) => {
                transaccionLogin = transaction;
                const usuario = await usuarioRepository.findByNombreUsuario({
                    nombreUsuario,
                    transaction,
                    lock: true
                });

                // Capturar identidad y fecha bajo el bloqueo. No releer la cuenta
                // después del commit: otra solicitud podría cambiar el contador.
                datosEvento = { ...datosEvento, fechaEvento: new Date(),
                    cuentaObjetivo: usuario ? toSessionUsuario(usuario) : null,
                    registro: usuario ? { tipo: 'USUARIO', id: usuario.id_usuario } : null };

                if (!usuario) {
                    etapa = 'CONFIRMACION';
                    return { type: LOGIN_RESULT.INVALID_CREDENTIALS, eventos: [{ ...datosEvento,
                        tipoEvento: 'LOGIN_USUARIO_INEXISTENTE', resultado: 'RECHAZADO', causa: 'USUARIO_INEXISTENTE' }] };
                }

                if (!usuario.estado) {
                    etapa = 'CONFIRMACION';
                    return { type: LOGIN_RESULT.INACTIVE, eventos: [{ ...datosEvento,
                        tipoEvento: 'LOGIN_USUARIO_INACTIVO', resultado: 'RECHAZADO', causa: 'USUARIO_INACTIVO' }] };
                }

                const now = new Date();
                const bloqueadoHasta = usuario.bloqueado_hasta ? new Date(usuario.bloqueado_hasta) : null;
                const bloqueoVigente = bloqueadoHasta && bloqueadoHasta > now;

                if (bloqueoVigente) {
                    etapa = 'CONFIRMACION';
                    return {
                        type: LOGIN_RESULT.BLOCKED,
                        bloqueadoHasta,
                        eventos: [{ ...datosEvento, tipoEvento: 'LOGIN_INTENTO_BLOQUEADO',
                            resultado: 'RECHAZADO', causa: 'BLOQUEO_VIGENTE', metadatos: {
                                intentosFallidos: usuario.intentos_fallidos_login,
                                bloqueadoDesde: new Date(bloqueadoHasta.getTime() - LOGIN_SECURITY.LOCK_MINUTES * 60000).toISOString(),
                                bloqueadoHasta: bloqueadoHasta.toISOString(), duracionMinutos: LOGIN_SECURITY.LOCK_MINUTES
                            } }]
                    };
                }

                const passwordCorrecta = await bcrypt.compare(password, usuario.password_hash);

                if (!passwordCorrecta) {
                    const intentosPrevios = bloqueadoHasta ? 0 : usuario.intentos_fallidos_login;
                    const intentosFallidos = intentosPrevios + 1;
                    const debeBloquear = intentosFallidos >= LOGIN_SECURITY.MAX_FAILED_ATTEMPTS;
                    const nuevoBloqueo = debeBloquear
                        ? new Date(now.getTime() + LOGIN_SECURITY.LOCK_MINUTES * 60 * 1000) : null;

                    etapa = 'SEGURIDAD';
                    await usuarioRepository.updateLoginSecurity({
                        idUsuario: usuario.id_usuario, intentosFallidosLogin: intentosFallidos,
                        bloqueadoHasta: nuevoBloqueo, transaction
                    });

                    const metadatos = { intentosFallidos, efecto: 'CONFIRMADO',
                        ...(debeBloquear ? { bloqueadoDesde: now.toISOString(), bloqueadoHasta: nuevoBloqueo.toISOString(),
                            duracionMinutos: LOGIN_SECURITY.LOCK_MINUTES } : {}) };
                    const eventos = [{ ...datosEvento, tipoEvento: 'LOGIN_PASSWORD_INCORRECTA',
                        resultado: 'RECHAZADO', causa: 'PASSWORD_INCORRECTA', metadatos }];
                    if (debeBloquear) eventos.push({ ...datosEvento, tipoEvento: 'LOGIN_BLOQUEO_GENERADO',
                        resultado: 'EXITO', causa: 'BLOQUEO_GENERADO', metadatos });
                    etapa = 'CONFIRMACION';
                    return { type: debeBloquear ? LOGIN_RESULT.BLOCKED : LOGIN_RESULT.INVALID_CREDENTIALS,
                        bloqueadoHasta: nuevoBloqueo, eventos };
                }

                // Firmar solo en memoria; no entregar JWT/cookie antes del commit.
                const usuarioPublico = toSessionUsuario(usuario);
                datosEvento = { ...datosEvento, responsable: usuarioPublico };
                etapa = 'FIRMA_TOKEN';
                const token = generarToken({
                    idUsuario: usuarioPublico.idUsuario, idRol: usuarioPublico.idRol,
                    versionCredenciales: usuario.version_credenciales
                });

                if (usuario.intentos_fallidos_login > 0 || bloqueadoHasta) {
                    etapa = 'SEGURIDAD';
                    await usuarioRepository.updateLoginSecurity({
                        idUsuario: usuario.id_usuario, intentosFallidosLogin: 0,
                        bloqueadoHasta: null, transaction
                    });
                }

                etapa = 'AUDITORIA';
                await bitacoraAuditoriaService.registrar({ ...datosEvento, tipoEvento: 'LOGIN_EXITO',
                    resultado: 'EXITO', metadatos: { efecto: 'CONFIRMADO' } }, { transaction });
                etapa = 'CONFIRMACION';
                return { type: LOGIN_RESULT.SUCCESS, usuario: usuarioPublico, token };
            });
        } catch (error) {
            if (!obtenerErrorAuditoria(error)?.gestionado) {
                await bitacoraAuditoriaService.intentarRegistrar({ ...datosEvento,
                    tipoEvento: 'ERROR_TECNICO', resultado: 'FALLO', causa: clasificarErrorTecnicoAuditoria(error),
                    metadatos: { operacionOrigen: 'AUTENTICACION.LOGIN', etapa,
                        efecto: transaccionLogin?.finished === 'commit' ? 'INCIERTO' : 'NO_APLICA' } });
            }
            throw marcarErrorAuditoriaGestionado(error);
        }

        // Estos resultados se auditan después de confirmar la transacción de
        // seguridad. Un fallo aquí nunca deshace un contador o bloqueo vigente.
        if (result.type !== LOGIN_RESULT.SUCCESS) {
            await bitacoraAuditoriaService.intentarRegistrar(result.eventos);
        }

        if (result.type === LOGIN_RESULT.INVALID_CREDENTIALS) {
            throw marcarErrorAuditoriaGestionado(new AppError('Usuario o contraseña incorrectos', 401));
        }

        if (result.type === LOGIN_RESULT.INACTIVE) {
            throw marcarErrorAuditoriaGestionado(new AppError('Usuario inactivo', 403));
        }

        if (result.type === LOGIN_RESULT.BLOCKED) {
            throw marcarErrorAuditoriaGestionado(new AppError(getBlockedMessage(result.bloqueadoHasta), 423));
        }

        return {
            token: result.token,
            usuario: result.usuario
        };
    }

    static async getSessionUsuario(idUsuario, versionCredenciales) {
        if (!esVersionCredencialesValida(versionCredenciales)) {
            throw anotarErrorAuditoria(new AppError('Sesión no válida', 401), {
                tipoEvento: 'SESION_INVALIDA', causa: 'CREDENCIALES_DESACTUALIZADAS'
            });
        }
        const usuario = await usuarioRepository.findByIdForSession({ idUsuario });

        if (!usuario || !usuario.estado || usuario.version_credenciales !== versionCredenciales) {
            throw anotarErrorAuditoria(new AppError('Sesión no válida', 401), {
                tipoEvento: 'SESION_INVALIDA',
                causa: !usuario ? 'USUARIO_INEXISTENTE' : !usuario.estado ? 'USUARIO_INACTIVO' : 'CREDENCIALES_DESACTUALIZADAS',
                cuentaObjetivo: usuario ? toSessionUsuario(usuario) : null
            });
        }

        return toSessionUsuario(usuario);
    }
}
