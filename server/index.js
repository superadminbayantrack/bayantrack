import { pathToFileURL } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authRoutes from './routes/auth.js';
import announcementsRoutes from './routes/announcements.js';
import servicesRoutes from './routes/services.js';
import contactRoutes from './routes/contact.js';
import reportsRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import officialsRoutes from './routes/officials.js';
import subscriptionsRoutes from './routes/subscriptions.js';
import contentRoutes from './routes/content.js';
import emergencyAlertRoutes from './routes/emergencyAlerts.js';
import User from './models/User.js';
import Department from './models/Department.js';
import Announcement from './models/Announcement.js';
import Official from './models/Official.js';
import SystemSetting from './models/SystemSetting.js';
import { AUTH_COOKIE_NAME, getJwtSecret, isProductionEnv, validateRuntimeEnv } from './config/env.js';
import { getEmbeddedAccountById } from './config/embeddedAccounts.js';
import { applySecurityMiddleware, authLimiter, otpLimiter, publicSubmitLimiter, sanitizeMongoPayloads } from './middleware/security.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const DEFAULT_ADMIN_PERMISSIONS = {
  officials: { view: true, add: true, edit: true, archive: true, delete: true },
  announcements: { view: true, add: true, edit: true, archive: true, delete: true },
  reports: { view: true, add: true, edit: true, archive: true, delete: true },
  serviceRequests: { view: true, add: true, edit: true, archive: true, delete: true },
  messages: { view: true, add: true, edit: true, archive: true, delete: true },
  subscribers: { view: true, add: true, edit: true, archive: true, delete: true },
};

const LOCAL_ADMIN_PASSWORD = 'AdminBayanTrack2026!';
const LOCAL_SUPERADMIN_PASSWORD = 'SuperAdminBayanTrack2026!';

let dbInitialized = false;
let dbInitPromise = null;

function getBootstrapAccounts() {
  return [
    {
      username: process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin',
      password: requireBootstrapSecret('BOOTSTRAP_ADMIN_PASSWORD', LOCAL_ADMIN_PASSWORD),
      role: 'admin',
      firstName: 'Admin',
      lastName: 'Bayan Track',
      email: process.env.BOOTSTRAP_ADMIN_EMAIL || 'adminbayantrack@gmail.com',
      contactNumber: process.env.BOOTSTRAP_ADMIN_CONTACT || '00000000002',
      address: 'Barangay Hall',
    },
    {
      username: process.env.BOOTSTRAP_SUPERADMIN_USERNAME || 'superAdmin123',
      password: requireBootstrapSecret('BOOTSTRAP_SUPERADMIN_PASSWORD', LOCAL_SUPERADMIN_PASSWORD),
      role: 'superadmin',
      firstName: 'Super',
      lastName: 'Admin',
      email: process.env.BOOTSTRAP_SUPERADMIN_EMAIL || 'superadminbayantrack@gmail.com',
      contactNumber: process.env.BOOTSTRAP_SUPERADMIN_CONTACT || '00000000001',
      address: 'City Hall',
    },
  ];
}

function requireBootstrapSecret(name, fallback) {
  const value = process.env[name] || fallback;
  if (isProductionEnv() && value === fallback) {
    throw new Error(`${name} must be set in production. Refusing to use a default bootstrap password.`);
  }
  return value;
}

function getMongoUri() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not set. Set MONGODB_URI in Vercel or MONGO_URI locally.');
  }

  return uri;
}

function getMongoConnectionOptions(uri) {
  const configuredDbName = process.env.MONGODB_DB_NAME || process.env.MONGO_DB_NAME;
  if (configuredDbName) {
    return { dbName: configuredDbName };
  }

  try {
    const dbNameFromUri = new URL(uri).pathname.replace(/^\/+|\/+$/g, '');
    if (!dbNameFromUri) {
      return { dbName: 'bayantrack' };
    }
  } catch (_err) {
    // Let mongoose report malformed MongoDB connection strings.
  }

  return undefined;
}

async function removeLegacyBootstrapAccounts() {
  await User.deleteMany({
    role: 'admin',
    $or: [
      { email: 'admin@bayantrack.com' },
      { username: 'admin123' },
      { contactNumber: '00000000000' },
    ],
  });
}

async function ensureMongoConnected(uri) {
  if (mongoose.connection.readyState === 1) return;

  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
    return;
  }

  await mongoose.connect(uri, getMongoConnectionOptions(uri));
}

async function findBootstrapAccountOwner(account) {
  return User.findOne({
    $or: [
      { username: account.username },
      { email: account.email },
      { contactNumber: account.contactNumber },
    ],
  });
}

