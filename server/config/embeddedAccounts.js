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
    password: 'superAdmin123',
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
    password: 'admin',
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

function matchesIdentifier(account, identifier) {
  const normalizedIdentifier = String(identifier || '').trim().toLowerCase();
  if (!normalizedIdentifier) return false;
  return [account.username, account.email, account.contactNumber]
    .map((value) => String(value || '').trim().toLowerCase())
    .includes(normalizedIdentifier);
}

export function findEmbeddedAccount(identifier, password) {
  const normalizedPassword = String(password || '');
  const account = EMBEDDED_ACCOUNTS.find((item) => matchesIdentifier(item, identifier) && item.password === normalizedPassword);
  return cloneAccount(account);
}

export function getEmbeddedAccountByIdentifier(identifier) {
  const account = EMBEDDED_ACCOUNTS.find((item) => matchesIdentifier(item, identifier));
  return cloneAccount(account);
}

export function isReservedEmbeddedIdentity(values = {}) {
  return [values.username, values.email, values.contactNumber]
    .filter(Boolean)
    .some((value) => Boolean(getEmbeddedAccountByIdentifier(value)));
}

export function getEmbeddedAccountById(id) {
  const account = EMBEDDED_ACCOUNTS.find((item) => item.id === id);
  return cloneAccount(account);
}
