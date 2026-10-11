import { AppIcon } from '../../components/AppIcon.jsx';

export const AppHeader = ({
  title,
  navigationOpen,
  closingSession,
  onOpenMenu,
  onChangePassword,
  onLogout
}) => (
  <header className="app-header" inert={navigationOpen}>
    <div className="app-header__inner">
      <div className="app-header__context">
        <button
          className="app-header__menu-button"
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menú de navegación"
          aria-controls="app-sidebar"
          aria-expanded={navigationOpen}
        >
          <AppIcon name="menu" size={22} />
        </button>
        <div>
          <h1 title={title}>{title}</h1>
        </div>
      </div>

      <div className="app-header__actions">
        <button
          className="app-header__action-button"
          type="button"
          onClick={onChangePassword}
          aria-label="Cambiar mi contraseña"
          title="Cambiar mi contraseña"
        >
          <AppIcon name="key" size={19} />
          <span>Cambiar contraseña</span>
        </button>
        <button
          className="app-header__action-button"
          type="button"
          onClick={onLogout}
          disabled={closingSession}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <AppIcon name="logout" size={19} />
          <span>{closingSession ? 'Cerrando…' : 'Salir'}</span>
        </button>
      </div>
    </div>
  </header>
);
