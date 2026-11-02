// Pruebas funcionales con API interceptada: sin base de datos ni capturas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const browserPath = process.env.CADEFAR_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const waitUntil = async predicate => {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) { const result = await predicate(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 25)); }
  throw new Error('Tiempo agotado esperando Recetas');
};
const medicamento = { idMedicamento: 5, codigoMedicamento: 'MED005', nombreComercial: 'Medicamento de prueba', formaFarmaceutica: 'Tableta', presentacion: '500 mg', unidadInventario: 'tableta', estado: true };
const detalle = (idVenta, idDetalleVenta, idReceta = null) => ({ idVenta, idDetalleVenta, idReceta, idExistencia: 7, cantidad: 2, precioUnitario: '10.50', subtotal: '21.00', existencia: { idExistencia: 7, idMedicamento: 5, codigoExistencia: 'MED005-007', fechaVencimiento: '2027-12-31', precisionVencimiento: 'DIA', medicamento } });
const baseReceta = (idReceta, idVenta, resultadoRevision = null) => ({ idReceta, idVenta, resultadoRevision, numeroReceta: 'TEST-1', fechaReceta: '2026-11-02',
  nombrePaciente: 'PACIENTE_PRIVADO_PRUEBA', documentoPaciente: 'DOC_PRIVADO_PRUEBA', nombreMedico: 'MEDICO_PRIVADO_PRUEBA', modalidad: 'Consulta', observacion: 'Observación anterior',
  fechaRegistro: '2026-11-02 09:00:00', fechaValidacion: resultadoRevision ? '2026-11-02 10:00:00' : null, idUsuarioValidador: resultadoRevision ? 2 : null });

