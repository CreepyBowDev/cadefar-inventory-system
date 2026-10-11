// Node >= 22 y Chrome/Edge. API simulada: no conecta con MySQL ni envía correos.
// Ejecutar con --test-concurrency=1 junto con las demás suites de navegador.
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
const waitUntil = async (predicate) => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error('Tiempo agotado esperando la navegación');
};

test('Estructura interna: alineación, roles y menú móvil con API simulada', { timeout: 90000 }, async (t) => {
  assert.ok(browserPath, 'Instala Chrome/Edge o configura CADEFAR_TEST_BROWSER');
  const tempRoot = process.platform === 'win32' ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : tmpdir();
  const profile = await mkdtemp(join(tempRoot, 'cadefar-shell-'));
  const origin = 'http://127.0.0.1:5183';
  const vite = spawn(process.execPath, ['--input-type=module', '--eval', `import { build, preview } from 'vite'; const outDir=${JSON.stringify(join(profile, 'app'))}; await build({logLevel:'warn',build:{outDir,emptyOutDir:true}}); const server=await preview({build:{outDir},preview:{host:'127.0.0.1',port:5183,strictPort:true}}); server.printUrls();`], {
    cwd: root, env: { ...process.env, VITE_API_URL: `${origin}/api` }, stdio: ['ignore', 'pipe', 'pipe']
  });
  let browser, socket, send;
  let role = 1;
  const errors = [], unexpected = [], requests = [];
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Vite no inició en 5183')), 15000);
      vite.stdout.on('data', (chunk) => {
        if (chunk.toString().replace(/\x1b\[[0-9;]*m/g, '').includes('127.0.0.1:5183')) { clearTimeout(timer); resolve(); }
      });
      vite.once('error', reject);
      vite.once('exit', () => reject(new Error('Vite finalizó antes de iniciar')));
    });
    browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
    let port;
    await waitUntil(async () => {
      try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; return true; }
      catch { return false; }
    });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    let sequence = 0;
    const pending = new Map();
    send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Chrome no respondió: ${method}`)); }, 10000);
      pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
      socket.send(JSON.stringify({ id, method, params }));
    });
    socket.addEventListener('close', () => { for (const item of pending.values()) item.reject(new Error('Chrome cerró')); pending.clear(); });
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const item = pending.get(message.id); pending.delete(message.id);
        if (message.error) item?.reject(new Error(message.error.message)); else item?.resolve(message.result);
      } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
      else if (message.method === 'Fetch.requestPaused') {
        const { requestId, request } = message.params;
        const path = new URL(request.url).pathname;
        requests.push({ path, method: request.method });
        let status = 200, body;
        if (path === '/api/auth/me' && request.method === 'GET') {
          status = role ? 200 : 401;
          body = role ? { data: { idUsuario: role, idRol: role, nombreUsuario: 'usuario_con_nombre_largo_cadefar' } } : { message: 'No autenticado' };
        } else if (path === '/api/auth/logout' && request.method === 'POST') {
          role = 0; body = { message: 'Sesión cerrada correctamente' };
        } else if (['/api/inventario', '/api/inventario/vencidos'].includes(path) && request.method === 'GET') {
          body = { data: [], meta: { fechaComercial: '2026-10-11', zonaHoraria: 'America/La_Paz' } };
        } else { unexpected.push(path); status = 404; body = { message: 'Endpoint inesperado' }; }
        void send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') }).catch((error) => errors.push(error.message));
      }
    });
    await send('Page.enable'); await send('Runtime.enable'); await send('Page.bringToFront');
    await send('Fetch.enable', { patterns: [{ urlPattern: `${origin}/api/*` }] });
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const waitFor = (expression) => waitUntil(async () => {
      try { return await evaluate(expression); } catch { return false; }
    });
    const render = () => evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
    const navigate = async (path, selector = '.dashboard-page') => {
      await evaluate('window.navigating = true'); await send('Page.navigate', { url: `${origin}${path}` });
      await waitFor(`!window.navigating && !!document.querySelector(${JSON.stringify(selector)})`);
      await render();
    };
    const viewport = async (width) => {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 620 });
      await render();
    };
    const key = async (key, code, modifiers = 0) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code, modifiers, ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code, modifiers });
      await render();
    };
    const openMenu = async () => {
      await evaluate('document.querySelector(".app-header__menu-button").focus()');
      await key('Enter', 13);
      try {
        await waitFor('document.activeElement.matches(".app-sidebar__close") && document.querySelector(".app-sidebar").getAttribute("aria-modal") === "true" && Math.abs(document.querySelector(".app-sidebar").getBoundingClientRect().left) < 1');
      } catch (error) {
        t.diagnostic(JSON.stringify(await evaluate('({focus:document.activeElement.className, sidebar:document.querySelector(".app-sidebar")?.className, width:innerWidth})')));
        t.diagnostic(JSON.stringify(errors));
        throw error;
      }
    };
    const screenshot = async (name) => {
      if (!process.env.CADEFAR_SCREENSHOT_DIR) return;
      await mkdir(process.env.CADEFAR_SCREENSHOT_DIR, { recursive: true });
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await writeFile(join(process.env.CADEFAR_SCREENSHOT_DIR, name), Buffer.from(data, 'base64'));
    };

    await t.test('Los tres roles conservan accesos operativos y pendientes legibles; nombres largos no se superponen', async () => {
      const expected = [
        ['/dashboard', '/usuarios', '/proveedores', '/medicamentos', '/principios-activos', '/compras', '/inventario', '/vencimientos'],
        ['/dashboard', '/proveedores', '/medicamentos', '/principios-activos', '/compras', '/inventario', '/vencimientos'],
        ['/dashboard', '/medicamentos', '/inventario']
      ];
      for (role of [1, 2, 3]) {
        await viewport(1366); await navigate('/dashboard');
        assert.deepEqual(await evaluate('[...document.querySelectorAll(".app-sidebar__navigation a")].map(a => a.getAttribute("href"))'), expected[role - 1]);
        assert.deepEqual(await evaluate('[...document.querySelectorAll(".dashboard-module-list a")].map(a => a.getAttribute("href"))'), expected[role - 1].slice(1));
        assert.equal(await evaluate('document.querySelectorAll(".app-sidebar__account-data strong").length'), 1);
        assert.equal(await evaluate('!!document.querySelector(".app-header__user-data")'), false);
        assert.deepEqual(await evaluate('[...document.querySelectorAll(".dashboard-pending h3")].map(e => e.textContent)'), role === 1 ? [] : [role === 2 ? 'Recetas' : 'Ventas']);
        assert.equal(await evaluate('document.querySelectorAll(".dashboard-pending a, .dashboard-pending button, .dashboard-pending [tabindex]").length'), 0);
        for (const width of [320, 375, 768, 1024, 1366, 1920]) {
          await viewport(width);
          assert.equal(await evaluate(`(() => {
            const title = document.getElementById('dashboard-title'), date = document.querySelector('.dashboard-welcome__date');
            const a = title.getBoundingClientRect(), b = date.getBoundingClientRect();
            return title.textContent.includes('usuario_con_nombre_largo_cadefar') && title.scrollWidth <= title.clientWidth &&
              (a.right <= b.left || a.bottom <= b.top || b.right <= a.left || b.bottom <= a.top) &&
              document.documentElement.scrollWidth <= innerWidth;
          })()`), true, `Bienvenida sin superposición a ${width}px, rol ${role}`);
          assert.equal(await evaluate('[...document.querySelectorAll(".dashboard-module__status")].every(e => getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().right <= innerWidth)'), true);
          await screenshot(`dashboard-rol-${role}-${width}.png`);
        }
        await viewport(1366);
        await evaluate(`document.querySelector('.dashboard-module[href="/inventario"]').focus()`);
        await key('Tab', 9, 8); await key('Tab', 9);
        assert.equal(await evaluate('getComputedStyle(document.activeElement).outlineStyle'), 'solid');
        await key('Enter', 13);
        await waitFor('location.pathname === "/inventario" && !!document.querySelector(".inventario-page")');
      }
    });

    await t.test('Logo/cabecera comparten altura y cabecera/contenido comparten ambos ejes en escritorio', async () => {
      role = 1; await navigate('/dashboard');
      for (const width of [1024, 1366, 1920, 2560]) {
        await viewport(width);
        const dimensions = await evaluate(`(() => {
          const rect = s => document.querySelector(s).getBoundingClientRect();
          const brand = rect('.app-sidebar__brand'), header = rect('.app-header'), inner = rect('.app-header__inner'), content = rect('.main-content__inner');
          return {sidebar:rect('.app-sidebar').width,brand:brand.bottom,header:header.bottom,left:inner.left-content.left,right:inner.right-content.right,overflow:document.documentElement.scrollWidth>innerWidth};
        })()`);
        assert.equal(dimensions.sidebar, 256); assert.equal(dimensions.brand, dimensions.header);
        assert.ok(Math.abs(dimensions.left) < 1 && Math.abs(dimensions.right) < 1);
        assert.equal(dimensions.overflow, false);
        await screenshot(`shell-escritorio-${width}.png`);
      }
    });

    await t.test('Menú móvil: apertura por teclado, foco contenido, Escape y fondo inerte a 320/375/768/960px', async () => {
      for (role of [1, 2, 3]) {
        await navigate('/dashboard');
        for (const width of [320, 375, 768, 960]) {
          await viewport(width);
          assert.equal(await evaluate('document.querySelector(".app-sidebar").inert'), true);
          await openMenu();
          assert.equal(await evaluate('document.querySelector(".main-content").inert && document.querySelector(".app-header").inert && document.body.style.overflow === "hidden"'), true);
          assert.equal(await evaluate('document.querySelector(".app-header__menu-button").getAttribute("aria-expanded")'), 'true');
          await key('Tab', 9, 8);
          assert.equal(await evaluate('document.activeElement.matches(".app-sidebar__logout")'), true);
          await key('Tab', 9);
          assert.equal(await evaluate('document.activeElement.matches(".app-sidebar__close")'), true);
          await screenshot(`shell-menu-rol-${role}-${width}.png`);
          await key('Escape', 27);
          assert.equal(await evaluate('document.activeElement.matches(".app-header__menu-button") && document.querySelector(".app-sidebar").inert && !document.querySelector(".main-content").inert && document.body.style.overflow !== "hidden"'), true);
          assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
        }
      }
    });

    await t.test('Cerrar por fondo o enlace devuelve el foco; navegación marca la vista actual', async () => {
      await viewport(375); role = 2; await navigate('/dashboard');
      await openMenu(); await evaluate('document.querySelector(".sidebar-backdrop").click()'); await render();
      assert.equal(await evaluate('document.activeElement.matches(".app-header__menu-button")'), true);
      await openMenu(); await evaluate(`document.querySelector('.app-sidebar a[href="/inventario"]').click()`);
      await waitFor('!!document.querySelector(".inventario-page") && document.querySelector(".app-sidebar").inert');
      assert.equal(await evaluate(`document.querySelector('.app-sidebar a[href="/inventario"]').getAttribute('aria-current')`), 'page');
      await screenshot('shell-inventario-375.png');
      await navigate('/vencimientos/vencidos', '.inventario-page');
      assert.equal(await evaluate('document.querySelector(".app-header h1").title'), 'Vencidos pendientes de retiro');
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    });

    await t.test('Cambiar de móvil a escritorio libera el fondo y permite volver a abrir el menú', async () => {
      await openMenu(); await viewport(1024);
      await waitFor('!document.querySelector(".app-sidebar").inert && document.body.style.overflow !== "hidden"');
      assert.equal(await evaluate('document.querySelector(".app-sidebar").hasAttribute("aria-modal")'), false);
      await viewport(375); assert.equal(await evaluate('document.querySelector(".app-sidebar").inert'), true);
      await openMenu(); await key('Escape', 27);
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".app-sidebar")).transitionDuration'), '0s');
      await send('Emulation.setEmulatedMedia', { features: [] });
    });

    await t.test('Cambiar contraseña y cerrar sesión siguen disponibles para los tres roles', async () => {
      for (const currentRole of [1, 2, 3]) {
        role = currentRole; await viewport(1366); await navigate('/dashboard');
        await evaluate(`document.querySelector('.app-header [aria-label="Cambiar mi contraseña"]').click()`);
        await waitFor('!!document.querySelector(".password-form")');
        assert.equal(await evaluate('document.querySelector(".password-form input[type=password]").required'), true);
        await evaluate(`document.querySelector('.modal [aria-label="Cerrar ventana"]').click()`); await render();
        if (currentRole === 3) { await viewport(375); await openMenu(); }
        const button = currentRole === 3 ? '.app-sidebar__logout' : '.app-header [aria-label="Cerrar sesión"]';
        const count = requests.filter((r) => r.path === '/api/auth/logout').length;
        await evaluate(`document.querySelector(${JSON.stringify(button)}).click()`);
        await waitFor('location.pathname === "/login" && !!document.querySelector(".login-page")');
        assert.equal(requests.filter((r) => r.path === '/api/auth/logout').length, count + 1);
        assert.equal(await evaluate('document.body.style.overflow === "hidden"'), false);
      }
      assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
      assert.ok(requests.every((r) => r.method === 'GET' || r.path === '/api/auth/logout'));
    });
  } finally {
    if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch { /* Chrome puede cerrar primero. */ } socket.close(); }
    browser?.kill(); vite.kill();
    await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }).catch(() => {});
  }
});
