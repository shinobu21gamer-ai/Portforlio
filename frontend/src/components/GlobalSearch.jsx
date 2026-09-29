import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useProducts, useCustomers, useUsers, useSales } from '../hooks/useApi';
import Button from './Button';
import './GlobalSearch.css';

export default function GlobalSearch({ isOpen, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeSection, setActiveSection] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const { data: productsData } = useProducts({ search: query || undefined, limit: 5 });
  const { data: customersData } = useCustomers({ search: query || undefined, limit: 5 });
  const { data: employeesData } = useUsers({ search: query || undefined, limit: 5 });
  const { data: salesData } = useSales({ search: query || undefined, limit: 5 });

  const products = productsData?.data?.products || productsData?.products || [];
  const customers = customersData?.data?.customers || customersData?.customers || [];
  const employees = employeesData?.data?.employees || employeesData?.employees || [];
  const sales = salesData?.data?.sales || salesData?.sales || [];

  const sections = useMemo(() => [
    { key: 'products', label: 'Products', icon: '📦', items: products, getLabel: p => p.name, getSub: p => p.sku ? `#${p.sku}` : null, getAction: p => ({ type: 'product', id: p.id }) },
    { key: 'customers', label: 'Customers', icon: '👤', items: customers, getLabel: c => `${c.firstName} ${c.lastName}`, getSub: c => c.email, getAction: c => ({ type: 'customer', id: c.id }) },
    { key: 'employees', label: 'Employees', icon: '👨‍💼', items: employees, getLabel: e => `${e.firstName} ${e.lastName}`, getSub: e => e.email || e.role?.name, getAction: e => ({ type: 'employee', id: e.id }) },
    { key: 'sales', label: 'Sales', icon: '🧾', items: sales, getLabel: s => s.invoiceNo, getSub: s => s.customerName ? `${s.customerName} • ${s.total}` : String(s.total), getAction: s => ({ type: 'sale', id: s.id }) }
  ].filter(s => s.items.length > 0), [products, customers, employees, sales]);

  const flatItems = useMemo(() => sections.flatMap((section, si) =>
    section.items.map((item, ii) => ({ sectionIndex: si, itemIndex: ii, section, item }))
  ), [sections]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setQuery('');
      setSelectedIndex(0);
      setActiveSection(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      document.addEventListener('keydown', handleGlobalKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isOpen]);

  const handleGlobalKeyDown = useCallback((e) => {
    if (!isOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, flatItems.length - 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (sections.length > 1) {
        setActiveSection(prev => (prev + 1) % sections.length);
        setSelectedIndex(sections[activeSection === sections.length - 1 ? 0 : activeSection + 1].items.length > 0 ?
          flatItems.findIndex(f => f.sectionIndex === ((activeSection + 1) % sections.length)) : 0);
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (sections.length > 1) {
        setActiveSection(prev => (prev - 1 + sections.length) % sections.length);
        setSelectedIndex(sections[activeSection === 0 ? sections.length - 1 : activeSection - 1].items.length > 0 ?
          flatItems.findIndex(f => f.sectionIndex === (activeSection === 0 ? sections.length - 1 : activeSection - 1)) : 0);
      }
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
      if (e.shiftKey) {
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else {
        setSelectedIndex(prev => Math.min(prev + 1, flatItems.length - 1));
      }
      return;
    }
  }, [isOpen, flatItems, sections, selectedIndex, activeSection, onClose, onSelect]);

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
    products: '📦',
    customers: '👤',
    employees: '👨‍💼',
    sales: '🧾'
  };

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
              placeholder="Search products, customers, employees, sales... (⌘K)"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              autoComplete="off"
              spellCheck="false"
            />
            <kbd className="global-search-shortcut">⌘K</kbd>
          </div>
        </header>

        <div className="global-search-sections" role="listbox" aria-label="Search results">
          {sections.length === 0 ? (
            <div className="global-search-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <p>No results found for "{query}"</p>
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