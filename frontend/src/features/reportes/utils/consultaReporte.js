import { exigirCamposTextuales, fechaCivilValida as fechaValida, leerParametrosUnicos } from '../../../utils/parametrosHttp.js';

const CAMPOS_TEMPORALES = ['dia', 'mes', 'desde', 'hasta'];
const CAMPOS_COMUNES = [...CAMPOS_TEMPORALES, 'pagina', 'limite'];
const OPCIONES = {
  ventas: { campo: 'estadoOperacion', valores: ['CONFIRMADA', 'PENDIENTE', 'ANULADA'] },
  compras: { campo: 'estadoOperacion', valores: ['CONFIRMADA', 'ANULADA'] },
  perdidas: { campo: 'motivo', valores: ['VENCIMIENTO', 'DAÑO'] }
};

const enteroValido = (valor, maximo) => /^[1-9]\d{0,9}$/.test(valor) && Number(valor) <= maximo;
const invalida = error => ({ estado: 'invalida', habilitada: false, filtros: null, error });

const analizarFiltros = (entrada, tipo, permitirSinPeriodo) => {
  if (!Object.hasOwn(OPCIONES, tipo)) return invalida('Selecciona un reporte válido.');
  if (!entrada || ![Object.prototype, null].includes(Object.getPrototypeOf(entrada))) {
    return invalida('Los filtros deben ser un objeto de valores textuales.');
  }
  const opcion = OPCIONES[tipo];
  const campos = [...CAMPOS_COMUNES, opcion.campo];
  for (const [campo, valor] of Object.entries(entrada)) {
    if (!campos.includes(campo)) return invalida('La consulta contiene filtros no admitidos. Corrige la URL o limpia los filtros.');
    if (typeof valor !== 'string' || !valor || valor !== valor.trim()) return invalida('La consulta contiene filtros vacíos, no textuales o con espacios exteriores.');
  }
  const filtros = { pagina: '1', limite: '25', ...entrada };
  if (!enteroValido(filtros.pagina, 2147483647)) return invalida('La página debe ser un entero positivo sin ceros iniciales, hasta 2147483647.');
  if (!enteroValido(filtros.limite, 100)) return invalida('El límite debe ser un entero entre 1 y 100, sin ceros iniciales.');
  if (Object.hasOwn(filtros, opcion.campo) && !opcion.valores.includes(filtros[opcion.campo])) {
    return invalida(`Selecciona un valor válido para ${opcion.campo}; para Todos omite el filtro.`);
  }
  const tiene = campo => Object.hasOwn(filtros, campo);
  const modalidades = Number(tiene('dia')) + Number(tiene('mes')) + Number(tiene('desde') || tiene('hasta'));
  if (modalidades === 0) {
    return permitirSinPeriodo
      ? { estado: 'sinPeriodo', habilitada: false, filtros, error: '' }
      : invalida('Selecciona un período antes de buscar.');
  }
  if (modalidades !== 1) return invalida('Indica solo día, mes o período desde/hasta, sin mezclarlos.');
  if (tiene('desde') !== tiene('hasta')) return invalida('Indica desde y hasta juntos para consultar un período cerrado.');
  for (const campo of ['dia', 'desde', 'hasta']) {
    if (tiene(campo) && !fechaValida(filtros[campo])) return invalida('Indica fechas civiles válidas entre los años 1000 y 9999 (YYYY-MM-DD).');
  }
  if (tiene('mes') && (!/^[1-9]\d{3}-\d{2}$/.test(filtros.mes) || !fechaValida(`${filtros.mes}-01`))) {
    return invalida('Indica un mes válido entre los años 1000 y 9999 (YYYY-MM).');
  }
  if (tiene('desde') && filtros.desde > filtros.hasta) return invalida('La fecha desde no puede ser posterior a hasta.');
  return { estado: 'valida', habilitada: true, filtros, error: '' };
};

// La ausencia inicial no es un error de URL, pero nunca habilita useConsulta.
export const leerConsultaReporte = (query, tipo) => {
  if (typeof query !== 'string' && !(query instanceof URLSearchParams)) return invalida('La consulta debe ser texto de URL o URLSearchParams.');
  const params = new URLSearchParams(query);
  if ([...params.keys()].some(campo => params.getAll(campo).length !== 1)) {
    return invalida('La consulta contiene filtros repetidos. Corrige la URL o limpia los filtros.');
  }
  return analizarFiltros(Object.fromEntries(params), tipo, true);
};

// Filtros aplicados/HTTP, no borrador: omitir opcionales sin selección en vez de usar ''.
export const validarFiltrosReporte = (filtros, tipo) => analizarFiltros(filtros, tipo, false).error;

export const serializarConsultaReporte = (filtros, tipo) => {
  const consulta = analizarFiltros(filtros, tipo, false);
  if (!consulta.habilitada) throw new Error(consulta.error);
  const params = new URLSearchParams();
  for (const campo of [...CAMPOS_COMUNES, OPCIONES[tipo].campo]) {
    if (Object.hasOwn(consulta.filtros, campo)) params.set(campo, consulta.filtros[campo]);
  }
  return params.toString();
};

