import test from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'catalogo_integral_sin_mysql';
process.env.JWT_SECRET = 'secreto_sintetico_catalogo_integral';
const { default: db } = await import('../src/data/models/index.js');
const { medicamentoService: meds } = await import('../src/business/services/medicamento.service.js');
const { composicionMedicamentoService: comps } = await import('../src/business/services/composicion-medicamento.service.js');
const { medicamentoRepository: repo } = await import('../src/data/repositories/medicamento.repository.js');
const { composicionMedicamentoRepository: cr } = await import('../src/data/repositories/composicion-medicamento.repository.js');
const { medicamentoValidator: validator } = await import('../src/business/validators/medicamento.validator.js');
const { composicionCanonica } = await import('../src/business/services/identidad-medicamento.js');
const { usuarioRepository } = await import('../src/data/repositories/usuario.repository.js');
const { app } = await import('../src/app.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');

const componente = (idPrincipioActivo = 1, cantidadPrincipioActivo = 500) => ({
    idPrincipioActivo, cantidadPrincipioActivo, unidadPrincipioActivo: 'mg', cantidadReferencia: 1, unidadReferencia: 'tableta'
});
const datos = (extra = {}) => ({ nombreComercial: 'Paracetamol Demo A', idProveedorLaboratorio: 1,
    formaFarmaceutica: 'TABLETA', presentacion: 'TABLETAS', unidadInventario: 'TABLETA',
    viaAdministracion: 'ORAL', tipoLiberacion: 'INMEDIATA', condicionVenta: 'LIBRE', stockMinimo: 10,
    composicion: [componente()], ...extra });
const campos = { nombreComercial: 'nombre_comercial', idProveedorLaboratorio: 'id_proveedor_laboratorio',
    formaFarmaceutica: 'forma_farmaceutica', presentacion: 'presentacion', unidadInventario: 'unidad_inventario',
    viaAdministracion: 'via_administracion', tipoLiberacion: 'tipo_liberacion', condicionVenta: 'condicion_venta', stockMinimo: 'stock_minimo', estado: 'estado' };
const modelo = (data, id = 1) => ({ id_medicamento: id, codigo_medicamento: `PAR${String(id).padStart(3, '0')}`, estado: true,
    ...Object.fromEntries(Object.entries(data).filter(([k]) => campos[k]).map(([k, v]) => [campos[k], v])) });
const relacion = (c, med, id) => ({ id_composicion: id, id_medicamento: med, id_principio_activo: c.idPrincipioActivo,
    cantidad_principio_activo: c.cantidadPrincipioActivo, unidad_principio_activo: c.unidadPrincipioActivo,
    cantidad_referencia: c.cantidadReferencia, unidad_referencia: c.unidadReferencia });
const texto = s => s.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

