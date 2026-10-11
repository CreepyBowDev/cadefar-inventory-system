// Navegador real con API simulada: no conecta a MySQL ni escribe compras.
// Node >= 22 y Chrome/Edge. Ejecutar: node --test tests/compras.browser.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const browserPath = process.env.CADEFAR_TEST_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(existsSync);
const waitUntil = async (predicate) => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const result = await predicate(); if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error('Tiempo agotado esperando Compras');
};
const proveedores = [{ idProveedorLaboratorio: 1, nombre: 'Laboratorio actual', estado: true }, { idProveedorLaboratorio: 2, nombre: 'Proveedor histórico', estado: false }];
const cabecera = (id, estado, usuario = 1) => ({ idCompra: id, idUsuario: usuario, idProveedorLaboratorio: 2,
  fechaCompra: '2026-02-01', fechaRegistro: '2026-02-02 00:15:00', estadoOperacion: estado,
  claveOperacion: `compra-${id}`, total: id === 2 ? '999999999999.99' : '100000000.37',
  fechaAnulacion: estado === 'ANULADA' ? '2026-02-03 08:12:13' : null,
  motivoAnulacion: estado === 'ANULADA' ? 'Devolución documentada\nSin eliminar el historial' : null,
  idUsuarioAnulador: estado === 'ANULADA' ? 1 : null, proveedorLaboratorio: proveedores[1],
  usuarioRegistrador: { idUsuario: usuario, nombreUsuario: `registrador-${usuario}` },
  usuarioAnulador: estado === 'ANULADA' ? { idUsuario: 1, nombreUsuario: 'administrador' } : null });
const compras = [cabecera(2, 'ANULADA', 2), cabecera(1, 'CONFIRMADA')];
const medicamento = { idMedicamento: 5, codigoMedicamento: 'PAR005', nombreComercial: 'Paracetamol histórico', formaFarmaceutica: 'Tableta', presentacion: '500 mg', unidadInventario: 'tableta', estado: false };
const existencia = { idExistencia: 7, idMedicamento: 5, codigoExistencia: 'PAR005-001', fechaVencimiento: '2026-02-01', precisionVencimiento: 'MES', medicamento };
const detalle = (id, costo, subtotal, cantidad = 1) => ({ idDetalleCompra: id, idCompra: 1, idExistencia: 7, cantidad, costoUnitario: costo, subtotal, existencia });
const detalles = [detalle(11, '0.000001', '0.00'), detalle(12, '0.123456', '0.37', 3), detalle(13, '99999999.999999', '100000000.00')];
const catalogo = [
  { ...medicamento, idMedicamento: 10, codigoMedicamento: 'ACT010', nombreComercial: 'Medicamento activo', estado: true, idProveedorLaboratorio: 1, proveedorLaboratorio: proveedores[0] },
  { ...medicamento, idMedicamento: 11, codigoMedicamento: 'ACT011', nombreComercial: 'Segundo medicamento', estado: true, idProveedorLaboratorio: 1, proveedorLaboratorio: proveedores[0] },
  { ...medicamento, idMedicamento: 12, estado: false, idProveedorLaboratorio: 1 },
  { ...medicamento, idMedicamento: 13, estado: true, idProveedorLaboratorio: 2 },
  { ...medicamento, idMedicamento: 14, codigoMedicamento: 'OTR014', nombreComercial: 'Otro proveedor', estado: true, idProveedorLaboratorio: 3 }
];
const proveedoresRegistro = [...proveedores, { idProveedorLaboratorio: 3, nombre: 'Otro laboratorio', estado: true }];

