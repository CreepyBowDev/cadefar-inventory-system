import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { ConfirmDialog } from '../../../components/ConfirmDialog.jsx';
import { ROLES } from '../../../constants/roles.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { ProveedorLaboratorioTable } from '../components/ProveedorLaboratorioTable.jsx';
import {
  getProveedoresLaboratorios,
  updateEstadoProveedorLaboratorio
} from '../services/proveedor-laboratorio.service.js';
import '../styles/proveedores.css';

export const ProveedoresPage = () => {
  const { usuario } = useAuth();
  const canManage = usuario.idRol === ROLES.ADMINISTRADOR;
  const location = useLocation();
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState(location.state?.message || '');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [estadoTarget, setEstadoTarget] = useState(null);
  const [updatingEstado, setUpdatingEstado] = useState(false);
  const loadRequest = useRef(0);

  const loadProveedores = async () => {
    const request = ++loadRequest.current;
    setLoading(true);
    setErrorMessage('');

    try {
      const data = await getProveedoresLaboratorios();
      if (request === loadRequest.current) setProveedores(data);
    } catch (error) {
      if (request === loadRequest.current) {
        setProveedores([]);
        setErrorMessage(getApiErrorMessage(error, 'No fue posible cargar los proveedores y laboratorios.'));
      }
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadProveedores();
    return () => { loadRequest.current += 1; };
  }, []);

  const filteredProveedores = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');

    return proveedores.filter((proveedor) => {
      const matchesSearch = !term || [proveedor.nombre, proveedor.telefono, proveedor.direccion]
        .some((value) => value?.toLocaleLowerCase('es').includes(term));
      const matchesStatus = statusFilter === 'todos' ||
        (statusFilter === 'activos' && proveedor.estado) ||
        (statusFilter === 'inactivos' && !proveedor.estado);

      return matchesSearch && matchesStatus;
    });
  }, [proveedores, search, statusFilter]);

  const handleUpdateEstado = async () => {
    if (!estadoTarget || updatingEstado) return;

    setUpdatingEstado(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const updated = await updateEstadoProveedorLaboratorio(
        estadoTarget.idProveedorLaboratorio,
        !estadoTarget.estado
      );
      setProveedores((current) => current.map((proveedor) =>
        proveedor.idProveedorLaboratorio === updated.idProveedorLaboratorio ? updated : proveedor
      ));
      setSuccessMessage(`${updated.nombre} fue ${updated.estado ? 'activado' : 'desactivado'} correctamente.`);
      setEstadoTarget(null);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No fue posible modificar el estado.'));
      setEstadoTarget(null);
    } finally {
      setUpdatingEstado(false);
    }
  };

  const hasFilters = Boolean(search.trim()) || statusFilter !== 'todos';

  return (
    <div className="proveedores-page">
      <header className="page-heading">
        <div>
          <h2>Proveedores / Laboratorios</h2>
          <p>Consulta los datos y el estado de las entidades que suministran medicamentos.</p>
        </div>
        {canManage && (
          <Link className="button button--primary" to="/proveedores/nuevo">
            <AppIcon name="plus" size={18} />
            Nuevo proveedor o laboratorio
          </Link>
        )}
      </header>

      {successMessage && (
        <div className="feedback feedback--success" role="status">
          <AppIcon name="check" size={18} />
          <p>{successMessage}</p>
        </div>
      )}

      {errorMessage && !loading && proveedores.length > 0 && (
        <div className="feedback feedback--error" role="alert">
          <AppIcon name="alert" size={18} />
          <p>{errorMessage}</p>
        </div>
      )}

      <section className="proveedores-panel" aria-labelledby="proveedores-list-title">
        <div className="proveedores-toolbar">
          <div>
            <h3 id="proveedores-list-title">Registros</h3>
            <p>{loading ? 'Consultando registros…' : `${proveedores.length} ${
              proveedores.length === 1 ? 'registro' : 'registros'
            }`}</p>
          </div>
          <div className="proveedores-toolbar__filters">
            <label className="search-control">
              <span className="visually-hidden">Buscar proveedores o laboratorios</span>
              <AppIcon name="search" size={18} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, teléfono o dirección"
              />
            </label>
            <label className="status-filter">
              <span className="visually-hidden">Filtrar por estado</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
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
            <p>Cargando proveedores y laboratorios…</p>
          </div>
        ) : errorMessage && proveedores.length === 0 ? (
          <div className="table-state" role="alert">
            <AppIcon name="alert" size={28} />
            <h3>No fue posible mostrar los registros</h3>
            <p>{errorMessage}</p>
            <button className="button button--secondary" type="button" onClick={loadProveedores}>
              <AppIcon name="retry" size={17} />
              Reintentar
            </button>
          </div>
        ) : filteredProveedores.length > 0 ? (
          <ProveedorLaboratorioTable
            proveedores={filteredProveedores}
            canManage={canManage}
            onToggleEstado={setEstadoTarget}
          />
        ) : (
          <div className="table-state">
            <AppIcon name="truck" size={30} />
            <h3>{hasFilters ? 'Sin coincidencias' : 'No hay proveedores o laboratorios registrados'}</h3>
            <p>{hasFilters
              ? 'Ajusta la búsqueda o los filtros para ver otros resultados.'
              : 'Todavía no hay registros para consultar.'}</p>
            {!hasFilters && canManage && (
              <Link className="button button--primary" to="/proveedores/nuevo">Crear registro</Link>
            )}
          </div>
        )}
      </section>

      {canManage && (
        <ConfirmDialog
          open={Boolean(estadoTarget)}
          title={estadoTarget?.estado ? 'Desactivar proveedor o laboratorio' : 'Activar proveedor o laboratorio'}
          description={estadoTarget?.estado
            ? `${estadoTarget.nombre} permanecerá en el historial y podrá consultarse, pero no estará disponible para nuevas asignaciones o compras.`
            : `${estadoTarget?.nombre || 'El registro'} volverá a estar activo.`}
          confirmLabel={estadoTarget?.estado ? 'Desactivar' : 'Activar'}
          tone={estadoTarget?.estado ? 'danger' : 'primary'}
          busy={updatingEstado}
          onConfirm={handleUpdateEstado}
          onClose={() => setEstadoTarget(null)}
        />
      )}
    </div>
  );
};
