# BayanTrack+ Diagram Master Prompt

Use this prompt when generating diagrams for the BayanTrack+ system.

```text
Analyze and create clear school-project diagrams for a system called BayanTrack+.

BayanTrack+ is a full-stack barangay digital portal for Barangay Mambog II, Bacoor, Cavite. It is built with React, Vite, TailwindCSS, Express, MongoDB, and Mongoose. The system supports residents, admins, and superadmins. It has a public website, resident services, resident profile management, admin dashboards, and barangay content management.

Create diagrams that are simple, clean, easy to understand, and suitable for a school project. Avoid overly technical wording. Use user-friendly labels such as "resident account", "service request", "report", "message", "announcement", and "barangay staff".

System Users / Actors:
1. Visitor
   - Can view public pages such as home, about, officials, announcements, services, emergency hotlines, weather, and contact information.
   - Can submit contact messages and issue reports if allowed by the system.
   - Can register for a resident account.

2. Resident
   - Can log in to the resident portal.
   - Can manage profile details.
   - Can change email or password using OTP verification.
   - Can add linked child access records.
   - Can submit service requests.
   - Can report issues, complaints, or rumors.
   - Can send contact messages to barangay departments.
   - Can view request/report history and updates.
   - Can receive email updates and notifications.

3. Admin
   - Can log in to the admin dashboard.
   - Can manage assigned modules based on permissions.
   - Can review users, service requests, issue reports, messages, announcements, officials, and subscribers depending on permission.
   - Can update statuses, add comments, and mark who handled a record.
   - Can view activity logs and notifications.

4. Superadmin
   - Has full system control.
   - Can manage all users, admins, permissions, and resident approvals.
   - Can approve or reject resident accounts and child access requests.
   - Can manage service catalog, departments, officials, announcements, messages, reports, subscribers, evacuation centers, emergency hotlines, website content, and system settings.
   - Can configure maintenance mode, registration availability, email notification mode, login lockout window, and other system settings.

Main System Modules:
1. Authentication and Account Management
   - Registration
   - Login
   - JWT session handling
   - OTP email verification
   - Forgot password and reset password
   - Resident profile settings
   - Child access request and approval
   - Admin and superadmin bootstrap accounts

2. Resident Profile Module
   - Stores resident personal information, address, contact details, valid ID information, avatar, civil status, and linked children.
   - Allows email/password changes through OTP.
   - Allows child profile updates and child access approval.

3. Service Request Module
   - Residents can request barangay services such as clearance, indigency, barangay ID, and other catalog items.
   - Requests have reference numbers, status, purpose, resident details, admin comments, handled-by staff, and status history.
   - Admins/superadmins can update request status and comments.

4. Issue Report Module
   - Residents or visitors can submit reports, complaints, hazards, or rumor reports.
   - Reports include category, description, optional attachments, status, admin comment, reference number, and handled-by staff.
   - Admins/superadmins can update, resolve, reject, archive, or delete reports.

5. Contact and Department Module
   - Public/resident users can send messages to barangay departments.
   - Messages include sender name, contact, selected department, message body, status, reference number, admin comment, and handled-by staff.
   - Departments include name, contact person, local number, email, phone, and active status.

6. Announcement and Public Content Module
   - Public users can view barangay updates, emergency hotlines, PHIVOLCS alerts, and fact checks.
   - Admins/superadmins can create, edit, archive, feature, and delete announcements.
   - Website content such as homepage, about page, services text, contact text, footer, and governance content can be edited by superadmin.

7. Officials Module
   - Stores barangay and city officials.
   - Includes name, role, level, rank order, committee, description, image, and active status.
   - Public users can view officials. Admins/superadmins can manage officials.

8. Subscriber Module
   - Visitors/residents can subscribe to updates using email.
   - Admins/superadmins can manage subscribers, status, comments, and handled-by staff.

9. Safety and Emergency Module
   - Stores emergency hotlines with name, type, number, description, when to call, and what to prepare.
   - Stores evacuation centers with name, address, capacity, hazards covered, location, notes, and active status.
   - Residents can view emergency information and nearest evacuation options.

10. Admin Dashboard Module
   - Dashboard summary
   - User management
   - Officials
   - Announcements
   - Reports
   - Service requests
   - Messages
   - Subscribers
   - Restore data
   - System notifications
   - Activity logs
   - System settings

11. System Settings Module
   - Controls resident registration, maintenance mode, maintenance message, auto-archive reports, announcement review, email digest, notification recipient mode, session timeout, and login lockout window.

12. Audit and Notification Module
   - Stores activity logs for important user/admin actions.
   - Sends email notifications for account approval, child access approval, OTP, password reset, report updates, service request updates, message updates, and subscriber updates.

13. Live Emergency Alert Module
   - Residents can send a live emergency alert from the chatbot during urgent situations such as fire, flood, theft, medical emergencies, or safety threats.
   - The alert sends the resident account details, current situation, latest location, and location update history to the admin and superadmin dashboards.
   - Barangay staff can acknowledge or resolve the alert and open the latest location in Google Maps.

Main Database Entities / Tables:
1. USER
   - PK: user_id
   - Important fields: username, email, contact_number, password_hash, role, status, first_name, middle_name, last_name, address, address_details, gender, civil_status, valid_id_type, valid_id_status, admin_permissions, failed_login_attempts, lock_until, created_at, updated_at
   - Stores residents, admins, and superadmins.

2. CHILD_ACCESS
   - PK: child_access_id
   - FK: parent_user_id -> USER.user_id
   - Important fields: child_full_name, child_email, birth_date, relationship, status, review_reason, reviewed_at
   - Logical table based on embedded User.children[] records.

3. OTP
   - PK: otp_id
   - Logical link: email -> USER.email
   - Important fields: otp_code, created_at, expires_at
   - Stores temporary email verification and password reset codes.

4. SYSTEM_SETTING
   - PK: setting_id
   - Important fields: allow_resident_registration, maintenance_mode, maintenance_message, auto_archive_reports, require_announcement_review, email_digest, notification_recipient_mode, session_timeout_minutes, lockout_window_minutes, developer_options_enabled

5. SERVICE_CATALOG
   - PK: service_catalog_id
   - Unique: code
   - Important fields: title, description, usage, requirements, processing_time, active, sort_order

6. SERVICE_REQUEST
   - PK: service_request_id
   - FK: user_id -> USER.user_id, optional
   - Recommended FK: service_catalog_id -> SERVICE_CATALOG.service_catalog_id
   - FK: handled_by_user_id -> USER.user_id, optional
   - Unique: reference_no
   - Important fields: full_name, contact_number, address, purpose, status, admin_comment, handled_by_name, handled_by_role, handled_at, created_at, updated_at

7. REQUEST_HISTORY
   - PK: history_id
   - FK: service_request_id -> SERVICE_REQUEST.service_request_id
   - FK: changed_by_user_id -> USER.user_id, optional
   - Important fields: status, note, changed_at
   - Logical table based on embedded ServiceRequest.history[] records.

8. ISSUE_REPORT
   - PK: report_id
   - FK: user_id -> USER.user_id, optional
   - FK: handled_by_user_id -> USER.user_id, optional
   - Unique: reference_no
   - Important fields: full_name, contact_number, address, category, description, status, admin_checked, admin_comment, handled_by_name, handled_by_role, handled_at, created_at, updated_at

9. REPORT_ATTACHMENT
   - PK: attachment_id
   - FK: report_id -> ISSUE_REPORT.report_id
   - Important fields: file_name, file_type, file_size, file_data_or_url
   - Logical table based on embedded IssueReport.attachments[] records.

10. DEPARTMENT
   - PK: department_id
   - Unique: name
   - Important fields: contact_person, local_number, email, phone, active

11. CONTACT_MESSAGE
   - PK: message_id
   - FK: user_id -> USER.user_id, optional
   - Recommended FK: department_id -> DEPARTMENT.department_id
   - FK: handled_by_user_id -> USER.user_id, optional
   - Unique: reference_no
   - Important fields: sender_name, sender_contact, message, status, admin_comment, handled_by_name, handled_by_role, handled_at, created_at, updated_at

12. SUBSCRIPTION
   - PK: subscription_id
   - FK: created_by_user_id -> USER.user_id, optional
   - FK: handled_by_user_id -> USER.user_id, optional
   - Unique: email
   - Important fields: status, source, admin_comment, handled_at, created_at, updated_at

13. ANNOUNCEMENT
   - PK: announcement_id
   - FK: created_by_user_id -> USER.user_id, optional
   - Important fields: title, content, module, category, source, image, featured, archived, created_at, updated_at

14. ACTIVITY_LOG
   - PK: activity_log_id
   - FK: user_id -> USER.user_id, optional
   - Important fields: actor_name, actor_role, type, title, reference_no, metadata, created_at

15. SITE_CONTENT
   - PK: site_content_id
   - FK: updated_by_user_id -> USER.user_id, optional
   - Important fields: homepage content, about content, contact content, service page content, footer content, community cards, governance items, updated_at

16. OFFICIAL
   - PK: official_id
   - Important fields: name, role, level, rank_order, committee, description, image, active

17. EVACUATION_CENTER
   - PK: evacuation_center_id
   - Important fields: name, address, capacity, hazards_covered, latitude, longitude, notes, active

18. EMERGENCY_HOTLINE
   - PK: emergency_hotline_id
   - Important fields: name, type, number, description, when_to_call, what_to_prepare, active

19. EMERGENCY_ALERT
   - PK: emergency_alert_id
   - FK: user_id -> USER.user_id
   - Unique: reference_no
   - Important fields: situation, status, resident_snapshot, latest_latitude, latest_longitude, accuracy, latest_location_time, admin_comment, handled_by_user_id, handled_by_name, handled_by_role, handled_at, created_at, updated_at

20. EMERGENCY_LOCATION_HISTORY
   - PK: location_history_id
   - FK: emergency_alert_id -> EMERGENCY_ALERT.emergency_alert_id
   - Important fields: latitude, longitude, accuracy, heading, speed, recorded_at
   - Logical table based on embedded EmergencyAlert.locationHistory[] records.

Main Relationships and Cardinality:
1. USER 1 to many CHILD_ACCESS
   - One parent user can have zero or many linked child access records.
   - Each child access record belongs to exactly one parent user.

2. USER 0/1 to many OTP
   - OTP records are temporary and linked by email.
   - A user may have zero or many OTP records over time.

3. USER 0/1 to many SERVICE_REQUEST
   - A resident can submit many service requests.
   - A request may belong to a registered user or may be nullable depending on the form rules.

4. SERVICE_CATALOG 1 to many SERVICE_REQUEST
   - One service type can be used by many service requests.
   - Current code stores service type as text, but a foreign key is recommended.

5. SERVICE_REQUEST 1 to many REQUEST_HISTORY
   - One service request can have many status history records.
   - Each history record belongs to exactly one service request.

6. USER 0/1 to many REQUEST_HISTORY
   - A staff user may be the one who changed a request status.

7. USER 0/1 to many ISSUE_REPORT
   - A resident can submit many issue reports.
   - Some reports may be submitted without a logged-in user.

8. ISSUE_REPORT 1 to many REPORT_ATTACHMENT
   - One report can have zero or many attachments.
   - Each attachment belongs to exactly one report.

9. USER 0/1 to many CONTACT_MESSAGE
   - A resident can send many contact messages.
   - A public visitor may also send a message.

10. DEPARTMENT 1 to many CONTACT_MESSAGE
   - One department can receive many messages.
   - Current code stores department as text, but a foreign key is recommended.

11. USER 0/1 to many SUBSCRIPTION
   - A user may create or handle subscriber records.

12. USER 0/1 to many ANNOUNCEMENT
   - Admins or superadmins can create many announcements.

13. USER 0/1 to many ACTIVITY_LOG
   - A user may generate many activity logs.
   - Some logs may be system-generated.

14. USER 0/1 to SITE_CONTENT
   - A user may be recorded as the last staff member who updated website content.

15. USER 0/1 to many handled records
   - A staff user can handle many service requests, reports, contact messages, or subscriptions.

16. USER 1 to many EMERGENCY_ALERT
   - One resident can send many live emergency alerts.
   - Each emergency alert belongs to exactly one resident account.

17. EMERGENCY_ALERT 1 to many EMERGENCY_LOCATION_HISTORY
   - One live alert can have many location updates while the resident is sharing location.
   - Each location update belongs to exactly one emergency alert.

No many-to-many junction table is required in the current scope. If the system later allows multiple staff members to handle one report/request/message, add a STAFF_ASSIGNMENT table.

Recommended missing or future tables:
1. STAFF_ASSIGNMENT
   - For assigning multiple barangay staff to one request, report, message, or subscriber record.
2. EMAIL_NOTIFICATION_LOG
   - For recording sent OTPs, account approval emails, update emails, and delivery status.
3. ROLE_PERMISSION
   - For normalizing admin permissions instead of storing them inside USER.
4. USER_NOTIFICATION
   - For storing in-app notifications that users can read later.
5. DEPARTMENT_ID in CONTACT_MESSAGE
   - Recommended replacement for text-only department routing.
6. SERVICE_CATALOG_ID in SERVICE_REQUEST
   - Recommended replacement for text-only service type.

Diagram Instructions:
- If creating an ERD, use Crow's Foot notation.
- Show primary keys, foreign keys, unique fields, and major attributes.
- Use simple labels and readable grouping.
- For optional relationships, show zero-or-one or zero-or-many.
- For required child records, show exactly-one parent.
- For MongoDB embedded records, show them as logical child tables.
- Add a small assumptions box explaining that the actual database is MongoDB but shown like relational tables for school documentation.
- Keep the diagram clean and not overcrowded.
```
