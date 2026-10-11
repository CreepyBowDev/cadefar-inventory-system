import { Link } from 'react-router-dom';
import { StatusBadge } from '../../../components/StatusBadge.jsx';
import { cantidad, costoDecimal, fechaCivil, fechaEtiqueta } from '../../../utils/presentacion.js';

export const ExistenciasTable = ({ existencias, showMedicamento = false, canSeeMovimientos = false, canAdjust = false, canRetire = false }) => <div className="catalogo-table-wrap" tabIndex={0} role="region" aria-label="Existencias y vencimientos">
  <table className="catalogo-table inventario-table">
    <caption className="visually-hidden">Existencias, vencimiento indicado y efectivo, stock y costo promedio</caption>
    <thead><tr>{showMedicamento && <th scope="col">Medicamento</th>}<th scope="col">Existencia</th><th scope="col">Vencimiento de etiqueta</th><th scope="col">Vencida desde</th><th scope="col" className="inventario-number">Físico</th><th scope="col" className="inventario-number">Vendible</th><th scope="col" className="inventario-number">Costo promedio</th>{canSeeMovimientos && <th scope="col">Historial</th>}{canAdjust && <th scope="col">Conteo físico</th>}{canRetire && <th scope="col">Retiros</th>}</tr></thead>
    <tbody>{existencias.map((e) => <tr key={e.idExistencia}>
      {showMedicamento && <td><Link className="inventario-link" to={`/inventario/medicamentos/${e.idMedicamento}/existencias`}>{e.medicamento.nombreComercial}</Link><small>{e.medicamento.codigoMedicamento}</small><StatusBadge active={e.medicamento.estado} /></td>}
      <td><strong>{e.codigoExistencia}</strong><small>ID {e.idExistencia}</small><span className={`inventario-badge ${e.vencida ? 'inventario-badge--expired' : ''}`}>{e.vencida ? 'Vencida' : 'No vencida'}</span></td>
      <td>{fechaEtiqueta(e)}<small>Precisión: {e.precisionVencimiento === 'MES' ? 'mes' : 'día'}</small><small>Fecha guardada: {fechaCivil(e.fechaVencimiento)}</small></td>
      <td>{fechaCivil(e.fechaEfectivaVencimiento)}</td>
      <td className="inventario-number">{cantidad(e.stockFisico)}</td><td className="inventario-number inventario-vendible"><strong>{cantidad(e.stockVendible)}</strong></td>
      <td className="inventario-number">{costoDecimal(e.costoUnitarioPromedio)}</td>
      {canSeeMovimientos && <td><Link className="inventario-link" to={`/inventario/movimientos?idExistencia=${e.idExistencia}`}>Ver movimientos <span className="visually-hidden">de {e.codigoExistencia}</span></Link>{Object.hasOwn(e, 'ultimoMovimiento') && <small>{e.ultimoMovimiento === null ? 'Sin movimientos' : `Último: #${e.ultimoMovimiento}`}</small>}</td>}
      {canAdjust && <td><Link className="inventario-link" to={`/inventario/medicamentos/${e.idMedicamento}/existencias/${e.idExistencia}/ajuste`}>Ajustar conteo <span className="visually-hidden">de {e.codigoExistencia}</span></Link></td>}
      {canRetire && <td><div className="inventario-retiro-links">{e.stockFisico > 0 ? <>{e.vencida && <Link className="inventario-link" to={`/inventario/medicamentos/${e.idMedicamento}/existencias/${e.idExistencia}/retiro-vencimiento`}>Retirar por vencimiento <span className="visually-hidden">de {e.codigoExistencia}</span></Link>}<Link className="inventario-link" to={`/inventario/medicamentos/${e.idMedicamento}/existencias/${e.idExistencia}/retiro-dano`}>Retirar por daño <span className="visually-hidden">de {e.codigoExistencia}</span></Link></> : <small>Sin saldo físico para retirar</small>}</div></td>}
    </tr>)}</tbody>
  </table>
</div>;
