import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import authRoutes from "./routes/auth.js";
import announcementsRoutes from "./routes/announcements.js";
import servicesRoutes from "./routes/services.js";
import contactRoutes from "./routes/contact.js";
import reportsRoutes from "./routes/reports.js";
import adminRoutes from "./routes/admin.js";
import officialsRoutes from "./routes/officials.js";
import subscriptionsRoutes from "./routes/subscriptions.js";
import contentRoutes from "./routes/content.js";
import User from "./models/User.js";
import Department from "./models/Department.js";
import Announcement from "./models/Announcement.js";
import Official from "./models/Official.js";
import { DEFAULT_ADMIN_PERMISSIONS, getBootstrapAccounts, type BootstrapAccount } from "./config/bootstrapAccounts";

let dbInitialized = false;
let dbInitPromise: Promise<void> | null = null;

dotenv.config();

async function findBootstrapAccountOwner(account: BootstrapAccount) {
  return User.findOne({
    $or: [
      { username: account.username },
      { email: account.email },
      { contactNumber: account.contactNumber },
    ],
  });
}

async function hasConflictingUniqueValue(field: "email" | "contactNumber", value: string, ownerId: unknown) {
  const conflict = await User.findOne({
    [field]: value,
    _id: { $ne: ownerId },
  })
    .select("_id")
    .lean();

  return Boolean(conflict);
}

async function repairBootstrapAccount(account: BootstrapAccount) {
  const existing = await findBootstrapAccountOwner(account);
  const baseUpdate: Record<string, unknown> = {
    username: account.username,
    role: account.role,
    firstName: account.firstName,
    lastName: account.lastName,
    address: account.address,
    status: "active",
    failedLoginAttempts: 0,
    lockUntil: null,
    ...(account.role === "admin" ? { adminPermissions: DEFAULT_ADMIN_PERMISSIONS } : {}),
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

  if (!(await hasConflictingUniqueValue("email", account.email, existing._id))) {
    baseUpdate.email = account.email;
  }

  if (!(await hasConflictingUniqueValue("contactNumber", account.contactNumber, existing._id))) {
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
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is not set");
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }

  if (dbInitialized) return;

  for (const account of getBootstrapAccounts()) {
    await repairBootstrapAccount(account);
  }

  const departmentCount = await Department.countDocuments();
  if (departmentCount === 0) {
    await Department.insertMany([
      { name: "Office of the Captain", contactPerson: "Ms. Admin Staff", localNumber: "101" },
      { name: "Barangay Secretary", contactPerson: "Sec. Aquino", localNumber: "102" },
      { name: "Health Center", contactPerson: "Dr. Health Officer", localNumber: "103" },
      { name: "Senior Citizen Desk", contactPerson: "Head OSCA", localNumber: "104" },
      { name: "Disaster / DRRM", contactPerson: "Officer on Duty", localNumber: "105" },
    ]);
  }

  const announcementCount = await Announcement.countDocuments();
  if (announcementCount === 0) {
    await Announcement.insertMany([
      {
        title: "Barangay General Assembly 2026",
        content: "All residents are invited to the upcoming barangay general assembly at the covered court.",
        module: "barangay-updates",
        category: "Event",
        source: "Barangay Council",
        featured: true,
      },
      {
        title: "Emergency Hotline Numbers Updated",
        content: "Updated emergency contact list is now available for all puroks.",
        module: "emergency-hotlines",
        category: "Advisory",
        source: "DRRM Office",
        featured: true,
      },
      {
        title: "PHIVOLCS Advisory: Stay Alert",
        content: "No active major seismic threat reported, but continue monitoring official bulletins.",
        module: "phivolcs-alerts",
        category: "Alert",
        source: "PHIVOLCS",
      },
      {
        title: "Fact Check: No Official Cash Aid Registration Link",
        content: "Any viral link claiming immediate barangay cash aid registration is not official.",
        module: "fact-check",
        category: "Fact Check",
        source: "Barangay Information Office",
      },
    ]);
  }

  const officialCount = await Official.countDocuments();
  if (officialCount === 0) {
    await Official.insertMany([
      {
        name: "Hon. Barangay Captain",
        role: "Punong Barangay",
        level: "barangay",
        rankOrder: 1,
        description: "Leads barangay governance and local policy implementation.",
      },
      {
        name: "Hon. Kagawad 1",
        role: "Barangay Kagawad",
        level: "barangay",
        rankOrder: 2,
        committee: "Committee on Peace and Order",
      },
      {
        name: "Hon. Kagawad 2",
        role: "Barangay Kagawad",
        level: "barangay",
        rankOrder: 3,
        committee: "Committee on Health and Sanitation",
      },
    ]);
  }

  dbInitialized = true;
}

async function ensureDatabaseReady() {
  if (dbInitialized) return;
  if (!dbInitPromise) {
    dbInitPromise = connectAndSeed().catch((err) => {
      dbInitPromise = null;
      throw err;
    });
  }
  await dbInitPromise;
}

export function createServer() {
  const app = express();

  // Middleware
  const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const corsMiddleware = cors((req, callback) => {
    const requestHost = req.headers.host;
    const forwardedHost = String(req.headers["x-forwarded-host"] || "");

    callback(null, {
      origin(origin, originCallback) {
        // Allow same-origin/non-browser requests.
        if (!origin) return originCallback(null, true);
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
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

        return originCallback(new Error("CORS blocked"));
      },
      credentials: true,
    });
  });

  app.use("/api", corsMiddleware);

  // Basic security headers.
  app.use((req, res, next) => {
    const isViteDevFrontend =
      process.env.NODE_ENV !== "production" && !req.path.startsWith("/api");

    if (isViteDevFrontend) {
      return next();
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(self), microphone=(), camera=()");
    res.setHeader(
      "Content-Security-Policy",
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
      ].join("; "),
    );
    // Only enable HSTS when behind HTTPS/tunnel.
    if (req.secure || String(req.headers["x-forwarded-proto"]).includes("https")) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use("/api", async (_req, _res, next) => {
    try {
      await ensureDatabaseReady();
      next();
    } catch (err) {
      console.error("MongoDB init failed:", err);
      next(err);
    }
  });

  // Keep API paths consistent in both dev and production.
  app.use("/api/auth", authRoutes);
  app.use("/api/announcements", announcementsRoutes);
  app.use("/api/services", servicesRoutes);
  app.use("/api/contact", contactRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/officials", officialsRoutes);
  app.use("/api/subscriptions", subscriptionsRoutes);
  app.use("/api/content", contentRoutes);

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  return app;
}