// Mutex, READ COMMITTED, UNIQUE y rollback son simulados; no prueba InnoDB real.
const fixture = (t, inicial = []) => {
    const estado = { medicamentos: inicial.map((d, i) => modelo(d, i + 1)),
        composiciones: inicial.flatMap((d, i) => d.composicion.map((c, j) => relacion(c, i + 1, (i + 1) * 10 + j))), compras: [], movimientos: [] };
    const locks = new Map(), eventos = [], transactions = [];
    let idMed = 100, idComp = 1000, falloComponente, falloCodigo = false;
    const vista = tx => ({ medicamentos: [...estado.medicamentos.filter(m => !tx?.medicamentos.has(m.id_medicamento)), ...tx?.medicamentos.values() || []],
        composiciones: [...estado.composiciones.filter(c => !tx?.composiciones.has(c.id_composicion)), ...[...tx?.composiciones.values() || []].filter(Boolean)] });
    const lock = async (key, tx) => {
        if (tx.keys.has(key)) return;
        const anterior = locks.get(key) || Promise.resolve();
        let release;
        const espera = new Promise(resolve => { release = resolve; });
        locks.set(key, anterior.then(() => espera));
        eventos.push(['espera', key, tx.id]); await anterior;
        tx.keys.add(key); tx.release.push(release); eventos.push(['lock', key, tx.id]);
    };
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('MySQL prohibido'); });
    t.mock.method(db.sequelize, 'transaction', async (options, callback) => {
        assert.equal(options.isolationLevel, 'READ COMMITTED');
        const tx = { id: transactions.length + 1, options, LOCK: { UPDATE: 'UPDATE', SHARE: 'SHARE' },
            keys: new Set(), release: [], medicamentos: new Map(), composiciones: new Map() };
        transactions.push(tx); eventos.push(['start', tx.id]);
        try {
            const result = await callback(tx);
            for (const m of tx.medicamentos.values()) {
                const otro = estado.medicamentos.find(e => e.id_medicamento !== m.id_medicamento && texto(e.codigo_medicamento) === texto(m.codigo_medicamento));
                if (otro) throw new db.Sequelize.UniqueConstraintError({ parent: { sqlMessage: "Duplicate entry 'x' for key 'medicamento.uq_medicamento_codigo'" } });
            }
            const actual = vista(tx); estado.medicamentos = actual.medicamentos; estado.composiciones = actual.composiciones;
            eventos.push(['commit', tx.id]); return result;
        } catch (error) { eventos.push(['rollback', tx.id]); throw error; }
        finally { for (const release of tx.release.reverse()) release(); }
    });
    t.mock.method(repo, 'findProveedorById', async ({ idProveedorLaboratorio: id, exclusivo, transaction: tx }) => {
        assert.equal(exclusivo, true); await lock(`proveedor${id}`, tx);
        return [1, 2].includes(id) ? { estado: true } : null;
    });
    t.mock.method(repo, 'findById', async ({ idMedicamento: id, transaction: tx, lock: bloquear }) => {
        if (bloquear) await lock(`med${id}`, tx);
        const state = vista(tx), m = state.medicamentos.find(m => m.id_medicamento === id);
        if (!m) return null;
        return bloquear ? db.Medicamento.build(m, { isNewRecord: false, raw: true }) : { ...m,
            composiciones: state.composiciones.filter(c => c.id_medicamento === id) };
    });
    t.mock.method(repo, 'findMayorCorrelativo', async ({ prefijo, transaction: tx }) => {
        eventos.push(['codigo', tx.id]);
        return Math.max(0, ...vista(tx).medicamentos.filter(m => new RegExp(`^${prefijo}[0-9]{3}$`).test(m.codigo_medicamento)).map(m => Number(m.codigo_medicamento.slice(3))));
    });
    t.mock.method(repo, 'findByCodigo', async ({ codigoMedicamento, transaction: tx }) => vista(tx).medicamentos.find(m => texto(m.codigo_medicamento) === texto(codigoMedicamento)));
    t.mock.method(repo, 'create', async ({ data, transaction: tx }) => {
        if (falloCodigo) { falloCodigo = false; throw new db.Sequelize.UniqueConstraintError({ parent: { sqlMessage: "Duplicate entry 'x' for key 'uq_medicamento_codigo'" } }); }
        const m = { ...data, id_medicamento: idMed++, estado: data.estado ?? true };
        tx.medicamentos.set(m.id_medicamento, m); return m;
    });
    t.mock.method(repo, 'update', async ({ idMedicamento: id, data, transaction: tx }) => {
        assert.equal(Object.hasOwn(data, 'codigo_medicamento'), false);
        tx.medicamentos.set(id, { ...vista(tx).medicamentos.find(m => m.id_medicamento === id), ...data });
    });
    t.mock.method(repo, 'hasMovimientos', async ({ idMedicamento: id, transaction: tx }) => Boolean(vista(tx).medicamentos.find(m => m.id_medicamento === id)?.historial));
    t.mock.method(cr, 'findPrincipioById', async ({ idPrincipioActivo }) => [1, 2, 3].includes(idPrincipioActivo) ? { id_principio_activo: idPrincipioActivo } : null);
    t.mock.method(cr, 'findAllForMedicamento', async ({ idMedicamento: id, transaction: tx }) => vista(tx).composiciones.filter(c => c.id_medicamento === id));
    t.mock.method(cr, 'findByPrincipio', async ({ idMedicamento, idPrincipioActivo, transaction: tx }) => vista(tx).composiciones.find(c => c.id_medicamento === idMedicamento && c.id_principio_activo === idPrincipioActivo));
    t.mock.method(cr, 'findById', async ({ idMedicamento, idComposicion, transaction: tx }) => vista(tx).composiciones.find(c => c.id_medicamento === idMedicamento && c.id_composicion === idComposicion));
    t.mock.method(cr, 'create', async ({ data, transaction: tx }) => {
        if (data.id_principio_activo === falloComponente) throw new Error('Fallo intermedio de composición');
        const c = { ...data, id_composicion: idComp++ }; tx.composiciones.set(c.id_composicion, c); return c;
    });
    t.mock.method(cr, 'update', async ({ idComposicion: id, data, transaction: tx }) => tx.composiciones.set(id, { ...vista(tx).composiciones.find(c => c.id_composicion === id), ...data }));
    t.mock.method(cr, 'remove', async ({ idComposicion, transaction: tx }) => tx.composiciones.set(idComposicion, null));
    t.mock.method(repo, 'findDuplicadosIdentidad', async ({ medicamento: m, composicion: cs, idMedicamento, transaction: tx }) => {
        assert.ok(tx.keys.has(`proveedor${m.id_proveedor_laboratorio}`));
        eventos.push(['identidad', tx.id]);
        const state = vista(tx);
        return state.medicamentos.filter(o => o.id_medicamento !== idMedicamento && o.id_proveedor_laboratorio === m.id_proveedor_laboratorio &&
            ['nombre_comercial', 'forma_farmaceutica', 'presentacion', 'unidad_inventario', 'via_administracion', 'tipo_liberacion'].every(k => texto(o[k]) === texto(m[k])) &&
            (() => {
                const other = composicionCanonica(state.composiciones.filter(c => c.id_medicamento === o.id_medicamento));
                return other.length === cs.length && other.every((c, i) => c.idPrincipioActivo === cs[i].idPrincipioActivo &&
                    c.cantidadPrincipioActivo === cs[i].cantidadPrincipioActivo && c.cantidadReferencia === cs[i].cantidadReferencia &&
                    texto(c.unidadPrincipioActivo) === texto(cs[i].unidadPrincipioActivo) && texto(c.unidadReferencia) === texto(cs[i].unidadReferencia));
            })());
    });
    return { estado, eventos, transactions, falloComponente: id => { falloComponente = id; }, colision: () => { falloCodigo = true; } };
};

