import test from 'node:test';
import assert from 'node:assert/strict';

// Capas HTTP reales; sesión, almacenamiento y snapshot simulados sin MySQL.
// El evaluador de fixtures y el SQL interceptado no acreditan ejecución SQL.
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'reportes_compras_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_reportes_compras_tests';
const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { authService } = await import('../src/business/services/auth.service.js');
const { reporteRepository } = await import('../src/data/repositories/reporte.repository.js');
const { reporteValidator } = await import('../src/business/validators/reporte.validator.js');
const { bitacoraAuditoriaRepository } = await import('../src/data/repositories/bitacora-auditoria.repository.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const { decimalAEntero, enteroADecimal } = await import('../src/shared/utils/decimal.js');
const { identificarOperacionAuditoria } = await import('../src/shared/constants/auditoria-operaciones.js');
const { CATALOGO_AUDITORIA } = await import('../src/shared/constants/auditoria.js');
const { prepararEventoAuditoria } = await import('../src/business/validators/auditoria.validator.js');
const { Op } = db.Sequelize;

const fila = (id, estado, fechaCompra, total = '15.50') => ({
    id_compra: id, id_proveedor_laboratorio: 2, estado_operacion: estado, fecha_compra: fechaCompra,
    fecha_registro: '2026-11-11 09:00:00',
    fecha_anulacion: estado === 'ANULADA' ? '2026-12-01 08:00:00' : null, total,
    motivo_anulacion: 'privado', clave_operacion: 'privado', id_usuario: 8,
    proveedorLaboratorio: { estado: false, nombre: 'privado', telefono: 'privado' },
    detallesCompra: [{ subtotal: '999.00', movimientos: [1, 2] }, { subtotal: '999.00', movimientos: [3] }],
    usuarioRegistrador: { nombre_usuario: 'privado', password_hash: 'privado' }
});
const cumple = (row, where) => Reflect.ownKeys(where).every(key => {
    const valor = where[key];
    if (typeof valor !== 'object' || valor === null) return row[key] === valor;
    return Reflect.ownKeys(valor).every(op => op === Op.gte ? row[key] >= valor[op] : row[key] <= valor[op]);
});

test('CU39: HTTP/capas, adquisición, dinero y auditoría con snapshot simulado', async t => {
    let filas = [], falloConsulta = false, falloAuditor = false, conteoInvalido = false, intercalar;
    let snapshotActivo = false;
    const lecturas = [], eventos = [], diagnosticos = [];
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('MySQL prohibido'); });
    t.mock.method(console, 'error', dato => diagnosticos.push(dato));
    t.mock.method(authService, 'getSessionUsuario', async id => ({
        idUsuario: id, idRol: id, nombreUsuario: `actor${id}`
    }));
    t.mock.method(db.sequelize, 'transaction', async (options, callback) => {
        if (typeof options === 'function') {
            assert.equal(snapshotActivo, false, 'Auditoría fuera del snapshot');
            return options({ auditor: true });
        }
        assert.equal(options.isolationLevel, db.Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ);
        const transaction = { snapshot: structuredClone(filas) };
        snapshotActivo = true;
        try { return await callback(transaction); } finally { snapshotActivo = false; }
    });
    t.mock.method(bitacoraAuditoriaRepository, 'create', async ({ data, transaction }) => {
        assert.equal(transaction.auditor, true);
        assert.equal(snapshotActivo, false);
        eventos.push(data);
        if (falloAuditor) throw new Error('privado_sql_credencial');
        return eventos.length;
    });
    t.mock.method(db.Compra, 'findAll', async options => {
        assert.equal(snapshotActivo, true);
        assert.ok(options.transaction.snapshot);
        assert.equal(options.include, undefined);
        assert.equal(options.lock, undefined);
        lecturas.push(options);
        if (falloConsulta) throw new Error('privado_sql_credencial');
        const seleccion = options.transaction.snapshot.filter(row => cumple(row, options.where));
        if (options.group) {
            if (conteoInvalido) return [{ estado_operacion: 'CONFIRMADA', cantidad: '9007199254740992', importe: '0.00' }];
            const grupos = new Map();
            for (const row of seleccion) {
                const estado = row.estado_operacion;
                const grupo = grupos.get(estado) ?? { estado_operacion: estado, cantidad: 0, centavos: 0n };
                grupo.cantidad++;
                grupo.centavos += decimalAEntero(row.total, 2);
                grupos.set(estado, grupo);
            }
            if (intercalar) { intercalar(); intercalar = undefined; }
            return [...grupos.values()].map(g => ({ estado_operacion: g.estado_operacion,
                cantidad: String(g.cantidad), importe: enteroADecimal(g.centavos, 2) }));
        }
        const agregacion = lecturas.at(-2);
        assert.equal(options.where, agregacion.where, 'Predicado compartido por identidad');
        assert.equal(options.transaction, agregacion.transaction, 'Mismo snapshot');
        return seleccion.sort((a, b) => b.fecha_compra.localeCompare(a.fecha_compra) || b.id_compra - a.id_compra)
            .slice(options.offset, options.offset + options.limit).map(row => ({ ...row }));
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const request = async (rol = 1, query = '?dia=2026-11-10', status = 200, tokenInvalido = false) => {
        const antes = eventos.length;
        const token = tokenInvalido ? 'invalido' : rol ? generarToken({ idUsuario: rol, idRol: rol, versionCredenciales: 0 }) : null;
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reportes/compras${query}`, {
            headers: token ? { Cookie: `token=${token}` } : {}, signal: AbortSignal.timeout(10000)
        });
        const body = await response.json();
        assert.equal(response.status, status, JSON.stringify(body));
        assert.equal(eventos.length, antes + 1, 'Una captura por solicitud, incluso si falla el auditor');
        assert.doesNotMatch(JSON.stringify(body), /privado|password|telefono|usuario|motivoAnulacion|claveOperacion|stack|SELECT/i);
        return body;
    };
    try {
        await t.test('401 sin sesión/token inválido; 403 para Regente y Vendedor', async () => {
            await request(null, '', 401);
            assert.equal(eventos.at(-1).tipo_evento, 'SESION_AUSENTE');
            await request(1, '', 401, true);
            assert.equal(eventos.at(-1).tipo_evento, 'TOKEN_INVALIDO');
            for (const rol of [2, 3]) {
                await request(rol, '', 403);
                assert.equal(eventos.at(-1).tipo_evento, 'ACCESO_DENEGADO');
                assert.equal(eventos.at(-1).causa, 'ROL_NO_PERMITIDO');
            }
            assert.equal(lecturas.length, 0);
        });
        await t.test('400 estricto, contrato temporal y validateCompras reutilizado', async () => {
            for (const query of ['', '?dia=2026-02-30', '?dia=1900-02-29', '?dia=0999-12-31',
                '?dia=2026-11-10&dia=2026-11-10', '?mes=2026-11&desde=2026-11-01',
                '?desde=2026-11-10', '?desde=2026-11-11&hasta=2026-11-10',
                '?dia=2026-11-10&limite=101', '?dia=2026-11-10&pagina=0',
                '?dia=2026-11-10&estadoOperacion=PENDIENTE', '?dia=2026-11-10&idProveedorLaboratorio=2',
                '?dia=2026-11-10&motivo=DAÑO']) {
                const body = await request(1, query, 400);
                assert.equal(body.message, 'Datos inválidos');
                assert.ok(body.errors.length);
                assert.equal(eventos.at(-1).tipo_evento, 'VALIDACION_RECHAZADA');
                assert.equal(eventos.at(-1).causa, 'ENTRADA_INVALIDA');
            }
            assert.equal(lecturas.length, 0);
            const validar = reporteValidator.validateCompras;
            const mock = t.mock.method(reporteValidator, 'validateCompras', query => validar(query));
            const body = await request(1, '?mes=2000-02');
            assert.equal(mock.mock.callCount(), 1);
            assert.deepEqual(body.data.periodo, validar({ mes: '2000-02' }).data.periodo);
            assert.deepEqual(lecturas.at(-1).where.fecha_compra, { [Op.gte]: '2000-02-01', [Op.lte]: '2000-02-29' });
            mock.mock.restore();
        });
        await t.test('Vacío 200 con ceros y evento de éxito mínimo', async () => {
            const body = await request();
            assert.deepEqual(body.paginacion, { pagina: 1, limite: 25, total: 0, totalPaginas: 0 });
            assert.deepEqual(body.data.detalle, []);
            assert.deepEqual(body.data.resumen, { confirmadas: { cantidad: 0, importe: '0.00' },
                anuladas: { cantidad: 0, importe: '0.00' }, totalComprasRealizadas: '0.00' });
            const evento = eventos.at(-1);
            assert.equal(evento.tipo_evento, 'REPORTE_COMPRAS_CONSULTAR');
            assert.equal(evento.modulo, 'REPORTES');
            assert.equal(evento.accion, 'CONSULTAR_COMPRAS');
            assert.equal(evento.id_usuario_responsable, 1);
            assert.deepEqual(evento.metadatos, { cantidadResultados: 0 });
            for (const campo of ['antes', 'despues', 'referencias', 'tipo_registro', 'id_registro']) assert.equal(evento[campo], null);
        });
        await t.test('Adquisición inclusiva, estados, proveedor inactivo y múltiples relaciones sin duplicación', async () => {
            filas = [fila(1, 'CONFIRMADA', '2026-11-01'), fila(2, 'CONFIRMADA', '2026-11-30'),
                fila(3, 'ANULADA', '2026-11-10', '0.10'), fila(4, 'CONFIRMADA', '2026-10-31'),
                fila(5, 'ANULADA', '2026-12-01')];
            const body = await request(1, '?mes=2026-11&limite=2');
            assert.deepEqual(body.data.resumen, { confirmadas: { cantidad: 2, importe: '31.00' },
                anuladas: { cantidad: 1, importe: '0.10' }, totalComprasRealizadas: '31.00' });
            assert.deepEqual(body.paginacion, { pagina: 1, limite: 2, total: 3, totalPaginas: 2 });
            assert.deepEqual(body.data.detalle.map(r => r.idCompra), [2, 3]);
            assert.deepEqual(body.data.detalle[1], { idCompra: 3, idProveedorLaboratorio: 2,
                estadoOperacion: 'ANULADA', fechaReferencia: '2026-11-10', fechaCompra: '2026-11-10',
                fechaRegistro: '2026-11-11 09:00:00', fechaAnulacion: '2026-12-01 08:00:00', total: '0.10' });
            assert.equal(body.data.detalle[0].fechaAnulacion, null);
            assert.deepEqual(eventos.at(-1).metadatos, { cantidadResultados: 2 });
            const pagina2 = await request(1, '?desde=2026-11-01&hasta=2026-11-30&limite=2&pagina=2');
            assert.deepEqual(pagina2.data.detalle.map(r => r.idCompra), [1]);
            assert.deepEqual(pagina2.data.resumen, body.data.resumen);
            const lejana = await request(1, '?mes=2026-11&pagina=2147483647&limite=100');
            assert.deepEqual(lejana.data.detalle, []);
            assert.equal(lejana.paginacion.pagina, 2147483647);
            assert.deepEqual(lejana.data.resumen, body.data.resumen);
            for (const estado of ['CONFIRMADA', 'ANULADA']) {
                const filtrado = await request(1, `?mes=2026-11&estadoOperacion=${estado}`);
                assert.ok(filtrado.data.detalle.every(r => r.estadoOperacion === estado));
                assert.equal(filtrado.paginacion.total, estado === 'CONFIRMADA' ? 2 : 1);
                const excluida = estado === 'CONFIRMADA' ? 'anuladas' : 'confirmadas';
                assert.deepEqual(filtrado.data.resumen[excluida], { cantidad: 0, importe: '0.00' });
                if (estado === 'ANULADA') assert.equal(filtrado.data.resumen.totalComprasRealizadas, '0.00');
            }
            const dia = await request();
            assert.deepEqual(dia.data.detalle.map(r => r.idCompra), [3]);
            const registro = await request(1, '?dia=2026-11-11');
            assert.equal(registro.paginacion.total, 0, 'Registro no sustituye adquisición');
            const anulacion = await request(1, '?dia=2026-12-01&estadoOperacion=ANULADA');
            assert.deepEqual(anulacion.data.detalle.map(r => r.idCompra), [5], 'Anulación no sustituye adquisición');
        });
        await t.test('Exactitud decimal, suma grande sin límite de columna y desempate por ID', async () => {
            filas = [fila(1, 'CONFIRMADA', '2026-11-10', '0.10'), fila(2, 'CONFIRMADA', '2026-11-10', '0.20')];
            const pequeno = await request();
            assert.equal(pequeno.data.resumen.totalComprasRealizadas, '0.30');
            assert.deepEqual(pequeno.data.detalle.map(r => r.idCompra), [2, 1]);
            filas = Array.from({ length: 10001 }, (_, id) => fila(id + 1, 'CONFIRMADA', '2026-11-10', '999999999999.99'));
            const body = await request(1, '?dia=2026-11-10&limite=1');
            assert.equal(body.data.resumen.totalComprasRealizadas, '10000999999999899.99');
            assert.equal(body.data.detalle[0].total, '999999999999.99');
            assert.equal(body.paginacion.total, 10001);
        });
        await t.test('Snapshot común con anulación intercalada simulada, nuevo estado en próxima solicitud', async () => {
            filas = [fila(1, 'CONFIRMADA', '2026-11-10')];
            intercalar = () => { filas[0].estado_operacion = 'ANULADA'; };
            const body = await request();
            assert.equal(body.data.resumen.confirmadas.cantidad, 1);
            assert.equal(body.data.detalle[0].estadoOperacion, 'CONFIRMADA');
            const siguiente = await request();
            assert.equal(siguiente.data.resumen.anuladas.cantidad, 1);
            assert.equal(siguiente.data.detalle[0].estadoOperacion, 'ANULADA');
        });
        await t.test('Futuros, bisiestos, años extremos y período amplio sin recorte', async () => {
            filas = [fila(1, 'CONFIRMADA', '1000-01-01', '0.00'), fila(2, 'CONFIRMADA', '9999-12-31', '0.00'),
                fila(3, 'CONFIRMADA', '2000-02-29', '0.00')];
            for (const dia of ['1000-01-01', '9999-12-31', '2000-02-29']) {
                const body = await request(1, `?dia=${dia}`);
                assert.equal(body.paginacion.total, 1);
                assert.equal(body.data.detalle[0].fechaCompra, dia);
            }
            assert.equal((await request(1, '?mes=9999-12')).paginacion.total, 1);
            assert.equal((await request(1, '?mes=2000-02')).paginacion.total, 1);
            assert.equal((await request(1, '?desde=1000-01-01&hasta=9999-12-31')).paginacion.total, 3);
        });
        await t.test('Materialización inválida falla con 500 seguro y sin éxito auditado', async () => {
            conteoInvalido = true;
            try {
                assert.deepEqual(await request(1, '?dia=2026-11-10', 500), { message: 'Error interno del servidor' });
                assert.equal(snapshotActivo, false);
                assert.equal(eventos.at(-1).tipo_evento, 'ERROR_TECNICO');
            } finally { conteoInvalido = false; }
        });
        await t.test('Auditor independiente en éxitos/rechazos/fallos, captura única y diagnóstico seguro', async () => {
            falloAuditor = true;
            await request();
            assert.equal(eventos.at(-1).tipo_evento, 'REPORTE_COMPRAS_CONSULTAR');
            await request(null, '', 401);
            await request(2, '', 403);
            await request(1, '', 400);
            falloConsulta = true;
            assert.deepEqual(await request(1, '?dia=2026-11-10', 500), { message: 'Error interno del servidor' });
            assert.equal(eventos.at(-1).tipo_evento, 'ERROR_TECNICO');
            assert.equal(eventos.at(-1).metadatos.operacionOrigen, 'REPORTES.CONSULTAR_COMPRAS');
            const propiosAuditor = diagnosticos.filter(d => d.categoria === 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA');
            assert.equal(propiosAuditor.length, 5);
            assert.doesNotMatch(JSON.stringify(propiosAuditor), /privado|sql|credencial/i);
            falloAuditor = false;
            await request(1, '?dia=2026-11-10', 500);
        });
        for (const evento of eventos.filter(e => e.resultado !== 'EXITO')) {
            assert.equal(evento.metadatos.operacionOrigen, 'REPORTES.CONSULTAR_COMPRAS');
        }
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reportes/perdidas`);
        assert.equal(response.status, 401, 'CU41 completo y protegido');
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('CU39: SQL Sequelize generado e interceptado, no ejecutado en MySQL', async t => {
    const queries = [];
    const transaction = new db.Sequelize.Transaction(db.sequelize, {});
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('MySQL prohibido'); });
    t.mock.method(db.sequelize, 'query', async (sql, options) => {
        assert.equal(options.transaction, transaction);
        queries.push(sql);
        return [];
    });
    for (const query of [{ dia: '2026-11-10' }, { mes: '2000-02', estadoOperacion: 'ANULADA' },
        { desde: '1000-01-01', hasta: '9999-12-31', pagina: '2', limite: '1' }]) {
        const filtros = reporteValidator.validateCompras(query).data;
        await reporteRepository.consultarCompras(filtros, { transaction });
        const [agregado, detalle] = queries.slice(-2);
        for (const sql of [agregado, detalle]) {
            assert.match(sql, /^SELECT /);
            assert.match(sql, /FROM `compra` AS `Compra`/);
            assert.ok(sql.includes(`\`Compra\`.\`fecha_compra\` >= '${filtros.periodo.desde}'`));
            assert.ok(sql.includes(`\`Compra\`.\`fecha_compra\` <= '${filtros.periodo.hasta}'`));
            assert.doesNotMatch(sql, /JOIN|DISTINCT|FOR UPDATE|usuario|clave_operacion|motivo_anulacion|telefono|detalles/i);
        }
        assert.match(agregado, /COUNT\(`id_compra`\)/);
        assert.match(agregado, /CAST\(SUM\(`total`\) AS CHAR\)/);
        assert.doesNotMatch(agregado, /LIMIT|fecha_registro|fecha_anulacion/);
        assert.match(detalle, /DATE_FORMAT\(`fecha_compra`, '%Y-%m-%d'\)/);
        assert.match(detalle, /ORDER BY `Compra`.`fecha_compra` DESC, `Compra`.`id_compra` DESC LIMIT/);
        assert.equal(agregado.split(' WHERE ')[1].split(' GROUP BY ')[0], detalle.split(' WHERE ')[1].split(' ORDER BY ')[0]);
        if (query.estadoOperacion) assert.match(agregado, /`Compra`.`estado_operacion` = 'ANULADA'/);
    }
    assert.equal(queries.length, 6, 'Dos lecturas por solicitud, conteo derivado de grupos');
    assert.match(queries.at(-1), /LIMIT 1, 1/);
});

test('CU39: catálogo, clasificación HEAD/caja/slash y metadatos mínimos permitidos', () => {
    assert.deepEqual(CATALOGO_AUDITORIA.REPORTE_COMPRAS_CONSULTAR,
        { modulo: 'REPORTES', accion: 'CONSULTAR_COMPRAS', perfil: null, transaccionExito: false });
    for (const metodo of ['GET', 'HEAD']) for (const path of ['/api/reportes/compras', '/API/REPORTES/COMPRAS/']) {
        assert.equal(identificarOperacionAuditoria(metodo, path), 'REPORTES.CONSULTAR_COMPRAS');
    }
    assert.equal(identificarOperacionAuditoria('GET', '/api/reportes/perdidas'), 'REPORTES.CONSULTAR_PERDIDAS');
    const evento = prepararEventoAuditoria({ tipoEvento: 'REPORTE_COMPRAS_CONSULTAR', resultado: 'EXITO',
        responsable: { idUsuario: 1, idRol: 1, nombreUsuario: 'admin' },
        contexto: { correlacion: 'a'.repeat(32), direccionIp: null, procedenciaIp: 'NO_DISPONIBLE' },
        metadatos: { cantidadResultados: 100, query: 'privado', total: '999.99', detalle: ['privado'] },
        antes: { proveedor: 'privado' }, despues: { total: '999.99' } });
    assert.deepEqual(evento.metadatos, { cantidadResultados: 100 });
    assert.equal(evento.antes, null);
    assert.equal(evento.despues, null);
});
