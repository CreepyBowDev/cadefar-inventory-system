import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'ventas_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_de_ventas_http';

const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const { ROLES } = await import('../src/shared/constants/roles.js');
const { simularAuditoriaTransversal } = await import('./helpers/auditoria-transversal.js');

test('CU29: HTTP, SQL, permisos, DTO y errores sin conexión MySQL', async t => {
    simularAuditoriaTransversal(t);
    const queries = [];
    let fallo = false;
    const usuario = { id_usuario: 3, nombre_usuario: 'vendedor', password_hash: 'privado_hash',
        correo: 'privado@example.test' };
    const venta = {
        id_venta: 7, id_usuario: 3, estado_operacion: 'PENDIENTE', clave_operacion: 'fixture-7',
        fecha_registro: '2026-11-01 23:59:59', fecha_venta: null, total: '999999999999.99',
        fecha_anulacion: null, motivo_anulacion: null, id_usuario_anulador: null,
        usuarioRegistrador: usuario, usuarioAnulador: null,
        detallesVenta: [{ id_detalle_venta: 8, id_venta: 7, id_existencia: 9, id_receta: 10,
            cantidad: 2, precio_unitario: '1.25', subtotal: '2.50',
            existencia: { id_existencia: 9, id_medicamento: 1, codigo_existencia: 'PAR-001',
                fecha_vencimiento: '2026-10-15', precision_vencimiento: 'MES',
                cantidad_fisica: 99, costo_unitario_promedio: '0.500000',
                medicamento: { id_medicamento: 1, codigo_medicamento: 'PAR', nombre_comercial: 'Producto',
                    forma_farmaceutica: 'Tableta', presentacion: '500 mg', unidad_inventario: 'tableta', estado: false }
            } }],
        recetas: [{ id_receta: 10, id_venta: 7, resultado_revision: null,
            nombre_paciente: 'Paciente privado', documento_paciente: 'documento_privado',
            archivo_receta: 'privado/archivo.pdf', observacion: 'observacion_privada' }]
    };
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => {
        throw new Error('No conectar MySQL en esta prueba');
    });
    t.mock.method(db.sequelize, 'transaction', async (options, callback) => {
        assert.equal(options.isolationLevel, db.Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ);
        return callback(undefined);
    });
    t.mock.method(db.sequelize, 'query', async (sql, options) => {
        assert.match(sql, /^SELECT /);
        queries.push(sql);
        if (options.model === db.Usuario) {
            const id = Number(sql.match(/`Usuario`.`id_usuario` = (\d+)/)[1]);
            const instance = db.Usuario.build({ id_usuario: id, id_rol: id > 3 ? 3 : id, nombre_usuario: `usuario${id}`,
                estado: id !== 5, version_credenciales: 0 }, { isNewRecord: false });
            return options.plain ? instance : [instance];
        }
        assert.match(sql, /FROM `venta` AS `Venta`/);
        if (fallo) throw new Error('sql_privado_no_exponer');
        const id = sql.match(/`Venta`.`id_venta` = (\d+)/);
        const rows = !id || Number(id[1]) === 7 ? [venta] : [];
        if (/count\(\*\)/i.test(sql)) return { count: rows.length };
        const instances = rows.map(row => db.Venta.build(structuredClone(row), {
            isNewRecord: false, raw: true, include: options.include
        }));
        return options.plain ? instances[0] ?? null : instances;
    });
    t.mock.method(console, 'error', () => {});
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const request = async (idRol, path = '', status = 200, method = 'GET') => {
        const token = idRol ? generarToken({ idUsuario: idRol, idRol, versionCredenciales: 0 }) : null;
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ventas${path}`, {
            method, headers: token ? { Cookie: `token=${token}` } : {}, signal: AbortSignal.timeout(10000)
        });
        const body = await response.json();
        assert.equal(response.status, status, JSON.stringify(body));
        assert.doesNotMatch(JSON.stringify(body), /privado|password|nombrePaciente|archivoReceta|documentoPaciente|costoUnitarioPromedio|stockFisico/);
        return body;
    };
    try {
        await t.test('Tres roles consultan cabeceras con paginación estable', async () => {
            for (const rol of Object.values(ROLES)) {
                const body = await request(rol);
                assert.equal(body.data[0].fechaVenta, null);
                assert.equal(body.data[0].fechaRegistro, '2026-11-01 23:59:59');
                assert.equal(body.data[0].total, '999999999999.99');
                assert.equal(body.data[0].detalles, undefined);
                assert.deepEqual(body.paginacion, { pagina: 1, limite: 25, total: 1, totalPaginas: 1 });
            }
            assert.match(queries.at(-1), /ORDER BY .*fecha_registro.* DESC, `Venta`.`id_venta` DESC LIMIT 0, 25/);
        });
        await t.test('Filtros combinados, fechas civiles y paginación llegan al SQL', async () => {
            await request(3, '?desde=2026-11-01&hasta=2026-11-02&campoFecha=fechaVenta' +
                '&idUsuario=3&estadoOperacion=CONFIRMADA&pagina=2&limite=1');
            const sql = queries.at(-1);
            assert.match(sql, /`Venta`.`fecha_venta` >= STR_TO_DATE\('2026-11-01 00:00:00'/);
            assert.match(sql, /`Venta`.`fecha_venta` <= STR_TO_DATE\('2026-11-02 23:59:59.999999'/);
            assert.match(sql, /`Venta`.`id_usuario` = 3/);
            assert.match(sql, /`Venta`.`estado_operacion` = 'CONFIRMADA'/);
            assert.match(sql, /LIMIT 1, 1/);
            await request(1, '?desde=2026-11-01');
            assert.match(queries.at(-1), /`Venta`.`fecha_registro` >= STR_TO_DATE/);
            assert.doesNotMatch(queries.at(-1), /JOIN `detalle_venta`|JOIN `receta`/);
        });
        await t.test('Detalle conserva referencias y medicamento histórico inactivo', async () => {
            const { data } = await request(2, '/7');
            assert.equal(data.detalles[0].idReceta, 10);
            assert.equal(data.detalles[0].precioUnitario, '1.25');
            assert.equal(data.detalles[0].existencia.medicamento.estado, false);
            assert.deepEqual(data.recetas, [{ idReceta: 10, idVenta: 7, resultadoRevision: null }]);
            const sql = queries.at(-1);
            assert.match(sql, /JOIN `detalle_venta`/);
            assert.match(sql, /JOIN `receta`/);
            assert.doesNotMatch(sql, /password_hash|archivo_receta|nombre_paciente|documento_paciente|costo_unitario_promedio|cantidad_fisica/);
        });
        await t.test('Lista vacía, ID ausente y validaciones no se confunden', async () => {
            const vacio = await request(3, '?idVenta=999');
            assert.deepEqual(vacio, { data: [], paginacion: { pagina: 1, limite: 25, total: 0, totalPaginas: 0 } });
            assert.deepEqual(await request(1, '/999', 404), { message: 'Venta no encontrada' });
            for (const path of ['?limite=101', '?pagina=0', '?idUsuario=1&idUsuario=2',
                '?desde=2026-02-29', '?otro=1', '/0', '/7?otro=1']) await request(1, path, 400);
        });
        await t.test('Sin sesión, token inválido e inactivo no acceden', async () => {
            await request(null, '', 401);
            await request(5, '', 401);
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ventas`, {
                headers: { Cookie: 'token=invalido' }
            });
            assert.equal(response.status, 401);
        });
        await t.test('Fallo técnico produce 500 sanitizado, nunca lista vacía', async () => {
            fallo = true;
            assert.deepEqual(await request(1, '', 500), { message: 'Error interno del servidor' });
            await request(2, '/7', 500);
        });
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});