test('Validación integral estricta con contratos reales de composición', async t => {
    assert.equal(validator.validateCreate(datos()).success, true);
    for (const [nombre, extra] of [['ausente', { composicion: undefined }], ['vacía', { composicion: [] }],
        ['repetida', { composicion: [componente(), componente()] }], ['ID inválido', { composicion: [componente(0)] }],
        ['negativa', { composicion: [componente(1, -1)] }], ['escala', { composicion: [componente(1, 0.00001)] }],
        ['límite', { composicion: [componente(1, 100000000)] }], ['cadena incompatible', { composicion: [componente(1, '500')] }],
        ['unidad vacía', { composicion: [{ ...componente(), unidadPrincipioActivo: ' ' }] }],
        ['unidad larga', { composicion: [{ ...componente(), unidadReferencia: 'a'.repeat(31) }] }],
        ['referencia inválida', { composicion: [{ ...componente(), cantidadReferencia: 0 }] }],
        ['FK extra', { composicion: [{ ...componente(), idMedicamento: 1 }] }], ['código', { codigoMedicamento: 'PAR001' }]]) {
        await t.test(nombre, () => assert.equal(validator.validateCreate(datos(extra)).success, false));
    }
    assert.equal(validator.validateUpdate({ composicion: [componente()] }).success, false);
});

