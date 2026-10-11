import { Link, useLocation } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { getNavigationForRole } from '../../../constants/navigation.js';
import { useAuth } from '../../../hooks/useAuth.js';
import '../styles/dashboard.css';

const formatDate = () =>
  new Intl.DateTimeFormat('es-BO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

export const DashboardPage = () => {
  const { usuario } = useAuth();
  const location = useLocation();
  const modules = getNavigationForRole(usuario.idRol).filter(
    (item) => item.key !== 'dashboard'
  );
  const availableModules = modules.filter((item) => item.available);
  const pendingModules = modules.filter((item) => !item.available);

  return (
    <div className="dashboard-page">
      {location.state?.accessDenied && (
        <div className="feedback feedback--error" role="alert">
          <AppIcon name="alert" size={18} />
          <p>No tienes autorización para acceder a esa sección.</p>
        </div>
      )}

      <section className="dashboard-welcome" aria-labelledby="dashboard-title">
        <div className="dashboard-welcome__content">
          <h2 id="dashboard-title">
            Bienvenido, <span className="dashboard-welcome__name">{usuario.nombreUsuario}</span>
          </h2>
          <p>Elige un módulo para comenzar tu trabajo en Farmacia CADEFAR.</p>
        </div>
        <p className="dashboard-welcome__date">{formatDate()}</p>
      </section>

      <section className="dashboard-modules" aria-labelledby="modules-title">
        <header className="dashboard-section-heading">
          <h2 id="modules-title">Accesos de trabajo</h2>
          <p>Abre una sección para consultar información o registrar una operación.</p>
        </header>

        {availableModules.length > 0 ? (
          <div className="dashboard-module-list">
            {availableModules.map((module) => (
              <Link className="dashboard-module" to={module.path} key={module.key}>
                <span className="dashboard-module__icon">
                  <AppIcon name={module.icon} size={22} />
                </span>
                <span className="dashboard-module__copy">
                  <strong>{module.label}</strong>
                  <small>{module.description}</small>
                </span>
                <AppIcon name="arrowRight" size={18} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty">
            <p>No hay módulos operativos asignados a este rol por el momento.</p>
          </div>
        )}
      </section>

      {pendingModules.length > 0 && (
        <section className="dashboard-pending" aria-labelledby="pending-title">
          <h2 id="pending-title">En preparación</h2>
          <ul>
            {pendingModules.map((module) => (
              <li className="dashboard-pending__module" key={module.key}>
                <AppIcon name={module.icon} size={20} />
                <div className="dashboard-module__copy">
                  <h3>{module.label}</h3>
                  <p>{module.description}</p>
                </div>
                <span className="dashboard-module__status">Próximamente</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <aside className="dashboard-note">
        <AppIcon name="inventory" size={20} />
        <div>
          <strong>Catálogo y existencias</strong>
          <p>
            Consulta los productos en Medicamentos y sus unidades físicas y
            vendibles en Inventario.
          </p>
        </div>
      </aside>
    </div>
  );
};
