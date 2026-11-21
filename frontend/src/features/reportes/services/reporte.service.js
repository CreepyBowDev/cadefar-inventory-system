import { api } from '../../../api/api.js';
import { serializarConsultaReporte, serializarEstadisticasReporte, serializarExportacionReporte } from '../utils/consultaReporte.js';
import { recibirArchivo } from '../../../utils/descargaBinaria.js';

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

const getEstadisticas = async (tipo, filtros, { signal } = {}) => {
  const params = new URLSearchParams(serializarEstadisticasReporte(filtros, tipo));
  const response = await api.get(`/reportes/${tipo}/estadisticas`, { params, signal });
  return response.data;
};
const exportar = (tipo, filtros, { signal } = {}) => {
  const params = new URLSearchParams(serializarExportacionReporte(filtros, tipo));
  return recibirArchivo(`/reportes/${tipo}/exportar`, params, {
    fuente: tipo, formato: params.get('formato'), presentacion: params.get('presentacion'), signal
  });
};

export const getEstadisticasVentas = (filtros, opciones) => getEstadisticas('ventas', filtros, opciones);
export const getEstadisticasCompras = (filtros, opciones) => getEstadisticas('compras', filtros, opciones);
export const getEstadisticasPerdidas = (filtros, opciones) => getEstadisticas('perdidas', filtros, opciones);
export const exportarReporteVentas = (filtros, opciones) => exportar('ventas', filtros, opciones);
export const exportarReporteCompras = (filtros, opciones) => exportar('compras', filtros, opciones);
export const exportarReportePerdidas = (filtros, opciones) => exportar('perdidas', filtros, opciones);
