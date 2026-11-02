// React real y API interceptada: sin MySQL, escrituras reales ni capturas.
// Ejecutar con Node >= 24 y Chrome/Edge: node --test tests/ventas-consulta.browser.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
    const result = await predicate();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error('Tiempo agotado esperando Ventas');
};
const venta = (idVenta, estadoOperacion) => ({
  idVenta, idUsuario: 3, estadoOperacion, claveOperacion: `venta-${idVenta}`,
  fechaRegistro: '2026-11-01 23:15:00', fechaVenta: idVenta === 1 ? null : '2026-11-02 00:10:00',
  total: '999999999999.99', fechaAnulacion: estadoOperacion === 'ANULADA' ? '2026-11-02 10:00:00' : null,
  motivoAnulacion: estadoOperacion === 'ANULADA' ? 'Solicitud documentada' : null,
  idUsuarioAnulador: estadoOperacion === 'ANULADA' ? 1 : null,
  usuarioRegistrador: { idUsuario: 3, nombreUsuario: 'vendedor' },
  usuarioAnulador: estadoOperacion === 'ANULADA' ? { idUsuario: 1, nombreUsuario: 'administrador' } : null
});
const ventas = [venta(1, 'PENDIENTE'), venta(2, 'CONFIRMADA'), venta(3, 'ANULADA')];
const detalle = (idDetalleVenta, idExistencia) => ({
  idDetalleVenta, idVenta: 1, idExistencia, idReceta: 7, cantidad: 2, precioUnitario: '10.50', subtotal: '21.00',
  existencia: { idExistencia, idMedicamento: 5, codigoExistencia: `PAR005-${idExistencia}`,
    fechaVencimiento: '2027-02-28', precisionVencimiento: 'MES', medicamento: {
      idMedicamento: 5, codigoMedicamento: 'PAR005', nombreComercial: 'Medicamento de prueba',
      formaFarmaceutica: 'Tableta', presentacion: '500 mg', unidadInventario: 'tableta', estado: true
    } }
});

