import { useEffect, useRef, useState } from 'react';
import { CatalogoState } from '../../../components/CatalogoState.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { Modal } from '../../../components/Modal.jsx';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { getPagosCompra, iniciarPagoCompra, verificarPagoCompra, confirmarPagoCompra, conciliarPagoCompra, autorizarPagoPrueba } from '../services/pago-compra.service.js';
import { PagoAutorizacionLocal } from './PagoAutorizacionLocal.jsx';
import { importePago, generarClavePago, enlacePagoSeguro, errorImportePago, nombreLaboratorioPago, estadoPagoVisible } from '../utils/pagoCompra.js';
import { CompraError } from './CompraError.jsx';
import { PagoEstado } from './PagoEstado.jsx';
import { CompraPagoForm } from './CompraPagoForm.jsx';
import { CompraPagosTable } from './CompraPagosTable.jsx';
import { PagoComprobante } from './PagoComprobante.jsx';

const formularioInicial = data => ({ metodo: 'TARJETA', importe: data.saldoDisponible, importePasarela: '', referenciaCotizacion: '', autorizado: false });

export const CompraPagos = ({ compra, bloqueado = false, pagarAhora = false, onPagoPreparado }) => {
  const consulta = useConsulta(getPagosCompra, compra.idCompra, compra.idCompra);
  const [form, setForm] = useState(null), [review, setReview] = useState(null), [comprobante, setComprobante] = useState(null);
  const [autorizacionLocal, setAutorizacionLocal] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [resultado, setResultado] = useState(null);
  const [status, setStatus] = useState(), [incierto, setIncierto] = useState(false);
  const [conciliacion, setConciliacion] = useState(null), [referencia, setReferencia] = useState('');
  const inFlight = useRef(false), active = useRef(true), clave = useRef(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const data = consulta.data;
  const autoAbierto = useRef(false);
  useEffect(() => {
    if (!pagarAhora || autoAbierto.current || consulta.loading || consulta.error || !data || bloqueado) return;
    autoAbierto.current = true;
    onPagoPreparado?.();
    if (compra.estadoOperacion !== 'CONFIRMADA' || data.saldoDisponible === '0.00' || data.importeReservado !== '0.00') return;
    clave.current = generarClavePago();
    setForm(formularioInicial(data));
  }, [pagarAhora, consulta.loading, consulta.error, data, bloqueado, compra.estadoOperacion, onPagoPreparado]);
  const disabled = busy || consulta.loading || bloqueado || status === 401 || status === 403;
  const actualizar = () => { if (!inFlight.current) { setError(''); setResultado(null); setIncierto(false); consulta.retry(); } };
  const ejecutar = async (operacion, abrirAutorizacion = false) => {
    if (inFlight.current || disabled) return;
    inFlight.current = true; setBusy(true); setError(''); setResultado(null);
    try {
      const response = await operacion();
      if (!active.current) return;
      setResultado(response.data); setReview(null); setForm(null); setConciliacion(null); setIncierto(false); consulta.retry();
      setAutorizacionLocal(abrirAutorizacion && response.data?.esPrueba ? response.data : null);
    } catch (failure) {
      if (!active.current) return;
      const codigo = failure.response?.status;
      setStatus(codigo); setReview(null); setIncierto(true);
      setError(codigo === 401 ? 'Tu sesión ya no es válida. Inicia sesión nuevamente.' : codigo === 403 ? 'No tienes autorización para realizar esta operación.'
        : !codigo || codigo >= 500 ? 'No fue posible confirmar el resultado. Actualiza el historial y verifica el intento registrado antes de iniciar otro pago.' : getApiErrorMessage(failure));
      consulta.retry();
    } finally { inFlight.current = false; if (active.current) setBusy(false); }
  };
  const abrir = () => {
    if (disabled || !data || incierto) return;
    clave.current = generarClavePago();
    setForm(formularioInicial(data)); setError('');
  };
  const metodo = data?.metodos.find(item => item.metodo === form?.metodo);
  const revisar = event => {
    event.preventDefault();
    if (disabled || !metodo?.disponible || !form.autorizado || incierto) return;
    const errorImporte = errorImportePago(form.importe, data.saldoDisponible);
    if (errorImporte) { setError(errorImporte); return; }
    setReview({ tipo: 'INICIAR', data: { claveOperacion: clave.current, metodo: form.metodo,
      importe: form.importe, autorizarPago: true,
      ...(metodo.requiereCotizacion ? { importePasarela: form.importePasarela, referenciaCotizacion: form.referenciaCotizacion } : {}) } });
  };
  const confirmar = () => review?.tipo === 'INICIAR'
    ? ejecutar(() => iniciarPagoCompra(compra.idCompra, review.data), true)
    : ejecutar(() => confirmarPagoCompra(compra.idCompra, review.pago.idPago));
  return <section className="catalogo-panel" id="pagos" aria-label="Pagos al laboratorio" aria-busy={consulta.loading || busy}>
    <div className="catalogo-toolbar"><div><h3>Pagos al laboratorio</h3></div><button type="button" className="button button--secondary" onClick={actualizar} disabled={disabled || consulta.loading}>Actualizar pagos</button></div>
    {consulta.loading ? <CatalogoState loading message="Consultando pagos…" /> : consulta.error ? <CompraError consulta={consulta} /> : data && <>
      <dl className="catalogo-detail pago-resumen">
        <div><dt>Estado financiero</dt><dd><PagoEstado estado={data.estadoFinanciero} /></dd></div>
        <div><dt>Total de la compra</dt><dd>{importePago(data.total, data.moneda)}</dd></div>
        <div><dt>Pagado verificado</dt><dd>{importePago(data.totalPagado, data.moneda)}</dd></div>
        <div><dt>Saldo pendiente</dt><dd className="compra-total">{importePago(data.saldoPendiente, data.moneda)}</dd></div>
        <div><dt>En verificación</dt><dd>{importePago(data.importeReservado, data.moneda)}</dd></div>
        <div><dt>Disponible para pagar</dt><dd>{importePago(data.saldoDisponible, data.moneda)}</dd></div>
      </dl>
      {data.esPrueba ? <p className="catalogo-note" role="status">Simulación educativa: no se envía dinero ni se realizan cargos reales. Los abonos se registran únicamente para esta demostración.</p> : <p className="catalogo-note">El saldo considera únicamente pagos registrados y verificados en CADEFAR. Concilia los pagos anteriores realizados fuera del sistema con el laboratorio antes de continuar.</p>}
      {!data.moneda && <FeedbackMessage message="La moneda de las compras requiere configuración administrativa antes de habilitar pagos." />}
      {compra.estadoOperacion === 'CONFIRMADA' && !form && data.saldoDisponible !== '0.00' && data.importeReservado === '0.00' && <div className="pago-actions"><button className="button button--primary" type="button" onClick={abrir} disabled={disabled || incierto}>Pagar</button></div>}
      {form && <CompraPagoForm compra={compra} resumen={data} form={form} onChange={setForm} onSubmit={revisar} onClose={() => setForm(null)} disabled={disabled || Boolean(review) || incierto} />}
      {data.pagos.length ? <CompraPagosTable pagos={data.pagos} disabled={disabled} onAutorizar={setAutorizacionLocal} onVerificar={pago => ejecutar(() => verificarPagoCompra(compra.idCompra, pago.idPago))} onConfirmar={pago => setReview({ tipo: 'CONFIRMAR', pago })} onConciliar={pago => { setReferencia(''); setConciliacion(pago); }} onComprobante={setComprobante} />
        : <CatalogoState title="Sin pagos registrados" message="No hay transacciones verificadas asociadas a esta compra." />}
    </>}
    <FeedbackMessage message={error} />
    {incierto && <p className="catalogo-note" role="status">No inicies otro pago. Actualiza el historial; si existe un intento, usa «Verificar estado». Un resultado incierto no libera su importe.</p>}
    {status === 401 && <a className="button button--primary" href="/login">Ir al inicio de sesión</a>}
    {resultado && !autorizacionLocal && <div className="pago-resultado" role="status"><PagoEstado estado={estadoPagoVisible(resultado)} /><p>{resultado.esPrueba ? resultado.estado === 'CONFIRMADO' ? 'Saldo actualizado.' : resultado.estado === 'RECHAZADO' ? 'No se aplicó ningún abono.' : 'Pendiente de verificación.' : resultado.estado === 'CONFIRMADO' ? 'El proveedor confirmó la transacción y el saldo se actualizó.' : resultado.estado === 'RECHAZADO' ? 'El proveedor cerró el intento sin confirmar un pago.' : 'El pago aún no está confirmado. Continúa en la pasarela y después verifica su estado.'}</p>{resultado.estado === 'CONFIRMADO' && <button type="button" className="button button--secondary" onClick={() => setComprobante(resultado)}>Ver comprobante de pago</button>}{enlacePagoSeguro(resultado.urlPago, resultado.metodo) && <a className="button button--primary" href={resultado.urlPago} target="_blank" rel="noopener noreferrer">Abrir pago seguro</a>}</div>}
    <PagoAutorizacionLocal key={autorizacionLocal?.idPago || 'cerrada'} compra={compra} pago={autorizacionLocal} busy={busy || consulta.loading} error={error}
      onSubmit={decision => { if (autorizacionLocal) ejecutar(() => autorizarPagoPrueba(compra.idCompra, autorizacionLocal.idPago, decision), true); }}
      onVerificar={() => ejecutar(() => verificarPagoCompra(compra.idCompra, autorizacionLocal.idPago), true)}
      onConfirmar={() => ejecutar(() => confirmarPagoCompra(compra.idCompra, autorizacionLocal.idPago), true)}
      onComprobante={pago => { setAutorizacionLocal(null); setComprobante(pago); }}
      onClose={() => { if (!inFlight.current) setAutorizacionLocal(null); }} />
    <Modal open={Boolean(review)} title={review?.tipo === 'INICIAR' ? 'Autorizar pago al laboratorio' : 'Confirmar envío por PayPal'} description={data?.esPrueba ? undefined : 'Esta operación puede enviar fondos reales a la cuenta del laboratorio. Revisa los importes antes de continuar.'} manageFocus onClose={() => { if (!inFlight.current) setReview(null); }}>
      {review && <><dl className="compra-review"><div><dt>Laboratorio</dt><dd>{nombreLaboratorioPago(compra.proveedorLaboratorio?.nombre, data?.esPrueba)}</dd></div><div><dt>Compra</dt><dd>#{compra.idCompra}</dd></div><div><dt>Abono a la compra</dt><dd>{importePago(review.data?.importe || review.pago?.importe, data?.moneda)}</dd></div><div><dt>Importe a enviar</dt><dd>{review.tipo === 'INICIAR' ? importePago(review.data.importePasarela || review.data.importe, metodo?.moneda) : importePago(review.pago.importePasarela, review.pago.monedaPasarela)}</dd></div></dl><div className="modal__actions"><button type="button" className="button button--secondary" disabled={busy} onClick={() => setReview(null)}>Volver</button><button type="button" className="button button--primary" disabled={disabled} onClick={confirmar}>{busy ? 'Procesando…' : review.tipo === 'INICIAR' ? 'Continuar al pago' : data?.esPrueba ? 'Confirmar operación' : 'Autorizar envío de fondos'}</button></div></>}
    </Modal>
    <PagoComprobante compra={compra} pago={comprobante} onClose={() => setComprobante(null)} />
    <Modal open={Boolean(conciliacion)} title="Conciliar inicio del pago" description="Solicita al laboratorio el identificador de la sesión de Stripe u orden de PayPal asociado a este intento. CADEFAR consultará al proveedor antes de aceptar la referencia. Esta acción no envía fondos." manageFocus onClose={() => { if (!inFlight.current) setConciliacion(null); }}>
      <form onSubmit={event => { event.preventDefault(); if (conciliacion) ejecutar(() => conciliarPagoCompra(compra.idCompra, conciliacion.idPago, referencia)); }}>
        <div className="form-field"><label htmlFor="pago-referencia-recuperada">Identificador de la sesión u orden</label><input id="pago-referencia-recuperada" required maxLength={100} pattern="[A-Za-z0-9_]+" disabled={busy} value={referencia} onChange={event => setReferencia(event.target.value)} /></div>
        <div className="modal__actions"><button className="button button--secondary" type="button" disabled={busy} onClick={() => setConciliacion(null)}>Cerrar</button><button className="button button--primary" type="submit" disabled={disabled}>Consultar referencia</button></div>
        <FeedbackMessage message={error} />
      </form>
    </Modal>
  </section>;
};
