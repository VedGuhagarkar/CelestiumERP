# 🚀 Astralis ERP — Complete Features & Capabilities Catalog

> **Platform:** Astralis ERP (Advanced Thermal Processing, Precision Machining & Metallurgical Manufacturing)  
> **Tech Stack:** Node.js, Express, MongoDB, JavaScript, React.js, CSS
> **Architecture:** Multi-Tenant Clean Layered Domain Architecture (`Route -> Controller -> Service -> Repository -> Model`) + Decoupled Event Bus  

---

## 📑 Table of Contents

1. [Core Platform & Architecture Foundation](#1-core-platform--architecture-foundation)
2. [Authentication & Session Management](#2-authentication--session-management)
3. [RBAC, Users, Roles & Governance](#3-rbac-users-roles--governance)
4. [Tenant, System Settings & Feature Flags](#4-tenant-system-settings--feature-flags)
5. [Customer & Client Registry](#5-customer--client-registry)
6. [Production & Heat Treatment Job Management](#6-production--heat-treatment-job-management)
7. [Metallurgical Quality Control & Lab Subsystem (ISO 17025 / AMS 2750G)](#7-metallurgical-quality-control--lab-subsystem-iso-17025--ams-2750g)
8. [Equipment, Machines, Maintenance & Pyrometry](#8-equipment-machines-maintenance--pyrometry)
9. [Inventory, Raw Materials & Traceability](#9-inventory-raw-materials--traceability)
10. [Workforce, Attendance, Shifts & Labor Operations](#10-workforce-attendance-shifts--labor-operations)
11. [Employee Directory & Personnel Management](#11-employee-directory--personnel-management)
12. [Configurable State Machine & Workflow Engine](#12-configurable-state-machine--workflow-engine)
13. [Outbound Dispatch & Shipping Logistics](#13-outbound-dispatch--shipping-logistics)
14. [Executive Analytics & Domain Reporting](#14-executive-analytics--domain-reporting)
15. [Global Search & Command Palette](#15-global-search--command-palette)
16. [Notification Center & Alert Delivery](#16-notification-center--alert-delivery)
17. [Manufacturing Command Center Dashboard](#17-manufacturing-command-center-dashboard)
18. [Frontend Application Shell & Navigation](#18-frontend-application-shell--navigation)
19. [Frontend Charts & Data Visualization](#19-frontend-charts--data-visualization)
20. [Frontend Apple Design System & Component Library](#20-frontend-apple-design-system--component-library)
21. [Frontend RTK Query API Layer](#21-frontend-rtk-query-api-layer)
22. [Security Audit Trail Explorer](#22-security-audit-trail-explorer)
23. [Finance & Manufacturing Cost Control](#23-finance--manufacturing-cost-control)
24. [Heat-Treatment Product & Process Master Data](#24-heat-treatment-product--process-master-data)
25. [Material Requirements & Production Planning](#25-material-requirements--production-planning)
26. [Job Costing & Manufacturing Cost Accounting](#26-job-costing--manufacturing-cost-accounting)
27. [Warehouse & Finished-Goods Management](#27-warehouse--finished-goods-management)

---

## 1. Core Platform & Architecture Foundation

### 1.1 Multi-Tenant Isolation Engine

- **Strict Collection Partitioning:** Enforces database-level isolation by indexing a mandatory `tenantId` on every document to prevent cross-tenant data leakage.
- **Tenant Context Middleware (`tenantMiddleware`):** Extracts tenant identity from incoming HTTP headers (`x-tenant-id`) or validated JWT claims and attaches `req.tenantId` to the request context.
- **Base Repository Isolation (`BaseRepository<T>`):** Automatically injects the active `{ tenantId }` scope into all queries, updates, counts, and soft-delete routines, guaranteeing zero cross-tenant query contamination.

### 1.2 Decoupled Domain Event Bus (`DomainEventBus`)

- **In-Memory Type-Safe Event Bus:** Provides asynchronous publish-subscribe messaging between decoupled domain modules without introducing external broker dependencies.
- **48+ Domain Event Subscriptions:** Listens for critical lifecycle events (such as `Job.Completed`, `QualityInspection.Approved`, and `Machine.BreakdownReported`) across 11 active domains.
- **Asynchronous Side-Effect Handlers:** Offloads secondary tasks like audit logging, notification dispatch, and telemetry updates to keep primary HTTP response cycles fast.

### 1.3 Immutable Audit Logging (`AuditLogService`)

- **Non-Blocking Audit Logger (`logSilently`):** Captures actor identity, action type, tenant context, timestamp, IP address, and payload diffs without slowing down business operations.
- **Granular Change Diff Engine:** Calculates before-and-after field differences for sensitive records to support stringent aerospace and automotive compliance audits.
- **AuditLog Collection:** Permanently records tamper-evident audit logs within tenant-partitioned MongoDB collections.

### 1.4 Atomic Sequential ID Generation (`CounterModel`)

- **Collision-Free Counter Engine:** Utilizes MongoDB atomic `$inc` operations with upserts to generate monotonic sequential codes even under high concurrency.
- **Domain-Specific Prefixes:** Produces standardized human-readable business identifiers such as `JOB-00001`, `EMP-00001`, `QC-00001`, `DISP-00001`, `NCR-00001`, `CUST-00001`, and `MACH-00001`.

### 1.5 Soft Delete Protocol (Mongoose Plugin)

- **Automatic Query Interceptor (`softDeletePlugin`):** Transparently injects `{ isDeleted: false }` into all Mongoose `find`, `count`, and aggregation pipelines.
- **Audit-Preserving Metadata:** Retains deletion timestamps (`deletedAt`) and user identities (`deletedBy`) rather than physically removing records from the database.
- **Entity Restore Handlers:** Provides dedicated controller actions to undelete and restore erroneously archived records.

### 1.6 Centralized Error Handling & API Response Standard

- **AppError Exception Hierarchy:** Normalizes domain exceptions into structured HTTP errors including `BadRequestError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), and `InternalServerError` (500).
- **Standardized API Envelope (`ApiResponse`):** Enforces uniform JSON response envelopes across all endpoints via `ApiResponse.success()`, `created()`, `paginated()`, `noContent()`, and `error()`.

### 1.7 Async Task Queue & Resilience Engine (`AsyncQueueService`)

- **Background Worker Engine:** Executes resource-intensive background operations like batch report exports, telemetry rollups, and bulk email notifications.
- **Exponential Backoff & Dead-Letter Queue (DLQ):** Retries transient background job failures with increasing delays before moving permanently failing tasks to an administrative DLQ.

### 1.8 Enterprise Idempotency Middleware

- **Duplicate Mutation Filter:** Inspects `Idempotency-Key` headers on mutating requests (`POST`, `PUT`, `PATCH`) to prevent double-charging or duplicate work-order generation on network retries.

### 1.9 Architectural Governance (`check:arch`)

- **Automated Onion Architecture Validator:** Scans import graphs across backend modules to guarantee strict layer compliance (`Route -> Controller -> Service -> Repository`).
- **Jest Architecture Boundary Test (`architecture-boundaries.spec.ts`):** Fails CI builds if circular dependencies or upward layer imports are detected in domain code.

### 1.10 Infrastructure & Middleware Stack

- **Express Security Stack:** Hardens API endpoints with Helmet security headers, CORS origin whitelisting, HTTP gzip compression, and rate limiting.
- **Winston Structured Logger:** Formats logs in structured JSON with automated masking of sensitive keys (passwords, tokens) and per-module log levels.
- **Zod Environment Validator (`src/config/env.config.ts`):** Validates all environment variables on boot, preventing startup when critical configuration keys are missing.
- **Async Handler HOC (`asyncHandler`):** Eliminates repetitive `try/catch` boilerplate across controllers by capturing and forwarding promise rejections to the global error middleware.

---

## 2. Authentication & Session Management

### 2.1 Core Authentication Endpoints

- `POST /api/v1/auth/register` — Registers a new user account under the active tenant and hashes credentials using bcrypt.
- `POST /api/v1/auth/login` — Authenticates credentials and returns a short-lived JWT access token along with a secure refresh token.
- `POST /api/v1/auth/refresh-token` — Rotates and exchanges an active refresh token for a newly signed JWT access token.
- `POST /api/v1/auth/logout` — Invalidates the current user session and revokes the active refresh token in the database.
- `POST /api/v1/auth/forgot-password` — Generates a time-limited, cryptographically secure password reset token and dispatches a recovery email.
- `POST /api/v1/auth/reset-password` — Verifies the recovery token and safely updates the user's password.
- `GET /api/v1/auth/me` — Fetches the currently authenticated user profile, active roles, and granular permissions for client-side authorization.

### 2.2 Session & User Identity

- **JWT Authentication Middleware (`authenticateJwt`):** Validates Bearer token signatures on incoming requests and attaches user claims to `req.user`.
- **Role Assignment Endpoint (`PATCH /api/v1/auth/users/:userId/roles`):** Assigns or revokes administrative and operational roles for a user.
- **RBAC Catalog Endpoint (`GET /api/v1/auth/rbac/catalog`):** Exposes the complete platform permission catalog, role definitions, and sensitivity classifications.
- **Centralized Session Revocation:** Allows administrators to terminate single active sessions or force-logout all active devices for a user.

### 2.3 Frontend Auth Pages

- **Login Page (`/login`):** Provides a high-contrast authentication form with input validation, password visibility toggles, and tenant routing.
- **Forgot Password Page (`/forgot-password`):** Allows users to request password recovery links via verified email addresses.
- **Reset Password Page (`/reset-password`):** Validates password strength rules and sets new account credentials using reset tokens.
- **Session Expired Page (`/session-expired`):** Displays a non-blocking timeout notice and directs users to safely re-authenticate.
- **Unauthorized Page (`/unauthorized`):** Informs users when their active role lacks permission for a requested view and provides a navigation fallback.

---

## 3. RBAC, Users, Roles & Governance

### 3.1 Permission Registry (44 Granular Permissions, 3 Sensitivity Tiers)

| Domain            | Permission Keys                                                                                                                                                     | Sensitivity          | Purpose                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Jobs**          | `JOB_VIEW`, `JOB_CREATE`, `JOB_UPDATE`, `JOB_DELETE`, `JOB_DISPATCH`                                                                                                | Standard / Sensitive | Controls access to work-order creation, recipe updates, status changes, and dispatch authorizations.         |
| **Quality**       | `QC_INSPECT`, `QC_ASSIGN`, `QC_APPROVE`, `QC_REJECT`                                                                                                                | Standard / Sensitive | Governs metallurgical lab inspections, hardness surveys, NCR dispositioning, and CoC sign-offs.              |
| **Machines**      | `MACHINE_VIEW`, `MACHINE_CREATE`, `MACHINE_UPDATE`, `MACHINE_DELETE`, `MACHINE_MAINTAIN`                                                                            | Standard             | Protects furnace registrations, calibration logs, capability parameters, and breakdown reporting.            |
| **Inventory**     | `INVENTORY_VIEW`, `INVENTORY_UPDATE`, `INVENTORY_MANAGE`                                                                                                            | Standard             | Restricts stock ledger adjustments, heat lot creations, goods receipts, and warehouse bin transfers.         |
| **Employees**     | `EMPLOYEE_VIEW`, `EMPLOYEE_CREATE`, `EMPLOYEE_UPDATE`, `EMPLOYEE_DELETE`, `EMPLOYEE_DEACTIVATE`, `EMPLOYEE_REACTIVATE`, `EMPLOYEE_ASSIGN`, `EMPLOYEE_MANAGE_SKILLS` | Standard / Sensitive | Controls personnel directory access, skill certifications, operator assignments, and deactivations.          |
| **Attendance**    | `ATTENDANCE_VIEW`, `ATTENDANCE_MARK`, `WORKFORCE_MANAGE`                                                                                                            | Standard             | Manages shift creation, clock-in records, supervisor corrections, leave approvals, and overtime logs.        |
| **Dispatch**      | `DISPATCH_VIEW`, `DISPATCH_CREATE`, `DISPATCH_SCHEDULE`, `DISPATCH_APPROVE`, `DISPATCH_MARK`, `DISPATCH_CANCEL`                                                     | Standard / Sensitive | Protects outbound shipping orders, document compliance gates, carrier schedules, and delivery confirmations. |
| **Reports**       | `REPORTS_VIEW`, `REPORTS_MANAGE`                                                                                                                                    | Standard             | Authorizes access to executive OEE dashboards, quality analytics, and automated report scheduling.           |
| **Customers**     | `CUSTOMER_VIEW`, `CUSTOMER_CREATE`, `CUSTOMER_UPDATE`, `CUSTOMER_DELETE`                                                                                            | Standard             | Manages client profile creation, credit limit adjustments, and customer directory access.                    |
| **Notifications** | `NOTIFICATIONS_VIEW`, `NOTIFICATIONS_MANAGE`                                                                                                                        | Standard             | Governs broadcast alert creation, system template editing, and user notification preference management.      |
| **Admin**         | `SYSTEM_ADMIN`, `TENANT_MANAGE`, `AUDIT_VIEW`                                                                                                                       | Critical             | Authorizes system settings updates, tenant provisioning, feature flag overrides, and audit log inspection.   |
| **Workflow**      | `WORKFLOW_VIEW`, `WORKFLOW_EXECUTE`, `WORKFLOW_MANAGE`                                                                                                              | Standard / Sensitive | Protects state-machine definition creation, workflow versioning, instance execution, and rollbacks.          |

### 3.2 Users Management Console (`/settings/users`)

- **Personnel Directory Table:** Renders active users, roles, email addresses, and status badges with responsive layout support.
- **Search & Filtering Bar:** Filters the user list by name, email, department, assigned role, and status.
- **User Creation & Edit Modal (`UserModal.tsx`):** Provides a modal form to create accounts, set temporary credentials, and assign roles.
- **Bulk Status Controls:** Enables administrators to activate or suspend multiple user accounts in a single batch operation.
- **RTK Query Hook Integration:** Connects the user console directly to cached backend mutations via `settingsApi.ts`.

### 3.3 Roles Management Console (`/settings/roles`)

- **Role Summary Cards:** Displays all defined organizational roles alongside real-time user count badges.
- **Role Configuration Dialog:** Allows administrators to rename roles and update role descriptions.

### 3.4 Permissions Matrix Console (`/settings/permissions`)

- **Interactive Permission Grid (`RolePermissionGrid.tsx`):** Provides an interactive matrix to toggle granular permissions across roles in real time.
- **Sensitivity Level Badging:** Visually highlights permissions with Standard, Sensitive, or Critical color-coded tags.
- **Permissions Explorer (`PermissionsPage.tsx`):** Displays detailed descriptions and risk classifications for all 44 platform permissions.

---

## 4. Tenant, System Settings & Feature Flags

### 4.1 System Settings Console (`/settings/system`)

- **System Telemetry Dashboard:** Monitors live MongoDB connection health, active tenant counts, and CPU/memory utilization.
- **Maintenance Mode Switch:** Enables administrators to temporarily lock the platform for controlled database migrations.
- `GET /api/v1/admin/system-settings` — Fetches global system configuration parameters and infrastructure flags.
- `PUT /api/v1/admin/system-settings` — Updates global system configuration parameters and infrastructure flags.

### 4.2 Tenant Settings Console (`/settings/tenants`)

- **Facility Profile Manager:** Configures plant physical address, operating legal name, tax identifiers, and industrial sector.
- **Rate Limit & Retention Configurator:** Customizes telemetry sampling frequencies and audit log retention periods per tenant.
- `GET /api/v1/admin/tenant-settings` — Retrieves the active tenant's operating parameters, timezone, and telemetry limits.
- `PUT /api/v1/admin/tenant-settings` — Updates the active tenant's operating parameters, timezone, and telemetry limits.

### 4.3 Feature Flags Console (`/settings/feature-flags`)

- **Runtime Flag Switches (`FeatureFlagToggleCards.tsx`):** Toggles platform-wide operational feature gates without requiring redeployment:
  - `ENABLE_AMS_2750G_PYROMETRY` — Enforces strict pyrometry sensor calibration workflows for aerospace heat treatment.
  - `ENABLE_REALTIME_PLC_TELEMETRY` — Connects live furnace PLC sensor streaming to dashboard widgets.
  - `ENABLE_MULTI_TENANT_ISOLATION` — Activates strict tenant partitioning verification on all queries.
  - `ENABLE_AUTO_COC_GENERATION` — Automatically drafts Certificates of Conformance upon QA approval.
- `GET /api/v1/admin/feature-flags/:flagKey` — Checks the runtime enabled status of a specific feature flag.
- `POST /api/v1/admin/feature-flags` — Sets or updates the global state of a platform feature flag.
- `POST /api/v1/admin/feature-flags/override` — Applies a tenant-specific override for a feature flag.

### 4.4 Backup Management

- `POST /api/v1/admin/backups` — Triggers an on-demand point-in-time database backup snapshot for disaster recovery.
- `GET /api/v1/admin/backups` — Lists previous backup archives, timestamps, file sizes, and storage locations.

### 4.5 License Management

- `GET /api/v1/admin/license` — Inspects enterprise license validity, authorized module entitlements, and user seat limits.

### 4.6 Session Administration

- `GET /api/v1/admin/sessions/:userId` — Lists all active login sessions, device user agents, and IP addresses for a user.
- `DELETE /api/v1/admin/sessions/:sessionId` — Revokes a specific compromised or stale user session token.
- `DELETE /api/v1/admin/sessions/user/:userId` — Forces termination of all active sessions for a given user account.

---

## 5. Customer & Client Registry

### 5.1 Backend API Endpoints

- `POST /api/v1/customers` — Creates a new customer profile with credit limits, billing addresses, and tax identifiers.
- `GET /api/v1/customers` — Retrieves a paginated list of client companies with search and industry filtering.
- `GET /api/v1/customers/:id` — Fetches full details for a specific customer including job history and credit status.
- `PUT /api/v1/customers/:id` — Updates existing customer contact information, billing terms, and address records.
- `DELETE /api/v1/customers/:id` — Soft-deletes a customer record while preserving historical job and financial associations.

### 5.2 Frontend Customer Console (`/settings/customers`)

- **Customer Directory Table:** Lists client organizations with credit limits, contact emails, phone numbers, and active status indicators.
- **Customer Search & Filters:** Filters the customer directory by corporate name, email, phone, and account status.
- **Customer Management Drawer:** Provides a slide-over form for creating and updating customer master records.
- **Customer Soft-Delete & Restore Action:** Allows archiving and restoring client records without permanent data loss.

---

## 6. Production & Heat Treatment Job Management

### 6.1 12-Stage Heat Treatment Lifecycle State Machine

`DRAFT` ➔ `PENDING_REVIEW` ➔ `APPROVED` ➔ `SCHEDULED` ➔ `IN_PROGRESS` ➔ `PAUSED` ➔ `QUALITY_CHECK` ➔ `STORAGE` ➔ `READY_FOR_DISPATCH` ➔ `DISPATCHED` ➔ `COMPLETED` / `CANCELLED`

### 6.2 Backend API Endpoints

- `POST /api/v1/jobs` — Creates a new production work order with metallurgical recipe parameters and customer references.
- `GET /api/v1/jobs` — Retrieves work orders with multi-parameter filtering (status, process type, machine ID, date range).
- `GET /api/v1/jobs/:id` — Returns complete job details including recipe parameters, stage progress, and assigned resources.
- `PUT /api/v1/jobs/:id` — Updates job specifications, target properties, or delivery dates before processing begins.
- `DELETE /api/v1/jobs/:id` — Soft-deletes a draft or cancelled job record from active production views.
- `PATCH /api/v1/jobs/:id/status` — Transitions a job through the 12-stage lifecycle state machine with validation.
- `GET /api/v1/jobs/queue` — Returns the prioritized shop-floor production queue for active furnaces.
- `GET /api/v1/jobs/:id/timeline` — Retrieves the timestamped state-transition history for a job.
- `GET /api/v1/jobs/:id/history` — Fetches the complete immutable audit trail of modifications for a work order.

### 6.3 Job Operations & Worker/Machine Assignments

- `PATCH /api/v1/jobs/:id/assign-worker` — Assigns a qualified shop-floor operator to a production job.
- `PATCH /api/v1/jobs/:id/reallocate-worker` — Reallocates an assigned operator from one job to another to balance floor workload.
- `PATCH /api/v1/jobs/:id/remove-worker` — Unassigns an operator from a work order.
- `PATCH /api/v1/jobs/:id/assign-machine` — Binds a furnace or CNC machine to a work order based on capability matching.
- `PATCH /api/v1/jobs/:id/reallocate-machine` — Reassigns a job to an alternate capable machine in case of bottlenecks or maintenance.
- `PATCH /api/v1/jobs/:id/remove-machine` — Clears the machine allocation for an unscheduled job.
- `POST /api/v1/jobs/check-conflicts` — Analyzes scheduling time slots to detect machine or operator booking conflicts.

### 6.4 Scheduling Operations

- `PATCH /api/v1/jobs/:id/schedule` — Assigns planned start and end time windows for a job on a specific machine.
- `PATCH /api/v1/jobs/:id/reschedule` — Moves a scheduled job to a new time window or alternative machine.
- `PATCH /api/v1/jobs/:id/cancel-schedule` — Cancels a planned schedule slot and returns the job to approved backlog status.

### 6.5 Production Operations

- `PATCH /api/v1/jobs/:id/start` — Records furnace charge entry, verifies initial temperature conditions, and begins cycle timer.
- `PATCH /api/v1/jobs/:id/pause` — Halts active cycle processing and logs operator downtime reasons (e.g., gas supply check).
- `PATCH /api/v1/jobs/:id/resume` — Resumes an in-progress cycle after resolving a temporary stoppage.
- `PATCH /api/v1/jobs/:id/progress` — Records completion percentages and milestones across thermal cycle stages (Preheat, Soak, Quench, Temper).
- `POST /api/v1/jobs/:id/downtime` — Logs an unplanned downtime event against an active job for OEE tracking.
- `PATCH /api/v1/jobs/:id/complete` — Concludes the thermal cycle, archives furnace logs, and automatically triggers a QC inspection record.
- `PATCH /api/v1/jobs/:id/storage` — Moves heat-treated parts into post-process warehouse storage awaiting QA clearance.
- `PATCH /api/v1/jobs/:id/dispatch` — Marks finished goods as transferred to the shipping bay for outbound dispatch.
- `POST /api/v1/jobs/:id/notes` — Appends shift handover notes, metallurgical observations, or operator remarks to the job log.

### 6.6 Recipe & Pyrometry Parameter Engine

- **Target Temperature Regulation:** Sets exact Celsius heating targets (°C) and controlled ramp rates (°C/min) to prevent thermal shock.
- **Soak & Dwell Timing:** Controls thermal dwell durations in minutes to ensure uniform austenitic transformation.
- **Atmospheric Carbon Potential Control:** Regulates percentage carbon (%C) potential for precision gas and vacuum carburizing cycles.
- **Quench Medium & Agitation:** Manages quench medium selection (Oil, Polymer, Water, N₂ gas) and variable agitator RPM for controlled cooling curves.

### 6.7 Metallurgical Heat Lot Tracking

- **Alloy Grade & Charge Specifications:** Tracks raw material grades (4140, 8620, 300M, Inconel 718), base hardness, and furnace charge weights (kg).
- **Target Hardness & Case Depth Specs:** Enforces customer specifications for surface hardness (HRC), core hardness, and Effective Case Depth (ECD in mm).

### 6.8 Frontend Job Pages & Components

- **Job List Page (`/jobs`):** Displays paginated work orders with status tabs, priority badges, furnace allocations, and quick filters.
- **Job Details Workbench (`/jobs/:id`):** Provides an 8-tab production console covering Recipe, Progress, Assignments, Downtime, Notes, QC, and History.
- **Create Job Page (`/jobs/new`):** Guides users through work-order drafting with customer lookups, recipe validation, and material verification.
- **Edit Job Page (`/jobs/:id/edit`):** Allows updating work-order parameters before thermal processing begins.
- **Create Job Modal (`CreateJobModal.tsx`):** Offers a rapid work-order creation popup accessible from anywhere in the application.
- **Job Inspector Drawer (`JobInspectorDrawer.tsx`):** Renders a slide-out preview of job recipes, status timelines, and operator notes.
- **Status Timeline (`StatusTimeline.tsx`):** Visualizes sequential state-machine transitions and timestamps for a job.

---

## 7. Metallurgical Quality Control & Lab Subsystem (ISO 17025 / AMS 2750G)

### 7.1 5-Tier Inspection Status Hierarchy

`PENDING` ➔ `IN_REVIEW` ➔ `APPROVED` ➔ `REJECTED` ➔ `REINSPECTION`

### 7.2 Backend API Endpoints

- `POST /api/v1/quality` — Creates a quality inspection record linked to a completed production job or received raw material batch.
- `GET /api/v1/quality` — Retrieves inspection records with multi-criteria filtering (status, job ID, inspector ID, date range).
- `GET /api/v1/quality/:id` — Returns complete inspection records including hardness surveys, defect findings, and test reports.
- `PUT /api/v1/quality/:id` — Updates inspection notes, sample IDs, or test standards prior to sign-off.
- `DELETE /api/v1/quality/:id` — Soft-deletes a draft or rejected inspection record.
- `GET /api/v1/quality/:id/history` — Fetches the complete state-transition audit log for an inspection.

### 7.3 Inspection Lifecycle Endpoints

- `POST /api/v1/quality/:id/assign` — Assigns a certified QC inspector or metallurgist to an inspection record.
- `POST /api/v1/quality/:id/execute` — Commences the physical laboratory inspection process and locks initial test samples.
- `POST /api/v1/quality/:id/measurements` — Records multi-point hardness and microhardness readings across sample cross-sections.
- `POST /api/v1/quality/:id/defects` — Logs observed non-conformances including crack indications, excessive decarburization, or porosity.
- `POST /api/v1/quality/:id/pass` — Signs off an inspection as compliant with engineering drawings and customer specifications.
- `POST /api/v1/quality/:id/fail` — Marks an inspection as failed and automatically generates a Non-Conformance Report (NCR).
- `POST /api/v1/quality/:id/request-reinspection` — Requests a secondary test run or sample repolish when readings are inconclusive.
- `POST /api/v1/quality/:id/approve` — Provides final QA Manager authorization to release parts for shipping.
- `POST /api/v1/quality/:id/reject` — Issues a formal QA Manager rejection preventing shipment of non-conforming lots.

### 7.4 Hardness & Microhardness Testing

- **Multi-Scale Hardness Support:** Records hardness on Rockwell C (HRC), Rockwell B (HRB), Rockwell A (HRA), Vickers (HV), and Brinell (HBW) scales.
- **Traverse Survey Curves (ECD):** Maps depth-versus-hardness profiles to verify Effective Case Depth at standard hardness cutoffs (e.g., 50 HRC).

### 7.5 Microstructure & Metallographic Analysis

- **Microstructural Evaluation:** Evaluates Retained Austenite percentage (%), ASTM E112 Grain Size Numbers, total decarburization depth, and carbide morphology.

### 7.6 Checklists

- `POST /api/v1/quality/checklists` — Creates reusable quality inspection checklists for specific customer specifications.
- `GET /api/v1/quality/checklists` — Lists available inspection checklists with process type filtering.
- `GET /api/v1/quality/checklists/:id` — Retrieves a specific checklist template and its inspection criteria.

### 7.7 Test Reports & Quality Certificates

- `POST /api/v1/quality/test-reports` — Compiles hardness surveys and microstructural findings into an ISO 17025 / AMS 2750G compliant test report.
- `GET /api/v1/quality/test-reports` — Retrieves compiled test reports and Certificates of Conformance (CoC).
- **Report Viewer (`ReportViewer.tsx`):** Renders a printable CoC with target-vs-actual tables, digital QA signatures, and QR verification codes.

### 7.8 NCR & CAPA Management

- `GET /api/v1/quality/ncrs` — Lists all open Non-Conformance Reports with severity classifications and root-cause summaries.
- `PATCH /api/v1/quality/ncrs/:ncrId/capa` — Records Corrective and Preventive Action (CAPA) plans to address defect root causes.

### 7.9 Frontend Quality Pages & Components

- **Inspection Queue Page (`/quality`):** Renders active inspection workloads, pass/fail ratios, and inspector assignment dialogs.
- **Inspection Details Workbench (`/quality/:id`):** Provides a 6-tab lab workbench covering Measurements, Defects, NCR/CAPA, Sign-Off, CoC, and History.
- **Quality Analytics Dashboard (`/quality/dashboard`):** Visualizes First Pass Yield (FPY %) trends, defect Pareto charts, and open NCR metrics.

---

## 8. Equipment, Machines, Maintenance & Pyrometry

### 8.1 Machine State Engine & Registry

- **Machine Operational States:** Tracks real-time machine states across `IDLE`, `RUNNING`, `MAINTENANCE`, `BREAKDOWN`, `OFFLINE`, and `CALIBRATING`.
- **Process Capability Matching:** Compares furnace thermal ratings and dimensions against job recipe requirements before scheduling.

### 8.2 Machine Backend API Endpoints

- `POST /api/v1/machines` — Registers a new furnace, CNC machine, or quench tank into the plant asset database.
- `GET /api/v1/machines` — Lists registered machinery with status, bay location, and capability filters.
- `GET /api/v1/machines/:id` — Retrieves full machine specifications, telemetry history, and maintenance records.
- `PUT /api/v1/machines/:id` — Updates machine technical parameters, working volume, or maximum operating temperatures.
- `DELETE /api/v1/machines/:id` — Soft-deletes a retired machine record from active shop-floor views.
- `PATCH /api/v1/machines/:id/status` — Updates a machine's live operational status (e.g., transitions to Maintenance).
- `PATCH /api/v1/machines/:id/calibration` — Records calibration certificates, sensor offsets, and pyrometry verification dates.
- `PATCH /api/v1/machines/:id/capabilities` — Updates the list of certified thermal processes a machine is capable of running.
- `POST /api/v1/machines/:id/notes` — Appends maintenance notes or inspection observations to the machine log.
- `GET /api/v1/machines/:id/status-history` — Returns the historical log of machine state transitions and durations.
- `GET /api/v1/machines/capable` — Finds machines meeting specific temperature, atmosphere, and charge weight criteria for a job.
- `GET /api/v1/machines/status-summary` — Computes fleet-wide counts of machines in each operational status.

### 8.3 Breakdown History & MTTR / MTBF Analytics

- `POST /api/v1/machines/breakdowns` — Logs an equipment breakdown event and automatically switches machine status to `BREAKDOWN`.
- `GET /api/v1/machines/breakdowns` — Lists historical and active breakdown logs with severity filters.
- `GET /api/v1/machines/breakdowns/analytics` — Calculates Mean Time To Repair (MTTR), Mean Time Between Failures (MTBF), and total downtime hours.
- `PATCH /api/v1/machines/breakdowns/:id/resolve` — Concludes breakdown repairs, logs root cause, and transitions machine to `MAINTENANCE` for testing.

### 8.4 Utilization Telemetry

- `POST /api/v1/machines/utilization` — Records shift-level runtime, idle, and setup hours for equipment efficiency tracking.
- `GET /api/v1/machines/utilization` — Retrieves historical utilization logs by machine and date range.
- `GET /api/v1/machines/utilization/analytics` — Computes Overall Equipment Effectiveness (OEE), availability, and performance rates.

### 8.5 Maintenance Schedules & Logs

- `POST /api/v1/maintenance/schedules` — Creates a recurring Preventive Maintenance (PM) schedule based on calendar intervals or runtime hours.
- `GET /api/v1/maintenance/schedules` — Lists active maintenance schedules and upcoming service dates.
- `GET /api/v1/maintenance/schedules/overdue` — Filters for overdue maintenance schedules requiring immediate attention.
- `GET /api/v1/maintenance/schedules/:id` — Retrieves full details and task checklists for a maintenance schedule.
- `PUT /api/v1/maintenance/schedules/:id` — Updates service intervals or task checklists for a maintenance schedule.
- `POST /api/v1/maintenance/schedules/:id/trigger` — Manually spawns an immediate maintenance work order from a schedule.
- `DELETE /api/v1/maintenance/schedules/:id` — Deactivates a recurring maintenance schedule.
- `POST /api/v1/maintenance` — Logs a completed maintenance work order with parts replaced and labor hours.
- `GET /api/v1/maintenance` — Lists completed and in-progress maintenance service logs.
- `GET /api/v1/maintenance/:id` — Retrieves full service history and replaced component details for a maintenance log.
- `PUT /api/v1/maintenance/:id` — Updates maintenance log notes or work-order completion details.
- `DELETE /api/v1/maintenance/:id` — Soft-deletes an erroneous maintenance log record.

### 8.6 Real-Time Pyrometry & AMS 2750G / CQI-9 Enforcement

- **Multi-Zone Thermocouple Telemetry:** Streams temperature data from Control, Overtemperature, and Load thermocouples (1–6).
- **Pyrometry Compliance Tracker:** Tracks Temperature Uniformity Survey (TUS) and System Accuracy Test (SAT) validity windows and alerts on upcoming expirations.

### 8.7 Frontend Machine Pages & Components

- **Machine Fleet List (`/machines`):** Displays machine cards with live status pills, current job links, and capability tags.
- **Machine Details Page (`/machines/:id`):** Provides a comprehensive machine console covering Specifications, Status History, Utilization, and Maintenance.
- **Machine Dashboard Page (`/machines/dashboard`):** Visualizes fleet-wide OEE, uptime percentages, and status distribution charts.
- **Machine Status Cards (`MachineStatusCards.tsx`):** Displays visual KPI cards with live operational state indicators for each furnace.
- **Machine Action Menu (`MachineActionMenu.tsx`):** Offers a quick-action dropdown to initiate maintenance, report breakdowns, or calibrate sensors.
- **Downtime Timeline (`DowntimeTimeline.tsx`):** Renders a visual timeline of historical downtime events and maintenance durations.
- **Utilization Charts (`UtilizationCharts.tsx`):** Displays OEE and uptime trend charts by equipment asset.
- **Maintenance History (`MaintenanceHistory.tsx`):** Renders chronological PM service cards with technician notes and due dates.
- **Machine Specifications (`MachineSpecifications.tsx`):** Lists working zone dimensions, temperature limits, atmospheric controls, and certifications.

---

## 9. Inventory, Raw Materials & Traceability

### 9.1 Stock Classification & Ledger

- **Material Categories:** Manages Raw Material Bar Stock, Quench Media (Oils, Polymers), Atmosphere Gases (N₂, NH₃, Acetylene), and Lab Consumables.

### 9.2 Backend API Endpoints

- `POST /api/v1/inventory` — Creates a new inventory item record (SKU) with reorder points and unit costs.
- `GET /api/v1/inventory` — Lists inventory items with category, stock level, and location filtering.
- `GET /api/v1/inventory/:id` — Retrieves item details including current balance, allocated stock, and storage locations.
- `PUT /api/v1/inventory/:id` — Updates item specifications, reorder levels, or unit pricing.
- `DELETE /api/v1/inventory/:id` — Soft-deletes a discontinued inventory item SKU.
- `POST /api/v1/inventory/:id/adjust` — Performs a manual stock adjustment with required supervisor reason codes.
- `GET /api/v1/inventory/alerts/low-stock` — Returns all inventory items currently below their designated safety reorder thresholds.

### 9.3 Goods Receipt, Issue & Transfers

- `POST /api/v1/inventory/goods-receipt` — Records incoming raw material deliveries, supplier heat numbers, and Mill Test Certificates (MTR).
- `POST /api/v1/inventory/goods-issue` — Issues raw materials and consumables to a specific production work order.
- `POST /api/v1/inventory/stock-movement` — Records internal inventory relocations between storage zones.
- `POST /api/v1/inventory/transfer` — Transfers inventory between plant warehouse locations or physical storage bays.

### 9.4 Work Order Reservations

- `POST /api/v1/inventory/stock-reservation` — Reserves specific raw materials or batches for scheduled work orders to prevent stockouts.
- `POST /api/v1/inventory/stock-reservation/release` — Releases unused stock reservations back to available inventory.

### 9.5 Batch & Heat Lot Traceability

- `POST /api/v1/inventory/batches` — Creates a unique heat lot batch record linked to supplier MTRs and chemistry certifications.
- `GET /api/v1/inventory/batches/track/:batchNumber` — Traces complete lineage and job history for a specific raw material heat lot number.
- `GET /api/v1/inventory/batches/:itemId` — Lists all active and consumed batches for an inventory item.

### 9.6 Transaction History

- `GET /api/v1/inventory/transactions` — Returns a paginated audit ledger of all inventory transactions across the plant.
- `GET /api/v1/inventory/:itemId/transactions` — Retrieves the complete transaction history for a specific inventory SKU.

### 9.7 Frontend Inventory Pages & Components

- **Inventory List Page (`/inventory`):** Displays stock tables with safety level indicators, category filters, and adjustment dialogs.
- **Material Details Page (`/inventory/materials/:id`):** Shows chemical composition, batch allocations, movement logs, and reorder controls.
- **Batch Details Page (`/inventory/batches/:id`):** Displays heat lot certificates, MTR documents, and linked job consumption records.
- **Warehouse View Page (`/inventory/warehouses`):** Visualizes warehouse bin occupancy and shelf topologies across storage aisles.
- **Inventory Summary Cards (`InventoryCards.tsx`):** Displays valuation totals, active SKU counts, and low-stock alert metrics.
- **Inventory Ledger Table (`InventoryTable.tsx`):** Provides a sortable stock table with inline adjustment and transfer triggers.
- **Batch Timeline (`BatchTimeline.tsx`):** Renders the lifecycle of a heat lot from supplier receipt through job processing.
- **Warehouse Location Cards (`WarehouseLocationCards.tsx`):** Displays visual bin layout cards showing current storage capacity.

---

## 10. Workforce, Attendance, Shifts & Labor Operations

### 10.1 Shift Management

- `POST /api/v1/attendance/shifts` — Defines a plant operating shift with start/end times, break allowances, and overtime rules.
- `GET /api/v1/attendance/shifts` — Lists all defined operating shifts and schedules.
- `GET /api/v1/attendance/shifts/:id` — Retrieves details and working hour configurations for a specific shift.
- `PUT /api/v1/attendance/shifts/:id` — Updates shift working hours, break durations, or grace period settings.
- `DELETE /api/v1/attendance/shifts/:id` — Deactivates an unused plant shift definition.

### 10.2 Shift Scheduling & Roster

- `POST /api/v1/attendance/schedules` — Assigns an employee to a scheduled shift slot on a specific date.
- `GET /api/v1/attendance/schedules` — Retrieves shift roster assignments by department, employee, or date range.
- `GET /api/v1/attendance/schedules/conflicts` — Scans scheduled rosters to detect double-booking or rest-period violations.
- `GET /api/v1/attendance/schedules/calendar` — Returns the complete plant shift roster formatted for monthly calendar views.
- `GET /api/v1/attendance/schedules/history/:employeeId` — Fetches the historical shift assignment record for an employee.
- `POST /api/v1/attendance/schedules/:id/reassign` — Reassigns a shift slot to a different qualified operator.
- `DELETE /api/v1/attendance/schedules/:id` — Removes an employee from a scheduled shift assignment.

### 10.3 Attendance Records

- `POST /api/v1/attendance/records` — Captures employee clock-in and clock-out timestamps for a shift.
- `PATCH /api/v1/attendance/records/:id/correct` — Allows supervisors to correct missed punches or adjust recorded hours with justification.
- `GET /api/v1/attendance/records` — Lists attendance logs with status filters (Present, Late, Absent, Early Departure).
- `GET /api/v1/attendance/records/:id` — Retrieves details and punch timestamps for a single attendance record.

### 10.4 Leave Management

- `POST /api/v1/attendance/leaves` — Submits a formal paid or unpaid leave request for supervisor review.
- `PATCH /api/v1/attendance/leaves/:id/approve` — Approves a submitted leave request and updates employee leave balances.
- `PATCH /api/v1/attendance/leaves/:id/reject` — Rejects a leave request and records the supervisor's reason.
- `PATCH /api/v1/attendance/leaves/:id/cancel` — Allows employees to cancel a pending or approved leave request before the leave date.
- `GET /api/v1/attendance/leaves/balances/:employeeId` — Returns available Annual, Sick, and Casual leave balances for an employee.
- `GET /api/v1/attendance/leaves/history/:employeeId` — Retrieves historical leave requests and approval records for an employee.
- `GET /api/v1/attendance/leaves` — Lists all leave applications with status and department filtering.

### 10.5 Overtime Management

- `POST /api/v1/attendance/overtimes` — Requests authorization for planned overtime hours before a shift.
- `POST /api/v1/attendance/overtimes/record` — Directly logs verified overtime hours worked by an employee.
- `PATCH /api/v1/attendance/overtimes/:id/approve` — Authorizes overtime hours for payroll calculation at applicable multiplier rates.
- `PATCH /api/v1/attendance/overtimes/:id/reject` — Rejects unauthorized overtime claims with supervisor notes.
- `GET /api/v1/attendance/overtimes/history/:employeeId` — Returns the chronological overtime record for an employee.
- `GET /api/v1/attendance/overtimes` — Lists overtime logs with multiplier categories (1.5x, 2.0x) and status filters.

### 10.6 Shift Swapping & Holiday Calendar

- `POST /api/v1/attendance/shift-swaps` — Submits a peer-to-peer shift swap request between two qualified workers.
- `PATCH /api/v1/attendance/shift-swaps/:id/approve` — Approves a shift swap and automatically updates both workers' rosters.
- `POST /api/v1/attendance/holidays` — Adds a recognized plant holiday or scheduled shutdown to the operating calendar.
- `GET /api/v1/attendance/holidays` — Lists all upcoming and past plant holidays.

### 10.7 Availability & Calendar Queries

- `GET /api/v1/attendance/availability/:employeeId` — Checks an employee's real-time working availability for emergency job assignments.
- `GET /api/v1/attendance/calendar` — Returns the consolidated plant calendar combining shifts, leaves, and plant holidays.

### 10.8 Frontend Workforce Pages & Components

- **Workforce Shifts Page (`/workforce/shifts`):** Displays the shift roster with operator allocation chips and swap controls.
- **Workforce Attendance Page (`/workforce/attendance`):** Renders daily attendance logs with clock-in actions and punch adjustment dialogs.
- **Leave Requests Page (`/workforce/leave`):** Provides a leave submission portal with balance cards and supervisor approval queues.
- **Overtime Page (`/workforce/overtime`):** Tracks overtime authorizations, multiplier calculations, and budget compliance metrics.
- **Shift Cards (`ShiftCards.tsx`):** Displays visual cards summarizing shift coverage and assigned personnel.
- **Workforce Attendance Table (`WorkforceAttendanceTable.tsx`):** Renders tabular attendance data with shift compliance percentages.
- **Workforce Calendar (`WorkforceCalendar.tsx`):** Visualizes shift rosters, approved leaves, and plant holidays on a monthly grid.

---

## 11. Employee Directory & Personnel Management

### 11.1 Backend API Endpoints

- `POST /api/v1/employees` — Creates an employee record with department, job title, and contact details.
- `GET /api/v1/employees` — Lists all employees with search and department filtering.
- `GET /api/v1/employees/:id` — Retrieves an employee profile including certifications, assignments, and employment status.
- `GET /api/v1/employees/code/:code` — Looks up an employee record by their unique badge/employee code.
- `PUT /api/v1/employees/:id` — Updates employee profile data, contact details, or department assignments.
- `DELETE /api/v1/employees/:id` — Soft-deletes an employee record upon offboarding.
- `PATCH /api/v1/employees/:id/status` — Updates an employee's active status (e.g., Active, On Leave, Suspended).
- `PATCH /api/v1/employees/:id/deactivate` — Deactivates an employee's system access upon departure while preserving history.
- `PATCH /api/v1/employees/:id/reactivate` — Re-enables system access for a returning employee.
- `PATCH /api/v1/employees/:id/restore` — Restores an archived employee profile back to active directory views.
- `PATCH /api/v1/employees/:id/assign` — Assigns an employee to a specific plant department or production cell.
- `PATCH /api/v1/employees/:id/skills` — Updates certified technical skills (e.g., Vacuum Furnace Operator, Pyrometry Specialist).
- `PATCH /api/v1/employees/:id/availability` — Sets recurring weekly working hours and availability preferences for an operator.

### 11.2 Frontend Employee Pages & Components

- **Employee Directory Page (`/workforce/employees`):** Renders searchable employee cards with job titles, departments, and skill badges.
- **Employee Details Page (`/workforce/employees/:id`):** Provides a complete employee workbench covering profile info, job history, and certifications.
- **Employee Profile Page (`/workforce/employees/:id/profile`):** Displays technical qualifications, safety certifications, and emergency contacts.
- **Attendance History Page (`/workforce/employees/:id/attendance`):** Shows per-employee clock-in history and punch records.
- **Employee Cards (`EmployeeCards.tsx`):** Renders responsive profile cards with quick-action links.
- **Attendance Timeline (`AttendanceTimeline.tsx`):** Visualizes daily attendance punch events in a chronological timeline.
- **Employee Activity Feed (`EmployeeActivityFeed.tsx`):** Streams recent actions, job allocations, and system events for an employee.
- **Leave Calendar (`LeaveCalendar.tsx`):** Shows individual leave history and approved time-off on a personal calendar.
- **Profile Tabs (`ProfileTabs.tsx`):** Provides tabbed navigation between employee profile sections.

---

## 12. Configurable State Machine & Workflow Engine

### 12.1 Backend API Endpoints

**Workflow Definitions:**

- `POST /api/v1/workflows/definitions` — Creates a JSON-defined state machine with transition rules, guards, and action hooks.
- `POST /api/v1/workflows/definitions/:workflowId/versions` — Creates a new version of an existing workflow definition without breaking running instances.
- `GET /api/v1/workflows/definitions` — Lists all configured workflow definitions across domain processes.
- `GET /api/v1/workflows/definitions/:id` — Retrieves a specific workflow definition and its complete state graph.
- `DELETE /api/v1/workflows/definitions/:id` — Deactivates a workflow definition to prevent new instance creation.

**Workflow Instances:**

- `POST /api/v1/workflows/instances` — Spawns a new workflow instance for a business entity (e.g., starting an approval workflow).
- `POST /api/v1/workflows/instances/:id/actions` — Executes a named transition action to advance an instance to its next valid state.
- `POST /api/v1/workflows/instances/:id/rollback` — Reverts a workflow instance to its prior state when an error or rejection occurs.
- `GET /api/v1/workflows/instances/:id` — Retrieves the current state, active payload, and available next actions for an instance.
- `GET /api/v1/workflows/instances/:id/history` — Returns the complete transition history and timestamped audit log for a workflow instance.

### 12.2 Frontend Workflow Integration

- **Workflow API (`workflowApi.ts`):** Exposes typed RTK Query hooks to manage workflow definitions, execute actions, and query history.
- **State Machine Guard Integration:** Powers approval chains for production jobs, QA certifications, leave applications, and dispatch gates.

---

## 13. Outbound Dispatch & Shipping Logistics

### 13.1 Shipment Lifecycle State Machine

`DRAFT` ➔ `QUALITY_VERIFIED` ➔ `SCHEDULED` ➔ `APPROVED` ➔ `DISPATCHED` ➔ `DELIVERED` / `CANCELLED`

### 13.2 Backend API Endpoints

- `POST /api/v1/dispatch` — Creates an outbound consignment order grouping finished jobs for customer delivery.
- `GET /api/v1/dispatch` — Lists dispatch consignments with status, customer, and date range filters.
- `GET /api/v1/dispatch/:id` — Retrieves complete dispatch order details including job manifests, carrier info, and compliance documents.
- `POST /api/v1/dispatch/:id/verify-quality` — Verifies that all jobs in the consignment have passed QA inspection and possess approved CoCs.
- `POST /api/v1/dispatch/:id/verify-documents` — Confirms compliance documents (Delivery Challan, CoC, Packing List) are attached.
- `POST /api/v1/dispatch/:id/schedule` — Assigns carrier name, Bill of Lading (BOL), vehicle registration, and driver details.
- `POST /api/v1/dispatch/:id/approve` — Grants plant manager authorization for the shipment to depart the facility.
- `POST /api/v1/dispatch/:id/dispatch` — Records physical departure from the facility and updates shipment status to In Transit.
- `POST /api/v1/dispatch/:id/deliver` — Confirms final delivery to the customer and uploads Proof of Delivery (PoD) records.
- `POST /api/v1/dispatch/:id/cancel` — Cancels an unsent dispatch order and releases assigned jobs back to finished-goods storage.
- `GET /api/v1/dispatch/:id/history` — Returns the complete timestamped audit trail of shipping state transitions.

### 13.3 Frontend Dispatch Pages & Components

- **Dispatch List Page (`/dispatch`):** Displays dispatch orders with status tabs, carrier tracking info, and compliance indicators.
- **Dispatch Details Workbench (`/dispatch/:id`):** Provides a 5-tab shipping console covering Manifest, Compliance, Carrier, Challan, and History.
- **Delivery Challan Print View:** Generates an ISO-formatted printable delivery manifest with signature blocks and packing lists.

---

## 14. Executive Analytics & Domain Reporting

### 14.1 Backend API Endpoints

- `GET /api/v1/reports/dashboards/executive` — Returns high-level executive KPIs covering monthly revenue, plant OEE, delivery rates, and scrap percentages.
- `GET /api/v1/reports/dashboards/operational` — Returns live shop-floor operational metrics covering active jobs, machine status, and workforce coverage.
- `GET /api/v1/reports/production` — Generates production throughput reports summarizing completed tonnage and cycle durations.
- `GET /api/v1/reports/inventory` — Generates inventory valuation reports by material category and consumption rate.
- `GET /api/v1/reports/attendance` — Generates workforce attendance compliance and overtime cost analysis reports.
- `GET /api/v1/reports/utilization` — Computes fleet equipment uptime, downtime hours, and OEE performance rankings.
- `GET /api/v1/reports/quality` — Compiles First Pass Yield (FPY %) metrics, defect Pareto distributions, and open NCR summaries.
- `GET /api/v1/reports/financial` — Exposes financial billing and revenue summaries (scaffolded).
- `POST /api/v1/reports/export` — Asynchronously generates downloadable report exports in CSV, XLSX, or PDF format.
- `POST /api/v1/reports/schedules` — Creates an automated recurring schedule to generate and email reports.
- `GET /api/v1/reports/schedules` — Lists configured automated report schedules.
- `POST /api/v1/reports/schedules/:id/execute` — Manually triggers the immediate execution and delivery of a scheduled report.

### 14.2 Frontend Report Pages & Components

- **Executive Analytics Dashboard (`/reports`):** Displays high-level executive KPI cards and revenue trend charts.
- **Production Reports Page (`/reports/production`):** Visualizes throughput tonnage, completed heat treatment batches, and cycle metrics.
- **Inventory Reports Page (`/reports/inventory`):** Shows stock valuation by material category and tracks monthly consumption trends.
- **Machine Equipment Reports (`/reports/machines`):** Analyzes equipment uptime, maintenance costs, and OEE performance.
- **Workforce Attendance Reports (`/reports/attendance`):** Visualizes shift attendance rates, overtime hours, and labor costs.
- **Report Filters Panel (`ReportFiltersPanel.tsx`):** Provides date range and facility bay selectors for report filtering.
- **Report KPI Summary Cards (`ReportKpiCards.tsx`):** Displays executive metrics with period-over-period delta indicators.
- **Report Export Dialog (`ReportExportDialog.tsx`):** Configures format (CSV, XLSX, PDF) and date range for report exports.
- **Interactive Chart Suite (`InteractiveCharts.tsx`):** Renders interactive revenue trend lines and process volume donut charts.

---

## 15. Global Search & Command Palette

### 15.1 Backend API Endpoints

- `GET /api/v1/search?q=...&categories=...` — Executes a multi-domain, permission-scoped search across all ERP entities.
- `GET /api/v1/search/suggestions?q=...` — Returns instant query suggestions and recent search terms as the user types.

### 15.2 Backend Search Engine Features

- **Cross-Domain Search Indexing:** Queries Jobs, Employees, Customers, Equipment, Inventory, Quality Inspections, and Dispatches simultaneously.
- **Permission-Aware Scoping:** Filters out results from domains where the user lacks explicit read permissions.
- **Tenant Partitioning:** Automatically scopes all search queries to the authenticated tenant and ignores soft-deleted records.
- **Category Filtering:** Restricts searches to specific domain categories when selected by the user.
- **Structured Result Grouping:** Organizes results by domain entity with standardized identifiers, titles, and status chips.

### 15.3 Frontend Command Palette (`CommandPalette.tsx`)

- **Global Shortcut Trigger (`Ctrl+K`):** Opens the command palette from anywhere in the application.
- **Frosted Glass Backdrop:** Uses Apple-styled frosted glass materials (`material-thick`) with background blur.
- **Domain Category Filter Capsules:** Provides clickable category chips to narrow search scope (e.g., Jobs, Machines, Inventory).
- **Persistent Search History:** Stores recent searches in `localStorage` for fast replay and one-click clearing.
- **Live Autocomplete Chips:** Displays search suggestions as the user types.
- **Full Keyboard Navigation:** Supports `ArrowUp`/`ArrowDown` navigation, `Enter` to select, and `ESC` to dismiss.
- **Search RTK Query Layer (`searchApi.ts`):** Handles caching and request debouncing for search queries.

---

## 16. Notification Center & Alert Delivery

### 16.1 Backend API Endpoints

- `POST /api/v1/notifications/templates` — Creates reusable notification templates with dynamic merge variables.
- `GET /api/v1/notifications/templates` — Lists available notification templates by domain category.
- `GET /api/v1/notifications/preferences` — Retrieves the authenticated user's delivery channel preferences.
- `PUT /api/v1/notifications/preferences` — Updates the authenticated user's notification preferences.
- `GET /api/v1/notifications/preferences/:userId` — Retrieves notification preferences for a specific user (admin).
- `PUT /api/v1/notifications/preferences/:userId` — Updates notification preferences for a specific user (admin).
- `POST /api/v1/notifications/send` — Programmatically dispatches an alert across enabled delivery channels.
- `GET /api/v1/notifications/unread-count` — Returns the current count of unread notifications for badge counters.
- `PATCH /api/v1/notifications/mark-all-read` — Marks all notifications in the user's inbox as read.
- `GET /api/v1/notifications/user/:userId` — Retrieves paginated notifications for a user's inbox.
- `PATCH /api/v1/notifications/:id/read` — Marks a specific notification as read.
- `GET /api/v1/notifications/:id/history` — Returns the delivery history and channel receipt logs for a notification.

### 16.2 Frontend Notification Components & Pages

- **Slide-Over Notification Panel (`NotificationPanel.tsx`):** Provides a quick-access drawer displaying categorized alerts with deep-link navigation.
- **Notification Center Page (`/notifications`):** Offers a full inbox interface with search, category filtering, and priority indicators.
- **Notification Preferences Console (`NotificationPreferences.tsx`):** Configures delivery channels (In-App, Email, SMS, Push, Webhooks) and muting rules.
- **Notification API Layer (`notificationApi.ts`):** Exposes RTK Query hooks for notification fetching, reading, and preference management.

---

## 17. Manufacturing Command Center Dashboard

### 17.1 Dashboard Widgets (10 Active Widgets)

- **KPI Summary Widget (`KpiSummaryWidget.tsx`):** Displays real-time metrics for Active Jobs, Running Furnaces, Pending QC, and Today's Dispatches.
- **Production Summary Widget (`ProductionSummaryWidget.tsx`):** Renders a 7-day job completion bar chart showing throughput trends.
- **Machine Status Widget (`MachineStatusWidget.tsx`):** Displays a fleet-wide status distribution chart (Running, Idle, Maintenance, Breakdown).
- **Inventory Alerts Widget (`InventoryAlertsWidget.tsx`):** Lists raw materials and consumables that have fallen below safety reorder points.
- **Pending Approvals Widget (`PendingApprovalsWidget.tsx`):** Surfaces pending supervisor approval requests for leaves, overtimes, and QC sign-offs.
- **Quality Alerts Widget (`QualityAlertsWidget.tsx`):** Highlights open Non-Conformance Reports (NCRs) and recent inspection failures.
- **Attendance Summary Widget (`AttendanceSummaryWidget.tsx`):** Shows today's shift check-in percentage and workforce attendance rate.
- **Upcoming Maintenance Widget (`UpcomingMaintenanceWidget.tsx`):** Displays upcoming Preventive Maintenance schedules and days-to-due counters.
- **Recent Activity Feed (`RecentActivityWidget.tsx`):** Streams real-time cross-domain events (job starts, QC approvals, dispatches) with timestamps.
- **Pending Jobs Widget (`PendingJobsWidget.tsx`):** Lists work orders in `PENDING_REVIEW` status awaiting engineering approval.

### 17.2 Dashboard Features

- **Time Range Selector:** Toggles dashboard telemetry windows between Live Shift, Today, Yesterday, This Week, and This Month.
- **Shop-Floor Telemetry Refresh:** Refreshes live sensor data with animated toast confirmations.
- **Rapid Work Order Creator:** Provides a header shortcut to open the `CreateJobModal` directly from the dashboard.

---

## 18. Frontend Application Shell & Navigation

### 18.1 Layout Components

- **Main Shell (`MainLayout.tsx`):** Orchestrates the responsive application layout with sidebar, header, and main content areas.
- **Navigation Sidebar (`Sidebar.tsx`):** Renders a collapsible navigation rail organized by domain modules (Production, Quality, Machines, etc.).
- **Application Header (`Header.tsx`):** Houses company branding, the `Ctrl+K` search bar, the notification bell, and the user profile menu.
- **Mobile Navigation Drawer (`MobileNavDrawer.tsx`):** Provides a touch-friendly bottom sheet navigation menu for tablet and mobile viewports.
- **User Profile Menu (`UserMenu.tsx`):** Displays user identity, role tags, settings shortcuts, dark mode toggles, and logout actions.
- **Application Footer (`Footer.tsx`):** Renders platform version, system status indicators, and legal notices.
- **Auth Shell (`AuthLayout.tsx`):** Provides a centered glassmorphic card container for login and password recovery pages.
- **Page Container Wrapper (`PageContainer.tsx`):** Enforces standard max-width constraints and responsive padding across all views.
- **Page Transition Wrapper (`PageTransition.tsx`):** Applies smooth fade-and-drift animations (`animate-page-enter`) during route changes.

### 18.2 Error Handling

- **Application Error Boundary (`ErrorBoundary.tsx`):** Catches unhandled React rendering errors and displays a recovery UI with retry actions.
- **Not Found Page (`/404`):** Displays an Apple-styled 404 screen with navigation options to return to safe routes.
- **Protected Route Guard (`auth/ProtectedRoute.tsx`):** Enforces JWT authentication and permission checks before rendering protected routes.

---

## 19. Frontend Charts & Data Visualization

All visualization components are built using custom SVG and Canvas implementations styled with Apple design tokens:

- **Area Trend Chart (`AreaChart.tsx`):** Renders smooth gradient area charts for time-series metrics like Revenue, FPY %, and OEE trends.
- **Categorical Bar Chart (`BarChart.tsx`):** Renders grouped bar charts for categorical comparisons like production volume by process.
- **Segmented Donut Chart (`DonutChart.tsx`):** Renders proportional donut charts with centered KPI callouts for distribution metrics.

---

## 20. Frontend Apple Design System & Component Library

### 20.1 Apple HIG Design Tokens

- **SF Pro Typography Scale:** Standardizes font sizes and line heights across `text-display`, `text-large-title`, `text-title-1`, `text-body`, and `text-caption`.
- **Translucent Materials:** Applies frosted glass backgrounds (`material-ultra-thin`, `material-thin`, `material-regular`, `material-thick`) with backdrop filters.
- **Continuous Squircles:** Uses squircle corner radii (`rounded-2xl`, `rounded-3xl` for cards; `rounded-xl` for buttons; `rounded-full` for chips).
- **Tactile Spring Curves:** Powers UI micro-interactions using standard spring cubic-bezier curves and press feedback (`active:scale-[0.97]`).
- **Keyframe Animations:** Standardizes UI motion via `animate-page-enter`, `animate-dialog-enter`, `animate-drawer-enter-right`, and `animate-toast-enter`.
- **Semantic Color Tokens:** Manages light/dark themes using semantic tokens for canvas, surface, borders, text, and status states.
- **Accessibility & Motion Guards:** Respects user preferences for `prefers-reduced-motion` and `prefers-reduced-transparency` with WCAG 2.1 AA compliance.

### 20.2 Complete UI Primitive Components (30 Directories)

| Component                          | Description                                                                        | Purpose                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **`AppButton`**                    | Standard button with Primary, Secondary, Tinted, Ghost, Danger, and Pill variants. | Provides tactile interactive button controls with loading spinners and disabled states. |
| **`IconButton`**                   | Compact circular/square icon button with tooltip integration.                      | Houses toolbar actions like refresh, edit, delete, and notifications.                   |
| **`ActionButton`**                 | Compound split-button with an attached context menu dropdown.                      | Offers primary actions with alternative secondary choices.                              |
| **`PageHeader`**                   | Standardized page header component with title, subtitle, icon, and action slots.   | Establishes consistent visual hierarchy at the top of every screen.                     |
| **`IconText`**                     | Single-line alignment component for Lucide icons and text labels.                  | Guarantees perfect vertical baseline alignment for icon-text pairings.                  |
| **`AppBreadcrumbs`**               | Accessible navigation breadcrumb trail using semantic `<nav>` markup.              | Informs users of their current location within nested module hierarchies.               |
| **`AppCard`**                      | Container card with glass, elevated, outlined, and interactive hover variants.     | Groups related content and forms into visually distinct surface containers.             |
| **`DataTable`**                    | High-density data table with keyboard row selection and sorting.                   | Renders paginated business data with accessible headers and responsive overflow.        |
| **`AppPagination`**                | Accessible pagination controller with rows-per-page selectors.                     | Manages navigation across large paginated data sets.                                    |
| **`AppTabs`**                      | Segmented pill tabs and underline tabs with badge counter support.                 | Swaps between sub-views and filtered perspectives without page reloads.                 |
| **`AppDialog`**                    | Accessible modal dialog with backdrop blur and focus trapping.                     | Focuses user attention on critical confirmation prompts and editing forms.              |
| **`AppDrawer`**                    | Slide-over side sheet with spring entrance animations.                             | Houses deep inspection details and creation wizards without navigating away.            |
| **`AppInput`**                     | Form input component with associated labels, validation errors, and focus rings.   | Captures textual and numeric user inputs with validation styling.                       |
| **`AppSelect`**                    | Styled select dropdown component with keyboard accessibility.                      | Allows single selection from short lists of options.                                    |
| **`AppDropdown`**                  | Lightweight dropdown menu selector for form controls and filter bars.              | Provides clean dropdown option pickers within toolbars.                                 |
| **`AppCheckbox`**                  | Accessible checkbox component with custom indicator styling.                       | Captures binary preferences and multi-row table selections.                             |
| **`AppRadio`**                     | Accessible radio group component with custom indicators.                           | Enforces single selection among mutually exclusive choices.                             |
| **`AppSwitch`**                    | Toggle switch component with smooth thumb transitions.                             | Toggles instant boolean feature flags and system settings.                              |
| **`SearchBar`**                    | Input bar with leading search icon and one-click clear button.                     | Provides real-time text filtering across tables and lists.                              |
| **`AppChip`**                      | Semantic status chip with success, warning, error, and primary variants.           | Labels entities with compact status and category metadata tags.                         |
| **`IconBadge`**                    | Compact badge component pairing a mini icon with a text label.                     | Highlights telemetry readings and operational tags in high-density views.               |
| **`StatusBadge`**                  | Domain-specific status badge for inspections, jobs, and shifts.                    | Renders standardized status badges with color-coded semantic tints.                     |
| **`AppAvatar`**                    | User avatar component displaying user profile photos or initials.                  | Identifies actors in user tables, audit logs, and assignment chips.                     |
| **`AppAlert`**                     | Inline alert banner supporting Info, Success, Warning, and Error types.            | Communicates important system messages, validation summaries, and warnings.             |
| **`ToastContainer`**               | Floating toast notification provider with spring animation.                        | Delivers non-blocking confirmation toasts for completed background mutations.           |
| **`AppSkeleton`**                  | Shimmering placeholder component matching target layout shapes.                    | Prevents layout shift and indicates loading states during data fetching.                |
| **`AppLoader` / `LoadingSpinner`** | Accessible SVG loading spinner with size variants.                                 | Indicates active background network queries and processing states.                      |
| **`EmptyState`**                   | Empty-view container with icon, title, description, and call-to-action button.     | Guides users when tables or queries return zero results.                                |
| **`ErrorState`**                   | Error placeholder with illustrative icon and a retry trigger.                      | Provides recovery actions when network queries or components fail to load.              |
| **`FilterPanel`**                  | Collapsible filter container with apply and reset buttons.                         | Houses complex multi-parameter filter controls for tables.                              |
| **`AppTooltip`**                   | Floating tooltip wrapper with directional positioning.                             | Reveals supplementary explanatory text on hover or focus.                               |
| **`AppSection`**                   | Semantic section container with standard title and action slots.                   | Groups related fields and widgets into clear visual chapters.                           |
| **`NavigationItem`**               | Sidebar navigation button with active route indicators and collapsed tooltips.     | Manages primary sidebar navigation links with accessibility compliance.                 |

### 20.3 Design System Showcase

- **Design System Gallery (`/design-system`):** Provides an interactive documentation page demonstrating all UI primitives, variants, and states.

---

## 21. Frontend RTK Query API Layer

| API File                 | Domain               | Purpose & Functionality                                                                                        |
| ------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| **`authApi.ts`**         | Authentication       | Manages user login, token refresh, logout, password resets, and user profile queries.                          |
| **`jobApi.ts`**          | Production Jobs      | Handles work-order CRUD, status transitions, scheduling, worker/machine allocations, and progress logging.     |
| **`qualityApi.ts`**      | Quality Control      | Manages inspection creation, hardness survey logs, defect tracking, CoC generation, and NCR/CAPA workflows.    |
| **`machineApi.ts`**      | Equipment            | Handles machine registration, capability queries, breakdown reporting, and utilization telemetry.              |
| **`maintenanceApi.ts`**  | Maintenance          | Manages preventive maintenance schedules, overdue schedule queries, and completed service logs.                |
| **`inventoryApi.ts`**    | Inventory            | Handles stock item CRUD, goods receipt/issue, stock transfers, reservations, and heat lot batch tracking.      |
| **`attendanceApi.ts`**   | Workforce Attendance | Manages shift definitions, worker scheduling rosters, punch logs, leave requests, and overtime authorizations. |
| **`employeeApi.ts`**     | Personnel            | Handles employee directory CRUD, skill certifications, availability windows, and deactivations.                |
| **`dispatchApi.ts`**     | Dispatch Logistics   | Manages shipping orders, QA verification gates, document compliance checks, and delivery confirmations.        |
| **`reportApi.ts`**       | Analytics & Reports  | Fetches executive/operational dashboards, domain report datasets, and manages automated report schedules.      |
| **`searchApi.ts`**       | Global Search        | Executes multi-domain permission-scoped searches and fetches real-time query suggestions.                      |
| **`notificationApi.ts`** | Notifications        | Handles notification fetching, unread counters, mark-as-read actions, and delivery preference updates.         |
| **`settingsApi.ts`**     | System Settings      | Manages system settings, tenant profiles, feature flags, user management, and role assignments.                |
| **`customerApi.ts`**     | Customers            | Handles client company CRUD, credit limit updates, and customer directory filtering.                           |
| **`workflowApi.ts`**     | Workflow Engine      | Manages workflow state-machine definitions, instance execution, transition actions, and rollbacks.             |
| **`baseApi.ts`**         | Core Infrastructure  | Configures the base RTK Query client with automatic JWT token injection and tenant header handling.            |

---

## 22. Security Audit Trail Explorer

### 22.1 Backend

- `GET /api/v1/admin/audit-logs` — Returns a paginated query interface for audit logs with domain, action, actor, and date filters.

### 22.2 Frontend Audit Log Console (`/settings/audit-logs`)

- **Filterable Audit Table (`AuditLogTable.tsx`):** Displays audit records with timestamp, actor, action type, and IP address.
- **Payload Diff Inspector Modal:** Renders a JSON before-and-after visual diff showing exact field modifications for any audit entry.
- **Audit Export Tool:** Generates CSV or JSON exports of audit trails for external regulatory compliance reviews.

---

## 23. Finance & Manufacturing Cost Control

This module is intentionally limited to the financial functions required to understand and control the economics of a heat-treatment factory. It does **not** introduce procurement, CRM, sales management, or unrelated enterprise-finance features.

### 23.1 General Ledger & Accounting Core

- `POST /api/v1/finance/journals` — Creates a balanced journal entry for approved manufacturing, expense, asset, or adjustment transactions.
- `POST /api/v1/finance/journals/:id/post` — Posts an approved journal entry to the general ledger and locks the original transaction.
- `POST /api/v1/finance/journals/:id/reverse` — Creates a reversing journal entry while preserving the original accounting history.
- `GET /api/v1/finance/ledger` — Retrieves posted ledger movements with account, date, job, machine, and cost-center filtering.
- `GET /api/v1/finance/trial-balance` — Generates a trial balance for the selected accounting period.
- `GET /api/v1/finance/profit-loss` — Produces a period-based profit and loss view using posted accounting transactions.
- `POST /api/v1/finance/periods/close` — Closes an accounting period after validation of unresolved postings and adjustments.

### 23.2 Chart of Accounts & Cost Centers

- `POST /api/v1/finance/accounts` — Creates a general-ledger account suitable for manufacturing operations and factory expenses.
- `GET /api/v1/finance/accounts` — Lists active accounts and account hierarchy.
- `PUT /api/v1/finance/accounts/:id` — Updates account descriptions, classifications, or active status without altering historical postings.
- `POST /api/v1/finance/cost-centers` — Creates a factory cost center such as Furnace Bay, Quality Lab, Maintenance, Utilities, or Administration.
- `GET /api/v1/finance/cost-centers` — Lists cost centers used for expense allocation and operational reporting.

### 23.3 Factory Expense Capture

- `POST /api/v1/finance/expenses` — Records approved factory operating expenses with account, cost center, date, amount, and reference details.
- `GET /api/v1/finance/expenses` — Retrieves expense records with job, machine, department, and period filters.
- `PATCH /api/v1/finance/expenses/:id/allocate` — Allocates an eligible expense to a job, machine, department, or shared factory cost pool.

### 23.4 Billing & Receivables

- `POST /api/v1/finance/invoices` — Generates a customer invoice from an approved completed/dispatchable heat-treatment job or job group.
- `GET /api/v1/finance/invoices` — Lists issued invoices with customer, job, status, and date filters.
- `GET /api/v1/finance/invoices/:id` — Retrieves invoice details, linked jobs, tax values, and accounting status.
- `POST /api/v1/finance/invoices/:id/issue` — Finalizes and posts an invoice for accounting.
- `POST /api/v1/finance/receipts` — Records customer payment receipts against issued invoices.
- `GET /api/v1/finance/receivables` — Returns outstanding customer balances and invoice aging.

### 23.5 Frontend Finance Pages

- **Finance Dashboard (`/finance`):** Displays factory revenue, operating expenses, outstanding receivables, and production-cost indicators.
- **Ledger Page (`/finance/ledger`):** Provides searchable posted ledger transactions and accounting-period filtering.
- **Job Cost View (`/finance/job-costs`):** Displays material, labor, machine, energy, overhead, and total cost by production job.
- **Invoice Page (`/finance/invoices`):** Manages heat-treatment invoices and payment status.
- **Cost Center Page (`/finance/cost-centers`):** Displays cost accumulation by factory department and operational area.

---

## 24. Heat-Treatment Product & Process Master Data

This module provides the controlled master data required to execute repeatable heat-treatment work. It is intentionally focused on heat-treatment parts, material grades, processes, recipes, specifications, and revisions.

### 24.1 Item & Material Master

- `POST /api/v1/master-data/items` — Creates a controlled material or finished-part master record.
- `GET /api/v1/master-data/items` — Lists items by material grade, customer reference, process family, or active status.
- `GET /api/v1/master-data/items/:id` — Retrieves item specifications, approved processes, revisions, and traceability requirements.
- `PUT /api/v1/master-data/items/:id` — Updates a master record through controlled revision management.
- `POST /api/v1/master-data/items/:id/revisions` — Creates a new effective-dated revision while preserving prior approved revisions.

### 24.2 Heat-Treatment Process & Recipe Master

- `POST /api/v1/master-data/processes` — Defines a reusable heat-treatment process family and its required controls.
- `GET /api/v1/master-data/processes` — Lists approved heat-treatment process definitions.
- `POST /api/v1/master-data/processes/:id/recipes` — Creates an approved process recipe containing temperature, ramp, soak, atmosphere, quench, and temper parameters.
- `GET /api/v1/master-data/processes/:id/recipes` — Lists active and historical recipe revisions.
- `PUT /api/v1/master-data/recipes/:id` — Updates an unpublished recipe revision before approval.
- `POST /api/v1/master-data/recipes/:id/approve` — Approves a recipe revision for production use.
- `POST /api/v1/master-data/recipes/:id/retire` — Retires a recipe revision from future scheduling while preserving historical usage.

### 24.3 Specification & Requirement Master

- `POST /api/v1/master-data/specifications` — Creates a customer or engineering specification defining required process and quality limits.
- `GET /api/v1/master-data/specifications` — Lists specifications by process, material, customer, and status.
- `PUT /api/v1/master-data/specifications/:id` — Updates a specification through revision control.
- `POST /api/v1/master-data/specifications/:id/approve` — Approves a specification revision for production and inspection use.

### 24.4 Controlled Master-Data Rules

- **Effective Dating:** Prevents future jobs from unintentionally using expired recipes or specifications.
- **Revision Locking:** Prevents modification of approved revisions after production usage.
- **Job Snapshotting:** Copies the exact approved recipe/specification revision into the job record for immutable historical traceability.

---

## 25. Material Requirements & Production Planning

This module is limited to planning the factory's heat-treatment workload, material availability, furnace capacity, and operator capacity. It does not introduce generic enterprise demand-planning features unrelated to factory execution.

### 25.1 Material Requirement Planning

- `POST /api/v1/planning/material-requirements/run` — Calculates required raw-material quantities for approved and scheduled heat-treatment work.
- `GET /api/v1/planning/material-requirements` — Lists material requirements, available stock, shortages, and reserved quantities.
- `GET /api/v1/planning/material-requirements/shortages` — Returns unresolved material shortages that could block scheduled work.
- `POST /api/v1/planning/material-requirements/:id/reserve` — Reserves available heat lots or inventory quantities against planned jobs.

### 25.2 Production Planning

- `POST /api/v1/planning/production-plans` — Creates a production plan from approved jobs and required completion dates.
- `GET /api/v1/planning/production-plans` — Lists active production plans and their progress.
- `GET /api/v1/planning/production-plans/:id` — Retrieves planned jobs, required materials, furnace capacity, and operator coverage.
- `PUT /api/v1/planning/production-plans/:id` — Updates planning priorities, planned quantities, or target dates before execution.
- `POST /api/v1/planning/production-plans/:id/recalculate` — Recalculates the plan after machine, material, or workforce constraints change.

### 25.3 Furnace Capacity Planning

- `GET /api/v1/planning/capacity/machines` — Returns available furnace capacity by date, shift, machine capability, and planned load.
- `GET /api/v1/planning/capacity/operators` — Returns operator capacity and skill coverage by shift.
- `POST /api/v1/planning/capacity/check` — Validates whether a set of jobs can fit within machine, shift, material, and workforce constraints.
- `GET /api/v1/planning/bottlenecks` — Identifies machine, material, or workforce bottlenecks affecting planned completion dates.

### 25.4 Planned-to-Execution Handoff

- **Plan-to-Job Conversion:** Converts an approved production plan into executable production jobs without duplicating master data.
- **Capacity Reservation:** Reserves furnace and operator slots against planned work until the job is scheduled or released.
- **Constraint Visibility:** Prevents scheduling work that lacks required material, qualified operators, or capable/available equipment.

---

## 26. Job Costing & Manufacturing Cost Accounting

This module is specifically designed to determine the true cost and profitability of heat-treatment jobs. It is not a generic enterprise budgeting system.

### 26.1 Standard Cost Components

- **Material Cost:** Calculates consumed raw-material and process-consumable cost from actual issued quantities and inventory valuation.
- **Labor Cost:** Calculates direct labor using verified production hours, shift rates, and overtime where applicable.
- **Machine Cost:** Allocates furnace or machine operating cost using runtime, setup time, and configured machine rates.
- **Energy Cost:** Allocates gas, electricity, quench media, or other process-energy cost using actual consumption or approved rate models.
- **Overhead Cost:** Applies controlled factory overhead pools to jobs using configured allocation bases.

### 26.2 Job Costing Endpoints

- `GET /api/v1/costing/jobs/:jobId` — Returns the complete actual and standard cost breakdown for a production job.
- `POST /api/v1/costing/jobs/:jobId/recalculate` — Recalculates job cost after inventory, labor, machine, or overhead transactions are posted.
- `GET /api/v1/costing/jobs/variance` — Returns material, labor, machine, energy, and overhead variances across jobs.
- `GET /api/v1/costing/jobs/profitability` — Calculates job-level revenue, total manufacturing cost, contribution, and margin.

### 26.3 Cost Rate Management

- `POST /api/v1/costing/rates/machine` — Defines or revises machine-hour cost rates.
- `POST /api/v1/costing/rates/labor` — Defines or revises labor cost rates by skill, shift, or role.
- `POST /api/v1/costing/rates/overhead` — Defines controlled overhead allocation rates for factory cost centers.
- `POST /api/v1/costing/rates/energy` — Defines approved energy/process-consumable rates used for cost estimation.

### 26.4 Cost Traceability

- **Transaction-Level Traceability:** Every job cost component links back to the inventory, attendance, machine, energy, or accounting transaction that produced it.
- **Frozen Historical Cost:** Finalized jobs retain their calculated historical cost even when future cost rates change.

---

## 27. Warehouse & Finished-Goods Management

This module is limited to the physical storage and traceability needs of a heat-treatment factory: raw-material storage, in-process holding, quarantine, finished-goods storage, and dispatch staging. It does not implement a generic enterprise warehouse suite.

### 27.1 Warehouse & Bin Structure

- `POST /api/v1/warehouse/locations` — Creates a physical storage location, bay, rack, or bin.
- `GET /api/v1/warehouse/locations` — Lists storage locations with type, capacity, and active status.
- `PUT /api/v1/warehouse/locations/:id` — Updates capacity, labeling, or location status.
- `GET /api/v1/warehouse/occupancy` — Returns current occupancy and available capacity by storage area.

### 27.2 Putaway, Moves & Transfers

- `POST /api/v1/warehouse/putaway` — Places received or completed heat-treatment material into an approved storage location.
- `POST /api/v1/warehouse/move` — Records a controlled movement between bins within the factory.
- `POST /api/v1/warehouse/transfer` — Transfers a heat lot or finished-goods quantity between warehouse areas.
- `GET /api/v1/warehouse/movements` — Retrieves the complete physical movement history for a material, heat lot, or finished-goods lot.

### 27.3 Quarantine & Release

- `POST /api/v1/warehouse/quarantine` — Places a material, heat lot, or finished-goods quantity into controlled quarantine.
- `GET /api/v1/warehouse/quarantine` — Lists quarantined material with quality and disposition status.
- `POST /api/v1/warehouse/quarantine/:id/release` — Releases material only after the required quality or management authorization.
- `POST /api/v1/warehouse/quarantine/:id/reject` — Marks material as rejected and prevents further production or dispatch use.

### 27.4 Finished-Goods Storage

- `POST /api/v1/warehouse/finished-goods/receive` — Receives QA-cleared jobs into finished-goods storage.
- `GET /api/v1/warehouse/finished-goods` — Lists finished-goods lots with customer, job, location, quantity, and dispatch status.
- `PATCH /api/v1/warehouse/finished-goods/:id/reserve` — Reserves finished goods for an approved dispatch.
- `PATCH /api/v1/warehouse/finished-goods/:id/release` — Releases a finished-goods reservation when a dispatch is cancelled or changed.

### 27.5 Cycle Counting & Stock Verification

- `POST /api/v1/warehouse/counts` — Creates a physical stock-count task for a location or heat lot range.
- `POST /api/v1/warehouse/counts/:id/record` — Records the physical count and discrepancy details.
- `POST /api/v1/warehouse/counts/:id/approve` — Approves a stock discrepancy adjustment after supervisor review.

### 27.6 Frontend Warehouse Pages

- **Warehouse Dashboard (`/warehouse`):** Displays raw-material, WIP, quarantine, and finished-goods occupancy.
- **Location View (`/warehouse/locations`):** Visualizes storage areas, bins, capacity, and current contents.
- **Quarantine Queue (`/warehouse/quarantine`):** Displays blocked lots awaiting quality or disposition actions.
- **Finished-Goods Page (`/warehouse/finished-goods`):** Manages QA-cleared lots awaiting dispatch.
- **Stock Count Page (`/warehouse/counts`):** Tracks scheduled and completed physical stock verification tasks.

---