test('CU28/CU29/CU30: ventas React con API simulada', { timeout: 120000 }, async (t) => {
  assert.ok(browserPath, 'Configura CADEFAR_TEST_BROWSER o instala Chrome/Edge');
  const tempRoot = process.platform === 'win32' ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : tmpdir();
  const profile = await mkdtemp(join(tempRoot, 'cadefar-ventas-'));
  const origin = 'http://127.0.0.1:5183';
  // Servir una compilación temporal evita cientos de módulos por cada recarga.
  const vite = spawn(process.execPath, ['--input-type=module', '--eval', `
    import { build } from 'vite';
    import { createServer } from 'node:http';
    import { readFile } from 'node:fs/promises';
    import { join, extname } from 'node:path';
    const outDir = ${JSON.stringify(join(profile, 'app'))};
    await build({ logLevel: 'warn', build: { outDir, emptyOutDir: true } });
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.html': 'text/html' };
    createServer(async (req, res) => {
      const path = new URL(req.url, '${origin}').pathname;
      const file = join(outDir, path.startsWith('/assets/') ? path : 'index.html');
      try { const body = await readFile(file); res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }); res.end(body); }
      catch { res.writeHead(404); res.end(); }
    }).listen(5183, '127.0.0.1', () => console.log('${origin}'));
  `], {
    cwd: root, env: { ...process.env, VITE_API_URL: `${origin}/api` }, stdio: ['ignore', 'pipe', 'pipe']
  });
  let browser, socket, send, rol = 3, nextResponse, heldRequest;
  let nextPost, heldPost, catalogoResponse, existenciaResponse, nextAnulacion, heldAnulacion;
  const registradas = [], confirmadas = new Map(), anuladas = new Map();
  const catalogo = [
    { ...detalle(1, 7).existencia.medicamento, condicionVenta: 'LIBRE' },
    { ...detalle(1, 7).existencia.medicamento, idMedicamento: 6, codigoMedicamento: 'INA006', nombreComercial: 'Medicamento inactivo', estado: false },
    { ...detalle(1, 7).existencia.medicamento, idMedicamento: 8, codigoMedicamento: 'SIN008', nombreComercial: 'Sin existencias', condicionVenta: 'RECETA_MEDICA' }
  ];
  const existencias = [{ ...detalle(1, 7).existencia, stockFisico: 20, stockVendible: 20, vencida: false, costoUnitarioPromedio: '5.000000' },
    { ...detalle(1, 9).existencia, stockFisico: 0, stockVendible: 0, vencida: true, fechaVencimiento: '2020-01-01', precisionVencimiento: 'DIA' }];
  const completa = v => ({ ...v, detalles: v.detalles || (v.idVenta === 2 ? [detalle(11, 7), detalle(12, 8)] : [detalle(11, 7)]),
    recetas: v.recetas || [{ idReceta: 7, idVenta: v.idVenta, resultadoRevision: v.idVenta === 1 ? null : 'APROBADA' }] });
  const porId = id => anuladas.get(id) || confirmadas.get(id) || [...ventas, ...registradas].find(v => v.idVenta === id);
  const registrar = body => {
    const idVenta = 50 + registradas.length;
    const nueva = { ...venta(idVenta, 'PENDIENTE'), fechaVenta: null, claveOperacion: body.claveOperacion, total: '0.70', recetas: [],
      detalles: body.detalles.map((d, index) => ({ ...detalle(500 + index, d.idExistencia), ...d, idVenta, idReceta: null,
        subtotal: '0.30', existencia: { ...existencias.find(e => e.idExistencia === d.idExistencia), medicamento: catalogo.find(m => m.idMedicamento === d.idMedicamento) } })) };
    registradas.push(nueva); return nueva;
  };
  const confirmarSimulada = id => {
    const actual = completa(porId(id));
    const confirmada = { ...actual, estadoOperacion: 'CONFIRMADA', fechaVenta: '2026-11-02 12:00:00',
      detalles: [{ ...detalle(901, 7), idVenta: id }, { ...detalle(902, 8), idVenta: id }],
      recetas: actual.recetas.map(r => ({ ...r, resultadoRevision: 'APROBADA' })) };
    confirmadas.set(id, confirmada); return confirmada;
  };
  const anularSimulada = (id, motivo) => {
    const anulada = { ...completa(porId(id)), estadoOperacion: 'ANULADA', motivoAnulacion: motivo,
      fechaAnulacion: '2026-11-02 15:00:00', idUsuarioAnulador: 1, usuarioAnulador: { idUsuario: 1, nombreUsuario: 'administrador' } };
    anuladas.set(id, anulada); return anulada;
  };
  const requests = [], errors = [], unexpected = [];
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Vite no inició')), 15000);
      vite.stdout.on('data', chunk => { if (chunk.toString().replace(/\x1b\[[0-9;]*m/g, '').includes('127.0.0.1:5183')) { clearTimeout(timeout); resolve(); } });
      vite.once('error', reject);
      vite.once('exit', () => reject(new Error('Vite finalizó antes de iniciar')));
    });
    browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
    const port = await waitUntil(async () => { try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { return null; } });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let id = 0;
    const pending = new Map();
    send = (method, params = {}) => new Promise((resolve, reject) => {
      const current = ++id;
      const timer = setTimeout(() => { pending.delete(current); reject(new Error(`Chrome no respondió: ${method}`)); }, 10000);
      pending.set(current, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
      socket.send(JSON.stringify({ id: current, method, params }));
    });
    const respond = (requestId, status, body) => send('Fetch.fulfillRequest', { requestId, responseCode: status,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
    socket.addEventListener('close', () => { for (const item of pending.values()) item.reject(new Error('Chrome cerró')); pending.clear(); });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const item = pending.get(message.id); pending.delete(message.id);
        if (message.error) item?.reject(new Error(message.error.message)); else item?.resolve(message.result);
      } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
      else if (message.method === 'Fetch.requestPaused') {
        const { requestId, request } = message.params;
        const url = new URL(request.url), path = url.pathname;
        requests.push({ path, query: Object.fromEntries(url.searchParams), method: request.method, ...(request.postData ? { body: JSON.parse(request.postData) } : {}) });
        const finish = (status, body) => { void respond(requestId, status, body).catch(error => errors.push(error.message)); };
        if (path === '/api/auth/me') { finish(rol ? 200 : 401, rol ? { data: { idUsuario: rol, idRol: rol, nombreUsuario: `usuario-${rol}` } } : { message: 'No autenticado' }); return; }
        if (path === '/api/medicamentos') { finish(catalogoResponse?.status || 200, catalogoResponse?.body || { data: catalogo }); return; }
        if (/^\/api\/medicamentos\/\d+$/.test(path)) { finish(200, { data: catalogo.find(m => m.idMedicamento === Number(path.split('/').at(-1))) }); return; }
        if (/^\/api\/inventario\/medicamentos\/\d+\/existencias$/.test(path)) {
          finish(existenciaResponse?.status || 200, existenciaResponse?.body || { data: path.includes('/5/') ? existencias : [], meta: { fechaComercial: '2026-11-02' } }); return;
        }
        if (request.method === 'POST' && /^\/api\/ventas\/\d+\/anular$/.test(path)) {
          const body = JSON.parse(request.postData), idVenta = Number(path.split('/')[3]);
          const planned = nextAnulacion; nextAnulacion = null;
          if (planned?.hold) { heldAnulacion = { requestId, body, idVenta }; return; }
          if (planned?.commit) anularSimulada(idVenta, planned.motivo || body.motivo);
          if (planned?.networkError) void send('Fetch.failRequest', { requestId, errorReason: 'ConnectionRefused' });
          else if (planned) finish(planned.status, planned.body);
          else if (porId(idVenta)?.estadoOperacion === 'ANULADA') finish(409, { message: 'La venta ya está anulada' });
          else finish(200, { data: anularSimulada(idVenta, body.motivo) });
          return;
        }
        if (request.method === 'POST' && (path === '/api/ventas' || /^\/api\/ventas\/\d+\/confirmar$/.test(path))) {
          const body = JSON.parse(request.postData), idVenta = path === '/api/ventas' ? null : Number(path.split('/')[3]);
          const planned = nextPost; nextPost = null;
          if (planned?.hold) { heldPost = { requestId, body, idVenta }; return; }
          const commit = () => idVenta === null ? registrar(body) : confirmarSimulada(idVenta);
          if (planned?.commit) commit();
          if (planned?.networkError) void send('Fetch.failRequest', { requestId, errorReason: 'ConnectionRefused' });
          else if (planned) finish(planned.status, planned.body);
          else if (idVenta === null && registradas.some(v => v.claveOperacion === body.claveOperacion)) finish(409, { message: 'La clave de operación ya está registrada' });
          else if (idVenta !== null && porId(idVenta)?.estadoOperacion !== 'PENDIENTE') finish(409, { message: 'Solo se puede confirmar una venta pendiente' });
          else finish(idVenta === null ? 201 : 200, { data: commit() });
          return;
        }
        if (request.method !== 'GET' || !/^\/api\/ventas(?:\/\d+)?$/.test(path)) { unexpected.push(path); finish(404, { message: 'Endpoint inesperado' }); return; }
        if (nextResponse) {
          const planned = nextResponse; if (!planned.persist) nextResponse = null;
          if (planned.hold) heldRequest = requestId;
          else if (planned.networkError) void send('Fetch.failRequest', { requestId, errorReason: 'ConnectionRefused' });
          else finish(planned.status, planned.body);
          return;
        }
        if (path === '/api/ventas') {
          const p = url.searchParams;
          let rows = [...ventas, ...registradas].map(v => anuladas.get(v.idVenta) || confirmadas.get(v.idVenta) || v).filter(v => (!p.get('estadoOperacion') || v.estadoOperacion === p.get('estadoOperacion')) &&
            (!p.get('idUsuario') || v.idUsuario === Number(p.get('idUsuario'))) && (!p.get('idVenta') || v.idVenta === Number(p.get('idVenta'))));
          const campo = p.get('campoFecha') || 'fechaRegistro';
          rows = rows.filter(v => (!p.get('desde') || v[campo]?.slice(0, 10) >= p.get('desde')) && (!p.get('hasta') || v[campo]?.slice(0, 10) <= p.get('hasta')));
          const pagina = Number(p.get('pagina') || 1), limite = Number(p.get('limite') || 25);
          finish(200, { data: rows.slice((pagina - 1) * limite, pagina * limite), paginacion: { pagina, limite, total: rows.length, totalPaginas: Math.ceil(rows.length / limite) } });
        } else {
          const v = porId(Number(path.split('/').at(-1)));
          finish(v ? 200 : 404, v ? { data: completa(v) } : { message: 'Venta no encontrada' });
        }
      }
    });
    await send('Page.enable'); await send('Runtime.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: `${origin}/api/*` }] });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const waitFor = expression => waitUntil(async () => { try { return await evaluate(expression); } catch { return false; } });
    const navigate = async path => {
      await evaluate('window.__navigating = true');
      await send('Page.navigate', { url: `${origin}${path}` });
      await waitFor('!window.__navigating && document.readyState === "complete"');
    };
    const ready = () => waitFor('!!document.querySelector(".ventas-page") && document.querySelector("[aria-busy]")?.getAttribute("aria-busy") === "false"');
    const contains = text => waitFor(`document.querySelector('.ventas-page')?.textContent.includes(${JSON.stringify(text)})`);
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const input = (id, value) => evaluate(`(() => { const el=document.getElementById(${JSON.stringify(id)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    const select = (id, value) => evaluate(`(() => { const el=document.getElementById(${JSON.stringify(id)}); el.value=${JSON.stringify(value)}; el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    const salesRequests = () => requests.filter(request => request.path.startsWith('/api/ventas'));
    const posts = () => salesRequests().filter(request => request.method === 'POST');
    const prepararFormulario = async () => {
      rol = 3; await navigate('/ventas/nueva'); await ready();
      await select('venta-linea-1-med', '5');
      await waitFor(`!!document.querySelector('#venta-linea-1-existencia option[value="7"]')`);
      await select('venta-linea-1-existencia', '7');
      await input('venta-linea-1-cantidad', '3'); await input('venta-linea-1-precio', '0.10');
    };
    const revisarRegistro = async () => { await click('.venta-form button[type="submit"]'); await waitFor('!!document.querySelector("[role=dialog]")'); };
    const enviarRegistro = () => click('.modal__actions button:last-child');
    const revisarConfirmacion = async () => { await click('.venta-confirmacion > button'); await waitFor('!!document.querySelector("[role=dialog]")'); };
    const esperarPost = () => waitFor('!document.querySelector("[role=dialog]")');
    const inputMotivo = value => evaluate(`(()=>{const el=document.getElementById('venta-anular-motivo');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    const revisarAnulacion = async () => { await click('.venta-anular-form button[type=submit]'); await waitFor('!!document.querySelector("[role=dialog]")'); };
    const anulacionRequests = () => posts().filter(request => request.path.endsWith('/anular'));
    const nuevaPendiente = () => registrar({ claveOperacion: `anulacion-${registradas.length}`, detalles: [{ idMedicamento: 5, idExistencia: 7, cantidad: 3, precioUnitario: '0.10' }] });
    const key = async (key, windowsVirtualKeyCode, modifiers = 0) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, windowsVirtualKeyCode, modifiers });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, windowsVirtualKeyCode, modifiers });
    };
    const comprobarFocoDialogo = async (disparador) => {
      await waitFor('document.activeElement === document.querySelector(".modal__header button")');
      await key('Tab', 9, 8);
      assert.ok(await evaluate('document.activeElement === document.querySelector(".modal__actions button:last-child")'));
      await key('Tab', 9);
      assert.ok(await evaluate('document.activeElement === document.querySelector(".modal__header button")'));
      await key('Escape', 27); await esperarPost();
      await waitFor(`document.activeElement === document.querySelector(${JSON.stringify(disparador)})`);
    };

    await t.test('Tres estados, fechas diferenciadas, total exacto y sidebar activo', async () => {
      await navigate('/ventas'); await ready();
      assert.equal(await evaluate('document.querySelectorAll(".venta-table tbody tr").length'), 3);
      const text = await evaluate('document.querySelector(".venta-table").textContent');
      for (const value of ['Pendiente', 'Confirmada', 'Anulada', 'Sin confirmación registrada', '01/11/2026 23:15:00', '02/11/2026 00:10:00', '999.999.999.999,99']) assert.ok(text.includes(value), value);
      assert.ok(await evaluate('!!document.querySelector(\'.app-sidebar a[href="/ventas"][aria-current="page"]\')'));
      assert.equal(await evaluate('document.querySelector(".catalogo-toolbar p").textContent'), '3 de 3 ventas registradas');
    });
    await t.test('Filtros combinados usan la API, se restauran al recargar y vuelven desde el detalle', async () => {
      await input('venta-responsable', '3'); await select('venta-estado', 'CONFIRMADA');
      await select('venta-campo-fecha', 'fechaVenta'); await input('venta-desde', '2026-11-02'); await input('venta-hasta', '2026-11-02');
      await click('.venta-filters button[type="submit"]'); await contains('1 de 1 ventas');
      assert.deepEqual(salesRequests().at(-1).query, { idUsuario: '3', estadoOperacion: 'CONFIRMADA', campoFecha: 'fechaVenta', desde: '2026-11-02', hasta: '2026-11-02', pagina: '1', limite: '25' });
      const query = await evaluate('location.search');
      await navigate(`/ventas${query}`); await ready();
      assert.equal(await evaluate('document.getElementById("venta-estado").value'), 'CONFIRMADA');
      await click('.venta-table a'); await contains('Venta #2'); await ready();
      assert.ok(await evaluate('document.querySelector(".back-link").getAttribute("href").includes("estadoOperacion=CONFIRMADA")'));
      await click('.back-link'); await contains('1 de 1 ventas');
    });
    await t.test('Paginación real, primera página y recuperación fuera de rango', async () => {
      await navigate('/ventas?limite=1'); await ready();
      await contains('Página 1 de 3');
      await click('.venta-pagination nav button:last-child'); await contains('Página 2 de 3');
      assert.equal(salesRequests().at(-1).query.pagina, '2');
      await click('.venta-pagination nav button:first-child'); await contains('Página 1 de 3');
      await select('venta-limite', '25'); await contains('Página 1 de 1');
      assert.equal(salesRequests().at(-1).query.limite, '25');
      await navigate('/ventas?pagina=99&limite=1'); await ready(); await contains('Esta página no tiene resultados');
      await click('.catalogo-state button'); await contains('Página 1 de 3');
    });
    await t.test('Fechas invertidas y URLs inválidas no consultan; los filtros pueden limpiarse', async () => {
      await navigate('/ventas'); await ready(); const before = salesRequests().length;
      await input('venta-desde', '2026-11-03'); await input('venta-hasta', '2026-11-01');
      await click('.venta-filters button[type="submit"]'); await contains('La fecha desde no puede ser posterior');
      assert.equal(salesRequests().length, before);
      for (const query of ['idVenta=01', 'pagina=0', 'estadoOperacion=OTRO', 'desde=2026-02-30', 'pagina=1&pagina=2']) {
        await navigate(`/ventas?${query}`); await ready(); await contains('Revisa los filtros');
        assert.equal(salesRequests().length, before);
      }
      await click('.venta-filters button[type="button"]'); await contains('3 de 3 ventas');
    });
    await t.test('Detalle pendiente, definitivo dividido y anulado conservan historial y recetas', async () => {
      await navigate('/ventas/1'); await ready(); await contains('todavía no ha descontado ni reservado inventario');
      await contains('Pendiente de revisión'); await contains('Existencia provisional');
      await navigate('/ventas/2'); await ready(); await contains('asignación definitiva');
      assert.equal(await evaluate('document.querySelectorAll(".venta-table tbody tr").length'), 2);
      await contains('PAR005-7'); await contains('PAR005-8'); await contains('Aprobada');
      await navigate('/ventas/3'); await ready(); await contains('Solicitud documentada'); await contains('administrador');
      assert.equal(await evaluate('!!document.querySelector(".ventas-page form")'), false);
    });
    await t.test('ID inválido no consulta y una venta inexistente muestra 404', async () => {
      const before = salesRequests().length;
      await navigate('/ventas/01'); await ready(); await contains('El identificador de la venta no es válido');
      assert.equal(salesRequests().length, before);
      await navigate('/ventas/999'); await ready(); await contains('Venta no encontrada');
      assert.equal(await evaluate('!!document.querySelector(".venta-table")'), false);
    });
    await t.test('Errores HTTP/red retiran datos anteriores y no exponen errores técnicos', async () => {
      for (const path of ['/ventas', '/ventas/1']) {
        for (const planned of [
          { status: 400, body: { message: 'Datos inválidos' }, expected: 'Datos inválidos' },
          { status: 404, body: { message: 'Venta no encontrada' }, expected: 'Venta no encontrada' },
          { status: 409, body: { message: 'Conflicto de consulta' }, expected: 'Conflicto de consulta' },
          { status: 500, body: { message: 'SELECT secreto' }, expected: 'No fue posible cargar' },
          { networkError: true, expected: 'No se pudo conectar' },
          { status: 403, body: { message: 'Denegado' }, expected: 'No tienes autorización' },
          { status: 401, body: { message: 'No autenticado' }, expected: 'Tu sesión ya no es válida' }
        ]) {
          nextResponse = { ...planned, persist: true }; await navigate(path); await ready();
          try { await contains(planned.expected); } catch (error) {
            throw new Error(`${path}: se esperaba ${planned.expected}; vista: ${await evaluate('document.querySelector(".ventas-page")?.textContent')}`, { cause: error });
          }
          assert.equal(await evaluate('!!document.querySelector(".venta-table")'), false);
          assert.equal(await evaluate('document.querySelector(".ventas-page").textContent.includes("SELECT secreto")'), false);
        }
      }
      nextResponse = null;
    });
    await t.test('Carga no muestra datos anteriores; actualizar recupera estado y vacío', async () => {
      await navigate('/ventas'); await ready();
      nextResponse = { hold: true }; await click('.catalogo-toolbar button');
      await waitUntil(() => heldRequest); await contains('Cargando ventas');
      assert.equal(await evaluate('!!document.querySelector(".venta-table")'), false);
      await respond(heldRequest, 200, { data: [], paginacion: { pagina: 1, limite: 25, total: 0, totalPaginas: 0 } }); heldRequest = null;
      await ready(); await contains('No hay ventas registradas');
      await navigate('/ventas?idUsuario=99'); await ready(); await contains('Sin coincidencias');
    });
    await t.test('Tres roles consultan con acciones autorizadas y sin endpoints sensibles', async () => {
      for (const role of [1, 2, 3]) {
        rol = role; await navigate('/ventas'); await ready();
        assert.ok(await evaluate('!!document.querySelector(\'.app-sidebar a[href="/ventas"]\')'));
        await navigate('/ventas/1'); await ready(); await contains('Venta #1');
        assert.equal(await evaluate('!!document.querySelector(".venta-anular-form")'), role === 1);
      }
      assert.ok(salesRequests().every(request => request.method === 'GET'));
    });
    await t.test('CU28: solo Vendedor registra y confirma; rutas y sidebar respetan los permisos', async () => {
      for (const role of [1, 2]) {
        rol = role;
        const before = requests.filter(r => r.path.startsWith('/api/medicamentos')).length;
        await navigate('/ventas/nueva'); await waitFor('location.pathname === "/dashboard"');
        assert.equal(requests.filter(r => r.path.startsWith('/api/medicamentos')).length, before);
        await navigate('/ventas/1'); await ready();
        assert.equal(await evaluate('!!document.querySelector(".venta-confirmacion")'), false);
        assert.equal(await evaluate('!!document.querySelector(\'.app-sidebar a[href="/ventas/nueva"]\')'), false);
      }
      await prepararFormulario();
      assert.ok(await evaluate('!!document.querySelector(\'.app-sidebar a[href="/ventas/nueva"][aria-current="page"]\')'));
      assert.equal(await evaluate(`!!document.querySelector('#venta-linea-1-med option[value="6"]')`), false);
    });
    await t.test('CU28: catálogo y existencias con error/vacíos orientan y permiten reintentar', async () => {
      catalogoResponse = { status: 500, body: { message: 'SELECT interno' } };
      await navigate('/ventas/nueva'); await ready(); await contains('No fue posible cargar');
      catalogoResponse = { status: 200, body: { data: [] } };
      await click('.catalogo-state button'); await ready(); await contains('No hay medicamentos activos');
      catalogoResponse = null; await click('.catalogo-state button'); await ready();
      existenciaResponse = { status: 500, body: { message: 'SELECT interno' } };
      await select('venta-linea-1-med', '5'); await contains('Reintentar existencias');
      existenciaResponse = null;
      await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Reintentar existencias").click()');
      await waitFor(`!!document.querySelector('#venta-linea-1-existencia option[value="7"]')`);
      await select('venta-linea-1-med', '8'); await contains('no tiene existencias reales');
      assert.equal(await evaluate('document.getElementById("venta-linea-1-existencia").value'), '');
    });
    await t.test('CU28: búsqueda, cantidades, precios, agregar/quitar e importes exactos sin envío', async () => {
      await prepararFormulario(); const before = posts().length;
      await input('venta-linea-1-buscar', 'PAR005');
      assert.ok(await evaluate(`!!document.querySelector('#venta-linea-1-med option[value="5"]')`));
      await contains('Total estimado: 0,30');
      await input('venta-linea-1-cantidad', '0'); await click('.venta-form button[type="submit"]'); await contains('la cantidad debe ser un entero positivo');
      await input('venta-linea-1-cantidad', '3'); await input('venta-linea-1-precio', '1e2'); await click('.venta-form button[type="submit"]'); await contains('el precio debe usar punto decimal');
      await input('venta-linea-1-precio', '0.10');
      await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Agregar medicamento").click()');
      assert.equal(await evaluate('document.querySelectorAll(".venta-linea").length'), 2);
      await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Quitar medicamento 2").click()');
      assert.equal(await evaluate('document.querySelectorAll(".venta-linea").length'), 1);
      await revisarRegistro(); await click('.modal__actions button:first-child');
      assert.equal(posts().length, before);
      assert.equal(await evaluate('document.getElementById("venta-linea-1-cantidad").value'), '3');
      assert.ok(await evaluate('document.getElementById("venta-nueva-clave").readOnly'));
    });
    await t.test('Teclado: registro y confirmación mantienen foco y permiten cancelar sin POST', async () => {
      await prepararFormulario(); await evaluate('document.querySelector(".venta-form button[type=submit]").focus()'); await revisarRegistro();
      await comprobarFocoDialogo('.venta-form button[type=submit]');
      await navigate('/ventas/1'); await ready(); await evaluate('document.querySelector(".venta-confirmacion > button").focus()'); await revisarConfirmacion();
      await comprobarFocoDialogo('.venta-confirmacion > button');
    });
    await t.test('CU28: registro exacto, referencia provisional sin saldo y bloqueo de doble envío', async () => {
      await prepararFormulario(); await select('venta-linea-1-existencia', '9');
      const clave = await evaluate('document.getElementById("venta-nueva-clave").value');
      await revisarRegistro(); nextPost = { hold: true }; const before = posts().length;
      await evaluate('document.querySelector(".modal__actions button:last-child").click(); document.querySelector(".modal__actions button:last-child").click()');
      await waitUntil(() => heldPost);
      assert.equal(posts().length, before + 1);
      assert.deepEqual(heldPost.body, { claveOperacion: clave, detalles: [{ idMedicamento: 5, idExistencia: 9, cantidad: 3, precioUnitario: '0.10' }] });
      assert.ok(await evaluate('document.querySelector(".modal__actions button:last-child").disabled'));
      const creada = registrar(heldPost.body);
      await respond(heldPost.requestId, 201, { data: creada }); heldPost = null;
      await waitFor(`location.pathname === '/ventas/${creada.idVenta}'`); await ready(); await contains('Venta pendiente registrada');
      await contains('Sin confirmación registrada'); await contains('todavía no ha descontado ni reservado inventario');
      assert.equal(await evaluate('document.querySelector(".page-heading .venta-estado").textContent'), 'Pendiente');
    });
    await t.test('CU28: errores 400/409/500/red conservan borrador y la misma clave', async () => {
      await prepararFormulario(); const clave = await evaluate('document.getElementById("venta-nueva-clave").value');
      for (const planned of [
        { status: 400, body: { message: 'Datos inválidos' }, expected: 'Datos inválidos' },
        { status: 409, body: { message: 'La clave de operación ya está registrada' }, expected: 'La clave de operación ya está registrada' },
        { status: 500, body: { message: 'SELECT interno' }, expected: 'No fue posible comprobar' },
        { networkError: true, expected: 'No fue posible comprobar' }
      ]) {
        await revisarRegistro(); nextPost = planned; await enviarRegistro(); await esperarPost(); await contains(planned.expected);
        assert.equal(await evaluate('document.getElementById("venta-nueva-clave").value'), clave);
        assert.equal(await evaluate('document.getElementById("venta-linea-1-cantidad").value'), '3');
        assert.equal(await evaluate('document.querySelector(".venta-form").textContent.includes("SELECT interno")'), false);
        assert.ok(await evaluate(`document.querySelector('.venta-form a[target="_blank"]').getAttribute('href') === '/ventas?idUsuario=3'`));
      }
    });
    await t.test('CU28: respuesta de registro perdida tras commit no crea otra operación al reintentar', async () => {
      await prepararFormulario(); const clave = await evaluate('document.getElementById("venta-nueva-clave").value');
      await revisarRegistro(); nextPost = { networkError: true, commit: true }; await enviarRegistro(); await esperarPost(); await contains('No fue posible comprobar');
      await revisarRegistro(); await enviarRegistro(); await esperarPost(); await contains('La clave de operación ya está registrada');
      assert.equal(registradas.filter(v => v.claveOperacion === clave).length, 1);
      assert.equal(posts().at(-1).body.claveOperacion, clave);
    });
    await t.test('CU28: 401/403 de registro bloquean acciones sin perder los campos', async () => {
      for (const status of [401, 403]) {
        await prepararFormulario(); await revisarRegistro(); nextPost = { status, body: { message: 'Denegado' } }; await enviarRegistro(); await esperarPost();
        await contains(status === 401 ? 'Tu sesión ya no es válida' : 'No tienes autorización para registrar');
        assert.ok(await evaluate('document.querySelector(".venta-form button[type=submit]").disabled'));
        assert.equal(await evaluate('document.getElementById("venta-linea-1-cantidad").value'), '3');
      }
    });
    await t.test('CU28: recetas no aprobadas se advierten y un rechazo real no confirma visualmente', async () => {
      await navigate('/ventas/1'); await ready(); await contains('no figura aprobada');
      await revisarConfirmacion(); await click('.modal__actions button:first-child');
      const before = posts().length;
      await revisarConfirmacion(); nextPost = { status: 409, body: { message: 'La venta requiere que las recetas utilizadas estén aprobadas' } };
      await enviarRegistro(); await esperarPost(); await contains('La venta requiere que las recetas utilizadas estén aprobadas');
      assert.equal(posts().length, before + 1); assert.deepEqual(posts().at(-1).body, {});
      assert.equal(await evaluate('document.querySelector(".page-heading .venta-estado").textContent'), 'Pendiente');
      assert.ok(await evaluate('document.querySelector(".venta-confirmacion > button").disabled'));
      await click('.catalogo-toolbar button'); await ready();
      assert.equal(await evaluate('document.querySelector(".venta-confirmacion > button").disabled'), false);
    });
    await t.test('CU28: errores de stock, vencimiento, condición, red y HTTP requieren reconsulta cuando corresponde', async () => {
      for (const planned of [
        { status: 409, body: { message: 'Stock insuficiente' }, expected: 'Stock insuficiente', blocked: true },
        { status: 409, body: { message: 'Existencias vencidas' }, expected: 'Existencias vencidas', blocked: true },
        { status: 409, body: { message: 'La condición de venta del medicamento no está reconocida' }, expected: 'La condición de venta', blocked: true },
        { status: 400, body: { message: 'Datos inválidos' }, expected: 'Datos inválidos', blocked: false },
        { status: 404, body: { message: 'Venta no encontrada' }, expected: 'Venta no encontrada', blocked: true },
        { status: 500, body: { message: 'SELECT interno' }, expected: 'No fue posible comprobar', blocked: true },
        { networkError: true, expected: 'No fue posible comprobar', blocked: true },
        { status: 200, body: { data: completa(ventas[0]) }, expected: 'No fue posible comprobar', blocked: true },
        { status: 401, body: { message: 'Denegado' }, expected: 'Tu sesión ya no es válida', blocked: true },
        { status: 403, body: { message: 'Denegado' }, expected: 'No tienes autorización para confirmar', blocked: true }
      ]) {
        await navigate('/ventas/1'); await ready(); await revisarConfirmacion(); nextPost = planned; await enviarRegistro(); await esperarPost(); await contains(planned.expected);
        assert.equal(await evaluate('document.querySelector(".page-heading .venta-estado").textContent'), 'Pendiente');
        assert.equal(await evaluate('document.querySelector(".venta-confirmacion > button").disabled'), planned.blocked);
        assert.equal(await evaluate('!!document.querySelector(".feedback--success")'), false);
      }
    });
    await t.test('CU28: éxito real actualiza estado, fecha y distribución definitiva; doble clic hace un solo POST', async () => {
      const idVenta = registradas[0].idVenta;
      await navigate(`/ventas/${idVenta}`); await ready(); await revisarConfirmacion(); nextPost = { hold: true }; const before = posts().length;
      await evaluate('document.querySelector(".modal__actions button:last-child").click(); document.querySelector(".modal__actions button:last-child").click()');
      await waitUntil(() => heldPost); assert.equal(posts().length, before + 1);
      assert.equal(heldPost.idVenta, idVenta); assert.deepEqual(heldPost.body, {});
      await respond(heldPost.requestId, 200, { data: confirmarSimulada(idVenta) }); heldPost = null;
      await esperarPost(); await contains('Venta confirmada.');
      assert.equal(await evaluate('document.querySelector(".page-heading .venta-estado").textContent'), 'Confirmada');
      await contains('02/11/2026 12:00:00'); await contains('asignación definitiva');
      assert.equal(await evaluate('document.querySelectorAll(".venta-table tbody tr").length'), 2);
      assert.equal(await evaluate('!!document.querySelector(".venta-confirmacion")'), false);
      await navigate(`/ventas/${idVenta}`); await ready();
      assert.equal(await evaluate('!!document.querySelector(".venta-confirmacion")'), false);
    });
    await t.test('CU28: confirmación con respuesta perdida se recupera por GET sin repetir el POST', async () => {
      const idVenta = registradas[1].idVenta;
      await navigate(`/ventas/${idVenta}`); await ready(); await revisarConfirmacion(); nextPost = { networkError: true, commit: true };
      const before = posts().length; await enviarRegistro(); await esperarPost(); await contains('No fue posible comprobar');
      assert.ok(await evaluate('document.querySelector(".venta-confirmacion > button").disabled'));
      await click('.catalogo-toolbar button'); await ready();
      assert.equal(await evaluate('document.querySelector(".page-heading .venta-estado").textContent'), 'Confirmada');
      assert.equal(posts().length, before + 1);
    });
    await t.test('CU28: respuestas tardías de registro y confirmación no secuestran otra pantalla', async () => {
      await prepararFormulario(); await revisarRegistro(); nextPost = { hold: true }; await enviarRegistro(); await waitUntil(() => heldPost);
      const registro = heldPost; heldPost = null;
      await navigate('/ventas/2'); await ready();
      await respond(registro.requestId, 201, { data: registrar(registro.body) });
      await navigate('/ventas/1'); await ready(); await revisarConfirmacion(); nextPost = { hold: true }; await enviarRegistro(); await waitUntil(() => heldPost);
      const confirmacion = heldPost; heldPost = null;
      await navigate('/ventas/3'); await ready();
      await respond(confirmacion.requestId, 200, { data: confirmarSimulada(1) });
      assert.equal(await evaluate('location.pathname'), '/ventas/3');
      await contains('Solicitud documentada');
    });
    await t.test('CU28: formulario y revisión móviles, sin secretos en almacenamiento', async () => {
      await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
      await prepararFormulario();
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
      await revisarRegistro();
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
      assert.equal(await evaluate('localStorage.length + sessionStorage.length'), 0);
    });
    await t.test('CU30: solo Administrador ve anulación de pendientes/confirmadas; anuladas quedan históricas', async () => {
      await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
      const pendiente = nuevaPendiente(); const before = anulacionRequests().length;
      for (const role of [1, 2, 3]) {
        rol = role;
        for (const id of [pendiente.idVenta, 2]) {
          await navigate(`/ventas/${id}`); await ready();
          assert.equal(await evaluate('!!document.querySelector(".venta-anular-form")'), role === 1);
        }
        await navigate('/ventas/3'); await ready();
        assert.equal(await evaluate('!!document.querySelector(".venta-anular-form")'), false);
      }
      assert.equal(anulacionRequests().length, before);
    });
    await t.test('CU30: sidebar reutiliza el listado, conserva intención y filtros al entrar y volver del detalle', async () => {
      rol = 1; await navigate('/ventas'); await ready();
      await evaluate('[...document.querySelectorAll(".app-sidebar a")].find(a => a.textContent.trim() === "Anular venta").click()');
      await contains('Selecciona el detalle de una venta pendiente o confirmada');
      await input('venta-id', '2'); await select('venta-estado', 'CONFIRMADA'); await click('.venta-filters button[type=submit]'); await contains('1 de 1 ventas');
      await click('.venta-table a'); await ready();
      assert.ok(await evaluate('[...document.querySelectorAll(".app-sidebar a[aria-current=page]")].some(a => a.textContent.trim() === "Anular venta")'));
      await click('.back-link'); await ready();
      assert.ok(await evaluate('location.search.includes("idVenta=2") && location.search.includes("estadoOperacion=CONFIRMADA")'));
      assert.ok(await evaluate('[...document.querySelectorAll(".app-sidebar a[aria-current=page]")].some(a => a.textContent.trim() === "Anular venta")'));
    });
    await t.test('CU30: motivo obligatorio, máximo y controles se validan; cancelar conserva el borrador', async () => {
      await navigate('/ventas/2'); await ready(); const before = anulacionRequests().length;
      for (const motivo of ['', '   ', 'x'.repeat(256), 'Primera línea\nSegunda línea']) {
        await inputMotivo(motivo); await click('.venta-anular-form button[type=submit]');
        assert.equal(await evaluate('!!document.querySelector("[role=dialog]")'), false);
      }
      assert.equal(anulacionRequests().length, before);
      await inputMotivo('  Motivo documentado  '); await revisarAnulacion();
      assert.ok(await evaluate('document.querySelector("[role=dialog]").textContent.includes("Motivo documentado")'));
      await click('.modal__actions button:first-child');
      assert.equal(await evaluate('document.getElementById("venta-anular-motivo").value'), '  Motivo documentado  ');
      assert.equal(anulacionRequests().length, before);
    });
    await t.test('Teclado: anulación mantiene foco, se cancela con Escape y conserva el motivo', async () => {
      await inputMotivo('Motivo para revisar por teclado');
      await evaluate('document.querySelector(".venta-anular-form button[type=submit]").focus()'); await revisarAnulacion();
      await comprobarFocoDialogo('.venta-anular-form button[type=submit]');
      assert.equal(await evaluate('document.getElementById("venta-anular-motivo").value'), 'Motivo para revisar por teclado');
    });
    await t.test('CU30: errores HTTP/red y respuesta no verificable no producen éxito; el motivo se conserva', async () => {
      for (const planned of [
        { status: 400, body: { message: 'Datos inválidos' }, expected: 'Datos inválidos', blocked: false },
        { status: 404, body: { message: 'Venta no encontrada' }, expected: 'Venta no encontrada', blocked: true },
        { status: 409, body: { message: 'El historial de inventario no permite la reversión' }, expected: 'no permite la reversión', blocked: true },
        { status: 500, body: { message: 'SELECT secreto' }, expected: 'No fue posible comprobar', blocked: true },
        { networkError: true, expected: 'No fue posible comprobar', blocked: true },
        { status: 200, body: { data: completa(ventas[1]) }, expected: 'No fue posible comprobar', blocked: true },
        { status: 401, body: { message: 'Denegado' }, expected: 'Tu sesión ya no es válida', blocked: true },
        { status: 403, body: { message: 'Denegado' }, expected: 'No tienes autorización para anular', blocked: true }
      ]) {
        await navigate('/ventas/2'); await ready(); await inputMotivo('Motivo conservado'); await revisarAnulacion(); nextAnulacion = planned;
        const before = anulacionRequests().length; await enviarRegistro(); await esperarPost(); await contains(planned.expected);
        assert.equal(anulacionRequests().length, before + 1);
        assert.equal(await evaluate('document.querySelector(".venta-anular-form button[type=submit]").disabled'), planned.blocked);
        assert.equal(await evaluate('document.getElementById("venta-anular-motivo").value'), 'Motivo conservado');
        assert.equal(await evaluate('document.querySelector(".page-heading .venta-estado").textContent'), 'Confirmada');
        assert.equal(await evaluate('document.querySelector(".ventas-page").textContent.includes("SELECT secreto")'), false);
        assert.equal(await evaluate('!!document.querySelector(".feedback--success")'), false);
      }
    });
    await t.test('CU30: conflicto exige GET, una consulta fallida no pierde motivo y una nueva revisión es explícita', async () => {
      await navigate('/ventas/2'); await ready(); await inputMotivo('Motivo para nueva revisión'); await revisarAnulacion();
      nextAnulacion = { status: 409, body: { message: 'Contención temporal' } }; await enviarRegistro(); await esperarPost(); await contains('Contención temporal');
      nextResponse = { status: 500, body: { message: 'SELECT secreto' } }; await click('.catalogo-toolbar button'); await ready();
      assert.equal(await evaluate('!!document.querySelector(".venta-anular-form")'), false);
      await click('.catalogo-state button'); await ready();
      assert.equal(await evaluate('document.getElementById("venta-anular-motivo").value'), 'Motivo para nueva revisión');
      assert.equal(await evaluate('document.querySelector(".venta-anular-form button[type=submit]").disabled'), false);
      assert.equal(await evaluate('!!document.querySelector("[role=dialog]")'), false);
    });
    await t.test('CU30: confirmada anula por POST exacto, bloquea doble clic y conserva importes, fechas y detalles', async () => {
      await navigate('/ventas/2'); await ready();
      const original = completa(porId(2)); const before = anulacionRequests().length;
      await inputMotivo('  Devolución documentada  '); await revisarAnulacion();
      assert.ok(await evaluate('document.querySelector("[role=dialog]").textContent.includes("compensará las salidas originales")'));
      nextAnulacion = { hold: true };
      await evaluate('document.querySelector(".modal__actions button:last-child").click();document.querySelector(".modal__actions button:last-child").click()');
      await waitUntil(() => heldAnulacion);
      assert.equal(anulacionRequests().length, before + 1); assert.deepEqual(heldAnulacion.body, { motivo: 'Devolución documentada' });
      assert.equal(anulacionRequests().at(-1).path, '/api/ventas/2/anular');
      assert.ok(await evaluate('document.querySelector(".modal__actions button:last-child").disabled && document.querySelector(".catalogo-toolbar button").disabled'));
      await click('.modal__header button'); assert.ok(await evaluate('!!document.querySelector("[role=dialog]")'));
      const anulada = anularSimulada(2, heldAnulacion.body.motivo);
      await respond(heldAnulacion.requestId, 200, { data: anulada }); heldAnulacion = null;
      await esperarPost(); await contains('Venta anulada. El backend confirmó');
      assert.equal(await evaluate('document.querySelector(".page-heading .venta-estado").textContent'), 'Anulada');
      assert.equal(await evaluate('!!document.querySelector(".venta-anular-form")'), false);
      assert.equal(anulada.total, original.total); assert.equal(anulada.fechaVenta, original.fechaVenta); assert.equal(anulada.fechaRegistro, original.fechaRegistro);
      assert.deepEqual(anulada.detalles, original.detalles); assert.deepEqual(anulada.recetas, original.recetas);
      await contains('999.999.999.999,99'); await contains('Devolución documentada'); await contains('administrador'); await contains('02/11/2026 15:00:00');
      assert.equal(await evaluate('document.querySelectorAll(".venta-table tbody tr").length'), original.detalles.length);
    });
    let pendienteAnulada;
    await t.test('CU30: pendiente se anula sin presentar reversiones ni una confirmación que no existió', async () => {
      const pendiente = nuevaPendiente(); pendienteAnulada = pendiente.idVenta;
      await navigate(`/ventas/${pendiente.idVenta}`); await ready(); await inputMotivo('Cancelar preparación'); await revisarAnulacion();
      assert.ok(await evaluate('document.querySelector("[role=dialog]").textContent.includes("No generará reversiones ni modificará los saldos")'));
      await enviarRegistro(); await esperarPost(); await contains('Venta pendiente anulada.');
      assert.equal(await evaluate('document.querySelector(".page-heading .venta-estado").textContent'), 'Anulada');
      await contains('Sin confirmación registrada');
      assert.equal(porId(pendiente.idVenta).fechaVenta, null);
      assert.equal(await evaluate('document.querySelector(".ventas-page").textContent.includes("Venta confirmada.")'), false);
    });
    await t.test('CU30: recarga y listado mantienen anuladas; no se habilita una segunda anulación', async () => {
      const before = anulacionRequests().length;
      for (const id of [2, pendienteAnulada]) {
        await navigate(`/ventas/${id}`); await ready(); assert.equal(await evaluate('!!document.querySelector(".venta-anular-form")'), false);
      }
      await navigate('/ventas?estadoOperacion=ANULADA'); await ready();
      assert.ok(await evaluate('document.querySelector(".venta-table").textContent.includes("Devolución documentada") === false'));
      assert.equal(await evaluate('[...document.querySelectorAll(".venta-table tbody .venta-estado")].every(e => e.textContent === "Anulada")'), true);
      assert.equal(anulacionRequests().length, before);
    });
    await t.test('CU30: respuesta perdida tras commit se recupera por ID sin repetir el POST', async () => {
      const pendiente = nuevaPendiente();
      await navigate(`/ventas/${pendiente.idVenta}`); await ready(); await inputMotivo('Resultado pendiente de comprobar'); await revisarAnulacion();
      nextAnulacion = { networkError: true, commit: true }; const before = anulacionRequests().length;
      await enviarRegistro(); await esperarPost(); await contains('No fue posible comprobar el resultado de la anulación');
      assert.ok(await evaluate('document.querySelector(".venta-anular-form button[type=submit]").disabled'));
      await click('.catalogo-toolbar button'); await ready(); await contains('Resultado pendiente de comprobar');
      assert.equal(await evaluate('document.querySelector(".page-heading .venta-estado").textContent'), 'Anulada');
      assert.equal(await evaluate('!!document.querySelector(".venta-anular-form")'), false);
      assert.equal(anulacionRequests().length, before + 1);
    });
    await t.test('CU30: una anulación concurrente muestra el motivo real al reconsultar', async () => {
      const pendiente = nuevaPendiente();
      await navigate(`/ventas/${pendiente.idVenta}`); await ready(); await inputMotivo('Mi motivo no registrado'); await revisarAnulacion();
      nextAnulacion = { status: 409, body: { message: 'La venta ya está anulada' }, commit: true, motivo: 'Anulación concurrente registrada' };
      await enviarRegistro(); await esperarPost(); await contains('La venta ya está anulada');
      await click('.catalogo-toolbar button'); await ready(); await contains('Anulación concurrente registrada');
      assert.equal(await evaluate('document.querySelector(".ventas-page").textContent.includes("Mi motivo no registrado")'), false);
    });
    await t.test('CU30: actualización en curso retira la acción y una respuesta POST tardía no cambia otra venta', async () => {
      const pendiente = nuevaPendiente();
      await navigate(`/ventas/${pendiente.idVenta}`); await ready(); await inputMotivo('Motivo antes de actualizar');
      nextResponse = { hold: true }; await click('.catalogo-toolbar button'); await waitUntil(() => heldRequest);
      assert.equal(await evaluate('!!document.querySelector(".venta-anular-form")'), false);
      await respond(heldRequest, 200, { data: completa(porId(pendiente.idVenta)) }); heldRequest = null; await ready();
      assert.equal(await evaluate('document.getElementById("venta-anular-motivo").value'), 'Motivo antes de actualizar');
      await revisarAnulacion(); nextAnulacion = { hold: true }; await enviarRegistro(); await waitUntil(() => heldAnulacion);
      const pending = heldAnulacion; heldAnulacion = null;
      await navigate('/ventas/3'); await ready();
      await respond(pending.requestId, 200, { data: anularSimulada(pending.idVenta, pending.body.motivo) });
      assert.equal(await evaluate('location.pathname'), '/ventas/3'); await contains('Solicitud documentada');
      assert.equal(await evaluate('!!document.querySelector(".feedback--success")'), false);
    });
    await t.test('CU30: formulario y confirmación a 375px sin desbordamiento ni peticiones de inventario', async () => {
      const pendiente = nuevaPendiente();
      await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
      await navigate(`/ventas/${pendiente.idVenta}`); await ready(); await inputMotivo('x'.repeat(255)); await revisarAnulacion();
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
      await enviarRegistro(); await esperarPost(); await contains('Venta pendiente anulada.');
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
      assert.equal(requests.some(r => r.path.startsWith('/api/inventario') && r.method !== 'GET'), false);
    });
    await t.test('Móvil sin desbordamiento y sin sesión no solicita datos', async () => {
      await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
      for (const path of ['/ventas', '/ventas/2']) {
        await navigate(path); await ready();
        assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
      }
      rol = null; const before = salesRequests().length;
      await navigate('/ventas'); await waitFor('location.pathname === "/login"');
      assert.equal(salesRequests().length, before);
    });
    assert.deepEqual(unexpected, []);
    assert.deepEqual(errors, []);
  } finally {
    if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch {} }
    socket?.close();
    for (const child of [browser, vite]) {
      if (!child || child.exitCode !== null) continue;
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill(); await exited;
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
