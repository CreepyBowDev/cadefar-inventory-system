import { z } from 'zod';
import { esFechaCivilValida } from '../../shared/utils/vencimiento.js';
import { decimalAEntero, enteroADecimal,
    MAXIMO_COEFICIENTE_DECIMAL_14 } from '../../shared/utils/decimal.js';

const idSchema = z.string().regex(/^[1-9]\d*$/, 'Debe indicar un ID entero positivo')
    .transform(Number).pipe(z.number().int().positive().max(2147483647));
const texto = (maximo) => z.string().trim().min(1).max(maximo);
const fechaSchema = z.string().refine(esFechaCivilValida, 'Debe indicar una fecha válida YYYY-MM-DD');
const enteroPositivoSchema = z.number().int().positive().max(2147483647);
const saldoSchema = z.number().int().nonnegative().max(2147483647);
const precondiciones = {
    idExistencia: enteroPositivoSchema,
    stockObservado: saldoSchema,
    ultimoMovimientoObservado: enteroPositivoSchema.nullable()
};
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
const ajusteSchema = z.object({
    ...precondiciones,
    saldoContado: saldoSchema,
    observacion: texto(500),
    costoUnitario: costoSchema.optional()
}).strict().superRefine((data, contexto) => {
    // Coherencia del cuerpo con el saldo observado. El Service deberá comparar
    // las precondiciones con la lectura actual antes de calcular el ajuste real.
    if (data.saldoContado > data.stockObservado && data.costoUnitario === undefined) {
        contexto.addIssue({ code: 'custom', path: ['costoUnitario'],
            message: 'El ajuste de entrada requiere costo unitario' });
    }
    if (data.saldoContado <= data.stockObservado && data.costoUnitario !== undefined) {
        contexto.addIssue({ code: 'custom', path: ['costoUnitario'],
            message: 'Solo el ajuste de entrada admite costo unitario' });
    }
});
const retiroVencimientoSchema = z.object({
    ...precondiciones, cantidad: enteroPositivoSchema, observacion: texto(500).optional()
}).strict();
const retiroDanoSchema = z.object({
    ...precondiciones, cantidad: enteroPositivoSchema, observacion: texto(500)
}).strict();

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
    static validateAjuste(data) { return ajusteSchema.safeParse(data); }
    static validateRetiroVencimiento(data) { return retiroVencimientoSchema.safeParse(data); }
    static validateRetiroDano(data) { return retiroDanoSchema.safeParse(data); }
}
