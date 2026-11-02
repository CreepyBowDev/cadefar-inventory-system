import { getApiErrorMessage } from '../../../utils/apiError.js';

export const mensajeErrorReceta = (failure, accion) => {
  const codigo = failure.response?.status;
  if (codigo === 401) return 'Tu sesión ya no es válida. Inicia sesión nuevamente.';
  if (codigo === 403) return 'No tienes autorización para esta operación de recetas.';
  if (!codigo || codigo >= 500) return `No fue posible comprobar el resultado ${accion === 'registro' ? 'del registro' : 'de la revisión'}. Consulta el estado de la venta y sus recetas antes de otro envío.`;
  return getApiErrorMessage(failure);
};
