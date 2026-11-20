// CU38/CU39/CU41 y regresión CU40: React/Router/Axios con API interceptada por CDP.
// Se conserva el nombre del arnés de Fase 2; sin backend/MySQL ni capturas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const executable = process.env.CADEFAR_TEST_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const esperar = async predicate => {
  const end = Date.now() + 15000;
  while (Date.now() < end) { const result = await predicate(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 25)); }
  throw new Error('Tiempo agotado esperando Reportes');
};
const categorias = ['CONFIRMADA', 'PENDIENTE', 'ANULADA_CONFIRMADA', 'ANULADA_SIN_CONFIRMAR'];
const filas = categorias.map((categoria, i) => ({ idVenta: i + 1, categoria, estadoOperacion: i > 1 ? 'ANULADA' : categoria,
  fechaReferencia: '2026-11-01 23:15:00', fechaRegistro: '2026-10-31 23:59:59',
  fechaVenta: i % 2 === 0 ? '2026-11-01 23:15:00' : null, fechaAnulacion: i > 1 ? '2026-11-19 12:00:00' : null,
  total: '900719925474099312345.01' }));
const respuestaVentas = p => {
  const vacio = p.get('mes') === '2099-01';
  const estado = p.get('estadoOperacion');
  const detalle = vacio ? [] : filas.filter(v => !estado || v.estadoOperacion === estado);
  const pagina = Number(p.get('pagina') || 1), limite = Number(p.get('limite') || 25);
  const resumen = Object.fromEntries(['confirmadas', 'pendientes', 'anuladasConfirmadas', 'anuladasSinConfirmar'].map((key, i) => [key,
    { cantidad: !vacio && detalle.some(v => v.categoria === categorias[i]) ? [10, 8, 7, 5][i] : 0,
      importe: !vacio && detalle.some(v => v.categoria === categorias[i]) ? '900719925474099312345.02' : '0.00' }]));
  resumen.totalVentasRealizadas = resumen.confirmadas.importe;
  const total = vacio ? 0 : estado === 'CONFIRMADA' ? 10 : estado === 'PENDIENTE' ? 8 : estado === 'ANULADA' ? 12 : 30;
  return { data: { periodo: { modalidad: p.has('dia') ? 'DIA' : p.has('mes') ? 'MES' : 'PERIODO',
    desde: p.get('dia') || (p.has('mes') ? `${p.get('mes')}-01` : p.get('desde')),
    hasta: p.get('dia') || (p.has('mes') ? `${p.get('mes')}-${p.get('mes') === '2099-01' ? '31' : '30'}` : p.get('hasta')), zonaHoraria: 'America/La_Paz' }, resumen,
    detalle: pagina > Math.ceil(total / limite) ? [] : pagina > 1 ? detalle.slice(0, 1) : detalle },
    paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) } };
};

const filasCompras = ['CONFIRMADA', 'CONFIRMADA', 'ANULADA'].map((estadoOperacion, i) => ({
  idCompra: i + 1, idProveedorLaboratorio: 70 + i, estadoOperacion,
  fechaReferencia: '2026-11-01', fechaCompra: '2026-11-01', fechaRegistro: '2026-12-02 23:59:59',
  fechaAnulacion: i === 2 ? '2027-01-03 00:00:00' : null, total: '900719925474099312345.01'
}));
const respuestaCompras = p => {
  const base = respuestaVentas(p), vacio = p.get('mes') === '2099-01', estado = p.get('estadoOperacion');
  const confirmadas = !vacio && estado !== 'ANULADA', anuladas = !vacio && estado !== 'CONFIRMADA';
  const resumen = { confirmadas: { cantidad: confirmadas ? 20 : 0, importe: confirmadas ? '900719925474099312345.02' : '0.00' },
    anuladas: { cantidad: anuladas ? 10 : 0, importe: anuladas ? '900719925474099312345.02' : '0.00' },
    totalComprasRealizadas: confirmadas ? '900719925474099312345.02' : '0.00' };
  const total = vacio ? 0 : estado === 'CONFIRMADA' ? 20 : estado === 'ANULADA' ? 10 : 30;
  const { pagina, limite } = base.paginacion, totalPaginas = Math.ceil(total / limite);
  const detalle = filasCompras.filter(c => !estado || c.estadoOperacion === estado);
  return { data: { periodo: base.data.periodo, resumen, detalle: vacio || pagina > totalPaginas ? [] : pagina > 1 ? detalle.slice(0, 1) : detalle },
    paginacion: { pagina, limite, total, totalPaginas } };
};

