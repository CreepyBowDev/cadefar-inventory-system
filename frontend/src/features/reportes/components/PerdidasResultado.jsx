import { Link } from 'react-router-dom';
import { cantidad, costoDecimal, fechaCivil, horaCivil } from '../../../utils/presentacion.js';

const motivos = { VENCIMIENTO: 'Vencimiento', DAÑO: 'Daño' };
const modalidades = { DIA: 'Día', MES: 'Mes', PERIODO: 'Período' };

export const PerdidasResumen = ({ periodo, resumen, motivo }) => <section aria-label="Resumen de pérdidas" className="reporte-resumen">
  <p className="catalogo-note">Período aplicado ({modalidades[periodo.modalidad]}): {fechaCivil(periodo.desde)} al {fechaCivil(periodo.hasta)}. Zona horaria: {periodo.zonaHoraria}. Motivo aplicado: {motivos[motivo] || 'Todos los motivos'}.</p>
  <h3>Resumen de todas las coincidencias</h3>
  <dl className="catalogo-detail">
    {[['vencimiento', 'Vencimiento'], ['dano', 'Daño']].map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{cantidad(resumen[key].cantidadRetiros)} retiros · Cantidad retirada: {cantidad(resumen[key].cantidadRetirada)} · Pérdida: <strong>{costoDecimal(resumen[key].perdida)}</strong></dd></div>)}
    <div><dt>Total global de retiros brutos</dt><dd>{cantidad(resumen.cantidadRetiros)} retiros · Cantidad retirada: {cantidad(resumen.cantidadRetirada)} · Pérdida total: <strong>{costoDecimal(resumen.perdidaTotal)}</strong></dd></div>
  </dl>
  <p className="catalogo-note">El resumen completo proviene del servidor, no de esta página de detalle. Las cantidades agregadas de distintos productos no representan una unidad farmacéutica común. Los códigos y nombres corresponden al catálogo actual; los costos e importes son históricos. Se conservan históricos de productos inactivos y existencias agotadas.</p>
</section>;

export const PerdidasTable = ({ detalle, query }) => <div className="catalogo-table-wrap" tabIndex={0} role="region" aria-label="Detalle de pérdidas">
  <table className="catalogo-table reporte-perdidas-table"><caption className="visually-hidden">Retiros brutos originales SALIDA por vencimiento o daño, ordenados por fecha de referencia e ID descendentes</caption>
    <thead><tr>{['Movimiento (ID)', 'Medicamento', 'Existencia', 'Usuario (ID)', 'Motivo', 'Fecha de referencia', 'Fecha del movimiento', 'Cantidad', 'Costo unitario aplicado', 'Pérdida', 'Movimiento de reversión (ID)', 'Trazabilidad'].map(label => <th key={label} scope="col" className={['Cantidad', 'Costo unitario aplicado', 'Pérdida'].includes(label) ? 'reporte-number' : undefined}>{label}</th>)}</tr></thead>
    <tbody>{detalle.map(retiro => <tr key={retiro.idMovimiento}>
      <td>#{retiro.idMovimiento}</td><td>{retiro.codigoMedicamento} · {retiro.nombreComercial}<br />ID: {retiro.idMedicamento}</td><td>{retiro.codigoExistencia}<br />ID: {retiro.idExistencia}</td><td>{retiro.idUsuario}</td><td>{motivos[retiro.motivo]}</td>
      <td>{horaCivil(retiro.fechaReferencia)}</td><td>{horaCivil(retiro.fechaMovimiento)}</td><td className="reporte-number">{cantidad(retiro.cantidad)}</td><td className="reporte-number">{costoDecimal(retiro.costoUnitarioAplicado)}</td><td className="reporte-number">{costoDecimal(retiro.perdida)}</td><td>{retiro.idMovimientoReversion === null ? '—' : `#${retiro.idMovimientoReversion}`}</td>
      <td><Link to={`/inventario/movimientos?${new URLSearchParams({ idExistencia: String(retiro.idExistencia), idMedicamento: String(retiro.idMedicamento) })}`} state={{ reportePerdidasQuery: query, sidebarItemKey: 'reporte-historial' }}>Ver historial <span className="visually-hidden">del retiro #{retiro.idMovimiento}</span></Link></td>
    </tr>)}</tbody>
  </table>
</div>;
