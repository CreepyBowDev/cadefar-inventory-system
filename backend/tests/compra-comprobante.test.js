import test from 'node:test';
import assert from 'node:assert/strict';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'comprobantes_sin_conexion';
const { default: db } = await import('../src/data/models/index.js');
const { compraService } = await import('../src/business/services/compra.service.js');
const { pagoCompraService } = await import('../src/business/services/pago-compra.service.js');
const { compraComprobanteService } = await import('../src/business/services/compra-comprobante.service.js');
const { generarComprobantePdf } = await import('../src/shared/utils/compra-comprobante-pdf.js');

test('Comprobantes: snapshot común, importes exactos, pagos confirmados y PDF A4 multipágina', async t => {
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('MySQL prohibido'); });
    const transaction = {};
    t.mock.method(db.sequelize, 'transaction', async (opciones, callback) => {
        assert.equal(opciones.isolationLevel, 'REPEATABLE READ'); return callback(transaction);
    });
    const compra = { idCompra: 7, total: '100.00', fechaCompra: '2026-11-22', estadoOperacion: 'CONFIRMADA', proveedorLaboratorio: { nombre: 'Laboratorio Ñandú · PRUEBA_LOCAL' },
        detalles: [{ idDetalleCompra: 9, cantidad: 3, costoUnitario: '0.123456', subtotal: '0.37', existencia: { codigoExistencia: 'PAR-001', medicamento: { nombreComercial: 'Paracetamol', presentacion: '500 mg' } } }] };
    const pago = { idPago: 11, idCompra: 7, idUsuario: 1, importe: '40.00', moneda: 'BOB', importePasarela: '40.00', monedaPasarela: 'BOB', estado: 'CONFIRMADO', metodo: 'TARJETA', fechaConfirmacion: '2026-11-22 13:25:45', referenciaExterna: 'PRUEBA_LOCAL_REF_11', esPrueba: true };
    const resumen = { totalPagado: '40.00', saldoPendiente: '60.00', moneda: 'BOB', esPrueba: true, pagos: [pago] };
    t.mock.method(compraService, 'getCompraById', async (id, tx) => { assert.equal(id, 7); assert.equal(tx, transaction); return compra; });
    t.mock.method(pagoCompraService, 'consultar', async (id, options) => { assert.equal(id, 7); assert.equal(options.transaction, transaction); return resumen; });
    let documento;
    await t.test('Compra usa saldos existentes y conserva seis decimales sin recalcular detalles', async () => {
        documento = await compraComprobanteService.consultar(7);
        assert.equal(documento.filas[0][2], '0,123456 BOB');
        assert.deepEqual(documento.totales, [['Total de la compra', '100,00 BOB'], ['Importe abonado', '40,00 BOB'], ['Saldo pendiente', '60,00 BOB']]);
        assert.equal(documento.datos[1][1], 'Laboratorio Ñandú');
        assert.match(documento.notas[0], /No representa una transferencia real/);
    });
    for (const metodo of ['TARJETA', 'PAYPAL']) await t.test(`${metodo}: referencia interna, fecha civil y saldo explícitamente vigente`, async () => {
        pago.metodo = metodo;
        const doc = await compraComprobanteService.consultar(7, 11);
        const texto = JSON.stringify(doc);
        assert.match(texto, /LOCAL-11/); assert.match(texto, /22\/11\/2026 13:25:45/);
        assert.match(texto, /Saldo restante al consultar/); assert.doesNotMatch(texto, /password|cvv|cuenta_destino|id_externo/);
        const pdf = await generarComprobantePdf(doc);
        assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
        const parsed = await getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise;
        try {
            assert.equal(parsed.numPages, 1, 'Un comprobante corto no debe crear páginas vacías');
            const page = await parsed.getPage(1), viewport = page.getViewport({ scale: 1 });
            assert.ok(Math.abs(viewport.width - 595.28) < .1 && Math.abs(viewport.height - 841.89) < .1);
            const text = (await page.getTextContent()).items.map(i => i.str).join(' ');
            for (const valor of ['CADEFAR', 'PAGO-11', 'LOCAL-11', '60,00 BOB', 'Prueba local', metodo === 'PAYPAL' ? 'PayPal' : 'Tarjeta']) assert.ok(text.includes(valor), valor);
        } finally { await parsed.cleanup(); }
    });
    await t.test('No emite comprobantes de intentos no confirmados ni de otra compra', async () => {
        for (const estado of ['PENDIENTE', 'PROCESANDO', 'RECHAZADO']) {
            pago.estado = estado;
            await assert.rejects(compraComprobanteService.consultar(7, 11), e => e.statusCode === 409);
        }
        await assert.rejects(compraComprobanteService.consultar(7, 99), e => e.statusCode === 404);
    });
    await t.test('PDF con muchos detalles y textos largos no pierde el final ni cambia los importes', async () => {
        const largo = { ...documento, filas: Array.from({ length: 90 }, (_, i) => [`Medicamento ${i + 1} · ${'descripción extensa '.repeat(6)}`, '3', '0,123456 BOB', '0,37 BOB']) };
        const parsed = await getDocument({ data: new Uint8Array(await generarComprobantePdf(largo)), useSystemFonts: true }).promise;
        try {
            assert.ok(parsed.numPages > 2);
            let texto = '';
            for (let i = 1; i <= parsed.numPages; i++) texto += (await (await parsed.getPage(i)).getTextContent()).items.map(v => v.str).join(' ');
            assert.match(texto, /Medicamento 90/); assert.match(texto, /Saldo pendiente/); assert.match(texto, /60,00 BOB/);
            assert.match(texto, /0,123456 BOB/);
        } finally { await parsed.cleanup(); }
    });
});
