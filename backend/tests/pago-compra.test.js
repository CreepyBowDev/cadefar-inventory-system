import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'pagos_sin_conexion';
const { default: db } = await import('../src/data/models/index.js');
const { pagoCompraValidator: validator } = await import('../src/business/validators/pago-compra.validator.js');
const { pagoCompraService: service, calcularResumenPagos } = await import('../src/business/services/pago-compra.service.js');
const { compraService } = await import('../src/business/services/compra.service.js');
const { compraRepository: compras } = await import('../src/data/repositories/compra.repository.js');
const { pagoCompraRepository: pagos } = await import('../src/data/repositories/pago-compra.repository.js');
const { pagosPasarela } = await import('../src/shared/utils/pagos-pasarela.js');
const { obtenerFechaOperacion } = await import('../src/shared/utils/fecha-operacion.js');
const { simularAuditoriaNegocio } = await import('./helpers/auditoria-transversal.js');
const { bitacoraAuditoriaService } = await import('../src/business/services/bitacora-auditoria.service.js');
const { metodosPagoPublicos } = await import('../src/shared/utils/pagos-config.js');

const entrada = (extra = {}) => validator.validateIniciar({ claveOperacion: 'pago-fixture-unico-001',
    metodo: 'TARJETA', importe: '40.00', autorizarPago: true, ...extra }).data;
const configurar = t => {
    const anteriores = { ...process.env };
    t.after(() => { process.env = anteriores; });
    process.env.PAGOS_REALES_HABILITADOS = 'true'; process.env.PAGOS_MONEDA_COMPRAS = 'BOB';
    process.env.FRONTEND_URL = 'https://cadefar.example.test';
    process.env.PAGOS_PAYPAL_PAYER_ID = 'CADEFAR000012';
    process.env.PAGOS_PROVEEDORES_JSON = JSON.stringify({ 5: {
        TARJETA: { habilitado: true, autorizadoMedicamentos: true, titularidadLaboratorioVerificada: true,
            pais: 'US', moneda: 'BOB', secretKey: 'sk_live_fixture_sin_valor', accountId: 'acct_fixture' },
        PAYPAL: { habilitado: true, autorizadoMedicamentos: true, titularidadLaboratorioVerificada: true,
            pais: 'US', moneda: 'USD', clientId: 'fixture', clientSecret: 'fixture', merchantId: 'LABORATORIO01' }
    } });
};

test('Contrato financiero estricto, sin números de tarjeta ni importes aproximados', () => {
    assert.equal(entrada().importe, '40.00');
    for (const importe of [0, '0', '-1', '1.001', '1e2', '1,20', ' 1', '9999999999999']) {
        assert.equal(validator.validateIniciar({ ...entrada(), importe }).success, false);
    }
    for (const campo of ['estado', 'referenciaExterna', 'idUsuario', 'cvv', 'numeroTarjeta', 'moneda']) {
        assert.equal(validator.validateIniciar({ ...entrada(), [campo]: 'dato-no-permitido' }).success, false);
    }
    assert.equal(validator.validateIniciar({ ...entrada(), autorizarPago: false }).success, false);
    assert.equal(validator.validatePago({ idCompra: '1', idPago: '2' }).success, true);
    for (const id of ['0', '01', '-1', '1.0', '2147483648']) assert.equal(validator.validateCompra({ idCompra: id }).success, false);
});

test('Saldo exacto, pagos parciales, reservas y recepción independiente', () => {
    const compra = { total: '999999999999.99', estado_operacion: 'CONFIRMADA' };
    const list = [{ importe: '0.01', moneda: 'BOB', estado: 'CONFIRMADO' },
        { importe: '25.00', moneda: 'BOB', estado: 'PROCESANDO' }, { importe: '10.00', moneda: 'BOB', estado: 'RECHAZADO' }];
    assert.deepEqual(calcularResumenPagos(compra, list, 'BOB'), { moneda: 'BOB', total: '999999999999.99',
        totalPagado: '0.01', saldoPendiente: '999999999999.98', importeReservado: '25.00', saldoDisponible: '999999999974.98', estadoFinanciero: 'PROCESANDO' });
    assert.equal(compra.estado_operacion, 'CONFIRMADA');
    assert.equal(calcularResumenPagos({ total: '1.00', estado_operacion: 'CONFIRMADA' }, [{ importe: '0.20', moneda: 'BOB', estado: 'CONFIRMADO' }], 'BOB').estadoFinanciero, 'PARCIAL');
    assert.equal(calcularResumenPagos({ total: '1.00', estado_operacion: 'CONFIRMADA' }, [{ importe: '1.00', moneda: 'BOB', estado: 'CONFIRMADO' }], 'BOB').estadoFinanciero, 'PAGADO');
    assert.throws(() => calcularResumenPagos({ total: '0.00' }, list, 'BOB'), /supera/);
    assert.throws(() => calcularResumenPagos(compra, list, 'USD'), /moneda/);
});