test('Registro integral, identidad completa y rollback sin MySQL', async t => {
    await t.test('Un componente y varios componentes devueltos en DTO', async t => {
        const f = fixture(t);
        const a = await meds.createMedicamento(datos());
        const b = await meds.createMedicamento(datos({ nombreComercial: 'Paroxetina', composicion: [componente(2), componente(3, 50)] }));
        assert.equal(a.codigoMedicamento, 'PAR001'); assert.equal(b.codigoMedicamento, 'PAR002');
        assert.equal(a.composicion.length, 1); assert.equal(b.composicion.length, 2);
        assert.equal(f.estado.composiciones.length, 3);
    });
    for (const [nombre, extra] of [['idéntico', {}], ['stock mínimo', { stockMinimo: 999 }],
        ['estado', { estado: false }], ['condición de venta', { condicionVenta: 'CON RECETA' }],
        ['caja, acentos y espacios', { nombreComercial: '  páracetamol   demo a  ', formaFarmaceutica: ' tableta ' }],
        ['decimales equivalentes', { composicion: [componente(1, 500.0000)] }]]) {
        await t.test(`409 por ${nombre}; no generar código`, async t => {
            const f = fixture(t, [datos({ estado: false })]), before = structuredClone(f.estado);
            await assert.rejects(meds.createMedicamento(datos(extra)), e => e.statusCode === 409 && e.details.medicamentosExistentes[0].codigoMedicamento === 'PAR001');
            assert.deepEqual(f.estado, before); assert.equal(f.eventos.some(e => e[0] === 'codigo'), false);
        });
    }
    await t.test('Orden distinto es igual, subconjunto no es igual', async t => {
        fixture(t, [datos({ composicion: [componente(), componente(2, 50)] })]);
        await assert.rejects(meds.createMedicamento(datos({ composicion: [componente(2, 50), componente()] })), { statusCode: 409 });
        assert.equal((await meds.createMedicamento(datos())).composicion.length, 1);
    });
    for (const [nombre, extra] of [['cantidad', { composicion: [componente(1, 1000)] }],
        ['principio', { composicion: [componente(2)] }], ['presentación', { presentacion: 'FRASCO' }],
        ['laboratorio', { idProveedorLaboratorio: 2 }], ['marca', { nombreComercial: 'Otra marca' }],
        ['unidad sin conversión', { composicion: [{ ...componente(), unidadPrincipioActivo: 'g' }] }],
        ['referencia', { composicion: [{ ...componente(), cantidadReferencia: 2 }] }]]) {
        await t.test(`permite distinta identidad: ${nombre}`, async t => {
            const f = fixture(t, [datos()]); await meds.createMedicamento(datos(extra)); assert.equal(f.estado.medicamentos.length, 2);
        });
    }
    await t.test('Principio inexistente devuelve 404 antes de medicamento/código', async t => {
        const f = fixture(t); await assert.rejects(meds.createMedicamento(datos({ composicion: [componente(99)] })), { statusCode: 404 });
        assert.equal(f.estado.medicamentos.length, 0); assert.equal(f.eventos.some(e => e[0] === 'codigo'), false);
    });
    await t.test('Fallo en tercer componente revierte medicamento y dos componentes anteriores', async t => {
        const f = fixture(t); f.falloComponente(3);
        await assert.rejects(meds.createMedicamento(datos({ composicion: [componente(), componente(2), componente(3)] })), /Fallo intermedio/);
        assert.equal(f.estado.medicamentos.length, 0); assert.equal(f.estado.composiciones.length, 0);
        assert.equal(f.eventos.at(-1)[0], 'rollback');
    });
    await t.test('Múltiples duplicados históricos se informan sin fusionar ni modificar', async t => {
        const f = fixture(t, [datos(), datos({ estado: false })]), before = structuredClone(f.estado);
        await assert.rejects(meds.createMedicamento(datos()), e => e.details.medicamentosExistentes.length === 2);
        assert.deepEqual(f.estado, before);
        await meds.updateMedicamento(1, { stockMinimo: 12 });
        assert.equal(f.estado.medicamentos.length, 2);
    });
});

