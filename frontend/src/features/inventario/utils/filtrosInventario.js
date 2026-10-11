import { idValido } from '../../../utils/presentacion.js';

export const validarFiltrosInventario = (filtros) => {
  if (['idMedicamento', 'idExistencia'].some((campo) => filtros[campo] && !idValido(filtros[campo]))) {
    return 'Los identificadores deben ser enteros positivos de hasta 2147483647.';
  }
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    return 'La fecha desde no puede ser posterior a la fecha hasta.';
  }
  return '';
};
