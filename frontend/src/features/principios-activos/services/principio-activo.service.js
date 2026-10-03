import { api } from '../../../api/api.js';

const basePath = '/principios-activos';
export const getPrincipiosActivos = async () => {
  const response = await api.get(basePath);
  return response.data.data;
};
export const getPrincipioActivo = async (idPrincipioActivo) => {
  const response = await api.get(`${basePath}/${idPrincipioActivo}`);
  return response.data.data;
};
export const createPrincipioActivo = async (data) => {
  const response = await api.post(basePath, data);
  return response.data.data;
};
export const updatePrincipioActivo = async (idPrincipioActivo, data) => {
  const response = await api.patch(`${basePath}/${idPrincipioActivo}`, data);
  return response.data.data;
};
export const updateEstadoPrincipioActivo = async (idPrincipioActivo, estado) => {
  const response = await api.patch(`${basePath}/${idPrincipioActivo}/estado`, { estado });
  return response.data.data;
};
