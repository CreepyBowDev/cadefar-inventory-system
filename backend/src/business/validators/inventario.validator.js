import { z } from 'zod';
import { esFechaCivilValida } from '../../shared/utils/vencimiento.js';

const idSchema = z.string().regex(/^[1-9]\d*$/, 'Debe indicar un ID entero positivo')
    .transform(Number).pipe(z.number().int().positive().max(2147483647));
const texto = (maximo) => z.string().trim().min(1).max(maximo);
const fechaSchema = z.string().refine(esFechaCivilValida, 'Debe indicar una fecha válida YYYY-MM-DD');

const paramsSchema = z.object({ idMedicamento: idSchema }).strict();
const sinFiltrosSchema = z.object({}).strict();
const filtrosInventarioSchema = z.object({
    idMedicamento: idSchema.optional(),
    codigoMedicamento: texto(20).optional(),
    nombreComercial: texto(150).optional()
}).strict();
const filtrosMovimientosSchema = z.object({
    idMedicamento: idSchema.optional(),
    idExistencia: idSchema.optional(),
    desde: fechaSchema.optional(),
    hasta: fechaSchema.optional(),
    direccion: z.enum(['ENTRADA', 'SALIDA']).optional(),
    motivo: texto(40).optional()
}).strict().refine((data) => !data.desde || !data.hasta || data.desde <= data.hasta, {
    message: 'La fecha desde no puede ser posterior a hasta', path: ['hasta']
});

export class inventarioValidator {
    static validateId(data) { return paramsSchema.safeParse(data); }
    static validateSinFiltros(data) { return sinFiltrosSchema.safeParse(data); }
    static validateFiltrosInventario(data) { return filtrosInventarioSchema.safeParse(data); }
    static validateFiltrosMovimientos(data) { return filtrosMovimientosSchema.safeParse(data); }
}
