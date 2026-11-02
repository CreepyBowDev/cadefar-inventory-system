// Aceptación focalizada React -> Express -> MySQL local, con cookies reales.
// No fabrica respuestas ni ejecuta suites del backend. Crea y elimina SOLO un
// esquema aleatorio nuevo; no migra, consulta datos ni escribe bases existentes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegadorReal, esperar } from './helpers/navegadorReal.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const backend = fileURLToPath(new URL('../../backend/', import.meta.url));
const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
requireBackend('dotenv').config({ path: join(backend, '.env'), quiet: true });
assert.notEqual(process.env.NODE_ENV, 'production', 'No ejecutar aceptación desde un entorno de producción');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), 'Se requiere MySQL local');
const protegidas = [process.env.DB_NAME, process.env.DB_NAME_TEST, process.env.DB_NAME_PRODUCTION].filter(Boolean);
const database = `cadefar_ventas_ui_${randomBytes(8).toString('hex')}`;
assert.match(database, /^cadefar_ventas_ui_[a-f0-9]{16}$/);
assert.ok(protegidas.every(nombre => nombre.toLowerCase() !== database.toLowerCase()));
const origin = 'http://127.0.0.1:5187';
Object.assign(process.env, { NODE_ENV: 'test', DB_NAME_TEST: database, JWT_SECRET: randomBytes(32).toString('hex'), FRONTEND_URL: origin });
const mysql = requireBackend('mysql2/promise'), bcrypt = requireBackend('bcrypt');
const exec = promisify(execFile);
const password = 'Aceptacion-Ventas-Sintetica-123!';

