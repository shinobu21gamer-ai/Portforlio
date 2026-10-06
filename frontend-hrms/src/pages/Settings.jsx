import { useState } from 'react';
import { Card, CardBody, CardHeader, CardTitle } from '../components/Card';
import Badge from '../components/Badge';
import Button from '../components/Button';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ErrorState from '../components/ErrorState';
import { useToast } from '../components/Toast';
import { useEmailStatus, useVerifyEmail, useSendTestEmail } from '../hooks/useApi';
import useAuthStore from '../store/authStore';

// Outbound email is the one subsystem that fails invisibly: password resets,
// payslips, contract notices and receipts are sent through a mailer whose
// callers ignore the result, so "no email arrived" and "email was never
// accepted" look identical from the outside. This page surfaces the mailer's
// configuration, its last connection check and its delivery counters, and can
// send a real test message.

const REASON_LABEL = {
  'not-configured': 'SMTP is not configured',
  auth: 'The mail server rejected the login',
  connection: 'The mail server could not be reached',
  unknown: 'Delivery failed',
};

function formatDateTime(value) {
  if (!value) return 'never';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

// One place decides what the badge says, so the card can never show "Working"
// while the counters say every message was rejected.
function describeEmail(status) {
  const verify = status?.lastVerify || {};
  if (!status?.configured) {
    return {
      variant: 'danger',
      label: 'Not configured',
      blurb: 'No email will be sent. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM on the server, then redeploy.',
    };
  }
  if (!status.passwordSet) {
    return {
      variant: 'warning',
      label: 'Password missing',
      blurb: 'SMTP_USER is set but SMTP_PASS is empty, so every login will be rejected. Most providers require an app password rather than the account password.',
    };
  }
  if (verify.ok === true) {
    return { variant: 'success', label: 'Working', blurb: 'The mail server accepted the last connection check.' };
  }
  if (verify.ok === false) {
    return { variant: 'warning', label: 'Needs attention', blurb: REASON_LABEL[verify.reason] || REASON_LABEL.unknown };
  }
  return { variant: 'neutral', label: 'Configured — not checked yet', blurb: 'Run a connection check to confirm the credentials work.' };
}

function Row({ label, value, mono = false }) {
  return (
    <div
      className="flex items-center"
      style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', gap: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}
    >
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm" style={{ fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

export default function Settings() {
  const user = useAuthStore(s => s.user);
  const toast = useToast();

  const isAdmin = user?.role?.slug === 'admin';
  const statusQuery = useEmailStatus();
  const verifyEmail = useVerifyEmail();
  const sendTest = useSendTestEmail();

  const [form, setForm] = useState({ to: '', subject: '', message: '' });
  const [testError, setTestError] = useState(null);

  if (!isAdmin) {
    return (
      <div className="hrms-page">
        <div className="page-header"><h1>Settings</h1></div>
        <div className="empty-state">You do not have permission to view this page.</div>
      </div>
    );
  }

  if (statusQuery.isLoading) return <div className="hrms-page"><LoadingSkeleton rows={5} /></div>;
  if (statusQuery.isError) {
    return (
      <div className="hrms-page">
        <div className="page-header"><h1>Settings</h1></div>
        <ErrorState
          message={statusQuery.error?.response?.data?.message || 'Could not load the email status.'}
          onRetry={() => statusQuery.refetch()}
          retrying={statusQuery.isFetching}
        />
      </div>
    );
  }

  const status = statusQuery.data || {};
  const badge = describeEmail(status);
  const counters = status.counters || {};
  const failed = (counters.notConfigured || 0) + (counters.errored || 0);

  const handleVerify = async () => {
    try {
      const fresh = await verifyEmail.mutateAsync();
      if (fresh.lastVerify?.ok) toast.success('Mail server reachable — credentials accepted');
      else toast.error(REASON_LABEL[fresh.lastVerify?.reason] || 'Connection check failed');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Connection check failed');
    }
  };

  const handleSendTest = async (e) => {
    e.preventDefault();
    setTestError(null);
    try {
      const result = await sendTest.mutateAsync({
        to: form.to.trim() || undefined,
        subject: form.subject.trim() || undefined,
        message: form.message.trim() || undefined,
      });
      toast.success(`Test email accepted for ${result.to}`);
    } catch (err) {
      const data = err?.response?.data;
      const message = data?.message || 'The test email could not be sent.';
      // 422 from the validator carries an array of field messages; 502/503 from
      // the mailer carries { reason, hint }.
      const hint = Array.isArray(data?.errors)
        ? data.errors.join(' ')
        : data?.errors?.hint || null;
      setTestError({ message, hint, reason: data?.errors?.reason || null });
      toast.error(message);
    }
  };

  return (
    <div className="hrms-page">
      <div className="page-header">
        <h1>Settings</h1>
        <p className="text-muted">Email delivery and system diagnostics.</p>
      </div>

      <Card>
        <CardHeader action={<Badge variant={badge.variant} dot>{badge.label}</Badge>}>
          <CardTitle subtitle={badge.blurb}>Email delivery</CardTitle>
        </CardHeader>
        <CardBody>
          <Row label="SMTP server" value={status.configured ? `${status.host}:${status.port}${status.secure ? ' (TLS)' : ''}` : '— not configured'} mono />
          <Row label="Sender address" value={status.from || '—'} mono />
          <Row label="Username" value={status.user || '—'} mono />
          <Row label="Password" value={status.passwordSet ? 'set' : 'not set'} />
          <Row
            label="Public site URL (links in emails)"
            value={status.frontendUrl || 'FRONTEND_URL is not set — emails with portal links will not be built'}
          />
          <Row label="Last connection check" value={`${formatDateTime(status.lastVerify?.checkedAt)}${status.lastVerify?.ok === true ? ' — OK' : status.lastVerify?.ok === false ? ` — ${REASON_LABEL[status.lastVerify.reason] || 'failed'}` : ''}`} />

          {status.disabledByFlag && (
            <p className="text-sm" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--muted)', color: 'var(--muted-fg)' }}>
              <strong>EMAIL_DISABLED=true</strong> is set. That only allows the server to boot without SMTP in
              production — it does <strong>not</strong> turn sending off, so it is not what is blocking delivery.
            </p>
          )}

          {status.lastVerify?.ok === false && status.lastVerify?.error && (
            <p className="text-sm" role="alert" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(220, 38, 38, 0.08)', color: 'var(--danger, #dc2626)' }}>
              <strong>{REASON_LABEL[status.lastVerify.reason] || REASON_LABEL.unknown}:</strong> {status.lastVerify.error}
              {status.lastVerify.hint && <><br />{status.lastVerify.hint}</>}
            </p>
          )}

          <div className="flex-gap-sm" style={{ marginTop: 16, alignItems: 'center' }}>
            <Button variant="secondary" size="sm" onClick={handleVerify} loading={verifyEmail.isPending}>
              Re-check connection
            </Button>
            <Button variant="ghost" size="sm" onClick={() => statusQuery.refetch()} loading={statusQuery.isFetching}>Refresh status</Button>
          </div>
          <p className="text-sm text-muted" style={{ marginTop: 8 }}>
            A connection check dials the mail server and logs in; no message is sent.
          </p>
        </CardBody>
      </Card>

      <Card style={{ marginTop: 20 }}>
        <CardHeader>
          <CardTitle subtitle={`Since the last server restart: ${counters.sent || 0} sent, ${counters.notConfigured || 0} dropped (no SMTP), ${counters.errored || 0} rejected by the server.`}>
            Delivery counters
          </CardTitle>
        </CardHeader>
        <CardBody>
          {counters.lastError && (
            <p className="text-sm" style={{ marginBottom: 12 }}>
              <span className="text-muted">Last error:</span> <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{counters.lastError}</span>
            </p>
          )}
          <p className="text-sm text-muted">
            {failed === 0
              ? 'Nothing has failed since the last restart.'
              : `${failed} message(s) never left the server. Password resets, payslips and receipts sent while the mailer is down are lost — they are not retried.`}
          </p>
        </CardBody>
      </Card>

      <Card style={{ marginTop: 20 }}>
        <CardHeader>
          <CardTitle subtitle="Sends a real message through the configured SMTP server, so it proves the whole path end to end. Leave the recipient blank to mail yourself.">
            Send a test email
          </CardTitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSendTest}>
            <div className="two-col">
              <div className="field">
                <label htmlFor="test-email-to">Recipient</label>
                <input
                  id="test-email-to"
                  className="input-block"
                  type="email"
                  placeholder={user?.email || 'you@example.com'}
                  value={form.to}
                  onChange={(e) => setForm(f => ({ ...f, to: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="test-email-subject">Subject</label>
                <input
                  id="test-email-subject"
                  className="input-block"
                  maxLength={150}
                  placeholder="Test email"
                  value={form.subject}
                  onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="test-email-message">Note (optional)</label>
              <textarea
                id="test-email-message"
                className="input-block"
                rows={3}
                maxLength={1000}
                placeholder="Anything the recipient should know, e.g. “checking a new SMTP setting”."
                value={form.message}
                onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
              />
            </div>

            {testError && (
              <p className="text-sm" role="alert" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(220, 38, 38, 0.08)', color: 'var(--danger, #dc2626)' }}>
                <strong>{testError.message}</strong>
                {testError.hint && <><br />{testError.hint}</>}
              </p>
            )}

            <Button type="submit" size="sm" loading={sendTest.isPending}>
              Send test email
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
