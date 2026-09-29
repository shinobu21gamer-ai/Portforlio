import './Card.css';

export function Card({
  children,
  variant = 'elevated',
  padding = 'md',
  hover = false,
  className = '',
  onClick,
  as: Component = 'div',
  ...props
}) {
  const classNames = [
    'card',
    `card--${variant}`,
    `card--${padding}`,
    hover && 'card--hover',
    onClick && 'card--clickable',
    className
  ].filter(Boolean).join(' ');

  return (
    <Component className={classNames} onClick={onClick} {...props}>
      {children}
    </Component>
  );
}

export function CardHeader({ children, className = '', action, ...props }) {
  return (
    <header className={`card__header ${className}`} {...props}>
      <div className="card__header-content">{children}</div>
      {action && <div className="card__header-action">{action}</div>}
    </header>
  );
}

export function CardBody({ children, className = '', ...props }) {
  return (
    <div className={`card__body ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', divided = true, ...props }) {
  return (
    <footer className={`card__footer ${divided ? 'card__footer--divided' : ''} ${className}`} {...props}>
      {children}
    </footer>
  );
}

export function CardTitle({ children, subtitle, className = '', ...props }) {
  return (
    <div className={`card__title ${className}`} {...props}>
      <h3 className="card__title-text">{children}</h3>
      {subtitle && <p className="card__subtitle">{subtitle}</p>}
    </div>
  );
}