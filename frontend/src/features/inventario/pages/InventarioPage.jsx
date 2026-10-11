import { ROLES } from '../../../constants/roles.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { ConsultaMeta } from '../components/ConsultaMeta.jsx';
import { ConsultaResultado } from '../components/ConsultaResultado.jsx';
import { ExistenciasTable } from '../components/ExistenciasTable.jsx';
import { InventarioFilters } from '../components/InventarioFilters.jsx';
import { InventarioNav } from '../components/InventarioNav.jsx';
import { InventarioTable } from '../components/InventarioTable.jsx';
import { useConsultaAutomatica } from '../../../hooks/useConsultaAutomatica.js';
import { getInventario, getProximosAVencer, getStockBajo, getVencidos } from '../services/inventario.service.js';
import { validarFiltrosInventario } from '../utils/filtrosInventario.js';
import '../styles/inventario.css';

const vistas = {
  inventario: { titulo: 'Inventario', descripcion: 'Medicamentos con existencias registradas, incluidos agotados e inactivos. Consulta su stock físico y vendible.', consultar: getInventario, empty: 'No hay medicamentos con existencias registradas que coincidan con la consulta. Revisa los filtros; crear un producto en el catálogo no registra existencias.' },
  stockBajo: { titulo: 'Stock bajo', descripcion: 'Medicamentos activos cuyo stock vendible es menor o igual al mínimo definido.', consultar: getStockBajo, empty: 'No hay medicamentos con stock bajo para estos filtros.' },
  proximos: { titulo: 'Próximos a vencer', descripcion: 'Existencias con unidades físicas, todavía no vencidas, con etiqueta dentro de los próximos tres meses calendario.', consultar: getProximosAVencer, empty: 'No hay existencias próximas a vencer para estos filtros.', existencias: true },
  vencidos: { titulo: 'Vencidos pendientes de retiro', descripcion: 'Unidades vencidas que permanecen físicamente registradas, también de medicamentos inactivos.', consultar: getVencidos, empty: 'No hay unidades vencidas pendientes de retiro para estos filtros.', existencias: true }
};

export const InventarioPage = ({ vista = 'inventario' }) => {
  const { usuario } = useAuth();
  const config = vistas[vista];
  const { filtros, consulta, errorFiltros, onChange, onClear } = useConsultaAutomatica(config.consultar, validarFiltrosInventario);
  return <div className="catalogo-page inventario-page">
    <header className="page-heading"><div><h2>{config.titulo}</h2><p>{config.descripcion}</p></div></header>
    <InventarioNav />
    <section className="catalogo-panel" aria-label={config.titulo}>
      <InventarioFilters filtros={filtros} error={errorFiltros} onChange={onChange} onClear={onClear} />
      <div className="catalogo-toolbar"><div><h3>Resultados</h3><p role="status" aria-live="polite">{consulta.loading ? 'Consultando…' : consulta.error ? 'Consulta no disponible' : `${consulta.data?.length || 0} ${config.existencias ? 'existencias' : 'medicamentos'}`}</p></div><button className="button button--secondary" type="button" onClick={consulta.retry} disabled={consulta.loading || Boolean(errorFiltros)}>Actualizar</button></div>
      <ConsultaMeta meta={consulta.meta} />
      {!config.existencias && <p className="catalogo-note">Físico: unidades registradas en la farmacia. Vendible: unidades que pueden venderse según el estado y el vencimiento.</p>}
      <div aria-busy={consulta.loading}><ConsultaResultado consulta={consulta} empty={config.empty}>
        {config.existencias ? <ExistenciasTable existencias={consulta.data || []} showMedicamento canSeeMovimientos={usuario.idRol !== ROLES.VENDEDOR} canRetire={vista === 'vencidos' && usuario.idRol === ROLES.REGENTE} /> : <InventarioTable medicamentos={consulta.data || []} stockBajo={vista === 'stockBajo'} />}
      </ConsultaResultado></div>
    </section>
  </div>;
};
