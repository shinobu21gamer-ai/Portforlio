import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  preventScroll = true,
  className = '',
  'aria-describedby': ariaDescribedBy,
  ...props
}) {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onCloseRef.current();
    }
  }, [closeOnOverlayClick]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && closeOnEscape) {
      onCloseRef.current();
      return;
    }

    if (e.key !== 'Tab' || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }, [closeOnEscape]);

  useEffect(() => {
    if (!open) return;

    previousActiveElement.current = document.activeElement;
    document.body.style.overflow = preventScroll ? 'hidden' : '';
    document.body.setAttribute('data-modal-open', 'true');

    window.addEventListener('keydown', handleKeyDown);

    // Focus first focusable element
    setTimeout(() => {
      const focusable = modalRef.current?.querySelector(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
      );
      focusable?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = '';
      document.body.removeAttribute('data-modal-open');
      window.removeEventListener('keydown', handleKeyDown);

      // Return focus to trigger element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [open, handleKeyDown, preventScroll]);

  if (!open) return null;

  const sizeClasses = {
    xs: 'modal--xs',
    sm: 'modal--sm',
    md: 'modal--md',
    lg: 'modal--lg',
    xl: 'modal--xl',
    full: 'modal--full'
  };

  return createPortal(
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={`modal ${sizeClasses[size]} ${className} modal--enter`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {(title || showCloseButton) && (
          <header className="modal__header">
            {title && (
              <h2 id="modal-title" className="modal__title">{title}</h2>
            )}
            {showCloseButton && (
              <button
                className="modal__close"
                onClick={onClose}
                aria-label="Close modal"
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            )}
          </header>
        )}
        <div className="modal__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}