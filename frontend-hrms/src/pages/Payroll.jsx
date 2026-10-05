import { useState } from 'react';
import SortableHeader from '../components/SortableHeader';
import { usePayrolls, usePayroll, useGeneratePayroll, useProcessPayroll, usePayPayroll, useEmployees, useDepartments } from '../hooks/useApi';

import LoadingSkeleton from '../components/LoadingSkeleton';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { peso, formatDate } from '../utils/helpers';
import { useIsAdmin } from '../hooks/useRole';
import api from '../api/client';
import useConfirm from '../hooks/useConfirm.jsx';
import useDebounce from '../hooks/useDebounce';
import { icons } from '../components/ActionButton';

function PrintPayslip({ payroll, payslip, employee }) {
  if (!payslip || !employee) return null;
  const period = payroll?.period || '';
  return (
    <div className="print-payslip" id="print-area">
      <div className="print-header">
        <h2>EMPLOYEE PAYSLIP</h2>
        <div>Period: {period}</div>
      </div>
      <div className="print-info">
        <div><strong>Employee:</strong> {employee.firstName} {employee.middleName ? employee.middleName + ' ' : ''}{employee.lastName}</div>
        <div><strong>Employee #:</strong> {employee.employeeNo}</div>
        <div><strong>Department:</strong> {employee.department?.name || '—'}</div>
      </div>
      <div className="print-section">
        <h3>Earnings</h3>
        <table className="print-table">
          <tbody>
            <tr><td>Basic Salary</td><td className="right">{peso(payslip.basicSalary)}</td></tr>
            <tr><td>Days Worked: {payslip.daysWorked}</td><td></td></tr>
            {parseFloat(payslip.overtimePay) > 0 && <tr><td>Overtime Pay</td><td className="right">{peso(payslip.overtimePay)}</td></tr>}
            {parseFloat(payslip.bonusPay) > 0 && <tr><td>Bonus</td><td className="right">{peso(payslip.bonusPay)}</td></tr>}
            <tr className="print-total"><td><strong>Gross Pay</strong></td><td className="right"><strong>{peso(payslip.grossPay)}</strong></td></tr>
          </tbody>
        </table>
      </div>
      <div className="print-section">
        <h3>Deductions</h3>
        <table className="print-table">
          <tbody>
            {payslip.absentDays > 0 && <tr><td>Absent ({payslip.absentDays} days)</td><td className="right" style={{color:'var(--danger)'}}>{peso(payslip.absentDeduction)}</td></tr>}
            <tr><td>SSS</td><td className="right">{peso(payslip.sssDeduction)}</td></tr>
            <tr><td>PhilHealth</td><td className="right">{peso(payslip.philhealthDeduction)}</td></tr>
            <tr><td>Pag-IBIG</td><td className="right">{peso(payslip.pagibigDeduction)}</td></tr>
            <tr><td>BIR Withholding Tax</td><td className="right">{peso(payslip.taxDeduction)}</td></tr>
            {parseFloat(payslip.otherDeductions) > 0 && <tr><td>Other</td><td className="right">{peso(payslip.otherDeductions)}</td></tr>}
            <tr className="print-total"><td><strong>Total Deductions</strong></td><td className="right"><strong>{peso(payslip.totalDeductions)}</strong></td></tr>
          </tbody>
        </table>
      </div>
      <div className="print-section print-net">
        <table className="print-table"><tbody>
          <tr className="print-total"><td><strong>NET PAY</strong></td><td className="right"><strong>{peso(payslip.netPay)}</strong></td></tr>
        </tbody></table>
      </div>
      <div className="print-footer">
        <div className="print-sign">_________________________<br/>Authorized Signature</div>
        <div className="print-date">Date: {new Date().toLocaleDateString('en-PH')}</div>
      </div>
    </div>
  );
}

