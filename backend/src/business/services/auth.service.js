import bcrypt from 'bcrypt';
import db from '../../data/models/index.js';
import { usuarioRepository } from '../../data/repositories/usuario.repository.js';
import { LOGIN_SECURITY } from '../../shared/constants/security.js';
import { AppError } from '../../shared/errors/app-error.js';
import { generarToken } from '../../shared/utils/jwt.js';

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
    static async login({ nombreUsuario, password }) {
        const result = await sequelize.transaction(async (transaction) => {
            const usuario = await usuarioRepository.findByNombreUsuario({
                nombreUsuario,
                transaction,
                lock: true
            });

            if (!usuario) {
                return { type: LOGIN_RESULT.INVALID_CREDENTIALS };
            }

            if (!usuario.estado) {
                return { type: LOGIN_RESULT.INACTIVE };
            }

            const now = new Date();
            const bloqueadoHasta = usuario.bloqueado_hasta
                ? new Date(usuario.bloqueado_hasta)
                : null;
            const bloqueoVigente = bloqueadoHasta && bloqueadoHasta > now;

            if (bloqueoVigente) {
                return {
                    type: LOGIN_RESULT.BLOCKED,
                    bloqueadoHasta
                };
            }

            const passwordCorrecta = await bcrypt.compare(
                password,
                usuario.password_hash
            );

            if (!passwordCorrecta) {
                const intentosPrevios = bloqueadoHasta
                    ? 0
                    : usuario.intentos_fallidos_login;
                const intentosFallidos = intentosPrevios + 1;
                const debeBloquear =
                    intentosFallidos >= LOGIN_SECURITY.MAX_FAILED_ATTEMPTS;
                const nuevoBloqueo = debeBloquear
                    ? new Date(
                        now.getTime() + LOGIN_SECURITY.LOCK_MINUTES * 60 * 1000
                    )
                    : null;

                await usuarioRepository.updateLoginSecurity({
                    idUsuario: usuario.id_usuario,
                    intentosFallidosLogin: intentosFallidos,
                    bloqueadoHasta: nuevoBloqueo,
                    transaction
                });

                return debeBloquear
                    ? {
                        type: LOGIN_RESULT.BLOCKED,
                        bloqueadoHasta: nuevoBloqueo
                    }
                    : { type: LOGIN_RESULT.INVALID_CREDENTIALS };
            }

            if (usuario.intentos_fallidos_login > 0 || bloqueadoHasta) {
                await usuarioRepository.updateLoginSecurity({
                    idUsuario: usuario.id_usuario,
                    intentosFallidosLogin: 0,
                    bloqueadoHasta: null,
                    transaction
                });
            }

            return {
                type: LOGIN_RESULT.SUCCESS,
                usuario: toSessionUsuario(usuario)
            };
        });

        if (result.type === LOGIN_RESULT.INVALID_CREDENTIALS) {
            throw new AppError('Usuario o contraseña incorrectos', 401);
        }

        if (result.type === LOGIN_RESULT.INACTIVE) {
            throw new AppError('Usuario inactivo', 403);
        }

        if (result.type === LOGIN_RESULT.BLOCKED) {
            throw new AppError(getBlockedMessage(result.bloqueadoHasta), 423);
        }

        const token = generarToken({
            idUsuario: result.usuario.idUsuario,
            idRol: result.usuario.idRol
        });

        return {
            token,
            usuario: result.usuario
        };
    }

    static async getSessionUsuario(idUsuario) {
        const usuario = await usuarioRepository.findById({ idUsuario });

        if (!usuario || !usuario.estado) {
            throw new AppError('Sesión no válida', 401);
        }

        return toSessionUsuario(usuario);
    }
}
