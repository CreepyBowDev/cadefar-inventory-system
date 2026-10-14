import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';

process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'auditoria_catalogo_sin_mysql';
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_catalogo_auditoria';
const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const { usuarioRepository: ur } = await import('../src/data/repositories/usuario.repository.js');
const { proveedorLaboratorioRepository: pr } = await import('../src/data/repositories/proveedor-laboratorio.repository.js');
const { principioActivoRepository: ar } = await import('../src/data/repositories/principio-activo.repository.js');
const { medicamentoRepository: mr } = await import('../src/data/repositories/medicamento.repository.js');
const { composicionMedicamentoRepository: cr } = await import('../src/data/repositories/composicion-medicamento.repository.js');
const { recuperacionPasswordRepository: rr } = await import('../src/data/repositories/recuperacion-password.repository.js');

test('Fase 5: escrituras de catálogo, consultas sensibles y atomicidad de auditoría sin MySQL', async t => {
    const password = 'Segura-sintetica-123!';
    const hash = await bcrypt.hash(password, 4);
    const privado = 'personal_sintetico_no_auditar';
    const med = { id_medicamento: 10, id_proveedor_laboratorio: 5, codigo_medicamento: 'PAR001',
        nombre_comercial: 'Paracetamol', forma_farmaceutica: 'Tableta', presentacion: '500 mg',
        unidad_inventario: 'tableta', stock_minimo: 0, condicion_venta: 'Libre',
        via_administracion: 'Oral', tipo_liberacion: 'Inmediata', estado: true };
    const componente = { id_composicion: 20, id_medicamento: 10, id_principio_activo: 7,
        cantidad_principio_activo: '500.0000', unidad_principio_activo: 'mg',
        cantidad_referencia: '1.0000', unidad_referencia: 'tableta' };
    const inicial = {
        roles: [1, 2, 3].map(id => ({ id_rol: id, nombre: `rol${id}`, estado: true })),
        usuarios: [1, 2, 3, 4].map(id => ({ id_usuario: id, id_rol: id === 4 ? 3 : id,
            nombre_usuario: `cuenta${id}`, correo: `cuenta${id}@example.test`, password_hash: hash,
            estado: true, version_credenciales: 0, intentos_fallidos_login: 2, bloqueado_hasta: null })),
        proveedores: [{ id_proveedor_laboratorio: 5, nombre: 'Proveedor', estado: true, telefono: privado, direccion: privado }],
        principios: [{ id_principio_activo: 7, nombre: 'Paracetamol', estado: true, descripcion: privado },
            { id_principio_activo: 8, nombre: 'Cafeína', estado: false, descripcion: null }],
        medicamentos: [med], composiciones: [componente], recuperaciones: [{ id_usuario: 4, invalidada_en: null }], eventos: []
    };
    let estado, id = 100, falloEvento, falloNegocio, duplicadoIdentidad, historial, colisiones, commitPerdido, sinListado;
    const pendientes = new Map(), logs = [], pasos = [];
    const reset = () => {
        estado = structuredClone(inicial); pendientes.clear(); logs.length = 0; pasos.length = 0;
        falloEvento = undefined; falloNegocio = undefined; duplicadoIdentidad = false; historial = false;
        colisiones = 0; commitPerdido = false; sinListado = false;
    };
    reset();
    const tecnico = () => Object.assign(new Error(privado), { name: 'SequelizeDatabaseError', sql: hash, parameters: { password } });
    const unique = indice => new db.Sequelize.UniqueConstraintError({ parent: { sqlMessage: `Duplicate entry 'sintetico' for key '${indice}'` } });
    const vista = transaction => transaction ? pendientes.get(transaction.id).datos : estado;
    const leer = (tabla, clave, valor, transaction) => structuredClone(vista(transaction)[tabla].find(r => r[clave] === valor));
    const modificar = (tabla, clave, valor, data, transaction) => {
        assert.ok(transaction, 'Toda escritura de negocio recibe la transacción de auditoría');
        Object.assign(vista(transaction)[tabla].find(r => r[clave] === valor), data);
        pendientes.get(transaction.id).escribe = true;
    };
    const crear = (tabla, clave, data, transaction) => {
        assert.ok(transaction); const row = { ...data, [clave]: id++ };
        vista(transaction)[tabla].push(row); pendientes.get(transaction.id).escribe = true;
        return structuredClone(row);
    };
    t.mock.method(console, 'error', log => logs.push(log));
    t.mock.method(console, 'warn', () => {});
    t.mock.method(db.sequelize.connectionManager, 'getConnection', async () => ({ uuid: 'conexion_sintetica' }));
    t.mock.method(db.sequelize.connectionManager, 'releaseConnection', async () => {});
    t.mock.method(db.sequelize.connectionManager, 'destroyConnection', async () => {});
    t.mock.method(db.sequelize, 'query', async (input, options = {}) => {
        const sql = typeof input === 'string' ? input : input.query;
        const tx = options.transaction?.id;
        pasos.push({ sql, tx });
        if (/^SET /.test(sql)) return [];
        if (/^START TRANSACTION/.test(sql)) { pendientes.set(tx, { datos: structuredClone(estado), escribe: false }); return []; }
        if (/^ROLLBACK/.test(sql)) { pendientes.delete(tx); return []; }
        if (/^COMMIT/.test(sql)) {
            const p = pendientes.get(tx); if (p.escribe) estado = p.datos; pendientes.delete(tx);
            if (commitPerdido) { commitPerdido = false; throw tecnico(); }
            return [];
        }
        assert.equal(options.type, db.Sequelize.QueryTypes.INSERT);
        assert.ok(options.instance.constructor === db.BitacoraAuditoria, 'Solo transporte SQL del auditor; negocio simulado en Repositories');
        if (options.instance.tipo_evento === falloEvento) throw tecnico();
        const row = Object.fromEntries(Object.entries(options.instance.get({ plain: true }))
            .map(([k, v]) => [k, v?.fn === 'STR_TO_DATE' ? v.args[0] : v]));
        assert.equal(vista(options.transaction).eventos.some(e => e.tipo_evento === row.tipo_evento && e.correlacion === row.correlacion), false);
        row.id_evento = id++; vista(options.transaction).eventos.push(row);
        pendientes.get(tx).escribe = true; options.instance.setDataValue('id_evento', row.id_evento);
        return [options.instance, 1];
    });
    const usuarioPublico = (idUsuario, transaction) => {
        const row = leer('usuarios', 'id_usuario', idUsuario, transaction);
        if (row) row.rol = leer('roles', 'id_rol', row.id_rol, transaction);
        return row;
    };
    t.mock.method(ur, 'findByIdForSession', async ({ idUsuario }) => leer('usuarios', 'id_usuario', idUsuario));
    t.mock.method(ur, 'findById', async ({ idUsuario, transaction }) => usuarioPublico(idUsuario, transaction));
    t.mock.method(ur, 'findByIdForUpdate', async ({ idUsuario, transaction }) => {
        assert.ok(transaction); return leer('usuarios', 'id_usuario', idUsuario, transaction);
    });
    t.mock.method(ur, 'findByNombreUsuario', async ({ nombreUsuario, transaction }) =>
        structuredClone(vista(transaction).usuarios.find(u => u.nombre_usuario === nombreUsuario)));
    t.mock.method(ur, 'findByCorreo', async ({ correo, transaction }) =>
        structuredClone(vista(transaction).usuarios.find(u => u.correo === correo)));
    t.mock.method(ur, 'findRolById', async ({ idRol, transaction }) => leer('roles', 'id_rol', idRol, transaction));
    t.mock.method(ur, 'findAllUsuarios', async () => {
        if (falloNegocio === 'usuariosLeer') throw tecnico();
        return sinListado ? [] : estado.usuarios.map(u => usuarioPublico(u.id_usuario));
    });
    t.mock.method(ur, 'createUsuario', async ({ transaction, ...data }) => {
        assert.equal(Object.hasOwn(data, 'password'), false); assert.notEqual(data.passwordHash, password);
        if (falloNegocio === 'usuarioUnique') throw unique('uq_usuario_nombre_usuario');
        return crear('usuarios', 'id_usuario', { id_rol: data.idRol, nombre_usuario: data.nombreUsuario,
            password_hash: data.passwordHash, correo: data.correo ?? null, estado: true, version_credenciales: 0,
            intentos_fallidos_login: 0, bloqueado_hasta: null }, transaction);
    });
    t.mock.method(ur, 'updateUsuario', async ({ idUsuario, transaction, ...data }) => {
        const values = Object.fromEntries(Object.entries({ id_rol: data.idRol, nombre_usuario: data.nombreUsuario, correo: data.correo })
            .filter(([, v]) => v !== undefined));
        modificar('usuarios', 'id_usuario', idUsuario, values, transaction);
    });
    t.mock.method(ur, 'updateEstado', async ({ idUsuario, estado, transaction }) => modificar('usuarios', 'id_usuario', idUsuario, { estado }, transaction));
    t.mock.method(rr, 'invalidatePendingByUsuario', async ({ idUsuario, invalidadaEn, transaction }) => {
        for (const row of vista(transaction).recuperaciones) if (row.id_usuario === idUsuario) row.invalidada_en = invalidadaEn;
        pendientes.get(transaction.id).escribe = true;
    });
    t.mock.method(pr, 'findById', async ({ idProveedorLaboratorio, transaction, lock }) => {
        if (lock) assert.ok(transaction); return leer('proveedores', 'id_proveedor_laboratorio', idProveedorLaboratorio, transaction);
    });
    t.mock.method(pr, 'findAll', async () => structuredClone(estado.proveedores));
    t.mock.method(pr, 'create', async (data, { transaction }) => crear('proveedores', 'id_proveedor_laboratorio', {
        estado: true, telefono: null, direccion: null, ...data }, transaction));
    t.mock.method(pr, 'update', async ({ idProveedorLaboratorio, data, transaction }) => modificar('proveedores', 'id_proveedor_laboratorio', idProveedorLaboratorio, data, transaction));
    t.mock.method(pr, 'updateEstado', async ({ idProveedorLaboratorio, estado, transaction }) => modificar('proveedores', 'id_proveedor_laboratorio', idProveedorLaboratorio, { estado }, transaction));
    t.mock.method(ar, 'findById', async ({ idPrincipioActivo, transaction }) => leer('principios', 'id_principio_activo', idPrincipioActivo, transaction));
    t.mock.method(ar, 'findAll', async () => structuredClone(estado.principios));
    t.mock.method(ar, 'findByNombre', async ({ nombre, transaction }) => structuredClone(vista(transaction).principios.find(p => p.nombre === nombre)));
    t.mock.method(ar, 'create', async ({ data, transaction }) => {
        if (falloNegocio === 'principioUnique') throw unique('uq_principio_activo_nombre');
        return crear('principios', 'id_principio_activo', { estado: true, descripcion: null, ...data }, transaction);
    });
    t.mock.method(ar, 'update', async ({ idPrincipioActivo, data, transaction }) => modificar('principios', 'id_principio_activo', idPrincipioActivo, data, transaction));
    t.mock.method(ar, 'updateEstado', async ({ idPrincipioActivo, estado, transaction }) => modificar('principios', 'id_principio_activo', idPrincipioActivo, { estado }, transaction));
    const medicamentoPublico = (idMedicamento, transaction) => {
        const row = leer('medicamentos', 'id_medicamento', idMedicamento, transaction);
        if (!row) return null;
        row.composiciones = vista(transaction).composiciones.filter(c => c.id_medicamento === idMedicamento);
        return structuredClone(row);
    };
    t.mock.method(mr, 'findById', async ({ idMedicamento, transaction, lock }) => {
        const row = medicamentoPublico(idMedicamento, transaction);
        if (falloNegocio === 'lecturaMed' && !lock && transaction) throw tecnico();
        return row && (lock ? db.Medicamento.build(row, { isNewRecord: false, raw: true }) : row);
    });
    t.mock.method(mr, 'findAll', async () => estado.medicamentos.map(m => medicamentoPublico(m.id_medicamento)));
    t.mock.method(mr, 'findProveedorById', async ({ idProveedorLaboratorio, transaction }) => leer('proveedores', 'id_proveedor_laboratorio', idProveedorLaboratorio, transaction));
    t.mock.method(mr, 'findMayorCorrelativo', async ({ transaction }) => Math.max(0, ...vista(transaction).medicamentos.map(m => Number(m.codigo_medicamento.slice(3)))));
    t.mock.method(mr, 'findByCodigo', async ({ codigoMedicamento, transaction }) => vista(transaction).medicamentos.find(m => m.codigo_medicamento === codigoMedicamento));
    t.mock.method(mr, 'findDuplicadosIdentidad', async ({ transaction }) => {
        assert.equal(transaction.options.isolationLevel, 'READ COMMITTED');
        return duplicadoIdentidad ? [{ ...med }] : [];
    });
    t.mock.method(mr, 'hasMovimientos', async () => historial);
    t.mock.method(mr, 'create', async ({ data, transaction }) => {
        if (colisiones-- > 0) throw unique('uq_medicamento_codigo');
        return crear('medicamentos', 'id_medicamento', { estado: true, stock_minimo: 0, ...data }, transaction);
    });
    t.mock.method(mr, 'update', async ({ idMedicamento, data, transaction }) => modificar('medicamentos', 'id_medicamento', idMedicamento, data, transaction));
    t.mock.method(mr, 'updateEstado', async ({ idMedicamento, estado, transaction }) => modificar('medicamentos', 'id_medicamento', idMedicamento, { estado }, transaction));
    t.mock.method(cr, 'findPrincipioById', async ({ idPrincipioActivo, transaction }) => leer('principios', 'id_principio_activo', idPrincipioActivo, transaction));
    t.mock.method(cr, 'findAllForMedicamento', async ({ idMedicamento, transaction }) => structuredClone(vista(transaction).composiciones.filter(c => c.id_medicamento === idMedicamento)));
    t.mock.method(cr, 'findById', async ({ idMedicamento, idComposicion, transaction }) =>
        structuredClone(vista(transaction).composiciones.find(c => c.id_medicamento === idMedicamento && c.id_composicion === idComposicion)));
    t.mock.method(cr, 'findByPrincipio', async ({ idMedicamento, idPrincipioActivo, transaction }) =>
        structuredClone(vista(transaction).composiciones.find(c => c.id_medicamento === idMedicamento && c.id_principio_activo === idPrincipioActivo)));
    t.mock.method(cr, 'create', async ({ data, transaction }) => {
        if (falloNegocio === 'componente' && data.id_principio_activo === 8) throw tecnico();
        return crear('composiciones', 'id_composicion', { ...data, cantidad_principio_activo: Number(data.cantidad_principio_activo).toFixed(4),
            cantidad_referencia: Number(data.cantidad_referencia).toFixed(4) }, transaction);
    });
    t.mock.method(cr, 'update', async ({ idComposicion, data, transaction }) => {
        const values = { ...data };
        for (const campo of ['cantidad_principio_activo', 'cantidad_referencia']) if (values[campo] !== undefined) values[campo] = Number(values[campo]).toFixed(4);
        modificar('composiciones', 'id_composicion', idComposicion, values, transaction);
    });
    t.mock.method(cr, 'remove', async ({ idComposicion, transaction }) => {
        vista(transaction).composiciones = vista(transaction).composiciones.filter(c => c.id_composicion !== idComposicion);
        pendientes.get(transaction.id).escribe = true;
    });
    const ingredient = (idPrincipioActivo = 7) => ({ idPrincipioActivo, cantidadPrincipioActivo: 500,
        unidadPrincipioActivo: 'mg', cantidadReferencia: 1, unidadReferencia: 'tableta' });
    const medicamento = () => ({ idProveedorLaboratorio: 5, nombreComercial: 'Producto nuevo', formaFarmaceutica: 'Tableta',
        presentacion: '500 mg', unidadInventario: 'tableta', stockMinimo: 0, condicionVenta: 'Libre', viaAdministracion: 'Oral',
        tipoLiberacion: 'Inmediata', composicion: [ingredient(), ingredient(8)] });
    const operaciones = [
        ['POST', '/usuarios', { idRol: 3, nombreUsuario: 'nuevaCuenta', password, correo: 'nuevo@example.test' }, 1, 'USUARIO_CREAR'],
        ['PATCH', '/usuarios/4', { nombreUsuario: 'renombrada', idRol: 2, correo: 'cambiado@example.test' }, 1, 'USUARIO_MODIFICAR'],
        ['PATCH', '/usuarios/4/estado', { estado: false }, 1, 'USUARIO_ESTADO'],
        ['POST', '/proveedores-laboratorios', { nombre: 'Nuevo', telefono: privado, direccion: privado }, 1, 'PROVEEDOR_LABORATORIO_CREAR'],
        ['PATCH', '/proveedores-laboratorios/5', { nombre: 'Corregido', telefono: 'nuevo_privado' }, 1, 'PROVEEDOR_LABORATORIO_MODIFICAR'],
        ['PATCH', '/proveedores-laboratorios/5/estado', { estado: false }, 1, 'PROVEEDOR_LABORATORIO_ESTADO'],
        ['POST', '/principios-activos', { nombre: 'Nuevo principio', descripcion: privado }, 2, 'PRINCIPIO_ACTIVO_CREAR'],
        ['PATCH', '/principios-activos/7', { nombre: 'Corregido', descripcion: 'nueva_descripcion' }, 2, 'PRINCIPIO_ACTIVO_MODIFICAR'],
        ['PATCH', '/principios-activos/7/estado', { estado: false }, 2, 'PRINCIPIO_ACTIVO_ESTADO'],
        ['POST', '/medicamentos', medicamento(), 2, 'MEDICAMENTO_CREAR'],
        ['PATCH', '/medicamentos/10', { nombreComercial: 'Nombre corregido' }, 2, 'MEDICAMENTO_MODIFICAR'],
        ['PATCH', '/medicamentos/10/estado', { estado: false }, 2, 'MEDICAMENTO_ESTADO'],
        ['POST', '/medicamentos/10/composicion', ingredient(8), 2, 'COMPOSICION_AGREGAR'],
        ['PATCH', '/medicamentos/10/composicion/20', { cantidadPrincipioActivo: 600 }, 2, 'COMPOSICION_MODIFICAR'],
        ['DELETE', '/medicamentos/10/composicion/20', undefined, 2, 'COMPOSICION_RETIRAR']
    ];
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const request = async (method, path, body, status = method === 'POST' ? 201 : 200, rol = 1) => {
        const auth = rol == null ? null : generarToken({ idUsuario: rol, idRol: rol, versionCredenciales: 0 });
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method,
            headers: { 'Content-Type': 'application/json', ...(auth ? { Cookie: `token=${auth}` } : {}) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
        const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data));
        assert.equal(pendientes.size, 0); return data;
    };
    const eventos = tipo => estado.eventos.filter(e => e.tipo_evento === tipo);
    const negocio = () => { const { eventos, ...datos } = estado; return structuredClone(datos); };
    try {
        await t.test('Las 15 escrituras conservan respuestas y un éxito atómico con responsable verificado', async () => {
            for (const [method, path, body, rol, tipo] of operaciones) {
                reset(); const response = await request(method, path, body, method === 'POST' ? 201 : 200, rol);
                assert.ok(response.message); assert.equal(eventos(tipo).length, 1); assert.equal(estado.eventos.length, 1);
                assert.equal(eventos(tipo)[0].id_usuario_responsable, rol); assert.equal(eventos(tipo)[0].nombre_usuario_responsable, `cuenta${rol}`);
                assert.equal(eventos(tipo)[0].resultado, 'EXITO'); assert.equal(eventos(tipo)[0].metadatos.efecto, 'CONFIRMADO');
                assert.match(pasos.at(-1).sql, /^COMMIT/);
            }
        });
        await t.test('Fallo obligatorio en cada una de las 15 escrituras revierte negocio y evita éxito/duplicación de errores', async () => {
            for (const [method, path, body, rol, tipo] of operaciones) {
                reset(); const antes = negocio(); falloEvento = tipo;
                const response = await request(method, path, body, 503, rol);
                assert.equal(response.message, 'No se pudo completar el registro de auditoría');
                assert.deepEqual(negocio(), antes); assert.equal(estado.eventos.length, 0);
                assert.equal(pasos.filter(p => /^INSERT /.test(p.sql)).length, 1);
                assert.equal(logs.filter(l => l.categoria === 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA').length, 1);
            }
        });
        await t.test('Alta de usuario: hash llega al Repository; correo y contraseña no llegan al evento', async () => {
            reset(); await request(...operaciones[0].slice(0, 3));
            const creado = estado.usuarios.at(-1); assert.equal(await bcrypt.compare(password, creado.password_hash), true);
            const evento = eventos('USUARIO_CREAR')[0];
            assert.deepEqual(evento.despues, { nombreUsuario: 'nuevaCuenta', idRol: 3, estado: true, correoAsignado: true });
            assert.equal(evento.id_usuario_objetivo, creado.id_usuario); assert.equal(evento.id_usuario_responsable, 1);
            const json = JSON.stringify(evento);
            for (const secreto of [password, creado.password_hash, creado.correo]) assert.equal(json.includes(secreto), false);
            assert.equal(eventos('USUARIO_CONSULTAR').length, 0, 'La lectura interna no produce CU05');
        });
        await t.test('Cambio de rol y correo: snapshots reales, nombres de campos privados e invalidación de recuperación', async () => {
            reset(); await request(...operaciones[1].slice(0, 3));
            const e = eventos('USUARIO_MODIFICAR')[0];
            assert.equal(e.antes.idRol, 3); assert.equal(e.despues.idRol, 2);
            assert.ok(e.metadatos.camposModificados.includes('idRol')); assert.ok(e.metadatos.camposModificados.includes('correo'));
            assert.equal(e.antes.correoAsignado, true); assert.equal(e.despues.correoAsignado, true);
            assert.ok(estado.recuperaciones[0].invalidada_en);
            assert.equal(JSON.stringify(e).includes('cambiado@example.test'), false);
            assert.equal(e.id_rol_objetivo, 2);
        });
        await t.test('Correo idéntico conserva recuperación; retirada registra indicador y revierte si falla auditoría', async () => {
            reset(); await request('PATCH', '/usuarios/4', { correo: 'cuenta4@example.test' });
            assert.equal(estado.recuperaciones[0].invalidada_en, null);
            assert.deepEqual(eventos('USUARIO_MODIFICAR')[0].metadatos.camposModificados, []);
            reset(); await request('PATCH', '/usuarios/4', { correo: null });
            assert.equal(eventos('USUARIO_MODIFICAR')[0].despues.correoAsignado, false);
            reset(); falloEvento = 'USUARIO_MODIFICAR'; await request('PATCH', '/usuarios/4', { correo: null }, 503);
            assert.equal(estado.recuperaciones[0].invalidada_en, null); assert.equal(estado.usuarios[3].correo, 'cuenta4@example.test');
        });
        await t.test('Estado de usuario conserva contador/credenciales; responsable no se reatribuye tras renombrarse', async () => {
            reset(); await request('PATCH', '/usuarios/4/estado', { estado: false });
            assert.equal(estado.usuarios[3].intentos_fallidos_login, 2); assert.equal(estado.usuarios[3].version_credenciales, 0);
            assert.deepEqual(eventos('USUARIO_ESTADO')[0].metadatos.camposModificados, ['estado']);
            reset(); await request('PATCH', '/usuarios/1', { nombreUsuario: 'adminRenombrado' });
            assert.equal(eventos('USUARIO_MODIFICAR')[0].nombre_usuario_responsable, 'cuenta1');
            assert.equal(eventos('USUARIO_MODIFICAR')[0].nombre_usuario_objetivo, 'adminRenombrado');
        });
        await t.test('CU04/CU05 auditan solo la consulta externa, incluidos listado vacío y detalle inexistente', async () => {
            reset(); await request('GET', '/usuarios'); assert.equal(eventos('USUARIOS_CONSULTAR')[0].metadatos.cantidadResultados, 4);
            reset(); sinListado = true; const vacio = await request('GET', '/usuarios'); assert.deepEqual(vacio.data, []);
            assert.equal(eventos('USUARIOS_CONSULTAR')[0].metadatos.cantidadResultados, 0);
            reset(); await request('GET', '/usuarios/4'); assert.equal(eventos('USUARIO_CONSULTAR').length, 1);
            reset(); await request('GET', '/usuarios/99', undefined, 404); assert.equal(eventos('USUARIO_CONSULTAR')[0].causa, 'NO_ENCONTRADO');
        });
        await t.test('Fallo exclusivo del auditor en CU04/CU05 conserva lectura/404 y diagnostica sin recursión', async () => {
            for (const [path, tipo, status] of [['/usuarios', 'USUARIOS_CONSULTAR', 200], ['/usuarios/4', 'USUARIO_CONSULTAR', 200], ['/usuarios/99', 'USUARIO_CONSULTAR', 404]]) {
                reset(); falloEvento = tipo; await request('GET', path, undefined, status);
                assert.equal(estado.eventos.length, 0); assert.equal(pasos.filter(p => /^INSERT /.test(p.sql)).length, 1);
            }
        });
        await t.test('CU04 distingue fallo técnico del listado vacío, sin éxito ni detalles técnicos públicos', async () => {
            reset(); falloNegocio = 'usuariosLeer'; const response = await request('GET', '/usuarios', undefined, 500);
            assert.equal(eventos('USUARIOS_CONSULTAR').length, 0); assert.equal(eventos('ERROR_TECNICO').length, 1);
            assert.equal(eventos('ERROR_TECNICO')[0].metadatos.operacionOrigen, 'USUARIOS.CONSULTAR');
            assert.equal(JSON.stringify(response).includes(privado), false);
        });
        await t.test('Duplicados y referencias de usuarios preservan respuestas públicas y un rechazo por operación', async () => {
            for (const [body, status] of [[{ idRol: 3, nombreUsuario: 'cuenta4', password }, 409],
                [{ idRol: 3, nombreUsuario: 'nuevaCuenta', password, correo: 'cuenta4@example.test' }, 409],
                [{ idRol: 99, nombreUsuario: 'nuevaCuenta', password }, 404]]) {
                reset(); const antes = negocio(); await request('POST', '/usuarios', body, status);
                assert.deepEqual(negocio(), antes); assert.equal(eventos('USUARIO_CREAR')[0].resultado, 'RECHAZADO');
                assert.equal(eventos('ERROR_TECNICO').length, 0);
            }
            reset(); estado.roles[2].estado = false; await request('POST', '/usuarios', operaciones[0][2], 409);
            assert.equal(eventos('USUARIO_CREAR')[0].causa, 'CONFLICTO');
            reset(); falloNegocio = 'usuarioUnique'; await request('POST', '/usuarios', operaciones[0][2], 409);
            assert.equal(eventos('USUARIO_CREAR').length, 1); assert.equal(estado.usuarios.length, 4);
        });
        await t.test('Proveedor y principio guardan snapshots mínimos; teléfono, dirección y descripción solo nombres de cambios', async () => {
            reset(); await request('PATCH', '/proveedores-laboratorios/5', { telefono: 'nuevo_privado', direccion: 'direccion_nueva' });
            const p = eventos('PROVEEDOR_LABORATORIO_MODIFICAR')[0];
            assert.deepEqual(p.metadatos.camposModificados, ['telefono', 'direccion']); assert.deepEqual(p.antes, p.despues);
            for (const valor of [privado, 'nuevo_privado', 'direccion_nueva']) assert.equal(JSON.stringify(p).includes(valor), false);
            reset(); await request('PATCH', '/principios-activos/7', { descripcion: 'nueva_descripcion' }, 200, 2);
            const a = eventos('PRINCIPIO_ACTIVO_MODIFICAR')[0]; assert.deepEqual(a.metadatos.camposModificados, ['descripcion']);
            assert.equal(JSON.stringify(a).includes('nueva_descripcion'), false);
        });
        await t.test('Principio duplicado por validación o UNIQUE produce un rechazo confirmado después del rollback', async () => {
            for (const fallo of [undefined, 'principioUnique']) {
                reset(); falloNegocio = fallo;
                await request('POST', '/principios-activos', { nombre: fallo ? 'Nuevo' : 'Paracetamol' }, 409, 2);
                assert.equal(eventos('PRINCIPIO_ACTIVO_CREAR')[0].resultado, 'RECHAZADO'); assert.equal(estado.principios.length, 2);
            }
        });
        await t.test('Alta integral: medicamento y componentes comparten un evento con referencias, sin eventos por ingrediente', async () => {
            reset(); const response = await request('POST', '/medicamentos', medicamento(), 201, 2);
            const e = eventos('MEDICAMENTO_CREAR')[0]; assert.equal(response.data.composicion.length, 2);
            assert.equal(estado.eventos.length, 1); assert.equal(e.metadatos.cantidadComponentes, 2);
            assert.deepEqual(e.referencias.map(r => r.id), response.data.composicion.map(c => c.idComposicion));
            assert.equal(e.despues.codigoMedicamento, response.data.codigoMedicamento); assert.equal(eventos('COMPOSICION_AGREGAR').length, 0);
        });
        await t.test('Referencias acotadas en alta integral grande: total y omisiones explícitos sin bloquear una operación válida', async () => {
            reset(); const data = medicamento();
            estado.principios = Array.from({ length: 101 }, (_, i) => ({ id_principio_activo: i + 1, nombre: `p${i}`, estado: true }));
            data.composicion = estado.principios.map(p => ingredient(p.id_principio_activo));
            await request('POST', '/medicamentos', data, 201, 2);
            const e = eventos('MEDICAMENTO_CREAR')[0]; assert.equal(e.referencias.length, 100);
            assert.equal(e.metadatos.cantidadComponentes, 101); assert.equal(e.metadatos.cantidadReferenciasOmitidas, 1);
        });
        await t.test('Fallo de componente o lectura final revierte el alta sin un evento de éxito huérfano', async () => {
            for (const fallo of ['componente', 'lecturaMed']) {
                reset(); falloNegocio = fallo; const antes = negocio(); await request('POST', '/medicamentos', medicamento(), 500, 2);
                assert.deepEqual(negocio(), antes); assert.equal(eventos('MEDICAMENTO_CREAR').length, 0);
                assert.equal(eventos('ERROR_TECNICO').length, 1); assert.equal(eventos('ERROR_TECNICO')[0].metadatos.efecto, 'NO_APLICA');
                assert.equal(JSON.stringify(logs).includes(privado), false);
            }
        });
        await t.test('Colisiones internas de código no producen eventos extra; agotamiento conserva un único rechazo', async () => {
            reset(); colisiones = 2; await request('POST', '/medicamentos', medicamento(), 201, 2);
            assert.equal(eventos('MEDICAMENTO_CREAR').length, 1); assert.equal(pasos.filter(p => /^ROLLBACK/.test(p.sql)).length, 2);
            reset(); colisiones = 5; await request('POST', '/medicamentos', medicamento(), 409, 2);
            assert.equal(eventos('MEDICAMENTO_CREAR').length, 1); assert.equal(eventos('MEDICAMENTO_CREAR')[0].resultado, 'RECHAZADO');
            assert.equal(eventos('MEDICAMENTO_CREAR')[0].id_registro, null); assert.equal(eventos('MEDICAMENTO_CREAR')[0].despues, null);
            assert.equal(estado.medicamentos.length, 1);
        });
        await t.test('Duplicado comercial conserva 409 y referencias públicas; auditoría no copia el objeto de error', async () => {
            reset(); duplicadoIdentidad = true;
            const response = await request('POST', '/medicamentos', medicamento(), 409, 2);
            assert.equal(response.errors.medicamentosExistentes[0].idMedicamento, 10);
            assert.equal(eventos('MEDICAMENTO_CREAR')[0].causa, 'CONFLICTO'); assert.equal(eventos('ERROR_TECNICO').length, 0);
        });
        await t.test('Historial protege identidad y composición; nombre/stock siguen editables y código se conserva', async () => {
            for (const [method, path, body, tipo] of [['PATCH', '/medicamentos/10', { presentacion: 'Otra' }, 'MEDICAMENTO_MODIFICAR'],
                ['POST', '/medicamentos/10/composicion', ingredient(8), 'COMPOSICION_AGREGAR'],
                ['PATCH', '/medicamentos/10/composicion/20', { cantidadPrincipioActivo: 600 }, 'COMPOSICION_MODIFICAR'],
                ['DELETE', '/medicamentos/10/composicion/20', undefined, 'COMPOSICION_RETIRAR']]) {
                reset(); historial = true; const antes = negocio(); await request(method, path, body, 409, 2);
                assert.deepEqual(negocio(), antes); assert.equal(eventos(tipo)[0].resultado, 'RECHAZADO');
            }
            reset(); historial = true; await request('PATCH', '/medicamentos/10', { nombreComercial: 'Nombre corregido', stockMinimo: 5 }, 200, 2);
            const e = eventos('MEDICAMENTO_MODIFICAR')[0]; assert.equal(e.antes.codigoMedicamento, e.despues.codigoMedicamento);
            assert.deepEqual(e.metadatos.camposModificados, ['nombreComercial', 'stockMinimo']);
        });
        await t.test('Composición independiente conserva decimales y traza retirada física de la última relación', async () => {
            reset(); await request('PATCH', '/medicamentos/10/composicion/20', { cantidadPrincipioActivo: 600 }, 200, 2);
            const cambio = eventos('COMPOSICION_MODIFICAR')[0];
            assert.equal(cambio.antes.cantidadPrincipioActivo, '500.0000'); assert.equal(cambio.despues.cantidadPrincipioActivo, '600.0000');
            assert.deepEqual(cambio.metadatos.camposModificados, ['cantidadPrincipioActivo']);
            reset(); await request('DELETE', '/medicamentos/10/composicion/20', undefined, 200, 2);
            assert.equal(estado.composiciones.length, 0); const retiro = eventos('COMPOSICION_RETIRAR')[0];
            assert.equal(retiro.id_registro, 20); assert.equal(retiro.antes.idPrincipioActivo, 7); assert.equal(retiro.despues, null);
            assert.deepEqual(retiro.referencias, [{ tipo: 'MEDICAMENTO', id: 10 }]);
        });
        await t.test('Composición repetida o perteneciente a otro medicamento conserva rechazo y no altera relaciones', async () => {
            reset(); await request('POST', '/medicamentos/10/composicion', ingredient(), 409, 2);
            assert.equal(eventos('COMPOSICION_AGREGAR')[0].causa, 'CONFLICTO');
            reset(); estado.medicamentos.push({ ...med, id_medicamento: 11 });
            await request('PATCH', '/medicamentos/11/composicion/20', { cantidadPrincipioActivo: 600 }, 404, 2);
            assert.equal(eventos('COMPOSICION_MODIFICAR')[0].causa, 'NO_ENCONTRADO'); assert.equal(estado.composiciones[0].cantidad_principio_activo, '500.0000');
        });
        await t.test('Sin cambio efectivo queda un evento de operación con lista de campos vacía', async () => {
            reset(); await request('PATCH', '/medicamentos/10', { stockMinimo: 0 }, 200, 2);
            assert.deepEqual(eventos('MEDICAMENTO_MODIFICAR')[0].metadatos.camposModificados, []);
            reset(); await request('PATCH', '/principios-activos/7/estado', { estado: true }, 200, 2);
            assert.deepEqual(eventos('PRINCIPIO_ACTIVO_ESTADO')[0].metadatos.camposModificados, []);
        });
        await t.test('Rechazo de negocio no se pierde ni cambia si falla su auditoría', async () => {
            reset(); falloEvento = 'COMPOSICION_AGREGAR'; await request('POST', '/medicamentos/10/composicion', ingredient(), 409, 2);
            assert.equal(estado.eventos.length, 0); assert.equal(estado.composiciones.length, 1);
            assert.equal(pasos.filter(p => /^INSERT /.test(p.sql)).length, 1);
        });
        await t.test('Commit incierto conserva diagnóstico seguro sin repetir la escritura ni fabricar respuesta exitosa', async () => {
            reset(); commitPerdido = true; await request('PATCH', '/medicamentos/10', { stockMinimo: 5 }, 500, 2);
            assert.equal(estado.medicamentos[0].stock_minimo, 5); assert.equal(eventos('MEDICAMENTO_MODIFICAR').length, 1);
            assert.equal(eventos('ERROR_TECNICO').length, 1); assert.equal(eventos('ERROR_TECNICO')[0].metadatos.efecto, 'INCIERTO');
        });
        await t.test('Error HTTP posterior conserva el efecto confirmado y referencia de la operación', async () => {
            reset(); const original = app.response.json;
            const mock = t.mock.method(app.response, 'json', function (...args) {
                if (this.req.originalUrl.endsWith('/proveedores-laboratorios/5') && this.statusCode === 200) throw tecnico();
                return original.apply(this, args);
            });
            try { await request('PATCH', '/proveedores-laboratorios/5', { nombre: 'Confirmado' }, 500); }
            finally { mock.mock.restore(); }
            assert.equal(estado.proveedores[0].nombre, 'Confirmado'); assert.equal(eventos('PROVEEDOR_LABORATORIO_MODIFICAR').length, 1);
            const e = eventos('ERROR_TECNICO')[0]; assert.equal(e.metadatos.efecto, 'CONFIRMADO'); assert.equal(e.tipo_registro, 'PROVEEDOR_LABORATORIO'); assert.equal(e.id_registro, 5);
        });
        await t.test('Lecturas rutinarias siguen sin éxito auditado; registro inexistente se clasifica como rechazo, no error técnico', async () => {
            for (const path of ['/proveedores-laboratorios', '/proveedores-laboratorios/5', '/principios-activos', '/principios-activos/7', '/medicamentos', '/medicamentos/10', '/medicamentos/10/composicion']) {
                reset(); await request('GET', path, undefined, 200, 2); assert.equal(estado.eventos.length, 0);
            }
            reset(); await request('GET', '/medicamentos/99', undefined, 404, 2);
            assert.equal(eventos('OPERACION_RECHAZADA')[0].causa, 'NO_ENCONTRADO'); assert.equal(eventos('ERROR_TECNICO').length, 0);
            assert.equal(eventos('OPERACION_RECHAZADA')[0].id_registro, 99);
            assert.equal(eventos('OPERACION_RECHAZADA')[0].tipo_registro, 'MEDICAMENTO');
        });
        await t.test('Permisos originales en las 15 escrituras: rechazo único y ningún cambio para roles no autorizados', async () => {
            for (const [method, path, body, rol] of operaciones) {
                reset(); const antes = negocio(); await request(method, path, body, 403, rol === 1 ? 2 : 1);
                assert.deepEqual(negocio(), antes); assert.equal(estado.eventos.length, 1); assert.equal(eventos('ACCESO_DENEGADO').length, 1);
            }
        });
        await t.test('Entrada estricta rechaza actor/estado/código falsos sin copiar body, ni iniciar negocio', async () => {
            for (const [path, body, rol] of [['/usuarios', { ...operaciones[0][2], idUsuario: 1 }, 1],
                ['/medicamentos', { ...medicamento(), codigoMedicamento: 'MAN001' }, 2],
                ['/principios-activos', { nombre: 'Nuevo', responsable: 1 }, 2]]) {
                reset(); await request('POST', path, body, 400, rol); assert.equal(eventos('VALIDACION_RECHAZADA').length, 1);
                assert.equal(JSON.stringify(estado.eventos).includes(password), false);
            }
        });
        t.diagnostic('Auditoría genera SQL y transacciones Sequelize reales; Repositories de negocio y almacenamiento simulados. No acredita MySQL/InnoDB real.');
    } finally {
        await new Promise(resolve => server.close(resolve));
        await db.sequelize.close();
    }
});

test('Repositories incorporados a transacciones compartidas transmiten la misma conexión y bloqueo a Sequelize', async t => {
    // Interceptar solo la frontera con Sequelize para detectar una omisión de
    // transaction en los Repositories que no cubre el fixture de negocio.
    const transaction = { LOCK: { UPDATE: 'UPDATE' } }, llamadas = [];
    for (const Model of [db.Usuario, db.ProveedorLaboratorio]) {
        t.mock.method(Model, 'create', async (data, options) => { llamadas.push({ data, options }); return data; });
        t.mock.method(Model, 'update', async (data, options) => { llamadas.push({ data, options }); return [1]; });
    }
    t.mock.method(db.ProveedorLaboratorio, 'findByPk', async (id, options) => { llamadas.push({ id, options }); return null; });
    await ur.createUsuario({ idRol: 3, nombreUsuario: 'fixture', passwordHash: 'hash_sintetico', transaction });
    await ur.updateEstado({ idUsuario: 4, estado: false, transaction });
    await pr.create({ nombre: 'Proveedor' }, { transaction });
    await pr.update({ idProveedorLaboratorio: 5, data: { nombre: 'Otro' }, transaction });
    await pr.updateEstado({ idProveedorLaboratorio: 5, estado: false, transaction });
    await pr.findById({ idProveedorLaboratorio: 5, transaction, lock: true });
    assert.equal(llamadas.length, 6);
    for (const llamada of llamadas) assert.equal(llamada.options.transaction, transaction);
    assert.equal(llamadas.at(-1).options.lock, transaction.LOCK.UPDATE);
    assert.equal(llamadas[0].data.password_hash, 'hash_sintetico');
    assert.equal(Object.hasOwn(llamadas[0].data, 'password'), false);
    await pr.findById({ idProveedorLaboratorio: 5 });
    assert.equal(llamadas.at(-1).options.lock, undefined, 'Las lecturas rutinarias no añaden un bloqueo');
});
