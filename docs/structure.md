# Fitness Tracking Platform

# Complete Architecture, Repository Structure & Development Roadmap

**Technology Stack**

* Backend: Node.js
* API: REST
* Database: MySQL
* Admin Dashboard: React + Vite
* User Application: Flutter
* Authentication: Access Token + Refresh Token
* Notifications: In-App + Push + Local Reminders
* Architecture: Multi-user, configuration-driven, API-first
* API Base: `/api/v1`

---

# 1. Purpose of This Document

This document defines:

1. Overall system architecture
2. Repository structure
3. Documentation structure
4. Backend folder structure
5. Admin dashboard folder structure
6. Flutter application folder structure
7. Database ownership
8. API organization
9. Authentication architecture
10. Plan configuration architecture
11. Workout configuration
12. Diet configuration
13. Daily tracking
14. Progress calculations
15. Notifications and reminders
16. Offline synchronization
17. Testing strategy
18. Deployment architecture
19. Development phases
20. Dependencies between phases
21. Definition of done for every major phase

The objective is to prevent development from becoming a collection of disconnected screens.

The system should be built from the database and API contracts upward.

---

# 2. System Architecture

The platform contains four major layers:

```text
                     ┌─────────────────────────┐
                     │       MySQL 8.x         │
                     │                         │
                     │ Configuration           │
                     │ Users                   │
                     │ Logs                    │
                     │ Notifications           │
                     │ Analytics Data          │
                     └────────────┬────────────┘
                                  │
                                  │
                     ┌────────────▼────────────┐
                     │       Node.js API       │
                     │                         │
                     │ Authentication          │
                     │ Authorization           │
                     │ Business Logic          │
                     │ Plan Resolution         │
                     │ Tracking                │
                     │ Progress Engine         │
                     │ Reminder Engine         │
                     │ Analytics               │
                     └────────────┬────────────┘
                                  │
                 ┌────────────────┴────────────────┐
                 │                                 │
        ┌────────▼────────┐               ┌────────▼────────┐
        │ React + Vite    │               │ Flutter Mobile  │
        │ Admin Dashboard │               │ User App        │
        │                 │               │                 │
        │ Configuration   │               │ Daily Tracking  │
        │ User Management │               │ Workout Logging │
        │ Analytics       │               │ Nutrition       │
        │ Monitoring      │               │ Progress        │
        └─────────────────┘               └─────────────────┘
```

---

# 3. Core Architectural Rule

The platform must always distinguish between:

```text
CONFIGURATION
```

and:

```text
EXECUTION / HISTORY
```

For example:

## Planned workout

```text
Leg Press
4 sets
8–12 repetitions
120 seconds rest
```

## Actual workout

```text
Set 1 → 100 kg × 12
Set 2 → 100 kg × 11
Set 3 → 105 kg × 10
Set 4 → 105 kg × 9
```

These are different records.

The same applies to:

* Diet configuration vs meals actually eaten
* Water target vs actual intake
* Cardio target vs actual cardio
* Weight goal vs actual measurements
* Planned reminder vs delivered notification

Historical records must remain intact when configuration changes.

---

# 4. Recommended Repository Structure

Use one repository containing the backend, admin dashboard, Flutter application, infrastructure, contracts, and documentation.

```text
fitness-platform/
│
├── backend/
│
├── admin-dashboard/
│
├── mobile-app/
│
├── contracts/
│
├── docs/
│
├── infrastructure/
│
├── scripts/
│
├── .github/
│
├── .gitignore
│
├── README.md
│
└── LICENSE
```

---

# 5. Responsibility of Each Root Folder

## `/backend`

Contains:

* Node.js API
* Business logic
* Database access
* Authentication
* Notifications
* Analytics
* Background jobs
* Migrations
* Backend tests

---

## `/admin-dashboard`

Contains:

* React + Vite administrator dashboard
* User management
* Diet builder
* Workout builder
* Exercise library
* Goals
* Water/cardio configuration
* Notification configuration
* Analytics

---

## `/mobile-app`

Contains:

* Flutter user application
* Daily tracking
* Diet logging
* Workout tracking
* Weight tracking
* Water tracking
* Cardio
* Progress
* Notifications
* Offline synchronization

---

## `/contracts`

Contains API contracts shared conceptually between applications.

Recommended:

```text
contracts/
├── openapi/
│   ├── openapi.yaml
│   └── schemas/
│
├── examples/
│
└── README.md
```

OpenAPI becomes the formal contract between:

```text
Node.js
React
Flutter
```

Frontend developers should not guess API response structures.

---

# 6. Documentation Repository

Create:

```text
docs/
├── 00-project-overview.md
├── 01-product-requirements.md
├── 02-system-architecture.md
├── 03-database-design.md
├── 04-api-design.md
├── 05-authentication-authorization.md
├── 06-backend-architecture.md
├── 07-admin-dashboard.md
├── 08-flutter-application.md
├── 09-diet-engine.md
├── 10-workout-engine.md
├── 11-daily-tracking.md
├── 12-goals-progress.md
├── 13-notifications-reminders.md
├── 14-offline-sync.md
├── 15-analytics.md
├── 16-security.md
├── 17-testing.md
├── 18-deployment.md
├── 19-monitoring-backups.md
├── 20-development-roadmap.md
│
├── adr/
│   ├── ADR-001-api-first.md
│   ├── ADR-002-plan-versioning.md
│   ├── ADR-003-offline-sync.md
│   └── ADR-004-notifications.md
│
└── diagrams/
```

---

# 7. Documentation Purpose

## `00-project-overview.md`

Defines:

* Product purpose
* Target users
* Major modules
* Tech stack

## `01-product-requirements.md`

Defines all business requirements.

## `02-system-architecture.md`

Defines:

* System components
* Communication
* Data ownership
* Architecture diagrams

## `03-database-design.md`

Contains:

* Full SQL schema
* ERD
* Constraints
* Indexing
* Versioning strategy

## `04-api-design.md`

Contains every API endpoint.

## `05-authentication-authorization.md`

Defines:

* Login
* Refresh tokens
* Logout
* RBAC
* User data isolation

## `06-backend-architecture.md`

Contains backend structure and coding conventions.

## `07-admin-dashboard.md`

Contains every admin page and workflow.

## `08-flutter-application.md`

Contains every user screen and mobile workflow.

## `09-diet-engine.md`

Defines diet configuration and meal logging.

## `10-workout-engine.md`