async function hasConflictingUniqueValue(field, value, ownerId) {
  const conflict = await User.findOne({
    [field]: value,
    _id: { $ne: ownerId },
  })
    .select('_id')
    .lean();

  return Boolean(conflict);
}

async function repairBootstrapAccount(account) {
  const existing = await findBootstrapAccountOwner(account);
  const baseUpdate = {
    username: account.username,
    role: account.role,
    firstName: account.firstName,
    lastName: account.lastName,
    address: account.address,
    status: 'active',
    failedLoginAttempts: 0,
    lockUntil: null,
    ...(account.role === 'admin' ? { adminPermissions: DEFAULT_ADMIN_PERMISSIONS } : {}),
  };

  if (!existing) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(account.password, salt);
    await User.create({
      ...baseUpdate,
      email: account.email,
      contactNumber: account.contactNumber,
      password: hashedPassword,
    });
    return;
  }

  if (!(await hasConflictingUniqueValue('email', account.email, existing._id))) {
    baseUpdate.email = account.email;
  }

  if (!(await hasConflictingUniqueValue('contactNumber', account.contactNumber, existing._id))) {
    baseUpdate.contactNumber = account.contactNumber;
  }

  const passwordMatches = await bcrypt.compare(account.password, existing.password);
  if (!passwordMatches) {
    const salt = await bcrypt.genSalt(10);
    baseUpdate.password = await bcrypt.hash(account.password, salt);
  }

  await User.updateOne({ _id: existing._id }, baseUpdate);
}

async function connectAndSeed() {
  const uri = getMongoUri();

  await ensureMongoConnected(uri);

  if (dbInitialized) return;

  await removeLegacyBootstrapAccounts();

  for (const account of getBootstrapAccounts()) {
    await repairBootstrapAccount(account);
  }

  const departmentCount = await Department.countDocuments();
  if (departmentCount === 0) {
    await Department.insertMany([
      { name: 'Office of the Captain', contactPerson: 'Ms. Admin Staff', localNumber: '101' },
      { name: 'Barangay Secretary', contactPerson: 'Sec. Aquino', localNumber: '102' },
      { name: 'Health Center', contactPerson: 'Dr. Health Officer', localNumber: '103' },
      { name: 'Senior Citizen Desk', contactPerson: 'Head OSCA', localNumber: '104' },
      { name: 'Disaster / DRRM', contactPerson: 'Officer on Duty', localNumber: '105' },
    ]);
  }

  const announcementCount = await Announcement.countDocuments();
  if (announcementCount === 0) {
    await Announcement.insertMany([
      {
        title: 'Barangay General Assembly 2026',
        content: 'All residents are invited to the upcoming barangay general assembly at the covered court.',
        module: 'barangay-updates',
        category: 'Event',
        source: 'Barangay Council',
        featured: true,
      },
      {
        title: 'Emergency Hotline Numbers Updated',
        content: 'Updated emergency contact list is now available for all puroks.',
        module: 'emergency-hotlines',
        category: 'Advisory',
        source: 'DRRM Office',
        featured: true,
      },
      {
        title: 'PHIVOLCS Advisory: Stay Alert',
        content: 'No active major seismic threat reported, but continue monitoring official bulletins.',
        module: 'phivolcs-alerts',
        category: 'Alert',
        source: 'PHIVOLCS',
      },
      {
        title: 'Fact Check: No Official Cash Aid Registration Link',
        content: 'Any viral link claiming immediate barangay cash aid registration is not official.',
        module: 'fact-check',
        category: 'Fact Check',
        source: 'Barangay Information Office',
      },
    ]);
  }

  const officialCount = await Official.countDocuments();
  if (officialCount === 0) {
    await Official.insertMany([
      {
        name: 'Hon. Barangay Captain',
        role: 'Punong Barangay',
        level: 'barangay',
        rankOrder: 1,
        description: 'Leads barangay governance and local policy implementation.',
      },
      {
        name: 'Hon. Kagawad 1',
        role: 'Barangay Kagawad',
        level: 'barangay',
        rankOrder: 2,
        committee: 'Committee on Peace and Order',
      },
      {
        name: 'Hon. Kagawad 2',
        role: 'Barangay Kagawad',
        level: 'barangay',
        rankOrder: 3,
        committee: 'Committee on Health and Sanitation',
      },
    ]);
  }

  dbInitialized = true;
}

async function ensureDatabaseReady() {
  if (dbInitialized && mongoose.connection.readyState === 1) return;
  if (!dbInitPromise) {
    dbInitPromise = connectAndSeed().catch((err) => {
      dbInitPromise = null;
      throw err;
    });
  }
  await dbInitPromise;
}

