import { Link, useLocation } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { getNavigationForRole } from '../../../constants/navigation.js';
import { getRoleName } from '../../../constants/roles.js';
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
  const roleName = getRoleName(usuario.idRol);
  const modules = getNavigationForRole(usuario.idRol).filter(
    (item) => item.key !== 'dashboard'
  );

  return (
    <div className="dashboard-page">
      {location.state?.accessDenied && (
        <div className="feedback feedback--error" role="alert">
          <AppIcon name="alert" size={18} />
          <p>No tienes autorización para acceder a esa sección.</p>
        </div>
      )}

      <section className="dashboard-welcome" aria-labelledby="dashboard-title">
        <div className="dashboard-welcome__accent" aria-hidden="true" />
        <div className="dashboard-welcome__content">
          <p className="dashboard-welcome__date">{formatDate()}</p>
          <h2 id="dashboard-title">Bienvenido, {usuario.nombreUsuario}</h2>
          <p>
            Accede a las funciones disponibles para tu trabajo dentro de
            Farmacia CADEFAR.
          </p>
        </div>
        <div className="dashboard-welcome__session">
          <span>Sesión activa</span>
          <strong>{roleName}</strong>
        </div>
      </section>

      <section className="dashboard-modules" aria-labelledby="modules-title">
        <header className="dashboard-section-heading">
          <div>
            <h2 id="modules-title">Tu espacio de trabajo</h2>
            <p>Los módulos visibles corresponden a tu rol actual.</p>
          </div>
        </header>

        {modules.length > 0 ? (
          <div className="dashboard-module-list">
            {modules.map((module) => {
              const content = (
                <>
                  <span className="dashboard-module__icon">
                    <AppIcon name={module.icon} size={22} />
                  </span>
                  <span className="dashboard-module__copy">
                    <strong>{module.label}</strong>
                    <small>{module.description}</small>
                  </span>
                  {module.available ? (
                    <AppIcon name="arrowRight" size={19} />
                  ) : (
                    <span className="dashboard-module__status">Próximamente</span>
                  )}
                </>
              );

              return module.available ? (
                <Link
                  className="dashboard-module"
                  to={module.path}
                  key={module.key}
                >
                  {content}
                </Link>
              ) : (
                <div
                  className="dashboard-module dashboard-module--pending"
                  key={module.key}
                >
                  {content}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="dashboard-empty">
            <p>No hay módulos operativos asignados a este rol por el momento.</p>
          </div>
        )}
      </section>

      <aside className="dashboard-note">
        <AppIcon name="inventory" size={20} />
        <div>
          <strong>Información confiable, operaciones trazables</strong>
          <p>
            CADEFAR conserva el responsable de cada operación y mantiene la
            seguridad real en el backend.
          </p>
        </div>
      </aside>
    </div>
  );
};