test('Métodos no habilitados y laboratorios bolivianos no se presentan como compatibles', t => {
    configurar(t);
    process.env.PAGOS_REALES_HABILITADOS = 'false';
    assert.ok(metodosPagoPublicos(5).every(m => !m.disponible));
    process.env.PAGOS_REALES_HABILITADOS = 'true';
    assert.equal(metodosPagoPublicos(5)[0].disponible, true);
    const config = JSON.parse(process.env.PAGOS_PROVEEDORES_JSON); config[5].TARJETA.pais = 'BO';
    process.env.PAGOS_PROVEEDORES_JSON = JSON.stringify(config);
    assert.equal(metodosPagoPublicos(5)[0].disponible, false);
    assert.doesNotMatch(JSON.stringify(metodosPagoPublicos(5)), /secretKey|clientSecret|sk_live|merchantId/);
});

test('Operaciones transaccionales de pagos sin MySQL ni solicitudes financieras', async t => {
    configurar(t); simularAuditoriaNegocio(t);
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('No se autoriza MySQL'); });
    t.mock.method(globalThis, 'fetch', () => { throw new Error('No se autorizan solicitudes externas'); });
    let estado, txActual, cola = Promise.resolve(), llamadas = 0, fallo, falloPersistencia;
    const inicial = () => ({ compra: { id_compra: 10, id_proveedor_laboratorio: 5, total: '100.00', estado_operacion: 'CONFIRMADA' }, pagos: [] });
    const reset = () => { estado = inicial(); llamadas = 0; fallo = undefined; falloPersistencia = false; };
    reset();
    t.mock.method(db.sequelize, 'transaction', async (options, callback) => {
        const operacion = callback || options;
        const anterior = cola; let liberar; cola = new Promise(resolve => { liberar = resolve; });
        await anterior;
        const pendiente = structuredClone(estado), transaction = { LOCK: { UPDATE: 'UPDATE' } };
        txActual = { pendiente, transaction };
        try { const result = await operacion(transaction); estado = pendiente; transaction.finished = 'commit'; return result; }
        catch (error) { transaction.finished = 'rollback'; throw error; }
        finally { txActual = undefined; liberar(); }
    });
    const vista = transaction => { assert.equal(transaction, txActual.transaction); return txActual.pendiente; };
    t.mock.method(compras, 'findById', async (idCompra, { transaction } = {}) => structuredClone((transaction ? vista(transaction) : estado).compra));
    t.mock.method(compras, 'findParaAnular', async ({ transaction }) => structuredClone(vista(transaction).compra));
    t.mock.method(pagos, 'findByClave', async ({ claveOperacion, transaction }) => vista(transaction).pagos.find(p => p.clave_operacion === claveOperacion));
    t.mock.method(pagos, 'findById', async ({ idPago, idCompra, transaction }) => structuredClone(vista(transaction).pagos.find(p => p.id_pago === idPago && p.id_compra === idCompra)));
    t.mock.method(pagos, 'findAll', async ({ transaction }) => structuredClone(vista(transaction).pagos));
    t.mock.method(pagos, 'findHistorial', async ({ transaction }) => structuredClone(vista(transaction).pagos));
    t.mock.method(pagos, 'findComprometido', async ({ transaction }) => vista(transaction).pagos.find(p => p.estado !== 'RECHAZADO'));
    t.mock.method(pagos, 'create', async ({ data, transaction }) => {
        const p = { id_pago: vista(transaction).pagos.length + 1, id_externo: null, referencia_externa: null,
            url_pago: null, url_comprobante: null, fecha_verificacion: null, fecha_confirmacion: null, resultado_proveedor: null, ...data };
        vista(transaction).pagos.push(p); return p;
    });
    t.mock.method(pagos, 'update', async ({ idPago, data, transaction }) => {
        if (falloPersistencia) throw new Error('Persistencia interrumpida');
        Object.assign(vista(transaction).pagos.find(p => p.id_pago === idPago), data); return [1];
    });
    const crear = async (config, pago) => {
        llamadas++;
        assert.equal(estado.pagos.find(p => p.id_pago === pago.id_pago).estado, 'PENDIENTE', 'La reserva ya debe estar confirmada antes de la petición remota');
        if (fallo) throw new Error(fallo);
        return { id_externo: 'cs_live_fixture', estado: 'PROCESANDO', resultado_proveedor: 'OPEN', url_pago: 'https://checkout.stripe.com/c/pay/fixture' };
    };
    t.mock.method(pagosPasarela, 'crear', crear);
    t.mock.method(pagosPasarela, 'consultar', async () => ({ estado: 'CONFIRMADO', resultado_proveedor: 'SUCCEEDED', referencia_externa: 'pi_fixture', url_pago: null }));
    const iniciar = (extra = {}) => service.iniciar(10, entrada(extra), 1);

    await t.test('Un inicio reserva, mantiene recepción y no almacena información de tarjetas', async () => {
        reset(); const pago = await iniciar();
        assert.equal(pago.estado, 'PROCESANDO'); assert.equal(estado.compra.estado_operacion, 'CONFIRMADA');
        const resumen = await service.consultar(10);
        assert.equal(resumen.importeReservado, '40.00'); assert.equal(resumen.totalPagado, '0.00'); assert.equal(resumen.saldoDisponible, '60.00');
        assert.doesNotMatch(JSON.stringify(pago), /cuenta_destino|secret|cvv|numeroTarjeta/);
    });
    await t.test('El mismo contenido y clave reutiliza el intento sin crear otro', async () => {
        reset(); await iniciar(); await iniciar(); assert.equal(estado.pagos.length, 1); assert.equal(llamadas, 1);
        await assert.rejects(iniciar({ importe: '20.00' }), /otros datos/);
    });
    await t.test('Doble envío concurrente con claves distintas no excede el saldo ni abre dos operaciones', async () => {
        reset(); const results = await Promise.allSettled([iniciar({ importe: '80.00' }), iniciar({ claveOperacion: 'pago-fixture-otra-002', importe: '80.00' })]);
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(estado.pagos.length, 1); assert.equal(llamadas, 1);
    });
    await t.test('Sobrepago y compra anulada no contactan la pasarela', async () => {
        reset(); await assert.rejects(iniciar({ importe: '100.01' }), /superar/); assert.equal(llamadas, 0); assert.equal(estado.pagos.length, 0);
        estado.compra.estado_operacion = 'ANULADA'; await assert.rejects(iniciar(), /anulada/); assert.equal(llamadas, 0);
    });
    await t.test('Un timeout deja la reserva, bloquea otro intento y permite recuperar con la misma clave', async () => {
        reset(); fallo = 'Timeout incierto'; await assert.rejects(iniciar(), /Timeout/);
        assert.equal(estado.pagos[0].estado, 'PENDIENTE'); assert.equal(estado.pagos[0].id_externo, null);
        fallo = undefined; await assert.rejects(iniciar({ claveOperacion: 'pago-fixture-distinta-003' }), /pendiente/);
        await iniciar(); assert.equal(estado.pagos.length, 1); assert.equal(llamadas, 2);
    });
    await t.test('Fallo de persistencia después de respuesta externa conserva la reserva para recuperación idempotente', async () => {
        reset(); falloPersistencia = true; await assert.rejects(iniciar(), /Persistencia/);
        assert.equal(estado.pagos[0].estado, 'PENDIENTE'); falloPersistencia = false;
        await iniciar(); assert.equal(estado.pagos.length, 1); assert.equal(llamadas, 2);
    });
    await t.test('Una reserva antigua sin ID externo no puede recrearse fuera de la ventana segura', async () => {
        reset(); fallo = 'Caída'; await assert.rejects(iniciar()); fallo = undefined;
        estado.pagos[0].fecha_registro = obtenerFechaOperacion(new Date(Date.now() - 7 * 3600000)).fechaHoraComercial;
        await assert.rejects(service.verificar(10, 1, false), /conciliación/); assert.equal(llamadas, 1);
        await service.verificar(10, 1, false, undefined, 'cs_live_recuperada');
        assert.equal(estado.pagos[0].estado, 'CONFIRMADO'); assert.equal(estado.pagos[0].id_externo, 'cs_live_recuperada');
        assert.equal(llamadas, 1, 'Conciliar no crea otra transacción');
    });
    await t.test('Confirmación repetida aplica el pago solo una vez y permite completar el saldo', async () => {
        reset(); await iniciar(); await service.verificar(10, 1, false); await service.verificar(10, 1, false);
        assert.equal((await service.consultar(10)).totalPagado, '40.00');
        await iniciar({ claveOperacion: 'pago-fixture-restante-004', importe: '60.00' });
        await service.verificar(10, 2, false); const resumen = await service.consultar(10);
        assert.equal(resumen.totalPagado, '100.00'); assert.equal(resumen.saldoPendiente, '0.00'); assert.equal(resumen.estadoFinanciero, 'PAGADO');
        await assert.rejects(iniciar({ claveOperacion: 'pago-fixture-exceso-005', importe: '0.01' }), /superar/);
    });
    await t.test('La auditoría fallida impide persistir una confirmación y conserva la reserva', async () => {
        reset(); await iniciar();
        const original = bitacoraAuditoriaService.registrarCambio;
        const mock = t.mock.method(bitacoraAuditoriaService, 'registrarCambio', async () => { throw new Error('Auditoría interrumpida'); });
        await assert.rejects(service.verificar(10, 1, false), /Auditoría/); assert.equal(estado.pagos[0].estado, 'PROCESANDO');
        mock.mock.restore(); assert.equal(bitacoraAuditoriaService.registrarCambio, original);
    });
    await t.test('Sin cotización explícita PayPal no inicia ni reserva', async () => {
        reset(); await assert.rejects(iniciar({ metodo: 'PAYPAL' }), /acordados/); assert.equal(estado.pagos.length, 0);
    });
    await t.test('Las reservas y los pagos confirmados bloquean anulación antes de tocar inventario', async () => {
        reset(); await iniciar();
        await assert.rejects(compraService.anularCompra(10, 'Corrección', 1), /conciliación financiera/);
        await service.verificar(10, 1, false);
        await assert.rejects(compraService.anularCompra(10, 'Corrección', 1), /conciliación financiera/);
    });
});
