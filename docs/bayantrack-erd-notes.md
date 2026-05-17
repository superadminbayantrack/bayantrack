# BayanTrack+ ERD Notes

Generated from the current BayanTrack+ project files, especially the Mongoose models in `server/models`, API routes in `server/routes`, and the main pages/modules in `client/pages`.

Image file:

`docs/bayantrack-crows-foot-erd.png`

## Scope Covered

BayanTrack+ is a barangay portal with these main modules:

- Resident registration, login, profile, OTP, and child access
- Admin and superadmin user review
- Online service requests
- Issue reports, complaints, and rumor reports
- Contact messages routed to barangay departments
- Announcements, updates, emergency hotlines, PHIVOLCS alerts, and fact checks
- Subscribers for email updates
- Website content editing
- Officials, departments, evacuation centers, and emergency hotlines
- System settings and activity logs

## Important Assumptions

- The actual system uses MongoDB and Mongoose collections. For school ERD documentation, the collections are shown like relational tables.
- Some data is embedded in MongoDB documents. For a clearer ERD, embedded data is shown as separate logical tables.
- `User.children[]` is shown as `CHILD_ACCESS`.
- `ServiceRequest.history[]` is shown as `REQUEST_HISTORY`.
- `IssueReport.attachments[]` is shown as `REPORT_ATTACHMENT`.
- `ContactMessage.department` is currently stored as text, but the ERD recommends `department_id` as a clearer foreign key.
- `ServiceRequest.serviceType` is currently stored as text, but the ERD recommends `service_catalog_id` as a clearer foreign key.
- No real many-to-many relationship exists in the current scope.

## Entities, Keys, and Purpose

| Entity | Primary Key | Important Attributes | Why It Is Needed |
|---|---|---|---|
| `USER` | `user_id` | `username`, `email`, `contact_number`, `password_hash`, `role`, `status`, `name`, `address`, `valid_id_status`, `admin_permissions` | Stores residents, admins, and superadmins. This is the main account table. |
| `CHILD_ACCESS` | `child_access_id` | `parent_user_id`, `child_full_name`, `child_email`, `birth_date`, `relationship`, `status`, `review_reason` | Stores child profiles linked to a parent resident account. |
| `OTP` | `otp_id` | `email`, `otp_code`, `created_at`, `expires_at` | Stores temporary email verification and password reset codes. |
| `SYSTEM_SETTING` | `setting_id` | `allow_resident_registration`, `maintenance_mode`, `maintenance_message`, `email_digest`, `notification_recipient_mode`, `lockout_window_minutes` | Stores global system options controlled by the superadmin. |
| `SERVICE_CATALOG` | `service_catalog_id` | `code`, `title`, `description`, `requirements`, `processing_time`, `active`, `sort_order` | Stores the list of available barangay services. |
| `SERVICE_REQUEST` | `service_request_id` | `user_id`, `service_catalog_id`, `reference_no`, `full_name`, `contact_number`, `address`, `purpose`, `status`, `admin_comment`, `handled_by_user_id` | Stores requests for barangay clearance, indigency, ID, and similar services. |
| `REQUEST_HISTORY` | `history_id` | `service_request_id`, `changed_by_user_id`, `status`, `note`, `changed_at` | Stores status changes for each service request. |
| `ISSUE_REPORT` | `report_id` | `user_id`, `handled_by_user_id`, `reference_no`, `full_name`, `category`, `description`, `status`, `admin_comment` | Stores resident reports, complaints, hazards, and rumor reports. |
| `REPORT_ATTACHMENT` | `attachment_id` | `report_id`, `file_name`, `file_type`, `file_size`, `file_data_or_url` | Stores uploaded proof or screenshots attached to issue reports. |
| `DEPARTMENT` | `department_id` | `name`, `contact_person`, `local_number`, `email`, `phone`, `active` | Stores barangay departments used for routing contact messages. |
| `CONTACT_MESSAGE` | `message_id` | `user_id`, `department_id`, `handled_by_user_id`, `reference_no`, `sender_name`, `sender_contact`, `message`, `status`, `admin_comment` | Stores resident messages sent through the contact form. |
| `SUBSCRIPTION` | `subscription_id` | `created_by_user_id`, `handled_by_user_id`, `email`, `status`, `source`, `admin_comment` | Stores people subscribed to email/community updates. |
| `ANNOUNCEMENT` | `announcement_id` | `created_by_user_id`, `title`, `content`, `module`, `category`, `source`, `image`, `featured`, `archived` | Stores barangay updates, advisories, fact checks, and alerts. |
| `ACTIVITY_LOG` | `activity_log_id` | `user_id`, `actor_name`, `actor_role`, `type`, `title`, `reference_no`, `metadata`, `created_at` | Stores audit trail records for important system actions. |
| `SITE_CONTENT` | `site_content_id` | `updated_by_user_id`, `home_text`, `about_text`, `contact_text`, `community_cards`, `governance_items`, `footer_text` | Stores editable website content managed in the dashboard. |
| `OFFICIAL` | `official_id` | `name`, `role`, `level`, `rank_order`, `committee`, `description`, `image`, `active` | Stores barangay and city officials shown on the public site. |
| `EVACUATION_CENTER` | `evacuation_center_id` | `name`, `address`, `capacity`, `hazards_covered`, `latitude`, `longitude`, `notes`, `active` | Stores evacuation locations and safety information. |
| `EMERGENCY_HOTLINE` | `emergency_hotline_id` | `name`, `type`, `number`, `description`, `when_to_call`, `what_to_prepare`, `active` | Stores emergency contact numbers and instructions. |

