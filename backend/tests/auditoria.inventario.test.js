import test from 'node:test';
import assert from 'node:assert/strict';

// SQL y transacciones Sequelize reales del auditor; negocio/almacenamiento
// simulados en Repositories. No conecta a MySQL ni acredita concurrencia InnoDB.
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'auditoria_inventario_sin_mysql';
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_auditoria_inventario';
const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const { usuarioRepository: ur } = await import('../src/data/repositories/usuario.repository.js');
const { compraRepository: cr } = await import('../src/data/repositories/compra.repository.js');
const { medicamentoRepository: mr } = await import('../src/data/repositories/medicamento.repository.js');
const { existenciaMedicamentoRepository: er } = await import('../src/data/repositories/existencia-medicamento.repository.js');
const { movimientoInventarioRepository: vr } = await import('../src/data/repositories/movimiento-inventario.repository.js');

test('Fase 6: compras, anulaciones, ajustes, conciliaciones y retiros auditados sin MySQL', async t => {
    const privado = 'observacion_personal_no_auditar';
    const movimiento = (id, extra = {}) => ({ id_movimiento: id, id_existencia: 8, id_usuario: 1,
        id_detalle_compra: null, id_detalle_venta: null, id_movimiento_original: null,
        direccion: 'ENTRADA', cantidad: 5, costo_unitario_aplicado: '1.000000', motivo: 'COMPRA',
        observacion: null, fecha_movimiento: '2025-01-01 10:00:00', ...extra });
    const inicial = {
        usuarios: [1, 2, 3].map(id => ({ id_usuario: id, id_rol: id, nombre_usuario: `cuenta${id}`,
            estado: true, version_credenciales: 0 })),
        medicamentos: [{ id_medicamento: 10, id_proveedor_laboratorio: 5, codigo_medicamento: 'PAR001',
            nombre_comercial: 'Paracetamol', forma_farmaceutica: 'Tableta', presentacion: '500 mg',
            unidad_inventario: 'tableta', estado: true }],
        proveedores: [{ id_proveedor_laboratorio: 5, nombre: 'Proveedor', estado: true }],
        existencias: [{ id_existencia: 8, id_medicamento: 10, codigo_existencia: 'PAR001-001',
            fecha_vencimiento: '2025-01-31', precision_vencimiento: 'MES',
            cantidad_fisica: 8, costo_unitario_promedio: '1.375000' }],
        compras: [{ id_compra: 20, id_usuario: 1, id_proveedor_laboratorio: 5, total: '6.00',
            estado_operacion: 'CONFIRMADA', fecha_anulacion: null, motivo_anulacion: null,
            id_usuario_anulador: null, fecha_compra: '2025-01-01', fecha_registro: '2025-01-01 10:00:00',
            clave_operacion: 'CLAVE_EXISTENTE_NO_AUDITAR' }],
        detalles: [{ id_detalle_compra: 201, id_compra: 20, id_existencia: 8, cantidad: 3,
            costo_unitario: '2.000000', subtotal: '6.00', saldo_anterior: 5, costo_promedio_anterior: '1.000000' }],
        movimientos: [movimiento(1), movimiento(10, { id_detalle_compra: 201, cantidad: 3, costo_unitario_aplicado: '2.000000' })],
        eventos: []
    };
    let estado, id = 300, falloEvento, falloNegocio, perdidaCommit;
    const pendientes = new Map(), pasos = [], logs = [];
    const reset = () => {
        estado = structuredClone(inicial); pendientes.clear(); pasos.length = 0; logs.length = 0;
        falloEvento = undefined; falloNegocio = undefined; perdidaCommit = false;
    };
    reset();
    const tecnico = () => Object.assign(new Error(privado), { name: 'SequelizeDatabaseError', sql: privado, parameters: { secreto: privado } });
    const unique = indice => new db.Sequelize.UniqueConstraintError({ parent: {
        sqlMessage: `Duplicate entry '${privado}' for key '${indice}'`, code: 'ER_DUP_ENTRY'
    } });
    const vista = transaction => transaction ? pendientes.get(transaction.id).datos : estado;
    const leer = (tabla, clave, valor, transaction) => structuredClone(vista(transaction)[tabla].find(r => r[clave] === valor));
    const dentro = (etapa, transaction, escribe = false) => {
        assert.ok(transaction); assert.ok(pendientes.has(transaction.id)); pasos.push({ etapa, tx: transaction.id });
        if (falloNegocio === etapa) throw tecnico();
        if (falloNegocio?.startsWith('ER_LOCK') && etapa === 'existenciaBloquear') throw Object.assign(tecnico(), { parent: { code: falloNegocio } });
        if (escribe) pendientes.get(transaction.id).escribe = true;
    };
    const crear = (tabla, clave, data, transaction, etapa) => {
        dentro(etapa, transaction, true); const row = { ...data, [clave]: id++ };
        vista(transaction)[tabla].push(row); return structuredClone(row);
    };
    t.mock.method(console, 'error', log => logs.push(log));
    t.mock.method(console, 'warn', () => {});
    t.mock.method(db.sequelize.connectionManager, 'getConnection', async () => ({ uuid: 'conexion_sintetica' }));
    t.mock.method(db.sequelize.connectionManager, 'releaseConnection', async () => {});
    t.mock.method(db.sequelize.connectionManager, 'destroyConnection', async () => {});
    t.mock.method(db.sequelize, 'query', async (input, options = {}) => {
        const sql = typeof input === 'string' ? input : input.query, tx = options.transaction?.id;
        pasos.push({ sql, tx });
        if (/^START TRANSACTION/.test(sql)) { pendientes.set(tx, { datos: structuredClone(estado), escribe: false }); return []; }
        if (/^ROLLBACK/.test(sql)) { pendientes.delete(tx); return []; }
        if (/^COMMIT/.test(sql)) {
            const p = pendientes.get(tx); if (p.escribe) estado = p.datos; pendientes.delete(tx);
            if (perdidaCommit) { perdidaCommit = false; throw tecnico(); }
            return [];
        }
        assert.equal(options.type, db.Sequelize.QueryTypes.INSERT);
        assert.equal(options.instance.constructor, db.BitacoraAuditoria);
        if (options.instance.tipo_evento === falloEvento) throw tecnico();
        const row = Object.fromEntries(Object.entries(options.instance.get({ plain: true }))
            .map(([k, v]) => [k, v?.fn === 'STR_TO_DATE' ? v.args[0] : v]));
        assert.equal(vista(options.transaction).eventos.some(e => e.tipo_evento === row.tipo_evento && e.correlacion === row.correlacion), false);
        row.id_evento = id++; vista(options.transaction).eventos.push(row); pendientes.get(tx).escribe = true;
        options.instance.setDataValue('id_evento', row.id_evento); return [options.instance, 1];
    });
    t.mock.method(ur, 'findByIdForSession', async ({ idUsuario }) => leer('usuarios', 'id_usuario', idUsuario));
    t.mock.method(mr, 'findById', async ({ idMedicamento, transaction, lock }) => {
        dentro('medicamentoBloquear', transaction); assert.equal(lock, true);
        return leer('medicamentos', 'id_medicamento', idMedicamento, transaction);
    });
    t.mock.method(mr, 'findProveedorById', async ({ idProveedorLaboratorio, transaction }) => {
        dentro('proveedorBloquear', transaction); return leer('proveedores', 'id_proveedor_laboratorio', idProveedorLaboratorio, transaction);
    });
    t.mock.method(er, 'findParaCompra', async ({ idMedicamento, transaction }) => {
        dentro('existenciasCompra', transaction);
        return structuredClone(vista(transaction).existencias.filter(e => e.id_medicamento === idMedicamento));
    });
    for (const metodo of ['findByIdParaMovimiento', 'findByIdParaAnular']) t.mock.method(er, metodo, async ({ idExistencia, transaction }) => {
        dentro('existenciaBloquear', transaction); return leer('existencias', 'id_existencia', idExistencia, transaction);
    });
    t.mock.method(er, 'create', async ({ data, transaction }) => crear('existencias', 'id_existencia', data, transaction, 'existenciaCrear'));
    t.mock.method(er, 'updateSaldoYCosto', async ({ idExistencia, cantidadFisica, costoUnitarioPromedio, transaction }) => {
        dentro('saldoActualizar', transaction, true);
        const row = vista(transaction).existencias.find(e => e.id_existencia === idExistencia);
        Object.assign(row, { cantidad_fisica: cantidadFisica, costo_unitario_promedio: costoUnitarioPromedio }); return [1];
    });
    t.mock.method(vr, 'findUltimoIdParaExistencia', async ({ idExistencia, transaction }) => {
        dentro('ultimoMovimiento', transaction);
        return vista(transaction).movimientos.filter(m => m.id_existencia === idExistencia).sort((a, b) => b.id_movimiento - a.id_movimiento)[0]?.id_movimiento ?? null;
    });
    t.mock.method(vr, 'create', async ({ data, transaction }) => crear('movimientos', 'id_movimiento', data, transaction, 'movimientoCrear'));
    t.mock.method(cr, 'findByClave', async ({ claveOperacion }) =>
        structuredClone(estado.compras.find(c => c.clave_operacion.toLowerCase() === claveOperacion.toLowerCase())));
    t.mock.method(cr, 'create', async ({ data, transaction }) => {
        if (falloNegocio === 'claveUnique') throw unique('uq_compra_clave_operacion');
        return crear('compras', 'id_compra', { fecha_anulacion: null, motivo_anulacion: null, id_usuario_anulador: null, ...data }, transaction, 'compraCrear');
    });
    t.mock.method(cr, 'createDetalle', async ({ data, transaction }) => crear('detalles', 'id_detalle_compra', data, transaction, 'detalleCrear'));
    t.mock.method(cr, 'findParaAnular', async ({ idCompra, transaction }) => {
        dentro('compraBloquear', transaction); return leer('compras', 'id_compra', idCompra, transaction);
    });
    t.mock.method(cr, 'findDetallesParaAnular', async ({ idCompra, transaction }) => {
        dentro('detallesBloquear', transaction); return structuredClone(vista(transaction).detalles.filter(d => d.id_compra === idCompra));
    });
    t.mock.method(vr, 'findParaAnular', async ({ idsExistencias, transaction }) => {
        dentro('historialBloquear', transaction); return structuredClone(vista(transaction).movimientos.filter(m => idsExistencias.includes(m.id_existencia)));
    });
    t.mock.method(vr, 'findReferenciasParaAnular', async ({ transaction }) => {
        dentro('referenciasAnular', transaction); return { detallesCompra: [], detallesVenta: [] };
    });
    t.mock.method(vr, 'findReversiones', async ({ idsOriginales, transaction }) => {
        dentro('reversionesBuscar', transaction); return structuredClone(vista(transaction).movimientos.filter(m => idsOriginales.includes(m.id_movimiento_original)));
    });
    t.mock.method(cr, 'anular', async ({ idCompra, motivo, idUsuario, fechaHora, transaction }) => {
        dentro('compraAnular', transaction, true); const compra = vista(transaction).compras.find(c => c.id_compra === idCompra);
        Object.assign(compra, { estado_operacion: 'ANULADA', motivo_anulacion: motivo, fecha_anulacion: fechaHora, id_usuario_anulador: idUsuario }); return [1];
    });
    const compraPublica = (row, transaction, detalles = false) => {
        const datos = vista(transaction);
        return { ...row, proveedorLaboratorio: datos.proveedores.find(p => p.id_proveedor_laboratorio === row.id_proveedor_laboratorio),
            usuarioRegistrador: datos.usuarios.find(u => u.id_usuario === row.id_usuario),
            usuarioAnulador: datos.usuarios.find(u => u.id_usuario === row.id_usuario_anulador),
            ...(detalles ? { detallesCompra: datos.detalles.filter(d => d.id_compra === row.id_compra).map(d => {
                const e = datos.existencias.find(e => e.id_existencia === d.id_existencia);
                return { ...d, existencia: { ...e, medicamento: datos.medicamentos.find(m => m.id_medicamento === e.id_medicamento) } };
            }) } : {}) };
    };
    t.mock.method(cr, 'findById', async (idCompra, { transaction } = {}) => {
        if (transaction) dentro('respuestaCompra', transaction);
        const row = leer('compras', 'id_compra', idCompra, transaction);
        return row ? structuredClone(compraPublica(row, transaction, true)) : null;
    });
    t.mock.method(cr, 'findAll', async () => estado.compras.map(c => compraPublica(c)));
    const nuevo = () => ({ fechaCompra: '2025-01-01', claveOperacion: 'CLAVE_NUEVA_NO_AUDITAR', detalles: [
        { idMedicamento: 10, cantidad: 2, costoUnitario: '2', fechaVencimiento: '2030-01-01', precisionVencimiento: 'DIA' },
        { idMedicamento: 10, cantidad: 3, costoUnitario: '1', fechaVencimiento: '2030-01-01', precisionVencimiento: 'DIA' }
    ] });
    const ajuste = (saldoContado = 10) => ({ idExistencia: 8, stockObservado: 8, ultimoMovimientoObservado: 10,
        saldoContado, ...(saldoContado > 8 ? { costoUnitario: '2' } : {}), observacion: privado });
    const retiro = () => ({ idExistencia: 8, stockObservado: 8, ultimoMovimientoObservado: 10, cantidad: 2, observacion: privado });
    const operaciones = [
        ['/compras', nuevo, 1, 'COMPRA_REGISTRAR', 201],
        ['/compras/20/anular', () => ({ motivo: privado }), 1, 'COMPRA_ANULAR', 200],
        ['/inventario/ajustes', ajuste, 2, 'INVENTARIO_AJUSTAR', 201],
        ['/inventario/ajustes', () => ajuste(8), 2, 'INVENTARIO_CONCILIAR', 200],
        ['/inventario/retiros/vencimiento', retiro, 2, 'INVENTARIO_RETIRAR_VENCIMIENTO', 201],
        ['/inventario/retiros/dano', retiro, 2, 'INVENTARIO_RETIRAR_DANO', 201]
    ];
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const request = async (path, body, status = 201, rol = 2, method = 'POST', tokenRol = rol) => {
        const token = tokenRol == null ? undefined : generarToken({ idUsuario: rol, idRol: tokenRol, versionCredenciales: 0 });
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method,
            headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `token=${token}` } : {}) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
        const resultado = await response.json(); assert.equal(response.status, status, JSON.stringify(resultado));
        assert.equal(pendientes.size, 0); assert.equal(JSON.stringify(resultado).includes('Sequelize'), false); return resultado;
    };
    const eventos = tipo => estado.eventos.filter(e => e.tipo_evento === tipo);
    const negocio = () => { const { eventos, ...datos } = estado; return structuredClone(datos); };
    const comprobarAtomicidad = () => {
        const insercion = pasos.find(p => p.sql?.startsWith('INSERT'));
        assert.ok(insercion); assert.equal(pasos.filter(p => p.sql?.startsWith('INSERT')).length, 1);
        assert.equal(pasos.filter(p => p.etapa).every(p => p.tx === insercion.tx), true);
        assert.match(pasos.at(-1).sql, /^COMMIT/);
    };
    try {
        await t.test('Seis resultados lógicos: un éxito con SQL auditado en la transacción de negocio y actor comprobado', async () => {
            for (const [path, body, rol, tipo, status] of operaciones) {
                reset(); await request(path, body(), status, rol); comprobarAtomicidad();
                assert.equal(estado.eventos.length, 1); const e = eventos(tipo)[0];
                assert.equal(e.resultado, 'EXITO'); assert.equal(e.id_usuario_responsable, rol);
                assert.equal(e.nombre_usuario_responsable, `cuenta${rol}`); assert.equal(e.metadatos.efecto, 'CONFIRMADO');
                assert.equal(e.procedencia_ip, 'SOCKET_PEER'); assert.equal(JSON.stringify(e).includes(privado), false);
            }
        });
        await t.test('Fallo obligatorio en los seis resultados produce 503, rollback íntegro y un diagnóstico sin recursión', async () => {
            for (const [path, body, rol, tipo] of operaciones) {
                reset(); const antes = negocio(); falloEvento = tipo;
                await request(path, body(), 503, rol); assert.deepEqual(negocio(), antes); assert.equal(estado.eventos.length, 0);
                assert.equal(pasos.filter(p => p.sql?.startsWith('INSERT')).length, 1); assert.match(pasos.at(-1).sql, /^ROLLBACK/);
                assert.equal(logs.filter(l => l.categoria === 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA').length, 1);
                assert.equal(JSON.stringify(logs).includes(privado), false);
            }
        });
        await t.test('Compra agrupada: dos detalles/movimientos y una existencia nueva quedan en un solo evento', async () => {
            reset(); const r = await request('/compras', nuevo(), 201, 1); const e = eventos('COMPRA_REGISTRAR')[0];
            assert.equal(e.id_registro, r.data.idCompra); assert.equal(e.despues.total, '7.00');
            assert.equal(e.metadatos.cantidadDetalles, 2); assert.equal(e.metadatos.cantidadExistencias, 1); assert.equal(e.metadatos.cantidadMovimientos, 2);
            assert.equal(r.data.detalles[0].idExistencia, r.data.detalles[1].idExistencia);
            assert.equal(e.referencias.filter(r => r.tipo === 'MOVIMIENTO').length, 2);
            assert.equal(e.referencias.filter(r => r.tipo === 'EXISTENCIA').length, 1);
            assert.equal(estado.existencias.at(-1).costo_unitario_promedio, '1.400000');
            assert.equal(JSON.stringify(e).includes(nuevo().claveOperacion), false);
        });
        await t.test('Compra reutiliza existencia sin crear eventos independientes de stock ni alterar snapshots', async () => {
            reset(); estado.existencias[0].fecha_vencimiento = '2030-01-01'; estado.existencias[0].precision_vencimiento = 'DIA';
            await request('/compras', nuevo(), 201, 1); assert.equal(estado.existencias.length, 1); assert.equal(estado.eventos.length, 1);
            assert.equal(estado.existencias[0].cantidad_fisica, 13); assert.equal(estado.existencias[0].costo_unitario_promedio, '1.384615');
            assert.equal(estado.detalles.at(-1).saldo_anterior, 8); assert.equal(estado.detalles.at(-1).costo_promedio_anterior, '1.375000');
        });
        await t.test('Compra grande acota referencias con omisiones explícitas y mantiene todos los detalles/movimientos reales', async () => {
            reset(); const data = nuevo(); data.detalles = Array.from({ length: 60 }, () => ({ ...data.detalles[0] }));
            await request('/compras', data, 201, 1); const e = eventos('COMPRA_REGISTRAR')[0];
            assert.equal(e.referencias.length, 100); assert.equal(e.metadatos.cantidadReferenciasOmitidas, 21);
            assert.equal(e.metadatos.cantidadDetalles, 60); assert.equal(e.metadatos.cantidadMovimientos, 60);
            assert.equal(estado.detalles.length, 61); assert.equal(estado.movimientos.length, 62);
        });
        await t.test('Clave repetida por consulta o UNIQUE: rechazo único, sin revelar ni recuperar la compra anterior', async () => {
            for (const uniqueFalla of [false, true]) {
                reset(); const antes = negocio(), data = nuevo();
                if (uniqueFalla) falloNegocio = 'claveUnique'; else data.claveOperacion = inicial.compras[0].clave_operacion;
                const r = await request('/compras', data, 409, 1); assert.deepEqual(negocio(), antes);
                assert.equal(eventos('COMPRA_REGISTRAR')[0].resultado, 'RECHAZADO'); assert.equal(eventos('COMPRA_REGISTRAR')[0].id_registro, null);
                assert.equal(estado.eventos.length, 1); assert.equal(r.errors, undefined);
            }
        });
        await t.test('Compra: referencias inexistentes, inactividad y vencimiento generan rechazos conocidos sin efectos', async () => {
            for (const variante of ['medicamentoNoExiste', 'medicamentoInactivo', 'proveedorNoExiste', 'proveedorInactivo', 'vencida']) {
                reset(); const data = nuevo(); let status = 409;
                if (variante === 'medicamentoNoExiste') { data.detalles[0].idMedicamento = 99; status = 404; }
                if (variante === 'medicamentoInactivo') estado.medicamentos[0].estado = false;
                if (variante === 'proveedorNoExiste') { estado.proveedores = []; status = 404; }
                if (variante === 'proveedorInactivo') estado.proveedores[0].estado = false;
                if (variante === 'vencida') data.detalles[0].fechaVencimiento = '2025-01-01';
                const antes = negocio(); await request('/compras', data, status, 1); assert.deepEqual(negocio(), antes);
                assert.equal(eventos('COMPRA_REGISTRAR')[0].resultado, 'RECHAZADO'); assert.equal(estado.eventos.length, 1);
            }
        });
        await t.test('Anulación B1: un evento, cambios de estado y referencias a originales/reversiones; sin copiar motivo', async () => {
            reset(); const originales = structuredClone(estado.movimientos); await request('/compras/20/anular', { motivo: privado }, 200, 1);
            const e = eventos('COMPRA_ANULAR')[0]; assert.equal(e.antes.estadoOperacion, 'CONFIRMADA'); assert.equal(e.despues.estadoOperacion, 'ANULADA');
            assert.deepEqual(e.metadatos.camposModificados, ['estadoOperacion']); assert.equal(e.metadatos.modoAnulacion, 'B1');
            assert.equal(estado.existencias[0].cantidad_fisica, 5); assert.equal(estado.existencias[0].costo_unitario_promedio, '1.000000');
            assert.deepEqual(estado.movimientos.slice(0, 2), originales); assert.equal(estado.movimientos.at(-1).id_movimiento_original, 10);
            assert.equal(e.referencias.some(r => r.tipo === 'MOVIMIENTO' && r.id === 10), true);
            assert.equal(e.referencias.some(r => r.tipo === 'MOVIMIENTO' && r.id === estado.movimientos.at(-1).id_movimiento), true);
        });
        await t.test('Anulación A: salida posterior se conserva, promedio residual exacto y modo auditado', async () => {
            reset(); estado.movimientos.push(movimiento(11, { direccion: 'SALIDA', cantidad: 1, motivo: 'AJUSTE', costo_unitario_aplicado: '1.375000' }));
            estado.existencias[0].cantidad_fisica = 7; await request('/compras/20/anular', { motivo: privado }, 200, 1);
            assert.equal(eventos('COMPRA_ANULAR')[0].metadatos.modoAnulacion, 'A');
            assert.equal(estado.existencias[0].cantidad_fisica, 4); assert.equal(estado.existencias[0].costo_unitario_promedio, '0.906250');
            assert.equal(estado.movimientos.some(m => m.id_movimiento === 11), true);
        });
        await t.test('Anulación mixta: B1/A por existencia se resume una vez sin cambiar el algoritmo', async () => {
            reset(); estado.existencias.push({ ...estado.existencias[0], id_existencia: 9, codigo_existencia: 'PAR001-002', cantidad_fisica: 7 });
            estado.detalles.push({ ...estado.detalles[0], id_detalle_compra: 202, id_existencia: 9 }); estado.compras[0].total = '12.00';
            estado.movimientos.push(movimiento(2, { id_existencia: 9 }), movimiento(12, { id_existencia: 9, id_detalle_compra: 202, cantidad: 3, costo_unitario_aplicado: '2.000000' }),
                movimiento(13, { id_existencia: 9, direccion: 'SALIDA', cantidad: 1, motivo: 'DAÑO', costo_unitario_aplicado: '1.375000' }));
            await request('/compras/20/anular', { motivo: privado }, 200, 1);
            const e = eventos('COMPRA_ANULAR')[0]; assert.equal(e.metadatos.modoAnulacion, 'MIXTO');
            assert.equal(e.metadatos.cantidadExistencias, 2); assert.equal(e.metadatos.cantidadMovimientos, 2); assert.equal(estado.eventos.length, 1);
        });
        await t.test('Doble anulación: nuevo rechazo correlacionado por otra solicitud, sin repetir reversión', async () => {
            reset(); await request('/compras/20/anular', { motivo: privado }, 200, 1); const antes = negocio();
            await request('/compras/20/anular', { motivo: privado }, 409, 1); assert.deepEqual(negocio(), antes);
            const lista = eventos('COMPRA_ANULAR'); assert.deepEqual(lista.map(e => e.resultado), ['EXITO', 'RECHAZADO']);
            assert.notEqual(lista[0].correlacion, lista[1].correlacion);
        });
        await t.test('Anulación con stock insuficiente o historial inconsistente no deja una reversión parcial', async () => {
            for (const variante of ['stock', 'historial', 'legado']) {
                reset();
                if (variante === 'stock') { estado.existencias[0].cantidad_fisica = 2; estado.movimientos.push(movimiento(11, { direccion: 'SALIDA', cantidad: 6, motivo: 'DAÑO' })); }
                if (variante === 'historial') estado.movimientos[1].cantidad = 4;
                if (variante === 'legado') { estado.detalles[0].saldo_anterior = null; estado.detalles[0].costo_promedio_anterior = null; }
                const antes = negocio(); await request('/compras/20/anular', { motivo: privado }, 409, 1); assert.deepEqual(negocio(), antes);
                assert.equal(eventos('COMPRA_ANULAR')[0].resultado, 'RECHAZADO'); assert.equal(estado.eventos.length, 1);
            }
        });
        await t.test('Ajustes de entrada/salida: snapshots bajo bloqueo, promedio y movimiento enlazado', async () => {
            for (const saldo of [10, 5, 0]) {
                reset(); await request('/inventario/ajustes', ajuste(saldo)); const e = eventos('INVENTARIO_AJUSTAR')[0];
                assert.equal(e.antes.stockFisico, 8); assert.equal(e.despues.stockFisico, saldo); assert.equal(e.metadatos.diferencia, saldo - 8);
                assert.equal(e.despues.costoUnitarioPromedio, saldo > 8 ? '1.500000' : '1.375000');
                assert.deepEqual(e.referencias, [{ tipo: 'MOVIMIENTO', id: estado.movimientos.at(-1).id_movimiento }]);
                assert.equal(estado.movimientos.at(-1).motivo, 'AJUSTE'); assert.equal(estado.movimientos.at(-1).observacion, privado);
            }
        });
        await t.test('Conciliación sin diferencia: solo resultado, sin snapshots/conteo/observación ni movimiento o UPDATE', async () => {
            reset(); const antes = negocio(); await request('/inventario/ajustes', ajuste(8), 200); assert.deepEqual(negocio(), antes);
            const e = eventos('INVENTARIO_CONCILIAR')[0]; assert.equal(e.id_registro, 8);
            assert.equal(e.antes, null); assert.equal(e.despues, null); assert.equal(e.referencias, null);
            assert.deepEqual(e.metadatos, { efecto: 'CONFIRMADO', cantidadMovimientos: 0, ajusteRealizado: false });
            assert.equal(pasos.some(p => p.etapa === 'saldoActualizar' || p.etapa === 'movimientoCrear'), false);
            await request('/inventario/ajustes', ajuste(8), 200); assert.equal(eventos('INVENTARIO_CONCILIAR').length, 2);
            assert.deepEqual(negocio(), antes);
        });
        await t.test('Precondiciones desactualizadas: rechaza ajustes, conciliación y ambos retiros antes de escribir', async () => {
            for (const [path, body] of operaciones.slice(2)) {
                for (const cambio of ['saldo', 'marcador']) {
                    reset(); if (cambio === 'saldo') estado.existencias[0].cantidad_fisica++;
                    else estado.movimientos.push(movimiento(11, { cantidad: 1, motivo: 'AJUSTE' }));
                    const antes = negocio(); await request(path, body(), 409); assert.deepEqual(negocio(), antes);
                    const e = eventos(path.includes('vencimiento') ? 'INVENTARIO_RETIRAR_VENCIMIENTO' : path.includes('dano') ? 'INVENTARIO_RETIRAR_DANO' : 'INVENTARIO_AJUSTAR')[0];
                    assert.equal(e.causa, 'PRECONDICIONES_DESACTUALIZADAS'); assert.equal(estado.eventos.length, 1);
                }
            }
        });
        await t.test('Retiro por daño/vencimiento: costo aplicado y pérdida exacta, snapshot mínimo sin observación', async () => {
            for (const path of ['/inventario/retiros/dano', '/inventario/retiros/vencimiento']) {
                reset(); await request(path, retiro()); const e = estado.eventos[0];
                assert.equal(e.metadatos.perdida, '2.75'); assert.equal(e.metadatos.cantidadRetirada, 2);
                assert.equal(e.antes.costoUnitarioPromedio, e.despues.costoUnitarioPromedio); assert.equal(e.despues.stockFisico, 6);
                assert.equal(estado.movimientos.at(-1).costo_unitario_aplicado, '1.375000');
            }
        });
        await t.test('Retiro máximo y costo cero conservan pérdida derivada exacta, sin tope artificial DECIMAL(14,2)', async () => {
            for (const costo of ['99999999.999999', '0.000000']) {
                reset(); estado.existencias[0].cantidad_fisica = 2147483647; estado.existencias[0].costo_unitario_promedio = costo;
                await request('/inventario/retiros/dano', { ...retiro(), stockObservado: 2147483647, cantidad: 2147483647 });
                const e = eventos('INVENTARIO_RETIRAR_DANO')[0]; assert.equal(e.despues.stockFisico, 0);
                assert.equal(e.metadatos.perdida, costo.startsWith('0.') ? '0.00' : '214748364699997852.52');
            }
        });
        await t.test('Vencimiento futuro y stock insuficiente conservan causas internas y 409 originales', async () => {
            reset(); estado.existencias[0].fecha_vencimiento = '2030-01-31'; const antes = negocio();
            await request('/inventario/retiros/vencimiento', retiro(), 409); assert.deepEqual(negocio(), antes);
            assert.equal(eventos('INVENTARIO_RETIRAR_VENCIMIENTO')[0].causa, 'CONFLICTO');
            reset(); await request('/inventario/retiros/dano', { ...retiro(), cantidad: 9 }, 409);
            assert.equal(eventos('INVENTARIO_RETIRAR_DANO')[0].causa, 'STOCK_INSUFICIENTE');
        });
        await t.test('Inexistencia de compra/existencia: 404 con referencia lógica y rechazo único', async () => {
            for (const [path, body, rol] of [['/compras/99/anular', { motivo: privado }, 1],
                ['/inventario/ajustes', { ...ajuste(), idExistencia: 99 }, 2],
                ['/inventario/retiros/dano', { ...retiro(), idExistencia: 99 }, 2]]) {
                reset(); await request(path, body, 404, rol); assert.equal(estado.eventos[0].id_registro, 99);
                assert.equal(estado.eventos[0].causa, 'NO_ENCONTRADO'); assert.equal(estado.eventos.length, 1);
            }
        });
        await t.test('Fallos en cada escritura/lectura final de compra revierten negocio; solo fallo técnico seguro', async () => {
            for (const etapa of ['compraCrear', 'existenciaCrear', 'detalleCrear', 'movimientoCrear', 'respuestaCompra']) {
                reset(); falloNegocio = etapa; const antes = negocio(); await request('/compras', nuevo(), 500, 1);
                assert.deepEqual(negocio(), antes); assert.equal(eventos('COMPRA_REGISTRAR').length, 0);
                assert.equal(eventos('ERROR_TECNICO').length, 1); assert.equal(eventos('ERROR_TECNICO')[0].metadatos.efecto, 'NO_APLICA');
                assert.equal(JSON.stringify(estado.eventos).includes(privado), false);
            }
        });
        await t.test('Fallos de anulación, ajuste y retiros revierten negocio y auditan después del rollback', async () => {
            for (const [path, body, rol] of operaciones.filter(([, , , tipo]) => !['COMPRA_REGISTRAR', 'INVENTARIO_CONCILIAR'].includes(tipo))) {
                for (const etapa of ['saldoActualizar', 'movimientoCrear']) {
                    reset(); falloNegocio = etapa; const antes = negocio(); await request(path, body(), 500, rol); assert.deepEqual(negocio(), antes);
                    assert.equal(estado.eventos.length, 1); assert.equal(eventos('ERROR_TECNICO').length, 1);
                    const rollback = pasos.findIndex(p => p.sql?.startsWith('ROLLBACK')), insert = pasos.findIndex(p => p.sql?.startsWith('INSERT'));
                    assert.ok(rollback >= 0 && rollback < insert); assert.notEqual(pasos[rollback].tx, pasos[insert].tx);
                }
            }
        });
        await t.test('Auditor caído en rechazos conserva 409/404 y no reintenta ni modifica negocio', async () => {
            for (const [path, body, rol, tipo, status] of [['/compras', { ...nuevo(), claveOperacion: inicial.compras[0].clave_operacion }, 1, 'COMPRA_REGISTRAR', 409],
                ['/compras/99/anular', { motivo: privado }, 1, 'COMPRA_ANULAR', 404],
                ['/inventario/ajustes', { ...ajuste(), stockObservado: 9 }, 2, 'INVENTARIO_AJUSTAR', 409],
                ['/inventario/retiros/dano', { ...retiro(), cantidad: 9 }, 2, 'INVENTARIO_RETIRAR_DANO', 409]]) {
                reset(); falloEvento = tipo; const antes = negocio(); await request(path, body, status, rol);
                assert.deepEqual(negocio(), antes); assert.equal(estado.eventos.length, 0); assert.equal(pasos.filter(p => p.sql?.startsWith('INSERT')).length, 1);
            }
        });
        await t.test('Contención temporal devuelve un rechazo después del rollback sin reintentar la operación', async () => {
            for (const codigo of ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']) {
                reset(); falloNegocio = codigo; const antes = negocio(); await request('/inventario/ajustes', ajuste(), 409);
                assert.deepEqual(negocio(), antes); assert.equal(eventos('INVENTARIO_AJUSTAR')[0].causa, 'CONFLICTO');
                assert.equal(pasos.filter(p => p.etapa === 'existenciaBloquear').length, 1);
            }
        });
        await t.test('Commit incierto de los seis resultados no repite negocio ni inventa una respuesta exitosa', async () => {
            for (const [path, body, rol, tipo] of operaciones) {
                reset(); perdidaCommit = true; await request(path, body(), 500, rol);
                assert.equal(eventos(tipo).length, 1); assert.equal(eventos('ERROR_TECNICO').length, 1);
                assert.equal(eventos('ERROR_TECNICO')[0].metadatos.efecto, 'INCIERTO');
                assert.equal(pasos.filter(p => p.sql?.startsWith('START TRANSACTION')).length, 2);
                assert.equal(JSON.stringify(logs).includes(privado), false);
            }
        });
        await t.test('Fallo HTTP posterior distingue efectos confirmados para los seis resultados y conserva registro afectado', async () => {
            const original = app.response.json;
            const mock = t.mock.method(app.response, 'json', function (...args) {
                if (this.statusCode < 300 && this.req.method === 'POST') throw tecnico();
                return original.apply(this, args);
            });
            try {
                for (const [path, body, rol, tipo] of operaciones) {
                    reset(); await request(path, body(), 500, rol); assert.equal(eventos(tipo).length, 1);
                    const e = eventos('ERROR_TECNICO')[0]; assert.equal(e.metadatos.efecto, 'CONFIRMADO');
                    assert.equal(e.id_registro, eventos(tipo)[0].id_registro); assert.equal(e.metadatos.etapa, 'RESPUESTA');
                }
            } finally { mock.mock.restore(); }
        });
        await t.test('Permisos originales: solo Administrador registra/anula compras y solo Regente escribe inventario', async () => {
            reset(); await request('/compras', nuevo(), 403, 2); assert.equal(eventos('ACCESO_DENEGADO')[0].id_usuario_responsable, 2);
            for (const [path, body, rol] of operaciones) {
                reset(); const antes = negocio(); const denegado = path === '/compras' ? 3 : rol === 1 ? 2 : 1;
                await request(path, body(), 403, denegado); assert.deepEqual(negocio(), antes); assert.equal(eventos('ACCESO_DENEGADO').length, 1);
            }
        });
        await t.test('Roles falsos en JWT y actor/resultado del body no sustituyen la sesión comprobada', async () => {
            reset(); await request('/inventario/ajustes', ajuste(), 403, 3, 'POST', 2); assert.equal(eventos('ACCESO_DENEGADO')[0].id_rol_responsable, 3);
            reset(); await request('/inventario/ajustes', { ...ajuste(), idUsuario: 1, resultado: 'EXITO' }, 400);
            assert.equal(eventos('VALIDACION_RECHAZADA').length, 1); assert.equal(pasos.some(p => p.etapa), false);
        });
        await t.test('Lecturas rutinarias de compras no generan éxito y el ID inexistente conserva rechazo', async () => {
            reset(); await request('/compras', undefined, 200, 1, 'GET'); await request('/compras/20', undefined, 200, 1, 'GET');
            assert.equal(estado.eventos.length, 0); await request('/compras/99', undefined, 404, 1, 'GET');
            assert.equal(eventos('OPERACION_RECHAZADA')[0].id_registro, 99);
        });
        t.diagnostic('Atomicidad verificada con transacciones Sequelize y transporte simulado. Persistencia, privilegios y carreras InnoDB reales requieren aceptación MySQL aislada.');
    } finally { await new Promise(resolve => server.close(resolve)); await db.sequelize.close(); }
});
