import z from "zod";

const loginSchema = z.object({
    nombreUsuario: z
        .string()
        .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
        .max(60, 'El nombre de usuario no puede superar los 60 caracteres'),
    password: z
        .string()
        .min(6, 'La contraseña debe tener al menos 6 caracteres')
        .max(100, 'La contraseña no puede superar los 100 caracteres')
}).strict();

export class authValidator {
    static validateLogin(data) {
        return loginSchema.safeParse(data);
    }
}
