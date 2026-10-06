import { useState } from 'react';
import { resolveAssetUrl } from '../utils/assets';
import './Avatar.css';

export default function Avatar({
  src,
  alt,
  name,
  size = 'md',
  shape = 'circle',
  status,
  statusPosition = 'bottom-right',
  className = '',
  ...props
}) {
  const imageSrc = resolveAssetUrl(src);
  const [failedSrc, setFailedSrc] = useState('');
  const showImage = imageSrc && failedSrc !== imageSrc;

  const classNames = [
    'avatar',
    `avatar--${size}`,
    `avatar--${shape}`,
    status && `avatar--has-status`,
    status && `avatar--status-${statusPosition}`,
    className
  ].filter(Boolean).join(' ');

  const statusColors = {
    online: 'var(--success)',
    offline: 'var(--fg-tertiary)',
    busy: 'var(--danger)',
    away: 'var(--warning)',
    pending: 'var(--info)'
  };

  return (
    <div className={classNames} {...props}>
      {showImage ? (
        <img
          src={imageSrc}
          alt={alt || name || 'Avatar'}
          className="avatar__image"
          loading="lazy"
          onError={() => setFailedSrc(imageSrc)}
        />
      ) : name ? (
        <span className="avatar__initials" aria-hidden="true">
          {name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)}
        </span>
      ) : (
        <svg className="avatar__fallback" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )}
      {status && (
        <span
          className="avatar__status"
          style={{ backgroundColor: statusColors[status] || status }}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
}

export function AvatarGroup({
  children,
  max = 5,
  size = 'md',
  className = '',
  ...props
}) {
  const avatars = Array.isArray(children) ? children : [children];
  const visible = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div className={`avatar-group ${className}`} {...props}>
      {visible.map((avatar, index) => (
        <span key={index} className="avatar-group__item" style={{ zIndex: visible.length - index }}>
          {typeof avatar === 'string' ? (
            <Avatar name={avatar} size={size} />
          ) : (
            avatar
          )}
        </span>
      ))}
      {remaining > 0 && (
        <span className={`avatar-group__more avatar--${size}`}>
          +{remaining}
        </span>
      )}
    </div>
  );
}