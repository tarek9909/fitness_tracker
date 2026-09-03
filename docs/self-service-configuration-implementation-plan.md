# Fitness Platform: Self-Service Configuration, OTP Security, Gmail SMTP, and RIR Removal

**Status:** Implementation completed locally and verified with automated backend, dashboard, mobile, contract, migration, and Gmail SMTP transport checks. Production deployment, live MySQL access, and controlled mailbox delivery remain operational follow-up items.

**Implementation note:** This document remains the end-to-end source of truth and checklist. The application changes are now present in the repository; checklist items that require production credentials, deployment access, or a real mailbox smoke test remain open until those operations are performed.

**Local verification completed:** 205 backend tests, backend lint/build, 76 Flutter tests, clean `flutter analyze`, dashboard lint/build, SQLite migration coverage, Gmail SMTP transport verification, and complete runtime/OpenAPI parity (197/197 operations). The only RIR references intentionally retained are the forward migration and migration-test fixtures that remove legacy database columns. Live MySQL verification is pending because this workspace has no usable MySQL password; no real OTP email was sent during verification.

**Objective:** Enable a user to configure and own a private fitness program from the mobile app, allow secure email and password changes through email OTP verification, configure Gmail SMTP for transactional mail, and remove RIR from the entire product.

## 1. Confirmed decisions

The implementation must follow these decisions:

- The user creates a private workout plan from scratch in the mobile app.
- The user creates a private diet plan from scratch in the mobile app.
- User-created plans use the existing exercise and food libraries. Creating new library exercises or foods is not part of this scope; those remain administrator capabilities.
- The user can configure personal information, goals, workout, diet, cardio, water, and reminders from the app.
- The user can change the account email address through OTP verification.
- The user can change the password through OTP verification.
- Password recovery will also be migrated to the same OTP model so there is no competing password-change mechanism based on a long reset token.
- RIR is removed from the product completely: UI, API payloads, database columns, constraints, snapshots, tests, contracts, seed data, and documentation.
- Existing administrator-created plans remain supported. A private user plan becomes the user’s active plan when the user activates it for an effective date.
- Historical workout, diet, and tracking records remain intact. RIR values are intentionally discarded because the field is being removed.
- No real Gmail credentials are committed to the repository. Credentials must be supplied through a secret manager or deployment environment.

## 2. Current-state audit

The implementation should account for the following existing behavior:

| Area | Current state | Required impact |
|---|---|---|
| Mobile profile | `mobile-app/lib/main.dart` shows profile, theme, progress, notifications, and sign-out. There is no fitness-configuration wizard or account-security screen. | Add entry points and new screens. |
| User profile API | `GET/PATCH /me` exists. The database has date of birth and gender, but the current self-service schema does not expose all profile fields. | Extend validation and response mapping safely. |
| Goals and targets | `GET /me/goals` exists. Writes for weight goals, water targets, cardio targets, and adherence configuration are administrator-only. | Add ownership-scoped `/me` write operations. Keep adherence weighting internal unless explicitly exposed later. |
| Workout plans | Versioned plan, day, exercise, and optional per-set tables exist. All builder routes are administrator-only. | Add private-plan ownership, user routes, validation, draft editing, publishing, and activation. |
| Diet plans | Versioned plan, meal, option-group, and food-option tables exist. All builder routes are administrator-only. | Add private-plan ownership, user routes, draft editing, publishing, and activation. |
| Daily plan | `GET /me/today` resolves active workout and diet assignments, then materializes daily tasks. | Keep it authoritative; make private activation create compatible assignments and invalidate affected daily-plan state. |
| Exercise and food libraries | Authenticated read access already exists for exercise metadata and foods. | Reuse these read endpoints in the mobile builders. |
| Authentication | Login, refresh, logout, and password reset by long token exist. | Add OTP challenges, authenticated security flows, password-reset OTP, session invalidation, and audit events. |
| Email | Nodemailer already supports generic SMTP, mock, and none providers. | Generalize the email service for OTP templates and configure Gmail values through deployment secrets. |
| RIR | RIR exists in schemas, SQL dumps, schema adapter mappings, backend plan/session code, mobile execution UI, admin builder UI, OpenAPI, tests, seed data, and docs. | Remove every runtime and contract reference and migrate existing databases. |
| Database migrations | The migration runner currently has migrations through `004-harmonize-schema-columns`. SQLite and MySQL require dialect-aware handling. | Add forward-only migrations after `004`; test both dialect paths. |

The worktree already contains user changes across mobile files. Before implementation, re-run `git status --short`, isolate the feature work from all existing tracked and untracked changes, and preserve unrelated changes. Do not use reset, checkout, or other destructive cleanup commands.

## 3. User-facing configuration

### 3.1 Entry points and wizard

Add a `My Fitness Configuration` entry to the mobile Profile screen. It should open a multi-step wizard with a persistent progress indicator:

1. Personal profile
2. Main goal
3. Workout plan
4. Diet plan
5. Cardio and water targets
6. Reminder preferences
7. Review and activate

