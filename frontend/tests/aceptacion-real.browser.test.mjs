// Aceptación React -> Express -> MySQL local: crea/migra/elimina solo una base
// aleatoria. No ejecuta seeders ni suites que escriban en DB_NAME/DB_NAME_TEST.
// Node >=22, Chrome/Edge y dependencias ya instaladas de ambos proyectos.
// Ejecutar desde frontend: node --test tests/aceptacion-real.browser.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegadorReal, esperar } from './helpers/navegadorReal.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const backend = fileURLToPath(new URL('../../backend/', import.meta.url));
const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
const dotenv = requireBackend('dotenv');
dotenv.config({ path: join(backend, '.env'), quiet: true });
const mysql = requireBackend('mysql2/promise');
const bcrypt = requireBackend('bcrypt');
const exec = promisify(execFile);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const identifiers = (value) => { assert.match(value, /^[a-zA-Z0-9_]+$/); return `\`${value}\``; };
const protectedNames = [...new Set([process.env.DB_NAME, process.env.DB_NAME_TEST, process.env.DB_NAME_PRODUCTION].filter(Boolean))];
const temporaryDatabase = `cadefar_e2e_${randomBytes(8).toString('hex')}`;
assert.ok(process.env.DB_NAME_TEST, 'Configurar DB_NAME_TEST en backend');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), 'Usar únicamente MySQL local');
assert.ok(protectedNames.every(name => name.toLowerCase() !== temporaryDatabase.toLowerCase()));
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = temporaryDatabase;
process.env.JWT_SECRET = `sintetico_e2e_${randomBytes(24).toString('hex')}`;
const password = 'Aceptacion-Sintetica-123!';
const protectedFile = join(backend, 'tests/compra.integration.test.js');

// Huellas de datos y SHOW CREATE TABLE. Acceso exclusivamente SELECT/SHOW a
// bases protegidas; decimales, enteros grandes y fechas permanecen como texto.
const fingerprint = async (connection, name) => {
  const [schemas] = await connection.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [name]);
  if (!schemas.length) return { exists: false, tables: 0, sha256: hash('base ausente') };
  const [tables] = await connection.query('SELECT TABLE_NAME AS nombre FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = \'BASE TABLE\' ORDER BY TABLE_NAME', [name]);
  const state = [];
  await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
  try {
    for (const { nombre } of tables) {
      const table = `${identifiers(name)}.${identifiers(nombre)}`;
      const [schema] = await connection.query(`SHOW CREATE TABLE ${table}`);
      const [rows] = await connection.query(`SELECT * FROM ${table}`);
      const serialized = rows.map(row => JSON.stringify(Object.fromEntries(Object.keys(row).sort().map(key => [key, row[key]])))).sort();
      state.push({ table: nombre, schema: schema[0]['Create Table'], rows: serialized });
    }
  } finally { await connection.query('ROLLBACK'); }
  return { exists: true, tables: tables.length, sha256: hash(JSON.stringify(state)) };
};

