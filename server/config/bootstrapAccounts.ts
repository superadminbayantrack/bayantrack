import { isProductionEnv } from "./env.js";

const LOCAL_ADMIN_PASSWORD = "AdminBayanTrack2026!";
const LOCAL_SUPERADMIN_PASSWORD = "SuperAdminBayanTrack2026!";

export type BootstrapAccount = {
  username: string;
  password: string;
  role: "admin" | "superadmin";
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  address: string;
};

export const DEFAULT_ADMIN_PERMISSIONS = {
  officials: { view: true, add: true, edit: true, archive: true, delete: true },
  announcements: { view: true, add: true, edit: true, archive: true, delete: true },
  reports: { view: true, add: true, edit: true, archive: true, delete: true },
  serviceRequests: { view: true, add: true, edit: true, archive: true, delete: true },
  messages: { view: true, add: true, edit: true, archive: true, delete: true },
  subscribers: { view: true, add: true, edit: true, archive: true, delete: true },
} as const;

function getBootstrapSecret(name: string, fallback: string) {
  const value = String(process.env[name] || "").trim();
  if (!isProductionEnv()) return value || fallback;

  if (!value || value === fallback) {
    console.warn(`${name} is missing or uses the local default. Skipping this bootstrap account in production.`);
    return null;
  }

  return value;
}

export function getBootstrapAccounts(): BootstrapAccount[] {
  const adminPassword = getBootstrapSecret("BOOTSTRAP_ADMIN_PASSWORD", LOCAL_ADMIN_PASSWORD);
  const superadminPassword = getBootstrapSecret("BOOTSTRAP_SUPERADMIN_PASSWORD", LOCAL_SUPERADMIN_PASSWORD);

  return [
    {
      username: process.env.BOOTSTRAP_ADMIN_USERNAME || "admin",
      password: adminPassword,
      role: "admin",
      firstName: "Admin",
      lastName: "Bayan Track",
      email: process.env.BOOTSTRAP_ADMIN_EMAIL || "adminbayantrack@gmail.com",
      contactNumber: process.env.BOOTSTRAP_ADMIN_CONTACT || "00000000002",
      address: "Barangay Hall",
    },
    {
      username: process.env.BOOTSTRAP_SUPERADMIN_USERNAME || "superAdmin123",
      password: superadminPassword,
      role: "superadmin",
      firstName: "Super",
      lastName: "Admin",
      email: process.env.BOOTSTRAP_SUPERADMIN_EMAIL || "superadminbayantrack@gmail.com",
      contactNumber: process.env.BOOTSTRAP_SUPERADMIN_CONTACT || "00000000001",
      address: "City Hall",
    },
  ].filter((account): account is BootstrapAccount => Boolean(account.password));
}
