import { ConsultaResultado } from '../components/ConsultaResultado.jsx';
import { InventarioFilters } from '../components/InventarioFilters.jsx';
import { InventarioNav } from '../components/InventarioNav.jsx';
import { MovimientosTable } from '../components/MovimientosTable.jsx';
import { useConsultaAutomatica } from '../../../hooks/useConsultaAutomatica.js';
import { getMovimientos } from '../services/inventario.service.js';
import { validarFiltrosInventario } from '../utils/filtrosInventario.js';
import '../styles/inventario.css';

export const MovimientosPage = () => {
  const { filtros, consulta, errorFiltros, onChange, onClear } = useConsultaAutomatica(getMovimientos, validarFiltrosInventario);
  return <div className="catalogo-page inventario-page">
    <header className="page-heading"><div><h2>Movimientos de inventario</h2><p>Consulta entradas, salidas y reversiones sin perder la operación original.</p></div></header>
    <InventarioNav />
    <section className="catalogo-panel" aria-label="Movimientos de inventario">
      <InventarioFilters filtros={filtros} movimientos error={errorFiltros} onChange={onChange} onClear={onClear} />
      <div className="catalogo-toolbar"><div><h3>Historial</h3><p role="status" aria-live="polite">{consulta.loading ? 'Consultando…' : consulta.error ? 'Consulta no disponible' : `${consulta.data?.length || 0} movimientos`}</p></div><button className="button button--secondary" type="button" onClick={consulta.retry} disabled={consulta.loading || Boolean(errorFiltros)}>Actualizar</button></div>
      <p className="catalogo-note">Las fechas del historial se muestran como están registradas, sin conversión horaria. Desde y hasta incluyen el día completo. Los costos conservan sus seis decimales.</p>
      <div aria-busy={consulta.loading}><ConsultaResultado consulta={consulta} empty="No hay movimientos para esta consulta. Ajusta o limpia los filtros."><MovimientosTable movimientos={consulta.data || []} /></ConsultaResultado></div>
    </section>
  </div>;
};