## Relationships and Cardinality

Crow's Foot symbols used:

- `||` means exactly one
- `O|` means zero or one
- `O<` means zero or many
- `|<` means one or many

| Relationship | Cardinality | Optional or Required | Explanation |
|---|---:|---|---|
| `USER` to `CHILD_ACCESS` | `USER || -- O< CHILD_ACCESS` | A child access record must belong to one parent user. A user may have zero or many linked children. | Parent accounts can add child profiles. |
| `USER` to `OTP` | `USER O| -- O< OTP` | OTP records are optional and temporary. | OTP is linked by email, not by ObjectId. |
| `USER` to `SERVICE_REQUEST` | `USER O| -- O< SERVICE_REQUEST` | A request may belong to a user, but can be nullable in the code. A user may submit many requests. | Residents submit service requests. |
| `SERVICE_CATALOG` to `SERVICE_REQUEST` | `SERVICE_CATALOG || -- O< SERVICE_REQUEST` | Recommended FK. A service request should point to one service type. | Current code stores service type as text, but a FK is better for ERD clarity. |
| `SERVICE_REQUEST` to `REQUEST_HISTORY` | `SERVICE_REQUEST || -- O< REQUEST_HISTORY` | A history row must belong to one service request. A request may have many history rows. | Tracks request status changes. |
| `USER` to `REQUEST_HISTORY` | `USER O| -- O< REQUEST_HISTORY` | Optional staff user reference. | Shows which staff member changed a request status. |
| `USER` to `ISSUE_REPORT` | `USER O| -- O< ISSUE_REPORT` | A report may belong to a user, but can be nullable. | Residents or visitors can report issues. |
| `ISSUE_REPORT` to `REPORT_ATTACHMENT` | `ISSUE_REPORT || -- O< REPORT_ATTACHMENT` | An attachment must belong to one report. A report may have zero or many attachments. | Stores proof or uploaded images. |
| `USER` to `CONTACT_MESSAGE` | `USER O| -- O< CONTACT_MESSAGE` | A contact message may belong to a user or may be sent as a public message. | Residents can message the barangay office. |
| `DEPARTMENT` to `CONTACT_MESSAGE` | `DEPARTMENT || -- O< CONTACT_MESSAGE` | Recommended FK. A message should be routed to one department. | Current code stores department as text. |
| `USER` to `SUBSCRIPTION` | `USER O| -- O< SUBSCRIPTION` | Optional creator/handler reference. | Users may subscribe to updates, and staff may handle subscriber records. |
| `USER` to `ANNOUNCEMENT` | `USER O| -- O< ANNOUNCEMENT` | Optional creator reference. | Admins or superadmins create announcements. |
| `USER` to `ACTIVITY_LOG` | `USER O| -- O< ACTIVITY_LOG` | Optional actor reference. | Some logs are connected to a user, others may be system-generated. |
| `USER` to `SITE_CONTENT` | `USER O| -- O| SITE_CONTENT` | Optional updater reference. | Site content can store which staff member last updated it. |
| `USER` to handled records | `USER O| -- O< SERVICE_REQUEST / ISSUE_REPORT / CONTACT_MESSAGE / SUBSCRIPTION` | Optional. | Staff assignment is stored through `handled_by_user_id`. |

