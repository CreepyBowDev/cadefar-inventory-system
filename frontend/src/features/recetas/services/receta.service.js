import { api } from '../../../api/api.js';

// La API consulta recetas por venta y reserva sus GET al Regente.
export const getRecetas = async (idVenta, filtros = {}) => {
  const params = new URLSearchParams();
  ['pagina', 'limite'].forEach((campo) => {
    const valor = String(filtros[campo] ?? '').trim();
    if (valor) params.set(campo, valor);
  });
  const response = await api.get(`/ventas/${idVenta}/recetas`, { params });
  return response.data;
};

export const getReceta = async (idVenta, idReceta) => {
  const response = await api.get(`/ventas/${idVenta}/recetas/${idReceta}`);
  return response.data;
};

export const createReceta = async (idVenta, {
  fechaReceta, nombrePaciente, documentoPaciente, nombreMedico, modalidad,
  numeroReceta, observacion, idsDetallesVenta
}) => {
  // Solo formulario: no enviar archivos, datos de revisión ni campos de auditoría.
  const data = { fechaReceta, nombrePaciente, documentoPaciente, nombreMedico, modalidad };
  if (numeroReceta !== undefined) data.numeroReceta = numeroReceta;
  if (observacion !== undefined) data.observacion = observacion;
  if (idsDetallesVenta !== undefined) data.idsDetallesVenta = idsDetallesVenta;
  const response = await api.post(`/ventas/${idVenta}/recetas`, data);
  return response.data;
};

export const revisarReceta = async (idVenta, idReceta, { resultadoRevision, observacion }) => {
  const data = { resultadoRevision };
  // Omitir conserva la observación previa; null la elimina según el contrato.
  if (observacion !== undefined) data.observacion = observacion;
  const response = await api.post(`/ventas/${idVenta}/recetas/${idReceta}/revisar`, data);
  return response.data;
};
