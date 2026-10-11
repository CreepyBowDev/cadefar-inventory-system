import test from 'node:test';
import assert from 'node:assert/strict';
import { obtenerPrefijoMedicamento } from '../src/shared/utils/codigo-medicamento.js';
import { medicamentoValidator } from '../src/business/validators/medicamento.validator.js';

// Servicios y HTTP reales, almacenamiento/transacciones simulados. Nunca MySQL.
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'medicamentos_sin_conexion';
process.env.JWT_SECRET = 'secreto_sintetico_medicamentos_pruebas';
const { default: db } = await import('../src/data/models/index.js');
const { medicamentoService: service } = await import('../src/business/services/medicamento.service.js');
const { medicamentoRepository: repo } = await import('../src/data/repositories/medicamento.repository.js');
const { usuarioRepository } = await import('../src/data/repositories/usuario.repository.js');
const { app } = await import('../src/app.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');

const datos = (nombreComercial = 'Paracetamol 500 mg') => ({
    idProveedorLaboratorio: 1, nombreComercial, formaFarmaceutica: 'Tableta',
    presentacion: '500 mg', unidadInventario: 'tableta', stockMinimo: 0,
    condicionVenta: 'Libre', viaAdministracion: 'Oral', tipoLiberacion: 'Inmediata'
});
const fila = (codigo, id = 1, estado = true) => ({
    id_medicamento: id, codigo_medicamento: codigo, estado, id_proveedor_laboratorio: 1,
    nombre_comercial: 'Nombre corregido', forma_farmaceutica: 'Tableta', presentacion: '500 mg',
    unidad_inventario: 'tableta', stock_minimo: 0, condicion_venta: 'Libre',
    via_administracion: 'Oral', tipo_liberacion: 'Inmediata', composiciones: []
});
const unique = (indice = 'uq_medicamento_codigo') => new db.Sequelize.UniqueConstraintError({
    parent: { code: 'ER_DUP_ENTRY', sqlMessage: `Duplicate entry 'sintetico' for key 'medicamento.${indice}'` }
});
const normalizar = codigo => codigo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

const almacenamiento = (t, inicial = []) => {
    let registros = structuredClone(inicial), sequence = 100, antesDeInsertar;
    const eventos = [], transacciones = [];
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('MySQL prohibido'); });
    t.mock.method(db.sequelize, 'transaction', async callback => {
        const transaction = { id: transacciones.length + 1, snapshot: structuredClone(registros),
            nuevas: [], cambios: [], LOCK: { UPDATE: 'UPDATE' } };
        transacciones.push(transaction); eventos.push(['inicio', transaction.id]);
        try {
            const result = await callback(transaction);
            if (transaction.nuevas.some(n => registros.some(r => normalizar(r.codigo_medicamento) === normalizar(n.codigo_medicamento)))) throw unique();
            registros.push(...transaction.nuevas);
            for (const cambio of transaction.cambios) Object.assign(registros.find(r => r.id_medicamento === cambio.id), cambio.data);
            eventos.push(['commit', transaction.id]);
            return result;
        } catch (error) { eventos.push(['rollback', transaction.id]); throw error; }
    });
    t.mock.method(repo, 'findProveedorById', async () => ({ estado: true }));
    t.mock.method(repo, 'findMayorCorrelativo', async ({ prefijo, transaction }) => {
        eventos.push(['maximo', transaction.id]);
        return Math.max(0, ...transaction.snapshot.map(r => normalizar(r.codigo_medicamento))
            .filter(c => new RegExp(`^${prefijo}[0-9]{3}$`).test(c)).map(c => Number(c.slice(3))));
    });
    t.mock.method(repo, 'findByCodigo', async ({ codigoMedicamento, transaction }) =>
        transaction.snapshot.find(r => normalizar(r.codigo_medicamento) === normalizar(codigoMedicamento)));
    t.mock.method(repo, 'create', async ({ data, transaction }) => {
        if (antesDeInsertar) await antesDeInsertar(data, transaction);
        const nueva = { ...fila(data.codigo_medicamento, sequence++), ...data };
        transaction.nuevas.push(nueva); eventos.push(['insert', transaction.id, data.codigo_medicamento]);
        return nueva;
    });
    t.mock.method(repo, 'findById', async ({ idMedicamento, transaction, lock }) => {
        const r = (transaction ? [...transaction.snapshot, ...transaction.nuevas] : registros).find(r => r.id_medicamento === idMedicamento);
        return r && (lock ? db.Medicamento.build(r, { isNewRecord: false, raw: true }) : r);
    });
    t.mock.method(repo, 'update', async ({ idMedicamento, data, transaction }) => {
        assert.equal(Object.hasOwn(data, 'codigo_medicamento'), false);
        Object.assign(transaction.snapshot.find(r => r.id_medicamento === idMedicamento), data);
        transaction.cambios.push({ id: idMedicamento, data });
    });
    return { registros: () => registros, eventos, transacciones,
        insertarExterno: r => registros.push(r), antesDeInsertar: callback => { antesDeInsertar = callback; } };
};

