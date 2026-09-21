import { Link } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';

export const UsuarioTable = ({ usuarios, onToggleEstado, onResetPassword }) => (
  <div className="usuario-table-wrap">
    <table className="usuario-table">
      <thead>
        <tr>
          <th scope="col">Usuario</th>
          <th scope="col">Rol</th>
          <th scope="col">Estado</th>
          <th scope="col" className="usuario-table__actions-heading">
            Acciones
          </th>
        </tr>
      </thead>
      <tbody>
        {usuarios.map((usuario) => (
          <tr key={usuario.idUsuario}>
            <td>
              <div className="usuario-table__identity">
                <span aria-hidden="true">
                  {usuario.nombreUsuario.charAt(0).toUpperCase()}
                </span>
                <div>
                  <strong>{usuario.nombreUsuario}</strong>
                  <small>Identificador #{usuario.idUsuario}</small>
                </div>
              </div>
            </td>
            <td>
              <span className="role-label">
                {usuario.rol?.nombre || 'Rol no disponible'}
              </span>
            </td>
            <td>
              <span
                className={`status-badge ${
                  usuario.estado ? 'status-badge--active' : 'status-badge--inactive'
                }`}
              >
                <span aria-hidden="true" />
                {usuario.estado ? 'Activo' : 'Inactivo'}
              </span>
            </td>
            <td>
              <div className="usuario-table__actions">
                <Link
                  className="table-action"
                  to={`/usuarios/${usuario.idUsuario}/editar`}
                  aria-label={`Editar a ${usuario.nombreUsuario}`}
                  title="Editar usuario"
                >
                  <AppIcon name="edit" size={17} />
                </Link>
                <button
                  className="table-action"
                  type="button"
                  onClick={() => onResetPassword(usuario)}
                  aria-label={`Restablecer contraseña de ${usuario.nombreUsuario}`}
                  title="Restablecer contraseña"
                >
                  <AppIcon name="reset" size={17} />
                </button>
                <button
                  className={`table-action ${
                    usuario.estado ? 'table-action--danger' : 'table-action--activate'
                  }`}
                  type="button"
                  onClick={() => onToggleEstado(usuario)}
                  aria-label={`${usuario.estado ? 'Desactivar' : 'Activar'} a ${
                    usuario.nombreUsuario
                  }`}
                  title={usuario.estado ? 'Desactivar usuario' : 'Activar usuario'}
                >
                  <AppIcon name="power" size={17} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
