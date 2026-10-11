import { idValido } from '../../../utils/presentacion.js';

export const normalizarFiltrosCompra = (filtros) => filtros.claveOperacion
  ? { ...filtros, claveOperacion: filtros.claveOperacion.toLowerCase() } : filtros;

export const validarFiltrosCompra = (filtros) => {
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    return 'La fecha desde no puede ser posterior a la fecha hasta.';
  }
  if (filtros.idProveedorLaboratorio && !idValido(filtros.idProveedorLaboratorio)) {
    return 'El ID del proveedor debe ser un entero positivo de hasta 2147483647.';
  }
  if (filtros.claveOperacion && !/^[A-Za-z0-9_-]{1,64}$/.test(filtros.claveOperacion)) {
    return 'La clave admite hasta 64 letras sin acentos, números, guion y guion bajo, sin espacios internos.';
  }
  return '';
};
