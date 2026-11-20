import { Link } from 'react-router-dom';
import { cantidad, costoDecimal, fechaCivil, horaCivil } from '../../../utils/presentacion.js';

const categorias = [
  ['confirmadas', 'Confirmadas'], ['pendientes', 'Pendientes'],
  ['anuladasConfirmadas', 'Anuladas confirmadas'], ['anuladasSinConfirmar', 'Anuladas sin confirmar']
];
const etiquetas = { CONFIRMADA: 'Confirmada', PENDIENTE: 'Pendiente', ANULADA: 'Anulada', ANULADA_CONFIRMADA: 'Anulada confirmada', ANULADA_SIN_CONFIRMAR: 'Anulada sin confirmar' };
const modalidades = { DIA: 'Día', MES: 'Mes', PERIODO: 'Período' };

export const ReporteVentasResumen = ({ periodo, resumen, estadoOperacion }) => <section aria-label="Resumen de ventas" className="reporte-resumen">
  <p className="catalogo-note">Período aplicado ({modalidades[periodo.modalidad]}): {fechaCivil(periodo.desde)} al {fechaCivil(periodo.hasta)}. Zona horaria: {periodo.zonaHoraria}. Estado aplicado: {etiquetas[estadoOperacion] || 'Todos los estados'}.</p>
  <h3>Resumen de todas las coincidencias</h3>
  <dl className="catalogo-detail">
    {categorias.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{cantidad(resumen[key].cantidad)} ventas · Importe: <strong>{costoDecimal(resumen[key].importe)}</strong></dd></div>)}
    <div><dt>Total de ventas realizadas (solo confirmadas)</dt><dd><strong>{costoDecimal(resumen.totalVentasRealizadas)}</strong></dd></div>
  </dl>
  <p className="catalogo-note">Pendientes y anuladas tienen importes informativos, no ingresos vigentes. Una anulación posterior puede reclasificar este reporte; no representa un cierre histórico. El resumen proviene del servidor, no de la página de detalle.</p>
</section>;

export const ReporteVentasTable = ({ detalle, query }) => <div className="catalogo-table-wrap" tabIndex={0} role="region" aria-label="Detalle del reporte de ventas">
  <table className="catalogo-table reporte-ventas-table"><caption className="visually-hidden">Ventas del período aplicado, ordenadas por fecha de referencia e ID descendentes</caption>
    <thead><tr>{['Venta', 'Estado', 'Categoría', 'Fecha de referencia', 'Registro', 'Confirmación', 'Anulación', 'Total', 'Ficha'].map(label => <th key={label} scope="col" className={label === 'Total' ? 'reporte-number' : undefined}>{label}</th>)}</tr></thead>
    <tbody>{detalle.map(venta => <tr key={venta.idVenta}>
      <td>#{venta.idVenta}</td><td>{etiquetas[venta.estadoOperacion]}</td><td>{etiquetas[venta.categoria]}</td>
      <td>{horaCivil(venta.fechaReferencia)}</td><td>{horaCivil(venta.fechaRegistro)}</td><td>{horaCivil(venta.fechaVenta)}</td><td>{horaCivil(venta.fechaAnulacion)}</td><td className="reporte-number">{costoDecimal(venta.total)}</td>
      <td><Link to={`/ventas/${venta.idVenta}`} state={{ reporteVentasQuery: query, sidebarItemKey: 'reporte-ventas' }}>Ver venta <span className="visually-hidden">#{venta.idVenta}</span></Link></td>
    </tr>)}</tbody>
  </table>
</div>;
