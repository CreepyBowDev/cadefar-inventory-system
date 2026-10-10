import { z } from 'zod';
import { newPasswordSchema } from './password.schema.js';

const idUsuarioSchema = z.object({
    idUsuario: z.coerce
        .number()
        .int()
        .positive()
}).strict();

const nombreUsuarioSchema = z
    .string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .max(60, 'El nombre de usuario no puede superar los 60 caracteres');

const currentPasswordSchema = z
    .string()
    .min(1, 'La contraseña actual es obligatoria')
    .max(100, 'La contraseña no puede superar los 100 caracteres');

const correoSchema = z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'El correo no puede estar vacío')
    .max(255, 'El correo no puede superar los 255 caracteres')
    .email('El correo debe tener un formato válido')
    .nullable()
    .optional();

export const createUsuarioSchema = z.object({
    idRol: z
        .number()
        .int()
        .positive(),
    nombreUsuario: nombreUsuarioSchema,
    password: newPasswordSchema,
    correo: correoSchema
}).strict();

const updateUsuarioSchema = z.object({
    idRol: z
        .number()
        .int()
        .positive()
        .optional(),
    nombreUsuario: nombreUsuarioSchema.optional(),
    correo: correoSchema
}).strict().refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Debe enviar al menos un dato para modificar' }
);

const updateEstadoSchema = z.object({
    estado: z.boolean()
}).strict();

const updatePasswordSchema = z.object({
    password: newPasswordSchema
}).strict();

const updateOwnPasswordSchema = z.object({
    passwordActual: currentPasswordSchema,
    passwordNueva: newPasswordSchema
}).strict();

export class usuarioValidator {
    static validateIdUsuario(data) {
        return idUsuarioSchema.safeParse(data);
    }

    static validateCreateUsuario(data) {
        return createUsuarioSchema.safeParse(data);
    }

    static validateUpdateUsuario(data) {
        return updateUsuarioSchema.safeParse(data);
    }

    static validateUpdateEstado(data) {
        return updateEstadoSchema.safeParse(data);
    }

    static validateUpdatePassword(data) {
        return updatePasswordSchema.safeParse(data);
    }

    static validateUpdateOwnPassword(data) {
        return updateOwnPasswordSchema.safeParse(data);
    }
}
