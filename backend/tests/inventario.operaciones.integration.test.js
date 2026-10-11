import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
const testDatabase = process.env.DB_NAME_TEST;
const protectedDatabases = [...new Set([process.env.DB_NAME, process.env.DB_NAME_PRODUCTION, testDatabase].filter(Boolean))];
assert.ok(testDatabase, 'Configurar DB_NAME_TEST');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), 'Usar MySQL local');
assert.equal([process.env.DB_NAME, process.env.DB_NAME_PRODUCTION].filter(Boolean)
    .some(name => name.toLowerCase() === testDatabase.toLowerCase()), false);
const temporaryDatabase = `${testDatabase.slice(0, 25)}_operaciones_${randomBytes(6).toString('hex')}`;
assert.match(temporaryDatabase, /^[a-zA-Z0-9_]+$/);
assert.equal(protectedDatabases.some(name => name.toLowerCase() === temporaryDatabase.toLowerCase()), false);
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = temporaryDatabase;
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_integracion_operaciones';

const executeFile = promisify(execFile);
const cliPath = fileURLToPath(new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url));
const runCli = async command => {
    try {
        await executeFile(process.execPath, [cliPath, command, '--env', 'test'], {
            cwd: fileURLToPath(new URL('../', import.meta.url)), env: { ...process.env }, timeout: 60000
        });
    } catch { throw new Error(`Sequelize CLI: ${command} falló en la base temporal de operaciones`); }
};
const identifier = name => `\`${name.replaceAll('`', '``')}\``;
// Esta conexión solo consulta bases protegidas (SELECT/SHOW), nunca hace DML/DDL.
const fingerprints = async connection => {
    const result = {};
    for (const database of protectedDatabases) {
        const [tables] = await connection.query('SELECT TABLE_NAME AS nombre FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = ? ORDER BY TABLE_NAME', [database, 'BASE TABLE']);
        const hash = createHash('sha256');
        for (const { nombre } of tables) {
            const qualified = `${identifier(database)}.${identifier(nombre)}`;
            const [ddl] = await connection.query(`SHOW CREATE TABLE ${qualified}`);
            const [rows] = await connection.query(`SELECT * FROM ${qualified}`);
            hash.update(JSON.stringify({ nombre, ddl, rows: rows.map(row => JSON.stringify(row)).sort() }));
        }
        result[database] = { tablas: tables.length, sha256: hash.digest('hex') };
    }
    return result;
};

