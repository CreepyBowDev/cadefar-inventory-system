import { z } from 'zod';

export const createUsuarioSchema = z.object({
    idRol: z
        .number()
        .int()
        .positive(),

    nombreUsuario: z
        .string()
        .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
        .max(60, 'El nombre de usuario no puede superar los 60 caracteres'),

    password: z
        .string()
        .min(8, 'La contraseña debe tener al menos 8 caracteres')
});

export class usuarioValidator {
    static validateCreateUsuario({ idRol, nombreUsuario, password }) {
        return createUsuarioSchema.safeParse({ idRol, nombreUsuario, password });
    }
}