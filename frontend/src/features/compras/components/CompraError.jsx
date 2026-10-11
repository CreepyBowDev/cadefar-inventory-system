import { CatalogoState } from '../../../components/CatalogoState.jsx';

export const CompraError = ({ consulta }) => <CatalogoState title={consulta.status === 404 ? 'Compra no encontrada' : 'No fue posible cargar la consulta'} message={consulta.error} onRetry={consulta.status === 401 || consulta.status === 403 ? undefined : consulta.retry}>
  {consulta.status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}
</CatalogoState>;