// Históricos de un producto ahora inactivo y una existencia agotada: el DTO no
// transporta actividad/saldo. No hay endpoints de enriquecimiento simulados.
const filasPerdidas = ['VENCIMIENTO', 'DAÑO', 'DAÑO'].map((motivo, i) => ({
  idMovimiento: 31 + i, idExistencia: 41 + i, idMedicamento: 51 + i,
  codigoExistencia: `HIST-00${i}`, codigoMedicamento: `HIST${i}`,
  nombreComercial: i ? 'Producto histórico de existencia agotada' : 'Producto histórico inactivo',
  idUsuario: 7, motivo, fechaReferencia: '2026-11-01 23:15:00',
  fechaMovimiento: i === 1 ? null : '2026-10-31 23:59:59', cantidad: 1,
  costoUnitarioAplicado: i ? '0.005000' : '0.000000', perdida: i ? '0.01' : '0.00',
  idMovimientoReversion: i ? null : 90
}));
const respuestaPerdidas = p => {
  const base = respuestaVentas(p), vacio = p.get('mes') === '2099-01', motivo = p.get('motivo');
  const vencimiento = !vacio && motivo !== 'DAÑO', dano = !vacio && motivo !== 'VENCIMIENTO';
  const grande = p.get('dia') === '9999-12-31';
  const resumen = {
    vencimiento: { cantidadRetiros: vencimiento ? 10 : 0, cantidadRetirada: vencimiento ? '900719925474099312345' : '0', perdida: '0.00' },
    dano: { cantidadRetiros: dano ? 20 : 0, cantidadRetirada: dano ? '2' : '0', perdida: dano ? (grande ? '900719925474099312345.02' : '0.02') : '0.00' },
    cantidadRetiros: vacio ? 0 : motivo === 'DAÑO' ? 20 : motivo === 'VENCIMIENTO' ? 10 : 30,
    cantidadRetirada: vacio ? '0' : motivo === 'DAÑO' ? '2' : motivo === 'VENCIMIENTO' ? '900719925474099312345' : '900719925474099312347',
    perdidaTotal: dano ? (grande ? '900719925474099312345.02' : '0.02') : '0.00'
  };
  const { pagina, limite } = base.paginacion, total = resumen.cantidadRetiros, totalPaginas = Math.ceil(total / limite);
  const detalle = filasPerdidas.filter(r => !motivo || r.motivo === motivo).map(r => grande ? { ...r, perdida: '900719925474099312345.01', costoUnitarioAplicado: '900719925474099312345.123456' } : r);
  return { data: { periodo: base.data.periodo, resumen, detalle: vacio || pagina > totalPaginas ? [] : pagina > 1 ? detalle.slice(0, 1) : detalle }, paginacion: { pagina, limite, total, totalPaginas } };
};

