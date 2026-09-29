import { forwardRef, useId, useRef, useEffect } from 'react';
import './Input.css';

const Input = forwardRef(function Input({
  label,
  error,
  hint,
  required = false,
  disabled = false,
  readOnly = false,
  fullWidth = true,
  leftIcon,
  rightIcon,
  leftAddon,
  rightAddon,
  className = '',
  id: providedId,
  'aria-describedby': ariaDescribedBy,
  ...props
}, ref) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [
    error && errorId,
    hint && hintId,
    ariaDescribedBy
  ].filter(Boolean).join(' ') || undefined;

  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (ref && typeof ref === 'object') ref.current = inputRef.current;
  }, [ref]);

  const combinedRef = (el) => {
    inputRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  const hasError = !!error;
  const hasLeftAddon = !!leftAddon;
  const hasRightAddon = !!rightAddon;
  const hasLeftIcon = !!leftIcon;
  const hasRightIcon = !!rightIcon;

  return (
    <div className={`input-wrapper ${fullWidth ? 'input-wrapper--full' : ''} ${hasError ? 'input-wrapper--error' : ''} ${disabled ? 'input-wrapper--disabled' : ''} ${readOnly ? 'input-wrapper--readonly' : ''} ${className}`}>
      {label && (
        <label htmlFor={id} className="input__label">
          <span className="input__label-text">{label}</span>
          {required && <span className="input__required" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="input__field-wrapper">
        {hasLeftAddon && (
          <span className="input__addon input__addon--left" aria-hidden="true">{leftAddon}</span>
        )}
        {hasLeftIcon && (
          <span className="input__icon input__icon--left" aria-hidden="true">{leftIcon}</span>
        )}
        <input
          ref={combinedRef}
          id={id}
          className={`input ${hasLeftAddon || hasLeftIcon ? 'input--has-left' : ''} ${hasRightAddon || hasRightIcon ? 'input--has-right' : ''}`}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          aria-required={required}
          {...props}
        />
        {hasRightIcon && (
          <span className="input__icon input__icon--right" aria-hidden="true">{rightIcon}</span>
        )}
        {hasRightAddon && (
          <span className="input__addon input__addon--right" aria-hidden="true">{rightAddon}</span>
        )}
      </div>
      {error && (
        <p id={errorId} className="input__error" role="alert" aria-live="polite">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="input__hint">{hint}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;