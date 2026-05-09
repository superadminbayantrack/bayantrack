import nodemailer from 'nodemailer';

const DEFAULT_MAIL_USER = process.env.MAIL_USER || process.env.NOTIFICATION_EMAIL || 'superadminbayantrack@gmail.com';
const DEFAULT_MAIL_FROM = process.env.MAIL_FROM || `"BayanTrack" <${DEFAULT_MAIL_USER}>`;

let transporterInstance = null;
const MAIL_SEND_TIMEOUT_MS = Number(process.env.MAIL_SEND_TIMEOUT_MS || 15000);

export function getNotificationEmail() {
  return process.env.NOTIFICATION_EMAIL || DEFAULT_MAIL_USER;
}

export function getMailTransporter() {
  if (transporterInstance) return transporterInstance;

  const user = process.env.MAIL_USER || DEFAULT_MAIL_USER;
  const pass = process.env.MAIL_PASS || '';
  const service = process.env.MAIL_SERVICE || 'gmail';

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

export async function safeSendMail(options = {}) {
  const transporter = getMailTransporter();
  if (!transporter) {
    console.warn('Mail transporter is not configured. Set MAIL_USER and MAIL_PASS in .env.');
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
