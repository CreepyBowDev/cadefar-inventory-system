import { costoDecimal } from '../../../utils/presentacion.js';

export const ESTADOS_PAGO = { PENDIENTE: 'Pendiente', PROCESANDO: 'Procesando', CONFIRMADO: 'Confirmado',
  RECHAZADO: 'Rechazado', CANCELADO: 'Cancelado', PAGADO: 'Pagada', PARCIAL: 'Pago parcial', NO_APLICA: 'No aplica' };
// Presentación de la causa final; no incorpora otro estado financiero en BD.
export const estadoPagoVisible = pago => pago.resultadoProveedor === 'PRUEBA_LOCAL_CANCELADO' ? 'CANCELADO' : pago.estado;
export const nombreMetodoPago = metodo => metodo === 'TARJETA' ? 'Tarjeta de débito o crédito' : 'PayPal';
export const nombreLaboratorioPago = (nombre, local = false) => local && nombre
  ? nombre.replace(/\s*[·|—-]?\s*PRUEBA_LOCAL\s*$/i, '').trim() : nombre;
export const referenciaPagoVisible = pago => pago.esPrueba
  ? pago.referenciaExterna?.replace(/^PRUEBA_LOCAL_REF_/, 'LOCAL-') : pago.referenciaExterna;
export const importePago = (importe, moneda) => `${costoDecimal(importe)}${moneda ? ` ${moneda}` : ''}`;
export const errorImportePago = (importe, saldo) => {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(importe)) return 'Indica un importe válido con hasta dos decimales. Usa punto decimal.';
  const centavos = valor => { const [entero, fraccion = ''] = valor.split('.'); return BigInt(entero) * 100n + BigInt(fraccion.padEnd(2, '0')); };
  if (centavos(importe) <= 0n) return 'El importe debe ser mayor que cero.';
  return centavos(importe) > centavos(saldo) ? 'El importe no puede superar el saldo disponible.' : '';
};
export const generarClavePago = () => `pago-${Array.from(crypto.getRandomValues(new Uint8Array(16)), valor => valor.toString(16).padStart(2, '0')).join('')}`;
export const enlacePagoSeguro = (valor, metodo, comprobante = false) => {
  try {
    const url = new URL(valor);
    const hosts = metodo === 'TARJETA' ? comprobante ? ['pay.stripe.com', 'payments.stripe.com', 'receipt.stripe.com'] : ['checkout.stripe.com'] : ['www.paypal.com', 'paypal.com'];
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts.includes(url.hostname) ? valor : null;
  } catch { return null; }
};
