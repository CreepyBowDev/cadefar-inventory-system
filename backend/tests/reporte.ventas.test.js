import test from 'node:test';
import assert from 'node:assert/strict';

// Express y capas reales; sesiones, transporte/almacenamiento y snapshots simulados.
// Ni estas pruebas ni el SQL generado acreditan ejecución o aislamiento de MySQL.
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'reportes_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_reportes_tests';
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

const fila = (id, estado, fechaVenta, fechaRegistro, total = '15.50') => ({
    id_venta: id, estado_operacion: estado, fecha_venta: fechaVenta, fecha_registro: fechaRegistro,
    fecha_anulacion: estado === 'ANULADA' ? '2026-12-01 09:00:00' : null, total,
    nombre_paciente: 'privado', motivo_anulacion: 'privado', clave_operacion: 'privado',
    detallesVenta: [{ subtotal: '999.00' }, { subtotal: '999.00' }],
    recetas: [{ nombre_paciente: 'privado' }, { documento_paciente: 'privado' }]
});
const categoriaDe = row => row.estado_operacion !== 'ANULADA' ? row.estado_operacion :
    row.fecha_venta === null ? 'ANULADA_SIN_CONFIRMAR' : 'ANULADA_CONFIRMADA';
const referenciaDe = row => ['CONFIRMADA', 'ANULADA_CONFIRMADA'].includes(categoriaDe(row)) ?
    row.fecha_venta : row.fecha_registro;
// Evaluador limitado a los predicados Sequelize emitidos por este Repository.
const cumple = (row, where) => Reflect.ownKeys(where).every(key => {
    if (key === Op.or) return where[key].some(condicion => cumple(row, condicion));
    const valor = where[key];
    if (valor === null || typeof valor !== 'object') return row[key] === valor;
    return Reflect.ownKeys(valor).every(op => {
        if (op === Op.ne) return row[key] !== valor[op];
        const extremo = valor[op].args[0];
        return row[key] !== null && (op === Op.gte ? row[key] >= extremo : row[key] <= extremo);
    });
});

