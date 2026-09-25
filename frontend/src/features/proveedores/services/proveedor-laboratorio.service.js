import { api } from '../../../api/api.js';

const basePath = '/proveedores-laboratorios';

export const getProveedoresLaboratorios = async () => {
  const response = await api.get(basePath);
  return response.data.data;
};

export const getProveedorLaboratorio = async (idProveedorLaboratorio) => {
  const response = await api.get(`${basePath}/${idProveedorLaboratorio}`);
  return response.data.data;
};

export const createProveedorLaboratorio = async (data) => {
  const response = await api.post(basePath, data);
  return response.data.data;
};

export const updateProveedorLaboratorio = async (idProveedorLaboratorio, data) => {
  const response = await api.patch(`${basePath}/${idProveedorLaboratorio}`, data);
  return response.data.data;
};

export const updateEstadoProveedorLaboratorio = async (idProveedorLaboratorio, estado) => {
  const response = await api.patch(`${basePath}/${idProveedorLaboratorio}/estado`, { estado });
  return response.data.data;
};
