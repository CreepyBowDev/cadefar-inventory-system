import { useEffect, useState } from 'react';
import { AppIcon } from '../../../components/AppIcon.jsx';
import { Modal } from '../../../components/Modal.jsx';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import { resetPasswordUsuario } from '../services/usuario.service.js';
import { PasswordInput } from './PasswordInput.jsx';

export const ResetPasswordDialog = ({ usuario, onClose, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (usuario) {
      setPassword('');
      setConfirmation('');
      setErrorMessage('');
    }
  }, [usuario]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');

    if (password.length < 8 || password.length > 100) {
      setErrorMessage('La contraseña debe tener entre 8 y 100 caracteres.');
      return;
    }

    if (password !== confirmation) {
      setErrorMessage('La confirmación de contraseña no coincide.');
      return;
    }

    setSubmitting(true);

    try {
      await resetPasswordUsuario(usuario.idUsuario, password);
      onSuccess(usuario);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No fue posible restablecer la contraseña.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(usuario)}
      title="Restablecer contraseña"
      description={
        usuario
          ? `Establece una nueva contraseña para ${usuario.nombreUsuario}.`
          : ''
      }
      onClose={submitting ? () => {} : onClose}
    >
      <form className="password-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="resetPassword">Nueva contraseña</label>
          <PasswordInput
            id="resetPassword"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            maxLength={100}
            autoComplete="new-password"
            disabled={submitting}
            required
          />
          <p className="form-field__help">Debe tener al menos 8 caracteres.</p>
        </div>
        <div className="form-field">
          <label htmlFor="resetPasswordConfirmation">Confirmar contraseña</label>
          <PasswordInput
            id="resetPasswordConfirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
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

        <div className="modal__actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Restableciendo…' : 'Restablecer contraseña'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