test('Fase 3.4: CU22/CU23/CU35/CU36, InnoDB real, concurrencia y B1/A en base aislada', { timeout: 300000 }, async t => {
    let databaseCreated = false, db, server, guard, beforeProtected, requests = 0;
    const queries = [];
    try {
        guard = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER,
            password: process.env.PASSWORD_DB, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
        beforeProtected = await fingerprints(guard);
        t.diagnostic(`Base aislada: ${temporaryDatabase}`);
        await runCli('db:create'); databaseCreated = true;
        await runCli('db:migrate');
        ({ default: db } = await import('../src/data/models/index.js'));
        assert.equal(db.sequelize.config.database, temporaryDatabase);
        db.sequelize.options.logging = false;
        const { app } = await import('../src/app.js');
        const { generarToken } = await import('../src/shared/utils/jwt.js');
        const { ROLES } = await import('../src/shared/constants/roles.js');
        const { existenciaMedicamentoRepository: existenciasRepo } = await import('../src/data/repositories/existencia-medicamento.repository.js');
        const { movimientoInventarioRepository: movimientosRepo } = await import('../src/data/repositories/movimiento-inventario.repository.js');
        const { compraRepository } = await import('../src/data/repositories/compra.repository.js');
        const select = (sql, options = {}) => db.sequelize.query(sql, { type: db.Sequelize.QueryTypes.SELECT, ...options });
        const originalQuery = db.sequelize.query.bind(db.sequelize);
        t.mock.method(db.sequelize, 'query', (sql, options) => {
            assert.equal(db.sequelize.config.database, temporaryDatabase);
            queries.push(typeof sql === 'string' ? sql : sql.query);
            return originalQuery(sql, options);
        });
        t.mock.method(console, 'error', () => {});
        await db.Rol.bulkCreate(Object.entries(ROLES).map(([nombre, id_rol]) => ({ id_rol, nombre })));
        const hash = await bcrypt.hash('Sintetica-Operaciones-123!', 4), usuarios = {};
        for (const [rol, idRol] of Object.entries(ROLES)) usuarios[rol] = await db.Usuario.create({
            id_rol: idRol, nombre_usuario: `operaciones_${rol}`, password_hash: hash
        });
        const proveedor = await db.ProveedorLaboratorio.create({ nombre: 'Proveedor sintético de operaciones' });
        let secuencia = 0;
        const civil = fecha => db.Sequelize.fn('STR_TO_DATE', fecha, '%Y-%m-%d %H:%i:%s');
        const fixture = async ({ saldo = 10, costo = '1.000000', fecha = '2025-01-31', precision = 'MES', activo = false, historial = true } = {}) => {
            const codigo = `OP${++secuencia}`;
            const med = await db.Medicamento.create({ id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio,
                codigo_medicamento: codigo, nombre_comercial: codigo, estado: activo,
                forma_farmaceutica: 'Tableta', presentacion: '500 mg', unidad_inventario: 'tableta',
                stock_minimo: 10, condicion_venta: 'Venta libre', via_administracion: 'Oral', tipo_liberacion: 'Inmediata' });
            const e = await db.ExistenciaMedicamento.create({ id_medicamento: med.id_medicamento,
                codigo_existencia: `${codigo}-001`, fecha_vencimiento: fecha, precision_vencimiento: precision,
                cantidad_fisica: saldo, costo_unitario_promedio: costo });
            if (saldo && historial) await movimientosRepo.create({ data: { id_existencia: e.id_existencia,
                id_usuario: usuarios.REGENTE.id_usuario, direccion: 'ENTRADA', cantidad: saldo,
                costo_unitario_aplicado: costo, motivo: 'AJUSTE', fecha_movimiento: '2025-01-01 08:00:00' } });
            return { e, med };
        };
        const instante = new Date('2026-11-01T04:15:00Z');
        t.mock.timers.enable({ apis: ['Date'], now: instante });
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
        const base = `http://127.0.0.1:${server.address().port}/api`;
        const request = async (method, path, body, rol = 'REGENTE', status) => {
            const usuario = usuarios[rol];
            const token = usuario ? generarToken({ idUsuario: usuario.id_usuario, idRol: usuario.id_rol, versionCredenciales: 0 }) : null;
            const response = await fetch(`${base}${path}`, { method, headers: {
                ...(token ? { Cookie: `token=${token}` } : {}),
                ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
            }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(25000) });
            requests++;
            const result = await response.json();
            if (status !== undefined) assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`);
            assert.doesNotMatch(JSON.stringify(result), /"(?:password_hash|password|token|versionCredenciales)"\s*:/);
            return { status: response.status, body: result };
        };
        const observar = async ({ e, med }) => {
            const result = await request('GET', `/inventario/medicamentos/${med.id_medicamento}/existencias`, undefined, 'REGENTE', 200);
            const row = result.body.data.find(row => row.idExistencia === e.id_existencia);
            assert.ok(row);
            return { idExistencia: row.idExistencia, stockObservado: row.stockFisico, ultimoMovimientoObservado: row.ultimoMovimiento };
        };
        const datos = (tipo, observado, cantidad = 3) => tipo === 'ajustes' ? {
            ...observado, saldoContado: observado.stockObservado + cantidad, costoUnitario: '2', observacion: 'Conteo sintético'
        } : { ...observado, cantidad, ...(tipo === 'retiros/dano' ? { observacion: 'Daño sintético' } : {}) };
        const post = (tipo, body, status = 201) => request('POST', `/inventario/${tipo}`, body, 'REGENTE', status);
        const tipos = ['ajustes', 'retiros/vencimiento', 'retiros/dano'];
        const snapshot = async () => {
            const result = {};
            for (const model of [db.Medicamento, db.ExistenciaMedicamento, db.MovimientoInventario, db.Compra, db.DetalleCompra]) {
                result[model.name] = await model.findAll({ raw: true, order: [[model.primaryKeyAttribute, 'ASC']] });
            }
            return result;
        };
        const estado = f => db.ExistenciaMedicamento.findByPk(f.e.id_existencia, { raw: true });
        const historial = f => db.MovimientoInventario.findAll({ where: { id_existencia: f.e.id_existencia }, raw: true, order: [['id_movimiento', 'ASC']] });
        const lock = (f, transaction) => existenciasRepo.findByIdParaMovimiento({ idExistencia: f.e.id_existencia, transaction });
        const esperarBloqueo = async (transaction, cantidad = 1) => {
            const [{ id }] = await select('SELECT CONNECTION_ID() AS id', { transaction });
            const deadline = performance.now() + 10000;
            while (performance.now() < deadline) {
                const [{ total }] = await select('SELECT COUNT(DISTINCT w.REQUESTING_ENGINE_TRANSACTION_ID) AS total FROM performance_schema.data_lock_waits w JOIN performance_schema.threads th ON th.THREAD_ID = w.BLOCKING_THREAD_ID WHERE th.PROCESSLIST_ID = :id', { replacements: { id } });
                if (Number(total) >= cantidad) return;
                await delay(20);
            }
            assert.fail('No se observó la espera real de InnoDB preparada');
        };
        const restaurarSaldoConHistorial = async (f, transaction) => {
            const actual = await lock(f, transaction);
            for (const direccion of ['SALIDA', 'ENTRADA']) {
                await existenciasRepo.updateSaldoYCosto({ idExistencia: f.e.id_existencia,
                    cantidadFisica: actual.cantidad_fisica - (direccion === 'SALIDA' ? 1 : 0),
                    costoUnitarioPromedio: actual.costo_unitario_promedio, transaction });
                await movimientosRepo.create({ transaction, data: { id_existencia: f.e.id_existencia,
                    id_usuario: usuarios.REGENTE.id_usuario, direccion, cantidad: 1,
                    costo_unitario_aplicado: actual.costo_unitario_promedio, motivo: 'AJUSTE', fecha_movimiento: '2026-11-01 00:15:00' } });
            }
        };

        await t.test('Entorno real y CU22: marcador null, mayor ID por existencia y proyección en un SELECT', async () => {
            const [{ aislamiento, version }] = await select('SELECT @@transaction_isolation AS aislamiento, VERSION() AS version');
            assert.equal(aislamiento, 'REPEATABLE-READ'); t.diagnostic(`MySQL ${version}; ${aislamiento}`);
            const f = await fixture({ saldo: 0, costo: '5.000000' });
            const inicio = queries.length, observado = await observar(f);
            assert.equal(observado.stockObservado, 0); assert.equal(observado.ultimoMovimientoObservado, null);
            const sql = queries.slice(inicio).filter(q => /FROM `medicamento`/.test(q));
            assert.equal(sql.length, 1); assert.match(sql[0], /SELECT MAX\(/);
            const result = (await post('ajustes', datos('ajustes', observado, 3))).body.data;
            assert.equal(result.costoUnitarioPromedio, '2.000000');
            assert.equal((await observar(f)).ultimoMovimientoObservado, result.movimiento.idMovimiento);
        });

        await t.test('Ajustes persistidos: entradas, salidas, agotadas, promedio cero, redondeo y conciliación sin historial', async () => {
            const f = await fixture({ saldo: 1, costo: '0.000001' });
            const observed = await observar(f);
            const entrada = (await post('ajustes', { ...datos('ajustes', observed, 1), costoUnitario: '0.000002' })).body.data;
            assert.equal(entrada.costoUnitarioPromedio, '0.000002');
            const antes = await snapshot(), obs = await observar(f);
            const noop = (await post('ajustes', { ...obs, saldoContado: obs.stockObservado, observacion: 'Conteo sin diferencia' }, 200)).body.data;
            assert.equal(noop.movimiento, null); assert.deepEqual(await snapshot(), antes);
            const salida = (await post('ajustes', { ...obs, saldoContado: 0, observacion: 'Conteo cero' })).body.data;
            assert.equal(salida.movimiento.direccion, 'SALIDA'); assert.equal(salida.movimiento.cantidad, 2);
            assert.equal((await estado(f)).costo_unitario_promedio, '0.000002');
            const cero = await fixture({ costo: '0.000000' });
            const zero = (await post('ajustes', { ...await observar(cero), saldoContado: 0, observacion: 'Conteo cero' })).body.data;
            assert.equal(zero.movimiento.costoUnitarioAplicado, '0.000000');
            const maxima = await fixture({ saldo: 2147483646, costo: '99999999.999999' });
            const max = (await post('ajustes', { ...datos('ajustes', await observar(maxima), 1), costoUnitario: '99999999.999999' })).body.data;
            assert.equal(max.stockFisico, 2147483647); assert.equal(max.costoUnitarioPromedio, '99999999.999999');
        });

        await t.test('Retiros reales: costos/cantidades, pérdida máxima, motivo y conservación de promedio/históricos', async () => {
            for (const tipo of tipos.slice(1)) for (const [cantidad, costo, perdida] of [
                [10, '0.000000', '0.00'], [1, '0.005000', '0.01'], [1, '0.000001', '0.00'],
                [2147483647, '99999999.999999', '214748364699997852.52']
            ]) {
                const f = await fixture({ saldo: cantidad, costo }), original = await historial(f);
                const result = (await post(tipo, datos(tipo, await observar(f), cantidad))).body.data;
                assert.equal(result.perdida, perdida); assert.equal(result.stockFisico, 0);
                assert.equal(result.costoUnitarioPromedio, costo);
                assert.equal(result.movimiento.motivo, tipo.endsWith('dano') ? 'DAÑO' : 'VENCIMIENTO');
                assert.equal(result.movimiento.observacion, tipo.endsWith('dano') ? 'Daño sintético' : null);
                assert.equal((await estado(f)).costo_unitario_promedio, costo);
                assert.deepEqual((await historial(f)).slice(0, original.length), original);
            }
        });

        await t.test('Horas civiles reales y cortes DIA/MES tras una espera observada por InnoDB', async () => {
            for (const [fecha, precision, anterior, posterior] of [
                ['2026-11-01', 'DIA', '2026-11-01T03:59:59Z', '2026-11-01T04:00:00Z'],
                ['2026-10-31', 'MES', '2026-11-01T03:59:59Z', '2026-11-01T04:00:00Z'],
                ['2024-02-29', 'MES', '2024-03-01T03:59:59Z', '2024-03-01T04:00:00Z'],
                ['2026-12-31', 'MES', '2027-01-01T03:59:59Z', '2027-01-01T04:00:00Z']
            ]) {
                const f = await fixture({ fecha, precision });
                t.mock.timers.setTime(new Date(anterior).getTime());
                const data = datos('retiros/vencimiento', await observar(f)), before = await snapshot();
                await post('retiros/vencimiento', data, 409); assert.deepEqual(await snapshot(), before);
                const blocker = await db.sequelize.transaction(); let pending;
                try {
                    await lock(f, blocker);
                    pending = post('retiros/vencimiento', data); pending.catch(() => {});
                    await esperarBloqueo(blocker);
                    t.mock.timers.setTime(new Date(posterior).getTime());
                    await blocker.commit();
                    const { movimiento } = (await pending).body.data;
                    const [{ hora }] = await select("SELECT DATE_FORMAT(fecha_movimiento, '%Y-%m-%d %H:%i:%s') AS hora FROM movimiento_inventario WHERE id_movimiento = :id", { replacements: { id: movimiento.idMovimiento } });
                    assert.equal(hora, movimiento.fechaMovimiento); assert.ok(hora.endsWith('00:00:00'));
                    assert.equal((await estado(f)).fecha_vencimiento, fecha);
                } finally {
                    if (!blocker.finished) await blocker.rollback();
                    if (pending) await pending.catch(() => {});
                    t.mock.timers.setTime(instante.getTime());
                }
            }
        });

        await t.test('Inactivos/vencidas y Daño no vencido: consultas posteriores no reactivan ni cambian vencimiento', async () => {
            const f = await fixture({ fecha: '2030-01-31' });
            await post('retiros/dano', datos('retiros/dano', await observar(f)));
            const result = (await request('GET', `/inventario/medicamentos/${f.med.id_medicamento}/existencias`, undefined, 'REGENTE', 200)).body.data[0];
            assert.equal(result.stockFisico, 7); assert.equal(result.stockVendible, 0); assert.equal(result.vencida, false);
            assert.equal((await db.Medicamento.findByPk(f.med.id_medicamento)).estado, false);
        });

        await t.test('Permisos y contratos HTTP reales: 400/401/403/404/409 no dejan efectos', async () => {
            const f = await fixture(), observado = await observar(f), before = await snapshot();
            for (const tipo of tipos) {
                const data = datos(tipo, observado);
                for (const rol of ['ADMINISTRADOR', 'VENDEDOR']) await request('POST', `/inventario/${tipo}`, data, rol, 403);
                await request('POST', `/inventario/${tipo}`, data, null, 401);
                for (const extra of [{ idUsuario: 1 }, { ultimoMovimientoObservado: undefined }, { ultimoMovimientoObservado: 0 }, { observacion: ' ' },
                    ...(tipo === 'ajustes' ? [{ costoUnitario: '0' }, { saldoContado: -1 }] : [{ cantidad: 0 }, { cantidad: 1.5 }, { costoUnitario: '1' }])]) {
                    await post(tipo, { ...data, ...extra }, 400);
                }
                await post(`${tipo}?estado=true`, data, 400);
                await post(tipo, { ...data, idExistencia: 2147483647 }, 404);
                await post(tipo, { ...data, stockObservado: 9 }, 409);
                if (tipo !== 'ajustes') await post(tipo, { ...data, cantidad: 11 }, 409);
            }
            assert.deepEqual(await snapshot(), before);
        });

        await t.test('Rollback real después de UPDATE/INSERT SQL: conserva saldo, promedio, marcador e historial y permite reintentar', async () => {
            for (const tipo of tipos) for (const [repo, metodo] of [[existenciasRepo, 'updateSaldoYCosto'], [movimientosRepo, 'create']]) {
                const f = await fixture(), observado = await observar(f), before = await snapshot();
                const original = repo[metodo].bind(repo); let fallo = false;
                const mocked = t.mock.method(repo, metodo, async args => {
                    const result = await original(args);
                    if ((args.idExistencia ?? args.data?.id_existencia) === f.e.id_existencia) {
                        fallo = true; throw new Error('Fallo sintético después de SQL real');
                    }
                    return result;
                });
                try {
                    await post(tipo, datos(tipo, observado), 500); assert.equal(fallo, true);
                    assert.deepEqual(await snapshot(), before); assert.deepEqual(await observar(f), observado);
                } finally { mocked.mock.restore(); }
                await post(tipo, datos(tipo, observado));
                assert.equal((await historial(f)).length, 2);
            }
        });

        await t.test('CU22 coherente: lectura durante escritura sin commit devuelve el par anterior, después devuelve ambos nuevos', async () => {
            const f = await fixture(), observado = await observar(f), transaction = await db.sequelize.transaction();
            try {
                await lock(f, transaction);
                await existenciasRepo.updateSaldoYCosto({ idExistencia: f.e.id_existencia, cantidadFisica: 11, costoUnitarioPromedio: '1.000000', transaction });
                const m = await movimientosRepo.create({ transaction, data: { id_existencia: f.e.id_existencia, id_usuario: usuarios.REGENTE.id_usuario,
                    direccion: 'ENTRADA', cantidad: 1, costo_unitario_aplicado: '1.000000', motivo: 'AJUSTE', fecha_movimiento: '2026-11-01 00:15:00' } });
                assert.deepEqual(await observar(f), observado);
                await transaction.commit();
                assert.deepEqual(await observar(f), { ...observado, stockObservado: 11, ultimoMovimientoObservado: m.id_movimiento });
            } finally { if (!transaction.finished) await transaction.rollback(); }
        });

        for (const tipo of [...tipos, 'conciliacion']) await t.test(`RR con snapshot previo y saldo restaurado: ${tipo} lee marcador actual tras esperar y rechaza sin efectos`, async () => {
            const f = await fixture(), observado = await observar(f), blocker = await db.sequelize.transaction();
            const originalLock = existenciasRepo.findByIdParaMovimiento.bind(existenciasRepo);
            const originalLast = movimientosRepo.findUltimoIdParaExistencia.bind(movimientosRepo);
            let oldId, snapshotId, currentId, pending;
            const max = async transaction => (await select('SELECT MAX(id_movimiento) AS id FROM movimiento_inventario WHERE id_existencia = :id',
                { replacements: { id: f.e.id_existencia }, transaction }))[0].id;
            await originalLock({ idExistencia: f.e.id_existencia, transaction: blocker });
            const mockedLock = t.mock.method(existenciasRepo, 'findByIdParaMovimiento', async args => {
                if (args.idExistencia === f.e.id_existencia) oldId = await max(args.transaction);
                return originalLock(args);
            });
            const mockedLast = t.mock.method(movimientosRepo, 'findUltimoIdParaExistencia', async args => {
                if (args.idExistencia === f.e.id_existencia) snapshotId = await max(args.transaction);
                const result = await originalLast(args);
                if (args.idExistencia === f.e.id_existencia) currentId = result;
                return result;
            });
            try {
                const data = tipo === 'conciliacion' ? { ...observado, saldoContado: 10, observacion: 'No diferencia aparente' } : datos(tipo, observado);
                pending = post(tipo === 'conciliacion' ? 'ajustes' : tipo, data, 409); pending.catch(() => {});
                await esperarBloqueo(blocker);
                await restaurarSaldoConHistorial(f, blocker);
                await blocker.commit();
                const before = await snapshot();
                await pending;
                assert.equal(oldId, observado.ultimoMovimientoObservado); assert.equal(snapshotId, oldId);
                assert.ok(currentId > oldId); assert.equal((await estado(f)).cantidad_fisica, 10);
                assert.deepEqual(await snapshot(), before); assert.equal((await historial(f)).length, 3);
            } finally {
                mockedLock.mock.restore(); mockedLast.mock.restore();
                if (!blocker.finished) await blocker.rollback();
                if (pending) await pending.catch(() => {});
            }
        });

        await t.test('Solicitudes realmente solapadas: un commit por precondiciones, mismos/diferentes motivos y marcador null', async () => {
            for (const [a, b, vacia] of [
                ['ajustes', 'ajustes', false], ['retiros/vencimiento', 'retiros/vencimiento', false],
                ['retiros/dano', 'retiros/dano', false], ['ajustes', 'retiros/dano', false],
                ['retiros/vencimiento', 'retiros/dano', false], ['ajustes', 'ajustes', true]
            ]) {
                const f = await fixture(vacia ? { saldo: 0, costo: '5.000000' } : {}), observado = await observar(f);
                const before = await historial(f), blocker = await db.sequelize.transaction(); let pendientes = [];
                try {
                    await lock(f, blocker);
                    pendientes = [a, b].map(tipo => request('POST', `/inventario/${tipo}`, datos(tipo, observado)));
                    pendientes.forEach(p => p.catch(() => {}));
                    await esperarBloqueo(blocker, 2); await blocker.commit();
                    const results = await Promise.all(pendientes);
                    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
                    const ganador = results.find(r => r.status === 201).body.data;
                    assert.equal((await estado(f)).cantidad_fisica, ganador.stockFisico);
                    assert.equal((await historial(f)).length, before.length + 1);
                } finally {
                    if (!blocker.finished) await blocker.rollback();
                    await Promise.allSettled(pendientes);
                }
            }
        });

        await t.test('Dos conciliaciones simultáneas sin diferencia: dos 200 y ningún movimiento ni cambio', async () => {
            const f = await fixture(), observado = await observar(f), before = await snapshot();
            const blocker = await db.sequelize.transaction(); let pendientes = [];
            try {
                await lock(f, blocker);
                pendientes = [1, 2].map(() => post('ajustes', { ...observado, saldoContado: 10, observacion: 'Conteo' }, 200));
                pendientes.forEach(p => p.catch(() => {}));
                await esperarBloqueo(blocker, 2); await blocker.commit();
                await Promise.all(pendientes); assert.deepEqual(await snapshot(), before);
            } finally {
                if (!blocker.finished) await blocker.rollback(); await Promise.allSettled(pendientes);
            }
        });

        await t.test('Un movimiento confirmado de otra existencia no invalida las precondiciones', async () => {
            const a = await fixture(), b = await fixture(), observado = await observar(a);
            await post('retiros/dano', datos('retiros/dano', await observar(b)));
            await post('ajustes', datos('ajustes', observado));
        });

        for (const tipo of tipos) await t.test(`Timeout real de ${tipo}: 409, rollback y reintento válido sin cambiar límites globales`, async () => {
            const f = await fixture(), observado = await observar(f), before = await snapshot();
            const blocker = await db.sequelize.transaction(); let pending;
            const original = existenciasRepo.findByIdParaMovimiento.bind(existenciasRepo);
            await original({ idExistencia: f.e.id_existencia, transaction: blocker });
            const mocked = t.mock.method(existenciasRepo, 'findByIdParaMovimiento', async args => {
                const [{ limite }] = await select('SELECT @@SESSION.innodb_lock_wait_timeout AS limite', { transaction: args.transaction });
                await db.sequelize.query('SET SESSION innodb_lock_wait_timeout = 1', { transaction: args.transaction });
                try { return await original(args); }
                finally { if (!args.transaction.finished) await db.sequelize.query(`SET SESSION innodb_lock_wait_timeout = ${Number(limite)}`, { transaction: args.transaction }); }
            });
            try {
                pending = post(tipo, datos(tipo, observado), 409); pending.catch(() => {});
                await esperarBloqueo(blocker); assert.match((await pending).body.message, /contención temporal/);
                assert.deepEqual(await snapshot(), before);
            } finally {
                mocked.mock.restore(); if (!blocker.finished) await blocker.rollback();
                if (pending) await pending.catch(() => {});
            }
            await post(tipo, datos(tipo, observado));
        });

        for (const tipo of tipos) await t.test(`Deadlock real de ${tipo}: InnoDB revierte la operación víctima y se conserva el estado`, async () => {
            const f = await fixture(), observado = await observar(f), before = await snapshot();
            const pesos = [];
            for (let i = 0; i < 20; i++) pesos.push(await fixture({ saldo: 0 }));
            const beforeWithWeights = await snapshot();
            const blocker = await db.sequelize.transaction(); let pending;
            try {
                // El INSERT de movimiento necesitará el bloqueo FK de Usuario.
                // Mayor peso del bloqueador fuerza a la operación ligera como víctima.
                await db.Usuario.update({ nombre_usuario: `bloqueo_${tipo.replaceAll('/', '_')}` }, { where: { id_usuario: usuarios.REGENTE.id_usuario }, transaction: blocker });
                for (const p of pesos) await db.Medicamento.update({ nombre_comercial: 'Peso sintético' }, { where: { id_medicamento: p.med.id_medicamento }, transaction: blocker });
                pending = post(tipo, datos(tipo, observado), 409); pending.catch(() => {});
                await esperarBloqueo(blocker);
                await lock(f, blocker);
                assert.match((await pending).body.message, /contención temporal/);
                await blocker.rollback(); assert.deepEqual(await snapshot(), beforeWithWeights);
                assert.deepEqual(await observar(f), observado);
            } finally {
                if (!blocker.finished) await blocker.rollback(); if (pending) await pending.catch(() => {});
            }
            assert.equal((await estado(f)).cantidad_fisica, before.ExistenciaMedicamento.find(e => e.id_existencia === f.e.id_existencia).cantidad_fisica);
            await post(tipo, datos(tipo, observado));
        });

        const compraFixture = async () => {
            const f = await fixture({ activo: true, fecha: '2027-03-31' });
            const result = await request('POST', '/compras', { claveOperacion: `op-compra-${secuencia}`, fechaCompra: '2026-11-01',
                detalles: [{ idMedicamento: f.med.id_medicamento, cantidad: 10, costoUnitario: '1', precisionVencimiento: 'MES', fechaVencimiento: '2027-03' }] }, 'ADMINISTRADOR', 201);
            return { ...f, compra: result.body.data };
        };
        const anular = (f, status = 200) => request('POST', `/compras/${f.compra.idCompra}/anular`, { motivo: 'Regresión operaciones' }, 'ADMINISTRADOR', status);
        await t.test('CU27 real: sin diferencia conserva B1; ajustes/retiros efectivos usan A y preservan snapshots', async () => {
            for (const tipo of ['conciliacion', ...tipos]) {
                const f = await compraFixture(), observado = await observar(f);
                const detalles = await db.DetalleCompra.findAll({ where: { id_compra: f.compra.idCompra }, raw: true });
                if (tipo === 'conciliacion') await post('ajustes', { ...observado, saldoContado: 20, observacion: 'Conteo' }, 200);
                else {
                    if (tipo === 'retiros/vencimiento') t.mock.timers.setTime(new Date('2027-04-01T04:15:00Z').getTime());
                    await post(tipo, tipo === 'ajustes' ? { ...datos(tipo, observado, 2), costoUnitario: '1' } : datos(tipo, observado, 3));
                }
                const before = await historial(f);
                await anular(f);
                assert.equal((await estado(f)).cantidad_fisica, tipo === 'conciliacion' ? 10 : tipo === 'ajustes' ? 12 : 7);
                assert.equal((await estado(f)).costo_unitario_promedio, '1.000000');
                assert.deepEqual((await historial(f)).slice(0, before.length), before);
                assert.deepEqual(await db.DetalleCompra.findAll({ where: { id_compra: f.compra.idCompra }, raw: true }), detalles);
                t.mock.timers.setTime(instante.getTime());
            }
            for (const tipo of tipos) {
                const f = await compraFixture(), observado = await observar(f);
                if (tipo === 'retiros/vencimiento') t.mock.timers.setTime(new Date('2027-04-01T04:15:00Z').getTime());
                await post(tipo, tipo === 'ajustes' ? { ...observado, saldoContado: 0, observacion: 'Conteo cero' } : datos(tipo, observado, 20));
                const before = await snapshot(); await anular(f, 409); assert.deepEqual(await snapshot(), before);
                t.mock.timers.setTime(instante.getTime());
            }
        });

        await t.test('Compra concurrente retenida: Ajuste espera y rechaza el par observado anterior al commit', async () => {
            const f = await fixture({ activo: true, fecha: '2027-03-31' }), observado = await observar(f);
            let liberar, llego, tx;
            const barrera = new Promise(resolve => { liberar = resolve; }), escrita = new Promise(resolve => { llego = resolve; });
            const original = compraRepository.createDetalle.bind(compraRepository);
            const mocked = t.mock.method(compraRepository, 'createDetalle', async args => {
                const result = await original(args); tx = args.transaction; llego(); await barrera; return result;
            });
            const compra = request('POST', '/compras', { claveOperacion: `op-espera-${secuencia}`, fechaCompra: '2026-11-01',
                detalles: [{ idMedicamento: f.med.id_medicamento, cantidad: 10, costoUnitario: '1', precisionVencimiento: 'MES', fechaVencimiento: '2027-03' }] }, 'ADMINISTRADOR', 201);
            compra.catch(() => {}); let pending;
            try {
                await escrita; pending = post('ajustes', datos('ajustes', observado), 409); pending.catch(() => {});
                await esperarBloqueo(tx); liberar(); await compra; await pending;
                assert.equal((await estado(f)).cantidad_fisica, 20);
            } finally { liberar(); mocked.mock.restore(); await compra.catch(() => {}); if (pending) await pending.catch(() => {}); }
        });

        await t.test('CU27 concurrente retenida por un Ajuste: lee el posterior confirmado y aplica A', async () => {
            const f = await compraFixture(), observado = await observar(f);
            let liberar, llego, tx;
            const barrera = new Promise(resolve => { liberar = resolve; }), escrita = new Promise(resolve => { llego = resolve; });
            const original = movimientosRepo.create.bind(movimientosRepo);
            const mocked = t.mock.method(movimientosRepo, 'create', async args => {
                const result = await original(args);
                if (args.data.motivo === 'AJUSTE' && args.data.id_existencia === f.e.id_existencia) {
                    tx = args.transaction; llego(); await barrera;
                }
                return result;
            });
            const ajuste = post('ajustes', { ...datos('ajustes', observado, 2), costoUnitario: '1' }); ajuste.catch(() => {});
            let pending;
            try {
                await escrita; pending = anular(f); pending.catch(() => {});
                await esperarBloqueo(tx); liberar(); await ajuste; await pending;
                assert.equal((await estado(f)).cantidad_fisica, 12);
                assert.equal((await estado(f)).costo_unitario_promedio, '1.000000');
            } finally { liberar(); mocked.mock.restore(); await ajuste.catch(() => {}); if (pending) await pending.catch(() => {}); }
        });

        await t.test('Integridad final: saldo físico conciliado, motivos, referencias, costos y esquema suficiente', async () => {
            const saldos = await select("SELECT e.id_existencia, e.cantidad_fisica, COALESCE(SUM(CASE WHEN m.direccion = 'ENTRADA' THEN m.cantidad ELSE -m.cantidad END),0) AS saldo FROM existencia_medicamento e LEFT JOIN movimiento_inventario m ON m.id_existencia = e.id_existencia GROUP BY e.id_existencia, e.cantidad_fisica");
            for (const e of saldos) assert.equal(e.cantidad_fisica, Number(e.saldo));
            const incorrectos = await select("SELECT id_movimiento FROM movimiento_inventario WHERE motivo IN ('AJUSTE','VENCIMIENTO','DAÑO') AND (cantidad <= 0 OR costo_unitario_aplicado < 0 OR id_detalle_compra IS NOT NULL OR id_detalle_venta IS NOT NULL OR id_movimiento_original IS NOT NULL)");
            assert.deepEqual(incorrectos, []);
            const [{ zona }] = await select('SELECT @@SESSION.time_zone AS zona'); assert.equal(zona, '+00:00');
        });
        t.diagnostic(`${requests} comprobaciones HTTP y ${queries.length} sentencias reales; ${temporaryDatabase}`);
    } finally {
        try {
            if (server) await new Promise(resolve => server.close(resolve));
            if (db) await db.sequelize.close();
        } finally {
            try {
                if (databaseCreated) await runCli('db:drop');
                if (guard) {
                    const [remaining] = await guard.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [temporaryDatabase]);
                    assert.deepEqual(remaining, []);
                    if (beforeProtected) {
                        assert.deepEqual(await fingerprints(guard), beforeProtected, 'Datos y estructura de todas las tablas protegidas deben permanecer idénticos');
                        t.diagnostic(`Base temporal eliminada; huellas de bases protegidas intactas: ${JSON.stringify(beforeProtected)}`);
                    }
                }
            } finally { if (guard) await guard.end(); }
        }
    }
});
