import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getPageTitle } from '../constants/navigation.js';
import { getRoleName } from '../constants/roles.js';
import { ChangeOwnPasswordDialog } from '../features/usuarios/components/ChangeOwnPasswordDialog.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { AppHeader } from './components/AppHeader.jsx';
import { AppSidebar } from './components/AppSidebar.jsx';
import '../styles/app-shell.css';
import '../styles/app-foundations.css';

export const MainLayout = () => {
  const [closingSession, setClosingSession] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileNavigation, setMobileNavigation] = useState(() => window.matchMedia('(max-width: 960px)').matches);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const roleName = getRoleName(usuario.idRol);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const navigationOpen = mobileNavigation && sidebarOpen;

  useEffect(() => {
    const media = window.matchMedia('(max-width: 960px)');
    const handleChange = (event) => {
      setMobileNavigation(event.matches);
      setSidebarOpen(false);
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setClosingSession(true);

    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setClosingSession(false);
    }
  };

  return (
    <div className="main-layout">
      <AppSidebar
        usuario={usuario}
        roleName={roleName}
        open={sidebarOpen}
        mobile={mobileNavigation}
        closingSession={closingSession}
        onNavigate={closeSidebar}
        onLogout={handleLogout}
        onClose={closeSidebar}
      />
      <AppHeader
        title={getPageTitle(location.pathname)}
        navigationOpen={navigationOpen}
        closingSession={closingSession}
        onOpenMenu={() => setSidebarOpen(true)}
        onChangePassword={() => setPasswordDialogOpen(true)}
        onLogout={handleLogout}
      />
      <main className="main-content" inert={navigationOpen}>
        <div className="main-content__inner">
          <Outlet />
        </div>
      </main>

      <ChangeOwnPasswordDialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
      />
    </div>
  );
};
