import { useEffect, useRef, useState } from 'react';
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

const SEARCH_DELAY = 350;
const readFilters = (query) => {
  const params = new URLSearchParams(query);
  return {
    codigoMedicamento: params.get('codigoMedicamento') || '',
    nombreComercial: params.get('nombreComercial') || '',
    idPrincipioActivo: params.getAll('idPrincipioActivo')
  };
};

export const MedicamentosPage = () => {
  const { usuario } = useAuth();
  const canManage = usuario.idRol === ROLES.REGENTE;
  const vendor = usuario.idRol === ROLES.VENDEDOR;
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const [filters, setFilters] = useState(() => readFilters(query));
  const draftFilters = useRef(filters);
  const searchTimer = useRef(null);
  const requestVersion = useRef(0);
  const internalQuery = useRef(null);
  const [medicamentos, setMedicamentos] = useState([]);
  const [principios, setPrincipios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
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
    const appliedFilters = readFilters(query);
    if (internalQuery.current === query) {
      // Una búsqueda propia no debe reemplazar texto que ya se siguió escribiendo.
      internalQuery.current = null;
    } else {
      // Restaurar filtros al navegar o cambiar la URL, cancelando el debounce.
      clearTimeout(searchTimer.current);
      draftFilters.current = appliedFilters;
      setFilters(appliedFilters);
    }
    const version = ++requestVersion.current;
    const isCurrent = () => active && version === requestVersion.current;
    setLoading(true);
    setLoadError('');
    getMedicamentos(appliedFilters)
      .then((data) => { if (isCurrent()) setMedicamentos(data); })
      .catch((error) => { if (isCurrent()) { setMedicamentos([]); setLoadError(getApiErrorMessage(error)); } })
      .finally(() => { if (isCurrent()) { setLoading(false); setLoaded(true); } });
    return () => { active = false; };
  }, [query, revision]);

  useEffect(() => () => {
    clearTimeout(searchTimer.current);
    requestVersion.current += 1;
  }, []);

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

  const search = (nextFilters) => {
    clearTimeout(searchTimer.current);
    const next = new URLSearchParams();
    if (nextFilters.codigoMedicamento.trim()) next.set('codigoMedicamento', nextFilters.codigoMedicamento.trim());
    if (nextFilters.nombreComercial.trim()) next.set('nombreComercial', nextFilters.nombreComercial.trim());
    nextFilters.idPrincipioActivo.forEach((id) => next.append('idPrincipioActivo', id));
    internalQuery.current = next.toString();
    // La búsqueda automática no agrega una entrada de historial por cada pausa.
    if (internalQuery.current === query) setRevision((current) => current + 1);
    else setParams(next, { replace: true });
  };

  const changeFilters = (nextFilters, immediate = false) => {
    clearTimeout(searchTimer.current);
    draftFilters.current = nextFilters;
    setFilters(nextFilters);
    // Invalidar también durante el debounce: ni un resultado ni un error previo
    // puede reemplazar el estado correspondiente a los filtros más recientes.
    requestVersion.current += 1;
    setActionError('');
    setSuccess('');
    setLoadError('');
    setLoading(true);
    if (immediate) search(nextFilters);
    else searchTimer.current = setTimeout(() => search(nextFilters), SEARCH_DELAY);
  };

  const togglePrincipio = (id) => {
    const value = String(id);
    const current = draftFilters.current;
    changeFilters({
      ...current,
      idPrincipioActivo: current.idPrincipioActivo.includes(value)
        ? current.idPrincipioActivo.filter((selected) => selected !== value)
        : [...current.idPrincipioActivo, value]
    }, true);
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
      <MedicamentoFilters filters={filters} principios={principios} vendor={vendor} optionsLoading={optionsLoading} optionsError={optionsError} onTextChange={(field, value) => changeFilters({ ...draftFilters.current, [field]: value })} onTogglePrincipio={togglePrincipio} onClear={() => changeFilters({ codigoMedicamento: '', nombreComercial: '', idPrincipioActivo: [] }, true)} onRetryOptions={() => setOptionsRevision((current) => current + 1)} />
      <div className="catalogo-toolbar"><div><h3>Resultados</h3><p role="status" aria-live="polite">{loading ? 'Consultando medicamentos…' : `${medicamentos.length} medicamentos`}</p></div></div>
      <div aria-busy={loading}>
        {loading && !loaded ? <CatalogoState loading message="Cargando medicamentos…" /> : loadError ? <CatalogoState title="No fue posible cargar el catálogo" message={loadError} onRetry={() => changeFilters(draftFilters.current, true)} /> : medicamentos.length ? <MedicamentoTable medicamentos={medicamentos} canManage={canManage} busy={busy || loading} onToggleEstado={setTarget} /> : <CatalogoState title={query ? 'Sin coincidencias' : 'No hay medicamentos registrados'} message={query ? 'Ajusta o limpia los filtros para consultar otros resultados.' : 'Todavía no hay productos en el catálogo.'} />}
      </div>
    </section>
    {canManage && <ConfirmDialog open={Boolean(target)} title={target?.estado ? 'Desactivar medicamento' : 'Activar medicamento'} description={target?.estado ? `${target.nombreComercial} quedará inactivo. Sus datos y su historial se conservarán.` : `${target?.nombreComercial || 'El medicamento'} volverá a estar activo.`} confirmLabel={target?.estado ? 'Desactivar' : 'Activar'} tone={target?.estado ? 'danger' : 'primary'} busy={busy} onConfirm={toggleEstado} onClose={() => setTarget(null)} />}
  </div>;
};
