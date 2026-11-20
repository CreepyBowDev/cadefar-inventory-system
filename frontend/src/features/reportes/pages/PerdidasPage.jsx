import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { Pagination } from '../../../components/Pagination.jsx';
import { ReporteFilters } from '../components/ReporteFilters.jsx';
import { PerdidasResumen, PerdidasTable } from '../components/PerdidasResultado.jsx';
import { useReporteConsulta } from '../hooks/useReporteConsulta.js';
import { getReportePerdidas } from '../services/reporte.service.js';
import '../styles/reportes.css';

export const PerdidasPage = () => {
  const { query, aplicada, consulta, borrador, errorLocal, cambiarBorrador, cambiarConsulta, buscar, limpiar } = useReporteConsulta('perdidas', getReportePerdidas);
  const restringida = consulta.status === 401 || consulta.status === 403;
  const paginacion = consulta.paginacion;
  const fueraDeRango = paginacion && paginacion.pagina > Math.max(1, paginacion.totalPaginas);
  const resultado = consulta.data;
  return <div className="catalogo-page reporte-perdidas-page">
    <header className="page-heading"><div><h2>Consulta de pérdidas</h2><p>Consulta retiros brutos por vencimiento o daño, con costos e importes históricos del servidor.</p></div></header>
    <section className="catalogo-panel" aria-label="Consulta de pérdidas">
      <ReporteFilters tipo="perdidas" borrador={borrador} onChange={cambiarBorrador} disabled={consulta.loading || restringida} onSearch={buscar} onClear={limpiar} />
      <FeedbackMessage message={errorLocal || aplicada.error} />
      <div className="catalogo-toolbar"><div><h3>Resultados</h3><p role="status" aria-live="polite">{consulta.loading ? 'Consultando pérdidas…' : aplicada.error || consulta.error ? 'Consulta no disponible' : !aplicada.habilitada ? 'Sin período aplicado' : `${resultado?.detalle.length || 0} de ${paginacion?.total ?? 0} retiros`}</p></div><button className="button button--secondary" type="button" onClick={consulta.retry} disabled={!aplicada.habilitada || consulta.loading || restringida}>Actualizar</button></div>
      <p className="catalogo-note">Solo salidas originales por VENCIMIENTO/DAÑO, sin ajustes negativos, ventas ni compensaciones. La referencia de reversión se informa sin descontarla ni habilitar su registro. Para volver desde el historial usa Atrás del navegador.</p>
      <div aria-busy={consulta.loading}>
        {aplicada.error ? <CatalogoState icon="report" title="Revisa los filtros" message="Corrige la URL o selecciona nuevos criterios y pulsa Buscar. Limpiar retira todos los filtros." />
          : !aplicada.habilitada ? <CatalogoState icon="report" title="Selecciona un período" message="Elige Día, Mes o Período y pulsa Buscar. No se consulta sin una selección temporal." />
            : consulta.loading ? <CatalogoState loading message="Cargando pérdidas…" />
              : consulta.error ? <CatalogoState icon="report" title={consulta.status === 401 ? 'Sesión no válida' : consulta.status === 403 ? 'Acceso no autorizado' : 'No fue posible consultar las pérdidas'} message={consulta.error} onRetry={restringida ? undefined : consulta.retry}>{consulta.status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}</CatalogoState>
                : resultado && <>
                  <PerdidasResumen periodo={resultado.periodo} resumen={resultado.resumen} motivo={aplicada.filtros.motivo} />
                  {fueraDeRango ? <CatalogoState icon="report" title="Esta página no tiene resultados" message="La página solicitada supera las páginas disponibles. El resumen conserva todas las coincidencias."><button type="button" className="button button--secondary" onClick={() => cambiarConsulta({ ...aplicada.filtros, pagina: '1' })}>Volver a la primera página</button></CatalogoState>
                    : resultado.detalle.length ? <PerdidasTable detalle={resultado.detalle} query={query} /> : <CatalogoState icon="report" title="Sin coincidencias" message="No hay retiros para el período y motivo aplicados. Cambia los filtros y pulsa Buscar." />}
                </>}
      </div>
      {aplicada.habilitada && <Pagination id="reporte" nombre="Retiros" filtros={aplicada.filtros} paginacion={paginacion} disabled={consulta.loading || restringida || !!consulta.error} onPage={pagina => cambiarConsulta({ ...aplicada.filtros, pagina: String(pagina) })} onLimit={limite => cambiarConsulta({ ...aplicada.filtros, limite, pagina: '1' })} />}
    </section>
  </div>;
};
