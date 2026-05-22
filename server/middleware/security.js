import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

function jsonLimitHandler(_req, res) {
  return res.status(429).json({
    msg: 'Too many requests. Please wait a moment before trying again.',
  });
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 35,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonLimitHandler,
});

export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonLimitHandler,
});

export const publicSubmitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonLimitHandler,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/ping',
  handler: jsonLimitHandler,
});

function sanitizeKey(key) {
  return String(key).replace(/\$/g, '_').replace(/\./g, '_');
}

function sanitizeValue(value, seen = new WeakMap()) {
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return value;
  if (seen.has(value)) return seen.get(value);

  if (Array.isArray(value)) {
    const next = [];
    seen.set(value, next);
    value.forEach((item, index) => {
      next[index] = sanitizeValue(item, seen);
    });
    return next;
  }

  const next = {};
  seen.set(value, next);
  Object.entries(value).forEach(([key, item]) => {
    next[sanitizeKey(key)] = sanitizeValue(item, seen);
  });
  return next;
}

export function sanitizeMongoPayloads(req, _res, next) {
  if (req.body && typeof req.body === 'object') req.body = sanitizeValue(req.body);
  if (req.params && typeof req.params === 'object') req.params = sanitizeValue(req.params);
  if (req.query && typeof req.query === 'object') {
    Object.defineProperty(req, 'query', {
      value: sanitizeValue(req.query),
      configurable: true,
      enumerable: true,
    });
  }
  next();
}

function sameOriginWriteGuard(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const origin = String(req.headers.origin || '').replace(/\/$/, '');
  if (!origin) return next();

  const requestHost = req.headers.host;
  const forwardedHost = String(req.headers['x-forwarded-host'] || '');
  const allowedOrigins = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean);

  try {
    const originHost = new URL(origin).host;
    if (originHost === requestHost || originHost === forwardedHost || allowedOrigins.includes(origin)) {
      return next();
    }
  } catch (_err) {
    // Reject malformed origins below.
  }

  return res.status(403).json({ msg: 'Request origin is not allowed.' });
}

export function applySecurityMiddleware(app) {
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(cookieParser());
  app.use(compression());
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          fontSrc: ["'self'", 'data:', 'https:'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", 'https:', 'wss:'],
          frameSrc: ["'self'", 'https://www.google.com', 'https://www.google.com/maps'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: false,
      },
    }),
  );

  app.use('/api', apiLimiter);
  app.use('/api', sameOriginWriteGuard);
}
