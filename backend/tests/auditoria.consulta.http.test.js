import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

// HTTP, autorización, validación, Repository, SQL y transacciones Sequelize
// reales. Solo transporte y almacenamiento simulados, sin conexión MySQL.
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'auditoria_cu42_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_cu42';
const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const { prepararEventoAuditoria } = await import('../src/business/validators/auditoria.validator.js');
const { crearContextoAuditoriaConexion } = await import('../src/shared/utils/auditoria-contexto.js');

test('CU42: filtros, páginas, historial y autorización HTTP con SQL simulado', async t => {
    const responsable = { idUsuario: 1, idRol: 1, nombreUsuario: 'adminHistorico' };
    const objetivo = { idUsuario: 4, idRol: 3, nombreUsuario: 'objetivoHistorico' };
    const fecha = new Date('2026-10-13T12:34:56.789Z');
    const semilla = (idEvento, cambios = {}) => ({ id_evento: idEvento,
        ...prepararEventoAuditoria({ contexto: crearContextoAuditoriaConexion('192.0.2.1'),
            tipoEvento: 'LOGIN_PASSWORD_INCORRECTA', resultado: 'RECHAZADO', causa: 'PASSWORD_INCORRECTA',
            cuentaObjetivo: objetivo, nombreIngresado: 'objetivoHistorico', registro: { tipo: 'USUARIO', id: 4 },
            metadatos: { intentosFallidos: 1, efecto: 'CONFIRMADO' }, ...cambios }, fecha) });
    const inicial = [semilla(1), semilla(2, { tipoEvento: 'LOGIN_BLOQUEO_GENERADO', resultado: 'EXITO', causa: 'BLOQUEO_GENERADO',
        metadatos: { intentosFallidos: 3, bloqueadoDesde: fecha.toISOString(),
            bloqueadoHasta: new Date(fecha.getTime() + 600000).toISOString(), duracionMinutos: 10 } }),
    semilla(3, { tipoEvento: 'USUARIO_MODIFICAR', resultado: 'EXITO', causa: null, responsable,
        antes: { nombreUsuario: 'anterior', estado: true }, despues: { nombreUsuario: 'nuevo', estado: false },
        referencias: [{ tipo: 'USUARIO', id: 4 }], metadatos: { camposModificados: ['nombreUsuario', 'estado'] } }),
    ...Array.from({ length: 28 }, (_, i) => semilla(i + 4))];
    let eventos, usuarios, id = 100, falloLectura, falloAuditoria, conexionCaida, commitPerdido, despuesPagina;
    const pendientes = new Map(), consultas = [], logs = [];
    const reset = () => {
        eventos = structuredClone(inicial);
        usuarios = [1, 2, 3].map(id => ({ id_usuario: id, id_rol: id, nombre_usuario: `actual${id}`,
            estado: true, version_credenciales: 0 }));
        pendientes.clear(); consultas.length = 0; logs.length = 0;
        falloLectura = undefined; falloAuditoria = false; conexionCaida = false; commitPerdido = false; despuesPagina = undefined;
    };
    reset();
    const privado = 'dato_sintetico_password_token_sql_no_exponer';
    const errorTecnico = () => Object.assign(new Error(privado), {
        name: 'SequelizeDatabaseError', sql: privado, parameters: { password: privado, token: privado } });
    t.mock.method(console, 'error', log => logs.push(log));
    t.mock.method(console, 'warn', () => {});
    t.mock.method(db.sequelize.connectionManager, 'getConnection', async () => {
        if (conexionCaida) throw Object.assign(new Error(privado), { name: 'SequelizeConnectionRefusedError' });
        return { uuid: 'conexion_sintetica' };
    });
    t.mock.method(db.sequelize.connectionManager, 'releaseConnection', async () => {});
    t.mock.method(db.sequelize.connectionManager, 'destroyConnection', async () => {});
    // QueryGenerator convierte options.where en SQL. Capturar las condiciones
    // antes de esa conversión, conservando el generador y los modelos reales.
    let condiciones;
    for (const metodo of ['findAll', 'count']) {
        const original = db.BitacoraAuditoria[metodo];
        t.mock.method(db.BitacoraAuditoria, metodo, function (options) {
            condiciones = { ...options.where };
            return original.call(this, options);
        });
    }
    const originalDetalle = db.BitacoraAuditoria.findByPk;
    t.mock.method(db.BitacoraAuditoria, 'findByPk', function (id, options) {
        condiciones = { id_evento: id };
        return originalDetalle.call(this, id, options);
    });
    const coincide = fila => Object.entries(condiciones).every(([campo, valor]) => fila[campo] === valor) &&
        (condiciones[db.Sequelize.Op.and] ?? []).every(condicion => {
            const valor = fila[condicion.attribute.col];
            return condicion.comparator === db.Sequelize.Op.gte ? valor >= condicion.logic : valor <= condicion.logic;
        });
    const formatearFechas = fila => fila && ({ ...fila,
        fecha_registro: `${fila.fecha_registro}000`, fecha_evento: `${fila.fecha_evento}000` });
    t.mock.method(db.sequelize, 'query', async (input, options = {}) => {
        const sql = typeof input === 'string' ? input : input.query;
        options = { ...options, model: options.model ?? options.instance?.constructor };
        // count usa QueryInterface.rawSelect, que no adjunta options.model.
        if (!options.model && /FROM `bitacora_auditoria`/.test(sql)) options.model = db.BitacoraAuditoria;
        consultas.push({ sql, options });
        const tx = options.transaction?.id;
        if (/^SET /.test(sql)) return [];
        if (/^START TRANSACTION/.test(sql)) {
            pendientes.set(tx, { filas: structuredClone(eventos), escribe: false }); return [];
        }
        if (/^ROLLBACK/.test(sql)) { pendientes.delete(tx); return []; }
        if (/^COMMIT/.test(sql)) {
            const pendiente = pendientes.get(tx);
            if (pendiente.escribe) eventos = pendiente.filas;
            pendientes.delete(tx);
            if (commitPerdido && pendiente.escribe) throw errorTecnico();
            return [];
        }
        if (options.model === db.Usuario) {
            assert.equal(options.type, db.Sequelize.QueryTypes.SELECT);
            const id = Number(sql.match(/`id_usuario` = (\d+)/)[1]);
            const row = usuarios.find(u => u.id_usuario === id);
            return row ? db.Usuario.build(row, { isNewRecord: false, raw: true }) : null;
        }
        assert.ok(options.model === db.BitacoraAuditoria, 'Solo se espera SQL de Bitácora o sesión');
        assert.doesNotMatch(sql, /JOIN|UPDATE |DELETE |DROP /);
        if (options.type === db.Sequelize.QueryTypes.SELECT) {
            const esCount = /count\(/i.test(sql);
            if (falloLectura === 'todos' || falloLectura === (esCount ? 'count' : 'pagina')) throw errorTecnico();
            const filas = (tx ? pendientes.get(tx).filas : eventos).filter(coincide);
            if (esCount) {
                assert.ok(tx); assert.doesNotMatch(sql, /LIMIT|ORDER BY/);
                return { count: String(filas.length) };
            }
            if (options.plain) return structuredClone(formatearFechas(filas[0] ?? null));
            assert.ok(tx); assert.match(sql, /ORDER BY .*`fecha_registro` DESC, .*`id_evento` DESC LIMIT/);
            assert.doesNotMatch(sql, /`antes`|`despues`|`metadatos`|`referencias`/);
            const rows = filas.sort((a, b) => b.fecha_registro.localeCompare(a.fecha_registro) || b.id_evento - a.id_evento)
                .slice(options.offset, options.offset + options.limit);
            const campos = options.attributes.map(attr => Array.isArray(attr) ? attr[1] : attr);
            const resumenes = rows.map(row => Object.fromEntries(campos.map(campo => [campo, row[campo]])));
            if (despuesPagina) despuesPagina();
            return structuredClone(resumenes.map(formatearFechas));
        }
        assert.equal(options.type, db.Sequelize.QueryTypes.INSERT);
        assert.ok(tx);
        if (falloAuditoria) throw errorTecnico();
        const row = Object.fromEntries(Object.entries(options.instance.get({ plain: true }))
            .map(([campo, valor]) => [campo, valor?.fn === 'STR_TO_DATE' ? valor.args[0] : valor]));
        const pendiente = pendientes.get(tx);
        assert.equal(pendiente.filas.some(e => e.tipo_evento === row.tipo_evento && e.correlacion === row.correlacion), false);
        row.id_evento = id++; pendiente.filas.push(row); pendiente.escribe = true;
        options.instance.setDataValue('id_evento', row.id_evento);
        return [options.instance, 1];
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const token = (id = 1, cambios = {}) => generarToken({ idUsuario: id, idRol: id, versionCredenciales: 0, ...cambios });
    const request = async (path = '', status = 200, { auth = token(), method = 'GET', rawPath } = {}) => {
        const response = await fetch(`${base}${rawPath ?? `/api/bitacora${path}`}`, { method,
            headers: auth ? { Cookie: `token=${auth}` } : {}, signal: AbortSignal.timeout(10000) });
        const texto = await response.text();
        const data = texto && response.headers.get('content-type')?.includes('application/json') ? JSON.parse(texto) : texto;
        assert.equal(response.status, status, JSON.stringify(data));
        assert.equal(pendientes.size, 0);
        return { data, response };
    };
    const accesos = tipo => eventos.filter(e => e.tipo_evento === tipo);
    const selectsBitacora = () => consultas.filter(q => q.options.model === db.BitacoraAuditoria && /^SELECT /.test(q.sql));
    try {
        await t.test('Listado predeterminado: orden estable, UTC, resumen y total antes de auditar su propio acceso', async () => {
            reset(); const { data } = await request();
            assert.deepEqual(data.paginacion, { pagina: 1, limite: 25, total: 31, totalPaginas: 2 });
            assert.deepEqual(data.data.map(e => e.idEvento), Array.from({ length: 25 }, (_, i) => 31 - i));
            assert.equal(data.data[0].fechaRegistro, fecha.toISOString());
            assert.equal(data.data[0].fechaEvento, fecha.toISOString());
            for (const row of data.data) for (const campo of ['antes', 'despues', 'metadatos', 'referencias', 'password_hash']) assert.equal(Object.hasOwn(row, campo), false);
            assert.equal(accesos('BITACORA_CONSULTAR').length, 1);
            assert.equal(accesos('BITACORA_CONSULTAR')[0].nombre_usuario_responsable, 'actual1');
            assert.equal(accesos('BITACORA_CONSULTAR')[0].metadatos.cantidadResultados, 25);
            assert.equal(selectsBitacora().length, 2, 'Auditar el acceso no vuelve a consultar la Bitácora');
            const [pagina, count] = selectsBitacora();
            assert.equal(pagina.options.transaction, count.options.transaction);
            assert.equal(pagina.options.transaction.options.isolationLevel, 'REPEATABLE READ');
        });
        await t.test('Filtros combinados e inclusivos: cuenta, responsable, nombre, IP, módulo, acción, evento, resultado y registro', async () => {
            reset();
            const filtros = new URLSearchParams({ desde: '2026-10-13T08:34:56.789-04:00', hasta: fecha.toISOString(),
                idUsuarioResponsable: '1', idUsuarioObjetivo: '4', nombreIngresado: 'objetivoHistorico',
                direccionIp: '::ffff:192.0.2.1', modulo: 'USUARIOS', accion: 'MODIFICAR', tipoEvento: 'USUARIO_MODIFICAR',
                resultado: 'EXITO', tipoRegistro: 'USUARIO', idRegistro: '4', pagina: '1', limite: '100' });
            const { data } = await request(`?${filtros}`);
            assert.equal(data.paginacion.total, 1); assert.equal(data.data[0].idEvento, 3);
            assert.deepEqual(data.data[0].responsable, responsable);
            const sql = selectsBitacora()[0].sql;
            assert.match(sql, /`fecha_registro` >= '2026-10-13 12:34:56.789'/);
            assert.match(sql, /`fecha_registro` <= '2026-10-13 12:34:56.789'/);
            assert.match(sql, /`direccion_ip` = '192.0.2.1'/);
        });
        await t.test('Total de contraseñas incorrectas excluye el evento diferenciado del bloqueo', async () => {
            reset(); const { data } = await request('?tipoEvento=LOGIN_PASSWORD_INCORRECTA&limite=100');
            assert.equal(data.paginacion.total, 29); assert.equal(data.data.length, 29);
            assert.equal(data.data.some(e => e.tipoEvento === 'LOGIN_BLOQUEO_GENERADO'), false);
        });
        await t.test('Paginación conserva filtros; páginas fuera de rango y filtros sin coincidencias son resultados vacíos', async () => {
            reset(); const { data } = await request('?pagina=2&limite=25&tipoEvento=LOGIN_PASSWORD_INCORRECTA');
            assert.equal(data.paginacion.total, 29); assert.equal(data.data.length, 4);
            assert.deepEqual(data.data.map(e => e.idEvento), [6, 5, 4, 1]);
            const fuera = (await request('?pagina=3&limite=25&tipoEvento=LOGIN_PASSWORD_INCORRECTA')).data;
            assert.deepEqual(fuera.data, []); assert.equal(fuera.paginacion.total, 29);
            const vacia = (await request('?nombreIngresado=ausente')).data;
            assert.deepEqual(vacia, { data: [], paginacion: { pagina: 1, limite: 25, total: 0, totalPaginas: 0 } });
        });
        await t.test('Página y count comparten snapshot aunque otro evento se agregue durante la lectura', async () => {
            reset(); despuesPagina = () => { eventos.push(semilla(90)); despuesPagina = undefined; };
            const { data } = await request('?limite=100');
            assert.equal(data.data.length, 31); assert.equal(data.paginacion.total, 31);
            assert.equal(eventos.length, 33, 'Evento concurrente más acceso confirmado');
        });
        await t.test('Detalle conserva identidades, JSON y referencias históricos aunque las cuentas hayan cambiado', async () => {
            reset(); const { data } = await request('/3');
            assert.deepEqual(data.data.responsable, responsable); assert.deepEqual(data.data.cuentaObjetivo, objetivo);
            assert.deepEqual(data.data.antes, { nombreUsuario: 'anterior', estado: true });
            assert.deepEqual(data.data.despues, { nombreUsuario: 'nuevo', estado: false });
            assert.deepEqual(data.data.referencias, [{ tipo: 'USUARIO', id: 4 }]);
            assert.deepEqual(data.data.metadatos, { camposModificados: ['nombreUsuario', 'estado'] });
            assert.equal(selectsBitacora().length, 1);
            assert.equal(accesos('BITACORA_EVENTO_CONSULTAR').length, 1);
            assert.equal(accesos('BITACORA_EVENTO_CONSULTAR')[0].tipo_registro, 'BITACORA');
            assert.equal(accesos('BITACORA_EVENTO_CONSULTAR')[0].id_registro, 3);
        });
        await t.test('Evento inexistente produce 404 después de autorización, con un rechazo y referencia al ID validado', async () => {
            reset(); const { data } = await request('/99', 404);
            assert.deepEqual(data, { message: 'Evento de Bitácora no encontrado' });
            const intento = accesos('BITACORA_EVENTO_CONSULTAR')[0];
            assert.equal(intento.resultado, 'RECHAZADO'); assert.equal(intento.causa, 'NO_ENCONTRADO');
            assert.equal(intento.id_registro, 99); assert.equal(accesos('ERROR_TECNICO').length, 0);
        });
        await t.test('Consulta vacía es 200; fallos de página, count o detalle son 500, nunca lista vacía', async () => {
            reset(); eventos = []; const vacia = (await request()).data;
            assert.deepEqual(vacia, { data: [], paginacion: { pagina: 1, limite: 25, total: 0, totalPaginas: 0 } });
            for (const fallo of ['pagina', 'count', 'todos']) {
                reset(); falloLectura = fallo;
                const { data } = await request(fallo === 'todos' ? '/3' : '', 500);
                assert.deepEqual(data, { message: 'Error interno del servidor' });
                assert.equal(accesos('BITACORA_CONSULTAR').length, 0); assert.equal(accesos('BITACORA_EVENTO_CONSULTAR').length, 0);
                assert.equal(accesos('ERROR_TECNICO').length, 1);
                assert.equal(JSON.stringify(logs).includes(privado), false);
            }
        });
        await t.test('Auditor de acceso caído conserva listado, detalle y 404; no recursa ni repite', async () => {
            for (const path of ['', '/3', '/99']) {
                reset(); falloAuditoria = true;
                await request(path, path === '/99' ? 404 : 200);
                assert.equal(eventos.length, 31);
                assert.equal(consultas.filter(q => /^INSERT /.test(q.sql)).length, 1);
                assert.ok(logs.some(l => l.categoria === 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA'));
            }
        });
        await t.test('Commit incierto del registro de acceso conserva la lectura, diagnostica y no reintenta', async () => {
            reset(); commitPerdido = true; await request('/3');
            assert.equal(accesos('BITACORA_EVENTO_CONSULTAR').length, 1);
            assert.equal(consultas.filter(q => /^INSERT /.test(q.sql)).length, 1);
            assert.ok(logs.some(l => l.categoria === 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA'));
        });
        await t.test('Sesión ausente, token inválido/expirado, cuenta inactiva y versión revocada no ejecutan SELECT de historial', async () => {
            for (const path of ['', '/3']) for (const caso of ['ausente', 'invalido', 'expirado', 'inactivo', 'revocado']) {
                reset();
                let auth = token();
                if (caso === 'ausente') auth = null;
                if (caso === 'invalido') auth = 'token_sintetico_invalido';
                if (caso === 'expirado') auth = jwt.sign({ idUsuario: 1, idRol: 1, versionCredenciales: 0 }, process.env.JWT_SECRET, { expiresIn: -1 });
                if (caso === 'inactivo') usuarios[0].estado = false;
                if (caso === 'revocado') usuarios[0].version_credenciales = 1;
                await request(path, 401, { auth }); assert.equal(selectsBitacora().length, 0);
                assert.equal(eventos.length, 32); assert.equal(eventos.at(-1).resultado, 'RECHAZADO');
                assert.equal(accesos('LOGOUT').length, 0);
            }
        });
        await t.test('Regente/Vendedor no consultan listado o detalle, aun enviando filtros inválidos o rol falso en JWT', async () => {
            for (const rol of [2, 3]) for (const path of ['?limite=incorrecto', '/3']) {
                reset(); await request(path, 403, { auth: token(rol, { idRol: 1 }) });
                assert.equal(selectsBitacora().length, 0); assert.equal(accesos('ACCESO_DENEGADO').length, 1);
                assert.equal(accesos('ACCESO_DENEGADO')[0].id_rol_responsable, rol);
                assert.equal(accesos('VALIDACION_RECHAZADA').length, 0);
            }
        });
        await t.test('Enteros estrictos: rechaza cero, negativos, espacios, decimales, exponentes, arrays, objetos y desbordamiento', async () => {
            for (const query of ['pagina=0', 'pagina=-1', 'pagina=1.5', 'pagina=1e2', 'pagina=+1', 'pagina=%201',
                'pagina=01', 'pagina=true', 'pagina=', 'pagina=2147483648', 'limite=101', 'limite=0',
                'limite=25&limite=25', 'limite[]=25', 'limite[x]=25', 'idUsuarioResponsable=0', 'idRegistro=4', 'idUsuarioObjetivo=4.2']) {
                reset(); await request(`?${query}`, 400); assert.equal(selectsBitacora().length, 0);
                assert.equal(accesos('VALIDACION_RECHAZADA').length, 1);
            }
        });
        await t.test('Fechas, IP, enums y campos desconocidos inválidos no llegan al Repository ni se copian al evento', async () => {
            for (const query of ['desde=2026-10-13', 'desde=2026-02-30T00%3A00%3A00Z',
                'desde=0999-12-31T23%3A59%3A59Z', 'hasta=9999-12-31T23%3A59%3A59-04%3A00',
                'desde=2026-10-14T00%3A00%3A00Z&hasta=2026-10-13T00%3A00%3A00Z',
                'direccionIp=192.0.2.1,198.51.100.1', 'modulo=FALSO', 'accion=FALSA', 'resultado=FALSO',
                'tipoEvento=VENTA_REGISTRAR', `password=${privado}`, 'nombreIngresado=' + 'x'.repeat(61)]) {
                reset(); const { data } = await request(`?${query}`, 400);
                assert.equal(selectsBitacora().length, 0); assert.equal(accesos('VALIDACION_RECHAZADA').length, 1);
                assert.equal(JSON.stringify(data).includes(privado), false);
                assert.equal(JSON.stringify(eventos).includes(privado), false);
            }
        });
        await t.test('Detalle exige ID válido y ninguna query; autorización antecede validación', async () => {
            for (const path of ['/0', '/-1', '/01', '/2147483648', '/1e2', '/3?pagina=1']) {
                reset(); await request(path, 400); assert.equal(selectsBitacora().length, 0);
            }
            reset(); await request('/0', 401, { auth: null }); assert.equal(accesos('VALIDACION_RECHAZADA').length, 0);
        });
        await t.test('Texto de búsqueda se escapa y se trata como dato; nunca amplía la consulta', async () => {
            reset(); const { data } = await request(`?${new URLSearchParams({ nombreIngresado: "x' OR 1=1 --" })}`);
            assert.deepEqual(data.data, []); assert.equal(data.paginacion.total, 0);
            assert.match(selectsBitacora()[0].sql, /`nombre_ingresado` = 'x\\' OR 1=1 --'/);
            assert.equal(JSON.stringify(accesos('BITACORA_CONSULTAR')).includes('OR 1=1'), false);
        });
        await t.test('Las únicas operaciones expuestas son lectura: Administrador no puede crear, editar o borrar eventos', async () => {
            for (const [method, path] of [['POST', ''], ['PATCH', '/3'], ['DELETE', '/3'], ['PUT', '/3']]) {
                reset(); await request(path, 404, { method });
                assert.equal(eventos.length, 31); assert.equal(selectsBitacora().length, 0);
                assert.equal(consultas.some(q => /^(INSERT|UPDATE|DELETE|DROP) /.test(q.sql)), false);
            }
        });
        await t.test('Express conserva rutas insensibles a caja/slash; HEAD también exige autorización y audita rechazo', async () => {
            reset(); await request('', 200, { rawPath: '/API/BITACORA/?limite=1' });
            assert.equal(accesos('BITACORA_CONSULTAR').length, 1);
            reset(); await request('/3', 403, { method: 'HEAD', auth: token(3) });
            assert.equal(accesos('ACCESO_DENEGADO').length, 1); assert.equal(selectsBitacora().length, 0);
        });
        await t.test('Conexión de lectura caída es 500 sanitizado, sin inventar historial ni auditoría persistida', async () => {
            reset(); conexionCaida = true; const { data } = await request('', 500);
            assert.deepEqual(data, { message: 'Error interno del servidor' });
            assert.equal(eventos.length, 31); assert.equal(selectsBitacora().length, 0);
            assert.ok(logs.some(l => l.categoria === 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA'));
            assert.equal(JSON.stringify(logs).includes(privado), false);
        });
        t.diagnostic('CU42 verificado con HTTP/SQL real y almacenamiento simulado. Migración, privilegios y concurrencia InnoDB requieren MySQL aislado.');
    } finally {
        await new Promise(resolve => server.close(resolve));
        await db.sequelize.close();
    }
});
