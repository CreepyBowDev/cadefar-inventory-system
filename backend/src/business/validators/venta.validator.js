import { z } from 'zod';
import { esFechaCivilValida } from '../../shared/utils/vencimiento.js';
import { decimalAEntero, enteroADecimal,
    MAXIMO_COEFICIENTE_DECIMAL_14 } from '../../shared/utils/decimal.js';

const enteroPositivo = z.number().int().positive().max(2147483647);
const precioSchema = z.string().transform((valor, contexto) => {
    let precio;
    try { precio = decimalAEntero(valor, 2); }
    catch (error) {
        if (!(error instanceof TypeError || error instanceof RangeError)) throw error;
        contexto.addIssue({ code: 'custom', message: 'Debe indicar un precio decimal con hasta dos decimales' });
        return z.NEVER;
    }
    if (precio > MAXIMO_COEFICIENTE_DECIMAL_14) {
        contexto.addIssue({ code: 'custom', message: 'El precio supera 999999999999.99' });
        return z.NEVER;
    }
    return enteroADecimal(precio, 2);
});
const createSchema = z.object({
    claveOperacion: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/)
        .transform(valor => valor.toLowerCase()),
    detalles: z.array(z.object({
        idMedicamento: enteroPositivo,
        idExistencia: enteroPositivo,
        cantidad: enteroPositivo,
        precioUnitario: precioSchema
    }).strict()).min(1)
}).strict();

const enteroQuery = (maximo) => z.string().regex(/^[1-9]\d*$/)
    .transform(Number).pipe(z.number().int().positive().max(maximo));
const idSchema = enteroQuery(2147483647);
const fechaSchema = z.string().length(10)
    .refine(esFechaCivilValida, 'Debe indicar una fecha válida YYYY-MM-DD');
const filtrosSchema = z.object({
    idVenta: idSchema.optional(),
    idUsuario: idSchema.optional(),
    estadoOperacion: z.enum(['PENDIENTE', 'CONFIRMADA', 'ANULADA']).optional(),
    campoFecha: z.enum(['fechaRegistro', 'fechaVenta']).default('fechaRegistro'),
    desde: fechaSchema.optional(),
    hasta: fechaSchema.optional(),
    pagina: enteroQuery(2147483647).default(1),
    limite: enteroQuery(100).default(25)
}).strict().refine(data => !data.desde || !data.hasta || data.desde <= data.hasta, {
    message: 'La fecha desde no puede ser posterior a hasta', path: ['hasta']
});

export class ventaValidator {
    static validateAnular(data) {
        return z.object({ motivo: z.string().trim().min(1).max(255)
            .refine(valor => !/[\u0000-\u001f\u007f]/.test(valor), 'El motivo contiene caracteres de control')
        }).strict().safeParse(data);
    }
    static validateConfirmar(data) { return z.object({}).strict().safeParse(data === undefined ? {} : data); }
    static validateCreate(data) { return createSchema.safeParse(data); }
    static validateFiltros(data) { return filtrosSchema.safeParse(data); }
    static validateId(data) { return z.object({ idVenta: idSchema }).strict().safeParse(data); }
    static validateSinFiltros(data) { return z.object({}).strict().safeParse(data); }
}