test('Aceptación real de Inventario/Compras: React, cookies, roles y concurrencia MySQL en base temporal', { timeout: 300000 }, async (t) => {
  let connection, db, server, vite, browser, profile, created = false, before, fileBefore;
  const frontendOrigin = 'http://127.0.0.1:5179';
  const transactions = new Set();
  try {
    fileBefore = hash(await readFile(protectedFile));
    connection = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.PASSWORD_DB, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
    before = {};
    for (const name of protectedNames) before[name] = await fingerprint(connection, name);
    await connection.query(`CREATE DATABASE ${identifiers(temporaryDatabase)}`); created = true;
    await exec(process.execPath, [join(backend, 'node_modules/sequelize-cli/lib/sequelize'), 'db:migrate', '--env', 'test'], { cwd: backend, env: { ...process.env }, timeout: 60000 });
    ({ default: db } = await import('../../backend/src/data/models/index.js'));
    assert.equal(db.sequelize.config.database, temporaryDatabase);
    db.sequelize.options.logging = false;
    const { ROLES } = await import('../../backend/src/shared/constants/roles.js');
    const { obtenerFechaOperacion } = await import('../../backend/src/shared/utils/fecha-operacion.js');
    const today = obtenerFechaOperacion().fechaComercial;
    await db.Rol.bulkCreate(Object.entries(ROLES).map(([nombre, id_rol]) => ({ id_rol, nombre })));
    const passwordHash = await bcrypt.hash(password, 4);
    const users = {};
    for (const [name, role] of [['admin', ROLES.ADMINISTRADOR], ['admin2', ROLES.ADMINISTRADOR], ['regente', ROLES.REGENTE], ['regente2', ROLES.REGENTE], ['vendedor', ROLES.VENDEDOR]]) {
      users[name] = await db.Usuario.create({ nombre_usuario: `e2e_${name}`, id_rol: role, password_hash: passwordHash });
    }
    const provider = await db.ProveedorLaboratorio.create({ nombre: 'Laboratorio sintético E2E' });
    const inactiveProvider = await db.ProveedorLaboratorio.create({ nombre: 'Proveedor inactivo E2E', estado: false });
    const med = async (codigo, extra = {}) => db.Medicamento.create({ id_proveedor_laboratorio: provider.id_proveedor_laboratorio, codigo_medicamento: codigo,
      nombre_comercial: `Producto ${codigo}`, forma_farmaceutica: 'Tableta', presentacion: '500 mg', unidad_inventario: 'tableta', stock_minimo: 10,
      condicion_venta: 'Venta libre', via_administracion: 'Oral', tipo_liberacion: 'Inmediata', ...extra });
    const meds = {};
    for (const code of ['B1', 'A', 'RACE', 'CAD', 'MES', 'NEAR', 'ZERO', 'MAX']) meds[code] = await med(code);
    meds.INAC = await med('INAC', { estado: false, id_proveedor_laboratorio: inactiveProvider.id_proveedor_laboratorio });
    const civil = value => db.Sequelize.fn('STR_TO_DATE', value, '%Y-%m-%d %H:%i:%s');
    const seedMovement = (e, cantidad, direccion = 'ENTRADA') => db.MovimientoInventario.create({ id_existencia: e.id_existencia, id_usuario: users.regente.id_usuario,
      direccion, cantidad, costo_unitario_aplicado: e.costo_unitario_promedio, motivo: 'AJUSTE', observacion: 'Saldo inicial sintético E2E', fecha_movimiento: civil(`${today} 00:01:00`) });
    const existence = async (code, date, precision, stock, cost) => {
      const e = await db.ExistenciaMedicamento.create({ id_medicamento: meds[code].id_medicamento, codigo_existencia: `${code}-001`, fecha_vencimiento: date,
        precision_vencimiento: precision, cantidad_fisica: stock, costo_unitario_promedio: cost });
      if (stock) await seedMovement(e, stock);
      return e;
    };
    const currentMonth = `${today.slice(0, 7)}-15`;
    const nextMonth = new Date(`${today.slice(0, 7)}-01T12:00:00Z`); nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const ex = {
      A: await existence('A', '2099-03-31', 'MES', 10, '2.000000'),
      RACE: await existence('RACE', '2099-01-01', 'DIA', 10, '2.000000'),
      CAD: await existence('CAD', '2000-01-01', 'DIA', 5, '1.123456'),
      INAC: await existence('INAC', '2000-02-15', 'MES', 4, '0.000000'),
      MES: await existence('MES', currentMonth, 'MES', 3, '0.123456'),
      NEAR: await existence('NEAR', `${nextMonth.toISOString().slice(0, 7)}-15`, 'MES', 3, '0.123456'),
      ZERO: await existence('ZERO', '2099-01-01', 'DIA', 0, '5.000000'),
      MAX: await existence('MAX', '2000-01-01', 'DIA', 2147483647, '99999999.999999')
    };
    await seedMovement(ex.ZERO, 1); await seedMovement(ex.ZERO, 1, 'SALIDA');
    const select = (sql, replacements = {}, transaction) => {
      assert.equal(db.sequelize.config.database, temporaryDatabase);
      return db.sequelize.query(sql, { type: db.Sequelize.QueryTypes.SELECT, replacements, ...(transaction ? { transaction } : {}) });
    };
    const row = async e => (await select('SELECT cantidad_fisica AS stock, CAST(costo_unitario_promedio AS CHAR) AS costo FROM existencia_medicamento WHERE id_existencia = :id', { id: e.id_existencia }))[0];
    const movementCount = async e => Number((await select('SELECT COUNT(*) AS total FROM movimiento_inventario WHERE id_existencia = :id', { id: e.id_existencia }))[0].total);
    process.env.FRONTEND_URL = frontendOrigin;
    const { app } = await import('../../backend/src/app.js');
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const apiUrl = `http://127.0.0.1:${server.address().port}/api`;
    profile = await mkdtemp(join(process.env.LOCALAPPDATA, 'Temp', 'opencode', 'cadefar-e2e-'));
    const outDir = join(profile, 'app');
    vite = spawn(process.execPath, ['--input-type=module', '--eval', `import {build,preview} from 'vite'; const outDir=${JSON.stringify(outDir)}; await build({logLevel:'warn',build:{outDir,emptyOutDir:true}}); const server=await preview({build:{outDir},preview:{host:'127.0.0.1',port:5179,strictPort:true}}); server.printUrls();`], { cwd: root, env: { ...process.env, NODE_ENV: 'production', VITE_API_URL: apiUrl }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error(`Vite Preview no inició en 5179: ${output.slice(-2000)}`)), 20000);
      vite.stdout.on('data', chunk => { output += chunk.toString().replace(/\x1b\[[0-9;]*m/g, ''); if (output.includes('127.0.0.1:5179')) { clearTimeout(timeout); resolve(); } });
      vite.stderr.on('data', chunk => { output += chunk.toString().replace(/\x1b\[[0-9;]*m/g, ''); });
      vite.once('error', error => { clearTimeout(timeout); reject(error); }); vite.once('exit', () => { clearTimeout(timeout); reject(new Error(`Vite Preview terminó antes de iniciar: ${output.slice(-2000)}`)); });
    });
    browser = await abrirNavegadorReal({ profile: join(profile, 'chrome'), origin: frontendOrigin, apiUrl });
    const pages = {};
    for (const name of Object.keys(users)) pages[name] = await browser.openSession(name);
    const login = async (page, name) => {
      await page.navigate('/login'); await page.wait('!!document.getElementById("nombreUsuario")');
      await page.field('#nombreUsuario', `e2e_${name}`); await page.field('#password', password);
      await page.click('.login-form button[type=submit]'); await page.wait('location.pathname === "/dashboard"');
    };
    const lastResponse = async (page, path, count) => esperar(() => browser.requests.slice(count).find(r => r.session === page.name && r.method === 'POST' && r.path === path && r.response), `respuesta real ${path}`);
    const rutaEx = e => `/inventario/medicamentos/${e.id_medicamento}/existencias`;
    const rutaAjuste = e => `${rutaEx(e)}/${e.id_existencia}/ajuste`;
    const rutaRetiro = (e, tipo) => `${rutaEx(e)}/${e.id_existencia}/retiro-${tipo}`;
    const prepareAdjustment = async (page, e, stock, cost) => {
      await page.navigate(rutaAjuste(e)); await page.ready(); await page.field('#ajuste-saldo', stock);
      await page.field('#ajuste-observacion', 'Conteo sintético E2E');
      if (cost) await page.field('#ajuste-costo', cost);
    };
    const adjust = async (page, e, stock, cost) => {
      await prepareAdjustment(page, e, stock, cost); const count = browser.requests.length;
      await page.review('.ajuste-form'); await page.clickText('Confirmar conteo');
      const response = await lastResponse(page, '/api/inventario/ajustes', count);
      await page.contains(response.status === 200 ? 'No fue necesario ajustar' : 'Ajuste registrado'); return response.response.data;
    };
    const prepareWithdrawal = async (page, e, tipo, qty) => {
      await page.navigate(rutaRetiro(e, tipo)); await page.ready(); await page.field('#retiro-cantidad', qty);
      if (tipo === 'dano') await page.field('#retiro-observacion', 'Envase dañado E2E');
    };
    const withdraw = async (page, e, tipo, qty) => {
      await prepareWithdrawal(page, e, tipo, qty); const count = browser.requests.length;
      await page.review('.retiro-form'); await page.clickText('Confirmar retiro');
      const response = await lastResponse(page, `/api/inventario/retiros/${tipo}`, count); assert.equal(response.status, 201);
      await page.contains('registrado'); return response.response.data;
    };
    const createPurchase = async (page, code, key, lines) => {
      await page.navigate('/compras/nueva'); await page.ready();
      await page.field('#compra-fecha', today); await page.field('#compra-nueva-clave', key);
      for (let i = 0; i < lines.length; i++) {
        if (i) await page.clickText('Agregar línea');
        const prefix = `.compra-linea:nth-of-type(${i + 1})`;
        await page.select(`${prefix} [name=idMedicamento]`, meds[code].id_medicamento);
        await page.field(`${prefix} [name=cantidad]`, lines[i].cantidad);
        await page.field(`${prefix} [name=costoUnitario]`, lines[i].costo);
        await page.select(`${prefix} [name=precisionVencimiento]`, 'MES');
        await page.field(`${prefix} [name=fechaVencimiento]`, '2099-03');
      }
      await page.review('.compra-form'); const count = browser.requests.length;
      await page.clickText('Confirmar registro'); return lastResponse(page, '/api/compras', count);
    };
    const prepareAnnul = async (page, id, motive) => {
      await page.navigate(`/compras/${id}`); await page.ready(); await page.field('#compra-anular-motivo', motive); await page.review('.compra-anular-form');
    };
    const annul = async (page, id) => {
      await prepareAnnul(page, id, 'Corrección de adquisición E2E'); const count = browser.requests.length;
      await page.clickText('Confirmar anulación'); const response = await lastResponse(page, `/api/compras/${id}/anular`, count);
      await page.contains('Compra anulada. El estado'); assert.equal(response.status, 200); return response.response.data;
    };
    const lock = async (table, column, id) => {
      const transaction = await db.sequelize.transaction(); transactions.add(transaction);
      await select(`SELECT ${column} FROM ${table} WHERE ${column} = :id FOR UPDATE`, { id }, transaction); return transaction;
    };
    const release = async transaction => { await transaction.commit(); transactions.delete(transaction); };
    const waitTwoBlockers = async transaction => {
      const [{ id }] = await select('SELECT CONNECTION_ID() AS id', {}, transaction);
      await esperar(async () => {
        const [{ total }] = await select('SELECT COUNT(DISTINCT w.REQUESTING_ENGINE_TRANSACTION_ID) AS total FROM performance_schema.data_lock_waits w JOIN performance_schema.threads th ON th.THREAD_ID = w.BLOCKING_THREAD_ID WHERE th.PROCESSLIST_ID = :id', { id });
        return Number(total) >= 2;
      }, 'dos transacciones HTTP reales esperando en InnoDB');
    };

    await t.test('Login real en cinco sesiones independientes, cookie HttpOnly, CORS y restauración por recarga', async () => {
      for (const [name, page] of Object.entries(pages)) {
        await login(page, name);
        const cookies = await page.cookies(); assert.equal(cookies.filter(c => c.name === 'token').length, 1);
        assert.ok(cookies.find(c => c.name === 'token').httpOnly);
        assert.equal(await page.evaluate('document.cookie.includes("token=")'), false);
        assert.equal(await page.evaluate('localStorage.length + sessionStorage.length'), 0);
        await page.navigate('/inventario'); await page.ready();
        assert.ok(await page.evaluate(`document.body.textContent.includes('e2e_${name}')`));
      }
    });
    await t.test('Roles reales: restricciones de rutas/acciones y rechazo HTTP 403 sin efectos', async () => {
      for (const page of [pages.admin, pages.vendedor]) {
        await page.navigate(rutaAjuste(ex.RACE)); await page.wait('location.pathname === "/dashboard"');
        const result = await page.request('POST', '/inventario/ajustes', { idExistencia: ex.RACE.id_existencia, saldoContado: 0, stockObservado: 10, ultimoMovimientoObservado: null, observacion: 'No autorizado' });
        assert.equal(result.status, 403);
        for (const tipo of ['vencimiento', 'dano']) assert.equal((await page.request('POST', `/inventario/retiros/${tipo}`, {})).status, 403);
      }
      for (const page of [pages.regente, pages.vendedor]) {
        await page.navigate('/compras/nueva'); await page.wait('location.pathname === "/dashboard"');
        assert.equal((await page.request('POST', '/compras', {})).status, 403);
        assert.equal((await page.request('POST', '/compras/1/anular', { motivo: 'No autorizado' })).status, 403);
      }
      assert.equal((await pages.vendedor.request('GET', '/compras')).status, 403);
      assert.equal((await pages.vendedor.request('GET', '/inventario/movimientos')).status, 403);
      await pages.admin.navigate(rutaEx(ex.RACE)); await pages.admin.ready();
      assert.equal(await pages.admin.evaluate('!!document.querySelector("a[href$=\\"/ajuste\\"], a[href*=\\"/retiro-\\"]")'), false);
      assert.deepEqual(await row(ex.RACE), { stock: 10, costo: '2.000000' });
    });
    let b1Purchase, aPurchase;
    await t.test('CU25 -> CU26 -> CU22: compra real con líneas repetidas, snapshots comunes y decimales exactos', async () => {
      const response = await createPurchase(pages.admin, 'B1', ' E2E-B1 ', [{ cantidad: 2, costo: '0.123456' }, { cantidad: 3, costo: '0.000001' }]);
      assert.equal(response.status, 201); b1Purchase = response.response.data;
      await pages.admin.wait(`location.pathname === '/compras/${b1Purchase.idCompra}'`); await pages.admin.ready();
      assert.equal(b1Purchase.claveOperacion, 'e2e-b1'); assert.equal(b1Purchase.total, '0.25');
      assert.equal(await pages.admin.evaluate('document.querySelectorAll(".compra-table tbody tr").length'), 2);
      assert.equal(await pages.admin.evaluate('document.querySelector(".compra-total").textContent'), '0,25');
      const ids = b1Purchase.detalles.map(d => d.idExistencia); assert.equal(new Set(ids).size, 1);
      ex.B1 = { id_existencia: ids[0], id_medicamento: meds.B1.id_medicamento };
      assert.deepEqual(await row(ex.B1), { stock: 5, costo: '0.049383' });
      const snapshots = await select('SELECT saldo_anterior AS saldo, CAST(costo_promedio_anterior AS CHAR) AS costo FROM detalle_compra WHERE id_compra = :id', { id: b1Purchase.idCompra });
      assert.deepEqual(snapshots, [{ saldo: 0, costo: '0.000000' }, { saldo: 0, costo: '0.000000' }]);
      await pages.regente.navigate(rutaEx(ex.B1)); await pages.regente.ready();
      assert.ok(await pages.regente.evaluate('document.querySelector(".inventario-table").textContent.includes("0,049383")'));
      await pages.admin.screenshot('e2e-compra-repetida.png');
    });
    await t.test('CU23 sin diferencia no agrega movimiento; CU27 B1 restaura estado previo y preserva originales', async () => {
      const count = await movementCount(ex.B1);
      const result = await adjust(pages.regente, ex.B1, 5);
      assert.equal(result.ajusteRealizado, false); assert.equal(result.movimiento, null); assert.equal(await movementCount(ex.B1), count);
      const beforeDetails = await select('SELECT * FROM detalle_compra WHERE id_compra = :id ORDER BY id_detalle_compra', { id: b1Purchase.idCompra });
      await annul(pages.admin, b1Purchase.idCompra); assert.deepEqual(await row(ex.B1), { stock: 0, costo: '0.000000' });
      assert.deepEqual(await select('SELECT * FROM detalle_compra WHERE id_compra = :id ORDER BY id_detalle_compra', { id: b1Purchase.idCompra }), beforeDetails);
      assert.equal(await movementCount(ex.B1), count * 2);
      await pages.regente.navigate(`/inventario/movimientos?idExistencia=${ex.B1.id_existencia}`); await pages.regente.ready();
      assert.ok(await pages.regente.evaluate('document.querySelector(".inventario-table").textContent.includes("ANULACION_COMPRA")'));
      const reversals = await select('SELECT r.id_movimiento_original AS original, r.cantidad, CAST(r.costo_unitario_aplicado AS CHAR) AS costo, r.id_detalle_compra AS detalle FROM movimiento_inventario r WHERE r.id_existencia = :id AND r.motivo = \'ANULACION_COMPRA\' ORDER BY r.id_movimiento', { id: ex.B1.id_existencia });
      assert.equal(reversals.length, 2); assert.equal(new Set(reversals.map(r => r.original)).size, 2);
      assert.deepEqual(reversals.map(r => [r.cantidad, r.costo]), [[2, '0.123456'], [3, '0.000001']]);
    });
    await t.test('CU25 -> CU36 -> CU27 A: reutiliza existencia MES histórica y compensa con movimientos posteriores', async () => {
      const response = await createPurchase(pages.admin, 'A', 'e2e-a', [{ cantidad: 2, costo: '2.000000' }]); aPurchase = response.response.data;
      assert.equal(aPurchase.detalles[0].idExistencia, ex.A.id_existencia); assert.deepEqual(await row(ex.A), { stock: 12, costo: '2.000000' });
      const damage = await withdraw(pages.regente, ex.A, 'dano', 2); assert.equal(damage.perdida, '4.00');
      await annul(pages.admin, aPurchase.idCompra); assert.deepEqual(await row(ex.A), { stock: 8, costo: '2.000000' });
      await pages.vendedor.navigate(rutaEx(ex.A)); await pages.vendedor.ready();
      assert.ok(await pages.vendedor.evaluate('document.querySelector(".inventario-table").textContent.includes("8")'));
    });
    await t.test('CU23 entrada/salida hasta cero actualiza promedio; consultas entre módulos reflejan el commit', async () => {
      const entry = await adjust(pages.regente, ex.A, 10, '4.000000'); assert.equal(entry.costoUnitarioPromedio, '2.400000');
      const exit = await adjust(pages.regente, ex.A, 0); assert.equal(exit.costoUnitarioPromedio, '2.400000');
      assert.deepEqual(await row(ex.A), { stock: 0, costo: '2.400000' });
      await pages.admin.navigate(rutaEx(ex.A)); await pages.admin.ready();
      const cells = await pages.admin.evaluate('[...document.querySelector(".inventario-table tbody tr").querySelectorAll("td")].map(td=>td.textContent)');
      assert.equal(cells[3], '0'); assert.equal(cells[4], '0'); assert.equal(cells[5], '2,400000');
    });
    await t.test('Vencimientos reales DIA/MES y catálogo inactivo conservan físico sin habilitarlo como vendible', async () => {
      for (const [e, physical, sellable, label] of [[ex.CAD, 5, 0, '01/01/2000'], [ex.INAC, 4, 0, '02/2000'], [ex.MES, 3, 3, `${today.slice(5, 7)}/${today.slice(0, 4)}`]]) {
        await pages.regente.navigate(rutaEx(e)); await pages.regente.ready();
        const cells = await pages.regente.evaluate('[...document.querySelector(".inventario-table tbody tr").querySelectorAll("td")].map(td=>td.textContent)');
        assert.equal(cells[3], String(physical)); assert.equal(cells[4], String(sellable)); assert.ok(cells[1].includes(label));
      }
      await pages.regente.navigate(rutaRetiro(ex.MES, 'vencimiento')); await pages.regente.ready(); await pages.regente.contains('todavía no está vencida');
      await pages.regente.navigate('/vencimientos'); await pages.regente.ready(); await pages.regente.contains('Producto NEAR');
      await pages.regente.navigate('/vencimientos/vencidos'); await pages.regente.ready(); await pages.regente.contains('Producto CAD'); await pages.regente.contains('Producto INAC');
    });
    await t.test('CU35/CU36 reales: bajas físicas parciales/totales, observación opcional y promedio cero/conservado', async () => {
      const expiration = await withdraw(pages.regente, ex.CAD, 'vencimiento', 2);
      assert.equal(expiration.perdida, '2.25'); assert.equal(expiration.movimiento.observacion, null);
      assert.deepEqual(await row(ex.CAD), { stock: 3, costo: '1.123456' });
      const damage = await withdraw(pages.regente, ex.INAC, 'dano', 1); assert.equal(damage.perdida, '0.00');
      const zero = await withdraw(pages.regente, ex.INAC, 'vencimiento', 3); assert.equal(zero.perdida, '0.00');
      assert.deepEqual(await row(ex.INAC), { stock: 0, costo: '0.000000' });
      assert.equal(await pages.regente.evaluate('document.querySelector(".retiro-perdida dd").textContent'), '0,00');
      await pages.regente.navigate('/vencimientos/vencidos'); await pages.regente.ready();
      assert.equal(await pages.regente.evaluate('document.querySelector(".inventario-table").textContent.includes("Producto INAC")'), false);
    });
    await t.test('Pérdida máxima real se conserva exactamente desde MySQL hasta React a 375px', async () => {
      await pages.regente.mobile();
      const result = await withdraw(pages.regente, ex.MAX, 'dano', 2147483647);
      assert.equal(result.perdida, '214748364699997852.52');
      assert.equal(await pages.regente.evaluate('document.querySelector(".retiro-perdida dd").textContent'), '214.748.364.699.997.852,52');
      assert.deepEqual(await row(ex.MAX), { stock: 0, costo: '99999999.999999' });
      assert.ok(await pages.regente.evaluate('document.documentElement.scrollWidth <= 375'));
      await pages.regente.evaluate('document.querySelector(".retiro-perdida").scrollIntoView({block:"center"})'); await pages.regente.screenshot('e2e-perdida-maxima-mobile.png');
    });
    await t.test('Dos Regentes: saldo restaurado con historial distinto produce 409 real y conserva borrador', async () => {
      await prepareWithdrawal(pages.regente2, ex.RACE, 'dano', 2);
      await withdraw(pages.regente, ex.RACE, 'dano', 1); await adjust(pages.regente, ex.RACE, 10, '2.000000');
      assert.deepEqual(await row(ex.RACE), { stock: 10, costo: '2.000000' }); const movements = await movementCount(ex.RACE);
      const count = browser.requests.length; await pages.regente2.review('.retiro-form'); await pages.regente2.clickText('Confirmar retiro');
      const response = await lastResponse(pages.regente2, '/api/inventario/retiros/dano', count); assert.equal(response.status, 409);
      await pages.regente2.wait('!document.querySelector("[role=dialog]")');
      assert.ok(await pages.regente2.evaluate('document.querySelector(".retiro-form button[type=submit]").disabled'));
      assert.equal(await movementCount(ex.RACE), movements);
      await pages.regente2.clickText('Volver a consultar la existencia'); await pages.regente2.ready();
      assert.equal(await pages.regente2.evaluate('document.getElementById("retiro-cantidad").value'), '2');
      assert.equal(await pages.regente2.evaluate('document.getElementById("retiro-observacion").value'), 'Envase dañado E2E');
    });
    await t.test('Carrera real de dos retiros: ambos esperan el mismo bloqueo InnoDB, solo uno confirma', async () => {
      await prepareWithdrawal(pages.regente, ex.RACE, 'dano', 2); await prepareWithdrawal(pages.regente2, ex.RACE, 'dano', 2);
      await Promise.all([pages.regente.review('.retiro-form'), pages.regente2.review('.retiro-form')]);
      const transaction = await lock('existencia_medicamento', 'id_existencia', ex.RACE.id_existencia), count = browser.requests.length, movements = await movementCount(ex.RACE);
      await Promise.all([pages.regente.clickText('Confirmar retiro'), pages.regente2.clickText('Confirmar retiro')]);
      await waitTwoBlockers(transaction); await release(transaction);
      const responses = await Promise.all([lastResponse(pages.regente, '/api/inventario/retiros/dano', count), lastResponse(pages.regente2, '/api/inventario/retiros/dano', count)]);
      assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]); assert.equal(await movementCount(ex.RACE), movements + 1);
      assert.deepEqual(await row(ex.RACE), { stock: 8, costo: '2.000000' });
      const loser = pages[responses.find(r => r.status === 409).session]; await loser.wait('!document.querySelector("[role=dialog]")');
      assert.ok(await loser.evaluate('document.querySelector(".retiro-form button[type=submit]").disabled'));
      await loser.clickText('Volver a consultar la existencia'); await loser.ready();
      assert.equal(await loser.evaluate('document.getElementById("retiro-cantidad").value'), '2');
    });
    await t.test('Carrera real de dos anulaciones: bloqueo de cabecera, un 200/un 409 y una reversión por original', async () => {
      const response = await createPurchase(pages.admin, 'B1', 'e2e-ann-race', [{ cantidad: 2, costo: '2' }]); const purchase = response.response.data;
      await prepareAnnul(pages.admin, purchase.idCompra, 'Anulación sesión uno'); await prepareAnnul(pages.admin2, purchase.idCompra, 'Anulación sesión dos');
      const transaction = await lock('compra', 'id_compra', purchase.idCompra), count = browser.requests.length;
      await Promise.all([pages.admin.clickText('Confirmar anulación'), pages.admin2.clickText('Confirmar anulación')]);
      await waitTwoBlockers(transaction); await release(transaction);
      const responses = await Promise.all([lastResponse(pages.admin, `/api/compras/${purchase.idCompra}/anular`, count), lastResponse(pages.admin2, `/api/compras/${purchase.idCompra}/anular`, count)]);
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
      const loser = pages[responses.find(r => r.status === 409).session]; await loser.wait('!document.querySelector("[role=dialog]")');
      await loser.clickText('Actualizar'); await loser.ready(); assert.equal(await loser.evaluate('!!document.querySelector(".compra-anular-form")'), false);
      const rows = await select('SELECT COUNT(*) AS total FROM movimiento_inventario m JOIN detalle_compra d ON d.id_detalle_compra=m.id_detalle_compra WHERE d.id_compra=:id AND m.id_movimiento_original IS NOT NULL', { id: purchase.idCompra });
      assert.equal(Number(rows[0].total), 1);
    });
    await t.test('Respuesta perdida después de commit real: CU25 recupera por clave y CU27 por ID sin duplicar efectos', async () => {
      await pages.admin.dropNextPost('/api/compras');
      const response = await createPurchase(pages.admin, 'B1', 'e2e-lost', [{ cantidad: 2, costo: '2' }]); assert.ok(response.dropped);
      await pages.admin.wait('!document.querySelector("[role=dialog]")'); await pages.admin.contains('No se pudo conectar');
      const purchase = response.response.data;
      assert.equal((await select('SELECT COUNT(*) AS total FROM compra WHERE clave_operacion=\'e2e-lost\''))[0].total, 1);
      await pages.admin.clickText('Consultar mi compra por clave'); await pages.admin.contains('Se encontró una compra propia');
      assert.ok(await pages.admin.evaluate('document.querySelector(".compra-form button[type=submit]").disabled'));
      await pages.admin.click(`.compra-recuperacion a[href="/compras/${purchase.idCompra}"]`); await pages.admin.wait(`location.pathname === '/compras/${purchase.idCompra}'`); await pages.admin.ready();
      await pages.admin.dropNextPost(`/api/compras/${purchase.idCompra}/anular`);
      await pages.admin.field('#compra-anular-motivo', 'Respuesta perdida real E2E'); await pages.admin.review('.compra-anular-form');
      const count = browser.requests.length; await pages.admin.clickText('Confirmar anulación');
      const ann = await lastResponse(pages.admin, `/api/compras/${purchase.idCompra}/anular`, count); assert.ok(ann.dropped);
      await pages.admin.wait('!document.querySelector("[role=dialog]")'); await pages.admin.contains('No fue posible confirmar el resultado');
      await pages.admin.clickText('Actualizar'); await pages.admin.ready();
      assert.equal(await pages.admin.evaluate('!!document.querySelector(".compra-anular-form")'), false);
      assert.ok(await pages.admin.evaluate('document.querySelector(".compra-anulacion").textContent.includes("Respuesta perdida real E2E")'));
      assert.equal(browser.requests.slice(count).filter(r => r.method === 'POST' && r.path.endsWith('/anular')).length, 1);
      assert.equal(browser.requests.filter(r => r.dropped).length, 2);
    });
    await t.test('Sesión pública obsoleta tras logout real en otra pestaña: 401 y navegación completa al login', async () => {
      await pages.vendedor.navigate('/inventario'); await pages.vendedor.ready();
      const otherTab = await browser.openSession('vendedor-logout', pages.vendedor.browserContextId);
      await otherTab.navigate('/inventario'); await otherTab.ready();
      await otherTab.click('button[aria-label="Cerrar sesión"]'); await otherTab.wait('location.pathname === "/login"');
      await pages.vendedor.clickText('Actualizar'); await pages.vendedor.ready(); await pages.vendedor.contains('Tu sesión ya no es válida');
      await pages.vendedor.click('a[href="/login"]'); await pages.vendedor.wait('location.pathname === "/login" && !!document.getElementById("nombreUsuario")');
      assert.equal((await pages.vendedor.request('GET', '/inventario')).status, 401);
    });
    await t.test('Conciliación SQL final: saldos, snapshots, reversiones y horas civiles; sin errores JS ni secretos públicos', async () => {
      const divergences = await select('SELECT e.id_existencia FROM existencia_medicamento e LEFT JOIN movimiento_inventario m ON m.id_existencia=e.id_existencia GROUP BY e.id_existencia,e.cantidad_fisica HAVING e.cantidad_fisica<>COALESCE(SUM(CASE WHEN m.direccion=\'ENTRADA\' THEN m.cantidad ELSE -m.cantidad END),0) OR e.cantidad_fisica<0');
      assert.deepEqual(divergences, []);
      const incompatible = await select('SELECT r.id_movimiento FROM movimiento_inventario r JOIN movimiento_inventario o ON o.id_movimiento=r.id_movimiento_original WHERE r.id_existencia<>o.id_existencia OR r.cantidad<>o.cantidad OR r.costo_unitario_aplicado<>o.costo_unitario_aplicado OR r.direccion=o.direccion OR r.id_detalle_compra<>o.id_detalle_compra');
      assert.deepEqual(incompatible, []);
      const hours = await select("SELECT DATE_FORMAT(c.fecha_registro,'%Y-%m-%d %H:%i:%s') AS compra, DATE_FORMAT(m.fecha_movimiento,'%Y-%m-%d %H:%i:%s') AS movimiento FROM compra c JOIN detalle_compra d ON d.id_compra=c.id_compra JOIN movimiento_inventario m ON m.id_detalle_compra=d.id_detalle_compra WHERE m.motivo='COMPRA'");
      assert.ok(hours.length > 0 && hours.every(r => r.compra === r.movimiento && r.compra.startsWith(today)));
      assert.deepEqual(browser.errors, []);
      for (const request of browser.requests.filter(r => r.response)) assert.equal(/"(?:password|password_hash|passwordHash|token|correo|versionCredenciales|version_credenciales)"\s*:/.test(JSON.stringify(request.response)), false);
      t.diagnostic(`${temporaryDatabase}: ${browser.requests.filter(r => r.response).length} respuestas HTTP reales observadas; ${browser.requests.filter(r => r.method === 'POST' && /\/(compras|inventario)/.test(r.path)).length} POST de negocio reales, ${browser.requests.filter(r => r.dropped).length} respuestas descartadas después del commit.`);
    });
  } finally {
    // Liberar bloqueos incluso si falla la aceptación, cerrar procesos y borrar
    // únicamente el nombre aleatorio generado por esta ejecución.
    try {
      for (const transaction of transactions) if (!transaction.finished) await transaction.rollback();
      await browser?.close(); vite?.kill();
      if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
      await db?.sequelize.close();
      if (created) {
        await connection.query(`DROP DATABASE ${identifiers(temporaryDatabase)}`);
        const [rows] = await connection.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [temporaryDatabase]); assert.equal(rows.length, 0);
        t.diagnostic(`Base temporal ${temporaryDatabase} eliminada y ausencia confirmada.`);
      }
      if (before) {
        for (const name of Object.keys(before)) {
          const after = await fingerprint(connection, name); assert.deepEqual(after, before[name], `Datos/esquema de ${name} conservados`);
          t.diagnostic(`${name}: ${after.tables} tablas, huella antes/después idéntica ${after.sha256}`);
        }
      }
      if (fileBefore) assert.equal(hash(await readFile(protectedFile)), fileBefore, 'Test backend de Compras preservado');
    } finally { await connection?.end(); if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }); }
  }
});
