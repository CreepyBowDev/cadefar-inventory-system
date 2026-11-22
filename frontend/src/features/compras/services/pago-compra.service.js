import { api } from '../../../api/api.js';

export const autorizarPagoPrueba = async (idCompra, idPago, decision) => {
  const response = await api.post(`/compras/${idCompra}/pagos/${idPago}/autorizar-prueba`, { decision });
  return response.data;
};

export const getPagosCompra = async idCompra => {
  const response = await api.get(`/compras/${idCompra}/pagos`);
  return response.data;
};
export const iniciarPagoCompra = async (idCompra, data) => {
  const response = await api.post(`/compras/${idCompra}/pagos`, data);
  return response.data;
};
export const verificarPagoCompra = async (idCompra, idPago) => {
  const response = await api.post(`/compras/${idCompra}/pagos/${idPago}/verificar`, {});
  return response.data;
};
export const confirmarPagoCompra = async (idCompra, idPago) => {
  const response = await api.post(`/compras/${idCompra}/pagos/${idPago}/confirmar`, { autorizarPago: true });
  return response.data;
};
export const conciliarPagoCompra = async (idCompra, idPago, idExterno) => {
  const response = await api.post(`/compras/${idCompra}/pagos/${idPago}/conciliar`, { idExterno });
  return response.data;
};