Defines workout builder and workout execution.

## `11-daily-tracking.md`

Defines today's agenda and completion logic.

## `12-goals-progress.md`

Defines calculations.

## `13-notifications-reminders.md`

Defines reminder rules and missed-task detection.

## `14-offline-sync.md`

Defines offline queues and conflict handling.

## `15-analytics.md`

Defines charts, summaries, and aggregation logic.

## `16-security.md`

Defines security controls.

## `17-testing.md`

Defines testing requirements.

## `18-deployment.md`

Defines production deployment.

---

# 8. Backend Architecture

Recommended backend structure:

```text
backend/
│
├── src/
│   │
│   ├── app/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   └── routes.ts
│   │
│   ├── config/
│   │   ├── environment.ts
│   │   ├── database.ts
│   │   ├── auth.ts
│   │   └── notification.ts
│   │
│   ├── database/
│   │   ├── pool.ts
│   │   ├── transaction.ts
│   │   └── health.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── roles/
│   │   ├── exercises/
│   │   ├── workouts/
│   │   ├── diets/
│   │   ├── foods/
│   │   ├── assignments/
│   │   ├── goals/
│   │   ├── weight/
│   │   ├── water/
│   │   ├── cardio/
│   │   ├── daily-plan/
│   │   ├── workout-logs/
│   │   ├── meal-logs/
│   │   ├── progress/
│   │   ├── analytics/
│   │   ├── notifications/
│   │   ├── reminders/
│   │   └── audit/
│   │
│   ├── middleware/
│   │   ├── authenticate.ts
│   │   ├── authorize.ts
│   │   ├── validate.ts
│   │   ├── rate-limit.ts
│   │   └── error-handler.ts
│   │
│   ├── jobs/
│   │   ├── reminder.job.ts
│   │   ├── missed-task.job.ts
│   │   ├── notification.job.ts
│   │   └── analytics.job.ts
│   │
│   ├── integrations/
│   │   └── push-notifications/
│   │
│   ├── shared/
│   │   ├── errors/
│   │   ├── constants/
│   │   ├── helpers/
│   │   ├── validators/
│   │   └── types/
│   │
│   └── openapi/
│
├── migrations/
│
├── seeds/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── scripts/
│
├── .env.example
├── package.json
└── README.md
```

---

# 9. Backend Feature Module Pattern

Every major backend module should follow the same structure.

Example:

```text
modules/workouts/
├── workout.routes.ts
├── workout.controller.ts
├── workout.service.ts
├── workout.repository.ts
├── workout.validation.ts
├── workout.types.ts
├── workout.mapper.ts
└── workout.constants.ts
```

Responsibilities:

### Route

Maps HTTP request to controller.

### Controller

Handles:

* Request
* Response
* HTTP status

No major business logic.

### Service

Contains:

* Business rules
* Transactions
* Calculations
* Validation across entities

### Repository

Contains database queries.

### Validation

Validates incoming data.

### Mapper

Transforms database models into API responses.

---

# 10. Backend Module — Authentication

Responsibilities:

* Login
* Refresh token
* Logout
* Password change
* Password reset
* Session invalidation

Endpoints:

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

---

# 11. Backend Module — Users

Responsibilities:

* User CRUD
* User profile
* Account status
* Height/profile information
* Timezone
* Assigned plans
* Current goal

Admin:

```text
GET    /api/v1/admin/users
POST   /api/v1/admin/users
GET    /api/v1/admin/users/:userId
PATCH  /api/v1/admin/users/:userId
```

User:

```text
GET   /api/v1/me
PATCH /api/v1/me
```

---

# 12. Backend Module — Exercise Library

Responsibilities:

* Exercise creation
* Exercise editing
* Exercise archive
* Muscle group
* Equipment
* Instructions
* Tracking type

An exercise should support different tracking modes:

```text
WEIGHT_REPS
REPS_ONLY
DURATION
DISTANCE
WEIGHT_DURATION
CUSTOM
```

This prevents the workout engine from assuming every exercise uses kilograms and repetitions.

---

# 13. Backend Module — Workout Configuration

The administrator must be able to configure workouts entirely from the dashboard.

Structure:

```text
Workout Plan
    ↓
Plan Version
    ↓
Workout Schedule
    ↓
Workout Day
    ↓
Exercises
    ↓
Sets / Reps / Rest / Notes
```

Administrators can configure:

* Plan name
* Description
* Schedule
* Training days
* Rest days
* Exercise order
* Exercise
* Sets
* Minimum repetitions
* Maximum repetitions
* Rest
* Instructions
* Optional exercises

---

# 14. Workout Lifecycle

Recommended status:

```text
DRAFT
PUBLISHED
ARCHIVED
```

Changes should happen in `DRAFT`.

A published plan should not be silently modified.

For major changes:

```text
Workout V1
      ↓
Duplicate/Edit
      ↓
Workout V2
      ↓
Publish
```

Existing historical workouts continue referencing V1.

---

# 15. Diet Configuration Module

Structure:

```text
Diet Plan
   ↓
Diet Version
   ↓
Meal
   ↓
Option Group
   ↓
Food Choice
```

Example conceptual meal:

```text
Breakfast

Carbohydrate Group
  - Option A
  - Option B

Protein Group
  - Option A
  - Option B
  - Option C
```

The admin configures all data.

Nothing should be embedded inside Flutter.

---

# 16. Diet Option Group Rules

An option group should support:

```text
minimum selections
maximum selections
required
optional
```

Example:

```text
Protein Group

minimum = 1
maximum = 1
required = true
```

Another meal may allow:

```text
Vegetables

minimum = 0
maximum = unlimited
```

---

# 17. Assignment Architecture

Do not use one generic polymorphic `plan_id`.

Use:

```text
user_diet_assignments
user_workout_assignments
```

This allows proper MySQL foreign keys.

Assignment fields should support:

```text
user
plan_version
effective_from
effective_until
status
assigned_by
```

---

# 18. Goals Module

Users may have:

* Weight goal
* Diet adherence goal
* Workout adherence goal
* Cardio goal
* Water goal

Weight goal:

```text
Starting Weight
Current Weight
Target Weight
Start Date
Target Date
```

---

# 19. Daily Plan Engine

This is one of the most important backend modules.

The Flutter application should not independently determine today's required tasks.

Instead:

```text
GET /api/v1/me/today
```

returns the authoritative daily agenda.

Example conceptual response:

