import bcrypt from 'bcrypt';
import db from '../../data/models/index.js';
import { usuarioRepository } from '../../data/repositories/usuario.repository.js';
import { recuperacionPasswordRepository } from '../../data/repositories/recuperacion-password.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { generarToken, esVersionCredencialesValida } from '../../shared/utils/jwt.js';
import { siguienteVersionCredenciales } from '../../shared/utils/credenciales.js';
import { bitacoraAuditoriaService } from './bitacora-auditoria.service.js';
import { crearContextoAuditoriaConexion } from '../../shared/utils/auditoria-contexto.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';
import { snapshotUsuario, cuentaAuditoriaUsuario, camposModificadosAuditoria } from '../../shared/utils/auditoria-catalogo.js';

const identidadAuditoria = usuario => ({ idUsuario: usuario.id_usuario,
    nombreUsuario: usuario.nombre_usuario, idRol: usuario.id_rol });

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
        throw anotarErrorAuditoria(new AppError('El rol indicado no existe', 404), { causa: 'NO_ENCONTRADO' });
    }

    if (!rol.estado) {
        throw anotarErrorAuditoria(new AppError('El rol indicado está inactivo', 409), { causa: 'CONFLICTO' });
    }
};

const throwIfDuplicateUsuario = async (nombreUsuario, idUsuario = undefined, transaction = undefined) => {
    const usuarioExistente = await usuarioRepository.findByNombreUsuario({ nombreUsuario, transaction });

    if (usuarioExistente && usuarioExistente.id_usuario !== idUsuario) {
        throw anotarErrorAuditoria(new AppError('El nombre de usuario ya está en uso', 409), { causa: 'CONFLICTO' });
    }
};

const throwIfDuplicateCorreo = async (correo, idUsuario = undefined, transaction = undefined) => {
    if (correo === undefined || correo === null) return;

    const usuarioExistente = await usuarioRepository.findByCorreo({ correo, transaction });

    if (usuarioExistente && usuarioExistente.id_usuario !== idUsuario) {
        throw anotarErrorAuditoria(new AppError('El correo ya está en uso', 409), { causa: 'CONFLICTO' });
    }
};

const handleDuplicateDatabaseError = (error) => {
    if (error?.name === 'SequelizeUniqueConstraintError') {
        const campos = [
            ...Object.keys(error.fields ?? {}),
            ...(error.errors ?? []).map(detail => detail.path)
        ];
        if (campos.some(campo => ['correo', 'uq_usuario_correo'].includes(campo))) {
            throw anotarErrorAuditoria(new AppError('El correo ya está en uso', 409), { causa: 'CONFLICTO' });
        }
        if (campos.some(campo => ['nombre_usuario', 'uq_usuario_nombre_usuario'].includes(campo))) {
            throw anotarErrorAuditoria(new AppError('El nombre de usuario ya está en uso', 409), { causa: 'CONFLICTO' });
        }
        throw anotarErrorAuditoria(new AppError('Los datos del usuario entran en conflicto con una cuenta existente', 409), { causa: 'CONFLICTO' });
    }

    throw error;
};

const requireCurrentCredentials = (usuario, versionCredenciales, passwordHash = undefined) => {
    if (!usuario || !usuario.estado || !esVersionCredencialesValida(versionCredenciales) ||
        usuario.version_credenciales !== versionCredenciales ||
        (passwordHash !== undefined && usuario.password_hash !== passwordHash)) {
        throw anotarErrorAuditoria(new AppError('Sesión no válida', 401),
            { tipoEvento: 'SESION_INVALIDA', causa: 'CREDENCIALES_DESACTUALIZADAS' });
    }
};

export class usuarioService {
    static async createUsuario({ idRol, nombreUsuario, password, correo }, auditoria) {
        return bitacoraAuditoriaService.ejecutarCambio('USUARIO_CREAR', auditoria, undefined, async seguimiento => {
            await throwIfDuplicateUsuario(nombreUsuario);
            await throwIfDuplicateCorreo(correo);
            await validateRolActivo(idRol);
            const passwordHash = await bcrypt.hash(password, 10);
            try {
                return await db.sequelize.transaction(async transaction => {
                    seguimiento.transaction = transaction;
                    const usuario = await usuarioRepository.createUsuario({ idRol, nombreUsuario, passwordHash, correo, transaction });
                    if (!usuario) throw anotarErrorAuditoria(new AppError('Error al crear el usuario', 500),
                        { tipoEvento: 'ERROR_TECNICO', causa: 'ERROR_INTERNO' });
                    const resultado = await this.getUsuarioById(usuario.id_usuario, transaction);
                    await bitacoraAuditoriaService.registrarCambio(seguimiento, {
                        registro: { tipo: 'USUARIO', id: resultado.idUsuario }, cuentaObjetivo: cuentaAuditoriaUsuario(resultado),
                        despues: snapshotUsuario(resultado)
                    }, transaction);
                    return resultado;
                });
            } catch (error) { handleDuplicateDatabaseError(error); }
        });
    }

