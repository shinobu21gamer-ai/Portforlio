import Modal from './Modal';
import Button from './Button';

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'primary', danger = false }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      preventClose={false}
    >
      <div style={{ textAlign: 'center', padding: 'var(--space-2) 0' }}>
        <p style={{ margin: 0, color: 'var(--fg-secondary)', fontSize: 'var(--text-base)', lineHeight: 'var(--leading-relaxed)' }}>
          {message}
        </p>
      </div>
      <div className="modal__footer" style={{ paddingTop: 'var(--space-4)', justifyContent: 'center' }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : variant} onClick={() => { onConfirm(); onClose(); }}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}