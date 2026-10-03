import { useState } from 'react';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';

export const PrincipioActivoForm = ({ initialData, submitting, apiError, onSubmit, onCancel }) => {
  const [nombre, setNombre] = useState(initialData?.nombre || '');
  const [descripcion, setDescripcion] = useState(initialData?.descripcion || '');
  const [validationError, setValidationError] = useState('');
  const submit = (event) => {
    event.preventDefault();
    if (submitting) return;
    setValidationError('');
    const data = { nombre: nombre.trim(), descripcion: descripcion.trim() || null };
    if (!data.nombre || data.nombre.length > 150 || (data.descripcion?.length || 0) > 255) { setValidationError('El nombre es obligatorio (hasta 150 caracteres) y la descripción admite hasta 255 caracteres.'); return; }
    const payload = initialData ? Object.fromEntries(Object.entries(data).filter(([key, value]) => value !== initialData[key])) : data;
    if (!Object.keys(payload).length) { setValidationError('No hay cambios para guardar.'); return; }
    onSubmit(payload);
  };
  return <form className="catalogo-form principio-form" onSubmit={submit} noValidate aria-busy={submitting}>
    <div className="form-field"><label htmlFor="principioNombre">Nombre</label><input id="principioNombre" value={nombre} onChange={(event) => setNombre(event.target.value)} maxLength={150} disabled={submitting} required /></div>
    <div className="form-field"><label htmlFor="principioDescripcion">Descripción (opcional)</label><textarea id="principioDescripcion" value={descripcion} onChange={(event) => setDescripcion(event.target.value)} maxLength={255} disabled={submitting} /></div>
    <FeedbackMessage message={validationError} /><FeedbackMessage message={apiError} />
    <div className="catalogo-form__actions"><button className="button button--secondary" type="button" disabled={submitting} onClick={onCancel}>Cancelar</button><button className="button button--primary" type="submit" disabled={submitting}>{submitting ? 'Guardando…' : initialData ? 'Guardar cambios' : 'Crear principio activo'}</button></div>
  </form>;
};
