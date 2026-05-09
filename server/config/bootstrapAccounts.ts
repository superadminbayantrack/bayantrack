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

export function getBootstrapAccounts(): BootstrapAccount[] {
  return [
    {
      username: process.env.BOOTSTRAP_ADMIN_USERNAME || "admin123",
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD || "admin123",
      role: "admin",
      firstName: "Admin",
      lastName: "User",
      email: process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@bayantrack.com",
      contactNumber: process.env.BOOTSTRAP_ADMIN_CONTACT || "00000000000",
      address: "Barangay Hall",
    },
    {
      username: process.env.BOOTSTRAP_SUPERADMIN_USERNAME || "superAdmin123",
      password: process.env.BOOTSTRAP_SUPERADMIN_PASSWORD || "superAdmin123",
      role: "superadmin",
      firstName: "Super",
      lastName: "Admin",
      email: process.env.BOOTSTRAP_SUPERADMIN_EMAIL || "superadminbayantrack@gmail.com",
      contactNumber: process.env.BOOTSTRAP_SUPERADMIN_CONTACT || "00000000001",
      address: "City Hall",
    },
  ];
}
