import { forwardRef, useId, useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './Select.css';

const Select = forwardRef(function Select({
  label,
  error,
  hint,
  required = false,
  disabled = false,
  fullWidth = true,
  placeholder = 'Select an option',
  options = [],
  value,
  onChange,
  className = '',
  id: providedId,
  'aria-describedby': ariaDescribedBy,
  searchable = false,
  clearable = false,
  maxHeight = 200,
  ...props
}, ref) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const triggerId = `${id}-trigger`;
  const listboxId = `${id}-listbox`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const triggerRef = useRef(null);
  const listboxRef = useRef(null);
  const optionsRef = useRef([]);

  const describedBy = [
    error && errorId,
    hint && hintId,
    ariaDescribedBy
  ].filter(Boolean).join(' ') || undefined;

  const filteredOptions = options.filter((opt) => {
    if (searchable && searchQuery) {
      const label = opt.label || opt.value || '';
      return label.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, -1));
        break;
      case 'Enter':
      case ' ':
        if (highlightedIndex >= 0) {
          e.preventDefault();
          const option = filteredOptions[highlightedIndex];
          onChange?.(option.value, option);
          setIsOpen(false);
        }
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        if (searchable && e.key.length === 1) {
          setSearchQuery((prev) => prev + e.key);
        }
    }
  }, [isOpen, filteredOptions, highlightedIndex, onChange]);

  const handleClickOutside = useCallback((e) => {
    if (triggerRef.current && !triggerRef.current.contains(e.target) &&
        listboxRef.current && !listboxRef.current.contains(e.target)) {
      setIsOpen(false);
    }
  }, []);

  const handleOptionClick = useCallback((option) => {
    onChange?.(option.value, option);
    setIsOpen(false);
    triggerRef.current?.focus();
  }, [onChange]);

  const handleClear = useCallback((e) => {
    e.stopPropagation();
    onChange?.('', null);
    setIsOpen(false);
  }, [onChange]);

  const handleTriggerClick = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
      setHighlightedIndex(-1);
      setSearchQuery('');
    }
  }, [disabled]);

  if (!isOpen) {
    return (
      <div className={`select-wrapper ${fullWidth ? 'select-wrapper--full' : ''} ${error ? 'select-wrapper--error' : ''} ${disabled ? 'select-wrapper--disabled' : ''} ${className}`}>
        {label && (
          <label htmlFor={triggerId} className="select__label">
            <span className="select__label-text">{label}</span>
            {required && <span className="select__required" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="select__trigger-wrapper">
          <button
            ref={triggerRef}
            id={triggerId}
            type="button"
            className={`select__trigger ${selectedOption ? 'select__trigger--has-value' : ''}`}
            aria-haspopup="listbox"
            aria-expanded="false"
            aria-controls={listboxId}
            aria-labelledby={label ? `${triggerId}-label` : undefined}
            aria-describedby={describedBy}
            aria-disabled={disabled}
            disabled={disabled}
            onClick={handleTriggerClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                handleTriggerClick();
              }
            }}
          >
            <span className="select__value">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            {clearable && value && !disabled && (
              <button
                type="button"
                className="select__clear"
                onClick={handleClear}
                aria-label="Clear selection"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            )}
            <span className="select__icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </button>
        </div>
        {error && (
          <p id={errorId} className="select__error" role="alert">{error}</p>
        )}
        {hint && !error && (
          <p id={hintId} className="select__hint">{hint}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`select-wrapper ${fullWidth ? 'select-wrapper--full' : ''} ${error ? 'select-wrapper--error' : ''} ${disabled ? 'select-wrapper--disabled' : ''} ${className}`}>
      {label && (
        <label htmlFor={triggerId} className="select__label">
          <span className="select__label-text">{label}</span>
          {required && <span className="select__required" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="select__trigger-wrapper" ref={triggerRef}>
        <button
          id={triggerId}
          type="button"
          className={`select__trigger select__trigger--open ${selectedOption ? 'select__trigger--has-value' : ''}`}
          aria-haspopup="listbox"
          aria-expanded="true"
          aria-controls={listboxId}
          aria-labelledby={label ? `${triggerId}-label` : undefined}
          aria-describedby={describedBy}
          aria-disabled={disabled}
          disabled={disabled}
          onClick={handleTriggerClick}
        >
          <span className="select__value">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {clearable && value && !disabled && (
            <button
              type="button"
              className="select__clear"
              onClick={handleClear}
              aria-label="Clear selection"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}
          <span className="select__icon select__icon--open" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>

        {createPortal(
          <div
            ref={listboxRef}
            id={listboxId}
            className="select__portal"
            role="listbox"
            aria-label={label || 'Options'}
            aria-activedescendant={highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined}
            style={{ maxHeight }}
          >
            {searchable && (
              <div className="select__search-wrapper">
                <input
                  type="text"
                  className="select__search"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(-1);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              </div>
            )}
            <ul className="select__options" role="presentation">
              {filteredOptions.length === 0 ? (
                <li className="select__empty" role="option" aria-disabled="true">
                  No options found
                </li>
              ) : (
                filteredOptions.map((option, index) => (
                  <li
                    ref={(el) => { optionsRef.current[index] = el; }}
                    key={option.value}
                    id={`${listboxId}-option-${index}`}
                    className={`select__option ${index === highlightedIndex ? 'select__option--highlighted' : ''} ${option.value === value ? 'select__option--selected' : ''} ${option.disabled ? 'select__option--disabled' : ''}`}
                    role="option"
                    aria-selected={option.value === value}
                    aria-disabled={option.disabled}
                    onClick={() => !option.disabled && handleOptionClick(option)}
                    onMouseEnter={() => !option.disabled && setHighlightedIndex(index)}
                  >
                    {option.icon && <span className="select__option-icon" aria-hidden="true">{option.icon}</span>}
                    <span className="select__option-label">{option.label}</span>
                    {option.description && <span className="select__option-desc">{option.description}</span>}
                    {option.value === value && (
                      <svg className="select__option-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body
        )}
      </div>
      {error && (
        <p id={errorId} className="select__error" role="alert">{error}</p>
      )}
      {hint && !error && (
        <p id={hintId} className="select__hint">{hint}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;