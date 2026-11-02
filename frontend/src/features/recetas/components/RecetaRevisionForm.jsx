import { useRef, useState } from 'react';
import { ConfirmDialog } from '../../../components/ConfirmDialog.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { prepararRevision } from '../utils/recetaForm.js';

export const RecetaRevisionForm = ({ receta, form, onChange, onSubmit, busy, blocked, apiError, status }) => {
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);
  const confirming = useRef(false);
  const reviewButton = useRef(null);
  const revisar = event => {
    event.preventDefault(); if (busy || blocked) return;
    try { setReview(prepararRevision(form)); setError(''); }
    catch (failure) { setError(failure.message); }
  };
  const guardar = async () => {
    if (!review || busy || blocked || confirming.current) return;
    confirming.current = true;
    try { await onSubmit(review); setReview(null); } finally { confirming.current = false; }
  };
  return <section className="catalogo-panel receta-revision" aria-label="Revisión definitiva de receta">
    <h3>Revisar receta física</h3><p>La decisión es definitiva. No confirma la venta ni modifica el inventario.</p>
    <form onSubmit={revisar} autoComplete="off">
      <fieldset disabled={busy || blocked || !!review}>
        <legend className="visually-hidden">Resultado y observación</legend>
        <div className="catalogo-form__grid">
          <div className="form-field"><label htmlFor="receta-resultado">Resultado de la revisión</label><select id="receta-resultado" value={form.resultadoRevision} required onChange={event => { setError(''); onChange({ ...form, resultadoRevision: event.target.value }); }}><option value="">Selecciona un resultado</option><option value="APROBADA">Aprobar</option><option value="RECHAZADA">Rechazar</option></select></div>
          <div className="form-field"><label htmlFor="receta-revision-observacion">Observación de revisión (opcional)</label><input id="receta-revision-observacion" maxLength={500} value={form.observacion} onChange={event => { setError(''); onChange({ ...form, observacion: event.target.value }); }} /><small className="form-field__help">Sustituye la observación registrada. Si la dejas vacía, se elimina. Una sola línea, hasta 500 caracteres.</small></div>
        </div>
      </fieldset>
      <FeedbackMessage message={error || apiError} />
      {status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}
      {blocked && status !== 401 && status !== 403 && <p role="status">Actualiza la receta para comprobar su estado antes de otra revisión.</p>}
      <div className="catalogo-form__actions"><button ref={reviewButton} className="button button--primary" type="submit" disabled={busy || blocked || !!review}>Revisar decisión</button></div>
    </form>
    <ConfirmDialog manageFocus returnFocusRef={reviewButton} open={!!review} title={review?.resultadoRevision === 'APROBADA' ? 'Aprobar receta' : 'Rechazar receta'} description={`Receta #${receta.idReceta}, venta #${receta.idVenta}. La decisión no podrá modificarse y no confirma la venta ni genera movimientos de inventario.`}
      confirmLabel={review?.resultadoRevision === 'APROBADA' ? 'Aprobar receta' : 'Rechazar receta'} tone={review?.resultadoRevision === 'APROBADA' ? 'primary' : 'danger'} busy={busy} onConfirm={guardar} onClose={() => { if (!busy) setReview(null); }} />
  </section>;
};
