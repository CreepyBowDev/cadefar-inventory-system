import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { ConfirmDialog } from '../../../components/ConfirmDialog.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { ROLES } from '../../../constants/roles.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { getPrincipiosActivos } from '../../principios-activos/services/principio-activo.service.js';
import { MedicamentoFilters } from '../components/MedicamentoFilters.jsx';
import { MedicamentoTable } from '../components/MedicamentoTable.jsx';
import { getMedicamentos, updateEstadoMedicamento } from '../services/medicamento.service.js';
import '../styles/medicamentos.css';

export const MedicamentosPage = () => {
  const { usuario } = useAuth();
  const canManage = usuario.idRol === ROLES.REGENTE;
  const vendor = usuario.idRol === ROLES.VENDEDOR;
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const [medicamentos, setMedicamentos] = useState([]);
  const [principios, setPrincipios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [optionsError, setOptionsError] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState(location.state?.message || '');
  const [revision, setRevision] = useState(0);
  const [optionsRevision, setOptionsRevision] = useState(0);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    const search = new URLSearchParams(query);
    getMedicamentos({
      codigoMedicamento: search.get('codigoMedicamento') || '',
      nombreComercial: search.get('nombreComercial') || '',
      idPrincipioActivo: search.getAll('idPrincipioActivo')
    }).then((data) => { if (active) setMedicamentos(data); })
      .catch((error) => { if (active) { setMedicamentos([]); setLoadError(getApiErrorMessage(error)); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, revision]);

  useEffect(() => {
    let active = true;
    setOptionsLoading(true);
    setOptionsError('');
    setPrincipios([]);
    const load = async () => {
      try {
        let options;
        if (vendor) {
          // El Vendedor obtiene solo ingredientes ya expuestos por su catálogo
          // autorizado. La fuente permanece independiente de los resultados.
          const catalogo = await getMedicamentos();
          const unique = new Map();
          catalogo.forEach((med) => med.composicion.forEach((comp) => {
            if (comp.principioActivo) unique.set(comp.idPrincipioActivo, comp.principioActivo);
          }));
          options = [...unique.values()];
        } else {
          options = await getPrincipiosActivos();
        }
        if (active) setPrincipios(options.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
      } catch (error) {
        if (active) setOptionsError(getApiErrorMessage(error, 'No fue posible cargar los criterios de composición.'));
      } finally { if (active) setOptionsLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [vendor, optionsRevision]);

  const search = (filters) => {
    const next = new URLSearchParams();
    if (filters.codigoMedicamento.trim()) next.set('codigoMedicamento', filters.codigoMedicamento.trim());
    if (filters.nombreComercial.trim()) next.set('nombreComercial', filters.nombreComercial.trim());
    filters.idPrincipioActivo.forEach((id) => next.append('idPrincipioActivo', id));
    setActionError('');
    setSuccess('');
    setLoading(true);
    setParams(next);
    setRevision((current) => current + 1);
  };

  const toggleEstado = async () => {
    if (!target || busy) return;
    setBusy(true); setActionError(''); setSuccess('');
    try {
      const saved = await updateEstadoMedicamento(target.idMedicamento, !target.estado);
      setMedicamentos((current) => current.map((med) => med.idMedicamento === saved.idMedicamento ? saved : med));
      setSuccess(`${saved.nombreComercial} fue ${saved.estado ? 'activado' : 'desactivado'} correctamente.`);
    } catch (error) { setActionError(getApiErrorMessage(error)); }
    finally { setTarget(null); setBusy(false); }
  };

  return <div className="catalogo-page medicamentos-page">
    <header className="page-heading"><div><h2>Medicamentos</h2><p>Consulta el catálogo y busca productos por código, nombre o composición.</p></div>
      {canManage && <Link className="button button--primary" to="/medicamentos/nuevo"><AppIcon name="plus" size={18} />Nuevo medicamento</Link>}
    </header>
    <FeedbackMessage message={success} tone="success" /><FeedbackMessage message={actionError} />
    <section className="catalogo-panel" aria-label="Catálogo de medicamentos">
      <MedicamentoFilters key={query} initialFilters={{ codigoMedicamento: params.get('codigoMedicamento') || '', nombreComercial: params.get('nombreComercial') || '', idPrincipioActivo: params.getAll('idPrincipioActivo') }} principios={principios} vendor={vendor} optionsLoading={optionsLoading} optionsError={optionsError} loading={loading} onSearch={search} onClear={() => search({ codigoMedicamento: '', nombreComercial: '', idPrincipioActivo: [] })} onRetryOptions={() => setOptionsRevision((current) => current + 1)} />
      <div className="catalogo-toolbar"><div><h3>Resultados</h3><p>{loading ? 'Consultando medicamentos…' : `${medicamentos.length} medicamentos`}</p></div></div>
      {loading ? <CatalogoState loading message="Cargando medicamentos…" /> : loadError ? <CatalogoState title="No fue posible cargar el catálogo" message={loadError} onRetry={() => setRevision((current) => current + 1)} /> : medicamentos.length ? <MedicamentoTable medicamentos={medicamentos} canManage={canManage} busy={busy} onToggleEstado={setTarget} /> : <CatalogoState title={query ? 'Sin coincidencias' : 'No hay medicamentos registrados'} message={query ? 'Ajusta o limpia los filtros para consultar otros resultados.' : 'Todavía no hay productos en el catálogo.'} />}
    </section>
    {canManage && <ConfirmDialog open={Boolean(target)} title={target?.estado ? 'Desactivar medicamento' : 'Activar medicamento'} description={target?.estado ? `${target.nombreComercial} quedará inactivo. Sus datos y su historial se conservarán.` : `${target?.nombreComercial || 'El medicamento'} volverá a estar activo.`} confirmLabel={target?.estado ? 'Desactivar' : 'Activar'} tone={target?.estado ? 'danger' : 'primary'} busy={busy} onConfirm={toggleEstado} onClose={() => setTarget(null)} />}
  </div>;
};