The user must be able to save a draft and return later. The final review step must show the effective date and clearly explain that activating a new plan can replace the currently active plan from that date forward.

The wizard must never silently invent personal plans, calorie targets, water targets, exercises, meals, or completion data. Missing configuration should be displayed as not configured.

### 3.2 Personal profile fields

The user can enter or edit:

- First name
- Last name
- Phone number, optional
- Date of birth, optional
- Gender, optional: male, female, other, or prefer not to say
- Height in the selected unit system
- Unit system: metric or imperial; store normalized metric values in the backend
- Time zone
- Locale/language, if supported by the existing app settings

Email and password are managed in Account Security, not in the general profile form.

### 3.3 Main goal fields

The first release should support:

- Goal type: lose weight, gain weight, build muscle, or maintain weight
- Starting weight
- Target weight
- Goal start date
- Optional target date
- Optional notes

Weights are stored in kilograms. The UI converts to the user’s selected unit system. For maintain-weight goals, the target weight may equal the starting weight. The backend must validate the selected goal type and weight range.

The daily weight logger remains separate. The onboarding starting weight is the goal baseline; daily measurements remain entries in `body_weight_entries`.

### 3.4 Private workout plan fields

The user can create a complete private plan:

- Plan name
- Description
- Goal/focus description
- Seven-day weekly schedule
- Training or rest status for each weekday
- Day name and notes
- Exercise selected from the authenticated exercise library
- Exercise order
- Number of sets
- Repetition minimum and maximum, when the tracking type uses repetitions
- Target weight per set, when supported by the tracking type
- Duration target, when supported
- Distance target, when supported
- Rest time
- Optional exercise flag
- Exercise notes

RIR must not appear in any workout form, preview, API payload, response, database record, or report.

The user should be able to add, remove, reorder, and edit exercises while the version is a draft. A published version is immutable; editing a published plan creates a new draft version.

The existing tracking type of an exercise determines which target fields are shown and validated. For example, duration exercises should not require repetitions, and distance exercises should not require a weight.

### 3.5 Private diet plan fields

The user can create a complete private diet plan:

- Plan name
- Description
- Daily calorie target
- Daily protein target
- Daily carbohydrate target
- Daily fat target
- Meal name and order
- Scheduled meal time
- Required or optional meal status
- Food option groups within each meal
- Required minimum and maximum selections per group
- Food selected from the authenticated food library
- Quantity and measurement unit
- Nutrition snapshot for the selected quantity
- Food alternatives
- Meal and option notes

The food catalog remains administrator-managed. The user configures a private meal plan by selecting catalog foods and quantities. Nutrition values are copied into the plan option snapshot so historical logs remain stable if the catalog later changes.

### 3.6 Cardio configuration

The user can configure one or more cardio targets:

- Cardio activity selected from the active activity library
- Weekdays
- Minimum and optional maximum duration
- Optional minimum and maximum speed
- Optional minimum and maximum incline
- Optional minimum and maximum distance
- Effective start date
- Optional end date
- Notes

The activity metadata controls whether speed, incline, or distance fields are displayed.

### 3.7 Water configuration

The user can configure:

- Daily water target
- Quick-add amounts, such as 250 ml, 500 ml, 750 ml, or 1,000 ml

Water values are stored in milliliters. The existing water logger continues to record actual intake separately.

### 3.8 Reminder configuration

The user can configure reminders for:

- Meals
- Workouts
- Cardio
- Water
- Weight
- Progress, if product policy permits it

Each user-owned reminder may include a fixed time, relative task offset, interval, grace period, active window, repeat limit, message, and active status. User routes must force `user_id` and `rule_scope` server-side; the client must never submit another user’s ID.

Notification delivery toggles and quiet hours continue to use the existing notification-settings flow.

Adherence component weights remain a platform/coach configuration and should not be exposed in the user wizard in this release.

## 4. Private plan and assignment model

### 4.1 Reuse the existing versioned plan model

Do not create a second parallel workout or diet schema. Extend the existing structures so the daily-plan engine, historical snapshots, and reporting continue to work.

Add ownership metadata to both `workout_plans` and `diet_plans`:

- `owner_user_id`, nullable for administrator/system plans and set for private user plans
- `visibility` or `scope`, with values such as `admin` and `private`
- Indexes on owner and visibility
- Foreign key to `users(id)` with delete behavior chosen to preserve historical tracking records

Keep `created_by` for audit attribution. For a private plan, both the owner and creator are the authenticated user. Do not infer ownership only from `created_by`; use an explicit owner field.

Add an assignment source marker to `user_workout_assignments` and `user_diet_assignments`, for example:

- `admin`
- `self_service`

This makes monitoring, conflict resolution, and auditing explicit.

### 4.2 Ownership and authorization rules

Create shared authorization helpers that verify the complete ownership chain before every read or mutation:

- User owns the plan.
- Plan owns the requested version.
- Version owns the requested day.
- Day owns the requested exercise.
- Exercise owns the requested option/group relationship where applicable.

Never authorize a nested resource by its numeric ID alone. A user must not be able to access, edit, publish, activate, or delete another user’s plan by changing a URL parameter.

