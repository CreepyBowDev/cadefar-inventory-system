const CAMPOS_TEMPORALES = ['dia', 'mes', 'desde', 'hasta'];
const CAMPOS_COMUNES = [...CAMPOS_TEMPORALES, 'pagina', 'limite'];
const OPCIONES = {
  ventas: { campo: 'estadoOperacion', valores: ['CONFIRMADA', 'PENDIENTE', 'ANULADA'] },
  compras: { campo: 'estadoOperacion', valores: ['CONFIRMADA', 'ANULADA'] },
  perdidas: { campo: 'motivo', valores: ['VENCIMIENTO', 'DAÑO'] }
};

// Calendario gregoriano civil: no interpretar estos valores como instantes UTC.
const fechaValida = valor => {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const bisiesto = anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0);
  const dias = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= dias[mes - 1];
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
