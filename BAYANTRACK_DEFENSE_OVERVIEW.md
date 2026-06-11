# BayanTrack Defense Overview

Use this as a study copy for system defense. It summarizes the project in simple but technical terms.

## 1. Project Summary

BayanTrack is a full-stack barangay digital portal for Barangay Mambog II, Bacoor, Cavite.

The system helps residents and barangay staff handle:

- Resident registration and account approval
- Login and secure resident portal access
- Barangay service requests
- Issue reports and rumor/fact-check reports
- Contact messages to barangay departments
- Announcements and public information
- Emergency hotlines and evacuation data
- Live emergency alerts with location and chat
- Admin and superadmin management dashboards
- Notifications, activity logs, and system settings

Main goal:

> To make barangay services, updates, reporting, and resident communication faster, more organized, and easier to monitor.

## 2. Technology Stack

Frontend:

- React 18
- TypeScript
- Vite
- React Router
- TailwindCSS
- Radix UI components
- Lucide React icons
- Axios for API requests
- TanStack Query provider

Backend:

- Node.js
- Express.js
- JavaScript and TypeScript server entry files
- Mongoose ODM
- JWT authentication
- bcryptjs password hashing
- Nodemailer for email and OTP
- Helmet security middleware
- Express rate limiting
- Cookie parser
- Compression middleware

Database:

- MongoDB Atlas
- Mongoose schemas/models
- Document-based collections

Deployment:

- Vercel for frontend and serverless API deployment
- MongoDB Atlas for cloud database
- Environment variables for secrets and configuration

Testing and checks:

- TypeScript typecheck
- Vitest
- Production build check
- pnpm audit for dependency vulnerabilities

## 3. Architecture Overview

High-level flow:

```text
Browser / User Interface
  -> React frontend
  -> Axios API request
  -> Express API route
  -> Middleware validation / auth / role check
  -> Mongoose model
  -> MongoDB Atlas
  -> JSON response
  -> React updates the UI
```

Deployment flow:

```text
User
  -> Vercel hosted website
  -> /api routes handled by serverless Express app
  -> MongoDB Atlas database
```

The system is mostly a monolithic full-stack app:

- One React frontend
- One Express backend
- One MongoDB database
- Shared deployment through Vercel

## 4. User Roles

### Visitor

Can:

- View public pages
- View announcements
- View officials
- View services information
- View emergency information
- Submit contact messages
- Submit reports where allowed
- Register for a resident account

Cannot:

- Access resident dashboard
- Access admin dashboard
- Manage records

### Resident

Can:

- Log in after account approval
- Manage profile information
- Change email/password using OTP
- Submit service requests
- Report issues or rumors
- Send contact messages
- View own request history
- View notifications
- Use chatbot and emergency alert features
- Request linked child access

Cannot:

- Access admin records
- Approve users
- Manage announcements
- Manage system settings

### Admin

Can:

- Access admin dashboard
- Manage assigned modules depending on permissions
- Review residents
- Manage reports, messages, service requests, subscribers, officials, and announcements if permitted
- Update statuses and comments
- View notifications and activity logs

Cannot:

- Fully control system settings unless allowed
- Manage superadmin-level functions
- Delete protected superadmin account

### Superadmin

Can:

- Full dashboard access
- Manage residents, admins, and permissions
- Approve/reject resident accounts
- Manage announcements, reports, services, messages, subscribers, officials
- Manage website content
- Manage emergency hotlines and evacuation centers
- Manage system settings
- View activity logs and notifications

## 5. Main Modules

### Authentication Module

Main functions:

- Register resident account
- Send OTP for registration
- Login using username, email, or phone
- Normalize phone login formats such as `09XXXXXXXXX`, `639XXXXXXXXX`, and `+639XXXXXXXXX`
- Login approved linked child account
- Keep child-session metadata available after login so the child avatar and name stay visible in the UI
- Logout
- Forgot password
- Reset password with OTP
- Lock account after failed login attempts
- Store secure session through httpOnly cookie
- Auto logout focus-away resident and child sessions after 2 minutes, and admin/superadmin sessions after 3 minutes, with a session-expired feedback message
- Use a short login grace window so fresh logins do not get cleared by an early 401 while cookies settle

