import { useState } from 'react';
import ErrorState from '../components/ErrorState';
import PosLayout from '../layouts/PosLayout';
import { useNotifications, useMarkNotificationsRead, useMarkAllNotificationsRead, useDeleteNotification } from '../hooks/useApi';
import { useToast } from '../components/Toast';
import Pagination from '../components/Pagination';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { formatDateTime } from '../utils/helpers';

const TYPE_BADGES = {
  low_stock: { label: 'Low Stock', cls: 'error' },
  expiring_product: { label: 'Expiring', cls: 'warning' },
  new_purchase: { label: 'Purchase', cls: 'info' },
  new_sale: { label: 'Sale', cls: 'success' },
  payment_received: { label: 'Payment', cls: 'success' },
  system: { label: 'System', cls: 'info' },
  stock_adjustment: { label: 'Stock Adj.', cls: 'info' },
  refund: { label: 'Refund', cls: 'error' },
};

export default function Notifications() {
  const [page, setPage] = useState(1);
  const [showRead, setShowRead] = useState(false);
  const toast = useToast();
  const { data, isLoading, isError, error, refetch } = useNotifications({ page, limit: 20, isRead: showRead ? undefined : 'false' });
  const markReadMut = useMarkNotificationsRead();
  const markAllMut = useMarkAllNotificationsRead();
  const deleteMut = useDeleteNotification();

  const notifications = data?.notifications || data?.data?.notifications || [];
  const pagination = data?.pagination || data?.data?.pagination;

  const handleMarkAllRead = async () => {
    try { await markAllMut.mutateAsync(); toast.success('All marked as read'); }
    catch { toast.error('Failed to mark as read'); }
  };

  const handleMarkRead = async (id) => {
    try { await markReadMut.mutateAsync([id]); toast.success('Marked as read'); }
    catch { toast.error('Failed to mark as read'); }
  };

  const handleDelete = async (id) => {
    try { await deleteMut.mutateAsync(id); toast.success('Notification deleted'); }
    catch { toast.error('Failed to delete'); }
  };

  if (isError) {
    return (
      <div className="page-error-wrap">
        <ErrorState message={error?.response?.data?.message || 'Something went wrong while loading this data.'} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <PosLayout active="notifications">
      <header className="pos-header">
        <div><h1>Notifications</h1><div className="sub">System alerts and activity</div></div>
        <div className="flex-gap-sm items-center">
          <button className={`btn btn-sm ${showRead ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setShowRead(!showRead); setPage(1); }}>
            {showRead ? 'Showing All' : 'Unread Only'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleMarkAllRead} disabled={markAllMut.isPending}>
            {markAllMut.isPending && <span className="btn-spinner" />}{markAllMut.isPending ? 'Marking...' : 'Mark all as read'}
          </button>
        </div>
      </header>

      {isLoading ? <LoadingSkeleton rows={10} cols={3} /> : (
        <>
          {notifications.length === 0 ? (
            <div className="empty-state">
              <div className="icon">🔔</div>
              <h3>No notifications</h3>
              <p className="text-muted mt-sm">You're all caught up!</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Status</th><th>Type</th><th>Title</th><th>Message</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {notifications.map(n => {
                    const badge = TYPE_BADGES[n.type] || { label: n.type, cls: 'info' };
                    return (
                      <tr key={n.id} className={n.isRead ? 'text-muted' : ''}>
                        <td>
                          {!n.isRead ? (
                            <button className="btn btn-sm p-sm" onClick={() => handleMarkRead(n.id)} title="Mark as read" style={{ fontSize: 16 }}>🔵</button>
                          ) : (
                            <span className="p-sm" style={{ fontSize: 16 }}>⚪</span>
                          )}
                        </td>
                        <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                        <td><strong>{n.title}</strong></td>
                        <td className="w-250 truncate">{n.message}</td>
                        <td>{formatDateTime(n.createdAt)}</td>
                        <td>
                          <button className="btn btn-destructive btn-sm" onClick={() => handleDelete(n.id)} disabled={deleteMut.isPending}>×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </PosLayout>
  );
}
