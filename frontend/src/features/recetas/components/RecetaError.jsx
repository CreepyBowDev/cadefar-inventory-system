import { CatalogoState } from '../../../components/CatalogoState.jsx';

export const RecetaError = ({ consulta }) => <CatalogoState icon="prescription"
  title={consulta.status === 404 ? 'Venta o receta no encontrada' : consulta.status === 401 ? 'Sesión no válida' : consulta.status === 403 ? 'Acceso no autorizado' : 'No fue posible cargar las recetas'}
  message={consulta.error} onRetry={consulta.status === 401 || consulta.status === 403 ? undefined : consulta.retry}>
  {consulta.status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}
</CatalogoState>;
