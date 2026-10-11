import { useRef, useState } from 'react';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { Modal } from '../../../components/Modal.jsx';
import { cantidad, costoDecimal } from '../../../utils/presentacion.js';

const saldoValido = (value) => /^\d+$/.test(value) && Number(value) <= 2147483647;

export const AjusteForm = ({ existencia, medicamento, form, onChange, onSubmit, submitting, blocked, error, status, requiereConsulta }) => {
  const [validation, setValidation] = useState('');
  const [review, setReview] = useState(null);
  const confirming = useRef(false);
  const saldo = form.saldoContado.trim();
  const entrada = saldoValido(saldo) && Number(saldo) > existencia.stockFisico;
  const sinDiferencia = saldoValido(saldo) && Number(saldo) === existencia.stockFisico;
  const close = () => { if (!confirming.current) setReview(null); };
  const revisar = (event) => {
    event.preventDefault(); if (blocked || submitting) return;
    if (!saldoValido(saldo)) { setValidation('El saldo contado debe ser un entero entre 0 y 2147483647.'); return; }
    const observacion = form.observacion.trim();
    if (!observacion || observacion.length > 500) { setValidation('La observación es obligatoria y admite hasta 500 caracteres.'); return; }
    const data = { idExistencia: existencia.idExistencia, saldoContado: Number(saldo), stockObservado: existencia.stockFisico,
      ultimoMovimientoObservado: existencia.ultimoMovimiento, observacion };
    if (entrada) {
      const costo = form.costoUnitario.trim();
      if (!/^\d+(?:\.\d{1,6})?$/.test(costo)) { setValidation('El costo debe ser positivo, con punto decimal y hasta seis decimales, sin coma ni exponente.'); return; }
      const [entero, fraccion = ''] = costo.split('.');
      const valor = BigInt(entero) * 1000000n + BigInt(fraccion.padEnd(6, '0'));
      if (valor <= 0n || valor > 99999999999999n) { setValidation('El costo debe ser mayor que cero y no superar 99999999.999999.'); return; }
      data.costoUnitario = costo;
    }
    setValidation(''); setReview(data);
  };
  const confirmar = async () => {
    if (confirming.current || blocked) return;
    confirming.current = true;
    try { await onSubmit(review); setReview(null); }
    finally { confirming.current = false; }
  };
  return <>
    <form className="catalogo-form ajuste-form" onSubmit={revisar}>
      <fieldset disabled={submitting || blocked || Boolean(review)}>
        <legend>Conteo de {existencia.codigoExistencia}</legend>
        <div className="catalogo-form__grid">
          <div className="form-field"><label htmlFor="ajuste-saldo">Saldo físico contado</label><input id="ajuste-saldo" inputMode="numeric" maxLength={10} value={form.saldoContado} onChange={(e) => { setValidation(''); onChange({ ...form, saldoContado: e.target.value }); }} required /><small className="form-field__help">Total contado en {medicamento.unidadInventario}. Admite cero; no es la cantidad que se agregará o retirará.</small></div>
          {entrada && <div className="form-field"><label htmlFor="ajuste-costo">Costo unitario de las unidades adicionales</label><input id="ajuste-costo" inputMode="decimal" maxLength={15} placeholder="Ej. 12.345678" value={form.costoUnitario} onChange={(e) => { setValidation(''); onChange({ ...form, costoUnitario: e.target.value }); }} required /><small className="form-field__help">Mayor que cero, hasta seis decimales y máximo 99999999.999999.</small></div>}
          <div className="form-field catalogo-form__wide"><label htmlFor="ajuste-observacion">Observación del conteo</label><textarea id="ajuste-observacion" rows={3} maxLength={500} value={form.observacion} onChange={(e) => { setValidation(''); onChange({ ...form, observacion: e.target.value }); }} required /><small className="form-field__help">Obligatoria también si el conteo coincide con el stock físico observado.</small></div>
        </div>
      </fieldset>
      {saldoValido(saldo) && <p className="ajuste-form__explicacion">{entrada ? 'El conteo supera el stock observado. Se requiere el costo de las unidades adicionales; el backend calculará el ajuste y el nuevo promedio.' : sinDiferencia ? 'El conteo coincide con el stock observado. Si el saldo y el historial siguen vigentes, no se modificará la existencia ni se guardará un movimiento o auditoría del conteo.' : 'El conteo es menor que el stock observado. El backend aplicará el promedio vigente a la salida y conservará ese promedio; no se envía un costo alternativo.'}</p>}
      <FeedbackMessage message={validation || error} />
      {requiereConsulta && <p className="ajuste-form__explicacion" role="status">Vuelve a consultar el saldo y el historial. El borrador se conservará para que revises el conteo antes de confirmar nuevamente. No hay reintentos automáticos.</p>}
      {status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}
      <div className="catalogo-form__actions"><button className="button button--primary" type="submit" disabled={submitting || blocked || Boolean(review)}>Revisar conteo</button></div>
    </form>
    <Modal open={Boolean(review)} title="Confirmar conteo físico" description="El servidor comprobará el saldo y el historial observados antes de decidir si corresponde un ajuste." onClose={close}>
      {review && <><dl className="ajuste-review">
        <div><dt>Existencia</dt><dd>{existencia.codigoExistencia}</dd></div><div><dt>Stock físico observado</dt><dd>{cantidad(review.stockObservado)}</dd></div><div><dt>Último movimiento observado</dt><dd>{review.ultimoMovimientoObservado === null ? 'Sin movimientos' : `#${review.ultimoMovimientoObservado}`}</dd></div>
        <div><dt>Saldo físico contado</dt><dd>{cantidad(review.saldoContado)} {medicamento.unidadInventario}</dd></div>
        {review.costoUnitario && <div><dt>Costo unitario de entrada</dt><dd>{costoDecimal(review.costoUnitario)}</dd></div>}
        <div><dt>Observación</dt><dd>{review.observacion}</dd></div>
      </dl><div className="modal__actions"><button className="button button--secondary" type="button" disabled={submitting} onClick={close}>Volver al conteo</button><button className="button button--primary" type="button" disabled={submitting || blocked} onClick={confirmar}>{submitting ? 'Confirmando…' : 'Confirmar conteo'}</button></div></>}
    </Modal>
  </>;
};
