const INSECURE_JWT_VALUES = new Set([
  'secret',
  'secrettoken',
  'changeme',
  'change-me',
  'replace-with-a-long-random-secret',
]);

export const AUTH_COOKIE_NAME = 'bayantrack_session';

export function isProductionEnv() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

export function getRequiredEnv(name, { minLength = 1, productionOnly = false } = {}) {
  const value = String(process.env[name] || '').trim();
  if (!value && (!productionOnly || isProductionEnv())) {
    throw new Error(`${name} is required${productionOnly ? ' in production' : ''}.`);
  }
  if (value && value.length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters long.`);
  }
  return value;
}

export function getJwtSecret() {
  const secret = getRequiredEnv('JWT_SECRET', { minLength: isProductionEnv() ? 32 : 16 });
  if (INSECURE_JWT_VALUES.has(secret.toLowerCase())) {
    throw new Error('JWT_SECRET is using an unsafe default value. Set a long random secret.');
  }
  return secret;
}

export function parseDurationMs(value, fallbackMs) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return fallbackMs;

  const match = raw.match(/^(\d+)\s*(ms|s|m|h|d)?$/);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2] || 'ms';
  if (!Number.isFinite(amount) || amount <= 0) return fallbackMs;

  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * multipliers[unit];
}

export function getAuthCookieOptions(req) {
  const secure =
    isProductionEnv() ||
    Boolean(req?.secure) ||
    String(req?.headers?.['x-forwarded-proto'] || '').includes('https');

  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: parseDurationMs(process.env.AUTH_TOKEN_TTL, 7 * 24 * 60 * 60 * 1000),
  };
}

export function validateRuntimeEnv() {
  getJwtSecret();
  if (isProductionEnv() && !String(process.env.MONGODB_URI || process.env.MONGO_URI || '').trim()) {
    throw new Error('MONGODB_URI or MONGO_URI is required in production.');
  }
  if (isProductionEnv() && !String(process.env.CORS_ORIGIN || '').trim()) {
    throw new Error('CORS_ORIGIN is required in production.');
  }
}
