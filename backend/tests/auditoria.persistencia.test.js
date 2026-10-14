import test from 'node:test';
import assert from 'node:assert/strict';

// Capas, generación SQL y transacciones Sequelize reales; solo transporte y
// estado de almacenamiento simulados. No acredita persistencia/concurrencia
// de InnoDB. No se ejecutan migraciones ni conexiones a MySQL.
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'auditoria_fase1_sin_conexion';
const { default: db } = await import('../src/data/models/index.js');
const { bitacoraAuditoriaService } = await import('../src/business/services/bitacora-auditoria.service.js');
const { bitacoraAuditoriaRepository } = await import('../src/data/repositories/bitacora-auditoria.repository.js');
const { crearContextoAuditoria } = await import('../src/shared/utils/auditoria-contexto.js');
const { validarConsultaAuditoria } = await import('../src/business/validators/auditoria.validator.js');

const responsable = { idUsuario: 1, nombreUsuario: 'adminHistorico', idRol: 1 };
const evento = cambios => ({ tipoEvento: 'LOGIN_USUARIO_INEXISTENTE', resultado: 'RECHAZADO',
    causa: 'USUARIO_INEXISTENTE', nombreIngresado: 'inexistente',
    contexto: crearContextoAuditoria({ socket: { remoteAddress: '::ffff:192.0.2.1' } }), ...cambios });
const exito = () => evento({ tipoEvento: 'USUARIO_CREAR', resultado: 'EXITO', causa: null,
    responsable, registro: { tipo: 'USUARIO', id: 4 }, despues: { nombreUsuario: 'nuevo', idRol: 3, estado: true } });

