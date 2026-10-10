import logoCadefar from '../../../assets/images/brand/logo-cadefar.png';
import escudoCadefar from '../../../assets/images/brand/escudo-cadefar.png';
import '../styles/login.css';

export const AuthPageContent = ({ titleId, title, description, children }) => (
  <div className="login-page">
    <aside className="login-brand-panel">
      <div className="login-brand-panel__topline" aria-hidden="true" />
      <div className="login-brand-panel__logo-frame">
        <img className="login-brand-panel__logo" src={logoCadefar} alt="Farmacia CADEFAR" />
      </div>
      <div className="login-brand-panel__content">
        <p className="login-brand-panel__context">Gestión farmacéutica interna</p>
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
      <img className="login-brand-panel__shield" src={escudoCadefar} alt="" aria-hidden="true" />
    </aside>

    <section className="login-form-panel" aria-labelledby={titleId}>
      <div className="login-form-panel__content">
        <div className="login-form-panel__identity">
          <img src={escudoCadefar} alt="" aria-hidden="true" />
          <span>Acceso seguro CADEFAR</span>
        </div>
        <header className="login-form-panel__heading">
          <h1 id={titleId}>{title}</h1>
          <p>{description}</p>
        </header>
        {children}
        <p className="login-form-panel__notice">
          Uso exclusivo del personal autorizado de Farmacia CADEFAR.
        </p>
      </div>
    </section>
  </div>
);
