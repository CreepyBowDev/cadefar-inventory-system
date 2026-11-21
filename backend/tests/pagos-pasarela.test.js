import test from 'node:test';
import assert from 'node:assert/strict';
import { pagosPasarela, urlPagoSegura } from '../src/shared/utils/pagos-pasarela.js';

const pago = { id_pago: 7, id_compra: 10, clave_operacion: 'fixture-operacion-0001', metodo: 'TARJETA',
    importe_pasarela: '12.34', moneda_pasarela: 'USD', id_externo: 'cs_live_fixture' };
const config = { secretKey: 'fixture-sin-valor', cuenta: 'acct_fixture', pais: 'US',
    clientId: 'fixture', clientSecret: 'fixture' };
const sesion = () => ({ id: 'cs_live_fixture', livemode: true, mode: 'payment', client_reference_id: '7',
    metadata: { clave_pago: pago.clave_operacion }, currency: 'usd', amount_total: 1234,
    status: 'complete', payment_status: 'paid', payment_intent: { id: 'pi_fixture', livemode: true,
        status: 'succeeded', currency: 'usd', amount_received: 1234, latest_charge: {
            paid: true, refunded: false, amount_refunded: 0, disputed: false,
            payment_method_details: { type: 'card' }, receipt_url: 'https://pay.stripe.com/receipts/fixture'
        } } });

test('Stripe: solo confirma importes, moneda, cuenta, método y estado verificados', async t => {
    let session = sesion(), cuenta = { id: config.cuenta, country: 'US', charges_enabled: true };
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.match(url, /^https:\/\/api\.stripe\.com\/v1\//); assert.equal(options.redirect, 'error');
        return { ok: true, json: async () => structuredClone(url.endsWith('/account') ? cuenta : session) };
    });
    assert.equal((await pagosPasarela.consultar(config, pago)).estado, 'CONFIRMADO');
    const cambios = [s => { s.amount_total++; }, s => { s.currency = 'eur'; }, s => { s.livemode = false; },
        s => { s.metadata.clave_pago = 'otra'; }, s => { s.client_reference_id = '9'; },
        s => { s.payment_intent.status = 'processing'; }, s => { s.payment_intent.amount_received = 1233; },
        s => { s.payment_intent.latest_charge.refunded = true; }, s => { s.payment_intent.latest_charge.amount_refunded = 1; },
        s => { s.payment_intent.latest_charge.disputed = true; }, s => { s.payment_intent.latest_charge.payment_method_details.type = 'paypal'; },
        s => { s.payment_intent.latest_charge.receipt_url = 'https://atacante.test/robar'; }];
    for (const cambiar of cambios) {
        session = sesion(); cambiar(session); await assert.rejects(pagosPasarela.consultar(config, pago), error => error.statusCode === 409);
    }
    session = { ...sesion(), status: 'open', payment_status: 'unpaid', payment_intent: null, url: 'https://checkout.stripe.com/c/pay/fixture' };
    assert.equal((await pagosPasarela.consultar(config, pago)).estado, 'PROCESANDO');
    session.status = 'expired'; assert.equal((await pagosPasarela.consultar(config, pago)).estado, 'RECHAZADO');
    cuenta = { ...cuenta, id: 'acct_ajena' }; await assert.rejects(pagosPasarela.consultar(config, pago), /no coincide/);
});

test('Stripe: sesión alojada, destinatario del laboratorio y clave estable al reintentar', async t => {
    const anterior = process.env.FRONTEND_URL; t.after(() => { if (anterior === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = anterior; });
    process.env.FRONTEND_URL = 'https://cadefar.example.test';
    const keys = [], bodies = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        if (url.endsWith('/account')) return { ok: true, json: async () => ({ id: config.cuenta, country: 'US', charges_enabled: true }) };
        if (url.includes('/country_specs/')) return { ok: true, json: async () => ({ supported_payment_currencies: ['usd'] }) };
        assert.equal(options.method, 'POST'); keys.push(options.headers['Idempotency-Key']); bodies.push(options.body.toString());
        assert.equal(options.body.get('payment_method_types[0]'), 'card');
        assert.equal(options.body.get('line_items[0][price_data][unit_amount]'), '1234');
        assert.equal(options.body.get('success_url'), 'https://cadefar.example.test/compras/10');
        return { ok: true, json: async () => ({ ...sesion(), status: 'open', payment_status: 'unpaid', url: 'https://checkout.stripe.com/c/pay/fixture' }) };
    });
    await pagosPasarela.crear(config, { ...pago, id_externo: null }); await pagosPasarela.crear(config, { ...pago, id_externo: null });
    assert.equal(keys[0], keys[1]); assert.equal(bodies[0], bodies[1]);
    assert.doesNotMatch(bodies[0], /card_number|cvv|cvc|customer\[/);
});

