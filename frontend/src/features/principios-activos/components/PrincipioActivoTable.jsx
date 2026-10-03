import { Link } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { StatusBadge } from '../../../components/StatusBadge.jsx';

export const PrincipioActivoTable = ({ principios, canManage, busy, onToggleEstado }) => (
  <div className="catalogo-table-wrap"><table className="catalogo-table">
    <thead><tr><th scope="col">Nombre</th><th scope="col">Descripción</th><th scope="col">Estado</th>{canManage && <th scope="col" className="catalogo-table__actions-heading">Acciones</th>}</tr></thead>
    <tbody>{principios.map((p) => <tr key={p.idPrincipioActivo}>
      <td><strong>{p.nombre}</strong></td><td className="principio-table__description">{p.descripcion || '—'}</td><td><StatusBadge active={p.estado} /></td>
      {canManage && <td><div className="catalogo-actions">
        <Link className="catalogo-action" to={`/principios-activos/${p.idPrincipioActivo}/editar`} title="Editar" aria-label={`Editar ${p.nombre}`}><AppIcon name="edit" size={17} /></Link>
        <button className={`catalogo-action ${p.estado ? 'catalogo-action--danger' : ''}`} type="button" onClick={() => onToggleEstado(p)} disabled={busy} title={p.estado ? 'Desactivar' : 'Activar'} aria-label={`${p.estado ? 'Desactivar' : 'Activar'} ${p.nombre}`}><AppIcon name="power" size={17} /></button>
      </div></td>}
    </tr>)}</tbody>
  </table></div>
);