```text
Date
Weight Task
Water Target
Meals
Workout
Cardio
Daily Progress
Missed Tasks
```

---

# 20. Daily Plan Resolution

The backend determines today's plan using:

```text
Authenticated User
        ↓
Timezone
        ↓
Current Date
        ↓
Active Assignments
        ↓
Current Plan Versions
        ↓
Day of Week
        ↓
Today's Tasks
```

---

# 21. Weight Module

Responsibilities:

* Record daily weight
* Update today's record
* History
* 7-day average
* Weekly change
* Goal progress

Endpoints:

```text
GET  /api/v1/me/weight
POST /api/v1/me/weight
GET  /api/v1/me/weight/history
```

---

# 22. Water Module

Do not only store one daily number.

Prefer individual water entries:

```text
08:30 → 500 ml
10:00 → 250 ml
12:30 → 500 ml
```

This allows:

* Accurate timeline
* Undo
* Reminder logic
* Daily aggregation

Endpoints:

```text
GET    /api/v1/me/water/today
POST   /api/v1/me/water
DELETE /api/v1/me/water/:entryId
```

The backend calculates total daily intake.

---

# 23. Cardio Module

Users can log:

* Type
* Duration
* Distance
* Speed
* Incline
* Calories
* Notes

Cardio configuration and cardio execution remain separate.

---

# 24. Workout Execution Module

Workflow:

```text
Today's Workout
      ↓
Start Workout
      ↓
Workout Session
      ↓
Exercise
      ↓
Set
      ↓
Weight / Reps
      ↓
Complete Exercise
      ↓
Complete Workout
```

Endpoints could include:

```text
POST  /api/v1/me/workouts/start
GET   /api/v1/me/workouts/:sessionId
POST  /api/v1/me/workouts/:sessionId/sets
PATCH /api/v1/me/workouts/:sessionId/sets/:setId
POST  /api/v1/me/workouts/:sessionId/complete
```

---

# 25. Previous Performance API

Flutter should not need to search through historical sessions.

Provide:

```text
GET /api/v1/me/exercises/:exerciseId/previous-performance
```

Return:

* Previous session date
* Sets
* Weight
* Reps
* Best recent performance

---

# 26. Progress Engine

Backend calculations include:

### Weight

* Current
* Starting
* Target
* Lost
* Remaining
* 7-day average
* Weekly rate

### Workout

* Completed workouts
* Missed workouts
* Weight progression
* Rep progression
* Volume

### Nutrition

* Meal adherence
* Missed meals
* Completed meals

### Water

* Intake
* Goal completion
* Weekly average

### Cardio

* Duration
* Completion percentage
* Weekly minutes

---

# 27. Workout Volume

Useful optional metric:

```text
Volume = Weight × Repetitions
```

Per set.

Example:

```text
100 kg × 10 = 1,000 kg
```

Exercise volume:

```text
Sum of completed sets
```

This can help visualize strength/performance trends.

It should not replace actual set history.

---

# 28. Notification Architecture

There are three concepts.

## In-App Notifications

Stored in MySQL.

Displayed inside the Flutter notification center.

## Push Notifications

Delivered to the mobile device.

## Local/Scheduled Notifications

Can be scheduled locally when appropriate.

The backend remains authoritative for missed-task logic.

---

# 29. Reminder Engine

Examples:

```text
Meal Reminder
Workout Reminder
Cardio Reminder
Water Reminder
Weight Reminder
```

Configuration determines:

* When reminder starts
* Grace period
* Repetition
* Quiet hours
* Enabled/disabled

---

# 30. Missed Task Engine

Example:

```text
Lunch scheduled = 13:00
Grace period = 60 minutes

14:01
No meal log

↓
Task becomes overdue

↓
Notification generated
```

---

# 31. Notification Deduplication

Every notification event should have a deduplication key.

Concept:

```text
user + date + task + notification_type
```

This prevents the same missed lunch notification from being generated repeatedly.

---

# 32. Background Jobs

Backend jobs:

```text
jobs/
├── reminders.job.ts
├── missed-tasks.job.ts
├── notification-delivery.job.ts
└── analytics.job.ts
```

Jobs must be safe to execute repeatedly.

---

# 33. Audit Module

Important admin changes should be recorded.

Examples:

```text
Created workout
Edited diet
Published new plan version
Changed target weight
Assigned plan
Disabled user
```

Audit record:

```text
Actor
Action
Entity
Entity ID
Previous Value
New Value
Timestamp
IP
```

---

# 34. API-First Development

Before building major frontend screens, document endpoints in:

```text
contracts/openapi/openapi.yaml
```

This becomes the contract between backend and frontend.

Example:

```text
GET /api/v1/me/today

200:
{
   date,
   weight,
   water,
   meals,
   workout,
   cardio,
   adherence,
   notifications
}
```

---

# 35. Admin Dashboard Architecture

Recommended structure:

```text
admin-dashboard/
│
├── src/
│   │
│   ├── app/
│   │   ├── router/
│   │   ├── providers/
│   │   └── store/
│   │
│   ├── layouts/
│   │   ├── AuthLayout/
│   │   └── DashboardLayout/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── exercises/
│   │   ├── workout-plans/
│   │   ├── diet-plans/
│   │   ├── assignments/
│   │   ├── goals/
│   │   ├── cardio/
│   │   ├── water/
│   │   ├── reminders/
│   │   ├── notifications/
│   │   ├── analytics/
│   │   ├── audit/
│   │   └── settings/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── forms/
│   │   ├── tables/
│   │   ├── charts/
│   │   └── feedback/
│   │
│   ├── api/
│   │   ├── client/
│   │   ├── hooks/
│   │   └── types/
│   │
│   ├── auth/
│   │   ├── guards/
│   │   └── permissions/
│   │
│   ├── utils/
│   ├── constants/
│   └── main.tsx
│
├── public/
├── tests/
└── package.json
```

---

# 36. Admin Dashboard Main Navigation

Recommended:

```text
Dashboard

Users

Plans
  ├── Diet Plans
  └── Workout Plans

Exercise Library

Assignments

Targets
  ├── Weight
  ├── Water
  └── Cardio

Notifications
  ├── Reminder Rules
  └── Notification History

Analytics

Audit Logs

Settings
```

---

# 37. Admin Workout Builder

This should be one of the strongest modules in the platform.

Workflow:

