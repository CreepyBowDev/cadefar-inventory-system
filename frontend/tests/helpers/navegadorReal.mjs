import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export const esperar = async (predicate, description, timeout = 20000) => {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    const result = await predicate();
    if (result) return result;
    await delay(25);
  }
  throw new Error(`Tiempo agotado: ${description}`);
};

// CDP controla sesiones independientes. Las peticiones llegan al Express real.
// La única intercepción disponible descarta una respuesta POST ya confirmada;
// no fabrica DTOs, cookies, estados HTTP ni datos de la API.
export const abrirNavegadorReal = async ({ profile, origin, apiUrl }) => {
  const executable = process.env.CADEFAR_TEST_BROWSER || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ].find(existsSync);
  assert.ok(executable, 'Instalar Chrome/Edge o configurar CADEFAR_TEST_BROWSER');
  const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let socket, send;
  try {
    const [port, path] = await esperar(async () => {
      try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split('\n'); }
      catch { return null; }
    }, 'iniciar Chrome');
    socket = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let sequence = 0;
    const pending = new Map(), sessions = new Map(), requests = [], errors = [];
    send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP no respondió: ${method}`)); }, 20000);
      pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    socket.addEventListener('close', () => { for (const item of pending.values()) item.reject(new Error('Chrome cerró')); pending.clear(); });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const item = pending.get(message.id); pending.delete(message.id);
        if (message.error) item?.reject(new Error(message.error.message)); else item?.resolve(message.result);
        return;
      }
      const session = sessions.get(message.sessionId);
      if (!session) return;
      const { method, params } = message;
      if (method === 'Runtime.exceptionThrown') errors.push({ session: session.name, exception: params.exceptionDetails.text });
      if (method === 'Network.requestWillBeSent' && params.request.url.startsWith(`${apiUrl}/`)) {
        const request = { session: session.name, id: params.requestId, method: params.request.method, path: new URL(params.request.url).pathname };
        // Nunca retener contraseñas de login ni headers/cookies en el registro.
        if (params.request.postData && !request.path.startsWith('/api/auth')) request.body = JSON.parse(params.request.postData);
        session.network.set(params.requestId, request); requests.push(request);
      }
      if (method === 'Network.responseReceived') {
        const request = session.network.get(params.requestId);
        if (request) request.status = params.response.status;
      }
      if (method === 'Network.loadingFinished') {
        const request = session.network.get(params.requestId);
        if (request) void send('Network.getResponseBody', { requestId: params.requestId }, message.sessionId).then(({ body, base64Encoded }) => {
          request.response = JSON.parse(base64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body);
        }).catch(() => { request.bodyUnavailable = true; });
      }
      if (method === 'Fetch.requestPaused') void (async () => {
        if (session.dropPath && params.request.method === 'POST' && new URL(params.request.url).pathname === session.dropPath && [200, 201].includes(params.responseStatusCode)) {
          const { body, base64Encoded } = await send('Fetch.getResponseBody', { requestId: params.requestId }, message.sessionId);
          const response = JSON.parse(base64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body);
          const request = session.network.get(params.networkId);
          assert.ok(request, 'La respuesta perdida corresponde a un POST real observado');
          Object.assign(request, { status: params.responseStatusCode, response, dropped: true });
          session.dropPath = null;
          await send('Fetch.failRequest', { requestId: params.requestId, errorReason: 'ConnectionReset' }, message.sessionId);
          await send('Fetch.disable', {}, message.sessionId);
        } else await send('Fetch.continueResponse', { requestId: params.requestId }, message.sessionId);
      })().catch((error) => errors.push({ session: session.name, interception: error.message }));
    });
    const openSession = async (name, contextId) => {
      const browserContextId = contextId || (await send('Target.createBrowserContext')).browserContextId;
      const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const session = { name, browserContextId, network: new Map(), dropPath: null };
      sessions.set(sessionId, session);
      await send('Page.enable', {}, sessionId); await send('Runtime.enable', {}, sessionId); await send('Network.enable', {}, sessionId);
      const evaluate = async (expression) => {
        const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
        assert.ok(!result.exceptionDetails, result.exceptionDetails?.text);
        return result.result.value;
      };
      const wait = (expression) => esperar(async () => evaluate(expression), `${name}: ${expression}`);
      const settle = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      return {
        name, browserContextId, evaluate, wait, settle,
        navigate: async (path) => {
          await evaluate('window.__navigating = true');
          await send('Page.navigate', { url: `${origin}${path}` }, sessionId);
          await wait('!window.__navigating && document.readyState === "complete"'); await settle();
        },
        ready: () => wait('!!document.querySelector(".inventario-page, .compras-page") && document.querySelector("[aria-busy]")?.getAttribute("aria-busy") === "false"'),
        contains: (text) => wait(`document.body.textContent.includes(${JSON.stringify(text)})`),
        click: (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`),
        clickText: (text) => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!b) throw new Error('Botón no encontrado'); b.click(); })()`),
        field: async (selector, value) => {
          await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); const type = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement; Object.getOwnPropertyDescriptor(type.prototype, 'value').set.call(el, ${JSON.stringify(String(value))}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`); await settle();
        },
        select: async (selector, value) => { await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value=${JSON.stringify(String(value))}; el.dispatchEvent(new Event('change',{bubbles:true})); })()`); await settle(); },
        review: async (selector) => { await evaluate(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`); await wait('!!document.querySelector("[role=dialog]")'); },
        request: async (method, path, body) => evaluate(`(async () => { const response = await fetch(${JSON.stringify(`${apiUrl}${path}`)}, {method:${JSON.stringify(method)},credentials:'include',${body === undefined ? '' : `headers:{'Content-Type':'application/json'},body:${JSON.stringify(JSON.stringify(body))},`} }); return {status:response.status,body:await response.json()}; })()`),
        dropNextPost: async (path) => { session.dropPath = path; await send('Fetch.enable', { patterns: [{ urlPattern: `${apiUrl.replace(/\/api$/, '')}${path}`, requestStage: 'Response' }] }, sessionId); },
        cookies: async () => (await send('Storage.getCookies', { browserContextId })).cookies,
        mobile: () => send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true }, sessionId),
        screenshot: async (name) => {
          if (!process.env.CADEFAR_SCREENSHOT_DIR) return;
          const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
          await writeFile(join(process.env.CADEFAR_SCREENSHOT_DIR, name), Buffer.from(data, 'base64'));
        }
      };
    };
    return { requests, errors, openSession, close: async () => { try { await send('Browser.close'); } catch { /* Chrome puede cerrar primero. */ } socket.close(); browser.kill(); } };
  } catch (error) { socket?.close(); browser.kill(); throw error; }
};
