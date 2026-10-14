import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDITORIA, CATALOGO_AUDITORIA } from '../src/shared/constants/auditoria.js';
import { crearContextoAuditoria, normalizarIpAuditoria, fechaAuditoriaSql,
    fechaAuditoriaIso } from '../src/shared/utils/auditoria-contexto.js';
import { auditoriaContextoMiddleware } from '../src/presentation/middlewares/auditoria-contexto.middleware.js';
import { prepararEventoAuditoria, validarConsultaAuditoria } from '../src/business/validators/auditoria.validator.js';

const privado = 'dato_sintetico_privado_no_registrar';
const contexto = crearContextoAuditoria({ socket: { remoteAddress: '::ffff:192.0.2.1' } });
const responsable = { idUsuario: 1, nombreUsuario: 'admin', idRol: 1 };
const evento = cambios => ({ tipoEvento: 'LOGIN_USUARIO_INEXISTENTE', resultado: 'RECHAZADO',
    causa: 'USUARIO_INEXISTENTE', nombreIngresado: 'noExiste', contexto, ...cambios });
const instante = new Date('2026-10-13T12:34:56.789Z');

test('Contexto: ignora IP, correlación e identidad del body, JWT y cabeceras reenviadas', () => {
    const req = { socket: { remoteAddress: '::ffff:192.0.2.1' }, ip: '198.51.100.1',
        headers: { 'x-forwarded-for': '198.51.100.2', 'x-real-ip': '198.51.100.3', 'x-request-id': privado },
        body: { ip: '198.51.100.4', correlacion: privado, idUsuario: 99 }, cookies: { token: privado } };
    const a = crearContextoAuditoria(req), b = crearContextoAuditoria(req);
    assert.equal(a.direccionIp, '192.0.2.1');
    assert.equal(a.procedenciaIp, 'SOCKET_PEER');
    assert.match(a.correlacion, /^[a-f0-9]{32}$/);
    assert.notEqual(a.correlacion, b.correlacion);
    assert.equal(Object.isFrozen(a), true);
    assert.equal(JSON.stringify(a).includes(privado), false);
    assert.equal('idUsuario' in a, false);
});

test('Contexto: dirección ausente o inválida queda explícitamente indisponible', () => {
    for (const remoteAddress of [undefined, null, '', '192.0.2.1,198.51.100.1', privado]) {
        const data = crearContextoAuditoria({ socket: { remoteAddress } });
        assert.equal(data.direccionIp, null);
        assert.equal(data.procedenciaIp, 'NO_DISPONIBLE');
    }
    assert.equal(crearContextoAuditoria({}).direccionIp, null);
});

test('IP: normalización individual IPv6/IPv4 mapeada sin agrupación de cuotas', () => {
    assert.equal(normalizarIpAuditoria('2001:0DB8:0000:0000:0000:0000:0000:0001'), '2001:db8::1');
    assert.equal(normalizarIpAuditoria('2001:db8::2'), '2001:db8::2');
    assert.equal(normalizarIpAuditoria('fe80::1%ethernet'), 'fe80::1');
    assert.equal(normalizarIpAuditoria('::ffff:c000:201'), '192.0.2.1');
    assert.equal(normalizarIpAuditoria('999.0.0.1'), null);
});

test('Middleware de contexto: no persiste ni responde, crea contexto antes de next', () => {
    let llamadas = 0;
    const req = { socket: { remoteAddress: '::1' } };
    auditoriaContextoMiddleware(req, {}, () => { llamadas++; assert.ok(req.contextoAuditoria); });
    assert.equal(llamadas, 1);
    assert.equal(req.contextoAuditoria.direccionIp, '::1');
});

test('Fechas UTC: conserva milisegundos y normaliza offset sin cambiar el instante', () => {
    assert.equal(fechaAuditoriaSql(instante), '2026-10-13 12:34:56.789');
    assert.equal(fechaAuditoriaSql(new Date('2026-10-13T08:34:56.789-04:00')), '2026-10-13 12:34:56.789');
    assert.equal(fechaAuditoriaIso('2026-10-13 12:34:56.789000'), instante.toISOString());
    for (const date of [new Date('invalida'), new Date('0999-01-01'), new Date('+010000-01-01'), '2026-01-01']) {
        assert.throws(() => fechaAuditoriaSql(date), TypeError);
    }
    for (const text of ['2026-02-30 00:00:00.000000', '2026-10-13T12:34:56.789Z', 'dato_privado']) {
        assert.throws(() => fechaAuditoriaIso(text), TypeError);
    }
});

