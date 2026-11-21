import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { nombreMetodoPago } from '../utils/pagoCompra.js';

export const CompraPagoForm = ({ compra, resumen, form, onChange, onSubmit, onClose, disabled }) => {
  const metodo = resumen.metodos.find(item => item.metodo === form.metodo);
  const cambiar = (campo, valor) => onChange({ ...form, [campo]: valor, autorizado: false });
  return <form className="catalogo-form pago-form" onSubmit={onSubmit}>
    <fieldset disabled={disabled}><legend>Preparar pago de la compra #{compra.idCompra}</legend>
      <p className="compra-form__note">Destinatario: <strong>{compra.proveedorLaboratorio?.nombre}</strong>. CADEFAR paga directamente a la cuenta receptora del laboratorio.</p>
      <div className="pago-metodos">{resumen.metodos.map(item => <label className={`pago-metodo ${item.metodo === form.metodo ? 'pago-metodo--selected' : ''}`} key={item.metodo}>
        <input type="radio" name="metodoPago" value={item.metodo} checked={item.metodo === form.metodo} onChange={() => cambiar('metodo', item.metodo)} />
        <span><strong>{nombreMetodoPago(item.metodo)}</strong><small>{item.disponible ? `Pago seguro · ${item.moneda}` : 'No disponible'}</small></span>
      </label>)}</div>
      {!metodo?.disponible && <FeedbackMessage message={metodo?.mensaje || 'El método de pago no está disponible.'} />}
      <div className="pago-form__fields"><div className="form-field"><label htmlFor="pago-importe">Importe a abonar a la compra{resumen.moneda ? ` (${resumen.moneda})` : ''}</label><input id="pago-importe" type="text" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" maxLength={15} required value={form.importe} onChange={event => cambiar('importe', event.target.value)} /><small>Admite el saldo completo o un abono parcial. Usa punto decimal.</small></div>
      {metodo?.requiereCotizacion && <><div className="form-field"><label htmlFor="pago-cotizado">Importe acordado a enviar ({metodo.moneda})</label><input id="pago-cotizado" type="text" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" maxLength={15} required value={form.importePasarela} onChange={event => cambiar('importePasarela', event.target.value)} /></div><div className="form-field"><label htmlFor="pago-referencia">Referencia del acuerdo con el laboratorio</label><input id="pago-referencia" maxLength={100} required value={form.referenciaCotizacion} onChange={event => cambiar('referenciaCotizacion', event.target.value)} /><small>No se aplica un tipo de cambio automático. El banco o la pasarela puede aplicar cargos adicionales.</small></div></>}
      </div>
      <label className="pago-autorizacion"><input type="checkbox" required checked={form.autorizado} onChange={event => onChange({ ...form, autorizado: event.target.checked })} /><span>He conciliado el saldo con el laboratorio y autorizo este importe y destinatario. Los datos de tarjeta se introducirán exclusivamente en la pasarela.</span></label>
    </fieldset>
    <div className="catalogo-form__actions"><button type="button" className="button button--secondary" disabled={disabled} onClick={onClose}>Cerrar</button><button className="button button--primary" type="submit" disabled={disabled || !metodo?.disponible || !form.autorizado}>Continuar al pago</button></div>
  </form>;
};
