import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getPageTitle } from '../constants/navigation.js';
import { getRoleName } from '../constants/roles.js';
import { ChangeOwnPasswordDialog } from '../features/usuarios/components/ChangeOwnPasswordDialog.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { AppHeader } from './components/AppHeader.jsx';
import { AppSidebar } from './components/AppSidebar.jsx';
import '../styles/app-shell.css';

export const MainLayout = () => {
  const [closingSession, setClosingSession] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const roleName = getRoleName(usuario.idRol);

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
        closingSession={closingSession}
        onNavigate={() => setSidebarOpen(false)}
        onLogout={handleLogout}
        onClose={() => setSidebarOpen(false)}
      />
      <AppHeader
        title={getPageTitle(location.pathname)}
        usuario={usuario}
        roleName={roleName}
        closingSession={closingSession}
        onOpenMenu={() => setSidebarOpen(true)}
        onChangePassword={() => setPasswordDialogOpen(true)}
        onLogout={handleLogout}
      />
      <main className="main-content">
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