Important backend routes:

- `POST /api/auth/send-otp`
- `POST /api/auth/register/check`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/user`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### Resident Profile Module

Main functions:

- View own profile
- Update name, address, gender, civil status, contact number
- Upload avatar/valid ID data
- Request email change OTP
- Request password change OTP
- Add linked child access request
- Update approved child name, email, and profile photo through parent OTP
- Show linked child avatars beside the child names in the parent account list
- Load profile activity separately so child sessions are not forced to log out when activity logs are unavailable

Important backend routes:

- `GET /api/auth/user`
- `PUT /api/auth/user`
- `POST /api/auth/change-email/request-otp`
- `POST /api/auth/change-password/request-otp`
- `POST /api/auth/child-access/request-otp`
- `POST /api/auth/child-access/verify`
- `POST /api/auth/child-session/request-otp`
- `PUT /api/auth/child-session/update`

### Service Request Module

Main functions:

- Resident requests barangay services
- Supports Barangay Clearance, Barangay ID, Certificate of Residency, and Certificate of Indigency
- Blocks duplicate same-day document requests unless the previous request is rejected or cancelled
- Allows requirement uploads as image/PDF metadata stored with the request
- Supports requesting on behalf of another person with beneficiary details
- Service request gets reference number
- Resident can view own service request history
- Admin can update status and comment
- Admin can mark request pending, in-review, approved, for-pickup, released, rejected, cancelled, or completed
- Released requests generate issued document tracking details and verification code

Important backend routes:

- `GET /api/services/catalog`
- `POST /api/services/requests`
- `GET /api/services/requests/me`
- `GET /api/services/requests/track/:referenceNo`
- `GET /api/services/requests`
- `PATCH /api/services/requests/:id/status`
- `PUT /api/services/requests/:id`
- `DELETE /api/services/requests/:id`

### Issue Report Module

Main functions:

- Resident or visitor can submit reports
- Supports community issue reports, complaints, and incident reports
- Supports priority/urgency and optional reported location coordinates
- Supports issue categories and optional image attachments
- Generates report reference number
- Admin can view, update, resolve, reject, or delete reports
- Admin can assign department/personnel and add blotter, case, and hearing schedule details
- Resident activity and notifications can show report updates and hearing schedule information
- Report updates can notify resident/admins through email

Important backend routes:

- `POST /api/reports`
- `GET /api/reports/me`
- `GET /api/reports`
- `GET /api/reports/:id`
- `PUT /api/reports/:id`
- `PATCH /api/reports/:id/status`
- `DELETE /api/reports/:id`

### Announcements Module

Main functions:

- Public users can view announcements
- Supports modules/categories:
  - All news and updates
  - Barangay updates
  - Emergency hotlines
  - PHIVOLCS alerts
  - Fact checks
- Admin/superadmin can create, edit, archive, restore, or delete announcements
- Announcement can include event date, time, location, source, image, status, and featured flag

Important backend routes:

- `GET /api/announcements`
- `GET /api/announcements/all`
- `POST /api/announcements`
- `PUT /api/announcements/:id`
- `PATCH /api/announcements/:id/archive`
- `DELETE /api/announcements/:id`

### Contact and Department Module

Main functions:

- Visitor/resident sends message to barangay department
- Admin can review, update, close, or delete messages
- Superadmin can manage department list

Important backend routes:

- `GET /api/contact/departments`
- `POST /api/contact/departments`
- `PUT /api/contact/departments/:id`
- `DELETE /api/contact/departments/:id`
- `POST /api/contact/messages`
- `GET /api/contact/messages`
- `PATCH /api/contact/messages/:id/status`
- `PUT /api/contact/messages/:id`
- `DELETE /api/contact/messages/:id`

### Officials Module

Main functions:

- Public can view officials
- Admin/superadmin can manage official records
- Stores name, role, level, committee, rank order, image, and active status

Important backend routes:

- `GET /api/officials`
- `GET /api/officials/all`
- `POST /api/officials`
- `PUT /api/officials/:id`
- `DELETE /api/officials/:id`

### Subscriber Module

Main functions:

- User can subscribe using email
- Admin can manage subscribers
- Supports active/unsubscribed status

Important backend routes:

- `POST /api/subscriptions`
- `GET /api/subscriptions`
- `PATCH /api/subscriptions/:id/status`
- `PUT /api/subscriptions/:id`
- `DELETE /api/subscriptions/:id`

### Emergency and Safety Module

Main functions:

- Public/residents can view emergency hotlines
- Residents can view evacuation center information
- Resident can request nearest evacuation center
- Superadmin can manage hotlines and centers

Important backend routes:

- `GET /api/services/emergency-hotlines`
- `POST /api/services/emergency-hotlines`
- `PUT /api/services/emergency-hotlines/:id`
- `PATCH /api/services/emergency-hotlines/:id/archive`
- `DELETE /api/services/emergency-hotlines/:id`
- `GET /api/services/evacuation-centers/public`
- `GET /api/services/evacuation-centers`
- `POST /api/services/evacuation-centers`
- `PUT /api/services/evacuation-centers/:id`
- `DELETE /api/services/evacuation-centers/:id`
- `GET /api/services/evacuation/nearest`

### Live Emergency Alert Module

Main functions:

- Resident can send emergency situation from chatbot
- System stores resident snapshot and current location
- System tracks location history
- Admin/superadmin can view live alert
- Staff and resident can live chat
- Staff can end chat or resolve alert
- Resident can submit rating/comment after resolution

Important backend routes:

- `POST /api/emergency-alerts`
- `GET /api/emergency-alerts`
- `GET /api/emergency-alerts/:id/messages`
- `POST /api/emergency-alerts/:id/messages`
- `PATCH /api/emergency-alerts/:id/end-chat`
- `PATCH /api/emergency-alerts/:id/rating`
- `PATCH /api/emergency-alerts/:id/typing`
- `PATCH /api/emergency-alerts/:id/location`
- `PATCH /api/emergency-alerts/:id/cancel`
- `PATCH /api/emergency-alerts/:id/status`
- `PATCH /api/emergency-alerts/:id/archive`
- `DELETE /api/emergency-alerts/:id`

### Admin Dashboard Module

Main functions:

- Dashboard summaries
- User management
- Officials management
- Announcements management
- Reports management
- Service requests management
- Contact messages
- Subscribers
- Live emergency alerts
- Restore/archive records
- Notifications
- Recent activity
- System settings
- Website content editing

### System Settings Module

Main functions:

- Allow or disable resident registration
- Maintenance mode and maintenance message
- Auto archive reports
- Announcement review requirement
- Email digest option
- Notification recipient mode
- Session timeout
- Login lockout window

Important backend routes:

- `GET /api/admin/system-settings`
- `PATCH /api/admin/system-settings`

### Activity Log and Notification Module

Main functions:

- Logs important user/admin actions
- Shows recent system activity
- Shows notification count and items
- Supports clear notifications

Important backend routes:

- `GET /api/admin/activity`
- `GET /api/admin/activity/me`
- `GET /api/admin/notifications`
- `PATCH /api/admin/notifications/clear`
- `GET /api/auth/notifications`
- `PATCH /api/auth/notifications/clear`

## 6. Main Database Collections

### User

Purpose:

- Stores residents, admins, and superadmins.

Important fields:

- username
- firstName, middleName, lastName
- email
- contactNumber
- password hash
- role
- status
- validIdStatus
- address and addressDetails
- gender
- civilStatus
- children including child name, email, status, and avatarImage
- failedLoginAttempts
- lockUntil
- adminPermissions

### Otp

Purpose:

- Stores temporary OTP codes for registration, password reset, email change, password change, and child access.

Important fields:

- email
- otp
- createdAt with expiration

### Announcement

Purpose:

- Stores public updates, barangay news, emergency advisories, PHIVOLCS alerts, and fact checks.

Important fields:

- title
- content
- module
- category
- source
- eventDate
- eventTime
- location
- status
- featured
- archived
- createdBy

### ServiceRequest

Purpose:

- Stores resident requests for barangay services.

Important fields:

- user
- serviceType
- fullName
- contactNumber
- address
- purpose
- status
- referenceNo
- adminComment
- handledBy
- history

### IssueReport

Purpose:

- Stores issue reports, complaints, rumors, or hazards.

Important fields:

- user
- fullName
- contactNumber
- address
- category
- description
- attachments
- status
- adminComment
- handledBy
- referenceNo

### ContactMessage

Purpose:

- Stores messages sent to barangay departments.

Important fields:

- user
- name
- contact
- department
- message
- status
- referenceNo
- adminComment
- handledBy

### Department

Purpose:

- Stores barangay department routing details.

Important fields:

- name
- contactPerson
- localNumber
- email
- phone
- active

### Official

Purpose:

- Stores barangay/city official information.

Important fields:

- name
- role
- level
- rankOrder
- committee
- description
- image
- active

### Subscription

Purpose:

- Stores email subscribers.

Important fields:

- email
- status
- source
- createdBy
- handledBy
- adminComment

### EmergencyAlert

Purpose:

- Stores live emergency alerts, latest location, location history, live chat messages, typing state, status, and rating.

Important fields:

- user
- referenceNo
- situation
- status
- residentSnapshot
- currentLocation
- locationHistory
- chatMessages
- typing
- archived
- residentRating
- residentRatingComment
- handledBy

### EmergencyHotline

Purpose:

- Stores emergency contact information.

Important fields:

- name
- type
- number
- description
- whenToCall
- whatToPrepare
- active

### EvacuationCenter

Purpose:

- Stores evacuation center data.

Important fields:

- name
- address
- location
- hazardsCovered
- capacity
- notes
- active

### SiteContent

Purpose:

- Stores editable public website content.

Important fields:

- home page content
- about page content
- contact page content
- services content
- footer content
- governance cards

### ActivityLog

Purpose:

- Stores important system actions for audit trail and dashboard recent activity.

Important fields:

- user
- actorName
- actorRole
- type
- title
- referenceNo
- metadata
- createdAt

### NotificationState

Purpose:

- Tracks when a user/admin last cleared notifications.

Important fields:

- actorId
- clearedAt

### SystemSetting

Purpose:

- Stores global admin-controlled system settings.

Important fields:

- allowResidentRegistration
- maintenanceMode
- maintenanceMessage
- autoArchiveReports
- requireAnnouncementReview
- emailDigest
- notificationRecipientMode
- sessionTimeoutMinutes
- lockoutWindowMinutes

## 7. Security Features

Implemented:

- Password hashing with bcrypt
- JWT session handling
- httpOnly cookie support
- Role-based access control
- Admin module permissions
- OTP verification
- Account lockout after failed attempts
- Server-side phone normalization for login and registration duplicate checks
- Express rate limiting
- Helmet security headers
- CORS origin checks
- Mongo payload sanitization
- Input validation for email, phone, required fields, statuses
- Child profile photo validation for allowed image data and size limit
- Duplicate same-day document request prevention for resident service requests
- Requirement upload validation for resident document requests
- Report type, priority, and optional location validation for community reports
- Role-based inactivity/focus-away logout with clear session-expired feedback
- Resident and linked child sessions time out after 2 minutes away from the site; admin and superadmin sessions time out after 3 minutes away
- Fresh logins get a short grace period before auth 401 responses can force a logout redirect
- Read-only auth refresh requests retry quietly so a temporary 401 does not force logout
- Protected admin and superadmin routes
- Environment variables for secrets
- Activity logs for important actions

Important defense answer:

> Passwords are hashed using bcrypt, protected routes use JWT verification, and admin features are restricted through roles and module permissions.

## 8. Upload and File Safety

Current implementation:

- The system does not save uploaded files directly into a public server folder.
- Attachments are stored as data URLs in MongoDB.
- Report attachments are limited to image data.
- Service request requirements are stored as controlled image/PDF data URL metadata for school-scope demonstration.
- Live chat attachments are normalized and size-limited.
- Filenames are stored only as metadata, not used as server paths.

Why this matters:

- A malicious filename like `../../shell.php` will not be written to the web root by the current implementation.
- The main risk is database bloat or large base64 payloads, not direct PHP execution.

Production improvement:

- Use Cloudinary, AWS S3, or Cloudflare R2.
- Backend generates signed upload URL.
- Browser uploads file directly to object storage.
- Database stores only secure file URL and metadata.

## 9. Performance Features

Implemented:

- MongoDB indexes on common queries
- Pagination helper available in backend
- Limited dashboard and list fetches in several routes
- Compression middleware
- Vercel/CDN static asset hosting
- Public attachment data excluded from list routes where possible
- Dashboard uses `Promise.allSettled`, so one failed section should not crash all sections

Future improvements:

- Redis cache for public data
- CDN caching headers for public announcements, officials, hotlines, and site content
- Cloud storage for attachments
- WebSocket or SSE for live chat and alerts
- Code splitting for the large dashboard bundle

## 10. Deployment Setup

Current deployment:

- Vercel hosts the frontend and serverless API routes.
- MongoDB Atlas stores system data.
- Environment variables are configured in Vercel.

Important environment variables:

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `MAIL_SERVICE`
- `MAIL_USER`
- `MAIL_PASS`
- `MAIL_FROM`
- `NOTIFICATION_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_SUPERADMIN_PASSWORD`

Defense answer:

> The system is cloud deployed through Vercel, while MongoDB Atlas stores the data. Sensitive values are managed through environment variables instead of hardcoding them in source code.

## 11. Testing and Validation

Recent checks performed:

- `pnpm typecheck` passed
- `pnpm test` passed
- `pnpm build` passed
- `pnpm audit --prod` found no known vulnerabilities

Manual flows to test before defense:

- Resident login/logout
- Login using registered phone number
- Superadmin login/logout
- Resident registration validation
- OTP request
- Profile update
- Child-session profile photo update with parent OTP
- Child login stays active after redirect and still shows the linked child avatar
- Profile Settings opens without logging out child sessions even if activity logs fail to load
- Duplicate same-day service request blocking
- Requirement upload and request-on-behalf flow
- Admin marks service request for pickup/released and issued document tracking appears
- Complaint/incident/community report with priority and location
- Admin adds hearing schedule connected to a report
- Service request submit
- Report issue submit
- Announcement view and admin edit
- Dashboard load
- Notification clear
- Resident, child, admin, and superadmin inactivity/session-timeout feedback
- Live emergency alert/chat if included in demo

## 12. Common Panel Questions and Short Answers

### What problem does BayanTrack solve?

BayanTrack solves manual and delayed barangay communication by letting residents access services, reports, announcements, emergency information, and updates online.

### What makes it different from simple CRUD?

It includes role-based access, OTP, resident approval, service tracking, issue reporting, emergency alert with location/chat, notifications, activity logs, permissions, and system settings.

### How does login work?

The backend checks the username/email/phone, compares the password using bcrypt, checks account status and lockout state, then creates a JWT session stored in an httpOnly cookie.

### How are passwords secured?

Passwords are hashed with bcrypt before saving to MongoDB. The system never needs to store plain text passwords.

### How do you prevent unauthorized access?

Protected API routes require authentication. Admin and superadmin routes also require role checks and module permission checks.

### What if someone uploads a malicious PHP file?

The system does not write uploads directly to a public server folder. Attachments are stored as controlled data URLs and metadata in MongoDB. For production, uploads should move to cloud object storage with signed URLs.

### Why MongoDB?

MongoDB fits because many records are document-like, such as resident profiles, linked children, request history, report attachments, and live chat messages.

### Can the system scale?

For the current school scope, Vercel and MongoDB Atlas are enough. For larger scale, the system can add Redis caching, cloud object storage, CDN caching, and WebSocket/SSE for live updates.

### What are the limitations?

Current limitations include base64 file storage, polling-based live chat, limited automated tests, and no dedicated Redis cache yet.

### What future improvements do you recommend?

Cloud storage for uploads, Redis cache, WebSocket live chat, automated backups, monitoring, error tracking, more tests, and dashboard code splitting.

## 13. Presentation Flow

Recommended explanation order:

1. Problem
2. Objectives
3. Target users
4. System modules
5. Architecture
6. Database design
7. Security
8. Demo
9. Testing
10. Limitations
11. Future improvements

## 14. Strong Closing Statement

> BayanTrack was built to make barangay services more accessible and organized. It supports residents, admins, and superadmins through a secure portal with service requests, reports, announcements, emergency support, notifications, and activity monitoring. The system is already functional for school project scope, and its future improvements are clear: cloud storage, caching, real-time infrastructure, monitoring, and stronger automated testing.