const orderFixture = () => ({ id: 'ORDERFIXTURE01', intent: 'CAPTURE', status: 'APPROVED',
    payer: { payer_id: 'CADEFAR000012' }, purchase_units: [{ reference_id: '7', custom_id: pago.clave_operacion,
        payee: { merchant_id: 'LABORATORIO01' }, amount: { currency_code: 'USD', value: '12.34' } }] });
test('PayPal: autorización no equivale a pago; captura solo por confirmación expresa y consulta posterior', async t => {
    const anterior = process.env.PAGOS_PAYPAL_PAYER_ID; t.after(() => { if (anterior === undefined) delete process.env.PAGOS_PAYPAL_PAYER_ID; else process.env.PAGOS_PAYPAL_PAYER_ID = anterior; });
    process.env.PAGOS_PAYPAL_PAYER_ID = 'CADEFAR000012';
    const pp = { ...pago, metodo: 'PAYPAL', id_externo: 'ORDERFIXTURE01' };
    const cuenta = { ...config, cuenta: 'LABORATORIO01' };
    let order = orderFixture(), capturas = 0;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.match(url, /^https:\/\/api-m\.paypal\.com\//);
        if (url.endsWith('/token')) return { ok: true, json: async () => ({ access_token: 'fixture', token_type: 'Bearer' }) };
        if (url.endsWith('/capture')) {
            capturas++; assert.equal(options.headers['PayPal-Request-Id'], `capture-7-${pago.clave_operacion}`);
            order.status = 'COMPLETED'; order.purchase_units[0].payments = { captures: [{ id: 'CAPTUREFIXTURE01', status: 'COMPLETED',
                final_capture: true, amount: { currency_code: 'USD', value: '12.34' } }] };
        }
        return { ok: true, json: async () => structuredClone(order) };
    });
    assert.equal((await pagosPasarela.consultar(cuenta, pp)).estado, 'PROCESANDO'); assert.equal(capturas, 0);
    const result = await pagosPasarela.consultar(cuenta, pp, true);
    assert.equal(result.estado, 'CONFIRMADO'); assert.equal(result.referencia_externa, 'CAPTUREFIXTURE01');
    await pagosPasarela.consultar(cuenta, pp, true); assert.equal(capturas, 1);
    order.payment_source = { paypal: { account_id: order.payer.payer_id } }; delete order.payer;
    assert.equal((await pagosPasarela.consultar(cuenta, pp)).estado, 'CONFIRMADO');
    const cambios = [o => { o.payer.payer_id = 'CUENTAAJENA01'; }, o => { o.purchase_units[0].payee.merchant_id = 'AJENO'; },
        o => { o.purchase_units[0].amount.value = '12.33'; }, o => { o.purchase_units[0].amount.currency_code = 'BOB'; },
        o => { o.purchase_units[0].custom_id = 'ajeno'; }];
    for (const cambiar of cambios) {
        order = orderFixture(); cambiar(order); await assert.rejects(pagosPasarela.consultar(cuenta, pp, true), /no coincide/);
    }
    assert.equal(capturas, 1);
    order = orderFixture(); order.status = 'VOIDED'; delete order.payer;
    assert.equal((await pagosPasarela.consultar(cuenta, pp)).estado, 'RECHAZADO');
});

test('Errores del proveedor conservan incertidumbre sin exponer credenciales ni responder confirmación', async t => {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: false, json: async () => ({ secret: 'NO_REVELAR' }) }));
    await assert.rejects(pagosPasarela.consultar(config, pago), error => error.statusCode === 502 && !/NO_REVELAR|fixture-sin-valor/.test(error.message));
    for (const url of ['javascript:alert(1)', 'http://checkout.stripe.com/pago', 'https://checkout.stripe.com.atacante.test/pago', 'https://usuario@checkout.stripe.com/pago', 'https://checkout.stripe.com:444/pago']) {
        assert.throws(() => urlPagoSegura(url, 'TARJETA'), /no coincide/);
    }
});
