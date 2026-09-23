import { AppIcon } from '../../../components/AppIcon.jsx';
import { PASSWORD_RULES } from '../utils/passwordPolicy.js';

export const PasswordRequirements = ({ password }) => (
  <div className="password-requirements" aria-label="Requisitos de contraseña">
    <p>La contraseña debe contener:</p>
    <ul>
      {PASSWORD_RULES.map((rule) => {
        const completed = rule.test(password);

        return (
          <li
            className={completed ? 'is-complete' : ''}
            key={rule.key}
          >
            <span aria-hidden="true">
              {completed ? <AppIcon name="check" size={13} /> : null}
            </span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  </div>
);