```text
Workout Plans
      ↓
Create Plan
      ↓
Create Draft Version
      ↓
Configure Weekly Schedule
      ↓
Choose Day
      ↓
Add Workout
      ↓
Add Exercises
      ↓
Configure Sets / Reps / Rest
      ↓
Drag & Drop Order
      ↓
Preview
      ↓
Publish
      ↓
Assign
```

---

# 38. Workout Builder UI

Example:

```text
LOWER

1. Leg Press
   Sets: [4]
   Reps: [8] to [12]
   Rest: [120 sec]

2. Seated Leg Curl
   Sets: [3]
   Reps: [10] to [15]
   Rest: [90 sec]

[ + Add Exercise ]
```

The exercise is selected from the exercise library.

---

# 39. Diet Builder UI

Workflow:

```text
Diet Plan
    ↓
Create Version
    ↓
Add Meal
    ↓
Meal Time
    ↓
Add Option Groups
    ↓
Add Food Choices
    ↓
Configure Quantities
    ↓
Preview
    ↓
Publish
```

---

# 40. Admin User Detail Page

Tabs:

```text
Overview
Plan
Weight
Nutrition
Workouts
Cardio
Water
Progress
Notifications
History
```

---

# 41. Admin Analytics

Admin analytics should load aggregated endpoints instead of massive raw datasets.

Charts:

* Weight trend
* Diet adherence
* Workout adherence
* Water completion
* Cardio completion
* Workout strength trends

---

# 42. Flutter Application Architecture

Recommended feature-first architecture:

```text
mobile-app/
│
├── lib/
│   │
│   ├── app/
│   │   ├── app.dart
│   │   ├── router.dart
│   │   └── bootstrap.dart
│   │
│   ├── core/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── database/
│   │   ├── storage/
│   │   ├── sync/
│   │   ├── notifications/
│   │   ├── theme/
│   │   ├── errors/
│   │   └── utils/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── home/
│   │   ├── daily-plan/
│   │   ├── diet/
│   │   ├── workout/
│   │   ├── weight/
│   │   ├── water/
│   │   ├── cardio/
│   │   ├── progress/
│   │   ├── notifications/
│   │   ├── history/
│   │   └── profile/
│   │
│   └── main.dart
│
├── test/
│
├── integration_test/
│
├── android/
├── ios/
└── pubspec.yaml
```

---

# 43. Flutter Feature Structure

Each major feature should be structured similarly.

Example:

```text
features/workout/
├── data/
│   ├── models/
│   ├── repositories/
│   └── services/
│
├── domain/
│   ├── entities/
│   └── usecases/
│
└── presentation/
    ├── screens/
    ├── widgets/
    └── state/
```

This prevents:

```text
screens/
models/
services/
```

from becoming enormous global folders.

---

# 44. Flutter Navigation

Recommended:

```text
Home
Plan
Progress
Notifications
Profile
```

The Plan screen can contain:

```text
Diet
Workout
Cardio
Water
```

---

# 45. Flutter Home

The Home screen is the daily command center.

It should call:

```text
GET /api/v1/me/today
```

and show:

```text
Today's Progress

Weight

Meals

Workout

Cardio

Water

Missed Tasks
```

---

# 46. Flutter Workout UX

Workout screen:

```text
Today's Workout

Exercise 1

Previous:
100 × 12
100 × 11
105 × 10

TODAY

Set 1
Weight [     ]
Reps   [     ]

Set 2
Weight [     ]
Reps   [     ]

[Complete Exercise]
```

Logging must be fast.

---

# 47. Flutter Water UX

Quick actions:

```text
+250 ml

+500 ml

+750 ml

+1000 ml

Custom
```

The screen immediately updates:

```text
2,250 / 3,000 ml
```

---

# 48. Flutter Weight UX

User enters:

```text
Today's weight
[ 104.6 ] kg
```

Then sees:

```text
Yesterday
104.8

7-Day Average
105.1

Change
-0.5 kg
```

---

# 49. Flutter Progress

Sections:

```text
Overview

Weight

Strength

Nutrition

Water

Cardio

Adherence
```

---

# 50. Flutter Notifications

Notification center:

```text
Today

Breakfast Reminder

Water Target Behind

Workout Ready

Cardio Incomplete
```

Tapping a notification should navigate directly to the relevant screen.

---

# 51. Offline Architecture

Flutter must not require a network connection for every action.

Important actions should first be stored locally:

```text
User Action
    ↓
Local Database
    ↓
Sync Queue
    ↓
API
    ↓
MySQL
```

---

# 52. Offline-Supported Actions

Support offline:

* Water
* Weight
* Workout sets
* Meal completion
* Food selection
* Cardio

---

# 53. Sync Queue

Every offline operation needs:

```text
local_id
operation_type
entity_type
payload
created_at
sync_status
attempt_count
last_error
```

Status:

```text
pending
syncing
synced
failed
```

---

# 54. Idempotency

Mobile retries must not create duplicates.

For create operations, Flutter can send:

```text
client_operation_id
```

The backend stores/checks it.

Example:

```text
550e8400-e29b-41d4-a716-446655440000
```

If Flutter retries the same request, the server returns the original result instead of inserting another record.

---

# 55. Authentication Architecture

## Admin Dashboard

Recommended:

```text
Access Token
+
Refresh Session
```

Admin requests always require authorization.

## Flutter

Store sensitive authentication data in secure device storage.

Never store:

```text
plaintext password
```

---

# 56. Authorization

Backend is responsible for access control.

Never rely on React hiding buttons.

Never rely on Flutter hiding screens.

Example:

```text
Admin:
GET /admin/users/100

Normal User:
DENIED
```

even if the user manually calls the endpoint.

---

# 57. Database Development Workflow

Database changes must use migrations.

Never manually edit the production database structure.

Workflow:

```text
Create Migration
      ↓
Review
      ↓
Run Locally
      ↓
Run Tests
      ↓
Staging
      ↓
Production
```

---

# 58. Database Phase Zero Corrections

Before backend implementation, refine the current schema.

At minimum:

### Separate plan assignments

Replace generic:

```text
plan_assignments
```

with:

```text
user_diet_assignments
user_workout_assignments
```

### Add Diet Option Groups

Required:

```text
diet_meal_option_groups
diet_meal_options
```

### Use Individual Water Entries

Prefer:

```text
water_entries
```

rather than only one mutable total per day.

### Add Notification Preferences

```text
notification_preferences
```

### Add Reminder Rules

```text
reminder_rules
```

