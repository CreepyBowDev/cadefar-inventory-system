import { Link, Navigate } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm.jsx';
import { AuthPageContent } from '../components/AuthPageContent.jsx';
import { useAuth } from '../../../hooks/useAuth.js';

export const LoginPage = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="session-loader" role="status" aria-live="polite">
        <span className="session-loader__mark" aria-hidden="true" />
        <span>Verificando sesión…</span>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AuthPageContent
      titleId="login-title"
      title="Iniciar sesión"
      description="Ingresa tus credenciales para continuar al sistema administrativo."
    >
      <LoginForm />
      <Link className="auth-form-link" to="/recuperar-contrasena">
        ¿Olvidaste tu contraseña?
      </Link>
    </AuthPageContent>
  );
};
