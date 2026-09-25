import { useEffect, useState } from 'react';
import { AppIcon } from '../../../components/AppIcon.jsx';

const EMPTY_FORM = {
  nombre: '',
  telefono: '',
  direccion: '',
  estado: true
};

export const ProveedorLaboratorioForm = ({ mode, initialData, submitting, apiError, onSubmit, onCancel }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [validationError, setValidationError] = useState('');
  const isCreate = mode === 'create';

  useEffect(() => {
    setForm({
      nombre: initialData?.nombre || '',
      telefono: initialData?.telefono || '',
      direccion: initialData?.direccion || '',
      estado: initialData?.estado ?? true
    });
    setValidationError('');
  }, [initialData]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: name === 'estado' ? value === 'true' : value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting) return;

    setValidationError('');
    const nombre = form.nombre.trim();
    const telefono = form.telefono.trim();
    const direccion = form.direccion.trim();

    if (!nombre) {
      setValidationError('El nombre es obligatorio.');
      return;
    }

    if (nombre.length > 150 || telefono.length > 30 || direccion.length > 255) {
      setValidationError('Revisa las longitudes: nombre hasta 150, teléfono hasta 30 y dirección hasta 255 caracteres.');
      return;
    }

    onSubmit({
      nombre,
      telefono: telefono || null,
      direccion: direccion || null,
      ...(isCreate ? { estado: form.estado } : {})
    });
  };

  return (
    <form className="proveedor-form" onSubmit={handleSubmit} noValidate>
      <div className="proveedor-form__grid">
        <div className="form-field proveedor-form__wide">
          <label htmlFor="nombre">Nombre</label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            value={form.nombre}
            onChange={updateField}
            maxLength={150}
            autoComplete="organization"
            disabled={submitting}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="telefono">Teléfono (opcional)</label>
          <input
            id="telefono"
            name="telefono"
            type="text"
            value={form.telefono}
            onChange={updateField}
            maxLength={30}
            autoComplete="tel"
            disabled={submitting}
          />
        </div>
        <div className="form-field proveedor-form__wide">
          <label htmlFor="direccion">Dirección (opcional)</label>
          <input
            id="direccion"
            name="direccion"
            type="text"
            value={form.direccion}
            onChange={updateField}
            maxLength={255}
            autoComplete="street-address"
            disabled={submitting}
          />
        </div>
        {isCreate && (
          <div className="form-field">
            <label htmlFor="estado">Estado inicial</label>
            <select
              id="estado"
              name="estado"
              value={String(form.estado)}
              onChange={updateField}
              disabled={submitting}
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
        )}
      </div>

      {(validationError || apiError) && (
        <div className="feedback feedback--error" role="alert">
          <AppIcon name="alert" size={18} />
          <p>{validationError || apiError}</p>
        </div>
      )}

      <div className="proveedor-form__actions">
        <button className="button button--secondary" type="button" onClick={onCancel} disabled={submitting}>
          Cancelar
        </button>
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? 'Guardando…' : isCreate ? 'Crear proveedor o laboratorio' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
};
