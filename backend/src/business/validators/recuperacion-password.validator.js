import { z } from 'zod';
import { newPasswordSchema } from './password.schema.js';

const correoSchema = z.string().trim().toLowerCase().min(1).max(255).email();
const solicitudSchema = z.object({ correo: correoSchema }).strict();
const restablecimientoSchema = z.object({
    correo: correoSchema,
    codigo: z.string().regex(/^\d{6}$/),
    passwordNueva: newPasswordSchema
}).strict();

export class recuperacionPasswordValidator {
    static validateSolicitud(data) {
        return solicitudSchema.safeParse(data);
    }

    static validateRestablecimiento(data) {
        return restablecimientoSchema.safeParse(data);
    }
}
