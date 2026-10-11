// PENDIENTE DE AUTORIZACIÓN. No crea conexiones/bases salvo opt-in explícito.
// CADEFAR_AUTORIZAR_CATALOGO_AISLADO=1 node --test tests/medicamento.integral.integration.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const autorizado = process.env.CADEFAR_AUTORIZAR_CATALOGO_AISLADO === '1';
test('Registro integral con Express/MySQL reales en base aleatoria aislada', {
    skip: autorizado ? false : 'Requiere autorización adicional para crear/migrar/eliminar una base aislada', timeout: 180000
}, async t => {
    const { default: dotenv } = await import('dotenv'); dotenv.config({ quiet: true });
    const { default: mysql } = await import('mysql2/promise');
    const nombre = `cadefar_catalogo_${randomBytes(8).toString('hex')}`;
    assert.match(nombre, /^cadefar_catalogo_[a-f0-9]{16}$/);
    assert.ok(![process.env.DB_NAME, process.env.DB_NAME_TEST, process.env.DB_NAME_PRODUCTION].includes(nombre));
    const admin = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.PASSWORD_DB });
    let db, server, creada = false;
    try {
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
        await t.test('Dos creaciones idénticas simultáneas: 201/409; solo un medicamento completo', async () => {
            const results = await Promise.all([request('POST', '', datos()), request('POST', '', datos())]);
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
            const results = await Promise.all([request('PATCH', `/${a.body.data.idMedicamento}`, { nombreComercial: 'Marca destino' }),
                request('PATCH', `/${b.body.data.idMedicamento}`, { nombreComercial: 'Marca destino' })]);
            assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
        });
        await t.test('Composición independiente no permite converger a producto existente', async () => {
            const created = await request('POST', '', datos({ composicion: [{ ...componente(p.id_principio_activo), cantidadPrincipioActivo: 1000 }, componente(q.id_principio_activo)] }));
            const id = created.body.data.idMedicamento, comp = created.body.data.composicion.find(c => c.idPrincipioActivo === p.id_principio_activo);
            assert.equal((await request('PATCH', `/${id}/composicion/${comp.idComposicion}`, { cantidadPrincipioActivo: 500 })).status, 409);
            assert.equal((await db.ComposicionMedicamento.findByPk(comp.idComposicion)).cantidad_principio_activo, '1000.0000');
        });
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (db) await db.sequelize.close();
        try { if (creada) await admin.query(`DROP DATABASE \`${nombre}\``); }
        finally { await admin.end(); }
    }
});
