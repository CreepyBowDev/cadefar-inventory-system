import { useRef, useState } from 'react';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { Modal } from '../../../components/Modal.jsx';
import { costoDecimal, fechaCivil } from '../../../utils/presentacion.js';

export const CompraAnularForm = ({ compra, motivo, onChange, onSubmit, submitting, error, status, requiereConsulta }) => {
  const [validation, setValidation] = useState('');
  const [review, setReview] = useState(null);
  const confirming = useRef(false);
  const blocked = requiereConsulta || status === 401 || status === 403;
  const close = () => { if (!confirming.current) setReview(null); };
  const revisar = (event) => {
    event.preventDefault();
    if (submitting || blocked) return;
    const value = motivo.trim();
    if (!value || value.length > 255) { setValidation('El motivo es obligatorio y admite hasta 255 caracteres.'); return; }
    setValidation(''); setReview({ motivo: value });
  };
  const confirmar = async () => {
    if (!review || confirming.current || blocked) return;
    confirming.current = true;
    try { await onSubmit(review); setReview(null); }
    finally { confirming.current = false; }
  };
  return <section className="catalogo-panel" aria-label="Anular compra">
    <div className="catalogo-toolbar"><div><h3>Anular esta compra</h3><p>Se conserva la adquisición y se compensan sus entradas de inventario.</p></div></div>
    <form className="catalogo-form compra-anular-form" onSubmit={revisar}>
      <fieldset disabled={submitting || blocked || Boolean(review)}><legend>Motivo de anulación de la compra #{compra.idCompra}</legend>
        <div className="form-field"><label htmlFor="compra-anular-motivo">Motivo de anulación</label><textarea id="compra-anular-motivo" rows={3} maxLength={255} required value={motivo} onChange={(e) => { setValidation(''); onChange(e.target.value); }} /><small className="form-field__help">Obligatorio, hasta 255 caracteres. Se conservará con el responsable y la fecha asignados por el servidor.</small></div>
      </fieldset>
      <p className="compra-form__note">El servidor comprobará el saldo, la valoración y el historial de todas las existencias. Si alguna no puede compensarse, rechazará la anulación completa. Las operaciones posteriores pueden impedirla aunque haya stock físico suficiente.</p>
      <FeedbackMessage message={validation || error} />
      {requiereConsulta && <p className="compra-form__note" role="status">Usa «Actualizar» para consultar el estado de la compra antes de otro envío. Se conservará el motivo para una nueva revisión. No hay reintentos automáticos.</p>}
      {status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}
      <div className="catalogo-form__actions"><button className="button button--danger" type="submit" disabled={submitting || blocked || Boolean(review)}>Revisar anulación</button></div>
    </form>
    <Modal open={Boolean(review)} title={`Anular compra #${compra.idCompra}`} description="La anulación compensará las entradas originales mediante movimientos de salida. La compra y sus detalles permanecerán en el historial." onClose={close}>
      {review && <><dl className="compra-review compra-anular-review">
        <div><dt>Compra</dt><dd>#{compra.idCompra} · {fechaCivil(compra.fechaCompra)}</dd></div><div><dt>Proveedor / Laboratorio registrado</dt><dd>{compra.proveedorLaboratorio?.nombre || `Proveedor #${compra.idProveedorLaboratorio}`}</dd></div>
        <div><dt>Total registrado</dt><dd>{costoDecimal(compra.total)}</dd></div><div><dt>Detalles registrados</dt><dd>{compra.detalles.length} · Se compensará la compra completa</dd></div><div><dt>Motivo a registrar</dt><dd>{review.motivo}</dd></div>
      </dl><p className="compra-form__note">La confirmación depende de las comprobaciones del servidor. No se modifica el costo histórico ni se eliminan movimientos originales.</p><div className="modal__actions"><button className="button button--secondary" type="button" disabled={submitting} onClick={close}>Volver al motivo</button><button className="button button--danger" type="button" disabled={submitting || blocked} onClick={confirmar}>{submitting ? 'Anulando…' : 'Confirmar anulación'}</button></div></>}
    </Modal>
  </section>;
};
