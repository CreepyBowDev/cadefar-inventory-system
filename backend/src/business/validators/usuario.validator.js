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

const currentPasswordSchema = z
    .string()
    .min(1, 'La contraseña actual es obligatoria')
    .max(100, 'La contraseña no puede superar los 100 caracteres');

const newPasswordSchema = z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(100, 'La contraseña no puede superar los 100 caracteres')
    .regex(/\p{Lu}/u, 'La contraseña debe contener al menos una letra mayúscula')
    .regex(/\p{Ll}/u, 'La contraseña debe contener al menos una letra minúscula')
    .regex(/\p{N}/u, 'La contraseña debe contener al menos un número')
    .regex(
        /[\p{P}\p{S}]/u,
        'La contraseña debe contener al menos un carácter especial'
    );

export const createUsuarioSchema = z.object({
    idRol: z
        .number()
        .int()
        .positive(),
    nombreUsuario: nombreUsuarioSchema,
    password: newPasswordSchema
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
