import { cantidad, costoDecimal, fechaEtiqueta } from '../../../utils/presentacion.js';

export const ExistenciaObservada = ({ existencia, className = '' }) => <dl className={`catalogo-detail existencia-observada ${className}`} aria-label="Estado observado de la existencia">
  <div><dt>Stock físico observado</dt><dd>{cantidad(existencia.stockFisico)}</dd></div><div><dt>Stock vendible consultado</dt><dd>{cantidad(existencia.stockVendible)}</dd></div>
  <div><dt>Costo promedio consultado</dt><dd>{costoDecimal(existencia.costoUnitarioPromedio)}</dd></div><div><dt>Último movimiento observado</dt><dd>{existencia.ultimoMovimiento === null ? 'Sin movimientos' : `#${existencia.ultimoMovimiento}`}</dd></div>
  <div><dt>Vencimiento de etiqueta</dt><dd>{fechaEtiqueta(existencia)} · {existencia.precisionVencimiento === 'MES' ? 'mes' : 'día'}</dd></div><div><dt>Estado de vencimiento consultado</dt><dd>{existencia.vencida ? 'Vencida' : 'No vencida'}</dd></div>
</dl>;
