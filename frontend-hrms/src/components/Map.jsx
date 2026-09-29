import { useEffect, useRef } from 'react';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function Map({ latitude, longitude, zoom = 15, height = 250, markerTitle = '' }) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    if (instanceRef.current) instanceRef.current.remove();

    const map = L.map(mapRef.current).setView([lat, lng], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    L.marker([lat, lng]).addTo(map).bindPopup(markerTitle || `${lat}, ${lng}`).openPopup();
    instanceRef.current = map;

    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => { clearTimeout(timer); map.remove(); instanceRef.current = null; };
  }, [latitude, longitude, zoom, markerTitle]);

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return (
      <div style={{ height, background: 'var(--muted)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-fg)', fontSize: 13 }}>
        No location data available
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div ref={mapRef} style={{ height, width: '100%' }} />
    </div>
  );
}
