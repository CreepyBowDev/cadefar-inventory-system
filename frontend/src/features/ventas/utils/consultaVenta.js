import { idValido } from '../../../utils/presentacion.js';

const CAMPOS = ['idVenta', 'idUsuario', 'estadoOperacion', 'campoFecha', 'desde', 'hasta', 'pagina', 'limite'];
const fechaValida = (valor) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  return anio >= 1000 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= new Date(Date.UTC(anio, mes, 0)).getUTCDate();
};

export const serializarConsultaVenta = (filtros) => {
  const params = new URLSearchParams();
  CAMPOS.forEach((campo) => {
    const valor = String(filtros[campo] ?? '').trim();
    if (valor) params.set(campo, valor);
  });
  return params.toString();
};

export const validarFiltrosVenta = (filtros) => {
  if (Object.keys(filtros).some(campo => !CAMPOS.includes(campo))) return 'La consulta contiene filtros no admitidos. Limpia los filtros para continuar.';
  for (const [campo, nombre] of [['idVenta', 'identificador de venta'], ['idUsuario', 'identificador del responsable'], ['pagina', 'número de página'], ['limite', 'límite por página']]) {
    if (filtros[campo] && !idValido(filtros[campo])) return `El ${nombre} debe ser un entero positivo válido.`;
  }
  if (Number(filtros.limite) > 100) return 'El límite por página no puede superar 100.';
  if (filtros.estadoOperacion && !['PENDIENTE', 'CONFIRMADA', 'ANULADA'].includes(filtros.estadoOperacion)) return 'Selecciona un estado de venta válido.';
  if (filtros.campoFecha && !['fechaRegistro', 'fechaVenta'].includes(filtros.campoFecha)) return 'Selecciona fecha de registro o fecha efectiva de venta.';
  if (['desde', 'hasta'].some(campo => filtros[campo] && !fechaValida(filtros[campo]))) return 'Indica fechas válidas entre los años 1000 y 9999.';
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) return 'La fecha desde no puede ser posterior a hasta.';
  return '';
};

export const leerConsultaVenta = (query) => {
  const params = new URLSearchParams(query);
  const filtros = { pagina: '1', limite: '25', campoFecha: 'fechaRegistro', ...Object.fromEntries(params) };
  if ([...params.keys()].some(campo => params.getAll(campo).length > 1)) return { filtros, error: 'La consulta contiene filtros repetidos. Limpia los filtros para continuar.' };
  if ([...params.values()].some(valor => !valor.trim())) return { filtros, error: 'La consulta contiene filtros vacíos. Limpia los filtros para continuar.' };
  return { filtros, error: validarFiltrosVenta(filtros) };
};
