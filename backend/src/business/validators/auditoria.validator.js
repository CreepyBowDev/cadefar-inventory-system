import { z } from 'zod';
import { AUDITORIA, CATALOGO_AUDITORIA, CAUSAS_AUDITORIA,
    RESULTADOS_AUDITORIA, TIPOS_REGISTRO_AUDITORIA } from '../../shared/constants/auditoria.js';
import { ROLES } from '../../shared/constants/roles.js';
import { LOGIN_SECURITY } from '../../shared/constants/security.js';
import { RECOVERY_SECURITY } from '../../shared/constants/recuperacion-password.js';
import { OPERACIONES_HTTP_AUDITORIA } from '../../shared/constants/auditoria-operaciones.js';
import { fechaAuditoriaSql, normalizarIpAuditoria } from '../../shared/utils/auditoria-contexto.js';

const entero = z.number().int().min(0).max(2147483647);
const id = entero.min(1);
const rol = z.union(Object.values(ROLES).map(valor => z.literal(valor)));
const texto = max => z.string().max(max).transform(valor => valor.replace(/[\u0000-\u001f\u007f]/g, ' '));
const decimal = z.string().regex(/^\d{1,18}(?:\.\d{1,6})?$/);
const instante = z.string().datetime({ offset: true }).transform(valor => fechaAuditoriaSql(new Date(valor)));
const opcionales = campos => z.object(Object.fromEntries(
    Object.entries(campos).map(([campo, schema]) => [campo, schema.optional()])
));

// Allowlist por perfil, nunca copia genérica de un modelo o body. Correo,
// teléfono y dirección se expresan como cambios, no se conservan sus valores.
const PERFILES = {
    USUARIO: { nombreUsuario: texto(60), idRol: rol, estado: z.boolean(), correoAsignado: z.boolean() },
    PROVEEDOR_LABORATORIO: { nombre: texto(150), estado: z.boolean() },
    PRINCIPIO_ACTIVO: { nombre: texto(150), estado: z.boolean() },
    MEDICAMENTO: { codigoMedicamento: texto(20), nombreComercial: texto(150),
        idProveedorLaboratorio: id, formaFarmaceutica: texto(80), presentacion: texto(150),
        unidadInventario: texto(50), stockMinimo: entero, condicionVenta: texto(40),
        viaAdministracion: texto(80), tipoLiberacion: texto(80), estado: z.boolean() },
    COMPOSICION: { idMedicamento: id, idPrincipioActivo: id, cantidadPrincipioActivo: decimal,
        unidadPrincipioActivo: texto(30), cantidadReferencia: decimal, unidadReferencia: texto(30) },
    COMPRA: { estadoOperacion: z.enum(['CONFIRMADA', 'ANULADA']), total: decimal,
        idProveedorLaboratorio: id, cantidadDetalles: entero },
    EXISTENCIA: { codigoExistencia: texto(30), stockFisico: entero, costoUnitarioPromedio: decimal }
};
const CAMBIOS_SIN_VALOR = {
    USUARIO: ['correo'], PROVEEDOR_LABORATORIO: ['telefono', 'direccion'],
    PRINCIPIO_ACTIVO: ['descripcion']
};

const identidad = z.object({ idUsuario: id, nombreUsuario: texto(60).pipe(z.string().min(1)), idRol: rol });
const registro = z.object({ tipo: z.enum(TIPOS_REGISTRO_AUDITORIA), id });
const contexto = z.object({
    correlacion: z.string().regex(/^[a-f0-9]{32}$/),
    direccionIp: z.string().max(45).nullable(),
    procedenciaIp: z.enum(['SOCKET_PEER', 'NO_DISPONIBLE'])
}).superRefine((data, ctx) => {
    const normalizada = normalizarIpAuditoria(data.direccionIp);
    if ((data.procedenciaIp === 'SOCKET_PEER' && (!normalizada || normalizada !== data.direccionIp)) ||
        (data.procedenciaIp === 'NO_DISPONIBLE' && data.direccionIp !== null)) {
        ctx.addIssue({ code: 'custom', message: 'Contexto IP incoherente' });
    }
});