test('Edición protege el estado completo resultante y preserva reglas históricas', async t => {
    for (const [nombre, a, b, accion] of [
        ['nombre', datos(), datos({ nombreComercial: 'Otra marca' }), () => meds.updateMedicamento(2, { nombreComercial: 'Paracetamol Demo A' })],
        ['proveedor', datos(), datos({ idProveedorLaboratorio: 2 }), () => meds.updateMedicamento(2, { idProveedorLaboratorio: 1 })],
        ['cantidad', datos(), datos({ composicion: [componente(1, 1000)] }), () => comps.updateComposicion(2, 20, { cantidadPrincipioActivo: 500 })],
        ['agregar', datos({ composicion: [componente(), componente(2)] }), datos(), () => comps.createComposicion(2, componente(2))],
        ['retirar', datos(), datos({ composicion: [componente(), componente(2)] }), () => comps.removeComposicion(2, 21)],
        ['histórico incompleto', datos(), datos({ composicion: [] }), () => comps.createComposicion(2, componente())],
        ['retirar último frente a histórico vacío', datos({ composicion: [] }), datos(), () => comps.removeComposicion(2, 20)]
    ]) {
        await t.test(`${nombre} no puede producir duplicado`, async t => {
            const f = fixture(t, [a, b]), before = structuredClone(f.estado);
            await assert.rejects(accion(), { statusCode: 409 }); assert.deepEqual(f.estado, before);
        });
    }
    await t.test('Completar histórico legítimo sin composición', async t => {
        const f = fixture(t, [datos({ composicion: [] })]); await comps.createComposicion(1, componente());
        assert.equal(f.estado.composiciones.length, 1);
    });
    await t.test('Historial bloquea presentación, agregar, editar y retirar; nombre corregible', async t => {
        const f = fixture(t, [datos()]); f.estado.medicamentos[0].historial = true;
        for (const accion of [() => meds.updateMedicamento(1, { presentacion: 'FRASCO' }),
            () => comps.createComposicion(1, componente(2)), () => comps.updateComposicion(1, 10, { cantidadPrincipioActivo: 1 }),
            () => comps.removeComposicion(1, 10)]) await assert.rejects(accion(), { statusCode: 409 });
        assert.equal((await meds.updateMedicamento(1, { nombreComercial: 'Corrección' })).codigoMedicamento, 'PAR001');
        await assert.rejects(meds.updateMedicamento(1, { codigoMedicamento: 'OTR001' }), { statusCode: 400 });
    });
    await t.test('Dos proveedores bloqueados en orden ascendente al trasladar producto', async t => {
        const f = fixture(t, [datos({ idProveedorLaboratorio: 2 })]); await meds.updateMedicamento(1, { idProveedorLaboratorio: 1 });
        assert.deepEqual(f.eventos.filter(e => e[0] === 'lock').map(e => e[1]), ['med1', 'proveedor1', 'proveedor2']);
    });
});

test('Concurrencia simulada con mutex por proveedor y lecturas actuales', async t => {
    await t.test('Dos productos iguales: un commit y un conflicto, sin código para el perdedor', async t => {
        const f = fixture(t);
        const results = await Promise.allSettled([meds.createMedicamento(datos()), meds.createMedicamento(datos())]);
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
        assert.equal(results.find(r => r.status === 'rejected').reason.statusCode, 409);
        assert.equal(f.estado.medicamentos.length, 1); assert.equal(f.estado.composiciones.length, 1);
        assert.equal(f.eventos.filter(e => e[0] === 'codigo').length, 1);
    });
    await t.test('Dos identidades distintas del mismo prefijo confirman códigos distintos', async t => {
        const f = fixture(t);
        const result = await Promise.all([meds.createMedicamento(datos()), meds.createMedicamento(datos({ composicion: [componente(1, 1000)] }))]);
        assert.deepEqual(result.map(r => r.codigoMedicamento), ['PAR001', 'PAR002']); assert.equal(f.estado.medicamentos.length, 2);
    });
    await t.test('Proveedores distintos compiten por código: reintento revalida identidad', async t => {
        const f = fixture(t); f.colision();
        await meds.createMedicamento(datos());
        assert.equal(f.transactions.length, 2); assert.equal(f.eventos.filter(e => e[0] === 'identidad').length, 2);
        assert.equal(f.estado.medicamentos.length, 1); assert.equal(f.estado.composiciones.length, 1);
    });
    await t.test('Dos ediciones intentan converger: solo una alcanza identidad destino', async t => {
        const f = fixture(t, [datos({ nombreComercial: 'Marca A' }), datos({ nombreComercial: 'Marca B' })]);
        const result = await Promise.allSettled([meds.updateMedicamento(1, { nombreComercial: 'Marca destino' }), meds.updateMedicamento(2, { nombreComercial: 'Marca destino' })]);
        assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
        assert.equal(f.estado.medicamentos.filter(m => m.nombre_comercial === 'Marca destino').length, 1);
    });
});

