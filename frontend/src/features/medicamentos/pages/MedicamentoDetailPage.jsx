import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { StatusBadge } from '../../../components/StatusBadge.jsx';
import { ROLES } from '../../../constants/roles.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { getMedicamento } from '../services/medicamento.service.js';
import '../styles/medicamentos.css';

export const MedicamentoDetailPage = () => {
  const { idMedicamento } = useParams();
  const { usuario } = useAuth();
  const location = useLocation();
  const [med, setMed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setMed(null); setError('');
    const id = Number(idMedicamento);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) { setError('El identificador del medicamento no es válido.'); setLoading(false); return; }
    getMedicamento(id).then((data) => { if (active) setMed(data); })
      .catch((error) => { if (active) setError(getApiErrorMessage(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [idMedicamento, revision]);

  const fields = med && [
    ['Código', med.codigoMedicamento], ['Nombre comercial', med.nombreComercial],
    ['Forma farmacéutica', med.formaFarmaceutica], ['Presentación', med.presentacion],
    ['Unidad de inventario', med.unidadInventario], ['Stock mínimo', med.stockMinimo],
    ['Proveedor / Laboratorio', med.proveedorLaboratorio?.nombre || '—'],
    ['Condición de venta', med.condicionVenta], ['Vía de administración', med.viaAdministracion],
    ['Tipo de liberación', med.tipoLiberacion]
  ];
  return <div className="catalogo-page">
    <Link className="back-link" to="/medicamentos"><AppIcon name="arrowLeft" size={17} />Volver a Medicamentos</Link>
    {loading ? <CatalogoState loading message="Cargando medicamento…" /> : !med ? <CatalogoState title="No se pudo abrir el medicamento" message={error} onRetry={() => setRevision((current) => current + 1)} /> : <>
      <FeedbackMessage message={location.state?.message} tone="success" />
      <header className="page-heading"><div><h2>{med.nombreComercial}</h2><p>{med.codigoMedicamento} · {med.presentacion}</p></div><div className="medicamento-detail-actions">
        <Link className="button button--secondary" to={`/inventario/medicamentos/${med.idMedicamento}/existencias`}><AppIcon name="inventory" size={18} />Ver existencias</Link>
        <Link className="button button--secondary" to={`/medicamentos/${med.idMedicamento}/composicion`}><AppIcon name="prescription" size={18} />Ver composición</Link>
        {usuario.idRol === ROLES.REGENTE && <Link className="button button--primary" to={`/medicamentos/${med.idMedicamento}/editar`}><AppIcon name="edit" size={18} />Editar datos</Link>}
      </div></header>
      <section className="catalogo-panel" aria-label="Datos del medicamento"><dl className="catalogo-detail">
        {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        <div><dt>Estado</dt><dd><StatusBadge active={med.estado} /></dd></div>
      </dl></section>
    </>}
  </div>;
};
