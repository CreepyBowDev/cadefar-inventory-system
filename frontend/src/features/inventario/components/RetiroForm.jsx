import { useRef, useState } from 'react';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { Modal } from '../../../components/Modal.jsx';
import { cantidad, costoDecimal, idValido } from '../../../utils/presentacion.js';

export const RetiroForm = ({ tipo, existencia, medicamento, form, onChange, onSubmit, submitting, blocked, error, status, requiereConsulta }) => {
  const [validation, setValidation] = useState('');
  const [review, setReview] = useState(null);
  const confirming = useRef(false);
  const porDano = tipo === 'dano';
  const motivo = porDano ? 'daño' : 'vencimiento';
  const close = () => { if (!confirming.current) setReview(null); };
  const revisar = (event) => {
    event.preventDefault(); if (blocked || submitting) return;
    const value = form.cantidad.trim();
    if (!idValido(value)) { setValidation('La cantidad debe ser un entero positivo de hasta 2147483647.'); return; }
    if (Number(value) > existencia.stockFisico) { setValidation('La cantidad no puede superar el stock físico observado.'); return; }
    const observacion = form.observacion.trim();
    if ((porDano && !observacion) || observacion.length > 500) { setValidation(porDano ? 'La observación del daño es obligatoria y admite hasta 500 caracteres.' : 'La observación admite hasta 500 caracteres.'); return; }
    const data = { idExistencia: existencia.idExistencia, cantidad: Number(value), stockObservado: existencia.stockFisico, ultimoMovimientoObservado: existencia.ultimoMovimiento };
    if (observacion) data.observacion = observacion;
    setValidation(''); setReview(data);
  };
  const confirmar = async () => {
    if (confirming.current || blocked) return;
    confirming.current = true;
    try { await onSubmit(review); setReview(null); }
    finally { confirming.current = false; }
  };
  return <>
    <form className="catalogo-form retiro-form" onSubmit={revisar}>
      <fieldset disabled={submitting || blocked || Boolean(review)}><legend>Unidades a retirar de {existencia.codigoExistencia}</legend>
        <div className="catalogo-form__grid">
          <div className="form-field"><label htmlFor="retiro-cantidad">Cantidad a retirar por {motivo}</label><input id="retiro-cantidad" inputMode="numeric" maxLength={10} value={form.cantidad} onChange={(e) => { setValidation(''); onChange({ ...form, cantidad: e.target.value }); }} required /><small className="form-field__help">En {medicamento.unidadInventario}. Mayor que cero y hasta el stock físico observado de {cantidad(existencia.stockFisico)}.</small></div>
          <div className="form-field catalogo-form__wide"><label htmlFor="retiro-observacion">{porDano ? 'Observación del daño' : 'Observación (opcional)'}</label><textarea id="retiro-observacion" rows={3} maxLength={500} value={form.observacion} onChange={(e) => { setValidation(''); onChange({ ...form, observacion: e.target.value }); }} required={porDano} /><small className="form-field__help">{porDano ? 'Describe el daño identificado. La observación es obligatoria.' : 'Si la dejas vacía, el retiro se registrará sin observación.'}</small></div>
        </div>
      </fieldset>
      <p className="retiro-form__explicacion">Se registrará una salida por {motivo}. El servidor aplicará el costo promedio vigente, lo conservará incluso al agotar la existencia y devolverá la pérdida valorizada. No se envía un costo alternativo.</p>
      <FeedbackMessage message={validation || error} />
      {requiereConsulta && <p className="retiro-form__explicacion" role="status">Vuelve a consultar el saldo y el historial antes de confirmar otro envío. Se conservará el borrador para revisarlo; no hay reintentos automáticos.</p>}
      {status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}
      <div className="catalogo-form__actions"><button className="button button--primary" type="submit" disabled={submitting || blocked || Boolean(review)}>Revisar retiro</button></div>
    </form>
    <Modal open={Boolean(review)} title={`Confirmar retiro por ${motivo}`} description="Se disminuirá el stock físico y se registrará un movimiento de salida. El servidor verificará el saldo y el historial antes de confirmar." onClose={close}>
      {review && <><dl className="retiro-review">
        <div><dt>Existencia</dt><dd>{existencia.codigoExistencia}</dd></div><div><dt>Motivo del retiro</dt><dd>{porDano ? 'Daño' : 'Vencimiento'}</dd></div><div><dt>Stock físico observado</dt><dd>{cantidad(review.stockObservado)}</dd></div><div><dt>Último movimiento observado</dt><dd>{review.ultimoMovimientoObservado === null ? 'Sin movimientos' : `#${review.ultimoMovimientoObservado}`}</dd></div>
        <div><dt>Cantidad a retirar</dt><dd>{cantidad(review.cantidad)} {medicamento.unidadInventario}</dd></div><div><dt>Costo promedio consultado</dt><dd>{costoDecimal(existencia.costoUnitarioPromedio)}</dd></div><div><dt>Observación</dt><dd>{review.observacion || 'Sin observación'}</dd></div>
      </dl><div className="modal__actions"><button className="button button--secondary" type="button" disabled={submitting} onClick={close}>Volver al retiro</button><button className="button button--danger" type="button" disabled={submitting || blocked} onClick={confirmar}>{submitting ? 'Retirando…' : 'Confirmar retiro'}</button></div></>}
    </Modal>
  </>;
};
