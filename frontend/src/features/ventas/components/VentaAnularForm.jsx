import { useRef, useState } from 'react';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { Modal } from '../../../components/Modal.jsx';
import { costoDecimal, horaCivil } from '../../../utils/presentacion.js';
import { prepararAnulacionVenta } from '../utils/ventaAnulacion.js';
import { VentaEstado } from './VentaEstado.jsx';

export const VentaAnularForm = ({ venta, motivo, onChange, onSubmit, submitting, error, status, requiereConsulta }) => {
  const [validation, setValidation] = useState('');
  const [review, setReview] = useState(null);
  const confirming = useRef(false);
  const reviewButton = useRef(null);
  const blocked = requiereConsulta || status === 401 || status === 403;
  const confirmada = venta.estadoOperacion === 'CONFIRMADA';
  const close = () => { if (!confirming.current) setReview(null); };
  const revisar = event => {
    event.preventDefault();
    if (submitting || blocked) return;
    try { setReview(prepararAnulacionVenta(motivo)); setValidation(''); }
    catch (failure) { setValidation(failure.message); }
  };
  const confirmar = async () => {
    if (!review || submitting || blocked || confirming.current) return;
    confirming.current = true;
    try { await onSubmit(review); setReview(null); } finally { confirming.current = false; }
  };
  return <section className="catalogo-panel" aria-label="Anular venta">
    <div className="catalogo-toolbar"><div><h3>Anular esta venta</h3><p>{confirmada ? 'Se conserva la venta y el backend compensa sus salidas originales.' : 'La venta pendiente se anula sin movimientos de reversión ni cambios de saldo.'}</p></div></div>
    <form className="catalogo-form venta-anular-form" onSubmit={revisar} aria-busy={submitting}>
      <fieldset disabled={submitting || blocked || !!review}>
        <legend>Motivo de anulación de la venta #{venta.idVenta}</legend>
        <div className="form-field"><label htmlFor="venta-anular-motivo">Motivo de anulación</label><textarea id="venta-anular-motivo" rows={3} maxLength={255} required value={motivo} onChange={event => { setValidation(''); onChange(event.target.value); }} /><small className="form-field__help">Obligatorio, hasta 255 caracteres, en una sola línea. Se conservará junto con el responsable y la fecha asignados por el servidor.</small></div>
      </fieldset>
      <p className="form-field__help">Se anula la venta completa, sin eliminar sus productos, recetas ni información histórica. {confirmada ? 'El backend verifica la trazabilidad y registra las reversiones de inventario de forma conjunta. Las unidades regresan al stock físico; eso no garantiza que sean vendibles.' : 'No se reintegran unidades porque esta venta todavía no descontó inventario.'}</p>
      <FeedbackMessage message={validation || error} />
      {requiereConsulta && <p className="form-field__help" role="status">Usa «Actualizar» para consultar el estado real antes de otro envío. El motivo se conserva para una nueva revisión. No hay reintentos automáticos.</p>}
      {status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}
      <div className="catalogo-form__actions"><button ref={reviewButton} className="button button--danger" type="submit" disabled={submitting || blocked || !!review}>Revisar anulación</button></div>
    </form>
    <Modal manageFocus returnFocusRef={reviewButton} open={!!review} title={`Anular venta #${venta.idVenta}`} description={confirmada ? 'La anulación cambiará el estado y compensará las salidas originales mediante reversiones registradas por el backend. La información histórica se conserva.' : 'La anulación cambiará el estado de esta venta pendiente. No generará reversiones ni modificará los saldos porque no hubo salidas de inventario.'} onClose={close}>
      {review && <><dl className="venta-anular-review">
        <div><dt>Venta / Estado actual</dt><dd>#{venta.idVenta} · <VentaEstado estado={venta.estadoOperacion} /></dd></div>
        <div><dt>Responsable del registro</dt><dd>{venta.usuarioRegistrador?.nombreUsuario || `Usuario #${venta.idUsuario}`}</dd></div>
        <div><dt>Fecha de registro</dt><dd>{horaCivil(venta.fechaRegistro)}</dd></div>
        <div><dt>Fecha efectiva de venta</dt><dd>{venta.fechaVenta ? horaCivil(venta.fechaVenta) : 'Sin confirmación registrada'}</dd></div>
        <div><dt>Total registrado</dt><dd>{costoDecimal(venta.total)}</dd></div>
        <div><dt>Productos</dt><dd>{venta.detalles.length} detalles · Anulación completa</dd></div>
        <div><dt>Motivo a registrar</dt><dd>{review.motivo}</dd></div>
      </dl><p className="form-field__help">La operación solo se presenta como exitosa cuando la API devuelve la venta anulada. React no modifica existencias ni genera movimientos.</p>
        <div className="modal__actions"><button className="button button--secondary" type="button" disabled={submitting} onClick={close}>Volver al motivo</button><button className="button button--danger" type="button" disabled={submitting || blocked} onClick={confirmar}>{submitting ? 'Anulando…' : 'Confirmar anulación'}</button></div>
      </>}
    </Modal>
  </section>;
};
