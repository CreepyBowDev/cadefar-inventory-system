import { Link } from 'react-router-dom';
import { ROLES } from '../../../constants/roles.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { useConsultaAutomatica } from '../../../hooks/useConsultaAutomatica.js';
import { getProveedoresLaboratorios } from '../../proveedores/services/proveedor-laboratorio.service.js';
import { CompraError } from '../components/CompraError.jsx';
import { CompraFilters } from '../components/CompraFilters.jsx';
import { CompraTable } from '../components/CompraTable.jsx';
import { getCompras } from '../services/compra.service.js';
import { normalizarFiltrosCompra, validarFiltrosCompra } from '../utils/filtrosCompra.js';
import '../styles/compras.css';

const consultarProveedores = async () => ({ data: await getProveedoresLaboratorios() });

export const ComprasPage = () => {
  const { usuario } = useAuth();
  const { filtros, query, consulta, errorFiltros, onChange, onClear } = useConsultaAutomatica(getCompras, validarFiltrosCompra, normalizarFiltrosCompra);
  const proveedores = useConsulta(consultarProveedores, 'proveedores');
  return <div className="catalogo-page compras-page">
    <header className="page-heading"><div><h2>Compras</h2><p>Consulta adquisiciones, existencias recibidas y operaciones anuladas.</p></div>{usuario?.idRol === ROLES.ADMINISTRADOR && <Link className="button button--primary" to="/compras/nueva">Registrar compra</Link>}</header>
    <section className="catalogo-panel" aria-label="Consulta de compras">
      <CompraFilters filtros={filtros} proveedores={proveedores} error={errorFiltros} onChange={onChange} onClear={onClear} />
      <div className="catalogo-toolbar"><div><h3>Resultados</h3><p role="status" aria-live="polite">{consulta.loading ? 'Consultando compras…' : consulta.error ? 'Consulta no disponible' : `${consulta.data?.length || 0} compras`}</p></div><button className="button button--secondary" type="button" onClick={consulta.retry} disabled={consulta.loading || Boolean(errorFiltros)}>Actualizar</button></div>
      <div aria-busy={consulta.loading}>
        {consulta.loading ? <CatalogoState loading message="Cargando compras…" /> : consulta.error ? <CompraError consulta={consulta} /> : consulta.data?.length ? <CompraTable compras={consulta.data} query={query} /> : <CatalogoState title={query ? 'Sin coincidencias' : 'No hay compras registradas'} message={filtros.claveOperacion ? 'No se encontró una compra propia con esa clave y estos filtros. Revisa la clave o limpia los filtros.' : query ? 'Ajusta o limpia los filtros para consultar otras compras.' : 'Las compras registradas aparecerán aquí.'} />}
      </div>
    </section>
  </div>;
};
