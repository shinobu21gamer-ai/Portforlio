/**
 * The one MiniMart lockup used everywhere a product identity appears:
 * the POS rail, the HRMS rail, both login screens and both public footers.
 *
 * `frontend/src/components/BrandMark.jsx` and
 * `frontend-hrms/src/components/BrandMark.jsx` must stay identical — the two
 * apps are separate builds, but they are one product.
 */
export default function BrandMark({ size = 'md', name = 'MiniMart', caption, showCopy = true, className = '' }) {
  const tile = size === 'lg' ? 'brand-mark--lg' : size === 'sm' ? 'brand-mark--sm' : '';
  return (
    <div className={`brand-lockup ${className}`.trim()}>
      <span className={`brand-mark ${tile}`.trim()} aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none" focusable="false">
          <path
            d="M8.5 9h2.3l1.7 9h8.4l1.9-6.6H11.6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="14" cy="23.2" r="1.7" fill="currentColor" />
          <circle cx="20.8" cy="23.2" r="1.7" fill="currentColor" />
        </svg>
      </span>
      {showCopy && (
        <span className="brand-lockup-copy">
          <strong>{name}</strong>
          <span>{caption}</span>
        </span>
      )}
    </div>
  );
}