### Add Audit Logs

```text
audit_logs
```

### Add Daily Summary

```text
daily_summaries
```

if persisted summaries are required.

### Add Plan Versions

Explicit tables/columns for diet and workout versions.

---

# 59. Master Development Strategy

Do not build:

```text
Backend
then entire Admin
then entire Flutter
```

independently.

Instead use domain phases.

The correct order is:

```text
FOUNDATION
    ↓
DATABASE
    ↓
API CONTRACT
    ↓
AUTH
    ↓
CONFIGURATION BACKEND
    ↓
ADMIN CONFIGURATION UI
    ↓
TRACKING BACKEND
    ↓
FLUTTER TRACKING
    ↓
PROGRESS
    ↓
NOTIFICATIONS
    ↓
OFFLINE SYNC
    ↓
ANALYTICS
    ↓
HARDENING
    ↓
PRODUCTION
```

---

# 60. BACKEND DEVELOPMENT PHASES

---

# Backend Phase B0 — Architecture Foundation

Build:

* Repository
* Node project
* Environment loader
* Error handling
* Logging
* API versioning
* MySQL connection pool
* Testing framework
* Health endpoint

Deliverable:

```text
GET /api/v1/health
```

works.

### Exit Criteria

* Application starts
* Database connects
* Environment validation works
* Error middleware works
* Tests execute
* Health endpoint passes

---

# Backend Phase B1 — Database Foundation

Implement:

* Final schema review
* Migration system
* Roles
* Users
* Refresh sessions
* Exercises
* Diet configuration
* Workout configuration
* Plan versions
* Assignments
* Goals
* Weight
* Water
* Cardio
* Meal logs
* Workout logs
* Notifications
* Audit

### Exit Criteria

* Clean database can be created from migrations
* All foreign keys work
* Unique constraints work
* Rollback strategy exists
* No manual database setup required

---

# Backend Phase B2 — Authentication & Authorization

Implement:

* Login
* Refresh
* Logout
* Password management
* Admin role
* User role
* Route protection
* User isolation

### Exit Criteria

Security tests prove:

```text
User A cannot access User B
```

and:

```text
Normal user cannot access admin APIs
```

---

# Backend Phase B3 — User Management

Implement:

* Create user
* Edit user
* Activate/deactivate
* Profile
* Timezone
* User overview

### Exit Criteria

Admin user CRUD works entirely through API.

---

# Backend Phase B4 — Exercise Library

Implement:

* Create
* Update
* Archive
* Filter
* Search
* Muscle groups
* Equipment
* Tracking type

### Exit Criteria

Exercise library is ready for workout builder.

---

# Backend Phase B5 — Workout Configuration

Implement:

* Workout plans
* Versions
* Schedule
* Days
* Exercises
* Sets
* Reps
* Rest
* Ordering
* Publishing

### Exit Criteria

A complete workout can be created using API only.

No code changes are required to create a new workout.

---

# Backend Phase B6 — Diet Configuration

Implement:

* Diet plans
* Versions
* Meals
* Meal schedule
* Option groups
* Food alternatives
* Quantities
* Nutrition data
* Publishing

### Exit Criteria

Any reasonable diet plan can be represented without code changes.

---

# Backend Phase B7 — Plan Assignments & Targets

Implement:

* Workout assignment
* Diet assignment
* Effective dates
* Weight goals
* Cardio targets
* Water targets

### Exit Criteria

Different users can simultaneously have different plans.

---

# Backend Phase B8 — Daily Plan Engine

Implement:

```text
GET /me/today
```

Resolve:

* User timezone
* Active plan
* Today's workout
* Meals
* Weight task
* Water target
* Cardio target
* Completion status

### Exit Criteria

The backend can completely describe the user's day.

---

# Backend Phase B9 — User Tracking

Implement:

* Weight logging
* Water entries
* Meal logging
* Food selections
* Cardio logging
* Workout sessions
* Exercise performance
* Workout sets

### Exit Criteria

Every user action needed by the mobile application can be saved.

---

# Backend Phase B10 — Progress Engine

Implement:

* Goal percentage
* Weight loss
* Remaining weight
* 7-day average
* Weekly change
* Meal adherence
* Workout adherence
* Cardio adherence
* Water adherence
* Exercise history
* Strength trends

### Exit Criteria

Frontend applications do not need to calculate official progress themselves.

---

# Backend Phase B11 — Notifications & Reminders

Implement:

* Reminder rules
* Missed task detection
* Notification center
* Push delivery integration
* Deduplication
* Quiet hours

### Exit Criteria

A missed configured task generates one correct notification.

---

# Backend Phase B12 — Analytics

Implement admin aggregation APIs.

Examples:

```text
/admin/analytics/overview

/admin/users/:id/analytics

/me/progress/weekly

/me/progress/monthly
```

### Exit Criteria

Dashboard can display analytics without loading raw historical datasets.

---

# Backend Phase B13 — Security & Performance Hardening

Implement:

* Rate limiting
* Request limits
* Security headers
* Input sanitization
* SQL parameterization
* Index review
* Pagination
* Query optimization
* Token rotation
* Audit review

### Exit Criteria

Backend passes security and performance review.

---

# 61. ADMIN DASHBOARD PHASES

---

# Dashboard Phase D0 — Foundation

Implement:

* Vite application
* Router
* API client
* Authentication state
* Layout
* Sidebar
* Error boundary
* Loading states
* Toasts
* Form system

---

# Dashboard Phase D1 — Authentication

Implement:

* Login
* Logout
* Session refresh
* Protected routes
* Permission guards

---

# Dashboard Phase D2 — User Management

Implement:

```text
Users List
Create User
User Profile
Edit User
Enable/Disable User
```

---

# Dashboard Phase D3 — Exercise Library

Implement:

* Exercise table
* Search
* Filter
* Create
* Edit
* Archive

This should be completed before the workout builder.

---

# Dashboard Phase D4 — Workout Builder

Implement the full configuration workflow.

```text
Workout Plans
Versions
Schedule
Workout Days
Exercise Selection
Set Configuration
Ordering
Preview
Publish
```

This is a critical milestone.

---

# Dashboard Phase D5 — Diet Builder

Implement:

```text
Diet Plans
Versions
Meals
Times
Option Groups
Food Options
Quantities
Nutrition
Preview
Publish
```

---

# Dashboard Phase D6 — Assignments

Admin can:

