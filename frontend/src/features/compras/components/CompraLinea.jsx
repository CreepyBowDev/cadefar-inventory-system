export const CompraLinea = ({ linea, index, medicamentos, proveedorId, disabled, canRemove, onChange, onRemove }) => {
  const medicamento = medicamentos.find((m) => String(m.idMedicamento) === linea.idMedicamento);
  const prefix = `compra-linea-${linea.key}`;
  return <fieldset className="compra-linea" disabled={disabled}>
    <legend>Línea {index + 1}</legend>
    <div className="compra-linea__fields">
      <div className="form-field compra-linea__medicamento"><label htmlFor={`${prefix}-med`}>Medicamento</label>
        <select id={`${prefix}-med`} name="idMedicamento" value={linea.idMedicamento} onChange={(e) => onChange('idMedicamento', e.target.value)} required>
          <option value="">Selecciona un medicamento</option>
          {medicamentos.map((m) => <option key={m.idMedicamento} value={m.idMedicamento} disabled={proveedorId !== undefined && m.idProveedorLaboratorio !== proveedorId}>{m.codigoMedicamento} · {m.nombreComercial} · {m.presentacion}</option>)}
        </select>
        {medicamento && <small className="form-field__help">{medicamento.formaFarmaceutica} · Unidad: {medicamento.unidadInventario} · {medicamento.proveedorLaboratorio?.nombre || `Proveedor #${medicamento.idProveedorLaboratorio}`}</small>}
      </div>
      <div className="form-field"><label htmlFor={`${prefix}-cantidad`}>Cantidad recibida</label><input id={`${prefix}-cantidad`} name="cantidad" inputMode="numeric" maxLength={10} value={linea.cantidad} onChange={(e) => onChange('cantidad', e.target.value)} required /></div>
      <div className="form-field"><label htmlFor={`${prefix}-costo`}>Costo unitario</label><input id={`${prefix}-costo`} name="costoUnitario" inputMode="decimal" maxLength={15} placeholder="Ej. 12.345678" value={linea.costoUnitario} onChange={(e) => onChange('costoUnitario', e.target.value)} required /><small className="form-field__help">Punto decimal, hasta seis decimales.</small></div>
      <div className="form-field"><label htmlFor={`${prefix}-precision`}>Precisión del vencimiento</label><select id={`${prefix}-precision`} name="precisionVencimiento" value={linea.precisionVencimiento} onChange={(e) => onChange('precisionVencimiento', e.target.value)}><option value="DIA">Día exacto</option><option value="MES">Mes y año</option></select></div>
      <div className="form-field"><label htmlFor={`${prefix}-fecha`}>{linea.precisionVencimiento === 'MES' ? 'Mes de vencimiento' : 'Fecha de vencimiento'}</label><input key={linea.precisionVencimiento} id={`${prefix}-fecha`} name="fechaVencimiento" type={linea.precisionVencimiento === 'MES' ? 'month' : 'date'} min={linea.precisionVencimiento === 'MES' ? '1000-01' : '1000-01-01'} max={linea.precisionVencimiento === 'MES' ? '9999-12' : '9999-12-31'} value={linea.fechaVencimiento} onChange={(e) => onChange('fechaVencimiento', e.target.value)} required /></div>
    </div>
    <div className="compra-linea__actions"><button className="button button--secondary" type="button" disabled={!canRemove} onClick={onRemove}>Quitar línea {index + 1}</button></div>
  </fieldset>;
};
