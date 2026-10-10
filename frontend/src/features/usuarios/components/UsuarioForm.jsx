import { useEffect, useState } from 'react';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { ROLE_OPTIONS } from '../../../constants/roles.js';
import { PasswordInput } from './PasswordInput.jsx';
import { PasswordRequirements } from './PasswordRequirements.jsx';
import { getPasswordValidationError } from '../utils/passwordPolicy.js';

const EMPTY_FORM = {
  nombreUsuario: '',
  correo: '',
  idRol: '',
  password: '',
  confirmPassword: ''
};

export const UsuarioForm = ({
  mode,
  initialData,
  submitting,
  apiError,
  onSubmit,
  onCancel
}) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [validationError, setValidationError] = useState('');
  const isCreate = mode === 'create';

  useEffect(() => {
    setForm({
      ...EMPTY_FORM,
      nombreUsuario: initialData?.nombreUsuario || '',
      correo: initialData?.correo || '',
      idRol: initialData?.rol?.idRol?.toString() || ''
    });
    setValidationError('');
  }, [initialData]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setValidationError('');

    const nombreUsuario = form.nombreUsuario.trim();

    if (nombreUsuario.length < 3 || nombreUsuario.length > 60) {
      setValidationError(
        'El nombre de usuario debe tener entre 3 y 60 caracteres.'
      );
      return;
    }

    const idRol = Number(form.idRol);

    if (!ROLE_OPTIONS.some((role) => role.idRol === idRol)) {
      setValidationError('Selecciona uno de los roles disponibles.');
      return;
    }

    const correo = form.correo.trim().toLowerCase() || null;

    if (correo && correo.length > 255) {
      setValidationError('El correo no puede superar los 255 caracteres.');
      return;
    }

    if (correo && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ||
        event.currentTarget.elements.correo.validity.typeMismatch)) {
      setValidationError('Ingresa un correo electrónico válido o deja el campo vacío.');
      return;
    }

    if (isCreate) {
      const passwordError = getPasswordValidationError(form.password);

      if (passwordError) {
        setValidationError(passwordError);
        return;
      }

      if (form.password !== form.confirmPassword) {
        setValidationError('La confirmación de contraseña no coincide.');
        return;
      }
    }

    onSubmit({
      idRol,
      nombreUsuario,
      ...(isCreate || correo !== (initialData?.correo ?? null) ? { correo } : {}),
      ...(isCreate ? { password: form.password } : {})
    });
  };

  return (
    <form className="usuario-form" onSubmit={handleSubmit} noValidate>
      <div className="usuario-form__grid">
        <div className="form-field usuario-form__wide">
          <label htmlFor="nombreUsuario">Nombre de usuario</label>
          <input
            id="nombreUsuario"
            name="nombreUsuario"
            type="text"
            value={form.nombreUsuario}
            onChange={updateField}
            minLength={3}
            maxLength={60}
            autoComplete="off"
            placeholder="Ej. vendedor01"
            disabled={submitting}
            required
          />
          <p className="form-field__help">
            Será el identificador utilizado para iniciar sesión.
          </p>
        </div>

        <div className="form-field usuario-form__wide">
          <label htmlFor="correo">Correo electrónico (opcional)</label>
          <input
            id="correo"
            name="correo"
            type="email"
            value={form.correo}
            onChange={updateField}
            maxLength={255}
            autoComplete="off"
            placeholder="Ej. usuario@dominio.com"
            aria-describedby="correo-help"
            disabled={submitting}
          />
          <p id="correo-help" className="form-field__help">
            {isCreate
              ? 'Permite recuperar la contraseña mediante un código enviado a este correo.'
              : 'Déjalo vacío para retirar el correo. Cambiarlo o retirarlo invalida los códigos de recuperación pendientes.'}
          </p>
        </div>

        <div className="form-field usuario-form__wide">
          <label htmlFor="idRol">Rol</label>
          <select
            id="idRol"
            name="idRol"
            value={form.idRol}
            onChange={updateField}
            disabled={submitting}
            required
          >
            <option value="">Selecciona un rol</option>
            {ROLE_OPTIONS.map((role) => (
              <option value={role.idRol} key={role.idRol}>
                {role.nombre}
              </option>
            ))}
          </select>
          <p className="form-field__help">
            Los roles son fijos y determinan las opciones visibles del sistema.
          </p>
        </div>

        {isCreate && (
          <>
            <div className="form-field">
              <label htmlFor="password">Contraseña inicial</label>
              <PasswordInput
                id="password"
                name="password"
                value={form.password}
                onChange={updateField}
                minLength={8}
                maxLength={100}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                disabled={submitting}
                required
              />
              <PasswordRequirements password={form.password} />
            </div>

            <div className="form-field">
              <label htmlFor="confirmPassword">Confirmar contraseña</label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={updateField}
                minLength={8}
                maxLength={100}
                autoComplete="new-password"
                placeholder="Repite la contraseña"
                disabled={submitting}
                required
              />
            </div>
          </>
        )}
      </div>

      {(validationError || apiError) && (
        <div className="feedback feedback--error" role="alert">
          <AppIcon name="alert" size={18} />
          <p>{validationError || apiError}</p>
        </div>
      )}

      <div className="usuario-form__actions">
        <button
          className="button button--secondary"
          type="button"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancelar
        </button>
        <button
          className="button button--primary"
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? 'Guardando…'
            : isCreate
              ? 'Crear usuario'
              : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
};
