import { useSearchParams } from 'react-router-dom';
import { ROLES } from '../../../constants/roles.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { ConsultaMeta } from '../components/ConsultaMeta.jsx';
import { ConsultaResultado } from '../components/ConsultaResultado.jsx';
import { ExistenciasTable } from '../components/ExistenciasTable.jsx';
import { InventarioFilters } from '../components/InventarioFilters.jsx';
import { InventarioNav } from '../components/InventarioNav.jsx';
import { InventarioTable } from '../components/InventarioTable.jsx';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { getInventario, getProximosAVencer, getStockBajo, getVencidos } from '../services/inventario.service.js';
import '../styles/inventario.css';

const vistas = {
  inventario: { titulo: 'Inventario', descripcion: 'Consulta las unidades físicas y las disponibles para venta, incluso de medicamentos inactivos.', consultar: getInventario, empty: 'No hay medicamentos que coincidan con la consulta. Ajusta o limpia los filtros.' },
  stockBajo: { titulo: 'Stock bajo', descripcion: 'Medicamentos activos cuyo stock vendible es menor o igual al mínimo definido.', consultar: getStockBajo, empty: 'No hay medicamentos con stock bajo para estos filtros.' },
  proximos: { titulo: 'Próximos a vencer', descripcion: 'Existencias con unidades físicas, todavía no vencidas, con etiqueta dentro de los próximos tres meses calendario.', consultar: getProximosAVencer, empty: 'No hay existencias próximas a vencer para estos filtros.', existencias: true },
  vencidos: { titulo: 'Vencidos pendientes de retiro', descripcion: 'Unidades vencidas que permanecen físicamente registradas, también de medicamentos inactivos.', consultar: getVencidos, empty: 'No hay unidades vencidas pendientes de retiro para estos filtros.', existencias: true }
};

export const InventarioPage = ({ vista = 'inventario' }) => {
  const [params, setParams] = useSearchParams();
  const { usuario } = useAuth();
  const config = vistas[vista];
  const query = params.toString();
  const filtros = Object.fromEntries(params);
  const consulta = useConsulta(config.consultar, `${vista}:${query}`, filtros);
  const search = (values) => {
    const next = new URLSearchParams(Object.entries(values).filter(([, value]) => value));
    if (next.toString() === query) consulta.retry();
    else setParams(next);
  };
  return <div className="catalogo-page inventario-page">
    <header className="page-heading"><div><h2>{config.titulo}</h2><p>{config.descripcion}</p></div></header>
    <InventarioNav />
    <section className="catalogo-panel" aria-label={config.titulo}>
      <InventarioFilters key={`${vista}:${query}`} filtros={filtros} onSearch={search} onClear={() => search({})} />
      <div className="catalogo-toolbar"><div><h3>Resultados</h3><p role="status" aria-live="polite">{consulta.loading ? 'Consultando…' : consulta.error ? 'Consulta no disponible' : `${consulta.data?.length || 0} ${config.existencias ? 'existencias' : 'medicamentos'}`}</p></div><button className="button button--secondary" type="button" onClick={consulta.retry} disabled={consulta.loading}>Actualizar</button></div>
      <ConsultaMeta meta={consulta.meta} />
      {!config.existencias && <p className="catalogo-note">Físico: unidades registradas en la farmacia. Vendible: unidades que pueden venderse según el estado y el vencimiento.</p>}
      <div aria-busy={consulta.loading}><ConsultaResultado consulta={consulta} empty={config.empty}>
        {config.existencias ? <ExistenciasTable existencias={consulta.data || []} showMedicamento canSeeMovimientos={usuario.idRol !== ROLES.VENDEDOR} canRetire={vista === 'vencidos' && usuario.idRol === ROLES.REGENTE} /> : <InventarioTable medicamentos={consulta.data || []} stockBajo={vista === 'stockBajo'} />}
      </ConsultaResultado></div>
    </section>
  </div>;
};
