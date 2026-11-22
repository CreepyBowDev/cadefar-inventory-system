'use strict';

const BASE_PRUEBAS = 'cadefar_pagos_pruebas';
const BASE_IDENTIDAD = 'cadefarexamen';
const esPruebaLocal = (env = process.env) => {
    const modo = env.PAGOS_MODO;
    if (!modo || modo === 'PRODUCCION') return false;
    if (modo !== 'PRUEBA_LOCAL' || env.NODE_ENV !== 'development' ||
        env.DB_NAME_PAGOS_PRUEBAS !== BASE_PRUEBAS ||
        env.DB_NAME !== BASE_IDENTIDAD || env.PAGOS_SESION_EXISTENTE !== 'true' ||
        !['127.0.0.1', 'localhost', '::1'].includes(env.DB_HOST) ||
        String(env.PORT || '3000') !== '3000' || env.FRONTEND_URL !== 'http://localhost:5173' ||
        env.PAGOS_MONEDA_COMPRAS !== 'BOB' || env.PAGOS_REALES_HABILITADOS !== 'false' ||
        (env.PAGOS_PROVEEDORES_JSON && env.PAGOS_PROVEEDORES_JSON !== '{}') ||
        env.PAGOS_PAYPAL_PAYER_ID || env.RECOVERY_ENABLED === 'true') {
        throw new Error('Configuración de pagos locales incompatible: arranque bloqueado');
    }
    return true;
};

module.exports = { BASE_PRUEBAS, BASE_IDENTIDAD, esPruebaLocal };
