import { Outlet } from 'react-router-dom';
import '../features/auth/styles/auth-foundations.css';

export const AuthLayout = () => (
  <main className="auth-layout" aria-label="Acceso a CADEFAR">
    <Outlet />
  </main>
);
