import { useRef, useEffect } from 'react';
import './Tabs.css';

export default function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = 'line',
  size = 'md',
  fullWidth = false,
  className = '',
  'aria-label': ariaLabel,
  ...props
}) {
  const tabListRef = useRef(null);
  const activeTabRef = useRef(null);

  useEffect(() => {
    if (activeTabRef.current && tabListRef.current) {
      const rect = activeTabRef.current.getBoundingClientRect();
      const listRect = tabListRef.current.getBoundingClientRect();
      tabListRef.current.scrollLeft = rect.left - listRect.left - (listRect.width - rect.width) / 2;
    }
  }, [activeTab]);

  const handleKeyDown = (e, index) => {
    let newIndex = index;
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        newIndex = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    onChange?.(tabs[newIndex].key);
  };

  return (
    <div className={`tabs tabs--${variant} tabs--${size} ${fullWidth ? 'tabs--full' : ''} ${className}`} {...props}>
      <div
        ref={tabListRef}
        role="tablist"
        aria-label={ariaLabel}
        className="tabs__list"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              ref={isActive ? activeTabRef : undefined}
              key={tab.key}
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.key}`}
              tabIndex={isActive ? 0 : -1}
              className={`tabs__tab ${isActive ? 'tabs__tab--active' : ''} ${tab.disabled ? 'tabs__tab--disabled' : ''}`}
              onClick={() => !tab.disabled && onChange?.(tab.key)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              disabled={tab.disabled}
              type="button"
            >
              {tab.icon && <span className="tabs__tab-icon" aria-hidden="true">{tab.icon}</span>}
              <span className="tabs__tab-label">{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="tabs__tab-badge">{tab.badge}</span>
              )}
            </button>
          );
        })}
        {variant === 'line' && (
          <span className="tabs__indicator" style={{ '--active-index': tabs.findIndex(t => t.key === activeTab) }} />
        )}
      </div>
      {tabs.map((tab) => (
        <div
          key={`panel-${tab.key}`}
          role="tabpanel"
          id={`panel-${tab.key}`}
          aria-labelledby={`tab-${tab.key}`}
          hidden={tab.key !== activeTab}
          className="tabs__panel"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}

export function TabList({ children, ...props }) {
  return <div role="tablist" {...props}>{children}</div>;
}

export function Tab({ children, key: tabKey, disabled, icon, badge, ...props }) {
  return <button role="tab" {...props}>{children}</button>;
}

export function TabPanel({ children, hidden, ...props }) {
  return <div role="tabpanel" hidden={hidden} {...props}>{children}</div>;
}