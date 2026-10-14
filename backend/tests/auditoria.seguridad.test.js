import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';

process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'auditoria_fase3_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_jwt_fase3';
process.env.RECOVERY_ENABLED = 'true';
process.env.RECOVERY_CLIENT_IP_SOURCE = 'socket';
process.env.RECOVERY_HMAC_SECRET = 'clave_sintetica_hmac_fase3_de_mas_de_32_bytes';
process.env.MAIL_PROVIDER = 'mock';
process.env.MAIL_FROM = 'pruebas@example.test';
process.env.MAIL_FROM_NAME = 'Pruebas';
const { default: db } = await import('../src/data/models/index.js');
const { usuarioRepository: usuarios } = await import('../src/data/repositories/usuario.repository.js');
const { recuperacionPasswordRepository: recuperaciones } = await import('../src/data/repositories/recuperacion-password.repository.js');
const { recuperacionPasswordService: recovery } = await import('../src/business/services/recuperacion-password.service.js');
const { usuarioService } = await import('../src/business/services/usuario.service.js');
const { crearContextoAuditoriaConexion } = await import('../src/shared/utils/auditoria-contexto.js');
const { calcularClaveIpHmac, normalizarIpRecuperacion } = await import('../src/shared/utils/recuperacion-crypto.js');
const { verificarToken, generarToken } = await import('../src/shared/utils/jwt.js');
const { app } = await import('../src/app.js');
const { OPERACIONES_HTTP_AUDITORIA } = await import('../src/shared/constants/auditoria-operaciones.js');

