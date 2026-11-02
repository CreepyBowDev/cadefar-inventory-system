import { useState } from 'react';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { useConsulta } from '../../../hooks/useConsulta.js';
import { getExistenciasMedicamento } from '../../inventario/services/inventario.service.js';
import { cantidad, costoDecimal, fechaEtiqueta } from '../../../utils/presentacion.js';
import { calcularImportesVenta } from '../utils/ventaForm.js';

export const VentaLinea = ({ linea, index, medicamentos, disabled, onChange, onRemove }) => {
  const [busqueda, setBusqueda] = useState('');
  const consulta = useConsulta(getExistenciasMedicamento, linea.idMedicamento, linea.idMedicamento, !!linea.idMedicamento);
  const existencias = consulta.data?.existencias || [];
  const medicamento = medicamentos.find(m => String(m.idMedicamento) === linea.idMedicamento);
  const opciones = medicamentos.filter(m => m.estado && (`${m.codigoMedicamento} ${m.nombreComercial}`).toLocaleLowerCase('es').includes(busqueda.trim().toLocaleLowerCase('es')));
  if (medicamento && !opciones.includes(medicamento)) opciones.unshift(medicamento);
  const prefix = `venta-linea-${linea.key}`;
  let subtotal;
  try { subtotal = calcularImportesVenta([linea]).total; } catch { /* Aún no hay importes válidos. */ }
  return <fieldset className="venta-linea" disabled={disabled}>
    <legend>Medicamento {index + 1}</legend>
    <div className="venta-linea__fields">
      <div className="form-field"><label htmlFor={`${prefix}-buscar`}>Buscar por código o nombre</label><input id={`${prefix}-buscar`} type="search" maxLength={150} value={busqueda} onChange={event => setBusqueda(event.target.value)} /></div>
      <div className="form-field"><label htmlFor={`${prefix}-med`}>Medicamento</label><select id={`${prefix}-med`} value={linea.idMedicamento} required onChange={event => onChange({ idMedicamento: event.target.value, idExistencia: '', existencia: null })}>
        <option value="">Selecciona un medicamento</option>{opciones.map(m => <option key={m.idMedicamento} value={m.idMedicamento}>{m.codigoMedicamento} · {m.nombreComercial} · {m.presentacion}</option>)}
      </select>{!opciones.length && <small className="form-field__help">No hay medicamentos activos que coincidan.</small>}
      {medicamento && <small className="form-field__help">{medicamento.formaFarmaceutica} · Unidad: {medicamento.unidadInventario} · Condición: {medicamento.condicionVenta}</small>}</div>
      <div className="form-field venta-linea__wide"><label htmlFor={`${prefix}-existencia`}>Existencia provisional</label><select id={`${prefix}-existencia`} value={linea.idExistencia} disabled={!linea.idMedicamento || consulta.loading || !!consulta.error} required onChange={event => onChange({ idExistencia: event.target.value, existencia: existencias.find(e => String(e.idExistencia) === event.target.value) || null })}>
        <option value="">Selecciona una referencia real</option>{existencias.map(e => <option key={e.idExistencia} value={e.idExistencia}>{e.codigoExistencia} · Vence: {fechaEtiqueta(e)} · Físico: {cantidad(e.stockFisico)} · Vendible: {cantidad(e.stockVendible)}{e.vencida ? ' · Vencida, no vendible' : ''}</option>)}
      </select>{consulta.loading && <small role="status">Cargando existencias…</small>}
      {consulta.error && <><FeedbackMessage message={consulta.error} />{consulta.status !== 401 && consulta.status !== 403 && <button className="button button--secondary" type="button" onClick={consulta.retry}>Reintentar existencias</button>}</>}
      {!consulta.loading && !consulta.error && linea.idMedicamento && !existencias.length && <small className="form-field__help">Este medicamento no tiene existencias reales. No se puede guardar una línea sin esa referencia.</small>}
      <small className="form-field__help">Es una referencia para el borrador, no una reserva ni una elección de salida. Puede no tener stock vendible; el backend decidirá las existencias definitivas al confirmar.</small></div>
      <div className="form-field"><label htmlFor={`${prefix}-cantidad`}>Cantidad</label><input id={`${prefix}-cantidad`} inputMode="numeric" maxLength={10} value={linea.cantidad} required onChange={event => onChange({ cantidad: event.target.value })} /></div>
      <div className="form-field"><label htmlFor={`${prefix}-precio`}>Precio unitario</label><input id={`${prefix}-precio`} inputMode="decimal" maxLength={15} placeholder="Ej. 10.50" value={linea.precioUnitario} required onChange={event => onChange({ precioUnitario: event.target.value })} /><small className="form-field__help">Punto decimal, hasta dos decimales.</small></div>
    </div>
    <div className="venta-linea__actions"><p>Importe estimado: <strong>{subtotal === undefined ? '—' : costoDecimal(subtotal)}</strong></p><button className="button button--secondary" type="button" onClick={onRemove}>Quitar medicamento {index + 1}</button></div>
  </fieldset>;
};