test('Prefijo ASCII: caja, acentos, Ñ, símbolos y nombres cortos', async t => {
    for (const [nombre, prefijo] of [[' paracetamol ', 'PAR'], ['Paroxetina', 'PAR'],
        ['Íbuproféno', 'IBU'], ['Ñandú', 'NAN'], ['  5-Á / b_c  ', 'ABC'],
        ['A\u0301cido acetilsalicílico', 'ACI']]) {
        await t.test(nombre, () => assert.equal(obtenerPrefijoMedicamento(nombre), prefijo));
    }
    for (const nombre of ['A', 'Ñá 12!', '123 +']) {
        await t.test(`rechaza ${nombre}`, () => assert.throws(() => obtenerPrefijoMedicamento(nombre),
            e => e.statusCode === 400 && /tres letras/.test(e.message)));
    }
});

test('Contrato: sin código en POST/PATCH, filtro histórico conservado', () => {
    assert.equal(medicamentoValidator.validateCreate(datos()).success, true);
    for (const codigoMedicamento of ['PAR001', undefined, null]) {
        assert.equal(medicamentoValidator.validateCreate({ ...datos(), codigoMedicamento }).success, false);
        assert.equal(medicamentoValidator.validateUpdate({ nombreComercial: 'Otro', codigoMedicamento }).success, false);
    }
    assert.equal(medicamentoValidator.validateUpdate({ nombreComercial: 'Otro' }).success, true);
    assert.equal(medicamentoValidator.validateUpdate({ estado: false }).success, false);
    assert.equal(medicamentoValidator.validateFiltros({ codigoMedicamento: 'histórico-irregular' }).success, true);
});

test('Repository: máximo numérico parametrizado, colación de columna y sin filtrar estado/nombre', async t => {
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('MySQL prohibido'); });
    const transaction = { id: 'tx' };
    t.mock.method(db.sequelize, 'query', async (sql, options) => {
        assert.match(sql, /MAX\(CAST\(SUBSTRING/);
        assert.match(sql, /CHAR_LENGTH\(codigo_medicamento\) = 6/);
        assert.match(sql, /LEFT\(codigo_medicamento, 3\) = :prefijo/);
        assert.match(sql, /REGEXP_LIKE/);
        assert.doesNotMatch(sql, /COUNT|estado|nombre_comercial|COLLATE|FOR UPDATE/i);
        assert.deepEqual(options.replacements, { prefijo: 'PAR' });
        assert.equal(options.transaction, transaction);
        assert.equal(options.type, db.Sequelize.QueryTypes.SELECT);
        return [{ mayor: '4' }];
    });
    assert.equal(await repo.findMayorCorrelativo({ prefijo: 'PAR', transaction }), 4);
});

