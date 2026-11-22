import test from 'node:test';
import assert from 'node:assert/strict';
import entorno from '../src/shared/utils/pagos-entorno.cjs';
import { monedaCompras, metodosPagoPublicos, obtenerConfiguracionPago } from '../src/shared/utils/pagos-config.js';
import { pagosPrueba } from '../src/shared/utils/pagos-prueba.js';
import { pagosPasarela } from '../src/shared/utils/pagos-pasarela.js';
import { pagosLocalMiddleware } from '../src/presentation/middlewares/pagos-local.middleware.js';

const demo = { NODE_ENV: 'production', PAGOS_MODO: 'SIMULACION', PAGOS_MONEDA_COMPRAS: 'BOB',
    PAGOS_REALES_HABILITADOS: 'false', PAGOS_PROVEEDORES_JSON: '{}', PAGOS_PAYPAL_PAYER_ID: '',
    FRONTEND_URL: 'https://cadefar.example.test', DB_HOST: 'mysql.example.test', PORT: '8080' };

test('Simulación desplegada explícita sin alterar el aislamiento de PRUEBA_LOCAL', () => {
    assert.equal(entorno.esSimulacion(demo), true);
    assert.equal(entorno.esPruebaLocal(demo), false);
    assert.equal(entorno.esSimulacion({}), false);
    assert.equal(entorno.esSimulacion({ ...demo, PAGOS_MODO: 'PRODUCCION' }), false);
    for (const cambio of [{ PAGOS_REALES_HABILITADOS: 'true' }, { PAGOS_REALES_HABILITADOS: '' },
        { PAGOS_MONEDA_COMPRAS: 'USD' }, { PAGOS_PROVEEDORES_JSON: '{"1":{}}' }, { PAGOS_PAYPAL_PAYER_ID: 'no-usar' }]) {
        assert.throws(() => entorno.esSimulacion({ ...demo, ...cambio }));
        assert.throws(() => entorno.esPruebaLocal({ ...demo, ...cambio }));
    }
});

test('Simulación en production: métodos disponibles, autorización remota y cero llamadas a pasarelas', async t => {
    const anterior = { ...process.env };
    Object.assign(process.env, demo);
    t.after(() => { process.env = anterior; });
    let llamadasRed = 0;
    t.mock.method(globalThis, 'fetch', () => { llamadasRed++; throw new Error('Red financiera prohibida'); });
    assert.equal(monedaCompras(), 'BOB');
    assert.ok(metodosPagoPublicos(5).every(m => m.disponible && m.moneda === 'BOB' && !m.requiereCotizacion));
    const config = obtenerConfiguracionPago(5, 'TARJETA');
    for (const metodo of ['TARJETA', 'PAYPAL']) {
        const pago = { id_pago: 1, metodo, cuenta_destino: config.cuenta, moneda: 'BOB', moneda_pasarela: 'BOB', estado: 'PENDIENTE' };
        const creado = { ...pago, ...pagosPrueba.crear(config, pago) };
        const autorizado = { ...creado, ...pagosPrueba.autorizar(creado, 'APROBAR') };
        assert.equal(pagosPrueba.consultar(config, autorizado, true).estado, 'CONFIRMADO');
        assert.equal(pagosPrueba.autorizar(creado, 'RECHAZAR').estado, 'RECHAZADO');
        await assert.rejects(pagosPasarela.crear(config, pago));
        await assert.rejects(pagosPasarela.consultar(config, { ...pago, cuenta_destino: 'cuenta_real' }));
        assert.throws(() => pagosPrueba.crear(config, { ...pago, cuenta_destino: 'cuenta_real' }));
    }
    let siguiente = false;
    pagosLocalMiddleware({ socket: { remoteAddress: '203.0.113.1' } }, {}, error => {
        assert.equal(error, undefined); siguiente = true;
    });
    assert.equal(siguiente, true);
    assert.equal(llamadasRed, 0);
    process.env.PAGOS_MODO = 'PRODUCCION';
    pagosLocalMiddleware({ socket: { remoteAddress: '203.0.113.1' } }, {}, error => assert.equal(error.statusCode, 404));
});

test('Servicio en production: iniciar, autorizar y confirmar un abono simulado con el historial habitual', async t => {
    const anterior = { ...process.env };
    Object.assign(process.env, demo, { DB_NAME_PRODUCTION: 'demo_sin_conexion' });
    t.after(() => { process.env = anterior; });
    const { default: db } = await import('../src/data/models/index.js');
    const { compraRepository } = await import('../src/data/repositories/compra.repository.js');
    const { pagoCompraRepository } = await import('../src/data/repositories/pago-compra.repository.js');
    const { bitacoraAuditoriaService } = await import('../src/business/services/bitacora-auditoria.service.js');
    const { pagoCompraService } = await import('../src/business/services/pago-compra.service.js');
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('MySQL prohibido'); });
    t.mock.method(globalThis, 'fetch', () => { throw new Error('Red financiera prohibida'); });
    t.mock.method(db.sequelize, 'transaction', async (opciones, operacion) => operacion({}));
    t.mock.method(bitacoraAuditoriaService, 'ejecutarCambio', async (evento, auditoria, entidad, operacion) => operacion({}));
    t.mock.method(bitacoraAuditoriaService, 'registrarCambio', async () => {});
    const compra = { id_compra: 1, id_proveedor_laboratorio: 5, total: '100.00', estado_operacion: 'CONFIRMADA' };
    t.mock.method(compraRepository, 'findById', async () => compra);
    t.mock.method(compraRepository, 'findParaAnular', async () => compra);
    let pago;
    t.mock.method(pagoCompraRepository, 'findHistorial', async () => pago ? [pago] : []);
    t.mock.method(pagoCompraRepository, 'findAll', async () => pago ? [pago] : []);
    t.mock.method(pagoCompraRepository, 'findByClave', async () => pago);
    t.mock.method(pagoCompraRepository, 'findById', async () => pago);
    t.mock.method(pagoCompraRepository, 'create', async ({ data }) => (pago = { id_pago: 1, ...data }));
    t.mock.method(pagoCompraRepository, 'update', async ({ data }) => { Object.assign(pago, data); return [1]; });
    assert.equal((await pagoCompraService.consultar(1)).esPrueba, true);
    assert.equal((await pagoCompraService.iniciar(1, { claveOperacion: 'demo-abono-001', metodo: 'TARJETA', importe: '25.00' }, 1, {})).estado, 'PROCESANDO');
    assert.equal((await pagoCompraService.consultar(1)).importeReservado, '25.00');
    await pagoCompraService.autorizarPrueba(1, 1, 'APROBAR', {});
    assert.equal((await pagoCompraService.verificar(1, 1, false, {})).estado, 'CONFIRMADO');
    const resumen = await pagoCompraService.consultar(1);
    assert.equal(resumen.totalPagado, '25.00');
    assert.equal(resumen.saldoPendiente, '75.00');
    assert.equal(resumen.pagos[0].esPrueba, true);
    pago.cuenta_destino = 'cuenta_real';
    await assert.rejects(pagoCompraService.consultar(1), /procesador local autorizado/);
});