* Select user
* Assign workout
* Assign diet
* Select effective date
* Configure targets

---

# Dashboard Phase D7 — Targets & Reminders

Manage:

* Weight targets
* Water targets
* Cardio targets
* Reminder configuration
* Notification defaults

---

# Dashboard Phase D8 — User Monitoring

User detail page:

```text
Overview
Weight
Diet
Workout
Water
Cardio
Notifications
```

---

# Dashboard Phase D9 — Analytics

Implement:

* Charts
* Date filters
* Adherence
* Weight trends
* Workout trends
* Water trends
* Cardio trends

---

# Dashboard Phase D10 — Audit & Settings

Implement:

* Audit logs
* System settings
* Notification configuration
* Account administration

---

# Dashboard Phase D11 — UX Hardening

Review:

* Responsive design
* Loading
* Empty states
* Error states
* Validation
* Accessibility
* Large datasets
* Confirmation dialogs

---

# 62. FLUTTER DEVELOPMENT PHASES

---

# Flutter Phase F0 — Foundation

Implement:

* Flutter project architecture
* Theme
* Routing
* API client
* Error model
* Secure storage
* Local database
* Connectivity service

---

# Flutter Phase F1 — Authentication

Implement:

* Login
* Session persistence
* Refresh
* Logout
* Auth failure handling

---

# Flutter Phase F2 — Home / Today's Plan

Connect:

```text
GET /me/today
```

Build:

* Today's progress
* Meals
* Workout
* Cardio
* Water
* Weight
* Missed tasks

---

# Flutter Phase F3 — Weight Tracking

Implement:

* Add weight
* Edit today's weight
* Weight history
* 7-day trend

---

# Flutter Phase F4 — Water Tracking

Implement:

* Quick add
* Custom amount
* History
* Target
* Remaining amount

---

# Flutter Phase F5 — Diet Tracking

Implement:

* Today's meals
* Meal options
* Food selection
* Complete
* Partial
* Skip
* Notes

---

# Flutter Phase F6 — Workout Tracking

Implement:

* Today's workout
* Exercise list
* Previous performance
* Set logging
* Weight
* Reps
* Complete exercise
* Complete workout

This is another critical milestone.

---

# Flutter Phase F7 — Cardio

Implement:

* Activity
* Duration
* Speed
* Incline
* Distance
* Notes
* Target completion

---

# Flutter Phase F8 — Progress

Implement:

* Goal progress
* Weight chart
* Workout progression
* Water
* Cardio
* Diet adherence
* Weekly summary

---

# Flutter Phase F9 — Notifications

Implement:

* Notification center
* Unread indicator
* Deep linking
* Push notifications
* Notification preferences

---

# Flutter Phase F10 — Offline Support

Implement local writes for:

* Workout sets
* Water
* Weight
* Meals
* Cardio

Then implement sync queue.

---

# Flutter Phase F11 — Sync Hardening

Implement:

* Retry
* Idempotency
* Conflict detection
* Failed sync screen
* Connectivity changes

---

# Flutter Phase F12 — Mobile UX Hardening

Review:

* App startup
* Slow connections
* Offline mode
* Keyboard behavior
* Input validation
* Loading states
* Empty states
* Notification permissions
* Background/resume handling

---

# 63. MASTER CROSS-PLATFORM DEVELOPMENT ORDER

The three applications should not be developed independently.

Recommended overall sequence:

| Master Phase | Backend                  | Dashboard        | Flutter           |
| ------------ | ------------------------ | ---------------- | ----------------- |
| **1**        | Architecture             | —                | —                 |
| **2**        | Database                 | —                | —                 |
| **3**        | Authentication           | Foundation       | Foundation        |
| **4**        | Users                    | User Management  | Authentication    |
| **5**        | Exercise Library         | Exercise Library | —                 |
| **6**        | Workout Configuration    | Workout Builder  | —                 |
| **7**        | Diet Configuration       | Diet Builder     | —                 |
| **8**        | Assignments & Targets    | Assignment UI    | —                 |
| **9**        | Daily Plan Engine        | Monitoring Base  | Home              |
| **10**       | Tracking APIs            | —                | Tracking Features |
| **11**       | Progress Engine          | Basic Analytics  | Progress          |
| **12**       | Notification Engine      | Reminder Config  | Notifications     |
| **13**       | Offline APIs/Idempotency | —                | Offline Sync      |
| **14**       | Aggregated Analytics     | Full Analytics   | Final Progress    |
| **15**       | Hardening                | Hardening        | Hardening         |
| **16**       | Production               | Production       | Release           |

---

# 64. What Can Run in Parallel

After the API contract is defined:

```text
Backend
   ↙        ↘
Admin      Flutter
```

can progress in parallel.

For example:

Once workout configuration APIs are stable:

```text
Backend B5
      ↓
Dashboard D4
```

can begin.

Once the daily tracking APIs are stable:

```text
Backend B8 + B9
      ↓
Flutter F2–F7
```

can begin.

---

# 65. What Should NOT Be Done in Parallel Too Early

Do not fully build:

```text
Flutter Workout Screen
```

before the workout API contract exists.

Do not fully build:

```text
Diet Builder
```

before the diet database design is stable.

Do not build:

```text
Analytics
```

before tracking data structures are finalized.

---

# 66. Recommended First Actual Development Track

The first implementation milestone should be:

```text
Database
      ↓
Authentication
      ↓
Users
      ↓
Exercise Library
      ↓
Workout Builder Backend
      ↓
Workout Builder Dashboard
```

Why?

Because one of the central requirements is:

> Administrators must be able to enter and configure the entire workout through the dashboard.

This proves the platform is genuinely configuration-driven.

---

# 67. Second Major Milestone

Then build:

```text
Diet Backend
      ↓
Diet Dashboard
      ↓
Assignment System
      ↓
Goals / Water / Cardio
```

At this point an administrator can fully configure a user.

---

# 68. Third Major Milestone

Then:

```text
Daily Plan Engine
       ↓
Flutter Home
       ↓
Weight
Water
Diet
Workout
Cardio
```

At this point the application becomes usable.

---

# 69. Fourth Major Milestone

Then:

```text
History
Progress
Charts
Adherence
Notifications
Missed Tasks
```

At this stage the platform becomes a complete tracking product.

---

# 70. Fifth Major Milestone

Finally:

```text
Offline
Sync
Security
Performance
Testing
Deployment
Monitoring
Backups
```

At this point the system becomes production-ready.

