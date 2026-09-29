import { useState } from 'react';
import PosLayout from '../layouts/PosLayout';
import { usePettyCashFunds, usePettyCashSummary, usePettyCashTransactions, useCreatePettyCashFund, usePettyCashDeposit, usePettyCashWithdraw, useClosePettyCashFund } from '../hooks/useApi';
import useAuthStore from '../store/authStore';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import { peso, formatDate } from '../utils/helpers';

export default function PettyCash() {
  const [showCreateFund, setShowCreateFund] = useState(false);
  const [fundName, setFundName] = useState('');
  const [fundDesc, setFundDesc] = useState('');
  const [fundBalance, setFundBalance] = useState('');
  const [selectedFund, setSelectedFund] = useState(null);
  const [depositModal, setDepositModal] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState(false);

  const user = useAuthStore(s => s.user);
  const role = user?.role?.slug;
  const canManage = role === 'admin' || role === 'manager';
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txPage, setTxPage] = useState(1);
  const [closeConfirm, setCloseConfirm] = useState(null);

  const toast = useToast();
  const { data: summaryData, isLoading: summaryLoading } = usePettyCashSummary();
  const { data: fundsData, isLoading: fundsLoading } = usePettyCashFunds();
  const { data: txData, isLoading: txLoading } = usePettyCashTransactions(selectedFund?.id, { page: txPage, limit: 10 });
  const createMut = useCreatePettyCashFund();
  const depositMut = usePettyCashDeposit();
  const withdrawMut = usePettyCashWithdraw();
  const closeMut = useClosePettyCashFund();

  const funds = fundsData?.data?.funds || [];
  const summary = summaryData?.data || {};
  const transactions = txData?.data?.transactions || [];
  const txPagination = txData?.data?.pagination;

  const handleCreateFund = async (e) => {
    e.preventDefault();
    if (!fundName.trim()) { toast.error('Fund name is required'); return; }
    try {
      await createMut.mutateAsync({ name: fundName, description: fundDesc, initialBalance: parseFloat(fundBalance) || 0 });
      toast.success('Fund created');
      setShowCreateFund(false);
      setFundName(''); setFundDesc(''); setFundBalance('');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create fund'); }
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    if (!txAmount || parseFloat(txAmount) <= 0) { toast.error('Enter a valid amount'); return; }
    try {
      const result = await depositMut.mutateAsync({ id: selectedFund.id, data: { amount: parseFloat(txAmount), description: txDesc } });
      toast.success('Deposit successful');
      setDepositModal(false); setTxAmount(''); setTxDesc('');
      if (result?.data) setSelectedFund(result.data);
      else if (selectedFund) setSelectedFund({ ...selectedFund, currentBalance: parseFloat(selectedFund.currentBalance) + parseFloat(txAmount) });
    } catch (err) { toast.error(err.response?.data?.message || 'Deposit failed'); }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (!txAmount || parseFloat(txAmount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (parseFloat(txAmount) > parseFloat(selectedFund.currentBalance)) { toast.error('Insufficient balance'); return; }
    try {
      const result = await withdrawMut.mutateAsync({ id: selectedFund.id, data: { amount: parseFloat(txAmount), description: txDesc } });
      toast.success('Withdrawal successful');
      setWithdrawModal(false); setTxAmount(''); setTxDesc('');
      if (result?.data) setSelectedFund(result.data);
      else if (selectedFund) setSelectedFund({ ...selectedFund, currentBalance: parseFloat(selectedFund.currentBalance) - parseFloat(txAmount) });
    } catch (err) { toast.error(err.response?.data?.message || 'Withdrawal failed'); }
  };

  const handleCloseFund = async (id) => {
    try {
      await closeMut.mutateAsync(id);
      toast.success('Fund closed');
      setCloseConfirm(null);
      if (selectedFund?.id === id) setSelectedFund(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to close fund'); }
  };

  return (
    <PosLayout active="petty-cash">
      <header className="pos-header">
        <div><h1>Petty Cash</h1><div className="sub">Manage cash funds for daily operations</div></div>
        {canManage && <button className="btn btn-primary btn-sm" onClick={() => setShowCreateFund(true)}>+ New Fund</button>}
      </header>

      <div className="dashboard-grid mb-md">
        <div className="stat-card">
          <div className="label">Total Cash Balance</div>
          <div className="value text-success">{peso(summary.totalBalance || 0)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Active Funds</div>
          <div className="value">{summary.fundCount || 0}</div>
        </div>
      </div>

      <div className="pc-layout">
        <div className={`pc-funds-list ${selectedFund ? '' : 'full'}`}>
          <h3 className="font-bold font-size-14 mb-md">Funds</h3>
          {fundsLoading ? <div className="spinner" /> : funds.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="icon">💰</div>
              <p className="mt-sm">No petty cash funds yet</p>
              {canManage && <button className="btn btn-primary btn-sm mt-md" onClick={() => setShowCreateFund(true)}>+ Create Fund</button>}
            </div>
          ) : (
            <div className="flex-col" style={{ gap: 8 }}>
              {funds.map(f => (
                <div
                  key={f.id}
                  onClick={() => { setSelectedFund(f); setTxPage(1); }}
                  className={`pc-fund-card ${selectedFund?.id === f.id ? 'selected' : ''}`}
                >
                  <div className="fund-header">
                    <strong className="fund-name">{f.name}</strong>
                    <span className={`badge ${f.status === 'active' ? 'success' : 'error'}`}>{f.status}</span>
                  </div>
                  <div className="fund-balance" style={{ color: f.status === 'active' ? 'var(--success)' : 'var(--muted-fg)' }}>
                    {peso(f.currentBalance)}
                  </div>
                  {f.description && <div className="fund-desc">{f.description}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedFund && (
          <div className="pc-transactions">
            <div className="pc-tx-header">
              <h3>{selectedFund.name} — Transactions</h3>
              <div className="pc-tx-actions">
                {canManage && <button className="btn btn-success btn-sm" onClick={() => { setDepositModal(true); setTxAmount(''); setTxDesc(''); }}>+ Deposit</button>}
                {canManage && <button className="btn btn-outline btn-sm" onClick={() => { setWithdrawModal(true); setTxAmount(''); setTxDesc(''); }}>- Withdraw</button>}
                {canManage && selectedFund.status === 'active' && (
                  <button className="btn btn-destructive btn-sm" onClick={() => setCloseConfirm(selectedFund)}>Close Fund</button>
                )}
                <button className="btn btn-sm" onClick={() => setSelectedFund(null)}>✕</button>
              </div>
            </div>

            {txLoading ? <div className="spinner" /> : transactions.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}><p>No transactions yet</p></div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Balance After</th><th>Description</th><th>By</th></tr></thead>
                  <tbody>
                    {transactions.map(t => (
                      <tr key={t.id}>
                        <td>{formatDate(t.createdAt)}</td>
                        <td><span className={`badge ${t.type === 'deposit' ? 'success' : 'error'}`}>{t.type}</span></td>
                        <td style={{ color: t.type === 'deposit' ? 'var(--success)' : 'var(--destructive)', fontWeight: 700 }}>
                          {t.type === 'deposit' ? '+' : '-'}{peso(t.amount)}
                        </td>
                        <td>{peso(t.balanceAfter)}</td>
                        <td style={{ maxWidth: 200 }} className="truncate">{t.description || '—'}</td>
                        <td>{t.user ? `${t.user.firstName} ${t.user.lastName}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {txPagination?.totalPages > 1 && (
              <div className="pagination">
                <button className="btn btn-sm" disabled={txPage <= 1} onClick={() => setTxPage(p => p - 1)}>Prev</button>
                <span>Page {txPage} / {txPagination.totalPages}</span>
                <button className="btn btn-sm" disabled={txPage >= txPagination.totalPages} onClick={() => setTxPage(p => p + 1)}>Next</button>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={showCreateFund} onClose={() => setShowCreateFund(false)} title="New Petty Cash Fund">
        <form onSubmit={handleCreateFund}>
          <div className="field"><label>Fund Name</label><input className="input-block" value={fundName} onChange={e => setFundName(e.target.value)} placeholder="e.g. Main Cash Register" required /></div>
          <div className="field"><label>Description</label><textarea className="input-block" value={fundDesc} onChange={e => setFundDesc(e.target.value)} rows={2} placeholder="Optional description..." /></div>
          <div className="field"><label>Initial Balance</label><input className="input-block" type="number" step="0.01" min="0" value={fundBalance} onChange={e => setFundBalance(e.target.value)} placeholder="0.00" /></div>
          <div className="form-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowCreateFund(false)}>✕ Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={createMut.isPending}>{createMut.isPending && <span className="btn-spinner" />}{createMut.isPending ? 'Creating...' : '+ Create'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={depositModal} onClose={() => setDepositModal(false)} title={`Deposit to ${selectedFund?.name || ''}`}>
        <form onSubmit={handleDeposit}>
          <div className="pc-balance-info">Current Balance: <strong>{peso(selectedFund?.currentBalance || 0)}</strong></div>
          <div className="field"><label>Amount</label><input className="input-block" type="number" step="0.01" min="0.01" value={txAmount} onChange={e => setTxAmount(e.target.value)} required /></div>
          <div className="field"><label>Description</label><textarea className="input-block" rows={2} value={txDesc} onChange={e => setTxDesc(e.target.value)} placeholder="Optional reason..." /></div>
          <div className="form-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setDepositModal(false)}>✕ Cancel</button>
            <button type="submit" className="btn btn-success btn-sm" disabled={depositMut.isPending}>{depositMut.isPending && <span className="btn-spinner" />}{depositMut.isPending ? 'Processing...' : '+ Deposit'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={withdrawModal} onClose={() => setWithdrawModal(false)} title={`Withdraw from ${selectedFund?.name || ''}`}>
        <form onSubmit={handleWithdraw}>
          <div className="pc-balance-info">Available: <strong>{peso(selectedFund?.currentBalance || 0)}</strong></div>
          <div className="field"><label>Amount</label><input className="input-block" type="number" step="0.01" min="0.01" max={selectedFund?.currentBalance || 0} value={txAmount} onChange={e => setTxAmount(e.target.value)} required /></div>
          <div className="field"><label>Description</label><textarea className="input-block" rows={2} value={txDesc} onChange={e => setTxDesc(e.target.value)} placeholder="Reason for withdrawal..." /></div>
          <div className="form-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setWithdrawModal(false)}>✕ Cancel</button>
            <button type="submit" className="btn btn-destructive btn-sm" disabled={withdrawMut.isPending}>{withdrawMut.isPending && <span className="btn-spinner" />}{withdrawMut.isPending ? 'Processing...' : '- Withdraw'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!closeConfirm} onClose={() => setCloseConfirm(null)} title="Close Fund">
        <p>Are you sure you want to close <strong>{closeConfirm?.name}</strong>? This action cannot be undone.</p>
        <div className="form-actions">
          <button className="btn btn-outline btn-sm" onClick={() => setCloseConfirm(null)}>✕ Cancel</button>
          <button className="btn btn-destructive btn-sm" onClick={() => handleCloseFund(closeConfirm?.id)} disabled={closeMut.isPending}>Close Fund</button>
        </div>
      </Modal>
    </PosLayout>
  );
}
