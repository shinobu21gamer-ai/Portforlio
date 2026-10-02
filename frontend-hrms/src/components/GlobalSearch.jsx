import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useEmployees, useDepartments, usePositions } from '../hooks/useApi';
import useDebounce from '../hooks/useDebounce';
import './GlobalSearch.css';

export default function GlobalSearch({ isOpen, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const keyHandlerRef = useRef(null);

  const debouncedQuery = useDebounce(query, 250);

  const { data: employeesData } = useEmployees({ search: debouncedQuery || undefined, limit: 5 });
  const { data: departmentsData } = useDepartments({ search: debouncedQuery || undefined, limit: 5 });
  const { data: positionsData } = usePositions({ search: debouncedQuery || undefined, limit: 5 });

  const employees = employeesData?.employees || [];
  const departments = departmentsData?.departments || [];
  const positions = positionsData?.positions || [];

  const sections = useMemo(() => [
    {
      key: 'employees', label: 'Employees', icon: '👨‍💼', items: employees,
      getLabel: e => `${e.firstName} ${e.middleName ? e.middleName + ' ' : ''}${e.lastName}`,
      getSub: e => e.employeeNo ? `${e.employeeNo} • ${e.position?.title || '—'}` : (e.email || '—'),
      getAction: e => ({ type: 'employee', id: e.id })
    },
    {
      key: 'departments', label: 'Departments', icon: '🏢', items: departments,
      getLabel: d => d.name,
      getSub: d => d.code ? `#${d.code}` : null,
      getAction: () => ({ type: 'department' })
    },
    {
      key: 'positions', label: 'Positions', icon: '💼', items: positions,
      getLabel: p => p.title,
      getSub: p => p.department?.name || null,
      getAction: () => ({ type: 'position' })
    }
  ].filter(s => s.items.length > 0), [employees, departments, positions]);

  const flatItems = useMemo(() => sections.flatMap((section, si) =>
    section.items.map((item, ii) => ({ sectionIndex: si, itemIndex: ii, section, item }))
  ), [sections]);

  const handleGlobalKeyDown = (e) => {
    if (!isOpen) return;
    const lastIndex = flatItems.length - 1;

    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (lastIndex < 0) return;
      setSelectedIndex(prev => Math.min(prev + 1, lastIndex));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (lastIndex < 0) return;
      setSelectedIndex(prev => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const selected = flatItems[selectedIndex];
      if (selected) {
        onSelect?.(selected.section.getAction(selected.item));
        onClose();
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (lastIndex < 0) return;
      if (e.shiftKey) {
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else {
        setSelectedIndex(prev => Math.min(prev + 1, lastIndex));
      }
      return;
    }
  };

  // Keep the registered listener pointing at the latest closure.
  keyHandlerRef.current = handleGlobalKeyDown;
  const stableKeyDown = useCallback((e) => keyHandlerRef.current?.(e), []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      document.addEventListener('keydown', stableKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', stableKeyDown);
    };
  }, [isOpen, stableKeyDown]);

  useEffect(() => {
    if (listRef.current && flatItems[selectedIndex]) {
      const element = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (element) {
        element.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, flatItems]);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setSelectedIndex(0);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const iconMap = {
    employees: '👨‍💼',
    departments: '🏢',
    positions: '💼'
  };

  const activeDescendant = flatItems[selectedIndex] ? `gs-option-${selectedIndex}` : undefined;

  return createPortal(
    <div className="global-search-overlay" onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Global Search">
      <div className="global-search-modal" ref={listRef} onClick={e => e.stopPropagation()}>
        <header className="global-search-header">
          <div className="global-search-input-wrapper">
            <svg className="global-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="global-search-input"
              placeholder="Search employees, departments, positions... (Ctrl+K)"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={sections.length > 0}
              aria-controls="gs-listbox"
              aria-activedescendant={activeDescendant}
              autoComplete="off"
              spellCheck="false"
            />
            <kbd className="global-search-shortcut">Ctrl K</kbd>
          </div>
        </header>

        <div className="global-search-sections" id="gs-listbox" role="listbox" aria-label="Search results">
          {sections.length === 0 ? (
            <div className="global-search-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <p>{query ? `No results found for "${query}"` : 'Start typing to search'}</p>
              <span>Try a different search term</span>
            </div>
          ) : sections.map((section, si) => (
            <section key={section.key} className="global-search-section" aria-label={section.label}>
              <header className="global-search-section-header">
                <span className="global-search-section-icon" aria-hidden="true">{iconMap[section.key] || '📦'}</span>
                <span className="global-search-section-label">{section.label}</span>
                <span className="global-search-section-count">{section.items.length}</span>
              </header>
              <ul className="global-search-results" role="presentation">
                {section.items.map((item, ii) => {
                  const flatIndex = flatItems.findIndex(f => f.sectionIndex === si && f.itemIndex === ii);
                  const isSelected = flatIndex === selectedIndex;
                  return (
                    <li
                      key={`${section.key}-${item.id}`}
                      id={`gs-option-${flatIndex}`}
                      data-index={flatIndex}
                      className={`global-search-result ${isSelected ? 'global-search-result--selected' : ''}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => { onSelect?.(section.getAction(item)); onClose(); }}
                      onMouseEnter={() => setSelectedIndex(flatIndex)}
                    >
                      <span className="global-search-result-main">{section.getLabel(item)}</span>
                      {section.getSub(item) && <span className="global-search-result-sub">{section.getSub(item)}</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <footer className="global-search-footer">
          <kbd className="global-search-help"><kbd>↑</kbd><kbd>↓</kbd> Navigate</kbd>
          <kbd className="global-search-help"><kbd>Enter</kbd> Select</kbd>
          <kbd className="global-search-help"><kbd>Esc</kbd> Close</kbd>
        </footer>
      </div>
    </div>,
    document.body
  );
}
