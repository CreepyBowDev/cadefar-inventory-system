import { z } from 'zod';
import { decimalAEntero, enteroADecimal,
    MAXIMO_COEFICIENTE_DECIMAL_14 } from '../../shared/utils/decimal.js';
import { esFechaCivilValida,
    obtenerFechaEtiquetaNormalizada } from '../../shared/utils/vencimiento.js';

const enteroPositivoSchema = z.number().int().positive().max(2147483647);
const idQuerySchema = z.string().regex(/^[1-9]\d*$/)
    .refine((valor) => valor === valor.trim(), 'El ID no admite espacios')
    .transform(Number).pipe(enteroPositivoSchema);
const fechaSchema = z.string().length(10)
    .refine(esFechaCivilValida, 'Debe indicar una fecha válida YYYY-MM-DD');
const mesSchema = z.string().length(7).regex(/^\d{4}-\d{2}$/)
    .refine((valor) => esFechaCivilValida(`${valor}-01`), 'Debe indicar un mes válido YYYY-MM')
    .transform((valor) => obtenerFechaEtiquetaNormalizada(`${valor}-01`, 'MES'));
const claveSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/)
    .refine((valor) => valor === valor.trim(), 'La clave no admite espacios')
    .transform((valor) => valor.toLowerCase());
const costoSchema = z.string().transform((valor, contexto) => {
    let costo;
    try {
        costo = decimalAEntero(valor, 6);
    } catch (error) {
        if (!(error instanceof TypeError || error instanceof RangeError)) throw error;
        contexto.addIssue({ code: 'custom', message: 'Debe indicar un costo decimal con hasta seis decimales' });
        return z.NEVER;
    }
    if (costo <= 0n || costo > MAXIMO_COEFICIENTE_DECIMAL_14) {
        contexto.addIssue({ code: 'custom', message: 'El costo debe ser positivo y no superar 99999999.999999' });
        return z.NEVER;
    }
    return enteroADecimal(costo, 6);
});

const detalleBaseSchema = z.object({
    idMedicamento: enteroPositivoSchema,
    cantidad: enteroPositivoSchema,
    costoUnitario: costoSchema
});
const detalleSchema = z.discriminatedUnion('precisionVencimiento', [
    detalleBaseSchema.extend({
        precisionVencimiento: z.literal('DIA'), fechaVencimiento: fechaSchema
    }).strict(),
    detalleBaseSchema.extend({
        precisionVencimiento: z.literal('MES'), fechaVencimiento: mesSchema
    }).strict()
]);
const createSchema = z.object({
    claveOperacion: claveSchema,
    fechaCompra: fechaSchema,
    detalles: z.array(detalleSchema).min(1)
}).strict();
const paramsSchema = z.object({ idCompra: idQuerySchema }).strict();
const anularSchema = z.object({ motivo: z.string().trim().min(1).max(255) }).strict();
const sinFiltrosSchema = z.object({}).strict();
const filtrosSchema = z.object({
    desde: fechaSchema.optional(),
    hasta: fechaSchema.optional(),
    idProveedorLaboratorio: idQuerySchema.optional(),
    estadoOperacion: z.enum(['CONFIRMADA', 'ANULADA']).optional(),
    claveOperacion: claveSchema.optional()
}).strict().refine((data) => !data.desde || !data.hasta || data.desde <= data.hasta, {
    message: 'La fecha desde no puede ser posterior a hasta', path: ['hasta']
});

// Las reglas dependientes del día comercial y de registros reales se aplican
// en CompraService con el instante de operación obtenido bajo los bloqueos.
export class compraValidator {
    static validateCreate(data) { return createSchema.safeParse(data); }
    static validateAnular(data) { return anularSchema.safeParse(data); }
    static validateId(data) { return paramsSchema.safeParse(data); }
    static validateFiltros(data) { return filtrosSchema.safeParse(data); }
    static validateSinFiltros(data) { return sinFiltrosSchema.safeParse(data); }
}
