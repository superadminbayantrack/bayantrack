import nodemailer from 'nodemailer';

function cleanEnvValue(value) {
  const trimmed = String(value || '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function cleanMailPassword(service, value) {
  const password = cleanEnvValue(value);
  if (String(service || '').toLowerCase() === 'gmail') {
    return password.replace(/\s+/g, '');
  }
  return password;
}

const DEFAULT_MAIL_USER = cleanEnvValue(process.env.MAIL_USER || process.env.NOTIFICATION_EMAIL || 'superadminbayantrack@gmail.com');
const DEFAULT_MAIL_FROM = cleanEnvValue(process.env.MAIL_FROM || `"BayanTrack" <${DEFAULT_MAIL_USER}>`);
const DEFAULT_RESEND_FROM = cleanEnvValue(process.env.RESEND_FROM_EMAIL || 'BayanTrack <onboarding@resend.dev>');

let transporterInstance = null;
const MAIL_SEND_TIMEOUT_MS = Number(process.env.MAIL_SEND_TIMEOUT_MS || 15000);

export function getNotificationEmail() {
  return cleanEnvValue(process.env.NOTIFICATION_EMAIL) || DEFAULT_MAIL_USER;
}

export function getMailTransporter() {
  if (transporterInstance) return transporterInstance;

  const service = cleanEnvValue(process.env.MAIL_SERVICE || 'gmail');
  const user = cleanEnvValue(process.env.MAIL_USER || DEFAULT_MAIL_USER);
  const pass = cleanMailPassword(service, process.env.MAIL_PASS || '');

  if (!user || !pass) {
    return null;
  }

  transporterInstance = nodemailer.createTransport({
    service,
    auth: { user, pass },
    connectionTimeout: MAIL_SEND_TIMEOUT_MS,
    greetingTimeout: MAIL_SEND_TIMEOUT_MS,
    socketTimeout: MAIL_SEND_TIMEOUT_MS,
  });
  return transporterInstance;
}

async function sendWithResend(options = {}) {
  const apiKey = cleanEnvValue(process.env.RESEND_API_KEY || '');
  if (!apiKey) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAIL_SEND_TIMEOUT_MS);

  try {
    const to = Array.isArray(options.to) ? options.to : [options.to].filter(Boolean);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.from || DEFAULT_RESEND_FROM,
        to,
        subject: options.subject || '',
        html: options.html || '',
        text: options.text || '',
        reply_to: options.replyTo,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend API error ${response.status}: ${body}`);
    }

    return true;
  } finally {
    clearTimeout(timeout);
  }
}

export async function safeSendMail(options = {}) {
  if (process.env.RESEND_API_KEY) {
    try {
      return await sendWithResend(options);
    } catch (err) {
      console.error('Failed to send email using Resend:', err);
      return false;
    }
  }

  const transporter = getMailTransporter();
  if (!transporter) {
    console.warn('Mail transporter is not configured. Set RESEND_API_KEY or MAIL_USER and MAIL_PASS in .env.');
    return false;
  }

  await Promise.race([
    transporter.sendMail({
      from: DEFAULT_MAIL_FROM,
      ...options,
    }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Mail send timeout after ${MAIL_SEND_TIMEOUT_MS}ms`)), MAIL_SEND_TIMEOUT_MS);
    }),
  ]);
  return true;
}
