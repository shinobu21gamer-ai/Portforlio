const config = require('../config');
const { escapeHtml } = require('./helpers');
const appName = config.app.name || 'MiniMart POS';

function formatDate(value) {
  if (!value) return '';
  try {
    let d;
    if (value instanceof Date) {
      d = value;
    } else if (typeof value === 'string') {
      d = new Date(value.includes('T') ? value : value + 'T00:00:00');
    } else {
      return String(value);
    }
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(value);
  }
}

function formatDateShort(value) {
  if (!value) return '';
  try {
    let d;
    if (value instanceof Date) {
      d = value;
    } else if (typeof value === 'string') {
      d = new Date(value.includes('T') ? value : value + 'T00:00:00');
    } else {
      return String(value);
    }
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(value);
  }
}

function baseLayout(content) {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <div style="background:#4F46E5;padding:24px 32px;">
        <h1 style="margin:0;color:#fff;font-size:20px;">${appName}</h1>
      </div>
      <div style="padding:32px;font-size:14px;color:#333;line-height:1.6;">
        ${content}
      </div>
      <div style="padding:16px 32px;background:#f9fafb;text-align:center;font-size:12px;color:#999;">
        &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
      </div>
    </div>
  </body>
  </html>`;
}

function passwordResetEmail(userName, resetUrl) {
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#333;">Password Reset Request</h2>
    <p>Hi <strong>${escapeHtml(userName)}</strong>,</p>
    <p>We received a request to reset your password. Click the button below to set a new password:</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 32px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Reset Password</a>
    </div>
    <p style="color:#666;font-size:13px;">This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>`;
  return baseLayout(content);
}

function passwordResetSuccessEmail(userName) {
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#333;">Password Changed</h2>
    <p>Hi <strong>${escapeHtml(userName)}</strong>,</p>
    <p>Your password has been successfully changed. If you didn't make this change, please contact support immediately.</p>`;
  return baseLayout(content);
}