---

# 71. Testing Strategy

Testing must exist throughout development rather than being postponed until the end.

---

# 72. Backend Tests

### Unit

Test:

* Calculations
* Services
* Adherence
* Progress
* Reminder rules

### Integration

Test:

* Database
* Repositories
* Transactions

### API

Test:

* Authentication
* CRUD
* Tracking
* Authorization

### Security

Test:

```text
User isolation
Admin access
Invalid tokens
Expired tokens
Unauthorized modifications
```

---

# 73. Dashboard Tests

Test:

* Forms
* Validation
* Workout builder
* Diet builder
* Authentication
* Permissions
* API failures
* Plan publishing

---

# 74. Flutter Tests

Test:

* Login
* Home
* Weight
* Water
* Meals
* Workout sets
* Cardio
* Progress
* Notifications
* Offline logging
* Synchronization

---

# 75. Contract Testing

Because three applications communicate through the API, contract integrity is extremely important.

Use OpenAPI as the reference.

When the backend changes:

```text
GET /me/today
```

the API contract must be updated.

React and Flutter should not silently use an old response structure.

---

# 76. Deployment Structure

Recommended server structure:

```text
Internet
   ↓
Nginx
   │
   ├── admin.domain.com
   │        ↓
   │   React Static Build
   │
   └── api.domain.com
            ↓
         Node.js
            ↓
          MySQL
```

Flutter communicates with:

```text
https://api.domain.com/api/v1
```

---

# 77. Backend Production

Run Node.js under a process manager.

Requirements:

* Restart on crash
* Environment variables
* Log rotation
* Health checks
* HTTPS through Nginx

---

# 78. Admin Production

React/Vite is built:

```text
npm run build
```

Then served as static assets through Nginx.

---

# 79. Flutter Production

Separate environments:

```text
Development
Staging
Production
```

Each environment has its own API base URL.

Do not hard-code production endpoints throughout the source code.

---

# 80. Production Database

MySQL production requirements:

* Separate database user
* Strong password
* No public MySQL exposure
* Backups
* Index monitoring
* Slow-query monitoring
* Migration history

---

# 81. Backup Strategy

At minimum:

```text
Daily MySQL Backup
Weekly Backup
Retention
Off-server copy
Restore testing
```

A backup that has never been restored in testing is not enough.

---

# 82. Logging & Monitoring

Backend should monitor:

* Errors
* API failures
* Database failures
* Authentication failures
* Push notification failures
* Background job failures
* Slow requests

---

# 83. API Naming Convention

Use:

```text
/api/v1
```

User self-service:

```text
/api/v1/me/...
```

Admin:

```text
/api/v1/admin/...
```

Examples:

```text
/api/v1/me/today

/api/v1/me/workouts

/api/v1/me/water

/api/v1/admin/users

/api/v1/admin/workout-plans
```

This avoids unnecessarily exposing user IDs for normal self-service APIs.

---

# 84. Database Naming Convention

Use:

```text
snake_case
```

Examples:

```text
workout_plans
workout_plan_versions
workout_plan_days
workout_plan_exercises
workout_logs
workout_log_exercises
workout_sets
```

---

# 85. API JSON Naming

Choose one standard.

Recommended:

```text
camelCase
```

Example:

```json
{
  "currentWeight": 104.8,
  "targetWeight": 95,
  "waterTargetMl": 3000
}
```

The database can remain snake_case.

The mapper layer converts between them.

---

# 86. Status Convention

Do not use arbitrary status strings.

Centralize statuses.

Examples:

```text
ACTIVE
INACTIVE

DRAFT
PUBLISHED
ARCHIVED

PENDING
IN_PROGRESS
COMPLETED
SKIPPED

UNREAD
READ
DISMISSED
```

---

# 87. Date & Time Rules

Database timestamps should be stored consistently.

Users have a timezone.

All scheduling decisions must use:

```text
user.timezone
```

A meal scheduled for:

```text
09:00
```

means 09:00 in the user's configured timezone.

---

# 88. Historical Integrity

Never delete historical references casually.

If an exercise is no longer used:

```text
archive exercise
```

rather than removing all traces.

If a workout plan changes:

```text
new version
```

rather than modifying historical sessions.

If a diet changes:

```text
new version
```

rather than rewriting historical meals.

---

# 89. Configuration-Driven Principle

The following must come from configuration:

* Workout name
* Workout schedule
* Exercises
* Exercise order
* Sets
* Reps
* Rest
* Exercise notes
* Diet meals
* Meal times
* Food choices
* Quantities
* Cardio targets
* Water targets
* Goals
* Reminder rules

Flutter must not contain fixed personal plans.

---

# 90. User Assignment Flow

Complete admin workflow:

```text
Create User
     ↓
Create/Select Diet
     ↓
Create/Select Workout
     ↓
Configure Weight Goal
     ↓
Configure Water
     ↓
Configure Cardio
     ↓
Configure Reminders
     ↓
Assign
     ↓
User Logs In
```

---

# 91. User Daily Flow

```text
Open App
    ↓
Load Today
    ↓
Enter Weight
    ↓
Track Meals
    ↓
Track Water
    ↓
Perform Workout
    ↓
Enter Sets
    ↓
Track Cardio
    ↓
View Completion
    ↓
Receive Reminder for Anything Missed
```

---

# 92. Progress Flow

```text
Daily Logs
     ↓
Backend Aggregation
     ↓
7-Day / Weekly Calculations
     ↓
Progress API
     ↓
Flutter Charts
     ↓
Admin Analytics
```

---

# 93. Notification Flow

```text
Configured Task
     ↓
Scheduled Time
     ↓
Backend Checks Completion
     ↓
Completed?
   ↙       ↘
YES       NO
 ↓         ↓
Stop    Grace Period
            ↓
       Still Missing?
        ↙        ↘
      NO          YES
      ↓            ↓
    Stop      Notification
```

---

# 94. Definition of MVP

The MVP is complete when:

1. Admin login works.
2. User login works.
3. Admin can create users.
4. Admin can create exercises.
5. Admin can create workout plans.
6. Admin can configure workout days.
7. Admin can configure exercises, sets and repetitions.
8. Admin can create diet plans.
9. Admin can configure meals and choices.
10. Admin can assign plans.
11. Admin can configure weight target.
12. Admin can configure water.
13. Admin can configure cardio.
14. Flutter displays today's plan.
15. User can log weight.
16. User can log meals.
17. User can log water.
18. User can log workout sets.
19. User can log cardio.
20. User can view basic progress.