test('Contrato: login inexistente no fabrica responsable, cuenta, rol ni contador', () => {
    const data = prepararEventoAuditoria(evento(), instante);
    assert.equal(data.id_usuario_responsable, null);
    assert.equal(data.id_usuario_objetivo, null);
    assert.equal(data.id_rol_responsable, null);
    assert.equal(data.nombre_ingresado, 'noExiste');
    assert.equal(data.metadatos, null);
    assert.equal(data.fecha_registro, '2026-10-13 12:34:56.789');
    assert.equal(data.version_formato, 1);
});

test('Contrato: snapshots de usuario y metadatos excluyen secretos y campos personales', () => {
    const fuente = { nombreUsuario: 'vendedor', idRol: 3, estado: true, correoAsignado: true,
        password: privado, password_hash: privado, token: privado, correo: privado, cookie: privado };
    const data = prepararEventoAuditoria(evento({ tipoEvento: 'USUARIO_MODIFICAR', resultado: 'EXITO',
        causa: null, responsable, registro: { tipo: 'USUARIO', id: 4, body: privado },
        antes: fuente, despues: { ...fuente, idRol: 2 }, body: fuente, headers: fuente,
        metadatos: { camposModificados: ['idRol', 'correo'], password: privado,
            detalle: { codigo: privado }, sql: privado, error: privado },
        referencias: [{ tipo: 'USUARIO', id: 4, codigoRecuperacion: privado }] }), instante);
    assert.deepEqual(data.antes, { nombreUsuario: 'vendedor', idRol: 3, estado: true, correoAsignado: true });
    assert.equal(data.despues.idRol, 2);
    assert.deepEqual(data.metadatos, { camposModificados: ['idRol', 'correo'] });
    assert.deepEqual(data.referencias, [{ tipo: 'USUARIO', id: 4 }]);
    assert.equal(JSON.stringify(data).includes(privado), false);
    fuente.idRol = 1;
    assert.equal(data.antes.idRol, 3, 'El snapshot queda separado de la fuente mutable');
});

test('Contrato: cambios de contraseña no admiten antes/después ni HMAC o códigos', () => {
    for (const tipoEvento of ['PASSWORD_CAMBIAR_PROPIA', 'PASSWORD_RESTABLECER_ADMINISTRADOR', 'PASSWORD_RESTABLECER_RECUPERACION']) {
        const data = prepararEventoAuditoria(evento({ tipoEvento, resultado: 'EXITO', causa: null,
            responsable, cuentaObjetivo: responsable, antes: { password: privado, passwordHash: privado },
            despues: { codigo: privado }, metadatos: { hmac: privado, codigo: privado, jwt: privado } }), instante);
        assert.equal(data.antes, null);
        assert.equal(data.despues, null);
        assert.equal(data.metadatos, null);
        assert.equal(JSON.stringify(data).includes(privado), false);
    }
});

test('Contrato: intento 3 y bloqueo son tipos distintos relacionados, sin inferir HTTP', () => {
    const cuentaObjetivo = { idUsuario: 4, nombreUsuario: 'cuenta', idRol: 3 };
    const metadatos = { intentosFallidos: 3, bloqueadoDesde: instante.toISOString(),
        bloqueadoHasta: '2026-10-13T12:44:56.789Z', duracionMinutos: 10 };
    const fallo = prepararEventoAuditoria(evento({ tipoEvento: 'LOGIN_PASSWORD_INCORRECTA',
        causa: 'PASSWORD_INCORRECTA', cuentaObjetivo, metadatos }), instante);
    const bloqueo = prepararEventoAuditoria(evento({ tipoEvento: 'LOGIN_BLOQUEO_GENERADO', resultado: 'EXITO',
        causa: 'BLOQUEO_GENERADO', cuentaObjetivo, idEventoRelacionado: 12, metadatos }), instante);
    assert.equal(fallo.id_usuario_responsable, null);
    assert.equal(bloqueo.id_evento_relacionado, 12);
    assert.equal(fallo.correlacion, bloqueo.correlacion);
    assert.equal(bloqueo.metadatos.duracionMinutos, 10);
    assert.equal(bloqueo.metadatos.bloqueadoHasta, '2026-10-13 12:44:56.789');
});

