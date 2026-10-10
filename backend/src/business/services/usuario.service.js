import bcrypt from 'bcrypt';
import db from '../../data/models/index.js';
import { usuarioRepository } from '../../data/repositories/usuario.repository.js';
import { recuperacionPasswordRepository } from '../../data/repositories/recuperacion-password.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { generarToken, esVersionCredencialesValida } from '../../shared/utils/jwt.js';
import { siguienteVersionCredenciales } from '../../shared/utils/credenciales.js';

const toPublicUsuario = (usuario) => {
    const data = usuario.get
        ? usuario.get({ plain: true })
        : usuario;

    return {
        idUsuario: data.id_usuario,
        nombreUsuario: data.nombre_usuario,
        correo: data.correo ?? null,
        estado: Boolean(data.estado),
        rol: data.rol
            ? {
                idRol: data.rol.id_rol,
                nombre: data.rol.nombre,
                descripcion: data.rol.descripcion,
                estado: Boolean(data.rol.estado)
            }
            : undefined
    };
};

const validateRolActivo = async (idRol, transaction = undefined) => {
    const rol = await usuarioRepository.findRolById({ idRol, transaction });

    if (!rol) {
        throw new AppError('El rol indicado no existe', 404);
    }

    if (!rol.estado) {
        throw new AppError('El rol indicado está inactivo', 409);
    }
};

const throwIfDuplicateUsuario = async (nombreUsuario, idUsuario = undefined, transaction = undefined) => {
    const usuarioExistente = await usuarioRepository.findByNombreUsuario({ nombreUsuario, transaction });

    if (usuarioExistente && usuarioExistente.id_usuario !== idUsuario) {
        throw new AppError('El nombre de usuario ya está en uso', 409);
    }
};

const throwIfDuplicateCorreo = async (correo, idUsuario = undefined, transaction = undefined) => {
    if (correo === undefined || correo === null) return;

    const usuarioExistente = await usuarioRepository.findByCorreo({ correo, transaction });

    if (usuarioExistente && usuarioExistente.id_usuario !== idUsuario) {
        throw new AppError('El correo ya está en uso', 409);
    }
};

const handleDuplicateDatabaseError = (error) => {
    if (error?.name === 'SequelizeUniqueConstraintError') {
        const campos = [
            ...Object.keys(error.fields ?? {}),
            ...(error.errors ?? []).map(detail => detail.path)
        ];
        if (campos.some(campo => ['correo', 'uq_usuario_correo'].includes(campo))) {
            throw new AppError('El correo ya está en uso', 409);
        }
        if (campos.some(campo => ['nombre_usuario', 'uq_usuario_nombre_usuario'].includes(campo))) {
            throw new AppError('El nombre de usuario ya está en uso', 409);
        }
        throw new AppError('Los datos del usuario entran en conflicto con una cuenta existente', 409);
    }

    throw error;
};

const requireCurrentCredentials = (usuario, versionCredenciales, passwordHash = undefined) => {
    if (!usuario || !usuario.estado || !esVersionCredencialesValida(versionCredenciales) ||
        usuario.version_credenciales !== versionCredenciales ||
        (passwordHash !== undefined && usuario.password_hash !== passwordHash)) {
        throw new AppError('Sesión no válida', 401);
    }
};

export class usuarioService {
    static async createUsuario({ idRol, nombreUsuario, password, correo }) {
        await throwIfDuplicateUsuario(nombreUsuario);
        await throwIfDuplicateCorreo(correo);
        await validateRolActivo(idRol);

        const passwordHash = await bcrypt.hash(password, 10);

        try {
            const usuario = await usuarioRepository.createUsuario({
                idRol,
                nombreUsuario,
                passwordHash,
                correo
            });

            if (!usuario) {
                throw new AppError('Error al crear el usuario', 500);
            }

            return this.getUsuarioById(usuario.id_usuario);
        } catch (error) {
            handleDuplicateDatabaseError(error);
        }
    }

