import { AppIcon } from './AppIcon.jsx';

export const CatalogoState = ({ loading = false, title, message, onRetry, children }) => (
  <div className="catalogo-state" role={loading ? 'status' : onRetry ? 'alert' : undefined}>
    {loading ? <span className="session-loader__mark" aria-hidden="true" /> : <AppIcon name="pill" size={28} />}
    {title && <h3>{title}</h3>}
    {message && <p>{message}</p>}
    {onRetry && <button className="button button--secondary" type="button" onClick={onRetry}>
      <AppIcon name="retry" size={17} /> Reintentar
    </button>}
    {children}
  </div>
);
