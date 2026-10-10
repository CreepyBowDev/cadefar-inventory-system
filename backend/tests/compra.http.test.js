import test from 'node:test';
import assert from 'node:assert/strict';

// Capas HTTP/Service/Repository y generador SQL reales; únicamente se simulan
// los resultados de SELECT. Estas pruebas no conectan ni escriben en MySQL.
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'compras_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_de_pruebas_compras';

const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const { ROLES } = await import('../src/shared/constants/roles.js');
const { compraService } = await import('../src/business/services/compra.service.js');

test('Fase 2.2: consultas de Compras y permisos sin conexión ni escrituras MySQL', async t => {
    const usuarios = Object.values(ROLES).map(idRol => ({
        id_usuario: idRol, id_rol: idRol, nombre_usuario: `usuario${idRol}`,
        estado: true, version_credenciales: 0
    }));
    usuarios.push({ id_usuario: 4, id_rol: ROLES.ADMINISTRADOR, nombre_usuario: 'otroAdmin',
        estado: true, version_credenciales: 0 });
    const usuarioPublico = (id) => ({ id_usuario: id, nombre_usuario: `usuario${id}`,
        password_hash: 'dato_sintetico_privado', correo: 'privado@example.test' });
    const medicamento = { id_medicamento: 1, codigo_medicamento: 'PAR',
        nombre_comercial: 'Paracetamol', forma_farmaceutica: 'Tableta', presentacion: '500 mg',
        unidad_inventario: 'tableta', estado: false, id_proveedor_laboratorio: 99 };
    const detalle = (id, cantidad, costo, subtotal) => ({
        id_detalle_compra: id, id_compra: 10, id_existencia: 8, cantidad,
        costo_unitario: costo, subtotal,
        existencia: { id_existencia: 8, id_medicamento: 1, codigo_existencia: 'PAR-008',
            fecha_vencimiento: '2026-10-15', precision_vencimiento: 'MES', medicamento }
    });
    const cabecera = (id, idUsuario, fecha, clave) => ({
        id_compra: id, id_usuario: idUsuario, id_proveedor_laboratorio: 5,
        fecha_compra: fecha, fecha_registro: '2026-11-01 00:15:00',
        estado_operacion: 'CONFIRMADA', clave_operacion: clave, total: '123456789012.34',
        fecha_anulacion: null, motivo_anulacion: null, id_usuario_anulador: null,
        proveedorLaboratorio: { id_proveedor_laboratorio: 5, nombre: 'Proveedor histórico', estado: false },
        usuarioRegistrador: usuarioPublico(idUsuario), usuarioAnulador: null, detallesCompra: []
    });
    const compras = [cabecera(30, 2, '2026-10-31', 'clave-regente'),
        cabecera(20, 1, '2026-10-31', 'clave-admin'), {
            ...cabecera(10, 2, '2026-10-01', 'clave-anulada'), estado_operacion: 'ANULADA',
            fecha_anulacion: '2026-11-02 13:25:46', motivo_anulacion: 'Error de registro',
            id_usuario_anulador: 1, usuarioAnulador: usuarioPublico(1),
            detallesCompra: [detalle(100, 1, '0.000001', '0.00'),
                detalle(101, 8, '12345678.123456', '98765424.99')]
        }];
    const before = structuredClone(compras);
    const tokens = Object.fromEntries(Object.entries(ROLES).map(([rol, idRol]) => [rol,
        generarToken({ idUsuario: idRol, idRol, versionCredenciales: 0 })]));
    const queries = [];
    let falloTecnico = false, peticiones = 0;
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => {
        throw new Error('Estas pruebas no deben conectar a MySQL');
    });
    t.mock.method(db.sequelize, 'query', async (sql, options) => {
        assert.equal(options.type, db.Sequelize.QueryTypes.SELECT);
        assert.match(sql, /^SELECT /);
        queries.push(sql);
        let rows;
        if (options.model === db.Usuario) {
            const id = Number(sql.match(/`Usuario`.`id_usuario` = (\d+)/)[1]);
            rows = usuarios.filter(u => u.id_usuario === id);
        } else if (options.model === db.Compra) {
            if (falloTecnico) throw new Error('detalle_tecnico_sintetico_no_exponer');
            rows = compras;
            // Simula selección sobre los fixtures; se comprueba además el SQL
            // para no sustituir con esta simulación una integración MySQL real.
            for (const campo of ['id_compra', 'id_usuario', 'id_proveedor_laboratorio']) {
                const match = sql.match(new RegExp('`Compra`\\.`' + campo + '` = (\\d+)'));
                if (match) rows = rows.filter(row => row[campo] === Number(match[1]));
            }
            for (const campo of ['clave_operacion', 'estado_operacion']) {
                const match = sql.match(new RegExp('`Compra`\\.`' + campo + "` = '([^']+)'"));
                if (match) rows = rows.filter(row => row[campo] === match[1]);
            }
            const desde = sql.match(/`Compra`.`fecha_compra` >= '([^']+)'/);
            const hasta = sql.match(/`Compra`.`fecha_compra` <= '([^']+)'/);
            if (desde) rows = rows.filter(row => row.fecha_compra >= desde[1]);
            if (hasta) rows = rows.filter(row => row.fecha_compra <= hasta[1]);
        } else throw new Error('Consulta inesperada');
        const instances = rows.map(row => options.model.build(structuredClone(row), {
            isNewRecord: false, raw: true, include: options.include
        }));
        return options.plain ? instances[0] ?? null : instances;
    });
    t.mock.method(console, 'error', () => {});
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/api/compras`;
    const request = async (rol, path = '', status = 200, token = tokens[rol]) => {
        peticiones++;
        const response = await fetch(`${base}${path}`, {
            headers: token ? { Cookie: `token=${token}` } : {}, signal: AbortSignal.timeout(10000)
        });
        const result = await response.json();
        assert.equal(response.status, status, `${rol} ${path}: ${JSON.stringify(result)}`);
        assert.doesNotMatch(JSON.stringify(result), /password|privado@example|versionCredenciales|dato_sintetico/);
        return result;
    };
    try {
        await t.test('Listado general conserva ambos estados, usuarios y proveedor histórico inactivo', async () => {
            const result = await request('ADMINISTRADOR');
            assert.deepEqual(result.data.map(c => c.idCompra), [30, 20, 10]);
            assert.equal(result.data[2].estadoOperacion, 'ANULADA');
            assert.equal(result.data[0].idUsuario, 2);
            assert.equal(result.data[0].total, '123456789012.34');
            assert.equal(result.data[0].fechaCompra, '2026-10-31');
            assert.equal(result.data[0].fechaRegistro, '2026-11-01 00:15:00');
            assert.equal(result.data[0].fechaAnulacion, null);
            assert.equal(result.data[0].usuarioAnulador, null);
            assert.deepEqual(result.data[0].proveedorLaboratorio,
                { idProveedorLaboratorio: 5, nombre: 'Proveedor histórico', estado: false });
            assert.equal(Object.hasOwn(result.data[0], 'detalles'), false);
            const sql = queries.at(-1);
            assert.doesNotMatch(sql, /WHERE|JOIN `detalle_compra`|password_hash|`correo`/);
            assert.match(sql, /ORDER BY .*fecha_compra.* DESC, `Compra`.`id_compra` DESC/);
        });

        await t.test('Por ID incluye detalles repetidos, costos exactos, vencimiento almacenado y anulación', async () => {
            const { data } = await request('REGENTE', '/10');
            assert.equal(data.fechaAnulacion, '2026-11-02 13:25:46');
            assert.equal(data.motivoAnulacion, 'Error de registro');
            assert.deepEqual(data.usuarioAnulador, { idUsuario: 1, nombreUsuario: 'usuario1' });
            assert.deepEqual(data.detalles.map(d => d.idDetalleCompra), [100, 101]);
            assert.deepEqual(data.detalles.map(d => d.idExistencia), [8, 8]);
            assert.equal(data.detalles[0].costoUnitario, '0.000001');
            assert.equal(data.detalles[0].subtotal, '0.00');
            assert.equal(data.detalles[1].costoUnitario, '12345678.123456');
            assert.equal(data.detalles[0].existencia.fechaVencimiento, '2026-10-15');
            assert.equal(data.detalles[0].existencia.medicamento.estado, false);
            assert.equal(data.idProveedorLaboratorio, 5);
            const sql = queries.at(-1);
            assert.match(sql, /LEFT OUTER JOIN `detalle_compra`/);
            assert.match(sql, /ORDER BY `detallesCompra`.`id_detalle_compra` ASC/);
            assert.doesNotMatch(sql, /saldo_anterior|costo_promedio_anterior|password_hash|cantidad_fisica/);
            assert.doesNotMatch(sql, /`estado` =/);
            for (const campo of ['fecha_registro', 'fecha_anulacion']) {
                assert.ok(sql.includes(`DATE_FORMAT(\`Compra\`.\`${campo}\`, '%Y-%m-%d %H:%i:%s')`));
            }
            assert.deepEqual((await request('ADMINISTRADOR', '/20')).data.detalles, []);
            assert.deepEqual(await request('REGENTE', '/2147483647', 404), { message: 'Compra no encontrada' });
        });

        await t.test('Filtros por adquisición inclusiva, proveedor y estado se combinan en SQL', async () => {
            const { data } = await request('REGENTE',
                '?desde=2026-10-31&hasta=2026-10-31&idProveedorLaboratorio=5&estadoOperacion=CONFIRMADA');
            assert.deepEqual(data.map(c => c.idCompra), [30, 20]);
            const sql = queries.at(-1);
            assert.match(sql, /`Compra`.`fecha_compra` >= '2026-10-31'/);
            assert.match(sql, /`Compra`.`fecha_compra` <= '2026-10-31'/);
            assert.match(sql, /`Compra`.`id_proveedor_laboratorio` = 5/);
            assert.match(sql, /`Compra`.`estado_operacion` = 'CONFIRMADA'/);
            assert.doesNotMatch(sql, /`Compra`.`id_usuario` = \d|fecha_registro` [<>]=/);
            assert.equal((await request('REGENTE', '?desde=2026-10-01&hasta=2026-10-31')).data.length, 3);
            assert.deepEqual((await request('ADMINISTRADOR', '?estadoOperacion=ANULADA')).data.map(c => c.idCompra), [10]);
            for (const path of ['?desde=2026-11-01', '?hasta=2026-09-30', '?idProveedorLaboratorio=6']) {
                assert.deepEqual((await request('REGENTE', path)).data, []);
            }
        });

        await t.test('Clave personal: añade sesión con cualquier filtro y oculta claves ajenas', async () => {
            assert.deepEqual((await request('ADMINISTRADOR', '?claveOperacion=CLAVE-ADMIN')).data.map(c => c.idCompra), [20]);
            assert.match(queries.at(-1), /`Compra`.`clave_operacion` = 'clave-admin'/);
            assert.match(queries.at(-1), /`Compra`.`id_usuario` = 1/);
            assert.deepEqual((await request('REGENTE', '?claveOperacion=clave-admin')).data, []);
            assert.match(queries.at(-1), /`Compra`.`id_usuario` = 2/);
            assert.deepEqual((await request('ADMINISTRADOR', '?claveOperacion=clave-regente')).data, []);
            assert.deepEqual((await request('ADMINISTRADOR', '?claveOperacion=clave-admin', 200,
                generarToken({ idUsuario: 4, idRol: ROLES.ADMINISTRADOR, versionCredenciales: 0 }))).data, []);
            assert.match(queries.at(-1), /`Compra`.`id_usuario` = 4/);
            assert.deepEqual((await request('REGENTE', '?claveOperacion=no-existe')).data, []);
            const filtros = '?claveOperacion=CLAVE-ANULADA&desde=2026-10-01&hasta=2026-10-31' +
                '&idProveedorLaboratorio=5&estadoOperacion=ANULADA';
            assert.deepEqual((await request('REGENTE', filtros)).data.map(c => c.idCompra), [10]);
            assert.match(queries.at(-1), /`Compra`.`id_usuario` = 2/);
            assert.deepEqual((await request('ADMINISTRADOR', filtros)).data, []);
            // La restricción por clave no altera el permiso general por ID.
            assert.equal((await request('REGENTE', '/20')).data.idUsuario, 1);
            const count = queries.length;
            await assert.rejects(compraService.getCompras({ claveOperacion: 'clave-admin' }),
                error => error.statusCode === 401);
            assert.equal(queries.length, count, 'Sin identidad no se ejecuta una búsqueda por clave');
        });

        await t.test('Permisos: Administrador/Regente, sesión ausente o inválida, cuenta y versión', async () => {
            for (const path of ['', '/10']) {
                for (const rol of Object.keys(ROLES)) {
                    await request(rol, path, rol === 'VENDEDOR' ? 403 : 200);
                }
                await request(null, path, 401);
                await request(null, path, 401, 'invalido');
                await request('ADMINISTRADOR', path, 401,
                    generarToken({ idUsuario: 1, idRol: 1, versionCredenciales: 1 }));
                usuarios[0].estado = false;
                await request('ADMINISTRADOR', path, 401);
                usuarios[0].estado = true;
                await request('ADMINISTRADOR', path, 403,
                    generarToken({ idUsuario: ROLES.VENDEDOR, idRol: ROLES.ADMINISTRADOR, versionCredenciales: 0 }));
            }
        });

        await t.test('Entrada inválida se rechaza antes de consultar Compras', async () => {
            for (const path of ['?idUsuario=1', '?claveOperacion=a&claveOperacion=b',
                '?claveOperacion=a%20b', '?claveOperacion=a%0A', '?claveOperacion=a%27OR%201=1',
                '?idProveedorLaboratorio=1e2', '?idProveedorLaboratorio=1&idProveedorLaboratorio=2',
                '?estadoOperacion=confirmada', '?estadoOperacion=CONFIRMADA&estadoOperacion=ANULADA',
                '?desde=2026-02-29', '?desde=2026-11-01&hasta=2026-10-31',
                '?desde=2026-10-01&desde=2026-10-02', '/0', '/1e2', '/abc', '/1%20',
                '/10?claveOperacion=clave-admin', '/10?idUsuario=1']) {
                const count = queries.length;
                const result = await request('REGENTE', path, 400);
                assert.equal(result.message, 'Datos inválidos');
                assert.ok(Array.isArray(result.errors));
                assert.equal(queries.length, count + 1, 'Solo SELECT de sesión');
            }
        });

        await t.test('Errores técnicos no revelan datos internos; las lecturas no mutan históricos', async () => {
            falloTecnico = true;
            for (const path of ['', '/10']) {
                assert.deepEqual(await request('REGENTE', path, 500), { message: 'Error interno del servidor' });
            }
            falloTecnico = false;
            assert.deepEqual(compras, before);
        });
        t.diagnostic(`${peticiones} comprobaciones HTTP y ${queries.length} SELECT generados; sin conexiones ni escrituras MySQL.`);
    } finally {
        await new Promise(resolve => server.close(resolve));
        await db.sequelize.close();
    }
});