Administrator routes continue to use administrator authorization. Administrators should be able to monitor private plans through the user dossier, but private plans should not become globally visible in the administrator plan catalog unless explicitly marked for reuse.

### 4.3 Draft, publish, and activate behavior

Use this lifecycle:

```text
Create private plan
        ↓
Create/edit draft version
        ↓
Validate complete plan
        ↓
Publish immutable version
        ↓
Activate from effective date
        ↓
Create/update self-service assignment
        ↓
Daily plan resolves it through /me/today
```

Publishing alone must not change the user’s daily plan. Activation is the operation that makes a version effective for the user.

Activation must be transactional and must:

1. Confirm the plan/version belongs to the authenticated user.
2. Confirm the version is valid and published, or publish it inside the same operation if the API intentionally combines those steps.
3. Close any overlapping active assignment at the day before the new effective date.
4. Deactivate future assignments that start on or after the new effective date when they conflict.
5. Insert the self-service assignment with `assigned_by` equal to the user and `assignment_source = self_service`.
6. Preserve all previous assignments and historical logs.
7. Rebuild or invalidate affected daily tasks for the effective date onward without rewriting completed historical tasks.

The UI must show the user which active plan will be replaced. An activation request must not fail merely because an administrator assignment exists; it should use the explicit replacement behavior above and retain the old assignment as history.

The same rule applies independently to workout and diet plans. A user may activate a workout without a diet, or a diet without a workout.

### 4.4 Daily-plan compatibility

The existing `DailyPlanService` should continue to resolve the active assignment and produce the authoritative `/me/today` response. Update it only where needed to:

- Resolve self-service assignments correctly.
- Preserve assignment source in diagnostic data.
- Avoid stale daily tasks after plan activation.
- Handle a user with no configured plan without synthetic defaults.
- Continue producing accurate meal, workout, cardio, water, and weight tasks.

When a new plan version becomes active, workout sessions and meal logs created afterward must snapshot the new version. Existing sessions and logs must keep their existing snapshots.

## 5. Proposed API surface

The exact route names may be adjusted to local conventions, but the implemented contract must provide equivalent capabilities.

### 5.1 Aggregate configuration and profile

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/me/fitness-configuration` | Return profile, active goals/targets, owned plans, active assignments, and reminder summary for the current user. |
| `PATCH` | `/me` | Update permitted profile fields, including date of birth, gender, height, units, time zone, and locale. |
| `PUT` | `/me/goals/weight` | Create a new effective-dated weight goal or replace the current goal from the selected date. |
| `PUT` | `/me/goals/water` | Create or replace the effective-dated water target. |
| `PUT` | `/me/goals/water-quick-add` | Replace the user’s quick-add amounts. |
| `GET` | `/me/goals/cardio` | List the user’s cardio targets. |
| `POST` | `/me/goals/cardio` | Create a user-owned cardio target. |
| `DELETE` | `/me/goals/cardio/:targetId` | Delete/deactivate only the user’s target. |
| `GET/POST/PUT/DELETE` | `/me/reminders...` | CRUD for user-owned reminder rules and weekdays. |
| `PATCH/PUT` | `/me/notification-settings` | Continue updating delivery toggles and quiet hours. |

All user routes derive `userId` from the authenticated token. No user route should accept a target `userId` in the body or path.

### 5.2 Private workout plans

Provide user-scoped equivalents of the existing administrator builder operations:

```text
GET    /me/workout-plans
POST   /me/workout-plans
GET    /me/workout-plans/:planId
PATCH  /me/workout-plans/:planId

GET    /me/workout-versions/:versionId
POST   /me/workout-plans/:planId/versions
POST   /me/workout-versions/:versionId/publish
POST   /me/workout-versions/:versionId/activate

POST   /me/workout-versions/:versionId/days
PATCH  /me/workout-days/:dayId
DELETE /me/workout-days/:dayId

POST   /me/workout-days/:dayId/exercises
PATCH  /me/workout-exercises/:exerciseId
DELETE /me/workout-exercises/:exerciseId
```

The user schemas must contain all supported workout targets except RIR. `publish` validates completeness and immutability. `activate` accepts an effective date and performs assignment replacement transactionally.

### 5.3 Private diet plans

Provide equivalent user-scoped diet operations:

```text
GET    /me/diet-plans
POST   /me/diet-plans
GET    /me/diet-plans/:planId
PATCH  /me/diet-plans/:planId

GET    /me/diet-versions/:versionId
POST   /me/diet-plans/:planId/versions
PATCH  /me/diet-versions/:versionId
POST   /me/diet-versions/:versionId/publish
POST   /me/diet-versions/:versionId/activate

POST   /me/diet-versions/:versionId/meals
PATCH  /me/diet-meals/:mealId
DELETE /me/diet-meals/:mealId

POST   /me/diet-meals/:mealId/groups
PATCH  /me/diet-option-groups/:groupId
DELETE /me/diet-option-groups/:groupId

