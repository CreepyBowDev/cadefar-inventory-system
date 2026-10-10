import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthPageContent } from '../components/AuthPageContent.jsx';
import { solicitarRecuperacion, restablecerPassword } from '../services/auth.service.js';
import { FeedbackMessage } from '../../../components/FeedbackMessage.jsx';
import { PasswordInput } from '../../usuarios/components/PasswordInput.jsx';
import { PasswordRequirements } from '../../usuarios/components/PasswordRequirements.jsx';
import { getPasswordValidationError } from '../../usuarios/utils/passwordPolicy.js';
import { getApiErrorMessage } from '../../../utils/apiError.js';
import '../../../styles/app-shell.css';
import '../../usuarios/styles/usuarios.css';
import '../styles/recuperacion.css';

const EMPTY_PASSWORD_FORM = { codigo: '', passwordNueva: '', confirmPassword: '' };
const PUBLIC_ERROR_MESSAGES = new Set([
  'Datos de recuperación inválidos',
  'El código de recuperación no es válido o ha vencido',
  'Demasiadas solicitudes. Intenta nuevamente más tarde',
  'La recuperación de contraseña no está disponible'
]);

const getRecoveryErrorMessage = (error) => {
  const fallback = 'No fue posible completar la recuperación. Inténtalo nuevamente más tarde.';
  const message = getApiErrorMessage(error, fallback);

  if (!error?.response) return message;
  return [400, 429, 503].includes(error.response.status) && PUBLIC_ERROR_MESSAGES.has(message)
    ? message
    : fallback;
};

