import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { crearEntornoReportes } from './helpers/reportes-mysql.js';

test('Fase 6: Reportes Express/Sequelize/MySQL aislados', { timeout: 180000 }, async t => {
    const entorno = await crearEntornoReportes(t);
    const { db } = entorno;
    let server;
    try {
        const { app } = await import('../src/app.js');
        const { decimalAEntero, enteroADecimal, dividirYRedondear } = await import('../src/shared/utils/decimal.js');
        const { bitacoraAuditoriaRepository: auditor } = await import('../src/data/repositories/bitacora-auditoria.repository.js');
        const select = async (sql, replacements = []) => db.sequelize.query(sql, {
            replacements, type: db.Sequelize.QueryTypes.SELECT, logging: false });
        const sqlReal = [];
        // Logging de sentencias realmente enviadas por Sequelize, no transporte interceptado.
        db.sequelize.options.logging = sql => sqlReal.push(sql);
        const civil = fecha => db.Sequelize.fn('STR_TO_DATE', fecha, '%Y-%m-%d %H:%i:%s');
        await db.Rol.bulkCreate(['ADMINISTRADOR', 'REGENTE', 'VENDEDOR'].map((nombre, i) => ({ id_rol: i + 1, nombre })));
        const password = 'Fixture-Reportes-123!';
        const hash = await bcrypt.hash(password, 4);
        const usuarios = [];
        for (let i = 1; i <= 3; i++) usuarios.push(await db.Usuario.create({
            id_rol: i, nombre_usuario: `reporte_fixture_${i}`, password_hash: hash }));
        const proveedor = await db.ProveedorLaboratorio.create({ nombre: 'Proveedor sintético inactivo', estado: false });
        const medicamento = await db.Medicamento.create({ id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio,
            codigo_medicamento: 'RF6', nombre_comercial: 'Producto sintético inactivo', forma_farmaceutica: 'Tableta',
            presentacion: '500 mg', unidad_inventario: 'tableta', condicion_venta: 'LIBRE',
            via_administracion: 'Oral', tipo_liberacion: 'Inmediata', estado: false });
        const existencia = await db.ExistenciaMedicamento.create({ id_medicamento: medicamento.id_medicamento,
            codigo_existencia: 'RF6-001', fecha_vencimiento: '2020-01-31', precision_vencimiento: 'MES',
            cantidad_fisica: 0, costo_unitario_promedio: '99.000000' });
        let secuencia = 0;
        const venta = (estado, fecha, extra = {}) => db.Venta.create({ id_usuario: usuarios[2].id_usuario,
            estado_operacion: estado, fecha_registro: civil('2026-10-01 12:00:00'),
            fecha_venta: estado === 'PENDIENTE' ? null : civil(fecha), total: '10.00',
            clave_operacion: `reporte-venta-${++secuencia}`, ...extra });
        const compra = (estado, fecha, extra = {}) => db.Compra.create({ id_usuario: usuarios[0].id_usuario,
            id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio, estado_operacion: estado,
            fecha_compra: fecha, fecha_registro: civil('2026-12-02 12:00:00'), total: '10.00',
            clave_operacion: `reporte-compra-${++secuencia}`, ...extra });
        const movimiento = (motivo, fecha, extra = {}) => db.MovimientoInventario.create({
            id_usuario: usuarios[1].id_usuario, id_existencia: existencia.id_existencia, direccion: 'SALIDA',
            motivo, cantidad: 1, costo_unitario_aplicado: '0.005000', fecha_movimiento: civil(fecha), ...extra });
        const v = [];
        v.push(await venta('CONFIRMADA', '2026-11-10 00:00:00'));
        v.push(await venta('PENDIENTE', '', { fecha_registro: civil('2026-11-10 08:00:00') }));
        v.push(await venta('ANULADA', '2026-11-10 12:00:00', { fecha_anulacion: civil('2026-12-01 10:00:00') }));
        v.push(await venta('ANULADA', '', { fecha_venta: null, fecha_registro: civil('2026-11-10 23:59:59') }));
        const c = [await compra('CONFIRMADA', '2026-11-10'), await compra('ANULADA', '2026-11-10', {
            fecha_anulacion: civil('2026-12-01 10:00:00') })];
        for (let i = 0; i < 2; i++) {
            await db.DetalleVenta.create({ id_venta: v[0].id_venta, id_existencia: existencia.id_existencia,
                cantidad: 1, precio_unitario: '5.00', subtotal: '5.00' });
            await db.DetalleCompra.create({ id_compra: c[0].id_compra, id_existencia: existencia.id_existencia,
                cantidad: 1, costo_unitario: '5.000000', subtotal: '5.00' });
        }
        await db.Receta.create({ id_venta: v[0].id_venta, fecha_receta: '2026-11-10',
            nombre_paciente: 'PACIENTE_PRIVADO_F6', documento_paciente: 'DOCUMENTO_PRIVADO_F6',
            nombre_medico: 'MEDICO_PRIVADO_F6', archivo_receta: 'ARCHIVO_PRIVADO_F6.pdf', modalidad: 'Fixture' });
        const retiros = [await movimiento('VENCIMIENTO', '2026-11-10 00:00:00'),
            await movimiento('VENCIMIENTO', '2026-11-10 23:59:59'),
            await movimiento('DAÑO', '2026-11-10 12:00:00', { cantidad: 3, costo_unitario_aplicado: '0.000000' })];
        const reversiones = [];
        for (let i = 0; i < 2; i++) reversiones.push(await movimiento('VENCIMIENTO',
            i ? '2026-12-10 12:00:00' : '2026-11-10 13:00:00', {
                direccion: 'ENTRADA', id_movimiento_original: retiros[i].id_movimiento }));
        for (const motivo of ['VENTA', 'AJUSTE', 'COMPRA']) await movimiento(motivo, '2026-11-10 12:00:00');
        await movimiento('DAÑO', '2026-11-10 12:00:00', { direccion: 'ENTRADA' });
        // Fixture de referencia no original: también debe excluirse aunque sea SALIDA/DAÑO.
        await movimiento('DAÑO', '2026-11-10 12:00:00', { id_movimiento_original: retiros[2].id_movimiento });
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
        const base = `http://127.0.0.1:${server.address().port}/api`;
        const cookies = {};
        for (let rol = 1; rol <= 3; rol++) {
            const response = await fetch(`${base}/auth/login`, { method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombreUsuario: usuarios[rol - 1].nombre_usuario, password }),
                signal: AbortSignal.timeout(10000) });
            assert.equal(response.status, 200);
            const cookie = response.headers.get('set-cookie');
            assert.match(cookie, /HttpOnly/i);
            cookies[rol] = cookie.split(';')[0];
        }
        const request = async (ruta, rol = 1, status = 200) => {
            const response = await fetch(`${base}${ruta}`, { headers: rol ? { Cookie: cookies[rol] } : {},
                signal: AbortSignal.timeout(15000) });
            const body = await response.json();
            assert.equal(response.status, status, JSON.stringify(body));
            assert.doesNotMatch(JSON.stringify(body), /password|password_hash|claveOperacion|stack|SELECT |INSERT |Fixture-Reportes|PRIVADO_F6/i);
            if (ruta.startsWith('/reportes/')) assert.doesNotMatch(JSON.stringify(body), /observacion/i);
            return body;
        };
        const paths = ['ventas', 'compras', 'perdidas'];
        const logs = [];
        const log = t.mock.method(console, 'error', entrada => logs.push(entrada));
        const snapshot = async () => JSON.stringify(await Promise.all(Object.values(db)
            .filter(m => m?.tableName && m !== db.BitacoraAuditoria)
            .map(m => m.findAll({ raw: true, order: [[m.primaryKeyAttribute, 'ASC']] }))));
        await t.test('401/403/200 reales por sesión/rol y CU40 conservado', async () => {
            for (const path of paths) {
                await request(`/reportes/${path}?dia=2026-11-10`, 0, 401);
                await request(`/reportes/${path}?dia=2026-11-10`, 3, 403);
                await request(`/reportes/${path}?dia=2026-11-10`, 2, path === 'perdidas' ? 200 : 403);
                await request(`/reportes/${path}?dia=2026-11-10`);
                const previa = cookies[1];
                try {
                    cookies[1] = 'token=token_invalido_fixture';
                    await request(`/reportes/${path}?dia=2026-11-10`, 1, 401);
                } finally { cookies[1] = previa; }
            }
            await request('/inventario/movimientos', 0, 401);
            await request('/inventario/movimientos', 3, 403);
            for (const rol of [1, 2]) assert.ok(Array.isArray((await request('/inventario/movimientos', rol)).data));
        });
        await t.test('400 estrictos y errores seguros persistidos una sola vez', async () => {
            for (const path of paths) for (const query of ['', '?dia=1900-02-29', '?mes=2026-13',
                '?dia=2026-11-10&dia=2026-11-11', '?desde=2026-11-11&hasta=2026-11-10', '?dia=2026-11-10&limite=101']) {
                const antes = await db.BitacoraAuditoria.count();
                await request(`/reportes/${path}${query}`, 1, 400);
                assert.equal(await db.BitacoraAuditoria.count(), antes + 1);
            }
            // Error SQL ejecutado realmente, acotado a una consulta de reporte (no auditoría).
            const original = db.Venta.findAll.bind(db.Venta);
            const fallo = t.mock.method(db.Venta, 'findAll', options => original({ ...options,
                attributes: [db.Sequelize.literal('columna_fixture_inexistente')] }));
            const antes = await db.BitacoraAuditoria.count();
            try { assert.deepEqual(await request('/reportes/ventas?dia=2026-11-10', 1, 500), { message: 'Error interno del servidor' }); }
            finally { fallo.mock.restore(); }
            assert.equal(await db.BitacoraAuditoria.count(), antes + 1);
            const ultimo = await db.BitacoraAuditoria.findOne({ order: [['id_evento', 'DESC']], raw: true });
            assert.equal(ultimo.tipo_evento, 'ERROR_TECNICO');
        });
        await t.test('Resumen completo, cuatro categorías/ejes históricos, adquisición y paginación', async () => {
            const ventas = await request('/reportes/ventas?dia=2026-11-10&limite=1');
            assert.equal(ventas.paginacion.total, 4);
            for (const key of ['confirmadas', 'pendientes', 'anuladasConfirmadas', 'anuladasSinConfirmar'])
                assert.deepEqual(ventas.data.resumen[key], { cantidad: 1, importe: '10.00' });
            assert.equal(ventas.data.resumen.totalVentasRealizadas, '10.00');
            for (const path of paths) {
                const dia = await request(`/reportes/${path}?dia=2026-11-10`);
                for (const query of ['mes=2026-11', 'desde=2026-11-10&hasta=2026-11-10']) {
                    const otro = await request(`/reportes/${path}?${query}`);
                    assert.deepEqual(otro.data.resumen, dia.data.resumen);
                    assert.deepEqual(otro.data.detalle, dia.data.detalle);
                }
                const lejos = await request(`/reportes/${path}?dia=2026-11-10&pagina=100`);
                assert.deepEqual(lejos.data.detalle, []);
                assert.deepEqual(lejos.data.resumen, dia.data.resumen);
                assert.equal(lejos.paginacion.total, dia.paginacion.total);
                assert.equal(dia.data.periodo.zonaHoraria, 'America/La_Paz');
                for (const fecha of ['2000-02-29', '1000-01-01', '9999-12-31', '2099-01-01']) {
                    const vacio = await request(`/reportes/${path}?dia=${fecha}`);
                    assert.equal(vacio.paginacion.total, 0);
                    assert.deepEqual(vacio.data.detalle, []);
                    assert.equal(vacio.paginacion.totalPaginas, 0);
                }
            }
            const compras = await request('/reportes/compras?dia=2026-11-10');
            assert.equal(compras.paginacion.total, 2);
            assert.deepEqual(compras.data.resumen, { confirmadas: { cantidad: 1, importe: '10.00' },
                anuladas: { cantidad: 1, importe: '10.00' }, totalComprasRealizadas: '10.00' });
            assert.equal((await request('/reportes/compras?dia=2026-12-02')).paginacion.total, 0);
        });
        await t.test('CU41 bruto: ROUND individual SQL = BigInt, cero histórico y reversiones dentro/fuera', async () => {
            const body = await request('/reportes/perdidas?dia=2026-11-10');
            assert.equal(body.paginacion.total, 3);
            assert.deepEqual(body.data.resumen, { vencimiento: { cantidadRetiros: 2, cantidadRetirada: '2', perdida: '0.02' },
                dano: { cantidadRetiros: 1, cantidadRetirada: '3', perdida: '0.00' }, cantidadRetiros: 3, cantidadRetirada: '5', perdidaTotal: '0.02' });
            for (const row of body.data.detalle) {
                assert.equal(row.perdida, enteroADecimal(dividirYRedondear(BigInt(row.cantidad) * decimalAEntero(row.costoUnitarioAplicado, 6), 10000n), 2));
                if (row.motivo === 'VENCIMIENTO') {
                    const i = retiros.findIndex(m => m.id_movimiento === row.idMovimiento);
                    assert.equal(row.idMovimientoReversion, reversiones[i].id_movimiento);
                }
            }
            const solo = await request('/reportes/perdidas?dia=2026-11-10&motivo=DA%C3%91O');
            assert.equal(solo.data.resumen.vencimiento.cantidadRetiros, 0);
            for (const path of ['ventas', 'compras']) {
                const filtrado = await request(`/reportes/${path}?dia=2026-11-10&estadoOperacion=ANULADA`);
                assert.equal(filtrado.data.resumen.confirmadas.cantidad, 0);
            }
        });
        await t.test('Lecturas sin mutación del negocio; éxito mínimo y rechazo único persistidos', async () => {
            const antes = await snapshot();
            const inicioSql = sqlReal.length;
            for (const path of paths) {
                const n = await db.BitacoraAuditoria.count();
                await request(`/reportes/${path}?dia=2026-11-10&limite=1`);
                assert.equal(await db.BitacoraAuditoria.count(), n + 1);
                const e = await db.BitacoraAuditoria.findOne({ order: [['id_evento', 'DESC']], raw: true });
                assert.equal(e.tipo_evento, `REPORTE_${path.toUpperCase()}_CONSULTAR`);
                assert.deepEqual(e.metadatos, { cantidadResultados: 1 });
                assert.equal(e.antes, null); assert.equal(e.despues, null);
                assert.equal(e.id_registro, null);
                const vacios = await db.BitacoraAuditoria.count();
                await request(`/reportes/${path}?dia=2099-01-01`);
                assert.equal(await db.BitacoraAuditoria.count(), vacios + 1);
                const vacio = await db.BitacoraAuditoria.findOne({ order: [['id_evento', 'DESC']], raw: true });
                assert.deepEqual(vacio.metadatos, { cantidadResultados: 0 });
                const rechazos = await db.BitacoraAuditoria.count();
                await request(`/reportes/${path}?dia=2026-11-10`, 3, 403);
                assert.equal(await db.BitacoraAuditoria.count(), rechazos + 1);
            }
            assert.equal(await snapshot(), antes);
            const lecturas = sqlReal.slice(inicioSql);
            assert.doesNotMatch(lecturas.join('\n'), /FOR UPDATE|SUM\(DISTINCT/i);
            const escrituras = lecturas.filter(sql => /\b(INSERT INTO|UPDATE `|DELETE FROM|REPLACE INTO)\b/i.test(sql));
            assert.ok(escrituras.length > 0);
            for (const sql of escrituras) assert.match(sql, /INSERT INTO `bitacora_auditoria`/);
        });
        await t.test('Auditor independiente: fallo SQL real en su escritura preserva 200 y error original', async () => {
            const crear = auditor.create.bind(auditor);
            const fallo = t.mock.method(auditor, 'create', args => crear({ ...args,
                data: { ...args.data, resultado: 'INVALIDO_FIXTURE' } }));
            const antes = await db.BitacoraAuditoria.count();
            try {
                for (const path of paths) {
                    await request(`/reportes/${path}?dia=2026-11-10`);
                    await request(`/reportes/${path}?dia=invalido`, 1, 400);
                }
            } finally { fallo.mock.restore(); }
            assert.equal(await db.BitacoraAuditoria.count(), antes);
            assert.ok(logs.some(e => e?.categoria === 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA'));
            assert.doesNotMatch(JSON.stringify(logs), /INVALIDO_FIXTURE|password|SELECT |INSERT /);
        });
        await t.test('Snapshot RR real ante anulación y reversión confirmadas entre agregado y detalle', async () => {
            for (const [model, path] of [[db.Venta, 'ventas'], [db.Compra, 'compras'], [db.MovimientoInventario, 'perdidas']]) {
                // Para CU41 usar un original sin referencia previa.
                let nuevo;
                if (path === 'perdidas') nuevo = await movimiento('DAÑO', '2026-11-10 14:00:00');
                const original = model.findAll.bind(model);
                let aggregateTx, detailTx, lecturaId, escrituraId, intercalada = false;
                const hook = t.mock.method(model, 'findAll', async options => {
                    if (!options.transaction) return original(options);
                    if (options.group) {
                        aggregateTx = options.transaction;
                        const [idsLectura] = await db.sequelize.query('SELECT CONNECTION_ID() AS id', { transaction: options.transaction });
                        lecturaId = idsLectura[0].id;
                        const rows = await original(options); // snapshot ya establecido en InnoDB
                        await db.sequelize.transaction(async transaction => {
                            const [ids] = await db.sequelize.query('SELECT CONNECTION_ID() AS id', { transaction });
                            escrituraId = ids[0].id;
                            if (path === 'perdidas') await db.MovimientoInventario.create({
                                id_usuario: usuarios[1].id_usuario, id_existencia: existencia.id_existencia,
                                direccion: 'ENTRADA', motivo: 'DAÑO', cantidad: 1, costo_unitario_aplicado: '0.005000',
                                fecha_movimiento: civil('2026-12-10 12:00:00'), id_movimiento_original: nuevo.id_movimiento
                            }, { transaction });
                            else await model.update({ estado_operacion: 'ANULADA' }, {
                                where: { [model.primaryKeyAttribute]: (path === 'ventas' ? v[0].id_venta : c[0].id_compra) }, transaction });
                        }); // COMMIT real antes de permitir detalle
                        intercalada = true;
                        return rows;
                    }
                    detailTx = options.transaction;
                    assert.ok(intercalada);
                    return original(options);
                });
                let body;
                try { body = await request(`/reportes/${path}?dia=2026-11-10`); }
                finally { hook.mock.restore(); }
                assert.equal(aggregateTx, detailTx);
                assert.equal(aggregateTx.options.isolationLevel, 'REPEATABLE READ');
                assert.equal(aggregateTx.finished, 'commit');
                assert.ok(lecturaId && escrituraId);
                assert.notEqual(lecturaId, escrituraId);
                if (path === 'perdidas') {
                    assert.equal(body.data.detalle.find(r => r.idMovimiento === nuevo.id_movimiento).idMovimientoReversion, null);
                    assert.ok((await request('/reportes/perdidas?dia=2026-11-10')).data.detalle
                        .find(r => r.idMovimiento === nuevo.id_movimiento).idMovimientoReversion);
                } else {
                    assert.equal(body.data.resumen.confirmadas.cantidad, 1);
                    assert.equal(body.data.detalle.find(r => r[path === 'ventas' ? 'idVenta' : 'idCompra'] ===
                        (path === 'ventas' ? v[0].id_venta : c[0].id_compra)).estadoOperacion, 'CONFIRMADA');
                    assert.equal((await request(`/reportes/${path}?dia=2026-11-10`)).data.resumen.confirmadas.cantidad, 0);
                }
                t.diagnostic(`${path}: conexiones lector=${lecturaId}, escritor=${escrituraId}; agregado real → COMMIT escritor real → detalle mismo snapshot → nueva solicitud ve cambio`);
            }
        });
        await t.test('DECIMAL derivado grande textual y años extremos persistidos', async () => {
            await venta('CONFIRMADA', '1000-01-01 00:00:00', { total: '999999999999.99' });
            await venta('CONFIRMADA', '1000-01-01 23:59:59', { total: '999999999999.99' });
            assert.equal((await request('/reportes/ventas?dia=1000-01-01')).data.resumen.totalVentasRealizadas, '1999999999999.98');
            await compra('CONFIRMADA', '9999-12-31', { total: '999999999999.99' });
            assert.equal((await request('/reportes/compras?dia=9999-12-31')).data.detalle[0].fechaCompra, '9999-12-31');
            await movimiento('DAÑO', '9999-12-31 23:59:59', { cantidad: 2147483647, costo_unitario_aplicado: '99999999.999999' });
            const body = await request('/reportes/perdidas?dia=9999-12-31');
            assert.equal(body.data.resumen.cantidadRetirada, '2147483647');
            assert.equal(body.data.resumen.perdidaTotal, enteroADecimal(dividirYRedondear(2147483647n * 99999999999999n, 10000n), 2));
            await movimiento('DAÑO', '9999-12-31 23:59:59', { cantidad: 2147483647, costo_unitario_aplicado: '99999999.999999' });
            const grande = await request('/reportes/perdidas?dia=9999-12-31');
            assert.equal(grande.data.resumen.cantidadRetirada, '4294967294');
            assert.equal(grande.data.resumen.perdidaTotal,
                enteroADecimal(2n * dividirYRedondear(2147483647n * 99999999999999n, 10000n), 2));
            await venta('CONFIRMADA', '9999-12-31 23:59:59');
            assert.equal((await request('/reportes/ventas?dia=9999-12-31')).paginacion.total, 1);
            await compra('CONFIRMADA', '1000-01-01');
            assert.equal((await request('/reportes/compras?dia=1000-01-01')).paginacion.total, 1);
            await movimiento('VENCIMIENTO', '1000-01-01 00:00:00');
            assert.equal((await request('/reportes/perdidas?dia=1000-01-01')).paginacion.total, 1);
        });
        await t.test('ROUND SQL sobre costos históricos bajo/igual/sobre empate y cantidades extremas', async () => {
            let esperado = 0n;
            const casos = [['0.004999', 1], ['0.005000', 1], ['0.005001', 1], ['0.000000', 2147483647],
                ['1.234567', 3], ['99999999.999999', 2147483647]];
            for (const [costo, cantidad] of casos) {
                await movimiento('DAÑO', '2026-11-12 23:59:59', { cantidad, costo_unitario_aplicado: costo });
                esperado += dividirYRedondear(BigInt(cantidad) * decimalAEntero(costo, 6), 10000n);
            }
            const body = await request('/reportes/perdidas?dia=2026-11-12');
            assert.equal(body.data.resumen.perdidaTotal, enteroADecimal(esperado, 2));
            for (const row of body.data.detalle) assert.equal(row.perdida,
                enteroADecimal(dividirYRedondear(BigInt(row.cantidad) * decimalAEntero(row.costoUnitarioAplicado, 6), 10000n), 2));
        });
        await t.test('Extremos inclusivos civiles, exclusión de días adyacentes y orden ID al empatar', async () => {
            for (const fecha of ['2026-11-19 23:59:59', '2026-11-20 00:00:00',
                '2026-11-20 23:59:59', '2026-11-20 23:59:59', '2026-11-21 00:00:00']) {
                await venta('CONFIRMADA', fecha);
                await compra('CONFIRMADA', fecha.slice(0, 10));
                await movimiento('VENCIMIENTO', fecha);
            }
            for (const path of paths) {
                const completo = await request(`/reportes/${path}?dia=2026-11-20`);
                assert.equal(completo.paginacion.total, 3);
                assert.equal(completo.data.detalle.length, 3);
                const id = path === 'ventas' ? 'idVenta' : path === 'compras' ? 'idCompra' : 'idMovimiento';
                assert.ok(completo.data.detalle[0][id] > completo.data.detalle[1][id]);
                for (let pagina = 1; pagina <= 3; pagina++) {
                    const parcial = await request(`/reportes/${path}?dia=2026-11-20&limite=1&pagina=${pagina}`);
                    assert.deepEqual(parcial.data.resumen, completo.data.resumen);
                    assert.deepEqual(parcial.data.detalle, [completo.data.detalle[pagina - 1]]);
                    assert.equal(parcial.paginacion.total, 3);
                }
            }
        });
        await t.test('Fracciones persistidas: requisito bloqueado si el esquema solo admite segundos', async sub => {
            const columnas = await select("SELECT TABLE_NAME, COLUMN_NAME, DATETIME_PRECISION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND ((TABLE_NAME = 'venta' AND COLUMN_NAME IN ('fecha_venta','fecha_registro')) OR (TABLE_NAME = 'movimiento_inventario' AND COLUMN_NAME = 'fecha_movimiento'))");
            for (const c of columnas) t.diagnostic(`${c.TABLE_NAME}.${c.COLUMN_NAME}: DATETIME(${c.DATETIME_PRECISION})`);
            if (columnas.some(c => Number(c.DATETIME_PRECISION) === 0)) {
                sub.skip('PENDIENTE: DATETIME(0) no permite fracciones persistidas; modelos/migraciones fuera de alcance');
                return;
            }
            assert.fail('Preparar fixtures fraccionarios si cambia el esquema; no aceptar solo por precisión declarada');
        });
        t.diagnostic(`Sentencias Sequelize realmente ejecutadas (incluye fixtures, login y auditoría): ${sqlReal.length}`);
        log.mock.restore();
    } finally {
        try {
            if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        } finally { await entorno.cerrar(); }
    }
});