const GRANULARIDADES = ['DIA', 'MES', 'ANIO'];
const exigirOpcion = (valor, opciones, campo) => {
  if (!opciones.includes(valor)) throw new Error(`Selecciona un valor válido para ${campo}.`);
};

// Solo cuenta intervalos naturales intersectados; no materializa series ni usa Date.
const validarIntervalos = params => {
  exigirOpcion(params.granularidad, GRANULARIDADES, 'granularidad');
  const desde = params.dia || (params.mes ? `${params.mes}-01` : params.desde);
  const hasta = params.dia || (params.mes ? `${params.mes}-01` : params.hasta);
  const partes = valor => valor.split('-').map(Number);
  const [a, m, d] = partes(desde);
  const [b, n, e] = partes(hasta);
  // Días anteriores al año/mes/día: la aritmética entera es exacta en 1000..9999.
  const ordinal = (anio, mes, dia) => {
    const anterior = anio - 1;
    const bisiesto = anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0);
    const acumulados = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    return 365 * anterior + Math.floor(anterior / 4) - Math.floor(anterior / 100)
      + Math.floor(anterior / 400) + acumulados[mes - 1] + (bisiesto && mes > 2 ? 1 : 0) + dia;
  };
  const diasMes = params.mes
    ? [31, fechaValida(`${params.mes.slice(0, 4)}-02-29`) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
    : null;
  const cantidad = params.granularidad === 'ANIO' ? b - a + 1
    : params.granularidad === 'MES' ? (b - a) * 12 + n - m + 1
      : diasMes ?? ordinal(b, n, e) - ordinal(a, m, d) + 1;
  if (cantidad > 1200) throw new Error('La consulta supera 1200 intervalos; elija otra granularidad o un período menor.');
};

const prepararOperacion = (entrada, tipo, exportacion) => {
  if (!Object.hasOwn(OPCIONES, tipo)) throw new Error('Selecciona un reporte válido.');
  const params = leerParametrosUnicos(entrada);
  const propios = [...CAMPOS_TEMPORALES, OPCIONES[tipo].campo];
  const adicionales = exportacion ? ['formato', 'presentacion', 'granularidad', 'grafico', 'metrica'] : ['granularidad'];
  exigirCamposTextuales(params, [...propios, ...adicionales]);
  const filtros = Object.fromEntries(Object.entries(params).filter(([campo]) => propios.includes(campo)));
  const error = validarFiltrosReporte(filtros, tipo);
  if (error) throw new Error(error);
  if (!exportacion) validarIntervalos(params);
  else {
    exigirOpcion(params.formato, ['PDF', 'XLSX', 'CSV'], 'formato');
    exigirOpcion(params.presentacion, ['TABULAR', 'ESTADISTICA'], 'presentacion');
    const tiene = campo => Object.hasOwn(params, campo);
    if (params.presentacion === 'TABULAR') {
      if (['granularidad', 'grafico', 'metrica'].some(tiene)) throw new Error('TABULAR no admite granularidad, gráfico ni métrica.');
    } else {
      validarIntervalos(params);
      if (params.formato === 'CSV') {
        if (tiene('grafico') || tiene('metrica')) throw new Error('CSV no admite gráfico ni métrica.');
      } else {
        exigirOpcion(params.grafico, ['BARRAS', 'LINEAS', 'SECTORES'], 'grafico');
        exigirOpcion(params.metrica, tipo === 'perdidas' ? ['CANTIDAD_RETIROS', 'PERDIDA'] : ['CANTIDAD', 'IMPORTE'], 'metrica');
      }
    }
  }
  return new URLSearchParams(params).toString();
};

export const serializarEstadisticasReporte = (params, tipo) => prepararOperacion(params, tipo, false);
export const serializarExportacionReporte = (params, tipo) => prepararOperacion(params, tipo, true);

// Lector opt-in para fases visuales: no cambia leerConsultaReporte ni el hook actual.
// vista/uiGranularidad son UI; filtros mantiene paginación, filtrosAplicados nunca.
export const leerConsultaReporteAmpliada = (query, tipo) => {
  try {
    if (typeof query !== 'string' && !(query instanceof URLSearchParams)) throw new Error('La consulta debe ser una URL.');
    const params = leerParametrosUnicos(query);
    const { vista = 'CONSULTA', uiGranularidad, ...http } = params;
    exigirOpcion(vista, ['CONSULTA', 'ESTADISTICAS'], 'vista');
    if (vista === 'ESTADISTICAS') exigirOpcion(uiGranularidad, GRANULARIDADES, 'uiGranularidad');
    else if (uiGranularidad !== undefined) throw new Error('uiGranularidad solo corresponde a la vista ESTADISTICAS.');
    const consulta = leerConsultaReporte(new URLSearchParams(http), tipo);
    if (consulta.estado === 'invalida') return consulta;
    const { pagina, limite, ...filtrosAplicados } = consulta.filtros;
    return { ...consulta, ui: { vista, ...(uiGranularidad ? { uiGranularidad } : {}) }, filtrosAplicados };
  } catch (error) {
    return invalida(error.message);
  }
};
