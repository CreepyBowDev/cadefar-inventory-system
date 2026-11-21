import { horaCivil } from '../../../utils/presentacion.js';
import { nombreMetodoPago, importePago, enlacePagoSeguro } from '../utils/pagoCompra.js';
import { PagoEstado } from './PagoEstado.jsx';

export const CompraPagosTable = ({ pagos, disabled, onVerificar, onConfirmar, onConciliar, onComprobante }) => <div className="catalogo-table-wrap" role="region" tabIndex={0} aria-label="Historial de pagos">
  <table className="catalogo-table pago-table"><caption className="visually-hidden">Historial verificable de pagos al laboratorio</caption>
    <thead><tr><th scope="col">Pago / Fecha</th><th scope="col">Importe / Método</th><th scope="col">Estado</th><th scope="col">Referencia / Responsable</th><th scope="col">Acciones</th></tr></thead><tbody>{pagos.map(pago => <tr key={pago.idPago}>
      <td><strong>#{pago.idPago}</strong><small>{horaCivil(pago.fecha)}</small>{pago.fechaVerificacion && <small>Verificado: {horaCivil(pago.fechaVerificacion)}</small>}</td>
      <td><strong>{importePago(pago.importe, pago.moneda)}</strong><small>{nombreMetodoPago(pago.metodo)}</small>{pago.monedaPasarela !== pago.moneda && <small>Enviado: {importePago(pago.importePasarela, pago.monedaPasarela)}</small>}</td>
      <td><PagoEstado estado={pago.estado} />{pago.resultadoProveedor === 'APPROVED' && <small>Autorizado en PayPal. Falta confirmar el envío.</small>}</td>
      <td className="compra-clave">{pago.referenciaExterna || 'Sin confirmación externa'}<small>{pago.administrador?.nombreUsuario || `Administrador #${pago.idUsuario}`}</small><small>Clave: {pago.claveOperacion}</small></td>
      <td><div className="pago-actions">{['PENDIENTE', 'PROCESANDO'].includes(pago.estado) && <>
        {enlacePagoSeguro(pago.urlPago, pago.metodo) && <a className="button button--secondary" href={pago.urlPago} target="_blank" rel="noopener noreferrer">Abrir pago seguro</a>}
        <button type="button" className="button button--secondary" disabled={disabled} onClick={() => onVerificar(pago)}>Verificar estado</button>
        {pago.permiteConciliacion && <button type="button" className="button button--secondary" disabled={disabled} onClick={() => onConciliar(pago)}>Conciliar referencia</button>}
        {pago.metodo === 'PAYPAL' && pago.resultadoProveedor === 'APPROVED' && <button type="button" className="button button--primary" disabled={disabled} onClick={() => onConfirmar(pago)}>Confirmar envío PayPal</button>}
      </>}{pago.estado === 'CONFIRMADO' && <button type="button" className="button button--secondary" onClick={() => onComprobante(pago)}>Ver comprobante</button>}</div></td>
    </tr>)}</tbody>
  </table>
</div>;
