import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { Pagination } from '../../../components/Pagination.jsx';
import { useReporteConsulta } from '../hooks/useReporteConsulta.js';
import { ReporteFilters } from './ReporteFilters.jsx';
import '../styles/reportes.css';

// Coordinación compartida exclusivamente por CU38/CU39; cada página aporta su resultado.
export const ReporteOperacionesConsulta = ({ tipo, consultar, titulo, descripcion, nota, Resumen, Table }) => {
  const nombre = tipo === 'compras' ? 'Compras' : 'Ventas';
  const { query, aplicada, consulta, borrador, errorLocal, cambiarBorrador, cambiarConsulta, buscar, limpiar } = useReporteConsulta(tipo, consultar);
  const restringida = consulta.status === 401 || consulta.status === 403;
  const paginacion = consulta.paginacion;
  const fueraDeRango = paginacion && paginacion.pagina > Math.max(1, paginacion.totalPaginas);
  const resultado = consulta.data;
  return <div className={`catalogo-page reporte-operaciones-page reporte-${tipo}-page`}>
    <header className="page-heading"><div><h2>{titulo}</h2><p>{descripcion}</p></div></header>
    <section className="catalogo-panel" aria-label={`Consulta del reporte de ${tipo}`}>
      <ReporteFilters tipo={tipo} borrador={borrador} onChange={cambiarBorrador} disabled={consulta.loading || restringida} onSearch={buscar} onClear={limpiar} />
      <FeedbackMessage message={errorLocal || aplicada.error} />
      <div className="catalogo-toolbar"><div><h3>Resultados</h3><p role="status" aria-live="polite">{consulta.loading ? 'Consultando reporte…' : aplicada.error || consulta.error ? 'Consulta no disponible' : !aplicada.habilitada ? 'Sin período aplicado' : `${resultado?.detalle.length || 0} de ${paginacion?.total ?? 0} ${tipo}`}</p></div><button className="button button--secondary" type="button" onClick={consulta.retry} disabled={!aplicada.habilitada || consulta.loading || restringida}>Actualizar</button></div>
      <p className="catalogo-note">{nota} Para volver desde una ficha usa Atrás del navegador.</p>
      <div aria-busy={consulta.loading}>
        {aplicada.error ? <CatalogoState icon="report" title="Revisa los filtros" message="Corrige la URL o selecciona nuevos criterios y pulsa Buscar. Limpiar retira todos los filtros." />
          : !aplicada.habilitada ? <CatalogoState icon="report" title="Selecciona un período" message="Elige Día, Mes o Período y pulsa Buscar. No se consulta sin una selección temporal." />
            : consulta.loading ? <CatalogoState loading message={`Cargando reporte de ${tipo}…`} />
              : consulta.error ? <CatalogoState icon="report" title={consulta.status === 401 ? 'Sesión no válida' : consulta.status === 403 ? 'Acceso no autorizado' : 'No fue posible consultar el reporte'} message={consulta.error} onRetry={restringida ? undefined : consulta.retry}>{consulta.status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}</CatalogoState>
                : resultado && <>
                  <Resumen periodo={resultado.periodo} resumen={resultado.resumen} estadoOperacion={aplicada.filtros.estadoOperacion} />
                  {fueraDeRango ? <CatalogoState icon="report" title="Esta página no tiene resultados" message="La página solicitada supera las páginas disponibles. El resumen conserva todas las coincidencias."><button type="button" className="button button--secondary" onClick={() => cambiarConsulta({ ...aplicada.filtros, pagina: '1' })}>Volver a la primera página</button></CatalogoState>
                    : resultado.detalle.length ? <Table detalle={resultado.detalle} query={query} /> : <CatalogoState icon="report" title="Sin coincidencias" message={`No hay ${tipo} para el período y estado aplicados. Cambia los filtros y pulsa Buscar.`} />}
                </>}
      </div>
      {aplicada.habilitada && <Pagination id="reporte" nombre={nombre} filtros={aplicada.filtros} paginacion={paginacion} disabled={consulta.loading || restringida || !!consulta.error} onPage={pagina => cambiarConsulta({ ...aplicada.filtros, pagina: String(pagina) })} onLimit={limite => cambiarConsulta({ ...aplicada.filtros, limite, pagina: '1' })} />}
    </section>
  </div>;
};