test('Contrato: rechaza resultados incompatibles, responsables falsos e IP incoherente', () => {
    for (const cambios of [
        { tipoEvento: 'LOGIN_EXITO', resultado: 'RECHAZADO' },
        { tipoEvento: 'ERROR_TECNICO', resultado: 'EXITO' },
        { tipoEvento: 'LOGIN_EXITO', resultado: 'EXITO', responsable: null },
        { responsable: { ...responsable, idRol: 99 } },
        { causa: privado }, { tipoEvento: 'VENTA_REGISTRAR' },
        { contexto: { ...contexto, procedenciaIp: 'PROXY_VERIFICADO' } },
        { contexto: { ...contexto, direccionIp: null } },
        { metadatos: { intentosFallidos: 4 } }, { metadatos: { duracionMinutos: 11 } }
    ]) assert.throws(() => prepararEventoAuditoria(evento(cambios), instante));
});

test('Contrato: acota referencias/textos, no trunca datos obligatorios y sanitiza controles', () => {
    assert.throws(() => prepararEventoAuditoria(evento({ nombreIngresado: 'x'.repeat(61) }), instante));
    assert.throws(() => prepararEventoAuditoria(evento({ referencias:
        Array.from({ length: AUDITORIA.MAX_REFERENCIAS + 1 }, () => ({ tipo: 'USUARIO', id: 1 })) }), instante));
    assert.equal(prepararEventoAuditoria(evento({ nombreIngresado: 'cuenta\r\nsegunda\u0000' }), instante).nombre_ingresado,
        'cuenta  segunda ');
    assert.equal(AUDITORIA.CONSERVACION_MINIMA_MESES, 60);
    assert.equal(AUDITORIA.MAX_JSON_BYTES, 32768);
});

test('Contrato: conciliación sin diferencia no almacena un historial detallado del conteo', () => {
    const data = prepararEventoAuditoria(evento({ tipoEvento: 'INVENTARIO_CONCILIAR', resultado: 'EXITO',
        causa: null, responsable, registro: { tipo: 'EXISTENCIA', id: 8 },
        antes: { saldoContado: 100 }, despues: { saldoContado: 100 },
        metadatos: { ajusteRealizado: false, diferencia: 0, saldoContado: 100, observacion: privado } }), instante);
    assert.equal(data.antes, null);
    assert.equal(data.despues, null);
    assert.deepEqual(data.metadatos, { diferencia: 0, ajusteRealizado: false });
});

test('Consulta interna: defaults y filtros combinables con IP canónica', () => {
    assert.deepEqual(validarConsultaAuditoria(), { pagina: 1, limite: 25 });
    const filtros = validarConsultaAuditoria({ desde: '2026-10-13T00:00:00-04:00',
        hasta: '2026-10-14T00:00:00Z', idUsuarioResponsable: 1, idUsuarioObjetivo: 4,
        tipoRegistro: 'USUARIO', idRegistro: 4, tipoEvento: 'LOGIN_PASSWORD_INCORRECTA',
        modulo: 'AUTENTICACION', accion: 'LOGIN', resultado: 'RECHAZADO',
        direccionIp: '::ffff:192.0.2.1', pagina: 2, limite: 100 });
    assert.equal(filtros.direccionIp, '192.0.2.1');
    assert.equal(filtros.idUsuarioResponsable, 1);
    assert.equal(filtros.idUsuarioObjetivo, 4);
});

test('Consulta interna: rechaza rango inverso, página ilimitada y filtros ambiguos', () => {
    for (const filtros of [{ desde: '2026-10-14T00:00:00Z', hasta: '2026-10-13T00:00:00Z' },
        { pagina: 0 }, { limite: 101 }, { limite: '25' }, { idRegistro: 4 },
        { direccionIp: '192.0.2.1,198.51.100.1' }, { password: privado }, { desde: '2026-10-13' }]) {
        assert.throws(() => validarConsultaAuditoria(filtros));
    }
});

test('Catálogo extensible en código: cubre módulos actuales y CU42, sin eventos futuros activos', () => {
    assert.ok(CATALOGO_AUDITORIA.BITACORA_CONSULTAR);
    for (const tipo of Object.keys(CATALOGO_AUDITORIA)) assert.doesNotMatch(tipo, /^(VENTA|RECETA|REPORTE)_/);
});
