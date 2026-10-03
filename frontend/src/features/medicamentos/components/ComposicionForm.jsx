import { useState } from 'react';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';

const fields = [
  ['cantidadPrincipioActivo', 'Cantidad del principio activo', true],
  ['unidadPrincipioActivo', 'Unidad del principio activo', false],
  ['cantidadReferencia', 'Cantidad de referencia', true],
  ['unidadReferencia', 'Unidad de referencia', false]
];

export const ComposicionForm = ({ initialData, principios, submitting, apiError, onSubmit, onCancel }) => {
  const [form, setForm] = useState(() => ({
    idPrincipioActivo: '',
    cantidadPrincipioActivo: initialData?.cantidadPrincipioActivo ?? '',
    unidadPrincipioActivo: initialData?.unidadPrincipioActivo ?? '',
    cantidadReferencia: initialData?.cantidadReferencia ?? '',
    unidadReferencia: initialData?.unidadReferencia ?? ''
  }));
  const [validationError, setValidationError] = useState('');
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = (event) => {
    event.preventDefault();
    if (submitting) return;
    setValidationError('');
    const data = {};
    for (const [key, label, numeric] of fields) {
      const text = String(form[key]).trim();
      if (numeric) {
        const value = Number(text);
        // Validación estructural para UX; el backend vuelve a validar DECIMAL.
        const [mantissa, exponent = '0'] = String(value).split('e');
        const decimals = (mantissa.split('.')[1] || '').length - Number(exponent);
        if (!text || !Number.isFinite(value) || value <= 0 || value > 99999999.9999 || decimals > 4) {
          setValidationError(`${label} debe ser positiva, hasta 99999999.9999 y con un máximo de cuatro decimales.`); return;
        }
        data[key] = value;
      } else {
        if (!text || text.length > 30) { setValidationError(`${label} es obligatoria y admite hasta 30 caracteres.`); return; }
        data[key] = text;
      }
    }
    if (!initialData) {
      const id = Number(form.idPrincipioActivo);
      if (!principios.some((p) => p.idPrincipioActivo === id)) { setValidationError('Selecciona un principio activo del catálogo.'); return; }
      data.idPrincipioActivo = id;
    }
    const payload = initialData ? Object.fromEntries(Object.entries(data).filter(([key, value]) =>
      key.startsWith('cantidad') ? value !== Number(initialData[key]) : value !== initialData[key]
    )) : data;
    if (!Object.keys(payload).length) { setValidationError('No hay cambios para guardar.'); return; }
    onSubmit(payload);
  };

  return <form className="catalogo-form catalogo-modal-form" onSubmit={submit} noValidate aria-busy={submitting}>
    {initialData ? <div className="form-field"><span className="form-field__label">Principio activo</span><p className="composicion-principio">{initialData.principioActivo?.nombre}</p><p className="form-field__help">Para corregir el ingrediente, retira esta relación y luego agrega la correcta.</p></div> : <div className="form-field"><label htmlFor="composicionPrincipio">Principio activo</label><select id="composicionPrincipio" name="idPrincipioActivo" value={form.idPrincipioActivo} onChange={update} disabled={submitting} required><option value="">Selecciona un principio activo</option>{principios.map((p) => <option key={p.idPrincipioActivo} value={p.idPrincipioActivo}>{p.nombre}{p.estado ? '' : ' (inactivo)'}</option>)}</select></div>}
    <div className="catalogo-form__grid">{fields.map(([key, label, numeric]) => <div className="form-field" key={key}><label htmlFor={`comp-${key}`}>{label}</label><input id={`comp-${key}`} name={key} type={numeric ? 'number' : 'text'} {...(numeric ? { min: '0.0001', max: '99999999.9999', step: '0.0001' } : { maxLength: 30 })} value={form[key]} onChange={update} disabled={submitting} required /></div>)}</div>
    <FeedbackMessage message={validationError} /><FeedbackMessage message={apiError} />
    <div className="catalogo-form__actions"><button className="button button--secondary" type="button" disabled={submitting} onClick={onCancel}>Cancelar</button><button className="button button--primary" type="submit" disabled={submitting || (!initialData && !principios.length)}>{submitting ? 'Guardando…' : initialData ? 'Guardar cambios' : 'Agregar principio activo'}</button></div>
  </form>;
};