test('CU31/CU32: recetas sin archivos, permisos y flujo relacionado con ventas', { timeout: 90000 }, async t => {
  assert.ok(browserPath, 'Instala Chrome/Edge o configura CADEFAR_TEST_BROWSER');
  const tempRoot = process.platform === 'win32' ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : tmpdir();
  const profile = await mkdtemp(join(tempRoot, 'cadefar-recetas-'));
  const origin = 'http://127.0.0.1:5188';
  const server = spawn(process.execPath, ['--input-type=module', '--eval', `
    import { build } from 'vite'; import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
    const outDir=${JSON.stringify(join(profile, 'app'))}; await build({logLevel:'warn',build:{outDir,emptyOutDir:true}});
    const types={'.js':'text/javascript','.css':'text/css','.png':'image/png','.html':'text/html'};
    createServer(async(req,res)=>{const path=new URL(req.url,'${origin}').pathname;const file=join(outDir,path.startsWith('/assets/')?path:'index.html');try{const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}}).listen(5188,'127.0.0.1',()=>console.log('${origin}'));
  `], { cwd: root, env: { ...process.env, VITE_API_URL: `${origin}/api` }, stdio: ['ignore', 'pipe', 'pipe'] });
  const ventas = [1, 2, 3, 4].map(idVenta => ({ idVenta, idUsuario: 3, usuarioRegistrador: { idUsuario: 3, nombreUsuario: 'vendedor' },
    estadoOperacion: idVenta === 2 ? 'CONFIRMADA' : idVenta === 3 ? 'ANULADA' : 'PENDIENTE', fechaRegistro: '2026-11-02 08:00:00', fechaVenta: idVenta === 2 ? '2026-11-02 10:00:00' : null,
    total: '42.00', claveOperacion: `test-${idVenta}`, detalles: idVenta === 1 ? [detalle(1, 11), detalle(1, 12), detalle(1, 13, 1)] : [detalle(idVenta, idVenta * 10 + 1)] }));
  const recetas = [baseReceta(1, 1), baseReceta(2, 1, 'RECHAZADA'), baseReceta(3, 2, 'APROBADA')];
  let rol = 3, nextRead, nextWrite, heldWrite, nextId = 10, browser, socket, send;
  const requests = [], errors = [], unexpected = [], consoleMessages = [];
  const ventaPorId = id => ventas.find(v => v.idVenta === id);
  const ventaCompleta = id => ({ ...ventaPorId(id), recetas: recetas.filter(r => r.idVenta === id).map(({ idReceta, idVenta, resultadoRevision }) => ({ idReceta, idVenta, resultadoRevision })) });
  const registrar = (idVenta, body) => {
    const receta = { ...baseReceta(nextId++, idVenta), ...body, numeroReceta: body.numeroReceta ?? null, observacion: body.observacion ?? null };
    recetas.push(receta);
    for (const d of ventaPorId(idVenta).detalles) if (body.idsDetallesVenta?.includes(d.idDetalleVenta)) d.idReceta = receta.idReceta;
    return receta;
  };
  const revisar = (idReceta, body) => {
    const receta = recetas.find(r => r.idReceta === idReceta);
    Object.assign(receta, body, { idUsuarioValidador: 2, fechaValidacion: '2026-11-02 11:00:00' }); return receta;
  };
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Servidor de pruebas no inició')), 15000);
      server.stdout.on('data', chunk => { if (chunk.toString().includes(origin)) { clearTimeout(timeout); resolve(); } });
      server.once('error', reject); server.once('exit', () => reject(new Error('Servidor de pruebas finalizó')));
    });
    browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
    const port = await waitUntil(async () => { try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { return null; } });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let sequence = 0; const pending = new Map();
    send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error(`Chrome no respondió: ${method}`)); }, 10000);
      pending.set(id, { resolve: result => { clearTimeout(timer); resolve(result); }, reject: error => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id, method, params }));
    });
    const respond = (requestId, status, body) => send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
    socket.addEventListener('close', () => { for (const item of pending.values()) item.reject(new Error('Chrome cerró')); pending.clear(); });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) { const item = pending.get(message.id); pending.delete(message.id); if (message.error) item?.reject(new Error(message.error.message)); else item?.resolve(message.result); return; }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
      if (message.method === 'Runtime.consoleAPICalled') consoleMessages.push(message.params.args.map(arg => arg.value || '').join(' '));
      if (message.method !== 'Fetch.requestPaused') return;
      const { requestId, request } = message.params, url = new URL(request.url), path = url.pathname;
      const body = request.postData ? JSON.parse(request.postData) : undefined;
      requests.push({ path, method: request.method, query: Object.fromEntries(url.searchParams), body });
      const finish = (status, data) => { void respond(requestId, status, data).catch(error => errors.push(error.message)); };
      if (path === '/api/auth/me') { finish(rol ? 200 : 401, rol ? { data: { idUsuario: rol, idRol: rol, nombreUsuario: `usuario-${rol}` } } : { message: 'No autenticado' }); return; }
      if (path === '/api/ventas' && request.method === 'GET') {
        const p = url.searchParams, pagina = Number(p.get('pagina') || 1), limite = Number(p.get('limite') || 25);
        const rows = ventas.filter(v => (!p.get('estadoOperacion') || v.estadoOperacion === p.get('estadoOperacion')) && (!p.get('idVenta') || String(v.idVenta) === p.get('idVenta')));
        finish(200, { data: rows.slice((pagina - 1) * limite, pagina * limite), paginacion: { pagina, limite, total: rows.length, totalPaginas: Math.ceil(rows.length / limite) } }); return;
      }
      if (/^\/api\/ventas\/\d+$/.test(path) && request.method === 'GET') {
        const id = Number(path.split('/')[3]); finish(ventaPorId(id) ? 200 : 404, ventaPorId(id) ? { data: ventaCompleta(id) } : { message: 'Venta no encontrada' }); return;
      }
      if (/^\/api\/ventas\/\d+\/confirmar$/.test(path) && request.method === 'POST') {
        const v = ventaPorId(Number(path.split('/')[3]));
        if (v.detalles.some(d => !recetas.some(r => r.idReceta === d.idReceta && r.resultadoRevision === 'APROBADA'))) { finish(409, { message: 'Se requieren recetas aprobadas' }); return; }
        v.estadoOperacion = 'CONFIRMADA'; v.fechaVenta = '2026-11-02 12:00:00'; finish(200, { data: ventaCompleta(v.idVenta) }); return;
      }
      const match = path.match(/^\/api\/ventas\/(\d+)\/recetas(?:\/(\d+))?(\/revisar)?$/);
      if (!match) { unexpected.push(path); finish(404, { message: 'Endpoint inesperado' }); return; }
      const idVenta = Number(match[1]), idReceta = match[2] ? Number(match[2]) : null;
      if (request.method === 'GET') {
        if (nextRead) { const planned = nextRead; if (!planned.persist) nextRead = null; if (planned.networkError) void send('Fetch.failRequest', { requestId, errorReason: 'ConnectionRefused' }); else finish(planned.status, planned.body); return; }
        if (rol !== 2) { finish(403, { message: 'Denegado' }); return; }
        if (idReceta) { const receta = recetas.find(r => r.idVenta === idVenta && r.idReceta === idReceta); finish(receta ? 200 : 404, receta ? { data: receta } : { message: 'Receta no encontrada en la venta' }); return; }
        const rows = recetas.filter(r => r.idVenta === idVenta), pagina = Number(url.searchParams.get('pagina') || 1), limite = Number(url.searchParams.get('limite') || 25);
        const data = rows.slice((pagina - 1) * limite, pagina * limite).map(({ idReceta, idVenta, fechaReceta, modalidad, resultadoRevision, idUsuarioValidador, fechaRegistro, fechaValidacion }) => ({ idReceta, idVenta, fechaReceta, modalidad, resultadoRevision, idUsuarioValidador, fechaRegistro, fechaValidacion }));
        finish(200, { data, paginacion: { pagina, limite, total: rows.length, totalPaginas: Math.ceil(rows.length / limite) } }); return;
      }
      if (request.method === 'POST') {
        const planned = nextWrite; nextWrite = null;
        const commit = () => idReceta ? revisar(idReceta, body) : registrar(idVenta, body);
        if (planned?.hold) { heldWrite = { requestId, idVenta, idReceta, body }; return; }
        if (planned?.commit) commit();
        if (planned?.networkError) void send('Fetch.failRequest', { requestId, errorReason: 'ConnectionRefused' });
        else if (planned) finish(planned.status, planned.body);
        else finish(idReceta ? 200 : 201, { data: commit() });
        return;
      }
      unexpected.push(path); finish(405, { message: 'Método no permitido' });
    });
    await send('Page.enable'); await send('Runtime.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: `${origin}/api/*` }] });
    const evaluate = async expression => { const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); assert.ok(!response.exceptionDetails, JSON.stringify(response.exceptionDetails)); return response.result.value; };
    const waitFor = expression => waitUntil(async () => { try { return await evaluate(expression); } catch { return false; } });
    const navigate = async path => { await evaluate('window.__navigating=true'); await send('Page.navigate', { url: `${origin}${path}` }); await waitFor('!window.__navigating && document.readyState === "complete"'); };
    const ready = () => waitFor('!!document.querySelector(".recetas-page") && document.querySelector("[aria-busy]")?.getAttribute("aria-busy") === "false"');
    const saleReady = () => waitFor('!!document.querySelector(".ventas-page") && document.querySelector("[aria-busy]")?.getAttribute("aria-busy") === "false"');
    const contains = text => waitFor(`document.querySelector('main')?.textContent.includes(${JSON.stringify(text)})`);
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const input = (id, value) => evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    const select = (id, value) => evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    const posts = () => requests.filter(r => r.method === 'POST');
    const recipeRequests = () => requests.filter(r => r.path.includes('/recetas'));
    const formValues = { 'receta-numero': 'TEST-2', 'receta-fecha': '2026-11-02', 'receta-paciente': 'PACIENTE_PRIVADO_PRUEBA', 'receta-documento': 'DOC_PRIVADO_PRUEBA', 'receta-medico': 'MEDICO_PRIVADO_PRUEBA', 'receta-modalidad': 'Consulta', 'receta-observacion': 'Nota de prueba' };
    const fill = async (id = 1) => { await navigate(`/ventas/${id}/recetas/nueva`); await ready(); for (const [campo, valor] of Object.entries(formValues)) await input(campo, valor); };
    const reviewRegistration = async () => { await click('.receta-form button[type=submit]'); await waitFor('!!document.querySelector("[role=dialog]")'); };
    const confirm = () => click('.modal__actions button:last-child');
    const settled = () => waitFor('!document.querySelector("[role=dialog]")');
    const reviewDecision = async (value = 'APROBADA') => { await select('receta-resultado', value); await click('.receta-revision button[type=submit]'); await waitFor('!!document.querySelector("[role=dialog]")'); };
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
      await key('Escape', 27); await settled();
      await waitFor(`document.activeElement === document.querySelector(${JSON.stringify(disparador)})`);
    };

    await t.test('Permisos: Administrador no accede; Vendedor registra pero no consulta ni revisa datos sensibles', async () => {
      for (const role of [1, 3]) {
        rol = role; const before = recipeRequests().length;
        for (const path of ['/recetas', '/ventas/1/recetas', '/ventas/1/recetas/1']) { await navigate(path); await waitFor('location.pathname === "/dashboard"'); }
        if (role === 1) for (const path of ['/recetas/registrar', '/ventas/1/recetas/nueva']) { await navigate(path); await waitFor('location.pathname === "/dashboard"'); }
        assert.equal(recipeRequests().length, before);
      }
      await fill(); assert.equal(await evaluate('!!document.querySelector("input[type=file]")'), false);
      assert.ok(await evaluate(`!!document.querySelector('.app-sidebar a[href="/recetas/registrar"][aria-current="page"]')`));
      await navigate('/dashboard'); await waitFor(`!!document.querySelector('.dashboard-module[href="/recetas/registrar"]')`);
      await click('.dashboard-module[href="/recetas/registrar"]'); await saleReady();
    });
    await t.test('Seleccionar venta reutiliza el listado y solo ofrece registro sobre pendientes', async () => {
      await navigate('/recetas/registrar'); await saleReady();
      assert.equal(requests.filter(r => r.path === '/api/ventas').at(-1).query.estadoOperacion, 'PENDIENTE');
      await click('.venta-table a'); await ready(); assert.equal(await evaluate('location.pathname'), '/ventas/1/recetas/nueva');
      for (const id of [2, 3]) { await navigate(`/ventas/${id}/recetas/nueva`); await ready(); await contains('La venta no está pendiente'); assert.equal(await evaluate('!!document.querySelector(".receta-form")'), false); }
    });
    await t.test('Validación no envía datos inválidos y los detalles ya vinculados no pueden sustituirse', async () => {
      await fill(); const before = posts().length;
      assert.ok(await evaluate(`document.querySelector('.receta-producto input[value="13"]').disabled`));
      await input('receta-paciente', ' '); await click('.receta-form button[type=submit]'); await contains('Nombre del paciente:');
      assert.equal(posts().length, before);
      assert.ok(await evaluate('document.querySelector(".receta-form").textContent.includes("Sin productos seleccionados")'));
    });
    let registrada;
    await t.test('Registro exacto con varios vínculos, doble envío bloqueado y navegación sin datos personales', async () => {
      await fill(); await click('.receta-producto input[value="11"]'); await click('.receta-producto input[value="12"]'); await reviewRegistration();
      nextWrite = { hold: true }; const before = posts().length;
      await evaluate('document.querySelector(".modal__actions button:last-child").click();document.querySelector(".modal__actions button:last-child").click()');
      await waitUntil(() => heldWrite); assert.equal(posts().length, before + 1);
      assert.deepEqual(heldWrite.body, { numeroReceta: 'TEST-2', fechaReceta: '2026-11-02', nombrePaciente: 'PACIENTE_PRIVADO_PRUEBA', documentoPaciente: 'DOC_PRIVADO_PRUEBA', nombreMedico: 'MEDICO_PRIVADO_PRUEBA', modalidad: 'Consulta', observacion: 'Nota de prueba', idsDetallesVenta: [11, 12] });
      assert.ok(await evaluate('document.querySelector(".modal__actions button:last-child").disabled'));
      registrada = registrar(heldWrite.idVenta, heldWrite.body);
      await respond(heldWrite.requestId, 201, { data: registrada }); heldWrite = null;
      await waitFor('location.pathname === "/ventas/1"'); await saleReady(); await contains(`Receta #${registrada.idReceta} registrada`); await contains('Pendiente de revisión');
      assert.equal(await evaluate('JSON.stringify(history.state).includes("PACIENTE_PRIVADO")'), false);
      assert.equal(await evaluate('document.querySelector("main").textContent.includes("PACIENTE_PRIVADO")'), false);
    });
    await t.test('Regente también registra sin aprobar automáticamente; vínculo omitido no respalda productos', async () => {
      rol = 2; await fill(); await input('receta-numero', ''); await input('receta-observacion', ''); await reviewRegistration();
      await click('.modal__actions button:first-child'); const before = posts().length;
      await reviewRegistration(); await confirm(); await waitFor('location.pathname === "/ventas/1"'); await saleReady();
      assert.equal(posts().length, before + 1); assert.equal(Object.hasOwn(posts().at(-1).body, 'idsDetallesVenta'), false);
      assert.equal(recetas.at(-1).resultadoRevision, null); assert.equal(posts().at(-1).body.numeroReceta, null);
    });
    await t.test('Errores de registro conservan campos; respuesta incierta o conflicto no permite repetir el POST', async () => {
      rol = 3;
      for (const planned of [
        { status: 400, body: { message: 'Datos de receta inválidos' }, expected: 'Datos de receta inválidos', blocked: false },
        { status: 409, body: { message: 'Uno o más detalles ya tienen una receta vinculada' }, expected: 'ya tienen una receta', blocked: true },
        { status: 404, body: { message: 'Venta no encontrada' }, expected: 'Venta no encontrada', blocked: true },
        { status: 500, body: { message: 'SELECT interno' }, expected: 'No fue posible comprobar', blocked: true },
        { networkError: true, commit: true, expected: 'No fue posible comprobar', blocked: true },
        { status: 401, body: { message: 'Denegado' }, expected: 'Tu sesión ya no es válida', blocked: true },
        { status: 403, body: { message: 'Denegado' }, expected: 'No tienes autorización', blocked: true }
      ]) {
        await fill(); await reviewRegistration(); nextWrite = planned; const before = posts().length; await confirm(); await settled(); await contains(planned.expected);
        assert.equal(await evaluate('document.querySelector(".receta-form button[type=submit]").disabled'), planned.blocked);
        assert.equal(await evaluate('document.getElementById("receta-paciente").value'), 'PACIENTE_PRIVADO_PRUEBA');
        assert.equal(posts().length, before + 1);
        assert.equal(await evaluate('document.querySelector("main").textContent.includes("SELECT interno")'), false);
      }
    });
    await t.test('Listado por venta tiene paginación real, estados y ningún dato de paciente', async () => {
      rol = 2; await navigate('/recetas'); await saleReady(); await click('.venta-table a'); await ready();
      assert.equal(await evaluate('location.pathname'), '/ventas/1/recetas'); await contains('Recetas de la venta #1');
      const text = await evaluate('document.querySelector(".receta-table").textContent');
      assert.ok(text.includes('Pendiente de revisión')); assert.ok(text.includes('Rechazada')); assert.equal(text.includes('PACIENTE_PRIVADO'), false);
      await navigate('/ventas/1/recetas?limite=1'); await ready(); await contains('Página 1 de');
      await click('.consulta-pagination nav button:last-child'); await contains('Página 2 de');
      assert.equal(recipeRequests().at(-1).query.pagina, '2');
      await navigate('/ventas/1/recetas?pagina=999'); await ready(); await contains('Esta página no tiene recetas');
      const before = recipeRequests().length; await navigate('/ventas/1/recetas?paciente=no-admitido'); await ready();
      assert.equal(recipeRequests().length, before); await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Limpiar criterios").click()'); await ready();
    });
    await t.test('Detalle sensible solo para Regente; resultado definitivo, venta cerrada o revisión inconsistente no se modifican', async () => {
      await navigate('/ventas/1/recetas/1'); await ready(); await contains('PACIENTE_PRIVADO_PRUEBA'); await contains('DOC_PRIVADO_PRUEBA');
      assert.equal(await evaluate('document.getElementById("receta-revision-observacion").value'), 'Observación anterior');
      for (const path of ['/ventas/1/recetas/2', '/ventas/2/recetas/3']) { await navigate(path); await ready(); assert.equal(await evaluate('!!document.querySelector(".receta-revision")'), false); }
      const parcial = { ...baseReceta(90, 1), idUsuarioValidador: 2 }; recetas.push(parcial);
      await navigate('/ventas/1/recetas'); await ready(); await contains('Datos de revisión inconsistentes');
      await navigate('/ventas/1/recetas/90'); await ready(); await contains('Datos de revisión inconsistentes'); assert.equal(await evaluate('!!document.querySelector(".receta-revision")'), false);
    });
    await t.test('Teclado: foco dentro del diálogo, Tab cíclico, Escape y retorno al botón de registro/revisión', async () => {
      await fill(); await evaluate('document.querySelector(".receta-form button[type=submit]").focus()'); await reviewRegistration();
      await comprobarFocoDialogo('.receta-form button[type=submit]');
      await navigate(`/ventas/1/recetas/${registrada.idReceta}`); await ready(); await select('receta-resultado', 'APROBADA');
      await evaluate('document.querySelector(".receta-revision button[type=submit]").focus()');
      await click('.receta-revision button[type=submit]'); await waitFor('!!document.querySelector("[role=dialog]")');
      await comprobarFocoDialogo('.receta-revision button[type=submit]');
    });
    await t.test('Aprobar requiere confirmación, bloquea duplicados y actualiza detalle/listado/venta sin confirmar la venta', async () => {
      await navigate(`/ventas/1/recetas/${registrada.idReceta}`); await ready(); await reviewDecision(); await click('.modal__actions button:first-child');
      await input('receta-revision-observacion', ''); await reviewDecision(); nextWrite = { hold: true }; const before = posts().length;
      await evaluate('document.querySelector(".modal__actions button:last-child").click();document.querySelector(".modal__actions button:last-child").click()');
      await waitUntil(() => heldWrite); assert.equal(posts().length, before + 1); assert.deepEqual(heldWrite.body, { resultadoRevision: 'APROBADA', observacion: null });
      await respond(heldWrite.requestId, 200, { data: revisar(heldWrite.idReceta, heldWrite.body) }); heldWrite = null;
      await settled(); await contains('Revisión registrada'); await contains('Aprobada');
      assert.equal(await evaluate('!!document.querySelector(".receta-revision")'), false); assert.equal(ventaPorId(1).estadoOperacion, 'PENDIENTE');
      await click('.back-link'); await ready(); await contains('Aprobada');
      await navigate('/ventas/1'); await saleReady(); await contains('Aprobada');
    });
    await t.test('Rechazo registra observación y la decisión se conserva al recargar', async () => {
      await navigate('/ventas/1/recetas/1'); await ready(); await input('receta-revision-observacion', 'Datos no válidos'); await reviewDecision('RECHAZADA'); await confirm(); await settled();
      await contains('Rechazada'); await contains('Datos no válidos');
      await navigate('/ventas/1/recetas/1'); await ready(); assert.equal(await evaluate('!!document.querySelector(".receta-revision")'), false);
    });
    await t.test('Revisión fallida no muestra éxito y exige consultar ante conflictos, red o respuesta perdida', async () => {
      const pendiente = registrar(1, {});
      for (const planned of [
        { status: 400, body: { message: 'Datos de receta inválidos' }, expected: 'Datos de receta inválidos', blocked: false },
        { status: 409, body: { message: 'La receta ya fue revisada' }, expected: 'La receta ya fue revisada', blocked: true },
        { status: 404, body: { message: 'Receta no encontrada' }, expected: 'Receta no encontrada', blocked: true },
        { status: 500, body: { message: 'SELECT interno' }, expected: 'No fue posible comprobar', blocked: true },
        { networkError: true, expected: 'No fue posible comprobar', blocked: true },
        { status: 200, body: { data: baseReceta(pendiente.idReceta, 1) }, expected: 'No fue posible comprobar', blocked: true },
        { status: 401, body: { message: 'Denegado' }, expected: 'Tu sesión ya no es válida', blocked: true },
        { status: 403, body: { message: 'Denegado' }, expected: 'No tienes autorización', blocked: true }
      ]) {
        await navigate(`/ventas/1/recetas/${pendiente.idReceta}`); await ready(); await reviewDecision(); nextWrite = planned; await confirm(); await settled(); await contains(planned.expected);
        if (planned.status === 401 || planned.status === 403) {
          assert.equal(await evaluate('!!document.querySelector(".receta-revision")'), false);
          assert.equal(await evaluate('document.querySelector("main").textContent.includes("PACIENTE_PRIVADO")'), false);
          assert.equal(await evaluate('document.querySelector("main").textContent.includes("DOC_PRIVADO")'), false);
        } else assert.equal(await evaluate('document.querySelector(".receta-revision button[type=submit]").disabled'), planned.blocked);
        assert.equal(await evaluate('!!document.querySelector(".feedback--success")'), false);
      }
      await navigate(`/ventas/1/recetas/${pendiente.idReceta}`); await ready(); await reviewDecision(); nextWrite = { networkError: true, commit: true }; const before = posts().length;
      await confirm(); await settled(); await contains('No fue posible comprobar'); await click('.catalogo-toolbar button'); await ready(); await contains('Aprobada');
      assert.equal(await evaluate('!!document.querySelector(".receta-revision")'), false); assert.equal(posts().length, before + 1);
    });
    await t.test('Errores de lectura retiran datos sensibles; IDs y criterios inválidos no consultan endpoints', async () => {
      for (const planned of [
        { status: 400, body: { message: 'Datos inválidos' }, expected: 'Datos inválidos' },
        { status: 404, body: { message: 'Receta no encontrada en la venta' }, expected: 'Receta no encontrada' },
        { status: 500, body: { message: 'SELECT interno' }, expected: 'No fue posible cargar' },
        { networkError: true, expected: 'No se pudo conectar' },
        { status: 403, body: { message: 'Denegado' }, expected: 'No tienes autorización' },
        { status: 401, body: { message: 'Denegado' }, expected: 'Tu sesión ya no es válida' }
      ]) {
        nextRead = planned; await navigate('/ventas/1/recetas/1'); await ready(); await contains(planned.expected);
        assert.equal(await evaluate('document.querySelector("main").textContent.includes("PACIENTE_PRIVADO")'), false);
      }
      const before = recipeRequests().length;
      for (const path of ['/ventas/01/recetas', '/ventas/1/recetas/01', '/ventas/01/recetas/nueva']) { await navigate(path); await ready(); }
      assert.equal(recipeRequests().length, before);
    });
    await t.test('Flujo relacionado: registrar, aprobar y volver como Vendedor para confirmar por backend', async () => {
      rol = 3; await fill(4); await click('.receta-producto input[value="41"]'); await reviewRegistration(); await confirm(); await waitFor('location.pathname === "/ventas/4"'); await saleReady();
      const receta = recetas.at(-1); assert.equal(receta.resultadoRevision, null);
      rol = 2; await navigate(`/ventas/4/recetas/${receta.idReceta}`); await ready(); await reviewDecision(); await confirm(); await settled();
      assert.equal(ventaPorId(4).estadoOperacion, 'PENDIENTE');
      rol = 3; await navigate('/ventas/4'); await saleReady(); await contains('Aprobada'); await click('.venta-confirmacion > button'); await confirm(); await settled(); await contains('Venta confirmada.');
      assert.equal(ventaPorId(4).estadoOperacion, 'CONFIRMADA'); assert.deepEqual(posts().at(-1).body, {});
    });
    await t.test('Respuestas tardías no navegan ni sustituyen los datos de otra venta o receta', async () => {
      rol = 3; await fill(); await reviewRegistration(); nextWrite = { hold: true }; await confirm(); await waitUntil(() => heldWrite);
      const registro = heldWrite; heldWrite = null;
      await navigate('/ventas/2'); await saleReady(); await respond(registro.requestId, 201, { data: registrar(registro.idVenta, registro.body) });
      assert.equal(await evaluate('location.pathname'), '/ventas/2');
      rol = 2; const pendiente = registrar(1, {});
      await navigate(`/ventas/1/recetas/${pendiente.idReceta}`); await ready(); await reviewDecision(); nextWrite = { hold: true }; await confirm(); await waitUntil(() => heldWrite);
      const revision = heldWrite; heldWrite = null;
      await navigate('/ventas/1/recetas/2'); await ready(); await respond(revision.requestId, 200, { data: revisar(revision.idReceta, revision.body) });
      assert.equal(await evaluate('location.pathname'), '/ventas/1/recetas/2');
      assert.equal(await evaluate('!!document.querySelector(".feedback--success")'), false);
    });
    await t.test('Móvil, datos solo en memoria, sin archivos ni exposición en URL, estado de navegación o logs', async () => {
      await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
      rol = 2; await fill(); assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
      await reviewRegistration(); assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
      await navigate('/ventas/1/recetas/1'); await ready(); assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
      assert.equal(await evaluate('localStorage.length + sessionStorage.length'), 0);
      assert.equal(await evaluate('JSON.stringify(history.state).includes("PACIENTE_PRIVADO") || location.href.includes("PACIENTE_PRIVADO")'), false);
      assert.equal(consoleMessages.some(value => /PACIENTE_PRIVADO|DOC_PRIVADO|MEDICO_PRIVADO/.test(value)), false);
      rol = null; const before = recipeRequests().length; await navigate('/ventas/1/recetas/1'); await waitFor('location.pathname === "/login"'); assert.equal(recipeRequests().length, before);
    });
    assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
  } finally {
    if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch {} } socket?.close();
    for (const child of [browser, server]) { if (!child || child.exitCode !== null) continue; const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; }
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
