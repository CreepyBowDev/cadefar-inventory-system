// Node >= 22 y Chrome/Edge. API interceptada: sin MySQL ni escrituras reales.
// Ejecutar: node --test tests/inventario.browser.test.mjs
// Con otras suites de Chrome/Vite, usar --test-concurrency=1 en este entorno.
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
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error('Tiempo agotado esperando la interfaz de Inventario');
};

const meta = { fechaComercial: '2026-02-15', zonaHoraria: 'America/La_Paz' };
const med = (id, nombre, estado = true) => ({ idMedicamento: id, codigoMedicamento: `PAR00${id}`, nombreComercial: nombre,
  formaFarmaceutica: 'Tableta', presentacion: '500 mg', unidadInventario: 'tableta', stockMinimo: 10, estado });
const medicamentos = [med(1, 'Paracetamol'), med(2, 'Producto inactivo', false), med(3, 'Sin existencias')];
const existencias = [
  { idExistencia: 11, idMedicamento: 1, codigoExistencia: 'PAR001-001', fechaVencimiento: '2026-02-01', precisionVencimiento: 'MES', fechaEfectivaVencimiento: '2026-03-01', vencida: false, stockFisico: 10, stockVendible: 10, costoUnitarioPromedio: '0.000001', ultimoMovimiento: 101 },
  { idExistencia: 12, idMedicamento: 1, codigoExistencia: 'PAR001-002', fechaVencimiento: '2026-02-15', precisionVencimiento: 'DIA', fechaEfectivaVencimiento: '2026-02-15', vencida: true, stockFisico: 5, stockVendible: 0, costoUnitarioPromedio: '1.123456', ultimoMovimiento: 102 },
  { idExistencia: 21, idMedicamento: 2, codigoExistencia: 'PAR002-001', fechaVencimiento: '2026-03-01', precisionVencimiento: 'DIA', fechaEfectivaVencimiento: '2026-03-01', vencida: false, stockFisico: 4, stockVendible: 0, costoUnitarioPromedio: '99999999.999999', ultimoMovimiento: null }
];
const inventario = medicamentos.map((m) => ({ ...m,
  stockFisico: m.idMedicamento === 1 ? 15 : m.idMedicamento === 2 ? 4 : 0,
  stockVendible: m.idMedicamento === 1 ? 10 : 0,
  existencias: existencias.filter((e) => e.idMedicamento === m.idMedicamento)
}));
const movimientos = [
  { idMovimiento: 101, idExistencia: 11, idUsuario: 2, direccion: 'ENTRADA', cantidad: 10, costoUnitarioAplicado: '0.000001', motivo: 'Compra', fechaMovimiento: '2026-02-01 00:15:00', observacion: 'Observación histórica', idMovimientoOriginal: null, idMovimientoReversion: 102,
    usuario: { nombreUsuario: 'regente-prueba' }, existencia: { ...existencias[0], medicamento: medicamentos[0] }, compra: { idCompra: 7, idDetalleCompra: 8 }, venta: null },
  { idMovimiento: 102, idExistencia: 11, idUsuario: 1, direccion: 'SALIDA', cantidad: 10, costoUnitarioAplicado: '0.000001', motivo: 'Reversión', fechaMovimiento: '2026-02-01 00:15:00', observacion: null, idMovimientoOriginal: 101, idMovimientoReversion: null,
    usuario: { nombreUsuario: 'admin-prueba' }, existencia: { ...existencias[0], medicamento: medicamentos[0] }, compra: { idCompra: 7, idDetalleCompra: 8 }, venta: null }
];

