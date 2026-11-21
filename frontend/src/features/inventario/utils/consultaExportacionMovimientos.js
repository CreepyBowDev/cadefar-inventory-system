import { exigirCamposTextuales, fechaCivilValida, leerParametrosUnicos } from '../../../utils/parametrosHttp.js';

export const serializarExportacionMovimientos = entrada => {
  const params = leerParametrosUnicos(entrada);
  if (typeof params.motivo === 'string') params.motivo = params.motivo.trim();
  exigirCamposTextuales(params, ['idMedicamento', 'idExistencia', 'desde', 'hasta', 'direccion', 'motivo', 'formato', 'presentacion']);
  if (!['PDF', 'XLSX', 'CSV'].includes(params.formato) || params.presentacion !== 'TABULAR') {
    throw new Error('El historial solo admite TABULAR con formato PDF, XLSX o CSV.');
  }
  for (const campo of ['idMedicamento', 'idExistencia']) {
    if (Object.hasOwn(params, campo) && (!/^[1-9]\d{0,9}$/.test(params[campo]) || Number(params[campo]) > 2147483647)) {
      throw new Error('Los identificadores deben ser enteros positivos canónicos hasta 2147483647.');
    }
  }
  for (const campo of ['desde', 'hasta']) {
    if (Object.hasOwn(params, campo) && !fechaCivilValida(params[campo])) throw new Error('Indica fechas civiles válidas entre 1000 y 9999.');
  }
  if (params.desde && params.hasta && params.desde > params.hasta) throw new Error('La fecha desde no puede ser posterior a hasta.');
  if (params.direccion && !['ENTRADA', 'SALIDA'].includes(params.direccion)) throw new Error('Selecciona una dirección válida.');
  if (params.motivo && params.motivo.length > 40) throw new Error('El motivo debe tener entre 1 y 40 caracteres.');
  return new URLSearchParams(params).toString();
};
