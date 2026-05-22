export const DEFAULT_ADMIN_PERMISSIONS = {
  officials: { view: true, add: true, edit: true, archive: true, delete: true },
  announcements: { view: true, add: true, edit: true, archive: true, delete: true },
  reports: { view: true, add: true, edit: true, archive: true, delete: true },
  serviceRequests: { view: true, add: true, edit: true, archive: true, delete: true },
  messages: { view: true, add: true, edit: true, archive: true, delete: true },
  subscribers: { view: true, add: true, edit: true, archive: true, delete: true },
};

const EMBEDDED_ACCOUNTS = [
  {
    id: 'embedded:superadmin',
    username: 'superAdmin123',
    password: process.env.EMBEDDED_SUPERADMIN_PASSWORD || '',
    role: 'superadmin',
    firstName: 'Super',
    lastName: 'Admin',
    email: 'superadminbayantrack@gmail.com',
    contactNumber: '00000000001',
    address: 'BayanTrack Embedded Access',
    status: 'active',
    adminPermissions: DEFAULT_ADMIN_PERMISSIONS,
  },
  {
    id: 'embedded:admin',
    username: 'admin',
    password: process.env.EMBEDDED_ADMIN_PASSWORD || '',
    role: 'admin',
    firstName: 'Admin',
    lastName: 'Bayan Track',
    email: 'adminbayantrack@gmail.com',
    contactNumber: '00000000002',
    address: 'BayanTrack Embedded Access',
    status: 'active',
    adminPermissions: DEFAULT_ADMIN_PERMISSIONS,
  },
];

function cloneAccount(account) {
  if (!account) return null;
  return {
    ...account,
    adminPermissions: { ...account.adminPermissions },
  };
}

function embeddedAccountsEnabled() {
  return String(process.env.ALLOW_EMBEDDED_ACCOUNTS || '').toLowerCase() === 'true';
}

function matchesIdentifier(account, identifier) {
  const normalizedIdentifier = String(identifier || '').trim().toLowerCase();
  if (!normalizedIdentifier) return false;
  return [account.username, account.email, account.contactNumber]
    .map((value) => String(value || '').trim().toLowerCase())
    .includes(normalizedIdentifier);
}

export function findEmbeddedAccount(identifier, password) {
  if (!embeddedAccountsEnabled()) return null;
  const normalizedPassword = String(password || '');
  if (!normalizedPassword) return null;
  const account = EMBEDDED_ACCOUNTS.find((item) => matchesIdentifier(item, identifier) && item.password === normalizedPassword);
  return cloneAccount(account);
}

export function getEmbeddedAccountByIdentifier(identifier) {
  if (!embeddedAccountsEnabled()) return null;
  const account = EMBEDDED_ACCOUNTS.find((item) => matchesIdentifier(item, identifier));
  return cloneAccount(account);
}

export function isReservedEmbeddedIdentity(values = {}) {
  return [values.username, values.email, values.contactNumber]
    .filter(Boolean)
    .some((value) => EMBEDDED_ACCOUNTS.some((item) => matchesIdentifier(item, value)));
}

export function getEmbeddedAccountById(id) {
  if (!embeddedAccountsEnabled()) return null;
  const account = EMBEDDED_ACCOUNTS.find((item) => item.id === id);
  return cloneAccount(account);
}
