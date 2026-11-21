import { z } from 'zod';
import { decimalAEntero, enteroADecimal, MAXIMO_COEFICIENTE_DECIMAL_14 } from '../../shared/utils/decimal.js';

const id = z.string().max(10).regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().positive().max(2147483647));
const importe = z.string().max(15).regex(/^\d{1,12}(?:\.\d{1,2})?$/).refine(valor => {
    if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(valor)) return false;
    const numero = decimalAEntero(valor, 2);
    return numero > 0n && numero <= MAXIMO_COEFICIENTE_DECIMAL_14;
}).transform(valor => enteroADecimal(decimalAEntero(valor, 2), 2));
const iniciar = z.object({
    claveOperacion: z.string().min(16).max(64).regex(/^[a-zA-Z0-9_-]+$/).transform(valor => valor.toLowerCase()),
    metodo: z.enum(['TARJETA', 'PAYPAL']), importe,
    importePasarela: importe.optional(),
    referenciaCotizacion: z.string().trim().min(1).max(100).optional(),
    autorizarPago: z.literal(true)
}).strict();

export class pagoCompraValidator {
    static validateIniciar(data) { return iniciar.safeParse(data); }
    static validateCompra(data) { return z.object({ idCompra: id }).strict().safeParse(data); }
    static validatePago(data) { return z.object({ idCompra: id, idPago: id }).strict().safeParse(data); }
    static validateVacio(data) { return z.object({}).strict().safeParse(data); }
    static validateConfirmar(data) { return z.object({ autorizarPago: z.literal(true) }).strict().safeParse(data); }
    static validateConciliar(data) { return z.object({ idExterno: z.string().min(1).max(100).regex(/^[A-Za-z0-9_]+$/) }).strict().safeParse(data); }
}
