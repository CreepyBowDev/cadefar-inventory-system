import { CatalogoState } from '../../../components/CatalogoState.jsx';

export const ConsultaResultado = ({ consulta, empty, children }) => {
  if (consulta.loading) return <CatalogoState loading message="Consultando inventario…" />;
  if (consulta.error) return <CatalogoState title="No fue posible cargar la consulta" message={consulta.error} onRetry={consulta.status === 401 || consulta.status === 403 ? undefined : consulta.retry}>
    {/* Recargar permite que AuthContext descarte la sesión pública obsoleta. */}
    {consulta.status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}
  </CatalogoState>;
  if (!consulta.data?.length) return <CatalogoState title="Sin resultados" message={empty} />;
  return children;
};