    static async getUsuarios(auditoria) {
        return bitacoraAuditoriaService.ejecutarCambio('USUARIOS_CONSULTAR', auditoria, undefined, async seguimiento => {
            const usuarios = await usuarioRepository.findAllUsuarios();
            const resultado = usuarios.map(toPublicUsuario);
            await bitacoraAuditoriaService.intentarRegistrar({ ...seguimiento.evento, resultado: 'EXITO',
                metadatos: { cantidadResultados: resultado.length } });
            return resultado;
        });
    }

    static async getUsuarioById(idUsuario, transaction = undefined, auditoria = undefined) {
        // Las lecturas internas de una escritura son parte de su evento de
        // origen. Solo la consulta HTTP sensible CU05 suministra auditoria.
        if (auditoria) return bitacoraAuditoriaService.ejecutarCambio('USUARIO_CONSULTAR', auditoria,
            { tipo: 'USUARIO', id: idUsuario }, async seguimiento => {
                const resultado = await this.getUsuarioById(idUsuario, transaction);
                seguimiento.evento.cuentaObjetivo = cuentaAuditoriaUsuario(resultado);
                await bitacoraAuditoriaService.intentarRegistrar({ ...seguimiento.evento, resultado: 'EXITO',
                    metadatos: { cantidadResultados: 1 } });
                return resultado;
            });
        const usuario = await usuarioRepository.findById({ idUsuario, transaction });

        if (!usuario) {
            throw anotarErrorAuditoria(new AppError('Usuario no encontrado', 404), { causa: 'NO_ENCONTRADO' });
        }

        return toPublicUsuario(usuario);
    }

    static async updateUsuario(idUsuario, { idRol, nombreUsuario, correo }, auditoria) {
        return bitacoraAuditoriaService.ejecutarCambio('USUARIO_MODIFICAR', auditoria, { tipo: 'USUARIO', id: idUsuario }, async seguimiento => {
            try {
                return await db.sequelize.transaction(async (transaction) => {
                    seguimiento.transaction = transaction;
                    const usuario = await usuarioRepository.findByIdForUpdate({ idUsuario, transaction });
                    if (!usuario) throw anotarErrorAuditoria(new AppError('Usuario no encontrado', 404), { causa: 'NO_ENCONTRADO' });
                    const antes = snapshotUsuario({ ...toPublicUsuario(usuario), rol: { idRol: usuario.id_rol } });
                    seguimiento.evento.cuentaObjetivo = identidadAuditoria(usuario);

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

                    const resultado = await this.getUsuarioById(idUsuario, transaction);
                    const despues = snapshotUsuario(resultado);
                    await bitacoraAuditoriaService.registrarCambio(seguimiento, { antes, despues,
                        cuentaObjetivo: cuentaAuditoriaUsuario(resultado),
                        camposModificados: camposModificadosAuditoria(antes, despues,
                            correo !== undefined && correo !== usuario.correo ? ['correo'] : [])
                    }, transaction);
                    return resultado;
                });
            } catch (error) {
                handleDuplicateDatabaseError(error);
            }
        });
    }

    static async updateEstado(idUsuario, { estado }, auditoria) {
        return bitacoraAuditoriaService.ejecutarCambio('USUARIO_ESTADO', auditoria, { tipo: 'USUARIO', id: idUsuario }, async seguimiento =>
            db.sequelize.transaction(async transaction => {
                seguimiento.transaction = transaction;
                const usuario = await usuarioRepository.findByIdForUpdate({ idUsuario, transaction });
                if (!usuario) throw anotarErrorAuditoria(new AppError('Usuario no encontrado', 404), { causa: 'NO_ENCONTRADO' });
                const antes = snapshotUsuario({ ...toPublicUsuario(usuario), rol: { idRol: usuario.id_rol } });
                seguimiento.evento.cuentaObjetivo = identidadAuditoria(usuario);
                await usuarioRepository.updateEstado({ idUsuario, estado, transaction });
                const resultado = await this.getUsuarioById(idUsuario, transaction);
                await bitacoraAuditoriaService.registrarCambio(seguimiento, { antes,
                    despues: snapshotUsuario(resultado), cuentaObjetivo: cuentaAuditoriaUsuario(resultado)
                }, transaction);
                return resultado;
            }));
    }

