import { api } from '../../../api/api.js';

const filtrosStock = ['idMedicamento', 'codigoMedicamento', 'nombreComercial'];
const filtrosHistorial = ['idMedicamento', 'idExistencia', 'desde', 'hasta', 'direccion', 'motivo'];
const consultar = async (path, filtros, campos) => {
  const params = new URLSearchParams();
  campos.forEach((campo) => {
    const valor = String(filtros[campo] ?? '').trim();
    if (valor) params.set(campo, valor);
  });
  const response = await api.get(`/inventario${path}`, { params });
  return response.data;
};

export const getInventario = (filtros = {}) => consultar('', filtros, filtrosStock);
export const getStockBajo = (filtros = {}) => consultar('/stock-bajo', filtros, filtrosStock);
export const getProximosAVencer = (filtros = {}) => consultar('/proximos-a-vencer', filtros, filtrosStock);
export const getVencidos = (filtros = {}) => consultar('/vencidos', filtros, filtrosStock);
export const getMovimientos = (filtros = {}) => consultar('/movimientos', filtros, filtrosHistorial);

export const registrarAjuste = async (data) => {
  const response = await api.post('/inventario/ajustes', data);
  return response.data;
};

export const registrarRetiroVencimiento = async (data) => {
  const response = await api.post('/inventario/retiros/vencimiento', data);
  return response.data;
};

export const registrarRetiroDano = async (data) => {
  const response = await api.post('/inventario/retiros/dano', data);
  return response.data;
};

export const getExistenciasMedicamento = async (idMedicamento) => {
  const [existencias, inventario] = await Promise.all([
    api.get(`/inventario/medicamentos/${idMedicamento}/existencias`),
    getInventario({ idMedicamento })
  ]);
  // CU22 es la fuente del saldo y marcador. La otra consulta aporta únicamente
  // la identificación del medicamento, también cuando no tiene existencias.
  return {
    data: { medicamento: inventario.data[0], existencias: existencias.data.data },
    meta: existencias.data.meta
  };
};
