import { useState } from 'react';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { Modal } from '../../../components/Modal.jsx';
import { ComposicionForm } from './ComposicionForm.jsx';
import { ComposicionTable } from './ComposicionTable.jsx';

const TEXT_FIELDS = [
  ['nombreComercial', 'Nombre comercial', 150],
  ['formaFarmaceutica', 'Forma farmacéutica', 80], ['presentacion', 'Presentación', 150],
  ['unidadInventario', 'Unidad de inventario', 50], ['condicionVenta', 'Condición de venta', 40],
  ['viaAdministracion', 'Vía de administración', 80], ['tipoLiberacion', 'Tipo de liberación', 80]
];
const getValues = (data) => Object.fromEntries([
  ...TEXT_FIELDS.map(([key]) => [key, data?.[key] || '']),
  ['stockMinimo', String(data?.stockMinimo ?? 0)],
  ['idProveedorLaboratorio', String(data?.idProveedorLaboratorio ?? '')]
]);

export const MedicamentoForm = ({ initialData, proveedores, principios = [], submitting, apiError, onSubmit, onCancel }) => {
  const [form, setForm] = useState(() => getValues(initialData));
  const [validationError, setValidationError] = useState('');
  const [composicion, setComposicion] = useState([]);
  const [editor, setEditor] = useState(null);
  const [nextId, setNextId] = useState(1);
  const disponibles = principios.filter((p) => !composicion.some((c) => c.idPrincipioActivo === p.idPrincipioActivo));
  const guardarComponente = (data) => {
    if (editor !== 'nuevo') {
      setComposicion((current) => current.map((c) => c.idComposicion === editor.idComposicion ? { ...c, ...data } : c));
    } else {
      // ID local de la fila; nunca se envía como ID de la base de datos.
      setComposicion((current) => [...current, { ...data, idComposicion: nextId,
        principioActivo: principios.find((p) => p.idPrincipioActivo === data.idPrincipioActivo) }]);
      setNextId((current) => current + 1);
    }
    setValidationError(''); setEditor(null);
  };
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
    if (!initialData) {
      if (!composicion.length) { setValidationError('Agrega al menos un principio activo a la composición.'); return; }
      data.composicion = composicion.map(({ idPrincipioActivo, cantidadPrincipioActivo, unidadPrincipioActivo,
        cantidadReferencia, unidadReferencia }) => ({ idPrincipioActivo, cantidadPrincipioActivo,
        unidadPrincipioActivo, cantidadReferencia, unidadReferencia }));
    }
    // PATCH parcial: no reasignar un proveedor inactivo que se está conservando.
    const payload = initialData ? Object.fromEntries(Object.entries(data).filter(([key, value]) => value !== initialData[key])) : data;
    if (!Object.keys(payload).length) { setValidationError('No hay cambios para guardar.'); return; }
    onSubmit(payload);
  };

  return <><form className="catalogo-form" onSubmit={submit} noValidate aria-busy={submitting}>
    {initialData ? <div className="form-field"><span className="form-field__label">Código del medicamento</span><p>{initialData.codigoMedicamento}</p><p className="form-field__help">El código se conserva y no puede modificarse.</p></div> : <p className="form-field__help">El código del medicamento se generará automáticamente al registrar.</p>}
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
    {!initialData && <section className="medicamento-composicion-draft" aria-labelledby="composicion-heading">
      <div className="medicamento-detail-actions"><h3 id="composicion-heading">Composición del medicamento</h3>
        <button className="button button--secondary" type="button" disabled={submitting || !disponibles.length} onClick={() => setEditor('nuevo')}>Agregar componente</button></div>
      <p className="form-field__help">Agrega al menos un principio activo. Los componentes se guardarán junto con el medicamento al confirmar el registro.</p>
      {!principios.length && <p className="form-field__help">No hay principios activos registrados. Registra uno en el catálogo para continuar.</p>}
      {composicion.length ? <ComposicionTable composicion={composicion} canManage busy={submitting}
        onEdit={setEditor} onRemove={(comp) => setComposicion((current) => current.filter((c) => c.idComposicion !== comp.idComposicion))} />
        : <p className="composicion-principio">Todavía no has agregado componentes.</p>}
    </section>}
    <FeedbackMessage message={validationError} /><FeedbackMessage message={apiError} />
    <div className="catalogo-form__actions"><button className="button button--secondary" type="button" onClick={onCancel} disabled={submitting}>Cancelar</button><button className="button button--primary" type="submit" disabled={submitting || (!initialData && (!actuales.length || !principios.length))}>{submitting ? 'Guardando…' : initialData ? 'Guardar cambios' : 'Crear medicamento'}</button></div>
  </form>
    <Modal open={editor !== null} title={editor === 'nuevo' ? 'Agregar componente' : 'Editar componente'} onClose={() => setEditor(null)}>
      {editor !== null && <ComposicionForm initialData={editor === 'nuevo' ? undefined : editor} principios={disponibles}
        submitting={submitting} onSubmit={guardarComponente} onCancel={() => setEditor(null)} />}
    </Modal>
  </>;
};
