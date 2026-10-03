import { AppIcon } from '../../../components/AppIcon.jsx';

// Presentación decimal sin convertir a float ni redondear la cantidad almacenada.
const decimal = (value) => String(value).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');

export const ComposicionTable = ({ composicion, canManage = false, busy = false, onEdit, onRemove }) => (
  <div className="catalogo-table-wrap">
    <table className="catalogo-table composicion-table">
      <thead><tr><th scope="col">Principio activo</th><th scope="col">Cantidad</th><th scope="col">Referencia</th>{canManage && <th scope="col" className="catalogo-table__actions-heading">Acciones</th>}</tr></thead>
      <tbody>{composicion.map((comp) => <tr key={comp.idComposicion}>
        <td><strong>{comp.principioActivo?.nombre || '—'}</strong></td>
        <td>{decimal(comp.cantidadPrincipioActivo)} {comp.unidadPrincipioActivo}</td>
        <td>{decimal(comp.cantidadReferencia)} {comp.unidadReferencia}</td>
        {canManage && <td><div className="catalogo-actions">
          <button className="catalogo-action" type="button" disabled={busy} onClick={() => onEdit(comp)} title="Editar cantidades y unidades" aria-label={`Editar composición de ${comp.principioActivo?.nombre}`}><AppIcon name="edit" size={17} /></button>
          <button className="catalogo-action catalogo-action--danger" type="button" disabled={busy} onClick={() => onRemove(comp)} title="Retirar relación" aria-label={`Retirar ${comp.principioActivo?.nombre}`}><AppIcon name="close" size={17} /></button>
        </div></td>}
      </tr>)}</tbody>
    </table>
  </div>
);