test('SQL de identidad parametrizado, colación real y conjuntos completos', async t => {
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('MySQL prohibido'); });
    const tx = { options: { isolationLevel: 'READ COMMITTED' } };
    t.mock.method(db.sequelize, 'query', async (sql, options) => {
        assert.doesNotMatch(sql, /FOR UPDATE|LOCK IN SHARE MODE|stock_minimo|condicion_venta|COLLATE|JSON/i);
        assert.match(sql, /COUNT\(\*\)/); assert.equal((sql.match(/EXISTS/g) || []).length, 2);
        assert.match(sql, /TRIM\(REGEXP_REPLACE\(m.nombre_comercial/);
        assert.equal(options.replacements.cantidad0, '500.0000');
        assert.equal(options.replacements.principio0, 1); assert.equal(options.replacements.principio1, 2);
        assert.equal(options.replacements.total, 2); assert.equal(options.transaction, tx);
        return [];
    });
    await repo.findDuplicadosIdentidad({ medicamento: modelo(datos()), composicion: composicionCanonica([componente(2), componente()]), transaction: tx });
    await assert.rejects(repo.findDuplicadosIdentidad({ transaction: { options: { isolationLevel: 'REPEATABLE READ' } } }), /READ COMMITTED/);
});

test('SQL Sequelize: proveedor exclusivo para catálogo y compartido para consumidores existentes', async t => {
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('MySQL prohibido'); });
    const queries = [];
    t.mock.method(db.sequelize, 'query', async (sql, options) => {
        queries.push(sql);
        assert.equal(options.transaction.id, 'tx');
        return db.ProveedorLaboratorio.build({ id_proveedor_laboratorio: 1, estado: true }, { isNewRecord: false, raw: true });
    });
    const transaction = { id: 'tx', LOCK: { UPDATE: 'UPDATE', SHARE: 'SHARE' } };
    await repo.findProveedorById({ idProveedorLaboratorio: 1, transaction, exclusivo: true });
    await repo.findProveedorById({ idProveedorLaboratorio: 1, transaction });
    assert.match(queries[0], /FOR UPDATE/);
    assert.match(queries[1], /LOCK IN SHARE MODE/);
});

test('HTTP real: contrato integral obligatorio, DTO completo y roles originales', async t => {
    const f = fixture(t); t.mock.method(console, 'error', () => {});
    t.mock.method(usuarioRepository, 'findByIdForSession', async ({ idUsuario }) => ({ id_usuario: idUsuario,
        id_rol: idUsuario, nombre_usuario: 'sintetico', estado: true, version_credenciales: 0 }));
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const request = async (body, status, rol = 2) => {
        const token = generarToken({ idUsuario: rol, idRol: rol, versionCredenciales: 0 });
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/medicamentos`, { method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` }, body: JSON.stringify(body) });
        const result = await response.json(); assert.equal(response.status, status, JSON.stringify(result)); return result;
    };
    try {
        const { composicion, ...antiguo } = datos();
        await request(antiguo, 400); await request(datos({ composicion: [] }), 400);
        await request(datos({ composicion: [componente(), componente()] }), 400);
        await request(datos(), 403, 1); await request(datos(), 403, 3);
        assert.equal(f.estado.medicamentos.length, 0);
        const response = await request(datos(), 201);
        assert.equal(response.data.composicion.length, 1); assert.equal(response.data.codigoMedicamento, 'PAR001');
        const dup = await request(datos(), 409);
        assert.equal(dup.errors.medicamentosExistentes[0].idMedicamento, response.data.idMedicamento);
        assert.equal(f.estado.medicamentos.length, 1);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
