import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

export const RoleRoute = ({ allowedRoles }) => {
  const { usuario } = useAuth();

  if (!usuario || !allowedRoles.includes(usuario.idRol)) {
    return (
      <Navigate
        to="/dashboard"
        state={{ accessDenied: true }}
        replace
      />
    );
  }

  return <Outlet />;
};
