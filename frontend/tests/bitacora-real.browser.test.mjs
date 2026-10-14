// Opt-in: React -> Express -> MySQL local. Crea una base NUEVA y la conserva.
// Ejecutar desde frontend con BITACORA_FRONTEND_MYSQL_ACCEPTANCE=1.
// No migra bases existentes, no fabrica respuestas HTTP ni cookies.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegadorReal, esperar } from './helpers/navegadorReal.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const backend = fileURLToPath(new URL('../../backend/', import.meta.url));
const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
requireBackend('dotenv').config({ path: join(backend, '.env'), quiet: true });
assert.equal(process.env.BITACORA_FRONTEND_MYSQL_ACCEPTANCE, '1', 'Autorizar una base MySQL local nueva y conservada');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), 'Se requiere MySQL local');
const database = `cadefar_bitacora_ui_${randomBytes(6).toString('hex')}`;
assert.ok(![process.env.DB_NAME, process.env.DB_NAME_TEST, process.env.DB_NAME_PRODUCTION].filter(Boolean)
  .some(nombre => nombre.toLowerCase() === database.toLowerCase()));
Object.assign(process.env, { NODE_ENV: 'test', DB_NAME_TEST: database, JWT_SECRET: randomBytes(32).toString('hex'),
  FRONTEND_URL: 'http://127.0.0.1:5186', RECOVERY_ENABLED: 'false', MAIL_PROVIDER: 'mock' });
const mysql = requireBackend('mysql2/promise'), bcrypt = requireBackend('bcrypt');
const exec = promisify(execFile);
const password = 'Bitacora-Sintetica-123!';
const stamp = '2026-01-02T03:04:05.678Z';