test('CU25/CU26/CU27 React: compras, recuperación y roles con API simulada', { timeout: 120000 }, async (t) => {
  assert.ok(browserPath, 'Instala Chrome/Edge o configura CADEFAR_TEST_BROWSER');
  const tempRoot = process.platform === 'win32' ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : tmpdir();
  const profile = await mkdtemp(join(tempRoot, 'cadefar-compras-'));
  const origin = 'http://127.0.0.1:5178';
  // Frontend compilado en directorio temporal, sin cientos de módulos por recarga.
  const vite = spawn(process.execPath, ['--input-type=module', '--eval', `import { build, preview } from 'vite'; const outDir=${JSON.stringify(join(profile, 'app'))}; await build({logLevel:'warn',build:{outDir,emptyOutDir:true}}); const server=await preview({build:{outDir},preview:{host:'127.0.0.1',port:5178,strictPort:true}}); server.printUrls();`], {
    cwd: root, env: { ...process.env, VITE_API_URL: `${origin}/api` }, stdio: ['ignore', 'pipe', 'pipe']
  });
  let browser, socket, send, rol = 1, nextResponse, heldRequest, proveedorResponse, medicamentoResponse, postResponse, heldPost;
  const registradas = [];
  const anuladas = new Map();
  let anulacionResponse, heldAnulacion;
  const compraPorId = (id) => anuladas.get(id) || [...compras, ...registradas].find(c => c.idCompra === id);
  const anularSimulada = (id, motivo) => {
    const c = compraPorId(id);
    const result = { ...c, detalles: c.detalles || detalles, estadoOperacion: 'ANULADA', motivoAnulacion: motivo,
      fechaAnulacion: '2026-02-15 00:15:00', idUsuarioAnulador: 1, usuarioAnulador: { idUsuario: 1, nombreUsuario: 'administrador' } };
    anuladas.set(id, result); return result;
  };
  const registrarSimulada = (payload) => {
    const c = { ...cabecera(50 + registradas.length, 'CONFIRMADA'), idUsuario: 1, claveOperacion: payload.claveOperacion,
      fechaCompra: payload.fechaCompra, total: '12.34', proveedorLaboratorio: proveedores[0], idProveedorLaboratorio: 1,
      detalles: payload.detalles.map((d, index) => ({ idDetalleCompra: 500 + index, ...d, idExistencia: 700 + index, subtotal: '1.23',
        existencia: { ...existencia, idExistencia: 700 + index, idMedicamento: d.idMedicamento, precisionVencimiento: d.precisionVencimiento,
          fechaVencimiento: d.precisionVencimiento === 'MES' ? `${d.fechaVencimiento}-28` : d.fechaVencimiento,
          medicamento: catalogo.find((m) => m.idMedicamento === d.idMedicamento) } })) };
    registradas.push(c); return c;
  };
  const requests = [], errors = [], unexpected = [];
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Vite no inició en 5178')), 15000);
      vite.stdout.on('data', (chunk) => { if (chunk.toString().replace(/\x1b\[[0-9;]*m/g, '').includes('127.0.0.1:5178')) { clearTimeout(timeout); resolve(); } });
      vite.once('error', reject); vite.once('exit', () => reject(new Error('Vite finalizó antes de iniciar')));
    });
    browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
    const port = await waitUntil(async () => { try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { return null; } });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let id = 0;
    const pending = new Map();
    send = (method, params = {}) => new Promise((resolve, reject) => {
      const current = ++id, timer = setTimeout(() => { pending.delete(current); reject(new Error(`Chrome no respondió: ${method}`)); }, 10000);
      pending.set(current, { resolve: (result) => { clearTimeout(timer); resolve(result); }, reject: (error) => { clearTimeout(timer); reject(error); } });
      socket.send(JSON.stringify({ id: current, method, params }));
    });
    const respond = (requestId, status, body) => send('Fetch.fulfillRequest', { requestId, responseCode: status,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
    socket.addEventListener('close', () => { for (const item of pending.values()) item.reject(new Error('Chrome cerró')); pending.clear(); });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const item = pending.get(message.id); pending.delete(message.id);
        if (message.error) item?.reject(new Error(message.error.message)); else item?.resolve(message.result);
      } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
      else if (message.method === 'Fetch.requestPaused') {
        const { requestId, request } = message.params, url = new URL(request.url), path = url.pathname;
        requests.push({ path, query: Object.fromEntries(url.searchParams), method: request.method, ...(request.postData ? { body: JSON.parse(request.postData) } : {}) });
        const finish = (status, data) => { void respond(requestId, status, data).catch((error) => errors.push(error.message)); };
        if (path === '/api/auth/me') { finish(rol ? 200 : 401, rol ? { data: { idUsuario: rol, idRol: rol, nombreUsuario: `usuario-${rol}` } } : { message: 'No autenticado' }); return; }
        if (path === '/api/proveedores-laboratorios') {
          const planned = proveedorResponse; if (!planned?.persist) proveedorResponse = null;
          finish(planned?.status || 200, planned?.body || { data: proveedoresRegistro }); return;
        }
        if (path === '/api/medicamentos') {
          const planned = medicamentoResponse; if (!planned?.persist) medicamentoResponse = null;
          finish(planned?.status || 200, planned?.body || { data: catalogo }); return;
        }
        if (!path.startsWith('/api/compras')) { unexpected.push(path); finish(404, { message: 'Endpoint inesperado' }); return; }
        if (/^\/api\/compras\/\d+\/anular$/.test(path) && request.method === 'POST') {
          const id = Number(path.split('/')[3]), body = JSON.parse(request.postData);
          const planned = anulacionResponse; anulacionResponse = null;
          if (planned?.hold) { heldAnulacion = { requestId, id, body }; return; }
          const c = planned?.commit ? anularSimulada(id, body.motivo) : null;
          if (planned?.networkError) void send('Fetch.failRequest', { requestId, errorReason: 'ConnectionRefused' });
          else if (planned) finish(planned.status, planned.body);
          else if (compraPorId(id)?.estadoOperacion === 'ANULADA') finish(409, { message: 'La compra ya está anulada' });
          else finish(200, { data: c || anularSimulada(id, body.motivo), message: 'Compra anulada exitosamente' });
          return;
        }
        if (path === '/api/compras' && request.method === 'POST') {
          const planned = postResponse; postResponse = null;
          if (planned?.hold) { heldPost = { requestId, body: JSON.parse(request.postData) }; return; }
          if (planned?.commit) registrarSimulada(JSON.parse(request.postData));
          if (planned?.networkError) void send('Fetch.failRequest', { requestId, errorReason: 'ConnectionRefused' });
          else if (planned) finish(planned.status, planned.body);
          else finish(201, { data: registrarSimulada(JSON.parse(request.postData)), message: 'Compra registrada' });
          return;
        }
        if (nextResponse) {
          const planned = nextResponse; if (!planned.persist) nextResponse = null;
          if (planned.hold) heldRequest = requestId;
          else if (planned.networkError) void send('Fetch.failRequest', { requestId, errorReason: 'ConnectionRefused' });
          else finish(planned.status, planned.body);
          return;
        }
        if (path === '/api/compras') {
          let data = [...compras, ...registradas].map(c => anuladas.get(c.idCompra) || c);
          const params = url.searchParams;
          if (params.has('claveOperacion')) data = data.filter((c) => c.claveOperacion === params.get('claveOperacion') && c.idUsuario === rol);
          if (params.has('estadoOperacion')) data = data.filter((c) => c.estadoOperacion === params.get('estadoOperacion'));
          if (params.has('idProveedorLaboratorio')) data = data.filter((c) => c.idProveedorLaboratorio === Number(params.get('idProveedorLaboratorio')));
          finish(200, { data });
        } else {
          const c = compraPorId(Number(path.split('/').at(-1)));
          finish(c ? 200 : 404, c ? { data: { ...c, detalles: c.detalles || detalles } } : { message: 'Compra no encontrada' });
        }
      }
    });
    await send('Page.enable'); await send('Runtime.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: `${origin}/api/*` }] });
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails)); return result.result.value;
    };
    const waitFor = (expression) => waitUntil(async () => { try { return await evaluate(expression); } catch { return false; } });
    const navigate = async (path) => { await evaluate('window.__navigating = true'); await send('Page.navigate', { url: `${origin}${path}` }); await waitFor('!window.__navigating && document.readyState === "complete"'); };
    const ready = async () => {
      await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      return waitFor('!!document.querySelector(".compras-page") && document.querySelector("[aria-busy]")?.getAttribute("aria-busy") === "false"');
    };
    const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const input = (id, value) => evaluate(`(() => { const el = document.getElementById(${JSON.stringify(id)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    const select = (id, value) => evaluate(`(() => { const el=document.getElementById(${JSON.stringify(id)}); el.value=${JSON.stringify(value)}; el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    const submit = async () => {
      await evaluate('document.querySelector(".compra-filters").requestSubmit()');
      await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    };
    const contains = (text) => waitFor(`document.querySelector('.compras-page')?.textContent.includes(${JSON.stringify(text)})`);
    const settled = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const screenshot = async (name) => { if (process.env.CADEFAR_SCREENSHOT_DIR) { const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(join(process.env.CADEFAR_SCREENSHOT_DIR, name), Buffer.from(data, 'base64')); } };
    const comprasRequests = () => requests.filter((r) => r.path.startsWith('/api/compras'));

    await t.test('Listado por defecto conserva confirmadas/anuladas, proveedor inactivo, horas civiles y total máximo', async () => {
      await navigate('/compras'); await ready();
      assert.equal(await evaluate('document.querySelectorAll(".compra-table tbody tr").length'), 2);
      const text = await evaluate('document.querySelector(".compra-table").textContent');
      for (const value of ['Anulada', 'Confirmada', 'Actualmente inactivo', '01/02/2026', '02/02/2026 00:15:00', '999.999.999.999,99']) assert.ok(text.includes(value));
      assert.ok(await evaluate(`!!document.querySelector('.app-sidebar a[href="/compras"]')`));
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false }); await screenshot('compras-listado.png');
    });
    await t.test('Período/proveedor/estado/clave se combinan, normalizan y no envían usuario del cliente', async () => {
      await waitFor(`document.querySelector('#compra-proveedor option[value="2"]')?.textContent.includes('inactivo')`);
      const count = comprasRequests().length;
      await input('compra-desde', '2026-02-01'); await input('compra-hasta', '2026-02-01');
      await select('compra-proveedor', '2'); await select('compra-estado', 'CONFIRMADA'); await input('compra-clave', ' COMPRA-1 ');
      assert.equal(comprasRequests().length, count);
      await submit(); await waitFor('location.search.includes("claveOperacion=compra-1")'); await ready();
      assert.deepEqual(comprasRequests().at(-1).query, { desde: '2026-02-01', hasta: '2026-02-01', idProveedorLaboratorio: '2', estadoOperacion: 'CONFIRMADA', claveOperacion: 'compra-1' });
      assert.equal(await evaluate('document.querySelectorAll(".compra-table tbody tr").length'), 1);
    });
    await t.test('Recarga, detalle y volver conservan los filtros; GET por ID no envía query', async () => {
      const search = await evaluate('location.search');
      await navigate(`/compras${search}`); await ready();
      assert.equal(await evaluate('document.getElementById("compra-clave").value'), 'compra-1');
      await click('a[href="/compras/1"]'); await waitFor('location.pathname === "/compras/1"'); await ready();
      assert.deepEqual(comprasRequests().at(-1).query, {});
      await screenshot('compra-detalle.png');
      await click('.back-link'); await waitFor('location.pathname === "/compras"'); await ready();
      assert.equal(await evaluate('location.search'), search);
      assert.equal(await evaluate('document.getElementById("compra-proveedor").value'), '2');
    });
    await t.test('Rango invertido y claves inválidas se rechazan antes de consultar', async () => {
      const count = comprasRequests().length;
      await input('compra-desde', '2026-02-02'); await submit(); await contains('no puede ser posterior');
      await input('compra-desde', '2026-02-01');
      for (const value of ['clave con espacio', 'ácento', 'a'.repeat(65)]) {
        await input('compra-clave', value); await submit(); await contains('La clave admite');
      }
      assert.equal(comprasRequests().length, count);
      await click('.compra-filters__actions button[type="button"]'); await waitFor('location.search === ""'); await ready();
      assert.equal(await evaluate('document.querySelectorAll(".compra-table tbody tr").length'), 2);
      await input('compra-clave', 'borrador'); await input('compra-desde', '2026-01-01');
      await select('compra-proveedor', '2');
      await click('.compra-filters__actions button[type="button"]'); await ready();
      assert.equal(await evaluate('document.getElementById("compra-clave").value'), '');
      assert.equal(await evaluate('document.getElementById("compra-desde").value'), '');
      assert.equal(await evaluate('document.getElementById("compra-proveedor").value'), '');
    });
    await t.test('Detalle conserva líneas repetidas, seis decimales, subtotales y MES histórico no canónico', async () => {
      await navigate('/compras/1'); await ready();
      const rows = await evaluate('[...document.querySelectorAll(".compra-table tbody tr")].map(tr => [...tr.querySelectorAll("td")].map(td => td.textContent))');
      assert.equal(rows.length, 3); assert.ok(rows.every((row) => row[1].includes('PAR005-001')));
      assert.ok(rows[0][2].includes('02/2026')); assert.ok(rows[0][2].includes('01/02/2026'));
      assert.equal(rows[0][4], '0,000001'); assert.equal(rows[0][5], '0,00');
      assert.equal(rows[1][4], '0,123456'); assert.equal(rows[2][4], '99.999.999,999999');
      assert.ok(await evaluate('document.querySelector(".compra-total").textContent === "100.000.000,37"'));
      assert.ok(rows[0][0].includes('Inactivo'));
      assert.ok(await evaluate(`!!document.querySelector('a[href="/inventario/medicamentos/5/existencias"]')`));
      assert.ok(await evaluate(`!!document.querySelector('a[href="/inventario/movimientos?idExistencia=7"]')`));
    });
    await t.test('Compra anulada muestra fecha, motivo, responsable y conserva el total y los detalles', async () => {
      await navigate('/compras/2'); await ready();
      const text = await evaluate('document.querySelector(".compra-anulacion").textContent');
      assert.ok(text.includes('03/02/2026 08:12:13')); assert.ok(text.includes('administrador')); assert.ok(text.includes('Devolución documentada'));
      assert.equal(await evaluate('document.querySelectorAll(".compra-table tbody tr").length'), 3);
      assert.equal(await evaluate('document.querySelector(".compra-total").textContent'), '999.999.999.999,99');
    });
    await t.test('ID inválido no hace peticiones y compra inexistente muestra 404', async () => {
      const count = comprasRequests().length;
      for (const id of ['0', '01', '1x', '2147483648']) { await navigate(`/compras/${id}`); await ready(); await contains('identificador de la compra no es válido'); }
      assert.equal(comprasRequests().length, count);
      await navigate('/compras/999'); await ready(); await contains('Compra no encontrada');
      assert.equal(await evaluate('!!document.querySelector(".compra-table")'), false);
    });
    await t.test('Respuesta y error tardíos no sustituyen una consulta más reciente', async () => {
      await navigate('/compras'); await ready();
      for (const status of [200, 500]) {
        nextResponse = { hold: true }; await input('compra-clave', 'anterior'); await submit(); await waitUntil(() => heldRequest);
        assert.equal(await evaluate('!!document.querySelector(".compra-table")'), false);
        await input('compra-clave', 'compra-1'); await submit(); await waitFor('location.search.includes("compra-1")'); await ready();
        await respond(heldRequest, status, status === 200 ? { data: [compras[0]] } : { message: 'Error antiguo' }); heldRequest = null; await settled();
        assert.equal(await evaluate('document.querySelectorAll(".compra-table tbody tr").length'), 1);
        assert.ok(await evaluate('document.querySelector(".compra-table").textContent.includes("Confirmada")'));
      }
    });
    await t.test('Opciones de proveedor con error no bloquean compras; reintento conserva selección y filtros', async () => {
      proveedorResponse = { status: 500, body: { message: 'Fallo interno' }, persist: true };
      await navigate('/compras?idProveedorLaboratorio=2'); await ready(); await contains('No fue posible cargar las opciones');
      assert.equal(await evaluate('document.getElementById("compra-proveedor").value'), '2');
      await input('compra-clave', 'compra-1');
      proveedorResponse = null;
      await evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Reintentar proveedores').click()`);
      await waitFor(`document.querySelector('#compra-proveedor option[value="2"]')?.textContent.includes('inactivo')`);
      assert.equal(await evaluate('document.getElementById("compra-proveedor").value'), '2');
      assert.equal(await evaluate('document.getElementById("compra-clave").value'), 'compra-1');
    });
    await t.test('Búsqueda personal y lista vacía dan mensajes útiles sin revelar compras ajenas', async () => {
      rol = 2; await navigate('/compras?claveOperacion=compra-1'); await ready(); await contains('No se encontró una compra propia');
      assert.equal(await evaluate('!!document.querySelector(".compra-table")'), false);
      nextResponse = { status: 200, body: { data: [] }, persist: true };
      await navigate('/compras'); await ready(); await contains('No hay compras registradas');
      nextResponse = null;
    });
    await t.test('Lista y detalle manejan 400/403/500 y red, sin datos anteriores ni detalles técnicos', async () => {
      for (const path of ['/compras', '/compras/1']) {
        await navigate(path); await ready();
        for (const planned of [
          { status: 400, body: { message: 'Datos inválidos' }, expected: 'Datos inválidos' },
          { status: 500, body: { message: 'SELECT secreto' }, expected: 'No fue posible cargar' },
          { networkError: true, expected: 'No se pudo conectar' },
          { status: 403, body: { message: 'Denegado' }, expected: 'No tienes autorización' }
        ]) {
          nextResponse = planned; await click('.catalogo-toolbar button'); await ready(); await contains(planned.expected);
          assert.equal(await evaluate('!!document.querySelector(".compra-table")'), false);
          assert.equal(await evaluate('document.querySelector(".compras-page").textContent.includes("SELECT secreto")'), false);
        }
        await click('.catalogo-toolbar button'); await ready(); assert.ok(await evaluate('!!document.querySelector(".compra-table")'));
      }
    });
    await t.test('401 conduce al login recargando la sesión; sin sesión no se consultan compras', async () => {
      nextResponse = { status: 401, body: { message: 'No autenticado' } };
      await click('.catalogo-toolbar button'); await ready(); await contains('sesión ya no es válida');
      rol = null; const count = comprasRequests().length;
      await click('.compras-page a[href="/login"]'); await waitFor('location.pathname === "/login" && !!document.getElementById("nombreUsuario")');
      await navigate('/compras'); await waitFor('location.pathname === "/login"');
      assert.equal(comprasRequests().length, count);
    });
    await t.test('Administrador y Regente acceden; Vendedor no ve Compras ni solicita lista o detalle', async () => {
      for (const role of [1, 2]) {
        rol = role; await navigate('/compras'); await ready();
        assert.ok(await evaluate(`!!document.querySelector('.app-sidebar a[href="/compras"]')`));
        await navigate('/compras/1'); await ready();
      }
      rol = 3; const count = comprasRequests().length;
      for (const path of ['/compras', '/compras/1']) { await navigate(path); await waitFor('location.pathname === "/dashboard"'); }
      assert.equal(comprasRequests().length, count);
      assert.equal(await evaluate(`!!document.querySelector('.app-sidebar a[href="/compras"]')`), false);
    });
    await t.test('Diseño móvil 375px: listado y detalle sin desbordamiento, tablas desplazables', async () => {
      rol = 1; await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
      for (const path of ['/compras', '/compras/2']) {
        await navigate(path); await ready(); await settled();
        assert.ok(await evaluate('document.documentElement.scrollWidth <= 375'));
        await evaluate('document.querySelector(".catalogo-table-wrap").scrollLeft = 150');
        assert.ok(await evaluate('document.querySelector(".catalogo-table-wrap").scrollLeft > 0'));
        await screenshot(path === '/compras' ? 'compras-mobile.png' : 'compra-detalle-mobile.png');
      }
    });
    const posts = () => requests.filter((r) => r.method === 'POST' && r.path === '/api/compras');
    const clickText = (text) => evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`);
    const setLinea = async (index, values) => {
      for (const [campo, value] of Object.entries(values)) {
        const id = await evaluate(`document.querySelectorAll('.compra-linea')[${index}].querySelector('[name="${campo}"]').id`);
        if (campo === 'idMedicamento' || campo === 'precisionVencimiento') await select(id, value); else await input(id, value);
      }
    };
    const nueva = async () => {
      rol = 1; await navigate('/compras/nueva'); await ready();
      await input('compra-fecha', '2026-02-01');
      await setLinea(0, { idMedicamento: '10', cantidad: '2', costoUnitario: '0.123456', fechaVencimiento: '2030-02-28' });
    };
    const revisar = async () => {
      await evaluate('document.querySelector(".compra-form").requestSubmit()'); await settled();
    };
    const confirmar = async () => {
      await revisar(); await waitFor('!!document.querySelector("[role=dialog]")'); await clickText('Confirmar registro'); await settled();
    };

    await t.test('CU25: Administrador entra desde el listado; clave generada y opciones excluyen inactivos', async () => {
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
      await navigate('/compras'); await ready(); await click('a[href="/compras/nueva"]'); await waitFor('location.pathname === "/compras/nueva"'); await ready();
      assert.match(await evaluate('document.getElementById("compra-nueva-clave").value'), /^compra-[0-9a-f]{32}$/);
      const options = await evaluate('[...document.querySelector(".compra-linea select").options].map(o => o.value)');
      assert.deepEqual(options, ['', '10', '11', '14']);
      await setLinea(0, { idMedicamento: '10' });
      assert.ok(await evaluate('document.querySelector(".compra-form__proveedor").textContent.includes("Laboratorio actual")'));
      assert.ok(await evaluate(`document.querySelector('.compra-linea option[value="14"]').disabled`));
      assert.equal(await evaluate('document.querySelector(".compra-linea button").disabled'), true);
    });
    await t.test('CU25: carga fallida reintenta; catálogo vacío orienta sin habilitar registro', async () => {
      medicamentoResponse = { status: 500, body: { message: 'SELECT secreto' }, persist: true };
      await navigate('/compras/nueva'); await ready(); await contains('No fue posible cargar');
      assert.equal(await evaluate('!!document.querySelector(".compra-form")'), false);
      assert.equal(await evaluate('document.querySelector(".compras-page").textContent.includes("SELECT secreto")'), false);
      medicamentoResponse = null; await clickText('Reintentar'); await waitFor('!!document.querySelector(".compra-form")');
      medicamentoResponse = { status: 200, body: { data: catalogo.filter(m => !m.estado) }, persist: true };
      await navigate('/compras/nueva'); await ready(); await contains('No hay medicamentos disponibles');
      assert.equal(await evaluate('!!document.querySelector(".compra-form")'), false);
      medicamentoResponse = null;
    });
    await t.test('CU25: formatos inválidos no envían; costos diminutos y máximos conservan seis decimales', async () => {
      await nueva(); const count = posts().length;
      for (const cantidad of ['0', '-1', '1.5', '1e2', '2147483648']) {
        await setLinea(0, { cantidad }); await revisar(); await contains('la cantidad debe ser un entero positivo');
      }
      await setLinea(0, { cantidad: '2147483647' });
      for (const costoUnitario of ['0', '-1', '1,23', '1e2', '0.1234567', '100000000', '0.000000']) {
        await setLinea(0, { costoUnitario }); await revisar();
        assert.equal(await evaluate('!!document.querySelector("[role=dialog]")'), false);
        assert.ok(await evaluate('document.querySelector(".compra-form .feedback").textContent.includes("costo")'));
      }
      await input('compra-nueva-clave', 'clave con espacios'); await setLinea(0, { costoUnitario: '0.000001' }); await revisar(); await contains('La clave admite');
      await input('compra-nueva-clave', ' COMPRA_VERIFICACION ');
      await revisar(); await waitFor('!!document.querySelector("[role=dialog]")');
      assert.ok(await evaluate('document.querySelector("[role=dialog]").textContent.includes("0,000001")'));
      await clickText('Volver al formulario');
      await setLinea(0, { costoUnitario: '99999999.999999' }); await revisar(); await waitFor('!!document.querySelector("[role=dialog]")');
      assert.ok(await evaluate('document.querySelector("[role=dialog]").textContent.includes("99.999.999,999999")'));
      await clickText('Volver al formulario'); assert.equal(posts().length, count);
    });
    await t.test('CU25: cambiar precisión vacía vencimiento; agregar/quitar preserva otras líneas', async () => {
      await nueva(); await setLinea(0, { precisionVencimiento: 'MES' });
      assert.equal(await evaluate('document.querySelector(".compra-linea [name=fechaVencimiento]").value'), '');
      await setLinea(0, { fechaVencimiento: '2030-02' });
      await clickText('Agregar línea'); await setLinea(1, { idMedicamento: '11', cantidad: '3', costoUnitario: '1.234567', fechaVencimiento: '2031-05-10' });
      await clickText('Quitar línea 1');
      assert.equal(await evaluate('document.querySelectorAll(".compra-linea").length'), 1);
      assert.equal(await evaluate('document.querySelector(".compra-linea [name=idMedicamento]").value'), '11');
      assert.equal(await evaluate('document.querySelector(".compra-linea [name=costoUnitario]").value'), '1.234567');
      await setLinea(0, { idMedicamento: '' }); await setLinea(0, { idMedicamento: '14' });
      assert.ok(await evaluate('document.querySelector(".compra-form__proveedor").textContent.includes("Otro laboratorio")'));
    });
    await t.test('CU25: mezcla de proveedores se señala antes del POST aunque se fuerce una opción deshabilitada', async () => {
      await nueva(); await clickText('Agregar línea');
      await setLinea(1, { idMedicamento: '14', cantidad: '1', costoUnitario: '1.000001', fechaVencimiento: '2030-05-01' });
      const count = posts().length; await revisar(); await contains('todos los medicamentos deben pertenecer al mismo proveedor');
      assert.equal(posts().length, count);
    });
    await t.test('CU25: revisión, POST exacto con líneas repetidas DIA/MES y bloqueo de doble confirmación', async () => {
      await nueva(); await input('compra-nueva-clave', ' RECEPCION_ABC ');
      await setLinea(0, { cantidad: '1', costoUnitario: '0.000001' });
      await clickText('Agregar línea'); await setLinea(1, { idMedicamento: '10', cantidad: '3', costoUnitario: '99999999.999999', precisionVencimiento: 'MES', fechaVencimiento: '2030-02' });
      await screenshot('compra-registro-desktop.png');
      const count = posts().length; postResponse = { hold: true }; await confirmar(); await waitUntil(() => heldPost);
      assert.equal(posts().length, count + 1);
      assert.deepEqual(heldPost.body, { claveOperacion: 'recepcion_abc', fechaCompra: '2026-02-01', detalles: [
        { idMedicamento: 10, cantidad: 1, costoUnitario: '0.000001', precisionVencimiento: 'DIA', fechaVencimiento: '2030-02-28' },
        { idMedicamento: 10, cantidad: 3, costoUnitario: '99999999.999999', precisionVencimiento: 'MES', fechaVencimiento: '2030-02' }
      ] });
      await evaluate(`document.querySelector('.modal__actions .button--primary').click(); document.querySelector('.modal__header button').click(); window.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))`);
      assert.ok(await evaluate('!!document.querySelector("[role=dialog]")'));
      assert.ok(await evaluate('document.querySelector(".compra-form fieldset").disabled'));
      assert.equal(posts().length, count + 1);
      await screenshot('compra-registro-revision.png');
      const c = registrarSimulada(heldPost.body); await respond(heldPost.requestId, 201, { data: c }); heldPost = null;
      await waitFor(`location.pathname === '/compras/${c.idCompra}'`); await ready(); await contains('Compra registrada');
      assert.equal(await evaluate('document.querySelector(".compra-total").textContent'), '12,34');
      assert.equal(await evaluate('document.querySelectorAll(".compra-table tbody tr").length'), 2);
    });
    await t.test('CU25: 400/404/409 conservan borrador y clave; reintentos no cambian la clave', async () => {
      await nueva(); const key = await evaluate('document.getElementById("compra-nueva-clave").value');
      for (const planned of [
        { status: 400, body: { message: 'La fecha de compra no puede ser futura' } },
        { status: 404, body: { message: 'Medicamento no encontrado' } },
        { status: 409, body: { message: 'No se puede recibir una existencia vencida' } },
        { status: 409, body: { message: 'La clave de operación ya está registrada' } }
      ]) {
        postResponse = planned; await confirmar(); await waitFor('!document.querySelector("[role=dialog]")'); await contains(planned.body.message);
        assert.equal(await evaluate('document.getElementById("compra-nueva-clave").value'), key);
        assert.equal(await evaluate('document.getElementById("compra-nueva-clave").readOnly'), true);
        assert.equal(await evaluate('document.querySelector(".compra-linea [name=costoUnitario]").value'), '0.123456');
        assert.equal(posts().at(-1).body.claveOperacion, key);
      }
    });
    await t.test('CU25: consulta personal vacía/error no elimina borrador ni hace POST automático', async () => {
      const count = posts().length;
      nextResponse = { status: 500, body: { message: 'SQL interno' } };
      await clickText('Consultar mi compra por clave'); await contains('No fue posible confirmar');
      await clickText('Consultar mi compra por clave'); await contains('No se encontró una compra propia con esta clave');
      const key = await evaluate('document.getElementById("compra-nueva-clave").value');
      assert.deepEqual(comprasRequests().at(-1).query, { claveOperacion: key });
      assert.equal(posts().length, count);
      assert.equal(await evaluate('document.querySelector(".compra-linea [name=costoUnitario]").value'), '0.123456');
    });
    await t.test('CU25: respuesta de red perdida tras commit simulado se recupera por clave y evita otra recepción', async () => {
      await nueva(); postResponse = { networkError: true, commit: true }; await confirmar();
      await waitFor('!document.querySelector("[role=dialog]")'); await contains('No se pudo conectar');
      const count = posts().length;
      await clickText('Consultar mi compra por clave'); await contains('Se encontró una compra propia');
      assert.equal(await evaluate('document.querySelector(".compra-form button[type=submit]").disabled'), true);
      await revisar(); assert.equal(posts().length, count);
      const c = registradas.at(-1); await click(`.compra-recuperacion a[href="/compras/${c.idCompra}"]`); await ready();
      assert.equal(await evaluate('location.pathname'), `/compras/${c.idCompra}`);
    });
    await t.test('CU25: 500 mantiene clave, no revela detalles técnicos y permite reintento explícito exitoso', async () => {
      await nueva(); const key = await evaluate('document.getElementById("compra-nueva-clave").value');
      postResponse = { status: 500, body: { message: 'SELECT password_hash' } }; await confirmar();
      await waitFor('!document.querySelector("[role=dialog]")'); await contains('No fue posible confirmar');
      assert.equal(await evaluate('document.querySelector(".compra-form").textContent.includes("password_hash")'), false);
      await clickText('Consultar mi compra por clave'); await contains('No se encontró una compra propia con esta clave');
      await confirmar(); await waitFor('location.pathname.startsWith("/compras/5")'); await ready();
      assert.equal(posts().at(-1).body.claveOperacion, key);
    });
    await t.test('CU25: una respuesta POST tardía tras salir no secuestra la navegación', async () => {
      await nueva(); postResponse = { hold: true }; await confirmar(); await waitUntil(() => heldPost);
      await click('.app-sidebar a[href="/compras"]'); await waitFor('location.pathname === "/compras"'); await ready();
      const c = registrarSimulada(heldPost.body); await respond(heldPost.requestId, 201, { data: c }); heldPost = null;
      await settled(); assert.equal(await evaluate('location.pathname'), '/compras');
    });
    await t.test('CU25: 401/403 conservan formulario, bloquean envío y 401 recarga el inicio de sesión', async () => {
      for (const status of [403, 401]) {
        await nueva(); postResponse = { status, body: { message: 'Denegado' } }; await confirmar();
        await waitFor('!document.querySelector("[role=dialog]")');
        await contains(status === 401 ? 'Tu sesión ya no es válida' : 'No tienes autorización');
        assert.equal(await evaluate('document.querySelector(".compra-form button[type=submit]").disabled'), true);
        assert.equal(await evaluate('document.querySelector(".compra-linea [name=cantidad]").value'), '2');
      }
      rol = null; await click('.compra-form a[href="/login"]'); await waitFor('location.pathname === "/login" && !!document.getElementById("nombreUsuario")');
    });
    await t.test('CU25: Regente/Vendedor no cargan opciones ni acceden a registro; Regente conserva consulta', async () => {
      for (const role of [2, 3]) {
        rol = role; const count = requests.length;
        await navigate('/compras/nueva'); await waitFor('location.pathname === "/dashboard"');
        assert.ok(requests.slice(count).every(r => r.path === '/api/auth/me'));
        if (role === 2) {
          await navigate('/compras'); await ready();
          assert.equal(await evaluate(`!!document.querySelector('a[href="/compras/nueva"]')`), false);
        }
      }
    });
    await t.test('CU25: móvil a 375px permite líneas y revisión sin desbordamiento', async () => {
      await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
      await nueva(); await settled();
      assert.ok(await evaluate('document.documentElement.scrollWidth <= 375'));
      await screenshot('compra-registro-mobile.png');
      await revisar(); await waitFor('!!document.querySelector("[role=dialog]")');
      assert.ok(await evaluate('document.documentElement.scrollWidth <= 375'));
      await clickText('Volver al formulario');
    });
    const anulaciones = () => requests.filter(r => r.method === 'POST' && r.path.endsWith('/anular'));
    const abrirAnulacion = async (id = 1) => {
      rol = 1; anuladas.delete(id); await navigate(`/compras/${id}`); await ready();
    };
    const motivoAnulacion = (value) => evaluate(`(() => { const el = document.getElementById('compra-anular-motivo'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    const revisarAnulacion = async () => { await evaluate('document.querySelector(".compra-anular-form").requestSubmit()'); await settled(); };
    const confirmarAnulacion = async () => { await revisarAnulacion(); await waitFor('!!document.querySelector("[role=dialog]")'); await clickText('Confirmar anulación'); await settled(); };

    await t.test('CU27: solo Administrador ve el formulario, también sobre compras ajenas y catálogo inactivo', async () => {
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
      rol = 2; await navigate('/compras/1'); await ready();
      assert.equal(await evaluate('!!document.querySelector(".compra-anular-form")'), false);
      rol = 3; const count = comprasRequests().length; await navigate('/compras/1'); await waitFor('location.pathname === "/dashboard"');
      assert.equal(comprasRequests().length, count);
      registradas.push({ ...cabecera(80, 'CONFIRMADA', 2), detalles });
      await abrirAnulacion(80);
      assert.ok(await evaluate('!!document.querySelector(".compra-anular-form")'));
      assert.ok(await evaluate('document.querySelector(".compra-detail").textContent.includes("Actualmente inactivo")'));
      assert.ok(await evaluate('document.querySelector(".compra-table").textContent.includes("Inactivo")'));
      await motivoAnulacion('Corrección autorizada de compra de otro registrador'); await confirmarAnulacion(); await contains('Compra anulada. El estado');
      assert.equal(anulaciones().at(-1).path, '/api/compras/80/anular');
      assert.equal(await evaluate('!!document.querySelector(".compra-anular-form")'), false);
    });
    await t.test('CU27: motivo vacío, espacios y más de 255 caracteres no hacen POST; cancelar conserva borrador', async () => {
      await abrirAnulacion(); const count = anulaciones().length;
      for (const value of [' ', 'a'.repeat(256)]) {
        await motivoAnulacion(value); await revisarAnulacion(); await contains('El motivo es obligatorio');
        assert.equal(await evaluate('!!document.querySelector("[role=dialog]")'), false);
      }
      await motivoAnulacion('Corrección\nSin eliminar originales'); await revisarAnulacion(); await waitFor('!!document.querySelector("[role=dialog]")');
      assert.ok(await evaluate('document.querySelector("[role=dialog]").textContent.includes("Corrección\\nSin eliminar originales")'));
      await clickText('Volver al motivo');
      assert.equal(await evaluate('document.getElementById("compra-anular-motivo").value'), 'Corrección\nSin eliminar originales');
      assert.equal(anulaciones().length, count);
    });
    await t.test('CU27: revisión y POST exacto; confirmación bloquea duplicados y resultado conserva los importes y líneas originales', async () => {
      await abrirAnulacion(); await motivoAnulacion(' Corrección de adquisición\nCantidades documentadas ');
      const originalRows = await evaluate('document.querySelector(".compra-table tbody").textContent');
      await evaluate('document.querySelector(".compra-anular-form").scrollIntoView({block:"center"})'); await screenshot('compra-anular-desktop.png');
      anulacionResponse = { hold: true }; const count = anulaciones().length, getCount = comprasRequests().filter(r => r.method === 'GET').length;
      await confirmarAnulacion(); await waitUntil(() => heldAnulacion);
      assert.equal(anulaciones().length, count + 1);
      assert.deepEqual(heldAnulacion.body, { motivo: 'Corrección de adquisición\nCantidades documentadas' });
      assert.deepEqual(anulaciones().at(-1).query, {});
      assert.ok(await evaluate('document.querySelector("[role=dialog]").textContent.includes("100.000.000,37")'));
      await evaluate(`document.querySelector('.modal__actions .button--danger').click(); document.querySelector('.modal__header button').click(); window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);
      assert.ok(await evaluate('!!document.querySelector("[role=dialog]")'));
      assert.ok(await evaluate('document.querySelector(".catalogo-toolbar button").disabled'));
      assert.ok(await evaluate('document.querySelector(".compra-anular-form fieldset").disabled'));
      assert.equal(anulaciones().length, count + 1); await screenshot('compra-anular-confirmacion.png');
      await respond(heldAnulacion.requestId, 200, { data: anularSimulada(heldAnulacion.id, heldAnulacion.body.motivo) }); heldAnulacion = null;
      await contains('Compra anulada. El estado');
      assert.equal(comprasRequests().filter(r => r.method === 'GET').length, getCount);
      assert.equal(await evaluate('document.querySelector(".compra-table tbody").textContent'), originalRows);
      assert.equal(await evaluate('document.querySelector(".compra-total").textContent'), '100.000.000,37');
      assert.ok(await evaluate('document.querySelector(".compra-anulacion").textContent.includes("15/02/2026 00:15:00")'));
      assert.ok(await evaluate('document.querySelector(".compra-anulacion").textContent.includes("administrador")'));
      assert.equal(await evaluate('!!document.querySelector(".compra-anular-form")'), false);
      await screenshot('compra-anulada-resultado.png');
    });
    await t.test('CU27: actualización/recarga no habilitan segunda anulación y volver conserva filtros y estado del listado', async () => {
      await navigate('/compras?estadoOperacion=ANULADA&idProveedorLaboratorio=2'); await ready();
      await click('a[href="/compras/1"]'); await ready(); await clickText('Actualizar'); await ready();
      assert.equal(await evaluate('!!document.querySelector(".compra-anular-form")'), false);
      await click('.back-link'); await ready();
      assert.equal(await evaluate('location.search'), '?estadoOperacion=ANULADA&idProveedorLaboratorio=2');
      assert.ok(await evaluate('document.querySelector(".compra-table").textContent.includes("Anulada")'));
      await navigate('/compras/1'); await ready();
      assert.equal(await evaluate('!!document.querySelector(".compra-anular-form")'), false);
    });
    await t.test('CU27: 409 de stock, valoración, legado o contención exigen consulta explícita sin calcular B1/A en React', async () => {
      await abrirAnulacion(); await motivoAnulacion('Corrección a revisar');
      for (const message of ['No se puede anular: stock físico insuficiente', 'No se puede anular: la valoración residual es incompatible', 'No se puede anular: falta el estado anterior de la compra histórica', 'La compra no pudo anularse por contención temporal. Consulte su estado y reintente']) {
        anulacionResponse = { status: 409, body: { message } }; await confirmarAnulacion(); await waitFor('!document.querySelector("[role=dialog]")'); await contains(message);
        const count = anulaciones().length; await revisarAnulacion(); assert.equal(anulaciones().length, count);
        assert.equal(await evaluate('document.querySelector(".compra-anular-form button[type=submit]").disabled'), true);
        await clickText('Actualizar'); await ready();
        assert.equal(await evaluate('document.getElementById("compra-anular-motivo").value'), 'Corrección a revisar');
        assert.equal(anulaciones().length, count);
      }
    });
    await t.test('CU27: una anulación concurrente devuelve 409; GET muestra el motivo real y retira el borrador', async () => {
      await abrirAnulacion(); await motivoAnulacion('Mi motivo todavía no confirmado');
      anularSimulada(1, 'Motivo confirmado desde otra sesión');
      anulacionResponse = { status: 409, body: { message: 'La compra ya está anulada' } };
      await confirmarAnulacion(); await waitFor('!document.querySelector("[role=dialog]")'); await contains('La compra ya está anulada');
      const count = anulaciones().length; await clickText('Actualizar'); await ready();
      assert.ok(await evaluate('document.querySelector(".compra-anulacion").textContent.includes("Motivo confirmado desde otra sesión")'));
      assert.equal(await evaluate('!!document.querySelector(".compra-anular-form")'), false);
      assert.equal(await evaluate('document.querySelector(".compras-page").textContent.includes("Mi motivo todavía no confirmado")'), false);
      assert.equal(anulaciones().length, count);
    });
    await t.test('CU27: respuesta de red perdida tras commit simulado se recupera por ID sin repetir POST', async () => {
      await abrirAnulacion(); await motivoAnulacion('Motivo registrado pese a respuesta perdida');
      anulacionResponse = { networkError: true, commit: true }; await confirmarAnulacion(); await waitFor('!document.querySelector("[role=dialog]")');
      await contains('No fue posible confirmar el resultado'); const count = anulaciones().length;
      assert.ok(await evaluate('document.querySelector(".compra-anular-form button[type=submit]").disabled'));
      await clickText('Actualizar'); await ready();
      assert.ok(await evaluate('document.querySelector(".compra-anulacion").textContent.includes("Motivo registrado pese a respuesta perdida")'));
      assert.equal(comprasRequests().at(-1).path, '/api/compras/1'); assert.deepEqual(comprasRequests().at(-1).query, {});
      assert.equal(await evaluate('!!document.querySelector(".compra-anular-form")'), false); assert.equal(anulaciones().length, count);
    });
    await t.test('CU27: red/500 sin commit bloquean; consulta fallida no pierde motivo y nueva confirmación es explícita', async () => {
      for (const planned of [{ networkError: true }, { status: 500, body: { message: 'SELECT password_hash' } }]) {
        await abrirAnulacion(); await motivoAnulacion('a'.repeat(255)); anulacionResponse = planned;
        await confirmarAnulacion(); await waitFor('!document.querySelector("[role=dialog]")'); await contains('No fue posible confirmar el resultado');
        assert.equal(await evaluate('document.querySelector(".compras-page").textContent.includes("password_hash")'), false);
        const count = anulaciones().length;
        nextResponse = { status: 500, body: { message: 'Fallo técnico' } }; await clickText('Actualizar'); await ready();
        assert.equal(await evaluate('!!document.querySelector(".compra-anular-form")'), false);
        await clickText('Reintentar'); await ready();
        assert.equal(await evaluate('document.getElementById("compra-anular-motivo").value'), 'a'.repeat(255));
        assert.equal(anulaciones().length, count); await confirmarAnulacion(); await contains('Compra anulada. El estado');
        assert.deepEqual(anulaciones().at(-1).body, { motivo: 'a'.repeat(255) });
      }
    });
    await t.test('CU27: 400 conserva motivo; 404 exige reconsulta y compra no encontrada no permite escribir', async () => {
      await abrirAnulacion(); await motivoAnulacion('Motivo documentado');
      anulacionResponse = { status: 400, body: { message: 'Datos inválidos' } }; await confirmarAnulacion(); await waitFor('!document.querySelector("[role=dialog]")'); await contains('Datos inválidos');
      assert.equal(await evaluate('document.getElementById("compra-anular-motivo").value'), 'Motivo documentado');
      assert.equal(await evaluate('document.querySelector(".compra-anular-form button[type=submit]").disabled'), false);
      anulacionResponse = { status: 404, body: { message: 'Compra no encontrada' } }; await confirmarAnulacion(); await waitFor('!document.querySelector("[role=dialog]")');
      assert.ok(await evaluate('document.querySelector(".compra-anular-form button[type=submit]").disabled'));
      nextResponse = { status: 404, body: { message: 'Compra no encontrada' } }; await clickText('Actualizar'); await ready();
      assert.equal(await evaluate('!!document.querySelector(".compra-anular-form")'), false);
      await clickText('Reintentar'); await ready(); assert.equal(await evaluate('document.getElementById("compra-anular-motivo").value'), 'Motivo documentado');
    });
    await t.test('CU27: 401/403 bloquean escritura, mantienen motivo y 401 vuelve al login con sesión renovada', async () => {
      for (const status of [403, 401]) {
        await abrirAnulacion(); await motivoAnulacion('Motivo pendiente'); anulacionResponse = { status, body: { message: 'Denegado' } };
        await confirmarAnulacion(); await waitFor('!document.querySelector("[role=dialog]")'); await contains(status === 401 ? 'Tu sesión ya no es válida' : 'No tienes autorización');
        assert.ok(await evaluate('document.querySelector(".compra-anular-form button[type=submit]").disabled'));
        assert.ok(await evaluate('document.querySelector(".catalogo-toolbar button").disabled'));
        assert.equal(await evaluate('document.getElementById("compra-anular-motivo").value'), 'Motivo pendiente');
      }
      rol = null; await click('.compra-anular-form a[href="/login"]'); await waitFor('location.pathname === "/login" && !!document.getElementById("nombreUsuario")');
      const count = comprasRequests().length; await navigate('/compras/1'); await waitFor('location.pathname === "/login"'); assert.equal(comprasRequests().length, count);
    });
    await t.test('CU27: respuesta POST tardía tras salir no sustituye otra compra ni conserva su motivo', async () => {
      await abrirAnulacion(); await motivoAnulacion('Motivo de la compra anterior'); anulacionResponse = { hold: true }; await confirmarAnulacion(); await waitUntil(() => heldAnulacion);
      await click('.app-sidebar a[href="/compras"]'); await ready(); await click('a[href="/compras/2"]'); await ready();
      await respond(heldAnulacion.requestId, 200, { data: anularSimulada(heldAnulacion.id, heldAnulacion.body.motivo) }); heldAnulacion = null; await settled();
      assert.equal(await evaluate('location.pathname'), '/compras/2');
      assert.ok(await evaluate('document.querySelector(".page-heading h2").textContent.includes("#2")'));
      assert.equal(await evaluate('document.querySelector(".compras-page").textContent.includes("Motivo de la compra anterior")'), false);
      await abrirAnulacion(); assert.equal(await evaluate('document.getElementById("compra-anular-motivo").value'), '');
    });
    await t.test('CU27: consulta en curso retira datos anteriores y formulario; no permite confirmar antes de obtener el detalle', async () => {
      await abrirAnulacion(); await motivoAnulacion('Motivo conservado'); nextResponse = { hold: true }; await clickText('Actualizar'); await waitUntil(() => heldRequest);
      assert.equal(await evaluate('!!document.querySelector(".compra-anular-form")'), false);
      assert.equal(await evaluate('!!document.querySelector(".compra-table")'), false);
      await respond(heldRequest, 200, { data: { ...cabecera(1, 'CONFIRMADA'), detalles } }); heldRequest = null; await ready();
      assert.equal(await evaluate('document.getElementById("compra-anular-motivo").value'), 'Motivo conservado');
    });
    await t.test('CU27: formulario, confirmación y resultado a 375px conservan texto largo sin desbordamiento', async () => {
      await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
      await abrirAnulacion(); await motivoAnulacion('a'.repeat(255)); await settled();
      await evaluate('document.querySelector(".compra-anular-form").scrollIntoView({block:"center"})');
      assert.ok(await evaluate('document.documentElement.scrollWidth <= 375')); await screenshot('compra-anular-mobile.png');
      await revisarAnulacion(); await waitFor('!!document.querySelector("[role=dialog]")');
      assert.ok(await evaluate('document.documentElement.scrollWidth <= 375')); await screenshot('compra-anular-confirmacion-mobile.png');
      await clickText('Confirmar anulación'); await contains('Compra anulada. El estado'); await settled();
      await evaluate('document.querySelector(".compra-anulacion").scrollIntoView({block:"center"})');
      assert.ok(await evaluate('document.documentElement.scrollWidth <= 375')); await screenshot('compra-anulada-mobile.png');
    });
    await t.test('Cierre: contratos permitidos, ninguna API inesperada, sin secretos almacenados ni errores JavaScript', async () => {
      assert.ok(requests.every((r) => r.method === 'GET' || (r.method === 'POST' && (r.path === '/api/compras' || /^\/api\/compras\/\d+\/anular$/.test(r.path))))); assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
      assert.ok(await evaluate('localStorage.length === 0 && sessionStorage.length === 0'));
      t.diagnostic(`${comprasRequests().length} peticiones de Compras interceptadas (${posts().length} POST de registro y ${anulaciones().length} POST de anulación simulados); sin MySQL.`);
    });
  } finally {
    if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch { /* Chrome puede cerrar primero. */ } socket.close(); }
    browser?.kill(); vite.kill();
    await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }).catch(() => {});
  }
});