const base = z.object({
    tipoEvento: z.enum(Object.keys(CATALOGO_AUDITORIA)),
    resultado: z.enum(Object.values(RESULTADOS_AUDITORIA)),
    causa: z.enum(CAUSAS_AUDITORIA).nullish(),
    contexto,
    responsable: identidad.nullish(), cuentaObjetivo: identidad.nullish(),
    nombreIngresado: texto(60).nullish(), registro: registro.nullish(),
    idEventoRelacionado: id.nullish(),
    // Solo Services internos pueden proporcionar el instante observado bajo
    // bloqueo. Controllers no deben copiar fechaEvento desde req.body.
    fechaEvento: z.date().optional()
});

const metadatosSeguridad = {
    intentosFallidos: entero.max(LOGIN_SECURITY.MAX_FAILED_ATTEMPTS),
    intentosCodigoFallidos: entero.max(RECOVERY_SECURITY.MAX_FAILED_ATTEMPTS),
    bloqueadoDesde: instante, bloqueadoHasta: instante,
    duracionMinutos: z.literal(LOGIN_SECURITY.LOCK_MINUTES),
    efecto: z.enum(['CONFIRMADO', 'NO_APLICA', 'INCIERTO']),
    estadoEnvio: z.enum(['ACEPTADO', 'RECHAZADO', 'INCIERTO']),
    operacionOrigen: z.enum([...new Set([...Object.values(CATALOGO_AUDITORIA).map(e => `${e.modulo}.${e.accion}`),
        ...OPERACIONES_HTTP_AUDITORIA.map(e => e.operacion)])]),
    etapa: z.enum(['VERIFICACION', 'FIRMA_TOKEN', 'SEGURIDAD', 'AUDITORIA', 'CONFIRMACION', 'COOKIE', 'RESPUESTA'])
};
const metadatosNegocio = {
    efecto: z.enum(['CONFIRMADO', 'NO_APLICA', 'INCIERTO']),
    cantidadDetalles: entero, cantidadMovimientos: entero, cantidadExistencias: entero,
    cantidadComponentes: entero, cantidadReferenciasOmitidas: entero,
    cantidadRetirada: entero.min(1), diferencia: z.number().int().min(-2147483647).max(2147483647),
    ajusteRealizado: z.boolean(), perdida: decimal,
    modoAnulacion: z.enum(['B1', 'A', 'MIXTO'])
};

const limpiar = (schema, valor) => {
    if (valor === undefined || valor === null) return null;
    const limpio = schema.parse(valor);
    return Object.keys(limpio).length ? limpio : null;
};