    static async updatePassword(idUsuario, { password }, auditoria = {}) {
        return bitacoraAuditoriaService.ejecutarSeguridad({
            contexto: auditoria.contexto ?? crearContextoAuditoriaConexion(),
            responsable: auditoria.responsable, tipoEvento: 'PASSWORD_RESTABLECER_ADMINISTRADOR',
            registro: { tipo: 'USUARIO', id: idUsuario }
        }, async seguimiento => {
            const existente = await usuarioRepository.findById({ idUsuario });
            if (!existente) throw anotarErrorAuditoria(new AppError('Usuario no encontrado', 404), { causa: 'NO_ENCONTRADO' });

            const passwordHash = await bcrypt.hash(password, 10);
            await db.sequelize.transaction(async (transaction) => {
                seguimiento.transaction = transaction;
                const usuario = await usuarioRepository.findByIdForUpdate({ idUsuario, transaction });
                if (!usuario) throw anotarErrorAuditoria(new AppError('Usuario no encontrado', 404), { causa: 'NO_ENCONTRADO' });
                seguimiento.evento.cuentaObjetivo = identidadAuditoria(usuario);
                seguimiento.evento.fechaEvento = new Date();
                seguimiento.etapa = 'SEGURIDAD';
                await usuarioRepository.updatePassword({
                    idUsuario, passwordHash, versionCredenciales: siguienteVersionCredenciales(usuario), transaction
                });
                await recuperacionPasswordRepository.invalidatePendingByUsuario({
                    idUsuario, invalidadaEn: new Date(), transaction
                });
                seguimiento.etapa = 'AUDITORIA';
                await bitacoraAuditoriaService.registrar({ ...seguimiento.evento, resultado: 'EXITO',
                    metadatos: { efecto: 'CONFIRMADO' } }, { transaction });
                seguimiento.etapa = 'CONFIRMACION';
            });
            return { cuentaObjetivo: seguimiento.evento.cuentaObjetivo };
        });
    }

    static async updateOwnPassword(idUsuario, { passwordActual, passwordNueva }, versionCredenciales, auditoria = {}) {
        return bitacoraAuditoriaService.ejecutarSeguridad({
            contexto: auditoria.contexto ?? crearContextoAuditoriaConexion(),
            responsable: auditoria.responsable, tipoEvento: 'PASSWORD_CAMBIAR_PROPIA',
            registro: { tipo: 'USUARIO', id: idUsuario }
        }, async seguimiento => {
            const usuario = await usuarioRepository.findByIdWithPassword({ idUsuario });
            if (!usuario) {
                throw anotarErrorAuditoria(new AppError('Usuario no encontrado', 404), { causa: 'NO_ENCONTRADO' });
            }
            seguimiento.evento.cuentaObjetivo = identidadAuditoria(usuario);
            requireCurrentCredentials(usuario, versionCredenciales);

            const passwordCorrecta = await bcrypt.compare(passwordActual, usuario.password_hash);
            if (!passwordCorrecta) {
                throw anotarErrorAuditoria(new AppError('La contraseña actual es incorrecta', 401), { causa: 'PASSWORD_INCORRECTA' });
            }

            const passwordHash = await bcrypt.hash(passwordNueva, 10);
            return db.sequelize.transaction(async (transaction) => {
                seguimiento.transaction = transaction;
                const current = await usuarioRepository.findByIdWithPassword({ idUsuario, transaction, lock: true });
                requireCurrentCredentials(current, versionCredenciales, usuario.password_hash);
                const nextVersion = siguienteVersionCredenciales(current);
                seguimiento.evento.cuentaObjetivo = identidadAuditoria(current);
                seguimiento.evento.responsable = identidadAuditoria(current);
                seguimiento.evento.fechaEvento = new Date();
                seguimiento.etapa = 'SEGURIDAD';
                await usuarioRepository.updatePassword({
                    idUsuario, passwordHash, versionCredenciales: nextVersion, transaction
                });
                await recuperacionPasswordRepository.invalidatePendingByUsuario({
                    idUsuario, invalidadaEn: new Date(), transaction
                });
                // Firmar antes del commit: un fallo revierte contraseña y recuperaciones.
                seguimiento.etapa = 'FIRMA_TOKEN';
                const token = generarToken({ idUsuario, idRol: current.id_rol, versionCredenciales: nextVersion });
                seguimiento.etapa = 'AUDITORIA';
                await bitacoraAuditoriaService.registrar({ ...seguimiento.evento, resultado: 'EXITO',
                    metadatos: { efecto: 'CONFIRMADO' } }, { transaction });
                seguimiento.etapa = 'CONFIRMACION';
                return { token, cuentaObjetivo: seguimiento.evento.cuentaObjetivo };
            });
        });
    }
}