function getRequestToken(req) {
  const headerToken = req.header('x-auth-token');
  const bearerToken = req.header('authorization')?.startsWith('Bearer ')
    ? req.header('authorization').replace('Bearer ', '')
    : null;
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME] || null;
  return headerToken || bearerToken || cookieToken || '';
}

async function isAdminRequest(req) {
  const token = getRequestToken(req);
  if (!token) return false;

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const userId = decoded?.user?.id;
    const embeddedAccount = getEmbeddedAccountById(userId);
    if (embeddedAccount) {
      return ['admin', 'superadmin'].includes(embeddedAccount.role);
    }

    if (!mongoose.Types.ObjectId.isValid(String(userId || ''))) return false;
    const user = await User.findById(userId).select('role status').lean();
    return Boolean(user && user.status === 'active' && ['admin', 'superadmin'].includes(user.role));
  } catch (_err) {
    return false;
  }
}

async function enforceMaintenanceMode(req, res, next) {
  if (req.path === '/ping' || req.path.startsWith('/admin') || req.path === '/auth/login' || req.path.startsWith('/emergency-alerts')) {
    return next();
  }

  const settings = await SystemSetting.findOne()
    .select('maintenanceMode maintenanceMessage')
    .lean();

  if (!settings?.maintenanceMode) {
    return next();
  }

  if (await isAdminRequest(req)) {
    return next();
  }

  return res.status(503).json({
    msg: settings.maintenanceMessage || 'The resident portal is temporarily under maintenance. Please try again later.',
  });
}

export function createServer() {
  validateRuntimeEnv();
  const app = express();

  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const corsMiddleware = cors((req, callback) => {
    const requestHost = req.headers.host;
    const forwardedHost = String(req.headers['x-forwarded-host'] || '');

    callback(null, {
      origin(origin, originCallback) {
        if (!origin) return originCallback(null, true);

        const normalizedOrigin = origin.replace(/\/$/, '');
        if (allowedOrigins.length === 0 || allowedOrigins.includes(normalizedOrigin)) {
          return originCallback(null, true);
        }

        try {
          const originHost = new URL(origin).host;
          if (originHost === requestHost || originHost === forwardedHost) {
            return originCallback(null, true);
          }
        } catch (_err) {
          // Fall through to the explicit CORS block below.
        }

        return originCallback(new Error('CORS blocked'));
      },
      credentials: true,
    });
  });

  app.use('/api', corsMiddleware);
  applySecurityMiddleware(app);

  app.use((req, res, next) => {
    const isViteDevFrontend =
      process.env.NODE_ENV !== 'production' && !req.path.startsWith('/api');

    if (isViteDevFrontend) {
      return next();
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(), camera=()');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "img-src 'self' data: https:",
        "font-src 'self' data: https:",
        "style-src 'self' 'unsafe-inline' https:",
        "script-src 'self'",
        "connect-src 'self' https: wss:",
        "frame-src 'self' https://www.google.com https://www.google.com/maps",
      ].join('; '),
    );
    if (req.secure || String(req.headers['x-forwarded-proto']).includes('https')) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  app.use(express.json({ limit: '8mb' }));
  app.use(express.urlencoded({ extended: true, limit: '8mb' }));
  app.use(sanitizeMongoPayloads);

  app.get('/api/ping', (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? 'ping';
    res.json({ message: ping });
  });

  app.use('/api/auth/login', authLimiter);
  app.use(['/api/auth/register', '/api/auth/register/check'], authLimiter);
  app.use([
    '/api/auth/send-otp',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/change-email/request-otp',
    '/api/auth/change-password/request-otp',
    '/api/auth/child-access/request-otp',
    '/api/auth/child-session/request-otp',
  ], otpLimiter);
  app.use(['/api/reports', '/api/contact/messages', '/api/subscriptions'], publicSubmitLimiter);

  app.use('/api', async (_req, _res, next) => {
    try {
      await ensureDatabaseReady();
      next();
    } catch (err) {
      console.error('MongoDB init failed:', err);
      next(err);
    }
  });
  app.use('/api', enforceMaintenanceMode);

  app.use('/api/auth', authRoutes);
  app.use('/api/announcements', announcementsRoutes);
  app.use('/api/services', servicesRoutes);
  app.use('/api/contact', contactRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/officials', officialsRoutes);
  app.use('/api/subscriptions', subscriptionsRoutes);
  app.use('/api/content', contentRoutes);
  app.use('/api/emergency-alerts', emergencyAlertRoutes);

  app.get('/api/demo', (_req, res) => {
    res.status(200).json({ message: 'Hello from Express server' });
  });

  return app;
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const app = createServer();
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