// Mismo arnés, coordinadores específicos y escenarios por consulta, secuenciales.
for (const tipo of ['ventas', 'compras', 'perdidas']) test(`${tipo}: Reportes y regresión CU40 con API simulada`, { timeout: 120000 }, async t => {
  const compras = tipo === 'compras';
  const perdidas = tipo === 'perdidas';
  const respuesta = perdidas ? respuestaPerdidas : compras ? respuestaCompras : respuestaVentas;
  const tabla = `.reporte-${tipo}-table`, paginaSelector = `.reporte-${tipo}-page`;
  const ruta = `/reportes/${tipo}`;
  assert.ok(executable, 'Configura CADEFAR_TEST_BROWSER con Chrome/Edge');
  const profile = await mkdtemp(join(process.platform === 'win32' ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : tmpdir(), 'cadefar-reportes-'));
  const origin = 'http://127.0.0.1:5188';
  const vite = spawn(process.execPath, ['--input-type=module', '--eval', `
    import { build } from 'vite'; import { createServer } from 'node:http';
    import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
    const outDir = ${JSON.stringify(join(profile, 'app'))};
    await build({logLevel:'warn',build:{outDir,emptyOutDir:true}});
    createServer(async (req,res) => {
      const path = new URL(req.url,'${origin}').pathname;
      // La API nunca tiene proxy ni fallback a un servidor real.
      if(path.startsWith('/api/')) {res.writeHead(500);res.end();return;}
      try {const file=join(outDir,path.startsWith('/assets/')?path:'index.html');
        res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.css':'text/css','.png':'image/png','.html':'text/html'}[extname(file)]});res.end(await readFile(file));}
      catch {res.writeHead(404);res.end();}
    }).listen(5188,'127.0.0.1',()=>console.log('${origin}'));
  `], { cwd: root, env: { ...process.env, VITE_API_URL: `${origin}/api` }, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser, socket, send, rol = 1, planned, held;
  const requests = [], errors = [], unexpected = [];
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('No inició el servidor estático de prueba')), 15000);
      vite.stdout.on('data', chunk => { if (chunk.toString().includes(origin)) { clearTimeout(timer); resolve(); } });
      vite.once('error', reject); vite.once('exit', () => reject(new Error('Finalizó el servidor de prueba')));
    });
    browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
    const port = await esperar(async () => { try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { return null; } });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let sequence = 0;
    const pending = new Map();
    send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP: ${method}`)); }, 10000);
      pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const respond = (requestId, status, body) => send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
    socket.addEventListener('close', () => { for (const item of pending.values()) item.reject(new Error('Chrome cerró')); pending.clear(); });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) { const item = pending.get(message.id); pending.delete(message.id); if (message.error) item?.reject(new Error(message.error.message)); else item?.resolve(message.result); return; }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
      if (message.method !== 'Fetch.requestPaused') return;
      const { requestId, request } = message.params, url = new URL(request.url), path = url.pathname;
      requests.push({ path, method: request.method, query: Object.fromEntries(url.searchParams), search: url.search });
      const finish = (status, body) => void respond(requestId, status, body).catch(error => errors.push(error.message));
      if (request.method !== 'GET') { unexpected.push(request.method + path); finish(500, {}); return; }
      if (path === '/api/auth/me') { finish(rol ? 200 : 401, rol ? { data: { idUsuario: rol, idRol: rol, nombreUsuario: `rol-${rol}` } } : { message: 'No autenticado' }); return; }
       if (path === `/api/reportes/${tipo}`) {
        if (planned) {
          const next = planned; if (!next.persist) planned = null;
          if (next.hold) held = { requestId, body: respuesta(url.searchParams) };
          else if (next.network) void send('Fetch.failRequest', { requestId, errorReason: 'ConnectionRefused' });
          else finish(next.status, next.body);
        } else finish(200, respuesta(url.searchParams));
         return;
       }
       // Solo el recorrido conjunto CU38 → CU41 admite las otras consultas.
       if (tipo === 'ventas' && path === '/api/reportes/compras') { finish(200, respuestaCompras(url.searchParams)); return; }
       if (tipo === 'ventas' && path === '/api/reportes/perdidas') { finish(200, respuestaPerdidas(url.searchParams)); return; }
      if (path === '/api/inventario/movimientos') { finish(200, { data: [] }); return; }
       if (/^\/api\/ventas\/\d+$/.test(path)) { const row = filas.find(v => String(v.idVenta) === path.split('/').at(-1)); finish(200, { data: { ...row, idUsuario: 3, detalles: [], recetas: [] } }); return; }
       if (/^\/api\/compras\/\d+$/.test(path)) { const row = filasCompras.find(c => String(c.idCompra) === path.split('/').at(-1)); finish(200, { data: { ...row, idUsuario: 3, detalles: [], claveOperacion: null } }); return; }
      unexpected.push(path); finish(500, { message: 'Petición no simulada' });
    });
    await send('Page.enable'); await send('Runtime.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/*api/*' }] });
    const evaluate = async expression => { const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); assert.ok(!value.exceptionDetails, JSON.stringify(value.exceptionDetails)); return value.result.value; };
    const wait = expression => esperar(async () => { try { return await evaluate(expression); } catch { return false; } });
    const settle = () => evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const navigate = async path => { await evaluate('window.__navigating=true'); await send('Page.navigate', { url: origin + path.replace('/reportes/ventas', ruta) }); await wait('!window.__navigating && document.readyState === "complete"'); };
    const ready = (selector = paginaSelector) => wait(`!!document.querySelector(${JSON.stringify(selector)}) && document.querySelector('[aria-busy]')?.getAttribute('aria-busy') === 'false'`);
    const contains = text => wait(`document.body.textContent.includes(${JSON.stringify(text)})`);
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const field = async (id, value) => { await evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`); await settle(); };
    const select = async (id, value) => { await evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`); await settle(); };
    const reportRequests = () => requests.filter(r => r.path === `/api/reportes/${tipo}`);
    const active = () => evaluate('[...document.querySelectorAll(".app-sidebar a[aria-current=page]")].map(a=>a.textContent.trim())');
    const link = text => evaluate(`[...document.querySelectorAll('.app-sidebar a')].find(a=>a.textContent.trim()===${JSON.stringify(text)}).click()`);
    const chooseDay = async day => { await select('reporte-modalidad', 'dia'); await field('reporte-dia', day); };

    await t.test('Entrada y Limpiar no emiten GET; Buscar exige modalidad explícita', async () => {
      await navigate('/reportes/ventas'); await ready(); await contains('Selecciona un período');
      assert.equal(reportRequests().length, 0);
      assert.ok(await evaluate('document.querySelector(".catalogo-toolbar button").disabled'));
      await click('.reporte-filters button[type=submit]'); await contains('Selecciona un período antes de buscar'); assert.equal(reportRequests().length, 0);
      await chooseDay('2026-11-01'); await click('.reporte-filters button[type=submit]'); await ready();
      assert.deepEqual(reportRequests().at(-1).query, { dia: '2026-11-01', pagina: '1', limite: '25' });
      const before = reportRequests().length; await click('.reporte-filters button[type=button]'); await ready(); await contains('Selecciona un período'); await settle();
      assert.equal(reportRequests().length, before); assert.equal(await evaluate('location.search'), '');
      assert.equal(await evaluate('!!document.querySelector(".reporte-resumen")'), false);
      assert.equal(await evaluate('document.getElementById("reporte-modalidad").value'), '');
      await chooseDay('2026-11-01'); await click('.reporte-filters button[type=submit]'); await ready();
      assert.equal(reportRequests().at(-1).query.limite, '25');
      if (perdidas) {
        const count = reportRequests().length;
        await navigate('/reportes/ventas?motivo=DA%C3%91O&limite=7'); await ready();
        await contains('Selecciona un período'); assert.equal(reportRequests().length, count);
      }
    });
    await t.test('URLs estrictas inválidas no consultan ni se sanean silenciosamente', async () => {
      const before = reportRequests().length;
      for (const query of ['mes=2026-11&extra=x', 'dia=2026-11-01&dia=2026-11-01', 'desde=2026-11-01', 'dia=1900-02-29', 'mes=2026-11&estadoOperacion=ANULADA_CONFIRMADA', 'mes=2026-11&limite=0', 'tipoPeriodo=MES', ...(compras ? ['mes=2026-11&estadoOperacion=PENDIENTE'] : []), ...(perdidas ? ['mes=2026-11&motivo=DANO', 'mes=2026-11&motivo=VENTA', 'mes=2026-11&motivo=DA%C3%91O&motivo=DA%C3%91O', 'motivo=', 'mes=2026-11&pagina=01', 'mes=2026-11&motivo[]=DA%C3%91O'] : [])]) {
        await navigate('/reportes/ventas?' + query); await ready(); await contains('Revisa los filtros');
        assert.equal(reportRequests().length, before); assert.equal(await evaluate('!!document.querySelector(".reporte-resumen")'), false);
      }
      await chooseDay('2000-02-29'); await click('.reporte-filters button[type=submit]'); await ready(); assert.equal(reportRequests().at(-1).query.dia, '2000-02-29');
    });
    await t.test('Extremos temporales en formulario y URL; modalidades incompatibles sin GET', async () => {
      for (const query of ['dia=2026-11-01&mes=2026-11', 'mes=2026-11&desde=2026-11-01&hasta=2026-11-30', 'dia=2100-02-29', 'mes=9999-13']) {
        const before = reportRequests().length;
        await navigate('/reportes/ventas?' + query); await ready(); await contains('Revisa los filtros');
        assert.equal(reportRequests().length, before);
      }
      for (const day of ['1000-01-01', '9999-12-31']) {
        await chooseDay(day); await click('.reporte-filters button[type=submit]'); await ready();
        assert.equal(reportRequests().at(-1).query.dia, day);
        assert.equal(await evaluate('document.getElementById("reporte-dia").max'), '9999-12-31');
      }
      await select('reporte-modalidad', 'periodo'); await field('reporte-desde', '1000-01-01'); await field('reporte-hasta', '9999-12-31');
      await click('.reporte-filters button[type=submit]'); await ready();
      assert.deepEqual(reportRequests().at(-1).query, { desde: '1000-01-01', hasta: '9999-12-31', pagina: '1', limite: '25' });
    });
    await t.test('URL válida, límite 7, resumen completo, categorías, fechas civiles y null', async () => {
      await navigate('/reportes/ventas?mes=2026-11&limite=7'); await ready();
      assert.equal(await evaluate('document.getElementById("reporte-limite").value'), '7');
      assert.equal(await evaluate('document.getElementById("reporte-modalidad").value'), 'mes');
      await contains('01/11/2026 al 30/11/2026'); await contains('America/La_Paz');
      const text = await evaluate('document.querySelector(".reporte-resumen").textContent');
      for (const label of perdidas ? ['Vencimiento', 'Daño', '900.719.925.474.099.312.345', '900.719.925.474.099.312.347', '0,02', '30 retiros'] : compras ? ['Confirmadas', 'Anuladas', '900.719.925.474.099.312.345,02', '20 compras'] : ['Confirmadas', 'Pendientes', 'Anuladas confirmadas', 'Anuladas sin confirmar', '900.719.925.474.099.312.345,02', '10 ventas']) assert.ok(text.includes(label), label);
      assert.ok(await evaluate(`document.querySelector('${tabla}').textContent.includes('${perdidas ? '0,005000' : '900.719.925.474.099.312.345,01'}')`));
      assert.equal(await evaluate(`document.querySelectorAll('${tabla} tbody tr').length`), compras || perdidas ? 3 : 4);
      assert.ok(await evaluate(`[...document.querySelectorAll('${tabla} tbody tr')][1].textContent.includes('—')`));
      if (compras) {
        assert.deepEqual(await evaluate('[...document.querySelectorAll("#reporte-estado option")].map(el=>el.value)'), ['', 'CONFIRMADA', 'ANULADA']);
        const cells = await evaluate(`[...document.querySelector('${tabla} tbody tr').cells].map(el=>el.textContent)`);
        assert.deepEqual(cells.slice(1, 7), ['70', 'Confirmada', '01/11/2026', '01/11/2026', '02/12/2026 23:59:59', '—']);
        await contains('03/01/2027 00:00:00');
        assert.equal(await evaluate(`document.querySelector('${tabla}').textContent.includes('-900')`), false);
        assert.equal((await evaluate('[...document.querySelectorAll(".reporte-resumen dd strong")].map(el=>el.textContent)')).at(-1), '900.719.925.474.099.312.345,02');
      }
      if (perdidas) {
        assert.deepEqual(await evaluate('[...document.querySelectorAll("#reporte-motivo option")].map(el=>el.value)'), ['', 'VENCIMIENTO', 'DAÑO']);
        const cells = await evaluate(`[...document.querySelector('${tabla} tbody tr').cells].map(el=>el.textContent)`);
        assert.deepEqual(cells.slice(5, 11), ['01/11/2026 23:15:00', '31/10/2026 23:59:59', '1', '0,000000', '0,00', '#90']);
        assert.equal(await evaluate(`[...document.querySelectorAll('${tabla} tbody tr')].filter(r=>r.cells[9].textContent==='0,01').length`), 2);
        assert.equal(await evaluate('document.querySelectorAll(".reporte-resumen dd strong")[2].textContent'), '0,02');
        await contains('Producto histórico inactivo'); await contains('Producto histórico de existencia agotada');
        assert.equal(await evaluate('document.querySelector(".reporte-perdidas-page").textContent.includes("pérdidas netas")'), false);
        assert.equal(await evaluate(`document.querySelectorAll('${tabla} button').length`), 0);
      }
      await send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Tokyo' });
      await contains(compras ? '02/12/2026 23:59:59' : '31/10/2026 23:59:59'); await contains(compras ? '01/11/2026' : '01/11/2026 23:15:00');
    });
    await t.test('Nueva carga bajo tres husos mantiene todas las celdas civiles, null y decimales', async () => {
      const original = await evaluate(`document.querySelector('${tabla}').textContent`);
      const resumen = await evaluate('document.querySelector(".reporte-resumen").textContent');
      for (const timezoneId of ['Pacific/Honolulu', 'Asia/Tokyo', 'America/La_Paz']) {
        await send('Emulation.setTimezoneOverride', { timezoneId });
        await navigate('/reportes/ventas?mes=2026-11&limite=7'); await ready();
        assert.equal(await evaluate('Intl.DateTimeFormat().resolvedOptions().timeZone'), timezoneId);
        assert.equal(await evaluate(`document.querySelector('${tabla}').textContent`), original);
        assert.equal(await evaluate('document.querySelector(".reporte-resumen").textContent'), resumen);
      }
    });
    await t.test('Actualizar/paginación/límite no aplican ni destruyen el borrador; Buscar sí', async () => {
      const resumenAplicado = await evaluate('document.querySelector(".reporte-resumen").textContent');
      await chooseDay('2099-12-31'); if (perdidas) await select('reporte-motivo', 'DAÑO'); const before = reportRequests().length;
      await click('.catalogo-toolbar button'); await ready(); assert.equal(reportRequests().length, before + 1); assert.equal(reportRequests().at(-1).query.mes, '2026-11');
      await click('.consulta-pagination nav button:last-child'); await ready(); await contains('Página 2 de 5');
      assert.equal(reportRequests().at(-1).query.pagina, '2'); assert.equal(reportRequests().at(-1).query.mes, '2026-11');
      assert.equal(await evaluate('document.querySelector(".reporte-resumen").textContent'), resumenAplicado);
      assert.equal(await evaluate(`document.querySelectorAll('${tabla} tbody tr').length`), 1);
      assert.equal(await evaluate('document.getElementById("reporte-dia").value'), '2099-12-31');
      if (perdidas) { assert.equal(reportRequests().at(-1).query.motivo, undefined); assert.equal(await evaluate('document.getElementById("reporte-motivo").value'), 'DAÑO'); }
      await contains('01/11/2026 al 30/11/2026');
      await select('reporte-limite', '10'); await ready(); assert.equal(reportRequests().at(-1).query.pagina, '1'); assert.equal(reportRequests().at(-1).query.mes, '2026-11');
      assert.equal(await evaluate('document.getElementById("reporte-dia").value'), '2099-12-31');
      await click('.reporte-filters button[type=submit]'); await ready(); assert.deepEqual(reportRequests().at(-1).query, { dia: '2099-12-31', pagina: '1', limite: '10', ...(perdidas ? { motivo: 'DAÑO' } : {}) });
      const count = reportRequests().length; await click('.reporte-filters button[type=submit]'); await ready(); assert.equal(reportRequests().length, count + 1);
      await evaluate('history.back()'); await ready(); await wait('document.getElementById("reporte-modalidad").value === "mes"');
      await evaluate('history.forward()'); await ready(); await wait('document.getElementById("reporte-dia")?.value === "2099-12-31"');
    });
    await t.test(`Modalidades excluyentes, período cerrado y estados separados de ${tipo}`, async () => {
      await select('reporte-modalidad', 'periodo'); await field('reporte-desde', '2026-11-02'); await field('reporte-hasta', '2026-11-01');
      const before = reportRequests().length; await click('.reporte-filters button[type=submit]'); await contains('La fecha desde no puede ser posterior'); assert.equal(reportRequests().length, before);
      await field('reporte-desde', '2026-11-01'); await select(perdidas ? 'reporte-motivo' : 'reporte-estado', perdidas ? 'DAÑO' : 'ANULADA'); await click('.reporte-filters button[type=submit]'); await ready();
      assert.deepEqual(reportRequests().at(-1).query, { desde: '2026-11-01', hasta: '2026-11-01', pagina: '1', limite: '10', [perdidas ? 'motivo' : 'estadoOperacion']: perdidas ? 'DAÑO' : 'ANULADA' });
      assert.equal(await evaluate(`document.querySelectorAll('${tabla} tbody tr').length`), compras ? 1 : 2);
      const values = await evaluate('[...document.querySelectorAll(".reporte-resumen dd")].map(el=>el.textContent)');
      if (perdidas) {
        assert.ok(reportRequests().at(-1).search.includes('motivo=DA%C3%91O'));
        assert.ok(values[0].includes('0 retiros · Cantidad retirada: 0 · Pérdida: 0,00'));
        assert.ok(values[1].includes('20 retiros · Cantidad retirada: 2 · Pérdida: 0,02'));
        await select('reporte-motivo', 'VENCIMIENTO'); await click('.reporte-filters button[type=submit]'); await ready();
        const summary = await evaluate('[...document.querySelectorAll(".reporte-resumen dd")].map(el=>el.textContent)');
        assert.ok(summary[1].includes('0 retiros · Cantidad retirada: 0 · Pérdida: 0,00'));
        assert.ok(summary[2].endsWith('Pérdida total: 0,00'));
        await select('reporte-motivo', '');
      } else { assert.ok(values[0].includes(`0 ${tipo}`)); assert.ok(values[1].includes(compras ? '10 compras' : '0 ventas')); assert.equal(values.at(-1), '0,00'); }
      if (compras) {
        assert.ok(values[1].includes('900.719.925.474.099.312.345,02'));
        await select('reporte-estado', 'CONFIRMADA'); await click('.reporte-filters button[type=submit]'); await ready();
        assert.equal(reportRequests().at(-1).query.estadoOperacion, 'CONFIRMADA');
        assert.equal(await evaluate(`document.querySelectorAll('${tabla} tbody tr').length`), 2);
        const summary = await evaluate('[...document.querySelectorAll(".reporte-resumen dd")].map(el=>el.textContent)');
        assert.ok(summary[1].includes('0 compras')); assert.equal(summary.at(-1), '900.719.925.474.099.312.345,02');
      }
      await select('reporte-modalidad', 'mes'); await field('reporte-mes', '2026-11'); await click('.reporte-filters button[type=submit]'); await ready();
      assert.equal(reportRequests().at(-1).query.desde, undefined); assert.equal(reportRequests().at(-1).query.dia, undefined);
    });
    await t.test('Vacío con ceros y página lejana con resumen, sin reajuste automático', async () => {
      await navigate('/reportes/ventas?mes=2099-01'); await ready(); await contains('Sin coincidencias'); await contains(`0 ${perdidas ? 'retiros' : tipo}`); assert.ok(await evaluate('!!document.querySelector(".reporte-resumen")'));
      await navigate('/reportes/ventas?mes=2026-11&pagina=99&limite=7'); await ready(); await contains('Esta página no tiene resultados'); await contains(perdidas ? '900.719.925.474.099.312.347' : '900.719.925.474.099.312.345,02');
      const resumenLejano = await evaluate('document.querySelector(".reporte-resumen").textContent');
      assert.equal(reportRequests().at(-1).query.pagina, '99'); const count = reportRequests().length; await settle(); assert.equal(reportRequests().length, count);
      await click('.catalogo-state button'); await ready(); await contains('Página 1 de 5');
      assert.equal(await evaluate('document.querySelector(".reporte-resumen").textContent'), resumenLejano);
    });
    await t.test('Fichas existentes: enlace con contexto, Atrás restaura consulta y recarga', async () => {
      const query = await evaluate('location.search'); await click(`${tabla} a`); await ready(perdidas ? '.inventario-page' : compras ? '.compras-page' : '.ventas-page');
      assert.equal(await evaluate('location.pathname'), perdidas ? '/inventario/movimientos' : `/${tipo}/1`);
      assert.equal(await evaluate(`history.state.usr.${perdidas ? 'reportePerdidasQuery' : compras ? 'reporteComprasQuery' : 'reporteVentasQuery'}`), query.slice(1));
      if (perdidas) {
        assert.deepEqual(requests.filter(r=>r.path === '/api/inventario/movimientos').at(-1).query, { idExistencia: '41', idMedicamento: '51' });
        assert.deepEqual(await active(), ['Historial de inventario']);
      }
      await evaluate('history.back()'); await ready(); assert.equal(await evaluate('location.search'), query);
      await navigate('/reportes/ventas' + query); await ready(); assert.equal(reportRequests().at(-1).query.limite, '7');
    });
    if (perdidas) await t.test('Importes grandes y costos históricos de seis decimales permanecen exactos', async () => {
      await navigate('/reportes/ventas?dia=9999-12-31'); await ready();
      await contains('31/12/9999 al 31/12/9999');
      assert.ok(await evaluate(`document.querySelector('${tabla}').textContent.includes('900.719.925.474.099.312.345,123456')`));
      assert.ok(await evaluate(`document.querySelector('${tabla}').textContent.includes('900.719.925.474.099.312.345,01')`));
      assert.equal(await evaluate('document.querySelectorAll(".reporte-resumen dd strong")[2].textContent'), '900.719.925.474.099.312.345,02');
    });
    await t.test('400/401/403/500/red retiran datos, sin reintentos ni SQL visible', async () => {
      for (const failure of [
        { status: 400, body: { message: 'Datos inválidos' }, expected: 'Datos inválidos' },
        { status: 500, body: { message: 'SELECT secreto stack' }, expected: 'No fue posible cargar' },
        { network: true, expected: 'No se pudo conectar' },
        { status: 403, body: { message: 'Denegado' }, expected: 'No tienes autorización' },
        { status: 401, body: { message: 'Denegado' }, expected: 'Tu sesión ya no es válida' }
      ]) {
        await navigate('/reportes/ventas?mes=2026-11'); await ready(); planned = failure;
        const before = reportRequests().length; await click('.catalogo-toolbar button'); await ready(); await contains(failure.expected);
        assert.equal(reportRequests().length, before + 1); assert.equal(await evaluate(`!!document.querySelector('.reporte-resumen, ${tabla}')`), false);
        assert.equal(await evaluate(`document.querySelector('${paginaSelector}').textContent.includes('SELECT secreto')`), false);
        if ([401, 403].includes(failure.status)) { assert.ok(await evaluate('document.querySelector(".catalogo-toolbar button").disabled')); assert.equal(await evaluate('!!document.querySelector(".catalogo-state button")'), false); }
        if (failure.status === 401) assert.ok(await evaluate(`!!document.querySelector('.catalogo-state a[href="/login"]')`));
      }
    });
    await t.test('Carga retira resumen/detalle; respuesta tardía tras cambio o salida/rol no reaparece', async () => {
      await navigate('/reportes/ventas?mes=2026-11'); await ready(); planned = { hold: true };
      await click('.catalogo-toolbar button'); await esperar(() => held);
      assert.equal(await evaluate(`!!document.querySelector('.reporte-resumen, ${tabla}')`), false);
      assert.ok(await evaluate('document.querySelector(".reporte-filters fieldset").disabled && document.querySelector(".consulta-pagination nav button:last-child").disabled'));
      const old = held; held = null;
      await link('Historial de inventario'); await ready('.inventario-page');
      await respond(old.requestId, 200, old.body); await settle(); assert.equal(await evaluate('!!document.querySelector(".reporte-resumen")'), false);
      await evaluate('history.back()'); await ready(); planned = { hold: true }; await click('.catalogo-toolbar button'); await esperar(() => held);
      const other = held; held = null;
      await evaluate('history.back()'); await wait(`!document.querySelector('${paginaSelector}') || document.querySelector('[aria-busy]')?.getAttribute('aria-busy') === 'false'`);
      await respond(other.requestId, 200, other.body); await settle();
      rol = perdidas ? 3 : 2; const before = reportRequests().length; await navigate('/reportes/ventas?mes=2026-11'); await wait('location.pathname === "/dashboard"'); assert.equal(reportRequests().length, before);
    });
    await t.test('Respuesta fuera de orden en la misma página no reemplaza el período vigente', async () => {
      rol = 1; await navigate('/reportes/ventas?mes=2026-11'); await ready();
      await chooseDay('2099-12-31'); planned = { hold: true }; await click('.reporte-filters button[type=submit]'); await esperar(() => held);
      const old = held; held = null;
      await evaluate('history.back()'); await wait('location.search === "?mes=2026-11"'); await ready();
      await respond(old.requestId, 200, old.body); await settle();
      await contains('01/11/2026 al 30/11/2026');
      assert.equal(await evaluate('document.querySelector(".reporte-resumen").textContent.includes("31/12/2099")'), false);
      assert.equal(await evaluate('document.getElementById("reporte-modalidad").value'), 'mes');
    });
    await t.test('Buscar/Actualizar bloquean duplicados, límite y paginación durante una respuesta retenida', async () => {
      await navigate('/reportes/ventas?mes=2026-11'); await ready();
      for (const selector of ['.reporte-filters button[type=submit]', '.catalogo-toolbar button']) {
        planned = { hold: true }; const before = reportRequests().length;
        await click(selector); await esperar(() => held);
        assert.ok(await evaluate('[...document.querySelectorAll(".reporte-filters button, .catalogo-toolbar button, .consulta-pagination button, .consulta-pagination select")].every(el=>el.matches(":disabled"))'));
        await click(selector); await click('.consulta-pagination nav button:last-child'); await settle();
        assert.equal(reportRequests().length, before + 1);
        assert.equal(await evaluate('!!document.querySelector(".reporte-resumen")'), false);
        const current = held; held = null; await respond(current.requestId, 200, current.body); await ready();
      }
    });
    await t.test('Buscar criterios equivalentes refresca una vez con defaults omitidos, orden distinto o URL canónica', async () => {
      for (const query of ['mes=2026-11', 'limite=25&pagina=1&mes=2026-11', 'mes=2026-11&pagina=1&limite=25']) {
        await navigate('/reportes/ventas?' + query); await ready();
        const before = reportRequests().length;
        await click('.reporte-filters button[type=submit]'); await ready(); await settle();
        assert.equal(reportRequests().length, before + 1);
        assert.deepEqual(reportRequests().at(-1).query, { mes: '2026-11', pagina: '1', limite: '25' });
        assert.equal(await evaluate('location.search'), '?mes=2026-11&pagina=1&limite=25');
        assert.ok(await evaluate('!!document.querySelector(".reporte-resumen")'));
      }
    });
    if (tipo === 'ventas') await t.test('Recorrido conjunto por rol desde destino del paquete, sin landing ni doble selección', async () => {
      for (const role of [1, 2]) {
        rol = role; await navigate('/dashboard'); await wait('!!document.querySelector(".dashboard-module-list")');
        const destination = role === 1 ? '/reportes/ventas' : '/inventario/movimientos';
        assert.equal(await evaluate('[...document.querySelectorAll(".dashboard-module")].find(a=>a.querySelector("strong").textContent === "Reportes").getAttribute("href")'), destination);
        await evaluate('[...document.querySelectorAll(".dashboard-module")].find(a=>a.querySelector("strong").textContent === "Reportes").click()');
        await ready(role === 1 ? '.reporte-ventas-page' : '.inventario-page');
        const steps = role === 1 ? [
          ['Reporte de ventas', '/reportes/ventas', '.reporte-ventas-page'],
          ['Reporte de compras', '/reportes/compras', '.reporte-compras-page'],
          ['Historial de inventario', '/inventario/movimientos', '.inventario-page'],
          ['Consulta de pérdidas', '/reportes/perdidas', '.reporte-perdidas-page']
        ] : [
          ['Historial de inventario', '/inventario/movimientos', '.inventario-page'],
          ['Consulta de pérdidas', '/reportes/perdidas', '.reporte-perdidas-page']
        ];
        assert.deepEqual(await evaluate('[...document.querySelectorAll("#sidebar-package-reportes a")].map(a=>a.textContent.trim())'), steps.map(([label])=>label));
        for (const [label, path, selector] of steps) {
          const before = requests.filter(r=>r.path.startsWith('/api/reportes/')).length;
          await link(label); await ready(selector);
          assert.equal(await evaluate('location.pathname'), path); assert.deepEqual(await active(), [label]);
          if (path.startsWith('/reportes/')) {
            await contains('Selecciona un período'); await settle();
            assert.equal(requests.filter(r=>r.path.startsWith('/api/reportes/')).length, before);
            await chooseDay('2026-11-01'); await click('.reporte-filters button[type=submit]'); await ready(selector);
            assert.equal(requests.at(-1).path, '/api' + path);
            assert.equal(await evaluate('document.querySelectorAll(".reporte-resumen").length'), 1);
            assert.deepEqual(await active(), [label]);
          }
        }
      }
      rol = 3; await navigate('/dashboard'); await wait('!!document.querySelector(".dashboard-module-list")');
      assert.equal(await evaluate('[...document.querySelectorAll(".dashboard-module strong")].some(el=>el.textContent === "Reportes")'), false);
    });
    await t.test('Roles, acceso directo y CU40 desde ambos paquetes sin doble activo; query y Atrás/Adelante', async () => {
      for (const role of [1, 2, 3]) {
        rol = role; await navigate('/dashboard'); await wait('!!document.querySelector(".app-sidebar")');
        assert.equal(await evaluate('!!document.getElementById("sidebar-package-reportes")'), role !== 3);
        assert.equal(await evaluate(`!!document.querySelector('.app-sidebar a[href="/reportes/ventas"]')`), role === 1);
        assert.equal(await evaluate(`!!document.querySelector('.app-sidebar a[href="/reportes/compras"]')`), role === 1);
        assert.equal(await evaluate(`!!document.querySelector('.app-sidebar a[href="/reportes/perdidas"]')`), role !== 3);
        if (role !== 1 && !(perdidas && role === 2)) { const count = reportRequests().length; await navigate('/reportes/ventas?mes=2026-11'); await wait('location.pathname === "/dashboard"'); assert.equal(reportRequests().length, count); }
        if (perdidas && role === 2) {
          await link('Consulta de pérdidas'); await ready(); await contains('Selecciona un período');
          await navigate('/reportes/ventas?mes=2026-11'); await ready(); assert.deepEqual(await active(), ['Consulta de pérdidas']);
          const query = await evaluate('location.search'); await click(`${tabla} a`); await ready('.inventario-page');
          assert.deepEqual(await active(), ['Historial de inventario']);
          await evaluate('history.back()'); await ready(); assert.equal(await evaluate('location.search'), query);
          assert.deepEqual(await active(), ['Consulta de pérdidas']);
        }
        if (role === 3) { const before = requests.length; await navigate('/inventario/movimientos'); await wait('location.pathname === "/dashboard"'); assert.equal(requests.slice(before).some(r => r.path === '/api/inventario/movimientos'), false); continue; }
        await link('Historial de inventario'); await ready('.inventario-page'); assert.deepEqual(await active(), ['Historial de inventario']);
        assert.ok(await evaluate('document.querySelector("[aria-controls=sidebar-package-reportes]").getAttribute("aria-expanded") === "true"'));
        await select('inv-direccion', 'SALIDA'); await ready('.inventario-page'); await wait('location.search.includes("direccion=SALIDA")'); assert.deepEqual(await active(), ['Historial de inventario']);
        await click('.inventario-filters button'); await ready('.inventario-page'); await wait('location.search === ""'); assert.deepEqual(await active(), ['Historial de inventario']);
        // Una URL distinta genera entrada de historial; Link al mismo destino la reemplaza por diseño de Router.
        await select('inv-direccion', 'ENTRADA'); await ready('.inventario-page'); await wait('location.search.includes("direccion=ENTRADA")');
        await link('Consultar movimientos de inventario'); await ready('.inventario-page'); assert.deepEqual(await active(), ['Consultar movimientos de inventario']);
        await evaluate('history.back()'); await ready('.inventario-page'); await wait('history.state.usr?.sidebarItemKey === "reporte-historial"'); assert.deepEqual(await active(), ['Historial de inventario']);
        await evaluate('history.forward()'); await ready('.inventario-page'); await wait('history.state.usr?.sidebarItemKey === "consultar-movimientos"'); assert.deepEqual(await active(), ['Consultar movimientos de inventario']);
        await navigate('/inventario/movimientos'); await ready('.inventario-page'); assert.deepEqual(await active(), ['Consultar movimientos de inventario']);
      }
      rol = null; const before = reportRequests().length; await navigate('/reportes/ventas?mes=2026-11'); await wait('location.pathname === "/login"'); assert.equal(reportRequests().length, before);
    });
    await t.test('Paquete contraído: teclado expande, enfoca enlace y navega con selección única', async () => {
      rol = 1; await navigate('/reportes/ventas?mes=2026-11'); await ready();
      await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false }); await settle();
      const toggle = '[aria-controls=sidebar-package-reportes]';
      await click(toggle); assert.equal(await evaluate('document.getElementById("sidebar-package-reportes").hidden'), true);
      await evaluate(`document.querySelector('${toggle}').focus()`);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await wait('!document.getElementById("sidebar-package-reportes").hidden');
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', windowsVirtualKeyCode: 9 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', windowsVirtualKeyCode: 9 });
      assert.equal(await evaluate('document.activeElement.textContent.trim()'), 'Reporte de ventas');
      assert.notEqual(await evaluate('getComputedStyle(document.activeElement).outlineStyle'), 'none');
      // El enlace de la consulta ejercida se activa también con Enter real.
      await evaluate(`document.querySelector('#sidebar-package-reportes a[href="${ruta}"]').focus()`);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await ready();
      assert.deepEqual(await active(), [perdidas ? 'Consulta de pérdidas' : compras ? 'Reporte de compras' : 'Reporte de ventas']);
      await contains('Selecciona un período');
    });
    await t.test('Labels, tabla accesible, teclado, escritorio/375px y navegación móvil CU40', async () => {
      rol = 1; await navigate('/reportes/ventas?mes=2026-11&limite=7'); await ready();
      for (const width of [1366, 375]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 375 }); await settle();
        assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
        assert.ok(await evaluate('[...document.querySelectorAll(".reporte-filters input, .reporte-filters select, .consulta-pagination select")].every(el=>el.labels.length>0)'));
        assert.ok(await evaluate('!!document.querySelector("table caption") && [...document.querySelectorAll("table th")].every(el=>el.scope === "col")'));
        assert.ok(await evaluate('document.querySelector(".catalogo-table-wrap").tabIndex === 0 && !!document.querySelector(".catalogo-table-wrap").getAttribute("aria-label")'));
        assert.ok(await evaluate('document.querySelector(".reporte-filters fieldset legend").textContent.length > 0 && !!document.querySelector(".catalogo-toolbar [role=status][aria-live=polite]")'));
        if (width === 375) {
          await evaluate('document.querySelector(".catalogo-table-wrap").focus()');
          await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', windowsVirtualKeyCode: 39 });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', windowsVirtualKeyCode: 39 });
          await wait('document.querySelector(".catalogo-table-wrap").scrollLeft > 0');
        }
      }
      await evaluate('document.getElementById("reporte-modalidad").focus()');
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', windowsVirtualKeyCode: 9 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', windowsVirtualKeyCode: 9 });
      assert.equal(await evaluate('document.activeElement.id'), 'reporte-mes');
      await click('.app-header__menu-button'); await wait('!!document.querySelector(".app-sidebar[role=dialog]")');
      assert.equal(await evaluate('document.activeElement === document.querySelector(".app-sidebar__close")'), true);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
      assert.equal(await evaluate('document.activeElement === document.querySelector(".app-sidebar__logout")'), true);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', windowsVirtualKeyCode: 9 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', windowsVirtualKeyCode: 9 });
      assert.equal(await evaluate('document.activeElement === document.querySelector(".app-sidebar__close")'), true);
      await link('Historial de inventario'); await ready('.inventario-page'); await wait('!document.querySelector(".app-sidebar[role=dialog]")'); assert.deepEqual(await active(), ['Historial de inventario']);
      if (perdidas) {
        await click('.app-header__menu-button'); await wait('!!document.querySelector(".app-sidebar[role=dialog]")');
        await link('Consulta de pérdidas'); await ready(); await wait('!document.querySelector(".app-sidebar[role=dialog]")');
        assert.deepEqual(await active(), ['Consulta de pérdidas']); await contains('Selecciona un período');
      }
      await click('.app-header__menu-button'); await wait('!!document.querySelector(".app-sidebar[role=dialog]")');
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', windowsVirtualKeyCode: 27 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', windowsVirtualKeyCode: 27 });
      await wait('document.activeElement === document.querySelector(".app-header__menu-button")');
      assert.equal(await evaluate('localStorage.length + sessionStorage.length'), 0);
    });
    assert.deepEqual(unexpected, []); assert.deepEqual(errors, []); assert.ok(requests.every(r => r.method === 'GET'));
    if (perdidas) assert.ok(requests.every(r => ['/api/auth/me', '/api/reportes/perdidas', '/api/inventario/movimientos'].includes(r.path)), 'Sin enriquecimiento desde otros módulos');
  } finally {
    if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch {} }
    socket?.close();
    for (const child of [browser, vite]) { if (!child || child.exitCode !== null) continue; const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; }
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