test('Inventario React: consultas, CU23/CU35/CU36 y permisos en Chrome con API simulada', { timeout: 120000 }, async (t) => {
  assert.ok(browserPath, 'Instala Chrome/Edge o configura CADEFAR_TEST_BROWSER');
  const tempRoot = process.platform === 'win32' ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : tmpdir();
  const profile = await mkdtemp(join(tempRoot, 'cadefar-inventario-'));
  const origin = 'http://127.0.0.1:5177';
  // Una compilación temporal evita agotar recursos de Chrome recargando cientos
  // de módulos ESM de desarrollo en decenas de navegaciones. No modifica dist/.
  const vite = spawn(process.execPath, ['--input-type=module', '--eval', `import { build, preview } from 'vite'; const outDir=${JSON.stringify(join(profile, 'app'))}; await build({logLevel:'warn',build:{outDir,emptyOutDir:true}}); const server=await preview({build:{outDir},preview:{host:'127.0.0.1',port:5177,strictPort:true}}); server.printUrls();`], {
    cwd: root, env: { ...process.env, VITE_API_URL: `${origin}/api` }, stdio: ['ignore', 'pipe', 'pipe']
  });
  let browser, socket, send;
  const requests = [], errors = [], unexpected = [];
  let pageDiagnostics = [];
  let rol = 2, nextResponse, heldRequest, postResponse, heldPost;
  let overrides = {}, consultaMeta = meta;
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Vite no inició en 5177')), 15000);
      vite.stdout.on('data', (chunk) => {
        if (chunk.toString().replace(/\x1b\[[0-9;]*m/g, '').includes('127.0.0.1:5177')) { clearTimeout(timeout); resolve(); }
      });
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
      const current = ++id;
      const timer = setTimeout(() => { pending.delete(current); reject(new Error(`Chrome no respondió: ${method}`)); }, 10000);
      pending.set(current, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
      socket.send(JSON.stringify({ id: current, method, params }));
    });
    const respond = (requestId, status, data) => send('Fetch.fulfillRequest', {
      requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(data)).toString('base64')
    });
    socket.addEventListener('close', () => { for (const item of pending.values()) item.reject(new Error('Chrome cerró')); pending.clear(); });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const item = pending.get(message.id); pending.delete(message.id);
        if (message.error) item?.reject(new Error(message.error.message)); else item?.resolve(message.result);
      } else if (message.method === 'Log.entryAdded') {
        if (message.params.entry.level === 'error') pageDiagnostics.push(message.params.entry);
      } else if (message.method === 'Network.loadingFailed') pageDiagnostics.push(message.params);
      else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
      else if (message.method === 'Fetch.requestPaused') {
        const { requestId, request } = message.params;
        const url = new URL(request.url), path = url.pathname, params = url.searchParams;
        requests.push({ path, query: Object.fromEntries(params), method: request.method, ...(request.postData ? { body: JSON.parse(request.postData) } : {}) });
        const finish = (status, data) => { void respond(requestId, status, data).catch((error) => errors.push(error.message)); };
        if (path === '/api/auth/me') {
          finish(rol ? 200 : 401, rol ? { data: { idUsuario: rol, idRol: rol, nombreUsuario: 'inventario-prueba' } } : { message: 'No autenticado' }); return;
        }
        if (!path.startsWith('/api/inventario')) { unexpected.push(path); finish(404, { message: 'Endpoint inesperado' }); return; }
        if (['/api/inventario/ajustes', '/api/inventario/retiros/vencimiento', '/api/inventario/retiros/dano'].includes(path) && request.method === 'POST') {
          const planned = postResponse; postResponse = null;
          if (planned?.hold) heldPost = { requestId, body: JSON.parse(request.postData) };
          else if (planned?.networkError) void send('Fetch.failRequest', { requestId, errorReason: 'ConnectionRefused' });
          else if (planned) finish(planned.status, planned.body);
          else { unexpected.push('POST no previsto'); finish(400, { message: 'POST no previsto' }); }
          return;
        }
        if (nextResponse) {
          const planned = nextResponse; if (!planned.persist) nextResponse = null;
          if (planned.hold) heldRequest = requestId;
          else if (planned.networkError) void send('Fetch.failRequest', { requestId, errorReason: 'ConnectionRefused' });
          else finish(planned.status, planned.body);
          return;
        }
        if (/\/medicamentos\/\d+\/existencias$/.test(path)) {
          const id = Number(path.split('/')[4]);
          finish(id === 999 ? 404 : 200, id === 999 ? { message: 'Medicamento no encontrado' } : { data: existencias.filter((e) => e.idMedicamento === id).map(e => ({ ...e, ...overrides[e.idExistencia] })), meta: consultaMeta });
        } else if (path.endsWith('/movimientos')) finish(200, { data: movimientos });
        else if (path.endsWith('/proximos-a-vencer') || path.endsWith('/vencidos')) {
          const expired = path.endsWith('/vencidos');
          finish(200, { data: existencias.filter((e) => e.vencida === expired).map((e) => ({ ...e, medicamento: medicamentos.find((m) => m.idMedicamento === e.idMedicamento) })), meta: expired ? meta : { ...meta, fechaHasta: '2026-05-15' } });
        } else {
          let data = path.endsWith('/stock-bajo') ? inventario.filter((m) => m.estado && m.stockVendible <= m.stockMinimo) : inventario;
          if (params.has('idMedicamento')) data = data.filter((m) => m.idMedicamento === Number(params.get('idMedicamento')));
          if (params.has('nombreComercial')) data = data.filter((m) => m.nombreComercial.toLowerCase().includes(params.get('nombreComercial').toLowerCase()));
          finish(200, { data, meta });
        }
      }
    });
    await send('Page.enable'); await send('Runtime.enable');
    await send('Log.enable'); await send('Network.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: `${origin}/api/*` }] });
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails)); return result.result.value;
    };
    const waitFor = (expression) => waitUntil(async () => { try { return await evaluate(expression); } catch { return false; } });
    const navigate = async (path) => {
      pageDiagnostics = [];
      await evaluate('window.__navigating = true'); await send('Page.navigate', { url: `${origin}${path}` });
      await waitFor('!window.__navigating && document.readyState === "complete"');
    };
    const ready = async () => {
      await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      try { return await waitFor('!!document.querySelector(".inventario-page") && document.querySelector("[aria-busy]")?.getAttribute("aria-busy") === "false"'); }
      catch (error) {
        const state = await evaluate('({path:location.pathname, text:document.body.textContent.slice(-1800), busy:document.querySelector("[aria-busy]")?.getAttribute("aria-busy")})');
        throw new Error(`${error.message}: ${JSON.stringify(state)}; diagnostico: ${JSON.stringify(pageDiagnostics.slice(-6))}; solicitudes recientes: ${JSON.stringify(requests.slice(-6))}`);
      }
    };
    const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const input = (id, value) => evaluate(`(() => { const input = document.getElementById(${JSON.stringify(id)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles:true })); })()`);
    const submit = async () => {
      await evaluate('document.querySelector(".inventario-filters").requestSubmit()');
      // Esperar el render de la navegación antes de inspeccionar aria-busy;
      // cambiar la URL puede preceder al commit de React bajo carga paralela.
      await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    };
    const bodyContains = (text) => waitFor(`document.querySelector('.inventario-page')?.textContent.includes(${JSON.stringify(text)})`);
    const changeRoute = async (selector, path) => { await click(selector); await waitFor(`location.pathname === ${JSON.stringify(path)}`); await ready(); };
    const screenshot = async (name) => {
      if (process.env.CADEFAR_SCREENSHOT_DIR) {
        const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await writeFile(join(process.env.CADEFAR_SCREENSHOT_DIR, name), Buffer.from(data, 'base64'));
      }
    };

    await t.test('Acceso directo restaura sesión, muestra stock físico/vendible e inactivos sin ocultarlos', async () => {
      await navigate('/inventario'); await ready();
      assert.equal(await evaluate('document.querySelectorAll(".inventario-table tbody tr").length'), 3);
      assert.ok(await evaluate('document.querySelector(".inventario-meta").textContent.includes("15/02/2026")'));
      assert.ok(await evaluate('document.querySelector(".inventario-meta").textContent.includes("America/La_Paz")'));
      const rows = await evaluate('[...document.querySelectorAll(".inventario-table tbody tr")].map(tr => [...tr.querySelectorAll("td")].map(td => td.textContent))');
      assert.equal(rows[0][3], '15'); assert.equal(rows[0][4], '10');
      assert.equal(rows[1][1].trim(), 'Inactivo'); assert.equal(rows[1][3], '4'); assert.equal(rows[1][4], '0');
      assert.ok(await evaluate(`!!document.querySelector('.app-sidebar a[href="/inventario"]')`));
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
      await screenshot('inventario-desktop.png');
    });
    await t.test('Filtros se aplican al consultar; normalizan espacios y preservan caracteres literales en la URL', async () => {
      const count = requests.length;
      await input('inv-codigo', ' PAR%_001 '); await input('inv-nombre', ' Paracetamol '); await input('inv-id-med', '1');
      assert.equal(requests.length, count);
      await submit(); await waitFor('location.search.includes("codigoMedicamento")'); await ready();
      assert.deepEqual(requests.at(-1).query, { codigoMedicamento: 'PAR%_001', nombreComercial: 'Paracetamol', idMedicamento: '1' });
      assert.equal(await evaluate('document.querySelectorAll(".inventario-table tbody tr").length'), 1);
      await navigate(`/inventario${await evaluate('location.search')}`); await ready();
      assert.equal(await evaluate('document.getElementById("inv-codigo").value'), 'PAR%_001');
      assert.equal(await evaluate('document.getElementById("inv-nombre").value'), 'Paracetamol');
    });
    await t.test('IDs inválidos no consultan la API y limpiar restaura listado', async () => {
      const count = requests.length;
      for (const value of ['0', '01', '1.5', '-1', '2147483648']) {
        await input('inv-id-med', value); await submit(); await bodyContains('enteros positivos');
      }
      assert.equal(requests.length, count);
      await click('.inventario-filters button[type="button"]'); await waitFor('location.search === ""'); await ready();
      assert.equal(await evaluate('document.querySelectorAll(".inventario-table tbody tr").length'), 3);
    });
    await t.test('Respuesta vacía ofrece dirección y no conserva filas de la consulta anterior', async () => {
      nextResponse = { status: 200, body: { data: [], meta } };
      await input('inv-nombre', 'No existe'); await submit(); await waitFor('location.search.includes("No+existe")'); await ready();
      await bodyContains('Sin resultados');
      assert.equal(await evaluate('document.querySelectorAll(".inventario-table tbody tr").length'), 0);
      await click('.inventario-filters button[type="button"]'); await waitFor('location.search === ""'); await ready();
    });
    await t.test('Una respuesta tardía no sustituye los filtros nuevos ni sus resultados', async () => {
      nextResponse = { hold: true };
      await input('inv-nombre', 'Antiguo'); await submit(); await waitUntil(() => heldRequest);
      await waitFor('document.querySelector("[aria-busy]").getAttribute("aria-busy") === "true"');
      assert.equal(await evaluate('!!document.querySelector(".inventario-table")'), false);
      await input('inv-nombre', 'Paracetamol'); await submit(); await waitFor('location.search.includes("Paracetamol")'); await ready();
      await respond(heldRequest, 200, { data: [inventario[1]], meta }); heldRequest = null;
      // Barrera de microtareas/render después de la resolución de la respuesta antigua.
      await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      assert.equal(await evaluate('document.querySelectorAll(".inventario-table tbody tr").length'), 1);
      assert.ok(await evaluate('document.querySelector(".inventario-table").textContent.includes("Paracetamol")'));
      assert.equal(await evaluate('document.getElementById("inv-nombre").value'), 'Paracetamol');
    });
    await t.test('Un error tardío de filtros anteriores tampoco sustituye el resultado actual', async () => {
      nextResponse = { hold: true };
      await input('inv-nombre', 'Error antiguo'); await submit(); await waitUntil(() => heldRequest);
      await input('inv-nombre', 'Paracetamol'); await submit(); await waitFor('location.search.includes("Paracetamol")'); await ready();
      await respond(heldRequest, 500, { message: 'Error técnico antiguo' }); heldRequest = null;
      await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      assert.ok(await evaluate('document.querySelector(".inventario-table").textContent.includes("Paracetamol")'));
      assert.equal(await evaluate('!!document.querySelector(".inventario-page [role=alert]")'), false);
    });
    await t.test('CU22 usa endpoint propio, conserva MES histórico y costos diminutos sin reinterpretar fechas', async () => {
      await changeRoute('a[href="/inventario/medicamentos/1/existencias"]', '/inventario/medicamentos/1/existencias');
      const rows = await evaluate('[...document.querySelectorAll(".inventario-table tbody tr")].map(tr => [...tr.querySelectorAll("td")].map(td => td.textContent))');
      assert.equal(rows.length, 2);
      assert.ok(rows[0][1].includes('02/2026')); assert.ok(rows[0][1].includes('01/02/2026'));
      assert.equal(rows[0][2], '01/03/2026'); assert.equal(rows[0][5], '0,000001');
      assert.equal(rows[1][2], '15/02/2026'); assert.equal(rows[1][4], '0'); assert.equal(rows[1][5], '1,123456');
      assert.ok(requests.some((r) => r.path === '/api/inventario/medicamentos/1/existencias' && !Object.keys(r.query).length));
      assert.ok(await evaluate('document.querySelector(".inventario-table").textContent.includes("Último: #101")'));
      await screenshot('existencias-desktop.png');
    });
    await t.test('Medicamento inactivo conserva físico, marcador null y costo máximo exacto', async () => {
      await navigate('/inventario/medicamentos/2/existencias'); await ready();
      const cells = await evaluate('[...document.querySelector(".inventario-table tbody tr").querySelectorAll("td")].map(td => td.textContent)');
      assert.equal(cells[3], '4'); assert.equal(cells[4], '0'); assert.equal(cells[5], '99.999.999,999999');
      assert.ok(cells[6].includes('Sin movimientos'));
    });
    await t.test('Existente sin existencias es vacío; inexistente es 404; ID inválido no genera peticiones', async () => {
      await navigate('/inventario/medicamentos/3/existencias'); await ready(); await bodyContains('todavía no tiene existencias');
      assert.equal(await evaluate('document.querySelector(".page-heading h2").textContent'), 'Sin existencias');
      await navigate('/inventario/medicamentos/999/existencias'); await ready(); await bodyContains('Medicamento no encontrado');
      const count = requests.filter((r) => r.path.startsWith('/api/inventario')).length;
      await navigate('/inventario/medicamentos/1x/existencias'); await ready(); await bodyContains('identificador del medicamento no es válido');
      assert.equal(requests.filter((r) => r.path.startsWith('/api/inventario')).length, count);
    });
    await t.test('Historial conserva motivos históricos, fecha civil, originales, reversiones y referencias', async () => {
      await navigate('/inventario/movimientos?idExistencia=11'); await ready();
      assert.equal(await evaluate('document.getElementById("inv-id-ex").value'), '11');
      const text = await evaluate('document.querySelector(".inventario-table").textContent');
      assert.ok(text.includes('01/02/2026 00:15:00')); assert.ok(text.includes('Compra')); assert.ok(text.includes('Reversión')); assert.ok(text.includes('0,000001'));
      await click('.inventario-trace summary');
      assert.ok(await evaluate('document.querySelector("details[open]").textContent.includes("Observación histórica")'));
      assert.ok(text.includes('#7 / #8')); assert.ok(text.includes('Movimiento original#101')); assert.ok(text.includes('Movimiento de reversión#102'));
      await screenshot('movimientos-desktop.png');
    });
    await t.test('Historial valida rango, envía filtros exactos y restaura al retroceder', async () => {
      const count = requests.length;
      await input('inv-desde', '2026-02-02'); await input('inv-hasta', '2026-02-01'); await submit(); await bodyContains('no puede ser posterior');
      assert.equal(requests.length, count);
      await input('inv-desde', '2026-02-01'); await input('inv-motivo', ' Compra ');
      await evaluate('const select = document.getElementById("inv-direccion"); select.value="ENTRADA"; select.dispatchEvent(new Event("change", {bubbles:true}));');
      await submit(); await waitFor('location.search.includes("desde")'); await ready();
      assert.deepEqual(requests.at(-1).query, { idExistencia: '11', desde: '2026-02-01', hasta: '2026-02-01', direccion: 'ENTRADA', motivo: 'Compra' });
      await click('.inventario-filters button[type="button"]'); await waitFor('location.search === ""'); await ready();
      await evaluate('history.back()'); await waitFor('location.search.includes("desde")'); await ready();
      assert.equal(await evaluate('document.getElementById("inv-motivo").value'), 'Compra');
      assert.equal(await evaluate('document.getElementById("inv-direccion").value'), 'ENTRADA');
    });
    await t.test('Stock bajo utiliza el resultado del backend, incluidos igualdad y catálogo sin existencias', async () => {
      await changeRoute('.inventario-nav a[href="/inventario/stock-bajo"]', '/inventario/stock-bajo');
      const text = await evaluate('document.querySelector(".inventario-table").textContent');
      assert.ok(text.includes('Paracetamol')); assert.ok(text.includes('Sin existencias')); assert.equal(text.includes('Producto inactivo'), false);
      assert.ok(requests.some((r) => r.path === '/api/inventario/stock-bajo'));
    });
    await t.test('Próximos y vencidos consumen consultas distintas y muestran rango comercial e inactivos', async () => {
      await changeRoute('.inventario-nav a[href="/vencimientos"]', '/vencimientos');
      assert.ok(await evaluate('document.querySelector(".inventario-meta").textContent.includes("15/05/2026")'));
      assert.ok(await evaluate('document.querySelector(".inventario-table").textContent.includes("Producto inactivo")'));
      await changeRoute('.inventario-nav a[href="/vencimientos/vencidos"]', '/vencimientos/vencidos');
      assert.equal(await evaluate('document.querySelectorAll(".inventario-table tbody tr").length'), 1);
      assert.ok(await evaluate('document.querySelector(".inventario-table").textContent.includes("PAR001-002")'));
      assert.ok(requests.some((r) => r.path === '/api/inventario/vencidos'));
    });
    await t.test('Errores 400/403/500 y red: mensajes útiles, sin detalles técnicos y sin mostrar datos antiguos', async () => {
      await navigate('/inventario'); await ready();
      for (const planned of [
        { status: 400, body: { message: 'Datos inválidos' }, expected: 'Datos inválidos' },
        { status: 500, body: { message: 'Sequelize: SELECT secreto' }, expected: 'No fue posible cargar' },
        { networkError: true, expected: 'No se pudo conectar' },
        { status: 403, body: { message: 'Acceso denegado' }, expected: 'No tienes autorización' }
      ]) {
        nextResponse = planned;
        await click('.catalogo-toolbar button'); await ready(); await bodyContains(planned.expected);
        assert.equal(await evaluate('!!document.querySelector(".inventario-table")'), false);
        assert.equal(await evaluate('document.querySelector(".inventario-page").textContent.includes("SELECT secreto")'), false);
      }
      await click('.catalogo-toolbar button'); await ready();
      assert.ok(await evaluate('!!document.querySelector(".inventario-table")'));
    });
    await t.test('401 durante consulta ofrece volver al login sin exponer datos anteriores', async () => {
      nextResponse = { status: 401, body: { message: 'No autenticado' } };
      await click('.catalogo-toolbar button'); await ready(); await bodyContains('sesión ya no es válida');
      assert.ok(await evaluate(`!!document.querySelector('.inventario-page a[href="/login"]')`));
      assert.equal(await evaluate('!!document.querySelector(".inventario-table")'), false);
      rol = null;
      await click('.inventario-page a[href="/login"]');
      await waitFor('location.pathname === "/login" && !!document.getElementById("nombreUsuario")');
    });
    await t.test('Todos los roles consultan Inventario/Existencias/Stock bajo; Vendedor no solicita historial/vencimientos', async () => {
      for (const role of [1, 2, 3]) {
        rol = role;
        await navigate('/inventario'); await ready();
        assert.ok(await evaluate(`!!document.querySelector('.app-sidebar a[href="/inventario"]')`));
        assert.equal(await evaluate(`!!document.querySelector('.inventario-nav a[href="/inventario/movimientos"]')`), role !== 3);
        await changeRoute('.inventario-nav a[href="/inventario/stock-bajo"]', '/inventario/stock-bajo');
        await navigate('/inventario/medicamentos/1/existencias'); await ready();
        assert.equal(await evaluate(`!!document.querySelector('.inventario-table a[href^="/inventario/movimientos"]')`), role !== 3);
        if (role === 3) for (const path of ['/inventario/movimientos', '/vencimientos', '/vencimientos/vencidos']) {
          const count = requests.filter((r) => r.path.startsWith('/api/inventario')).length;
          await navigate(path); await waitFor('location.pathname === "/dashboard"');
          assert.equal(requests.filter((r) => r.path.startsWith('/api/inventario')).length, count);
        }
      }
    });
    await t.test('Sin sesión se redirige al login antes de solicitar inventario', async () => {
      rol = null;
      const count = requests.filter((r) => r.path.startsWith('/api/inventario')).length;
      await navigate('/inventario'); await waitFor('location.pathname === "/login" && !!document.getElementById("nombreUsuario")');
      assert.equal(requests.filter((r) => r.path.startsWith('/api/inventario')).length, count);
    });
    await t.test('Móvil 375px: filtros utilizables y tabla desplazable sin desbordar la página', async () => {
      rol = 2; await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
      await navigate('/inventario'); await ready();
      await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      await screenshot('inventario-mobile.png');
      assert.ok(await evaluate('document.documentElement.scrollWidth <= 375'));
      assert.ok(await evaluate('document.querySelector(".catalogo-table-wrap").scrollWidth > document.querySelector(".catalogo-table-wrap").clientWidth'));
      assert.ok(await evaluate('document.getElementById("inv-nombre").getBoundingClientRect().right <= 375'));
      await screenshot('inventario-mobile.png');
      for (const path of ['/inventario/medicamentos/1/existencias', '/inventario/movimientos']) {
        await navigate(path); await ready();
        await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        assert.ok(await evaluate('document.documentElement.scrollWidth <= 375'));
        await evaluate('document.querySelector(".catalogo-table-wrap").scrollLeft = 200');
        assert.ok(await evaluate('document.querySelector(".catalogo-table-wrap").scrollLeft > 0'));
      }
    });
    const posts = () => requests.filter(r => r.method === 'POST');
    const settle = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const clickText = (text) => evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`);
    const observacion = (value) => evaluate(`(() => { const el = document.getElementById('ajuste-observacion'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', {bubbles:true})); })()`);
    const rutaAjuste = (med = 1, ex = 11) => `/inventario/medicamentos/${med}/existencias/${ex}/ajuste`;
    const nuevoConteo = async (med = 1, ex = 11) => {
      rol = 2; overrides = {}; await navigate(rutaAjuste(med, ex)); await ready();
      await observacion(' Conteo verificado\nRevisión física ');
    };
    const revisarConteo = async () => { await evaluate('document.querySelector(".ajuste-form").requestSubmit()'); await settle(); };
    const confirmarConteo = async () => { await revisarConteo(); await waitFor('!!document.querySelector("[role=dialog]")'); await clickText('Confirmar conteo'); await settle(); };
    const fixtureEntrada = { ajusteRealizado: true, idExistencia: 11, saldoAnterior: 10, saldoContado: 12, diferencia: 2, stockFisico: 12,
      costoUnitarioPromedio: '0.020577', ultimoMovimiento: 901, movimiento: { idMovimiento: 901, idExistencia: 11, idUsuario: 2, idDetalleCompra: null, idDetalleVenta: null, idMovimientoOriginal: null,
        direccion: 'ENTRADA', cantidad: 2, costoUnitarioAplicado: '0.123456', motivo: 'AJUSTE', observacion: 'Conteo verificado\nRevisión física', fechaMovimiento: '2026-02-15 00:15:00' } };
    const fixtureSalida = { ...fixtureEntrada, idExistencia: 12, saldoAnterior: 5, saldoContado: 0, diferencia: -5, stockFisico: 0, costoUnitarioPromedio: '1.123456', movimiento: { ...fixtureEntrada.movimiento, idExistencia: 12, direccion: 'SALIDA', cantidad: 5, costoUnitarioAplicado: '1.123456' } };
    const fixtureSinDiferencia = { ajusteRealizado: false, idExistencia: 21, saldoAnterior: 4, saldoContado: 4, diferencia: 0, stockFisico: 4, costoUnitarioPromedio: '99999999.999999', ultimoMovimiento: null, movimiento: null };
    const plan = (data, status = 201) => { postResponse = { status, body: { data } }; };

    await t.test('CU23: acceso desde CU22 consulta un par fresco y ofrece ajustes solo al Regente', async () => {
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
      for (const role of [1, 3]) {
        rol = role; await navigate('/inventario/medicamentos/1/existencias'); await ready();
        assert.equal(await evaluate(`!!document.querySelector('a[href$="/ajuste"]')`), false);
        const count = requests.length; await navigate(rutaAjuste()); await waitFor('location.pathname === "/dashboard"');
        assert.ok(requests.slice(count).every(r => r.path === '/api/auth/me'));
      }
      rol = 2; await navigate('/inventario/medicamentos/1/existencias'); await ready();
      overrides = { 11: { stockFisico: 15, ultimoMovimiento: 500 } };
      const count = requests.filter(r => r.path.endsWith('/existencias')).length;
      await click(`a[href="${rutaAjuste()}"]`); await waitFor(`location.pathname === '${rutaAjuste()}'`); await ready();
      assert.ok(requests.filter(r => r.path.endsWith('/existencias')).length > count);
      const observed = await evaluate('document.querySelector(".ajuste-observado").textContent');
      assert.ok(observed.includes('15')); assert.ok(observed.includes('#500'));
      assert.equal(await evaluate('document.getElementById("ajuste-saldo").value'), '');
    });
    await t.test('CU23: IDs inválidos no consultan; medicamento/relación inexistentes y marcador ausente bloquean preparación', async () => {
      overrides = {}; const count = requests.filter(r => r.path.startsWith('/api/inventario')).length;
      for (const path of [rutaAjuste('0', 11), rutaAjuste(1, '01'), rutaAjuste(1, '2147483648'), rutaAjuste('abc', 11)]) {
        await navigate(path); await ready(); await bodyContains('identificadores');
        assert.equal(await evaluate('!!document.querySelector(".ajuste-form")'), false);
      }
      assert.equal(requests.filter(r => r.path.startsWith('/api/inventario')).length, count);
      for (const path of [rutaAjuste(999, 11), rutaAjuste(1, 21), rutaAjuste(1, 999)]) {
        await navigate(path); await ready(); await bodyContains('Existencia no encontrada');
        assert.equal(await evaluate('!!document.querySelector(".ajuste-form")'), false);
      }
      for (const ultimoMovimiento of [undefined, 0]) {
        overrides = { 11: { ultimoMovimiento } }; await navigate(rutaAjuste()); await ready(); await bodyContains('saldo e historial válidos');
        assert.equal(await evaluate('!!document.querySelector(".ajuste-form")'), false);
      }
      overrides = {};
    });
    await t.test('CU23: conteos/costos inválidos y observación vacía/excesiva no hacen POST', async () => {
      await nuevoConteo(); const count = posts().length;
      for (const saldo of ['-1', '1.5', '1e2', '2147483648']) {
        await input('ajuste-saldo', saldo); await revisarConteo(); await bodyContains('saldo contado debe ser un entero');
      }
      await input('ajuste-saldo', '10');
      for (const value of ['   ', 'a'.repeat(501)]) { await observacion(value); await revisarConteo(); await bodyContains('observación es obligatoria'); }
      await observacion('Conteo con entrada'); await input('ajuste-saldo', '12');
      for (const costo of ['0', '-1', '1,2', '1e2', '0.1234567', '100000000', '0.000000']) {
        await input('ajuste-costo', costo); await revisarConteo();
        assert.equal(await evaluate('!!document.querySelector("[role=dialog]")'), false);
        assert.ok(await evaluate('document.querySelector(".ajuste-form .feedback").textContent.includes("costo")'));
      }
      for (const costo of ['0.000001', '99999999.999999']) {
        await input('ajuste-costo', costo); await revisarConteo(); await waitFor('!!document.querySelector("[role=dialog]")');
        await clickText('Volver al conteo');
      }
      assert.equal(posts().length, count);
    });
    await t.test('CU23: entrada envía solo el conteo, costo decimal y par observado; bloquea doble confirmación', async () => {
      await nuevoConteo(); await input('ajuste-saldo', '12'); await input('ajuste-costo', '0.123456');
      await screenshot('ajuste-entrada-desktop.png');
      postResponse = { hold: true }; const count = posts().length; await confirmarConteo(); await waitUntil(() => heldPost);
      assert.deepEqual(heldPost.body, { idExistencia: 11, saldoContado: 12, stockObservado: 10, ultimoMovimientoObservado: 101, observacion: 'Conteo verificado\nRevisión física', costoUnitario: '0.123456' });
      assert.deepEqual(posts().at(-1).query, {});
      await evaluate(`document.querySelector('.modal__actions .button--primary').click(); document.querySelector('.modal__header button').click(); window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);
      assert.equal(posts().length, count + 1); assert.ok(await evaluate('!!document.querySelector("[role=dialog]")'));
      assert.ok(await evaluate('document.querySelector(".ajuste-form fieldset").disabled'));
      await screenshot('ajuste-confirmacion.png');
      overrides = { 11: { stockFisico: 12, stockVendible: 12, ultimoMovimiento: 901, costoUnitarioPromedio: '0.020577' } };
      await respond(heldPost.requestId, 201, { data: fixtureEntrada }); heldPost = null; await bodyContains('Ajuste registrado');
      const text = await evaluate('document.querySelector(".ajuste-resultado").textContent');
      assert.ok(text.includes('0,020577')); assert.ok(text.includes('0,123456')); assert.ok(text.includes('15/02/2026 00:15:00'));
      assert.ok(text.includes('AJUSTE')); assert.equal(await evaluate('!!document.querySelector(".ajuste-form")'), false);
      await click('.ajuste-resultado a[href="/inventario/medicamentos/1/existencias"]'); await ready();
      const rows = await evaluate('[...document.querySelectorAll(".inventario-table tbody tr")].map(tr => [...tr.querySelectorAll("td")].map(td=>td.textContent))');
      assert.equal(rows[0][3], '12'); assert.equal(rows[0][4], '12');
    });
    await t.test('CU23: salida hasta cero de existencia vencida omite costo y conserva promedio del backend', async () => {
      await nuevoConteo(1, 12); await input('ajuste-saldo', '6'); await input('ajuste-costo', '5.123456');
      await input('ajuste-saldo', '0'); assert.equal(await evaluate('!!document.getElementById("ajuste-costo")'), false);
      plan(fixtureSalida); await confirmarConteo(); await bodyContains('Ajuste registrado');
      assert.deepEqual(posts().at(-1).body, { idExistencia: 12, saldoContado: 0, stockObservado: 5, ultimoMovimientoObservado: 102, observacion: 'Conteo verificado\nRevisión física' });
      const text = await evaluate('document.querySelector(".ajuste-resultado").textContent');
      assert.ok(text.includes('Salida')); assert.ok(text.includes('1,123456'));
    });
    await t.test('CU23: inactivo, marcador null y sin diferencia muestran conciliación sin movimiento/auditoría', async () => {
      await nuevoConteo(2, 21); await input('ajuste-saldo', '4'); await observacion('Esta observación no queda persistida');
      assert.ok(await evaluate('document.querySelector(".ajuste-observado").textContent.includes("Sin movimientos")'));
      assert.ok(await evaluate('document.querySelector(".catalogo-status").textContent.includes("Inactivo")'));
      assert.equal(await evaluate('!!document.getElementById("ajuste-costo")'), false);
      plan(fixtureSinDiferencia, 200); await confirmarConteo(); await bodyContains('No fue necesario ajustar');
      assert.equal(posts().at(-1).body.ultimoMovimientoObservado, null); assert.equal(Object.hasOwn(posts().at(-1).body, 'costoUnitario'), false);
      const text = await evaluate('document.querySelector(".ajuste-resultado").textContent');
      assert.ok(text.includes('no se guardaron como auditoría')); assert.ok(text.includes('99.999.999,999999'));
      assert.equal(text.includes('Esta observación no queda persistida'), false);
      assert.equal(text.includes('Movimiento registrado'), false);
      await clickText('Preparar otro conteo'); await ready();
      assert.equal(await evaluate('document.getElementById("ajuste-saldo").value'), '');
      assert.equal(await evaluate('document.getElementById("ajuste-observacion").value'), '');
    });
    await t.test('CU23: salida al promedio cero consume el resultado sin inventar costo alternativo', async () => {
      overrides = { 11: { costoUnitarioPromedio: '0.000000' } }; await navigate(rutaAjuste()); await ready();
      await input('ajuste-saldo', '8'); await observacion('Conteo de salida');
      plan({ ...fixtureEntrada, saldoContado: 8, stockFisico: 8, diferencia: -2, costoUnitarioPromedio: '0.000000', movimiento: { ...fixtureEntrada.movimiento, direccion: 'SALIDA', costoUnitarioAplicado: '0.000000' } });
      await confirmarConteo(); await bodyContains('Ajuste registrado');
      assert.equal(Object.hasOwn(posts().at(-1).body, 'costoUnitario'), false);
      assert.ok(await evaluate('document.querySelector(".ajuste-resultado").textContent.includes("0,000000")'));
    });
    await t.test('CU23: 409 con saldo restaurado/historial distinto obliga reconsulta sin cambiar el borrador ni reenviar', async () => {
      await nuevoConteo(); await input('ajuste-saldo', '10');
      postResponse = { status: 409, body: { message: 'La existencia cambió. Consulte su saldo e historial antes de ajustar' } };
      await confirmarConteo(); await bodyContains('La existencia cambió'); await waitFor('!document.querySelector("[role=dialog]")');
      const count = posts().length; await revisarConteo(); assert.equal(posts().length, count);
      assert.equal(await evaluate('document.querySelector(".ajuste-form button[type=submit]").disabled'), true);
      overrides = { 11: { ultimoMovimiento: 777 } }; await clickText('Volver a consultar la existencia'); await ready();
      assert.equal(await evaluate('document.getElementById("ajuste-saldo").value'), '10');
      assert.ok(await evaluate('document.getElementById("ajuste-observacion").value.includes("Revisión física")'));
      assert.ok(await evaluate('document.querySelector(".ajuste-observado").textContent.includes("#777")'));
      plan({ ...fixtureSinDiferencia, idExistencia: 11, saldoAnterior: 10, saldoContado: 10, stockFisico: 10, costoUnitarioPromedio: '0.000001', ultimoMovimiento: 777 }, 200);
      await confirmarConteo(); await bodyContains('No fue necesario ajustar');
      assert.equal(posts().at(-1).body.ultimoMovimientoObservado, 777); assert.equal(posts().at(-1).body.stockObservado, 10);
    });
    await t.test('CU23: un stock nuevo puede cambiar la entrada a salida solo tras reconsulta y nueva revisión', async () => {
      await nuevoConteo(); await input('ajuste-saldo', '12'); await input('ajuste-costo', '9.123456');
      postResponse = { status: 409, body: { message: 'Conflicto de stock' } }; await confirmarConteo(); await bodyContains('Conflicto de stock');
      overrides = { 11: { stockFisico: 14, ultimoMovimiento: 778 } }; await clickText('Volver a consultar la existencia'); await ready();
      assert.equal(await evaluate('document.getElementById("ajuste-saldo").value'), '12');
      assert.equal(await evaluate('!!document.getElementById("ajuste-costo")'), false);
      plan({ ...fixtureEntrada, saldoAnterior: 14, saldoContado: 12, diferencia: -2, costoUnitarioPromedio: '0.000001', movimiento: { ...fixtureEntrada.movimiento, direccion: 'SALIDA', costoUnitarioAplicado: '0.000001' } });
      await confirmarConteo(); await bodyContains('Ajuste registrado');
      assert.equal(posts().at(-1).body.stockObservado, 14); assert.equal(posts().at(-1).body.ultimoMovimientoObservado, 778);
      assert.equal(Object.hasOwn(posts().at(-1).body, 'costoUnitario'), false);
    });
    await t.test('CU23: 400 conserva campos y permite corrección; red/500 exigen consultar resultado sin reintentos automáticos', async () => {
      await nuevoConteo(); await input('ajuste-saldo', '12'); await input('ajuste-costo', '0.123456');
      postResponse = { status: 400, body: { message: 'Datos inválidos' } }; await confirmarConteo(); await bodyContains('Datos inválidos');
      assert.equal(await evaluate('document.getElementById("ajuste-costo").value'), '0.123456');
      for (const planned of [{ networkError: true }, { status: 500, body: { message: 'SELECT password_hash' } }]) {
        postResponse = planned; await confirmarConteo(); await waitFor('!document.querySelector("[role=dialog]")');
        assert.equal(await evaluate('document.querySelector(".ajuste-form button[type=submit]").disabled'), true);
        assert.equal(await evaluate('document.querySelector(".ajuste-page").textContent.includes("password_hash")'), false);
        const count = posts().length; await revisarConteo(); assert.equal(posts().length, count);
        await clickText('Volver a consultar la existencia'); await ready();
        assert.equal(await evaluate('document.getElementById("ajuste-saldo").value'), '12');
      }
    });
    await t.test('CU23: 404 tras preparar exige reconsulta y carga fallida conserva el borrador al recuperarse', async () => {
      await nuevoConteo(); await input('ajuste-saldo', '9');
      postResponse = { status: 404, body: { message: 'Existencia no encontrada' } }; await confirmarConteo(); await bodyContains('Existencia no encontrada');
      nextResponse = { status: 500, body: { message: 'Fallo técnico' }, persist: true };
      await clickText('Volver a consultar la existencia'); await ready();
      assert.equal(await evaluate('!!document.querySelector(".ajuste-form")'), false);
      nextResponse = null; await clickText('Reintentar'); await ready();
      assert.equal(await evaluate('document.getElementById("ajuste-saldo").value'), '9');
    });
    await t.test('CU23: 401/403 bloquean envío; 401 descarta sesión pública con navegación completa', async () => {
      for (const status of [403, 401]) {
        await nuevoConteo(); await input('ajuste-saldo', '10');
        postResponse = { status, body: { message: 'Denegado' } }; await confirmarConteo(); await waitFor('!document.querySelector("[role=dialog]")');
        await bodyContains(status === 401 ? 'sesión ya no es válida' : 'No tienes autorización');
        assert.equal(await evaluate('document.querySelector(".ajuste-form button[type=submit]").disabled'), true);
      }
      rol = null; await click('.ajuste-form a[href="/login"]'); await waitFor('location.pathname === "/login" && !!document.getElementById("nombreUsuario")');
    });
    await t.test('CU23: respuesta tardía tras salir no altera otra ruta ni su consulta', async () => {
      await nuevoConteo(); await input('ajuste-saldo', '12'); await input('ajuste-costo', '0.123456');
      postResponse = { hold: true }; await confirmarConteo(); await waitUntil(() => heldPost);
      await click('.app-sidebar a[href="/inventario"]'); await waitFor('location.pathname === "/inventario"'); await ready();
      await respond(heldPost.requestId, 201, { data: fixtureEntrada }); heldPost = null; await settle();
      assert.equal(await evaluate('location.pathname'), '/inventario');
      assert.equal(await evaluate('!!document.querySelector(".ajuste-resultado")'), false);
    });
    await t.test('CU23: pantalla y revisión móvil a 375px sin desbordamiento', async () => {
      await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
      await nuevoConteo(); await input('ajuste-saldo', '12'); await input('ajuste-costo', '0.123456'); await settle();
      assert.ok(await evaluate('document.documentElement.scrollWidth <= 375')); await screenshot('ajuste-mobile.png');
      await revisarConteo(); await waitFor('!!document.querySelector("[role=dialog]")');
      assert.ok(await evaluate('document.documentElement.scrollWidth <= 375')); await clickText('Volver al conteo');
    });
    const rutaRetiro = (tipo = 'dano', med = 1, ex = 11) => `/inventario/medicamentos/${med}/existencias/${ex}/retiro-${tipo}`;
    const nuevoRetiro = async (tipo = 'dano', med = 1, ex = 11) => {
      rol = 2; overrides = {}; consultaMeta = meta; await navigate(rutaRetiro(tipo, med, ex)); await ready();
    };
    const observacionRetiro = (value) => evaluate(`(() => { const el = document.getElementById('retiro-observacion'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    const revisarRetiro = async () => { await evaluate('document.querySelector(".retiro-form").requestSubmit()'); await settle(); };
    const confirmarRetiro = async () => { await revisarRetiro(); await waitFor('!!document.querySelector("[role=dialog]")'); await clickText('Confirmar retiro'); await settle(); };
    const fixtureVencimiento = { idExistencia: 12, saldoAnterior: 5, cantidadRetirada: 5, stockFisico: 0, costoUnitarioPromedio: '1.123456', perdida: '5.62', ultimoMovimiento: 1001,
      movimiento: { idMovimiento: 1001, idExistencia: 12, idUsuario: 2, idDetalleCompra: null, idDetalleVenta: null, idMovimientoOriginal: null, direccion: 'SALIDA', cantidad: 5,
        costoUnitarioAplicado: '1.123456', motivo: 'VENCIMIENTO', observacion: null, fechaMovimiento: '2026-02-15 00:15:00' } };
    const fixtureDano = { idExistencia: 11, saldoAnterior: 10, cantidadRetirada: 2, stockFisico: 8, costoUnitarioPromedio: '0.000001', perdida: '0.00', ultimoMovimiento: 1002,
      movimiento: { ...fixtureVencimiento.movimiento, idMovimiento: 1002, idExistencia: 11, cantidad: 2, costoUnitarioAplicado: '0.000001', motivo: 'DAÑO', observacion: 'Envase roto\nUnidades identificadas' } };
    const fixtureMaximo = { idExistencia: 21, saldoAnterior: 2147483647, cantidadRetirada: 2147483647, stockFisico: 0, costoUnitarioPromedio: '99999999.999999', perdida: '214748364699997852.52', ultimoMovimiento: 1003,
      movimiento: { ...fixtureDano.movimiento, idMovimiento: 1003, idExistencia: 21, cantidad: 2147483647, costoUnitarioAplicado: '99999999.999999' } };

    await t.test('CU35/CU36: acciones solo Regente; vencidos enlaza y cada retiro carga un par nuevo desde CU22', async () => {
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
      for (const role of [1, 3]) {
        rol = role; await navigate('/inventario/medicamentos/1/existencias'); await ready();
        assert.equal(await evaluate(`!!document.querySelector('a[href*="/retiro-"]')`), false);
        for (const tipo of ['dano', 'vencimiento']) {
          const count = requests.length; await navigate(rutaRetiro(tipo, 1, 12)); await waitFor('location.pathname === "/dashboard"');
          assert.ok(requests.slice(count).every(r => r.path === '/api/auth/me'));
        }
      }
      rol = 2; await navigate('/inventario/medicamentos/1/existencias'); await ready();
      assert.equal(await evaluate(`!!document.querySelector('a[href="${rutaRetiro('vencimiento')}"]')`), false);
      assert.ok(await evaluate(`!!document.querySelector('a[href="${rutaRetiro()}"]')`));
      overrides = { 12: { stockFisico: 8, ultimoMovimiento: 800 } }; await navigate('/vencimientos/vencidos'); await ready();
      await click(`a[href="${rutaRetiro('vencimiento', 1, 12)}"]`); await waitFor(`location.pathname === '${rutaRetiro('vencimiento', 1, 12)}'`); await ready();
      assert.ok(await evaluate('document.querySelector(".retiro-observado").textContent.includes("#800")'));
      assert.ok(await evaluate('document.querySelector(".retiro-observado").textContent.includes("8")'));
      assert.equal(await evaluate('document.getElementById("retiro-cantidad").value'), '');
    });
    await t.test('CU35/CU36: IDs, pertenencia y marcador ausente impiden preparar el retiro', async () => {
      for (const tipo of ['dano', 'vencimiento']) {
        const count = requests.filter(r => r.path.startsWith('/api/inventario')).length;
        await navigate(rutaRetiro(tipo, 1, '0')); await ready(); await bodyContains('identificadores');
        assert.equal(requests.filter(r => r.path.startsWith('/api/inventario')).length, count);
        await navigate(rutaRetiro(tipo, 1, 21)); await ready(); await bodyContains('Existencia no encontrada');
        overrides = { 12: { ultimoMovimiento: undefined } };
        await navigate(rutaRetiro(tipo, 1, 12)); await ready(); await bodyContains('saldo e historial válidos');
        assert.equal(await evaluate('!!document.querySelector(".retiro-form")'), false);
      }
      overrides = {};
    });
    await t.test('CU35: MES no vencido bloquea el formulario; reconsulta del corte backend lo habilita sin convertir fecha histórica', async () => {
      await nuevoRetiro('vencimiento'); await bodyContains('todavía no está vencida');
      assert.equal(await evaluate('!!document.querySelector(".retiro-form")'), false);
      assert.ok(await evaluate('document.querySelector(".retiro-observado").textContent.includes("02/2026")'));
      overrides = { 11: { vencida: true, stockVendible: 0 } }; consultaMeta = { ...meta, fechaComercial: '2026-03-01' };
      await clickText('Volver a consultar la existencia'); await ready();
      assert.ok(await evaluate('!!document.querySelector(".retiro-form")'));
      assert.ok(await evaluate('document.querySelector(".inventario-meta").textContent.includes("01/03/2026")'));
      await input('retiro-cantidad', '1'); await revisarRetiro(); await waitFor('!!document.querySelector("[role=dialog]")'); await clickText('Volver al retiro');
    });
    await t.test('CU35/CU36: saldo agotado bloquea; cantidades inválidas o superiores al físico no hacen POST', async () => {
      for (const tipo of ['dano', 'vencimiento']) {
        overrides = { 12: { stockFisico: 0 } }; await navigate(rutaRetiro(tipo, 1, 12)); await ready(); await bodyContains('Sin saldo físico para retirar');
        assert.equal(await evaluate('!!document.querySelector(".retiro-form")'), false);
        await nuevoRetiro(tipo, 1, 12); await observacionRetiro('Unidades identificadas'); const count = posts().length;
        for (const value of ['0', '-1', '1.5', '1e2', '2147483648', '6']) {
          await input('retiro-cantidad', value); await revisarRetiro();
          assert.equal(await evaluate('!!document.querySelector("[role=dialog]")'), false);
          assert.ok(await evaluate('document.querySelector(".retiro-form .feedback").textContent.includes("cantidad")'));
        }
        assert.equal(posts().length, count);
      }
    });
    await t.test('CU35: vencimiento DIA omite observación vacía, conserva promedio al agotar y muestra pérdida del servidor', async () => {
      await nuevoRetiro('vencimiento', 1, 12); await input('retiro-cantidad', '5'); await observacionRetiro('   ');
      plan(fixtureVencimiento); await confirmarRetiro(); await bodyContains('Retiro por vencimiento registrado');
      assert.equal(posts().at(-1).path, '/api/inventario/retiros/vencimiento');
      assert.deepEqual(posts().at(-1).body, { idExistencia: 12, cantidad: 5, stockObservado: 5, ultimoMovimientoObservado: 102 });
      assert.deepEqual(posts().at(-1).query, {});
      const text = await evaluate('document.querySelector(".retiro-resultado").textContent');
      assert.ok(text.includes('1,123456')); assert.ok(text.includes('5,62')); assert.ok(text.includes('Sin observación')); assert.ok(text.includes('15/02/2026 00:15:00'));
      assert.equal(await evaluate('!!document.querySelector(".retiro-form")'), false);
      await click('.retiro-resultado a[href="/inventario/movimientos?idExistencia=12"]'); await ready();
      assert.equal(requests.at(-1).query.idExistencia, '12');
    });
    await t.test('CU35/CU36: observación de daño obligatoria, límite 500 y observación opcional normalizada para vencimiento', async () => {
      await nuevoRetiro(); await input('retiro-cantidad', '2'); const count = posts().length;
      for (const value of ['   ', 'a'.repeat(501)]) { await observacionRetiro(value); await revisarRetiro(); await bodyContains('observación del daño es obligatoria'); }
      assert.equal(posts().length, count);
      await nuevoRetiro('vencimiento', 1, 12); await input('retiro-cantidad', '2'); await observacionRetiro('a'.repeat(501)); await revisarRetiro(); await bodyContains('observación admite hasta 500');
      await observacionRetiro(' Retiro documentado ');
      plan({ ...fixtureVencimiento, cantidadRetirada: 2, stockFisico: 3, perdida: '2.25', movimiento: { ...fixtureVencimiento.movimiento, cantidad: 2, observacion: 'Retiro documentado' } });
      await confirmarRetiro(); await bodyContains('Retiro por vencimiento registrado');
      assert.equal(posts().at(-1).body.observacion, 'Retiro documentado');
    });
    await t.test('CU36: daño no exige vencimiento, contrato exacto sin costo y confirmación bloquea duplicados', async () => {
      await nuevoRetiro(); await input('retiro-cantidad', '2'); await observacionRetiro(' Envase roto\nUnidades identificadas ');
      assert.equal(await evaluate('!!document.querySelector(".retiro-form input[inputmode=decimal]")'), false);
      await screenshot('retiro-dano-desktop.png');
      postResponse = { hold: true }; const count = posts().length; await confirmarRetiro(); await waitUntil(() => heldPost);
      assert.equal(posts().at(-1).path, '/api/inventario/retiros/dano');
      assert.deepEqual(heldPost.body, { idExistencia: 11, cantidad: 2, stockObservado: 10, ultimoMovimientoObservado: 101, observacion: 'Envase roto\nUnidades identificadas' });
      await evaluate(`document.querySelector('.modal__actions .button--danger').click(); document.querySelector('.modal__header button').click(); window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);
      assert.equal(posts().length, count + 1); assert.ok(await evaluate('!!document.querySelector("[role=dialog]")'));
      await screenshot('retiro-confirmacion.png');
      overrides = { 11: { stockFisico: 8, stockVendible: 8, ultimoMovimiento: 1002 } };
      await respond(heldPost.requestId, 201, { data: fixtureDano }); heldPost = null; await bodyContains('Retiro por daño registrado');
      assert.ok(await evaluate('document.querySelector(".retiro-resultado").textContent.includes("0,000001")'));
      assert.equal(await evaluate('document.querySelector(".retiro-perdida dd").textContent'), '0,00');
      await click('.retiro-resultado a[href="/inventario/medicamentos/1/existencias"]'); await ready();
      const cells = await evaluate('[...document.querySelector(".inventario-table tbody tr").querySelectorAll("td")].map(td=>td.textContent)');
      assert.equal(cells[3], '8'); assert.equal(cells[4], '8');
    });
    await t.test('CU35/CU36: inactivo/vencido con promedio cero se admite; marcador null y pérdida cero se conservan', async () => {
      for (const tipo of ['dano', 'vencimiento']) {
        overrides = { 21: { vencida: true, costoUnitarioPromedio: '0.000000' } }; consultaMeta = { ...meta, fechaComercial: '2026-03-02' };
        await navigate(rutaRetiro(tipo, 2, 21)); await ready(); await input('retiro-cantidad', '4');
        if (tipo === 'dano') await observacionRetiro('Envase inutilizable');
        plan({ ...fixtureMaximo, saldoAnterior: 4, cantidadRetirada: 4, costoUnitarioPromedio: '0.000000', perdida: '0.00', movimiento: { ...fixtureMaximo.movimiento, cantidad: 4, motivo: tipo === 'dano' ? 'DAÑO' : 'VENCIMIENTO', costoUnitarioAplicado: '0.000000', observacion: tipo === 'dano' ? 'Envase inutilizable' : null } });
        await confirmarRetiro(); await bodyContains('registrado');
        assert.equal(posts().at(-1).body.ultimoMovimientoObservado, null);
        assert.ok(await evaluate('document.querySelector(".retiro-resultado").textContent.includes("0,000000")'));
        assert.equal(await evaluate('document.querySelector(".retiro-perdida dd").textContent'), '0,00');
      }
    });
    await t.test('CU36: pérdida máxima derivada se presenta exacta sin límite DECIMAL(14,2) ni Number', async () => {
      overrides = { 21: { stockFisico: 2147483647 } }; await navigate(rutaRetiro('dano', 2, 21)); await ready();
      await input('retiro-cantidad', '2147483647'); await observacionRetiro('Envase roto\nUnidades identificadas'); plan(fixtureMaximo);
      await confirmarRetiro(); await bodyContains('Retiro por daño registrado');
      assert.equal(await evaluate('document.querySelector(".retiro-perdida dd").textContent'), '214.748.364.699.997.852,52');
      await screenshot('retiro-perdida-maxima.png');
      await clickText('Preparar otro retiro'); await ready();
      assert.equal(await evaluate('document.getElementById("retiro-cantidad").value'), '');
      assert.equal(await evaluate('document.getElementById("retiro-observacion").value'), '');
    });
    await t.test('CU35/CU36: 409 con saldo restaurado e historial cambiado exige reconsulta y mantiene borrador', async () => {
      for (const tipo of ['dano', 'vencimiento']) {
        const ex = tipo === 'dano' ? 11 : 12; await nuevoRetiro(tipo, 1, ex); await input('retiro-cantidad', '2'); await observacionRetiro('Revisión documentada');
        postResponse = { status: 409, body: { message: 'La existencia cambió. Consulte su saldo e historial antes de retirar' } };
        await confirmarRetiro(); await bodyContains('La existencia cambió'); await waitFor('!document.querySelector("[role=dialog]")');
        const count = posts().length; await revisarRetiro(); assert.equal(posts().length, count);
        assert.equal(await evaluate('document.querySelector(".retiro-form button[type=submit]").disabled'), true);
        overrides = { [ex]: { ultimoMovimiento: 888 } }; await clickText('Volver a consultar la existencia'); await ready();
        assert.equal(await evaluate('document.getElementById("retiro-cantidad").value'), '2');
        assert.equal(await evaluate('document.getElementById("retiro-observacion").value'), 'Revisión documentada');
        plan(tipo === 'dano' ? fixtureDano : { ...fixtureVencimiento, cantidadRetirada: 2, stockFisico: 3, perdida: '2.25', movimiento: { ...fixtureVencimiento.movimiento, cantidad: 2, observacion: 'Revisión documentada' } });
        await confirmarRetiro(); await bodyContains('registrado'); assert.equal(posts().at(-1).body.ultimoMovimientoObservado, 888);
      }
    });
    await t.test('CU35/CU36: red/500 no reintentan; al reconsultar saldo insuficiente el usuario debe corregir cantidad', async () => {
      for (const tipo of ['dano', 'vencimiento']) {
        await nuevoRetiro(tipo, 1, 12); await input('retiro-cantidad', '4'); await observacionRetiro('Unidades identificadas');
        postResponse = tipo === 'dano' ? { networkError: true } : { status: 500, body: { message: 'SELECT password_hash' } };
        await confirmarRetiro(); await waitFor('!document.querySelector("[role=dialog]")');
        assert.equal(await evaluate('document.querySelector(".retiro-form button[type=submit]").disabled'), true);
        assert.equal(await evaluate('document.querySelector(".retiro-page").textContent.includes("password_hash")'), false);
        const count = posts().length;
        overrides = { 12: { stockFisico: 1, ultimoMovimiento: 889 } }; await clickText('Volver a consultar la existencia'); await ready();
        assert.equal(await evaluate('document.getElementById("retiro-cantidad").value'), '4');
        await revisarRetiro(); await bodyContains('no puede superar el stock físico observado'); assert.equal(posts().length, count);
      }
    });
    await t.test('CU35/CU36: 400 conserva campos, 404 exige reconsulta y una carga fallida no elimina el borrador', async () => {
      await nuevoRetiro(); await input('retiro-cantidad', '2'); await observacionRetiro('Envase roto');
      for (const status of [400, 404]) {
        postResponse = { status, body: { message: status === 400 ? 'Datos inválidos' : 'Existencia no encontrada' } }; await confirmarRetiro(); await waitFor('!document.querySelector("[role=dialog]")');
        assert.equal(await evaluate('document.getElementById("retiro-observacion").value'), 'Envase roto');
      }
      nextResponse = { status: 500, body: { message: 'Fallo técnico' }, persist: true }; await clickText('Volver a consultar la existencia'); await ready();
      assert.equal(await evaluate('!!document.querySelector(".retiro-form")'), false);
      nextResponse = null; await clickText('Reintentar'); await ready();
      assert.equal(await evaluate('document.getElementById("retiro-cantidad").value'), '2');
      assert.equal(await evaluate('document.getElementById("retiro-observacion").value'), 'Envase roto');
    });
    await t.test('CU35/CU36: 401/403 bloquean retiros y 401 recarga el login para descartar la sesión obsoleta', async () => {
      for (const tipo of ['dano', 'vencimiento']) {
        for (const status of [403, 401]) {
          await nuevoRetiro(tipo, 1, 12); await input('retiro-cantidad', '2'); await observacionRetiro('Unidades identificadas');
          postResponse = { status, body: { message: 'Denegado' } }; await confirmarRetiro(); await waitFor('!document.querySelector("[role=dialog]")');
          assert.equal(await evaluate('document.querySelector(".retiro-form button[type=submit]").disabled'), true);
          await bodyContains(status === 401 ? 'sesión ya no es válida' : 'No tienes autorización');
        }
      }
      rol = null; await click('.retiro-form a[href="/login"]'); await waitFor('location.pathname === "/login" && !!document.getElementById("nombreUsuario")');
      const count = posts().length; await navigate(rutaRetiro()); await waitFor('location.pathname === "/login"'); assert.equal(posts().length, count);
    });
    await t.test('CU35/CU36: respuesta tardía al salir no altera otra ruta', async () => {
      await nuevoRetiro(); await input('retiro-cantidad', '2'); await observacionRetiro('Envase roto'); postResponse = { hold: true }; await confirmarRetiro(); await waitUntil(() => heldPost);
      await click('.app-sidebar a[href="/inventario"]'); await waitFor('location.pathname === "/inventario"'); await ready();
      await respond(heldPost.requestId, 201, { data: fixtureDano }); heldPost = null; await settle();
      assert.equal(await evaluate('location.pathname'), '/inventario'); assert.equal(await evaluate('!!document.querySelector(".retiro-resultado")'), false);
    });
    await t.test('CU35/CU36: formularios, revisión y pérdida máxima a 375px no desbordan la pantalla', async () => {
      await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
      for (const tipo of ['dano', 'vencimiento']) {
        await nuevoRetiro(tipo, 1, 12); await input('retiro-cantidad', '2'); await observacionRetiro('Unidades identificadas'); await settle();
        await evaluate('document.querySelector(".retiro-form").scrollIntoView({block:"center"})');
        assert.ok(await evaluate('document.documentElement.scrollWidth <= 375')); await screenshot(`retiro-${tipo}-mobile.png`);
        await revisarRetiro(); await waitFor('!!document.querySelector("[role=dialog]")'); assert.ok(await evaluate('document.documentElement.scrollWidth <= 375')); await clickText('Volver al retiro');
      }
      overrides = { 21: { stockFisico: 2147483647 } }; await navigate(rutaRetiro('dano', 2, 21)); await ready(); await input('retiro-cantidad', '2147483647'); await observacionRetiro('Envase roto'); plan(fixtureMaximo);
      await confirmarRetiro(); await bodyContains('Retiro por daño registrado'); await settle();
      assert.ok(await evaluate('document.documentElement.scrollWidth <= 375'));
      await evaluate('document.querySelector(".retiro-perdida").scrollIntoView({block:"center"})'); await screenshot('retiro-perdida-mobile.png');
    });
    await t.test('Cierre: contratos previstos, almacenamiento vacío y sin errores JavaScript', async () => {
      assert.ok(requests.every((request) => request.method === 'GET' || (request.method === 'POST' && ['/api/inventario/ajustes', '/api/inventario/retiros/vencimiento', '/api/inventario/retiros/dano'].includes(request.path))));
      assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
      assert.ok(await evaluate('localStorage.length === 0 && sessionStorage.length === 0'));
      t.diagnostic(`${requests.filter((request) => request.path.startsWith('/api/inventario')).length} peticiones de Inventario interceptadas (${posts().length} POST simulados); sin MySQL.`);
    });
  } finally {
    if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch { /* Chrome puede cerrar primero. */ } socket.close(); }
    browser?.kill(); vite.kill();
    await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }).catch(() => {});
  }
});
