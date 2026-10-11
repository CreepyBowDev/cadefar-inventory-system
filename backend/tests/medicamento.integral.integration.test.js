// Integración autorizada solo mediante opt-in; no conecta ni escribe por defecto.
// CADEFAR_AUTORIZAR_CATALOGO_AISLADO=1 node --test tests/medicamento.integral.integration.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const autorizado = process.env.CADEFAR_AUTORIZAR_CATALOGO_AISLADO === '1';
const quote = name => `\`${name.replaceAll('`', '``')}\``;
const fingerprint = async (cn, name) => {
    const [schemas] = await cn.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [name]);
    if (!schemas.length) return { existe: false };
    const [tables] = await cn.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME", [name]);
    const state = [];
    await cn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    try {
        for (const { TABLE_NAME: table } of tables) {
            const target = `${quote(name)}.${quote(table)}`;
            const [schema] = await cn.query(`SHOW CREATE TABLE ${target}`);
            const [rows] = await cn.query(`SELECT * FROM ${target}`);
            state.push({ table, schema: schema[0]['Create Table'],
                rows: rows.map(row => JSON.stringify(Object.fromEntries(Object.keys(row).sort().map(k => [k, row[k]])))).sort() });
        }
    } finally { await cn.rollback(); }
    return { existe: true, tablas: tables.length, sha256: createHash('sha256').update(JSON.stringify(state)).digest('hex') };
};
test('Registro integral con Express/MySQL reales en base aleatoria aislada', {
    skip: autorizado ? false : 'Requiere autorización adicional para crear/migrar/eliminar una base aislada', timeout: 180000
}, async t => {
    const { default: dotenv } = await import('dotenv'); dotenv.config({ quiet: true });
    const { default: mysql } = await import('mysql2/promise');
    const nombre = `cadefar_catalogo_${randomBytes(8).toString('hex')}`;
    assert.match(nombre, /^cadefar_catalogo_[a-f0-9]{16}$/);
    assert.ok(![process.env.DB_NAME, process.env.DB_NAME_TEST, process.env.DB_NAME_PRODUCTION].includes(nombre));
    const protegidas = [...new Set(['prueba', 'cadefar_test', process.env.DB_NAME, process.env.DB_NAME_TEST,
        process.env.DB_NAME_PRODUCTION].filter(Boolean))];
    const admin = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.PASSWORD_DB,
        dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
    let db, server, creada = false;
    const before = new Map();
    try {
        for (const name of protegidas) before.set(name, await fingerprint(admin, name));
        await admin.query(`CREATE DATABASE \`${nombre}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`); creada = true;
        process.env.NODE_ENV = 'test'; process.env.DB_NAME_TEST = nombre;
        process.env.JWT_SECRET = randomBytes(32).toString('hex');
        const require = createRequire(import.meta.url);
        await new Promise((resolve, reject) => {
            const cli = spawn(process.execPath, [require.resolve('sequelize-cli/lib/sequelize'), 'db:migrate', '--env', 'test'],
                { cwd: new URL('../', import.meta.url), env: process.env, stdio: 'ignore' });
            cli.once('error', reject); cli.once('exit', code => code === 0 ? resolve() : reject(new Error(`Migración aislada falló (${code})`)));
        });
        ({ default: db } = await import('../src/data/models/index.js'));
        const { app } = await import('../src/app.js');
        const { generarToken } = await import('../src/shared/utils/jwt.js');
        assert.equal(db.sequelize.config.database, nombre); db.sequelize.options.logging = false;
        await db.Rol.create({ id_rol: 2, nombre: 'Regente', estado: true });
        const usuario = await db.Usuario.create({ id_rol: 2, nombre_usuario: 'regente_aislado', password_hash: 'hash_sintetico_no_login' });
        const proveedor = await db.ProveedorLaboratorio.create({ nombre: 'Laboratorio aislado' });
        const otro = await db.ProveedorLaboratorio.create({ nombre: 'Otro laboratorio aislado' });
        const p = await db.PrincipioActivo.create({ nombre: 'Ingrediente aislado' });
        const q = await db.PrincipioActivo.create({ nombre: 'Segundo ingrediente aislado' });
        const token = generarToken({ idUsuario: usuario.id_usuario, idRol: 2, versionCredenciales: usuario.version_credenciales });
        const componente = id => ({ idPrincipioActivo: id, cantidadPrincipioActivo: 500,
            unidadPrincipioActivo: 'mg', cantidadReferencia: 1, unidadReferencia: 'tableta' });
        const datos = extra => ({ nombreComercial: 'Paracetamol aislado', idProveedorLaboratorio: proveedor.id_proveedor_laboratorio,
            formaFarmaceutica: 'TABLETA', presentacion: 'TABLETAS', unidadInventario: 'TABLETA', stockMinimo: 10,
            condicionVenta: 'LIBRE', viaAdministracion: 'ORAL', tipoLiberacion: 'INMEDIATA',
            composicion: [componente(p.id_principio_activo), componente(q.id_principio_activo)], ...extra });
        server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
        const request = async (method, path, body) => {
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api/medicamentos${path}`, {
                method, headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000)
            });
            return { status: response.status, body: await response.json() };
        };
        const carreraBloqueada = async callbacks => {
            await admin.beginTransaction();
            await admin.query(`SELECT id_proveedor_laboratorio FROM ${quote(nombre)}.proveedor_laboratorio WHERE id_proveedor_laboratorio=? FOR UPDATE`, [proveedor.id_proveedor_laboratorio]);
            const pending = callbacks.map(callback => callback());
            // Observar dos transacciones independientes esperando la fila real,
            // antes de soltar el bloqueo. No depender de la velocidad de Promise.all.
            let observado = false, ultimaEspera;
            try {
                const limite = Date.now() + 10000;
                while (Date.now() < limite) {
                    const [waiters] = await admin.query(`SELECT DISTINCT solicitante.PROCESSLIST_ID AS connectionId, tx.ISOLATION_LEVEL AS nivel
                        FROM performance_schema.data_lock_waits w JOIN performance_schema.threads th ON th.THREAD_ID=w.BLOCKING_THREAD_ID
                        JOIN performance_schema.threads solicitante ON solicitante.THREAD_ID=w.REQUESTING_THREAD_ID
                        JOIN performance_schema.events_transactions_current tx ON tx.THREAD_ID=solicitante.THREAD_ID AND tx.STATE='ACTIVE'
                        WHERE th.PROCESSLIST_ID=?`, [admin.threadId]);
                    ultimaEspera = { waiters };
                    if (waiters.length === 2) {
                        // @@transaction_isolation informa el default de la sesión,
                        // no el nivel de la transacción SET TRANSACTION en curso.
                        assert.ok(waiters.every(tx => tx.nivel === 'READ COMMITTED'), JSON.stringify(waiters));
                        observado = true; break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 25));
                }
            } finally { await admin.rollback(); }
            const results = await Promise.all(pending);
            assert.ok(observado, `Dos transacciones deben esperar el bloqueo InnoDB del proveedor: ${JSON.stringify(ultimaEspera)}`);
            return results;
        };
        await t.test('Dos creaciones idénticas simultáneas: 201/409; solo un medicamento completo', async () => {
            const results = await carreraBloqueada([() => request('POST', '', datos()), () => request('POST', '', datos())]);
            assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
            assert.equal(await db.Medicamento.count(), 1); assert.equal(await db.ComposicionMedicamento.count(), 2);
        });
        await t.test('Colación, orden y decimales equivalentes; inactivo sigue siendo duplicado', async () => {
            const original = await db.Medicamento.findOne();
            await db.Medicamento.update({ estado: false }, { where: { id_medicamento: original.id_medicamento } });
            assert.equal((await request('POST', '', datos({ nombreComercial: '  páracetamol   AISLADO ',
                stockMinimo: 20, condicionVenta: 'CON RECETA', composicion: datos().composicion.reverse() }))).status, 409);
            assert.equal(await db.Medicamento.count(), 1);
        });
        await t.test('Identidades distintas compiten por prefijo entre proveedores', async () => {
            const results = await Promise.all([request('POST', '', datos({ presentacion: 'FRASCO' })),
                request('POST', '', datos({ idProveedorLaboratorio: otro.id_proveedor_laboratorio }))]);
            assert.deepEqual(results.map(r => r.status), [201, 201]);
            assert.equal(new Set(results.map(r => r.body.data.codigoMedicamento)).size, 2);
        });
        await t.test('Fallo al insertar tercer componente: rollback real sin medicamento huérfano', async () => {
            const { composicionMedicamentoRepository: repo } = await import('../src/data/repositories/composicion-medicamento.repository.js');
            const original = repo.create;
            const before = [await db.Medicamento.count(), await db.ComposicionMedicamento.count()];
            let n = 0;
            const tercer = await db.PrincipioActivo.create({ nombre: 'Tercer ingrediente aislado' });
            const mock = t.mock.method(repo, 'create', async args => { if (++n === 3) throw new Error('Fallo sintético antes del tercer INSERT'); return original.call(repo, args); });
            try {
                assert.equal((await request('POST', '', datos({ nombreComercial: 'Producto rollback',
                    composicion: [...datos().composicion, componente(tercer.id_principio_activo)] }))).status, 500);
                assert.deepEqual([await db.Medicamento.count(), await db.ComposicionMedicamento.count()], before);
            } finally { mock.mock.restore(); }
        });
        await t.test('Edición concurrente hacia la misma identidad: un éxito y un rechazo', async () => {
            const a = await request('POST', '', datos({ nombreComercial: 'Marca A' }));
            const b = await request('POST', '', datos({ nombreComercial: 'Marca B' }));
            const results = await carreraBloqueada([() => request('PATCH', `/${a.body.data.idMedicamento}`, { nombreComercial: 'Marca destino' }),
                () => request('PATCH', `/${b.body.data.idMedicamento}`, { nombreComercial: 'Marca destino' })]);
            assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
        });
        await t.test('Composición independiente no permite converger a producto existente', async () => {
            const created = await request('POST', '', datos({ composicion: [{ ...componente(p.id_principio_activo), cantidadPrincipioActivo: 1000 }, componente(q.id_principio_activo)] }));
            const id = created.body.data.idMedicamento, comp = created.body.data.composicion.find(c => c.idPrincipioActivo === p.id_principio_activo);
            assert.equal((await request('PATCH', `/${id}/composicion/${comp.idComposicion}`, { cantidadPrincipioActivo: 500 })).status, 409);
            assert.equal((await db.ComposicionMedicamento.findByPk(comp.idComposicion)).cantidad_principio_activo, '1000.0000');
        });
    } finally {
        await admin.rollback();
        if (server) await new Promise(resolve => server.close(resolve));
        if (db) await db.sequelize.close();
        try {
            if (creada) {
                await admin.query(`DROP DATABASE \`${nombre}\``);
                const [rows] = await admin.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [nombre]);
                assert.equal(rows.length, 0);
            }
            for (const [name, huella] of before) assert.deepEqual(await fingerprint(admin, name), huella, `Base protegida ${name} preservada`);
            t.diagnostic('Base temporal eliminada; esquema y datos de las bases protegidas conservan sus huellas SHA-256.');
        }
        finally { await admin.end(); }
    }
});
