import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth.js';

const getLoginErrorMessage = (error) => {
  if (!error.response) {
    return 'No se pudo conectar con el servidor. Verifica que el backend esté disponible.';
  }

  if (error.response.status === 401) {
    return 'El nombre de usuario o la contraseña son incorrectos.';
  }

  if (error.response.status === 403) {
    return 'Esta cuenta se encuentra inactiva. Comunícate con el Administrador.';
  }

  if (error.response.status === 423) {
    return (
      error.response.data?.message ||
      'La cuenta está bloqueada temporalmente. Inténtalo más tarde.'
    );
  }

  if (error.response.status === 400) {
    return 'Revisa el nombre de usuario y la contraseña ingresados.';
  }

  return 'No fue posible iniciar sesión. Inténtalo nuevamente.';
};

const EyeIcon = ({ hidden }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {hidden ? (
      <>
        <path d="M3 3l18 18" />
        <path d="M10.6 10.7a2 2 0 002.7 2.7" />
        <path d="M9.9 4.3A10.8 10.8 0 0112 4c5.5 0 9 5.2 9 5.2a15.8 15.8 0 01-3.2 3.6" />
        <path d="M6.5 6.5A16.4 16.4 0 003 9.2s3.5 5.2 9 5.2c.8 0 1.5-.1 2.2-.3" />
      </>
    ) : (
      <>
        <path d="M3 12s3.5-5.2 9-5.2 9 5.2 9 5.2-3.5 5.2-9 5.2S3 12 3 12z" />
        <circle cx="12" cy="12" r="2.4" />
      </>
    )}
  </svg>
);

export const LoginForm = () => {
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');

    const normalizedUsuario = nombreUsuario.trim();

    if (normalizedUsuario.length < 3) {
      setErrorMessage('El nombre de usuario debe tener al menos 3 caracteres.');
      return;
    }

    if (!password) {
      setErrorMessage('Ingresa tu contraseña.');
      return;
    }

    setSubmitting(true);

    try {
      await login({
        nombreUsuario: normalizedUsuario,
        password
      });

      const destination = location.state?.from?.pathname || '/dashboard';
      navigate(destination, { replace: true });
    } catch (error) {
      setErrorMessage(getLoginErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="login-form"
      onSubmit={handleSubmit}
      noValidate
      aria-busy={submitting}
    >
      <div className="login-form__field">
        <label htmlFor="nombreUsuario">Nombre de usuario</label>
        <div className="login-form__input-wrap">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="3.2" />
            <path d="M5.5 19c.5-3.3 2.7-5.2 6.5-5.2s6 1.9 6.5 5.2" />
          </svg>
          <input
            id="nombreUsuario"
            name="nombreUsuario"
            type="text"
            value={nombreUsuario}
            onChange={(event) => setNombreUsuario(event.target.value)}
            autoComplete="username"
            minLength={3}
            maxLength={60}
            placeholder="Ingresa tu usuario"
            required
            disabled={submitting}
          />
        </div>
      </div>

      <div className="login-form__field">
        <label htmlFor="password">Contraseña</label>
        <div className="login-form__input-wrap login-form__input-wrap--password">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5.5" y="10" width="13" height="10" rx="2" />
            <path d="M8.5 10V7.5a3.5 3.5 0 017 0V10" />
          </svg>
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            minLength={1}
            maxLength={100}
            placeholder="Ingresa tu contraseña"
            required
            disabled={submitting}
          />
          <button
            className="login-form__visibility"
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={showPassword}
            disabled={submitting}
          >
            <EyeIcon hidden={showPassword} />
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="login-form__error" role="alert">
          <span aria-hidden="true">!</span>
          <p>{errorMessage}</p>
        </div>
      )}

      <button
        className="login-form__submit"
        type="submit"
        disabled={submitting || !nombreUsuario.trim() || !password}
      >
        {submitting && <span className="button-spinner" aria-hidden="true" />}
        {submitting ? 'Verificando acceso…' : 'Iniciar sesión'}
      </button>
    </form>
  );
};
