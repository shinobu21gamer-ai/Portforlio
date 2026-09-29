import { useEffect, useRef, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ open, onClose, title, children, wide, preventClose }) {
  const modalRef = useRef(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleOverlayClick = useCallback(() => {
    if (!preventClose) onCloseRef.current();
  }, [preventClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { if (!preventClose) onCloseRef.current(); return; }
    if (e.key !== 'Tab' || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleKeyDown, preventClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        ref={modalRef}
        className={`modal ${wide ? 'modal-wide' : ''} modal-enter`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="modal-header">
            <h3 id={titleId}>{title}</h3>
            <button className="modal-close" onClick={() => { if (!preventClose) onClose(); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
