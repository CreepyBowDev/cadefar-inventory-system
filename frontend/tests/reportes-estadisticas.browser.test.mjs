// React/Router/Axios reales; patrón CDP de reportes-ventas.browser.test.mjs.
// API exclusivamente simulada, sin backend, MySQL ni descargas reales.
// Capturas sintéticas opt-in fuera del repositorio con CADEFAR_REPORTES_SCREENSHOTS.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estadisticasVentas } from './fixtures/estadisticasVentas.mjs';
import { estadisticasFuente, detallePerdidas } from './fixtures/estadisticasComprasPerdidas.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const executable = process.env.CADEFAR_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const esperar = async predicate => { const end = Date.now() + 15000; while (Date.now() < end) { const value = await predicate(); if (value) return value; await new Promise(r => setTimeout(r, 25)); } throw new Error('Tiempo agotado esperando estadísticas'); };

for (const tipo of ['ventas', 'compras', 'perdidas']) test(`${tipo}: estadísticas accesibles y coexistencia con Consulta/TABULAR, API simulada`, { timeout: 240000 }, async t => {
  const perdidas = tipo === 'perdidas';
  const fixture = tipo === 'ventas' ? estadisticasVentas : (params, opciones) => estadisticasFuente(tipo, params, opciones);
  const cantidad = perdidas ? 'CANTIDAD_RETIROS' : 'CANTIDAD';
  const importe = perdidas ? 'PERDIDA' : 'IMPORTE';
  const nSeries = tipo === 'ventas' ? 8 : perdidas ? 6 : 4;
  const nCategorias = tipo === 'ventas' ? 4 : 2;
  assert.ok(executable, 'Configura CADEFAR_TEST_BROWSER');
  const profile = await mkdtemp(join(process.env.LOCALAPPDATA, 'Temp', 'opencode', 'cadefar-estadisticas-'));
  const origin = 'http://127.0.0.1:5193';
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
    }).listen(5193,'127.0.0.1',()=>console.log('${origin}'));
  `], { cwd: root, env: { ...process.env, VITE_API_URL: `${origin}/api` }, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser, socket, send, rol = 1, planned, held;
  const requests = [], errors = [], unexpected = [];
  try {
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Servidor de prueba no inició')), 20000); servidor.stdout.on('data', c => { if (c.toString().includes(origin)) { clearTimeout(timer); resolve(); } }); servidor.once('error', reject); servidor.once('exit', () => reject(new Error('Servidor cerrado'))); });
    browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
    const port = await esperar(async () => { try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { return null; } });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    let sequence = 0; const pending = new Map();
    send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP ${method}`)); }, 10000); pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: e => { clearTimeout(timer); reject(e); } }); socket.send(JSON.stringify({ id, method, params })); });
    const fulfill = (requestId, status, body) => send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
    socket.addEventListener('close', () => { for (const p of pending.values()) p.reject(new Error('Navegador cerrado')); pending.clear(); });
    socket.addEventListener('message', event => {
      const m = JSON.parse(event.data);
      if (m.id) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p?.reject(new Error(m.error.message)); else p?.resolve(m.result); return; }
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
      if (m.method !== 'Fetch.requestPaused') return;
      const { requestId, request } = m.params, url = new URL(request.url), path = url.pathname;
      requests.push({ path, method: request.method, query: Object.fromEntries(url.searchParams) });
      const finish = promise => void promise.catch(e => errors.push(e.message));
      if (path === '/api/auth/me') { finish(fulfill(requestId, rol ? 200 : 401, rol ? { data: { idUsuario: rol, idRol: rol, nombreUsuario: 'simulado' } } : { message: 'No autenticado' })); return; }
      if (path === `/api/reportes/${tipo}/estadisticas`) {
        const next = planned; planned = null;
        if (next?.hold) { held = { id: requestId, body: fixture(url.searchParams) }; return; }
        if (next?.network) { finish(send('Fetch.failRequest', { requestId, errorReason: 'ConnectionReset' })); return; }
        finish(fulfill(requestId, next?.status || 200, next?.status ? { message: 'Datos inválidos' } : fixture(url.searchParams, next || { intervalos1200: url.searchParams.get('desde') === '1000-01-01' }))); return;
      }
      if (path === `/api/reportes/${tipo}`) {
        const data = fixture(url.searchParams).data;
        const detalle = perdidas ? detallePerdidas.filter(r => !url.searchParams.has('motivo') || r.motivo === url.searchParams.get('motivo')) : [];
        finish(fulfill(requestId, 200, { data: { periodo: data.periodo, resumen: data.resumen, detalle }, paginacion: { pagina: Number(url.searchParams.get('pagina') || 1), limite: 25, total: 30, totalPaginas: 2 } })); return;
      }
      if (path === '/api/inventario/movimientos') { finish(fulfill(requestId, 200, { data: [] })); return; }
      unexpected.push(path); finish(fulfill(requestId, 500, {}));
    });
    await send('Page.enable'); await send('Runtime.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/*api/*' }] });
    const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); assert.ok(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value; };
    const wait = expression => esperar(() => evaluate(expression));
    const settle = () => evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    const navigate = async path => { await evaluate('window.__navigating=true'); await send('Page.navigate', { url: origin + path }); await wait('!window.__navigating && document.readyState==="complete"'); };
    const contains = text => wait(`document.body.textContent.includes(${JSON.stringify(text)})`);
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const select = async (selector, value) => { await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`); await settle(); };
    const field = async (id, value) => { await evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`); await settle(); };
    const ready = () => wait('!!document.querySelector(".reporte-estadisticas")');
    const count = () => requests.filter(r => r.path.endsWith('/estadisticas')).length;
    const route = query => `/reportes/${tipo}?` + query;
    const aplicada = 'desde=2026-11-15&hasta=2026-12-05&vista=ESTADISTICAS&uiGranularidad=MES';
    const chartSelect = '.reporte-estadisticas select';
    const metricaSelect = '.reporte-estadisticas .reporte-exportacion__acciones .form-field:nth-child(2) select';
    const panelSelect = '.reporte-estadisticas > .form-field select';
    const tardia = async old => { try { await fulfill(old.id, 200, old.body); } catch (e) { assert.match(e.message, /Invalid InterceptionId/); } };
    const captura = async (nombre, selector = '.catalogo-panel') => {
      if (!process.env.CADEFAR_REPORTES_SCREENSHOTS) return;
      const directory = process.env.CADEFAR_REPORTES_SCREENSHOTS;
      await mkdir(directory, { recursive: true }); await evaluate('window.scrollTo(0,0)'); await settle();
      const clip = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:0,y:r.top+scrollY,width:innerWidth,height:Math.min(1200,r.height),scale:1};})()`);
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
      await writeFile(join(directory, `${tipo}-${nombre}.png`), Buffer.from(data, 'base64'));
    };

    await t.test('Entrada Consulta y selección estadística sin granularidad nunca consultan preventivamente', async () => {
      await navigate(`/reportes/${tipo}`); await contains('Selecciona un período'); assert.equal(count(), 0);
      await click('input[value=ESTADISTICAS]'); await contains('Selecciona período y granularidad'); assert.equal(count(), 0);
      await select('#reporte-granularidad', 'MES'); await click('.reporte-estadisticas__controles button'); await settle();
      assert.equal(count(), 0); assert.ok(await evaluate('location.search.includes("uiGranularidad=MES")'));
      await select('#reporte-modalidad', 'periodo'); await field('reporte-desde', '2026-11-15'); await field('reporte-hasta', '2026-12-05');
      await click('.reporte-filters button[type=submit]'); await ready();
      assert.deepEqual(requests.filter(r => r.path.endsWith('/estadisticas')).at(-1).query, { desde: '2026-11-15', hasta: '2026-12-05', granularidad: 'MES' });
    });
    await t.test('Series contractuales, exactitud grande/bajo resolución, parciales y exploración con teclado', async () => {
      await navigate(route(aplicada)); await ready();
      assert.equal(await evaluate('document.querySelectorAll("[aria-label^=Valores] tbody tr").length'), nSeries * 2);
      await contains(perdidas ? '900719925474099312345' : '900719925474099312345.01'); await contains(perdidas ? '0.02' : '0.01'); await contains('Sí');
      assert.deepEqual(await evaluate(`Array.from(document.querySelector(${JSON.stringify(metricaSelect)}).options,o=>o.value)`), [cantidad, importe]);
      await select(metricaSelect, importe);
      await evaluate('document.querySelector(".reporte-estadisticas svg [role=button]").focus()');
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter' }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
      assert.match(await evaluate('document.querySelector(".reporte-estadisticas__valor").textContent'), /2026-11-15 al 2026-11-30.*intervalo parcial/);
      await evaluate('document.querySelectorAll(".reporte-estadisticas svg [role=button]")[3].focus()');
      assert.match(await evaluate('document.querySelector(".reporte-estadisticas__valor").textContent'), perdidas ? /0\.02/ : /0\.01/);
      assert.ok(await evaluate('document.activeElement.matches("svg [role=button]")'));
    });
    await t.test('Gráficas, métricas y leyendas no repiten GET; ocultar no modifica totales/tabla', async () => {
      const before = count(); const tabla = await evaluate('document.querySelector("[aria-label^=Valores]").textContent');
      for (const g of ['LINEAS', 'SECTORES', 'BARRAS']) { await select(chartSelect, g); await select(metricaSelect, g === 'BARRAS' ? cantidad : importe); }
      await click('.reporte-estadisticas__leyenda input'); await settle();
      assert.equal(await evaluate('document.querySelector("[aria-label^=Valores]").textContent'), tabla);
      assert.equal(count(), before); await contains(perdidas ? '0.02' : '900719925474099312345.02');
    });
    if (tipo !== 'ventas') await t.test('Todas las series/distribuciones coinciden campo por campo; particularidades de la fuente', async () => {
      await navigate(route(aplicada)); await ready();
      const esperado = fixture(new URLSearchParams('desde=2026-11-15&hasta=2026-12-05&granularidad=MES')).data;
      const filas = await evaluate('Array.from(document.querySelectorAll("[aria-label^=Valores] tbody tr"),r=>Array.from(r.cells,c=>c.textContent))');
      assert.deepEqual(filas.map(r => [r[0], r[1], r[2], r[3], r[5], r[6], r[7], r[8]]), esperado.intervalos.flatMap((i, j) => esperado.series.map(s => [i.etiqueta, i.desde, i.hasta, i.parcial ? 'Sí' : 'No', s.metrica, s.unidad, s.valores[j], s.total])));
      const distribuciones = await evaluate(`Array.from(document.querySelectorAll(${JSON.stringify('[aria-label="Distribuciones exactas"] tbody tr')}),r=>Array.from(r.cells,c=>c.textContent))`);
      assert.deepEqual(distribuciones.map(r => r.slice(1)), esperado.distribuciones.flatMap(d => d.categorias.map(c => [d.metrica, d.unidad, c.valor, d.total])));
      if (perdidas) {
        await contains('sin equivalencia farmacéutica común');
        await contains('sin descontar reversiones');
        assert.match(await evaluate('document.querySelector(".reporte-resumen").textContent'), /Pérdida total: 0,02/);
        await click('input[value=CONSULTA]'); await contains('0,005000'); await contains('0,000000');
        const reversiones = await evaluate('Array.from(document.querySelectorAll(".reporte-perdidas-table tbody tr"),r=>r.cells[10].textContent)');
        assert.deepEqual(reversiones, ['#90', '—', '—']);
        planned = { grande: true }; await navigate(route(aplicada)); await ready(); await select(metricaSelect, importe);
        await contains('900719925474099312345.01'); await contains('0.02');
        assert.equal(await evaluate('document.querySelectorAll("[aria-label^=Valores] tbody tr").length'), 12);
      } else {
        await contains('fecha de adquisición (fecha de compra), no al registro ni a la anulación');
        assert.match(await evaluate('document.querySelector(".reporte-resumen").textContent'), /Total de compras realizadas \(solo confirmadas\)900\.719\.925\.474\.099\.312\.345,01/);
        await select(metricaSelect, importe); await contains('No equivale al total de compras realizadas');
      }
    });
    if (tipo !== 'ventas') await t.test('Filtro propio borrador/aplicado: DAÑO o ANULADA, sin categorías ni parámetros ajenos', async () => {
      await navigate(route(aplicada)); await ready(); const before = count();
      const filtro = perdidas ? 'motivo' : 'estadoOperacion', valor = perdidas ? 'DAÑO' : 'ANULADA';
      await select(perdidas ? '#reporte-motivo' : '#reporte-estado', valor);
      assert.equal(count(), before);
      await click('.reporte-filters button[type=submit]'); await esperar(() => count() === before + 1); await ready();
      assert.deepEqual(requests.filter(r => r.path.endsWith('/estadisticas')).at(-1).query, { desde: '2026-11-15', hasta: '2026-12-05', [filtro]: valor, granularidad: 'MES' });
      if (perdidas) {
        assert.ok(await evaluate('[...document.querySelectorAll("[aria-label^=Valores] tbody tr")].some(r=>r.cells[5].textContent==="CANTIDAD_RETIRADA" && r.cells[6].textContent==="UNIDADES_INVENTARIO_HETEROGENEAS")'));
        await contains('0.02');
      } else {
        assert.equal(await evaluate('document.querySelectorAll("#reporte-estado option[value=PENDIENTE]").length'), 0);
        assert.match(await evaluate('document.querySelector(".reporte-resumen").textContent'), /Total de compras realizadas \(solo confirmadas\)0,00/);
      }
    });
    await t.test('Borrador/aplicado de filtros y granularidad, recarga y navegación Atrás/Adelante', async () => {
      await navigate(route(aplicada)); await ready();
      // Canonizar los defaults de página con UI no puede dejar la lectura
      // dinámica invalidada para siempre ni bloquear el formulario compartido.
      await click('.reporte-filters button[type=submit]'); await settle();
      await wait('!document.querySelector(".reporte-filters fieldset").disabled');
      const before = count();
      await field('reporte-desde', '2026-11-16'); await select('#reporte-granularidad', 'DIA');
      assert.equal(count(), before); await contains('Granularidad aplicada: MES');
      await click('.reporte-filters button[type=submit]'); await esperar(() => count() === before + 1); await ready();
      assert.equal(requests.filter(r => r.path.endsWith('/estadisticas')).at(-1).query.granularidad, 'MES');
      await click('.reporte-estadisticas__controles button'); await esperar(() => count() === before + 2); await ready();
      await evaluate('history.back()'); await contains('Granularidad aplicada: MES'); await ready();
      await evaluate('history.forward()'); await contains('Granularidad aplicada: DIA'); await ready();
      await send('Page.reload'); await ready(); await contains('Granularidad aplicada: DIA');
      assert.equal(await evaluate('document.getElementById("reporte-desde").value'), '2026-11-16');
    });
    await t.test('Página dinámica no refresca estadísticas; volver a Consulta mantiene página y TABULAR', async () => {
      await navigate(route(aplicada + '&pagina=2')); await ready(); const before = count();
      await click('input[value=CONSULTA]'); await contains(`Exportar tabla de ${tipo}`);
      assert.ok(await evaluate('!location.search.includes("vista=") && location.search.includes("pagina=2")'));
      await click('.catalogo-toolbar button'); await settle(); assert.equal(count(), before);
      assert.ok(await evaluate('!!document.querySelector(".reporte-exportacion")'));
      // La paginación de URL solo cambia la lectura dinámica, no la clave estadística.
      await click('input[value=ESTADISTICAS]'); await select('#reporte-granularidad', 'MES'); await click('.reporte-estadisticas__controles button'); await ready();
      const n = count(); await evaluate('(()=>{const u=new URL(location.href);u.searchParams.set("pagina","1");history.pushState(null,"",u);dispatchEvent(new PopStateEvent("popstate"));})()'); await settle(); await ready();
      assert.equal(count(), n);
      await evaluate('(()=>{const u=new URL(location.href);u.searchParams.sort();history.pushState(null,"",u);dispatchEvent(new PopStateEvent("popstate"));})()'); await settle(); await ready();
      assert.equal(count(), n);
      await evaluate('history.pushState(null,"",location.href+"&pagina=2");dispatchEvent(new PopStateEvent("popstate"))'); await settle();
      // Una página repetida tampoco se sanea silenciosamente.
      await contains('Revisa los filtros'); assert.equal(count(), n);
    });
    await t.test('1200 intervalos: 20 paneles completos, todos los puntos/filas accesibles; 1201 sin autoajuste', async () => {
      await navigate(route('desde=1000-01-01&hasta=2199-12-31&vista=ESTADISTICAS&uiGranularidad=ANIO')); await ready();
      const before = count(); assert.equal(await evaluate(`document.querySelector(${JSON.stringify(panelSelect)}).options.length`), 20);
      let filas = 0, puntos = 0;
      for (let i = 0; i < 20; i++) {
        await select(panelSelect, String(i));
        filas += await evaluate('document.querySelectorAll("[aria-label^=Valores] tbody tr").length');
        puntos += await evaluate('document.querySelectorAll(".reporte-estadisticas svg [role=button]").length');
      }
      assert.equal(filas, nSeries * 1200); assert.equal(puntos, nCategorias * 1200); await contains('2199-12-31'); assert.equal(count(), before);
      await select(chartSelect, 'LINEAS');
      assert.ok(await evaluate('[...document.querySelectorAll(".reporte-estadisticas polyline")].every(p=>p.getAttribute("points").split(" ").length===60)'));
      const foco = await evaluate('(()=>{const p=[...document.querySelectorAll(".reporte-estadisticas svg [role=button]")].at(-1);p.scrollIntoView({block:"center",inline:"center"});p.focus();return {esperado:p.getAttribute("aria-label"),activo:document.activeElement.getAttribute("aria-label")};})()');
      assert.equal(foco.activo, foco.esperado);
      assert.match(foco.esperado, /2199-01-01 al 2199-12-31/);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter' }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
      await wait('document.querySelector(".reporte-estadisticas__valor").textContent.includes("2199-01-01 al 2199-12-31")');
       assert.match(await evaluate('document.querySelector(".reporte-estadisticas__valor").textContent'), perdidas ? /2199-01-01 al 2199-12-31.*CANTIDAD_RETIROS: 2/ : /2199-01-01 al 2199-12-31.*CANTIDAD: 1/);
       for (const g of ['BARRAS', 'LINEAS', 'SECTORES']) for (const extremo of ['0', '19']) {
         await select(chartSelect, g); await select(panelSelect, extremo);
         assert.equal(await evaluate(`document.querySelector(${JSON.stringify(panelSelect)}).value`), extremo);
         assert.equal(await evaluate('document.querySelectorAll("[aria-label^=Valores] tbody tr").length'), nSeries * 60);
         if (g === 'SECTORES') await contains('el panel seleccionado solo cambia la tabla exacta');
         await evaluate('[...document.querySelectorAll(".reporte-estadisticas__leyenda input")].forEach(el=>el.click())'); await settle();
         await contains('Todas las categorías están ocultas');
         await evaluate('[...document.querySelectorAll(".reporte-estadisticas__leyenda input")].forEach(el=>el.click())'); await settle();
       }
       assert.equal(count(), before);
      await navigate(route('desde=1000-01-01&hasta=2200-12-31&vista=ESTADISTICAS&uiGranularidad=ANIO')); await contains('La consulta supera 1200 intervalos');
      assert.equal(count(), before); assert.equal(await evaluate('document.getElementById("reporte-granularidad").value'), 'ANIO');
    });
    await t.test('sinDatos vs importe cero; sin sectores ficticios; categorías excluidas conservan ceros', async () => {
      planned = { cero: true }; await navigate(route(aplicada)); await ready(); await select(chartSelect, 'SECTORES'); await select(metricaSelect, importe); await contains('Sin valor para graficar');
       assert.equal(await evaluate('document.querySelectorAll(".reporte-estadisticas__viewport svg").length'), 0);
       planned = { vacio: true }; await navigate(route(aplicada)); await ready(); await contains('Sin operaciones'); assert.equal(await evaluate('document.querySelectorAll(".reporte-estadisticas__viewport svg").length'), 0);
      await navigate(route(aplicada + (perdidas ? '&motivo=DA%C3%91O' : '&estadoOperacion=ANULADA'))); await ready();
      assert.ok(await evaluate(`[...document.querySelectorAll("[aria-label^=Valores] tbody tr")].filter(r=>r.cells[4].textContent===${JSON.stringify(perdidas ? 'Vencimiento' : 'Confirmada')}).every(r=>["0","0.00"].includes(r.cells[7].textContent))`));
    });
    await t.test('Errores 400/500/red independientes de consulta dinámica; sin retry automático', async () => {
      for (const next of [{ status: 400 }, { status: 500 }, { network: true }]) {
        planned = next; const before = count(); await navigate(route(aplicada)); await contains('No fue posible consultar estadísticas'); await settle(); assert.equal(count(), before + 1);
        await click('input[value=CONSULTA]'); await contains('Resumen de todas las coincidencias');
      }
    });
    await t.test('401/403 retiran ambos resultados y no reintentan; roles no autorizados sin GET estadístico', async () => {
      for (const status of [401, 403]) {
        planned = { status }; await navigate(route(aplicada)); await contains('Estadísticas no disponibles');
        assert.equal(await evaluate('document.querySelectorAll(".reporte-resumen,.reporte-estadisticas").length'), 0);
        await click('input[value=CONSULTA]'); await contains(status === 401 ? 'Sesión no válida' : 'Acceso no autorizado');
      }
      for (const role of perdidas ? [3, 0] : [2, 3, 0]) { rol = role; const before = count(); await navigate(route(aplicada)); await settle(); await wait(`!document.querySelector(".reporte-${tipo}-page")`); assert.equal(count(), before); }
      if (perdidas) {
        rol = 2; await navigate(route(aplicada)); await ready(); await contains('0.02');
        await navigate('/inventario/movimientos'); await contains('Exportar tabla de movimientos');
        assert.equal(await evaluate('document.querySelectorAll(".reporte-vista,.reporte-estadisticas").length'), 0);
      }
      rol = 1;
    });
    await t.test('Respuestas tardías tras filtros rápidos, salida de vista y desmontaje se descartan', async () => {
      for (const cambio of ['filtros', 'granularidad', 'vista', 'desmontaje']) {
        planned = { hold: true }; await navigate(route(aplicada)); await esperar(() => held); const old = held; held = null;
        if (cambio === 'filtros') { await field('reporte-desde', '2026-11-16'); await click('.reporte-filters button[type=submit]'); await ready(); }
        else if (cambio === 'granularidad') { await select('#reporte-granularidad', 'ANIO'); await click('.reporte-estadisticas__controles button'); await ready(); }
        else if (cambio === 'vista') { await click('input[value=CONSULTA]'); await contains(`Exportar tabla de ${tipo}`); }
        else { await navigate('/login'); }
        await tardia(old); await settle();
        if (cambio === 'filtros') assert.ok(await evaluate('location.search.includes("desde=2026-11-16")'));
        else if (cambio === 'granularidad') await contains('Granularidad aplicada: ANIO');
        else assert.equal(await evaluate('document.querySelectorAll(".reporte-estadisticas").length'), 0);
      }
    });
    await t.test('375px, foco visible, tabla/viewport desplazables y toque sobre punto', async () => {
      await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
      await send('Emulation.setTouchEmulationEnabled', { enabled: true });
      await navigate(route(aplicada)); await ready();
      assert.ok(await evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'));
      assert.ok(await evaluate('[...document.querySelectorAll(".reporte-estadisticas select")].every(s=>!!document.querySelector(`label[for="${s.id}"]`))'));
      await evaluate('document.querySelector(".reporte-estadisticas svg [role=button]").scrollIntoView({block:"center"})');
      const xy = await evaluate('(()=>{const r=document.querySelector(".reporte-estadisticas svg [role=button] rect").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+20};})()');
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...xy, radiusX: 1, radiusY: 1, force: 1, id: 0 }] }); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await wait('document.querySelector(".reporte-estadisticas__valor").textContent.includes("2026-11-15 al 2026-11-30")');
      await evaluate('document.querySelector(".reporte-estadisticas svg [role=button]").focus()');
      assert.ok(await evaluate('getComputedStyle(document.activeElement).outlineStyle!=="none"'));
      assert.ok(await evaluate('[...document.querySelectorAll(".reporte-estadisticas .catalogo-table-wrap")].every(el=>el.tabIndex===0 && el.getAttribute("aria-label"))'));
    });
    await t.test('Composición estadística: desplegables, leyenda y continuidad a 1366/768/375px y reflow 200%', async () => {
      await navigate(route(aplicada)); await ready(); await select(metricaSelect, importe);
      await evaluate('void(window.__grafica=document.querySelector(".reporte-estadisticas"))');
      await evaluate('void(window.__filas=[...document.querySelectorAll(".reporte-estadisticas tbody tr")])');
      const before = count();
       // Reflow 200% de 1366px: 683 CSS px y DPR 2, no pinch zoom.
       for (const width of [1366, 768, 683, 375]) {
         await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: width === 683 ? 2 : 1, mobile: width === 375 }); await settle();
        assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
        assert.ok(await evaluate('(()=>{const s=document.querySelector(".reporte-estadisticas"),e=document.querySelector(".reporte-exportacion"),b=s.closest("[aria-busy]");return !!(b.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING)&&!b.contains(e)&&e===e.parentElement.lastElementChild;})()'));
        assert.ok(await evaluate('[...document.querySelectorAll(".reporte-estadisticas__leyenda label")].every(l=>l.querySelector("svg[aria-hidden=true]")&&/^[1-4]\\. /u.test(l.textContent))'));
        for (const grafico of ['BARRAS', 'LINEAS', 'SECTORES']) {
          await select(chartSelect, grafico);
          assert.ok(await evaluate('!!document.querySelector(".reporte-estadisticas__viewport").getAttribute("aria-describedby")'));
          assert.ok(await evaluate('document.querySelector(".reporte-estadisticas__viewport").nextElementSibling.matches(".reporte-estadisticas__valor")'));
          await evaluate('document.querySelector(".reporte-estadisticas__viewport [role=button]").scrollIntoView({block:"center",inline:"center"})');
          const xy = await evaluate('(()=>{const p=document.querySelector(".reporte-estadisticas__viewport [role=button]"),r=p.querySelector("rect,circle,path").getBoundingClientRect();return {x:r.x+r.width*(p.closest("svg").classList.contains("reporte-estadisticas__sectores") ? 0.65 : 0.5),y:r.y+r.height/2};})()');
          await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...xy, radiusX: 1, radiusY: 1, force: 1, id: 0 }] });
          await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle();
          assert.ok(await evaluate('document.querySelector(".reporte-estadisticas__valor").textContent.includes(document.querySelector(".reporte-estadisticas__viewport [role=button]").getAttribute("aria-label"))'));
          await evaluate('document.querySelector(".reporte-estadisticas__viewport [role=button]").focus()');
          const valor = await evaluate('document.querySelector(".reporte-estadisticas__valor").textContent');
          for (let i = 0; i < 2; i++) {
            await evaluate(`document.querySelectorAll(".reporte-estadisticas__exactos summary")[${i}].focus()`);
            for (const key of ['Enter', ' ']) {
              await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key === 'Enter' ? 'Enter' : 'Space', text: key === 'Enter' ? '\r' : ' ', windowsVirtualKeyCode: key === 'Enter' ? 13 : 32 });
              await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key === 'Enter' ? 'Enter' : 'Space', windowsVirtualKeyCode: key === 'Enter' ? 13 : 32 }); await settle();
              assert.equal(await evaluate(`document.querySelectorAll(".reporte-estadisticas__exactos")[${i}].open`), key === 'Enter');
              assert.notEqual(await evaluate('getComputedStyle(document.activeElement).outlineStyle'), 'none');
              if (key === 'Enter') {
                await evaluate(`document.querySelectorAll(".reporte-estadisticas__exactos .catalogo-table-wrap")[${i}].focus()`);
                await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
                await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
                await evaluate('new Promise(r=>setTimeout(r,150))');
                if (width === 375) assert.ok(await evaluate('document.activeElement.scrollLeft>0&&document.documentElement.scrollWidth<=innerWidth+1'));
                await evaluate(`document.querySelectorAll(".reporte-estadisticas__exactos summary")[${i}].focus()`);
              }
            }
          }
          assert.equal(await evaluate('document.querySelector(".reporte-estadisticas__valor").textContent'), valor);
          assert.ok(await evaluate('__grafica===document.querySelector(".reporte-estadisticas")&&__filas.every((r,i)=>r===document.querySelectorAll(".reporte-estadisticas tbody tr")[i])'));
          const tabla = await evaluate('document.querySelector("[aria-label^=Valores]").textContent');
          await evaluate('[...document.querySelectorAll(".reporte-estadisticas__leyenda input")].forEach(el=>el.click())'); await settle();
           await contains('Todas las categorías están ocultas');
           if (tipo === 'ventas' && width === 768 && grafico === 'BARRAS') await captura('ocultas-768', '.reporte-estadisticas');
          assert.equal(await evaluate('document.querySelector("[aria-label^=Valores]").textContent'), tabla);
          assert.equal(await evaluate('document.querySelectorAll(".reporte-estadisticas__viewport [role=button]").length'), 0);
          await evaluate('[...document.querySelectorAll(".reporte-estadisticas__leyenda input")].forEach(el=>el.click())'); await settle();
           if (process.env.CADEFAR_REPORTES_SCREENSHOTS && grafico === { ventas: 'BARRAS', compras: 'LINEAS', perdidas: 'SECTORES' }[tipo]) {
            const directory = process.env.CADEFAR_REPORTES_SCREENSHOTS;
            await mkdir(directory, { recursive: true });
            await evaluate('window.scrollTo(0,0)'); await settle();
            const { cssContentSize } = await send('Page.getLayoutMetrics');
            const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: cssContentSize.height, scale: 1 } });
            await writeFile(join(directory, `${tipo}-${grafico}-${width}.png`), Buffer.from(data, 'base64'));
             if (width === 768 || width === 683) {
              await evaluate('document.querySelectorAll(".reporte-estadisticas__exactos").forEach(d=>d.open=true)'); await settle();
              await evaluate('document.querySelectorAll(".reporte-estadisticas__exactos .catalogo-table-wrap").forEach(el=>el.scrollLeft=0)');
              const clip = await evaluate('(()=>{const r=document.querySelector(".reporte-estadisticas__exactos").getBoundingClientRect();return {x:0,y:r.top+scrollY,width:innerWidth,height:Math.min(1500,document.documentElement.scrollHeight-r.top-scrollY),scale:1};})()');
              const captura = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
              await writeFile(join(directory, `${tipo}-exactos-${width}.png`), Buffer.from(captura.data, 'base64'));
              await evaluate('document.querySelectorAll(".reporte-estadisticas__exactos").forEach(d=>d.open=false)');
            }
          }
        }
      }
      assert.equal(count(), before);
    });
    await t.test('Barras/líneas/sectores: cero y sinDatos conservan tablas exactas y avisos visibles', async () => {
      for (const opciones of [{ cero: true }, { vacio: true }]) {
        planned = opciones; await navigate(route(aplicada)); await ready(); await select(metricaSelect, importe);
        const before = count();
        for (const g of ['BARRAS', 'LINEAS', 'SECTORES']) {
          await select(chartSelect, g); await contains(opciones.vacio ? 'Sin operaciones' : 'Sin valor para graficar');
          assert.equal(await evaluate('document.querySelectorAll(".reporte-estadisticas__viewport svg").length'), 0);
          assert.ok(await evaluate('document.querySelector(".reporte-estadisticas__precision").getBoundingClientRect().height>0&&!document.querySelector(".reporte-estadisticas__precision").closest("details")'));
          assert.ok(await evaluate('document.querySelectorAll(".reporte-estadisticas__exactos tbody tr").length>0'));
          if (g === 'SECTORES' && tipo === (opciones.vacio ? 'perdidas' : 'compras')) await captura(opciones.vacio ? 'vacio-375' : 'cero-375', '.reporte-estadisticas');
        }
        assert.equal(count(), before);
      }
    });
    await t.test('Estados inicial/carga/error a 768px: exportación fuera del resultado, sin overflow', async () => {
      await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 900, deviceScaleFactor: 1, mobile: false });
      await navigate(`/reportes/${tipo}`); await click('input[value=ESTADISTICAS]'); await contains('Selecciona período y granularidad');
      if (tipo === 'ventas') await captura('inicial-768');
      planned = { hold: true }; await navigate(route(aplicada)); await esperar(() => held); await contains('Cargando estadísticas');
      assert.ok(await evaluate('document.querySelector(".catalogo-panel > div[aria-busy=true]")&&!document.querySelector(".catalogo-panel > div[aria-busy=true]").contains(document.querySelector(".reporte-exportacion"))'));
      if (tipo === 'ventas') await captura('carga-768');
      const old = held; held = null; await fulfill(old.id, 500, { message: 'Error interno del servidor' }); await contains('No fue posible consultar estadísticas');
      if (tipo === 'ventas') await captura('error-768');
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
      assert.ok(await evaluate('!!document.querySelector(".reporte-exportacion select")'));
    });
    if (tipo === 'ventas') await t.test('Contraste sRGB de tokens efectivos de Reportes: texto, series, controles y foco', async () => {
      const relaciones = await evaluate(`(()=>{
        const css=getComputedStyle(document.querySelector('.main-layout'));
        const luminancia=hex=>{let h=hex.trim().slice(1);if(h.length===3)h=[...h].map(c=>c+c).join('');const c=h.match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
        const contraste=(a,b)=>{const l=[a,b].map(n=>luminancia(css.getPropertyValue('--color-'+n))).sort((a,b)=>b-a);return (l[0]+.05)/(l[1]+.05);};
        return ['surface','surface-subtle'].flatMap(fondo=>['ink','muted','focus','control-border'].map(color=>({color,fondo,ratio:contraste(color,fondo)})));
      })()`);
      for (const { color, fondo, ratio } of relaciones) assert.ok(ratio >= (['ink', 'muted'].includes(color) ? 4.5 : 3), `${color}/${fondo}: ${ratio}`);
      t.diagnostic(JSON.stringify(relaciones.map(r=>({...r,ratio:Number(r.ratio.toFixed(2))}))));
    });
    assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
  } finally {
    try { if (send && socket?.readyState === 1) await send('Browser.close'); } catch { /* proceso propio */ }
    socket?.close(); browser?.kill(); servidor.kill();
    await new Promise(r => setTimeout(r, 500)); await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