test('Persistencia Fase 1: atomicidad, fallos e índices de consulta con SQL generado sin MySQL', async t => {
    const consultas = [], logs = [];
    let confirmados = [], pendientes, siguienteId = 1, fallarInsert = 0, inserts = 0, commitIncierto = false;
    let controladorLectura;
    const privado = 'dato_sintetico_privado_sql_password_jwt';
    const fallo = new Error(privado);
    fallo.name = 'SequelizeDatabaseError';
    fallo.sql = privado;
    fallo.parameters = { password: privado };
    t.mock.method(console, 'error', data => logs.push(data));
    // Mantener una zona global distinta verifica que las funciones SQL y filtros
    // del módulo no desplacen DATETIME UTC ni cambien configuración de negocio.
    db.sequelize.options.timezone = '-04:00';
    t.mock.method(db.sequelize.connectionManager, 'getConnection', async () => ({ uuid: 'conexion_sintetica' }));
    t.mock.method(db.sequelize.connectionManager, 'releaseConnection', async () => {});
    t.mock.method(db.sequelize.connectionManager, 'destroyConnection', async () => {});
    t.mock.method(db.sequelize, 'query', async (input, options = {}) => {
        const sql = typeof input === 'string' ? input : input.query;
        options = { ...options, model: options.model ?? options.instance?.constructor };
        consultas.push({ sql, bind: typeof input === 'string' ? options.bind : input.bind, options });
        if (/^START TRANSACTION/.test(sql)) { assert.equal(pendientes, undefined); pendientes = structuredClone(confirmados); return []; }
        if (/^COMMIT/.test(sql)) {
            confirmados = pendientes; pendientes = undefined;
            if (commitIncierto) throw new Error('Respuesta de COMMIT sintética perdida');
            return [];
        }
        if (/^ROLLBACK/.test(sql)) { pendientes = undefined; return []; }
        if (/^SET /.test(sql)) return [];
        if (/^SELECT /.test(sql)) {
            assert.ok(controladorLectura, 'Cada SELECT debe tener un resultado simulado explícito');
            return controladorLectura(sql, options);
        }
        assert.match(sql, /^INSERT INTO `bitacora_auditoria`/);
        assert.equal(options.model, db.BitacoraAuditoria);
        assert.ok(options.transaction);
        assert.ok(pendientes);
        inserts++;
        if (inserts === fallarInsert) throw fallo;
        const data = Object.fromEntries(Object.entries(options.instance.get({ plain: true }))
            .map(([campo, valor]) => [campo, valor?.fn === 'STR_TO_DATE' ? valor.args[0] : valor]));
        if (pendientes.some(e => e.correlacion === data.correlacion && e.tipo_evento === data.tipo_evento)) {
            throw new db.Sequelize.UniqueConstraintError({ fields: { correlacion: data.correlacion, tipo_evento: data.tipo_evento } });
        }
        data.id_evento = siguienteId++;
        pendientes.push(data);
        options.instance.setDataValue('id_evento', data.id_evento);
        return [options.instance, 1];
    });
    const reset = () => {
        confirmados = []; pendientes = undefined; consultas.length = 0; logs.length = 0;
        inserts = 0; fallarInsert = 0; commitIncierto = false; controladorLectura = undefined;
    };
    const error503 = error => error.statusCode === 503 && error.details === undefined && !error.message.includes(privado);

    try {
        await t.test('Registro independiente devuelve ID después de commit, sin inventar identidad', async () => {
            reset();
            const id = await bitacoraAuditoriaService.registrar(evento());
            assert.equal(confirmados.length, 1);
            assert.equal(confirmados[0].id_evento, id);
            assert.equal(confirmados[0].id_usuario_responsable, null);
            assert.equal(pendientes, undefined);
            assert.match(consultas.at(-1).sql, /^COMMIT/);
        });

        await t.test('Éxito crítico usa exactamente la transacción externa y no confirma anticipadamente', async () => {
            reset();
            const tipo = exito();
            const instante = new Date('2026-10-13T12:34:56.789Z');
            tipo.fechaEvento = instante;
            await db.sequelize.transaction(async transaction => {
                const id = await bitacoraAuditoriaService.registrar(tipo, { transaction });
                assert.equal(pendientes[0].id_evento, id);
                assert.equal(confirmados.length, 0);
                const insert = consultas.find(q => /^INSERT /.test(q.sql));
                assert.equal(insert.options.transaction, transaction);
                assert.match(insert.sql, /STR_TO_DATE\('2026-10-13 12:34:56.789', '%Y-%m-%d %H:%i:%s.%f'\)/);
                assert.equal(pendientes[0].fecha_evento, '2026-10-13 12:34:56.789');
            });
            assert.equal(confirmados.length, 1);
            assert.equal(consultas.filter(q => /^START TRANSACTION/.test(q.sql)).length, 1);
        });

        await t.test('Rollback posterior del negocio elimina su evento de éxito', async () => {
            reset();
            const errorNegocio = new Error('rollback_sintetico_negocio');
            await assert.rejects(db.sequelize.transaction(async transaction => {
                await bitacoraAuditoriaService.registrar(exito(), { transaction });
                throw errorNegocio;
            }), error => error === errorNegocio);
            assert.equal(confirmados.length, 0);
            assert.equal(pendientes, undefined);
            assert.match(consultas.at(-1).sql, /^ROLLBACK/);
            assert.equal(logs.length, 0, 'Un rollback del caller no es un fallo de escritura de auditoría');
        });

        await t.test('Fallo obligatorio produce 503 seguro y rollback del caller', async () => {
            reset(); fallarInsert = 1;
            await assert.rejects(db.sequelize.transaction(transaction =>
                bitacoraAuditoriaService.registrar(exito(), { transaction })), error503);
            assert.equal(confirmados.length, 0);
            assert.match(consultas.at(-1).sql, /^ROLLBACK/);
            assert.equal(logs.length, 1);
            assert.equal(logs[0].causa, 'PERSISTENCIA');
            assert.equal(JSON.stringify(logs).includes(privado), false);
        });

        await t.test('Sin transacción no puede registrar un éxito crítico ni degradarlo a best effort', async () => {
            reset();
            await assert.rejects(bitacoraAuditoriaService.registrar(exito()), error503);
            await assert.rejects(bitacoraAuditoriaService.intentarRegistrar(exito()), error503);
            assert.equal(consultas.length, 0);
        });

        await t.test('Fallo en el segundo evento revierte el grupo fallo/bloqueo, no la seguridad ya confirmada', async () => {
            reset(); fallarInsert = 2;
            const seguridadConfirmada = { intentosFallidos: 3, bloqueadoHasta: '2026-10-13T12:44:56.789Z' };
            const contexto = crearContextoAuditoria({ socket: { remoteAddress: '192.0.2.1' } });
            const cuentaObjetivo = { idUsuario: 4, nombreUsuario: 'cuenta', idRol: 3 };
            const metadatos = { ...seguridadConfirmada, duracionMinutos: 10 };
            const result = await bitacoraAuditoriaService.intentarRegistrar([
                evento({ contexto, cuentaObjetivo, metadatos, tipoEvento: 'LOGIN_PASSWORD_INCORRECTA', causa: 'PASSWORD_INCORRECTA' }),
                evento({ contexto, cuentaObjetivo, metadatos, tipoEvento: 'LOGIN_BLOQUEO_GENERADO', resultado: 'EXITO', causa: 'BLOQUEO_GENERADO' })
            ]);
            assert.deepEqual(result, { registrado: false, estado: 'NO_CONFIRMADO', ids: [] });
            assert.equal(confirmados.length, 0);
            assert.match(consultas.at(-1).sql, /^ROLLBACK/);
            assert.equal(seguridadConfirmada.intentosFallidos, 3);
            assert.equal(seguridadConfirmada.bloqueadoHasta, '2026-10-13T12:44:56.789Z');
            assert.equal(logs.length, 1, 'No vuelve a intentar auditar su propio error');
        });

        await t.test('Best effort confirmado distingue persistencia de un fallo silenciado', async () => {
            reset();
            const result = await bitacoraAuditoriaService.intentarRegistrar(evento());
            assert.equal(result.registrado, true);
            assert.equal(result.estado, 'CONFIRMADO');
            assert.equal(result.ids.length, 1);
            assert.equal(confirmados[0].id_evento, result.ids[0]);
            assert.match(consultas.at(-1).sql, /^COMMIT/);
        });

        await t.test('Duplicados: rechaza el grupo antes de SQL y el UNIQUE simulado cubre otra captura', async () => {
            reset();
            const tipo = evento();
            await assert.rejects(bitacoraAuditoriaService.registrarEventos([tipo, tipo]), error503);
            assert.equal(consultas.length, 0);
            await bitacoraAuditoriaService.registrar(tipo);
            assert.deepEqual(await bitacoraAuditoriaService.intentarRegistrar(tipo), { registrado: false, estado: 'NO_CONFIRMADO', ids: [] });
            assert.equal(confirmados.length, 1);
            // Nueva solicitud real: correlación nueva, evento independiente.
            await bitacoraAuditoriaService.registrar(evento());
            assert.equal(confirmados.length, 2);
        });

        await t.test('Contratos inválidos no emiten SQL ni diagnósticos con valores privados', async () => {
            reset();
            for (const input of [evento({ nombreIngresado: privado.repeat(5) }), evento({ tipoEvento: privado })]) {
                await assert.rejects(bitacoraAuditoriaService.registrar(input), error503);
            }
            await assert.rejects(bitacoraAuditoriaService.registrarEventos([]), error503);
            const transaction = new db.Sequelize.Transaction(db.sequelize);
            transaction.finished = 'rollback';
            await assert.rejects(bitacoraAuditoriaService.registrar(evento(), { transaction }), error503);
            assert.equal(consultas.length, 0);
            assert.equal(JSON.stringify(logs).includes(privado), false);
        });

        await t.test('COMMIT con respuesta perdida: no afirma ausencia ni repite el evento', async () => {
            reset(); commitIncierto = true;
            const result = await bitacoraAuditoriaService.intentarRegistrar(evento());
            assert.deepEqual(result, { registrado: false, estado: 'NO_CONFIRMADO', ids: [] });
            assert.equal(confirmados.length, 1, 'El transporte simula commit aplicado antes de perder respuesta');
            assert.equal(inserts, 1, 'No hay reintento automático');
            assert.equal(logs.some(log => log.categoria === 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA'), true);
            assert.equal(JSON.stringify(logs).includes(privado), false);
        });

        await t.test('Repository no acepta escrituras fuera de una transacción', async () => {
            reset();
            await assert.rejects(bitacoraAuditoriaRepository.create({ data: {} }), TypeError);
            assert.equal(consultas.length, 0);
        });

        await t.test('Lectura paginada: filtros parametrizados, UTC, total separado y JSON fuera del listado', async () => {
            reset();
            const fila = { id_evento: 7, tipo_evento: 'USUARIO_MODIFICAR', resultado: 'EXITO',
                nombre_usuario_responsable: 'adminHistorico', fecha_registro: '2026-10-13 12:34:56.789000',
                fecha_evento: '2026-10-13 12:34:56.000000' };
            controladorLectura = (sql, options) => {
                assert.equal(options.type, db.Sequelize.QueryTypes.SELECT);
                assert.equal(options.raw, true);
                assert.match(sql, /`id_usuario_responsable` = 1/);
                assert.match(sql, /`id_usuario_objetivo` = 4/);
                assert.match(sql, /`fecha_registro` >= '2026-10-13 04:00:00.000'/);
                assert.match(sql, /`fecha_registro` <= '2026-10-14 00:00:00.000'/);
                assert.match(sql, /`resultado` = 'EXITO'/);
                assert.doesNotMatch(sql, /JOIN/);
                if (/count\(/i.test(sql)) {
                    assert.doesNotMatch(sql, /ORDER BY|LIMIT/);
                    return { count: '42' };
                }
                assert.match(sql, /ORDER BY .*`fecha_registro` DESC, .*`id_evento` DESC LIMIT 25, 25;/);
                assert.doesNotMatch(sql, /`antes`|`despues`|`metadatos`|`referencias`/);
                return [fila];
            };
            const filtros = validarConsultaAuditoria({ pagina: 2, desde: '2026-10-13T00:00:00-04:00',
                hasta: '2026-10-14T00:00:00Z', idUsuarioResponsable: 1, idUsuarioObjetivo: 4,
                modulo: 'USUARIOS', accion: 'MODIFICAR', resultado: 'EXITO' });
            const result = await bitacoraAuditoriaRepository.findAll(filtros);
            assert.equal(result.total, 42);
            assert.equal(result.rows[0].fecha_registro, '2026-10-13T12:34:56.789Z');
            assert.equal(result.rows[0].nombre_usuario_responsable, 'adminHistorico');
            assert.equal(consultas.length, 2);
        });

        await t.test('Filtros de texto se escapan y detalle conserva JSON/referencias sin JOIN a estado actual', async () => {
            reset();
            controladorLectura = (sql, options) => {
                assert.doesNotMatch(sql, /JOIN/);
                if (/count\(/i.test(sql)) return { count: 0 };
                if (options.plain) {
                    assert.match(sql, /`id_evento` = 7/);
                    assert.match(sql, /`antes`, `despues`, `metadatos`, `referencias`/);
                    return { id_evento: 7, antes: { estado: true }, despues: { estado: false },
                        referencias: [{ tipo: 'USUARIO', id: 4 }],
                        fecha_registro: '2026-10-13 12:34:56.789000', fecha_evento: '2026-10-13 12:34:56.789000' };
                }
                assert.match(sql, /`nombre_ingresado` = 'x\\' OR 1=1 --'/);
                return [];
            };
            const lista = await bitacoraAuditoriaRepository.findAll(validarConsultaAuditoria({ nombreIngresado: "x' OR 1=1 --" }));
            assert.deepEqual(lista, { rows: [], total: 0 });
            const detalle = await bitacoraAuditoriaRepository.findById({ idEvento: 7 });
            assert.deepEqual(detalle.despues, { estado: false });
            assert.equal(detalle.fecha_evento, '2026-10-13T12:34:56.789Z');
        });

        await t.test('Fallo de lectura no se transforma en historial vacío; detalle inexistente devuelve null', async () => {
            reset();
            controladorLectura = () => { throw fallo; };
            await assert.rejects(bitacoraAuditoriaRepository.findAll(validarConsultaAuditoria()), error => error === fallo);
            controladorLectura = () => null;
            assert.equal(await bitacoraAuditoriaRepository.findById({ idEvento: 99 }), null);
        });
        t.diagnostic('SQL generado y transporte simulado. Aplicación de migración, privilegios, persistencia y concurrencia MySQL requieren aceptación aislada posterior.');
    } finally { await db.sequelize.close(); }
});
