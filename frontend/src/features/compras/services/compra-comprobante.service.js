import { api } from '../../../api/api.js';

const ruta = ({ idCompra, idPago }) => `/compras/${idCompra}${idPago == null ? '' : `/pagos/${idPago}`}/comprobante`;

export const getComprobanteCompra = async ids => (await api.get(ruta(ids))).data;

export const descargarComprobanteCompra = async (ids, signal) => {
  let response;
  try { response = await api.get(`${ruta(ids)}.pdf`, { responseType: 'blob', signal }); }
  catch (error) {
    const status = error.response?.status;
    throw new Error(status === 401 ? 'Tu sesión ya no es válida. Inicia sesión nuevamente.' : status === 403 ? 'No tienes autorización para descargar el comprobante.' : status === 409 ? 'El pago todavía no está confirmado.' : 'No fue posible descargar el comprobante. Inténtalo nuevamente.');
  }
  if (response.status !== 200 || response.data?.type?.split(';')[0] !== 'application/pdf' || !response.data.size || !(await response.data.slice(0, 5).text()).startsWith('%PDF-')) {
    throw new Error('El servidor no devolvió un PDF válido.');
  }
  return { blob: response.data, nombre: `CADEFAR-${ids.idPago == null ? `COMPRA-${ids.idCompra}` : `PAGO-${ids.idPago}`}.pdf` };
};
