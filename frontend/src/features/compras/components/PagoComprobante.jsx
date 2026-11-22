import { ComprobanteModal } from './ComprobanteModal.jsx';

export const PagoComprobante = ({ compra, pago, onClose }) => pago?.estado === 'CONFIRMADO'
  ? <ComprobanteModal key={pago.idPago} idCompra={compra.idCompra} idPago={pago.idPago} titulo={pago.esPrueba ? 'Comprobante de prueba' : 'Comprobante del pago verificado'} onClose={onClose} /> : null;