test('Generación y conservación de históricos con almacenamiento simulado', async t => {
    for (const [codigos, esperado] of [[[], 'PAR001'], [['PAR001', 'PAR002'], 'PAR003'],
        [['PAR001', 'PAR002', 'PAR004'], 'PAR005'], [['par004', 'PÁR005'], 'PAR006'],
        [['PAR-007', 'PARABC', 'PAR1000'], 'PAR001']]) {
        await t.test(`${codigos.join(',')} -> ${esperado}`, async t => {
            const inicial = codigos.map((c, i) => fila(c, i + 1, false));
            const store = almacenamiento(t, inicial);
            const result = await service.createMedicamento(datos());
            assert.equal(result.codigoMedicamento, esperado);
            assert.deepEqual(store.registros().slice(0, inicial.length), inicial);
            assert.equal(store.eventos.at(-1)[0], 'commit');
        });
    }
    await t.test('Paracetamol/Paroxetina comparten secuencia; Ibuprofeno es independiente', async t => {
        const store = almacenamiento(t);
        for (const [nombre, esperado] of [['paracetamol', 'PAR001'], ['Paroxetina', 'PAR002'], ['Íbuprofeno', 'IBU001']]) {
            const result = await service.createMedicamento(datos(nombre));
            assert.equal(result.codigoMedicamento, esperado);
            assert.equal(result.nombreComercial, nombre);
        }
        assert.equal(store.registros().length, 3);
    });
    await t.test('Histórico equivalente irregular ocupado: saltar candidato según igualdad MySQL simulada', async t => {
        const store = almacenamiento(t, [fila('PA\u0301R001')]);
        t.mock.method(repo, 'findMayorCorrelativo', async () => 0);
        assert.equal((await service.createMedicamento(datos())).codigoMedicamento, 'PAR002');
        assert.equal(store.registros()[0].codigo_medicamento, 'PA\u0301R001');
    });
    await t.test('999 rechaza sin INSERT y revierte', async t => {
        const store = almacenamiento(t, [fila('PAR999', 1, false)]);
        await assert.rejects(service.createMedicamento(datos()), e => e.statusCode === 409 && /999/.test(e.message));
        assert.deepEqual(store.registros(), [fila('PAR999', 1, false)]);
        assert.deepEqual(store.eventos.map(e => e[0]), ['inicio', 'maximo', 'rollback']);
    });
    await t.test('998 permite asignar exactamente 999; siguiente registro rechazado', async t => {
        const store = almacenamiento(t, [fila('PAR998')]);
        assert.equal((await service.createMedicamento(datos())).codigoMedicamento, 'PAR999');
        await assert.rejects(service.createMedicamento(datos('Paroxetina')), { statusCode: 409 });
        assert.deepEqual(store.registros().map(r => r.codigo_medicamento), ['PAR998', 'PAR999']);
    });
    await t.test('Cambio de nombre conserva ID, código y composición; código manual rechazado', async t => {
        const original = { ...fila('LEGADO-01'), composiciones: [{ id_composicion: 7, id_medicamento: 1,
            id_principio_activo: 2, cantidad_principio_activo: '500.0000', unidad_principio_activo: 'mg',
            cantidad_referencia: '1.0000', unidad_referencia: 'tableta' }] };
        const store = almacenamiento(t, [original]);
        const result = await service.updateMedicamento(1, { nombreComercial: 'Ibuprofeno corregido' });
        assert.equal(result.codigoMedicamento, 'LEGADO-01');
        assert.equal(result.idMedicamento, 1);
        assert.equal(result.composicion[0].idComposicion, 7);
        assert.deepEqual(store.registros()[0], { ...original, nombre_comercial: 'Ibuprofeno corregido' });
        for (const codigoMedicamento of ['LEGADO-01', 'OTRO']) {
            await assert.rejects(service.updateMedicamento(1, { codigoMedicamento }), { statusCode: 400 });
            await assert.rejects(service.createMedicamento({ ...datos(), codigoMedicamento }), { statusCode: 400 });
        }
    });
    await t.test('Nombre corto falla antes de abrir transacción', async t => {
        const store = almacenamiento(t);
        await assert.rejects(service.createMedicamento(datos('Á2')), { statusCode: 400 });
        assert.equal(store.transacciones.length, 0);
    });
    await t.test('Proveedor inexistente o inactivo mantiene sus errores', async t => {
        almacenamiento(t);
        t.mock.method(repo, 'findProveedorById', async () => null);
        await assert.rejects(service.createMedicamento(datos()), { statusCode: 404 });
        t.mock.method(repo, 'findProveedorById', async () => ({ estado: false }));
        await assert.rejects(service.createMedicamento(datos()), { statusCode: 409 });
    });
});

