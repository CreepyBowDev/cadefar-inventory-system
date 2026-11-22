// React/Router/Axios reales, API interceptada por CDP. Sin backend/MySQL,
// guardado de descargas: se observa la activación del anchor. Capturas sintéticas
// opt-in mediante CADEFAR_REPORTES_SCREENSHOTS, fuera del repositorio.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estadisticasVentas } from './fixtures/estadisticasVentas.mjs';
import { estadisticasFuente } from './fixtures/estadisticasComprasPerdidas.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const executable = process.env.CADEFAR_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const esperar = async predicate => {
  const end = Date.now() + 15000;
  while (Date.now() < end) { const result = await predicate(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 25)); }
  throw new Error('Tiempo agotado esperando exportación tabular');
};
const mime = { PDF: 'application/pdf', XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', CSV: 'text/csv' };
const respuesta = (fuente, params) => {
  if (fuente === 'movimientos') return { data: [] };
  const grupo = { cantidad: 0, importe: '0.00' }, retiro = { cantidadRetiros: 0, cantidadRetirada: '0', perdida: '0.00' };
  const resumen = fuente === 'ventas' ? { confirmadas: grupo, pendientes: grupo, anuladasConfirmadas: grupo, anuladasSinConfirmar: grupo, totalVentasRealizadas: '0.00' }
    : fuente === 'compras' ? { confirmadas: grupo, anuladas: grupo, totalComprasRealizadas: '0.00' }
      : { vencimiento: retiro, dano: retiro, cantidadRetiros: 0, cantidadRetirada: '0', perdidaTotal: '0.00' };
  return { data: { periodo: { modalidad: 'MES', desde: '2026-11-01', hasta: '2026-11-30', zonaHoraria: 'America/La_Paz' }, resumen, detalle: [] },
    paginacion: { pagina: Number(params.get('pagina') || 1), limite: Number(params.get('limite') || 25), total: 0, totalPaginas: 0 } };
};

test('Regresión conjunta Consulta/Estadísticas/TABULAR: cuatro páginas, recursos y estados con API simulada', { timeout: 300000 }, async t => {
  assert.ok(executable, 'Configura CADEFAR_TEST_BROWSER');
  const profile = await mkdtemp(join(process.env.LOCALAPPDATA, 'Temp', 'opencode', 'cadefar-tabular-'));
  const origin = 'http://127.0.0.1:5191';
  const servidor = spawn(process.execPath, ['--input-type=module', '--eval', `
    import { build } from 'vite'; import { createServer } from 'node:http';
    import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
    const outDir=${JSON.stringify(join(profile, 'app'))};
    await build({logLevel:'warn',build:{outDir,emptyOutDir:true}});
    createServer(async(req,res)=>{const path=new URL(req.url,'${origin}').pathname;
      if(path.startsWith('/api/')) {res.writeHead(500);res.end();return;}
      try {const file=join(outDir,path.startsWith('/assets/')?path:'index.html');
      res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.css':'text/css','.png':'image/png','.html':'text/html'}[extname(file)]});res.end(await readFile(file));}
      catch {res.writeHead(404);res.end();}
    }).listen(5191,'127.0.0.1',()=>console.log('${origin}'));
  `], { cwd: root, env: { ...process.env, VITE_API_URL: `${origin}/api` }, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser, socket, send, rol = 1, loginRol, planned, held, estadisticasOpciones, plannedJson, heldJson;
  const requests = [], errors = [], unexpected = [];
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Servidor de prueba no inició')), 20000);
      servidor.stdout.on('data', chunk => { if (chunk.toString().includes(origin)) { clearTimeout(timer); resolve(); } });
      servidor.once('error', reject); servidor.once('exit', () => reject(new Error('Servidor cerrado')));
    });
    browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
    const port = await esperar(async () => { try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { return null; } });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    let sequence = 0; const pending = new Map();
    send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP ${method}`)); }, 10000);
      pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const fulfill = (id, status, body, headers = { 'Content-Type': 'application/json' }) => send('Fetch.fulfillRequest', { requestId: id, responseCode: status,
      responseHeaders: Object.entries(headers).map(([name, value]) => ({ name, value })), body: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)).toString('base64') });
    const archivo = (id, formato, extra = {}) => fulfill(id, 200, 'bytes sintéticos, no documento real', { 'Content-Type': mime[formato], ...extra });
    // Un aborto real de XHR retira la intercepción en Chrome. Solo ese rechazo
    // concreto es esperado al intentar entregar la respuesta retenida.
    const entregarTardia = async old => {
      try { await archivo(old.id, old.formato); }
      catch (error) { assert.match(error.message, /Invalid InterceptionId/); }
    };
    socket.addEventListener('close', () => { for (const item of pending.values()) item.reject(new Error('Navegador cerrado')); pending.clear(); });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) { const item = pending.get(message.id); pending.delete(message.id); if (message.error) item?.reject(new Error(message.error.message)); else item?.resolve(message.result); return; }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
      if (message.method !== 'Fetch.requestPaused') return;
      const { requestId, request } = message.params, url = new URL(request.url), path = url.pathname;
      requests.push({ path, method: request.method, query: Object.fromEntries(url.searchParams) });
      const finish = promise => void promise.catch(error => errors.push(error.message));
      if (path === '/api/auth/me') { finish(fulfill(requestId, rol ? 200 : 401, rol ? { data: { idUsuario: rol, idRol: rol, nombreUsuario: 'simulado' } } : { message: 'No autenticado' })); return; }
      // Credenciales ficticias solo en el formulario: no registrar body ni fabricar JWT/cookies.
      if (path === '/api/auth/login' && request.method === 'POST') { rol = loginRol; finish(fulfill(requestId, 200, { data: { idUsuario: rol, idRol: rol, nombreUsuario: 'simulado' } })); return; }
      if (path === '/api/auth/logout' && request.method === 'POST') { rol = null; finish(fulfill(requestId, 200, {})); return; }
      const match = /^\/api\/(?:reportes\/(ventas|compras|perdidas)|inventario\/(movimientos))(\/exportar|\/estadisticas)?$/.exec(path);
      if (!match) { unexpected.push(path); finish(fulfill(requestId, 500, {})); return; }
      const fuente = match[1] || match[2];
      if (match[3] === '/estadisticas') {
        const opciones = estadisticasOpciones; estadisticasOpciones = undefined;
        const next = plannedJson; plannedJson = null;
        const body = fuente === 'ventas' ? estadisticasVentas(url.searchParams, opciones) : estadisticasFuente(fuente, url.searchParams, opciones);
        if (next?.hold) { heldJson = { id: requestId, body }; return; }
        finish(fulfill(requestId, next?.status || 200, next?.status ? { message: 'Datos inválidos' } : body)); return;
      }
      if (!match[3]) { finish(fulfill(requestId, 200, respuesta(fuente, url.searchParams))); return; }
      const next = planned; planned = null;
      if (next?.hold) { held = { id: requestId, formato: url.searchParams.get('formato') }; return; }
      if (next?.network) { finish(send('Fetch.failRequest', { requestId, errorReason: 'ConnectionReset' })); return; }
      if (next?.status) { finish(fulfill(requestId, next.status, { message: next.message }, { 'Content-Type': 'application/json', ...(next.retry ? { 'Retry-After': '5' } : {}) })); return; }
      if (next?.invalid) { finish(fulfill(requestId, 200, 'transporte inválido', { 'Content-Type': 'text/html' })); return; }
      finish(archivo(requestId, url.searchParams.get('formato'), next?.nombre ? { 'Content-Disposition': 'attachment; filename="servidor-seguro.pdf"' } : {}));
    });
    await send('Page.enable'); await send('Runtime.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/*api/*' }] });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.__descargas=[]; window.__creadas=[]; window.__revocadas=[]; window.__limpiezas=[];
      const crear=URL.createObjectURL.bind(URL); URL.createObjectURL=b=>{const u=crear(b);__creadas.push(u);return u;};
      const revocar=URL.revokeObjectURL.bind(URL); URL.revokeObjectURL=u=>{__revocadas.push(u);revocar(u);};
      const timer=window.setTimeout; window.setTimeout=(fn,ms,...args)=>ms===60000?(__limpiezas.push(fn),0):timer(fn,ms,...args);
      const click=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){if(this.download){__descargas.push({nombre:this.download,url:this.href,conectado:this.isConnected});return;}return click.call(this);};
      const headers=XMLHttpRequest.prototype.getAllResponseHeaders;
      XMLHttpRequest.prototype.getAllResponseHeaders=function(){const value=headers.call(this);return window.__ocultarCabeceras?value.split(/\\r?\\n/).filter(line=>! /^(content-disposition|retry-after):/i.test(line)).join('\\r\\n'):value;};
    ` });
    const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails)); return result.result.value; };
    const wait = expression => esperar(() => evaluate(expression));
    const settle = () => evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    const navigate = async path => { await evaluate('window.__navigating=true'); await send('Page.navigate', { url: origin + path }); await wait('!window.__navigating && document.readyState==="complete"'); };
    const ready = () => wait('!!document.querySelector(".reporte-exportacion") && document.querySelector(".catalogo-panel > div[aria-busy]")?.getAttribute("aria-busy")==="false"');
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const select = async (value, selector = '.reporte-exportacion select') => { await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`); await settle(); };
    const exportar = () => click('.reporte-exportacion__acciones button');
    const count = () => requests.filter(r => r.path.endsWith('/exportar')).length;
    const descarga = n => wait(`__descargas.length===${n}`);
    const ruta = fuente => fuente === 'movimientos' ? '/inventario/movimientos' : `/reportes/${fuente}`;
    const contains = text => wait(`document.body.textContent.includes(${JSON.stringify(text)})`);
    const capturaExportacion = async nombre => {
      if (!process.env.CADEFAR_REPORTES_SCREENSHOTS) return;
      const directory = process.env.CADEFAR_REPORTES_SCREENSHOTS;
      await mkdir(directory, { recursive: true }); await evaluate('window.scrollTo(0,0)'); await settle();
      const clip = await evaluate('(()=>{const r=document.querySelector(".reporte-exportacion").getBoundingClientRect();return {x:0,y:r.top+scrollY,width:innerWidth,height:r.height,scale:1};})()');
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
      await writeFile(join(directory, `${nombre}.png`), Buffer.from(data, 'base64'));
    };

    await t.test('12 variantes, paths exactos, vacío/página lejana, selección explícita, consultas intactas y recursos', async () => {
      for (const fuente of ['ventas', 'compras', 'perdidas', 'movimientos']) {
        await navigate(ruta(fuente) + (fuente === 'movimientos' ? '?desde=2026-01-01&motivo=AJUSTE+LIBRE' : '?mes=2026-11&pagina=99&limite=7')); await ready();
        assert.ok(await evaluate('document.querySelector(".reporte-exportacion__acciones button").disabled'));
        const ordinarias = requests.filter(r => r.path === '/api' + ruta(fuente));
        assert.equal(ordinarias.length > 0, true);
        const antes = requests.filter(r => !r.path.endsWith('/exportar')).length;
        for (const formato of ['PDF', 'XLSX', 'CSV']) {
          await select(formato); const n = count(), recibidas = await evaluate('__descargas.length'); await exportar(); await descarga(recibidas + 1);
          await contains('Archivo recibido; descarga iniciada.');
          assert.equal(count(), n + 1);
          assert.deepEqual(requests.at(-1), { path: '/api' + ruta(fuente) + '/exportar', method: 'GET', query: { ...(fuente === 'movimientos' ? { desde: '2026-01-01', motivo: 'AJUSTE LIBRE' } : { mes: '2026-11' }), presentacion: 'TABULAR', formato } });
          const d = await evaluate('__descargas.at(-1)'); assert.equal(d.nombre, `cadefar-${fuente}-tabular.${formato.toLowerCase()}`); assert.ok(d.conectado);
          assert.equal(await evaluate('document.querySelectorAll("a[download]").length'), 0);
          assert.equal(await evaluate('__revocadas.length'), 0);
        }
        assert.equal(requests.filter(r => !r.path.endsWith('/exportar')).length, antes);
        assert.equal(await evaluate('__creadas.length'), 3);
        await evaluate('__limpiezas.splice(0).forEach(fn=>fn())');
        assert.equal(await evaluate('__revocadas.length'), 3);
      }
    });
    await t.test('Composición compartida: formato y descarga sobreviven a Actualizar y responsive; CU40 conserva ubicación', async () => {
      for (const fuente of ['ventas', 'compras', 'perdidas', 'movimientos']) {
        await navigate(ruta(fuente) + (fuente === 'movimientos' ? '' : '?mes=2026-11')); await ready(); await select('XLSX');
        await evaluate('void(window.__formato=document.querySelector(".reporte-exportacion select"))');
        planned = { hold: true }; const antes = requests.length; await exportar(); await esperar(() => held);
        await click('.catalogo-toolbar button'); await ready();
        assert.equal(requests.slice(antes).filter(r => r.path.endsWith('/exportar')).length, 1);
        assert.equal(requests.slice(antes).filter(r => r.path === '/api' + ruta(fuente)).length, 1);
        // 683 CSS px / DPR 2 emula reflow de 1366px con zoom 200%.
        for (const width of [1366, 768, 683, 375]) {
          await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: width === 683 ? 2 : 1, mobile: width === 375 }); await settle();
          assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
          assert.ok(await evaluate('__formato === document.querySelector(".reporte-exportacion select") && __formato.value === "XLSX"'));
          assert.equal(await evaluate('document.querySelector(".reporte-exportacion fieldset").getAttribute("aria-busy")'), 'true');
          assert.ok(await evaluate('[...document.querySelectorAll(".reporte-exportacion p")].filter(el=>el.textContent.includes("128 MiB") || el.textContent.includes("consulta independiente")).every(el=>el.getBoundingClientRect().height>0 && !el.closest("details"))'));
          if (fuente === 'movimientos') assert.ok(await evaluate('!!(document.querySelector(".reporte-exportacion").compareDocumentPosition(document.querySelector(".catalogo-panel > div[aria-busy]")) & Node.DOCUMENT_POSITION_FOLLOWING)'));
        }
        const old = held; held = null; await archivo(old.id, old.formato); await descarga(1); await contains('Archivo recibido; descarga iniciada.');
        assert.equal(await evaluate('document.querySelector(".reporte-exportacion select").value'), 'XLSX');
        if (fuente === 'movimientos' && process.env.CADEFAR_REPORTES_SCREENSHOTS) {
          const directory = process.env.CADEFAR_REPORTES_SCREENSHOTS;
          await mkdir(directory, { recursive: true });
          for (const width of [768, 683]) {
            await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: width === 683 ? 2 : 1, mobile: false }); await settle();
            const { cssContentSize } = await send('Page.getLayoutMetrics');
            const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: cssContentSize.height, scale: 1 } });
            await writeFile(join(directory, `movimientos-${width}.png`), Buffer.from(data, 'base64'));
          }
        }
      }
      await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
    });
    await t.test('Reportes exigen período; URL inválida nunca se sanea; CU40 admite filtros ausentes', async () => {
      for (const fuente of ['ventas', 'compras', 'perdidas', 'movimientos']) {
        for (const query of [fuente === 'movimientos' ? 'motivo=x&motivo=y' : '', 'mes=2026-11&extra=x']) {
          await navigate(ruta(fuente) + '?' + query); await ready(); await select('CSV');
          const n = count(); await exportar(); await settle(); assert.equal(count(), n);
          assert.ok(await evaluate('document.querySelector(".reporte-exportacion__acciones button").disabled'));
        }
      }
      await navigate('/inventario/movimientos'); await ready(); await select('CSV'); await exportar(); await contains('Archivo recibido; descarga iniciada.');
      assert.deepEqual(requests.at(-1).query, { presentacion: 'TABULAR', formato: 'CSV' });
    });
    await t.test('Borrador de reporte no se exporta; debounce CU40 bloquea y cancela antes de aplicar', async () => {
      await navigate('/reportes/ventas?mes=2026-11'); await ready(); await select('PDF');
      await evaluate(`(()=>{const el=document.getElementById('reporte-mes');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'2099-01');el.dispatchEvent(new Event('input',{bubbles:true}));})()`); await settle();
      await exportar(); await contains('Archivo recibido; descarga iniciada.'); assert.equal(requests.at(-1).query.mes, '2026-11');
      await navigate('/inventario/movimientos'); await ready(); await select('PDF'); planned = { hold: true }; await exportar(); await esperar(() => held);
      await evaluate(`(()=>{const el=document.getElementById('inv-motivo');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'AJUSTE LIBRE');el.dispatchEvent(new Event('input',{bubbles:true}));})()`); await settle();
      assert.ok(await evaluate('document.querySelector(".reporte-exportacion__acciones button").disabled'));
      const old = held; held = null; await entregarTardia(old); await settle(); assert.equal(await evaluate('__descargas.length'), 0);
      await wait('location.search.includes("motivo=AJUSTE")'); await ready(); await exportar(); await contains('Archivo recibido; descarga iniciada.'); assert.equal(requests.at(-1).query.motivo, 'AJUSTE LIBRE');
    });
    await t.test('Errores Blob JSON/400/413/tres 503/500/red/transporte inválido sin retry ni pérdida de consulta', async () => {
      for (const fallo of [
        { status: 400, message: 'Datos inválidos' },
        { status: 413, message: 'La exportación supera el límite técnico; reduzca los filtros o utilice otro formato' },
        { status: 503, message: 'Generación de exportaciones ocupada; reintente más tarde', retry: true },
        { status: 503, message: 'Formato no disponible' },
        { status: 503, message: 'Se agotó el tiempo de generación; reduzca los filtros o reintente' },
        { status: 500, message: 'Error interno del servidor' }, { network: true }, { invalid: true },
        { status: 200, message: 'Datos inválidos' }
      ]) {
        await navigate('/reportes/compras?mes=2026-11'); await ready(); await select('PDF'); planned = fallo;
        const n = count(); await exportar(); await wait('!!document.querySelector(".reporte-exportacion [role=alert]")'); await settle();
        assert.equal(count(), n + 1); assert.equal(await evaluate('__descargas.length'), 0); assert.ok(await evaluate('!!document.querySelector(".reporte-resumen")'));
        if (fallo.message) await contains(fallo.message);
        if (fallo.retry) await contains('después de 5 segundos');
      }
    });
    await t.test('401/403 retiran resultados restringidos y bloquean la exportación', async () => {
      for (const fuente of ['ventas', 'movimientos']) for (const status of [401, 403]) {
        await navigate(ruta(fuente) + (fuente === 'ventas' ? '?mes=2026-11' : '')); await ready(); await select('CSV'); planned = { status, message: 'Denegado' };
        await exportar(); await contains(status === 401 ? 'Tu sesión ya no es válida' : 'No tienes autorización');
        assert.equal(await evaluate('!!document.querySelector(".reporte-resumen")'), false);
        assert.ok(await evaluate('document.querySelector(".reporte-exportacion__acciones button").disabled'));
        assert.equal(await evaluate('__descargas.length'), 0);
      }
    });
    await t.test('Doble click, cancelación, cambios aplicados, navegación y respuestas tardías', async () => {
      for (const accion of ['cancelar', 'filtros', 'salir']) {
        await navigate('/reportes/ventas?mes=2026-11'); await ready(); await select('PDF'); planned = { hold: true }; const n = count();
        await evaluate('document.querySelector(".reporte-exportacion__acciones button").click();document.querySelector(".reporte-exportacion__acciones button").click()'); await esperar(() => held); assert.equal(count(), n + 1);
        if (accion === 'cancelar') { await click('.reporte-exportacion__acciones button:last-child'); await contains('Solicitud cancelada'); }
        else if (accion === 'filtros') { await click('.reporte-filters button[type=button]'); await contains('Selecciona un período'); }
        else { await evaluate(`document.querySelector('.app-sidebar a[href="/inventario/movimientos"]').click()`); await ready(); }
        const old = held; held = null; await entregarTardia(old); await settle(); assert.equal(await evaluate('__descargas.length'), 0); assert.equal(await evaluate('__creadas.length'), 0);
      }
    });
    await t.test('Nombre servidor accesible y fallback honesto; labels, teclado y 375 px', async () => {
      await navigate('/reportes/ventas?mes=2026-11'); await ready(); await select('PDF'); planned = { nombre: true }; await exportar(); await contains('Nombre del servidor: servidor-seguro.pdf');
      for (const width of [1366, 375]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 375 }); await settle();
        assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
        assert.ok(await evaluate('document.querySelector(".reporte-exportacion select").labels.length>0'));
        await evaluate('document.querySelector(".reporte-exportacion select").focus()');
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', windowsVirtualKeyCode: 9 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', windowsVirtualKeyCode: 9 });
        assert.equal(await evaluate('document.activeElement.textContent.trim()'), 'Exportar PDF');
        assert.notEqual(await evaluate('getComputedStyle(document.activeElement).outlineStyle'), 'none');
      }
      const n = await evaluate('__descargas.length');
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await descarga(n + 1);
      await contains('Nombre alternativo'); await contains('El servidor determina la disponibilidad de exportación');
    });
    await t.test('Cabeceras inaccesibles simuladas y limpieza diferida tras navegación SPA', async () => {
      await navigate('/reportes/ventas?mes=2026-11'); await ready(); await select('PDF');
      await evaluate('window.__ocultarCabeceras=true'); planned = { nombre: true }; await exportar(); await descarga(1);
      await contains('Nombre alternativo'); assert.equal(await evaluate('__descargas[0].nombre'), 'cadefar-ventas-tabular.pdf');
      planned = { status: 503, message: 'Generación de exportaciones ocupada; reintente más tarde', retry: true };
      await exportar(); await contains('Generación de exportaciones ocupada');
      assert.equal(await evaluate('document.querySelector(".reporte-exportacion").textContent.includes("después de 5 segundos")'), false);
      await evaluate(`document.querySelector('.app-sidebar a[href="/inventario/movimientos"]').click()`); await ready();
      assert.equal(await evaluate('__revocadas.length'), 0);
      await evaluate('__limpiezas.splice(0).forEach(fn=>fn())'); assert.equal(await evaluate('__revocadas.length'), 1);
    });
    const estadisticaQuery = 'desde=2026-11-15&hasta=2026-12-05&pagina=99&limite=7&vista=ESTADISTICAS&uiGranularidad=MES';
    const statsReady = () => wait('!!document.querySelector(".reporte-estadisticas")');
    const chart = '.reporte-estadisticas .reporte-exportacion__acciones .form-field:first-child select';
    const metric = '.reporte-estadisticas .reporte-exportacion__acciones .form-field:nth-child(2) select';
    const field = async (id, value) => { await evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`); await settle(); };
    await t.test('JSON y archivo simultáneos: cargas, errores y snapshots independientes en las tres fuentes', async () => {
      for (const fuente of ['ventas', 'compras', 'perdidas']) for (const status of [200, 500]) {
        await navigate(ruta(fuente) + '?' + estadisticaQuery); await statsReady(); await select('CSV');
        planned = { hold: true }; await exportar(); await esperar(() => held);
        const n = count(); plannedJson = { hold: true };
        await click('.catalogo-toolbar button'); await esperar(() => heldJson);
        assert.equal(await evaluate('document.querySelectorAll(".reporte-estadisticas,.reporte-resumen").length'), 0);
        assert.ok(await evaluate('document.querySelector(".reporte-exportacion fieldset").getAttribute("aria-busy")==="true"'));
        const old = held; held = null; await archivo(old.id, old.formato); await descarga(1);
        await contains('Archivo recibido; descarga iniciada.');
        const json = heldJson; heldJson = null;
        await fulfill(json.id, status, status === 200 ? json.body : { message: 'Error interno del servidor' });
        if (status === 200) await statsReady(); else await contains('No fue posible consultar estadísticas');
        await contains('Archivo recibido; descarga iniciada.'); assert.equal(count(), n);
        assert.equal(await evaluate('__creadas.length'), 1);
        // Invertir el orden: refrescar JSON no cancela una descarga independiente.
        planned = { hold: true }; await exportar(); await esperar(() => held);
        estadisticasOpciones = { vacio: true }; await click('.catalogo-toolbar button'); await statsReady(); await contains('Sin operaciones');
        assert.ok(await evaluate('document.querySelector(".reporte-exportacion fieldset").getAttribute("aria-busy")==="true"'));
        const segunda = held; held = null; await archivo(segunda.id, segunda.formato); await descarga(2);
        await contains('Sin operaciones'); await contains('Cada archivo usa una consulta independiente');
        await evaluate('__limpiezas.splice(0).forEach(fn=>fn())'); assert.equal(await evaluate('__revocadas.length'), 2);
      }
    });
    await t.test('Estadísticas: desplegables y ancho conservan panel/ocultas/explorado; Actualizar conserva formato/selección/descarga', async () => {
      for (const fuente of ['ventas', 'compras', 'perdidas']) {
        estadisticasOpciones = { intervalos1200: true };
        await navigate(ruta(fuente) + '?desde=1000-01-01&hasta=2199-12-31&vista=ESTADISTICAS&uiGranularidad=ANIO'); await statsReady();
        await select('LINEAS', chart); await select(fuente === 'perdidas' ? 'PERDIDA' : 'IMPORTE', metric);
        await select('19', '.reporte-estadisticas > .form-field select'); await click('.reporte-estadisticas__leyenda input');
        await evaluate('document.querySelector(".reporte-estadisticas__viewport [role=button]").focus()');
        const explorado = await evaluate('document.querySelector(".reporte-estadisticas__valor").textContent');
        await select('XLSX');
        await evaluate('void(window.__formato=document.querySelector(".reporte-exportacion select"))');
        planned = { hold: true }; const antes = requests.length; await exportar(); await esperar(() => held);
        for (const width of [1366, 768, 683, 375]) {
          await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: width === 683 ? 2 : 1, mobile: width === 375 }); await settle();
          for (const open of [true, false]) { await evaluate(`document.querySelectorAll(".reporte-estadisticas details, .reporte-exportacion details").forEach(d=>d.open=${open})`); await settle(); }
          assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
          assert.equal(await evaluate('document.querySelector(".reporte-estadisticas > .form-field select").value'), '19');
          assert.equal(await evaluate('document.querySelector(".reporte-estadisticas__leyenda input").checked'), false);
          assert.equal(await evaluate('document.querySelector(".reporte-estadisticas__valor").textContent'), explorado);
          assert.ok(await evaluate('__formato===document.querySelector(".reporte-exportacion select")&&__formato.value==="XLSX"'));
          assert.equal(await evaluate('document.querySelector(".reporte-exportacion fieldset").getAttribute("aria-busy")'), 'true');
        }
        estadisticasOpciones = { intervalos1200: true }; plannedJson = { hold: true }; await click('.catalogo-toolbar button'); await esperar(() => heldJson);
        assert.ok(await evaluate('__formato===document.querySelector(".reporte-exportacion select")&&__formato.value==="XLSX"'));
        const json = heldJson; heldJson = null; await fulfill(json.id, 200, json.body); await statsReady();
        assert.equal(await evaluate(`document.querySelector(${JSON.stringify(chart)}).value`), 'LINEAS');
        assert.equal(await evaluate(`document.querySelector(${JSON.stringify(metric)}).value`), fuente === 'perdidas' ? 'PERDIDA' : 'IMPORTE');
        assert.equal(requests.slice(antes).filter(r=>r.path.endsWith('/estadisticas')).length, 1);
        assert.equal(requests.slice(antes).filter(r=>r.path.endsWith('/exportar')).length, 1);
        assert.deepEqual(requests.slice(antes).find(r=>r.path.endsWith('/exportar')).query, { desde: '1000-01-01', hasta: '2199-12-31', presentacion: 'ESTADISTICA', formato: 'XLSX', granularidad: 'ANIO', grafico: 'LINEAS', metrica: fuente === 'perdidas' ? 'PERDIDA' : 'IMPORTE' });
        const old = held; held = null; await archivo(old.id, old.formato); await descarga(1); await contains('Archivo recibido; descarga iniciada.');
      }
      await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
    });
    await t.test('Feedback de descarga visible: ocupada, cancelada, fallida y recibida; criterios largos CU40', async () => {
      rol = 1;
      await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
      await navigate('/inventario/movimientos?' + new URLSearchParams({ motivo: 'ReferenciaSinteticaSinEspaciosDeCuarentaXXX'.slice(0, 40), desde: '1000-01-01', hasta: '9999-12-31', idMedicamento: '2147483647', idExistencia: '2147483647' })); await ready(); await select('XLSX');
      await evaluate('void(window.__formato=document.querySelector(".reporte-exportacion select"))');
      planned = { hold: true }; await exportar(); await esperar(() => held);
      assert.ok(await evaluate('document.querySelector(".reporte-exportacion button:last-child").textContent.includes("Cancelar")'));
      await capturaExportacion('descarga-ocupada-375');
      await click('.reporte-exportacion button:last-child'); await contains('Solicitud cancelada');
      const old = held; held = null; await entregarTardia(old);
      await capturaExportacion('descarga-cancelada-375');
      planned = { status: 503, message: 'Generación de exportaciones ocupada; reintente más tarde', retry: true };
      await exportar(); await contains('después de 5 segundos'); await capturaExportacion('descarga-fallida-375');
      await exportar(); await descarga(1); await contains('Archivo recibido; descarga iniciada.'); await capturaExportacion('descarga-recibida-375');
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1&&__formato===document.querySelector(".reporte-exportacion select")&&__formato.value==="XLSX"'));
    });
    await t.test('401/403 estadístico durante descarga retira datos e invalida archivo; vista/formato no desbloquean', async () => {
      for (const fuente of ['ventas', 'compras', 'perdidas']) for (const status of [401, 403]) {
        await navigate(ruta(fuente) + '?' + estadisticaQuery); await statsReady(); await select('PDF');
        planned = { hold: true }; await exportar(); await esperar(() => held); plannedJson = { status };
        await click('.catalogo-toolbar button'); await contains('Estadísticas no disponibles');
        const old = held; held = null; await entregarTardia(old); await settle();
        const n = requests.filter(r => r.path.includes('/reportes/')).length;
        await click('input[value=CONSULTA]'); await contains(status === 401 ? 'Sesión no válida' : 'Acceso no autorizado');
        // Un control recién montado deja cambiar formato, pero no elimina la denegación.
        await select('XLSX'); await exportar(); await settle();
        assert.ok(await evaluate('document.querySelector(".reporte-exportacion button").disabled'));
        await click('input[value=ESTADISTICAS]'); await contains('Estadísticas no disponibles'); await select('CSV'); await exportar(); await settle();
        assert.equal(requests.filter(r => r.path.includes('/reportes/')).length, n);
        assert.equal(await evaluate('__creadas.length'), 0);
        assert.equal(await evaluate('document.querySelectorAll(".reporte-estadisticas,.reporte-resumen,a[download]").length'), 0);
      }
    });
    await t.test('URL completa inválida bloquea conjuntamente JSON y archivo, sin descartar ni reparar claves', async () => {
      for (const fuente of ['ventas', 'compras', 'perdidas']) for (const extra of ['&extra=x', '&mes=', '&mes=2026-12', '&motivo[]=DAÑO', '&vista=CONSULTA', '&uiGranularidad=DIA', '&formato=CSV', '&limite=01']) {
        const query = estadisticaQuery + extra;
        const n = requests.filter(r => r.path.includes('/reportes/')).length;
        await navigate(ruta(fuente) + '?' + query); await contains('Revisa los filtros');
        assert.equal(await evaluate('decodeURI(location.search)'), decodeURI('?' + query));
        await select('CSV'); await exportar(); await settle();
        assert.equal(requests.filter(r => r.path.includes('/reportes/')).length, n);
        assert.equal(await evaluate('__creadas.length'), 0);
      }
    });
    await t.test('9 variantes estadísticas de UI completan matriz 21; selección visual, filtros propios y criterios exactos', async () => {
      for (const fuente of ['ventas', 'compras', 'perdidas']) {
        const propios = fuente === 'perdidas' ? { motivo: 'DAÑO' } : { estadoOperacion: 'ANULADA' };
        await navigate(ruta(fuente) + '?' + estadisticaQuery + '&' + new URLSearchParams(propios)); await statsReady();
        const consultas = requests.filter(r => !r.path.endsWith('/exportar')).length;
        for (const formato of ['PDF', 'XLSX', 'CSV', 'PDF']) {
          await select(formato);
          for (const grafico of formato === 'CSV' ? ['SECTORES'] : ['BARRAS', 'LINEAS', 'SECTORES']) for (const metrica of fuente === 'perdidas' ? ['CANTIDAD_RETIROS', 'PERDIDA'] : ['CANTIDAD', 'IMPORTE']) {
            await select(grafico, chart); await select(metrica, metric);
            const n = count(), recibidas = await evaluate('__descargas.length'); await exportar(); await descarga(recibidas + 1);
            assert.equal(count(), n + 1);
            assert.deepEqual(requests.at(-1), { path: '/api' + ruta(fuente) + '/exportar', method: 'GET', query: { desde: '2026-11-15', hasta: '2026-12-05', ...propios, presentacion: 'ESTADISTICA', formato, granularidad: 'MES', ...(formato === 'CSV' ? {} : { grafico, metrica }) } });
            assert.equal(await evaluate('__descargas.at(-1).nombre'), `cadefar-${fuente}-estadistica.${formato.toLowerCase()}`);
          }
        }
        assert.equal(requests.filter(r => !r.path.endsWith('/exportar')).length, consultas);
        assert.equal(await evaluate('document.querySelectorAll("a[download]").length'), 0);
        const creadas = await evaluate('__creadas.length'); await evaluate('__limpiezas.splice(0).forEach(fn=>fn())'); assert.equal(await evaluate('__revocadas.length'), creadas);
      }
    });
    await t.test('Filtros/granularidad borradores, categorías ocultas y panel no reducen archivo; transiciones de presentación', async () => {
      await navigate('/reportes/perdidas?' + estadisticaQuery); await statsReady();
      await field('reporte-desde', '2026-11-16'); await select('ANIO', '#reporte-granularidad'); await select('DAÑO', '#reporte-motivo');
      await click('.reporte-estadisticas__leyenda input'); await select('CSV'); await exportar(); await descarga(1);
      assert.deepEqual(requests.at(-1).query, { desde: '2026-11-15', hasta: '2026-12-05', presentacion: 'ESTADISTICA', formato: 'CSV', granularidad: 'MES' });
      await contains('0.02'); await contains('UNIDADES_INVENTARIO_HETEROGENEAS'); await contains('Todas las métricas, series, categorías y ceros');
      await click('input[value=CONSULTA]'); await contains('Exportar tabla de perdidas'); await select('XLSX'); await exportar(); await descarga(2);
      assert.deepEqual(requests.at(-1).query, { desde: '2026-11-15', hasta: '2026-12-05', presentacion: 'TABULAR', formato: 'XLSX' });
      await click('input[value=ESTADISTICAS]'); await select('MES', '#reporte-granularidad'); await click('.reporte-estadisticas__controles button'); await statsReady(); await select('CSV'); await exportar(); await descarga(3);
      assert.equal(requests.at(-1).query.granularidad, 'MES');
      await navigate('/reportes/compras?desde=1000-01-01&hasta=2199-12-31&vista=ESTADISTICAS&uiGranularidad=ANIO'); await statsReady();
      await select('19', '.reporte-estadisticas > .form-field select'); await click('.reporte-estadisticas__leyenda input'); await select('PDF'); await exportar(); await descarga(1);
      assert.deepEqual(requests.at(-1).query, { desde: '1000-01-01', hasta: '2199-12-31', presentacion: 'ESTADISTICA', formato: 'PDF', granularidad: 'ANIO', grafico: 'BARRAS', metrica: 'CANTIDAD' });
      await contains('imagen, no un gráfico nativo editable');
    });
    await t.test('ESTADISTICA no repara URLs incompatibles; granularidad aplicada/URL y vacíos exportables', async () => {
      for (const extra of ['&extra=x', '&pagina=1', '&grafico=BARRAS', '&formato=CSV', '&uiGranularidad=DIA']) {
        await navigate('/reportes/ventas?' + estadisticaQuery + extra); await contains('Revisa los filtros');
        // Una URL inválida no se convierte en una consulta estadística utilizable.
        if (await evaluate('!!document.querySelector(".reporte-exportacion")')) { await select('CSV'); assert.ok(await evaluate('document.querySelector(".reporte-exportacion__acciones button").disabled')); }
      }
      await navigate('/reportes/ventas?mes=2026-11&estadoOperacion=ANULADA&vista=ESTADISTICAS&uiGranularidad=MES'); await statsReady();
      await select('DIA', '#reporte-granularidad'); await click('.reporte-estadisticas__controles button'); await statsReady(); await select('CSV'); await exportar(); await descarga(1); assert.equal(requests.at(-1).query.granularidad, 'DIA');
      await evaluate('history.back()'); await contains('Granularidad aplicada: MES'); await statsReady(); await select('CSV'); await exportar(); await descarga(2); assert.equal(requests.at(-1).query.granularidad, 'MES');
    });
    await t.test('Errores estadísticos binarios 400/413/503/500/JSON/red/transporte; sin retry ni pérdida de consulta', async () => {
      for (const fallo of [{ status: 400, message: 'Datos inválidos' }, { status: 413 }, { status: 503, message: 'Generación de exportaciones ocupada; reintente más tarde', retry: true }, { status: 503, message: 'Formato no disponible' }, { status: 503, message: 'Se agotó el tiempo de generación; reduzca los filtros o reintente' }, { status: 500 }, { status: 200, message: 'Datos inválidos' }, { network: true }, { invalid: true }]) {
        await navigate('/reportes/compras?' + estadisticaQuery); await statsReady(); await select('PDF'); planned = fallo;
        const n = count(); await exportar(); await wait('!!document.querySelector(".reporte-exportacion [role=alert]")'); await settle(); assert.equal(count(), n + 1);
        assert.equal(await evaluate('__creadas.length'), 0); assert.ok(await evaluate('!!document.querySelector(".reporte-estadisticas")'));
        if (fallo.retry) await contains('después de 5 segundos');
        await click('input[value=CONSULTA]'); await contains('Resumen de todas las coincidencias');
      }
    });
    await t.test('Vacíos estadísticos válidos en tres fuentes/formatos, sin dependencia del detalle ni imagen React', async () => {
      for (const fuente of ['ventas', 'compras', 'perdidas']) {
        estadisticasOpciones = { vacio: true }; await navigate(ruta(fuente) + '?' + estadisticaQuery); await statsReady(); await contains('Sin operaciones');
        assert.equal(await evaluate('document.querySelectorAll(".reporte-estadisticas__viewport svg").length'), 0);
        assert.ok(await evaluate('[...document.querySelectorAll("[aria-label^=Valores] tbody tr")].every(r=>["0","0.00"].includes(r.cells[7].textContent))'));
        for (const formato of ['CSV', 'PDF', 'XLSX']) { await select(formato); const n = await evaluate('__descargas.length'); await exportar(); await descarga(n + 1); assert.equal(requests.at(-1).query.formato, formato); }
      }
    });
    await t.test('401/403 de descarga estadística retiran ambas vistas; cambiar presentación no levanta restricción', async () => {
      for (const status of [401, 403]) {
        await navigate('/reportes/perdidas?' + estadisticaQuery); await statsReady(); await select('CSV'); planned = { status }; await exportar(); await contains('Estadísticas no disponibles');
        assert.equal(await evaluate('document.querySelectorAll(".reporte-resumen,.reporte-estadisticas").length'), 0);
        await click('input[value=CONSULTA]'); await contains(status === 401 ? 'Sesión no válida' : 'Acceso no autorizado');
        assert.ok(await evaluate('document.querySelector(".reporte-exportacion__acciones button").disabled'));
        await click('input[value=ESTADISTICAS]'); await contains('Estadísticas no disponibles'); assert.equal(await evaluate('__descargas.length'), 0);
      }
    });
    await t.test('Descarga estadística: doble click, cancelar/reintento manual, cambio de contexto y entrega tardía', async () => {
      for (const cambio of ['cancelar', 'granularidad', 'filtros', 'vista', 'grafico', 'salir']) {
        await navigate('/reportes/ventas?' + estadisticaQuery); await statsReady(); await select('PDF'); planned = { hold: true }; const n = count();
        await evaluate('document.querySelector(".reporte-exportacion__acciones button").click();document.querySelector(".reporte-exportacion__acciones button").click()'); await esperar(() => held); assert.equal(count(), n + 1);
        if (cambio === 'cancelar') { await click('.reporte-exportacion button:last-child'); await contains('Solicitud cancelada'); }
        if (cambio === 'granularidad') { await select('ANIO', '#reporte-granularidad'); await click('.reporte-estadisticas__controles button'); }
        if (cambio === 'filtros') { await field('reporte-desde', '2026-11-16'); await click('.reporte-filters button[type=submit]'); }
        if (cambio === 'vista') await click('input[value=CONSULTA]');
        if (cambio === 'grafico') await select('LINEAS', chart);
        if (cambio === 'salir') await click('.app-sidebar a[href="/inventario/movimientos"]');
        await settle(); const old = held; held = null; await entregarTardia(old); await settle(); assert.equal(await evaluate('__creadas.length'), 0);
        if (cambio === 'cancelar') { await exportar(); await descarga(1); assert.equal(count(), n + 2); }
      }
    });
    await t.test('Headers estadísticos accesibles/inaccesibles; teclado, foco, toque y 375 px; recursos al navegar', async () => {
      await navigate('/reportes/ventas?' + estadisticaQuery); await statsReady(); await select('PDF'); planned = { nombre: true }; await exportar(); await contains('Nombre del servidor: servidor-seguro.pdf');
      await evaluate('window.__ocultarCabeceras=true'); planned = { nombre: true }; await exportar(); await descarga(2); await contains('Nombre alternativo'); assert.equal(await evaluate('__descargas.at(-1).nombre'), 'cadefar-ventas-estadistica.pdf');
      planned = { status: 503, message: 'Generación de exportaciones ocupada; reintente más tarde', retry: true }; await exportar(); await contains('Generación de exportaciones ocupada');
      assert.equal(await evaluate('document.querySelector(".reporte-exportacion").textContent.includes("después de 5 segundos")'), false);
      await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true }); await send('Emulation.setTouchEmulationEnabled', { enabled: true }); await settle();
      assert.ok(await evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'));
      assert.ok(await evaluate('document.querySelector(".reporte-exportacion select").labels.length>0'));
      await evaluate('document.querySelector(".reporte-exportacion select").focus()'); await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', windowsVirtualKeyCode: 9 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', windowsVirtualKeyCode: 9 });
      assert.equal(await evaluate('document.activeElement.textContent.trim()'), 'Exportar PDF'); assert.notEqual(await evaluate('getComputedStyle(document.activeElement).outlineStyle'), 'none');
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await descarga(3);
      await evaluate('document.querySelector(".reporte-exportacion button").scrollIntoView({block:"center"})');
      const xy = await evaluate('(()=>{const r=document.querySelector(".reporte-exportacion button").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...xy, radiusX: 1, radiusY: 1, force: 1, id: 0 }] }); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await descarga(4);
      await click('.app-sidebar a[href="/inventario/movimientos"]'); await ready(); assert.equal(await evaluate('__revocadas.length'), 0); await evaluate('__limpiezas.splice(0).forEach(fn=>fn())'); assert.equal(await evaluate('__revocadas.length'), 4);
    });
    await t.test('Roles estadísticos: Regente solo pérdidas, CU40 sigue TABULAR; sin acceso ventas/compras', async () => {
      for (const role of [1, 2, 3, null]) for (const fuente of ['ventas', 'compras', 'perdidas']) {
        rol = role; const n = count(); await navigate(ruta(fuente) + '?' + estadisticaQuery);
        if (role === 1 || role === 2 && fuente === 'perdidas') { await statsReady(); await select('CSV'); await exportar(); await descarga(1); assert.equal(count(), n + 1); }
        else { await wait(`location.pathname===${JSON.stringify(role ? '/dashboard' : '/login')}`); assert.equal(count(), n); }
      }
    });
    await t.test('Roles y paths: Regente solo pérdidas/CU40; Vendedor y sesión ausente sin exportación', async () => {
      for (const role of [1, 2, 3, null]) for (const fuente of ['ventas', 'compras', 'perdidas', 'movimientos']) {
        rol = role; const n = count(); await navigate(ruta(fuente) + (fuente === 'movimientos' ? '' : '?mes=2026-11'));
        const permitida = role === 1 || role === 2 && ['perdidas', 'movimientos'].includes(fuente);
        if (permitida) { await ready(); await select('CSV'); await exportar(); await contains('Archivo recibido; descarga iniciada.'); assert.equal(count(), n + 1); }
        else { await wait(`location.pathname===${JSON.stringify(role ? '/dashboard' : '/login')}`); assert.equal(count(), n); assert.equal(await evaluate('!!document.querySelector(".reporte-exportacion")'), false); }
      }
    });
    await t.test('Login/logout simulados, cambio de sesión y rol descartan descarga pendiente sin persistir JWT', async () => {
      for (const role of [1, 2, 3]) {
        rol = null; loginRol = role; await navigate('/login'); await wait('!!document.querySelector(".login-form")');
        await field('nombreUsuario', 'usuario-simulado'); await field('password', 'solo-fixture-no-real');
        const n = requests.filter(r => r.path === '/api/auth/login').length;
        await click('.login-form button[type=submit]');
        await wait('location.pathname==="/dashboard" && !!document.querySelector(".app-sidebar")');
        if (role === 3) { await wait('location.pathname==="/dashboard"'); assert.equal(await evaluate('!!document.querySelector(".reporte-exportacion")'), false); }
        else {
          await click('.app-sidebar a[href="/reportes/perdidas"]'); await ready();
          await select('mes', '#reporte-modalidad'); await field('reporte-mes', '2026-11'); await click('.reporte-filters button[type=submit]'); await ready();
          await click('input[value=ESTADISTICAS]'); await select('MES', '#reporte-granularidad'); await click('.reporte-estadisticas__controles button');
          await statsReady(); await select('PDF'); planned = { hold: true }; await exportar(); await esperar(() => held);
        }
        assert.equal(requests.filter(r => r.path === '/api/auth/login').length, n + 1);
        await click('button[aria-label="Cerrar sesión"]'); await wait('!!document.querySelector(".login-form")');
        if (held) { const old = held; held = null; await entregarTardia(old); await settle(); }
        assert.equal(await evaluate('__creadas.length'), 0);
        assert.equal(await evaluate('document.querySelectorAll(".reporte-resumen,.reporte-estadisticas,.reporte-exportacion").length'), 0);
        assert.equal(await evaluate('localStorage.length + sessionStorage.length'), 0);
      }
      rol = 1;
    });
    assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
    assert.ok(requests.every(r => r.method === (['/api/auth/login', '/api/auth/logout'].includes(r.path) ? 'POST' : 'GET')));
  } finally {
    if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch {} } socket?.close();
    for (const child of [browser, servidor]) { if (!child || child.exitCode !== null) continue; const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; }
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