export const prepararEventoAuditoria = (entrada, fechaRegistro = new Date()) => {
    const data = base.parse(entrada);
    const definicion = CATALOGO_AUDITORIA[data.tipoEvento];
    const seguridad = ['AUTENTICACION', 'SEGURIDAD'].includes(definicion.modulo) ||
        data.tipoEvento.startsWith('PASSWORD_');
    const campos = PERFILES[definicion.perfil];
    const snapshot = campos ? opcionales(campos) : null;
    // No se permiten snapshots de contraseñas, seguridad ni conciliaciones.
    const antes = snapshot ? limpiar(snapshot, entrada.antes) : null;
    const despues = snapshot ? limpiar(snapshot, entrada.despues) : null;
    const camposPermitidos = [...Object.keys(campos ?? {}), ...(CAMBIOS_SIN_VALOR[definicion.perfil] ?? [])];
    const schemaMetadatos = opcionales({ ...(seguridad ? metadatosSeguridad : metadatosNegocio),
        ...(camposPermitidos.length ? { camposModificados: z.array(z.enum(camposPermitidos)).max(camposPermitidos.length) } : {}),
        ...(['USUARIOS_CONSULTAR', 'USUARIO_CONSULTAR', 'BITACORA_CONSULTAR', 'BITACORA_EVENTO_CONSULTAR'].includes(data.tipoEvento)
            ? { cantidadResultados: entero } : {})
    });
    const metadatos = limpiar(schemaMetadatos, entrada.metadatos);
    const referencias = entrada.referencias == null ? null :
        z.array(registro).max(AUDITORIA.MAX_REFERENCIAS).parse(entrada.referencias);
    const json = { antes, despues, metadatos, referencias };
    const bytes = Object.values(json).reduce((total, valor) => total +
        (valor === null ? 0 : Buffer.byteLength(JSON.stringify(valor), 'utf8')), 0);
    if (bytes > AUDITORIA.MAX_JSON_BYTES) throw new TypeError('Evento de auditoría excede el límite JSON');
    if (data.resultado !== RESULTADOS_AUDITORIA.EXITO && !data.causa) {
        throw new TypeError('Un rechazo o fallo requiere una causa de auditoría');
    }
    const resultadosEspecificos = {
        LOGIN_EXITO: 'EXITO', LOGIN_PASSWORD_INCORRECTA: 'RECHAZADO',
        LOGIN_USUARIO_INEXISTENTE: 'RECHAZADO', LOGIN_USUARIO_INACTIVO: 'RECHAZADO',
        LOGIN_BLOQUEO_GENERADO: 'EXITO', LOGIN_INTENTO_BLOQUEADO: 'RECHAZADO',
        SESION_AUSENTE: 'RECHAZADO', TOKEN_INVALIDO: 'RECHAZADO', TOKEN_EXPIRADO: 'RECHAZADO',
        SESION_INVALIDA: 'RECHAZADO', ACCESO_DENEGADO: 'RECHAZADO',
        VALIDACION_RECHAZADA: 'RECHAZADO', OPERACION_RECHAZADA: 'RECHAZADO', ERROR_TECNICO: 'FALLO'
    };
    if (resultadosEspecificos[data.tipoEvento] && resultadosEspecificos[data.tipoEvento] !== data.resultado) {
        throw new TypeError('Resultado incompatible con el tipo de evento');
    }
    if (data.resultado === 'EXITO') {
        const sinResponsable = ['LOGIN_BLOQUEO_GENERADO', 'RECUPERACION_SOLICITAR',
            'RECUPERACION_EMITIR', 'RECUPERACION_ENVIO', 'PASSWORD_RESTABLECER_RECUPERACION'];
        if (!sinResponsable.includes(data.tipoEvento) && !data.responsable) {
            throw new TypeError('El éxito requiere identidad comprobada del responsable');
        }
        if (definicion.perfil && data.registro?.tipo !== definicion.perfil) {
            throw new TypeError('El éxito requiere referencia al registro de su operación');
        }
        if (['LOGIN_BLOQUEO_GENERADO', 'RECUPERACION_EMITIR', 'PASSWORD_RESTABLECER_RECUPERACION'].includes(data.tipoEvento) && !data.cuentaObjetivo) {
            throw new TypeError('El evento requiere cuenta objetivo comprobada');
        }
    }
    return {
        tipo_evento: data.tipoEvento, modulo: definicion.modulo, accion: definicion.accion,
        resultado: data.resultado, causa: data.causa ?? null,
        fecha_registro: fechaAuditoriaSql(fechaRegistro),
        fecha_evento: fechaAuditoriaSql(data.fechaEvento ?? fechaRegistro),
        id_usuario_responsable: data.responsable?.idUsuario ?? null,
        nombre_usuario_responsable: data.responsable?.nombreUsuario ?? null,
        id_rol_responsable: data.responsable?.idRol ?? null,
        id_usuario_objetivo: data.cuentaObjetivo?.idUsuario ?? null,
        nombre_usuario_objetivo: data.cuentaObjetivo?.nombreUsuario ?? null,
        id_rol_objetivo: data.cuentaObjetivo?.idRol ?? null,
        nombre_ingresado: data.nombreIngresado ?? null,
        direccion_ip: data.contexto.direccionIp, procedencia_ip: data.contexto.procedenciaIp,
        tipo_registro: data.registro?.tipo ?? null, id_registro: data.registro?.id ?? null,
        correlacion: data.contexto.correlacion, id_evento_relacionado: data.idEventoRelacionado ?? null,
        version_formato: AUDITORIA.VERSION_FORMATO, ...json
    };
};