    static async getUsuarios() {
        const usuarios = await usuarioRepository.findAllUsuarios();
        return usuarios.map(toPublicUsuario);
    }

    static async getUsuarioById(idUsuario, transaction = undefined) {
        const usuario = await usuarioRepository.findById({ idUsuario, transaction });

        if (!usuario) {
            throw new AppError('Usuario no encontrado', 404);
        }

        return toPublicUsuario(usuario);
    }

    static async updateUsuario(idUsuario, { idRol, nombreUsuario, correo }) {
        try {
            return await db.sequelize.transaction(async (transaction) => {
                const usuario = await usuarioRepository.findByIdForUpdate({ idUsuario, transaction });
                if (!usuario) throw new AppError('Usuario no encontrado', 404);

                if (nombreUsuario !== undefined) {
                    await throwIfDuplicateUsuario(nombreUsuario, idUsuario, transaction);
                }
                if (idRol !== undefined) {
                    await validateRolActivo(idRol, transaction);
                }
                await throwIfDuplicateCorreo(correo, idUsuario, transaction);

                await usuarioRepository.updateUsuario({
                    idUsuario, idRol, nombreUsuario, correo, transaction
                });

                if (correo !== undefined && correo !== usuario.correo) {
                    await recuperacionPasswordRepository.invalidatePendingByUsuario({
                        idUsuario, invalidadaEn: new Date(), transaction
                    });
                }

                return this.getUsuarioById(idUsuario, transaction);
            });
        } catch (error) {
            handleDuplicateDatabaseError(error);
        }
    }

    static async updateEstado(idUsuario, { estado }) {
        await this.getUsuarioById(idUsuario);
        await usuarioRepository.updateEstado({ idUsuario, estado });

        return this.getUsuarioById(idUsuario);
    }

    static async updatePassword(idUsuario, { password }) {
        await this.getUsuarioById(idUsuario);

        const passwordHash = await bcrypt.hash(password, 10);
        await db.sequelize.transaction(async (transaction) => {
            const usuario = await usuarioRepository.findByIdForUpdate({ idUsuario, transaction });
            if (!usuario) throw new AppError('Usuario no encontrado', 404);
            await usuarioRepository.updatePassword({
                idUsuario, passwordHash, versionCredenciales: siguienteVersionCredenciales(usuario), transaction
            });
            await recuperacionPasswordRepository.invalidatePendingByUsuario({
                idUsuario, invalidadaEn: new Date(), transaction
            });
        });
    }

    static async updateOwnPassword(idUsuario, { passwordActual, passwordNueva }, versionCredenciales) {
        const usuario = await usuarioRepository.findByIdWithPassword({
            idUsuario
        });

        if (!usuario) {
            throw new AppError('Usuario no encontrado', 404);
        }

        requireCurrentCredentials(usuario, versionCredenciales);

        const passwordCorrecta = await bcrypt.compare(
            passwordActual,
            usuario.password_hash
        );

        if (!passwordCorrecta) {
            throw new AppError('La contraseña actual es incorrecta', 401);
        }

        const passwordHash = await bcrypt.hash(passwordNueva, 10);
        return db.sequelize.transaction(async (transaction) => {
            const current = await usuarioRepository.findByIdWithPassword({ idUsuario, transaction, lock: true });
            requireCurrentCredentials(current, versionCredenciales, usuario.password_hash);
            const nextVersion = siguienteVersionCredenciales(current);
            await usuarioRepository.updatePassword({
                idUsuario, passwordHash, versionCredenciales: nextVersion, transaction
            });
            await recuperacionPasswordRepository.invalidatePendingByUsuario({
                idUsuario, invalidadaEn: new Date(), transaction
            });
            // Firmar antes del commit: un fallo revierte contraseña y recuperaciones.
            const token = generarToken({ idUsuario, idRol: current.id_rol, versionCredenciales: nextVersion });
            return { token };
        });
    }
}
