import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname, resolve } from 'node:path';
import { abrirNavegadorReal } from './helpers/navegadorReal.mjs';
import { build } from 'vite';

// React y navegador reales; API con fixtures exclusivamente en memoria.
// No conecta al backend de uso, MySQL ni a ninguna cuenta de las pasarelas.
test('Compras: pagos responsive, parciales, historial, confirmación expresa y roles', { timeout: 90000 }, async t => {
  const carpeta = fileURLToPath(new URL('../../.pagos-tests/', import.meta.url));
  await mkdir(carpeta, { recursive: true });
  const profile = await mkdtemp(join(carpeta, 'browser-'));
  const dist = join(profile, 'app');
  await build({ root: fileURLToPath(new URL('../', import.meta.url)), logLevel: 'error',
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') }, build: { outDir: dist, emptyOutDir: true } });
  let rol = 1, disponible = false, estadoPago = null, redIncierta = false, pagos = [], inicios = 0, confirmaciones = 0;
  const compra = { idCompra: 10, idUsuario: 1, idProveedorLaboratorio: 5, estadoOperacion: 'CONFIRMADA',
    fechaCompra: '2026-11-01', fechaRegistro: '2026-11-01 10:00:00', claveOperacion: 'compra-existente', total: '100.00',
    proveedorLaboratorio: { idProveedorLaboratorio: 5, nombre: 'Laboratorio receptor', estado: true }, usuarioRegistrador: { nombreUsuario: 'administrador' },
    detalles: [{ idDetalleCompra: 1, cantidad: 10, costoUnitario: '10.000000', subtotal: '100.00',
      existencia: { idExistencia: 1, codigoExistencia: 'PAR001-001', fechaVencimiento: '2027-12-31', precisionVencimiento: 'MES',
        medicamento: { nombreComercial: 'Paracetamol', codigoMedicamento: 'PAR001', presentacion: 'Tabletas', unidadInventario: 'tableta' } } }] };
  const centavos = valor => BigInt(valor.replace('.', ''));
  const decimal = valor => `${valor / 100n}.${String(valor % 100n).padStart(2, '0')}`;
  const resumen = () => {
    const abonado = pagos.filter(p => p.estado === 'CONFIRMADO').reduce((s, p) => s + centavos(p.importe), 0n);
    const reservado = pagos.filter(p => ['PENDIENTE', 'PROCESANDO'].includes(p.estado)).reduce((s, p) => s + centavos(p.importe), 0n);
    return { moneda: 'BOB', total: '100.00', totalPagado: decimal(abonado), saldoPendiente: decimal(10000n - abonado),
      importeReservado: decimal(reservado), saldoDisponible: decimal(10000n - abonado - reservado),
      estadoFinanciero: reservado ? 'PROCESANDO' : abonado === 10000n ? 'PAGADO' : abonado ? 'PARCIAL' : 'PENDIENTE',
      pagos, metodos: ['TARJETA', 'PAYPAL'].map(metodo => ({ metodo, disponible, moneda: metodo === 'TARJETA' ? 'BOB' : 'USD',
        requiereCotizacion: metodo === 'PAYPAL', mensaje: 'El método de pago no está disponible para este laboratorio.' })) };
  };
  const requests = [], erroresServidor = [];
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path.startsWith('/api/')) {
        let raw = ''; for await (const chunk of req) raw += chunk;
        const body = raw ? JSON.parse(raw) : null; requests.push({ path, method: req.method, body });
        res.setHeader('Content-Type', 'application/json');
        const responder = data => res.end(JSON.stringify({ data }));
        if (path === '/api/auth/me') return responder({ idUsuario: rol, idRol: rol, nombreUsuario: 'administrador' });
        if (path === '/api/compras/10') return responder(compra);
        const comprobante = path.match(/^\/api\/compras\/10\/pagos\/(\d+)\/comprobante$/);
        if (comprobante) {
          const pago = pagos.find(p => p.idPago === Number(comprobante[1]));
          return responder({ titulo: 'Comprobante de pago', numero: `PAGO-${pago.idPago}`, datos: [['Referencia', pago.referenciaExterna]], columnas: [], filas: [], totales: [['Importe pagado', `${pago.importe.replace('.', ',')} BOB`]], notas: [] });
        }
        if (path === '/api/compras/10/pagos' && req.method === 'GET') return responder(resumen());
        if (path === '/api/compras/10/pagos' && req.method === 'POST') {
          inicios++;
          const pago = { idPago: pagos.length + 1, idCompra: 10, idUsuario: 1, ...body, moneda: 'BOB', monedaPasarela: body.metodo === 'TARJETA' ? 'BOB' : 'USD',
            importePasarela: body.importePasarela || body.importe, estado: 'PROCESANDO', fecha: '2026-11-21 12:00:00',
            urlPago: body.metodo === 'TARJETA' ? 'https://checkout.stripe.com/c/pay/fixture' : 'https://www.paypal.com/checkoutnow?token=FIXTURE',
            resultadoProveedor: 'OPEN', administrador: { nombreUsuario: 'administrador' } };
          pagos.push(pago);
          if (redIncierta) {
            redIncierta = false; pago.estado = 'PENDIENTE'; pago.urlPago = null; pago.permiteConciliacion = true;
            res.statusCode = 502; return res.end(JSON.stringify({ message: 'No se pudo verificar el resultado externo.' }));
          }
          return responder(pago);
        }
        const accion = path.match(/^\/api\/compras\/10\/pagos\/(\d+)\/(verificar|confirmar|conciliar)$/);
        if (accion) {
          const pago = pagos.find(p => p.idPago === Number(accion[1]));
          if (accion[2] === 'confirmar') confirmaciones++;
          Object.assign(pago, { estado: estadoPago || 'CONFIRMADO', urlPago: null,
            resultadoProveedor: estadoPago === 'PROCESANDO' ? 'APPROVED' : 'COMPLETED',
            ...(estadoPago === 'PROCESANDO' ? {} : { referenciaExterna: 'REFERENCIA_VERIFICADA', fechaConfirmacion: '2026-11-21 12:05:00', fechaVerificacion: '2026-11-21 12:05:00' }) });
          return responder(pago);
        }
        res.statusCode = 404; return res.end(JSON.stringify({ message: 'No encontrado' }));
      }
      const file = resolve(dist, `.${path.startsWith('/assets/') ? path : '/index.html'}`);
      assert.ok(file.startsWith(dist));
      res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.html': 'text/html' }[extname(file)] || 'application/octet-stream');
      res.end(await readFile(file));
    } catch (error) { erroresServidor.push(error); res.statusCode = 500; res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await abrirNavegadorReal({ profile, origin, apiUrl: `${origin}/api` });
    const page = await browser.openSession('pagos');
    const cargar = async () => { await page.navigate('/compras/10'); await page.contains('Pagos al laboratorio'); await page.contains('Disponible para pagar'); };
    await t.test('Solo dos métodos; no disponibles sin habilitación y sin formularios de tarjeta locales', async () => {
      await cargar(); await page.clickText('Pagar'); await page.contains('No disponible');
      assert.equal(await page.evaluate('document.querySelectorAll(".pago-metodo").length'), 2);
      assert.ok(await page.evaluate('document.querySelector(".pago-form button[type=submit]").disabled'));
      assert.equal(await page.evaluate('!!document.querySelector("input[name=cardNumber],input[name=cvv]")'), false);
      assert.doesNotMatch(await page.evaluate('document.getElementById("pagos").textContent'), /simulaci[oó]n|demo|prueba|ficticio/i);
    });
    await t.test('Abono parcial: revisión obligatoria, doble clic no duplica y reserva sin confirmar', async () => {
      disponible = true; await cargar(); await page.clickText('Pagar'); await page.field('#pago-importe', '40.00');
      await page.click('.pago-autorizacion input'); await page.review('.pago-form');
      await page.evaluate('const boton=document.querySelector(".modal__actions .button--primary");boton.click();boton.click();');
      await page.contains('Verificar estado'); assert.equal(inicios, 1); assert.equal(pagos[0].importe, '40.00');
      assert.ok(await page.evaluate('document.querySelector(".pago-resumen").textContent.includes("0,00 BOB")'));
      assert.equal(pagos[0].estado, 'PROCESANDO'); assert.equal(compra.estadoOperacion, 'CONFIRMADA');
    });
    await t.test('Verificación, saldo parcial, referencia y comprobante', async () => {
      await page.clickText('Verificar estado'); await page.contains('Pago parcial');
      await page.clickText('Ver comprobante'); await page.contains('REFERENCIA_VERIFICADA');
      assert.ok(await page.evaluate('document.querySelector("[role=dialog]").textContent.includes("40,00 BOB")'));
      await page.click('button[aria-label="Cerrar ventana"]');
    });
    await t.test('PayPal exige importe acordado; autorización no captura hasta confirmar expresamente', async () => {
      await page.clickText('Pagar'); await page.click('input[value=PAYPAL]');
      await page.field('#pago-cotizado', '8.00'); await page.field('#pago-referencia', 'Acuerdo del laboratorio');
      await page.click('.pago-autorizacion input'); await page.review('.pago-form'); await page.click('.modal__actions .button--primary');
      await page.contains('Verificar estado'); estadoPago = 'PROCESANDO';
      await page.clickText('Verificar estado'); await page.contains('Confirmar envío PayPal'); assert.equal(confirmaciones, 0);
      await page.clickText('Confirmar envío PayPal'); await page.contains('Autorizar envío de fondos');
      estadoPago = null; await page.clickText('Autorizar envío de fondos'); await page.contains('Pagada');
      assert.equal(confirmaciones, 1); assert.equal(resumen().saldoPendiente, '0.00');
    });
    await t.test('Respuesta incierta mantiene el intento visible y no inventa confirmación', async () => {
      pagos = []; redIncierta = true; await cargar(); await page.clickText('Pagar');
      await page.click('.pago-autorizacion input'); await page.review('.pago-form'); await page.click('.modal__actions .button--primary');
      await page.contains('No fue posible confirmar el resultado'); await page.contains('Verificar estado');
      assert.equal(pagos.length, 1); assert.equal(pagos[0].estado, 'PENDIENTE');
    });
    await t.test('Conciliación de referencia recuperada consulta sin iniciar ni capturar otro pago', async () => {
      const count = inicios, capturas = confirmaciones;
      await page.clickText('Conciliar referencia'); await page.contains('Identificador de la sesión u orden');
      await page.field('#pago-referencia-recuperada', 'cs_live_recuperada'); await page.clickText('Consultar referencia');
      await page.contains('Pagada'); assert.equal(inicios, count); assert.equal(confirmaciones, capturas);
    });
    await t.test('375 px sin desbordamiento y tabla desplazable', async () => {
      await page.mobile(); await page.settle();
      assert.ok(await page.evaluate('document.documentElement.scrollWidth <= 375'));
      await page.evaluate('document.querySelector("#pagos .catalogo-table-wrap").scrollLeft=150');
      assert.ok(await page.evaluate('document.querySelector("#pagos .catalogo-table-wrap").scrollLeft>0'));
    });
    await t.test('Regente conserva consulta de compras sin acceder a pagos; Vendedor no accede', async () => {
      const count = requests.filter(r => r.path.includes('/pagos')).length;
      rol = 2; await page.navigate('/compras/10'); await page.ready();
      assert.equal(await page.evaluate('!!document.getElementById("pagos")'), false);
      rol = 3; await page.navigate('/compras/10'); await page.wait('location.pathname === "/dashboard"');
      assert.equal(requests.filter(r => r.path.includes('/pagos')).length, count);
    });
    assert.deepEqual(browser.errors, []); assert.deepEqual(erroresServidor, []);
  } finally {
    await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
