import { useSearchParams } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { BitacoraTable } from '../components/BitacoraTable.jsx';
import { BitacoraFilters } from '../components/BitacoraFilters.jsx';
import { BitacoraPagination } from '../components/BitacoraPagination.jsx';
import { leerConsultaBitacora, serializarConsultaBitacora } from '../utils/consultaBitacora.js';
import { getEventosBitacora } from '../services/bitacora.service.js';
import '../styles/bitacora.css';

export const BitacoraPage = () => {
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const { filtros, error: errorUrl } = leerConsultaBitacora(query);
  const consulta = useConsulta(getEventosBitacora, query, filtros, !errorUrl);
  const cambiarConsulta = nuevos => {
    const siguiente = serializarConsultaBitacora(nuevos);
    if (siguiente === query) consulta.retry();
    else { consulta.invalidate(); setParams(siguiente); }
  };
  const restringida = consulta.status === 401 || consulta.status === 403;
  const fueraDeRango = consulta.meta && Number(filtros.pagina) > Math.max(1, consulta.meta.totalPaginas);
  const filtrada = Object.keys(filtros).some(campo => !['pagina', 'limite'].includes(campo));
  const resumen = consulta.loading ? 'Consultando eventos…' : consulta.error || errorUrl ? 'Consulta no disponible'
    : `${consulta.data?.length || 0} de ${consulta.meta?.total ?? 0} eventos registrados`;
  return <div className="catalogo-page bitacora-page">
    <header className="page-heading"><div>
      <h2>Bitácora</h2><p>Consulta los eventos del sistema, sus responsables y resultados.</p>
    </div></header>
    <section className="catalogo-panel" aria-labelledby="bitacora-eventos-title">
      <div className="catalogo-toolbar">
        <div><h3 id="bitacora-eventos-title">Eventos registrados</h3><p role="status" aria-live="polite">{resumen}</p></div>
        <button className="button button--secondary" type="button" onClick={consulta.retry} disabled={consulta.loading || restringida || !!errorUrl}>
          <AppIcon name="retry" size={17} />Actualizar
        </button>
      </div>
      <BitacoraFilters key={query} filtros={filtros} disabled={consulta.loading || restringida} onSearch={cambiarConsulta} onClear={() => cambiarConsulta({ pagina: '1', limite: '25' })} />
      {errorUrl && <div className="bitacora-url-error"><FeedbackMessage message={errorUrl} /></div>}
      <p className="catalogo-note bitacora-note" id="bitacora-zona">Hora de Bolivia (America/La_Paz, UTC−4). Orden del más reciente al más antiguo. El total corresponde a los criterios aplicados.</p>
      <div aria-busy={consulta.loading}>
        {errorUrl ? <CatalogoState icon="audit" title="Corrige los criterios de consulta" message="Revisa los filtros y pulsa Buscar, o usa Limpiar para volver al historial." />
          : consulta.loading ? <CatalogoState loading message="Cargando Bitácora…" />
          : consulta.error ? <CatalogoState icon="audit" title={consulta.status === 401 ? 'Sesión no válida' : consulta.status === 403 ? 'Acceso no autorizado' : 'No fue posible consultar la Bitácora'} message={consulta.error} onRetry={restringida ? undefined : consulta.retry}>
            {consulta.status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}
          </CatalogoState>
            : fueraDeRango ? <CatalogoState icon="audit" title="Esta página no tiene resultados" message="La página solicitada supera las páginas disponibles para estos criterios.">
              <button type="button" className="button button--secondary" onClick={() => cambiarConsulta({ ...filtros, pagina: '1' })}>Volver a la primera página</button>
            </CatalogoState>
              : consulta.data?.length ? <BitacoraTable eventos={consulta.data} query={query} />
                : <CatalogoState icon="audit" title={filtrada ? 'No hay eventos que coincidan' : 'No hay eventos registrados'} message={filtrada ? 'Cambia los filtros y pulsa Buscar, o usa Limpiar para ver el historial.' : 'Los eventos capturados por el sistema aparecerán aquí. Usa Actualizar para volver a consultar.'} />}
      </div>
      {!errorUrl && <BitacoraPagination meta={consulta.meta} filtros={filtros} disabled={consulta.loading || restringida || !!consulta.error} onPage={pagina => cambiarConsulta({ ...filtros, pagina: String(pagina) })} onLimit={limite => cambiarConsulta({ ...filtros, limite, pagina: '1' })} />}
      <p className="catalogo-note">Pueden incorporarse eventos entre consultas; las páginas no representan una instantánea fija del historial.</p>
    </section>
  </div>;
};
