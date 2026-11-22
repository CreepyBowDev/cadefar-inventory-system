import { Link } from 'react-router-dom';
import { cantidad, costoDecimal, fechaCivil, horaCivil } from '../../../utils/presentacion.js';

const etiquetas = { CONFIRMADA: 'Confirmada', ANULADA: 'Anulada' };
const modalidades = { DIA: 'Día', MES: 'Mes', PERIODO: 'Período' };

export const ReporteComprasResumen = ({ periodo, resumen, estadoOperacion }) => <section aria-label="Resumen de compras" className="reporte-resumen">
  <div className="reporte-contexto"><h3>Criterios aplicados</h3><p><span>Período aplicado ({modalidades[periodo.modalidad]}): {fechaCivil(periodo.desde)} al {fechaCivil(periodo.hasta)}.</span>{' '}<span>Zona horaria: {periodo.zonaHoraria}.</span>{' '}<span>Estado aplicado: {etiquetas[estadoOperacion] || 'Todos los estados'}.</span></p></div>
  <h3>Resumen de todas las coincidencias</h3>
  <dl className="catalogo-detail">
    <div className="reporte-resumen__principal"><dt>Total de compras realizadas (solo confirmadas)</dt><dd><strong>{costoDecimal(resumen.totalComprasRealizadas)}</strong></dd></div>
    {[['confirmadas', 'Confirmadas'], ['anuladas', 'Anuladas']].map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{cantidad(resumen[key].cantidad)} compras · Importe: <strong>{costoDecimal(resumen[key].importe)}</strong></dd></div>)}
  </dl>
  <p className="catalogo-note">Las anuladas conservan su importe informativo positivo y no se descuentan nuevamente. Una anulación posterior puede reclasificar este reporte; no representa un cierre histórico. El resumen proviene del servidor, no de la página de detalle.</p>
</section>;

export const ReporteComprasTable = ({ detalle, query }) => <div className="catalogo-table-wrap" tabIndex={0} role="region" aria-label="Detalle del reporte de compras">
  <table className="catalogo-table reporte-compras-table"><caption className="visually-hidden">Compras del período aplicado, ordenadas por fecha de adquisición e ID descendentes</caption>
    <thead><tr>{['Compra', 'Proveedor / Laboratorio (ID)', 'Estado', 'Fecha de referencia (adquisición)', 'Fecha de compra', 'Registro', 'Anulación', 'Total', 'Ficha'].map(label => <th key={label} scope="col" className={label === 'Total' ? 'reporte-number' : undefined}>{label}</th>)}</tr></thead>
    <tbody>{detalle.map(compra => <tr key={compra.idCompra}>
      <td>#{compra.idCompra}</td><td>{compra.idProveedorLaboratorio}</td><td>{etiquetas[compra.estadoOperacion]}</td>
      <td>{fechaCivil(compra.fechaReferencia)}</td><td>{fechaCivil(compra.fechaCompra)}</td><td>{horaCivil(compra.fechaRegistro)}</td><td>{horaCivil(compra.fechaAnulacion)}</td><td className="reporte-number">{costoDecimal(compra.total)}</td>
      <td><Link to={`/compras/${compra.idCompra}`} state={{ reporteComprasQuery: query, sidebarItemKey: 'reporte-compras' }}>Ver compra <span className="visually-hidden">#{compra.idCompra}</span></Link></td>
    </tr>)}</tbody>
  </table>
</div>;
