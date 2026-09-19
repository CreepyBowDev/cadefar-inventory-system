import { z } from 'zod';

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

const passwordSchema = z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(100, 'La contraseña no puede superar los 100 caracteres');

export const createUsuarioSchema = z.object({
    idRol: z
        .number()
        .int()
        .positive(),
    nombreUsuario: nombreUsuarioSchema,
    password: passwordSchema
}).strict();

const updateUsuarioSchema = z.object({
    idRol: z
        .number()
        .int()
        .positive()
        .optional(),
    nombreUsuario: nombreUsuarioSchema.optional()
}).strict().refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Debe enviar al menos un dato para modificar' }
);

const updateEstadoSchema = z.object({
    estado: z.boolean()
}).strict();

const updatePasswordSchema = z.object({
    password: passwordSchema
}).strict();

const updateOwnPasswordSchema = z.object({
    passwordActual: passwordSchema,
    passwordNueva: passwordSchema
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
