import { AppError } from '../errors/app-error.js';
import { decimalAEntero } from './decimal.js';
import { urlRetornoPago } from './pagos-config.js';
import entorno from './pagos-entorno.cjs';
import { esPagoPrueba } from './pagos-prueba.js';

const exigirReal = pago => {
    if (entorno.esPruebaLocal() || esPagoPrueba(pago) || String(pago.id_externo || '').startsWith('PRUEBA_LOCAL_')) {
        throw new AppError('El procesador real no admite operaciones de prueba', 409);
    }
};

const conflicto = () => new AppError('La respuesta del proveedor no coincide con el pago. El importe permanece reservado para su revisión.', 409);
const comprobar = condicion => { if (!condicion) throw conflicto(); };
export const urlPagoSegura = (valor, metodo, comprobante = false) => {
    if (!valor) return null;
    let url;
    try { url = new URL(valor); } catch { throw conflicto(); }
    const hosts = metodo === 'TARJETA'
        ? comprobante ? ['pay.stripe.com', 'payments.stripe.com', 'receipt.stripe.com'] : ['checkout.stripe.com']
        : ['www.paypal.com', 'paypal.com'];
    comprobar(url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts.includes(url.hostname) && valor.length <= 2048);
    return valor;
};

// Sin redirects, reintentos ni logs de respuestas: pueden contener datos privados.
const solicitar = async (url, opciones = {}) => {
    if (entorno.esPruebaLocal()) throw new AppError('Las pasarelas reales están bloqueadas en pruebas locales', 409);
    try {
        const response = await fetch(url, { ...opciones, redirect: 'error', signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw new Error('Proveedor no disponible');
        return await response.json();
    } catch {
        throw new AppError('No fue posible verificar el resultado con el proveedor. Consulte el pago antes de iniciar otro; su importe permanece reservado.', 502);
    }
};
const stripe = (config, path, { body, key, method = 'GET' } = {}) => solicitar(`https://api.stripe.com/v1${path}`, {
    method, headers: { Authorization: `Bearer ${config.secretKey}`, 'Stripe-Version': '2025-06-30.basil',
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...(key ? { 'Idempotency-Key': key } : {}) }, body
});
const idValido = (id, patron) => { comprobar(typeof id === 'string' && patron.test(id)); return encodeURIComponent(id); };
const claveProveedor = pago => `cadefar-${pago.id_pago}-${pago.clave_operacion}`;

const comprobarCuentaStripe = async config => {
    const cuenta = await stripe(config, '/account');
    comprobar(cuenta.id === config.cuenta && cuenta.country === config.pais && cuenta.charges_enabled === true);
};
const verificarStripe = async (config, pago, session) => {
    comprobar(session.livemode === true && session.mode === 'payment' &&
        session.client_reference_id === String(pago.id_pago) && session.metadata?.clave_pago === pago.clave_operacion &&
        session.currency === pago.moneda_pasarela.toLowerCase() &&
        Number.isSafeInteger(session.amount_total) && BigInt(session.amount_total) === decimalAEntero(pago.importe_pasarela, 2) &&
        (!pago.id_externo || session.id === pago.id_externo));
    idValido(session.id, /^cs_live_[a-zA-Z0-9]+$/);
    const base = { id_externo: session.id, url_pago: session.status === 'open' ? urlPagoSegura(session.url, 'TARJETA') : null,
        estado: 'PROCESANDO', resultado_proveedor: session.status === 'expired' ? 'EXPIRED' : 'OPEN' };
    if (session.payment_status === 'paid') {
        const intent = session.payment_intent;
        comprobar(session.status === 'complete' && intent?.status === 'succeeded' && intent.livemode === true &&
            intent.currency === session.currency && BigInt(intent.amount_received) === decimalAEntero(pago.importe_pasarela, 2) &&
            intent.latest_charge?.paid === true && intent.latest_charge?.refunded === false &&
            intent.latest_charge?.amount_refunded === 0 && intent.latest_charge?.disputed === false &&
            intent.latest_charge?.payment_method_details?.type === 'card');
        idValido(intent.id, /^pi_[a-zA-Z0-9]+$/);
        return { ...base, estado: 'CONFIRMADO', resultado_proveedor: 'SUCCEEDED', referencia_externa: intent.id,
            url_comprobante: urlPagoSegura(intent.latest_charge.receipt_url, 'TARJETA', true) };
    }
    if (session.status === 'expired') return { ...base, estado: 'RECHAZADO' };
    return base;
};

const tokenPayPal = async config => {
    const result = await solicitar('https://api-m.paypal.com/v1/oauth2/token', {
        method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials'
    });
    comprobar(typeof result.access_token === 'string' && result.token_type?.toLowerCase() === 'bearer');
    return result.access_token;
};
const paypal = (token, path, { method = 'GET', body, key } = {}) => solicitar(`https://api-m.paypal.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
        Prefer: 'return=representation', ...(key ? { 'PayPal-Request-Id': key } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
});
const verificarPayPal = (config, pago, order) => {
    idValido(order.id, /^[A-Z0-9]+$/);
    const unit = order.purchase_units?.[0];
    comprobar(order.intent === 'CAPTURE' && order.purchase_units?.length === 1 &&
        unit.reference_id === String(pago.id_pago) && unit.custom_id === pago.clave_operacion &&
        unit.payee?.merchant_id === config.cuenta && unit.amount?.currency_code === pago.moneda_pasarela &&
        decimalAEntero(unit.amount.value, 2) === decimalAEntero(pago.importe_pasarela, 2) &&
        (!pago.id_externo || order.id === pago.id_externo));
    if (['APPROVED', 'COMPLETED'].includes(order.status)) {
        const cuentaPagadora = order.payment_source?.paypal?.account_id || order.payer?.payer_id;
        comprobar(cuentaPagadora === process.env.PAGOS_PAYPAL_PAYER_ID &&
            (!order.payer?.payer_id || order.payer.payer_id === cuentaPagadora));
    }
    const captura = unit.payments?.captures?.[0];
    const base = { id_externo: order.id, estado: 'PROCESANDO',
        resultado_proveedor: ['CREATED', 'SAVED', 'APPROVED', 'PAYER_ACTION_REQUIRED', 'COMPLETED', 'VOIDED'].includes(order.status) ? order.status : 'PENDING',
        url_pago: ['CREATED', 'PAYER_ACTION_REQUIRED'].includes(order.status)
            ? urlPagoSegura(order.links?.find(link => ['approve', 'payer-action'].includes(link.rel))?.href, 'PAYPAL') : null };
    if (captura?.status === 'COMPLETED') {
        comprobar(order.status === 'COMPLETED' && unit.payments.captures.length === 1 && captura.final_capture === true &&
            captura.amount?.currency_code === pago.moneda_pasarela &&
            decimalAEntero(captura.amount.value, 2) === decimalAEntero(pago.importe_pasarela, 2));
        idValido(captura.id, /^[A-Z0-9]+$/);
        return { ...base, estado: 'CONFIRMADO', resultado_proveedor: 'COMPLETED', referencia_externa: captura.id };
    }
    if (order.status === 'VOIDED' && !unit.payments?.captures?.length) return { ...base, estado: 'RECHAZADO' };
    return base;
};

export class pagosPasarela {
    static async crear(config, pago) {
        exigirReal(pago);
        const retorno = urlRetornoPago(pago.id_compra);
        if (pago.metodo === 'TARJETA') {
            await comprobarCuentaStripe(config);
            const spec = await stripe(config, `/country_specs/${config.pais}`);
            comprobar(spec.supported_payment_currencies?.includes(pago.moneda_pasarela.toLowerCase()));
            const body = new URLSearchParams({ mode: 'payment', 'payment_method_types[0]': 'card',
                'adaptive_pricing[enabled]': 'false', success_url: retorno, cancel_url: retorno,
                client_reference_id: String(pago.id_pago), 'metadata[clave_pago]': pago.clave_operacion,
                'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': pago.moneda_pasarela.toLowerCase(),
                'line_items[0][price_data][unit_amount]': String(decimalAEntero(pago.importe_pasarela, 2)),
                'line_items[0][price_data][product_data][name]': `Pago de compra CADEFAR #${pago.id_compra}`,
                'expand[0]': 'payment_intent.latest_charge' });
            const result = await stripe(config, '/checkout/sessions', { method: 'POST', body, key: claveProveedor(pago) });
            return verificarStripe(config, pago, result);
        }
        const token = await tokenPayPal(config);
        const order = await paypal(token, '/v2/checkout/orders', { method: 'POST', key: claveProveedor(pago), body: {
            intent: 'CAPTURE', purchase_units: [{ reference_id: String(pago.id_pago), custom_id: pago.clave_operacion,
                description: `Pago de compra CADEFAR #${pago.id_compra}`, payee: { merchant_id: config.cuenta },
                amount: { currency_code: pago.moneda_pasarela, value: pago.importe_pasarela } }],
            payment_source: { paypal: { experience_context: { user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING',
                return_url: retorno, cancel_url: retorno } } }
        } });
        return verificarPayPal(config, pago, order);
    }

    static async consultar(config, pago, capturar = false) {
        exigirReal(pago);
        if (pago.metodo === 'TARJETA') {
            await comprobarCuentaStripe(config);
            const id = idValido(pago.id_externo, /^cs_live_[a-zA-Z0-9]+$/);
            const session = await stripe(config, `/checkout/sessions/${id}?expand[]=payment_intent.latest_charge`);
            return verificarStripe(config, pago, session);
        }
        const token = await tokenPayPal(config);
        const id = idValido(pago.id_externo, /^[A-Z0-9]+$/);
        let order = await paypal(token, `/v2/checkout/orders/${id}`);
        const previo = verificarPayPal(config, pago, order);
        if (capturar && order.status === 'APPROVED' && previo.estado !== 'CONFIRMADO') {
            await paypal(token, `/v2/checkout/orders/${id}/capture`, { method: 'POST', key: `capture-${pago.id_pago}-${pago.clave_operacion}`, body: {} });
            // Nunca confiar en parámetros de retorno ni en la respuesta del navegador.
            order = await paypal(token, `/v2/checkout/orders/${id}`);
        }
        return verificarPayPal(config, pago, order);
    }
}
