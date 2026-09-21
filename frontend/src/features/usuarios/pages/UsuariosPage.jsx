import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { ConfirmDialog } from '../../../components/ConfirmDialog.jsx';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { ResetPasswordDialog } from '../components/ResetPasswordDialog.jsx';
import { UsuarioTable } from '../components/UsuarioTable.jsx';
import {
  getUsuarios,
  updateEstadoUsuario
} from '../services/usuario.service.js';
import '../styles/usuarios.css';

export const UsuariosPage = () => {
  const location = useLocation();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState(
    location.state?.message || ''
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [estadoTarget, setEstadoTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [updatingEstado, setUpdatingEstado] = useState(false);

  const loadUsuarios = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      setUsuarios(await getUsuarios());
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No fue posible cargar los usuarios.')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsuarios();
  }, []);

  const filteredUsuarios = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('es');

    return usuarios.filter((usuario) => {
      const matchesSearch =
        !normalizedSearch ||
        usuario.nombreUsuario.toLocaleLowerCase('es').includes(normalizedSearch) ||
        usuario.rol?.nombre
          ?.toLocaleLowerCase('es')
          .includes(normalizedSearch);
      const matchesStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'activos' && usuario.estado) ||
        (statusFilter === 'inactivos' && !usuario.estado);

      return matchesSearch && matchesStatus;
    });
  }, [usuarios, search, statusFilter]);

  const handleUpdateEstado = async () => {
    const nextEstado = !estadoTarget.estado;
    setUpdatingEstado(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const updatedUsuario = await updateEstadoUsuario(
        estadoTarget.idUsuario,
        nextEstado
      );
      setUsuarios((current) =>
        current.map((usuario) =>
          usuario.idUsuario === updatedUsuario.idUsuario
            ? updatedUsuario
            : usuario
        )
      );
      setSuccessMessage(
        `El usuario ${updatedUsuario.nombreUsuario} fue ${
          updatedUsuario.estado ? 'activado' : 'desactivado'
        } correctamente.`
      );
      setEstadoTarget(null);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No fue posible modificar el estado.')
      );
    } finally {
      setUpdatingEstado(false);
    }
  };

  const handlePasswordReset = (usuario) => {
    setResetTarget(null);
    setSuccessMessage(
      `La contraseña de ${usuario.nombreUsuario} fue restablecida correctamente.`
    );
  };

  const hasFilters = Boolean(search.trim()) || statusFilter !== 'todos';

  return (
    <div className="usuarios-page">
      <header className="page-heading">
        <div>
          <h2>Gestión de usuarios</h2>
          <p>Administra las cuentas, sus roles y el acceso al sistema.</p>
        </div>
        <Link className="button button--primary" to="/usuarios/nuevo">
          <AppIcon name="plus" size={18} />
          Nuevo usuario
        </Link>
      </header>

      {successMessage && (
        <div className="feedback feedback--success" role="status">
          <AppIcon name="check" size={18} />
          <p>{successMessage}</p>
        </div>
      )}

      {errorMessage && !loading && usuarios.length > 0 && (
        <div className="feedback feedback--error" role="alert">
          <AppIcon name="alert" size={18} />
          <p>{errorMessage}</p>
        </div>
      )}

      <section className="usuarios-panel" aria-labelledby="usuarios-list-title">
        <div className="usuarios-toolbar">
          <div>
            <h3 id="usuarios-list-title">Usuarios registrados</h3>
            <p>
              {loading
                ? 'Consultando usuarios…'
                : `${usuarios.length} ${
                    usuarios.length === 1 ? 'cuenta registrada' : 'cuentas registradas'
                  }`}
            </p>
          </div>
          <div className="usuarios-toolbar__filters">
            <label className="search-control">
              <span className="visually-hidden">Buscar usuarios</span>
              <AppIcon name="search" size={18} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por usuario o rol"
              />
            </label>
            <label className="status-filter">
              <span className="visually-hidden">Filtrar por estado</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="todos">Todos los estados</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="table-state" role="status">
            <span className="session-loader__mark" aria-hidden="true" />
            <p>Cargando usuarios…</p>
          </div>
        ) : errorMessage && usuarios.length === 0 ? (
          <div className="table-state">
            <AppIcon name="alert" size={28} />
            <h3>No fue posible mostrar los usuarios</h3>
            <p>{errorMessage}</p>
            <button
              className="button button--secondary"
              type="button"
              onClick={loadUsuarios}
            >
              <AppIcon name="retry" size={17} />
              Reintentar
            </button>
          </div>
        ) : filteredUsuarios.length > 0 ? (
          <UsuarioTable
            usuarios={filteredUsuarios}
            onToggleEstado={setEstadoTarget}
            onResetPassword={setResetTarget}
          />
        ) : (
          <div className="table-state">
            <AppIcon name="users" size={30} />
            <h3>{hasFilters ? 'Sin coincidencias' : 'No hay usuarios registrados'}</h3>
            <p>
              {hasFilters
                ? 'Ajusta la búsqueda o los filtros para ver otros resultados.'
                : 'Crea la primera cuenta para comenzar la gestión de usuarios.'}
            </p>
            {!hasFilters && (
              <Link className="button button--primary" to="/usuarios/nuevo">
                Crear usuario
              </Link>
            )}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(estadoTarget)}
        title={estadoTarget?.estado ? 'Desactivar usuario' : 'Activar usuario'}
        description={
          estadoTarget?.estado
            ? `${estadoTarget.nombreUsuario} dejará de poder iniciar sesión y registrar operaciones. Su historial se conservará.`
            : `${estadoTarget?.nombreUsuario || 'El usuario'} podrá iniciar sesión nuevamente.`
        }
        confirmLabel={estadoTarget?.estado ? 'Desactivar' : 'Activar'}
        tone={estadoTarget?.estado ? 'danger' : 'primary'}
        busy={updatingEstado}
        onConfirm={handleUpdateEstado}
        onClose={() => setEstadoTarget(null)}
      />

      <ResetPasswordDialog
        usuario={resetTarget}
        onClose={() => setResetTarget(null)}
        onSuccess={handlePasswordReset}
      />
    </div>
  );
};
