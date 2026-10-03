import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { ConfirmDialog } from '../../../components/ConfirmDialog.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { ROLES } from '../../../constants/roles.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { PrincipioActivoTable } from '../components/PrincipioActivoTable.jsx';
import { getPrincipiosActivos, updateEstadoPrincipioActivo } from '../services/principio-activo.service.js';
import '../styles/principios-activos.css';

export const PrincipiosActivosPage = () => {
  const { usuario } = useAuth();
  const canManage = usuario.idRol === ROLES.REGENTE;
  const location = useLocation();
  const [principios, setPrincipios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(location.state?.message || '');
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError('');
    getPrincipiosActivos().then((data) => { if (active) setPrincipios(data); })
      .catch((error) => { if (active) { setPrincipios([]); setLoadError(getApiErrorMessage(error)); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  // Este catálogo no ofrece filtros de búsqueda en la API actual.
  const visible = useMemo(() => principios.filter((p) =>
    [p.nombre, p.descripcion].some((value) => value?.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')))
  ), [principios, search]);
  const toggle = async () => {
    if (!target || busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const saved = await updateEstadoPrincipioActivo(target.idPrincipioActivo, !target.estado);
      setPrincipios((current) => current.map((p) => p.idPrincipioActivo === saved.idPrincipioActivo ? saved : p));
      setSuccess(`${saved.nombre} fue ${saved.estado ? 'activado' : 'desactivado'} correctamente.`);
    } catch (error) { setError(getApiErrorMessage(error)); }
    finally { setTarget(null); setBusy(false); }
  };
  return <div className="catalogo-page">
    <header className="page-heading"><div><h2>Principios activos</h2><p>Consulta el catálogo de ingredientes utilizados en la composición de medicamentos.</p></div>{canManage && <Link className="button button--primary" to="/principios-activos/nuevo"><AppIcon name="plus" size={18} />Nuevo principio activo</Link>}</header>
    <FeedbackMessage message={success} tone="success" /><FeedbackMessage message={error} />
    <section className="catalogo-panel" aria-label="Catálogo de principios activos">
      <div className="catalogo-toolbar"><div><h3>Registros</h3><p>{loading ? 'Consultando registros…' : `${visible.length} principios activos`}</p></div><div className="form-field"><label htmlFor="buscarPrincipios">Buscar por nombre o descripción</label><input id="buscarPrincipios" type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
      {loading ? <CatalogoState loading message="Cargando principios activos…" /> : loadError ? <CatalogoState title="No fue posible cargar los registros" message={loadError} onRetry={() => setRevision((current) => current + 1)} /> : visible.length ? <PrincipioActivoTable principios={visible} canManage={canManage} busy={busy} onToggleEstado={setTarget} /> : <CatalogoState title={search.trim() ? 'Sin coincidencias' : 'No hay principios activos registrados'} message="No hay registros para mostrar con los criterios actuales." />}
    </section>
    {canManage && <ConfirmDialog open={Boolean(target)} title={target?.estado ? 'Desactivar principio activo' : 'Activar principio activo'} description={`${target?.nombre || 'El principio activo'} quedará ${target?.estado ? 'inactivo' : 'activo'}. Sus relaciones de composición se conservarán.`} confirmLabel={target?.estado ? 'Desactivar' : 'Activar'} tone={target?.estado ? 'danger' : 'primary'} busy={busy} onConfirm={toggle} onClose={() => setTarget(null)} />}
  </div>;
};
