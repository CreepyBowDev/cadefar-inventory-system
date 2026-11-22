import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegadorReal } from './helpers/navegadorReal.mjs';

test('Administrador: pagos locales de extremo a extremo en React/Express/MySQL, puertos 5173/3000', {
  skip: process.env.CADEFAR_AUTORIZAR_PAGOS_LOCAL !== '1', timeout: 120000
}, async t => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const backend = fileURLToPath(new URL('../../backend/', import.meta.url));
  const require = createRequire(join(backend, 'package.json'));
  const dotenv = require('dotenv');
  dotenv.config({ path: join(backend, '.env'), quiet: true });
  dotenv.config({ path: join(backend, '.env.pagos-pruebas'), override: true, quiet: true });
  const { default: entorno } = await import('../../backend/src/shared/utils/pagos-entorno.cjs');
  assert.equal(entorno.esPruebaLocal(), true);
    const { default: db } = await import('../../backend/src/data/models/index.js');
    assert.equal(db.sequelize.config.database, entorno.BASE_PRUEBAS);
    const [baseActiva] = await db.sequelize.query('SELECT DATABASE() AS nombre', { logging: false });
    assert.equal(baseActiva[0].nombre, entorno.BASE_PRUEBAS);
  const { app } = await import('../../backend/src/app.js');
  const { obtenerFechaOperacion } = await import('../../backend/src/shared/utils/fecha-operacion.js');
  const profile = await mkdtemp(join(process.env.LOCALAPPDATA, 'Temp', 'opencode', 'cadefar-pagos-browser-'));
  // Permite verificar el servidor local ya abierto sin detenerlo ni cambiar su puerto.
  const server = process.env.CADEFAR_TEST_SERVIDOR_EXISTENTE === '1' ? null : app.listen(3000, '127.0.0.1');
  if (server) await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const fetchReal = globalThis.fetch;
  let externalCalls = 0;
  t.mock.method(globalThis, 'fetch', (url, options) => {
    const parsed = new URL(url);
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !['3000', '5173'].includes(parsed.port)) {
      externalCalls++; throw new Error('Se prohíbe acceso externo');
    }
    return fetchReal(url, options);
  });
  const suffix = randomBytes(6).toString('hex');
  let browser;
  try {
    const usuario = await db.Usuario.findOne({ where: { nombre_usuario: 'admin_demo' },
      attributes: ['id_usuario', 'id_rol', 'nombre_usuario', 'estado', 'version_credenciales'], logging: false });
    assert.ok(usuario?.estado && usuario.id_rol === 1);
    const { generarToken } = await import('../../backend/src/shared/utils/jwt.js');
    browser = await abrirNavegadorReal({ profile, origin: 'http://localhost:5173', apiUrl: 'http://localhost:3000/api' });
    const page = await browser.openSession('administrador-pagos-locales');
    await page.viewport(1280, 1000);
    // Fixture de sesión únicamente de esta regresión. La aceptación de login
    // se realiza aparte con formulario real y contraseña introducida por su titular.
    await page.restoreSessionCookie(generarToken({ idUsuario: usuario.id_usuario, idRol: usuario.id_rol, versionCredenciales: usuario.version_credenciales }));
    await page.navigate('/compras');
    const sesion = await page.request('GET', '/auth/me');
    assert.equal(sesion.status, 200); assert.equal(sesion.body.data.esPrueba, true);
    await page.initScript(`window.__pagoProcesando = false; new MutationObserver(() => { if (document.querySelector('.pago-procesamiento')) window.__pagoProcesando = true; }).observe(document, { childList: true, subtree: true });`);
    await page.navigate('/compras');
    await page.contains('Local');
    const medicamento = await db.Medicamento.findOne({ where: { codigo_medicamento: 'PRU001' } });
    let sequence = 0;
    const nuevaCompra = async () => {
      const r = await page.request('POST', '/compras', { claveOperacion: `browser-${suffix}-${++sequence}`,
        fechaCompra: obtenerFechaOperacion().fechaComercial, detalles: [{ idMedicamento: medicamento.id_medicamento,
          cantidad: 10, costoUnitario: '50.000000', precisionVencimiento: 'DIA', fechaVencimiento: '2099-12-31' }] });
      assert.equal(r.status, 201); assert.equal(r.body.data.total, '500.00');
      await page.navigate('/compras'); await page.contains('Compras');
      await page.wait(`!!document.querySelector('a[href="/compras/${r.body.data.idCompra}"]')`);
      await page.click(`a[href="/compras/${r.body.data.idCompra}"]`); await page.contains('Disponible para pagar');
      return r.body.data.idCompra;
    };
    const iniciar = async (importe, metodo = 'TARJETA') => {
      await page.clickText('Pagar'); await page.field('#pago-importe', importe);
      assert.equal(await page.evaluate('/PRUEBA_LOCAL|Entorno de pruebas|Operación ficticia/.test(document.querySelector(".pago-form").textContent)'), false);
      if (metodo === 'PAYPAL') await page.click('input[value=PAYPAL]');
      await page.click('.pago-autorizacion input'); await page.review('.pago-form');
      await page.click('.modal__actions .button--primary');
      try { await page.contains(metodo === 'TARJETA' ? 'Número de tarjeta' : 'Revisa el importe y autoriza'); }
      catch (error) {
        t.diagnostic(JSON.stringify({ ui: await page.evaluate('document.querySelector("#pagos")?.textContent'),
          network: browser.requests.filter(r => r.path.includes('/pagos')).slice(-5).map(r => ({ method: r.method, status: r.status, response: r.response })) }));
        throw error;
      }
      await page.wait('document.querySelector(".pago-autorizacion-local")?.getAttribute("aria-busy") === "false"');
      assert.equal(await page.evaluate('!!document.querySelector(".pago-datos-prueba")'), false);
      assert.equal(await page.evaluate('/PRUEBA_LOCAL|TITULAR DE PRUEBA|Datos de prueba disponibles/.test(document.querySelector(".pago-autorizacion-local").textContent)'), false);
      assert.equal(await page.evaluate('!!document.querySelector(".pago-autorizacion-local input[type=email],.pago-autorizacion-local input[type=password]:not(#tarjeta-cvv)")'), false);
    };
    const datosEnviados = [];
    const autorizar = async (decision = 'APROBAR') => {
      await page.wait('!!document.querySelector(".pago-autorizacion-local .button--primary") && !document.querySelector(".pago-autorizacion-local .button--primary").disabled');
      if (decision === 'CANCELAR') await page.clickText('Cancelar pago');
      else {
        if (await page.evaluate('!!document.querySelector("#tarjeta-numero")')) {
          const datos = [
            { titular: 'Ana Ejemplo', numero: '1234567890123', vencimiento: '07/35', cvv: '314' },
            { titular: 'José Prueba-López', numero: '1234567890123456789', vencimiento: '06/32', cvv: '5926' }
          ][datosEnviados.length % 2];
          for (const [campo, valor] of Object.entries(datos)) await page.field(`#tarjeta-${campo}`, valor);
          datosEnviados.push(datos);
        }
        await page.click('.pago-opciones-local summary'); await page.select('#pago-decision-local', decision);
        // Dos clics síncronos deben producir una única autorización persistida.
        await page.evaluate('(() => { const b=document.querySelector(".pago-autorizacion-local button[type=submit]"); b.click(); b.click(); })()');
      }
      await page.contains(decision === 'CANCELAR' ? 'Pago cancelado' : decision === 'RECHAZAR' ? 'Pago rechazado' : decision === 'PENDIENTE' ? 'Pendiente de revisión' : await page.evaluate('document.querySelector("#modal-title")?.textContent === "Pago con tarjeta"') ? 'Autorización aprobada' : 'Pago autorizado');
      await page.wait('document.querySelector(".pago-autorizacion-local")?.getAttribute("aria-busy") === "false"');
      await page.wait('document.querySelector("#pagos")?.getAttribute("aria-busy") === "false"');
      assert.equal(await page.evaluate('window.__pagoProcesando'), true);
    };
    const cerrar = async () => { await page.clickText('Volver al historial'); await page.wait('!document.querySelector(".pago-autorizacion-local")'); };
    await t.test('Compra, tarjeta 200, comprobante, PayPal 300, confirmación expresa y saldo final 0', async () => {
      const id = await nuevaCompra(); await iniciar('200.00');
      await page.screenshot('tarjeta-formulario-desktop.png');
      const requestsAntes = browser.requests.filter(r => r.method === 'POST' && r.path.endsWith('/autorizar-prueba')).length;
      await page.click('.pago-autorizacion-local button[type=submit]'); await page.contains('Ingresa el nombre del titular');
      assert.equal(browser.requests.filter(r => r.method === 'POST' && r.path.endsWith('/autorizar-prueba')).length, requestsAntes);
      await page.field('#tarjeta-numero', 'texto'); await page.contains('Usa únicamente dígitos');
      assert.equal(await page.evaluate('document.querySelector("#tarjeta-numero").value'), '');
      await page.mobile(); await page.settle(); await page.screenshot('tarjeta-formulario-mobile.png');
      assert.ok(await page.evaluate('document.documentElement.scrollWidth <= 375 && document.querySelector(".modal").scrollWidth <= document.querySelector(".modal").clientWidth'));
      await page.viewport(1280); await autorizar();
      assert.equal(browser.requests.filter(r => r.method === 'POST' && r.path.endsWith('/autorizar-prueba')).length, requestsAntes + 1);
      const antesVerificar = await page.request('GET', `/compras/${id}/pagos`);
      assert.equal(antesVerificar.body.data.totalPagado, '0.00'); assert.equal(antesVerificar.body.data.importeReservado, '200.00');
      assert.equal(antesVerificar.body.data.pagos.length, 1, 'Dos clics no crean dos pagos persistidos');
      const idPago = antesVerificar.body.data.pagos[0].idPago;
      const [auditoria] = await db.sequelize.query("SELECT COUNT(*) AS cantidad FROM bitacora_auditoria WHERE tipo_evento='PAGO_COMPRA_AUTORIZAR_PRUEBA' AND id_registro=:id AND resultado='EXITO'", { replacements: { id: idPago } });
      assert.equal(Number(auditoria[0].cantidad), 1, 'Una única autorización efectiva queda auditada');
      await page.clickText('Verificar pago'); await page.contains('Pago confirmado'); await page.contains('Pago parcial');
      const parcial = await page.request('GET', `/compras/${id}/pagos`);
      assert.equal(parcial.body.data.saldoPendiente, '300.00');
      await page.click('.pago-autorizacion-local .button--primary'); await page.contains('Comprobante de prueba');
      await page.contains('Documento local sin valor bancario ni fiscal.'); await page.contains('LOCAL-'); await page.click('button[aria-label="Cerrar ventana"]');
      await iniciar('300.00', 'PAYPAL'); await page.screenshot('paypal-autorizacion-desktop.png');
      await page.mobile(); await page.settle(); await page.screenshot('paypal-autorizacion-mobile.png');
      assert.ok(await page.evaluate('document.documentElement.scrollWidth <= 375 && document.querySelector(".modal").scrollWidth <= document.querySelector(".modal").clientWidth'));
      await page.viewport(1280); await autorizar();
      assert.equal((await page.request('GET', `/compras/${id}/pagos`)).body.data.saldoPendiente, '300.00');
      await page.click('.pago-autorizacion-local button.button--secondary:nth-last-child(2)');
      await page.wait('document.querySelector(".pago-autorizacion-local")?.getAttribute("aria-busy") === "false"');
      assert.equal((await page.request('GET', `/compras/${id}/pagos`)).body.data.saldoPendiente, '300.00', 'Verificar PayPal no confirma ni descuenta fondos');
      await page.clickText('Confirmar operación'); await page.contains('Pago confirmado');
      await page.contains('Pagada'); assert.equal((await page.request('GET', `/compras/${id}/pagos`)).body.data.saldoPendiente, '0.00');
      await page.click('.pago-autorizacion-local .button--primary'); await page.contains('Comprobante de prueba');
      await page.screenshot('paypal-comprobante.png'); await page.click('button[aria-label="Cerrar ventana"]');
      await page.navigate(`/compras/${id}`); await page.contains('Pagada');
      assert.equal(await page.evaluate('document.querySelectorAll(".pago-table tbody tr").length'), 2);
      await page.mobile(); await page.settle();
      assert.ok(await page.evaluate('document.documentElement.scrollWidth <= 375'));
      await page.viewport(1280);
    });
    await t.test('Rechazo y cancelación visibles; no se aplica abono', async () => {
      const id = await nuevaCompra();
      for (const metodo of ['TARJETA', 'PAYPAL']) for (const decision of ['RECHAZAR', 'CANCELAR']) {
        await iniciar('100.00', metodo); await autorizar(decision); await cerrar();
      }
      const r = await page.request('GET', `/compras/${id}/pagos`); assert.equal(r.body.data.totalPagado, '0.00'); assert.equal(r.body.data.saldoDisponible, '500.00');
      assert.equal(r.body.data.pagos.length, 4);
      await page.contains('Cancelado'); await page.contains('Rechazado');
    });
    await t.test('Pendiente de revisión, recarga y continuación de autorización sin perder la reserva', async () => {
      const id = await nuevaCompra(); await iniciar('200.00'); await autorizar('PENDIENTE'); await cerrar(); await page.clickText('Verificar estado');
      await page.navigate(`/compras/${id}`); await page.contains('Abrir pago seguro');
      const r = await page.request('GET', `/compras/${id}/pagos`); assert.equal(r.body.data.importeReservado, '200.00');
      await page.clickText('Abrir pago seguro'); await page.contains('Número de tarjeta'); await autorizar();
      await page.clickText('Verificar pago'); await page.contains('Pago parcial'); await cerrar();
    });
    await t.test('Cero, negativos, precisión y sobrepago se muestran antes de enviar', async () => {
      await nuevaCompra(); await page.clickText('Pagar');
      const before = browser.requests.filter(r => r.path.match(/\/pagos$/) && r.method === 'POST').length;
      for (const importe of ['0', '-1', '1.001', '500.01']) {
        await page.field('#pago-importe', importe);
        assert.equal(await page.evaluate('document.querySelector("#pago-importe").getAttribute("aria-invalid")'), 'true');
        assert.ok(await page.evaluate('document.querySelector(".pago-form button[type=submit]").disabled'));
      }
      assert.equal(browser.requests.filter(r => r.path.match(/\/pagos$/) && r.method === 'POST').length, before);
    });
    const autorizaciones = browser.requests.filter(r => r.method === 'POST' && r.path.endsWith('/autorizar-prueba'));
    assert.ok(autorizaciones.length > 0);
    for (const request of autorizaciones) {
      assert.ok(request.body && typeof request.body === 'object', 'Cada POST de autorización debe tener un cuerpo JSON capturado');
      assert.deepEqual(Object.keys(request.body), ['decision']);
    }
    t.diagnostic(JSON.stringify({ solicitudesAutorizacion: { POST: autorizaciones.length,
      OPTIONS: browser.requests.filter(r => r.method === 'OPTIONS' && r.path.endsWith('/autorizar-prueba')).length },
      dobleClic: 'un pago y una autorización efectiva comprobados en MySQL' }));
    const payloads = JSON.stringify(browser.requests.filter(r => r.method === 'POST' && r.path.includes('/pagos')).map(r => r.body));
    assert.doesNotMatch(payloads, /"(?:titular|numero|cvv|numeroTarjeta|vencimiento)"/i);
    for (const datos of datosEnviados) {
      assert.equal(payloads.includes(datos.numero), false, 'El número completo no sale del formulario');
      assert.equal(payloads.includes(datos.titular), false, 'El titular no sale del formulario');
      assert.equal(payloads.includes(JSON.stringify(datos.cvv)), false, 'El CVV no sale del formulario');
    }
    assert.equal(await page.evaluate('localStorage.length + sessionStorage.length'), 0);
    assert.equal(externalCalls, 0);
    assert.deepEqual(browser.errors, []);
    t.diagnostic('Navegador y API reales; sin mocks financieros ni peticiones a pasarelas.');
  } finally {
    await browser?.close(); if (server) await new Promise(resolve => server.close(resolve));
    await db.sequelize.close(); await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
