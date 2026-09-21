import { Navigate } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm.jsx';
import { useAuth } from '../../../hooks/useAuth.js';
import logoCadefar from '../../../assets/images/brand/logo-cadefar.png';
import escudoCadefar from '../../../assets/images/brand/escudo-cadefar.png';
import '../styles/login.css';

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
    <div className="login-page">
      <aside className="login-brand-panel">
        <div className="login-brand-panel__topline" aria-hidden="true" />

        <div className="login-brand-panel__logo-frame">
          <img
            className="login-brand-panel__logo"
            src={logoCadefar}
            alt="Farmacia CADEFAR"
          />
        </div>

        <div className="login-brand-panel__content">
          <p className="login-brand-panel__context">
            Gestión farmacéutica interna
          </p>
          <h2>Información precisa para cuidar cada operación.</h2>
          <p>
            Un único espacio para administrar existencias, ventas y
            vencimientos con seguridad y trazabilidad.
          </p>
          <ul className="login-brand-panel__features">
            <li>Existencias y vencimientos</li>
            <li>Compras y ventas</li>
            <li>Movimientos de inventario</li>
          </ul>
        </div>

        <div className="login-brand-panel__footer">
          <span>Sistema de gestión interna</span>
          <span>Farmacia CADEFAR</span>
        </div>

        <img
          className="login-brand-panel__shield"
          src={escudoCadefar}
          alt=""
          aria-hidden="true"
        />
      </aside>

      <section className="login-form-panel" aria-labelledby="login-title">
        <div className="login-form-panel__content">
          <div className="login-form-panel__identity">
            <img src={escudoCadefar} alt="" aria-hidden="true" />
            <span>Acceso seguro CADEFAR</span>
          </div>

          <header className="login-form-panel__heading">
            <h1 id="login-title">Iniciar sesión</h1>
            <p>
              Ingresa tus credenciales para continuar al sistema administrativo.
            </p>
          </header>

          <LoginForm />

          <p className="login-form-panel__notice">
            Uso exclusivo del personal autorizado de Farmacia CADEFAR.
          </p>
        </div>
      </section>
    </div>
  );
};
