import { z } from 'zod';

const paramsSchema = z.object({
    idPrincipioActivo: z.coerce.number().int().positive().max(2147483647)
}).strict();

const datosSchema = z.object({
    nombre: z.string().trim().min(1).max(150),
    descripcion: z.string().trim().max(255)
        .transform((valor) => valor || null).nullable().optional()
});

const createSchema = datosSchema.extend({ estado: z.boolean().optional() }).strict();
const updateSchema = datosSchema.partial().strict().refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Debe enviar al menos un dato para modificar' }
);
const updateEstadoSchema = z.object({ estado: z.boolean() }).strict();

export class principioActivoValidator {
    static validateId(data) { return paramsSchema.safeParse(data); }
    static validateCreate(data) { return createSchema.safeParse(data); }
    static validateUpdate(data) { return updateSchema.safeParse(data); }
    static validateUpdateEstado(data) { return updateEstadoSchema.safeParse(data); }
}
