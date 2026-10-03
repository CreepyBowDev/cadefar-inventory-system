import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { ConfirmDialog } from '../../../components/ConfirmDialog.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { Modal } from '../../../components/Modal.jsx';
import { ROLES } from '../../../constants/roles.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { getPrincipiosActivos } from '../../principios-activos/services/principio-activo.service.js';
import { ComposicionForm } from '../components/ComposicionForm.jsx';
import { ComposicionTable } from '../components/ComposicionTable.jsx';
import { createComposicion, deleteComposicion, getComposicionMedicamento, getMedicamento, updateComposicion } from '../services/medicamento.service.js';
import '../styles/medicamentos.css';

export const MedicamentoComposicionPage = () => {
  const { idMedicamento } = useParams();
  const { usuario } = useAuth();
  const canManage = usuario.idRol === ROLES.REGENTE;
  const [med, setMed] = useState(null);
  const [composicion, setComposicion] = useState([]);
  const [principios, setPrincipios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [optionsError, setOptionsError] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialog, setDialog] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [optionsRevision, setOptionsRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(''); setMed(null); setComposicion([]);
    setDialog(null); setRemoveTarget(null); setError(''); setSuccess('');
    const id = Number(idMedicamento);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) { setLoadError('El identificador del medicamento no es válido.'); setLoading(false); return; }
    Promise.all([getMedicamento(id), getComposicionMedicamento(id)])
      .then(([data, items]) => { if (active) { setMed(data); setComposicion(items); } })
      .catch((error) => { if (active) setLoadError(getApiErrorMessage(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [idMedicamento, revision]);

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    setOptionsLoading(true); setOptionsError('');
    getPrincipiosActivos().then((data) => { if (active) setPrincipios(data); })
      .catch((error) => { if (active) setOptionsError(getApiErrorMessage(error)); })
      .finally(() => { if (active) setOptionsLoading(false); });
    return () => { active = false; };
  }, [canManage, optionsRevision]);

  const openForm = (item = null) => { setFormError(''); setError(''); setSuccess(''); setDialog({ item }); };
  const save = async (data) => {
    if (busy || !dialog || !canManage) return;
    setBusy(true); setFormError(''); setSuccess('');
    try {
      const saved = dialog.item
        ? await updateComposicion(med.idMedicamento, dialog.item.idComposicion, data)
        : await createComposicion(med.idMedicamento, data);
      setComposicion((current) => dialog.item
        ? current.map((item) => item.idComposicion === saved.idComposicion ? saved : item)
        : [...current, saved]);
      setSuccess('La composición fue actualizada correctamente.'); setDialog(null);
    } catch (error) { setFormError(getApiErrorMessage(error)); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (busy || !removeTarget || !canManage) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await deleteComposicion(med.idMedicamento, removeTarget.idComposicion);
      setComposicion((current) => current.filter((item) => item.idComposicion !== removeTarget.idComposicion));
      setSuccess('La relación de composición fue retirada correctamente.');
    } catch (error) { setError(getApiErrorMessage(error)); }
    finally { setRemoveTarget(null); setBusy(false); }
  };

  return <div className="catalogo-page">
    <Link className="back-link" to={`/medicamentos/${idMedicamento}`}><AppIcon name="arrowLeft" size={17} />Volver al medicamento</Link>
    {loading ? <CatalogoState loading message="Cargando composición…" /> : !med ? <CatalogoState title="No se pudo abrir la composición" message={loadError} onRetry={() => setRevision((current) => current + 1)} /> : <>
      <header className="page-heading"><div><h2>Composición</h2><p>{med.nombreComercial} · {med.codigoMedicamento} · {med.presentacion}</p></div>
        {canManage && <button className="button button--primary" type="button" disabled={busy || optionsLoading || Boolean(optionsError) || !principios.length} onClick={() => openForm()}><AppIcon name="plus" size={18} />{optionsLoading ? 'Cargando principios…' : 'Agregar principio activo'}</button>}
      </header>
      <FeedbackMessage message={success} tone="success" /><FeedbackMessage message={error} />
      {canManage && optionsError && <div><FeedbackMessage message={optionsError} /><button className="button button--secondary" type="button" onClick={() => setOptionsRevision((current) => current + 1)}>Reintentar catálogo de principios</button></div>}
      {canManage && !optionsLoading && !optionsError && !principios.length && <p className="catalogo-note">No hay principios activos registrados. <Link to="/principios-activos/nuevo">Registrar un principio activo</Link></p>}
      <section className="catalogo-panel" aria-label="Composición del medicamento">
        <div className="catalogo-toolbar"><div><h3>Principios del medicamento</h3><p>{composicion.length} ingredientes registrados</p></div></div>
        {composicion.length ? <ComposicionTable composicion={composicion} canManage={canManage} busy={busy} onEdit={openForm} onRemove={(item) => { setError(''); setSuccess(''); setRemoveTarget(item); }} /> : <CatalogoState title="Sin composición registrada" message="Este medicamento todavía no tiene ingredientes registrados en su composición." />}
        {canManage && <p className="catalogo-note">El backend valida si la composición puede modificarse. Con historial, los cambios quedan bloqueados. Para corregir un ingrediente, retira la relación incorrecta y después agrega la correcta.</p>}
      </section>
      {canManage && <>
        <Modal open={Boolean(dialog)} title={dialog?.item ? 'Editar composición' : 'Agregar principio activo'} description={med.nombreComercial} onClose={busy ? () => {} : () => setDialog(null)}>
          {dialog && <ComposicionForm key={dialog.item?.idComposicion || 'nuevo'} initialData={dialog.item} principios={principios} submitting={busy} apiError={formError} onSubmit={save} onCancel={() => setDialog(null)} />}
        </Modal>
        <ConfirmDialog open={Boolean(removeTarget)} title="Retirar relación de composición" description={`Se retirará ${removeTarget?.principioActivo?.nombre || 'el ingrediente'} de ${med.nombreComercial}. El medicamento y el principio activo se conservarán. El backend permite esta operación únicamente antes de existir historial.`} confirmLabel="Retirar relación" busy={busy} onConfirm={remove} onClose={() => setRemoveTarget(null)} />
      </>}
    </>}
  </div>;
};
