import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import entorno from './pagos-entorno.cjs';

// Cuentas receptoras propiedad del laboratorio, nunca de CADEFAR. Secretos solo
// en el entorno del servidor. La habilitación comercial incluye medicamentos.
const comun = {
    habilitado: z.literal(true), autorizadoMedicamentos: z.literal(true),
    titularidadLaboratorioVerificada: z.literal(true),
    pais: z.string().regex(/^[A-Z]{2}$/).refine(pais => pais !== 'BO'),
    moneda: z.enum(['BOB', 'USD', 'EUR'])
};
const tarjeta = z.object({ ...comun, secretKey: z.string().regex(/^sk_live_/),
    accountId: z.string().regex(/^acct_[a-zA-Z0-9]+$/) });
const paypal = z.object({ ...comun, moneda: z.enum(['USD', 'EUR']),
    clientId: z.string().min(1), clientSecret: z.string().min(1), merchantId: z.string().regex(/^[A-Z0-9]{13}$/) });

export const monedaCompras = () => entorno.esSimulacion() ? 'BOB' : ['BOB', 'USD', 'EUR'].includes(process.env.PAGOS_MONEDA_COMPRAS)
    ? process.env.PAGOS_MONEDA_COMPRAS : null;

export const obtenerConfiguracionPago = (idProveedor, metodo, exigirHabilitacion = true) => {
    if (entorno.esSimulacion()) return { moneda: 'BOB', cuenta: `PRUEBA_LOCAL_LAB_${idProveedor}`, procesador: 'PRUEBA_LOCAL' };
    if (exigirHabilitacion && process.env.PAGOS_REALES_HABILITADOS !== 'true') {
        throw new AppError('El método de pago no está disponible. Se requiere habilitación administrativa.', 503);
    }
    let configuraciones;
    try { configuraciones = JSON.parse(process.env.PAGOS_PROVEEDORES_JSON || '{}'); }
    catch { throw new AppError('El método de pago no está disponible por configuración incompleta.', 503); }
    const schema = metodo === 'TARJETA' ? tarjeta : paypal;
    const result = schema.safeParse(configuraciones?.[idProveedor]?.[metodo]);
    if (!result.success || !monedaCompras() || (metodo === 'PAYPAL' && !/^[A-Z0-9]{13}$/.test(process.env.PAGOS_PAYPAL_PAYER_ID || ''))) {
        throw new AppError('El método de pago no está disponible para este laboratorio. Se requiere una cuenta receptora compatible y habilitada.', 503);
    }
    return { ...result.data, cuenta: metodo === 'TARJETA' ? result.data.accountId : result.data.merchantId };
};

export const metodosPagoPublicos = idProveedor => ['TARJETA', 'PAYPAL'].map(metodo => {
    try {
        const config = obtenerConfiguracionPago(idProveedor, metodo);
        urlRetornoPago(1);
        return { metodo, disponible: true, moneda: config.moneda,
            requiereCotizacion: config.moneda !== monedaCompras() };
    } catch (error) {
        if (!(error instanceof AppError)) throw error;
        return { metodo, disponible: false, mensaje: error.message };
    }
});

export const urlRetornoPago = idCompra => {
    if (entorno.esPruebaLocal()) return `http://localhost:5173/compras/${idCompra}`;
    let url;
    try { url = new URL(process.env.FRONTEND_URL); } catch { throw new AppError('El método de pago no está disponible por configuración incompleta.', 503); }
    if (url.protocol !== 'https:' || url.username || url.password) {
        throw new AppError('El método de pago requiere una dirección segura de retorno.', 503);
    }
    return new URL(`/compras/${idCompra}`, url.origin).href;
};