export default function Payroll() {
  const { confirmAction, confirmDialog } = useConfirm();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('DESC');
  const handleSort = (field) => {
    if (sortBy === field) setSortOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'));
    else { setSortBy(field); setSortOrder('DESC'); }
        setPage(1);
  };
  const [genModal, setGenModal] = useState(false);
  const [payslipModal, setPayslipModal] = useState(false);
  const [printModal, setPrintModal] = useState(false);
  const [previewModal, setPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [genForm, setGenForm] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), periodType: 'monthly', half: 1, departmentId: null });
  const { data: departments } = useDepartments();
  const [bonuses, setBonuses] = useState({});
  const toast = useToast();
  const isAdmin = useIsAdmin();

  const { data, isLoading } = usePayrolls({ page, limit: 10, search: debouncedSearch || undefined, sortBy, sortOrder });
  const { data: selectedPayroll } = usePayroll(selectedId);
  const generateMut = useGeneratePayroll();
  const processMut = useProcessPayroll();
  const payMut = usePayPayroll();
  const { data: empData } = useEmployees({ limit: 50, status: 'active' });
  const employees = empData?.employees || [];

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!genForm.month || genForm.month < 1 || genForm.month > 12) { toast.error('Select a valid month (1-12)'); return; }
    if (!genForm.year || genForm.year < 2020 || genForm.year > 2030) { toast.error('Select a valid year (2020-2030)'); return; }
    try {
      const payload = { ...genForm, bonuses };
      if (!payload.departmentId) payload.departmentId = null;
      await generateMut.mutateAsync(payload);
      toast.success('Payroll generated');
      setGenModal(false);
      setBonuses({});
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const setBonus = (empId, value) => {
    const num = parseFloat(value) || 0;
    setBonuses(prev => ({ ...prev, [empId]: num }));
  };

  const totalBonuses = Object.values(bonuses).reduce((a, b) => a + (b || 0), 0);

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await api.post('/payrolls/preview', { ...genForm, bonuses });
      setPreviewData(res.data.data);
      setPreviewModal(true);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Preview failed');
    }
    setPreviewLoading(false);
  };

  const handleExport = async (id) => {
    try {
      const res = await api.get(`/payrolls/${id}/export`, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payroll-${id}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Exported');
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Export failed');
    }
  };

  const handleProcess = async (id) => {
    if (!(await confirmAction('Process this payroll? Payslips will be calculated.', 'Process Payroll'))) return;
    try { await processMut.mutateAsync(id); toast.success('Payroll processed'); }
    catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handlePay = async (id) => {
    if (!(await confirmAction('Mark this payroll as paid?', 'Confirm Payment'))) return;
    try { await payMut.mutateAsync(id); toast.success('Payroll marked as paid'); }
    catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length) toast.error(errors.join('. '));
      else toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const viewPayslips = (id) => { setSelectedId(id); setPayslipModal(true); };

  const openPrint = (ps, emp) => {
    setSelectedPayslip(ps);
    setSelectedEmp(emp);
    setPrintModal(true);
  };

  const handlePrint = () => {
    const content = document.getElementById('print-area');
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    const clone = content.cloneNode(true);
    printWindow.document.write(`
      <html><head><title>Payslip</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1a1a2e; }
        .print-payslip { max-width: 900px; margin: 0 auto; padding: 30px; }
        .print-header { text-align: center; border-bottom: 3px solid #6c63ff; padding-bottom: 16px; margin-bottom: 24px; }
        .print-header h2 { margin: 0; color: #6c63ff; font-size: 28px; letter-spacing: 1px; }
        .print-info { margin-bottom: 24px; font-size: 16px; line-height: 2; }
        .print-info div { margin-bottom: 8px; }
        .print-section { margin-bottom: 24px; }
        .print-section h3 { font-size: 17px; margin: 0 0 12px; padding: 8px 14px; background: #f0f0ff; border-left: 4px solid #6c63ff; }
        .print-table { width: 100%; border-collapse: collapse; font-size: 16px; }
        .print-table td { padding: 10px 14px; border-bottom: 1px solid #eee; }
        .print-table .right { text-align: right; }
        .print-total { border-top: 2px solid #333; }
        .print-net { background: #f8f8ff; padding: 14px; border-radius: 6px; }
        .print-footer { margin-top: 50px; display: flex; justify-content: space-between; font-size: 15px; }
        .print-sign { text-align: center; }
      </style></head><body></body></html>
    `);
    printWindow.document.body.appendChild(clone);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const months = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <>
      <header className="pos-header">
        <div><h1>Payroll</h1><div className="sub">Philippine payroll with SSS, PhilHealth, Pag-IBIG, BIR deductions</div></div>
        <button className="btn btn-primary" onClick={() => setGenModal(true)}>＋</button>
      </header>

      <div className="search-bar">
        <input className="input-block w-250" placeholder="Search employee name..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {isLoading ? <LoadingSkeleton rows={4} /> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><SortableHeader label="Period" field="period" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /><SortableHeader label="Status" field="status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /><th>Employees</th><SortableHeader label="Gross Pay" field="totalGrossPay" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /><th>Deductions</th><SortableHeader label="Net Pay" field="totalNetPay" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} /><th>Actions</th></tr>
            </thead>
            <tbody>
              {(data?.payrolls || []).map(p => (
                <tr key={p.id}>
                  <td><strong>{p.period}</strong></td>
                  <td><span className={`badge ${p.status === 'paid' ? 'success' : p.status === 'processed' ? 'info' : 'warning'}`}>{p.status}</span></td>
                  <td>{p.totalEmployees}</td>
                  <td>{peso(p.totalGrossPay)}</td>
                  <td>{peso(p.totalDeductions)}</td>
                  <td className="total-amount">{peso(p.totalNetPay)}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => viewPayslips(p.id)}>{icons.view}</button>
                    <button className="btn btn-sm btn-outline ml-xs" onClick={() => handleExport(p.id)}>↓</button>
                    {p.status === 'draft' && <button className="btn btn-sm btn-primary ml-xs" onClick={() => handleProcess(p.id)} disabled={processMut.isPending}>Process</button>}
                    {p.status === 'processed' && isAdmin && <button className="btn btn-sm btn-success ml-xs" onClick={() => handlePay(p.id)} disabled={payMut.isPending}>₱</button>}
                    {p.status === 'processed' && !isAdmin && <span className="badge info ml-xs">Awaiting Admin</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!data?.payrolls || data.payrolls.length === 0) && <div className="empty-state">No payrolls yet. Click "Generate Payroll" to start.</div>}
        </div>
      )}

      {data?.pagination?.totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>◀</button>
          <span>Page {page} / {data.pagination.totalPages}</span>
          <button className="btn btn-sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage(p => p + 1)}>▶</button>
        </div>
      )}

      <Modal open={genModal} onClose={() => setGenModal(false)} title="Generate Payroll">
        <form onSubmit={handleGenerate} className="modal-form">
          <div className="form-row">
            <div className="field"><label htmlFor="pay-month">Month *</label>
              <select id="pay-month" className="input-block" value={genForm.month} onChange={e => setGenForm({...genForm, month: +e.target.value})} required>
                {months.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="pay-year">Year *</label>
              <select id="pay-year" className="input-block" value={genForm.year} onChange={e => setGenForm({...genForm, year: +e.target.value})} required>
                {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="pay-periodType">Payment Period *</label>
              <select id="pay-periodType" className="input-block" value={genForm.periodType} onChange={e => setGenForm({...genForm, periodType: e.target.value, half: 1})} required>
                <option value="monthly">Monthly (full month)</option>
                <option value="semi-monthly">Semi-Monthly (15th split)</option>
              </select>
            </div>
            {genForm.periodType === 'semi-monthly' && (
              <div className="field"><label htmlFor="pay-half">Pay Period *</label>
                <select id="pay-half" className="input-block" value={genForm.half} onChange={e => setGenForm({...genForm, half: +e.target.value})} required>
                  <option value={1}>1st Half (1st – 15th)</option>
                  <option value={2}>2nd Half (16th – end)</option>
                </select>
              </div>
            )}
          </div>

          <div className="form-row mt-sm">
            <div className="field"><label htmlFor="pay-dept">Department (optional)</label>
              <select id="pay-dept" className="input-block" value={genForm.departmentId} onChange={e => setGenForm({...genForm, departmentId: e.target.value})}>
                <option value="">All Departments</option>
                {(departments?.departments || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div className="field mt-sm">
            <label>Bonuses (optional)</label>
            <div className="sub mb-sm">Set bonuses per employee. Overtime and absent deductions are calculated automatically from attendance.</div>
            <div className="table-wrap overflow-auto border-none" style={{ maxHeight: 200, borderRadius: 6 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Employee</th><th className="w-140">Bonus (₱)</th></tr>
                </thead>
                <tbody>
                  {employees.map(emp => (
                    <tr key={emp.id}>
                      <td>{emp.firstName} {emp.middleName ? emp.middleName + ' ' : ''}{emp.lastName}</td>
                      <td>
                        <input
                          type="number"
                          className="input-block"
                          min="0"
                          step="0.01"
                          value={bonuses[emp.id] || ''}
                          onChange={e => setBonus(emp.id, e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalBonuses > 0 && <div className="mt-xs text-sm text-accent">Total bonuses: {peso(totalBonuses)}</div>}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => { setGenModal(false); setBonuses({}); }}>{icons.close}</button>
            <button type="button" className="btn btn-secondary" onClick={handlePreview} disabled={previewLoading}>{previewLoading ? 'Loading...' : '⊙'}</button>
            <button type="submit" className="btn btn-primary" disabled={generateMut.isPending}>{generateMut.isPending && <span className="btn-spinner" />}{generateMut.isPending ? 'Generating...' : 'Generate'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={payslipModal} onClose={() => setPayslipModal(false)} title={`Payslips - ${selectedPayroll?.period || ''}`} >
        <div className="table-wrap border-none overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th><th>Days</th><th>Absent</th><th>Basic Pay</th><th>OT Pay</th><th>ND Pay</th><th>Holiday</th><th>Rest Day</th><th>13th Month</th><th>Bonus</th>
                <th>Absent Ded.</th><th>SSS</th><th>PhilHealth</th><th>Pag-IBIG</th><th>BIR Tax</th>
                <th>Total Ded.</th><th>Net Pay</th><th>Print</th>
              </tr>
            </thead>
            <tbody>
              {(selectedPayroll?.payslips || selectedPayroll?.Payslips || []).map(ps => {
                const emp = ps.employee || ps.Employee || {};
                return (
                  <tr key={ps.id}>
                    <td>{emp.firstName} {emp.middleName ? emp.middleName + ' ' : ''}{emp.lastName}</td>
                    <td>{ps.daysWorked || 0}</td>
                    <td>{ps.absentDays || 0}</td>
                    <td>{peso(ps.basicSalary || ps.basic_salary)}</td>
                    <td style={{ color: parseFloat(ps.overtimePay || 0) > 0 ? 'var(--success)' : undefined }}>
                      {peso(ps.overtimePay || 0)}
                    </td>
                    <td style={{ color: parseFloat(ps.nightDiffPay || 0) > 0 ? 'var(--success)' : undefined }}>
                      {peso(ps.nightDiffPay || 0)}
                    </td>
                    <td style={{ color: parseFloat(ps.holidayPay || 0) > 0 ? 'var(--success)' : undefined }}>
                      {peso(ps.holidayPay || 0)}
                    </td>
                    <td style={{ color: parseFloat(ps.restDayPay || 0) > 0 ? 'var(--success)' : undefined }}>
                      {peso(ps.restDayPay || 0)}
                    </td>
                    <td style={{ color: parseFloat(ps.thirteenthMonthPay || 0) > 0 ? 'var(--accent)' : undefined }}>
                      {peso(ps.thirteenthMonthPay || 0)}
                    </td>
                    <td style={{ color: parseFloat(ps.bonusPay || 0) > 0 ? 'var(--accent)' : undefined }}>
                      {peso(ps.bonusPay || 0)}
                    </td>
                    <td style={{ color: parseFloat(ps.absentDeduction || 0) > 0 ? 'var(--danger)' : undefined }}>
                      {peso(ps.absentDeduction || 0)}
                    </td>
                    <td>{peso(ps.sssDeduction || 0)}</td>
                    <td>{peso(ps.philhealthDeduction || 0)}</td>
                    <td>{peso(ps.pagibigDeduction || 0)}</td>
                    <td>{peso(ps.taxDeduction || 0)}</td>
                    <td>{peso(ps.totalDeductions || 0)}</td>
                    <td className="total-amount">{peso(ps.netPay || 0)}</td>
                    <td><button className="btn btn-sm btn-outline" onClick={() => openPrint(ps, emp)}>⎙</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(!selectedPayroll?.payslips && !selectedPayroll?.Payslips) && <div className="empty-state">No payslips</div>}
        </div>
      </Modal>

      <Modal open={printModal} onClose={() => setPrintModal(false)} title="Print Payslip" wide>
        <div className="flex-end mb-sm">
          <button className="btn btn-primary" onClick={handlePrint}>⎙</button>
        </div>
        <PrintPayslip payroll={selectedPayroll} payslip={selectedPayslip} employee={selectedEmp} />
      </Modal>

      <Modal open={previewModal} onClose={() => setPreviewModal(false)} title={`Payroll Preview - ${previewData?.period || ''}`} wide>
        {previewData && (
          <div>
            <div className="detail-grid mb-md text-sm" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div><strong>Employees:</strong> {previewData.totalEmployees}</div>
              <div><strong>Working Days:</strong> {previewData.totalWorkingDays}</div>
              <div><strong>Gross Pay:</strong> {peso(previewData.totalGross)}</div>
              <div><strong>Total Deductions:</strong> {peso(previewData.totalDeductions)}</div>
              <div><strong>Net Pay:</strong> {peso(previewData.totalNet)}</div>
            </div>
            <div className="table-wrap overflow-auto" style={{ maxHeight: 400 }}>
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Days</th><th>Absent</th><th>Basic</th><th>OT</th><th>ND</th><th>Holiday</th><th>Rest Day</th><th>13th Month</th><th>Bonus</th><th>Deductions</th><th>Net Pay</th></tr></thead>
                <tbody>
                  {previewData.payslips?.map((ps, i) => (
                    <tr key={i}>
                      <td>{ps.employeeName}</td><td>{ps.daysWorked}</td><td>{ps.absentDays}</td>
                      <td>{peso(ps.basicSalary)}</td><td>{peso(ps.overtimePay)}</td>
                      <td>{peso(ps.nightDiffPay || 0)}</td><td>{peso(ps.holidayPay || 0)}</td>
                      <td>{peso(ps.restDayPay || 0)}</td><td>{peso(ps.thirteenthMonthPay || 0)}</td>
                      <td>{peso(ps.bonusPay)}</td>
                      <td>{peso(ps.totalDeductions)}</td><td className="total-amount">{peso(ps.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    {confirmDialog}
    </>
  );
}
