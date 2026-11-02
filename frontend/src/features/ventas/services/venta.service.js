import { api } from '../../../api/api.js';

export const getVentas = async (filtros = {}) => {
  const params = new URLSearchParams();
  ['idVenta', 'idUsuario', 'estadoOperacion', 'campoFecha', 'desde', 'hasta', 'pagina', 'limite'].forEach((campo) => {
    const valor = String(filtros[campo] ?? '').trim();
    if (valor) params.set(campo, valor);
  });
  const response = await api.get('/ventas', { params });
  return response.data;
};

export const getVenta = async (idVenta) => {
  const response = await api.get(`/ventas/${idVenta}`);
  return response.data;
};

export const createVenta = async ({ claveOperacion, detalles }) => {
  const response = await api.post('/ventas', {
    claveOperacion,
    detalles: detalles.map(({ idMedicamento, idExistencia, cantidad, precioUnitario }) => ({
      idMedicamento, idExistencia, cantidad, precioUnitario
    }))
  });
  return response.data;
};

export const confirmarVenta = async (idVenta) => {
  const response = await api.post(`/ventas/${idVenta}/confirmar`, {});
  return response.data;
};

export const anularVenta = async (idVenta, { motivo }) => {
  const response = await api.post(`/ventas/${idVenta}/anular`, { motivo });
  return response.data;
};
