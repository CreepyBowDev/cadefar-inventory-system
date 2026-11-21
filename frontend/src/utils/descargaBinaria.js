import { api } from '../api/api.js';

// 120 s generación + 120 s entrega + 30 s de margen de transporte/admisión.
export const TIMEOUT_EXPORTACION_MS = 270000;
const MIME = {
  PDF: 'application/pdf',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  CSV: 'text/csv'
};
const MENSAJES = new Set([
  'Datos inválidos',
  'La consulta supera 1200 intervalos; elija otra granularidad o un período menor',
  'La exportación supera el límite técnico; reduzca los filtros o utilice otro formato',
  'Generación de exportaciones ocupada; reintente más tarde',
  'Formato no disponible',
  'Se agotó el tiempo de generación; reduzca los filtros o reintente',
  'Error interno del servidor'
]);
const CAMPOS = ['dia', 'mes', 'desde', 'hasta', 'estadoOperacion', 'motivo', 'granularidad', 'formato', 'presentacion', 'grafico', 'metrica', 'idMedicamento', 'idExistencia', 'direccion', 'pagina', 'limite'];
const cabecera = (headers, nombre) => {
  try {
    const valor = typeof headers?.get === 'function' ? headers.get(nombre)
      : Object.entries(headers || {}).find(([clave]) => clave.toLowerCase() === nombre.toLowerCase())?.[1];
    return typeof valor === 'string' ? valor : null;
  } catch { return null; } // Cabecera ausente/inaccesible no es disponibilidad garantizada.
};
const tipoMime = valor => (valor || '').split(';')[0].trim().toLowerCase();
const esJSON = valor => tipoMime(valor) === 'application/json' || tipoMime(valor).endsWith('+json');
const respuestaMismoOrigen = response => {
  try {
    // URL final del transporte, no hostname/configuración del frontend como gate LOCAL.
    return typeof location !== 'undefined' && Boolean(response.request?.responseURL)
      && new URL(response.request.responseURL).origin === location.origin;
  } catch { return false; }
};

const errorSeguro = (message, status, code, errors = [], retryAfter = null) => {
  const error = new Error(message);
  error.name = 'DescargaError';
  Object.assign(error, { status, code, errors, retryAfter });
  // Compatible con getApiErrorMessage y las guardas de sesión existentes.
  if (status !== undefined) error.response = { status, data: { message, ...(errors.length ? { errors } : {}) } };
  return error;
};
const cancelacion = () => errorSeguro('La solicitud fue cancelada.', undefined, 'ERR_CANCELED');
const comprobarCancelacion = signal => { if (signal?.aborted) throw cancelacion(); };
const falloHTTP = async response => {
  const status = response?.status;
  const mensajes = {
    400: 'Datos inválidos', 401: 'La sesión no es válida. Inicia sesión nuevamente.',
    403: 'No tienes autorización para exportar este reporte.',
    413: 'La exportación supera el límite técnico; reduzca los filtros o utilice otro formato',
    503: 'La exportación no está disponible. Reintenta manualmente más tarde.',
    500: 'Error interno del servidor'
  };
  let message = mensajes[status] || 'La respuesta no es un archivo válido.';
  let errors = [];
  let sobre = response?.data;
  if (sobre instanceof Blob) {
    if (sobre.size <= 65536 && (esJSON(sobre.type) || esJSON(cabecera(response.headers, 'Content-Type')))) {
      try { sobre = JSON.parse(await sobre.text()); } catch { sobre = null; }
    } else sobre = null;
  }
  if (sobre && typeof sobre === 'object') {
    if (MENSAJES.has(sobre.message)) message = sobre.message;
    // No copiar el sobre completo, valores rechazados, stack ni detalles internos.
    if (Array.isArray(sobre.errors)) errors = sobre.errors.slice(0, 30).flatMap(issue => {
      if (!Array.isArray(issue?.path) || !issue.path.every(campo => CAMPOS.includes(campo))) return [];
      const texto = issue.message;
      if (typeof texto !== 'string' || texto.length > 300 || /[\x00-\x1f\x7f<>\\]|sequelize|\bSQL\b|\bstack\b|[A-Z]:\//i.test(texto)) return [];
      return [{ path: [...issue.path], message: texto }];
    });
  }
  const retry = cabecera(response?.headers, 'Retry-After');
  return errorSeguro(message, status, 'HTTP_EXPORTACION', errors, retry && /^\d{1,6}$/.test(retry) ? retry : null);
};

const nombreSeguro = (disposition, formato) => {
  if (!disposition || disposition.length > 1024 || /[\x00-\x1f\x7f]/.test(disposition)) return null;
  // El contrato usa filename ASCII. Rechazar ambigüedades/filename* en vez de reinterpretarlas.
  const match = /^attachment;\s*filename=(?:"([^"]+)"|([A-Za-z0-9._-]+))\s*$/i.exec(disposition);
  const nombre = match?.[1] || match?.[2];
  if (!nombre || nombre.length > 180 || !/^[A-Za-z0-9][A-Za-z0-9_-]*\.[A-Za-z0-9]+$/.test(nombre)) return null;
  if (!nombre.toLowerCase().endsWith(`.${formato.toLowerCase()}`)) return null;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(nombre)) return null;
  return nombre;
};

