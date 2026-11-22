import { useState } from 'react';
import { Modal } from '../../../components/Modal.jsx';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { importePago, nombreMetodoPago, nombreLaboratorioPago, referenciaPagoVisible } from '../utils/pagoCompra.js';
import { admiteNumeroPrueba, formatearNumeroPrueba, formatearVencimientoPrueba, validarTarjetaPrueba } from '../utils/tarjetaPrueba.js';

export const PagoAutorizacionLocal = ({ compra, pago, busy, error, onSubmit, onVerificar, onConfirmar, onComprobante, onClose }) => {
  const [decision, setDecision] = useState('APROBAR');
  const [datos, setDatos] = useState({ titular: '', numero: '', vencimiento: '', cvv: '' });
  const [errores, setErrores] = useState({}), [enviado, setEnviado] = useState(false);
  const tarjeta = pago?.metodo === 'TARJETA';
  const confirmado = pago?.estado === 'CONFIRMADO', rechazado = pago?.estado === 'RECHAZADO';
  const cancelado = pago?.resultadoProveedor === 'PRUEBA_LOCAL_CANCELADO';
  const autorizado = ['PRUEBA_LOCAL_APROBADO', 'PRUEBA_LOCAL_AUTORIZADO'].includes(pago?.resultadoProveedor);
  const revision = enviado && pago?.resultadoProveedor === 'PRUEBA_LOCAL_EN_REVISION';
  const resultado = confirmado || rechazado || autorizado || revision;
  const cambiar = (campo, valor) => { setDatos(anterior => ({ ...anterior, [campo]: valor })); setErrores(anterior => ({ ...anterior, [campo]: '' })); };
  const resumen = pago && <dl className="compra-review pago-operacion"><div><dt>Laboratorio</dt><dd>{nombreLaboratorioPago(compra.proveedorLaboratorio?.nombre, true)}</dd></div><div><dt>Compra</dt><dd>#{compra.idCompra}</dd></div><div><dt>Importe</dt><dd className="pago-operacion__importe">{importePago(pago.importe, pago.moneda)}</dd></div><div><dt>Método</dt><dd>{nombreMetodoPago(pago.metodo)}</dd></div></dl>;
  const enviar = event => {
    event.preventDefault();
    if (busy) return;
    if (tarjeta) {
      const fallos = validarTarjetaPrueba(datos); setErrores(fallos);
      if (Object.keys(fallos).length) { event.currentTarget.querySelector(`#tarjeta-${Object.keys(fallos)[0]}`)?.focus(); return; }
    }
    // Solo sale una decisión del escenario; jamás los campos de la tarjeta.
    setDatos({ titular: '', numero: '', vencimiento: '', cvv: '' }); setEnviado(true); onSubmit(decision);
  };
  return <Modal open={Boolean(pago)} size="pago-local" title={tarjeta ? 'Pago con tarjeta' : 'Autorización PayPal'} manageFocus onClose={onClose}>
    {pago && <div className="pago-autorizacion-local" aria-busy={busy}>
      <ol className="pago-pasos" aria-label="Progreso del pago"><li aria-current={!resultado && !busy ? 'step' : undefined}>1. {tarjeta ? 'Datos de tarjeta' : 'Autorización'}</li><li aria-current={busy || autorizado ? 'step' : undefined}>2. Verificación</li><li aria-current={confirmado || rechazado ? 'step' : undefined}>3. Resultado</li></ol>
      {busy ? <div className="pago-procesamiento" role="status"><span className="pago-procesamiento__indicador" aria-hidden="true" /><h3>Procesando pago…</h3><p>Un momento, por favor.</p></div>
        : resultado ? <div className="pago-confirmacion" role="status">
          {resumen}
          <h3>{confirmado ? 'Pago confirmado' : cancelado ? 'Pago cancelado' : rechazado ? 'Pago rechazado' : revision ? 'Pendiente de revisión' : tarjeta ? 'Autorización aprobada' : 'Pago autorizado'}</h3>
          <p>{confirmado ? 'Saldo actualizado.' : rechazado ? 'No se aplicó ningún abono.' : revision ? 'Importe reservado. Puedes continuar desde el historial.' : tarjeta ? 'Verifica el pago para aplicar el abono.' : 'Confirma el envío para aplicar el abono.'}</p>
          {confirmado && <p>Referencia: <strong>{referenciaPagoVisible(pago)}</strong></p>}
          <div className="modal__actions"><button type="button" className="button button--secondary" onClick={onClose}>Volver al historial</button>
            {confirmado && <button type="button" className="button button--primary" onClick={() => onComprobante(pago)}>Ver comprobante</button>}
            {autorizado && <><button type="button" className="button button--secondary" onClick={() => onSubmit('CANCELAR')}>Cancelar pago</button>{!tarjeta && <button type="button" className="button button--secondary" onClick={onVerificar}>Verificar estado</button>}<button type="button" className="button button--primary" onClick={tarjeta ? onVerificar : onConfirmar}>{tarjeta ? 'Verificar pago' : 'Confirmar operación'}</button></>}
          </div>
        </div> : <form noValidate autoComplete="off" onSubmit={enviar}>
          {tarjeta ? <fieldset className="pago-tarjeta"><legend className="visually-hidden">Tarjeta de débito o crédito</legend>
            <div className="pago-tarjeta__campos">
              <div className="form-field pago-tarjeta__ancho"><label htmlFor="tarjeta-titular">Nombre del titular</label><input id="tarjeta-titular" autoComplete="off" spellCheck={false} maxLength={100} value={datos.titular} placeholder="Nombre del titular" aria-invalid={Boolean(errores.titular)} aria-describedby="tarjeta-titular-error" onBlur={() => setErrores(anterior => ({ ...anterior, titular: validarTarjetaPrueba(datos).titular }))} onChange={event => cambiar('titular', event.target.value)} /><small id="tarjeta-titular-error" className="pago-campo-error">{errores.titular}</small></div>
              <div className="form-field pago-tarjeta__ancho"><label htmlFor="tarjeta-numero">Número de tarjeta</label><input id="tarjeta-numero" inputMode="numeric" autoComplete="off" maxLength={23} value={datos.numero} placeholder="13 a 19 dígitos" aria-invalid={Boolean(errores.numero)} aria-describedby="tarjeta-numero-error" onBlur={() => setErrores(anterior => ({ ...anterior, numero: validarTarjetaPrueba(datos).numero }))} onChange={event => {
                if (admiteNumeroPrueba(event.target.value)) cambiar('numero', formatearNumeroPrueba(event.target.value));
                else setErrores(anterior => ({ ...anterior, numero: 'Usa únicamente dígitos (máximo 19).' }));
              }} /><small id="tarjeta-numero-error" className="pago-campo-error">{errores.numero}</small></div>
              <div className="form-field"><label htmlFor="tarjeta-vencimiento">Vencimiento (MM/AA)</label><input id="tarjeta-vencimiento" inputMode="numeric" autoComplete="off" maxLength={5} value={datos.vencimiento} placeholder="MM/AA" aria-invalid={Boolean(errores.vencimiento)} aria-describedby="tarjeta-vencimiento-error" onBlur={() => setErrores(anterior => ({ ...anterior, vencimiento: validarTarjetaPrueba(datos).vencimiento }))} onChange={event => cambiar('vencimiento', formatearVencimientoPrueba(event.target.value))} /><small id="tarjeta-vencimiento-error" className="pago-campo-error">{errores.vencimiento}</small></div>
              <div className="form-field"><label htmlFor="tarjeta-cvv">CVV</label><input id="tarjeta-cvv" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={datos.cvv} placeholder="3 o 4 dígitos" aria-invalid={Boolean(errores.cvv)} aria-describedby="tarjeta-cvv-error" onBlur={() => setErrores(anterior => ({ ...anterior, cvv: validarTarjetaPrueba(datos).cvv }))} onChange={event => cambiar('cvv', event.target.value.replace(/\D/g, '').slice(0, 4))} /><small id="tarjeta-cvv-error" className="pago-campo-error">{errores.cvv}</small></div>
            </div>
          </fieldset> : <div className="pago-paypal__medio"><strong>PayPal</strong><p>Revisa el importe y autoriza la operación.</p></div>}
          {resumen}
          <details className="pago-opciones-local"><summary>Opciones locales</summary><div className="form-field"><label htmlFor="pago-decision-local">Resultado</label><select id="pago-decision-local" value={decision} onChange={event => setDecision(event.target.value)}><option value="APROBAR">Aprobación</option><option value="RECHAZAR">Rechazo</option><option value="PENDIENTE">Pendiente de revisión</option></select></div></details>
          <div className="modal__actions"><button type="button" className="button button--secondary" onClick={() => onSubmit('CANCELAR')}>Cancelar pago</button><button type="submit" className="button button--primary">Autorizar pago</button></div>
        </form>}
      <FeedbackMessage message={error} />
    </div>}
  </Modal>;
};