function payrollProcessedEmail(userName, period, netPay) {
  const hrmsUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#333;">Payroll Processed</h2>
    <p>Hi <strong>${escapeHtml(userName)}</strong>,</p>
    <p>Your payroll for <strong>${escapeHtml(period)}</strong> has been processed.</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
      <div style="font-size:12px;color:#666;">Net Pay</div>
      <div style="font-size:24px;font-weight:700;color:#16a34a;">₱${Number(netPay).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
    </div>
    <p style="font-size:13px;color:#666;">You can view your detailed payslip through the <a href="${hrmsUrl}" style="color:#4F46E5;">HRMS Portal</a>.</p>`;
  return baseLayout(content);
}

function leaveRequestEmail(userName, leaveType, status, startDate, endDate) {
  const hrmsUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  const colorMap = { 'approved': '#16a34a', 'rejected': '#dc2626', 'submitted': '#2563eb', 'reviewed': '#f59e0b' };
  const labelMap = { 'approved': 'Approved', 'rejected': 'Rejected', 'submitted': 'Submitted', 'reviewed': 'Reviewed by HR' };
  const color = colorMap[status] || '#6b7280';
  const label = labelMap[status] || status;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#333;">Leave Request ${escapeHtml(label)}</h2>
    <p>Hi <strong>${escapeHtml(userName)}</strong>,</p>
    <p>Your <strong>${escapeHtml(leaveType)}</strong> leave request has been <strong style="color:${color}">${escapeHtml(label.toLowerCase())}</strong>.</p>
    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;">
      <div><strong>From:</strong> ${escapeHtml(formatDateShort(startDate))}</div>
      <div><strong>To:</strong> ${escapeHtml(formatDateShort(endDate))}</div>
    </div>
    ${status === 'submitted' ? '<p>HR will review your request shortly.</p>' : ''}
    ${status === 'reviewed' ? '<p>Your request is pending admin approval.</p>' : ''}
    ${status === 'rejected' ? '<p>Please contact HR if you have questions.</p>' : ''}
    <p>You can manage your leaves through the <a href="${hrmsUrl}" style="color:#4F46E5;">HRMS Portal</a>.</p>`;
  return baseLayout(content);
}

function leaveStatusEmail(userName, leaveType, status, startDate, endDate) {
  return leaveRequestEmail(userName, leaveType, status, startDate, endDate);
}

function contractRenewalEmail(userName, contractType, startDate, endDate, salary) {
  const hrmsUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#2563eb;">Contract Renewed</h2>
    <p>Hi <strong>${escapeHtml(userName)}</strong>,</p>
    <p>Your employment contract has been <strong>renewed</strong>.</p>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0;">
      <div><strong>Type:</strong> ${escapeHtml(contractType)}</div>
      <div><strong>Start:</strong> ${escapeHtml(formatDateShort(startDate))}</div>
      ${endDate ? `<div><strong>End:</strong> ${escapeHtml(formatDateShort(endDate))}</div>` : ''}
      ${salary ? `<div><strong>Salary:</strong> ₱${Number(salary).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>` : ''}
    </div>
    <p>You can view your full contract details through the <a href="${hrmsUrl}" style="color:#4F46E5;">HRMS Portal</a>.</p>`;
  return baseLayout(content);
}

function contractExpiryEmail(userName, contractType, endDate) {
  const hrmsUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#333;">Contract Expiring Soon</h2>
    <p>Hi <strong>${escapeHtml(userName)}</strong>,</p>
    <p>Your <strong>${escapeHtml(contractType)}</strong> contract is expiring on <strong>${escapeHtml(formatDateShort(endDate))}</strong>.</p>
    <p>Please contact HR for contract renewal, or view details through the <a href="${hrmsUrl}" style="color:#4F46E5;">HRMS Portal</a>.</p>`;
  return baseLayout(content);
}

function employeeApprovedEmail(userName, employeeNo, tempPassword, details = {}) {
  const hrmsUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  const { startDate, department, position, schedule } = details;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#16a34a;">Welcome — You're Approved!</h2>
    <p>Hi <strong>${escapeHtml(userName)}</strong>,</p>
    <p>Your employment has been <strong>approved</strong>. You are now an active employee.</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
      <div><strong>Employee No:</strong> ${escapeHtml(employeeNo)}</div>
      ${position ? `<div><strong>Position:</strong> ${escapeHtml(position)}</div>` : ''}
      ${department ? `<div><strong>Department:</strong> ${escapeHtml(department)}</div>` : ''}
      ${startDate ? `<div><strong>Start Date:</strong> ${escapeHtml(startDate)}</div>` : ''}
      ${schedule ? `<div><strong>Schedule:</strong> ${escapeHtml(schedule)}</div>` : ''}
    </div>
    <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
      <div style="font-weight:600;margin-bottom:8px;">Your Login Credentials</div>
      <div><strong>HRMS Portal:</strong> <a href="${hrmsUrl}" style="color:#4F46E5;">${escapeHtml(hrmsUrl)}</a></div>
      <div><strong>Email:</strong> Your registered email</div>
      ${tempPassword ? `<div><strong>Password:</strong> <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;">${escapeHtml(tempPassword)}</code></div>` : ''}
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;">
        <div style="font-weight:600;margin-bottom:4px;">How to Access</div>
        <div style="font-size:13px;color:#64748b;">
          <strong>HRMS Portal</strong> — Use the link above to log in. You'll be directed to your work area based on your role.<br>
          <strong>POS System</strong> — Available inside the HRMS portal after logging in. If you have POS access, you'll see it in the sidebar.
        </div>
      </div>
    </div>
    <p style="color:#64748b;font-size:13px;">For security, please change your password after your first login.</p>`;
  return baseLayout(content);
}

function employeeRejectedEmail(userName) {
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#dc2626;">Employment Application Update</h2>
    <p>Hi <strong>${escapeHtml(userName)}</strong>,</p>
    <p>Thank you for your interest. After review, we regret to inform you that your employment application has <strong>not been approved</strong> at this time.</p>
    <p>We wish you the best in your future endeavors.</p>`;
  return baseLayout(content);
}

function employeeTerminatedEmail(userName, terminationType, terminationDate) {
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#dc2626;">Employment Termination Notice</h2>
    <p>Hi <strong>${escapeHtml(userName)}</strong>,</p>
    <p>This is to inform you that your employment has been <strong>terminated</strong> effective <strong>${escapeHtml(formatDateShort(terminationDate))}</strong>.</p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
      <div><strong>Reason:</strong> ${escapeHtml(terminationType)}</div>
    </div>
    <p>Please contact HR for final pay, benefits, and other concerns.</p>`;
  return baseLayout(content);
}

function contractApprovedEmail(userName, contractType, startDate, endDate, salary) {
  const hrmsUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#16a34a;">Contract Approved</h2>
    <p>Hi <strong>${escapeHtml(userName)}</strong>,</p>
    <p>Your employment contract has been <strong>approved</strong>.</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
      <div><strong>Type:</strong> ${escapeHtml(contractType)}</div>
      <div><strong>Start:</strong> ${escapeHtml(formatDateShort(startDate))}</div>
      ${endDate ? `<div><strong>End:</strong> ${escapeHtml(formatDateShort(endDate))}</div>` : ''}
      ${salary ? `<div><strong>Salary:</strong> ₱${Number(salary).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>` : ''}
    </div>
    <p>You can view your full contract details through the <a href="${hrmsUrl}" style="color:#4F46E5;">HRMS Portal</a>.</p>`;
  return baseLayout(content);
}

function contractRejectedEmail(userName, remarks) {
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#dc2626;">Contract Rejected</h2>
    <p>Hi <strong>${escapeHtml(userName)}</strong>,</p>
    <p>We regret to inform you that your contract has been <strong>rejected</strong>.</p>
    ${remarks ? `<p><strong>Reason:</strong> ${escapeHtml(remarks)}</p>` : ''}
    <p>Please contact HR for more details.</p>`;
  return baseLayout(content);
}

function contractTerminatedEmail(userName) {
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#dc2626;">Contract Terminated</h2>
    <p>Hi <strong>${escapeHtml(userName)}</strong>,</p>
    <p>Your employment contract has been <strong>terminated</strong>.</p>
    <p>Please contact HR for final pay and benefits information.</p>`;
  return baseLayout(content);
}

function applicationStatusEmail(userName, jobTitle, status, details = {}) {
  const hrmsUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  const posUrl = process.env.POS_URL || 'http://localhost:5173';
  const careersUrl = hrmsUrl;
  const colorMap = {
    'accepted': '#16a34a', 'hired': '#16a34a',
    'rejected': '#dc2626',
    'pending': '#f59e0b', 'reviewed': '#f59e0b',
    'initial-interview': '#2563eb', 'final-interview': '#2563eb',
  };
  const labelMap = {
    'pending': 'Received',
    'reviewed': 'Under Review',
    'initial-interview': 'Initial Interview Scheduled',
    'final-interview': 'Final Interview Scheduled',
    'accepted': 'Accepted',
    'rejected': 'Rejected',
    'hired': 'Hired',
  };
  const color = colorMap[status] || '#6b7280';
  const label = labelMap[status] || status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  let statusMessage;

  if (status.includes('interview') && details.scheduledDate) {
    const { scheduledDate, scheduledTime, location } = details;
    const formattedDate = formatDate(scheduledDate);
    statusMessage = `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:16px 0;">
        <div style="font-weight:600;color:#1e40af;margin-bottom:8px;">Interview Details</div>
        ${formattedDate ? `<div><strong>Date:</strong> ${escapeHtml(formattedDate)}</div>` : ''}
        ${scheduledTime ? `<div><strong>Time:</strong> ${escapeHtml(scheduledTime)}</div>` : ''}
        ${location ? `<div><strong>Location:</strong> ${escapeHtml(location)}</div>` : ''}
      </div>`;
  } else if (status.includes('interview')) {
    statusMessage = '<p>Please check your email for interview details including date, time, and location.</p>';
  } else if (status === 'accepted') {
    statusMessage = '<p>Our HR team will be in touch with you shortly regarding the next steps.</p>';
  } else if (status === 'hired') {
    const { email, tempPassword, startDate, department, position, schedule, employeeNo } = details;
    statusMessage = `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
        <div style="font-weight:600;color:#166534;margin-bottom:8px;">Welcome to MiniMart!</div>
        ${position ? `<div><strong>Position:</strong> ${escapeHtml(position)}</div>` : ''}
        ${department ? `<div><strong>Department:</strong> ${escapeHtml(department)}</div>` : ''}
        ${employeeNo ? `<div><strong>Employee No:</strong> ${escapeHtml(employeeNo)}</div>` : ''}
        ${startDate ? `<div><strong>Start Date:</strong> ${escapeHtml(startDate)}</div>` : ''}
        ${schedule ? `<div><strong>Schedule:</strong> ${escapeHtml(schedule)}</div>` : ''}
      </div>
      <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
        <div style="font-weight:600;margin-bottom:8px;">Your Login Credentials</div>
        <div><strong>HRMS Portal:</strong> <a href="${hrmsUrl}" style="color:#4F46E5;">${escapeHtml(hrmsUrl)}</a></div>
        ${email ? `<div><strong>Email:</strong> ${escapeHtml(email)}</div>` : ''}
        ${tempPassword ? `<div><strong>Password:</strong> <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;">${escapeHtml(tempPassword)}</code></div>` : ''}
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;">
          <div style="font-weight:600;margin-bottom:4px;">How to Access</div>
          <div style="font-size:13px;color:#64748b;">
            <strong>HRMS Portal</strong> — Use the link above to log in. You'll be directed to your work area based on your role.<br>
            <strong>POS System</strong> — Available inside the HRMS portal after logging in. If you have POS access, you'll see it in the sidebar.
          </div>
        </div>
      </div>
      <p style="color:#64748b;font-size:13px;">For security, please change your password after your first login.</p>`;
  } else if (status === 'rejected') {
    statusMessage = '<p>We wish you the best in your future endeavors.</p>';
  } else {
    statusMessage = '<p>We are reviewing your application. You will receive an update via email.</p>';
  }

  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#333;">Application ${escapeHtml(label)}</h2>
    <p>Hi <strong>${escapeHtml(userName)}</strong>,</p>
    <p>Your application for <strong>${escapeHtml(jobTitle)}</strong> has been updated to: <strong style="color:${color}">${escapeHtml(label)}</strong>.</p>
    ${statusMessage}
    <div style="text-align:center;margin:24px 0;">
      <a href="${careersUrl}/careers" style="display:inline-block;padding:12px 32px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">View Job Openings</a>
    </div>`;
  return baseLayout(content);
}

function scheduleAssignmentEmail(userName, scheduleName, startTime, endTime, date) {
  const hrmsUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#333;">Schedule Assignment</h2>
    <p>Hi <strong>${escapeHtml(userName)}</strong>,</p>
    <p>You have been assigned to a new work schedule.</p>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0;">
      <div><strong>Schedule:</strong> ${escapeHtml(scheduleName)}</div>
      <div><strong>Time:</strong> ${escapeHtml(startTime)} — ${escapeHtml(endTime)}</div>
      ${date ? `<div><strong>Date:</strong> ${escapeHtml(date)}</div>` : ''}
    </div>
    <p>You can view your full schedule and manage your attendance through the <a href="${hrmsUrl}" style="color:#4F46E5;">HRMS Portal</a>.</p>`;
  return baseLayout(content);
}

function receiptEmail(userName, invoiceNo, items, total, paymentMethod) {
  const itemRows = items.map(i => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(i.name)} &times; ${escapeHtml(i.quantity)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">₱${Number(i.subtotal).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
    </tr>`).join('');

  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#333;">Receipt - ${escapeHtml(invoiceNo)}</h2>
    <p>Hi <strong>${escapeHtml(userName)}</strong>,</p>
    <p>Thank you for your purchase!</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      ${itemRows}
      <tr>
        <td style="padding:12px 0 0;font-weight:700;font-size:16px;">Total</td>
        <td style="padding:12px 0 0;text-align:right;font-weight:700;font-size:16px;">₱${Number(total).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
      </tr>
    </table>
    <p style="font-size:13px;color:#666;">Payment: ${escapeHtml(paymentMethod)}</p>`;
  return baseLayout(content);
}

module.exports = {
  formatDate,
  formatDateShort,
  passwordResetEmail,
  passwordResetSuccessEmail,
  payrollProcessedEmail,
  leaveStatusEmail,
  leaveRequestEmail,
  contractExpiryEmail,
  contractRenewalEmail,
  receiptEmail,
  employeeApprovedEmail,
  employeeRejectedEmail,
  employeeTerminatedEmail,
  contractApprovedEmail,
  contractRejectedEmail,
  contractTerminatedEmail,
  applicationStatusEmail,
  scheduleAssignmentEmail,
};
