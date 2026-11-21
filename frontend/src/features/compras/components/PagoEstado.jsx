import { ESTADOS_PAGO } from '../utils/pagoCompra.js';

export const PagoEstado = ({ estado }) => <span className={`compra-estado pago-estado--${estado.toLowerCase()}`}>{ESTADOS_PAGO[estado] || estado}</span>;
