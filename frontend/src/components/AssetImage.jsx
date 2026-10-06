import { useState } from 'react';
import { resolveAssetUrl } from '../utils/assets';

/** Render API-hosted images with a caller-provided fallback if they are absent or unavailable. */
export default function AssetImage({ src, alt = '', fallback = null, onError, ...props }) {
  const resolvedSrc = resolveAssetUrl(src);
  const [failedSrc, setFailedSrc] = useState('');

  if (!resolvedSrc || failedSrc === resolvedSrc) return fallback;

  return (
    <img
      {...props}
      src={resolvedSrc}
      alt={alt}
      onError={(event) => {
        setFailedSrc(resolvedSrc);
        onError?.(event);
      }}
    />
  );
}
