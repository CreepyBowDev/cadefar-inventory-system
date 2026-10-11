import { Link, useParams } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { StatusBadge } from '../../../components/StatusBadge.jsx';
import { ROLES } from '../../../constants/roles.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { ConsultaMeta } from '../components/ConsultaMeta.jsx';
import { ConsultaResultado } from '../components/ConsultaResultado.jsx';
import { ExistenciasTable } from '../components/ExistenciasTable.jsx';
import { InventarioNav } from '../components/InventarioNav.jsx';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { getExistenciasMedicamento } from '../services/inventario.service.js';
import { idValido } from '../../../utils/presentacion.js';
import '../styles/inventario.css';

const consultarExistencias = (id) => idValido(id) ? getExistenciasMedicamento(id) : Promise.reject({ response: { status: 400, data: { message: 'El identificador del medicamento no es válido.' } } });

export const ExistenciasPage = () => {
  const { idMedicamento } = useParams();
  const { usuario } = useAuth();
  const consulta = useConsulta(consultarExistencias, idMedicamento, idMedicamento);
  const med = consulta.data?.medicamento;
  const existencias = consulta.data?.existencias || [];
  const canSeeMovimientos = usuario.idRol !== ROLES.VENDEDOR;
  return <div className="catalogo-page inventario-page">
    <Link className="back-link" to="/inventario"><AppIcon name="arrowLeft" size={17} />Volver a Inventario</Link>
    <header className="page-heading"><div><h2>{med ? med.nombreComercial : 'Existencias del medicamento'}</h2><p>{med ? `${med.codigoMedicamento} · ${med.formaFarmaceutica} · ${med.presentacion}` : 'Consulta las unidades diferenciadas por vencimiento.'}</p></div>
      {med && <StatusBadge active={med.estado} />}
    </header>
    <InventarioNav />
    <section className="catalogo-panel" aria-label="Existencias del medicamento">
      <div className="catalogo-toolbar"><div><h3>Existencias</h3><p role="status" aria-live="polite">{consulta.loading ? 'Consultando…' : consulta.error ? 'Consulta no disponible' : `${existencias.length} existencias registradas${med ? ` · Unidad: ${med.unidadInventario}` : ''}`}</p></div><button className="button button--secondary" type="button" disabled={consulta.loading} onClick={consulta.retry}>Actualizar</button></div>
      <ConsultaMeta meta={consulta.meta} />
      <div aria-busy={consulta.loading}>
        <ConsultaResultado consulta={{ ...consulta, data: existencias }} empty="Este medicamento todavía no tiene existencias registradas.">
          <ExistenciasTable existencias={existencias} canSeeMovimientos={canSeeMovimientos} canAdjust={usuario.idRol === ROLES.REGENTE} canRetire={usuario.idRol === ROLES.REGENTE} />
        </ConsultaResultado>
      </div>
      {med && <p className="catalogo-note">La precisión mes conserva todo el mes de etiqueta; la precisión día vence al inicio de la fecha indicada. Las unidades vencidas o de medicamentos inactivos conservan saldo físico, pero no son vendibles.</p>}
    </section>
    {med && <div className="inventario-detail-links"><Link className="button button--secondary" to={`/medicamentos/${idMedicamento}`}>Ver ficha del medicamento</Link>{canSeeMovimientos && <Link className="button button--secondary" to={`/inventario/movimientos?idMedicamento=${idMedicamento}`}>Ver historial del medicamento</Link>}</div>}
  </div>;
};
