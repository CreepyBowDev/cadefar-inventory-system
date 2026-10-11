import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { AppIcon } from '../../components/AppIcon.jsx';
import { getNavigationForRole } from '../../constants/navigation.js';
import logoCadefar from '../../assets/images/brand/logo-cadefar.png';

export const AppSidebar = ({
  usuario,
  roleName,
  open,
  mobile,
  closingSession,
  onNavigate,
  onLogout,
  onClose
}) => {
  const navigationItems = getNavigationForRole(usuario.idRol);
  const sidebarRef = useRef(null);

  useEffect(() => {
    if (!mobile || !open) return undefined;

    const sidebar = sidebarRef.current;
    const menuButton = document.querySelector('.app-header__menu-button');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar.querySelector('.app-sidebar__close').focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab') {
        const controls = [...sidebar.querySelectorAll('a[href], button:not(:disabled)')]
          .filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    sidebar.addEventListener('keydown', handleKeyDown);
    return () => {
      sidebar.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (menuButton?.isConnected && menuButton.getClientRects().length > 0) menuButton.focus();
    };
  }, [mobile, open, onClose]);

  return (
    <>
      <button
        className={`sidebar-backdrop${open ? ' is-visible' : ''}`}
        type="button"
        aria-label="Cerrar menú de navegación"
        aria-hidden={!mobile || !open}
        tabIndex={-1}
        onClick={onClose}
      />

      <aside
        className={`app-sidebar${open ? ' is-open' : ''}`}
        id="app-sidebar"
        ref={sidebarRef}
        inert={mobile && !open}
        role={mobile && open ? 'dialog' : undefined}
        aria-modal={mobile && open ? true : undefined}
        aria-label="Menú de navegación"
      >
        <div className="app-sidebar__brand">
          <div className="app-sidebar__logo-frame">
            <img src={logoCadefar} alt="Farmacia CADEFAR" />
          </div>
          <button
            className="app-sidebar__close"
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <AppIcon name="close" size={21} />
          </button>
        </div>

        <nav className="app-sidebar__navigation" aria-label="Navegación principal">
          <p className="app-sidebar__section-label">Módulos</p>
          <ul>
            {navigationItems.map((item) => (
              <li key={item.key}>
                {item.available ? (
                  <NavLink
                    to={item.path}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `app-sidebar__link${isActive ? ' is-active' : ''}`
                    }
                  >
                    <AppIcon name={item.icon} size={19} />
                    <span>{item.label}</span>
                  </NavLink>
                ) : (
                  <div
                    className="app-sidebar__link app-sidebar__link--disabled"
                    title="Módulo pendiente de integración"
                  >
                    <AppIcon name={item.icon} size={19} />
                    <span>{item.label}</span>
                    <span className="app-sidebar__pending">Próximamente</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="app-sidebar__account">
          <div className="app-sidebar__avatar" aria-hidden="true">
            {usuario.nombreUsuario.charAt(0).toUpperCase()}
          </div>
          <div className="app-sidebar__account-data">
            <strong title={usuario.nombreUsuario}>{usuario.nombreUsuario}</strong>
            <span>{roleName}</span>
          </div>
          <button
            className="app-sidebar__logout"
            type="button"
            onClick={onLogout}
            disabled={closingSession}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <AppIcon name="logout" size={19} />
          </button>
        </div>
      </aside>
    </>
  );
};
