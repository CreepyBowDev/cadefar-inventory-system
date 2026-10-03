import { z } from 'zod';

const idParamSchema = z.coerce.number().int().positive().max(2147483647);
const medicamentoParamsSchema = z.object({ idMedicamento: idParamSchema }).strict();
const composicionParamsSchema = medicamentoParamsSchema.extend({
    idComposicion: idParamSchema
}).strict();

const cantidadSchema = z.number().positive().max(99999999.9999).refine(
    (valor) => {
        const [mantisa, exponente = '0'] = String(valor).split('e');
        const decimales = (mantisa.split('.')[1] || '').length;
        return decimales - Number(exponente) <= 4;
    },
    { message: 'La cantidad admite como máximo cuatro decimales' }
);
const unidadSchema = z.string().trim().min(1).max(30);
const cantidadesSchema = z.object({
    cantidadPrincipioActivo: cantidadSchema,
    unidadPrincipioActivo: unidadSchema,
    cantidadReferencia: cantidadSchema,
    unidadReferencia: unidadSchema
});
const createSchema = cantidadesSchema.extend({
    idPrincipioActivo: z.number().int().positive().max(2147483647)
}).strict();
const updateSchema = cantidadesSchema.partial().strict().refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Debe enviar al menos un dato para modificar' }
);

export class composicionMedicamentoValidator {
    static validateMedicamentoId(data) { return medicamentoParamsSchema.safeParse(data); }
    static validateId(data) { return composicionParamsSchema.safeParse(data); }
    static validateCreate(data) { return createSchema.safeParse(data); }
    static validateUpdate(data) { return updateSchema.safeParse(data); }
}
