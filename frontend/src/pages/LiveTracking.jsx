import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import io from 'socket.io-client';

const PHILIPPINES_CENTER = [14.5995, 120.9842];

const STATUS_MAP = {
  pending: { label: 'In Supplier / Shop', color: '#eab308', bg: '#fefce8', icon: '📦' },
  in_transit: { label: 'In Transit', color: '#3b82f6', bg: '#eff6ff', icon: '🚚' },
  delivered: { label: 'Delivered', color: '#22c55e', bg: '#f0fdf4', icon: '✅' },
  cancelled: { label: 'Cancelled', color: '#ef4444', bg: '#fef2f2', icon: '❌' },
};

function FlyToMarker({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 16, { duration: 1.5 });
  }, [position, map]);
  return null;
}

export default function LiveTracking({ deliveryId }) {
  const [pos, setPos] = useState(null);
  const [status, setStatus] = useState('pending');
  const [dest, setDest] = useState(null);
  const [demo, setDemo] = useState(false);
  const socketRef = useRef(null);
  const simRef = useRef(false);
  const demoIntervalRef = useRef(null);

  const stopDemo = () => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    setDemo(false);
  };

  useEffect(() => {
    if (!deliveryId) return;

    const base = (() => {
      const u = import.meta.env.VITE_API_URL;
      if (u && /^https?:/.test(u)) return new URL(u).origin;
      return window.location.origin;
    })();
    const token = sessionStorage.getItem('token')
      || (() => { try { return JSON.parse(localStorage.getItem('hrms_auth') || '{}').token } catch(e) { return null } })() || '';
    let cancelled = false;

    fetch(`${base}/api/v1/tracking/delivery/${deliveryId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (cancelled || !d.data) return;
        stopDemo();
        simRef.current = true;
        const del = d.data.delivery;
        if (d.data.location) {
          setPos([parseFloat(d.data.location.lat), parseFloat(d.data.location.lng)]);
        }
        if (del) {
          setStatus(del.status || 'pending');
          if (del.destinationLat && del.destinationLng) {
            setDest([parseFloat(del.destinationLat), parseFloat(del.destinationLng)]);
          }
          if (del.status === 'delivered' || del.status === 'cancelled') {
            simRef.current = true;
          }
        }
      })
      .catch(() => {});

    const socket = io(base, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.emit('join-delivery', deliveryId);

    socket.on('location', (data) => {
      if (data.deliveryId == deliveryId) {
        stopDemo();
        simRef.current = true;
        setPos([data.lat, data.lng]);
        if (data.status) setStatus(data.status);
      }
    });

    socket.on('status', (data) => {
      if (data.deliveryId == deliveryId && data.status) {
        stopDemo();
        setStatus(data.status);
        if (data.status === 'delivered' || data.status === 'cancelled') simRef.current = true;
      }
    });

    return () => { cancelled = true; socket.disconnect(); };
  }, [deliveryId]);

  useEffect(() => {
    let timer;
    const startSim = () => {
      simRef.current = true;
      setDemo(true);
      setStatus('in_transit');
      const start = PHILIPPINES_CENTER;
      const end = [14.6015, 121.0220];
      const steps = 40;
      let step = 0;
      setPos(start);
      demoIntervalRef.current = setInterval(() => {
        step++;
        if (step >= steps) {
          clearInterval(demoIntervalRef.current);
          demoIntervalRef.current = null;
          setPos(end);
          setStatus('delivered');
          return;
        }
        const t = step / steps;
        setPos([
          start[0] + (end[0] - start[0]) * t + (Math.random() - 0.5) * 0.001,
          start[1] + (end[1] - start[1]) * t + (Math.random() - 0.5) * 0.001,
        ]);
      }, 800);
    };
    timer = setTimeout(() => {
      if (simRef.current) return;
      startSim();
    }, 1500);
    return () => {
      clearTimeout(timer);
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    };
  }, []);

  const info = STATUS_MAP[status] || STATUS_MAP.pending;

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{
        padding: '12px 16px',
        background: info.bg,
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>{info.icon}</span>
        <div>
          <div style={{ fontWeight: 600, color: info.color, fontSize: 14 }}>{info.label}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {pos ? `${pos[0].toFixed(6)}, ${pos[1].toFixed(6)}` : 'Waiting for rider...'}
          </div>
        </div>
        {status !== 'delivered' && (
          <div style={{ marginLeft: 'auto' }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: info.color,
              display: 'inline-block', animation: 'pulse 1.5s infinite',
            }} />
          </div>
        )}
      </div>

      {demo && (
        <div style={{
          padding: '8px 16px',
          background: '#fff7ed',
          borderBottom: '1px solid #fdba74',
          color: '#c2410c',
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>⚠️</span>
          <span>SIMULATED DEMO — no live rider data. This path is auto-generated for preview.</span>
        </div>
      )}

      <MapContainer
        center={pos || PHILIPPINES_CENTER}
        zoom={pos ? 16 : 13}
        style={{ height: 350, width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {pos && (
          <>
            <FlyToMarker position={pos} />
            <Marker
              position={pos}
              icon={L.divIcon({
                className: '',
                html: `<div style="width:32px;height:32px;background:#6366f1;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg></div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 32],
              })}
            >
              <Popup><strong>Rider Location</strong><br />{pos[0].toFixed(6)}, {pos[1].toFixed(6)}</Popup>
            </Marker>
          </>
        )}
        {dest && (
          <Marker
            position={dest}
            icon={L.divIcon({
              className: '',
              html: `<div style="width:28px;height:28px;background:#ef4444;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg></div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 28],
            })}
          >
            <Popup><strong>Destination</strong></Popup>
          </Marker>
        )}
      </MapContainer>

      {!pos && (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🛰️</div>
          Waiting for rider location updates...
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
}
