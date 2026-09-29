import { forwardRef } from 'react';
import './Button.css';

const Button = forwardRef(function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  type = 'button',
  onClick,
  className = '',
  'aria-label': ariaLabel,
  ...props
}, ref) {
  const classNames = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth && 'btn--full',
    loading && 'btn--loading',
    disabled && 'btn--disabled',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={classNames}
      disabled={disabled || loading}
      aria-label={ariaLabel || (loading ? 'Loading' : undefined)}
      aria-busy={loading}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <span className="btn__spinner" aria-hidden="true" />
      ) : (
        <>
          {leftIcon && <span className="btn__icon btn__icon--left" aria-hidden="true">{leftIcon}</span>}
          <span className="btn__text">{children}</span>
          {rightIcon && <span className="btn__icon btn__icon--right" aria-hidden="true">{rightIcon}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;