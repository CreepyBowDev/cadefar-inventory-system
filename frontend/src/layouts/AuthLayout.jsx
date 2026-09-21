import { Outlet } from 'react-router-dom';

export const AuthLayout = () => (
  <main className="auth-layout" aria-label="Acceso a CADEFAR">
    <Outlet />
  </main>
);
