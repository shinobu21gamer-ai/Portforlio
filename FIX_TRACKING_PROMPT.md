# LIVE RIDER TRACKING SYSTEM — FIX & BUILD PROMPT

You are fixing the **Live Rider Tracking** feature in a MiniMart POS + HRMS system. The feature lets users track delivery riders in real-time on a map, see delivery status (In Shop → In Transit → Delivered), and auto-receive purchases when the rider arrives.

**The system is almost entirely broken and needs to be rebuilt.** Here is exactly what to fix and build.

---

## ARCHITECTURE

```
Backend (Express + Sequelize + SQLite)
├── src/models/Delivery.js          # Delivery record (orderType, orderId, status, destinationLat/Lng)
├── src/models/RiderLocation.js     # Rider GPS coordinates (deliveryId, riderId, lat, lng)
├── src/services/tracking.service.js # Business logic (create delivery, update location, auto-receive)
├── src/routes/tracking.routes.js   # API endpoints (POST /update, GET /delivery/:id)
├── src/routes/index.js             # Route registration (BROKEN ORDER)
└── src/server.js                   # Socket.io setup (join-delivery room)

Frontend (React + Vite + Leaflet)
├── src/pages/LiveTracking.jsx      # Map component (BROKEN — status hardcoded)
├── src/pages/Purchases.jsx         # Purchase management (NO tracking UI)
├── src/pages/Suppliers.jsx         # Suppliers (tracking placed OUTSIDE component)
├── src/hooks/useApi.js             # API hooks (NO tracking hooks)
└── src/App.jsx                     # Routing (NO tracking route)
```

---

## CRITICAL BUGS TO FIX (Priority Order)

