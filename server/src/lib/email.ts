import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    logger.info('[email dev]', { to, subject, html });
    return;
  }
  await resend.emails.send({ from: env.FROM_EMAIL, to, subject, html });
}

// ─── Templates ────────────────────────────────────────────────────────────────

function wrap(title: string, body: string) {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#0a0a0f;color:#e2e8f0;margin:0;padding:40px 20px">
<div style="max-width:480px;margin:0 auto">
  <div style="margin-bottom:32px">
    <span style="font-size:18px;font-weight:700;color:#fff">Valence</span>
  </div>
  <div style="background:#13131a;border:1px solid #2a2a3a;border-radius:12px;padding:32px">
    <h2 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#fff">${title}</h2>
    ${body}
  </div>
  <p style="margin-top:24px;font-size:11px;color:#4a5568">Valence · Operational Intelligence Platform</p>
</div></body></html>`;
}

function btn(label: string, url: string) {
  return `<a href="${url}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#5b21b6;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">${label}</a>`;
}

// ─── Senders ──────────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const body = `
    <p style="margin:0 0 16px;font-size:14px;color:#94a3b8;line-height:1.6">
      We received a request to reset your Valence password. This link expires in 1 hour.
    </p>
    ${btn('Reset password', resetUrl)}
    <p style="margin-top:20px;font-size:12px;color:#4a5568">If you didn't request this, you can ignore this email.</p>`;
  await send(to, 'Reset your Valence password', wrap('Reset your password', body));
}

export async function sendSupportTicket(opts: {
  userName: string;
  userEmail: string;
  userId: string;
  category: string;
  subject: string;
  message: string;
  screenshot: string | null;
  pageUrl: string | null;
  browserInfo: string | null;
  submittedAt: string;
}) {
  const categoryColors: Record<string, string> = {
    'Bug Report':      '#ef4444',
    'Feature Request': '#8b5cf6',
    'General Support': '#3b82f6',
  };
  const color = categoryColors[opts.category] ?? '#64748b';

  const metaRows = [
    ['User',      `${opts.userName} (${opts.userEmail})`],
    ['User ID',   opts.userId],
    ['Category',  opts.category],
    ['Timestamp', new Date(opts.submittedAt).toLocaleString('en-CA', { timeZone: 'America/Toronto' })],
    ...(opts.pageUrl     ? [['Page', opts.pageUrl]]     : []),
    ...(opts.browserInfo ? [['Browser', opts.browserInfo]] : []),
  ];

  const metaTable = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      ${metaRows.map(([k, v]) => `
        <tr>
          <td style="padding:6px 12px 6px 0;font-size:11px;font-weight:600;color:#64748b;white-space:nowrap;vertical-align:top">${k}</td>
          <td style="padding:6px 0;font-size:12px;color:#94a3b8;word-break:break-all">${v}</td>
        </tr>`).join('')}
    </table>`;

  const body = `
    <div style="margin-bottom:16px">
      <span style="display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:${color}22;color:${color};border:1px solid ${color}44">${opts.category}</span>
    </div>
    <h3 style="margin:0 0 20px;font-size:16px;font-weight:600;color:#fff">${opts.subject}</h3>
    <div style="background:#0d0d14;border:1px solid #1e1e2e;border-radius:8px;padding:16px;margin-bottom:24px">
      <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.7;white-space:pre-wrap">${opts.message}</p>
    </div>
    <div style="border-top:1px solid #1e1e2e;padding-top:20px">
      <p style="margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#4a5568">Submission details</p>
      ${metaTable}
    </div>
    <p style="margin:0;font-size:11px;color:#4a5568">Reply directly to this email to respond to ${opts.userName}.</p>`;

  const attachments: { filename: string; content: Buffer }[] = [];
  if (opts.screenshot) {
    const base64 = opts.screenshot.includes(',') ? opts.screenshot.split(',')[1] : opts.screenshot;
    attachments.push({ filename: 'screenshot.png', content: Buffer.from(base64, 'base64') });
  }

  if (!resend) {
    logger.info('[support ticket dev]', { to: 'support@valenceos.ca', subject: opts.subject });
    return;
  }

  await resend.emails.send({
    from:        env.FROM_EMAIL,
    to:          'support@valenceos.ca',
    replyTo:     opts.userEmail,
    subject:     `[${opts.category}] ${opts.subject}`,
    html:        wrap(`New ${opts.category}`, body),
    attachments,
  });
}

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  const body = `
    <p style="margin:0 0 16px;font-size:14px;color:#94a3b8;line-height:1.6">
      Verify your email address to complete your Valence account setup.
    </p>
    ${btn('Verify email address', verifyUrl)}
    <p style="margin-top:20px;font-size:12px;color:#4a5568">This link expires in 24 hours.</p>`;
  await send(to, 'Verify your Valence email', wrap('Verify your email', body));
}