test('CU28–CU32: aceptación React/Express/MySQL local con datos sintéticos y auditoría real', { timeout: 180000 }, async t => {
  let connection, db, server, frontend, browser, profile, creada = false;
  const logs = [];
  t.mock.method(console, 'error', entrada => logs.push(entrada));
  try {
    connection = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.PASSWORD_DB });
    await connection.query(`CREATE DATABASE \`${database}\``); creada = true;
    try {
      await exec(process.execPath, [join(backend, 'node_modules/sequelize-cli/lib/sequelize'), 'db:migrate', '--env', 'test'], { cwd: backend, env: { ...process.env }, timeout: 60000 });
    } catch { throw new Error('No se pudo migrar el esquema temporal local de aceptación'); }
    ({ default: db } = await import('../../backend/src/data/models/index.js'));
    assert.equal(db.sequelize.config.database, database);
    db.sequelize.options.logging = false;
    const select = (sql, replacements = {}) => {
      assert.equal(db.sequelize.config.database, database);
      return db.sequelize.query(sql, { type: db.Sequelize.QueryTypes.SELECT, replacements, logging: false });
    };
    const { ROLES } = await import('../../backend/src/shared/constants/roles.js');
    const { obtenerFechaOperacion } = await import('../../backend/src/shared/utils/fecha-operacion.js');
    const today = obtenerFechaOperacion().fechaComercial;
    await db.Rol.bulkCreate(Object.entries(ROLES).map(([nombre, id_rol]) => ({ nombre, id_rol })));
    const passwordHash = await bcrypt.hash(password, 4), users = {};
    for (const [name, idRol] of [['admin', 1], ['regente', 2], ['vendedor', 3]]) users[name] = await db.Usuario.create({ nombre_usuario: `ventas_ui_${name}`, id_rol: idRol, password_hash: passwordHash });
    const proveedor = await db.ProveedorLaboratorio.create({ nombre: 'Proveedor sintético aceptación Ventas' });
    const medicamentos = {};
    for (const [nombre, condicion] of [['LIB', 'LIBRE'], ['RX', 'RECETA_MEDICA'], ['UNK', 'Desconocida'], ['ZERO', 'LIBRE'], ['VEN', 'LIBRE']]) medicamentos[nombre] = await db.Medicamento.create({
      id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio, codigo_medicamento: `VR${nombre}`,
      nombre_comercial: `Producto sintético ${nombre}`, forma_farmaceutica: 'Tableta', presentacion: '500 mg', unidad_inventario: 'tableta',
      condicion_venta: condicion, via_administracion: 'Oral', tipo_liberacion: 'Inmediata', stock_minimo: 1
    });
    const existencia = async (med, sufijo, fecha, cantidad, costo) => {
      const e = await db.ExistenciaMedicamento.create({ id_medicamento: medicamentos[med].id_medicamento, codigo_existencia: `VR${med}-${sufijo}`, fecha_vencimiento: fecha, precision_vencimiento: 'DIA', cantidad_fisica: cantidad, costo_unitario_promedio: costo });
      if (cantidad) await db.MovimientoInventario.create({ id_existencia: e.id_existencia, id_usuario: users.regente.id_usuario, direccion: 'ENTRADA', motivo: 'AJUSTE', cantidad, costo_unitario_aplicado: costo,
        observacion: 'Saldo inicial sintético', fecha_movimiento: db.Sequelize.fn('STR_TO_DATE', `${today} 00:01:00`, '%Y-%m-%d %H:%i:%s') });
      return e;
    };
    const ex = {
      libreLejana: await existencia('LIB', '001', '2099-12-31', 4, '2.000000'),
      libreCercana: await existencia('LIB', '002', '2098-01-01', 2, '1.000000'),
      recetaLejana: await existencia('RX', '001', '2099-12-31', 3, '3.000000'),
      recetaCercana: await existencia('RX', '002', '2098-01-01', 2, '4.000000'),
      desconocida: await existencia('UNK', '001', '2099-12-31', 2, '1.000000'),
      sinStock: await existencia('ZERO', '001', '2099-12-31', 0, '1.000000'),
      vencida: await existencia('VEN', '001', '2000-01-01', 3, '1.000000')
    };
    const inventario = () => select('SELECT id_existencia, cantidad_fisica, CAST(costo_unitario_promedio AS CHAR) AS costo FROM existencia_medicamento ORDER BY id_existencia');
    const inicial = await inventario();
    const { app } = await import('../../backend/src/app.js');
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const apiUrl = `http://127.0.0.1:${server.address().port}/api`;
    const tempRoot = process.platform === 'win32' ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : tmpdir();
    profile = await mkdtemp(join(tempRoot, 'cadefar-ventas-real-'));
    frontend = spawn(process.execPath, ['--input-type=module', '--eval', `
      import { build } from 'vite'; import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
      const outDir=${JSON.stringify(join(profile, 'app'))}; await build({logLevel:'warn',build:{outDir,emptyOutDir:true}});
      const types={'.js':'text/javascript','.css':'text/css','.png':'image/png','.html':'text/html'};
      createServer(async(req,res)=>{const path=new URL(req.url,'${origin}').pathname;const file=join(outDir,path.startsWith('/assets/')?path:'index.html');try{const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}}).listen(5187,'127.0.0.1',()=>console.log('${origin}'));
    `], { cwd: root, env: { ...process.env, NODE_ENV: 'production', VITE_API_URL: apiUrl }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Frontend de aceptación no inició')), 20000);
      frontend.stdout.on('data', chunk => { if (chunk.toString().includes(origin)) { clearTimeout(timer); resolve(); } });
      frontend.once('error', reject); frontend.once('exit', () => reject(new Error('Frontend de aceptación finalizó antes de iniciar')));
    });
    browser = await abrirNavegadorReal({ profile: join(profile, 'chrome'), origin, apiUrl });
    const pages = {};
    for (const name of ['admin', 'regente', 'vendedor', 'guest']) pages[name] = await browser.openSession(name);
    const ready = page => page.ready('.ventas-page, .recetas-page');
    const response = (page, start, path) => esperar(() => browser.requests.slice(start).find(r => r.session === page.name && r.method === 'POST' && r.path === path && r.response), `respuesta de negocio real ${path}`);
    const navegarVenta = async (page, id) => { await page.navigate(`/ventas/${id}`); await ready(page); };
    const guardarVenta = async (tipo, e, cantidad, precio = '0.10', drop = false) => {
      const page = pages.vendedor;
      await page.navigate('/ventas/nueva'); await ready(page);
      await page.select('#venta-linea-1-med', medicamentos[tipo].id_medicamento);
      await page.wait(`!!document.querySelector('#venta-linea-1-existencia option[value="${e.id_existencia}"]')`);
      await page.select('#venta-linea-1-existencia', e.id_existencia); await page.field('#venta-linea-1-cantidad', cantidad); await page.field('#venta-linea-1-precio', precio);
      await page.review('.venta-form');
      if (drop) await page.dropNextPost('/api/ventas');
      const start = browser.requests.length; await page.clickText('Guardar pendiente'); const result = await response(page, start, '/api/ventas');
      assert.equal(result.status, 201);
      if (drop) await page.contains('No fue posible comprobar el resultado del registro');
      else { await page.wait(`location.pathname === '/ventas/${result.response.data.idVenta}'`); await ready(page); }
      return result.response.data;
    };
    const confirmar = async (id, status = 200, drop = false) => {
      const page = pages.vendedor; await navegarVenta(page, id); await page.click('.venta-confirmacion > button'); await page.wait('!!document.querySelector("[role=dialog]")');
      const path = `/api/ventas/${id}/confirmar`, start = browser.requests.length;
      if (drop) await page.dropNextPost(path);
      await page.clickText('Confirmar venta y descontar inventario'); const result = await response(page, start, path); assert.equal(result.status, status);
      await page.wait('!document.querySelector("[role=dialog]")');
      await page.contains(drop ? 'No fue posible comprobar el resultado de la confirmación' : status === 200 ? 'Venta confirmada.' : result.response.message);
      return result.response.data;
    };
    const registrarReceta = async (id, drop = false) => {
      const page = pages.vendedor; await page.navigate(`/ventas/${id}/recetas/nueva`); await ready(page);
      for (const [campo, valor] of Object.entries({ 'receta-fecha': today, 'receta-paciente': 'PII_UI_PACIENTE', 'receta-documento': 'PII_UI_DOCUMENTO', 'receta-medico': 'PII_UI_MEDICO', 'receta-modalidad': 'Presentada' })) await page.field(`#${campo}`, valor);
      await page.click('.receta-producto input:not(:disabled)'); await page.review('.receta-form');
      const path = `/api/ventas/${id}/recetas`, start = browser.requests.length;
      if (drop) await page.dropNextPost(path);
      await page.clickText('Registrar receta'); const result = await response(page, start, path); assert.equal(result.status, 201);
      if (drop) await page.contains('No fue posible comprobar el resultado del registro');
      else { await page.wait(`location.pathname === '/ventas/${id}'`); await ready(page); }
      return result.response.data;
    };
    const revisarReceta = async (receta, decision, drop = false) => {
      const page = pages.regente; await page.navigate(`/ventas/${receta.idVenta}/recetas/${receta.idReceta}`); await ready(page);
      await page.contains('PII_UI_PACIENTE'); await page.select('#receta-resultado', decision); await page.field('#receta-revision-observacion', 'Revisión sintética UI'); await page.review('.receta-revision form');
      const path = `/api/ventas/${receta.idVenta}/recetas/${receta.idReceta}/revisar`, start = browser.requests.length;
      if (drop) await page.dropNextPost(path);
      await page.clickText(decision === 'APROBADA' ? 'Aprobar receta' : 'Rechazar receta'); const result = await response(page, start, path); assert.equal(result.status, 200);
      await page.wait('!document.querySelector("[role=dialog]")'); await page.contains(drop ? 'No fue posible comprobar el resultado de la revisión' : 'Revisión registrada.');
      return result.response.data;
    };
    const anular = async (id, drop = false) => {
      const page = pages.admin; await navegarVenta(page, id); await page.field('#venta-anular-motivo', 'Anulación sintética UI'); await page.review('.venta-anular-form');
      const path = `/api/ventas/${id}/anular`, start = browser.requests.length;
      if (drop) await page.dropNextPost(path);
      await page.clickText('Confirmar anulación'); const result = await response(page, start, path); assert.equal(result.status, 200);
      await page.wait('!document.querySelector("[role=dialog]")'); await page.contains(drop ? 'No fue posible comprobar el resultado de la anulación' : 'anulada.');
      return result.response.data;
    };
    let libre, medica, receta;

    await t.test('Migración aplicada en el esquema temporal; login real, cookie HttpOnly y sesión restaurada de tres roles', async () => {
      const [columna] = await select("SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='receta' AND COLUMN_NAME='archivo_receta'"); assert.equal(columna.IS_NULLABLE, 'YES');
      for (const name of ['admin', 'regente', 'vendedor']) {
        const page = pages[name]; await page.navigate('/login'); await page.wait('!!document.getElementById("nombreUsuario")');
        await page.field('#nombreUsuario', `ventas_ui_${name}`); await page.field('#password', password); await page.click('.login-form button[type=submit]'); await page.wait('location.pathname === "/dashboard"');
        const token = (await page.cookies()).find(c => c.name === 'token'); assert.ok(token?.httpOnly); assert.equal(token.sameSite, 'Lax');
        assert.equal(await page.evaluate('document.cookie.includes("token=")'), false);
        await page.navigate('/ventas'); await ready(page); assert.equal(await page.evaluate('localStorage.length + sessionStorage.length'), 0);
      }
    });
    await t.test('Guardar pendiente por React conserva inventario; confirmar redistribuye FEFO real entre existencias', async () => {
      libre = await guardarVenta('LIB', ex.libreLejana, 4);
      assert.equal(libre.estadoOperacion, 'PENDIENTE'); assert.equal(libre.fechaVenta, null); assert.equal(libre.total, '0.40'); assert.deepEqual(await inventario(), inicial);
      const confirmada = await confirmar(libre.idVenta);
      assert.deepEqual(confirmada.detalles.map(d => [d.idExistencia, d.cantidad]), [[ex.libreCercana.id_existencia, 2], [ex.libreLejana.id_existencia, 2]]);
      assert.equal(confirmada.total, '0.40'); assert.equal(confirmada.fechaRegistro, libre.fechaRegistro);
      assert.equal(await pages.vendedor.evaluate('document.querySelectorAll(".venta-table tbody tr").length'), 2);
      assert.equal(await pages.vendedor.evaluate('!!document.querySelector(".venta-confirmacion")'), false);
      await anular(libre.idVenta); assert.deepEqual(await inventario(), inicial);
    });
    await t.test('Formulario sin archivo vincula receta; Regente aprueba, Vendedor confirma y FEFO conserva vínculos', async () => {
      medica = await guardarVenta('RX', ex.recetaLejana, 4); await confirmar(medica.idVenta, 409);
      receta = await registrarReceta(medica.idVenta); assert.equal(receta.resultadoRevision, null); assert.equal(receta.idVenta, medica.idVenta);
      assert.equal((await db.Receta.findByPk(receta.idReceta)).archivo_receta, null); assert.deepEqual(await inventario(), inicial);
      assert.equal(await pages.vendedor.evaluate('document.querySelector("main").textContent.includes("PII_UI_PACIENTE")'), false);
      await revisarReceta(receta, 'APROBADA'); assert.deepEqual(await inventario(), inicial);
      assert.equal((await db.Venta.findByPk(medica.idVenta)).estado_operacion, 'PENDIENTE');
      const confirmada = await confirmar(medica.idVenta);
      assert.deepEqual(confirmada.detalles.map(d => [d.idExistencia, d.cantidad, d.idReceta]), [[ex.recetaCercana.id_existencia, 2, receta.idReceta], [ex.recetaLejana.id_existencia, 2, receta.idReceta]]);
      await anular(medica.idVenta); assert.deepEqual(await inventario(), inicial);
      await pages.regente.navigate(`/ventas/${medica.idVenta}/recetas/${receta.idReceta}`); await ready(pages.regente);
      assert.equal(await pages.regente.evaluate('!!document.querySelector(".receta-revision")'), false);
    });
    await t.test('Rechazo, agotamiento, vencimiento y condición desconocida producen errores reales sin confirmar ni descontar', async () => {
      const rechazada = await guardarVenta('RX', ex.recetaLejana, 1), r = await registrarReceta(rechazada.idVenta);
      await revisarReceta(r, 'RECHAZADA'); await confirmar(rechazada.idVenta, 409); await anular(rechazada.idVenta);
      for (const [tipo, e] of [['ZERO', ex.sinStock], ['VEN', ex.vencida], ['UNK', ex.desconocida]]) {
        const v = await guardarVenta(tipo, e, 1); await confirmar(v.idVenta, 409);
        assert.equal((await db.Venta.findByPk(v.idVenta)).estado_operacion, 'PENDIENTE'); await anular(v.idVenta);
      }
      assert.deepEqual(await inventario(), inicial);
    });
    await t.test('Pérdida real de respuestas después del commit: claves, revisión, confirmación y anulación no se duplican', async () => {
      const perdida = await guardarVenta('LIB', ex.libreLejana, 1, '0.10', true);
      const start = browser.requests.length; await pages.vendedor.review('.venta-form'); await pages.vendedor.clickText('Guardar pendiente');
      const duplicada = await response(pages.vendedor, start, '/api/ventas'); assert.equal(duplicada.status, 409);
      assert.equal(await db.Venta.count({ where: { clave_operacion: perdida.claveOperacion } }), 1);
      await confirmar(perdida.idVenta, 200, true); assert.ok(await pages.vendedor.evaluate('document.querySelector(".venta-confirmacion > button").disabled'));
      await pages.vendedor.clickText('Actualizar'); await ready(pages.vendedor); assert.equal(await pages.vendedor.evaluate('!!document.querySelector(".venta-confirmacion")'), false);
      await anular(perdida.idVenta, true); assert.ok(await pages.admin.evaluate('document.querySelector(".venta-anular-form button[type=submit]").disabled'));
      await pages.admin.clickText('Actualizar'); await ready(pages.admin); assert.equal(await pages.admin.evaluate('!!document.querySelector(".venta-anular-form")'), false);
      const conReceta = await guardarVenta('RX', ex.recetaLejana, 1); const r = await registrarReceta(conReceta.idVenta, true);
      assert.ok(await pages.vendedor.evaluate('document.querySelector(".receta-form button[type=submit]").disabled'));
      assert.equal(await db.Receta.count({ where: { id_venta: conReceta.idVenta } }), 1);
      await revisarReceta(r, 'APROBADA', true); await pages.regente.clickText('Actualizar receta'); await ready(pages.regente);
      assert.equal(await pages.regente.evaluate('!!document.querySelector(".receta-revision")'), false);
      await anular(conReceta.idVenta); assert.deepEqual(await inventario(), inicial);
    });
    await t.test('Permisos reales y navegación impiden accesos sensibles; móvil conserva el flujo', async () => {
      for (const name of ['admin', 'vendedor']) {
        const page = pages[name]; await page.navigate(`/ventas/${medica.idVenta}/recetas/${receta.idReceta}`); await page.wait('location.pathname === "/dashboard"');
        assert.equal((await page.request('GET', `/ventas/${medica.idVenta}/recetas/${receta.idReceta}`)).status, 403);
      }
      assert.equal((await pages.regente.request('POST', `/ventas/${medica.idVenta}/anular`, { motivo: 'No autorizado' })).status, 403);
      await pages.guest.navigate('/ventas'); await pages.guest.wait('location.pathname === "/login"');
      assert.equal((await pages.guest.request('GET', '/ventas')).status, 401);
      for (const page of [pages.admin, pages.regente, pages.vendedor]) {
        await page.mobile(); await navegarVenta(page, medica.idVenta); assert.ok(await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
        assert.equal(await page.evaluate('localStorage.length + sessionStorage.length'), 0);
      }
    });
    await t.test('Bitácora consulta los eventos reales y snapshots de revisión sin datos personales', async () => {
      const page = pages.admin; await page.viewport(1440);
      await page.navigate('/bitacora?modulo=VENTAS&tipoEvento=VENTA_ANULAR&tipoRegistro=VENTA&pagina=1&limite=25'); await page.ready('.bitacora-page'); await page.contains('Anulación de venta');
      assert.ok(await page.evaluate('document.querySelectorAll(".bitacora-table tbody tr").length > 0'));
      await page.navigate('/bitacora?modulo=RECETAS&tipoEvento=RECETA_REVISAR&tipoRegistro=RECETA&pagina=1&limite=25'); await page.ready('.bitacora-page'); await page.contains('Revisión de receta');
      const filas = await select("SELECT id_evento, antes, despues, metadatos FROM bitacora_auditoria WHERE tipo_evento='RECETA_REVISAR' AND resultado='EXITO' ORDER BY id_evento DESC"); assert.ok(filas.length > 0);
      assert.doesNotMatch(JSON.stringify(filas), /PII_UI_|nombrePaciente|documentoPaciente|nombreMedico|observacion/);
      await page.navigate(`/bitacora/${filas[0].id_evento}`); await page.ready('.bitacora-page'); await page.contains('Resultado de revisión');
      assert.equal(await page.evaluate('document.querySelector("main").textContent.includes("PII_UI_")'), false);
    });
    await t.test('Conciliación final: inventario, reversiones, trazabilidad y ausencia de errores JavaScript', async () => {
      assert.deepEqual(await inventario(), inicial);
      const divergencias = await select("SELECT e.id_existencia FROM existencia_medicamento e LEFT JOIN movimiento_inventario m ON m.id_existencia=e.id_existencia GROUP BY e.id_existencia,e.cantidad_fisica HAVING e.cantidad_fisica<>COALESCE(SUM(CASE WHEN m.direccion='ENTRADA' THEN m.cantidad ELSE -m.cantidad END),0) OR e.cantidad_fisica<0"); assert.deepEqual(divergencias, []);
      const invalidas = await select('SELECT r.id_movimiento FROM movimiento_inventario r JOIN movimiento_inventario o ON o.id_movimiento=r.id_movimiento_original WHERE r.id_existencia<>o.id_existencia OR r.cantidad<>o.cantidad OR r.costo_unitario_aplicado<>o.costo_unitario_aplicado OR r.direccion=o.direccion'); assert.deepEqual(invalidas, []);
      const duplicadas = await select('SELECT id_movimiento_original FROM movimiento_inventario WHERE id_movimiento_original IS NOT NULL GROUP BY id_movimiento_original HAVING COUNT(*)>1'); assert.deepEqual(duplicadas, []);
      assert.deepEqual(browser.errors, []);
      assert.ok(logs.every(entrada => entrada?.statusCode < 500), 'No debe haber errores internos del backend durante la aceptación');
      t.diagnostic(`${browser.requests.filter(r => r.response).length} respuestas HTTP reales; ${browser.requests.filter(r => r.method === 'POST' && r.path.startsWith('/api/ventas')).length} POST de negocio; ${browser.requests.filter(r => r.dropped).length} respuestas descartadas después del commit.`);
    });
  } finally {
    try {
      await browser?.close();
      if (frontend && frontend.exitCode === null) { const exited = new Promise(resolve => frontend.once('exit', resolve)); frontend.kill(); await exited; }
      if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
      await db?.sequelize.close();
      if (creada) {
        assert.match(database, /^cadefar_ventas_ui_[a-f0-9]{16}$/); assert.ok(protegidas.every(nombre => nombre.toLowerCase() !== database.toLowerCase()));
        await connection.query(`DROP DATABASE \`${database}\``);
        const [rows] = await connection.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [database]); assert.equal(rows.length, 0);
        t.diagnostic('Base temporal local eliminada y ausencia verificada; bases existentes no utilizadas.');
      }
    } finally { await connection?.end(); if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
  }
});