### BUG 1: Tracking routes are BLOCKED by 404 catch-all
**File:** `src/routes/index.js`
**Problem:** Line 56 registers a 404 catch-all BEFORE line 60 registers tracking routes. All tracking requests return 404.
**Fix:** Move the tracking route registration ABOVE the 404 catch-all:
```js
// Register tracking BEFORE the 404 handler
router.use(`${apiPrefix}/tracking`, require('./tracking.routes'));

// THEN the 404 catch-all
router.use(`${apiPrefix}/*`, (req, res) => {
  res.status(404).json({ success: false, message: `API route not found: ${req.method} ${req.originalUrl}` });
});
```

### BUG 2: tracking.service.js references wrong PettyCash model
**File:** `src/services/tracking.service.js`
**Problem:** Line 1 imports `PettyCash` but the actual models are `PettyCashFund` and `PettyCashTransaction`. Line 34 uses `balance` column but the model uses `currentBalance`.
**Fix:** Change the import and column reference:
```js
const { Delivery, RiderLocation, sequelize, Purchase, PettyCashFund } = require('../models');
// ...
await PettyCashFund.update({ currentBalance: sequelize.literal(`current_balance - ${total}`) }, { where: { id: 1 } });
```

### BUG 3: Auto-receive logic runs at wrong distance
**File:** `src/services/tracking.service.js`
**Problem:** Lines 30-36 (purchase auto-receive + petty cash) execute regardless of distance. Should ONLY run when `dist < 100`.
**Fix:** The purchase receive and petty cash deduction block must be inside the `dist < 100` block:
```js
if (dist < 100) {
  if (delivery.status !== 'delivered') {
    await delivery.update({ status: 'delivered' });
    // Auto-receive purchase + deduct petty cash ONLY here
    const purchase = await Purchase.findByPk(delivery.orderId);
    if (purchase && purchase.status !== 'received') {
      await purchaseService.receive(...);
      const total = parseFloat(purchase.total) || 0;
      await PettyCashFund.update({ currentBalance: sequelize.literal(`current_balance - ${total}`) }, { where: { id: 1 } });
    }
  }
} else if (dist < 5000) {
  if (delivery.status === 'pending') await delivery.update({ status: 'in_transit' });
}
```

### BUG 4: LiveTracking.jsx has hardcoded status that never updates
**File:** `frontend/src/pages/LiveTracking.jsx`
**Problem:** Status state is initialized to 'In Supplier / Shop' and never updated by the socket event. Default coordinates are Jakarta, Indonesia.
**Fix:**
```jsx
import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import io from 'socket.io-client';

const PHILIPPINES_CENTER = [12.8797, 121.7740]; // Center of Philippines

const statusColors = {
  'pending': { label: 'In Supplier / Shop', color: '#eab308', bg: '#fefce8' },
  'in_transit': { label: 'In Transit', color: '#3b82f6', bg: '#eff6ff' },
  'delivered': { label: 'Delivered', color: '#22c55e', bg: '#f0fdf4' },
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
  const socketRef = useRef(null);

  useEffect(() => {
    if (!deliveryId) return;
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const socket = io(base, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.emit('join-delivery', deliveryId);
    socket.on('location', (data) => {
      if (data.deliveryId == deliveryId) {
        setPos([data.lat, data.lng]);
        if (data.status) setStatus(data.status);
      }
    });
    socket.on('status', (data) => {
      if (data.deliveryId == deliveryId && data.status) setStatus(data.status);
    });

    // Fetch current location on mount
    fetch(`${base}/api/v1/tracking/delivery/${deliveryId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('hrms_token') || ''}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d.data) {
          setPos([d.data.lat, d.data.lng]);
          if (d.data.status) setStatus(d.data.status);
        }
      })
      .catch(() => {});

    return () => socket.disconnect();
  }, [deliveryId]);

  const info = statusColors[status] || statusColors.pending;

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{ padding: '10px 16px', background: info.bg, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: info.color, display: 'inline-block', boxShadow: `0 0 8px ${info.color}` }} />
        <strong style={{ fontSize: 13, color: info.color }}>{info.label}</strong>
      </div>
      <MapContainer center={PHILIPPINES_CENTER} zoom={13} style={{ height: 350, width: '100%' }} scrollWheelZoom={false}>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {pos && (
          <>
            <FlyToMarker position={pos} />
            <Marker position={pos}>
              <Popup>Rider is here</Popup>
            </Marker>
          </>
        )}
      </MapContainer>
      {!pos && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Waiting for rider location...
        </div>
      )}
    </div>
  );
}
```

### BUG 5: LiveTracking is OUTSIDE the Suppliers component
**File:** `frontend/src/pages/Suppliers.jsx`
**Problem:** Line 442 has `<LiveTracking deliveryId={1} />` AFTER the component's closing `}`. It's dead code.
**Fix:** Remove the stray JSX outside the component. If tracking is needed in Suppliers, add it inside a tab or section within the component's return statement with a dynamic deliveryId.

### BUG 6: No delivery creation when purchase is made
**File:** `src/services/purchase.service.js` or new integration
**Problem:** Creating a purchase order never creates a Delivery record. There's nothing to track.
**Fix:** When a purchase is created with a delivery type, create a Delivery record:
```js
const { Delivery } = require('../models');

// Inside purchase create or a new "ship" action:
async shipPurchase(purchaseId, { destinationLat, destinationLng }) {
  const purchase = await Purchase.findByPk(purchaseId);
  if (!purchase) throw ApiError.notFound('Purchase not found');
  const delivery = await Delivery.create({
    orderType: 'purchase',
    orderId: purchaseId,
    supplierId: purchase.supplierId,
    destinationLat,
    destinationLng,
    status: 'pending',
  });
  return delivery;
}
```

### BUG 7: No tracking API hooks in frontend
**File:** `frontend/src/hooks/useApi.js`
**Problem:** Zero hooks for tracking endpoints.
**Fix:** Add these hooks:
```js
export function useDeliveryTracking(deliveryId) {
  return useQuery({
    queryKey: ['tracking', deliveryId],
    queryFn: async () => {
      const { data } = await api.get(`/tracking/delivery/${deliveryId}`);
      return data.data;
    },
    enabled: !!deliveryId,
    refetchInterval: 5000, // Poll every 5 seconds as fallback
  });
}

export function useShipPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ purchaseId, destinationLat, destinationLng }) => {
      const { data } = await api.post(`/tracking/ship/${purchaseId}`, { destinationLat, destinationLng });
      return data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchases'] }),
  });
}
```

### BUG 8: Duplicate leaflet/react-leaflet in package.json
**File:** `frontend/package.json`
**Problem:** `leaflet` appears on lines 13 AND 19. `react-leaflet` appears as both v4.2.1 AND v5.0.0.
**Fix:** Remove duplicates. Keep only one version of each:
```json
"leaflet": "^1.9.4",
"react-leaflet": "^4.2.1"
```

---

## WHAT TO BUILD IN PURCHASES PAGE

Add a **"Track Delivery"** button in the purchase actions column that:
1. Opens a modal with the LiveTracking map component
2. Shows delivery status badge (In Shop / In Transit / Delivered)
3. Shows the map with rider's live position
4. Auto-closes or shows "Delivered" when rider arrives

### UI Flow in Purchases.jsx:
1. Add a "Track" button in the actions column for purchases with status "ordered" or "in_transit"
2. Clicking it opens a modal with `<LiveTracking deliveryId={purchase.deliveryId} />`
3. If no delivery exists, show a "Start Delivery" button that calls the ship endpoint
4. The modal shows the status bar + map + close button

### Add to DataTable columns:
```
Delivery Status: pending → "📦 In Shop", in_transit → "🚚 In Transit", delivered → "✅ Delivered"
```

### Add "Ship" action button:
- Visible when purchase status is 'ordered' and no delivery exists
- On click: calls shipPurchase endpoint, then opens tracking modal
- Needs supplier branch coordinates (from branch selection or supplier address geocoding)

---

## SOCKET.IO EVENTS

### Server → Client
- `location` — `{ deliveryId, lat, lng, status }` — rider's GPS update
- `status` — `{ deliveryId, status }` — delivery status change

### Client → Server
- `join-delivery` — `{ deliveryId }` or just `deliveryId` — join a delivery room to receive updates

---

## MODEL ASSOCIATIONS TO ADD

### Delivery.js
```js
Delivery.associate = (models) => {
  Delivery.belongsTo(models.Purchase, { foreignKey: 'orderId', as: 'purchase' });
  Delivery.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
};
```

### RiderLocation.js
```js
RiderLocation.associate = (models) => {
  RiderLocation.belongsTo(models.Delivery, { foreignKey: 'deliveryId', as: 'delivery' });
};
```

---

## RIDER SIMULATOR (for testing)

Create a simple endpoint to simulate a rider moving toward the destination:
```js
// POST /api/v1/tracking/simulate/:deliveryId
// Simulates a rider moving from origin to destination over N steps
async simulateRide(req, res) {
  const { deliveryId } = req.params;
  const delivery = await Delivery.findByPk(deliveryId);
  const steps = 10;
  const startLat = parseFloat(req.body.startLat) || 14.5995;
  const startLng = parseFloat(req.body.startLng) || 120.9842;
  const endLat = parseFloat(delivery.destinationLat);
  const endLng = parseFloat(delivery.destinationLng);

  for (let i = 0; i <= steps; i++) {
    const lat = startLat + (endLat - startLat) * (i / steps);
    const lng = startLng + (endLng - startLng) * (i / steps);
    await trackingService.updateLocation({ deliveryId, riderId: 'simulator', lat, lng });
    // Emit via socket
    const io = require('../server').io;
    if (io) io.to(String(deliveryId)).emit('location', { deliveryId, lat, lng, status: delivery.status });
    await new Promise(r => setTimeout(r, 1000));
  }
  res.json({ success: true, message: 'Simulation complete' });
}
```

---

## DELIVERY STATUS FLOW

```
[purchase created] → no delivery yet
[ship button clicked] → Delivery created (status: 'pending')
[rider starts] → status: 'pending' (In Supplier/Shop)
[rider within 5km] → status: 'in_transit' (In Transit)
[rider within 100m] → status: 'delivered' (Delivered)
                      → Purchase auto-received
                      → Petty cash auto-deducted
```

---

## COMPLETE CHECKLIST

### Backend Fixes
- [ ] Move tracking routes above 404 catch-all in `src/routes/index.js`
- [ ] Fix PettyCash → PettyCashFund import in `tracking.service.js`
- [ ] Fix `balance` → `currentBalance` column in `tracking.service.js`
- [ ] Nest auto-receive logic inside `dist < 100` block
- [ ] Add Delivery model associations (belongsTo Purchase, Supplier)
- [ ] Add RiderLocation model association (belongsTo Delivery)
- [ ] Add `shipPurchase` method to tracking or purchase service
- [ ] Add simulate endpoint for testing
- [ ] Validate lat/lng bounds in update endpoint
- [ ] Validate deliveryId exists in update endpoint

### Frontend Fixes
- [ ] Fix LiveTracking.jsx — status updates, Philippines coordinates, polling fallback
- [ ] Remove LiveTracking dead code from Suppliers.jsx line 442
- [ ] Fix duplicate leaflet/react-leaflet in package.json
- [ ] Add tracking API hooks (useDeliveryTracking, useShipPurchase)

### Frontend Builds
- [ ] Add "Track" button to Purchases page action column
- [ ] Add delivery status column to Purchases DataTable
- [ ] Add tracking modal with LiveTracking map component
- [ ] Add "Ship" action for purchases not yet in transit
- [ ] Add delivery status badge (colored dot + label)

### Testing
- [ ] Create a purchase → ship it → verify Delivery record created
- [ ] Open tracking modal → verify map shows with waiting state
- [ ] Simulate rider movement → verify marker moves on map
- [ ] Rider reaches destination → verify status changes to "Delivered"
- [ ] Verify purchase auto-receives on delivery
- [ ] Verify petty cash is deducted on delivery
- [ ] Test with multiple deliveries simultaneously
- [ ] Test socket reconnection on network drop