test('Reintentos y carreras simuladas: rollback antes de snapshot nuevo', async t => {
    for (const inicial of [[], [fila('PAR004')]]) {
        await t.test(`dos solicitudes con ${inicial.length ? 'prefijo existente' : 'prefijo nuevo'}`, async t => {
            const store = almacenamiento(t, inicial);
            let liberar, llegadas = 0;
            const barrera = new Promise(resolve => { liberar = resolve; });
            store.antesDeInsertar(async () => { if (++llegadas <= 2) { if (llegadas === 2) liberar(); await barrera; } });
            const results = await Promise.all([service.createMedicamento(datos()), service.createMedicamento(datos('Paroxetina'))]);
            assert.deepEqual(results.map(r => r.codigoMedicamento).sort(), inicial.length ? ['PAR005', 'PAR006'] : ['PAR001', 'PAR002']);
            assert.equal(store.transacciones.length, 3);
            const rollback = store.eventos.findIndex(e => e[0] === 'rollback');
            const reinicio = store.eventos.findIndex(e => e[0] === 'inicio' && e[1] === 3);
            assert.ok(rollback < reinicio);
            assert.equal(new Set(store.registros().map(r => r.codigo_medicamento)).size, store.registros().length);
        });
    }
    await t.test('Colisión de INSERT: revalidar proveedor y máximo en otra transacción', async t => {
        const store = almacenamiento(t);
        store.antesDeInsertar(async (_data, tx) => {
            if (tx.id === 1) { store.insertarExterno(fila('PAR001')); throw unique(); }
        });
        assert.equal((await service.createMedicamento(datos())).codigoMedicamento, 'PAR002');
        assert.equal(repo.findProveedorById.mock.callCount(), 2);
        assert.equal(store.transacciones.length, 2);
        assert.notEqual(store.transacciones[0], store.transacciones[1]);
        assert.deepEqual(store.eventos.map(e => e[0]), ['inicio', 'maximo', 'rollback', 'inicio', 'maximo', 'insert', 'commit']);
    });
    await t.test('Límite de cinco intentos; sin confirmaciones parciales', async t => {
        const store = almacenamiento(t);
        store.antesDeInsertar(async () => { throw unique(); });
        await assert.rejects(service.createMedicamento(datos()), e => e.statusCode === 409 && /simultáneos/.test(e.message));
        assert.equal(store.transacciones.length, 5);
        assert.equal(store.eventos.filter(e => e[0] === 'rollback').length, 5);
        assert.deepEqual(store.registros(), []);
    });
    for (const [error, estado, texto] of [
        [Object.assign(new Error('deadlock'), { parent: { code: 'ER_LOCK_DEADLOCK' } }), 409, /bloqueo mutuo/],
        [Object.assign(new Error('timeout'), { original: { code: 'ER_LOCK_WAIT_TIMEOUT' } }), 409, /espera/],
        [unique('otro_indice'), undefined, undefined], [new Error('fallo técnico'), undefined, undefined]
    ]) {
        await t.test(`no reintentar ${error.message || error.parent?.code}`, async t => {
            const store = almacenamiento(t);
            store.antesDeInsertar(async () => { throw error; });
            await assert.rejects(service.createMedicamento(datos()), e => estado ? e.statusCode === estado && texto.test(e.message) : e === error);
            assert.equal(store.transacciones.length, 1);
            assert.deepEqual(store.registros(), []);
        });
    }
    await t.test('Fallo leyendo DTO revierte el INSERT completo', async t => {
        const store = almacenamiento(t);
        t.mock.method(repo, 'findById', async () => { throw new Error('fallo lectura'); });
        await assert.rejects(service.createMedicamento(datos()), /fallo lectura/);
        assert.deepEqual(store.registros(), []);
        assert.equal(store.eventos.at(-1)[0], 'rollback');
    });
    await t.test('Operación fallida no consume código; nuevo registro puede confirmar 001', async t => {
        const store = almacenamiento(t);
        let falla = true;
        store.antesDeInsertar(async () => { if (falla) { falla = false; throw new Error('fallo temporal'); } });
        await assert.rejects(service.createMedicamento(datos()), /fallo temporal/);
        assert.equal((await service.createMedicamento(datos())).codigoMedicamento, 'PAR001');
        assert.equal(store.registros().length, 1);
    });
});

