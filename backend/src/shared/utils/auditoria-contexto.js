import { randomBytes } from 'node:crypto';
import { isIP } from 'node:net';

// Es distinta de la agrupación /56 y HMAC usados por las cuotas de CU09.
export const normalizarIpAuditoria = valor => {
    if (typeof valor !== 'string') return null;
    const direccion = valor.split('%')[0]; // La zona de un socket IPv6 no es la IP.
    const version = isIP(direccion);
    if (version === 4) return direccion;
    if (version !== 6) return null;
    const normalizada = new URL(`http://[${direccion}]/`).hostname.slice(1, -1);
    const mapeada = /^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/.exec(normalizada);
    if (!mapeada) return normalizada;
    const alta = parseInt(mapeada[1], 16), baja = parseInt(mapeada[2], 16);
    return `${alta >> 8}.${alta & 255}.${baja >> 8}.${baja & 255}`;
};

// Solo información de conexión. No leer body, cookies, JWT, req.ip ni cabeceras
// reenviadas. Railway todavía no tiene una cadena de confianza aprobada.
export const crearContextoAuditoriaConexion = direccion => {
    const direccionIp = normalizarIpAuditoria(direccion);
    return Object.freeze({
        correlacion: randomBytes(16).toString('hex'),
        direccionIp,
        procedenciaIp: direccionIp ? 'SOCKET_PEER' : 'NO_DISPONIBLE'
    });
};

export const crearContextoAuditoria = req => crearContextoAuditoriaConexion(req.socket?.remoteAddress);

export const fechaAuditoriaSql = fecha => {
    if (!(fecha instanceof Date) || !Number.isFinite(fecha.getTime()) ||
        fecha.getUTCFullYear() < 1000 || fecha.getUTCFullYear() > 9999) {
        throw new TypeError('Instante de auditoría inválido');
    }
    return fecha.toISOString().slice(0, -1).replace('T', ' ');
};

// DATE_FORMAT devuelve texto sin que la configuración global de Sequelize
// reinterprete este DATETIME UTC como hora comercial America/La_Paz.
export const fechaAuditoriaIso = texto => {
    if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/.test(texto)) {
        throw new TypeError('Fecha almacenada de auditoría inválida');
    }
    const iso = `${texto.slice(0, 23).replace(' ', 'T')}Z`;
    if (fechaAuditoriaSql(new Date(iso)) !== texto.slice(0, 23)) {
        throw new TypeError('Fecha almacenada de auditoría inválida');
    }
    return iso;
};
