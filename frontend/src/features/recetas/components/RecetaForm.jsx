import { useRef, useState } from 'react';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { ConfirmDialog } from '../../../components/ConfirmDialog.jsx';
import { cantidad } from '../../../utils/presentacion.js';
import { prepararReceta } from '../utils/recetaForm.js';

export const RecetaForm = ({ venta, form, onChange, onSubmit, busy, blocked, apiError, status }) => {
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);
  const confirming = useRef(false);
  const reviewButton = useRef(null);
  const campo = nombre => ({ value: form[nombre], onChange: event => { setError(''); onChange({ ...form, [nombre]: event.target.value }); } });
  const revisar = event => {
    event.preventDefault();
    if (busy || blocked) return;
    try { setReview(prepararReceta(form, venta)); setError(''); }
    catch (failure) { setError(failure.message); }
  };
  const guardar = async () => {
    if (!review || busy || blocked || confirming.current) return;
    confirming.current = true;
    try { await onSubmit(review); setReview(null); } finally { confirming.current = false; }
  };
  return <>
    <form className="receta-form" onSubmit={revisar} autoComplete="off">
      <fieldset disabled={busy || blocked || !!review}>
        <legend>Datos de la receta física</legend>
        <p className="form-field__help">Venta #{venta.idVenta}. El registro queda pendiente de revisión y no confirma la venta. No se adjuntan archivos.</p>
        <div className="catalogo-form__grid">
          <div className="form-field"><label htmlFor="receta-numero">Número de receta (opcional)</label><input id="receta-numero" maxLength={80} {...campo('numeroReceta')} /></div>
          <div className="form-field"><label htmlFor="receta-fecha">Fecha de receta</label><input id="receta-fecha" type="date" min="1000-01-01" max="9999-12-31" required {...campo('fechaReceta')} /></div>
          <div className="form-field"><label htmlFor="receta-paciente">Nombre del paciente</label><input id="receta-paciente" maxLength={150} required {...campo('nombrePaciente')} /></div>
          <div className="form-field"><label htmlFor="receta-documento">Documento del paciente</label><input id="receta-documento" maxLength={40} required {...campo('documentoPaciente')} /></div>
          <div className="form-field"><label htmlFor="receta-medico">Nombre del médico</label><input id="receta-medico" maxLength={150} required {...campo('nombreMedico')} /></div>
          <div className="form-field"><label htmlFor="receta-modalidad">Modalidad</label><input id="receta-modalidad" maxLength={50} required {...campo('modalidad')} /><small className="form-field__help">Transcribe la modalidad indicada en la receta física.</small></div>
          <div className="form-field catalogo-form__wide"><label htmlFor="receta-observacion">Observación (opcional)</label><input id="receta-observacion" maxLength={500} {...campo('observacion')} /><small className="form-field__help">Una sola línea, hasta 500 caracteres.</small></div>
        </div>
      </fieldset>
      <fieldset disabled={busy || blocked || !!review} className="receta-productos">
        <legend>Productos respaldados por esta receta</legend>
        <p className="form-field__help">Selecciona los detalles correspondientes de esta venta. Un detalle con receta vinculada no puede sustituirse. Si no seleccionas ninguno, la receta se registra sin respaldar productos.</p>
        {venta.detalles.map(detalle => <label key={detalle.idDetalleVenta} className="receta-producto">
          <input type="checkbox" value={detalle.idDetalleVenta} checked={form.idsDetallesVenta.includes(detalle.idDetalleVenta)} disabled={detalle.idReceta !== null}
            onChange={event => { setError(''); onChange({ ...form, idsDetallesVenta: event.target.checked ? [...form.idsDetallesVenta, detalle.idDetalleVenta] : form.idsDetallesVenta.filter(id => id !== detalle.idDetalleVenta) }); }} />
          <span><strong>{detalle.existencia?.medicamento?.nombreComercial || 'Medicamento no disponible'}</strong><small>Detalle #{detalle.idDetalleVenta} · Cantidad: {cantidad(detalle.cantidad)}{detalle.idReceta !== null ? ` · Ya vinculado a receta #${detalle.idReceta}` : ''}</small></span>
        </label>)}
        {!form.idsDetallesVenta.length && <p className="receta-note">Sin productos seleccionados: la receta no satisfará por sí sola los requisitos de ningún detalle.</p>}
      </fieldset>
      <FeedbackMessage message={error || apiError} />
      {status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}
      {blocked && status !== 401 && status !== 403 && <p role="status" className="receta-note">El envío está bloqueado. Vuelve a la venta y comprueba las recetas y sus vínculos antes de iniciar otro registro; este endpoint no dispone de una clave para reintentos.</p>}
      <div className="catalogo-form__actions"><button ref={reviewButton} className="button button--primary" type="submit" disabled={busy || blocked || !!review}>Revisar registro de receta</button></div>
    </form>
    <ConfirmDialog manageFocus returnFocusRef={reviewButton} open={!!review} title="Registrar receta pendiente" description={`Venta #${venta.idVenta}: ${form.idsDetallesVenta.length} productos seleccionados. Se registrarán los datos del formulario sin archivos y sin aprobación automática. La venta seguirá pendiente.`}
      confirmLabel="Registrar receta" tone="primary" busy={busy} onConfirm={guardar} onClose={() => { if (!busy) setReview(null); }} />
  </>;
};
