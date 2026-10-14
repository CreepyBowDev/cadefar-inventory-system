// CU42 Fases 1/2/3: navegador real y API interceptada. No conecta a MySQL.
// Ejecutar secuencialmente con las otras suites de navegador.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const browserPath = process.env.CADEFAR_TEST_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(existsSync);
const esperar = async predicate => {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error('Tiempo agotado esperando Bitácora');
};
const identidad = { idUsuario: 17, nombreUsuario: 'administrador_historico', idRol: 1 };
const evento = (idEvento, extra = {}) => ({
  idEvento, tipoEvento: 'COMPRA_REGISTRAR', modulo: 'COMPRAS', accion: 'REGISTRAR', resultado: 'EXITO', causa: null,
  fechaRegistro: '2026-10-13T03:04:05.678Z', fechaEvento: '2026-10-13T03:04:00.123Z',
  responsable: identidad, cuentaObjetivo: null, nombreIngresado: null, registro: { tipo: 'COMPRA', id: 91 },
  direccionIp: '192.0.2.1', procedenciaIp: 'SOCKET_PEER', correlacion: 'a'.repeat(32), idEventoRelacionado: null, versionFormato: 1,
  ...extra
});
const datos = [
  evento(40),
  evento(39, { tipoEvento: 'LOGIN_PASSWORD_INCORRECTA', modulo: 'AUTENTICACION', accion: 'LOGIN', resultado: 'RECHAZADO', causa: 'PASSWORD_INCORRECTA',
    responsable: null, cuentaObjetivo: { idUsuario: 18, nombreUsuario: 'cuenta_objetivo_historica', idRol: 3 }, registro: { tipo: 'USUARIO', id: 18 } }),
  evento(38, { tipoEvento: 'ERROR_TECNICO', modulo: 'SEGURIDAD', accion: 'PROCESAR', resultado: 'FALLO', causa: 'ERROR_PERSISTENCIA', registro: null }),
  evento(37, { tipoEvento: 'LOGIN_BLOQUEO_GENERADO', modulo: 'AUTENTICACION', resultado: 'EXITO', responsable: null,
    cuentaObjetivo: { idUsuario: 18, nombreUsuario: 'cuenta_objetivo_historica', idRol: 3 }, registro: { tipo: 'USUARIO', id: 18 } }),
  evento(36, { tipoEvento: 'LOGIN_USUARIO_INEXISTENTE', modulo: 'AUTENTICACION', resultado: 'RECHAZADO', responsable: null,
    nombreIngresado: 'nombre_inexistente', registro: null })
];
const respuesta = (data = datos, total = 218, pagina = 1, limite = 25) => ({ data, paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) } });
const detalle = id => {
  const base = datos.find(e => e.idEvento === id) || evento(id);
  if (id === 30) return { ...base, tipoEvento: 'USUARIO_MODIFICAR', modulo: 'USUARIOS', accion: 'MODIFICAR', registro: { tipo: 'USUARIO', id: 18 },
    cuentaObjetivo: { idUsuario: 18, nombreUsuario: 'cuenta_objetivo_historica', idRol: 3 },
    antes: { nombreUsuario: 'cuenta_anterior', idRol: 1, estado: false, correoAsignado: false },
    despues: { nombreUsuario: '<img src=x onerror="window.__inyeccion=true">', idRol: 3, estado: true, correoAsignado: true },
    metadatos: { efecto: 'CONFIRMADO', camposModificados: ['nombreUsuario', 'idRol', 'estado', 'correoAsignado', 'correo'] }, referencias: [] };
  if (id === 39) return { ...base, antes: null, despues: null, idEventoRelacionado: 37,
    metadatos: { intentosFallidos: 3, bloqueadoDesde: '2026-10-13 03:04:00.123', bloqueadoHasta: '2026-10-13 03:14:00.123', duracionMinutos: 10, efecto: 'CONFIRMADO' }, referencias: null };
  if (id === 36) return { ...base, direccionIp: null, procedenciaIp: 'NO_DISPONIBLE', antes: null, despues: null, metadatos: { intentosFallidos: 0 }, referencias: null };
  if (id === 80) return { ...base, versionFormato: 2, antes: { nombreUsuario: 'formato_futuro_no_interpretar' }, despues: null,
    metadatos: { cantidadResultados: 1 }, referencias: [] };
  return { ...base, antes: null, despues: { estadoOperacion: 'CONFIRMADA', total: '999999999999.123456', cantidadDetalles: 2 },
    metadatos: { efecto: 'CONFIRMADO', cantidadDetalles: 2, cantidadMovimientos: 2, cantidadReferenciasOmitidas: 7 },
    referencias: [{ tipo: 'COMPRA', id: 91 }, { tipo: 'EXISTENCIA', id: 21 }, { tipo: 'MOVIMIENTO', id: 31 }] };
};