test('Fase 3: seguridad y auditoría con transacciones Sequelize y almacenamiento simulado', async t => {
    const password = 'Original-123!';
    const nueva = 'Nueva-segura-456!';
    const hash = await bcrypt.hash(password, 4);
    const inicio = { usuarios: [1, 3].map(id => ({ id_usuario: id, id_rol: id, nombre_usuario: `usuario${id}`,
        correo: `usuario${id}@example.test`, estado: true, password_hash: hash, version_credenciales: 0,
        intentos_fallidos_login: 3, bloqueado_hasta: new Date(Date.now() + 600000) })), recuperaciones: [], cuotas: [], eventos: [] };
    let estado, codigo, falloEvento, falloNegocio, despuesCommit, envios, id = 1;
    const pendientes = new Map(), logs = [], solicitudesCuota = [];
    const reset = () => {
        estado = structuredClone(inicio); pendientes.clear(); logs.length = 0; solicitudesCuota.length = 0;
        codigo = undefined; falloEvento = undefined; falloNegocio = undefined; despuesCommit = undefined; envios = 0;
        process.env.RECOVERY_ENABLED = 'true';
    };
    reset();
    const actual = transaction => transaction ? pendientes.get(transaction.id) : estado;
    const sujeto = () => estado.usuarios[1];
    const contexto = () => crearContextoAuditoriaConexion('2001:db8:1234:5678::1');
    const responsable = { idUsuario: 1, idRol: 1, nombreUsuario: 'usuario1' };
    const datosAuditoria = () => ({ contexto: contexto(), responsable });
    const tecnico = () => Object.assign(new Error('secreto_sintetico_no_conservar'), {
        name: 'SequelizeDatabaseError', sql: hash, parameters: { password: nueva } });
    t.mock.method(console, 'error', log => logs.push(log));
    t.mock.method(console, 'warn', () => {});
    t.mock.method(console, 'info', () => {});
    t.mock.method(recovery, 'esperarRespuesta', async () => {});
    t.mock.method(db.sequelize.connectionManager, 'getConnection', async () => ({ uuid: 'sintetica' }));
    t.mock.method(db.sequelize.connectionManager, 'releaseConnection', async () => {});
    t.mock.method(db.sequelize.connectionManager, 'destroyConnection', async () => {});
    t.mock.method(db.sequelize, 'query', async (input, options = {}) => {
        const sql = typeof input === 'string' ? input : input.query;
        const tx = options.transaction;
        if (/^SET /.test(sql)) return [];
        if (/^START TRANSACTION/.test(sql)) { pendientes.set(tx.id, structuredClone(estado)); return []; }
        if (/^ROLLBACK/.test(sql)) { pendientes.delete(tx.id); return []; }
        if (/^COMMIT/.test(sql)) {
            estado = pendientes.get(tx.id); pendientes.delete(tx.id);
            if (despuesCommit) await despuesCommit();
            return [];
        }
        assert.equal(options.type, db.Sequelize.QueryTypes.INSERT);
        assert.equal(options.instance.constructor, db.BitacoraAuditoria);
        assert.ok(actual(tx), 'El INSERT de auditoría comparte un estado transaccional');
        if (options.instance.tipo_evento === falloEvento) throw tecnico();
        const fila = Object.fromEntries(Object.entries(options.instance.get({ plain: true }))
            .map(([campo, valor]) => [campo, valor?.fn === 'STR_TO_DATE' ? valor.args[0] : valor]));
        assert.equal(actual(tx).eventos.some(e => e.tipo_evento === fila.tipo_evento && e.correlacion === fila.correlacion), false);
        fila.id_evento = id++;
        actual(tx).eventos.push(fila); options.instance.setDataValue('id_evento', fila.id_evento);
        return [options.instance, 1];
    });
    const buscar = ({ idUsuario, transaction }) => structuredClone(actual(transaction).usuarios.find(u => u.id_usuario === idUsuario));
    for (const metodo of ['findById', 'findByIdForUpdate', 'findByIdWithPassword', 'findByIdForRecovery', 'findByIdForSession']) {
        t.mock.method(usuarios, metodo, async opciones => buscar(opciones));
    }
    t.mock.method(usuarios, 'findByCorreo', async ({ correo }) => {
        const row = estado.usuarios.find(u => u.correo === correo);
        return row ? { id_usuario: row.id_usuario } : null;
    });
    t.mock.method(usuarios, 'updatePassword', async ({ idUsuario, passwordHash, versionCredenciales, transaction }) => {
        if (falloNegocio === 'password') throw tecnico();
        assert.ok(transaction);
        Object.assign(actual(transaction).usuarios.find(u => u.id_usuario === idUsuario), {
            password_hash: passwordHash, version_credenciales: versionCredenciales,
            intentos_fallidos_login: 0, bloqueado_hasta: null });
    });
    t.mock.method(recuperaciones, 'getCurrentDate', async () => new Date());
    t.mock.method(recuperaciones, 'incrementIpQuota', async ({ ambito, claveIpHmac, transaction }) => {
        solicitudesCuota.push({ ambito, claveIpHmac });
        const rows = actual(transaction).cuotas;
        let row = rows.find(r => r.ambito === ambito);
        if (!row) { row = { ambito, cantidad: 0 }; rows.push(row); }
        row.cantidad++;
        return structuredClone(row);
    });
    t.mock.method(recuperaciones, 'findHistoryByUsuario', async ({ idUsuario, desde, transaction }) =>
        structuredClone(actual(transaction).recuperaciones.filter(r => r.id_usuario === idUsuario && r.fecha_solicitud > desde)
            .sort((a, b) => b.id_recuperacion - a.id_recuperacion)));
    t.mock.method(recuperaciones, 'findLatestByUsuario', async ({ idUsuario, transaction }) =>
        structuredClone(actual(transaction).recuperaciones.filter(r => r.id_usuario === idUsuario).at(-1)));
    t.mock.method(recuperaciones, 'findByIdForUpdate', async ({ idRecuperacion, transaction }) =>
        structuredClone(actual(transaction).recuperaciones.find(r => r.id_recuperacion === idRecuperacion)));
    t.mock.method(recuperaciones, 'create', async ({ values, transaction }) => {
        if (falloNegocio === 'emision') throw tecnico();
        const row = { ...values, id_recuperacion: id++, intentos_fallidos: 0, invalidada_en: null, consumida_en: null };
        actual(transaction).recuperaciones.push(row); return structuredClone(row);
    });
    t.mock.method(recuperaciones, 'updateById', async ({ idRecuperacion, values, transaction }) => {
        if (falloNegocio === 'invalidacion') throw tecnico();
        Object.assign(actual(transaction).recuperaciones.find(r => r.id_recuperacion === idRecuperacion), values);
    });
    t.mock.method(recuperaciones, 'invalidatePendingByUsuario', async ({ idUsuario, invalidadaEn, transaction }) => {
        for (const row of actual(transaction).recuperaciones) if (row.id_usuario === idUsuario && !row.consumida_en && !row.invalidada_en) row.invalidada_en = invalidadaEn;
    });
    const emitir = async (estadoEnvio = 'ACEPTADO', correo = sujeto().correo, falla = false) => recovery.solicitarRecuperacion(
        { correo }, '2001:db8:1234:5678::1', { resolverMock: async mensaje => {
            envios++; codigo = mensaje.text.match(/es (\d{6})/)[1];
            if (falla) throw tecnico();
            return { estado: estadoEnvio };
        } }, contexto());
    const restablecer = (entrada = codigo) => recovery.restablecerPassword({ correo: sujeto().correo,
        codigo: entrada, passwordNueva: nueva }, '2001:db8:1234:5678::1', contexto());
    const own = (entrada = password) => usuarioService.updateOwnPassword(3,
        { passwordActual: entrada, passwordNueva: nueva }, 0,
        { contexto: contexto(), responsable: { idUsuario: 3, idRol: 3, nombreUsuario: 'usuario3' } });
    const eventos = tipo => estado.eventos.filter(e => e.tipo_evento === tipo);
    const errorEsperado = async (operacion, status) => {
        await assert.rejects(operacion, e => e.statusCode === status);
        assert.equal(pendientes.size, 0);
    };
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const request = async (path, status, { method = 'GET', auth, body } = {}) => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
            method, headers: { 'Content-Type': 'application/json', ...(auth ? { Cookie: `token=${auth}` } : {}) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
        const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data));
        return { data, cookie: response.headers.get('set-cookie') };
    };
    const token = idUsuario => generarToken({ idUsuario, idRol: idUsuario, versionCredenciales: 0 });
    try {
        await t.test('Emisión y envío aceptado: tres hechos, sin identidad autenticada ni material de recuperación', async () => {
            reset(); const result = await emitir();
            assert.match(result.message, /^Si el correo/);
            assert.equal(envios, 1); assert.equal(estado.recuperaciones.length, 1);
            assert.deepEqual(estado.eventos.map(e => e.tipo_evento), ['RECUPERACION_SOLICITAR', 'RECUPERACION_EMITIR', 'RECUPERACION_ENVIO']);
            assert.equal(new Set(estado.eventos.map(e => e.correlacion)).size, 1);
            assert.equal(eventos('RECUPERACION_ENVIO')[0].metadatos.estadoEnvio, 'ACEPTADO');
            for (const e of estado.eventos) { assert.equal(e.id_usuario_responsable, null); assert.equal(e.id_usuario_objetivo, 3); }
            const json = JSON.stringify(estado.eventos);
            for (const secreto of [sujeto().correo, codigo, estado.recuperaciones[0].nonce, estado.recuperaciones[0].codigo_hmac, hash]) assert.equal(json.includes(secreto), false);
            assert.equal(solicitudesCuota[0].claveIpHmac, calcularClaveIpHmac({ ambito: 'solicitud',
                ipNormalizada: normalizarIpRecuperacion('2001:db8:1234:5678::1') }));
        });
        await t.test('Envío rechazado invalida; ambiguo o excepción no invalida ni repite', async () => {
            for (const envio of ['RECHAZADO', 'AMBIGUO', 'EXCEPCION']) {
                reset(); await emitir(envio, sujeto().correo, envio === 'EXCEPCION');
                assert.equal(envios, 1);
                assert.equal(Boolean(estado.recuperaciones[0].invalidada_en), envio === 'RECHAZADO');
                assert.equal(eventos('RECUPERACION_ENVIO')[0].causa, envio === 'RECHAZADO' ? 'ENVIO_RECHAZADO' : 'ENVIO_INCIERTO');
            }
        });
        await t.test('Fallo de invalidación tras rechazo conserva respuesta genérica y registra fallo técnico separado', async () => {
            reset(); falloNegocio = 'invalidacion'; await emitir('RECHAZADO');
            assert.equal(eventos('ERROR_TECNICO').length, 1);
            assert.equal(eventos('RECUPERACION_ENVIO').length, 1); assert.equal(envios, 1);
        });
        await t.test('Desconocido, inactivo y límite por cuenta comparten respuesta genérica sin emitir', async () => {
            reset(); const desconocido = await emitir('ACEPTADO', 'ausente@example.test');
            assert.equal(eventos('RECUPERACION_SOLICITAR')[0].causa, 'USUARIO_INEXISTENTE');
            assert.equal(eventos('RECUPERACION_SOLICITAR')[0].id_usuario_objetivo, null);
            reset(); sujeto().estado = false; assert.deepEqual(await emitir(), desconocido);
            assert.equal(eventos('RECUPERACION_SOLICITAR')[0].causa, 'USUARIO_INACTIVO');
            reset(); await emitir(); assert.deepEqual(await emitir(), desconocido);
            assert.equal(eventos('RECUPERACION_SOLICITAR').at(-1).causa, 'LIMITE_CUENTA'); assert.equal(envios, 1);
        });
        await t.test('Fallo del auditor no deshace emisión confirmada ni impide el envío único', async () => {
            for (const tipo of ['RECUPERACION_SOLICITAR', 'RECUPERACION_EMITIR', 'RECUPERACION_ENVIO']) {
                reset(); falloEvento = tipo; await emitir();
                assert.equal(estado.recuperaciones.length, 1); assert.equal(envios, 1);
                assert.equal(eventos(tipo).length, 0); assert.ok(logs.some(l => l.categoria === 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA'));
            }
        });
        await t.test('Rollback de emisión no deja éxito ni envío; cuota IP confirmada se conserva', async () => {
            reset(); falloNegocio = 'emision'; await assert.rejects(() => emitir());
            assert.equal(estado.recuperaciones.length, 0); assert.equal(envios, 0);
            assert.equal(eventos('RECUPERACION_EMITIR').length, 0);
            assert.equal(eventos('ERROR_TECNICO').length, 1); assert.equal(estado.cuotas[0].cantidad, 1);
        });
        await t.test('Cuotas independientes 20/30 e IP HMAC original se conservan ante fallo de auditoría', async () => {
            reset(); estado.cuotas = [{ ambito: 'solicitud', cantidad: 20 }, { ambito: 'restablecimiento', cantidad: 30 }];
            await errorEsperado(() => emitir(), 429);
            await errorEsperado(() => restablecer('000000'), 429);
            assert.equal(eventos('RECUPERACION_SOLICITAR')[0].causa, 'LIMITE_IP');
            assert.equal(eventos('PASSWORD_RESTABLECER_RECUPERACION')[0].causa, 'LIMITE_IP');
            assert.deepEqual(estado.cuotas.map(c => c.cantidad), [21, 31]);
            falloEvento = 'RECUPERACION_SOLICITAR'; await errorEsperado(() => emitir(), 429);
            assert.equal(estado.cuotas[0].cantidad, 22);
        });
        await t.test('Cinco códigos incorrectos confirman intentos e invalidación antes del error auditado', async () => {
            reset(); await emitir();
            const incorrecto = codigo === '000000' ? '111111' : '000000';
            for (let i = 1; i <= 5; i++) {
                await errorEsperado(() => restablecer(incorrecto), 400);
                assert.equal(estado.recuperaciones[0].intentos_fallidos, i);
                assert.equal(eventos('PASSWORD_RESTABLECER_RECUPERACION').at(-1).metadatos.intentosCodigoFallidos, i);
            }
            assert.ok(estado.recuperaciones[0].invalidada_en);
            assert.equal(sujeto().intentos_fallidos_login, 3);
        });
        await t.test('Auditor caído en quinto fallo conserva invalidación y error original', async () => {
            reset(); await emitir(); estado.recuperaciones[0].intentos_fallidos = 4;
            falloEvento = 'PASSWORD_RESTABLECER_RECUPERACION';
            await errorEsperado(() => restablecer(codigo === '000000' ? '111111' : '000000'), 400);
            assert.equal(estado.recuperaciones[0].intentos_fallidos, 5); assert.ok(estado.recuperaciones[0].invalidada_en);
        });
        await t.test('Vencido, utilizado e inexistente conservan el error público con causas privadas diferenciadas', async () => {
            for (const variante of ['vencido', 'utilizado', 'inexistente']) {
                reset(); await emitir();
                if (variante === 'vencido') estado.recuperaciones[0].expira_en = new Date(Date.now() - 1);
                if (variante === 'utilizado') estado.recuperaciones[0].consumida_en = new Date();
                if (variante === 'inexistente') sujeto().correo = 'sin_cuenta@example.test';
                await errorEsperado(() => recovery.restablecerPassword({ correo: 'usuario3@example.test', codigo, passwordNueva: nueva },
                    '2001:db8:1234:5678::1'), 400);
                assert.equal(eventos('PASSWORD_RESTABLECER_RECUPERACION')[0].causa,
                    variante === 'vencido' ? 'CODIGO_VENCIDO' : variante === 'utilizado' ? 'CODIGO_UTILIZADO' : 'USUARIO_INEXISTENTE');
            }
        });
        await t.test('Restablecimiento correcto consume, incrementa versión, elimina bloqueo y audita en la misma transacción', async () => {
            reset(); await emitir(); await restablecer();
            assert.equal(sujeto().version_credenciales, 1); assert.equal(sujeto().bloqueado_hasta, null);
            assert.equal(sujeto().intentos_fallidos_login, 0); assert.ok(estado.recuperaciones[0].consumida_en);
            assert.equal(await bcrypt.compare(nueva, sujeto().password_hash), true);
            assert.equal(eventos('PASSWORD_RESTABLECER_RECUPERACION')[0].resultado, 'EXITO');
            assert.equal(eventos('PASSWORD_RESTABLECER_RECUPERACION')[0].id_usuario_responsable, null);
            await errorEsperado(() => restablecer(), 400);
        });
        await t.test('Auditor obligatorio revierte cambio, versión y consumo de código, preservando cuotas', async () => {
            reset(); await emitir(); falloEvento = 'PASSWORD_RESTABLECER_RECUPERACION';
            await errorEsperado(() => restablecer(), 503);
            assert.equal(sujeto().version_credenciales, 0); assert.equal(sujeto().password_hash, hash);
            assert.equal(estado.recuperaciones[0].consumida_en, null); assert.equal(estado.recuperaciones[0].invalidada_en, null);
            assert.equal(estado.cuotas.find(c => c.ambito === 'restablecimiento').cantidad, 1);
        });
        await t.test('Cambio propio y administrativo: responsable/objetivo distintos y revocación atómica', async () => {
            reset(); await emitir(); const result = await own();
            assert.equal(verificarToken(result.token).versionCredenciales, 1);
            assert.equal(sujeto().version_credenciales, 1); assert.ok(estado.recuperaciones[0].invalidada_en);
            assert.equal(eventos('PASSWORD_CAMBIAR_PROPIA')[0].id_usuario_responsable, 3);
            reset(); await emitir(); await usuarioService.updatePassword(3, { password: nueva }, datosAuditoria());
            const e = eventos('PASSWORD_RESTABLECER_ADMINISTRADOR')[0];
            assert.equal(e.id_usuario_responsable, 1); assert.equal(e.id_usuario_objetivo, 3);
            assert.equal(sujeto().version_credenciales, 1); assert.equal(sujeto().bloqueado_hasta, null);
        });
        await t.test('Contraseña propia incorrecta y sesión desactualizada: rechazo único sin modificar cuenta', async () => {
            reset(); await errorEsperado(() => own('incorrecta'), 401);
            assert.equal(eventos('PASSWORD_CAMBIAR_PROPIA')[0].causa, 'PASSWORD_INCORRECTA');
            assert.equal(sujeto().password_hash, hash);
            reset(); sujeto().version_credenciales = 1; await errorEsperado(() => own(), 401);
            assert.equal(eventos('SESION_INVALIDA').length, 1); assert.equal(sujeto().password_hash, hash);
        });
        await t.test('Rollback de auditoría propia y administrativa preserva password, bloqueo y recuperación', async () => {
            for (const tipo of ['PASSWORD_CAMBIAR_PROPIA', 'PASSWORD_RESTABLECER_ADMINISTRADOR']) {
                reset(); await emitir(); falloEvento = tipo;
                await errorEsperado(() => tipo === 'PASSWORD_CAMBIAR_PROPIA' ? own() : usuarioService.updatePassword(3, { password: nueva }, datosAuditoria()), 503);
                assert.equal(sujeto().password_hash, hash); assert.equal(sujeto().version_credenciales, 0);
                assert.ok(sujeto().bloqueado_hasta); assert.equal(estado.recuperaciones[0].invalidada_en, null);
                assert.equal(eventos(tipo).length, 0);
            }
        });
        await t.test('Commit incierto de cambio propio no devuelve JWT ni repite el éxito', async () => {
            reset(); despuesCommit = () => { despuesCommit = undefined; throw tecnico(); };
            await assert.rejects(() => own());
            assert.equal(eventos('PASSWORD_CAMBIAR_PROPIA').length, 1);
            assert.equal(eventos('ERROR_TECNICO').length, 1);
            assert.equal(eventos('ERROR_TECNICO')[0].metadatos.efecto, 'INCIERTO');
        });
        await t.test('Firma JWT fallida revierte contraseña y recuperaciones antes de auditar el fallo', async () => {
            reset(); await emitir(); const secreto = process.env.JWT_SECRET;
            try {
                delete process.env.JWT_SECRET;
                await assert.rejects(() => own());
            } finally { process.env.JWT_SECRET = secreto; }
            assert.equal(sujeto().password_hash, hash); assert.equal(sujeto().version_credenciales, 0);
            assert.equal(estado.recuperaciones[0].invalidada_en, null);
            assert.equal(eventos('PASSWORD_CAMBIAR_PROPIA').length, 0);
            assert.equal(eventos('ERROR_TECNICO')[0].metadatos.etapa, 'FIRMA_TOKEN');
        });
        await t.test('Commit incierto de emisión: no envía ni afirma éxito, conserva incertidumbre sin reintentar', async () => {
            reset();
            despuesCommit = () => {
                if (estado.recuperaciones.length) { despuesCommit = undefined; throw tecnico(); }
            };
            await assert.rejects(() => emitir());
            assert.equal(estado.recuperaciones.length, 1); assert.equal(envios, 0);
            assert.equal(eventos('RECUPERACION_EMITIR').length, 0);
            assert.equal(eventos('ERROR_TECNICO')[0].metadatos.efecto, 'INCIERTO');
        });
        await t.test('Cambio de credenciales entre preverificación y consumo impide sobrescritura y audita rechazo', async () => {
            reset(); await emitir(); let commits = 0;
            despuesCommit = () => {
                if (++commits === 2) { sujeto().version_credenciales = 1; despuesCommit = undefined; }
            };
            await errorEsperado(() => restablecer(), 400);
            assert.equal(sujeto().password_hash, hash); assert.equal(sujeto().version_credenciales, 1);
            assert.equal(estado.recuperaciones[0].consumida_en, null);
            assert.equal(eventos('PASSWORD_RESTABLECER_RECUPERACION')[0].causa, 'PRECONDICIONES_DESACTUALIZADAS');
        });
        await t.test('Contador de recuperación capturado bajo bloqueo no se relee tras cambio posterior', async () => {
            reset(); await emitir(); let commits = 0;
            despuesCommit = () => {
                if (++commits === 2) { estado.recuperaciones[0].intentos_fallidos = 4; despuesCommit = undefined; }
            };
            await errorEsperado(() => restablecer(codigo === '000000' ? '111111' : '000000'), 400);
            assert.equal(estado.recuperaciones[0].intentos_fallidos, 4);
            assert.equal(eventos('PASSWORD_RESTABLECER_RECUPERACION')[0].metadatos.intentosCodigoFallidos, 1);
        });
        await t.test('Restablecimiento administrativo de cuenta inexistente: rechazo conocido, sin falso error técnico', async () => {
            reset(); await errorEsperado(() => usuarioService.updatePassword(99, { password: nueva }, datosAuditoria()), 404);
            assert.equal(eventos('PASSWORD_RESTABLECER_ADMINISTRADOR')[0].causa, 'NO_ENCONTRADO');
            assert.equal(eventos('ERROR_TECNICO').length, 0);
        });
        await t.test('Seguridad transversal: sesión ausente en plantillas protegidas del catálogo de 46 endpoints', async () => {
            assert.equal(OPERACIONES_HTTP_AUDITORIA.length, 46);
            for (const ruta of OPERACIONES_HTTP_AUDITORIA.filter(r => !r.ruta.startsWith('/api/auth/'))) {
                reset(); await request(ruta.ruta.replaceAll(':id', '3') + '?secreto=no_conservar', 401, { method: ruta.metodo });
                assert.equal(eventos('SESION_AUSENTE').length, 1);
                assert.equal(estado.eventos[0].metadatos.operacionOrigen, ruta.operacion);
                assert.equal(JSON.stringify(estado.eventos).includes('no_conservar'), false);
            }
        });
        await t.test('Rol denegado obtiene identidad verificada; no se confunde con logout ni acepta body', async () => {
            reset(); const result = await request('/api/usuarios/3/password', 403, { method: 'PATCH', auth: token(3), body: { idUsuario: 1, password: nueva } });
            assert.equal(result.cookie, null); assert.equal(eventos('ACCESO_DENEGADO')[0].id_usuario_responsable, 3);
            assert.equal(eventos('ACCESO_DENEGADO')[0].causa, 'ROL_NO_PERMITIDO');
            assert.equal(eventos('PASSWORD_RESTABLECER_ADMINISTRADOR').length, 0);
            falloEvento = 'ACCESO_DENEGADO'; await request('/api/usuarios', 403, { auth: token(3) });
        });
        await t.test('Validación transversal y recuperación deshabilitada conservan respuestas y clasifican causas', async () => {
            reset(); await request('/api/usuarios/me/password', 400, { method: 'PATCH', auth: token(3), body: {} });
            assert.equal(eventos('VALIDACION_RECHAZADA').length, 1);
            process.env.RECOVERY_ENABLED = 'false';
            await request('/api/auth/recuperacion/solicitar', 503, { method: 'POST', body: { correo: sujeto().correo } });
            assert.equal(eventos('RECUPERACION_SOLICITAR')[0].causa, 'RECUPERACION_NO_HABILITADA');
        });
        await t.test('HTTP cambio propio emite cookie solo tras confirmar; rechazo de auditoría no emite cookie', async () => {
            reset(); const result = await request('/api/usuarios/me/password', 200, { method: 'PATCH', auth: token(3),
                body: { passwordActual: password, passwordNueva: nueva } });
            assert.match(result.cookie, /HttpOnly/); assert.equal(eventos('PASSWORD_CAMBIAR_PROPIA').length, 1);
            reset(); falloEvento = 'PASSWORD_CAMBIAR_PROPIA';
            const fallo = await request('/api/usuarios/me/password', 503, { method: 'PATCH', auth: token(3),
                body: { passwordActual: password, passwordNueva: nueva } });
            assert.equal(fallo.cookie, null); assert.equal(sujeto().password_hash, hash);
            assert.equal(eventos('ERROR_TECNICO').length, 0);
        });
        await t.test('Fallo HTTP posterior al restablecimiento administrativo conserva actor y objetivo distintos', async () => {
            reset(); const jsonOriginal = app.response.json;
            const mock = t.mock.method(app.response, 'json', function (...args) {
                if (this.req.originalUrl === '/api/usuarios/3/password' && this.statusCode === 200) throw tecnico();
                return jsonOriginal.apply(this, args);
            });
            try {
                await request('/api/usuarios/3/password', 500, { method: 'PATCH', auth: token(1), body: { password: nueva } });
            } finally { mock.mock.restore(); }
            assert.equal(sujeto().version_credenciales, 1);
            assert.equal(eventos('PASSWORD_RESTABLECER_ADMINISTRADOR').length, 1);
            const error = eventos('ERROR_TECNICO')[0];
            assert.equal(error.id_usuario_responsable, 1); assert.equal(error.id_usuario_objetivo, 3);
            assert.equal(error.metadatos.efecto, 'CONFIRMADO'); assert.equal(error.metadatos.etapa, 'RESPUESTA');
            assert.equal(JSON.stringify(estado.eventos).includes(nueva), false);
            assert.equal(JSON.stringify(logs).includes('secreto_sintetico_no_conservar'), false);
        });
        t.diagnostic('Repositorios de negocio y transporte SQL simulados; auditoría genera INSERT y transacciones Sequelize reales. No acredita persistencia/concurrencia MySQL.');
    } finally {
        await new Promise(resolve => server.close(resolve));
        await db.sequelize.close();
    }
});
