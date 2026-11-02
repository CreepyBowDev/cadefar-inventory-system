import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth.js';
import { ROLES } from '../../../constants/roles.js';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { VentaFilters } from '../components/VentaFilters.jsx';
import { VentaTable } from '../components/VentaTable.jsx';
import { VentaPagination } from '../components/VentaPagination.jsx';
import { VentaError } from '../components/VentaError.jsx';
import { leerConsultaVenta, serializarConsultaVenta } from '../utils/consultaVenta.js';
import { getVentas } from '../services/venta.service.js';
import '../styles/ventas.css';

export const VentasPage = ({ modo }) => {
  const { usuario } = useAuth();
  const location = useLocation();
  const sidebarItemKey = !modo && usuario?.idRol === ROLES.ADMINISTRADOR && location.state?.sidebarItemKey === 'anular-venta' ? 'anular-venta' : undefined;
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const registroReceta = modo === 'registrarReceta';
  const revisionRecetas = modo === 'revisarRecetas';
  const { filtros, error } = leerConsultaVenta(query || (registroReceta ? 'estadoOperacion=PENDIENTE' : ''));
  const consulta = useConsulta(getVentas, `${modo || 'ventas'}?${query}`, filtros, !error);
  const cambiarConsulta = (nuevos) => {
    const siguiente = serializarConsultaVenta(nuevos);
    if (siguiente === query) consulta.retry();
    else { consulta.invalidate(); setParams(siguiente, { state: { sidebarItemKey } }); }
  };
  const restringida = consulta.status === 401 || consulta.status === 403;
  const paginacion = consulta.paginacion;
  const fueraDeRango = paginacion && paginacion.pagina > Math.max(1, paginacion.totalPaginas);
  const filtrada = ['idVenta', 'idUsuario', 'estadoOperacion', 'desde', 'hasta'].some(campo => filtros[campo]);
  return <div className="catalogo-page ventas-page">
    <header className="page-heading"><div><h2>{registroReceta ? 'Registrar receta: seleccionar venta' : revisionRecetas ? 'Revisar recetas: seleccionar venta' : 'Ventas'}</h2><p>{registroReceta ? 'Selecciona una venta pendiente para registrar su receta y vincular los productos correspondientes.' : revisionRecetas ? 'Selecciona una venta y consulta sus recetas pendientes de revisión. La API consulta las recetas por venta, no mediante un listado global.' : 'Consulta operaciones pendientes, confirmadas y anuladas, sin confundir el registro con la venta efectiva.'}</p></div>{!modo && usuario?.idRol === ROLES.VENDEDOR && <Link className="button button--primary" to="/ventas/nueva">Registrar venta</Link>}</header>
    <section className="catalogo-panel" aria-label="Consulta de ventas">
      <VentaFilters key={`${modo || 'ventas'}:${query}`} filtros={filtros} disabled={consulta.loading || restringida} onSearch={cambiarConsulta} onClear={() => cambiarConsulta({})} />
      <div className="catalogo-toolbar"><div><h3>Resultados</h3><p role="status" aria-live="polite">{consulta.loading ? 'Consultando ventas…' : consulta.error || error ? 'Consulta no disponible' : `${consulta.data?.length || 0} de ${paginacion?.total ?? 0} ventas registradas`}</p></div><button className="button button--secondary" type="button" onClick={consulta.retry} disabled={consulta.loading || restringida || !!error}>Actualizar</button></div>
      <p className="catalogo-note">Una venta pendiente no descuenta ni reserva inventario. Los importes son los registrados por el backend.</p>
      {sidebarItemKey && <p className="catalogo-note">Selecciona el detalle de una venta pendiente o confirmada para revisar su anulación. Las ventas ya anuladas solo pueden consultarse.</p>}
      <div aria-busy={consulta.loading}>
        {error ? <><FeedbackMessage message={error} /><CatalogoState icon="sales" title="Revisa los filtros" message="Corrige los criterios y pulsa Buscar ventas, o limpia los filtros para volver al listado." /></>
          : consulta.loading ? <CatalogoState loading message="Cargando ventas…" />
            : consulta.error ? <VentaError consulta={consulta} />
              : fueraDeRango ? <CatalogoState icon="sales" title="Esta página no tiene resultados" message="La página solicitada supera las páginas disponibles."><button className="button button--secondary" type="button" onClick={() => cambiarConsulta({ ...filtros, pagina: '1' })}>Volver a la primera página</button></CatalogoState>
                : consulta.data?.length ? <VentaTable ventas={consulta.data} query={query} modo={modo} sidebarItemKey={sidebarItemKey} />
                  : <CatalogoState icon="sales" title={filtrada ? 'Sin coincidencias' : 'No hay ventas registradas'} message={filtrada ? 'Ajusta o limpia los filtros para consultar otras ventas.' : 'Las ventas registradas aparecerán aquí.'} />}
      </div>
      {!error && <VentaPagination paginacion={paginacion} filtros={filtros} disabled={consulta.loading || restringida || !!consulta.error} onPage={pagina => cambiarConsulta({ ...filtros, pagina: String(pagina) })} onLimit={limite => cambiarConsulta({ ...filtros, limite, pagina: '1' })} />}
    </section>
  </div>;
};