export const RecuperacionPasswordPage = () => {
  const [step, setStep] = useState('request');
  const [correo, setCorreo] = useState('');
  const [form, setForm] = useState(EMPTY_PASSWORD_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const firstFieldRef = useRef(null);
  const successRef = useRef(null);
  // También impide dos envíos antes de que React actualice el botón.
  const pendingRef = useRef(false);

  useEffect(() => {
    if (step === 'success') successRef.current?.focus();
    else firstFieldRef.current?.focus();
  }, [step]);

  const handleRequest = async (event) => {
    event.preventDefault();
    if (pendingRef.current) return;
    setErrorMessage('');
    const normalizedCorreo = correo.trim().toLowerCase();

    if (!normalizedCorreo || normalizedCorreo.length > 255 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedCorreo) ||
        firstFieldRef.current?.validity.typeMismatch) {
      setErrorMessage('Ingresa un correo electrónico válido.');
      return;
    }

    pendingRef.current = true;
    setSubmitting(true);
    try {
      const response = await solicitarRecuperacion({ correo: normalizedCorreo });
      setCorreo(normalizedCorreo);
      setRequestMessage(response.message);
      setForm(EMPTY_PASSWORD_FORM);
      setStep('reset');
    } catch (error) {
      setErrorMessage(getRecoveryErrorMessage(error));
    } finally {
      pendingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleReset = async (event) => {
    event.preventDefault();
    if (pendingRef.current) return;
    setErrorMessage('');

    if (!/^\d{6}$/.test(form.codigo)) {
      setErrorMessage('Ingresa el código de seis dígitos.');
      return;
    }

    const passwordError = getPasswordValidationError(form.passwordNueva);
    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }
    if (new TextEncoder().encode(form.passwordNueva).byteLength > 72) {
      setErrorMessage('La contraseña no puede superar los 72 bytes en UTF-8.');
      return;
    }
    if (form.passwordNueva !== form.confirmPassword) {
      setErrorMessage('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    pendingRef.current = true;
    setSubmitting(true);
    try {
      const response = await restablecerPassword({
        correo,
        codigo: form.codigo,
        passwordNueva: form.passwordNueva
      });
      setSuccessMessage(response.message);
      setForm(EMPTY_PASSWORD_FORM);
      setCorreo('');
      setRequestMessage('');
      setStep('success');
    } catch (error) {
      setErrorMessage(getRecoveryErrorMessage(error));
    } finally {
      pendingRef.current = false;
      setSubmitting(false);
    }
  };

  const requestAnotherCode = () => {
    if (pendingRef.current) return;
    setForm(EMPTY_PASSWORD_FORM);
    setErrorMessage('');
    setRequestMessage('');
    setStep('request');
  };

  const updatePasswordField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  return (
    <AuthPageContent
      titleId="recovery-title"
      title={step === 'request' ? 'Recuperar contraseña' : 'Restablecer contraseña'}
      description={step === 'request'
        ? 'Ingresa el correo electrónico asociado a tu cuenta para recibir un código de recuperación.'
        : step === 'reset'
          ? 'Ingresa el código recibido y establece tu nueva contraseña.'
          : 'Ya puedes iniciar sesión con tu nueva contraseña.'}
    >
      {step === 'success' ? (
        <div className="recovery-success" ref={successRef} tabIndex={-1}>
          <FeedbackMessage message={successMessage} tone="success" />
          <Link className="login-form__submit" to="/login">Volver a iniciar sesión</Link>
        </div>
      ) : (
        <>
          <form
            className="login-form recovery-form"
            noValidate
            aria-busy={submitting}
            onSubmit={step === 'request' ? handleRequest : handleReset}
          >
            {step === 'request' ? (
              <div className="login-form__field">
                <label htmlFor="recovery-correo">Correo electrónico</label>
                <input
                  ref={firstFieldRef}
                  id="recovery-correo"
                  name="correo"
                  type="email"
                  value={correo}
                  onChange={(event) => setCorreo(event.target.value)}
                  autoComplete="email"
                  maxLength={255}
                  required
                  disabled={submitting}
                />
              </div>
            ) : (
              <>
                <FeedbackMessage message={requestMessage} tone="success" />
                <div className="login-form__field">
                  <label htmlFor="recovery-codigo">Código de verificación</label>
                  <input
                    ref={firstFieldRef}
                    id="recovery-codigo"
                    name="codigo"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    value={form.codigo}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (/^\d{0,6}$/.test(value)) {
                        setForm((current) => ({ ...current, codigo: value }));
                      }
                    }}
                    aria-describedby="recovery-code-help"
                    required
                    disabled={submitting}
                  />
                  <p id="recovery-code-help" className="recovery-form__help">
                    El código tiene seis dígitos, vence a los diez minutos y permite un solo uso.
                  </p>
                </div>
                <div className="login-form__field">
                  <label htmlFor="recovery-password">Nueva contraseña</label>
                  <PasswordInput
                    id="recovery-password"
                    name="passwordNueva"
                    value={form.passwordNueva}
                    onChange={updatePasswordField}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={100}
                    aria-describedby="recovery-password-help"
                    required
                    disabled={submitting}
                  />
                  <div id="recovery-password-help">
                    <PasswordRequirements password={form.passwordNueva} />
                    <p className="recovery-form__help">Máximo 72 bytes UTF-8; algunos caracteres ocupan más de un byte.</p>
                  </div>
                </div>
                <div className="login-form__field">
                  <label htmlFor="recovery-confirm-password">Confirmar nueva contraseña</label>
                  <PasswordInput
                    id="recovery-confirm-password"
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={updatePasswordField}
                    autoComplete="new-password"
                    maxLength={100}
                    required
                    disabled={submitting}
                  />
                </div>
              </>
            )}
            <FeedbackMessage message={errorMessage} />
            <button className="login-form__submit" type="submit" disabled={submitting}>
              {submitting && <span className="button-spinner" aria-hidden="true" />}
              {step === 'request'
                ? submitting ? 'Solicitando código…' : 'Enviar código'
                : submitting ? 'Restableciendo contraseña…' : 'Restablecer contraseña'}
            </button>
            {step === 'reset' && (
              <div className="recovery-form__secondary">
                <button className="auth-form-link" type="button" onClick={requestAnotherCode} disabled={submitting}>
                  Solicitar otro código
                </button>
                <p className="recovery-form__help">
                  Espera al menos 60 segundos entre solicitudes. Los límites del servidor siguen aplicándose.
                </p>
              </div>
            )}
          </form>
          <Link className="auth-form-link" to="/login">Volver a iniciar sesión</Link>
        </>
      )}
    </AuthPageContent>
  );
};
