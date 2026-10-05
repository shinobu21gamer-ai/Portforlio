import { useState, useCallback, useRef } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

/**
 * Shared confirm dialog hook (replaces the old sweetalert2 utils/swal helpers).
 *
 *   const { confirmDelete, confirmDialog } = useConfirm();
 *   if (!(await confirmDelete('Remove this product?'))) return;
 *   ...
 *   return (<>{...}{confirmDialog}</>);
 *
 * Every helper returns Promise<boolean> (true = confirmed), same semantics as the
 * removed swal helpers, so call sites only change by the hook destructure.
 */
export default function useConfirm() {
  const [state, setState] = useState({
    open: false,
    title: 'Confirm',
    message: '',
    confirmLabel: 'Confirm',
    danger: false,
    variant: 'primary',
  });
  const resolveRef = useRef(null);

  const openConfirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({
        open: true,
        title: opts.title || 'Confirm',
        message: opts.message || '',
        confirmLabel: opts.confirmLabel || 'Confirm',
        danger: !!opts.danger,
        variant: opts.variant || 'primary',
      });
    });
  }, []);

  const settle = (result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setState((s) => ({ ...s, open: false }));
  };

  const confirmDelete = (message = 'Are you sure you want to delete this?') =>
    openConfirm({ title: 'Confirm Delete', message, confirmLabel: 'Yes, delete it!', danger: true });

  const confirmAction = (message, title = 'Confirm') =>
    openConfirm({ title, message, confirmLabel: 'Yes' });

  const confirmApprove = (message = 'Approve this item?') =>
    openConfirm({ title: 'Approve', message, confirmLabel: 'Yes, approve', variant: 'success' });

  const confirmReject = (message = 'Reject this item?') =>
    openConfirm({ title: 'Reject', message, confirmLabel: 'Yes, reject', danger: true });

  const confirmTerminate = (message = 'Terminate this?') =>
    openConfirm({ title: 'Terminate', message, confirmLabel: 'Yes, terminate', danger: true });

  const confirmDialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      danger={state.danger}
      variant={state.variant}
      onClose={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  );

  return {
    confirm: openConfirm,
    confirmDelete,
    confirmAction,
    confirmApprove,
    confirmReject,
    confirmTerminate,
    confirmDialog,
  };
}
