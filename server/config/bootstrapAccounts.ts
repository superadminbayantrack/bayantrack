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

function requireBootstrapSecret(name: string, fallback: string) {
  const value = process.env[name] || fallback;
  if (isProductionEnv() && value === fallback) {
    throw new Error(`${name} must be set in production. Refusing to use a default bootstrap password.`);
  }
  return value;
}

export function getBootstrapAccounts(): BootstrapAccount[] {
  return [
    {
      username: process.env.BOOTSTRAP_ADMIN_USERNAME || "admin",
      password: requireBootstrapSecret("BOOTSTRAP_ADMIN_PASSWORD", LOCAL_ADMIN_PASSWORD),
      role: "admin",
      firstName: "Admin",
      lastName: "Bayan Track",
      email: process.env.BOOTSTRAP_ADMIN_EMAIL || "adminbayantrack@gmail.com",
      contactNumber: process.env.BOOTSTRAP_ADMIN_CONTACT || "00000000002",
      address: "Barangay Hall",
    },
    {
      username: process.env.BOOTSTRAP_SUPERADMIN_USERNAME || "superAdmin123",
      password: requireBootstrapSecret("BOOTSTRAP_SUPERADMIN_PASSWORD", LOCAL_SUPERADMIN_PASSWORD),
      role: "superadmin",
      firstName: "Super",
      lastName: "Admin",
      email: process.env.BOOTSTRAP_SUPERADMIN_EMAIL || "superadminbayantrack@gmail.com",
      contactNumber: process.env.BOOTSTRAP_SUPERADMIN_CONTACT || "00000000001",
      address: "City Hall",
    },
  ];
}