test('HTTP real sin MySQL: POST/PATCH, consultas, composición y permisos', async t => {
    const store = almacenamiento(t);
    t.mock.method(console, 'error', () => {});
    t.mock.method(usuarioRepository, 'findByIdForSession', async ({ idUsuario }) => ({
        id_usuario: idUsuario, id_rol: idUsuario, nombre_usuario: 'sintetico', estado: true, version_credenciales: 0
    }));
    t.mock.method(repo, 'findAll', async filtros => {
        assert.deepEqual(filtros, { codigoMedicamento: 'PAR' });
        return store.registros();
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const request = async (method, path, body, status, rol = 2) => {
        const token = generarToken({ idUsuario: rol, idRol: rol, versionCredenciales: 0 });
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/medicamentos${path}`, {
            method, headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        const result = await response.json();
        assert.equal(response.status, status, JSON.stringify(result));
        return result;
    };
    try {
        await t.test('POST sin código devuelve código confirmado; consulta por ID/código/composición', async () => {
            const { data } = await request('POST', '', datos(), 201);
            assert.equal(data.codigoMedicamento, 'PAR001');
            assert.equal(store.eventos.at(-1)[0], 'commit');
            for (const rol of [1, 2, 3]) {
                assert.equal((await request('GET', `/${data.idMedicamento}`, undefined, 200, rol)).data.codigoMedicamento, 'PAR001');
                assert.equal((await request('GET', '?codigoMedicamento=PAR', undefined, 200, rol)).data[0].codigoMedicamento, 'PAR001');
                assert.deepEqual((await request('GET', `/${data.idMedicamento}/composicion`, undefined, 200, rol)).data, []);
            }
        });
        await t.test('Código manual rechazado en POST y PATCH; nombre no regenera código', async () => {
            await request('POST', '', { ...datos(), codigoMedicamento: 'MAN001' }, 400);
            await request('PATCH', '/100', { codigoMedicamento: 'PAR001' }, 400);
            const { data } = await request('PATCH', '/100', { nombreComercial: 'Ibuprofeno corregido' }, 200);
            assert.equal(data.codigoMedicamento, 'PAR001');
        });
        await t.test('Administrador/Vendedor no pueden crear ni editar', async () => {
            for (const rol of [1, 3]) {
                await request('POST', '', datos(), 403, rol);
                await request('PATCH', '/100', { nombreComercial: 'Otro' }, 403, rol);
            }
            assert.equal(store.registros().length, 1);
        });
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('Transacciones Sequelize gestionadas reales con transporte SQL simulado', async t => {
    const eventos = [], snapshots = new Map();
    let confirmado = false;
    t.mock.method(db.sequelize.connectionManager, 'getConnection', async () => ({}));
    t.mock.method(db.sequelize.connectionManager, 'releaseConnection', async () => {});
    t.mock.method(db.sequelize.connectionManager, 'destroyConnection', async () => {});
    t.mock.method(db.sequelize, 'query', async (sql, options) => {
        assert.match(sql, /^(START TRANSACTION|COMMIT|ROLLBACK)/);
        const id = options.transaction.id;
        eventos.push([sql, id]);
        if (sql.startsWith('START')) snapshots.set(id, confirmado);
        return [];
    });
    t.mock.method(repo, 'findProveedorById', async () => ({ estado: true }));
    t.mock.method(repo, 'findMayorCorrelativo', async ({ transaction }) => snapshots.get(transaction.id) ? 1 : 0);
    t.mock.method(repo, 'findByCodigo', async () => null);
    t.mock.method(repo, 'create', async ({ data, transaction }) => {
        if (!snapshots.get(transaction.id)) { confirmado = true; throw unique(); }
        return fila(data.codigo_medicamento, 2);
    });
    t.mock.method(repo, 'findById', async () => fila('PAR002', 2));
    assert.equal((await service.createMedicamento(datos())).codigoMedicamento, 'PAR002');
    assert.deepEqual(eventos.map(e => e[0]), ['START TRANSACTION;', 'ROLLBACK;', 'START TRANSACTION;', 'COMMIT;']);
    assert.notEqual(eventos[0][1], eventos[2][1]);
    assert.equal(db.sequelize.connectionManager.releaseConnection.mock.callCount(), 2);
});
