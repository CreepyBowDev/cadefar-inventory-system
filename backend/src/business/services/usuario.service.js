import bcrypt from 'bcrypt';
import { usuarioRepository } from '../../data/repositories/usuario.repository.js';
import { AppError } from '../../shared/errors/app-error.js';

const toPublicUsuario = (usuario) => {
    const data = usuario.get
        ? usuario.get({ plain: true })
        : usuario;

    return {
        idUsuario: data.id_usuario,
        nombreUsuario: data.nombre_usuario,
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

const validateRolActivo = async (idRol) => {
    const rol = await usuarioRepository.findRolById({ idRol });

    if (!rol) {
        throw new AppError('El rol indicado no existe', 404);
    }

    if (!rol.estado) {
        throw new AppError('El rol indicado está inactivo', 409);
    }
};

const throwIfDuplicateUsuario = async (nombreUsuario, idUsuario = undefined) => {
    const usuarioExistente = await usuarioRepository.findByNombreUsuario({ nombreUsuario });

    if (usuarioExistente && usuarioExistente.id_usuario !== idUsuario) {
        throw new AppError('El nombre de usuario ya está en uso', 409);
    }
};

const handleDuplicateDatabaseError = (error) => {
    if (error?.name === 'SequelizeUniqueConstraintError') {
        throw new AppError('El nombre de usuario ya está en uso', 409);
    }

    throw error;
};

export class usuarioService {
    static async createUsuario({ idRol, nombreUsuario, password }) {
        await throwIfDuplicateUsuario(nombreUsuario);
        await validateRolActivo(idRol);

        const passwordHash = await bcrypt.hash(password, 10);

        try {
            const usuario = await usuarioRepository.createUsuario({
                idRol,
                nombreUsuario,
                passwordHash
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

    static async getUsuarioById(idUsuario) {
        const usuario = await usuarioRepository.findById({ idUsuario });

        if (!usuario) {
            throw new AppError('Usuario no encontrado', 404);
        }

        return toPublicUsuario(usuario);
    }

    static async updateUsuario(idUsuario, { idRol, nombreUsuario }) {
        await this.getUsuarioById(idUsuario);

        if (nombreUsuario !== undefined) {
            await throwIfDuplicateUsuario(nombreUsuario, idUsuario);
        }

        if (idRol !== undefined) {
            await validateRolActivo(idRol);
        }

        try {
            await usuarioRepository.updateUsuario({
                idUsuario,
                idRol,
                nombreUsuario
            });
        } catch (error) {
            handleDuplicateDatabaseError(error);
        }

        return this.getUsuarioById(idUsuario);
    }

    static async updateEstado(idUsuario, { estado }) {
        await this.getUsuarioById(idUsuario);
        await usuarioRepository.updateEstado({ idUsuario, estado });

        return this.getUsuarioById(idUsuario);
    }

    static async updatePassword(idUsuario, { password }) {
        await this.getUsuarioById(idUsuario);

        const passwordHash = await bcrypt.hash(password, 10);
        await usuarioRepository.updatePassword({ idUsuario, passwordHash });
    }

    static async updateOwnPassword(idUsuario, { passwordActual, passwordNueva }) {
        const usuario = await usuarioRepository.findByIdWithPassword({
            idUsuario
        });

        if (!usuario) {
            throw new AppError('Usuario no encontrado', 404);
        }

        const passwordCorrecta = await bcrypt.compare(
            passwordActual,
            usuario.password_hash
        );

        if (!passwordCorrecta) {
            throw new AppError('La contraseña actual es incorrecta', 401);
        }

        const passwordHash = await bcrypt.hash(passwordNueva, 10);
        await usuarioRepository.updatePassword({ idUsuario, passwordHash });
    }
}
