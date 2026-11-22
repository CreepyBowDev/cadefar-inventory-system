import { useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth.js';
import { ROLES } from '../../../constants/roles.js';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { getEstadisticasVentas, getEstadisticasCompras, getEstadisticasPerdidas } from '../services/reporte.service.js';
import { serializarEstadisticasReporte } from '../utils/consultaReporte.js';
import { useReporteEstadisticas } from '../hooks/useReporteEstadisticas.js';
import { ReporteEstadisticas } from './ReporteEstadisticas.jsx';
import { ReporteVentasResumen } from './ReporteVentasResultado.jsx';
import { ReporteComprasResumen } from './ReporteComprasResultado.jsx';
import { PerdidasResumen } from './PerdidasResultado.jsx';
import { ExportacionTabular } from './ExportacionTabular.jsx';

// Tres fuentes concretas del mismo contrato JSON; CU40 no participa.
const fuentes = {
  ventas: { consultar: getEstadisticasVentas, Resumen: ReporteVentasResumen },
  compras: { consultar: getEstadisticasCompras, Resumen: ReporteComprasResumen },
  perdidas: { consultar: getEstadisticasPerdidas, Resumen: PerdidasResumen }
};

export const ReporteFuenteEstadisticas = ({ tipo, activa, aplicada, restringida, onRestringida, onAplicar }) => {
  const { consultar, Resumen } = fuentes[tipo];
  const { usuario, loading } = useAuth();
  const [granularidad, setGranularidad] = useState(aplicada.ui?.uiGranularidad || '');
  const [seleccionLocal, setSeleccionLocal] = useState(null);
  const aplicadaGranularidad = aplicada.ui?.uiGranularidad;
  useEffect(() => { setGranularidad(aplicadaGranularidad || ''); }, [aplicadaGranularidad]);
  let clave = '', error = '';
  const permitida = usuario?.idRol === ROLES.ADMINISTRADOR || (tipo === 'perdidas' && usuario?.idRol === ROLES.REGENTE);
  if (activa && aplicada.habilitada && aplicadaGranularidad && !restringida && !loading && permitida) {
    try {
      const params = new URLSearchParams(serializarEstadisticasReporte({ ...aplicada.filtrosAplicados, granularidad: aplicadaGranularidad }, tipo));
      params.sort(); clave = params.toString();
    }
    catch (fallo) { error = fallo.message; }
  }
  const consulta = useReporteEstadisticas(consultar, clave, usuario, onRestringida);
  const contexto = `${tipo}:${clave}`;
  // Misma decisión UX de la gráfica existente, ahora compartida con el archivo.
  // Reinicia por criterios aplicados/fuente, no por borradores o paginación.
  const seleccion = seleccionLocal?.contexto === contexto ? seleccionLocal.valor
    : { grafico: 'BARRAS', metrica: tipo === 'perdidas' ? 'CANTIDAD_RETIROS' : 'CANTIDAD' };
  const cambiarSeleccion = valor => setSeleccionLocal({ contexto, valor });
  if (!activa) return null;
  return <>
    <fieldset className="reporte-estadisticas__aplicacion">
      <legend>Agrupación estadística por aplicar</legend>
      <div className="reporte-estadisticas__controles">
      <div className="form-field"><label htmlFor="reporte-granularidad">Granularidad estadística</label><select id="reporte-granularidad" value={granularidad} onChange={e => setGranularidad(e.target.value)} disabled={restringida}><option value="">Selecciona una granularidad</option><option value="DIA">Día (DIA)</option><option value="MES">Mes (MES)</option><option value="ANIO">Año (ANIO)</option></select></div>
      <button type="button" className="button button--secondary" disabled={!granularidad || restringida || aplicada.estado === 'invalida'} onClick={() => onAplicar('ESTADISTICAS', granularidad)}>Aplicar granularidad</button>
      </div>
      <p className="catalogo-note">Editar la granularidad no cambia los resultados hasta aplicarla. Los filtros se aplican con Buscar.</p>
    </fieldset>
    <div className="catalogo-toolbar"><div><h3>Resultados estadísticos</h3><p role="status">{consulta.loading ? 'Consultando estadísticas…' : 'Consulta independiente del detalle paginado'}</p></div><button type="button" className="button button--secondary" disabled={!clave || consulta.loading || restringida} onClick={consulta.retry}>Actualizar estadísticas</button></div>
    <p className="reporte-contexto reporte-estadisticas__contexto">Vista elegida: Estadísticas. Granularidad aplicada: {aplicadaGranularidad || 'ninguna'}. El período y estado/motivo del resultado se muestran en sus criterios aplicados.</p>
    <FeedbackMessage message={error || consulta.error} />
    <div aria-busy={consulta.loading}>
      {restringida ? <CatalogoState title="Estadísticas no disponibles" message="Tu sesión o rol no permite consultar esta información."><a className="button button--secondary" href="/login">Ir al inicio de sesión</a></CatalogoState>
        : aplicada.error ? <CatalogoState title="Revisa los filtros" message="Corrige la URL o limpia los filtros." />
          : !aplicada.habilitada || !aplicadaGranularidad ? <CatalogoState title="Selecciona período y granularidad" message="Aplica un período con Buscar y elige explícitamente DIA, MES o ANIO con Aplicar granularidad." />
            : error ? <CatalogoState title="Revisa la granularidad" message={error} />
              : consulta.loading ? <CatalogoState loading message={`Cargando estadísticas de ${tipo}…`} />
                : consulta.error ? <CatalogoState title="No fue posible consultar estadísticas" message={consulta.error} onRetry={consulta.retry} />
                  : consulta.data && <><Resumen periodo={consulta.data.periodo} resumen={consulta.data.resumen} {...consulta.data.filtros} /><ReporteEstadisticas key={contexto} data={consulta.data} seleccion={seleccion} onSeleccion={cambiarSeleccion} /></>}
    </div>
    <ExportacionTabular fuente={tipo} presentacion="ESTADISTICA" seleccion={seleccion} restringida={restringida} onRestringida={onRestringida} />
  </>;
};
