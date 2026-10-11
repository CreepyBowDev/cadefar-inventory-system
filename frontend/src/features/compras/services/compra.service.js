import { api } from '../../../api/api.js';

export const getCompras = async (filtros = {}) => {
  const params = new URLSearchParams();
  ['desde', 'hasta', 'idProveedorLaboratorio', 'estadoOperacion', 'claveOperacion'].forEach((campo) => {
    const valor = String(filtros[campo] ?? '').trim();
    if (valor) params.set(campo, campo === 'claveOperacion' ? valor.toLowerCase() : valor);
  });
  const response = await api.get('/compras', { params });
  return response.data;
};

export const getCompra = async (idCompra) => {
  const response = await api.get(`/compras/${idCompra}`);
  return response.data;
};

export const createCompra = async (data) => {
  const response = await api.post('/compras', data);
  return response.data;
};

export const anularCompra = async (idCompra, data) => {
  const response = await api.post(`/compras/${idCompra}/anular`, data);
  return response.data;
};
