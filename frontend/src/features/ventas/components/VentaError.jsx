import { CatalogoState } from '../../../components/CatalogoState.jsx';

export const VentaError = ({ consulta }) => <CatalogoState icon="sales"
  title={consulta.status === 404 ? 'Venta no encontrada' : consulta.status === 401 ? 'Sesión no válida' : consulta.status === 403 ? 'Acceso no autorizado' : 'No fue posible cargar la consulta'}
  message={consulta.error} onRetry={consulta.status === 401 || consulta.status === 403 ? undefined : consulta.retry}>
  {consulta.status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}
</CatalogoState>;
