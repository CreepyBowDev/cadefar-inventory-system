import { useEffect, useRef } from 'react';
import { AppIcon } from './AppIcon.jsx';

export const Modal = ({
  open,
  title,
  description,
  children,
  onClose,
  size = 'medium',
  manageFocus = false,
  returnFocusRef
}) => {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!manageFocus || !open) return undefined;
    const dialog = dialogRef.current;
    const origen = returnFocusRef?.current || document.activeElement;
    const controles = () => [...dialog.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')]
      .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length > 0);
    const enfocarInicio = () => (controles()[0] || dialog).focus();
    enfocarInicio();
    const mantenerFoco = event => { if (!dialog.contains(event.target)) enfocarInicio(); };
    const manejarTab = event => {
      if (event.key !== 'Tab') return;
      const elementos = controles(), primero = elementos[0], ultimo = elementos.at(-1);
      if (!primero) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && (document.activeElement === primero || !dialog.contains(document.activeElement))) { event.preventDefault(); ultimo.focus(); }
      else if (!event.shiftKey && (document.activeElement === ultimo || !dialog.contains(document.activeElement))) { event.preventDefault(); primero.focus(); }
    };
    document.addEventListener('focusin', mantenerFoco);
    document.addEventListener('keydown', manejarTab);
    return () => {
      document.removeEventListener('focusin', mantenerFoco);
      document.removeEventListener('keydown', manejarTab);
      queueMicrotask(() => {
        if (!dialogRef.current && origen?.isConnected && !origen.disabled && !origen.closest('[inert]')) origen.focus();
      });
    };
  }, [open, manageFocus, returnFocusRef]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        tabIndex={manageFocus ? -1 : undefined}
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-description' : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p id="modal-description">{description}</p>}
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
          >
            <AppIcon name="close" />
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </section>
    </div>
  );
};
