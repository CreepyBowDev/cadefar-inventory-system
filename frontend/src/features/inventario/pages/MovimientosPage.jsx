import { useSearchParams } from 'react-router-dom';
import { ConsultaResultado } from '../components/ConsultaResultado.jsx';
import { InventarioFilters } from '../components/InventarioFilters.jsx';
import { InventarioNav } from '../components/InventarioNav.jsx';
import { MovimientosTable } from '../components/MovimientosTable.jsx';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { getMovimientos } from '../services/inventario.service.js';
import '../styles/inventario.css';

export const MovimientosPage = () => {
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const filtros = Object.fromEntries(params);
  const consulta = useConsulta(getMovimientos, query, filtros);
  const search = (values) => {
    const next = new URLSearchParams(Object.entries(values).filter(([, value]) => value));
    if (next.toString() === query) consulta.retry();
    else setParams(next);
  };
  return <div className="catalogo-page inventario-page">
    <header className="page-heading"><div><h2>Movimientos de inventario</h2><p>Consulta entradas, salidas y reversiones sin perder la operación original.</p></div></header>
    <InventarioNav />
    <section className="catalogo-panel" aria-label="Movimientos de inventario">
      <InventarioFilters key={query} filtros={filtros} movimientos onSearch={search} onClear={() => search({})} />
      <div className="catalogo-toolbar"><div><h3>Historial</h3><p role="status" aria-live="polite">{consulta.loading ? 'Consultando…' : consulta.error ? 'Consulta no disponible' : `${consulta.data?.length || 0} movimientos`}</p></div><button className="button button--secondary" type="button" onClick={consulta.retry} disabled={consulta.loading}>Actualizar</button></div>
      <p className="catalogo-note">Las fechas del historial se muestran como están registradas, sin conversión horaria. Desde y hasta incluyen el día completo. Los costos conservan sus seis decimales.</p>
      <div aria-busy={consulta.loading}><ConsultaResultado consulta={consulta} empty="No hay movimientos para esta consulta. Ajusta o limpia los filtros."><MovimientosTable movimientos={consulta.data || []} /></ConsultaResultado></div>
    </section>
  </div>;
};
