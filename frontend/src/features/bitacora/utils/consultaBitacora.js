import { MODULOS_BITACORA, REGISTROS_BITACORA, TIPOS_EVENTO_BITACORA } from './presentacionBitacora.js';

export const ACCIONES_BITACORA = Object.freeze({
  LOGIN: 'Iniciar sesión', BLOQUEAR: 'Bloquear', LOGOUT: 'Cerrar sesión',
  VERIFICAR_SESION: 'Verificar sesión', AUTORIZAR: 'Autorizar', VALIDAR: 'Validar', PROCESAR: 'Procesar',
  SOLICITAR_RECUPERACION: 'Solicitar recuperación', EMITIR_RECUPERACION: 'Emitir recuperación',
  ENVIAR_RECUPERACION: 'Enviar recuperación', RESTABLECER_PASSWORD: 'Restablecer contraseña',
  CAMBIAR_PASSWORD: 'Cambiar contraseña', CREAR: 'Crear', MODIFICAR: 'Modificar', CAMBIAR_ESTADO: 'Cambiar estado',
  CONSULTAR: 'Consultar', AGREGAR: 'Agregar', RETIRAR: 'Retirar', REGISTRAR: 'Registrar', ANULAR: 'Anular',
  AJUSTAR: 'Ajustar', CONCILIAR: 'Conciliar', RETIRAR_VENCIMIENTO: 'Retirar por vencimiento',
  RETIRAR_DANO: 'Retirar por daño', CONSULTAR_DETALLE: 'Consultar detalle'
});
export const RESULTADOS_BITACORA = Object.freeze({ EXITO: 'Éxito', RECHAZADO: 'Rechazado', FALLO: 'Fallo' });
export const LIMITES_BITACORA = [25, 50, 100];
const catalogos = { modulo: MODULOS_BITACORA, accion: ACCIONES_BITACORA,
  tipoEvento: TIPOS_EVENTO_BITACORA, resultado: RESULTADOS_BITACORA, tipoRegistro: REGISTROS_BITACORA };
const campos = ['desde', 'hasta', 'idUsuarioResponsable', 'idUsuarioObjetivo', 'nombreIngresado',
  'direccionIp', 'modulo', 'accion', 'tipoEvento', 'resultado', 'tipoRegistro', 'idRegistro', 'pagina', 'limite'];
const idValido = valor => /^[1-9]\d{0,9}$/.test(valor) && Number(valor) <= 2147483647;

// Comprobar fechas civiles antes de Date evita normalizar silenciosamente 30/02.
const civilValido = valor => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(valor)) return false;
  const fecha = new Date(`${valor}Z`);
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 19) === valor.slice(0, 19);
};
const isoValido = valor => {
  const partes = /^(.*)(Z|[+-]\d{2}:\d{2})$/.exec(valor);
  if (!partes || !civilValido(partes[1]) || !Number.isFinite(Date.parse(valor))) return false;
  const year = new Date(valor).getUTCFullYear();
  return year >= 1000 && year <= 9999;
};
const ipValida = valor => {
  if (valor.length > 45) return false;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(valor)) return valor.split('.').every(n => Number(n) <= 255 && String(Number(n)) === n);
  if (!valor.includes(':') || !/^[\da-f:.]+$/i.test(valor)) return false;
  try { new URL(`http://[${valor}]/`); return true; } catch { return false; }
};

export const validarFiltrosBitacora = filtros => {
  for (const campo of ['pagina', 'idUsuarioResponsable', 'idUsuarioObjetivo', 'idRegistro']) {
    if (filtros[campo] !== undefined && !idValido(filtros[campo])) return 'Los identificadores y la página deben ser enteros positivos, sin ceros iniciales, hasta 2147483647.';
  }
  if (!LIMITES_BITACORA.includes(Number(filtros.limite)) || String(Number(filtros.limite)) !== filtros.limite) return 'Elige 25, 50 o 100 eventos por página.';
  for (const [campo, opciones] of Object.entries(catalogos)) {
    if (filtros[campo] !== undefined && !Object.hasOwn(opciones, filtros[campo])) return `El filtro ${campo} no es válido. Selecciona una opción disponible.`;
  }
  for (const campo of ['desde', 'hasta']) {
    if (filtros[campo] !== undefined && !isoValido(filtros[campo])) return 'Las fechas requieren un instante válido con zona horaria y año UTC entre 1000 y 9999.';
  }
  if (filtros.desde && filtros.hasta && Date.parse(filtros.desde) > Date.parse(filtros.hasta)) return 'La fecha Desde no puede ser posterior a Hasta.';
  if (filtros.idRegistro && !filtros.tipoRegistro) return 'Selecciona el tipo de registro para buscar su identificador.';
  if (filtros.nombreIngresado !== undefined && (filtros.nombreIngresado.length > 60 || /[\u0000-\u001f\u007f]/.test(filtros.nombreIngresado))) return 'El nombre ingresado admite hasta 60 caracteres, sin caracteres de control.';
  if (filtros.direccionIp !== undefined && !ipValida(filtros.direccionIp)) return 'Introduce una dirección IPv4 o IPv6 válida, sin puerto ni zona de interfaz.';
  return '';
};

export const leerConsultaBitacora = search => {
  const params = new URLSearchParams(search);
  const filtros = { pagina: '1', limite: '25' };
  let error = '';
  for (const [campo, valor] of params) {
    if (!campos.includes(campo) || params.getAll(campo).length !== 1) error = 'La URL contiene filtros desconocidos o repetidos. Corrige los criterios con Buscar o usa Limpiar.';
    else filtros[campo] = valor;
  }
  return { filtros, error: error || validarFiltrosBitacora(filtros) };
};

export const serializarConsultaBitacora = filtros => {
  const params = new URLSearchParams();
  for (const campo of campos) {
    if (filtros[campo] !== undefined && filtros[campo] !== '') params.set(campo, String(filtros[campo]));
  }
  return params.toString();
};

export const borradorBitacora = filtros => Object.fromEntries(campos.filter(campo => !['pagina', 'limite'].includes(campo)).map(campo => {
  let valor = filtros[campo] || '';
  if (['desde', 'hasta'].includes(campo) && isoValido(valor)) {
    // Restar cuatro horas y usar métodos UTC: independiente de la zona del equipo.
    valor = new Date(Date.parse(valor) - 4 * 60 * 60 * 1000).toISOString().slice(0, -1);
  }
  return [campo, valor];
}));

export const aplicarBorradorBitacora = (borrador, limite) => {
  const filtros = { pagina: '1', limite };
  for (const campo of campos.filter(campo => !['pagina', 'limite'].includes(campo))) {
    const valor = (borrador[campo] || '').trim();
    if (!valor) continue;
    if (['desde', 'hasta'].includes(campo)) {
      const civil = valor.length === 16 ? `${valor}:00` : valor;
      if (!civilValido(civil)) return { error: 'Introduce fechas y horas válidas en hora de Bolivia.' };
      filtros[campo] = `${civil}-04:00`;
    } else filtros[campo] = valor;
  }
  return { filtros, error: validarFiltrosBitacora(filtros) };
};