test('CU42 Fase 4: aceptación React, Express, cookie HttpOnly y MySQL local conservado', { timeout: 240000 }, async t => {
  let connection, db, server, vite, browser, profile, port;
  const logs = [];
  t.mock.method(console, 'error', dato => logs.push(dato));
  const closeServer = async () => {
    if (!server?.listening) return;
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  };
  try {
    try {
      connection = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.PASSWORD_DB });
      // CREATE estricto: nunca reutilizar/migrar una base preexistente.
      await connection.query(`CREATE DATABASE \`${database}\``);
    } catch { throw new Error('No fue posible crear una base MySQL local nueva para esta aceptación'); }
    t.diagnostic(`Base local creada y conservada: ${database}`);
    const runCli = async (...args) => {
      try { await exec(process.execPath, [join(backend, 'node_modules/sequelize-cli/lib/sequelize'), ...args, '--env', 'test'], { cwd: backend, env: { ...process.env }, timeout: 90000 }); }
      catch { throw new Error(`Sequelize CLI ${args[0]} no pudo preparar la base aislada`); }
    };
    await runCli('db:migrate');
    await runCli('db:seed', '--seed', '20260914181926-seed-rol.js');
    ({ default: db } = await import('../../backend/src/data/models/index.js'));
    assert.equal(db.sequelize.config.database, database);
    const select = (sql, replacements = []) => {
      assert.equal(db.sequelize.config.database, database);
      return db.sequelize.query(sql, { type: db.Sequelize.QueryTypes.SELECT, replacements, logging: false });
    };
    const [version] = await select('SELECT VERSION() AS version');
    t.diagnostic(`MySQL ${version.version}; fixtures exclusivamente sintéticos.`);
    const hash = await bcrypt.hash(password, 4), users = {};
    for (const [name, role] of [['admin', 1], ['admin2', 1], ['regente', 2], ['vendedor', 3], ['historico', 3], ['objetivo', 3]]) {
      users[name] = await db.Usuario.create({ nombre_usuario: `bitacora_${name}`, id_rol: role, password_hash: hash });
    }
    const { prepararEventoAuditoria } = await import('../../backend/src/business/validators/auditoria.validator.js');
    const { bitacoraAuditoriaRepository: repo } = await import('../../backend/src/data/repositories/bitacora-auditoria.repository.js');
    const { crearContextoAuditoriaConexion: contexto } = await import('../../backend/src/shared/utils/auditoria-contexto.js');
    const historical = { idUsuario: users.historico.id_usuario, nombreUsuario: 'bitacora_historico', idRol: 3 };
    const fixtureIds = [];
    await db.sequelize.transaction(async transaction => {
      for (let i = 0; i < 63; i++) fixtureIds.push(await repo.create({ transaction,
        data: prepararEventoAuditoria({ tipoEvento: 'LOGOUT', resultado: 'EXITO', responsable: historical,
          contexto: contexto('192.0.2.10'), fechaEvento: new Date(stamp), registro: { tipo: 'USUARIO', id: historical.idUsuario },
          metadatos: { efecto: 'CONFIRMADO' } }, new Date(stamp)) }));
    });
    const provider = await db.ProveedorLaboratorio.create({ nombre: 'Proveedor sintético Bitácora UI' });
    const med = await db.Medicamento.create({ id_proveedor_laboratorio: provider.id_proveedor_laboratorio,
      codigo_medicamento: 'AUDUI001', nombre_comercial: 'Producto sintético Bitácora', forma_farmaceutica: 'Tableta',
      presentacion: '500 mg', unidad_inventario: 'tableta', condicion_venta: 'LIBRE', via_administracion: 'ORAL', tipo_liberacion: 'INMEDIATA' });
    const { app } = await import('../../backend/src/app.js');
    const startServer = async () => {
      server = app.listen(port || 0, '127.0.0.1');
      await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
      port = server.address().port;
    };
    await startServer();
    const origin = process.env.FRONTEND_URL, apiUrl = `http://127.0.0.1:${port}/api`;
    profile = await mkdtemp(join(process.env.LOCALAPPDATA, 'Temp', 'opencode', 'cadefar-bitacora-real-'));
    const outDir = join(profile, 'app');
    vite = spawn(process.execPath, ['--input-type=module', '--eval', `import {build,preview} from 'vite';const outDir=${JSON.stringify(outDir)};await build({logLevel:'warn',build:{outDir,emptyOutDir:true}});const server=await preview({build:{outDir},preview:{host:'127.0.0.1',port:5186,strictPort:true}});server.printUrls();`], {
      cwd: root, env: { ...process.env, NODE_ENV: 'production', VITE_API_URL: apiUrl }, stdio: ['ignore', 'pipe', 'pipe']
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Vite Preview no inició en 5186')), 20000);
      vite.stdout.on('data', chunk => { if (chunk.toString().replace(/\x1b\[[0-9;]*m/g, '').includes('127.0.0.1:5186')) { clearTimeout(timer); resolve(); } });
      vite.once('error', error => { clearTimeout(timer); reject(error); });
      vite.once('exit', () => { clearTimeout(timer); reject(new Error('Vite Preview terminó antes de iniciar')); });
    });
    if (process.env.CADEFAR_SCREENSHOT_DIR) await mkdir(process.env.CADEFAR_SCREENSHOT_DIR, { recursive: true });
    browser = await abrirNavegadorReal({ profile: join(profile, 'chrome'), origin, apiUrl });
    const pages = {};
    for (const name of ['admin', 'admin2', 'regente', 'vendedor', 'guest']) pages[name] = await browser.openSession(name);
    const admin = pages.admin;
    await admin.timezone('Asia/Tokyo'); await admin.viewport(1440);
    const login = async (page, name) => {
      await page.navigate('/login'); await page.wait('!!document.getElementById("nombreUsuario")');
      await page.field('#nombreUsuario', `bitacora_${name}`); await page.field('#password', password);
      await page.click('.login-form button[type=submit]'); await page.wait('location.pathname === "/dashboard"');
    };
    const ready = () => admin.ready('.bitacora-page');
    const listRequests = () => browser.requests.filter(r => r.session === 'admin' && r.path === '/api/bitacora' && r.method === 'GET');
    const detailRequests = () => browser.requests.filter(r => r.session === 'admin' && /^\/api\/bitacora\/\d+$/.test(r.path));
    const audited = tipo => select('SELECT * FROM bitacora_auditoria WHERE tipo_evento = ? ORDER BY id_evento', [tipo]);
    const response = (start, page, path) => esperar(() => browser.requests.slice(start).find(r => r.session === page.name && r.path === path && r.response), `respuesta real ${path}`);
    const navigate = async path => { await admin.navigate(path); await ready(); };
    const click = async text => { await admin.clickText(text); await ready(); };
    let purchaseEvent, modificationEvent;

    await t.test('Login del navegador real, CORS con credenciales, cookie HttpOnly y restauración de sesión', async () => {
      for (const name of ['admin', 'admin2', 'regente', 'vendedor']) await login(pages[name], name);
      const cookie = (await admin.cookies()).find(c => c.name === 'token');
      assert.ok(cookie?.httpOnly); assert.equal(cookie.sameSite, 'Lax');
      assert.equal(await admin.evaluate('document.cookie.includes("token=")'), false);
      await navigate('/bitacora');
      assert.equal(listRequests().at(-1).status, 200);
      assert.ok(await admin.evaluate('document.querySelectorAll(".bitacora-table tbody tr").length === 25'));
      await navigate('/bitacora'); assert.equal(listRequests().at(-1).status, 200);
      assert.equal(await admin.evaluate('location.pathname'), '/bitacora');
      assert.equal(await admin.evaluate('localStorage.length + sessionStorage.length'), 0);
    });
    await t.test('Orden estable con fechas iguales, páginas 25/50/100 y total contrastados con MySQL', async () => {
      await navigate('/bitacora?tipoEvento=LOGOUT&pagina=1&limite=25');
      const start = browser.requests.length;
      await admin.clickText('Actualizar'); await ready();
      const request = await response(start, admin, '/api/bitacora');
      assert.equal(request.response.paginacion.total, 63);
      assert.deepEqual(request.response.data.map(e => e.idEvento), fixtureIds.slice(-25).reverse());
      await click('Siguiente'); assert.equal(listRequests().at(-1).query.pagina, '2');
      assert.equal(await admin.evaluate('document.body.textContent.includes("Página 2 de 3")'), true);
      const p2 = await response(start + 1, admin, '/api/bitacora');
      assert.deepEqual(p2.response.data.map(e => e.idEvento), fixtureIds.slice(13, 38).reverse());
      for (const limite of ['50', '100', '25']) {
        await admin.select('#bitacora-limite', limite); await ready();
        assert.equal(listRequests().at(-1).query.pagina, '1'); assert.equal(listRequests().at(-1).query.limite, limite);
        assert.equal(await admin.evaluate('document.querySelectorAll(".bitacora-table tbody tr").length'), Math.min(Number(limite), 63));
      }
    });
    await t.test('Buscar combina doce filtros y extremos exactos inclusivos con milisegundos en Bolivia desde equipo Tokio', async () => {
      await navigate('/bitacora');
      const start = listRequests().length;
      const criterios = { desde: '2026-01-01T23:04:05.678', hasta: '2026-01-01T23:04:05.678',
        modulo: 'AUTENTICACION', accion: 'LOGOUT', tipoEvento: 'LOGOUT', resultado: 'EXITO', idUsuarioResponsable: String(historical.idUsuario),
        direccionIp: '192.0.2.10', tipoRegistro: 'USUARIO', idRegistro: String(historical.idUsuario) };
      await admin.click('.bitacora-filters summary');
      for (const [campo, valor] of Object.entries(criterios)) {
        if (['modulo', 'accion', 'tipoEvento', 'resultado', 'tipoRegistro'].includes(campo)) await admin.select(`[name=${campo}]`, valor);
        else await admin.field(`[name=${campo}]`, valor);
      }
      assert.equal(listRequests().length, start);
      await click('Buscar');
      assert.equal(listRequests().length, start + 1);
      assert.equal(listRequests().at(-1).query.desde, '2026-01-01T23:04:05.678-04:00');
      assert.equal(await admin.evaluate('document.body.textContent.includes("25 de 63 eventos registrados")'), true);
      assert.match(await admin.evaluate('document.querySelector(".bitacora-table time").textContent'), /01\/01\/2026.*23:04:05[.,]678/);
      await admin.field('[name=idUsuarioObjetivo]', users.objetivo.id_usuario); await admin.field('[name=nombreIngresado]', 'bitacora_objetivo');
      await click('Buscar');
      assert.equal(await admin.evaluate('document.body.textContent.includes("No hay eventos que coincidan")'), true);
      assert.equal(listRequests().at(-1).query.idUsuarioObjetivo, String(users.objetivo.id_usuario));
      assert.equal(listRequests().at(-1).query.nombreIngresado, 'bitacora_objetivo');
    });
    await t.test('Cada lectura de listado se audita después del snapshot; edición/expansión no hace lecturas', async () => {
      const antes = (await audited('BITACORA_CONSULTAR')).length, start = browser.requests.length;
      await navigate('/bitacora');
      const request = await response(start, admin, '/api/bitacora');
      const despues = await audited('BITACORA_CONSULTAR'); assert.equal(despues.length, antes + 1);
      assert.equal(request.response.paginacion.total, await db.BitacoraAuditoria.count() - 1);
      assert.equal(request.response.data.some(e => e.idEvento === despues.at(-1).id_evento), false);
      const count = listRequests().length;
      await admin.field('[name=idUsuarioResponsable]', historical.idUsuario); await admin.click('.bitacora-filters summary'); await admin.settle();
      assert.equal(listRequests().length, count); assert.equal((await audited('BITACORA_CONSULTAR')).length, antes + 1);
    });
    await t.test('Modificación real de usuario: snapshots, rol/correo y nombre histórico permanecen consultables', async () => {
      const result = await admin.request('PATCH', `/usuarios/${historical.idUsuario}`, { nombreUsuario: 'bitacora_nombre_actual', idRol: 2, correo: 'sintetico@example.test' });
      assert.equal(result.status, 200);
      modificationEvent = (await audited('USUARIO_MODIFICAR')).at(-1).id_evento;
      await navigate(`/bitacora/${modificationEvent}`);
      const table = await admin.evaluate('document.querySelector(".bitacora-cambios").textContent');
      assert.ok(table.includes('bitacora_historico') && table.includes('bitacora_nombre_actual'));
      assert.ok(table.includes('Vendedor (#3)') && table.includes('Regente (#2)'));
      assert.ok(table.includes('Valor no conservado'));
      assert.equal(await admin.evaluate('document.body.textContent.includes("sintetico@example.test")'), false);
      await navigate(`/bitacora?tipoEvento=LOGOUT&idUsuarioResponsable=${historical.idUsuario}&pagina=2&limite=25`);
      assert.equal(await admin.evaluate('document.querySelector(".bitacora-table").textContent.includes("bitacora_historico")'), true);
      assert.equal(await admin.evaluate('document.querySelector(".bitacora-table").textContent.includes("bitacora_nombre_actual")'), false);
      const query = await admin.evaluate('location.search');
      await admin.click('.bitacora-table a'); await ready();
      assert.equal(await admin.evaluate('location.search'), query);
      assert.deepEqual(detailRequests().at(-1).query, {});
      await navigate(await admin.evaluate('location.pathname + location.search'));
      await admin.click('.back-link'); await ready(); assert.equal(await admin.evaluate('location.search'), query);
      assert.equal(listRequests().at(-1).query.pagina, '2');
    });
    await t.test('Tres logins incorrectos reales generan tres fallos y un bloqueo, con cuenta objetivo sin responsable', async () => {
      const guest = pages.guest;
      await guest.navigate('/login'); await guest.wait('!!document.getElementById("nombreUsuario")');
      await guest.field('#nombreUsuario', 'bitacora_objetivo'); await guest.field('#password', 'Incorrecta-Sintetica!');
      for (const status of [401, 401, 423]) {
        const start = browser.requests.length;
        await guest.click('.login-form button[type=submit]');
        const r = await response(start, guest, '/api/auth/login'); assert.equal(r.status, status);
        await guest.wait('document.querySelector(".login-form button[type=submit]").disabled === false');
      }
      const fallos = await audited('LOGIN_PASSWORD_INCORRECTA'), bloqueos = await audited('LOGIN_BLOQUEO_GENERADO');
      assert.equal(fallos.length, 3); assert.equal(bloqueos.length, 1);
      assert.equal(fallos.at(-1).correlacion, bloqueos[0].correlacion);
      await navigate(`/bitacora?tipoEvento=LOGIN_PASSWORD_INCORRECTA&idUsuarioObjetivo=${users.objetivo.id_usuario}&pagina=1&limite=25`);
      assert.equal(await admin.evaluate('document.body.textContent.includes("3 de 3 eventos registrados")'), true);
      await admin.click('.bitacora-table a'); await ready();
      const texto = await admin.evaluate('document.querySelector(".bitacora-detail").textContent');
      assert.ok(texto.includes('Sin responsable autenticado') && texto.includes('bitacora_objetivo'));
      assert.ok(await admin.evaluate('document.body.textContent.includes("Intentos de contraseña fallidos3")'));
      await navigate(`/bitacora/${bloqueos[0].id_evento}`);
      assert.equal(await admin.evaluate('document.querySelector(".bitacora-resultado").textContent'), 'Éxito');
      assert.equal(await admin.evaluate('document.body.textContent.includes("Bloqueo temporal generado")'), true);
      assert.equal(await admin.evaluate('document.querySelectorAll("section[aria-labelledby=bitacora-metadatos-title] time").length'), 2);
    });
    await t.test('Compra real: un evento, decimales y referencias, captura a más de 100 referencias con omisiones', async () => {
      const result = await admin.request('POST', '/compras', { fechaCompra: '2026-01-01', claveOperacion: 'bitacora_ui_compra',
        detalles: Array.from({ length: 52 }, () => ({ idMedicamento: med.id_medicamento, cantidad: 1, costoUnitario: '1.123456', precisionVencimiento: 'DIA', fechaVencimiento: '2035-12-31' })) });
      assert.equal(result.status, 201);
      const compras = await audited('COMPRA_REGISTRAR'); assert.equal(compras.length, 1); purchaseEvent = compras[0].id_evento;
      await navigate(`/bitacora/${purchaseEvent}`);
      const start = browser.requests.length; await click('Actualizar'); const r = await response(start, admin, `/api/bitacora/${purchaseEvent}`);
      assert.equal(r.response.data.registro.id, result.body.data.idCompra);
      assert.equal(await admin.evaluate('document.querySelectorAll(".bitacora-referencias li").length'), r.response.data.referencias.length);
      assert.equal(r.response.data.referencias.length, 100);
      assert.ok(r.response.data.metadatos.cantidadReferenciasOmitidas > 0);
      assert.equal(await admin.evaluate('document.body.textContent.includes("Se omitieron")'), true);
      assert.equal(r.response.data.despues.total, result.body.data.total);
      assert.equal(await admin.evaluate(`document.querySelector('.bitacora-cambios').textContent.includes(${JSON.stringify(result.body.data.total)})`), true);
      assert.equal(await db.Compra.count(), 1); assert.equal(await db.DetalleCompra.count(), 52);
    });
    await t.test('Regente/Vendedor y sin sesión: ruta visual y API rechazan lista/detalle sin eludir permisos', async () => {
      for (const [name, status] of [['regente', 403], ['vendedor', 403], ['guest', 401]]) {
        const page = pages[name], start = browser.requests.length;
        for (const path of ['/bitacora', `/bitacora/${purchaseEvent}`]) {
          await page.navigate(path); await page.wait(name === 'guest' ? 'location.pathname === "/login"' : 'location.pathname === "/dashboard"');
        }
        assert.equal(browser.requests.slice(start).some(r => r.session === name && r.path.startsWith('/api/bitacora')), false);
        for (const path of ['/bitacora', `/bitacora/${purchaseEvent}`]) assert.equal((await page.request('GET', path)).status, status);
      }
    });
    await t.test('URLs inválidas no hacen lecturas; la API real valida 400/404 y la UI distingue inexistencia de vacío', async () => {
      const before = listRequests().length;
      await navigate('/bitacora?pagina=01'); assert.equal(listRequests().length, before);
      assert.equal(await admin.evaluate('document.body.textContent.includes("Corrige los criterios")'), true);
      assert.equal((await admin.request('GET', '/bitacora?pagina=01')).status, 400);
      await navigate('/bitacora/2147483647');
      assert.equal(await admin.evaluate('document.body.textContent.includes("Evento no encontrado")'), true);
      await navigate('/bitacora?tipoRegistro=BITACORA&idRegistro=2147483647&pagina=1&limite=25');
      // El 404 anterior se audita con este mismo registro: no es un vacío.
      assert.equal(await admin.evaluate('document.body.textContent.includes("1 de 1 eventos registrados")'), true);
      await navigate('/bitacora?tipoRegistro=MEDICAMENTO&idRegistro=2147483647&pagina=1&limite=25');
      assert.equal(await admin.evaluate('document.body.textContent.includes("No hay eventos que coincidan")'), true);
    });
    await t.test('Detalle, cambios y referencias reales en escritorio/móvil sin desbordamiento y sin secretos en DOM/DTO', async () => {
      await navigate(`/bitacora/${purchaseEvent}`);
      for (const width of [320, 375, 768, 1440]) {
        await admin.viewport(width); await admin.evaluate('scrollTo(0,0)'); await admin.settle();
        assert.equal(await admin.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
        await admin.screenshot(`bitacora-real-detalle-${width}.png`);
        await admin.evaluate('document.querySelector(".bitacora-cambios").scrollIntoView({block:"center"})'); await admin.settle();
        await admin.screenshot(`bitacora-real-cambios-${width}.png`);
      }
      const rendered = await admin.evaluate('document.body.textContent'); assert.equal(rendered.includes(password), false); assert.equal(rendered.includes(hash), false);
      const dtos = browser.requests.filter(r => r.path.startsWith('/api/bitacora') && r.response).map(r => JSON.stringify(r.response)).join('\n');
      for (const privado of [password, hash, 'password_hash', 'sintetico@example.test']) assert.equal(dtos.includes(privado), false);
      assert.equal(await admin.evaluate('localStorage.length + sessionStorage.length'), 0);
      assert.equal(await admin.evaluate('document.querySelectorAll(".bitacora-detail-page input, .bitacora-detail-page textarea, .bitacora-detail-page form").length'), 0);
    });
    await t.test('Nueva lectura y reinicio HTTP conservan el evento; otro proceso recupera exactamente los datos persistidos', async () => {
      const antes = await repo.findById({ idEvento: purchaseEvent });
      const script = `import db from './src/data/models/index.js';import {bitacoraAuditoriaRepository as r} from './src/data/repositories/bitacora-auditoria.repository.js';const e=await r.findById({idEvento:${purchaseEvent}});console.log(JSON.stringify({id:e.id_evento,fecha:e.fecha_registro,total:e.despues.total}));await db.sequelize.close();`;
      let out;
      try { out = await exec(process.execPath, ['--input-type=module', '-e', script], { cwd: backend, env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' }, timeout: 30000 }); }
      catch { throw new Error('No se pudo recuperar el evento desde otro proceso'); }
      assert.deepEqual(JSON.parse(out.stdout.trim().split(/\r?\n/).at(-1)), { id: purchaseEvent, fecha: antes.fecha_registro, total: antes.despues.total });
      await closeServer(); await click('Actualizar');
      assert.equal(await admin.evaluate('document.body.textContent.includes("No fue posible consultar el evento")'), true);
      assert.equal(await admin.evaluate('!!document.querySelector(".bitacora-detail")'), false);
      await startServer(); await click('Reintentar');
      assert.equal(await admin.evaluate('document.querySelector(".page-heading h2").textContent'), `Evento #${purchaseEvent}`);
      assert.deepEqual(await repo.findById({ idEvento: purchaseEvent }), antes);
    });
    await t.test('Cambiar el rol en servidor causa 403 con Context previo; logout externo produce 401 y bloquea reintentos', async () => {
      await navigate('/bitacora');
      assert.equal((await pages.admin2.request('PATCH', `/usuarios/${users.admin.id_usuario}`, { idRol: 3 })).status, 200);
      await click('Actualizar');
      assert.equal(await admin.evaluate('document.body.textContent.includes("Acceso no autorizado")'), true);
      assert.equal(await admin.evaluate('document.querySelector(".bitacora-page button").disabled'), true);
      assert.equal((await pages.admin2.request('PATCH', `/usuarios/${users.admin.id_usuario}`, { idRol: 1 })).status, 200);
      await navigate(`/bitacora/${purchaseEvent}`);
      assert.equal((await admin.request('POST', '/auth/logout')).status, 200);
      await click('Actualizar');
      assert.equal(await admin.evaluate('document.body.textContent.includes("Sesión no válida")'), true);
      assert.equal(await admin.evaluate('document.querySelector(".bitacora-page button").disabled'), true);
      assert.equal(await admin.evaluate(`!!document.querySelector('.bitacora-page a[href="/login"]')`), true);
    });
    await t.test('Cierre: referencias reales, auditoría append-only por API y ninguna escritura originada desde Bitácora', async () => {
      const paths = browser.requests.filter(r => r.path.startsWith('/api/bitacora'));
      assert.ok(paths.every(r => r.method === 'GET'));
      assert.ok(detailRequests().every(r => Object.keys(r.query).length === 0));
      assert.deepEqual(browser.errors, []);
      assert.ok(logs.every(log => log.name === 'AppError' && [400, 401, 403, 404, 423].includes(log.statusCode)));
      for (const privado of [password, hash, 'password_hash', 'sintetico@example.test']) assert.equal(JSON.stringify(logs).includes(privado), false);
      assert.equal((await db.Usuario.findByPk(historical.idUsuario)).nombre_usuario, 'bitacora_nombre_actual');
      assert.equal((await repo.findById({ idEvento: fixtureIds[0] })).nombre_usuario_responsable, 'bitacora_historico');
      assert.equal((await repo.findById({ idEvento: modificationEvent })).despues.idRol, 2);
      t.diagnostic(`${paths.length} lecturas CU42 HTTP reales observadas; base ${database} conservada, sin modificar bases preexistentes.`);
    });
  } finally {
    await browser?.close();
    vite?.kill(); await closeServer();
    if (db) await db.sequelize.close();
    if (connection) await connection.end();
    if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    // La base y todos sus eventos quedan conservados también si falla una prueba.
  }
});
