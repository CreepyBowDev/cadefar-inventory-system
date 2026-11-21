import { costoDecimal } from '../../../utils/presentacion.js';

export const ESTADOS_PAGO = { PENDIENTE: 'Pendiente', PROCESANDO: 'Procesando', CONFIRMADO: 'Confirmado',
  RECHAZADO: 'Rechazado', PAGADO: 'Pagada', PARCIAL: 'Pago parcial', NO_APLICA: 'No aplica' };
export const nombreMetodoPago = metodo => metodo === 'TARJETA' ? 'Tarjeta de débito o crédito' : 'PayPal';
export const importePago = (importe, moneda) => `${costoDecimal(importe)}${moneda ? ` ${moneda}` : ''}`;
export const generarClavePago = () => `pago-${Array.from(crypto.getRandomValues(new Uint8Array(16)), valor => valor.toString(16).padStart(2, '0')).join('')}`;
export const enlacePagoSeguro = (valor, metodo, comprobante = false) => {
  try {
    const url = new URL(valor);
    const hosts = metodo === 'TARJETA' ? comprobante ? ['pay.stripe.com', 'payments.stripe.com', 'receipt.stripe.com'] : ['checkout.stripe.com'] : ['www.paypal.com', 'paypal.com'];
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts.includes(url.hostname) ? valor : null;
  } catch { return null; }
};
