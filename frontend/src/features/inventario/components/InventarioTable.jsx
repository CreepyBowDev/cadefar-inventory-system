import { Link } from 'react-router-dom';
import { StatusBadge } from '../../../components/StatusBadge.jsx';
import { cantidad } from '../../../utils/presentacion.js';

export const InventarioTable = ({ medicamentos, stockBajo = false }) => <div className="catalogo-table-wrap" tabIndex={0} role="region" aria-label="Disponibilidad por medicamento">
  <table className="catalogo-table inventario-table">
    <caption className="visually-hidden">Stock físico, vendible y mínimo por medicamento</caption>
    <thead><tr><th scope="col">Medicamento</th><th scope="col">Estado</th><th scope="col">Unidad</th><th scope="col" className="inventario-number">Físico</th><th scope="col" className="inventario-number">Vendible</th><th scope="col" className="inventario-number">Mínimo</th><th scope="col">Existencias</th></tr></thead>
    <tbody>{medicamentos.map((med) => <tr key={med.idMedicamento}>
      <td><strong>{med.nombreComercial}</strong><small>{med.codigoMedicamento} · ID {med.idMedicamento}</small><small>{med.formaFarmaceutica} · {med.presentacion}</small></td>
      <td><StatusBadge active={med.estado} /></td><td>{med.unidadInventario}</td>
      <td className="inventario-number">{cantidad(med.stockFisico)}</td>
      <td className="inventario-number inventario-vendible"><strong>{cantidad(med.stockVendible)}</strong>{stockBajo && <small>Stock bajo</small>}</td>
      <td className="inventario-number">{cantidad(med.stockMinimo)}</td>
      <td><Link className="inventario-link" to={`/inventario/medicamentos/${med.idMedicamento}/existencias`}>Ver existencias <span className="visually-hidden">de {med.nombreComercial}</span></Link><small>{med.existencias.length} registradas</small></td>
    </tr>)}</tbody>
  </table>
</div>;
