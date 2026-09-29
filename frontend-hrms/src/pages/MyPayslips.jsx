import { useState } from 'react';
import { useMyPayslips } from '../hooks/useApi';
import LoadingSkeleton from '../components/LoadingSkeleton';
import Modal from '../components/Modal';

const peso = (v) => v != null ? `₱${Number(v).toLocaleString()}` : '—';

export default function MyPayslips() {
  const [page, setPage] = useState(1);
  const [viewPayslip, setViewPayslip] = useState(null);
  const { data, isLoading, error } = useMyPayslips({ page, limit: 15 });

  const payslips = data?.payslips || [];

  const handlePrint = () => {
    const content = document.getElementById('payslip-printable');
    if (!content) return;
    const w = window.open('', '_blank', 'width=800,height=600');
    w.document.write(`<html><head><title>Payslip</title><style>body{font-family:sans-serif;padding:24px;font-size:13px}table{width:100%;border-collapse:collapse}td,th{padding:6px 8px;border:1px solid #ddd;text-align:left}th{background:#f5f5f5}.text-right{text-align:right}.text-center{text-align:center}h2{margin:0 0 4px}h3{margin:0 0 16px;color:#666}</style></head><body>${content.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  if (error) return <div className="hrms-page"><div className="empty-state">Failed to load payslips</div></div>;

  return (
    <div className="hrms-page">
      <div className="page-header"><h1>My Payslips</h1></div>

      {isLoading ? <LoadingSkeleton rows={5} /> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Period</th><th>Basic</th><th>OT</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Status</th><th>Paid</th><th>Actions</th></tr></thead>
            <tbody>
              {payslips.map(p => (
                <tr key={p.id}>
                  <td>{p.payroll?.period ? `${p.payroll.period}` : '—'}</td>
                  <td>{peso(p.basicSalary)}</td>
                  <td>{peso(p.overtimePay)}</td>
                  <td>{peso(p.grossPay)}</td>
                  <td>{peso(p.totalDeductions)}</td>
                  <td><strong>{peso(p.netPay)}</strong></td>
                  <td><span className={`badge ${p.status === 'paid' ? 'success' : p.status === 'processed' ? 'info' : 'warning'}`}>{p.status}</span></td>
                  <td>{p.paidDate ? new Date(p.paidDate).toLocaleDateString('en-PH') : '—'}</td>
                  <td><button className="btn btn-sm btn-outline" onClick={() => setViewPayslip(p)}>View</button></td>
                </tr>
              ))}
              {!payslips.length && <tr><td colSpan={9} className="empty-state">No payslips yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination?.totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>◀</button>
          <span>Page {page} / {data.pagination.totalPages}</span>
          <button className="btn btn-sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage(p => p + 1)}>▶</button>
        </div>
      )}

      <Modal open={!!viewPayslip} onClose={() => setViewPayslip(null)} title="Payslip Detail">
        {viewPayslip && (
          <>
            <div id="payslip-printable">
              <div className="text-center mb-md">
                <h2>MiniMart Corporation</h2>
                <h3>Payslip</h3>
              </div>
              <table style={{ width: '100%', marginBottom: 16 }}>
                <tbody>
                  <tr><td><strong>Pay Period</strong></td><td>{viewPayslip.payroll?.period ? `${viewPayslip.payroll.period}` : '—'}</td></tr>
                  <tr><td><strong>Status</strong></td><td>{viewPayslip.status}</td></tr>
                  {viewPayslip.paidDate && <tr><td><strong>Paid Date</strong></td><td>{new Date(viewPayslip.paidDate).toLocaleDateString('en-PH')}</td></tr>}
                </tbody>
              </table>
              <table style={{ width: '100%' }}>
                <thead><tr><th>Earnings</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  <tr><td>Basic Salary</td><td className="text-right">{peso(viewPayslip.basicSalary)}</td></tr>
                  <tr><td>Overtime Pay</td><td className="text-right">{peso(viewPayslip.overtimePay)}</td></tr>
                  <tr><td><strong>Gross Salary</strong></td><td className="text-right"><strong>{peso(viewPayslip.grossPay)}</strong></td></tr>
                </tbody>
              </table>
              <table style={{ width: '100%', marginTop: 12 }}>
                <thead><tr><th>Deductions</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  <tr><td>SSS</td><td className="text-right">{peso(viewPayslip.sssDeduction)}</td></tr>
                  <tr><td>PhilHealth</td><td className="text-right">{peso(viewPayslip.philhealthDeduction)}</td></tr>
                  <tr><td>Pag-IBIG</td><td className="text-right">{peso(viewPayslip.pagibigDeduction)}</td></tr>
                  <tr><td>Tax</td><td className="text-right">{peso(viewPayslip.taxDeduction)}</td></tr>
                  <tr><td><strong>Total Deductions</strong></td><td className="text-right"><strong>{peso(viewPayslip.totalDeductions)}</strong></td></tr>
                </tbody>
              </table>
              <div style={{ marginTop: 16, padding: '8px 0', borderTop: '2px solid #333', fontSize: 16 }}>
                <strong>Net Salary: {peso(viewPayslip.netPay)}</strong>
              </div>
            </div>
            <div className="modal-actions mt-md">
              <button className="btn btn-outline" onClick={() => setViewPayslip(null)}>Close</button>
              <button className="btn btn-primary" onClick={handlePrint}>Print / Save PDF</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
