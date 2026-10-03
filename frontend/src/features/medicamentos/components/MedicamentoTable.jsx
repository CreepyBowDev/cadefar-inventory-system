import { Link } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { StatusBadge } from '../../../components/StatusBadge.jsx';

export const MedicamentoTable = ({ medicamentos, canManage, busy, onToggleEstado }) => (
  <div className="catalogo-table-wrap">
    <table className="catalogo-table medicamentos-table">
      <thead><tr>
        <th scope="col">Medicamento</th><th scope="col">Forma / Presentación</th>
        <th scope="col">Unidad</th><th scope="col">Proveedor / Laboratorio</th>
        <th scope="col">Condición de venta</th><th scope="col">Estado</th>
        <th scope="col" className="catalogo-table__actions-heading">Acciones</th>
      </tr></thead>
      <tbody>{medicamentos.map((med) => (
        <tr key={med.idMedicamento}>
          <td className="medicamentos-table__product"><strong>{med.nombreComercial}</strong><small>{med.codigoMedicamento}</small></td>
          <td>{med.formaFarmaceutica}<small>{med.presentacion}</small></td>
          <td>{med.unidadInventario}</td><td>{med.proveedorLaboratorio?.nombre || '—'}</td>
          <td>{med.condicionVenta}</td><td><StatusBadge active={med.estado} /></td>
          <td><div className="catalogo-actions">
            <Link className="catalogo-action" to={`/medicamentos/${med.idMedicamento}`} title="Ver detalles" aria-label={`Ver ${med.nombreComercial}`}><AppIcon name="eye" size={17} /></Link>
            <Link className="catalogo-action" to={`/medicamentos/${med.idMedicamento}/composicion`} title="Composición" aria-label={`Composición de ${med.nombreComercial}`}><AppIcon name="prescription" size={17} /></Link>
            {canManage && <>
              <Link className="catalogo-action" to={`/medicamentos/${med.idMedicamento}/editar`} title="Editar" aria-label={`Editar ${med.nombreComercial}`}><AppIcon name="edit" size={17} /></Link>
              <button className={`catalogo-action ${med.estado ? 'catalogo-action--danger' : ''}`} type="button" disabled={busy} onClick={() => onToggleEstado(med)} title={med.estado ? 'Desactivar' : 'Activar'} aria-label={`${med.estado ? 'Desactivar' : 'Activar'} ${med.nombreComercial}`}><AppIcon name="power" size={17} /></button>
            </>}
          </div></td>
        </tr>
      ))}</tbody>
    </table>
  </div>
);
