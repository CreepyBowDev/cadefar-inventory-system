import { api } from '../../../api/api.js';
import { serializarConsultaReporte } from '../utils/consultaReporte.js';

export const getReporteVentas = async (filtros = {}) => {
  const params = new URLSearchParams(serializarConsultaReporte(filtros, 'ventas'));
  const response = await api.get('/reportes/ventas', { params });
  return response.data;
};

export const getReporteCompras = async (filtros = {}) => {
  const params = new URLSearchParams(serializarConsultaReporte(filtros, 'compras'));
  const response = await api.get('/reportes/compras', { params });
  return response.data;
};

export const getReportePerdidas = async (filtros = {}) => {
  const params = new URLSearchParams(serializarConsultaReporte(filtros, 'perdidas'));
  const response = await api.get('/reportes/perdidas', { params });
  return response.data;
};