POST   /me/diet-option-groups/:groupId/options
PATCH  /me/diet-options/:optionId
DELETE /me/diet-options/:optionId
```

Food IDs and measurement-unit IDs must be validated against active catalog rows. Nutrition snapshots must be calculated or accepted only under a server-defined validation rule; the client must not be trusted to alter catalog nutrition values.

### 5.4 Account security and OTP

Recommended authenticated routes:

```text
POST /me/security/email-change/request
POST /me/security/email-change/verify

POST /me/security/password-change/request
POST /me/security/password-change/verify
```

Recommended public password-recovery routes:

```text
POST /auth/password-reset/request
POST /auth/password-reset/verify
```

Existing `/auth/forgot-password`, `/auth/request-password-reset`, and `/auth/reset-password` routes should either become compatibility aliases to the OTP flow during a controlled deprecation period or be removed after all clients are migrated. They must not continue creating a second long-token password path if the product decision is OTP-only.

Example password-change flow:

```json
POST /me/security/password-change/request
{}
```

```json
{
  "challengeId": "opaque-challenge-id",
  "expiresAt": "2026-09-03T12:00:00Z",
  "delivery": "email"
}
```

```json
POST /me/security/password-change/verify
{
  "challengeId": "opaque-challenge-id",
  "otp": "123456",
  "newPassword": "NewSecurePassword123!"
}
```

Example email-change flow:

1. User submits the new email address.
2. Server validates format, normalizes it, checks uniqueness, and creates an email-change request.
3. Server sends an authorization OTP to the current email.
4. User verifies the current-email OTP.
5. Server sends a separate ownership-verification OTP to the new email.
6. User submits both challenge IDs/OTPs, or verifies the second challenge using a short-lived server-side continuation token.
7. Server performs the email change in one transaction.

Two OTPs are intentional: one proves authorization from the existing account email and the other proves ownership of the new email. The database email must not change before both checks succeed.

For password reset, the request endpoint must return the same generic response whether the email exists or not. The verification endpoint accepts the OTP and new password only after the challenge is valid.

## 6. OTP security design

### 6.1 Persistence

Add an `auth_otp_challenges` table with at least:

- Opaque challenge ID
- Nullable user ID for public password recovery
- Purpose, such as `password_change`, `password_reset`, `email_change_current`, or `email_change_new`
- Destination email
- HMAC/hash of the OTP, never the raw code
- Expiration timestamp
- Consumed timestamp
- Failed-attempt count
- Maximum-attempt count
- Last-sent timestamp
- Invalidated timestamp, if used
- Request IP and user-agent metadata where policy permits
- Created timestamp

Add a dedicated `user_email_change_requests` table or equivalent durable record containing:

- User ID
- Normalized new email
- Current-email challenge ID
- New-email challenge ID
- Request status
- Expiration timestamp
- Completion timestamp
- Created timestamp

Add `email_verified_at` to `users` if the product wants a durable verification state. Existing accounts can remain usable; a legacy account may be marked verified after it proves access to the current email during its first security operation.

Add a security-version or credential-version field to `users`. Include it in access tokens and compare it in `authenticate`. Increment it after an email or password change so previously issued access tokens stop working immediately, not only after their normal 15-minute expiration.

### 6.2 Code and lifecycle rules

- Generate a cryptographically secure six-digit numeric code with `crypto.randomInt`.
- Hash/HMAC the code with a server-side OTP pepper and challenge ID.
- OTP lifetime: use a short window such as 10 minutes.
- Maximum verification attempts: use a bounded value such as 5.
- Resend cooldown: use a bounded value such as 60 seconds.
- Invalidate older active challenges for the same user, purpose, and destination when a new one is issued.
- Mark a challenge consumed atomically with the credential/email update.
- Never log OTP values, password values, SMTP passwords, or raw reset secrets.
- Rate-limit by user, destination email, IP, and device where possible.
- Return generic failure messages for invalid, expired, consumed, and unknown challenges where disclosure could help attackers.
- Do not queue OTP request or verification operations for offline synchronization.
- Do not allow an OTP endpoint to be replayed successfully.

### 6.3 Credential/session behavior

After a successful password or email change:

1. Hash the new password with the existing bcrypt policy.
2. Update the email/password and security version transactionally.
3. Revoke every refresh token for the user.
4. Invalidate current access tokens through the security-version check.
5. Return a clear response requiring the mobile app to sign in again, or issue a newly authenticated session only if that flow is explicitly designed and tested.
6. Send a security notification to the old email when possible.
7. Record an audit event without including the new password, OTP, or full secret values.

## 7. Gmail SMTP setup

The existing SMTP abstraction can be configured for Gmail without storing credentials in source control.

### 7.1 Gmail account prerequisites

1. Use a dedicated Gmail or Google Workspace mailbox for the platform.
2. Enable two-step verification on the Google account.
3. Create a Google App Password for mail access.
4. Use the 16-character App Password as `SMTP_PASSWORD`; do not use the normal Google account password.
5. Ensure `SMTP_FROM` is the authenticated mailbox or a verified Workspace alias.
6. Prefer a dedicated production mailbox rather than a personal mailbox.
7. Configure SPF, DKIM, and DMARC for the sending domain when using a custom domain or Workspace alias.

### 7.2 Runtime values

Use port 587 with STARTTLS as the default:

```properties
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=fitness-platform@your-domain.example
SMTP_PASSWORD=<GOOGLE_APP_PASSWORD>
SMTP_FROM="Fitness Platform" <fitness-platform@your-domain.example>
```

Port 465 with `SMTP_SECURE=true` is an alternative if required by the deployment network.

Populate these values only in the deployment secret store or an untracked production environment file. Update `.env.production.example` with Gmail placeholders only; never commit a real mailbox password or App Password.

### 7.3 Email-service changes

Refactor `backend/src/shared/services/email.service.ts` from a password-reset-specific sender into typed transactional messages, including:

- Password reset OTP
- Password change OTP
- Current-email authorization OTP
- New-email verification OTP
- Security-change confirmation

Keep the mock provider and `testSentEmails` test hook. In production, use the Nodemailer transport with the Gmail values. Do not log message bodies or OTP codes.

Add a startup or deployment verification step that checks SMTP connectivity without sending a real user email. Keep live delivery verification as a controlled manual smoke test.

### 7.4 Gmail operational risks

Document Gmail sending limits and the possibility of delivery throttling. For production-scale or high-volume OTP traffic, retain the typed email-provider abstraction so the platform can later switch to a transactional provider without changing OTP business logic.

## 8. RIR removal plan

### 8.1 Database fields to remove

Remove these columns and related constraints from every schema representation and live database:

- `workout_plan_exercises.rir_target`
- `workout_plan_exercise_sets.rir_target`
- `workout_session_exercises.planned_rir_snapshot`
- `workout_sets.rir`
- The check constraints that validate planned or performed RIR values

Existing RIR data is deliberately dropped. All non-RIR workout and tracking data must be copied or retained.

Update all repository-managed schema representations:

- `backend/src/database/schema.ts`
- `backend/src/database/fitness_tracker.sql`
- `backend/src/database/mysql/canonical-schema.sql`
- Any repository-managed SQL/dump mirror that is used by migration or schema-audit tooling
- `backend/src/database/schema-adapter.ts`
- `backend/src/database/schema-divergence-inventory.json`

The migration must handle existing databases. For MySQL, drop the named checks before dropping dependent columns where required by the engine. For SQLite, use version-aware `DROP COLUMN` only when constraints permit it; otherwise rebuild affected tables with the non-RIR columns, copy data, restore foreign keys/indexes, and validate row counts. Test both paths against backups.

### 8.2 Backend removal

Remove RIR from:

- Workout plan Zod schemas and request types
- Workout plan repository inserts, updates, selects, and clone logic
- Workout session request validation
- Workout session insert/update statements
- Workout session snapshots and response aliases
- Schema adapter mappings
- Seed inserts
- Any analytics, monitoring, or serialization code

If a client submits `rir` after the change, the API should reject it as an unknown field or ignore it only under the project’s established validation policy. The preferred behavior is strict rejection in new endpoints and no persistence in all cases.

### 8.3 Mobile removal

Remove the RIR input, controller, focus handling, validation, payload key, previous-performance display, and history label from `mobile-app/lib/features/workout/workout_execution_screen.dart`.

Update workout dialogs and summaries to show only the applicable load, repetitions, duration, distance, notes, and completion state. Ensure no text such as `RIR`, `Reps in Reserve`, or `RIR unconfigured` remains in the shipped app.

### 8.4 Administrator dashboard removal

Remove RIR state, validation, form fields, cards, badges, previews, and request payloads from `admin-dashboard/src/pages/WorkoutPlanBuilderPage.tsx`.

Update builder tests so set breakdowns and validation cover only supported targets. The administrator must still be able to configure the rest of the workout plan.

### 8.5 Contract, test, and documentation removal

Update:

- `contracts/openapi/openapi.yaml`
- Backend API tests and architecture/security tests
- Flutter workout tests and regression fixtures
- Dashboard workout-builder tests
- Seed data
- `docs/structure.md`
- `docs/documentation.md`
- Existing backend/admin/mobile implementation plans that describe RIR
- README/status/checklist references where applicable

The implementation plan itself may mention RIR because it records the removal requirement; the runtime source and product documentation must not.

## 9. Backend implementation sequence

Implement in this order so each layer has a usable contract:

### Phase A — Contracts and database design

- Freeze the API payload and response names.
- Decide whether user plans are activated through separate publish/activate operations or one atomic endpoint; prefer separate operations for clear lifecycle behavior.
- Add migrations for plan ownership, assignment source, user security version, email verification state, OTP challenges, and pending email changes.
- Add the RIR removal migration.
- Update SQLite and MySQL schema sources and migration capability checks.
- Add indexes, foreign keys, uniqueness rules, and effective-date constraints.
- Add migration rollback/runbook notes even if the repository uses forward-only production migrations.

### Phase B — Shared backend services

- Add typed OTP generation, hashing, expiration, attempt, resend, and consumption services.
- Generalize the email service and add OTP templates.
- Add session invalidation/security-version helpers.
- Add reusable ownership-chain authorization helpers.
- Add transaction helpers for effective-dated replacement.
- Add audit-event names for profile updates, plan creation/publishing/activation, OTP issuance/failure/success, email change, and password change.

### Phase C — Profile, target, and reminder self-service

- Extend `/me` validation and repository mapping.
- Implement self-owned weight, water, cardio, and reminder operations.
- Ensure all writes use authenticated user identity.
- Add aggregate `GET /me/fitness-configuration`.
- Test target replacement and historical preservation.

### Phase D — Private workout plans

- Add user-scoped routes and controller schemas.
- Reuse plan service logic with ownership-aware authorization.
- Remove RIR from all workout plan service/repository paths.
- Support draft creation, full weekly schedule, exercise selection, editing, ordering, validation, publishing, and activation.
- Add self-service assignment replacement transaction.
- Update daily-plan resolution and task invalidation.

### Phase E — Private diet plans

- Add user-scoped routes and controller schemas.
- Reuse diet service logic with ownership-aware authorization.
- Support draft creation, meals, times, groups, food options, quantities, nutrition snapshots, validation, publishing, and activation.
- Add self-service assignment replacement transaction.
- Update daily-plan resolution and task invalidation.

### Phase F — OTP security

- Add authenticated password-change request/verify.
- Add authenticated email-change request/verify with current and new email verification.
- Replace or alias public password reset with OTP request/verify.
- Revoke sessions and increment security version after successful changes.
- Add generic responses and rate limits.

### Phase G — Mobile app

- Add configuration models and API methods.
- Add the wizard and draft state handling.
- Add private workout builder.
- Add private diet builder.
- Add goals, cardio, water, and reminders forms.
- Add account-security screen with OTP countdown, resend, error, and retry states.
- Add sign-in-again behavior after credential changes.
- Disable offline queueing for OTP/security calls.
- Remove all RIR UI and parsing.

### Phase H — Administrator dashboard and monitoring

- Remove RIR from the admin builder.
- Add read-only visibility of a user’s private active plan and source in the user dossier.
- Preserve administrator assignment and monitoring workflows.
- Make assignment conflicts and private-plan activation history visible to administrators.

### Phase I — SMTP/Gmail and deployment

- Add Gmail placeholders to environment documentation.
- Inject real secrets through the deployment secret store.
- Run transport verification.
- Send controlled OTP smoke tests to a test mailbox.
- Verify SPF/DKIM/DMARC and delivery monitoring.
- Deploy migrations before application traffic.

## 10. Mobile UX and state requirements

### 10.1 Draft handling

- The server is the source of truth for drafts after each successful save.
- The app may keep unsaved form state in memory, but must not persist passwords or OTPs in local storage.
- Do not send fitness configuration mutations through the generic offline queue unless each operation is intentionally designed and tested for replay. Security operations must never use the queue.
- Show unsaved changes and retry options.

### 10.2 Validation

Client validation improves usability, but the server remains authoritative. Display server validation errors by field where possible.

Validate at minimum:

- Numeric ranges and unit conversion
- Date format and effective-date ordering
- One schedule entry per weekday
- At least one training day with an exercise before workout publish
- At least one meal, group, and food option before diet publish
- Selection minimum/maximum consistency
- Tracking-type-specific target requirements
- Unique food/exercise selection references
- Email syntax and password policy
- Six-digit numeric OTP format

### 10.3 Security UX

- Mask OTP entry appropriately while allowing paste from email.
- Show expiration countdown and resend cooldown.
- Disable submit while a verification request is in progress.
- Do not reveal whether an email account exists in password recovery.
- After email change, show the new email and require sign-in with it after session invalidation.
- After password change, clear sensitive form fields and require sign-in again.

## 11. Testing and verification plan

### 11.1 Database and migration tests

- Fresh SQLite initialization creates the final schema without RIR columns.
- Fresh MySQL initialization creates the final schema without RIR columns.
- Existing SQLite migration removes RIR columns and constraints while preserving non-RIR rows, foreign keys, indexes, and historical records.
- Existing MySQL migration removes RIR columns and constraints while preserving non-RIR rows and indexes.
- Migration is idempotent and records its version exactly once.
- Schema-parity and dialect audits pass.
- New ownership, OTP, and security-version columns are present in both dialects.

### 11.2 Backend API tests

Private plan tests:

- User can create and edit only a private plan owned by that user.
- User cannot read or mutate another user’s plan, version, day, exercise, meal, group, or option by ID.
- User can save a draft and resume it.
- Invalid workout and diet drafts cannot publish.
- Published versions are immutable.
- Activation creates the correct self-service assignment.
- Activation replaces overlapping assignments from the effective date while preserving history.
- `/me/today` resolves the private plan after activation.
- Historical sessions and meal logs remain tied to their previous snapshots.
- No synthetic workout or diet plan appears when none is configured.

Target/profile tests:

- Profile fields are scoped to the current user.
- Weight, water, cardio, and reminder writes cannot cross user boundaries.
- Effective-dated targets resolve correctly for current and historical dates.
- Target replacement does not rewrite historical entries.

OTP tests:

- OTP is generated securely, stored only as a hash/HMAC, and never appears in logs.
- Correct OTP succeeds once; replay fails.
- Wrong attempts are bounded.
- Expired and invalidated challenges fail.
- Resend cooldown and rate limits work.
- Password-change OTP is delivered to the current email.
- Email change requires both current-email authorization and new-email ownership verification.
- Existing email remains until email change fully succeeds.
- Duplicate email changes return conflict without leaking account information.
- Password reset uses OTP and generic enumeration-resistant responses.
- Successful credential changes revoke refresh tokens and invalidate access tokens through security version.
- Security audit events contain no OTP or password.

RIR tests:

- Workout plan requests containing RIR cannot persist it.
- Workout session requests containing RIR cannot persist it.
- Workout responses contain no RIR fields.
- No runtime source, OpenAPI contract, seed SQL, or shipped UI includes RIR.

### 11.3 Email/SMTP tests

- Mock provider records all OTP template types.
- SMTP configuration validation fails closed in production when any required value is missing.
- Gmail host, port, secure mode, and sender values are loaded correctly.
- Transport verification succeeds with a controlled Gmail App Password.
- SMTP delivery failures do not consume an OTP challenge, or the challenge is cleanly invalidated and a retry is allowed according to the selected transaction policy.
- Email contents do not expose passwords or internal identifiers beyond the opaque challenge needed by the client.

### 11.4 Mobile and dashboard tests

- Configuration wizard loads existing server state.
- Each step validates and saves correctly.
- Draft resume works after navigation away.
- Review/activate shows replacement warning and effective date.
- Workout and diet builders render the correct tracking fields without RIR.
- OTP countdown, resend, failure, success, and re-login behavior work.
- Security requests are not added to the offline mutation queue.
- Admin builder has no RIR field or label.
- Admin dossier shows private-plan ownership/source without exposing another user’s private plan through an IDOR.

### 11.5 End-to-end smoke test

Use a clean test account and mailbox:

1. Register or create a user.
2. Sign in on the mobile app.
3. Enter profile and goal information.
4. Create a private workout plan with at least two training days and a rest day.
5. Create a private diet plan with meals, groups, foods, quantities, and nutrition targets.
6. Configure water, cardio, and reminders.
7. Review and activate from a selected date.
8. Confirm `/me/today` displays the configured agenda.
9. Complete one workout, meal, water, cardio, and weight log.
10. Change the password through OTP and confirm all sessions are invalidated.
11. Sign in again and change the email through the two-OTP flow.
12. Sign in with the new email and confirm the private configuration and historical records remain available.
13. Confirm no RIR field is visible or stored anywhere in the flow.

## 12. Deployment and rollback runbook

### Before deployment

- Back up the production database and verify that the backup can be restored.
- Review and approve forward-only migrations.
- Confirm application and migration images contain the same schema version.
- Provision a dedicated Gmail/Workspace mailbox.
- Enable Google two-step verification and generate an App Password.
- Store Gmail credentials, OTP pepper, and JWT secrets in the secret manager.
- Confirm `EMAIL_PROVIDER=smtp` and all SMTP variables are populated.
- Verify sender identity and domain authentication records.
- Test SMTP connectivity from the production network.
- Run the full backend, dashboard, and mobile test suites.

### Deployment order

1. Build and type-check backend, dashboard, and mobile code.
2. Run schema migrations using the dedicated migration job/container.
3. Run schema parity and migration smoke tests.
4. Deploy the backend API and reminder worker.
5. Verify health/readiness endpoints.
6. Deploy the dashboard and mobile release.
7. Run controlled OTP email smoke tests.
8. Monitor SMTP failures, OTP failure rates, authentication failures, and plan activation errors.

### Rollback strategy

- Roll back application code only when the new schema is backward compatible.
- Do not drop newly added columns during an emergency application rollback.
- RIR removal is destructive by decision; restore RIR values only from a pre-migration database backup if the product later reverses that decision.
- If email delivery fails, switch the provider configuration to a tested provider or stop security mutations rather than silently claiming OTP delivery.
- Preserve audit logs and historical plan assignments during rollback.

## 13. Definition of done

The work is complete only when all of the following are true:

- A normal user can create, edit, publish, and activate a private workout plan from the mobile app.
- A normal user can create, edit, publish, and activate a private diet plan from the mobile app.
- User-owned plans are isolated from other users and administrator plans through server-side authorization.
- Profile, goals, water, cardio, and reminder configuration can be entered from the app.
- Effective dates and historical snapshots behave correctly.
- Email change requires OTP authorization and new-email verification.
- Password change and password recovery use OTP.
- Credential changes invalidate prior sessions.
- Gmail SMTP delivers OTP and security messages using an App Password held outside source control.
- SMTP failures are observable and do not create false success states.
- RIR is absent from runtime code, database schemas, API contracts, UI, tests, seed data, and product documentation.
- SQLite and MySQL migrations, schema parity, backend tests, dashboard tests, mobile tests, and the end-to-end smoke test pass.
- Production deployment and rollback runbooks are updated and tested.

## 14. Implementation checklist

### Planning and contracts

- [ ] Confirm final endpoint names and API response shapes.
- [ ] Confirm unit-system behavior and supported locales.
- [ ] Confirm whether progress reminders are user-configurable; default to disabled if not approved.
- [ ] Freeze the effective-date replacement behavior.
- [ ] Freeze OTP expiry, attempt, cooldown, and rate-limit values.
- [ ] Freeze whether publish and activate remain separate operations; recommended: keep them separate.

### Database and migrations

- [ ] Add private-plan owner/scope fields to workout and diet plan tables.
- [ ] Add assignment-source fields to workout and diet assignments.
- [ ] Add profile/security fields required for self-service and session invalidation.
- [ ] Add OTP challenge table.
- [ ] Add pending email-change table.
- [ ] Add required indexes, foreign keys, uniqueness rules, and effective-date protections.
- [ ] Remove RIR columns and check constraints from canonical schemas.
- [ ] Add forward migrations after migration `004`.
- [ ] Implement dialect-aware SQLite table rebuild/drop logic.
- [ ] Implement MySQL constraint/column removal logic.
- [ ] Test migrations against fresh and populated databases.
- [ ] Verify row counts and foreign-key integrity after migration.
- [ ] Update schema-parity and divergence inventories.

### Backend services and authorization

- [ ] Add ownership-chain authorization helpers.
- [ ] Add self-service profile field validation and persistence.
- [ ] Add self-service goal, water, cardio, and reminder operations.
- [ ] Add aggregate fitness-configuration read endpoint.
- [ ] Add private workout plan routes and service methods.
- [ ] Add private diet plan routes and service methods.
- [ ] Add draft/publish/activate lifecycle rules.
- [ ] Add transactional assignment replacement.
- [ ] Update daily-plan resolution and task invalidation.
- [ ] Remove RIR from workout plan routes, services, repositories, and session routes.
- [ ] Add audit events for user configuration and security changes.
- [ ] Add OTP service with secure hashing, expiration, attempts, resend controls, and rate limits.
- [ ] Add email-change request/verification service.
- [ ] Add password-change request/verification service.
- [ ] Convert password recovery to OTP or remove legacy token endpoints after migration.
- [ ] Add security-version access-token invalidation.
- [ ] Revoke all refresh sessions after credential changes.

### Email and Gmail SMTP

- [ ] Generalize the email service for OTP and security templates.
- [ ] Add Gmail placeholders to environment documentation.
- [ ] Add/validate OTP pepper and related configuration values.
- [ ] Provision a dedicated Gmail or Workspace mailbox.
- [ ] Enable Google two-step verification.
- [ ] Generate and securely store a Google App Password.
- [ ] Set `smtp.gmail.com`, port `587`, STARTTLS mode, sender, and authenticated user.
- [ ] Verify sender/domain SPF, DKIM, and DMARC where applicable.
- [ ] Verify SMTP connectivity from the deployed network.
- [ ] Send controlled OTP smoke tests.
- [ ] Monitor delivery failures and Gmail throttling.

### Mobile app

- [ ] Add fitness-configuration models and API client methods.
- [ ] Add Profile entry for My Fitness Configuration.
- [ ] Build profile and goal forms.
- [ ] Build private workout draft builder.
- [ ] Build private diet draft builder.
- [ ] Build cardio, water, and reminder forms.
- [ ] Build review and activation step.
- [ ] Add account-security screen.
- [ ] Add OTP request, countdown, resend, verify, and error states.
- [ ] Require sign-in again after email/password changes.
- [ ] Prevent OTP/security operations from entering the offline queue.
- [ ] Remove all RIR fields, labels, payloads, parsing, and tests.
- [ ] Preserve unrelated existing mobile worktree changes.

### Administrator dashboard and contracts

- [ ] Remove RIR from workout builder state, UI, validation, previews, and payloads.
- [ ] Update administrator builder tests.
- [ ] Add private-plan source/ownership visibility to user monitoring where appropriate.
- [ ] Update OpenAPI for all new self-service and OTP routes.
- [ ] Remove RIR from OpenAPI schemas.
- [ ] Run the contract audit.

### Verification and release

- [ ] Add backend ownership/IDOR tests.
- [ ] Add plan lifecycle and effective-date tests.
- [ ] Add target/profile/reminder tests.
- [ ] Add OTP security and enumeration-resistance tests.
- [ ] Add session invalidation tests.
- [ ] Add Gmail/mock email tests.
- [ ] Add SQLite/MySQL migration tests.
- [ ] Add Flutter wizard/security/RIR-removal tests.
- [ ] Add dashboard/RIR-removal tests.
- [ ] Run backend build, lint, and test commands.
- [ ] Run dashboard build and tests.
- [ ] Run Flutter tests and release checks.
- [ ] Run end-to-end smoke test with a real test mailbox.
- [ ] Back up production before migration.
- [ ] Run migrations before application traffic.
- [ ] Verify health, SMTP, OTP, private plans, and `/me/today` after deployment.
- [ ] Update operational documentation and handoff notes.
