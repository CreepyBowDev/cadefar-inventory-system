import { useEffect, useState } from 'react';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { Modal } from '../../../components/Modal.jsx';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { updateOwnPassword } from '../services/usuario.service.js';
import { PasswordInput } from './PasswordInput.jsx';
import { PasswordRequirements } from './PasswordRequirements.jsx';
import { getPasswordValidationError } from '../utils/passwordPolicy.js';

const INITIAL_FORM = {
  passwordActual: '',
  passwordNueva: '',
  confirmPassword: ''
};

export const ChangeOwnPasswordDialog = ({ open, onClose }) => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (open) {
      setForm(INITIAL_FORM);
      setErrorMessage('');
      setSuccessMessage('');
    }
  }, [open]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!form.passwordActual || form.passwordActual.length > 100) {
      setErrorMessage('Ingresa tu contraseña actual.');
      return;
    }

    const passwordError = getPasswordValidationError(form.passwordNueva);

    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }

    if (form.passwordNueva !== form.confirmPassword) {
      setErrorMessage('La confirmación de la nueva contraseña no coincide.');
      return;
    }

    setSubmitting(true);

    try {
      await updateOwnPassword({
        passwordActual: form.passwordActual,
        passwordNueva: form.passwordNueva
      });
      setForm(INITIAL_FORM);
      setSuccessMessage('Tu contraseña fue modificada correctamente.');
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No fue posible cambiar tu contraseña.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Cambiar mi contraseña"
      description="Confirma tu contraseña actual antes de establecer una nueva."
      onClose={submitting ? () => {} : onClose}
    >
      <form className="password-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="ownPasswordActual">Contraseña actual</label>
          <PasswordInput
            id="ownPasswordActual"
            name="passwordActual"
            value={form.passwordActual}
            onChange={updateField}
            minLength={1}
            maxLength={100}
            autoComplete="current-password"
            disabled={submitting}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="ownPasswordNueva">Nueva contraseña</label>
          <PasswordInput
            id="ownPasswordNueva"
            name="passwordNueva"
            value={form.passwordNueva}
            onChange={updateField}
            minLength={8}
            maxLength={100}
            autoComplete="new-password"
            disabled={submitting}
            required
          />
          <PasswordRequirements password={form.passwordNueva} />
        </div>
        <div className="form-field">
          <label htmlFor="ownPasswordConfirm">Confirmar nueva contraseña</label>
          <PasswordInput
            id="ownPasswordConfirm"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={updateField}
            minLength={8}
            maxLength={100}
            autoComplete="new-password"
            disabled={submitting}
            required
          />
        </div>

        {errorMessage && (
          <div className="feedback feedback--error" role="alert">
            <AppIcon name="alert" size={18} />
            <p>{errorMessage}</p>
          </div>
        )}
        {successMessage && (
          <div className="feedback feedback--success" role="status">
            <AppIcon name="check" size={18} />
            <p>{successMessage}</p>
          </div>
        )}

        <div className="modal__actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            Cerrar
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Actualizando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
