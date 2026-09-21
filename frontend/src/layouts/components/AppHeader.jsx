import { AppIcon } from '../../components/AppIcon.jsx';
import escudoCadefar from '../../assets/images/brand/escudo-cadefar.png';

export const AppHeader = ({
  title,
  usuario,
  roleName,
  closingSession,
  onOpenMenu,
  onChangePassword,
  onLogout
}) => (
  <header className="app-header">
    <div className="app-header__context">
      <button
        className="app-header__menu-button"
        type="button"
        onClick={onOpenMenu}
        aria-label="Abrir menú de navegación"
        aria-controls="app-sidebar"
      >
        <AppIcon name="menu" size={22} />
      </button>
      <div>
        <span>Sistema administrativo</span>
        <h1>{title}</h1>
      </div>
    </div>

    <div className="app-header__account">
      <img src={escudoCadefar} alt="" aria-hidden="true" />
      <div className="app-header__user-data">
        <strong>{usuario.nombreUsuario}</strong>
        <span>{roleName}</span>
      </div>
      <div className="app-header__actions">
        <button
          className="app-header__action-button"
          type="button"
          onClick={onChangePassword}
          aria-label="Cambiar mi contraseña"
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
        >
          <AppIcon name="logout" size={19} />
          <span>{closingSession ? 'Cerrando…' : 'Salir'}</span>
        </button>
      </div>
    </div>
  </header>
);
