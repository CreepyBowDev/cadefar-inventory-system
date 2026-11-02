import { useRef, useState } from 'react';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { Modal } from '../../../components/Modal.jsx';
import { costoDecimal } from '../../../utils/presentacion.js';
import { generarClaveVenta, prepararVenta, calcularImportesVenta } from '../utils/ventaForm.js';
import { VentaLinea } from './VentaLinea.jsx';

const nuevaLinea = key => ({ key, idMedicamento: '', idExistencia: '', existencia: null, cantidad: '', precioUnitario: '' });

export const VentaForm = ({ medicamentos, submitting, attempted, apiError, status, idUsuario, onSubmit, onCancel }) => {
  const [form, setForm] = useState(() => ({ claveOperacion: generarClaveVenta(), detalles: [nuevaLinea(1)] }));
  const nextKey = useRef(2);
  const confirming = useRef(false);
  const reviewButton = useRef(null);
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);
  const blocked = submitting || status === 401 || status === 403;
  let importes;
  try { if (form.detalles.length) importes = calcularImportesVenta(form.detalles); } catch { /* Borrador incompleto. */ }
  const revisar = event => {
    event.preventDefault();
    if (blocked) return;
    try {
      const datos = prepararVenta(form, medicamentos);
      setForm(actual => ({ ...actual, claveOperacion: datos.claveOperacion })); setReview(datos); setError('');
    } catch (failure) { setError(failure.message); }
  };
  const guardar = async () => {
    if (confirming.current || blocked || !review) return;
    confirming.current = true;
    try { await onSubmit(review); setReview(null); } finally { confirming.current = false; }
  };
  return <>
    <form className="venta-form" onSubmit={revisar}>
      <div className="form-field"><label htmlFor="venta-nueva-clave">Clave de operación</label><input id="venta-nueva-clave" value={form.claveOperacion} readOnly maxLength={64} /><small className="form-field__help">Copia esta clave si necesitas salir o recargar. Se conserva al reintentar; el borrador solo permanece en esta pantalla.</small></div>
      <section aria-label="Medicamentos de la venta"><h3>Productos del borrador</h3><p className="form-field__help">Selecciona medicamentos activos, una existencia real provisional, cantidades y precios. No se reserva ni descuenta inventario.</p>
        {form.detalles.map((linea, index) => <VentaLinea key={linea.key} linea={linea} index={index} medicamentos={medicamentos} disabled={blocked || !!review}
          onChange={cambios => { setError(''); setForm(actual => ({ ...actual, detalles: actual.detalles.map(d => d.key === linea.key ? { ...d, ...cambios } : d) })); }}
          onRemove={() => { setError(''); setForm(actual => ({ ...actual, detalles: actual.detalles.filter(d => d.key !== linea.key) })); }} />)}
        <button className="button button--secondary" type="button" disabled={blocked || !!review} onClick={() => { const linea = nuevaLinea(nextKey.current++); setForm(actual => ({ ...actual, detalles: [...actual.detalles, linea] })); }}>Agregar medicamento</button>
      </section>
      <p className="venta-form__total">Total estimado: <strong>{importes ? costoDecimal(importes.total) : '—'}</strong></p>
      <p className="form-field__help">El backend calcula y devuelve los importes definitivos. Guardar crea una venta PENDIENTE, no una venta confirmada.</p>
      <FeedbackMessage message={error || apiError} />
      {status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}
      {attempted && <section className="venta-aviso" aria-label="Comprobar registro"><h3>Comprobar el resultado</h3><p>Si se perdió la respuesta o la clave ya existe, consulta tus ventas y compara la clave y los detalles antes de reintentar. No cambies la clave para repetir este registro.</p><a className="button button--secondary" href={`/ventas?idUsuario=${idUsuario}`} target="_blank" rel="noreferrer">Consultar mis ventas en otra pestaña</a></section>}
      <div className="catalogo-form__actions"><button className="button button--secondary" type="button" disabled={submitting} onClick={onCancel}>Volver a Ventas</button><button ref={reviewButton} className="button button--primary" type="submit" disabled={blocked || !!review}>Revisar venta pendiente</button></div>
    </form>
    <Modal manageFocus returnFocusRef={reviewButton} open={!!review} title="Guardar venta pendiente" description="Se guardarán la venta y sus productos sin descontar ni reservar inventario. Las recetas se registran después y la confirmación es una operación posterior." onClose={() => { if (!submitting) setReview(null); }}>
      {review && <><p className="venta-clave">Clave: {review.claveOperacion}</p><ol className="venta-review">{review.detalles.map((d, index) => <li key={index}><strong>{medicamentos.find(m => m.idMedicamento === d.idMedicamento)?.nombreComercial}</strong><p>Cantidad: {d.cantidad} · Precio: {costoDecimal(d.precioUnitario)} · Referencia provisional #{d.idExistencia}</p></li>)}</ol><p>Total estimado: <strong>{costoDecimal(calcularImportesVenta(review.detalles).total)}</strong></p>
        <div className="modal__actions"><button className="button button--secondary" type="button" disabled={submitting} onClick={() => setReview(null)}>Volver al formulario</button><button className="button button--primary" type="button" disabled={submitting} onClick={guardar}>{submitting ? 'Guardando…' : 'Guardar pendiente'}</button></div></>}
    </Modal>
  </>;
};
