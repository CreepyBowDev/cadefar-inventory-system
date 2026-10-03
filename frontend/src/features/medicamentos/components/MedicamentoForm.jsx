import { useState } from 'react';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';

const TEXT_FIELDS = [
  ['codigoMedicamento', 'Código', 20], ['nombreComercial', 'Nombre comercial', 150],
  ['formaFarmaceutica', 'Forma farmacéutica', 80], ['presentacion', 'Presentación', 150],
  ['unidadInventario', 'Unidad de inventario', 50], ['condicionVenta', 'Condición de venta', 40],
  ['viaAdministracion', 'Vía de administración', 80], ['tipoLiberacion', 'Tipo de liberación', 80]
];
const getValues = (data) => Object.fromEntries([
  ...TEXT_FIELDS.map(([key]) => [key, data?.[key] || '']),
  ['stockMinimo', String(data?.stockMinimo ?? 0)],
  ['idProveedorLaboratorio', String(data?.idProveedorLaboratorio ?? '')]
]);

export const MedicamentoForm = ({ initialData, proveedores, submitting, apiError, onSubmit, onCancel }) => {
  const [form, setForm] = useState(() => getValues(initialData));
  const [validationError, setValidationError] = useState('');
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const actuales = proveedores.filter((p) => p.estado);
  const proveedorActual = initialData && proveedores.find((p) => p.idProveedorLaboratorio === initialData.idProveedorLaboratorio);
  const inactiveCurrent = initialData && !proveedorActual?.estado;

  const submit = (event) => {
    event.preventDefault();
    if (submitting) return;
    setValidationError('');
    const data = {};
    for (const [key, label, max] of TEXT_FIELDS) {
      const value = form[key].trim();
      if (!value || value.length > max) { setValidationError(`${label} es obligatorio y admite hasta ${max} caracteres.`); return; }
      data[key] = value;
    }
    const stock = Number(form.stockMinimo);
    if (!form.stockMinimo.trim() || !Number.isInteger(stock) || stock < 0 || stock > 2147483647) { setValidationError('El stock mínimo debe ser un entero no negativo dentro del rango permitido.'); return; }
    data.stockMinimo = stock;
    const proveedor = Number(form.idProveedorLaboratorio);
    const keepsCurrent = initialData && proveedor === initialData.idProveedorLaboratorio;
    if (!Number.isInteger(proveedor) || proveedor <= 0 || (!keepsCurrent && !actuales.some((p) => p.idProveedorLaboratorio === proveedor))) { setValidationError('Selecciona un proveedor o laboratorio activo.'); return; }
    data.idProveedorLaboratorio = proveedor;
    // PATCH parcial: no reasignar un proveedor inactivo que se está conservando.
    const payload = initialData ? Object.fromEntries(Object.entries(data).filter(([key, value]) => value !== initialData[key])) : data;
    if (!Object.keys(payload).length) { setValidationError('No hay cambios para guardar.'); return; }
    onSubmit(payload);
  };

  return <form className="catalogo-form" onSubmit={submit} noValidate aria-busy={submitting}>
    <div className="catalogo-form__grid">
      {TEXT_FIELDS.map(([key, label, max]) => <div className="form-field" key={key}><label htmlFor={key}>{label}</label><input id={key} name={key} value={form[key]} onChange={update} maxLength={max} disabled={submitting} required /></div>)}
      <div className="form-field"><label htmlFor="stockMinimo">Stock mínimo</label><input id="stockMinimo" name="stockMinimo" type="number" min="0" max="2147483647" step="1" value={form.stockMinimo} onChange={update} disabled={submitting} required /></div>
      <div className="form-field"><label htmlFor="idProveedorLaboratorio">Proveedor / Laboratorio</label><select id="idProveedorLaboratorio" name="idProveedorLaboratorio" value={form.idProveedorLaboratorio} onChange={update} disabled={submitting} required>
        <option value="">Selecciona un proveedor activo</option>
        {inactiveCurrent && <option value={initialData.idProveedorLaboratorio} disabled>{initialData.proveedorLaboratorio?.nombre || 'Proveedor actual'} (inactivo; relación actual)</option>}
        {actuales.map((p) => <option value={p.idProveedorLaboratorio} key={p.idProveedorLaboratorio}>{p.nombre}</option>)}
      </select>{inactiveCurrent && <p className="form-field__help">Puedes conservar la relación actual. Para cambiarla, selecciona un proveedor activo.</p>}
      {!actuales.length && <p className="form-field__help">No hay proveedores activos para una nueva asignación.</p>}</div>
    </div>
    <FeedbackMessage message={validationError} /><FeedbackMessage message={apiError} />
    <div className="catalogo-form__actions"><button className="button button--secondary" type="button" onClick={onCancel} disabled={submitting}>Cancelar</button><button className="button button--primary" type="submit" disabled={submitting || (!initialData && !actuales.length)}>{submitting ? 'Guardando…' : initialData ? 'Guardar cambios' : 'Crear medicamento'}</button></div>
  </form>;
};
