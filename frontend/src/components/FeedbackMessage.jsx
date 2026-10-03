import { AppIcon } from './AppIcon.jsx';

export const FeedbackMessage = ({ message, tone = 'error' }) => message ? (
  <div className={`feedback feedback--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
    <AppIcon name={tone === 'error' ? 'alert' : 'check'} size={18} />
    <p>{message}</p>
  </div>
) : null;
