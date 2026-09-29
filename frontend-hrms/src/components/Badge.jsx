import './Badge.css';

export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) {
  const classNames = [
    'badge',
    `badge--${variant}`,
    `badge--${size}`,
    dot && 'badge--dot',
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={classNames} {...props}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      <span className="badge__text">{children}</span>
    </span>
  );
}