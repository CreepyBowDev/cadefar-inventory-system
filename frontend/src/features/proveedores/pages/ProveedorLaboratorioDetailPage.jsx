import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { ROLES } from '../../../constants/roles.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { getProveedorLaboratorio } from '../services/proveedor-laboratorio.service.js';
import '../styles/proveedores.css';

export const ProveedorLaboratorioDetailPage = () => {
  const { idProveedorLaboratorio } = useParams();
  const { usuario } = useAuth();
  const [proveedor, setProveedor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const numericId = Number(idProveedorLaboratorio);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      setProveedor(null);
      setErrorMessage('El identificador del proveedor o laboratorio no es válido.');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setErrorMessage('');
    const loadProveedor = async () => {
      try {
        const data = await getProveedorLaboratorio(numericId);
        if (active) setProveedor(data);
      } catch (error) {
        if (active) {
          setProveedor(null);
          setErrorMessage(getApiErrorMessage(error, 'No fue posible cargar el registro.'));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProveedor();
    return () => { active = false; };
  }, [idProveedorLaboratorio]);

  if (loading) {
    return (
      <div className="page-loading" role="status">
        <span className="session-loader__mark" aria-hidden="true" />
        <span>Cargando registro…</span>
      </div>
    );
  }

  if (!proveedor) {
    return (
      <div className="proveedor-page-state" role="alert">
        <AppIcon name="alert" size={30} />
        <h2>No se pudo abrir el registro</h2>
        <p>{errorMessage}</p>
        <Link className="button button--secondary" to="/proveedores">Volver a Proveedores / Laboratorios</Link>
      </div>
    );
  }

  return (
    <div className="proveedor-detail-page">
      <Link className="back-link" to="/proveedores">
        <AppIcon name="arrowLeft" size={17} />
        Volver a Proveedores / Laboratorios
      </Link>
      <header className="page-heading">
        <div>
          <h2>{proveedor.nombre}</h2>
          <p>Datos del proveedor o laboratorio.</p>
        </div>
        {usuario.idRol === ROLES.ADMINISTRADOR && (
          <Link
            className="button button--primary"
            to={`/proveedores/${proveedor.idProveedorLaboratorio}/editar`}
          >
            <AppIcon name="edit" size={18} />
            Editar datos
          </Link>
        )}
      </header>
      <section className="proveedor-detail-panel" aria-label="Información del proveedor o laboratorio">
        <dl>
          <div><dt>Nombre</dt><dd>{proveedor.nombre}</dd></div>
          <div><dt>Teléfono</dt><dd>{proveedor.telefono || 'No registrado'}</dd></div>
          <div><dt>Dirección</dt><dd>{proveedor.direccion || 'No registrada'}</dd></div>
          <div>
            <dt>Estado</dt>
            <dd>
              <span className={`status-badge ${
                proveedor.estado ? 'status-badge--active' : 'status-badge--inactive'
              }`}>
                <span aria-hidden="true" />
                {proveedor.estado ? 'Activo' : 'Inactivo'}
              </span>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
};