test('CU38: HTTP, categorías, dinero, snapshot y auditoría simulados sin MySQL', async t => {
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
            assert.equal(snapshotActivo, false, 'Auditoría fuera del snapshot de lectura');
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
    t.mock.method(db.Venta, 'findAll', async options => {
        assert.equal(snapshotActivo, true);
        assert.ok(options.transaction.snapshot);
        assert.equal(options.include, undefined);
        assert.equal(options.lock, undefined);
        lecturas.push(options);
        if (falloConsulta) throw new Error('privado_sql_credencial');
        const seleccion = options.transaction.snapshot.filter(row => cumple(row, options.where));
        if (options.group) {
            if (conteoInvalido) return [{ categoria: 'CONFIRMADA', cantidad: '9007199254740992', importe: '0.00' }];
            const grupos = new Map();
            for (const row of seleccion) {
                const categoria = categoriaDe(row);
                const grupo = grupos.get(categoria) ?? { categoria, cantidad: 0, centavos: 0n };
                grupo.cantidad++;
                grupo.centavos += decimalAEntero(row.total, 2);
                grupos.set(categoria, grupo);
            }
            if (intercalar) { intercalar(); intercalar = undefined; }
            return [...grupos.values()].map(g => ({ categoria: g.categoria,
                cantidad: String(g.cantidad), importe: enteroADecimal(g.centavos, 2) }));
        }
        const agregacion = lecturas.at(-2);
        assert.equal(options.where, agregacion.where, 'Predicado compartido por identidad');
        assert.equal(options.transaction, agregacion.transaction, 'Mismo snapshot');
        return seleccion.sort((a, b) => referenciaDe(b).localeCompare(referenciaDe(a)) || b.id_venta - a.id_venta)
            .slice(options.offset, options.offset + options.limit)
            .map(row => ({ ...row, categoria: categoriaDe(row), fecha_referencia: referenciaDe(row).slice(0, 19),
                fecha_venta: row.fecha_venta?.slice(0, 19) ?? null }));
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const request = async (rol = 1, query = '?dia=2026-11-10', status = 200, tokenInvalido = false) => {
        const antes = eventos.length;
        const token = tokenInvalido ? 'invalido' : rol ? generarToken({ idUsuario: rol, idRol: rol, versionCredenciales: 0 }) : null;
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reportes/ventas${query}`, {
            headers: token ? { Cookie: `token=${token}` } : {}, signal: AbortSignal.timeout(10000)
        });
        const body = await response.json();
        assert.equal(response.status, status, JSON.stringify(body));
        assert.equal(eventos.length, antes + 1, 'Una captura por solicitud, incluso con fallo del auditor');
        assert.doesNotMatch(JSON.stringify(body), /privado|password|paciente|receta|motivoAnulacion|claveOperacion|stack|SELECT/i);
        return body;
    };
    try {
        await t.test('401 sin sesión/token inválido y 403 Regente/Vendedor; captura transversal única', async () => {
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
        await t.test('400 estricto y reutilización de validateVentas, sin consultas', async () => {
            for (const query of ['', '?dia=2026-02-30', '?dia=2026-11-10&dia=2026-11-10',
                '?mes=2026-11&desde=2026-11-01', '?desde=2026-11-11&hasta=2026-11-10',
                '?dia=2026-11-10&limite=101', '?dia=2026-11-10&motivo=DAÑO']) {
                const body = await request(1, query, 400);
                assert.equal(body.message, 'Datos inválidos');
                assert.ok(body.errors.length);
                assert.equal(eventos.at(-1).tipo_evento, 'VALIDACION_RECHAZADA');
            }
            assert.equal(lecturas.length, 0);
            const validar = reporteValidator.validateVentas;
            const mock = t.mock.method(reporteValidator, 'validateVentas', query => validar(query));
            const body = await request(1, '?mes=2000-02');
            assert.equal(mock.mock.callCount(), 1);
            assert.deepEqual(body.data.periodo, validar({ mes: '2000-02' }).data.periodo);
            mock.mock.restore();
        });
        await t.test('Vacío 200, ceros, paginación y auditoría mínima aun sin filas', async () => {
            const body = await request();
            assert.deepEqual(body.paginacion, { pagina: 1, limite: 25, total: 0, totalPaginas: 0 });
            assert.deepEqual(body.data.detalle, []);
            for (const nombre of ['confirmadas', 'pendientes', 'anuladasConfirmadas', 'anuladasSinConfirmar']) {
                assert.deepEqual(body.data.resumen[nombre], { cantidad: 0, importe: '0.00' });
            }
            const evento = eventos.at(-1);
            assert.equal(evento.tipo_evento, 'REPORTE_VENTAS_CONSULTAR');
            assert.equal(evento.modulo, 'REPORTES');
            assert.equal(evento.accion, 'CONSULTAR_VENTAS');
            assert.equal(evento.id_usuario_responsable, 1);
            assert.deepEqual(evento.metadatos, { cantidadResultados: 0 });
            for (const campo of ['antes', 'despues', 'referencias', 'tipo_registro', 'id_registro']) assert.equal(evento[campo], null);
        });
        await t.test('Cuatro categorías y ejes civiles inclusivos, sin duplicar cabeceras con igual importe', async () => {
            filas = [
                fila(1, 'CONFIRMADA', '2026-11-10 00:00:00', '2026-10-01 08:00:00'),
                fila(2, 'CONFIRMADA', '2026-11-10 23:59:59.999999', '2026-10-01 08:00:00'),
                fila(3, 'PENDIENTE', null, '2026-11-10 12:00:00', '0.10'),
                fila(4, 'ANULADA', '2026-11-10 12:00:00', '2026-10-01 08:00:00', '0.20'),
                fila(5, 'ANULADA', null, '2026-11-10 12:00:00', '0.30'),
                fila(6, 'CONFIRMADA', '2026-11-09 23:59:59.999999', '2026-11-10 12:00:00'),
                fila(7, 'CONFIRMADA', '2026-11-11 00:00:00', '2026-11-10 12:00:00'),
                fila(8, 'ANULADA', null, '2026-11-09 23:59:59.999999'),
                fila(9, 'PENDIENTE', null, '2026-11-11 00:00:00')
            ];
            const body = await request(1, '?dia=2026-11-10&limite=2');
            assert.deepEqual(body.data.resumen, {
                confirmadas: { cantidad: 2, importe: '31.00' }, pendientes: { cantidad: 1, importe: '0.10' },
                anuladasConfirmadas: { cantidad: 1, importe: '0.20' }, anuladasSinConfirmar: { cantidad: 1, importe: '0.30' },
                totalVentasRealizadas: '31.00'
            });
            assert.deepEqual(body.paginacion, { pagina: 1, limite: 2, total: 5, totalPaginas: 3 });
            assert.deepEqual(body.data.detalle.map(r => r.idVenta), [2, 5]);
            assert.equal(body.data.detalle[1].fechaVenta, null);
            assert.equal(body.data.detalle[1].categoria, 'ANULADA_SIN_CONFIRMAR');
            assert.equal(body.data.detalle[0].fechaReferencia, '2026-11-10 23:59:59');
            assert.deepEqual(Object.keys(body.data.detalle[0]).sort(), ['idVenta', 'estadoOperacion', 'categoria',
                'fechaReferencia', 'fechaRegistro', 'fechaVenta', 'fechaAnulacion', 'total'].sort());
            const pagina2 = await request(1, '?dia=2026-11-10&limite=2&pagina=2');
            assert.deepEqual(pagina2.data.detalle.map(r => r.idVenta), [4, 3]);
            assert.deepEqual(pagina2.data.resumen, body.data.resumen);
            const lejana = await request(1, '?dia=2026-11-10&pagina=2147483647&limite=100');
            assert.deepEqual(lejana.data.detalle, []);
            assert.equal(lejana.paginacion.pagina, 2147483647);
            assert.deepEqual(lejana.data.resumen, body.data.resumen);
            for (const estado of ['CONFIRMADA', 'PENDIENTE', 'ANULADA']) {
                const filtrado = await request(1, `?dia=2026-11-10&estadoOperacion=${estado}`);
                assert.ok(filtrado.data.detalle.every(r => r.estadoOperacion === estado));
                assert.equal(filtrado.paginacion.total, estado === 'PENDIENTE' ? 1 : 2);
                if (estado !== 'CONFIRMADA') assert.equal(filtrado.data.resumen.totalVentasRealizadas, '0.00');
                if (estado === 'ANULADA') assert.deepEqual(filtrado.data.detalle.map(r => r.categoria),
                    ['ANULADA_SIN_CONFIRMAR', 'ANULADA_CONFIRMADA']);
            }
        });
        await t.test('Sumas grandes superiores a precisión Number, sin límite artificial DECIMAL(14,2)', async () => {
            filas = Array.from({ length: 10001 }, (_, id) => fila(id + 1, 'CONFIRMADA',
                '2026-11-10 12:00:00', '2026-11-01 08:00:00', '999999999999.99'));
            const body = await request(1, '?dia=2026-11-10&limite=1');
            assert.equal(body.data.resumen.confirmadas.importe, '10000999999999899.99');
            assert.equal(body.data.detalle[0].total, '999999999999.99');
            assert.equal(body.paginacion.total, 10001);
        });
        await t.test('Coordinación de snapshot común ante cambio intercalado simulado', async () => {
            filas = [fila(1, 'CONFIRMADA', '2026-11-10 12:00:00', '2026-11-01 08:00:00')];
            intercalar = () => { filas[0].estado_operacion = 'ANULADA'; };
            const body = await request();
            assert.equal(body.data.resumen.confirmadas.cantidad, 1);
            assert.equal(body.data.detalle[0].estadoOperacion, 'CONFIRMADA');
            const siguiente = await request();
            assert.equal(siguiente.data.resumen.anuladasConfirmadas.cantidad, 1);
            assert.equal(siguiente.data.detalle[0].estadoOperacion, 'ANULADA');
        });
        await t.test('Extremos civiles/futuros conservan normalización y no inventan confirmación', async () => {
            filas = [fila(1, 'PENDIENTE', null, '9999-12-31 00:00:00', '0.00')];
            const body = await request(1, '?dia=9999-12-31');
            assert.equal(body.data.periodo.hasta, '9999-12-31');
            assert.equal(body.data.detalle[0].fechaVenta, null);
            assert.equal(body.data.resumen.pendientes.importe, '0.00');
            assert.equal(body.paginacion.total, 1);
            const amplio = await request(1, '?desde=1000-01-01&hasta=9999-12-31');
            assert.equal(amplio.paginacion.total, 1);
        });
        await t.test('Fallo de materialización revierte lectura y no emite éxito', async () => {
            conteoInvalido = true;
            try {
                assert.deepEqual(await request(1, '?dia=2026-11-10', 500), { message: 'Error interno del servidor' });
                assert.equal(snapshotActivo, false);
                assert.equal(eventos.at(-1).tipo_evento, 'ERROR_TECNICO');
            } finally { conteoInvalido = false; }
        });
        await t.test('Errores técnicos seguros, auditor independiente, sin reintento ni recursión', async () => {
            falloAuditor = true;
            await request();
            assert.equal(eventos.at(-1).tipo_evento, 'REPORTE_VENTAS_CONSULTAR');
            await request(null, '', 401);
            await request(2, '', 403);
            await request(1, '', 400);
            falloConsulta = true;
            assert.deepEqual(await request(1, '?dia=2026-11-10', 500), { message: 'Error interno del servidor' });
            assert.equal(eventos.at(-1).tipo_evento, 'ERROR_TECNICO');
            assert.equal(eventos.at(-1).metadatos.operacionOrigen, 'REPORTES.CONSULTAR_VENTAS');
            assert.ok(diagnosticos.some(d => d.categoria === 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA'));
            const propiosAuditor = diagnosticos.filter(d => d.categoria === 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA');
            assert.doesNotMatch(JSON.stringify(propiosAuditor), /privado|sql|credencial/i);
            falloAuditor = false;
            await request(1, '?dia=2026-11-10', 500);
        });
        for (const evento of eventos.filter(e => e.resultado !== 'EXITO')) {
            assert.equal(evento.metadatos.operacionOrigen, 'REPORTES.CONSULTAR_VENTAS');
        }
        for (const ruta of ['/perdidas']) {
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reportes${ruta}`);
            assert.equal(response.status, 401, 'CU41 completo y protegido');
        }
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('CU38: SQL Sequelize generado, transporte interceptado (no ejecución MySQL)', async t => {
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
        const filtros = reporteValidator.validateVentas(query).data;
        await reporteRepository.consultarVentas(filtros, { transaction });
        const [agregado, detalle] = queries.slice(-2);
        for (const sql of [agregado, detalle]) {
            assert.match(sql, /^SELECT /);
            assert.match(sql, /FROM `venta` AS `Venta`/);
            assert.match(sql, /fecha_venta` IS NOT NULL/);
            assert.match(sql, /fecha_venta` IS NULL/);
            assert.ok(sql.includes(`STR_TO_DATE('${filtros.desdeFechaHora}'`));
            assert.ok(sql.includes(`STR_TO_DATE('${filtros.hastaFechaHora}'`));
            assert.doesNotMatch(sql, /JOIN|DISTINCT|FOR UPDATE|paciente|receta|usuario|clave_operacion|motivo_anulacion/i);
        }
        assert.match(agregado, /COUNT\(`id_venta`\)/);
        assert.match(agregado, /CAST\(SUM\(`total`\) AS CHAR\)/);
        assert.doesNotMatch(agregado, /LIMIT/);
        assert.match(detalle, /ORDER BY CASE[\s\S]+END DESC, `Venta`.`id_venta` DESC LIMIT/);
        assert.equal(agregado.split(' WHERE ')[1].split(' GROUP BY ')[0], detalle.split(' WHERE ')[1].split(' ORDER BY ')[0]);
        if (query.estadoOperacion) assert.match(agregado, /`Venta`.`estado_operacion` = 'ANULADA'/);
    }
    assert.match(queries.at(-1), /LIMIT 1, 1/);
});

test('CU38: catálogo, clasificador HEAD/caja/slash y allowlist de metadatos', () => {
    assert.deepEqual(CATALOGO_AUDITORIA.REPORTE_VENTAS_CONSULTAR,
        { modulo: 'REPORTES', accion: 'CONSULTAR_VENTAS', perfil: null, transaccionExito: false });
    for (const metodo of ['GET', 'HEAD']) for (const path of ['/api/reportes/ventas', '/API/REPORTES/VENTAS/']) {
        assert.equal(identificarOperacionAuditoria(metodo, path), 'REPORTES.CONSULTAR_VENTAS');
    }
    assert.equal(identificarOperacionAuditoria('GET', '/api/reportes/compras'), 'REPORTES.CONSULTAR_COMPRAS');
    const evento = prepararEventoAuditoria({ tipoEvento: 'REPORTE_VENTAS_CONSULTAR', resultado: 'EXITO',
        responsable: { idUsuario: 1, idRol: 1, nombreUsuario: 'admin' },
        contexto: { correlacion: 'a'.repeat(32), direccionIp: null, procedenciaIp: 'NO_DISPONIBLE' },
        metadatos: { cantidadResultados: 100, query: 'privado', total: '999.99', detalle: ['privado'] },
        antes: { nombrePaciente: 'privado' }, despues: { total: '999.99' } });
    assert.deepEqual(evento.metadatos, { cantidadResultados: 100 });
    assert.equal(evento.antes, null);
    assert.equal(evento.despues, null);
});
