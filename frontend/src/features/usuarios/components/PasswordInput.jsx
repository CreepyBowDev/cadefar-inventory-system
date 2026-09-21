import { useState } from 'react';
import { AppIcon } from '../../../components/AppIcon.jsx';

export const PasswordInput = ({ id, ...inputProps }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input">
      <input id={id} type={visible ? 'text' : 'password'} {...inputProps} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
      >
        <AppIcon name={visible ? 'eyeOff' : 'eye'} size={18} />
      </button>
    </div>
  );
};
