// Fase 6: integración real focalizada. Opt-in externo, esquema nuevo y fixtures
// directos; nunca formularios operativos, respuestas fabricadas ni secretos en logs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearEntornoReportes } from '../../backend/tests/helpers/reportes-mysql.js';
import { abrirNavegadorReal, esperar } from './helpers/navegadorReal.mjs';
import { cantidad, costoDecimal, fechaCivil, horaCivil } from '../src/utils/presentacion.js';

test('CU38–CU41: React/Axios/cookie/Express/MySQL local autorizados', { timeout: 180000 }, async t => {
  // Debe proceder del comando de esta sesión, antes de cargar cualquier .env.
  assert.equal(process.env.REPORTES_MYSQL_ACCEPTANCE, 'CREAR_MIGRAR_FIXTURES_ELIMINAR_LOCAL');
  assert.notEqual(process.env.NODE_ENV, 'production');
  const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
  requireBackend('dotenv').config({ path: fileURLToPath(new URL('../../backend/.env', import.meta.url)), quiet: true });
  assert.notEqual(process.env.NODE_ENV, 'production');
  const entorno = await crearEntornoReportes(t);
  const { db } = entorno;
  let server, frontend, profile, browser;
  const sql = [], unexpected = [];
  try {
    db.sequelize.options.logging = false;
    const civil = value => db.Sequelize.fn('STR_TO_DATE', value, '%Y-%m-%d %H:%i:%s');
    const password = randomBytes(24).toString('hex');
    const hash = await requireBackend('bcrypt').hash(password, 4);
    await db.Rol.bulkCreate(['ADMINISTRADOR', 'REGENTE', 'VENDEDOR'].map((nombre, i) => ({ id_rol: i + 1, nombre })));
    const users = [];
    for (let i = 1; i <= 3; i++) users.push(await db.Usuario.create({ id_rol: i, nombre_usuario: `reportes_ui_${i}`, password_hash: hash }));
    const proveedor = await db.ProveedorLaboratorio.create({ nombre: 'Proveedor sintético F6', estado: false });
    const med = await db.Medicamento.create({ id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio,
      codigo_medicamento: 'UIF6', nombre_comercial: 'Producto sintético histórico F6', forma_farmaceutica: 'Tableta',
      presentacion: '500 mg', unidad_inventario: 'tableta', condicion_venta: 'LIBRE', via_administracion: 'Oral', tipo_liberacion: 'Inmediata', estado: false });
    const ex = await db.ExistenciaMedicamento.create({ id_medicamento: med.id_medicamento, codigo_existencia: 'UIF6-001',
      fecha_vencimiento: '2020-01-31', precision_vencimiento: 'MES', cantidad_fisica: 1, costo_unitario_promedio: '99.000000' });
    const ventas = [];
    for (const [i, estado] of ['CONFIRMADA', 'PENDIENTE', 'ANULADA', 'ANULADA'].entries()) ventas.push(await db.Venta.create({
      id_usuario: users[2].id_usuario, estado_operacion: estado, total: '12345678.91', clave_operacion: `ui-f6-v-${i}`,
      fecha_registro: civil(i === 1 || i === 3 ? '2026-11-10 23:59:59' : '2026-10-01 12:00:00'),
      fecha_venta: i === 1 || i === 3 ? null : civil('2026-11-10 00:00:00'),
      fecha_anulacion: i > 1 ? civil('2026-12-01 10:00:00') : null }));
    const compras = [];
    for (const [i, estado] of ['CONFIRMADA', 'ANULADA'].entries()) compras.push(await db.Compra.create({
      id_usuario: users[0].id_usuario, id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio, estado_operacion: estado,
      total: '12345678.91', clave_operacion: `ui-f6-c-${i}`, fecha_compra: '2026-11-10',
      fecha_registro: civil('2026-12-02 12:00:00'), fecha_anulacion: i ? civil('2026-12-03 10:00:00') : null }));
    const dc = await db.DetalleCompra.create({ id_compra: compras[0].id_compra, id_existencia: ex.id_existencia, cantidad: 5, costo_unitario: '0.005000', subtotal: '0.03' });
    const movement = (motivo, fecha, extra = {}) => db.MovimientoInventario.create({ id_usuario: users[1].id_usuario,
      id_existencia: ex.id_existencia, direccion: 'SALIDA', motivo, cantidad: 1, costo_unitario_aplicado: '0.005000',
      fecha_movimiento: civil(fecha), observacion: 'Trazabilidad sintética F6', ...extra });
    await movement('COMPRA', '2026-10-01 12:00:00', { direccion: 'ENTRADA', cantidad: 5, id_detalle_compra: dc.id_detalle_compra });
    const retiros = [await movement('VENCIMIENTO', '2026-11-10 00:00:00'), await movement('VENCIMIENTO', '2026-11-10 23:59:59'),
      await movement('DAÑO', '2026-11-10 12:00:00', { cantidad: 3, costo_unitario_aplicado: '0.000000' })];
    const reversal = await movement('VENCIMIENTO', '2026-12-10 12:00:00', { direccion: 'ENTRADA', id_movimiento_original: retiros[0].id_movimiento });
    const snapshot = async () => JSON.stringify(await Promise.all(Object.values(db).filter(m => m?.tableName && m !== db.BitacoraAuditoria)
      .map(m => m.findAll({ raw: true, order: [[m.primaryKeyAttribute, 'ASC']] }))));
    const initial = await snapshot();
    db.sequelize.options.logging = statement => sql.push(statement);

    const tempRoot = join(process.env.LOCALAPPDATA, 'Temp', 'opencode');
    profile = await mkdtemp(join(tempRoot, 'cadefar-reportes-real-'));
    frontend = createServer(async (req, res) => {
      const path = new URL(req.url, 'http://127.0.0.1').pathname;
      if (path.startsWith('/api/')) { res.writeHead(500); res.end(); return; }
      try {
        const file = join(profile, 'app', path.startsWith('/assets/') ? path : 'index.html');
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.html': 'text/html' }[extname(file)] || 'application/octet-stream' }); res.end(body);
      } catch { res.writeHead(404); res.end(); }
    });
    await new Promise((resolve, reject) => { frontend.once('error', reject); frontend.listen(0, '127.0.0.1', resolve); });
    const origin = `http://127.0.0.1:${frontend.address().port}`;
    process.env.FRONTEND_URL = origin;
    const { app } = await import('../../backend/src/app.js');
    server = createServer((req, res) => {
      const path = new URL(req.url, origin).pathname;
      const allowed = req.method === 'OPTIONS' || req.method === 'POST' && path === '/api/auth/login'
        || req.method === 'GET' && (/^\/api\/(auth\/me|reportes\/(ventas|compras|perdidas)|inventario\/movimientos)$/.test(path) || /^\/api\/(ventas|compras)\/\d+$/.test(path));
      if (!allowed) { unexpected.push(`${req.method} ${path}`); res.writeHead(405); res.end('{}'); return; }
      app(req, res);
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const apiUrl = `http://127.0.0.1:${server.address().port}/api`;
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--input-type=module', '--eval', `import {build} from 'vite'; await build({logLevel:'silent',build:{outDir:${JSON.stringify(join(profile, 'app'))},emptyOutDir:true}});`],
        { cwd: fileURLToPath(new URL('../', import.meta.url)), env: { ...process.env, NODE_ENV: 'production', VITE_API_URL: apiUrl }, stdio: 'ignore' });
      child.once('error', () => reject(new Error('No se pudo iniciar el build aislado')));
      child.once('exit', code => code === 0 ? resolve() : reject(new Error('Falló el build aislado')));
    });
    t.diagnostic('Frontend y Express en puertos efímeros loopback; build/perfil temporales; API real sin mocks.');
    browser = await abrirNavegadorReal({ profile: join(profile, 'chrome'), origin, apiUrl });
    const pages = [];
    const ready = (page, tipo) => page.ready(`.reporte-${tipo}-page`);
    const latest = async (page, start, tipo) => esperar(() => browser.requests.slice(start).find(r => r.session === page.name && r.path === `/api/reportes/${tipo}` && r.response), 'respuesta real de reporte');
    const query = async (page, tipo, params) => {
      const start = browser.requests.length;
      await page.navigate(`/reportes/${tipo}?${params}`); await ready(page, tipo);
      const request = await latest(page, start, tipo); assert.equal(request.status, 200); return request.response;
    };
    const expected = {
      ventas: { confirmadas: { cantidad: 1, importe: '12345678.91' }, pendientes: { cantidad: 1, importe: '12345678.91' },
        anuladasConfirmadas: { cantidad: 1, importe: '12345678.91' }, anuladasSinConfirmar: { cantidad: 1, importe: '12345678.91' }, totalVentasRealizadas: '12345678.91' },
      compras: { confirmadas: { cantidad: 1, importe: '12345678.91' }, anuladas: { cantidad: 1, importe: '12345678.91' }, totalComprasRealizadas: '12345678.91' },
      perdidas: { vencimiento: { cantidadRetiros: 2, cantidadRetirada: '2', perdida: '0.02' }, dano: { cantidadRetiros: 1, cantidadRetirada: '3', perdida: '0.00' }, cantidadRetiros: 3, cantidadRetirada: '5', perdidaTotal: '0.02' }
    };
    const checkRendered = async (page, tipo, body) => {
      const values = await page.evaluate('[...document.querySelectorAll(".reporte-resumen dd")].map(e=>e.textContent)');
      const summary = body.data.resumen;
      const expectedText = tipo === 'perdidas' ? ['vencimiento', 'dano'].map(key => `${cantidad(summary[key].cantidadRetiros)} retiros · Cantidad retirada: ${cantidad(summary[key].cantidadRetirada)} · Pérdida: ${costoDecimal(summary[key].perdida)}`)
        .concat(`${cantidad(summary.cantidadRetiros)} retiros · Cantidad retirada: ${cantidad(summary.cantidadRetirada)} · Pérdida total: ${costoDecimal(summary.perdidaTotal)}`)
        : (tipo === 'ventas' ? ['confirmadas', 'pendientes', 'anuladasConfirmadas', 'anuladasSinConfirmar'] : ['confirmadas', 'anuladas'])
          .map(key => `${summary[key].cantidad} ${tipo} · Importe: ${costoDecimal(summary[key].importe)}`).concat(costoDecimal(summary[tipo === 'ventas' ? 'totalVentasRealizadas' : 'totalComprasRealizadas']));
      assert.deepEqual(values, expectedText);
      const rows = await page.evaluate(`[...document.querySelectorAll('.reporte-${tipo}-table tbody tr')].map(r=>[...r.cells].map(c=>c.textContent))`);
      assert.equal(rows.length, body.data.detalle.length);
      const labels = { CONFIRMADA: 'Confirmada', PENDIENTE: 'Pendiente', ANULADA: 'Anulada', ANULADA_CONFIRMADA: 'Anulada confirmada', ANULADA_SIN_CONFIRMAR: 'Anulada sin confirmar' };
      for (const [i, row] of body.data.detalle.entries()) {
        if (tipo === 'ventas') assert.deepEqual(rows[i].slice(0, 8), [`#${row.idVenta}`, labels[row.estadoOperacion], labels[row.categoria], horaCivil(row.fechaReferencia), horaCivil(row.fechaRegistro), horaCivil(row.fechaVenta), horaCivil(row.fechaAnulacion), costoDecimal(row.total)]);
        else if (tipo === 'compras') assert.deepEqual(rows[i].slice(0, 8), [`#${row.idCompra}`, String(row.idProveedorLaboratorio), labels[row.estadoOperacion], fechaCivil(row.fechaReferencia), fechaCivil(row.fechaCompra), horaCivil(row.fechaRegistro), horaCivil(row.fechaAnulacion), costoDecimal(row.total)]);
        else assert.deepEqual(rows[i].slice(3, 11), [String(row.idUsuario), row.motivo === 'DAÑO' ? 'Daño' : 'Vencimiento', horaCivil(row.fechaReferencia), horaCivil(row.fechaMovimiento), cantidad(row.cantidad), costoDecimal(row.costoUnitarioAplicado), costoDecimal(row.perdida), row.idMovimientoReversion === null ? '—' : `#${row.idMovimientoReversion}`]);
      }
      await page.contains('America/La_Paz');
    };

    await t.test('Login real de tres roles, HttpOnly y recuperación de sesión sin almacenamiento JWT', async () => {
      for (let i = 0; i < 3; i++) {
        const page = await browser.openSession(`rol-${i + 1}`); pages.push(page);
        await page.navigate('/login'); await page.wait('!!document.getElementById("nombreUsuario")');
        await page.field('#nombreUsuario', users[i].nombre_usuario); await page.field('#password', password);
        await page.click('.login-form button[type=submit]'); await page.wait('location.pathname === "/dashboard"');
        const cookie = (await page.cookies()).find(c => c.name === 'token');
        assert.ok(cookie?.httpOnly); assert.equal(cookie.sameSite, 'Lax');
        assert.equal(await page.evaluate('document.cookie.includes("token=")'), false);
        await page.navigate('/dashboard'); await page.wait('!!document.querySelector(".dashboard-module-list")');
        assert.equal(await page.evaluate('localStorage.length + sessionStorage.length'), 0);
      }
    });
    const [admin, regente, vendedor] = pages;
    await t.test('Recorrido por rol CU38→CU39→CU40→CU41; Regente CU40→CU41; Vendedor sin paquete ni acceso directo', async () => {
      for (const [page, labels] of [[admin, ['Reporte de ventas', 'Reporte de compras', 'Historial de inventario', 'Consulta de pérdidas']], [regente, ['Historial de inventario', 'Consulta de pérdidas']]]) {
        await page.navigate('/dashboard'); await page.wait('!!document.querySelector(".dashboard-module-list")');
        await page.evaluate('[...document.querySelectorAll(".dashboard-module")].find(a=>a.querySelector("strong").textContent === "Reportes").click()');
        await page.ready(page === admin ? '.reporte-ventas-page' : '.inventario-page');
        const links = await page.evaluate('[...document.querySelectorAll(".app-sidebar a")].map(a=>a.textContent.trim())');
        if (page === regente) { assert.ok(!links.includes('Reporte de ventas')); assert.ok(!links.includes('Reporte de compras')); }
        for (const label of labels) {
          await page.evaluate(`[...document.querySelectorAll('.app-sidebar a')].find(a=>a.textContent.trim()===${JSON.stringify(label)}).click()`);
          await page.ready(label === 'Historial de inventario' ? '.inventario-page' : label === 'Consulta de pérdidas' ? '.reporte-perdidas-page' : label === 'Reporte de compras' ? '.reporte-compras-page' : '.reporte-ventas-page');
          assert.equal(await page.evaluate('document.querySelectorAll(".app-sidebar a[aria-current=page]").length'), 1);
        }
      }
      for (const page of [regente, vendedor]) for (const tipo of ['ventas', 'compras', 'perdidas']) {
        const allowed = page === regente && tipo === 'perdidas';
        assert.equal((await page.request('GET', `/reportes/${tipo}?dia=2026-11-10`)).status, allowed ? 200 : 403);
        if (!allowed) { await page.navigate(`/reportes/${tipo}?dia=2026-11-10`); await page.wait('location.pathname === "/dashboard"'); }
      }
      assert.equal((await vendedor.request('GET', '/inventario/movimientos')).status, 403);
      await vendedor.navigate('/inventario/movimientos'); await vendedor.wait('location.pathname === "/dashboard"');
      assert.equal(await vendedor.evaluate('[...document.querySelectorAll(".dashboard-module strong")].some(e=>e.textContent === "Reportes")'), false);
      const guest = await browser.openSession('sin-sesion');
      await guest.navigate('/login'); await guest.wait('!!document.getElementById("nombreUsuario")');
      assert.equal((await guest.request('GET', '/reportes/ventas?dia=2026-11-10')).status, 401);
    });
    for (const tipo of ['ventas', 'compras', 'perdidas']) await t.test(`${tipo}: selección explícita, modalidades, filtros, resumen completo, detalle paginado y vacío`, async () => {
      const withoutPeriod = browser.requests.length;
      await admin.navigate(`/reportes/${tipo}`); await ready(admin, tipo); await admin.contains('Selecciona un período');
      assert.equal(browser.requests.slice(withoutPeriod).filter(r => r.path === `/api/reportes/${tipo}`).length, 0);
      const start = browser.requests.length;
      await admin.select('#reporte-modalidad', 'dia'); await admin.field('#reporte-dia', '2026-11-10');
      await admin.click('.reporte-filters button[type=submit]'); await ready(admin, tipo);
      const day = (await latest(admin, start, tipo)).response;
      assert.deepEqual(day.data.resumen, expected[tipo]);
      assert.deepEqual(day.data.periodo, { modalidad: 'DIA', desde: '2026-11-10', hasta: '2026-11-10', zonaHoraria: 'America/La_Paz' });
      await checkRendered(admin, tipo, day);
      if (tipo === 'ventas') { assert.equal(day.data.detalle.filter(r => r.fechaVenta === null).length, 2); assert.ok(day.data.detalle.some(r => r.fechaReferencia === '2026-11-10 23:59:59')); assert.ok(day.data.detalle.every(r => r.total === '12345678.91')); }
      if (tipo === 'compras') assert.ok(day.data.detalle.every(r => r.fechaCompra === '2026-11-10' && r.fechaRegistro === '2026-12-02 12:00:00' && r.total === '12345678.91'));
      if (tipo === 'perdidas') { assert.equal(day.data.detalle.find(r => r.idMovimiento === retiros[0].id_movimiento).idMovimientoReversion, reversal.id_movimiento); assert.ok(day.data.detalle.some(r => r.idMovimientoReversion === null)); }
      for (const params of ['mes=2026-11', 'desde=2026-11-10&hasta=2026-11-10']) {
        const body = await query(admin, tipo, params); assert.deepEqual(body.data.resumen, expected[tipo]); assert.deepEqual(body.data.detalle, day.data.detalle); await checkRendered(admin, tipo, body);
      }
      for (const pagina of ['1', '2']) {
        const body = await query(admin, tipo, `dia=2026-11-10&limite=1&pagina=${pagina}`);
        assert.deepEqual(body.data.resumen, expected[tipo]); assert.equal(body.data.detalle.length, 1);
        assert.equal(body.data.detalle[0][tipo === 'ventas' ? 'idVenta' : tipo === 'compras' ? 'idCompra' : 'idMovimiento'], day.data.detalle[pagina === '1' ? 0 : 1][tipo === 'ventas' ? 'idVenta' : tipo === 'compras' ? 'idCompra' : 'idMovimiento']);
        await checkRendered(admin, tipo, body);
      }
      const far = await query(admin, tipo, 'dia=2026-11-10&pagina=100&limite=7');
      assert.deepEqual(far.data.resumen, expected[tipo]); assert.deepEqual(far.data.detalle, []); await admin.contains('Esta página no tiene resultados'); await checkRendered(admin, tipo, far);
      const empty = await query(admin, tipo, 'mes=2099-01'); assert.equal(empty.paginacion.total, 0); assert.equal(empty.paginacion.totalPaginas, 0); assert.deepEqual(empty.data.detalle, []); await admin.contains('Sin coincidencias'); await checkRendered(admin, tipo, empty);
      const onlyZeros = value => typeof value === 'object' ? Object.values(value).every(onlyZeros) : [0, '0', '0.00'].includes(value);
      assert.ok(onlyZeros(empty.data.resumen));
      const filter = tipo === 'perdidas' ? 'motivo=DA%C3%91O' : 'estadoOperacion=ANULADA';
      const filtered = await query(admin, tipo, `dia=2026-11-10&${filter}`);
      if (tipo === 'perdidas') assert.deepEqual(filtered.data.resumen, { vencimiento: { cantidadRetiros: 0, cantidadRetirada: '0', perdida: '0.00' }, dano: { cantidadRetiros: 1, cantidadRetirada: '3', perdida: '0.00' }, cantidadRetiros: 1, cantidadRetirada: '3', perdidaTotal: '0.00' });
      else {
        const wanted = structuredClone(expected[tipo]); wanted.confirmadas = { cantidad: 0, importe: '0.00' };
        wanted[tipo === 'ventas' ? 'totalVentasRealizadas' : 'totalComprasRealizadas'] = '0.00';
        if (tipo === 'ventas') wanted.pendientes = { cantidad: 0, importe: '0.00' };
        assert.deepEqual(filtered.data.resumen, wanted); assert.equal(filtered.data.detalle.length, tipo === 'ventas' ? 2 : 1);
      }
      await checkRendered(admin, tipo, filtered);
      for (const option of tipo === 'perdidas' ? ['VENCIMIENTO'] : tipo === 'ventas' ? ['CONFIRMADA', 'PENDIENTE'] : ['CONFIRMADA']) {
        const body = await query(admin, tipo, `dia=2026-11-10&${new URLSearchParams({ [tipo === 'perdidas' ? 'motivo' : 'estadoOperacion']: option })}`);
        const wanted = structuredClone(expected[tipo]);
        if (tipo === 'perdidas') {
          wanted.dano = { cantidadRetiros: 0, cantidadRetirada: '0', perdida: '0.00' };
          wanted.cantidadRetiros = 2; wanted.cantidadRetirada = '2';
        } else {
          const included = option === 'PENDIENTE' ? 'pendientes' : 'confirmadas';
          for (const key of tipo === 'ventas' ? ['confirmadas', 'pendientes', 'anuladasConfirmadas', 'anuladasSinConfirmar'] : ['confirmadas', 'anuladas']) if (key !== included) wanted[key] = { cantidad: 0, importe: '0.00' };
          if (option === 'PENDIENTE') wanted.totalVentasRealizadas = '0.00';
        }
        assert.deepEqual(body.data.resumen, wanted); await checkRendered(admin, tipo, body);
      }
      assert.equal((await admin.request('GET', `/reportes/${tipo}?dia=1900-02-29`)).status, 400);
      for (const timezone of ['Pacific/Honolulu', 'Asia/Tokyo']) { await admin.timezone(timezone); const body = await query(admin, tipo, 'dia=2026-11-10'); await checkRendered(admin, tipo, body); }
      await admin.timezone('America/La_Paz');
      // Regresión real de Fase 5: defaults omitidos, orden distinto y URL canónica.
      for (const params of ['mes=2026-11', 'limite=25&pagina=1&mes=2026-11', 'mes=2026-11&pagina=1&limite=25']) {
        await query(admin, tipo, params); const before = browser.requests.length;
        await admin.click('.reporte-filters button[type=submit]'); await ready(admin, tipo); await latest(admin, before, tipo); await admin.settle();
        assert.equal(browser.requests.slice(before).filter(r => r.path === `/api/reportes/${tipo}`).length, 1);
        assert.equal(await admin.evaluate('location.search'), '?mes=2026-11&pagina=1&limite=25');
      }
      const beforeClear = browser.requests.length;
      await admin.clickText('Limpiar'); await ready(admin, tipo); await admin.contains('Selecciona un período');
      assert.equal(await admin.evaluate('!!document.querySelector(".reporte-resumen")'), false);
      assert.equal(browser.requests.slice(beforeClear).filter(r => r.path === `/api/reportes/${tipo}`).length, 0);
    });
    await t.test('Trazabilidad real a fichas y CU40/getMovimientos; retorno mediante Atrás', async () => {
      for (const tipo of ['ventas', 'compras', 'perdidas']) {
        await query(admin, tipo, 'dia=2026-11-10');
        await admin.click(`.reporte-${tipo}-table tbody a`);
        await admin.ready(tipo === 'perdidas' ? '.inventario-page' : tipo === 'ventas' ? '.ventas-page' : '.compras-page');
        if (tipo === 'perdidas') {
          await admin.contains('Trazabilidad sintética F6');
          await admin.contains('reportes_ui_2');
          assert.ok(await admin.evaluate('document.querySelectorAll(".inventario-table--movimientos tbody tr").length === 5'));
          assert.ok(browser.requests.some(r => r.session === admin.name && r.path === '/api/inventario/movimientos' && r.status === 200));
        }
        await admin.evaluate('history.back()'); await ready(admin, tipo);
        assert.equal(await admin.evaluate('location.search'), '?dia=2026-11-10');
      }
      const body = await query(regente, 'perdidas', 'dia=2026-11-10'); assert.deepEqual(body.data.resumen, expected.perdidas); await checkRendered(regente, 'perdidas', body);
    });
    await t.test('Consultas sin escrituras de negocio; auditoría persistida separada y registros sanitizados', async () => {
      assert.equal(await snapshot(), initial);
      const writes = sql.filter(s => /\b(INSERT INTO|UPDATE `|DELETE FROM|REPLACE INTO)\b/i.test(s));
      assert.ok(writes.length > 0);
      for (const statement of writes) assert.match(statement, /INSERT INTO `bitacora_auditoria`/);
      for (const tipo of ['VENTAS', 'COMPRAS', 'PERDIDAS']) {
        const events = await db.BitacoraAuditoria.findAll({ where: { tipo_evento: `REPORTE_${tipo}_CONSULTAR` }, raw: true });
        assert.ok(events.length > 0);
        for (const event of events) { assert.deepEqual(Object.keys(event.metadatos), ['cantidadResultados']); assert.equal(event.antes, null); assert.equal(event.despues, null); }
        t.diagnostic(`Auditoría REPORTE_${tipo}_CONSULTAR: ${events.length} eventos persistidos.`);
      }
      assert.deepEqual(unexpected, []); assert.deepEqual(browser.errors, []);
      assert.ok(browser.requests.every(r => r.method === 'GET' || ['POST', 'OPTIONS'].includes(r.method) && r.path === '/api/auth/login'));
      t.diagnostic(`${browser.requests.length} peticiones API observadas; ${writes.length} INSERT de auditoría; snapshot de negocio idéntico.`);
    });
  } finally {
    // Cada limpieza se intenta aunque otra falle. El helper comprueba ausencia DB.
    try { await browser?.close(); }
    finally {
      try {
        for (const service of [server, frontend]) if (service?.listening) { service.closeAllConnections(); await new Promise(resolve => service.close(resolve)); }
      } finally {
        try { await entorno.cerrar(); }
        finally {
          if (profile) { await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); t.diagnostic('Perfil/build temporal eliminado; servidores propios cerrados.'); }
        }
      }
    }
  }
});