## Foreign Keys

| Table | Foreign Key | References | Required? |
|---|---|---|---|
| `CHILD_ACCESS` | `parent_user_id` | `USER.user_id` | Yes |
| `OTP` | `email` | `USER.email` | Logical link only |
| `SERVICE_REQUEST` | `user_id` | `USER.user_id` | Optional |
| `SERVICE_REQUEST` | `service_catalog_id` | `SERVICE_CATALOG.service_catalog_id` | Recommended |
| `SERVICE_REQUEST` | `handled_by_user_id` | `USER.user_id` | Optional |
| `REQUEST_HISTORY` | `service_request_id` | `SERVICE_REQUEST.service_request_id` | Yes |
| `REQUEST_HISTORY` | `changed_by_user_id` | `USER.user_id` | Optional |
| `ISSUE_REPORT` | `user_id` | `USER.user_id` | Optional |
| `ISSUE_REPORT` | `handled_by_user_id` | `USER.user_id` | Optional |
| `REPORT_ATTACHMENT` | `report_id` | `ISSUE_REPORT.report_id` | Yes |
| `CONTACT_MESSAGE` | `user_id` | `USER.user_id` | Optional |
| `CONTACT_MESSAGE` | `department_id` | `DEPARTMENT.department_id` | Recommended |
| `CONTACT_MESSAGE` | `handled_by_user_id` | `USER.user_id` | Optional |
| `SUBSCRIPTION` | `created_by_user_id` | `USER.user_id` | Optional |
| `SUBSCRIPTION` | `handled_by_user_id` | `USER.user_id` | Optional |
| `ANNOUNCEMENT` | `created_by_user_id` | `USER.user_id` | Optional |
| `ACTIVITY_LOG` | `user_id` | `USER.user_id` | Optional |
| `SITE_CONTENT` | `updated_by_user_id` | `USER.user_id` | Optional |

## Junction Tables

No many-to-many junction table is required in the current system.

The following tables are child/detail tables, not many-to-many junction tables:

- `CHILD_ACCESS` belongs to one parent user.
- `REQUEST_HISTORY` belongs to one service request.
- `REPORT_ATTACHMENT` belongs to one issue report.

## Missing or Recommended Tables/Fields

These are not strictly required, but they would make the database design cleaner:

| Recommendation | Why It Helps |
|---|---|
| Add `service_catalog_id` to `SERVICE_REQUEST` | The current code stores the service type as text. A real FK prevents spelling mismatch and keeps services organized. |
| Add `department_id` to `CONTACT_MESSAGE` | The current code stores department as text. A real FK makes message routing cleaner. |
| Add `STAFF_ASSIGNMENT` table | Useful if more than one admin, tanod, kagawad, or staff member can handle the same report/request/message. |
| Add `EMAIL_NOTIFICATION_LOG` table | Useful if the school panel asks for proof that OTPs or update emails were sent. |
| Add `ROLE_PERMISSION` table | Current admin permissions are embedded in `USER`. A separate table is cleaner for a larger system. |
| Add `USER_NOTIFICATION` table | Useful if resident/admin notifications should be stored and shown later inside the app. |

## Simple Explanation

The center of the system is the `USER` table because every resident, admin, and superadmin account is stored there. Residents can submit service requests, reports, messages, subscriptions, and child access records. Admins and superadmins review those records, update their status, leave comments, and may be recorded as the handler through `handled_by_user_id`.

Reference tables such as `SERVICE_CATALOG`, `DEPARTMENT`, `OFFICIAL`, `EVACUATION_CENTER`, and `EMERGENCY_HOTLINE` store information that appears on the public website and dashboard. `SYSTEM_SETTING` and `SITE_CONTENT` store configurable system and website content. `ACTIVITY_LOG` keeps a record of important actions for monitoring and accountability.
