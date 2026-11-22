import test from 'node:test';
import assert from 'node:assert/strict';
import entorno from '../src/shared/utils/pagos-entorno.cjs';
import { pagosPrueba } from '../src/shared/utils/pagos-prueba.js';
import { pagosPasarela } from '../src/shared/utils/pagos-pasarela.js';

const local = { NODE_ENV: 'development', PAGOS_MODO: 'PRUEBA_LOCAL', DB_NAME_PAGOS_PRUEBAS: 'cadefar_pagos_pruebas',
    DB_NAME: 'cadefarexamen', PAGOS_SESION_EXISTENTE: 'true',
    DB_HOST: '127.0.0.1', PORT: '3000', FRONTEND_URL: 'http://localhost:5173', PAGOS_MONEDA_COMPRAS: 'BOB',
    PAGOS_REALES_HABILITADOS: 'false', PAGOS_PROVEEDORES_JSON: '{}', PAGOS_PAYPAL_PAYER_ID: '', RECOVERY_ENABLED: 'false' };
test('Gate local explícito, producción bloqueada y sin fallback real', () => {
    assert.equal(entorno.esPruebaLocal({}), false);
    assert.equal(entorno.esPruebaLocal(local), true);
    for (const changes of [{ NODE_ENV: 'production' }, { NODE_ENV: 'test' }, { DB_HOST: 'remoto.example' },
        { DB_NAME_PAGOS_PRUEBAS: 'cadefarexamen' }, { PAGOS_REALES_HABILITADOS: 'true' },
        { DB_NAME: 'otra_base' }, { PAGOS_SESION_EXISTENTE: 'false' },
        { FRONTEND_URL: 'https://remoto.example' }, { PAGOS_MONEDA_COMPRAS: 'USD' }, { PAGOS_MODO: 'desconocido' },
        { PAGOS_PROVEEDORES_JSON: '{"1":{}}' }, { PAGOS_PAYPAL_PAYER_ID: 'no-usar' }, { RECOVERY_ENABLED: 'true' }]) {
        assert.throws(() => entorno.esPruebaLocal({ ...local, ...changes }));
    }
});
test('Adaptador local sin red: espera, aprobación, PayPal explícito, rechazo y cancelación', async t => {
    const anterior = { ...process.env }; Object.assign(process.env, local);
    t.after(() => { process.env = anterior; });
    t.mock.method(globalThis, 'fetch', () => { throw new Error('No se permite red'); });
    const pago = { id_pago: 1, metodo: 'TARJETA', cuenta_destino: 'PRUEBA_LOCAL_LAB_1', moneda: 'BOB', moneda_pasarela: 'BOB', estado: 'PENDIENTE' };
    const creado = { ...pago, ...pagosPrueba.crear({}, pago) };
    assert.equal(creado.resultado_proveedor, 'PRUEBA_LOCAL_ESPERANDO');
    assert.equal(pagosPrueba.consultar({}, creado).estado, 'PROCESANDO');
    const aprobado = { ...creado, ...pagosPrueba.autorizar(creado, 'APROBAR') };
    assert.equal(pagosPrueba.consultar({}, aprobado).estado, 'CONFIRMADO');
    const paypal = { ...creado, metodo: 'PAYPAL' };
    const autorizado = { ...paypal, ...pagosPrueba.autorizar(paypal, 'APROBAR') };
    assert.equal(pagosPrueba.consultar({}, autorizado).estado, 'PROCESANDO');
    assert.equal(pagosPrueba.consultar({}, autorizado, true).estado, 'CONFIRMADO');
    assert.equal(pagosPrueba.autorizar(creado, 'RECHAZAR').estado, 'RECHAZADO');
    assert.equal(pagosPrueba.autorizar(creado, 'CANCELAR').resultado_proveedor, 'PRUEBA_LOCAL_CANCELADO');
    assert.equal(pagosPrueba.autorizar(creado, 'PENDIENTE').resultado_proveedor, 'PRUEBA_LOCAL_EN_REVISION');
    for (const pagoAutorizado of [aprobado, autorizado]) {
        const cancelado = { ...pagoAutorizado, ...pagosPrueba.autorizar(pagoAutorizado, 'CANCELAR') };
        assert.equal(cancelado.resultado_proveedor, 'PRUEBA_LOCAL_CANCELADO');
        assert.equal(pagosPrueba.consultar({}, cancelado, true).estado, 'RECHAZADO');
        assert.deepEqual(pagosPrueba.autorizar(cancelado, 'APROBAR'), {});
    }
    const confirmado = { ...aprobado, ...pagosPrueba.consultar({}, aprobado) };
    assert.deepEqual(pagosPrueba.autorizar(confirmado, 'CANCELAR'), {});
    assert.throws(() => pagosPrueba.autorizar(creado, 'CONFIRMADO'));
    assert.throws(() => pagosPrueba.crear({}, { ...pago, cuenta_destino: 'acct_real' }));
    await assert.rejects(pagosPasarela.crear({}, pago));
    await assert.rejects(pagosPasarela.consultar({}, pago));
    process.env.PAGOS_MODO = 'PRODUCCION';
    assert.throws(() => pagosPrueba.crear({}, pago));
    await assert.rejects(pagosPasarela.crear({}, pago));
});
