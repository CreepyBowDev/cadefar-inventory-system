import { Link } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';

export const ProveedorLaboratorioTable = ({ proveedores, canManage, onToggleEstado }) => (
  <div className="proveedores-table-wrap">
    <table className="proveedores-table">
      <thead>
        <tr>
          <th scope="col">Nombre</th>
          <th scope="col">Teléfono</th>
          <th scope="col">Dirección</th>
          <th scope="col">Estado</th>
          <th scope="col" className="proveedores-table__actions-heading">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {proveedores.map((proveedor) => (
          <tr key={proveedor.idProveedorLaboratorio}>
            <td>
              <strong>{proveedor.nombre}</strong>
            </td>
            <td>{proveedor.telefono || '—'}</td>
            <td className="proveedores-table__address">{proveedor.direccion || '—'}</td>
            <td>
              <span className={`status-badge ${
                proveedor.estado ? 'status-badge--active' : 'status-badge--inactive'
              }`}>
                <span aria-hidden="true" />
                {proveedor.estado ? 'Activo' : 'Inactivo'}
              </span>
            </td>
            <td>
              <div className="proveedores-table__actions">
                <Link
                  className="table-action"
                  to={`/proveedores/${proveedor.idProveedorLaboratorio}`}
                  aria-label={`Ver detalles de ${proveedor.nombre}`}
                  title="Ver detalles"
                >
                  <AppIcon name="eye" size={17} />
                </Link>
                {canManage && (
                  <>
                    <Link
                      className="table-action"
                      to={`/proveedores/${proveedor.idProveedorLaboratorio}/editar`}
                      aria-label={`Editar ${proveedor.nombre}`}
                      title="Editar proveedor o laboratorio"
                    >
                      <AppIcon name="edit" size={17} />
                    </Link>
                    <button
                      className={`table-action ${
                        proveedor.estado ? 'table-action--danger' : 'table-action--activate'
                      }`}
                      type="button"
                      onClick={() => onToggleEstado(proveedor)}
                      aria-label={`${proveedor.estado ? 'Desactivar' : 'Activar'} ${proveedor.nombre}`}
                      title={proveedor.estado ? 'Desactivar' : 'Activar'}
                    >
                      <AppIcon name="power" size={17} />
                    </button>
                  </>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