Notifications and advanced analytics can then build on top of this.

---

# 95. Definition of Full V1

Full V1 additionally requires:

1. Notifications.
2. Missed-task detection.
3. Push notifications.
4. In-app notification center.
5. Weekly analytics.
6. Monthly analytics.
7. Exercise progression.
8. 7-day weight average.
9. Offline support.
10. Synchronization.
11. Audit logs.
12. Full admin analytics.
13. Security hardening.
14. Performance review.
15. Backup system.
16. Production deployment.
17. Production monitoring.

---

# 96. Recommended Development Phase Summary

The complete project can be divided into approximately **16 master phases**:

```text
PHASE 0
Documentation & Architecture

PHASE 1
Database Finalization

PHASE 2
Backend Foundation

PHASE 3
Authentication & Users

PHASE 4
Exercise Library

PHASE 5
Workout Configuration

PHASE 6
Diet Configuration

PHASE 7
Assignments & Targets

PHASE 8
Admin Configuration Completion

PHASE 9
Daily Plan Engine

PHASE 10
Flutter Core Tracking

PHASE 11
Progress Engine

PHASE 12
Notifications & Reminders

PHASE 13
Analytics

PHASE 14
Offline Synchronization

PHASE 15
Security, Testing & Performance

PHASE 16
Production Deployment
```

---

# 97. Phase 0 — Documentation & Architecture

Complete:

* Product requirements
* System architecture
* Database ERD
* API conventions
* Security decisions
* Notification design
* Offline design

**Do not start heavy frontend development before Phase 0 is complete.**

---

# 98. Phase 1 — Database Finalization

Complete:

* Final schema
* Foreign keys
* Constraints
* Versioning
* Assignment tables
* Notification tables
* Reminder tables
* Audit tables
* Indexes
* Migration scripts

Result:

> Database foundation is stable.

---

# 99. Phase 2 — Backend Foundation

Complete:

* Node.js
* Application structure
* Configuration
* Database pool
* Error handling
* Logging
* Health
* Base API

---

# 100. Phase 3 — Authentication & Users

Complete:

* Login
* Tokens
* Roles
* User management
* Profile
* Authorization

---

# 101. Phase 4 — Exercise Library

Complete backend + dashboard together.

Result:

> Administrator can manage reusable exercises.

---

# 102. Phase 5 — Workout Configuration

Complete backend + dashboard.

Result:

> Administrator can enter any workout entirely from the dashboard.

This is one of the project's most important acceptance points.

---

# 103. Phase 6 — Diet Configuration

Complete backend + dashboard.

Result:

> Administrator can configure diets without source changes.

---

# 104. Phase 7 — Assignment & Targets

Complete:

* Workout assignment
* Diet assignment
* Weight goal
* Water target
* Cardio target

Result:

> A user has a complete personalized plan.

---

# 105. Phase 8 — Admin Configuration Completion

Complete:

* All configuration UI
* User overview
* Reminder configuration
* Settings

At this point the administrator can configure the system without developer assistance.

---

# 106. Phase 9 — Daily Plan Engine

Backend determines:

```text
What does this user need to do today?
```

This endpoint drives Flutter.

---

# 107. Phase 10 — Flutter Core Tracking

Complete:

* Home
* Weight
* Water
* Diet
* Workout
* Cardio

At this phase the actual user experience becomes usable.

---

# 108. Phase 11 — Progress Engine

Complete:

* Goal progress
* Weight trends
* 7-day averages
* Workout history
* Strength progression
* Adherence

---

# 109. Phase 12 — Notifications

Complete:

* Reminders
* Missed tasks
* Notification center
* Push notifications
* Deep linking

---

# 110. Phase 13 — Analytics

Complete both:

```text
Flutter Progress
Admin Analytics
```

---

# 111. Phase 14 — Offline Synchronization

Complete:

* Local DB
* Sync queue
* Retry
* Idempotency
* Failure handling

---

# 112. Phase 15 — Hardening

Complete:

* Security testing
* Integration tests
* E2E tests
* Query optimization
* API performance
* Mobile testing
* Permission testing
* Notification testing

---

# 113. Phase 16 — Production

Complete:

* Production MySQL
* Node deployment
* Nginx
* HTTPS
* Dashboard deployment
* Flutter production configuration
* Push certificates
* Backups
* Monitoring
* Production smoke tests

---

# 114. Final Development Rule

The project should always be developed using this hierarchy:

```text
DATABASE
   ↓
BUSINESS RULES
   ↓
API CONTRACT
   ↓
BACKEND
   ↓
ADMIN CONFIGURATION
   ↓
FLUTTER EXECUTION
   ↓
ANALYTICS
```

Do not reverse it and build screens first while figuring out the backend afterward.

---

# 115. Final Architecture Principle

The completed system should function as:

```text
ADMIN CONFIGURES
       ↓
BACKEND STORES
       ↓
BACKEND RESOLVES PLAN
       ↓
FLUTTER DISPLAYS
       ↓
USER LOGS ACTIVITY
       ↓
BACKEND VALIDATES
       ↓
MYSQL STORES HISTORY
       ↓
BACKEND CALCULATES PROGRESS
       ↓
REMINDER ENGINE CHECKS MISSED TASKS
       ↓
USER RECEIVES NOTIFICATION
       ↓
ADMIN + USER SEE ANALYTICS
```

---

# 116. Final Recommendation

The correct starting point is **not Flutter** and it is **not the dashboard UI**.

The development order should begin with:

```text
1. Final Documentation
2. Final Database
3. Database Migrations
4. Backend Foundation
5. Authentication
6. Exercise Library
7. Workout Configuration Backend
8. Workout Builder Dashboard
9. Diet Configuration Backend
10. Diet Builder Dashboard
11. Plan Assignments
12. Daily Plan Engine
13. Flutter
14. Progress
15. Notifications
16. Offline Sync
17. Analytics
18. Hardening
19. Production
```

This order gives the project a stable foundation and prevents expensive rewrites later.

The most important early milestone is:

> **An administrator can log into the React/Vite dashboard, create exercises, create an entirely new workout plan, configure each training day, configure sets/repetitions/rest, publish the plan, and assign it to a user without modifying a single line of code.**

Once that works correctly, the Flutter application can consume the plan dynamically and the platform has achieved its core configuration-driven architecture.
