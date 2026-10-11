// React compilado y Chrome real, API completamente simulada. Sin MySQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const esperar = async predicate => {
    const fin = Date.now() + 20000;
    while (Date.now() < fin) {
        if (await predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error('Tiempo agotado esperando Medicamentos');
};

test('Medicamentos React: código exclusivo del servidor, edición y consultas', { timeout: 120000 }, async t => {
    const executable = process.env.CADEFAR_TEST_BROWSER || [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    ].find(existsSync);
    assert.ok(executable, 'Configurar CADEFAR_TEST_BROWSER o instalar Chrome/Edge');
    const tempRoot = process.platform === 'win32' ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : tmpdir();
    const profile = await mkdtemp(join(tempRoot, 'cadefar-medicamentos-'));
    const origin = 'http://127.0.0.1:5180';
    const outDir = join(profile, 'app');
    const vite = spawn(process.execPath, ['--input-type=module', '--eval',
        `import {build,preview} from 'vite'; await build({logLevel:'warn',build:{outDir:${JSON.stringify(outDir)},emptyOutDir:true}}); const s=await preview({build:{outDir:${JSON.stringify(outDir)}},preview:{host:'127.0.0.1',port:5180,strictPort:true}}); s.printUrls();`],
    { cwd: root, env: { ...process.env, VITE_API_URL: `${origin}/api` }, stdio: ['ignore', 'pipe', 'pipe'] });
    const requests = [], errors = [], unexpected = [];
    let browser, socket, send, rol = 2, heldPost, nextPost, principiosVacios = false, falloPrincipios = false;
    const principios = [{ idPrincipioActivo: 1, nombre: 'Paracetamol', estado: true },
        { idPrincipioActivo: 2, nombre: 'Cafeína', estado: true }];
    let med = { idMedicamento: 100, codigoMedicamento: 'PAR047', nombreComercial: 'Paracetamol confirmado',
        idProveedorLaboratorio: 1, proveedorLaboratorio: { idProveedorLaboratorio: 1, nombre: 'Laboratorio' },
        formaFarmaceutica: 'Tableta', presentacion: '500 mg', unidadInventario: 'tableta', stockMinimo: 0,
        condicionVenta: 'Libre', viaAdministracion: 'Oral', tipoLiberacion: 'Inmediata', estado: true, composicion: [] };
    try {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Vite no inició en 5180')), 30000);
            vite.stdout.on('data', chunk => { if (chunk.toString().replace(/\x1b\[[0-9;]*m/g, '').includes('127.0.0.1:5180')) { clearTimeout(timeout); resolve(); } });
            vite.once('error', reject);
            vite.once('exit', () => { clearTimeout(timeout); reject(new Error('Vite terminó antes de iniciar')); });
        });
        browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
        let port;
        await esperar(async () => { try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; return port; } catch { return false; } });
        const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
        let sequence = 0;
        const pending = new Map();
        send = (method, params = {}) => new Promise((resolve, reject) => {
            const id = ++sequence;
            const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP: ${method}`)); }, 10000);
            pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: e => { clearTimeout(timer); reject(e); } });
            socket.send(JSON.stringify({ id, method, params }));
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
                const body = request.postData ? JSON.parse(request.postData) : undefined;
                requests.push({ path, method: request.method, body, query: Object.fromEntries(url.searchParams) });
                const finish = (status, data) => { void respond(requestId, status, data).catch(e => errors.push(e.message)); };
                if (path === '/api/auth/me') { finish(200, { data: { idUsuario: rol, idRol: rol, nombreUsuario: 'sintetico' } }); return; }
                if (path === '/api/proveedores-laboratorios') { finish(200, { data: [{ idProveedorLaboratorio: 1, nombre: 'Laboratorio', estado: true }] }); return; }
                if (path === '/api/principios-activos') {
                    if (falloPrincipios) { finish(500, { message: 'No se pudo cargar el catálogo' }); return; }
                    finish(200, { data: principiosVacios ? [] : principios }); return;
                }
                if (path === '/api/medicamentos' && request.method === 'POST') {
                    if (nextPost) { const planned = nextPost; nextPost = null; finish(planned.status, { message: planned.message, errors: planned.errors }); return; }
                    heldPost = { requestId, body }; return;
                }
                if (path === '/api/medicamentos') { finish(200, { data: [med] }); return; }
                if (path === '/api/medicamentos/100' && request.method === 'PATCH') {
                    med = { ...med, ...body }; finish(200, { data: med }); return;
                }
                if (path === '/api/medicamentos/100') { finish(200, { data: med }); return; }
                if (path === '/api/medicamentos/100/composicion') { finish(200, { data: med.composicion }); return; }
                unexpected.push(path); finish(404, { message: 'Endpoint inesperado' });
            }
        });
        await send('Page.enable'); await send('Runtime.enable');
        await send('Fetch.enable', { patterns: [{ urlPattern: `${origin}/api/*` }] });
        const evaluate = async expression => {
            const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
            assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails)); return result.result.value;
        };
        const wait = expression => esperar(async () => evaluate(expression));
        const settle = () => evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const navigate = async path => { await evaluate('window.__navigating=true'); await send('Page.navigate', { url: `${origin}${path}` }); await wait('!window.__navigating && document.readyState === "complete"'); };
        const field = async (name, value) => {
            await evaluate(`(()=>{const el=document.querySelector('[name=${name}]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
            await settle();
        };
        const fill = async () => {
            for (const [name, value] of Object.entries({ nombreComercial: 'Paracetamol', formaFarmaceutica: 'Tableta',
                presentacion: '500 mg', unidadInventario: 'tableta', condicionVenta: 'Libre', viaAdministracion: 'Oral', tipoLiberacion: 'Inmediata' })) await field(name, value);
            await evaluate(`(()=>{const el=document.querySelector('[name=idProveedorLaboratorio]'); el.value='1'; el.dispatchEvent(new Event('change',{bubbles:true}));})()`); await settle();
        };
        const click = async label => { await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`); await settle(); };
        const agregar = async (id = 1, cantidad = '500') => {
            await click('Agregar componente'); await wait('!!document.querySelector("[role=dialog]")');
            await evaluate(`(()=>{const el=document.querySelector('[name=idPrincipioActivo]'); el.value=${JSON.stringify(String(id))}; el.dispatchEvent(new Event('change',{bubbles:true}));})()`); await settle();
            for (const [name, value] of Object.entries({ cantidadPrincipioActivo: cantidad, unidadPrincipioActivo: 'mg', cantidadReferencia: '1', unidadReferencia: 'tableta' })) await field(name, value);
            await click('Agregar principio activo'); await wait('!document.querySelector("[role=dialog]")');
        };
        const submit = async () => { await evaluate('document.querySelector(".catalogo-form").requestSubmit()'); await settle(); };
        const posts = () => requests.filter(r => r.method === 'POST');

        await t.test('Creación sin campo de código ni solicitudes de reserva', async () => {
            await navigate('/medicamentos/nuevo'); await wait('!!document.querySelector(".catalogo-form")');
            assert.equal(await evaluate('!!document.querySelector("[name=codigoMedicamento]")'), false);
            assert.ok(await evaluate('document.body.textContent.includes("se generará automáticamente")'));
            assert.ok(requests.every(r => r.method === 'GET'));
        });
        await t.test('Sin composición no envía; agregar/editar/retirar solo modifica el borrador', async () => {
            await fill(); await submit();
            assert.equal(posts().length, 0);
            assert.ok(await evaluate('document.body.textContent.includes("Agrega al menos un principio activo")'));
            await agregar(); await click('Agregar componente');
            assert.equal(await evaluate('!!document.querySelector("[name=idPrincipioActivo] option[value=\\"1\\"]")'), false);
            await field('cantidadPrincipioActivo', '0.00001'); await field('cantidadReferencia', '1');
            await field('unidadPrincipioActivo', 'mg'); await field('unidadReferencia', 'tableta');
            await click('Agregar principio activo');
            assert.ok(await evaluate('document.querySelector("[role=dialog]").textContent.includes("cuatro decimales")'));
            await evaluate('document.querySelector("[aria-label=\\"Cerrar ventana\\"]").click()'); await settle();
            await agregar(2, '50');
            await evaluate('document.querySelector("[aria-label=\\"Editar composición de Cafeína\\"]").click()'); await settle();
            await field('cantidadPrincipioActivo', '25'); await click('Guardar cambios');
            assert.ok(await evaluate('document.querySelector(".composicion-table").textContent.includes("25 mg")'));
            await evaluate('document.querySelector("[aria-label=\\"Retirar Cafeína\\"]").click()'); await settle();
            assert.equal(await evaluate('document.querySelectorAll(".composicion-table tbody tr").length'), 1);
            assert.equal(posts().length, 0);
        });
        await t.test('POST exacto sin código; resultado solo después de confirmar y doble envío bloqueado', async () => {
            await agregar(2, '50'); await submit(); await esperar(() => heldPost);
            assert.deepEqual(heldPost.body, { nombreComercial: 'Paracetamol', formaFarmaceutica: 'Tableta', presentacion: '500 mg',
                unidadInventario: 'tableta', condicionVenta: 'Libre', viaAdministracion: 'Oral', tipoLiberacion: 'Inmediata', stockMinimo: 0, idProveedorLaboratorio: 1,
                composicion: [{ idPrincipioActivo: 1, cantidadPrincipioActivo: 500, unidadPrincipioActivo: 'mg', cantidadReferencia: 1, unidadReferencia: 'tableta' },
                    { idPrincipioActivo: 2, cantidadPrincipioActivo: 50, unidadPrincipioActivo: 'mg', cantidadReferencia: 1, unidadReferencia: 'tableta' }] });
            assert.equal(await evaluate('location.pathname'), '/medicamentos/nuevo');
            assert.ok(await evaluate('document.querySelector("button[type=submit]").disabled'));
            await submit(); assert.equal(posts().length, 1);
            med.composicion = heldPost.body.composicion.map((c, i) => ({ ...c, idComposicion: i + 1,
                idMedicamento: 100, principioActivo: principios.find(p => p.idPrincipioActivo === c.idPrincipioActivo) }));
            await respond(heldPost.requestId, 201, { data: med }); heldPost = null;
            await wait('location.pathname === "/medicamentos/100" && !!document.querySelector(".catalogo-detail")');
            assert.ok(await evaluate('document.body.textContent.includes("Código: PAR047")'));
            assert.ok(await evaluate('document.querySelector(".catalogo-detail").textContent.includes("PAR047")'));
        });
        await t.test('Edición muestra código fijo y PATCH exclusivamente con nombre cambiado', async () => {
            await navigate('/medicamentos/100/editar'); await wait('!!document.querySelector(".catalogo-form")');
            assert.equal(await evaluate('!!document.querySelector("[name=codigoMedicamento]")'), false);
            assert.ok(await evaluate('document.querySelector(".catalogo-form").textContent.includes("PAR047")'));
            await field('nombreComercial', 'Ibuprofeno corregido'); await submit();
            await wait('location.pathname === "/medicamentos/100" && !!document.querySelector(".catalogo-detail")');
            assert.deepEqual(requests.filter(r => r.method === 'PATCH').at(-1).body, { nombreComercial: 'Ibuprofeno corregido' });
            assert.equal(med.codigoMedicamento, 'PAR047');
        });
        await t.test('Listado, filtro por código y composición siguen mostrando código confirmado', async () => {
            await navigate('/medicamentos'); await wait('!!document.querySelector(".medicamentos-table")');
            assert.ok(await evaluate('document.querySelector(".medicamentos-table").textContent.includes("PAR047")'));
            await evaluate(`(()=>{const el=document.getElementById('filtroCodigo'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'PAR047'); el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
            await esperar(() => requests.some(r => r.query.codigoMedicamento === 'PAR047'));
            await navigate('/medicamentos/100/composicion'); await wait('!!document.querySelector(".composicion-table")');
            assert.ok(await evaluate('document.querySelector(".page-heading").textContent.includes("PAR047")'));
        });
        await t.test('Error funcional del servidor conserva formulario y permite corrección del nombre', async () => {
            await navigate('/medicamentos/nuevo'); await wait('!!document.querySelector(".catalogo-form")'); await fill(); await agregar();
            nextPost = { status: 400, message: 'El nombre comercial debe contener al menos tres letras válidas' };
            await field('nombreComercial', 'Á2'); await submit();
            await wait('document.body.textContent.includes("al menos tres letras válidas")');
            assert.equal(await evaluate('document.querySelector("[name=nombreComercial]").value'), 'Á2');
            assert.equal(await evaluate('!!document.querySelector("[name=codigoMedicamento]")'), false);
            nextPost = { status: 409, message: 'Se agotaron los códigos del prefijo PAR: el correlativo máximo es 999' };
            await field('nombreComercial', 'Paracetamol'); await submit(); await wait('document.body.textContent.includes("máximo es 999")');
        });
        await t.test('409 de identidad conserva componentes y permite consultar producto inactivo', async () => {
            nextPost = { status: 409, message: 'Ya existe un medicamento registrado con estas características y composición.',
                errors: { medicamentosExistentes: [{ idMedicamento: 100, codigoMedicamento: 'PAR047', nombreComercial: 'Paracetamol confirmado', estado: false }] } };
            await submit(); await wait('!!document.querySelector(".medicamento-duplicados a")');
            assert.equal(await evaluate('document.querySelector(".medicamento-duplicados a").getAttribute("href")'), '/medicamentos/100');
            assert.ok(await evaluate('document.querySelector(".medicamento-duplicados").textContent.includes("inactivo")'));
            assert.equal(await evaluate('document.querySelectorAll(".composicion-table tbody tr").length'), 1);
            nextPost = { status: 500, message: 'Error interno del servidor' };
            await submit(); await wait('document.body.textContent.includes("Error interno del servidor")');
            assert.equal(await evaluate('!!document.querySelector(".medicamento-duplicados")'), false);
            assert.equal(await evaluate('document.querySelectorAll(".composicion-table tbody tr").length'), 1);
        });
        await t.test('Catálogo vacío bloquea creación; error de carga permite reintentar', async () => {
            principiosVacios = true;
            await navigate('/medicamentos/nuevo'); await wait('!!document.querySelector(".catalogo-form")');
            assert.ok(await evaluate('document.querySelector("button[type=submit]").disabled'));
            assert.ok(await evaluate('document.body.textContent.includes("No hay principios activos registrados")'));
            principiosVacios = false; falloPrincipios = true;
            await navigate('/medicamentos/nuevo'); await wait('document.body.textContent.includes("No se pudo abrir el formulario")');
            assert.equal(await evaluate('!!document.querySelector(".catalogo-form")'), false);
            falloPrincipios = false;
            await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("Reintentar")).click()');
            await wait('!!document.querySelector(".catalogo-form")');
        });
        await t.test('Móvil 375px: creación y edición sin desbordamiento', async () => {
            await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
            for (const path of ['/medicamentos/nuevo', '/medicamentos/100/editar']) {
                await navigate(path); await wait('!!document.querySelector(".catalogo-form")'); await settle();
                assert.ok(await evaluate('document.documentElement.scrollWidth <= 375'));
                if (path.endsWith('nuevo')) {
                    await agregar();
                    assert.ok(await evaluate('document.documentElement.scrollWidth <= 375'));
                    await click('Agregar componente');
                    assert.ok(await evaluate('document.querySelector("[role=dialog]").getBoundingClientRect().right <= 375'));
                    await evaluate('document.querySelector("[aria-label=\\"Cerrar ventana\\"]").click()');
                }
            }
        });
        await t.test('Administrador y Vendedor mantienen consultas y no acceden a creación/edición', async () => {
            for (rol of [1, 3]) {
                for (const path of ['/medicamentos/nuevo', '/medicamentos/100/editar']) {
                    const inicio = requests.length;
                    await navigate(path); await wait('location.pathname === "/dashboard"');
                    assert.ok(requests.slice(inicio).every(r => r.path === '/api/auth/me'));
                }
                await navigate('/medicamentos/100/composicion'); await wait('!!document.querySelector(".composicion-table")');
                assert.ok(await evaluate('document.querySelector(".page-heading").textContent.includes("PAR047")'));
            }
        });
        assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
        assert.ok(requests.filter(r => ['POST', 'PATCH'].includes(r.method)).every(r => !Object.hasOwn(r.body, 'codigoMedicamento')));
        t.diagnostic(`${requests.length} peticiones API simuladas; sin conexión a MySQL`);
    } finally {
        if (send && socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch { /* cierre de Chrome */ } }
        socket?.close(); browser?.kill(); vite.kill();
        await rm(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    }
});
