import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Seleccionar y comprobar el entorno antes de cargar Sequelize y la app.
dotenv.config({ quiet: true });
const testDatabase = process.env.DB_NAME_TEST;
assert.equal(Boolean(testDatabase), true, 'Configurar DB_NAME_TEST para ejecutar integración');
assert.equal([process.env.DB_NAME, process.env.DB_NAME_PRODUCTION].filter(Boolean).some(
    name => name.toLowerCase() === testDatabase.toLowerCase()
), false, 'La base de pruebas debe ser distinta de desarrollo y producción');
process.env.NODE_ENV = 'test';

const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const { ROLES } = await import('../src/shared/constants/roles.js');

// Integración con MySQL configurado por el backend. Todos los datos de prueba
// viven en una transacción exterior que se revierte; los Services mantienen
// sus transacciones reales como savepoints. No se modifica el esquema.
test('Catálogo: HTTP, autorización, reglas históricas y búsqueda AND en MySQL', { timeout: 120000 }, async (t) => {
    const prefix = `CT${randomBytes(5).toString('hex')}`;
    const originalQuery = db.sequelize.query.bind(db.sequelize);
    const originalTransaction = db.sequelize.transaction.bind(db.sequelize);
    const originalConsoleError = console.error;
    const originalLogging = db.sequelize.options.logging;
    let transaction, server, requests = 0;
    const created = { usuarios: [], proveedores: [], principios: [], medicamentos: [] };

    try {
        db.sequelize.options.logging = false;
        assert.equal(db.sequelize.config.database === testDatabase, true, 'Sequelize debe usar DB_NAME_TEST');
        transaction = await originalTransaction();
        db.sequelize.query = (sql, options = {}) => originalQuery(sql, {
            ...options, transaction: options.transaction ?? transaction
        });
        db.sequelize.transaction = (options, callback) => originalTransaction(
            { transaction }, typeof options === 'function' ? options : callback
        );
        console.error = (...args) => {
            if (args[0]?.name !== 'AppError') originalConsoleError(...args);
        };

        const tokens = {};
        const hash = await bcrypt.hash(`Temporal-${prefix}-9!`, 4);
        for (const [nombre, idRol] of Object.entries(ROLES)) {
            const usuario = await db.Usuario.create({
                nombre_usuario: `${prefix}_${nombre}`, id_rol: idRol, password_hash: hash
            });
            created.usuarios.push(usuario.id_usuario);
            tokens[nombre] = generarToken({ idUsuario: usuario.id_usuario, idRol, versionCredenciales: usuario.version_credenciales });
        }
        const proveedor = await db.ProveedorLaboratorio.create({ nombre: `${prefix} proveedor` });
        const inactivo = await db.ProveedorLaboratorio.create({ nombre: `${prefix} inactivo`, estado: false });
        created.proveedores.push(proveedor.id_proveedor_laboratorio, inactivo.id_proveedor_laboratorio);

        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve, reject) => {
            server.once('listening', resolve);
            server.once('error', reject);
        });
        const base = `http://127.0.0.1:${server.address().port}/api`;
        const request = async (rol, method, path, status, body) => {
            const response = await fetch(`${base}${path}`, {
                method,
                headers: {
                    ...(rol ? { Cookie: `token=${tokens[rol]}` } : {}),
                    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
                },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {})
            });
            const result = await response.json();
            requests++;
            assert.equal(response.status, status, `${rol || 'sin sesión'} ${method} ${path}: ${JSON.stringify(result)}`);
            return result;
        };
        const medData = (suffix, extra = {}) => ({
            idProveedorLaboratorio: proveedor.id_proveedor_laboratorio,
            codigoMedicamento: `${prefix}${suffix}`,
            nombreComercial: `${prefix} producto ${suffix}`,
            formaFarmaceutica: 'Tableta', presentacion: '500 mg', unidadInventario: 'tableta',
            condicionVenta: 'Con receta', viaAdministracion: 'Oral', tipoLiberacion: 'Inmediata', ...extra
        });
        const createMed = async (suffix, extra) => {
            const { data } = await request('REGENTE', 'POST', '/medicamentos', 201, medData(suffix, extra));
            created.medicamentos.push(data.idMedicamento);
            return data;
        };
        const compData = (idPrincipioActivo, extra = {}) => ({
            idPrincipioActivo, cantidadPrincipioActivo: 500, unidadPrincipioActivo: 'mg',
            cantidadReferencia: 1, unidadReferencia: 'tableta', ...extra
        });
        const createComp = async (med, principio, extra) => (
            await request('REGENTE', 'POST', `/medicamentos/${med.idMedicamento}/composicion`, 201, compData(principio.idPrincipioActivo, extra))
        ).data;

        let medicamento, otro, principio, segundo, tercero, composicion;
        await t.test('Regente crea los catálogos y se respetan defaults y respuestas públicas', async () => {
            const { data } = await request('REGENTE', 'POST', '/principios-activos', 201, { nombre: `  ${prefix} ingrediente A  ` });
            principio = data;
            assert.equal(data.nombre, `${prefix} ingrediente A`);
            assert.equal(data.descripcion, null);
            assert.equal(data.estado, true);
            created.principios.push(data.idPrincipioActivo);
            for (const nombre of ['B', 'C']) {
                const response = await request('REGENTE', 'POST', '/principios-activos', 201, { nombre: `${prefix} ingrediente ${nombre}` });
                created.principios.push(response.data.idPrincipioActivo);
                if (nombre === 'B') segundo = response.data;
                else tercero = response.data;
            }
            medicamento = await createMed('A');
            otro = await createMed('B', { estado: false });
            assert.equal(medicamento.estado, true);
            assert.equal(medicamento.stockMinimo, 0);
            assert.deepEqual(medicamento.composicion, []);
            assert.deepEqual(Object.keys(medicamento.proveedorLaboratorio).sort(), ['idProveedorLaboratorio', 'nombre']);
            assert.equal(otro.estado, false);
            composicion = await createComp(medicamento, principio);
            assert.equal(composicion.principioActivo.nombre, principio.nombre);
            assert.equal(composicion.cantidadPrincipioActivo, '500.0000');
            assert.equal('id_composicion' in composicion, false);
        });

        await t.test('Matriz completa de consultas y denegaciones por rol y sin sesión', async () => {
            const m = `/medicamentos/${medicamento.idMedicamento}`;
            const p = `/principios-activos/${principio.idPrincipioActivo}`;
            const c = `${m}/composicion`;
            const lecturas = ['/medicamentos', m, c, '/principios-activos', p];
            for (const rol of Object.keys(ROLES)) {
                for (const path of lecturas) {
                    const status = rol === 'VENDEDOR' && path.startsWith('/principios-activos') ? 403 : 200;
                    await request(rol, 'GET', path, status);
                }
            }
            const escrituras = [
                ['POST', '/medicamentos', medData('Z')], ['PATCH', m, { nombreComercial: 'Cambio' }],
                ['PATCH', `${m}/estado`, { estado: false }],
                ['POST', '/principios-activos', { nombre: `${prefix} no autorizado` }],
                ['PATCH', p, { descripcion: 'Cambio' }], ['PATCH', `${p}/estado`, { estado: false }],
                ['POST', c, compData(segundo.idPrincipioActivo)],
                ['PATCH', `${c}/${composicion.idComposicion}`, { cantidadPrincipioActivo: 250 }],
                ['DELETE', `${c}/${composicion.idComposicion}`, undefined]
            ];
            for (const rol of ['ADMINISTRADOR', 'VENDEDOR']) {
                for (const [method, path, body] of escrituras) await request(rol, method, path, 403, body);
            }
            for (const path of lecturas) await request(null, 'GET', path, 401);
            for (const [method, path, body] of escrituras) await request(null, method, path, 401, body);
        });

        await t.test('Regente edita, cambia estado y corrige un ingrediente explícitamente', async () => {
            const m = `/medicamentos/${medicamento.idMedicamento}`;
            const p = `/principios-activos/${principio.idPrincipioActivo}`;
            const c = `${m}/composicion`;
            const result = await request('REGENTE', 'PATCH', m, 200, { nombreComercial: `${prefix} nombre corregido`, stockMinimo: 5 });
            assert.equal(result.data.stockMinimo, 5);
            for (const path of [`${m}/estado`, `${p}/estado`]) {
                assert.equal((await request('REGENTE', 'PATCH', path, 200, { estado: false })).data.estado, false);
                assert.equal((await request('REGENTE', 'PATCH', path, 200, { estado: true })).data.estado, true);
            }
            assert.equal((await request('REGENTE', 'PATCH', p, 200, { descripcion: '  Ingrediente de prueba  ' })).data.descripcion, 'Ingrediente de prueba');
            const edited = await request('REGENTE', 'PATCH', `${c}/${composicion.idComposicion}`, 200, {
                cantidadPrincipioActivo: 0.0001, unidadPrincipioActivo: 'g', cantidadReferencia: 2, unidadReferencia: 'unidades'
            });
            assert.equal(edited.data.cantidadPrincipioActivo, '0.0001');
            await request('REGENTE', 'DELETE', `${c}/${composicion.idComposicion}`, 200);
            await request('REGENTE', 'PATCH', `${c}/${composicion.idComposicion}`, 404, { cantidadReferencia: 1 });
            composicion = await createComp(medicamento, principio);
            await createComp(medicamento, segundo, { cantidadPrincipioActivo: 30 });
            await createComp(medicamento, tercero, { cantidadPrincipioActivo: 10 });
            await createComp(otro, principio);
        });

        await t.test('Unicidad, referencias inexistentes y proveedor inactivo', async () => {
            await request('REGENTE', 'POST', '/medicamentos', 409, medData('A'));
            await request('REGENTE', 'POST', '/medicamentos', 404, medData('X', { idProveedorLaboratorio: 2147483647 }));
            await request('REGENTE', 'POST', '/medicamentos', 409, medData('X', { idProveedorLaboratorio: inactivo.id_proveedor_laboratorio }));
            await request('REGENTE', 'PATCH', `/medicamentos/${otro.idMedicamento}`, 409, { codigoMedicamento: medicamento.codigoMedicamento });
            await request('REGENTE', 'POST', '/principios-activos', 409, { nombre: principio.nombre });
            await request('REGENTE', 'PATCH', `/principios-activos/${segundo.idPrincipioActivo}`, 409, { nombre: principio.nombre });
            const c = `/medicamentos/${medicamento.idMedicamento}/composicion`;
            await request('REGENTE', 'POST', c, 409, compData(principio.idPrincipioActivo));
            await request('REGENTE', 'POST', c, 404, compData(2147483647));
            for (const path of ['/medicamentos/2147483647', '/principios-activos/2147483647', '/medicamentos/2147483647/composicion']) {
                await request('REGENTE', 'GET', path, 404);
            }
            await request('REGENTE', 'PATCH', '/medicamentos/2147483647', 404, { nombreComercial: 'No existe' });
            await request('REGENTE', 'POST', '/medicamentos/2147483647/composicion', 404, compData(principio.idPrincipioActivo));
            await request('REGENTE', 'PATCH', `/medicamentos/${otro.idMedicamento}/composicion/${composicion.idComposicion}`, 404, { cantidadReferencia: 2 });
            await request('REGENTE', 'DELETE', `/medicamentos/${otro.idMedicamento}/composicion/${composicion.idComposicion}`, 404);
            await db.ProveedorLaboratorio.update({ estado: false }, { where: { id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio } });
            await request('REGENTE', 'PATCH', `/medicamentos/${medicamento.idMedicamento}`, 200, { stockMinimo: 6 });
            await request('REGENTE', 'PATCH', `/medicamentos/${medicamento.idMedicamento}`, 409, { idProveedorLaboratorio: proveedor.id_proveedor_laboratorio });
            await db.ProveedorLaboratorio.update({ estado: true }, { where: { id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio } });
        });

        await t.test('Validadores: IDs, longitudes, PATCH vacío, estado y campos desconocidos', async () => {
            for (const id of ['abc', '0', '-1', '1.5', '2147483648']) {
                await request('REGENTE', 'GET', `/medicamentos/${id}`, 400);
                await request('REGENTE', 'GET', `/principios-activos/${id}`, 400);
                await request('REGENTE', 'GET', `/medicamentos/${id}/composicion`, 400);
            }
            const m = `/medicamentos/${medicamento.idMedicamento}`;
            const p = `/principios-activos/${principio.idPrincipioActivo}`;
            const c = `${m}/composicion/${composicion.idComposicion}`;
            for (const path of [m, p, c]) {
                await request('REGENTE', 'PATCH', path, 400, {});
                await request('REGENTE', 'PATCH', path, 400, { estado: false });
                await request('REGENTE', 'PATCH', path, 400, { desconocido: 1 });
            }
            for (const path of [`${m}/estado`, `${p}/estado`]) {
                await request('REGENTE', 'PATCH', path, 400, { estado: 'false' });
                await request('REGENTE', 'PATCH', path, 400, { estado: false, nombre: 'No permitido' });
            }
            await request('REGENTE', 'PATCH', c, 400, { idPrincipioActivo: segundo.idPrincipioActivo });
            await request('REGENTE', 'POST', '/medicamentos', 400, { ...medData('X'), idMedicamento: 100 });
            await request('REGENTE', 'POST', '/medicamentos', 400, medData('X', { stockMinimo: -1 }));
            await request('REGENTE', 'POST', '/medicamentos', 400, medData('X', { codigoMedicamento: 'X'.repeat(21) }));
            await request('REGENTE', 'POST', '/principios-activos', 400, { nombre: ' ' });
            await request('REGENTE', 'POST', '/principios-activos', 400, { nombre: 'X'.repeat(151) });
            await request('REGENTE', 'GET', '/medicamentos?desconocido=1', 400);
            await request('REGENTE', 'GET', '/medicamentos?idPrincipioActivo=abc', 400);
            for (const value of [0, -1, 0.00001, 1.12345, 100000000]) {
                await request('REGENTE', 'POST', `${m}/composicion`, 400, compData(principio.idPrincipioActivo, { cantidadPrincipioActivo: value }));
                await request('REGENTE', 'PATCH', c, 400, { cantidadReferencia: value });
            }
            await request('REGENTE', 'PATCH', c, 400, { unidadReferencia: 'X'.repeat(31) });
        });

        await t.test('Búsqueda por código, nombre y varios principios con AND, composición completa', async () => {
            const common = `codigoMedicamento=${prefix}`;
            for (const rol of Object.keys(ROLES)) {
                const ids = [principio.idPrincipioActivo, segundo.idPrincipioActivo];
                const result = await request(rol, 'GET', `/medicamentos?${common}&idPrincipioActivo=${ids[0]}&idPrincipioActivo=${ids[1]}`, 200);
                assert.deepEqual(result.data.map(m => m.idMedicamento), [medicamento.idMedicamento]);
                assert.equal(result.data[0].composicion.length, 3);
                const single = await request(rol, 'GET', `/medicamentos?${common}&idPrincipioActivo=${ids[0]}`, 200);
                assert.equal(single.data.length, 2);
                const repeated = await request(rol, 'GET', `/medicamentos?${common}&idPrincipioActivo=${ids[0]}&idPrincipioActivo=${ids[0]}`, 200);
                assert.equal(repeated.data.length, 2);
                const missing = await request(rol, 'GET', `/medicamentos?${common}&idPrincipioActivo=${ids[0]}&idPrincipioActivo=2147483647`, 200);
                assert.deepEqual(missing.data, []);
                const name = await request(rol, 'GET', `/medicamentos?nombreComercial=${encodeURIComponent(`${prefix} nombre corregido`)}`, 200);
                assert.deepEqual(name.data.map(m => m.idMedicamento), [medicamento.idMedicamento]);
            }
            assert.deepEqual((await request('REGENTE', 'GET', '/medicamentos?codigoMedicamento=%25', 200)).data, []);
        });

        await t.test('Existencia sin movimientos no bloquea; primer movimiento bloquea toda la identidad y composición', async () => {
            const existencia = await db.ExistenciaMedicamento.create({
                id_medicamento: medicamento.idMedicamento, codigo_existencia: `${prefix}-001`,
                fecha_vencimiento: '2035-12-31', precision_vencimiento: 'DIA'
            });
            const m = `/medicamentos/${medicamento.idMedicamento}`;
            const c = `${m}/composicion`;
            await request('REGENTE', 'PATCH', m, 200, { presentacion: 'Presentación corregida' });
            await request('REGENTE', 'PATCH', `${c}/${composicion.idComposicion}`, 200, { cantidadReferencia: 2 });
            const segundaExistencia = await db.ExistenciaMedicamento.create({
                id_medicamento: medicamento.idMedicamento, codigo_existencia: `${prefix}-002`,
                fecha_vencimiento: '2036-12-31', precision_vencimiento: 'DIA'
            });
            const usuario = created.usuarios[Object.keys(ROLES).indexOf('REGENTE')];
            const movimiento = await db.MovimientoInventario.create({
                id_usuario: usuario, id_existencia: segundaExistencia.id_existencia,
                direccion: 'ENTRADA', cantidad: 1, motivo: 'Ajuste', costo_unitario_aplicado: 0
            });
            await db.MovimientoInventario.create({
                id_usuario: usuario, id_existencia: segundaExistencia.id_existencia,
                id_movimiento_original: movimiento.id_movimiento,
                direccion: 'SALIDA', cantidad: 1, motivo: 'Reversión', costo_unitario_aplicado: 0
            });
            assert.equal(await db.MovimientoInventario.count({ where: { id_existencia: existencia.id_existencia } }), 0);
            const before = (await request('REGENTE', 'GET', m, 200)).data;
            const cambios = {
                codigoMedicamento: `${prefix}N`, idProveedorLaboratorio: inactivo.id_proveedor_laboratorio,
                formaFarmaceutica: 'Cápsula', presentacion: 'Otra presentación', unidadInventario: 'cápsula',
                viaAdministracion: 'Otra vía', tipoLiberacion: 'Prolongada'
            };
            for (const [campo, valor] of Object.entries(cambios)) await request('REGENTE', 'PATCH', m, 409, { [campo]: valor });
            await request('REGENTE', 'POST', c, 409, compData(principio.idPrincipioActivo));
            for (const data of [{ cantidadPrincipioActivo: 250 }, { unidadPrincipioActivo: 'g' }, { cantidadReferencia: 1 }, { unidadReferencia: 'cápsula' }]) {
                await request('REGENTE', 'PATCH', `${c}/${composicion.idComposicion}`, 409, data);
            }
            await request('REGENTE', 'DELETE', `${c}/${composicion.idComposicion}`, 409);
            assert.deepEqual((await request('REGENTE', 'GET', m, 200)).data, before);
            await request('REGENTE', 'PATCH', m, 200, { codigoMedicamento: before.codigoMedicamento });
            const allowed = await request('REGENTE', 'PATCH', m, 200, {
                nombreComercial: `${prefix} corrección tipográfica`, stockMinimo: 10, condicionVenta: 'Venta libre'
            });
            assert.equal(allowed.data.stockMinimo, 10);
            await request('REGENTE', 'PATCH', `${m}/estado`, 200, { estado: false });
            const after = (await request('REGENTE', 'GET', m, 200)).data;
            assert.deepEqual(after.composicion, before.composicion);
            assert.equal(after.estado, false);
        });

        await t.test('JWT inválido y cuenta inactiva no acceden al catálogo', async () => {
            const response = await fetch(`${base}/medicamentos`, { headers: { Cookie: 'token=invalid' } });
            requests++;
            assert.equal(response.status, 401);
            await db.Usuario.update({ estado: false }, { where: { id_usuario: created.usuarios[0] } });
            await request('ADMINISTRADOR', 'GET', '/medicamentos', 401);
        });

        t.diagnostic(`${requests} comprobaciones HTTP contra MySQL, con JWT y autenticación reales.`);
    } finally {
        if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        db.sequelize.query = originalQuery;
        db.sequelize.transaction = originalTransaction;
        console.error = originalConsoleError;
        try {
            if (transaction && !transaction.finished) await transaction.rollback();
            for (const [model, ids, key] of [
                [db.Usuario, created.usuarios, 'id_usuario'],
                [db.ProveedorLaboratorio, created.proveedores, 'id_proveedor_laboratorio'],
                [db.PrincipioActivo, created.principios, 'id_principio_activo'],
                [db.Medicamento, created.medicamentos, 'id_medicamento']
            ]) {
                if (ids.length) assert.equal(await model.count({ where: { [key]: ids }, logging: false }), 0, 'Datos de prueba revertidos');
            }
        } finally {
            db.sequelize.options.logging = originalLogging;
            await db.sequelize.close();
        }
    }
});
