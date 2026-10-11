import { NavLink } from 'react-router-dom';
import { ROLES } from '../../../constants/roles.js';
import { useAuth } from '../../../hooks/useAuth.js';

export const InventarioNav = () => {
  const { usuario } = useAuth();
  const historial = usuario.idRol !== ROLES.VENDEDOR;
  return <nav className="inventario-nav" aria-label="Consultas de inventario">
    <NavLink to="/inventario" end>Inventario</NavLink>
    <NavLink to="/inventario/stock-bajo">Stock bajo</NavLink>
    {historial && <>
      <NavLink to="/inventario/movimientos">Movimientos</NavLink>
      <NavLink to="/vencimientos" end>Próximos a vencer</NavLink>
      <NavLink to="/vencimientos/vencidos">Vencidos</NavLink>
    </>}
  </nav>;
};
