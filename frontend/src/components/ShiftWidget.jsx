import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useToast } from './Toast';
import { peso } from '../utils/helpers';
import Button from './Button';
import Modal from './Modal';

/**
 * Register shift control (icon button at the bottom of the POS rail).
 *
 * A green dot marks an open shift; clicking the icon opens a modal with the
 * live cash total (cash sales minus cash refunds, refreshed every 30s) and
 * the open/close actions. Attribution happens server-side: cash sales
 * completed while a shift is open count against it.
 */
export default function ShiftWidget() {
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  const { data: myShift, isLoading } = useQuery({
    queryKey: ['my-shift'],
    queryFn: () => api.get('/shifts/mine/open').then(r => r.data.data),
    refetchInterval: 30000,
    staleTime: 5000,
  });

  const openMut = useMutation({
    mutationFn: (body) => api.post('/shifts', body).then(r => r.data.data),
    onSuccess: (shift) => {
      setOpeningFloat('');
      qc.invalidateQueries({ queryKey: ['my-shift'] });
      toast.success(`Shift opened — float ${peso(shift.openingFloat)}`);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not open shift'),
  });

  const closeMut = useMutation({
    mutationFn: (body) => api.post('/shifts/close', body).then(r => r.data.data),
    onSuccess: (shift) => {
      setOpen(false);
      setCountedCash('');
      setCloseNotes('');
      qc.invalidateQueries({ queryKey: ['my-shift'] });
      const diff = parseFloat(shift.cashDifference) || 0;
      if (Math.abs(diff) < 0.005) toast.success('Shift closed — till balanced');
      else if (diff > 0) toast.success(`Shift closed — over by ${peso(diff)}`);
      else toast.error(`Shift closed — short by ${peso(Math.abs(diff))}`);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not close shift'),
  });

  const expected = myShift
    ? Math.max(0, (parseFloat(myShift.openingFloat) || 0) + (parseFloat(myShift.cashSalesTotal) || 0) - (parseFloat(myShift.voidedTotal) || 0))
    : 0;

  if (isLoading) return null;

  return (
    <>
      <Button
        className="sidebar-btn"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        title={myShift ? `Shift open — expected till ${peso(expected)}` : 'Open shift'}
        style={{ position: 'relative' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
          <line x1="7" y1="15" x2="11" y2="15" />
          <line x1="15" y1="15" x2="17" y2="15" />
        </svg>
        <span className="sidebar-label">Register shift</span>
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 10,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: myShift ? 'var(--success, #16a34a)' : 'var(--fg-tertiary, #94a3b8)',
            boxShadow: myShift ? '0 0 0 2px var(--bg-secondary, rgba(0,0,0,0.1))' : 'none',
          }}
          aria-hidden
        />
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={myShift ? 'Close Shift' : 'Open Shift'}>
        {myShift ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Opened</span><span>{new Date(myShift.openedAt).toLocaleString('en-PH')}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Opening float</span><span>{peso(parseFloat(myShift.openingFloat) || 0)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cash sales</span><span>{peso(parseFloat(myShift.cashSalesTotal) || 0)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Voids</span><span>−{peso(parseFloat(myShift.voidedTotal) || 0)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 6, fontWeight: 700 }}>
                <span>Expected in till</span><span>{peso(expected)}</span>
              </div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Cash counted in the drawer</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={countedCash}
                onChange={e => setCountedCash(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
              {countedCash !== '' && (
                <div style={{ marginTop: 6, fontSize: 'var(--text-sm)', fontWeight: 600, color: Math.abs((parseFloat(countedCash) || 0) - expected) < 0.005 ? 'var(--success, #16a34a)' : 'var(--danger)' }}>
                  Difference: {peso((parseFloat(countedCash) || 0) - expected)}
                </div>
              )}
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Notes (optional)</label>
              <input className="input" value={closeNotes} onChange={e => setCloseNotes(e.target.value)} placeholder="e.g. ₱50 missing — register jam" />
            </div>
            <div className="modal__footer" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={closeMut.isPending || countedCash === '' || Number.isNaN(parseFloat(countedCash)) || parseFloat(countedCash) < 0}
                onClick={() => closeMut.mutate({ countedCash: parseFloat(countedCash), notes: closeNotes })}
              >
                {closeMut.isPending ? 'Closing…' : 'Close Shift'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-secondary)' }}>
              Enter the cash float you are starting the register with (change money, drawer seed, etc.).
              Cash sales you complete while the shift is open will count to your till.
            </p>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Opening float</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={openingFloat}
                onChange={e => setOpeningFloat(e.target.value)}
                placeholder="0.00"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') openMut.mutate({ openingFloat: parseFloat(openingFloat) || 0 }); }}
              />
            </div>
            <div className="modal__footer" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" disabled={openMut.isPending} onClick={() => openMut.mutate({ openingFloat: parseFloat(openingFloat) || 0 })}>
                {openMut.isPending ? 'Opening…' : 'Open Shift'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
