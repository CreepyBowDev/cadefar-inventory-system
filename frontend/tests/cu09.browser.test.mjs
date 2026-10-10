// Sin dependencias de pruebas: Node >= 22, Chrome/Edge y Vite del proyecto.
// Ejecutar: node --test tests/cu09.browser.test.mjs
// Todas las peticiones /api/ se interceptan; no usa MySQL ni envía correos.
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
const genericMessage = 'Si el correo corresponde a una cuenta habilitada, recibirás un código de recuperación';
const invalidMessage = 'El código de recuperación no es válido o ha vencido';
const testPassword = 'Prueba-Segura9!';

const waitUntil = async (predicate) => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const result = await predicate();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error('Tiempo agotado esperando el navegador de pruebas');
};

test('CU09 y correo de Usuarios: integración en navegador, con API simulada', { timeout: 90000 }, async (t) => {
  assert.ok(browserPath, 'Instala Chrome/Edge o indica CADEFAR_TEST_BROWSER');
  const tempRoot = process.platform === 'win32'
    ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : tmpdir();
  const profile = await mkdtemp(join(tempRoot, 'cadefar-cu09-'));
  const vite = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5176', '--strictPort'], {
    cwd: root,
    env: { ...process.env, VITE_API_URL: 'http://127.0.0.1:5176/api' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let browser;
  let socket;
  let send;
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Vite no anunció el puerto 5176')), 15000);
      vite.stdout.on('data', (chunk) => {
        if (chunk.toString().replace(/\x1b\[[0-9;]*m/g, '').includes('127.0.0.1:5176')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      vite.once('error', reject);
      vite.once('exit', () => reject(new Error('No se pudo iniciar Vite en el puerto de pruebas 5176')));
    });
    t.diagnostic('Vite de pruebas iniciado');
    browser = spawn(browserPath, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--remote-debugging-port=0',
      `--user-data-dir=${profile}`, 'about:blank'
    ], { stdio: 'ignore' });
    const port = await waitUntil(async () => {
      try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; }
      catch { return null; }
    });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    t.diagnostic('Chrome headless iniciado');
    socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    let nextId = 0;
    const pending = new Map();
    const requests = [];
    let nextResponse = null;
    let usuarioError = null;
    let heldRequest = null;
    const usuarios = [{
      idUsuario: 2, nombreUsuario: 'cu08-prueba', idRol: 3,
      correo: 'registrado+prueba@example.invalid', estado: true,
      rol: { idRol: 3, nombre: 'Vendedor' }
    }];
    const response = (requestId, status, data) => send('Fetch.fulfillRequest', {
      requestId, responseCode: status,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      body: Buffer.from(JSON.stringify(data)).toString('base64')
    });
    send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Chrome no respondió a ${method}`));
      }, 10000);
      pending.set(id, {
        resolve: (value) => { clearTimeout(timeout); resolve(value); },
        reject: (error) => { clearTimeout(timeout); reject(error); }
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
    socket.addEventListener('close', () => {
      for (const request of pending.values()) request.reject(new Error('Chrome cerró la conexión'));
      pending.clear();
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const request = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) request?.reject(new Error(message.error.message));
        else request?.resolve(message.result);
      } else if (message.method === 'Fetch.requestPaused') {
        const { requestId, request } = message.params;
        const path = new URL(request.url).pathname;
        requests.push({ path, method: request.method, body: request.postData ? JSON.parse(request.postData) : null });
        if (path === '/api/auth/me') {
          void response(requestId, 401, { message: 'No autenticado' });
        } else if (nextResponse && path.includes('/recuperacion/')) {
          const planned = nextResponse;
          nextResponse = null;
          if (planned.hold) heldRequest = requestId;
          else if (planned.networkError) void send('Fetch.failRequest', { requestId, errorReason: 'ConnectionRefused' });
          else void response(requestId, planned.status, { message: planned.message });
        } else if (path === '/api/auth/recuperacion/solicitar') {
          void response(requestId, 200, { message: genericMessage });
        } else if (path === '/api/auth/recuperacion/restablecer') {
          void response(requestId, 200, { message: 'Contraseña restablecida exitosamente' });
        } else if (path === '/api/auth/login') {
          void response(requestId, 200, { data: { idUsuario: 1, nombreUsuario: 'cu09-prueba', idRol: 1 } });
        } else if (path === '/api/usuarios' && request.method === 'GET') {
          void response(requestId, 200, { data: usuarios });
        } else if (/^\/api\/usuarios\/\d+$/.test(path) && request.method === 'GET') {
          void response(requestId, 200, { data: usuarios.find((usuario) => usuario.idUsuario === Number(path.split('/').at(-1))) });
        } else if ((path === '/api/usuarios' && request.method === 'POST') ||
            (/^\/api\/usuarios\/\d+$/.test(path) && request.method === 'PATCH')) {
          if (usuarioError) {
            void response(requestId, usuarioError.status, { message: usuarioError.message });
            usuarioError = null;
          } else {
            const { password, ...data } = JSON.parse(request.postData);
            if (request.method === 'POST') {
              const usuario = { ...data, idUsuario: usuarios.length + 2, estado: true, rol: { idRol: data.idRol, nombre: 'Vendedor' } };
              usuarios.push(usuario);
              void response(requestId, 201, { data: usuario });
            } else {
              const usuario = usuarios.find((item) => item.idUsuario === Number(path.split('/').at(-1)));
              Object.assign(usuario, data);
              void response(requestId, 200, { data: usuario });
            }
          }
        } else {
          void response(requestId, 200, { data: [], message: 'Operación completada' });
        }
      }
    });
    await send('Page.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*://127.0.0.1:5176/api/*' }] });
    t.diagnostic('Intercepción de API activada');
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      assert.ok(!result.exceptionDetails, 'La interacción con la interfaz debe completarse');
      return result.result.value;
    };
    const waitFor = (expression) => waitUntil(async () => {
      try { return await evaluate(expression); }
      catch { return false; } // El contexto anterior desaparece durante una navegación.
    });
    const navigate = async (url) => {
      await evaluate('window.__testNavigating = true');
      await send('Page.navigate', { url });
      await waitFor('!window.__testNavigating && document.readyState === "complete"');
    };
    const input = (id, value) => evaluate(`(() => {
      const field = document.getElementById(${JSON.stringify(id)});
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(value)});
      field.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    const submit = () => evaluate('document.querySelector("form").requestSubmit()');
    const alertContains = (text) => waitFor(`document.querySelector('form')?.getAttribute('aria-busy') !== 'true' && document.querySelector('[role="alert"]')?.textContent.includes(${JSON.stringify(text)})`);
    const recoveryRequests = () => requests.filter((request) => request.path.includes('/recuperacion/'));
    const usuarioWrites = () => requests.filter((request) =>
      (request.path === '/api/usuarios' && request.method === 'POST') ||
      (/^\/api\/usuarios\/\d+$/.test(request.path) && request.method === 'PATCH'));
    const openCreateUsuario = async (nombreUsuario) => {
      await evaluate(`document.querySelector('a[href="/usuarios/nuevo"]').click()`);
      await waitFor('!!document.getElementById("correo")');
      await input('nombreUsuario', nombreUsuario);
      await evaluate(`(() => {
        const select = document.getElementById('idRol');
        select.value = '3';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      await input('password', testPassword);
      await input('confirmPassword', testPassword);
    };
    const openEditUsuario = async () => {
      await evaluate(`document.querySelector('a[href="/usuarios/2/editar"]').click()`);
      await waitFor('document.getElementById("nombreUsuario")?.value === "cu08-prueba" && document.getElementById("idRol")?.value === "3"');
    };
    await navigate('http://127.0.0.1:5176/login');
    await waitFor('!!document.getElementById("nombreUsuario")');

    await t.test('Login muestra el enlace y navega a la ruta pública', async () => {
      assert.equal(await evaluate('document.querySelector("a.auth-form-link").textContent.trim()'), '¿Olvidaste tu contraseña?');
      await evaluate('document.querySelector("a.auth-form-link").click()');
      await waitFor('!!document.getElementById("recovery-correo")');
      assert.equal(await evaluate('location.pathname'), '/recuperar-contrasena');
      assert.equal(await evaluate('!!document.querySelector(".app-header")'), false);
    });
    await t.test('Acceso directo y recarga sin sesión', async () => {
      await navigate('http://127.0.0.1:5176/recuperar-contrasena');
      await waitFor('!!document.getElementById("recovery-correo")');
      await evaluate('window.__testNavigating = true');
      await send('Page.reload');
      await waitFor('!window.__testNavigating && document.readyState === "complete"');
      await waitFor('!!document.getElementById("recovery-correo")');
      assert.equal(await evaluate('location.pathname'), '/recuperar-contrasena');
    });
    await t.test('Correo inválido no solicita a la API', async () => {
      const count = recoveryRequests().length;
      await input('recovery-correo', 'correo-invalido');
      await submit();
      await alertContains('correo electrónico válido');
      assert.equal(recoveryRequests().length, count);
    });
    await t.test('Errores de conexión, cuota y disponibilidad conservan el paso inicial', async () => {
      await input('recovery-correo', 'persona@example.invalid');
      for (const planned of [
        { networkError: true, expected: 'No se pudo conectar' },
        { status: 429, message: 'Demasiadas solicitudes. Intenta nuevamente más tarde', expected: 'Demasiadas solicitudes' },
        { status: 503, message: 'La recuperación de contraseña no está disponible', expected: 'no está disponible' },
        { status: 400, message: 'Datos de recuperación inválidos', expected: 'Datos de recuperación inválidos' },
        { status: 500, message: 'Detalle interno que nunca debe mostrarse', expected: 'No fue posible completar' }
      ]) {
        nextResponse = planned;
        await submit();
        await alertContains(planned.expected);
        assert.ok(await evaluate('!!document.getElementById("recovery-correo")'));
        assert.equal(await evaluate('document.body.textContent.includes("Detalle interno")'), false);
      }
    });
    await t.test('Solicitud normalizada, carga, bloqueo de duplicados y mensaje genérico', async () => {
      await input('recovery-correo', ' Persona.Cadefar+prueba@Example.Invalid ');
      const count = recoveryRequests().length;
      nextResponse = { hold: true };
      await submit();
      await waitUntil(() => heldRequest);
      await waitFor('document.querySelector("form").getAttribute("aria-busy") === "true"');
      assert.ok(await evaluate('document.querySelector("button[type=submit]").disabled'));
      await submit();
      assert.equal(recoveryRequests().length, count + 1);
      const request = recoveryRequests().at(-1);
      assert.equal(request.path, '/api/auth/recuperacion/solicitar');
      assert.equal(request.method, 'POST');
      assert.deepEqual(Object.keys(request.body), ['correo']);
      assert.equal(request.body.correo, 'persona.cadefar+prueba@example.invalid');
      await response(heldRequest, 200, { message: genericMessage });
      heldRequest = null;
      await waitFor('!!document.getElementById("recovery-codigo")');
      assert.ok(await evaluate(`document.body.textContent.includes(${JSON.stringify(genericMessage)})`));
      assert.equal(await evaluate('document.activeElement.id'), 'recovery-codigo');
    });
    await t.test('Código textual: exactamente seis dígitos y ceros iniciales', async () => {
      await input('recovery-codigo', '000123');
      await input('recovery-codigo', '00012x');
      assert.ok(await evaluate('document.getElementById("recovery-codigo").value === "000123"'));
      await input('recovery-codigo', '123');
      const count = recoveryRequests().length;
      await submit();
      await alertContains('seis dígitos');
      assert.equal(recoveryRequests().length, count);
      await input('recovery-codigo', '000123');
    });
    await t.test('Política de complejidad, 100 caracteres y 72 bytes UTF-8', async () => {
      for (const password of ['A1!a', 'sinmayuscula9!', 'SINMINUSCULA9!', 'SinNumero!!', 'SinEspecial99', 'A1!' + 'a'.repeat(98), 'Á1!a' + 'é'.repeat(35)]) {
        const count = recoveryRequests().length;
        await input('recovery-password', password);
        await input('recovery-confirm-password', password);
        await submit();
        await alertContains('contraseña');
        assert.equal(recoveryRequests().length, count);
      }
      await alertContains('72 bytes');
      await input('recovery-password', testPassword);
      await input('recovery-confirm-password', testPassword + 'x');
      await submit();
      await alertContains('confirmación no coincide');
      await input('recovery-confirm-password', testPassword);
    });
    await t.test('Mostrar/ocultar funciona independientemente en ambas contraseñas', async () => {
      for (const id of ['recovery-password', 'recovery-confirm-password']) {
        await evaluate(`document.getElementById(${JSON.stringify(id)}).focus()`);
        await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'), 'Mostrar contraseña');
        await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
        assert.equal(await evaluate(`document.getElementById(${JSON.stringify(id)}).type`), 'text');
        await evaluate(`document.getElementById(${JSON.stringify(id)}).parentElement.querySelector('button').click()`);
        assert.equal(await evaluate(`document.getElementById(${JSON.stringify(id)}).type`), 'password');
      }
    });
    await t.test('Código inválido/vencido/usado y límite de intentos conservan el error genérico', async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        nextResponse = { status: 400, message: invalidMessage };
        await submit();
        await alertContains(invalidMessage);
        assert.ok(await evaluate('!!document.getElementById("recovery-codigo")'));
      }
      for (const planned of [
        { networkError: true, expected: 'No se pudo conectar' },
        { status: 429, message: 'Demasiadas solicitudes. Intenta nuevamente más tarde', expected: 'Demasiadas solicitudes' },
        { status: 503, message: 'La recuperación de contraseña no está disponible', expected: 'no está disponible' }
      ]) {
        nextResponse = planned;
        await submit();
        await alertContains(planned.expected);
      }
    });
    await t.test('Solicitar otro código limpia datos sensibles, requiere envío manual y respeta 429', async () => {
      const count = recoveryRequests().length;
      await evaluate('document.querySelector(".recovery-form__secondary button").click()');
      await waitFor('!!document.getElementById("recovery-correo")');
      assert.equal(recoveryRequests().length, count);
      nextResponse = { status: 429, message: 'Demasiadas solicitudes. Intenta nuevamente más tarde' };
      await submit();
      await alertContains('Demasiadas solicitudes');
      await submit();
      await waitFor('!!document.getElementById("recovery-codigo")');
      assert.ok(await evaluate('["recovery-codigo", "recovery-password", "recovery-confirm-password"].every(id => document.getElementById(id).value === "")'));
    });
    await t.test('Responsive a 360 y 1440 píxeles sin desbordamiento horizontal', async () => {
      for (const width of [360, 1440]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 360 });
        assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
        assert.ok(await evaluate('[...document.querySelectorAll("input")].every(input => input.getBoundingClientRect().width > 0)'));
        if (process.env.CADEFAR_TEST_ARTIFACTS) {
          await mkdir(process.env.CADEFAR_TEST_ARTIFACTS, { recursive: true });
          const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
          const path = join(process.env.CADEFAR_TEST_ARTIFACTS, `cu09-${width}.png`);
          await writeFile(path, Buffer.from(screenshot.data, 'base64'));
          t.diagnostic(`Captura para revisión visual: ${path}`);
        }
      }
    });
    await t.test('Restablecimiento envía el contrato exacto, limpia el formulario y no inicia sesión', async () => {
      await input('recovery-codigo', '000123');
      await input('recovery-password', testPassword);
      await input('recovery-confirm-password', testPassword);
      nextResponse = { hold: true };
      const count = recoveryRequests().length;
      await submit();
      await waitUntil(() => heldRequest);
      await submit();
      assert.equal(recoveryRequests().length, count + 1);
      const request = recoveryRequests().at(-1);
      assert.equal(request.path, '/api/auth/recuperacion/restablecer');
      assert.equal(request.method, 'POST');
      assert.deepEqual(Object.keys(request.body), ['correo', 'codigo', 'passwordNueva']);
      assert.ok(request.body.codigo === '000123' && typeof request.body.codigo === 'string');
      assert.ok(request.body.passwordNueva === testPassword);
      await response(heldRequest, 200, { message: 'Contraseña restablecida exitosamente' });
      heldRequest = null;
      await waitFor('!!document.querySelector(".recovery-success")');
      assert.ok(await evaluate('document.body.textContent.includes("Ya puedes iniciar sesión con tu nueva contraseña")'));
      assert.equal(await evaluate('document.querySelectorAll("input").length'), 0);
      assert.equal(await evaluate('location.pathname'), '/recuperar-contrasena');
      assert.equal(requests.filter((request) => request.path === '/api/auth/login').length, 0);
      assert.ok(await evaluate('localStorage.length === 0 && sessionStorage.length === 0 && !location.search && !location.hash && document.cookie === ""'));
      await evaluate('document.querySelector(".recovery-success a").click()');
      await waitFor('!!document.getElementById("nombreUsuario")');
    });
    await t.test('Login existente conserva campos, body y navegación tras autenticación', async () => {
      await input('nombreUsuario', 'cu09-prueba');
      await input('password', testPassword);
      await submit();
      await waitFor('!!document.querySelector(".app-header")');
      assert.equal(await evaluate('location.pathname'), '/dashboard');
      const request = requests.find((request) => request.path === '/api/auth/login');
      assert.deepEqual(Object.keys(request.body), ['nombreUsuario', 'password']);
      assert.ok(request.body.password === testPassword);
    });
    await t.test('CU08 propio conserva formulario, contraseña actual y endpoint independiente', async () => {
      await evaluate(`document.querySelector('[aria-label="Cambiar mi contraseña"]').click()`);
      await waitFor('!!document.getElementById("ownPasswordActual")');
      const ids = await evaluate('[...document.querySelectorAll(".password-form input")].map(input => input.id)');
      assert.equal(ids.length, 3);
      for (const id of ids) await input(id, testPassword);
      await evaluate('document.querySelector(".password-form").requestSubmit()');
      await waitUntil(() => requests.find((request) => request.path === '/api/usuarios/me/password'));
      const request = requests.find((request) => request.path === '/api/usuarios/me/password');
      assert.equal(request.method, 'PATCH');
      assert.deepEqual(Object.keys(request.body), ['passwordActual', 'passwordNueva']);
      assert.ok(await evaluate('!!document.querySelector(".app-header")'));
      await waitFor('document.querySelector(".password-form").textContent.includes("Tu contraseña fue modificada correctamente")');
      await evaluate('document.querySelector(".password-form .button--secondary").click()');
    });
    await t.test('CU08 administrativo conserva restablecimiento separado', async () => {
      await evaluate(`document.querySelector('.app-sidebar a[href="/usuarios"]').click()`);
      await waitFor('!!document.querySelector(".usuario-table")');
      await evaluate(`document.querySelector('[aria-label="Restablecer contraseña de cu08-prueba"]').click()`);
      await waitFor('!!document.getElementById("resetPassword")');
      await input('resetPassword', testPassword);
      await input('resetPasswordConfirmation', testPassword);
      await evaluate('document.querySelector(".password-form").requestSubmit()');
      await waitUntil(() => requests.find((request) => request.path === '/api/usuarios/2/password'));
      const request = requests.find((request) => request.path === '/api/usuarios/2/password');
      assert.equal(request.method, 'PATCH');
      assert.deepEqual(Object.keys(request.body), ['password']);
      assert.ok(request.body.password === testPassword);
      await waitFor('document.querySelector(".usuarios-page").textContent.includes("fue restablecida")');
    });
    await t.test('Crear usuario valida formato y longitud del correo antes de enviar', async () => {
      await openCreateUsuario('usuario-correo');
      assert.equal(await evaluate('document.getElementById("correo").required'), false);
      assert.equal(await evaluate('document.getElementById("correo").maxLength'), 255);
      const count = usuarioWrites().length;
      await input('correo', 'correo-invalido');
      await submit();
      await alertContains('correo electrónico válido');
      await input('correo', 'a'.repeat(250) + '@example.invalid');
      await submit();
      await alertContains('255 caracteres');
      assert.equal(usuarioWrites().length, count);
    });
    await t.test('Correo duplicado al crear muestra 409 y conserva el formulario', async () => {
      await input('correo', 'registrado+prueba@example.invalid');
      usuarioError = { status: 409, message: 'El correo ya está en uso' };
      await submit();
      await alertContains('El correo ya está en uso');
      assert.equal(await evaluate('location.pathname'), '/usuarios/nuevo');
      assert.ok(await evaluate('document.getElementById("correo").value === "registrado+prueba@example.invalid"'));
    });
    await t.test('Crear envía correo normalizado conservando puntos y +', async () => {
      await input('correo', ' Nuevo.Usuario+prueba@Example.Invalid ');
      await submit();
      await waitFor('!!document.querySelector(".usuario-table")');
      const request = usuarioWrites().at(-1);
      assert.equal(request.method, 'POST');
      assert.deepEqual(Object.keys(request.body).sort(), ['correo', 'idRol', 'nombreUsuario', 'password']);
      assert.equal(request.body.correo, 'nuevo.usuario+prueba@example.invalid');
      assert.ok(request.body.password === testPassword);
    });
    await t.test('Crear sin correo envía null y sigue siendo permitido', async () => {
      await openCreateUsuario('usuario-sin-correo');
      await input('correo', '   ');
      await submit();
      await waitFor('!!document.querySelector(".usuario-table")');
      assert.equal(usuarioWrites().at(-1).body.correo, null);
    });
    await t.test('Editar precarga el correo y omite el campo si no cambia', async () => {
      await openEditUsuario();
      assert.equal(await evaluate('document.getElementById("correo").value'), 'registrado+prueba@example.invalid');
      await input('correo', ' Registrado+prueba@Example.Invalid ');
      await submit();
      await waitFor('!!document.querySelector(".usuario-table")');
      const request = usuarioWrites().at(-1);
      assert.equal(request.path, '/api/usuarios/2');
      assert.equal(request.method, 'PATCH');
      assert.deepEqual(Object.keys(request.body).sort(), ['idRol', 'nombreUsuario']);
      assert.equal(usuarios[0].correo, 'registrado+prueba@example.invalid');
    });
    await t.test('Editar valida correo, muestra duplicados y permite actualizarlo', async () => {
      await openEditUsuario();
      const count = usuarioWrites().length;
      await input('correo', 'invalido');
      await submit();
      await alertContains('correo electrónico válido');
      assert.equal(usuarioWrites().length, count);
      await input('correo', 'nuevo.usuario+prueba@example.invalid');
      usuarioError = { status: 409, message: 'El correo ya está en uso' };
      await submit();
      await alertContains('El correo ya está en uso');
      assert.equal(await evaluate('location.pathname'), '/usuarios/2/editar');
      await input('correo', ' Editado.Usuario+prueba@Example.Invalid ');
      await submit();
      await waitFor('!!document.querySelector(".usuario-table")');
      const request = usuarioWrites().at(-1);
      assert.deepEqual(Object.keys(request.body).sort(), ['correo', 'idRol', 'nombreUsuario']);
      assert.equal(request.body.correo, 'editado.usuario+prueba@example.invalid');
      await openEditUsuario();
      assert.equal(await evaluate('document.getElementById("correo").value'), 'editado.usuario+prueba@example.invalid');
    });
    await t.test('Vaciar el correo en edición envía null; un correo ya vacío se conserva', async () => {
      await input('correo', '');
      await submit();
      await waitFor('!!document.querySelector(".usuario-table")');
      assert.equal(usuarioWrites().at(-1).body.correo, null);
      await openEditUsuario();
      assert.equal(await evaluate('document.getElementById("correo").value'), '');
      await submit();
      await waitFor('!!document.querySelector(".usuario-table")');
      assert.ok(!Object.hasOwn(usuarioWrites().at(-1).body, 'correo'));
      assert.equal(usuarios[0].correo, null);
    });
    await t.test('La ruta privada continúa requiriendo autenticación después de recargar', async () => {
      await navigate('http://127.0.0.1:5176/usuarios');
      await waitFor('!!document.getElementById("nombreUsuario")');
      assert.equal(await evaluate('location.pathname'), '/login');
    });
  } finally {
    if (socket?.readyState === WebSocket.OPEN) {
      try { await send('Browser.close'); } catch { /* El proceso puede cerrar antes de responder. */ }
      socket.close();
    }
    browser?.kill();
    vite.kill();
    await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }).catch(() => {});
  }
});
