import { api } from '../../../api/api.js';

const basePath = '/medicamentos';

export const getMedicamentos = async ({ codigoMedicamento, nombreComercial, idPrincipioActivo = [] } = {}) => {
  const params = new URLSearchParams();
  if (codigoMedicamento?.trim()) params.set('codigoMedicamento', codigoMedicamento.trim());
  if (nombreComercial?.trim()) params.set('nombreComercial', nombreComercial.trim());
  idPrincipioActivo.forEach((id) => params.append('idPrincipioActivo', String(id)));
  const response = await api.get(basePath, { params });
  return response.data.data;
};

export const getMedicamento = async (idMedicamento) => {
  const response = await api.get(`${basePath}/${idMedicamento}`);
  return response.data.data;
};
export const createMedicamento = async (data) => {
  const response = await api.post(basePath, data);
  return response.data.data;
};
export const updateMedicamento = async (idMedicamento, data) => {
  const response = await api.patch(`${basePath}/${idMedicamento}`, data);
  return response.data.data;
};
export const updateEstadoMedicamento = async (idMedicamento, estado) => {
  const response = await api.patch(`${basePath}/${idMedicamento}/estado`, { estado });
  return response.data.data;
};
export const getComposicionMedicamento = async (idMedicamento) => {
  const response = await api.get(`${basePath}/${idMedicamento}/composicion`);
  return response.data.data;
};
export const createComposicion = async (idMedicamento, data) => {
  const response = await api.post(`${basePath}/${idMedicamento}/composicion`, data);
  return response.data.data;
};
export const updateComposicion = async (idMedicamento, idComposicion, data) => {
  const response = await api.patch(`${basePath}/${idMedicamento}/composicion/${idComposicion}`, data);
  return response.data.data;
};
export const deleteComposicion = async (idMedicamento, idComposicion) => {
  const response = await api.delete(`${basePath}/${idMedicamento}/composicion/${idComposicion}`);
  return response.data.message;
};
