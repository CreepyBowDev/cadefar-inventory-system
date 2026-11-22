import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegadorReal, esperar } from './helpers/navegadorReal.mjs';

test('Acceso y menú habituales, logout, reingreso independiente y pagos Tarjeta 200 + PayPal 300', {
  skip: process.env.CADEFAR_AUTORIZAR_PAGOS_LOCAL !== '1' || process.env.CADEFAR_LOGIN_MANUAL !== '1', timeout: 900000
}, async t => {
  const backend = fileURLToPath(new URL('../../backend/', import.meta.url));
  const require = createRequire(join(backend, 'package.json'));
  require('dotenv').config({ path: join(backend, '.env'), quiet: true });
  require('dotenv').config({ path: join(backend, '.env.pagos-pruebas'), override: true, quiet: true });
  const { default: entorno } = await import('../../backend/src/shared/utils/pagos-entorno.cjs');
  assert.equal(entorno.esPruebaLocal(), true);
  const { huellaBase } = await import('../../backend/tests/helpers/huella-pagos.js');
  const c = await require('mysql2/promise').createConnection({ host: process.env.DB_HOST,
    user: process.env.DB_USER, password: process.env.PASSWORD_DB, database: entorno.BASE_PRUEBAS, timezone: '+00:00' });
  const [[baseActiva]] = await c.query('SELECT DATABASE() AS nombre');
  assert.equal(baseActiva.nombre, entorno.BASE_PRUEBAS);
  const profile = await mkdtemp(join(process.env.LOCALAPPDATA, 'Temp', 'opencode', 'cadefar-login-local-'));
  let browser;
  let etapa = 'ABRIR_NAVEGADOR';
  try {
    const baseline = await huellaBase(c, entorno.BASE_IDENTIDAD);
    browser = await abrirNavegadorReal({ profile, origin: 'http://localhost:5173', apiUrl: 'http://localhost:3000/api', headless: false });
    let page = await browser.openSession('acceso-habitual-admin-demo', undefined, { useDefaultContext: true });
    const inicio = Date.now();
    const esperarLogin = async (pagina, fase) => {
      await pagina.viewport(1280, 1000);
      assert.equal((await pagina.cookies()).some(cookie => cookie.name === 'token'), false);
      await pagina.navigate('/'); await pagina.contains('Nombre de usuario'); await pagina.contains('Entorno de pruebas');
      assert.equal(await pagina.evaluate('location.pathname'), '/login');
      assert.equal(await pagina.evaluate('!!document.querySelector(".login-form #password")'), true);
      assert.equal(await pagina.evaluate('document.body.textContent.includes("Se requiere una sesión válida")'), false);
      await esperar(async () => {
        if (await pagina.evaluate('location.pathname === "/login" || !!document.querySelector(".login-form")')) return false;
        const session = await pagina.request('GET', '/auth/me');
        return session.status === 200 && session.body.data?.nombreUsuario === 'admin_demo' && session.body.data?.esPrueba === true;
      }, `login manual de ${fase}; escribe únicamente en la ventana recién abierta`, 300000);
      await pagina.contains('Bienvenido');
      assert.ok(browser.requests.some(r => r.session === pagina.name && r.method === 'POST' && r.path === '/api/auth/login' && r.status === 200),
        'Debe observarse el POST del formulario del mismo navegador, sin sesión fabricada');
      assert.equal((await pagina.cookies()).find(cookie => cookie.name === 'token')?.httpOnly, true);
      assert.equal(await pagina.evaluate('document.cookie.includes("token=")'), false);
      assert.equal((await pagina.request('GET', '/auth/me')).body.data.idRol, 1);
    };
    // Primera fase: aplicación habitual, sin alterar su formulario ni su menú.
    etapa = 'LOGIN_HABITUAL';
    await esperarLogin(page, 'acceso habitual');
    etapa = 'NAVEGACION_HABITUAL';
    for (const path of ['/usuarios', '/proveedores', '/medicamentos', '/principios-activos', '/inventario', '/ventas', '/compras', '/reportes/compras', '/bitacora']) {
      await page.evaluate(`(() => {
        const a = [...document.querySelectorAll('.app-sidebar__navigation a')].find(a => new URL(a.href).pathname === ${JSON.stringify(path)});
        if (!a) throw new Error('Enlace habitual del menú no encontrado');
        const lista = a.closest('.app-sidebar__submenu'); if (lista?.hidden) lista.previousElementSibling.click(); a.click();
      })()`);
      await page.wait(`location.pathname === ${JSON.stringify(path)} && !!document.querySelector('.main-content')`);
    }
    for (const path of ['/usuarios', '/proveedores-laboratorios', '/medicamentos', '/principios-activos', '/inventario', '/ventas', '/compras']) {
      assert.equal((await page.request('GET', path)).status, 200, `Consulta habitual ${path}`);
    }
    await page.navigate('/compras/1'); await page.contains('Disponible para pagar');
    await page.navigate('/compras/1'); await page.contains('Disponible para pagar');
    assert.equal((await page.request('GET', '/auth/me')).status, 200);
    await page.clickText('Salir'); await page.contains('Nombre de usuario');
    assert.equal((await page.request('GET', '/auth/me')).status, 401);
    assert.equal((await page.cookies()).some(cookie => cookie.name === 'token'), false);
    // Segunda fase independiente: otra cookie/contexto, contraseña escrita otra
    // vez por su titular; la sesión anterior permanece cerrada.
    const normal = page;
    etapa = 'ABRIR_SESION_INDEPENDIENTE';
    page = await browser.openSession('pagos-login-independiente');
    await normal.close();
    await page.initScript(`addEventListener('DOMContentLoaded', () => {
      if (location.pathname === '/login') {
        document.title = 'CADEFAR — PRUEBA GUIADA: inicia sesión aquí';
        const aviso = document.createElement('p'); aviso.setAttribute('role', 'status');
        aviso.textContent = 'PRUEBA GUIADA CADEFAR: inicia sesión aquí con admin_demo. Después no cierres esta ventana; las comprobaciones continuarán automáticamente.';
        aviso.style.cssText = 'position:fixed;inset:0 0 auto;margin:0;padding:12px;background:#fff4c2;color:#242424;z-index:9999;font:14px sans-serif;text-align:center';
        document.body.prepend(aviso);
      }
    });`);
    etapa = 'LOGIN_INDEPENDIENTE';
    await esperarLogin(page, 'prueba independiente de pagos');
    etapa = 'PAGOS';
    await page.navigate('/compras'); await page.contains('Compras');
    await page.navigate('/compras/1'); await page.contains('Disponible para pagar');
    // Compra nueva de 500 BOB: no depender de saldos consumidos por otra prueba.
    const [[fixture]] = await c.query("SELECT m.id_medicamento FROM medicamento m JOIN proveedor_laboratorio p ON p.id_proveedor_laboratorio=m.id_proveedor_laboratorio WHERE m.codigo_medicamento='PRU001' AND p.nombre LIKE '%PRUEBA_LOCAL%'");
    assert.ok(fixture);
    const { obtenerFechaOperacion } = await import('../../backend/src/shared/utils/fecha-operacion.js');
    assert.equal((await c.query('SELECT DATABASE() AS nombre'))[0][0].nombre, entorno.BASE_PRUEBAS);
    const nueva = await page.request('POST', '/compras', { claveOperacion: `login-real-${randomBytes(12).toString('hex')}`,
      fechaCompra: obtenerFechaOperacion().fechaComercial, detalles: [{ idMedicamento: fixture.id_medicamento,
        cantidad: 10, costoUnitario: '50.000000', precisionVencimiento: 'DIA', fechaVencimiento: '2099-12-31' }] });
    assert.equal(nueva.status, 201); assert.equal(nueva.body.data.total, '500.00');
    const compraPath = `/compras/${nueva.body.data.idCompra}`;
    await page.navigate(compraPath); await page.contains('Disponible para pagar');
    for (const [metodo, importe] of [['TARJETA', '200.00'], ['PAYPAL', '300.00']]) {
      await page.wait('document.querySelector("#pagos")?.getAttribute("aria-busy") === "false"');
      await page.clickText('Pagar'); await page.field('#pago-importe', importe);
      if (metodo === 'PAYPAL') await page.click('input[value=PAYPAL]');
      await page.click('.pago-autorizacion input'); await page.review('.pago-form');
      await page.click('.modal__actions .button--primary'); await page.contains(metodo === 'TARJETA' ? 'Número de tarjeta' : 'Revisa el importe y autoriza');
      await page.wait('!!document.querySelector(".pago-autorizacion-local .button--primary") && !document.querySelector(".pago-autorizacion-local .button--primary").disabled');
      await page.wait('document.querySelector(".pago-autorizacion-local")?.getAttribute("aria-busy") === "false"');
      if (metodo === 'TARJETA') {
        for (const [campo, valor] of Object.entries({ titular: 'Persona Inventada', numero: '1234567890123456789', vencimiento: '04/34', cvv: '1234' })) await page.field(`#tarjeta-${campo}`, valor);
        await page.click('.pago-autorizacion-local button[type=submit]'); await page.contains('Autorización aprobada');
      } else { await page.clickText('Autorizar pago'); await page.contains('Pago autorizado'); }
      await page.wait('document.querySelector(".pago-autorizacion-local")?.getAttribute("aria-busy") === "false"');
      await page.wait('document.querySelector("#pagos")?.getAttribute("aria-busy") === "false"');
      const before = (await page.request('GET', `${compraPath}/pagos`)).body.data;
      const pending = before.pagos.find(p => p.metodo === metodo && ['PENDIENTE', 'PROCESANDO'].includes(p.estado));
      assert.ok(pending);
      if (metodo === 'PAYPAL') {
        await page.evaluate(`(() => { const b = [...document.querySelectorAll('.pago-autorizacion-local button')].find(b => b.textContent.trim() === 'Verificar estado'); b.click(); })()`);
        await page.wait('document.querySelector(".pago-autorizacion-local")?.getAttribute("aria-busy") === "false"');
        assert.equal((await page.request('GET', `${compraPath}/pagos`)).body.data.saldoPendiente, '300.00');
      }
      await page.clickText(metodo === 'TARJETA' ? 'Verificar pago' : 'Confirmar operación');
      await page.contains('Pago confirmado');
      await page.wait('document.querySelector("#pagos")?.getAttribute("aria-busy") === "false"');
      const updated = (await page.request('GET', `${compraPath}/pagos`)).body.data;
      const pago = updated.pagos.find(p => p.idPago === pending.idPago);
      assert.equal(pago.estado, 'CONFIRMADO'); assert.match(pago.referenciaExterna, /^PRUEBA_LOCAL_REF_/);
      assert.equal(updated.saldoPendiente, metodo === 'TARJETA' ? '300.00' : '0.00');
      await page.click('.pago-autorizacion-local .button--primary');
      await page.contains('Comprobante de prueba'); await page.contains('Documento local sin valor bancario ni fiscal.');
      await page.click('button[aria-label="Cerrar ventana"]');
    }
    const result = (await page.request('GET', `${compraPath}/pagos`)).body.data;
    assert.equal(result.totalPagado, '500.00'); assert.equal(result.saldoPendiente, '0.00');
    assert.equal(result.pagos.length, 2);
    await page.navigate(compraPath); await page.contains('Pagada');
    assert.equal((await page.request('GET', '/auth/me')).status, 200);
    assert.equal(await page.evaluate('location.pathname'), compraPath);
    assert.equal(await page.evaluate('document.querySelectorAll(".pago-table tbody tr").length'), 2);
    assert.equal(await page.evaluate('localStorage.length + sessionStorage.length'), 0);
    const [events] = await c.query("SELECT tipo_evento FROM cadefar_pagos_pruebas.bitacora_auditoria WHERE tipo_evento='LOGIN_EXITO' AND nombre_usuario_responsable='admin_demo' AND fecha_evento>=?", [new Date(inicio)]);
    assert.ok(events.length >= 2, 'Ambos logins reales deben quedar auditados solo en pruebas');
    assert.equal(await huellaBase(c, entorno.BASE_IDENTIDAD), baseline);
    assert.deepEqual(browser.errors, []);
    t.diagnostic(JSON.stringify({ loginReal: true, navegacionHabitual: true, logoutYReingreso: true, cookieHttpOnly: true, recargaConSesion: true,
      compra: nueva.body.data.idCompra, abonosFicticios: '200.00 Tarjeta + 300.00 PayPal', saldoFinal: result.saldoPendiente, originalIntacto: true }));
  } catch (error) {
    t.diagnostic(`Etapa de la aceptación manual: ${etapa}`);
    throw error;
  } finally {
    await browser?.close(); await c.end();
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
