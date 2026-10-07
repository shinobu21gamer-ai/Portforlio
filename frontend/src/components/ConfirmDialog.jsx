import Modal from './Modal';
import Button from './Button';

/**
 * Shared confirmation dialog — the same component in the POS build and the
 * HRMS build, so a "Delete this product?" prompt looks and behaves identically
 * wherever it appears.
 * Usage: <ConfirmDialog open={...} onClose={...} onConfirm={...} title="Delete?"
 *          message="This cannot be undone." confirmLabel="Delete" danger />
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  danger = false,
  loading = false,
}) {
  const handleConfirm = () => {
    if (loading) return;
    const result = onConfirm();
    // Support async onConfirm: only close when it resolves.
    if (result && typeof result.then === 'function') {
      result.then(() => onClose()).catch(() => {});
    } else {
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} preventClose={loading}>
      <div className="confirm-dialog">
        <div className="confirm-dialog__message" role="alert">
          {message}
        </div>
        <div className="confirm-dialog__actions">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : variant}
            size="sm"
            onClick={handleConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