// Contrato interno de lectura. El adaptador HTTP convierte únicamente enteros
// decimales canónicos; este contrato sigue rechazando coerciones implícitas.
export const validarConsultaAuditoria = entrada => {
    const fechaFiltro = z.string().datetime({ offset: true }).refine(valor => {
        const fecha = new Date(valor);
        return Number.isFinite(fecha.getTime()) && fecha.getUTCFullYear() >= 1000 && fecha.getUTCFullYear() <= 9999;
    }, 'La fecha debe estar dentro del rango DATETIME UTC');
    const filtros = z.object({
        desde: fechaFiltro.optional(),
        hasta: fechaFiltro.optional(),
        idUsuarioResponsable: id.optional(), idUsuarioObjetivo: id.optional(),
        nombreIngresado: texto(60).optional(), direccionIp: z.string().max(45).optional(),
        modulo: z.enum([...new Set(Object.values(CATALOGO_AUDITORIA).map(e => e.modulo))]).optional(),
        accion: z.enum([...new Set(Object.values(CATALOGO_AUDITORIA).map(e => e.accion))]).optional(),
        tipoEvento: z.enum(Object.keys(CATALOGO_AUDITORIA)).optional(),
        resultado: z.enum(Object.values(RESULTADOS_AUDITORIA)).optional(),
        tipoRegistro: z.enum(TIPOS_REGISTRO_AUDITORIA).optional(), idRegistro: id.optional(),
        pagina: id.default(1), limite: id.max(AUDITORIA.PAGINA_MAXIMA).default(AUDITORIA.PAGINA_PREDETERMINADA)
    }).strict().parse(entrada ?? {});
    if (filtros.desde && filtros.hasta && new Date(filtros.desde) > new Date(filtros.hasta)) {
        throw new TypeError('Rango temporal de auditoría inválido');
    }
    if (filtros.direccionIp !== undefined) {
        const ip = normalizarIpAuditoria(filtros.direccionIp);
        if (!ip) throw new TypeError('Filtro IP de auditoría inválido');
        filtros.direccionIp = ip;
    }
    if (filtros.idRegistro !== undefined && filtros.tipoRegistro === undefined) {
        throw new TypeError('El filtro de registro requiere tipo');
    }
    return filtros;
};

const idHttp = z.string().max(10).regex(/^[1-9]\d*$/).transform(Number).pipe(id);
const numericosConsulta = ['idUsuarioResponsable', 'idUsuarioObjetivo', 'idRegistro', 'pagina', 'limite'];
const camposConsulta = ['desde', 'hasta', ...numericosConsulta, 'nombreIngresado', 'direccionIp',
    'modulo', 'accion', 'tipoEvento', 'resultado', 'tipoRegistro'];
const consultaHttp = z.object(Object.fromEntries(camposConsulta.map(campo =>
    [campo, (numericosConsulta.includes(campo) ? idHttp : z.string()).optional()]))).strict();

export const validarConsultaAuditoriaHttp = entrada => {
    const filtros = consultaHttp.parse(entrada);
    return validarConsultaAuditoria(filtros);
};

export const validarIdEventoAuditoriaHttp = entrada =>
    z.object({ idEvento: idHttp }).strict().parse(entrada).idEvento;

export const validarDetalleAuditoriaHttp = entrada => z.object({}).strict().parse(entrada);
