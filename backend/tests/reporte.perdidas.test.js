import test from 'node:test';
import assert from 'node:assert/strict';

// Fixtures evaluados en JS y SQL interceptado: NO acreditan ejecución MySQL.
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'reportes_perdidas_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_reportes_perdidas_tests';
const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { authService } = await import('../src/business/services/auth.service.js');
const { reporteRepository } = await import('../src/data/repositories/reporte.repository.js');
const { reporteValidator } = await import('../src/business/validators/reporte.validator.js');
const { bitacoraAuditoriaRepository } = await import('../src/data/repositories/bitacora-auditoria.repository.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const { decimalAEntero, enteroADecimal, dividirYRedondear } = await import('../src/shared/utils/decimal.js');
const { identificarOperacionAuditoria } = await import('../src/shared/constants/auditoria-operaciones.js');
const { CATALOGO_AUDITORIA } = await import('../src/shared/constants/auditoria.js');
const { prepararEventoAuditoria } = await import('../src/business/validators/auditoria.validator.js');
const { Op } = db.Sequelize;
const fila = (id, motivo = 'VENCIMIENTO', fecha = '2026-11-10 12:00:00', cantidad = 1, costo = '0.005000') => ({
    id_movimiento: id, id_existencia: 7, id_medicamento: 3, id_usuario: 2,
    codigo_existencia: 'MED003-001', codigo_medicamento: 'MED003', nombre_comercial: 'Producto',
    motivo, fecha_movimiento: fecha, cantidad, costo_unitario_aplicado: costo,
    direccion: 'SALIDA', id_movimiento_original: null,
    existencia: { cantidad_fisica: 0, costo_unitario_promedio: '999.000000', fecha_vencimiento: '2020-01-01',
        medicamento: { estado: false, composiciones: [1, 2, 3] } },
    observacion: 'privado', usuario: { password_hash: 'privado', nombre_usuario: 'privado' }
});
const cumple = (row, where) => Reflect.ownKeys(where).every(key => {
    const valor = where[key];
    if (valor === null || typeof valor !== 'object') return row[key] === valor;
    return Reflect.ownKeys(valor).every(op => {
        if (op === Op.in) return valor[op].includes(row[key]);
        const fecha = valor[op].args[0];
        return op === Op.gte ? row[key] >= fecha : row[key] <= fecha;
    });
});
const centavos = row => dividirYRedondear(BigInt(row.cantidad) * decimalAEntero(row.costo_unitario_aplicado, 6), 10000n);

test('CU41: HTTP/capas, pérdidas históricas y snapshot simulados sin MySQL', async t => {
    let filas = [], activo = false, intercalar, falloConsulta = false, falloAuditor = false, grupoForzado;
    const lecturas = [], eventos = [], diagnosticos = [];
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('MySQL prohibido'); });
    t.mock.method(console, 'error', dato => diagnosticos.push(dato));
    t.mock.method(authService, 'getSessionUsuario', async id => ({ idUsuario: id, idRol: id, nombreUsuario: `actor${id}` }));
    t.mock.method(db.sequelize, 'transaction', async (options, callback) => {
        if (typeof options === 'function') {
            assert.equal(activo, false);
            return options({ auditor: true });
        }
        assert.equal(options.isolationLevel, db.Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ);
        const transaction = { snapshot: structuredClone(filas) };
        activo = true;
        try { return await callback(transaction); } finally { activo = false; }
    });
    t.mock.method(bitacoraAuditoriaRepository, 'create', async ({ data, transaction }) => {
        assert.equal(activo, false);
        assert.equal(transaction.auditor, true);
        eventos.push(data);
        if (falloAuditor) throw new Error('privado_sql_credencial');
        return eventos.length;
    });
    t.mock.method(db.MovimientoInventario, 'findAll', async options => {
        assert.equal(activo, true);
        assert.equal(options.lock, undefined);
        lecturas.push(options);
        if (falloConsulta) throw new Error('privado_sql_credencial');
        const seleccion = options.transaction.snapshot.filter(row => cumple(row, options.where));
        if (options.group) {
            assert.equal(options.include, undefined);
            if (grupoForzado) return [grupoForzado];
            const grupos = new Map();
            for (const row of seleccion) {
                const grupo = grupos.get(row.motivo) ?? { motivo: row.motivo, retiros: 0, unidades: 0n, perdida: 0n };
                grupo.retiros++;
                grupo.unidades += BigInt(row.cantidad);
                grupo.perdida += centavos(row);
                grupos.set(row.motivo, grupo);
            }
            if (intercalar) { intercalar(); intercalar = undefined; }
            return [...grupos.values()].map(g => ({ motivo: g.motivo, cantidad_retiros: String(g.retiros),
                cantidad_retirada: g.unidades.toString(), perdida: enteroADecimal(g.perdida, 2) }));
        }
        assert.equal(options.where, lecturas.at(-2).where);
        assert.equal(options.transaction, lecturas.at(-2).transaction);
        return seleccion.sort((a, b) => b.fecha_movimiento.localeCompare(a.fecha_movimiento) || b.id_movimiento - a.id_movimiento)
            .slice(options.offset, options.offset + options.limit).map(row => ({ ...row,
                fecha_movimiento: row.fecha_movimiento.slice(0, 19),
                id_movimiento_reversion: options.transaction.snapshot.find(r => r.id_movimiento_original === row.id_movimiento)?.id_movimiento ?? null }));
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const request = async (rol = 1, query = '?dia=2026-11-10', status = 200, invalido = false) => {
        const antes = eventos.length;
        const token = invalido ? 'invalido' : rol ? generarToken({ idUsuario: rol, idRol: rol, versionCredenciales: 0 }) : null;
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reportes/perdidas${query}`, {
            headers: token ? { Cookie: `token=${token}` } : {}, signal: AbortSignal.timeout(10000) });
        const body = await response.json();
        assert.equal(response.status, status, JSON.stringify(body));
        assert.equal(eventos.length, antes + 1, 'Una captura por solicitud');
        assert.doesNotMatch(JSON.stringify(body), /privado|password|observacion|costoUnitarioPromedio|stack|SELECT/i);
        return body;
    };
    try {
        await t.test('401 sin sesión/token inválido, 403 Vendedor, 200 Administrador/Regente', async () => {
            await request(null, '', 401);
            assert.equal(eventos.at(-1).tipo_evento, 'SESION_AUSENTE');
            await request(1, '', 401, true);
            assert.equal(eventos.at(-1).tipo_evento, 'TOKEN_INVALIDO');
            await request(3, '', 403);
            assert.equal(eventos.at(-1).causa, 'ROL_NO_PERMITIDO');
            assert.equal(lecturas.length, 0);
            await request(1);
            await request(2);
        });
        await t.test('400 estricto y normalización temporal reutilizada', async () => {
            const antes = lecturas.length;
            for (const query of ['', '?dia=2026-02-30', '?dia=1900-02-29', '?dia=0999-12-31',
                '?dia=2026-11-10&dia=2026-11-10', '?mes=2026-11&desde=2026-11-01',
                '?desde=2026-11-10', '?desde=2026-11-11&hasta=2026-11-10', '?dia=2026-11-10&limite=101',
                '?dia=2026-11-10&estadoOperacion=ANULADA', '?dia=2026-11-10&motivo=AJUSTE', '?dia=2026-11-10&idMedicamento=3']) {
                const body = await request(1, query, 400);
                assert.equal(body.message, 'Datos inválidos');
                assert.ok(body.errors.length);
                assert.equal(eventos.at(-1).tipo_evento, 'VALIDACION_RECHAZADA');
            }
            assert.equal(lecturas.length, antes);
            const validar = reporteValidator.validatePerdidas;
            const mock = t.mock.method(reporteValidator, 'validatePerdidas', query => validar(query));
            const body = await request(2, '?mes=2000-02');
            assert.equal(mock.mock.callCount(), 1);
            assert.deepEqual(body.data.periodo, validar({ mes: '2000-02' }).data.periodo);
            assert.equal(lecturas.at(-1).where.fecha_movimiento[Op.lte].args[0], '2000-02-29 23:59:59.999999');
            mock.mock.restore();
        });
        await t.test('Vacíos, ceros y auditoría mínima sin snapshots ni lista', async () => {
            const body = await request();
            assert.deepEqual(body.data.resumen, { vencimiento: { cantidadRetiros: 0, cantidadRetirada: '0', perdida: '0.00' },
                dano: { cantidadRetiros: 0, cantidadRetirada: '0', perdida: '0.00' },
                cantidadRetiros: 0, cantidadRetirada: '0', perdidaTotal: '0.00' });
            assert.deepEqual(body.data.detalle, []);
            assert.deepEqual(body.paginacion, { pagina: 1, limite: 25, total: 0, totalPaginas: 0 });
            const evento = eventos.at(-1);
            assert.equal(evento.tipo_evento, 'REPORTE_PERDIDAS_CONSULTAR');
            assert.equal(evento.modulo, 'REPORTES');
            assert.equal(evento.accion, 'CONSULTAR_PERDIDAS');
            assert.deepEqual(evento.metadatos, { cantidadResultados: 0 });
            for (const campo of ['antes', 'despues', 'referencias', 'tipo_registro', 'id_registro']) assert.equal(evento[campo], null);
        });
        await t.test('Originales brutos, límites inclusivos, motivos separados, reversiones y categorías ajenas', async () => {
            filas = [fila(1, 'VENCIMIENTO', '2026-11-10 00:00:00'), fila(2, 'VENCIMIENTO', '2026-11-10 23:59:59.999999'),
                fila(3, 'DAÑO', '2026-11-10 12:00:00', 2, '1.500000'),
                fila(4, 'AJUSTE'), fila(5, 'VENTA'), fila(6, 'ANULACION_COMPRA'), fila(7, 'otro'),
                { ...fila(8), direccion: 'ENTRADA' }, fila(9, 'DAÑO', '2026-11-09 23:59:59.999999'),
                fila(10, 'DAÑO', '2026-11-11 00:00:00'),
                { ...fila(11), direccion: 'ENTRADA', id_movimiento_original: 1 },
                { ...fila(12, 'ANULACION_VENTA', '2027-01-01 00:00:00'), id_movimiento_original: 2 },
                { ...fila(13), id_movimiento_original: 99 }];
            const body = await request(2, '?dia=2026-11-10&limite=2');
            assert.deepEqual(body.data.resumen, { vencimiento: { cantidadRetiros: 2, cantidadRetirada: '2', perdida: '0.02' },
                dano: { cantidadRetiros: 1, cantidadRetirada: '2', perdida: '3.00' },
                cantidadRetiros: 3, cantidadRetirada: '4', perdidaTotal: '3.02' });
            assert.deepEqual(body.paginacion, { pagina: 1, limite: 2, total: 3, totalPaginas: 2 });
            assert.deepEqual(body.data.detalle.map(r => r.idMovimiento), [2, 3]);
            assert.deepEqual(body.data.detalle[0], { idMovimiento: 2, idExistencia: 7, idMedicamento: 3,
                codigoExistencia: 'MED003-001', codigoMedicamento: 'MED003', nombreComercial: 'Producto', idUsuario: 2,
                motivo: 'VENCIMIENTO', fechaReferencia: '2026-11-10 23:59:59', fechaMovimiento: '2026-11-10 23:59:59',
                cantidad: 1, costoUnitarioAplicado: '0.005000', perdida: '0.01', idMovimientoReversion: 12 });
            assert.equal(body.data.detalle[1].idMovimientoReversion, null);
            assert.deepEqual(eventos.at(-1).metadatos, { cantidadResultados: 2 });
            const pagina2 = await request(1, '?dia=2026-11-10&limite=2&pagina=2');
            assert.equal(pagina2.data.detalle[0].idMovimientoReversion, 11);
            assert.deepEqual(pagina2.data.resumen, body.data.resumen);
            const lejana = await request(1, '?dia=2026-11-10&pagina=2147483647&limite=100');
            assert.deepEqual(lejana.data.detalle, []);
            assert.equal(lejana.paginacion.pagina, 2147483647);
            assert.deepEqual(lejana.data.resumen, body.data.resumen);
            for (const motivo of ['VENCIMIENTO', 'DAÑO']) {
                const filtrado = await request(1, `?dia=2026-11-10&motivo=${encodeURIComponent(motivo)}`);
                assert.ok(filtrado.data.detalle.every(r => r.motivo === motivo));
                assert.deepEqual(filtrado.data.resumen[motivo === 'DAÑO' ? 'vencimiento' : 'dano'],
                    { cantidadRetiros: 0, cantidadRetirada: '0', perdida: '0.00' });
            }
        });
        await t.test('Costo cero, costo histórico, extremos y cantidad agregada más allá de Number seguro', async () => {
            filas = [fila(1, 'DAÑO', undefined, 2147483647, '0.000000'), fila(2, 'DAÑO', undefined, 2147483647, '99999999.999999')];
            const body = await request();
            assert.equal(body.data.detalle[1].perdida, '0.00');
            assert.equal(body.data.detalle[0].perdida, '214748364699997852.52');
            assert.equal(body.data.resumen.cantidadRetirada, '4294967294');
            assert.equal(body.data.resumen.perdidaTotal, '214748364699997852.52');
            grupoForzado = { motivo: 'DAÑO', cantidad_retiros: '5000000', cantidad_retirada: '10737418235000000',
                perdida: '1073741823499989262600.00' };
            const grande = await request();
            assert.equal(grande.data.resumen.cantidadRetirada, grupoForzado.cantidad_retirada);
            assert.equal(grande.data.resumen.perdidaTotal, grupoForzado.perdida);
            grupoForzado = undefined;
        });
        await t.test('Snapshot común incluye referencia de reversión ante cambio intercalado simulado', async () => {
            filas = [fila(1)];
            intercalar = () => filas.push({ ...fila(2), id_movimiento_original: 1 });
            const body = await request();
            assert.equal(body.data.detalle[0].idMovimientoReversion, null);
            const siguiente = await request();
            assert.equal(siguiente.data.detalle[0].idMovimientoReversion, 2);
            assert.deepEqual(siguiente.data.resumen, body.data.resumen);
        });
        await t.test('Día, mes, período, bisiesto, futuros y años extremos sin recorte', async () => {
            filas = [fila(1, 'DAÑO', '1000-01-01 00:00:00'), fila(2, 'DAÑO', '9999-12-31 23:59:59.999999'),
                fila(3, 'DAÑO', '2000-02-29 12:00:00')];
            for (const dia of ['1000-01-01', '9999-12-31', '2000-02-29']) {
                assert.equal((await request(1, `?dia=${dia}`)).paginacion.total, 1);
            }
            assert.equal((await request(1, '?mes=9999-12')).paginacion.total, 1);
            assert.equal((await request(1, '?mes=2000-02')).paginacion.total, 1);
            assert.equal((await request(1, '?desde=1000-01-01&hasta=9999-12-31')).paginacion.total, 3);
        });
        await t.test('Materialización inválida y errores técnicos seguros; auditor independiente sin recursión', async () => {
            grupoForzado = { motivo: 'DAÑO', cantidad_retiros: '9007199254740992', cantidad_retirada: '0', perdida: '0.00' };
            assert.deepEqual(await request(1, '?dia=2026-11-10', 500), { message: 'Error interno del servidor' });
            assert.equal(eventos.at(-1).tipo_evento, 'ERROR_TECNICO');
            grupoForzado = undefined;
            filas = [{ ...fila(1), costo_unitario_aplicado: 'invalido' }];
            // Aislar el fallo de materialización del detalle del agregado simulado.
            grupoForzado = { motivo: 'VENCIMIENTO', cantidad_retiros: '1', cantidad_retirada: '1', perdida: '0.01' };
            assert.deepEqual(await request(1, '?dia=2026-11-10', 500), { message: 'Error interno del servidor' });
            assert.equal(activo, false);
            assert.equal(eventos.at(-1).tipo_evento, 'ERROR_TECNICO');
            grupoForzado = undefined;
            filas = [];
            falloAuditor = true;
            await request();
            assert.equal(eventos.at(-1).tipo_evento, 'REPORTE_PERDIDAS_CONSULTAR');
            await request(null, '', 401);
            await request(3, '', 403);
            await request(1, '', 400);
            falloConsulta = true;
            assert.deepEqual(await request(1, '?dia=2026-11-10', 500), { message: 'Error interno del servidor' });
            assert.equal(eventos.at(-1).tipo_evento, 'ERROR_TECNICO');
            const propios = diagnosticos.filter(d => d.categoria === 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA');
            assert.equal(propios.length, 5);
            assert.doesNotMatch(JSON.stringify(propios), /privado|sql|credencial/i);
        });
        for (const evento of eventos.filter(e => e.resultado !== 'EXITO')) {
            assert.equal(evento.metadatos.operacionOrigen, 'REPORTES.CONSULTAR_PERDIDAS');
        }
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('CU41: SQL generado por Sequelize, transporte interceptado sin motor MySQL', async t => {
    const queries = [];
    const transaction = new db.Sequelize.Transaction(db.sequelize, {});
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('MySQL prohibido'); });
    t.mock.method(db.sequelize, 'query', async (sql, options) => {
        assert.equal(options.transaction, transaction);
        queries.push(sql);
        return [];
    });
    for (const query of [{ dia: '2026-11-10' }, { mes: '2000-02', motivo: 'DAÑO' },
        { desde: '1000-01-01', hasta: '9999-12-31', pagina: '2', limite: '1' }]) {
        const filtros = reporteValidator.validatePerdidas(query).data;
        await reporteRepository.consultarPerdidas(filtros, { transaction });
        const [agregado, detalle] = queries.slice(-2);
        for (const sql of [agregado, detalle]) {
            assert.match(sql, /^SELECT /);
            assert.match(sql, /`MovimientoInventario`.`direccion` = 'SALIDA'/);
            assert.match(sql, /`MovimientoInventario`.`id_movimiento_original` IS NULL/);
            assert.ok(sql.includes(`STR_TO_DATE('${filtros.desdeFechaHora}'`));
            assert.ok(sql.includes(`STR_TO_DATE('${filtros.hastaFechaHora}'`));
            assert.doesNotMatch(sql, /DISTINCT|FOR UPDATE|password|observacion|costo_unitario_promedio|cantidad_fisica|fecha_vencimiento|`estado`|JOIN `usuario`/i);
            if (query.motivo) assert.match(sql, /`MovimientoInventario`.`motivo` = 'DAÑO'/);
            else assert.match(sql, /`MovimientoInventario`.`motivo` IN \('VENCIMIENTO', 'DAÑO'\)/);
        }
        assert.match(agregado, /COUNT\(`id_movimiento`\)/);
        assert.match(agregado, /CAST\(SUM\(`cantidad`\) AS CHAR\)/);
        assert.match(agregado, /CAST\(SUM\(ROUND\(CAST\(`MovimientoInventario`.`cantidad` AS DECIMAL\(10,0\)\) \* `MovimientoInventario`.`costo_unitario_aplicado`, 2\)\) AS CHAR\)/);
        assert.doesNotMatch(agregado, /JOIN|LIMIT/);
        assert.match(detalle, /LEFT OUTER JOIN `existencia_medicamento`/);
        assert.match(detalle, /LEFT OUTER JOIN `medicamento`/);
        assert.match(detalle, /LEFT OUTER JOIN `movimiento_inventario` AS `movimientoReversion` ON `MovimientoInventario`.`id_movimiento` = `movimientoReversion`.`id_movimiento_original`/);
        assert.doesNotMatch(detalle, /`movimientoReversion`.`fecha_movimiento`/);
        assert.match(detalle, /ORDER BY `MovimientoInventario`.`fecha_movimiento` DESC, `MovimientoInventario`.`id_movimiento` DESC LIMIT/);
        assert.equal(agregado.split(' WHERE ')[1].split(' GROUP BY ')[0], detalle.split(' WHERE ')[1].split(' ORDER BY ')[0]);
    }
    assert.equal(queries.length, 6);
    assert.match(queries.at(-1), /LIMIT 1, 1/);
});

test('CU41: equivalencia matemática ROUND exacto no negativo y redondeo BigInt (no prueba SQL)', () => {
    // ROUND(x,2) exacto para x>=0: floor(x*100 + 1/2).
    for (const cantidad of [1n, 2n, 99n, 2147483647n]) {
        for (const costo of ['0.000000', '0.004999', '0.005000', '0.005001', '0.015000', '99999999.999999']) {
            const millonesimas = cantidad * decimalAEntero(costo, 6);
            const roundExacto = (millonesimas + 5000n) / 10000n;
            assert.equal(roundExacto, dividirYRedondear(millonesimas, 10000n));
        }
    }
    assert.equal(enteroADecimal(centavos(fila(1)) + centavos(fila(2)), 2), '0.02');
});

test('CU41: catálogo/clasificación y allowlist de auditoría', () => {
    assert.deepEqual(CATALOGO_AUDITORIA.REPORTE_PERDIDAS_CONSULTAR,
        { modulo: 'REPORTES', accion: 'CONSULTAR_PERDIDAS', perfil: null, transaccionExito: false });
    for (const metodo of ['GET', 'HEAD']) for (const path of ['/api/reportes/perdidas', '/API/REPORTES/PERDIDAS/']) {
        assert.equal(identificarOperacionAuditoria(metodo, path), 'REPORTES.CONSULTAR_PERDIDAS');
    }
    const evento = prepararEventoAuditoria({ tipoEvento: 'REPORTE_PERDIDAS_CONSULTAR', resultado: 'EXITO',
        responsable: { idUsuario: 1, idRol: 1, nombreUsuario: 'admin' },
        contexto: { correlacion: 'a'.repeat(32), direccionIp: null, procedenciaIp: 'NO_DISPONIBLE' },
        metadatos: { cantidadResultados: 100, query: 'privado', perdidaTotal: '999.99', detalle: ['privado'] },
        antes: { usuario: 'privado' }, despues: { costo: '999.99' } });
    assert.deepEqual(evento.metadatos, { cantidadResultados: 100 });
    assert.equal(evento.antes, null);
    assert.equal(evento.despues, null);
});
