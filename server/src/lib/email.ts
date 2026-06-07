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

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  const body = `
    <p style="margin:0 0 16px;font-size:14px;color:#94a3b8;line-height:1.6">
      Verify your email address to complete your Valence account setup.
    </p>
    ${btn('Verify email address', verifyUrl)}
    <p style="margin-top:20px;font-size:12px;color:#4a5568">This link expires in 24 hours.</p>`;
  await send(to, 'Verify your Valence email', wrap('Verify your email', body));
}
