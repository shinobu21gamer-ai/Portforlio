import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useProducts, useCustomers, useUsers, useSales } from '../hooks/useApi';
import useAuthStore from '../store/authStore';
import { useDebounce } from '../utils/helpers';
import './GlobalSearch.css';

export default function GlobalSearch({ isOpen, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeSection, setActiveSection] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const keyHandlerRef = useRef(null);
  const roleSlug = useAuthStore(s => s.user?.role?.slug || (typeof s.user?.role === 'string' ? s.user.role : null));
  const canViewUsers = roleSlug === 'admin';

  const debouncedQuery = useDebounce(query, 250);

  // Closed palette used to fire these on every POS load. Cashiers have no
  // users.view, so GET /users 403'd (and retried) before the register painted.
  const searchParams = { search: debouncedQuery || undefined, limit: 5 };
  const { data: productsData } = useProducts(searchParams, { enabled: isOpen });
  const { data: customersData } = useCustomers(searchParams, { enabled: isOpen });
  const { data: employeesData } = useUsers(searchParams, { enabled: isOpen && canViewUsers });
  const { data: salesData } = useSales(searchParams, { enabled: isOpen });

  const products = productsData?.data?.products || productsData?.products || [];
  const customers = customersData?.data?.customers || customersData?.customers || [];
  const employees = employeesData?.data?.employees || employeesData?.employees || [];
  const sales = salesData?.data?.sales || salesData?.sales || [];

  // Each section navigates to a management screen, and those screens are
  // role-gated (ProtectedRoute bounces an unauthorised role to "/"). Offering a
  // result the user cannot open looked like a dead click, so the palette now
  // mirrors the route guards.
  const SECTIONS_BY_ROLE = ['admin', 'manager', 'inventory_staff'];
  const canViewProducts = SECTIONS_BY_ROLE.includes(roleSlug);
  const canViewCustomers = roleSlug === 'admin' || roleSlug === 'manager';

  const sections = useMemo(() => [
    { key: 'products', label: 'Products', enabled: canViewProducts, icon: '📦', items: products, getLabel: p => p.name, getSub: p => p.sku ? `#${p.sku}` : null, getAction: p => ({ type: 'product', id: p.id, query: p.name }) },
    { key: 'customers', label: 'Customers', enabled: canViewCustomers, icon: '👤', items: customers, getLabel: c => `${c.firstName} ${c.lastName}`, getSub: c => c.email, getAction: c => ({ type: 'customer', id: c.id, query: `${c.firstName} ${c.lastName}`.trim() }) },
    { key: 'employees', label: 'Employees', enabled: canViewUsers, icon: '👨‍💼', items: employees, getLabel: e => `${e.firstName} ${e.lastName}`, getSub: e => e.email || e.role?.name, getAction: e => ({ type: 'employee', id: e.id, query: `${e.firstName} ${e.lastName}`.trim() }) },
    { key: 'sales', label: 'Sales', enabled: canViewCustomers, icon: '🧾', items: sales, getLabel: s => s.invoiceNo, getSub: s => s.customerName ? `${s.customerName} • ${s.total}` : String(s.total), getAction: s => ({ type: 'sale', id: s.id, query: s.invoiceNo || '' }) }
  ].filter(s => s.enabled !== false && s.items.length > 0), [products, customers, employees, sales, canViewProducts, canViewCustomers, canViewUsers]);

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

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      moveToSection(e.key === 'ArrowRight' ? 1 : -1);
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

  const moveToSection = (delta) => {
    if (sections.length <= 1) return;
    const current = flatItems[selectedIndex];
    const currentSection = current ? current.sectionIndex : 0;
    const nextSection = (currentSection + delta + sections.length) % sections.length;
    const firstFlat = flatItems.findIndex(f => f.sectionIndex === nextSection);
    setActiveSection(nextSection);
    if (firstFlat >= 0) setSelectedIndex(firstFlat);
  };

  // Keep the registered listener pointing at the latest closure.
  keyHandlerRef.current = handleGlobalKeyDown;
  const stableKeyDown = useCallback((e) => keyHandlerRef.current?.(e), []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setQuery('');
      setSelectedIndex(0);
      setActiveSection(0);
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
    products: '📦',
    customers: '👤',
    employees: '👨‍💼',
    sales: '🧾'
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
              placeholder="Search products, customers, employees, sales... (Ctrl+K)"
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