test('CU42 Fases 1/2/3: listado, detalle histórico, filtros URL, sesión y móvil', { timeout: 120000 }, async t => {
  assert.ok(browserPath, 'Instalar Chrome/Edge o configurar CADEFAR_TEST_BROWSER');
  const tempRoot = process.platform === 'win32' ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : tmpdir();
  const profile = await mkdtemp(join(tempRoot, 'cadefar-bitacora-'));
  const origin = 'http://127.0.0.1:5184';
  const vite = spawn(process.execPath, ['--input-type=module', '--eval', `import { build, preview } from 'vite'; const outDir=${JSON.stringify(join(profile, 'app'))}; await build({logLevel:'warn',build:{outDir,emptyOutDir:true}}); const server=await preview({build:{outDir},preview:{host:'127.0.0.1',port:5184,strictPort:true}}); server.printUrls();`], {
    cwd: root, env: { ...process.env, VITE_API_URL: `${origin}/api` }, stdio: ['ignore', 'pipe', 'pipe']
  });
  let browser, socket, send, rol = 1, nextResponse, heldRequest;
  const requests = [], errors = [], unexpected = [];
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Vite no inició en 5184')), 20000);
      vite.stdout.on('data', chunk => {
        if (chunk.toString().replace(/\x1b\[[0-9;]*m/g, '').includes('127.0.0.1:5184')) { clearTimeout(timer); resolve(); }
      });
      vite.once('error', reject); vite.once('exit', () => reject(new Error('Vite terminó antes de iniciar')));
    });
    browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
    const port = await esperar(async () => { try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { return null; } });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let sequence = 0;
    const pending = new Map();
    send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error(`Chrome no respondió: ${method}`)); }, 15000);
      pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const respond = (requestId, status, body) => send('Fetch.fulfillRequest', { requestId, responseCode: status,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
    socket.addEventListener('close', () => { for (const item of pending.values()) item.reject(new Error('Chrome cerró')); pending.clear(); });
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const item = pending.get(message.id); pending.delete(message.id);
        if (message.error) item?.reject(new Error(message.error.message)); else item?.resolve(message.result);
      } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
      else if (message.method === 'Fetch.requestPaused') {
        const { requestId, request } = message.params, url = new URL(request.url);
        requests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), method: request.method });
        const finish = (status, body) => { void respond(requestId, status, body).catch(error => errors.push(error.message)); };
        if (url.pathname === '/api/auth/me') { finish(rol ? 200 : 401, rol ? { data: { idUsuario: rol, idRol: rol, nombreUsuario: `cuenta_actual_${rol}` } } : { message: 'No autenticado' }); return; }
        if (url.pathname === '/api/bitacora' && request.method === 'GET') {
          const planned = nextResponse; nextResponse = null;
          if (planned?.hold) { heldRequest = requestId; return; }
          if (planned?.networkError) { void send('Fetch.failRequest', { requestId, errorReason: 'ConnectionRefused' }); return; }
          const pagina = Number(url.searchParams.get('pagina') || 1), limite = Number(url.searchParams.get('limite') || 25);
          finish(planned?.status || 200, planned?.body || respuesta(pagina === 1 ? datos : [evento(30)], 218, pagina, limite)); return;
        }
        if (/^\/api\/bitacora\/\d+$/.test(url.pathname) && request.method === 'GET') {
          const planned = nextResponse; nextResponse = null;
          if (planned?.hold) { heldRequest = requestId; return; }
          if (planned?.networkError) { void send('Fetch.failRequest', { requestId, errorReason: 'ConnectionRefused' }); return; }
          finish(planned?.status || 200, planned?.body || { data: detalle(Number(url.pathname.split('/').at(-1))) }); return;
        }
        unexpected.push(`${request.method} ${url.pathname}`); finish(404, { message: 'Endpoint inesperado' });
      }
    });
    await send('Page.enable'); await send('Runtime.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: `${origin}/api/*` }] });
    // La zona del equipo difiere de Bolivia: el formato debe ser explícito.
    await send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Tokyo' });
    const evaluate = async expression => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      assert.ok(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value;
    };
    const waitFor = expression => esperar(async () => evaluate(expression));
    const settle = () => evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
    const navigate = async (path, selector = '.bitacora-page') => {
      await evaluate('window.__navigating = true'); await send('Page.navigate', { url: `${origin}${path}` });
      await waitFor(`!window.__navigating && !!document.querySelector(${JSON.stringify(selector)})`); await settle();
    };
    const ready = () => waitFor('document.querySelector(".bitacora-page [aria-busy]")?.getAttribute("aria-busy") === "false"');
    const clickActualizar = () => evaluate('[...document.querySelectorAll(".bitacora-page button")].find(b => b.textContent.trim() === "Actualizar").click()');
    const buscar = () => evaluate('document.querySelector(".bitacora-filters button[type=submit]").click()');
    const limpiar = () => evaluate('document.querySelector(".bitacora-filters button[type=button]").click()');
    const cambiarCampo = (nombre, valor) => evaluate(`(() => {
      const input = document.querySelector('[name="${nombre}"]');
      const setter = Object.getOwnPropertyDescriptor(input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(valor)}); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', {bubbles:true}));
    })()`);
    const siguiente = () => evaluate('[...document.querySelectorAll(".bitacora-pagination button")].find(b => b.textContent === "Siguiente").click()');
    const consultas = () => requests.filter(r => r.path === '/api/bitacora');
    const detalles = () => requests.filter(r => r.path.startsWith('/api/bitacora/'));
    const viewport = async width => { await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 620 }); await settle(); };
    const screenshot = async name => {
      if (!process.env.CADEFAR_SCREENSHOT_DIR) return;
      await mkdir(process.env.CADEFAR_SCREENSHOT_DIR, { recursive: true });
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await writeFile(join(process.env.CADEFAR_SCREENSHOT_DIR, name), Buffer.from(data, 'base64'));
    };

    await t.test('Administrador: entrada directa, menú activo y una consulta acotada con total del servidor', async () => {
      await viewport(1440); await navigate('/bitacora'); await ready();
      assert.equal(await evaluate('document.querySelector(".app-header h1").textContent'), 'Bitácora');
      assert.equal(await evaluate(`document.querySelector('.app-sidebar a[href="/bitacora"]').getAttribute('aria-current')`), 'page');
      assert.equal(await evaluate('document.querySelectorAll(".bitacora-table tbody tr").length'), 5);
      assert.equal(await evaluate('document.body.textContent.includes("5 de 218 eventos registrados")'), true);
      assert.deepEqual(consultas().at(-1).query, { pagina: '1', limite: '25' });
      assert.equal(consultas().length, 1); await screenshot('bitacora-escritorio.png');
    });
    await t.test('Fechas de registro en Bolivia con milisegundos, aunque el navegador esté en Tokio', async () => {
      const fecha = await evaluate('document.querySelector(".bitacora-table time").textContent');
      assert.ok(fecha.includes('12/10/2026')); assert.match(fecha, /23:04:05[.,]678/);
      assert.equal(await evaluate('document.querySelector(".bitacora-table time").dateTime'), '2026-10-13T03:04:05.678Z');
      assert.equal(await evaluate('document.getElementById("bitacora-zona").textContent.includes("America/La_Paz")'), true);
    });
    await t.test('Identidades históricas y cuenta objetivo diferenciadas; el bloqueo no se presenta como login correcto', async () => {
      const filas = await evaluate('[...document.querySelectorAll(".bitacora-table tbody tr")].map(e => e.textContent)');
      assert.ok(filas[0].includes('administrador_historico')); assert.equal(filas[0].includes('cuenta_actual_1'), false);
      assert.ok(filas[1].includes('Sin responsable autenticado')); assert.ok(filas[1].includes('Cuenta objetivo: cuenta_objetivo_historica (#18)'));
      assert.ok(filas[3].includes('Bloqueo temporal generado')); assert.equal(filas[3].includes('Inicio de sesión correcto'), false);
      assert.ok(filas[4].includes('Nombre ingresado: nombre_inexistente'));
      assert.deepEqual(await evaluate('[...document.querySelectorAll(".bitacora-resultado")].map(e => e.textContent)'), ['Éxito', 'Rechazado', 'Fallo', 'Éxito', 'Rechazado']);
    });
    await t.test('Actualizar retira datos antiguos, bloquea envíos mientras carga y no genera consultas periódicas', async () => {
      const antes = consultas().length; nextResponse = { hold: true }; await clickActualizar();
      await esperar(() => heldRequest);
      assert.equal(await evaluate('document.querySelectorAll(".bitacora-table tbody tr").length'), 0);
      assert.equal(await evaluate('document.querySelector(".bitacora-page button").disabled'), true);
      await clickActualizar(); await settle(); assert.equal(consultas().length, antes + 1);
      await respond(heldRequest, 200, respuesta([evento(50)], 219)); heldRequest = null; await ready();
      assert.equal(await evaluate('document.body.textContent.includes("1 de 219 eventos registrados")'), true);
      await new Promise(resolve => setTimeout(resolve, 500)); assert.equal(consultas().length, antes + 1);
    });
    await t.test('Historial vacío es una lectura válida, distinta de errores de consulta', async () => {
      nextResponse = { body: respuesta([], 0) }; await clickActualizar(); await ready();
      assert.equal(await evaluate('document.body.textContent.includes("No hay eventos registrados")'), true);
      assert.equal(await evaluate('document.body.textContent.includes("0 de 0 eventos registrados")'), true);
      assert.equal(await evaluate('document.querySelector(".bitacora-page button").disabled'), false);
    });
    await t.test('Una respuesta incompleta no se presenta como historial vacío ni total cero', async () => {
      for (const body of [{ data: [] }, { data: null, paginacion: { total: 0 } }]) {
        nextResponse = { body }; await clickActualizar(); await ready();
        assert.equal(await evaluate('document.body.textContent.includes("respuesta incompleta")'), true);
        assert.equal(await evaluate('document.body.textContent.includes("No hay eventos registrados") || document.body.textContent.includes("0 de 0 eventos registrados")'), false);
      }
      await clickActualizar(); await ready();
    });
    await t.test('400/404/500/503 y red: errores visibles, reintento manual y sin mostrar resultados anteriores', async () => {
      for (const status of [400, 404, 500, 503, undefined]) {
        nextResponse = status ? { status, body: { message: status >= 500 ? 'detalle_tecnico_no_mostrar' : 'Consulta rechazada' } } : { networkError: true };
        await clickActualizar(); await ready();
        assert.equal(await evaluate('document.body.textContent.includes("No fue posible consultar la Bitácora")'), true);
        assert.equal(await evaluate('document.body.textContent.includes("detalle_tecnico_no_mostrar")'), false);
        assert.equal(await evaluate('document.querySelectorAll(".bitacora-table tbody tr").length'), 0);
        assert.equal(await evaluate('[...document.querySelectorAll(".bitacora-page button")].some(b => b.textContent.includes("Reintentar"))'), true);
      }
      await evaluate('[...document.querySelectorAll(".bitacora-page button")].find(b => b.textContent.includes("Reintentar")).click()'); await ready();
      assert.equal(await evaluate('document.querySelectorAll(".bitacora-table tbody tr").length'), 5);
    });
    await t.test('401/403 desde API conservan mensajes de sesión/permisos y bloquean reintentos', async () => {
      for (const status of [401, 403]) {
        nextResponse = { status, body: { message: 'rechazo_sintetico' } }; await navigate('/bitacora'); await ready();
        assert.equal(await evaluate('document.querySelector(".bitacora-page button").disabled'), true);
        assert.equal(await evaluate('[...document.querySelectorAll(".bitacora-page button")].some(b => b.textContent.includes("Reintentar"))'), false);
        assert.equal(await evaluate(`!!document.querySelector('.bitacora-page a[href="/login"]')`), status === 401);
      }
    });
    await t.test('Regente/Vendedor no ven accesos y la ruta directa no solicita Bitácora', async () => {
      for (rol of [2, 3]) {
        const antes = consultas().length; await navigate('/bitacora', '.dashboard-page');
        assert.equal(await evaluate('location.pathname'), '/dashboard');
        assert.equal(await evaluate('document.body.textContent.includes("No tienes autorización para acceder a esa sección.")'), true);
        assert.equal(await evaluate(`!!document.querySelector('a[href="/bitacora"]')`), false);
        assert.equal(consultas().length, antes);
      }
    });
    await t.test('Sin sesión vuelve a login; el Administrador puede abrir Bitácora desde Inicio', async () => {
      rol = 0; const antes = consultas().length; await navigate('/bitacora', '.login-page');
      assert.equal(await evaluate('location.pathname'), '/login'); assert.equal(consultas().length, antes);
      rol = 1; await navigate('/dashboard', '.dashboard-page');
      await evaluate(`document.querySelector('.dashboard-module[href="/bitacora"]').click()`); await ready();
      assert.equal(await evaluate('location.pathname'), '/bitacora');
    });
    await t.test('Tipos desconocidos y textos con HTML se conservan como texto sin ejecución', async () => {
      const texto = '<img src=x onerror="window.__inyeccion=true">';
      nextResponse = { body: respuesta([evento(60, { tipoEvento: 'TIPO_FUTURO', modulo: 'MODULO_FUTURO', resultado: 'RESULTADO_FUTURO', responsable: { ...identidad, nombreUsuario: texto } })], 1) };
      await clickActualizar(); await ready();
      assert.equal(await evaluate('document.body.textContent.includes("TIPO_FUTURO") && document.body.textContent.includes("RESULTADO_FUTURO")'), true);
      assert.equal(await evaluate('document.querySelector(".bitacora-table").textContent.includes("<img")'), true);
      assert.equal(await evaluate('!!document.querySelector(".bitacora-table img") || Boolean(window.__inyeccion)'), false);
    });
    await t.test('Vista móvil, textos largos, foco visible y tabla desplazable sin desbordar la página', async () => {
      nextResponse = { body: respuesta([evento(70, { responsable: { ...identidad, nombreUsuario: 'nombre_extenso_'.repeat(4) } })], 1) };
      await clickActualizar(); await ready();
      for (const width of [320, 375, 768, 1440]) {
        await viewport(width);
        assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `Página sin desbordamiento a ${width}px`);
        const overflow = await evaluate('(() => { const t = document.querySelector(".bitacora-table-wrap"); return t.scrollWidth > t.clientWidth && getComputedStyle(t).overflowX === "auto"; })()');
        if (width < 1000) assert.equal(overflow, true);
        await evaluate('document.querySelector(".bitacora-filters button[type=submit]").focus()');
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await settle();
        assert.equal(await evaluate('document.activeElement.matches(".bitacora-table-wrap")'), true);
        assert.equal(await evaluate('getComputedStyle(document.activeElement).outlineStyle'), 'solid');
        await screenshot(`bitacora-${width}.png`);
      }
    });
    await t.test('Respuesta tardía después de salir no altera otra pantalla ni inicia consultas adicionales', async () => {
      nextResponse = { hold: true }; await clickActualizar(); await esperar(() => heldRequest);
      await evaluate(`document.querySelector('.app-sidebar a[href="/dashboard"]').click()`);
      await waitFor('!!document.querySelector(".dashboard-page")');
      const antes = consultas().length; await respond(heldRequest, 200, respuesta([evento(999)], 1)); heldRequest = null; await settle();
      assert.equal(await evaluate('!!document.querySelector(".bitacora-page")'), false); assert.equal(consultas().length, antes);
      await navigate('/bitacora'); await ready();
      assert.equal(await evaluate('document.querySelector(".bitacora-table").textContent.includes("Evento #999")'), false);
    });
    await t.test('Recarga conserva acceso y vuelve a consultar solo la primera página', async () => {
      const antes = consultas().length; await navigate('/bitacora'); await ready();
      assert.equal(consultas().length, antes + 1); assert.deepEqual(consultas().at(-1).query, { pagina: '1', limite: '25' });
      assert.ok(requests.every(r => r.method === 'GET')); assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
    });
    await t.test('Editar filtros no consulta; Buscar combina los 12 criterios y envía fechas con zona, independiente del equipo', async () => {
      const antes = consultas().length;
      const criterios = { desde: '2026-10-12T23:04:05.678', hasta: '2026-10-13T23:59:59.999',
        modulo: 'AUTENTICACION', tipoEvento: 'LOGIN_PASSWORD_INCORRECTA', resultado: 'RECHAZADO', idUsuarioResponsable: '17',
        idUsuarioObjetivo: '18', nombreIngresado: '  cuenta_historica  ', direccionIp: '2001:db8::1',
        accion: 'LOGIN', tipoRegistro: 'USUARIO', idRegistro: '18' };
      await evaluate('document.querySelector(".bitacora-filters summary").click()');
      for (const [campo, valor] of Object.entries(criterios)) await cambiarCampo(campo, valor);
      await new Promise(resolve => setTimeout(resolve, 450)); assert.equal(consultas().length, antes);
      assert.equal(await evaluate('document.body.textContent.includes("Hay cambios sin aplicar")'), true);
      await buscar(); await ready();
      const esperados = { ...criterios, nombreIngresado: 'cuenta_historica', desde: `${criterios.desde}-04:00`, hasta: `${criterios.hasta}-04:00`, pagina: '1', limite: '25' };
      assert.deepEqual(consultas().at(-1).query, esperados);
      assert.deepEqual(await evaluate('Object.fromEntries(new URLSearchParams(location.search))'), esperados);
      assert.equal(consultas().length, antes + 1);
      assert.equal(await evaluate('document.querySelector("[name=desde]").value'), criterios.desde);
      await screenshot('bitacora-filtros.png');
    });
    await t.test('Página, recarga, Atrás/Adelante conservan criterios y sincronizan los controles', async () => {
      const base = consultas().at(-1).query;
      await siguiente(); await ready(); assert.deepEqual(consultas().at(-1).query, { ...base, pagina: '2' });
      assert.equal(await evaluate('document.body.textContent.includes("Página 2 de 9")'), true);
      const ruta = await evaluate('location.pathname + location.search');
      await navigate(ruta); await ready(); assert.deepEqual(consultas().at(-1).query, { ...base, pagina: '2' });
      await cambiarCampo('nombreIngresado', 'otro_nombre'); await buscar(); await ready();
      assert.equal(consultas().at(-1).query.pagina, '1');
      await evaluate('history.back()'); await waitFor('new URLSearchParams(location.search).get("pagina") === "2"'); await ready();
      assert.deepEqual(consultas().at(-1).query, { ...base, pagina: '2' });
      assert.equal(await evaluate('document.querySelector("[name=nombreIngresado]").value'), 'cuenta_historica');
      await evaluate('history.forward()'); await waitFor('new URLSearchParams(location.search).get("nombreIngresado") === "otro_nombre"'); await ready();
      assert.equal(consultas().at(-1).query.nombreIngresado, 'otro_nombre');
    });
    await t.test('Tamaño 25/50/100 reinicia página y no aplica un borrador pendiente; Limpiar reinicia criterios', async () => {
      await siguiente(); await ready(); await cambiarCampo('nombreIngresado', 'sin_aplicar');
      for (const limite of ['50', '100', '25']) {
        await evaluate(`(() => { const select = document.getElementById('bitacora-limite'); select.value = '${limite}'; select.dispatchEvent(new Event('change', {bubbles:true})); })()`); await ready();
        assert.equal(consultas().at(-1).query.limite, limite); assert.equal(consultas().at(-1).query.pagina, '1');
        assert.equal(consultas().at(-1).query.nombreIngresado, 'otro_nombre');
      }
      await limpiar(); await ready(); assert.deepEqual(consultas().at(-1).query, { pagina: '1', limite: '25' });
      assert.equal(await evaluate('document.querySelector("[name=nombreIngresado]").value'), '');
    });
    await t.test('Rangos, IDs y registro sin tipo se corrigen sin solicitar lecturas inválidas', async () => {
      const antes = consultas().length;
      await cambiarCampo('desde', '2026-10-14T00:00'); await cambiarCampo('hasta', '2026-10-13T00:00'); await buscar();
      assert.equal(await evaluate('document.body.textContent.includes("Desde no puede ser posterior")'), true);
      await cambiarCampo('desde', ''); await cambiarCampo('hasta', '');
      for (const invalido of ['0', '01', '1e2', '2147483648']) {
        await cambiarCampo('idUsuarioResponsable', invalido); await buscar();
        assert.equal(await evaluate('document.querySelector(".bitacora-filters .feedback") !== null'), true);
      }
      await cambiarCampo('idUsuarioResponsable', ''); await evaluate('document.querySelector(".bitacora-filters summary").click()');
      await cambiarCampo('idRegistro', '91'); await buscar();
      assert.equal(await evaluate('document.body.textContent.includes("Selecciona el tipo de registro")'), true);
      await cambiarCampo('idRegistro', ''); await cambiarCampo('direccionIp', '300.1.2.3'); await buscar();
      assert.equal(await evaluate('document.body.textContent.includes("IPv4 o IPv6 válida")'), true);
      assert.equal(consultas().length, antes);
      await limpiar(); await ready();
    });
    await t.test('URL inválida bloquea consulta, permite corregir con Buscar/Limpiar y no descarta criterios silenciosamente', async () => {
      for (const query of ['pagina=01', 'limite=101', 'idRegistro=91', 'resultado=OTRO', 'pagina=1&pagina=2', 'inventado=1', 'desde=2026-02-30T00:00:00Z']) {
        const antes = consultas().length; await navigate(`/bitacora?${query}`);
        assert.equal(consultas().length, antes);
        assert.equal(await evaluate('document.body.textContent.includes("Corrige los criterios de consulta")'), true);
        assert.equal(await evaluate('document.querySelector(".bitacora-page button").disabled'), true);
        await limpiar(); await ready(); assert.deepEqual(consultas().at(-1).query, { pagina: '1', limite: '25' });
      }
      await navigate('/bitacora?limite=101'); await buscar(); await ready();
      assert.deepEqual(consultas().at(-1).query, { pagina: '1', limite: '25' });
    });
    await t.test('Sin coincidencias y página fuera de rango ofrecen recuperación explícita sin consultas automáticas', async () => {
      nextResponse = { body: respuesta([], 0) }; await cambiarCampo('resultado', 'FALLO'); await buscar(); await ready();
      assert.equal(await evaluate('document.body.textContent.includes("No hay eventos que coincidan")'), true);
      assert.equal(await evaluate('document.body.textContent.includes("Sin páginas")'), true);
      await limpiar(); await ready();
      const antes = consultas().length; nextResponse = { body: respuesta([], 218, 20) }; await navigate('/bitacora?pagina=20&limite=25'); await ready();
      assert.equal(consultas().length, antes + 1);
      assert.equal(await evaluate('document.body.textContent.includes("Esta página no tiene resultados")'), true);
      await evaluate('[...document.querySelectorAll(".bitacora-page button")].find(b => b.textContent === "Volver a la primera página").click()'); await ready();
      assert.equal(consultas().at(-1).query.pagina, '1');
    });
    await t.test('Atrás invalida una respuesta pendiente de otra página aunque se reciba después', async () => {
      const original = consultas().at(-1).query; nextResponse = { hold: true }; await siguiente(); await esperar(() => heldRequest);
      await evaluate('history.back()'); await waitFor('new URLSearchParams(location.search).get("pagina") === "1"'); await ready();
      assert.deepEqual(consultas().at(-1).query, original);
      await respond(heldRequest, 200, respuesta([evento(999)], 218, 2)); heldRequest = null; await settle();
      assert.equal(await evaluate('document.querySelector(".bitacora-table").textContent.includes("Evento #999")'), false);
    });
    await t.test('Filtros expandidos y paginador caben en móvil; no hay consultas al abrir o cerrar Más filtros', async () => {
      const antes = consultas().length; await evaluate('document.querySelector(".bitacora-filters details").open = true');
      for (const width of [320, 375, 768, 1440]) {
        await viewport(width); assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `Filtros a ${width}px`);
        await screenshot(`bitacora-filtros-${width}.png`);
        await evaluate('document.querySelector(".bitacora-pagination").scrollIntoView({block:"end"})');
        await settle(); await screenshot(`bitacora-paginador-${width}.png`);
        await evaluate('scrollTo(0,0)'); await settle();
      }
      assert.equal(consultas().length, antes); assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
    });
    await t.test('Buscar con la misma URL relee una sola vez; Actualizar mantiene criterios aplicados ante borradores pendientes', async () => {
      await limpiar(); await ready(); await cambiarCampo('resultado', 'RECHAZADO'); await buscar(); await ready();
      const query = await evaluate('location.search'), antes = consultas().length;
      await buscar(); await ready(); assert.equal(consultas().length, antes + 1);
      assert.equal(await evaluate('location.search'), query);
      await cambiarCampo('resultado', 'FALLO'); await clickActualizar(); await ready();
      assert.equal(consultas().length, antes + 2); assert.equal(consultas().at(-1).query.resultado, 'RECHAZADO');
      assert.equal(await evaluate('document.querySelector("[name=resultado]").value'), 'FALLO');
      assert.ok(requests.every(r => r.method === 'GET')); assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
    });
    await t.test('Detalle desde página filtrada: GET sin criterios, recarga y retorno conservan URL/página/tamaño', async () => {
      await navigate('/bitacora?modulo=USUARIOS&pagina=2&limite=50'); await ready();
      const query = await evaluate('location.search'), antes = detalles().length;
      assert.equal(await evaluate('document.querySelector(".bitacora-table a").getAttribute("aria-label").includes("Ver detalle del evento")'), true);
      await evaluate('document.querySelector(".bitacora-table a").scrollIntoView({block:"center"})'); await settle();
      await evaluate('document.querySelector(".bitacora-table a").click()'); await ready();
      assert.equal(await evaluate('location.pathname'), '/bitacora/30');
      assert.equal(await evaluate('location.search'), query); assert.equal(detalles().length, antes + 1);
      assert.equal(await evaluate('scrollY'), 0);
      assert.equal(await evaluate('document.activeElement.tagName'), 'H2');
      assert.deepEqual(detalles().at(-1).query, {});
      assert.equal(await evaluate('document.querySelector(".app-header h1").textContent'), 'Detalle de Bitácora');
      assert.equal(await evaluate(`document.querySelector('.app-sidebar a[href="/bitacora"]').getAttribute('aria-current')`), 'page');
      await navigate(`/bitacora/30${query}`); await ready();
      assert.deepEqual(detalles().at(-1).query, {});
      await evaluate('document.querySelector(".bitacora-detail-page .back-link").click()'); await ready();
      assert.equal(await evaluate('location.pathname'), '/bitacora'); assert.equal(await evaluate('location.search'), query);
      assert.deepEqual(consultas().at(-1).query, { modulo: 'USUARIOS', pagina: '2', limite: '50' });
    });
    await t.test('Valores históricos antes/después, rol, falsos y cambio de correo sin valores conservados; texto HTML inerte', async () => {
      await navigate('/bitacora/30'); await ready();
      const filas = await evaluate('[...document.querySelectorAll(".bitacora-cambios tbody tr")].map(r => r.textContent)');
      assert.ok(filas.some(r => r.includes('Nombre de usuario') && r.includes('cuenta_anterior') && r.includes('<img')));
      assert.ok(filas.some(r => r.includes('Rol') && r.includes('Administrador (#1)') && r.includes('Vendedor (#3)')));
      assert.ok(filas.some(r => r.includes('Estado') && r.includes('Inactivo') && r.includes('Activo')));
      assert.ok(filas.some(r => r.includes('Correo asignado') && r.includes('No') && r.includes('Sí')));
      assert.ok(filas.some(r => r.includes('Correo') && r.includes('Solo se conserva que cambió') && r.includes('Valor no conservado')));
      assert.equal(await evaluate('Boolean(window.__inyeccion) || !!document.querySelector(".bitacora-detail img") || !!document.querySelector(".bitacora-cambios img")'), false);
      assert.equal(await evaluate('document.querySelector(".bitacora-detail").textContent.includes("administrador_historico")'), true);
      await screenshot('bitacora-detalle-usuario.png');
    });
    await t.test('Adquisición: decimales intactos, antes ausente, referencias y omisiones explícitas', async () => {
      await navigate('/bitacora/40'); await ready();
      assert.equal(await evaluate('document.querySelector(".bitacora-cambios").textContent.includes("999999999999.123456")'), true);
      assert.equal(await evaluate('document.querySelector(".bitacora-cambios").textContent.includes("No capturado")'), true);
      assert.equal(await evaluate('document.querySelectorAll(".bitacora-referencias li").length'), 3);
      assert.equal(await evaluate('document.body.textContent.includes("Se omitieron 7 referencias")'), true);
      assert.equal(await evaluate('document.querySelectorAll(".bitacora-detail-page input, .bitacora-detail-page textarea, .bitacora-detail-page form").length'), 0);
      assert.equal(await evaluate('document.querySelectorAll(".bitacora-detail time")[0].textContent.includes("12/10/2026")'), true);
    });
    await t.test('Login rechazado: cuenta objetivo no atribuida a responsable, bloqueo SQL UTC en Bolivia y evento relacionado', async () => {
      await navigate('/bitacora/39?resultado=RECHAZADO&pagina=2&limite=25'); await ready();
      const texto = await evaluate('document.querySelector(".bitacora-detail").textContent');
      assert.ok(texto.includes('Sin responsable autenticado')); assert.ok(texto.includes('cuenta_objetivo_historica'));
      assert.ok(texto.includes('Contraseña incorrecta')); assert.ok(texto.includes('PASSWORD_INCORRECTA'));
      assert.equal(await evaluate('document.querySelector(".bitacora-cambios") === null'), true);
      const fechas = await evaluate('[...document.querySelectorAll("section[aria-labelledby=bitacora-metadatos-title] time")].map(e => ({fecha:e.textContent, iso:e.dateTime}))');
      assert.match(fechas[0].fecha, /12\/10\/2026.*23:04:00[.,]123/); assert.equal(fechas[0].iso, '2026-10-13T03:04:00.123Z');
      assert.match(fechas[1].fecha, /23:14:00[.,]123/);
      await evaluate('document.querySelector(".bitacora-detail a").click()'); await ready();
      assert.equal(await evaluate('location.pathname + location.search'), '/bitacora/37?resultado=RECHAZADO&pagina=2&limite=25');
      assert.deepEqual(detalles().at(-1).query, {});
    });
    await t.test('Metadatos sin captura son distintos de cero, no disponible y ausencia de referencias', async () => {
      await navigate('/bitacora/36'); await ready();
      assert.equal(await evaluate('document.querySelector("section[aria-labelledby=bitacora-metadatos-title] dd").textContent'), '0');
      assert.equal(await evaluate('document.body.textContent.includes("Sin IP disponible (NO_DISPONIBLE)")'), true);
      assert.equal(await evaluate('document.body.textContent.includes("Nombre ingresadonombre_inexistente")'), true);
      nextResponse = { body: { data: { ...detalle(36), metadatos: null } } }; await clickActualizar(); await ready();
      assert.equal(await evaluate('document.body.textContent.includes("Sin metadatos disponibles")'), true);
      assert.equal(await evaluate('document.body.textContent.includes("Sin referencias adicionales registradas")'), true);
    });
    await t.test('IDs inválidos no hacen GET; 404 no equivale a historial vacío y la respuesta incompleta no se presenta como detalle válido', async () => {
      for (const id of ['0', '01', '1e2', '2147483648', 'abc']) {
        const antes = detalles().length; await navigate(`/bitacora/${id}`); await ready();
        assert.equal(detalles().length, antes);
        assert.equal(await evaluate('document.body.textContent.includes("Identificador de evento no válido")'), true);
      }
      nextResponse = { status: 404, body: { message: 'detalle_interno_no_mostrar' } }; await navigate('/bitacora/999'); await ready();
      assert.equal(await evaluate('document.body.textContent.includes("Evento no encontrado")'), true);
      assert.equal(await evaluate('document.body.textContent.includes("detalle_interno_no_mostrar")'), false);
      for (const data of [null, { idEvento: 999, tipoEvento: 'COMPRA_REGISTRAR', versionFormato: 1 }, detalle(40), { ...detalle(999), referencias: [null] }]) {
        nextResponse = { body: { data } }; await clickActualizar(); await ready();
        assert.equal(await evaluate('document.body.textContent.includes("detalle incompleto")'), true);
        assert.equal(await evaluate('!!document.querySelector(".bitacora-detail")'), false);
      }
    });
    await t.test('401/403 del detalle bloquean reintento; 400/500/503/red retiran datos anteriores y permiten reintento explícito', async () => {
      for (const status of [400, 500, 503, undefined]) {
        await navigate('/bitacora/40'); await ready();
        nextResponse = status ? { status, body: { message: status >= 500 ? 'detalle_tecnico_no_mostrar' : 'Consulta rechazada' } } : { networkError: true };
        await clickActualizar(); await ready();
        assert.equal(await evaluate('!!document.querySelector(".bitacora-detail") || !!document.querySelector(".bitacora-cambios")'), false);
        assert.equal(await evaluate('document.body.textContent.includes("detalle_tecnico_no_mostrar")'), false);
        assert.equal(await evaluate('[...document.querySelectorAll(".bitacora-page button")].some(b => b.textContent.includes("Reintentar"))'), true);
      }
      for (const status of [401, 403]) {
        nextResponse = { status, body: { message: 'rechazo_sintetico' } }; await navigate('/bitacora/40'); await ready();
        assert.equal(await evaluate('document.querySelector(".bitacora-page button").disabled'), true);
        assert.equal(await evaluate('[...document.querySelectorAll(".bitacora-page button")].some(b => b.textContent.includes("Reintentar"))'), false);
        assert.equal(await evaluate(`!!document.querySelector('.bitacora-page a[href="/login"]')`), status === 401);
      }
    });
    await t.test('Regente/Vendedor y sesión ausente no solicitan detalle por ruta directa', async () => {
      for (rol of [2, 3, 0]) {
        const antes = detalles().length; await navigate('/bitacora/40', rol ? '.dashboard-page' : '.login-page');
        assert.equal(detalles().length, antes); assert.equal(await evaluate('!!document.querySelector(".bitacora-detail-page")'), false);
      }
      rol = 1;
    });
    await t.test('Actualizar oculta el detalle anterior; respuesta tardía tras cambiar evento o salir no secuestra la vista', async () => {
      await navigate('/bitacora/39'); await ready(); nextResponse = { hold: true }; await clickActualizar(); await esperar(() => heldRequest);
      assert.equal(await evaluate('!!document.querySelector(".bitacora-detail")'), false);
      assert.equal(await evaluate('document.querySelector(".bitacora-page button").disabled'), true);
      await evaluate(`document.querySelector('.app-sidebar a[href="/bitacora"]').click()`); await ready();
      await evaluate('document.querySelector(".bitacora-table a").click()'); await ready();
      await respond(heldRequest, 200, { data: detalle(39) }); heldRequest = null; await settle();
      assert.equal(await evaluate('document.querySelector(".page-heading h2").textContent'), 'Evento #40');
      nextResponse = { hold: true }; await clickActualizar(); await esperar(() => heldRequest);
      await evaluate(`document.querySelector('.app-sidebar a[href="/dashboard"]').click()`); await waitFor('!!document.querySelector(".dashboard-page")');
      await respond(heldRequest, 200, { data: detalle(40) }); heldRequest = null; await settle();
      assert.equal(await evaluate('location.pathname'), '/dashboard');
    });
    await t.test('Formato futuro informa compatibilidad; claves ajenas al contrato no se vuelcan como JSON', async () => {
      await navigate('/bitacora/80'); await ready();
      assert.equal(await evaluate('document.body.textContent.includes("Formato de detalle no compatible")'), true);
      assert.equal(await evaluate('document.body.textContent.includes("formato_futuro_no_interpretar")'), false);
      const sintetico = { ...detalle(40), causa: 'CAUSA_FUTURA', antes: { password: 'secreto_sintetico_no_mostrar' },
        despues: { total: '0', token: 'secreto_sintetico_no_mostrar' }, metadatos: { cantidadResultados: 0, error: 'secreto_sintetico_no_mostrar' } };
      nextResponse = { body: { data: sintetico } }; await navigate('/bitacora/40'); await ready();
      assert.equal(await evaluate('document.body.textContent.includes("CAUSA_FUTURA")'), true);
      assert.equal(await evaluate('document.body.textContent.includes("secreto_sintetico_no_mostrar")'), false);
    });
    await t.test('Detalle con 100 referencias y texto largo: responsive, tablas desplazables y foco visible', async () => {
      const grande = { ...detalle(30), responsable: { ...identidad, nombreUsuario: 'nombre_historico_extenso_'.repeat(3) },
        referencias: Array.from({ length: 100 }, (_, i) => ({ tipo: 'MOVIMIENTO', id: i + 1 })) };
      nextResponse = { body: { data: grande } }; await navigate('/bitacora/30'); await ready();
      assert.equal(await evaluate('document.querySelectorAll(".bitacora-referencias li").length'), 100);
      for (const width of [320, 375, 768, 1440]) {
        await viewport(width); assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `Detalle a ${width}px`);
        await evaluate('scrollTo(0,0)'); await settle();
        await screenshot(`bitacora-detalle-${width}.png`);
        await evaluate('document.querySelector(".bitacora-cambios").scrollIntoView({block:"center"})'); await settle();
        await screenshot(`bitacora-cambios-${width}.png`);
      }
      await evaluate('document.querySelector(".bitacora-page button").focus()');
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); await settle();
      assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'), 'Valores antes y después');
      assert.equal(await evaluate('getComputedStyle(document.activeElement).outlineStyle'), 'solid');
      assert.ok(detalles().every(r => Object.keys(r.query).length === 0)); assert.ok(requests.every(r => r.method === 'GET'));
      assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
    });
    t.diagnostic(`${consultas().length} consultas de listado y ${detalles().length} de detalle interceptadas; API simulada, sin MySQL ni escrituras de negocio.`);
  } finally {
    try { if (send) await send('Browser.close'); } catch { /* Chrome puede cerrar antes de responder. */ }
    socket?.close(); browser?.kill(); vite.kill();
    await new Promise(resolve => setTimeout(resolve, 150)); await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
