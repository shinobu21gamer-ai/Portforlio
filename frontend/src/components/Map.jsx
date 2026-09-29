import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import L from 'leaflet';

// Fix default marker icons in bundled apps
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const branchIcon = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;background:var(--primary,#6366f1);border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

const activeBranchIcon = L.divIcon({
  className: '',
  html: `<div style="width:34px;height:34px;background:#ef4444;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(239,68,68,0.5);display:flex;align-items:center;justify-content:center">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18],
});

const Map = forwardRef(function Map({ latitude, longitude, zoom = 15, height = 250, markerTitle = '', markers, onMarkerClick }, ref) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    flyTo(lat, lng, zoomLevel = 14) {
      if (instanceRef.current) {
        instanceRef.current.flyTo([lat, lng], zoomLevel, { duration: 1.2 });
        // Open popup for matching marker
        if (markersLayerRef.current) {
          markersLayerRef.current.eachLayer(layer => {
            if (layer instanceof L.Marker) {
              const mLatLng = layer.getLatLng();
              if (Math.abs(mLatLng.lat - lat) < 0.0001 && Math.abs(mLatLng.lng - lng) < 0.0001) {
                layer.openPopup();
              }
            }
          });
        }
      }
    },
    fitAll() {
      if (instanceRef.current && markers && markers.length > 0) {
        const bounds = L.latLngBounds();
        markers.forEach(m => {
          const lat = parseFloat(m.latitude);
          const lng = parseFloat(m.longitude);
          if (!isNaN(lat) && !isNaN(lng)) bounds.extend([lat, lng]);
        });
        if (bounds.isValid()) instanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }
    },
    getMap() { return instanceRef.current; },
  }));

  useEffect(() => {
    if (!mapRef.current) return;

    if (instanceRef.current) {
      instanceRef.current.remove();
      instanceRef.current = null;
    }
    markersLayerRef.current = null;

    let map;

    if (markers && markers.length > 0) {
      const validMarkers = markers.filter(m => {
        const lat = parseFloat(m.latitude);
        const lng = parseFloat(m.longitude);
        return !isNaN(lat) && !isNaN(lng);
      });

      if (validMarkers.length === 0) return;

      map = L.map(mapRef.current);
      const layerGroup = L.layerGroup();
      let bounds = null;
      if (validMarkers.length > 1) bounds = L.latLngBounds();
      validMarkers.forEach(m => {
        const lat = parseFloat(m.latitude);
        const lng = parseFloat(m.longitude);
        const marker = L.marker([lat, lng], { icon: branchIcon })
          .bindPopup(`<div style="font-family:Arial,sans-serif;min-width:140px">
            <strong style="font-size:13px">${m.name || 'Branch'}</strong>
            ${m.code ? `<span style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-size:11px;margin-left:4px">${m.code}</span>` : ''}
            ${m.location ? `<div style="font-size:12px;color:#666;margin-top:4px">${m.location}</div>` : ''}
          </div>`);
        if (onMarkerClick) marker.on('click', () => onMarkerClick(m));
        layerGroup.addLayer(marker);
        if (bounds) bounds.extend([lat, lng]);
      });
      layerGroup.addTo(map);
      markersLayerRef.current = layerGroup;
      if (bounds && validMarkers.length > 1) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      } else {
        map.setView([parseFloat(validMarkers[0].latitude), parseFloat(validMarkers[0].longitude)], zoom);
      }
    } else {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      map = L.map(mapRef.current).setView([lat, lng], zoom);
      L.marker([lat, lng]).addTo(map).bindPopup(markerTitle || `${lat}, ${lng}`).openPopup();
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    instanceRef.current = map;

    const timer = setTimeout(() => map.invalidateSize(), 100);

    return () => {
      clearTimeout(timer);
      map.remove();
      instanceRef.current = null;
    };
  }, [latitude, longitude, zoom, markerTitle, markers, onMarkerClick]);

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  const hasMarkers = markers && markers.length > 0;

  if (!hasMarkers && (isNaN(lat) || isNaN(lng))) {
    return (
      <div style={{ height, background: 'var(--muted)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-fg)', fontSize: 13 }}>
        📍 No location data available
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div ref={mapRef} style={{ height: hasMarkers ? (height || 350) : height, width: '100%' }} />
    </div>
  );
});

export default Map;
