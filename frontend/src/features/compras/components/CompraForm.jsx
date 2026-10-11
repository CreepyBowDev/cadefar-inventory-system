import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { Modal } from '../../../components/Modal.jsx';
import { costoDecimal, fechaCivil } from '../../../utils/presentacion.js';
import { generarClaveCompra, prepararCompra } from '../utils/compraForm.js';
import { CompraLinea } from './CompraLinea.jsx';

const nuevaLinea = (key) => ({ key, idMedicamento: '', cantidad: '', costoUnitario: '', precisionVencimiento: 'DIA', fechaVencimiento: '' });

export const CompraForm = ({ medicamentos, proveedores, submitting, attempted, apiError, status, lookup, onLookup, onSubmit, onCancel }) => {
  const [form, setForm] = useState(() => ({ claveOperacion: generarClaveCompra(), fechaCompra: '', detalles: [nuevaLinea(1)] }));
  const nextKey = useRef(2);
  const confirming = useRef(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);
  const activos = medicamentos.filter((m) => m.estado && proveedores.some((p) => p.estado && p.idProveedorLaboratorio === m.idProveedorLaboratorio));
  const proveedorId = medicamentos.find((m) => String(m.idMedicamento) === form.detalles.find((d) => d.idMedicamento)?.idMedicamento)?.idProveedorLaboratorio;
  const proveedor = proveedores.find((p) => p.idProveedorLaboratorio === proveedorId);
  const busy = submitting || lookup.loading;
  const blocked = busy || status === 401 || status === 403 || lookup.status === 401 || lookup.status === 403 || Boolean(lookup.data?.length);
  const changeLinea = (key, campo, value) => {
    setError('');
    setForm((current) => ({ ...current, detalles: current.detalles.map((d) => d.key === key ? { ...d, [campo]: value, ...(campo === 'precisionVencimiento' ? { fechaVencimiento: '' } : {}) } : d) }));
  };
  const revisar = (event) => {
    event.preventDefault(); if (blocked) return;
    try {
      const data = prepararCompra(form, medicamentos, proveedores);
      setForm({ ...form, claveOperacion: data.claveOperacion }); setReview(data); setError('');
    }
    catch (validation) { setError(validation.message); }
  };
  const close = () => { if (!busy) setReview(null); };
  const confirmar = async () => {
    if (confirming.current) return;
    confirming.current = true;
    try { await onSubmit(review); setReview(null); }
    finally { confirming.current = false; }
  };
  return <>
    <form className="compra-form" onSubmit={revisar}>
      <fieldset disabled={blocked || Boolean(review)} className="compra-form__cabecera">
        <legend>Datos de adquisición</legend>
        <div className="catalogo-form__grid">
          <div className="form-field"><label htmlFor="compra-fecha">Fecha de adquisición</label><input id="compra-fecha" type="date" min="1000-01-01" max="9999-12-31" value={form.fechaCompra} onChange={(e) => setForm({ ...form, fechaCompra: e.target.value })} required /><small className="form-field__help">No puede ser futura. El servidor verifica el día comercial de Bolivia.</small></div>
          <div className="form-field"><label htmlFor="compra-nueva-clave">Clave de operación</label><input id="compra-nueva-clave" maxLength={64} value={form.claveOperacion} readOnly={attempted} onChange={(e) => setForm({ ...form, claveOperacion: e.target.value })} required /><small className="form-field__help">Identifica esta recepción. Conserva la misma clave al reintentar; no se reutiliza aunque la compra se anule. Copia la clave si necesitas salir o recargar: el borrador se mantiene solo en esta pantalla.</small></div>
        </div>
        <p className="compra-form__proveedor"><strong>Proveedor / Laboratorio:</strong> {proveedor?.nombre || 'Se obtiene de los medicamentos seleccionados.'}</p>
      </fieldset>
      <section aria-label="Líneas de recepción"><div className="compra-form__heading"><h3>Medicamentos recibidos</h3><p>Todos deben pertenecer al mismo proveedor activo. Puedes repetir un medicamento; cada línea se registrará por separado.</p></div>
        {form.detalles.map((linea, index) => <CompraLinea key={linea.key} linea={linea} index={index} medicamentos={activos} proveedorId={proveedorId} disabled={blocked || Boolean(review)} canRemove={form.detalles.length > 1} onChange={(campo, value) => changeLinea(linea.key, campo, value)} onRemove={() => setForm({ ...form, detalles: form.detalles.filter((d) => d.key !== linea.key) })} />)}
        <button className="button button--secondary" type="button" disabled={blocked || Boolean(review)} onClick={() => { const linea = nuevaLinea(nextKey.current++); setForm({ ...form, detalles: [...form.detalles, linea] }); }}>Agregar línea</button>
      </section>
      <p className="compra-form__note">El sistema verificará los vencimientos al registrar, identificará las existencias y calculará los subtotales, el total y el costo promedio.</p>
      <FeedbackMessage message={error || apiError} />
      {status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}
      {attempted && <section className="compra-recuperacion" aria-label="Consulta de la clave enviada"><h3>Consultar el resultado del registro</h3><p>Si se perdió la respuesta o la clave ya existe, consulta tu operación antes de realizar otra recepción. Encontrarla no demuestra que su contenido coincida con este formulario.</p>
        <button className="button button--secondary" type="button" disabled={busy || status === 401 || status === 403} onClick={() => onLookup(form.claveOperacion.trim().toLowerCase())}>{lookup.loading ? 'Consultando clave…' : 'Consultar mi compra por clave'}</button>
        <FeedbackMessage message={lookup.error} />
        {lookup.status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}
        {lookup.data && (lookup.data.length ? <div className="compra-recuperacion__result"><p>Se encontró una compra propia. Revisa sus detalles antes de continuar.</p>{lookup.data.map((c) => <Link key={c.idCompra} className="button button--secondary" to={`/compras/${c.idCompra}`}>Ver compra #{c.idCompra}</Link>)}</div> : <p role="status">No se encontró una compra propia con esta clave. Una consulta vacía no confirma el resultado de una solicitud en curso; conserva la clave al reintentar.</p>)}
      </section>}
      <div className="catalogo-form__actions"><button className="button button--secondary" type="button" disabled={busy} onClick={onCancel}>Volver a Compras</button><button className="button button--primary" type="submit" disabled={blocked || Boolean(review)}>Revisar compra</button></div>
    </form>
    <Modal open={Boolean(review)} title="Revisar compra" description="Al confirmar se registrarán la compra, las existencias y las entradas de inventario de forma conjunta." onClose={close}>
      {review && <><dl className="compra-review"><div><dt>Adquisición</dt><dd>{fechaCivil(review.fechaCompra)}</dd></div><div><dt>Proveedor / Laboratorio</dt><dd>{proveedor?.nombre}</dd></div><div><dt>Clave</dt><dd>{review.claveOperacion}</dd></div></dl>
        <ol className="compra-review__lineas">{review.detalles.map((d, index) => {
          const medicamento = medicamentos.find((m) => m.idMedicamento === d.idMedicamento);
          return <li key={index}><strong>{medicamento.codigoMedicamento} · {medicamento.nombreComercial}</strong><p>{medicamento.presentacion} · {d.cantidad} {medicamento.unidadInventario}</p><p>Costo unitario: {costoDecimal(d.costoUnitario)}</p><p>Vencimiento: {d.precisionVencimiento === 'MES' ? `${d.fechaVencimiento.slice(5)}/${d.fechaVencimiento.slice(0, 4)} (mes)` : `${fechaCivil(d.fechaVencimiento)} (día)`}</p></li>;
        })}</ol>
        <div className="modal__actions"><button className="button button--secondary" type="button" disabled={submitting} onClick={close}>Volver al formulario</button><button className="button button--primary" type="button" disabled={submitting} onClick={confirmar}>{submitting ? 'Registrando…' : 'Confirmar registro'}</button></div>
      </>}
    </Modal>
  </>;
};
