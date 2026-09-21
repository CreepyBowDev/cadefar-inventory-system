import { Modal } from './Modal.jsx';

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  busy = false,
  tone = 'danger',
  onConfirm,
  onClose
}) => (
  <Modal
    open={open}
    title={title}
    description={description}
    onClose={busy ? () => {} : onClose}
    size="small"
  >
    <div className="modal__actions">
      <button
        className="button button--secondary"
        type="button"
        onClick={onClose}
        disabled={busy}
      >
        {cancelLabel}
      </button>
      <button
        className={`button button--${tone}`}
        type="button"
        onClick={onConfirm}
        disabled={busy}
      >
        {busy ? 'Procesando…' : confirmLabel}
      </button>
    </div>
  </Modal>
);