// Recibe y valida únicamente. No crea anchors/object URLs ni activa descargas.
export const recibirArchivo = async (path, params, { fuente, presentacion, formato, signal } = {}) => {
  if (!['ventas', 'compras', 'perdidas', 'movimientos'].includes(fuente)
    || !['TABULAR', 'ESTADISTICA'].includes(presentacion) || !Object.hasOwn(MIME, formato)) {
    throw errorSeguro('La configuración de descarga no es válida.', undefined, 'CONFIGURACION');
  }
  comprobarCancelacion(signal);
  let response;
  try {
    response = await api.get(path, { params, responseType: 'blob', signal, timeout: TIMEOUT_EXPORTACION_MS });
  } catch (error) {
    if (signal?.aborted || error?.code === 'ERR_CANCELED') throw cancelacion();
    if (error?.response) {
      const seguro = await falloHTTP(error.response);
      comprobarCancelacion(signal);
      throw seguro;
    }
    if (['ECONNABORTED', 'ETIMEDOUT'].includes(error?.code)) {
      throw errorSeguro('Se agotó el tiempo de espera de la descarga. Reintenta manualmente.', undefined, 'TIEMPO_AGOTADO');
    }
    throw errorSeguro('No se pudo recibir el archivo. Verifica la conexión y reintenta manualmente.', undefined, 'RED');
  }
  comprobarCancelacion(signal);
  const blob = response.data;
  if (response.status !== 200 || esJSON(cabecera(response.headers, 'Content-Type')) || (blob instanceof Blob && esJSON(blob.type))) {
    const error = await falloHTTP(response);
    comprobarCancelacion(signal);
    throw error;
  }
  if (!(blob instanceof Blob) || blob.size === 0
    || tipoMime(cabecera(response.headers, 'Content-Type')) !== MIME[formato] || tipoMime(blob.type) !== MIME[formato]) {
    throw errorSeguro('El archivo recibido está vacío o tiene un tipo incompatible.', response.status, 'ARCHIVO_INVALIDO');
  }
  const longitud = cabecera(response.headers, 'Content-Length');
  // Content-Encoding puede estar oculto por CORS. Su ausencia NO prueba identidad.
  const encoding = cabecera(response.headers, 'Content-Encoding');
  const comparable = encoding?.trim().toLowerCase() === 'identity' || (encoding === null && respuestaMismoOrigen(response));
  if (longitud !== null && (!/^\d+$/.test(longitud) || (comparable && BigInt(longitud) !== BigInt(blob.size)))) {
    throw errorSeguro('No se pudo validar la longitud del archivo recibido.', response.status, 'LONGITUD_INVALIDA');
  }
  const recibido = nombreSeguro(cabecera(response.headers, 'Content-Disposition'), formato);
  const nombre = recibido || `cadefar-${fuente}-${presentacion.toLowerCase()}.${formato.toLowerCase()}`;
  comprobarCancelacion(signal);
  return { blob, nombre, nombreServidor: Boolean(recibido), mime: MIME[formato], longitudVerificada: comparable && longitud !== null };
};
