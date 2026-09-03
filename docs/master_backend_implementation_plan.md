# Fitness Tracking Platform

# Master Backend Implementation Plan

**Backend:** Node.js + TypeScript
**HTTP Framework:** Fastify
**Database:** MySQL 8.x / 8.4 baseline
**API Style:** REST
**API Version:** `/api/v1`
**Architecture:** Modular service/repository architecture
**Authentication:** Access Token + Refresh Token
**Clients:** React/Vite Admin + Flutter Mobile
**Primary Goal:** Configuration-driven multi-user fitness tracking backend

---

# 1. Backend Mission

The backend is the authoritative layer of the entire fitness platform.

It is responsible for:

* Authentication
* Authorization
* Users
* Roles
* Exercise library
* Workout configuration
* Workout versioning
* Diet configuration
* Diet versioning
* Plan assignments
* Weight goals
* Water targets
* Cardio targets
* Daily plan generation
* Daily tasks
* Meal tracking
* Workout tracking
* Workout set tracking
* Cardio tracking
* Water tracking
* Weight tracking
* Progress calculations
* Adherence calculations
* Notifications
* Reminder scheduling
* Missed-task detection
* Push notification delivery
* Analytics
* Audit logs
* Offline synchronization support
* Idempotency
* Security
* API contracts

React and Flutter must not redefine these business rules.

---

# 2. Architecture Principle

The backend must maintain strict separation between:

```text
CONFIGURATION
      ↓
ASSIGNMENT
      ↓
DAILY PLAN
      ↓
EXECUTION
      ↓
HISTORY
      ↓
ANALYTICS
```

Example:

```text
Workout Plan Configuration

Leg Press
4 × 8–12
```

is not the same record as:

```text
Workout Execution

100 × 12
100 × 11
105 × 10
105 × 9
```

Likewise:

```text
Water Target
3000 ml
```

is different from:

```text
Water Entries

500 ml
250 ml
500 ml
...
```

This distinction must remain throughout the entire backend.

---

# 3. Recommended Technology Baseline

Use:

```text
Node.js LTS
TypeScript
Fastify
MySQL
mysql2/promise
JSON Schema / TypeBox
JWT-compatible token implementation
Argon2 or equivalent password hashing
OpenAPI
Pino structured logging
Vitest or equivalent testing framework
```

The exact patch versions should be pinned when the project is initialized.

Avoid floating production dependencies.

---

# 4. Why TypeScript

The backend has many entities and contracts:

```text
WorkoutPlan
WorkoutVersion
WorkoutDay
WorkoutExercise
DietPlan
DietVersion
Meal
MealOption
Assignment
DailyTask
WorkoutSession
WorkoutSet
ProgressResponse
Notification
```

TypeScript significantly reduces contract mistakes between:

```text
Database
Service
Controller
OpenAPI
React
Flutter
```

Use TypeScript in strict mode.

---

# 5. Repository Position

Within the monorepo:

```text
fitness-platform/
│
├── backend/
├── admin-dashboard/
├── mobile-app/
├── contracts/
├── docs/
└── infrastructure/
```

This document covers:

```text
backend/
```

---

# 6. Backend Directory Structure

Use:

```text
backend/
│
├── src/
│   │
│   ├── app/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── routes.ts
│   │   └── lifecycle.ts
│   │
│   ├── config/
│   │   ├── env.ts
│   │   ├── database.ts
│   │   ├── auth.ts
│   │   ├── cors.ts
│   │   ├── notifications.ts
│   │   └── logger.ts
│   │
│   ├── database/
│   │   ├── pool.ts
│   │   ├── transaction.ts
│   │   ├── query.ts
│   │   ├── health.ts
│   │   └── types.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── roles/
│   │   ├── exercises/
│   │   ├── workout-plans/
│   │   ├── diet-plans/
│   │   ├── assignments/
│   │   ├── goals/
│   │   ├── cardio-targets/
│   │   ├── water-targets/
│   │   ├── daily-plan/
│   │   ├── daily-tasks/
│   │   ├── weight/
│   │   ├── water/
│   │   ├── cardio/
│   │   ├── meals/
│   │   ├── workout-sessions/
│   │   ├── progress/
│   │   ├── analytics/
│   │   ├── reminders/
│   │   ├── notifications/
│   │   ├── push/
│   │   ├── audit/
│   │   └── idempotency/
│   │
│   ├── middleware/
│   │   ├── authenticate.ts
│   │   ├── authorize.ts
│   │   ├── request-id.ts
│   │   ├── rate-limit.ts
│   │   ├── error-handler.ts
│   │   └── idempotency.ts
│   │
│   ├── jobs/
│   │   ├── runner.ts
│   │   ├── daily-plan.job.ts
│   │   ├── reminder.job.ts
│   │   ├── missed-task.job.ts
│   │   ├── notification-delivery.job.ts
│   │   ├── daily-summary.job.ts
│   │   └── progress-snapshot.job.ts
│   │
│   ├── integrations/
│   │   ├── push/
│   │   └── email/
│   │
│   ├── shared/
│   │   ├── errors/
│   │   ├── constants/
│   │   ├── pagination/
│   │   ├── dates/
│   │   ├── security/
│   │   ├── schemas/
│   │   ├── utils/
│   │   └── types/
│   │
│   └── openapi/
│
├── migrations/
│
├── seeds/
│
├── scripts/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── api/
│   ├── security/
│   └── fixtures/
│
├── coverage/
│
├── .env.example
├── tsconfig.json
├── package.json
└── README.md
```

---

# 7. Standard Module Structure

Each domain module should have a predictable structure.

Example:

```text
modules/workout-plans/
│
├── workout-plan.routes.ts
├── workout-plan.controller.ts
├── workout-plan.service.ts
├── workout-plan.repository.ts
├── workout-plan.schemas.ts
├── workout-plan.types.ts
├── workout-plan.mapper.ts
├── workout-plan.errors.ts
└── index.ts
```

---

# 8. Route Responsibility

Routes define:

* HTTP method
* URL
* Request schema
* Response schema
* Authentication requirements
* Authorization requirements
* Controller

Example conceptual route:

```text
POST /api/v1/admin/workout-plans
```

The route should not contain business logic.

---

# 9. Controller Responsibility

Controllers should:

1. Read validated request data.
2. Read authenticated user.
3. Call service.
4. Convert result to HTTP response.

Controllers should not:

* Write SQL
* Calculate adherence
* Resolve plan versions
* Perform complex authorization
* Build transactions

---

# 10. Service Responsibility

Services contain business logic.

Examples:

```text
WorkoutPlanService.createPlan()

WorkoutPlanService.createVersion()

WorkoutPlanService.publishVersion()

AssignmentService.assignWorkout()

DailyPlanService.resolveToday()

WorkoutSessionService.startWorkout()

ProgressService.calculateWeightProgress()

ReminderService.processOverdueTasks()
```

Services own transaction boundaries.

---

# 11. Repository Responsibility

Repositories perform database operations.

Example:

```text
WorkoutPlanRepository.findById()

WorkoutPlanRepository.insertVersion()

WorkoutPlanRepository.getDays()

WorkoutPlanRepository.insertExercise()
```

Repositories should not contain HTTP logic.

Repositories should return database/domain structures.

---

# 12. Mapper Responsibility

Mappers convert:

```text
Database representation
        ↓
Domain representation
        ↓
API representation
```

Database snake_case should not leak directly into API contracts.

Example:

```text
target_weight_kg
```

becomes:

```text
targetWeightKg
```

---

# 13. API Naming

All endpoints start with:

```text
/api/v1
```

Admin endpoints:

```text
/api/v1/admin/...
```

Authenticated user self-service:

```text
/api/v1/me/...
```

Public/authentication:

```text
/api/v1/auth/...
```

System:

```text
/api/v1/health
```

---

# 14. API Response Standard

Successful single resource:

```json
{
  "success": true,
  "data": {}
}
```

Successful list:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 100,
    "totalPages": 4
  }
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request.",
    "details": []
  }
}
```

---

# 15. Error Codes

Use stable machine-readable codes.

Examples:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
RESOURCE_NOT_FOUND
RESOURCE_CONFLICT

INVALID_CREDENTIALS
TOKEN_EXPIRED
REFRESH_TOKEN_INVALID

PLAN_NOT_FOUND
PLAN_VERSION_NOT_FOUND
PLAN_VERSION_IMMUTABLE

ASSIGNMENT_OVERLAP

WORKOUT_ALREADY_STARTED
WORKOUT_ALREADY_COMPLETED

DAILY_WEIGHT_ALREADY_EXISTS

TASK_ALREADY_COMPLETED

IDEMPOTENCY_CONFLICT
```

Flutter should react to codes, not parse human-readable messages.

---

# 16. HTTP Status Standards

Use:

```text
200 OK
201 Created
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests
500 Internal Server Error
503 Service Unavailable
```

---

# 17. OpenAPI

Maintain:

```text
contracts/openapi/openapi.yaml
```

OpenAPI should describe:

* Authentication
* Schemas
* Requests
* Responses
* Errors
* Pagination
* Admin APIs
* Mobile APIs

OpenAPI is the contract between:

```text
Backend
Admin
Flutter
```

---

# 18. Database Access

Use one MySQL connection pool.

Do not create new MySQL connections per request.

Structure:

```text
Request
   ↓
Repository
   ↓
Pool
   ↓
MySQL
```

---

# 19. Transaction Helper

Implement:

```text
withTransaction(async trx => {})
```

Conceptually:

```text
START TRANSACTION

service operation

COMMIT
```

On failure:

```text
ROLLBACK
```

Use transactions for multi-table operations.

---

# 20. Required Transaction Boundaries

Transactions should be used for:

### Publishing workout versions

```text
validate version
archive/adjust previous state
publish version
audit event
```

### Publishing diet versions

Same principle.

### Assigning plans

```text
check overlap
create assignment
audit
```

### Starting workout

```text
create workout session
create session exercises
create planned sets if needed
update task
```

### Completing workout

```text
validate sets
complete exercises
complete workout
complete daily task
update summary
```

### Meal logging

```text
create/update meal log
replace selections
update daily task
```

---

# 21. Environment Configuration

`.env.example`:

```text
NODE_ENV=

APP_HOST=
APP_PORT=

DATABASE_HOST=
DATABASE_PORT=
DATABASE_NAME=
DATABASE_USER=
DATABASE_PASSWORD=
DATABASE_POOL_MIN=
DATABASE_POOL_MAX=

ACCESS_TOKEN_SECRET=
ACCESS_TOKEN_TTL=
REFRESH_TOKEN_SECRET=
REFRESH_TOKEN_TTL=

PASSWORD_HASH_MEMORY=
PASSWORD_HASH_ITERATIONS=

ADMIN_ALLOWED_ORIGINS=

PUSH_PROVIDER=
PUSH_PROJECT_ID=
PUSH_CREDENTIALS_PATH=

RATE_LIMIT_MAX=

LOG_LEVEL=
```

Environment configuration must be validated at startup.

Application startup should fail if required secrets are missing.

---

# 22. Server Startup Process

Startup sequence:

```text
Load Environment
      ↓
Validate Environment
      ↓
Initialize Logger
      ↓
Initialize MySQL Pool
      ↓
Test Database
      ↓
Create Fastify App
      ↓
Register Plugins
      ↓
Register Middleware
      ↓
Register Routes
      ↓
Register Error Handler
      ↓
Start Server
```

---

# 23. Graceful Shutdown

Handle:

```text
SIGTERM
SIGINT
```

Shutdown should:

```text
Stop accepting requests
      ↓
Allow current requests to finish
      ↓
Stop worker jobs
      ↓
Close MySQL pool
      ↓
Exit
```

---

# 24. Request IDs

Every request gets:

```text
requestId
```

Example:

```text
req_01J...
```

Return:

```text
X-Request-ID
```

Include it in logs and errors.

---

# 25. Structured Logging

Log JSON.

Important fields:

```text
timestamp
level
requestId
userId
method
path
status
duration
errorCode
```

Never log:

```text
password
access token
refresh token
push token
full credentials
```

---

# 26. Authentication Module

Endpoints:

```text
POST /api/v1/auth/login

POST /api/v1/auth/refresh

POST /api/v1/auth/logout

POST /api/v1/auth/forgot-password

POST /api/v1/auth/reset-password
```

---

# 27. Login Flow

```text
Email + Password
      ↓
Find User
      ↓
Verify Status
      ↓
Verify Password
      ↓
Generate Access Token
      ↓
Generate Refresh Token
      ↓
Store Refresh Token Hash
      ↓
Update Last Login
      ↓
Return Session
```

Never store the raw refresh token.

Store its hash.

---

# 28. Access Token

Access token should contain only necessary claims.

Example:

```json
{
  "sub": "123",
  "role": "user",
  "sessionId": "..."
}
```

Do not place sensitive profile data inside tokens.

---

# 29. Refresh Token Rotation

Each successful refresh should:

```text
Validate token
      ↓
Verify stored hash
      ↓
Revoke previous token
      ↓
Generate replacement
      ↓
Store replacement
```

This limits the effect of stolen refresh tokens.

---

# 30. Authorization

Use role-based guards.

Examples:

```text
requireAuthenticatedUser

requireAdmin
```

Normal user routes should derive user ID from:

```text
request.auth.userId
```

Never from:

```text
body.userId
```

for self-service requests.

---

# 31. User Isolation Rule

This endpoint:

```text
GET /api/v1/me/weight
```

automatically means:

```text
authenticated user's weight
```

The Flutter application should not send its own user ID.

---

# 32. Admin User Module

Endpoints:

```text
GET    /api/v1/admin/users
POST   /api/v1/admin/users

GET    /api/v1/admin/users/:userId
PATCH  /api/v1/admin/users/:userId

POST   /api/v1/admin/users/:userId/disable
POST   /api/v1/admin/users/:userId/enable
```

---

# 33. Current User Module

Endpoints:

```text
GET   /api/v1/me

PATCH /api/v1/me

GET   /api/v1/me/settings
PATCH /api/v1/me/settings
```

---

# 34. Exercise Library Module

Admin endpoints:

```text
GET    /api/v1/admin/exercises
POST   /api/v1/admin/exercises

GET    /api/v1/admin/exercises/:id
PATCH  /api/v1/admin/exercises/:id

POST   /api/v1/admin/exercises/:id/archive
POST   /api/v1/admin/exercises/:id/restore
```

Support filtering:

```text
search
muscleGroup
equipment
trackingType
status
page
limit
```

---

# 35. Exercise Tracking Types

Support:

```text
weight_reps
reps_only
duration
distance
weight_duration
custom
```

This determines which workout-set fields Flutter should display.

---

# 36. Workout Plan Module

Base endpoints:

```text
GET    /api/v1/admin/workout-plans

POST   /api/v1/admin/workout-plans

GET    /api/v1/admin/workout-plans/:planId

PATCH  /api/v1/admin/workout-plans/:planId

POST   /api/v1/admin/workout-plans/:planId/archive
```

---

# 37. Workout Versions

Endpoints:

```text
GET  /api/v1/admin/workout-plans/:planId/versions

POST /api/v1/admin/workout-plans/:planId/versions

GET  /api/v1/admin/workout-plans/:planId/versions/:versionId

POST /api/v1/admin/workout-plans/:planId/versions/:versionId/publish
```

---

# 38. Published Version Rule

Once:

```text
status = published
```

the version becomes read-only.

API requests attempting to modify it return:

```text
409 PLAN_VERSION_IMMUTABLE
```

Admin should:

```text
Duplicate Published Version
      ↓
Edit New Draft
      ↓
Publish New Version
```

---

# 39. Workout Day Endpoints

```text
POST
/api/v1/admin/workout-versions/:versionId/days

PATCH
/api/v1/admin/workout-days/:dayId

DELETE
/api/v1/admin/workout-days/:dayId

POST
/api/v1/admin/workout-versions/:versionId/days/reorder
```

---

# 40. Workout Exercise Endpoints

```text
POST
/api/v1/admin/workout-days/:dayId/exercises

PATCH
/api/v1/admin/workout-exercises/:id

DELETE
/api/v1/admin/workout-exercises/:id

POST
/api/v1/admin/workout-days/:dayId/exercises/reorder
```

---

# 41. Workout Configuration Validation

When saving:

```text
targetSets > 0
```

If reps are configured:

```text
repsMax >= repsMin
```

Rest:

```text
>= 0
```

Exercise order must be unique within a workout day.

---

# 42. Workout Publish Validation

Before publishing:

Verify:

```text
Plan exists

Version is draft

At least one configured day exists

Training days contain exercises

No duplicate exercise order

All required targets are valid

Every referenced exercise exists

No invalid rest/repetition ranges
```

Only then publish.

---

# 43. Diet Plan Module

Endpoints:

```text
GET    /api/v1/admin/diet-plans
POST   /api/v1/admin/diet-plans
GET    /api/v1/admin/diet-plans/:id
PATCH  /api/v1/admin/diet-plans/:id
POST   /api/v1/admin/diet-plans/:id/archive
```

---

# 44. Diet Versions

```text
GET
/api/v1/admin/diet-plans/:planId/versions

POST
/api/v1/admin/diet-plans/:planId/versions

GET
/api/v1/admin/diet-plans/:planId/versions/:versionId

POST
/api/v1/admin/diet-plans/:planId/versions/:versionId/publish
```

Published diet versions are also immutable.

---

# 45. Diet Meal Endpoints

```text
POST
/api/v1/admin/diet-versions/:versionId/meals

PATCH
/api/v1/admin/diet-meals/:mealId

DELETE
/api/v1/admin/diet-meals/:mealId

POST
/api/v1/admin/diet-versions/:versionId/meals/reorder
```

---

# 46. Diet Option Groups

Endpoints:

```text
POST
/api/v1/admin/diet-meals/:mealId/groups

PATCH
/api/v1/admin/diet-option-groups/:groupId

DELETE
/api/v1/admin/diet-option-groups/:groupId
```

Group validation:

```text
minimumSelections >= 0

maximumSelections >= minimumSelections

required groups should normally require >= 1 selection
```

---

# 47. Diet Options

Endpoints:

```text
POST
/api/v1/admin/diet-option-groups/:groupId/options

PATCH
/api/v1/admin/diet-options/:optionId

DELETE
/api/v1/admin/diet-options/:optionId
```

Options can either reference:

```text
foodId
```

or contain a custom label/composite option.

---

# 48. Assignment Module

Separate APIs:

```text
/api/v1/admin/users/:userId/workout-assignments

/api/v1/admin/users/:userId/diet-assignments
```

Do not use a generic polymorphic plan assignment API internally.

---

# 49. Workout Assignment Flow

```text
User
      ↓
Published Workout Version
      ↓
Effective From
      ↓
Optional Effective Until
      ↓
Check Existing Assignments
      ↓
Reject Overlap
      ↓
Create Assignment
      ↓
Audit
```

---

# 50. Diet Assignment Flow

Same architecture as workout assignment.

Only published versions can be assigned.

---

# 51. Effective-Date Resolution

To resolve a plan for date `D`:

```text
effective_from <= D

AND

effective_until IS NULL
OR
effective_until >= D

AND

status = active
```

Only one active assignment of each plan type should apply to a user/date.

---

# 52. Goal Module

Admin endpoints:

```text
GET
/api/v1/admin/users/:userId/weight-goals

POST
/api/v1/admin/users/:userId/weight-goals

PATCH
/api/v1/admin/weight-goals/:goalId
```

User:

```text
GET /api/v1/me/goals
```

---

# 53. Water Target Module

Admin:

```text
GET
/api/v1/admin/users/:userId/water-targets

POST
/api/v1/admin/users/:userId/water-targets
```

Flutter:

```text
GET /api/v1/me/water/target
```

---

# 54. Cardio Target Module

Admin configures:

```text
Activity

Applicable weekdays

Minimum duration

Maximum duration

Speed range

Incline range

Distance range

Effective dates
```

---

# 55. Daily Plan Engine

This is a critical backend component.

Main endpoint:

```text
GET /api/v1/me/today
```

Optional historical date:

```text
GET /api/v1/me/days/:date
```

---

# 56. Daily Plan Resolution Algorithm

For authenticated user:

```text
1. Get user timezone

2. Determine local date

3. Resolve active diet assignment

4. Resolve active workout assignment

5. Resolve today's workout day

6. Resolve today's meals

7. Resolve active water target

8. Resolve active cardio target for weekday

9. Resolve active weight goal

10. Materialize daily tasks

11. Load existing logs

12. Calculate task completion

13. Calculate current adherence

14. Return daily plan
```

---

# 57. `/me/today` Response Shape

Conceptually:

```json
{
  "date": "2026-08-30",

  "weight": {},

  "water": {},

  "diet": {
    "meals": []
  },

  "workout": {},

  "cardio": {},

  "tasks": [],

  "progress": {
    "completedTasks": 4,
    "totalTasks": 8,
    "dailyAdherence": 50
  }
}
```

---

# 58. Daily Task Materialization

Tasks should be deterministic.

Example keys:

```text
weight

water

meal:123

meal:124

workout:51

cardio:7
```

Use:

```text
userId + taskDate + taskKey
```

as logical uniqueness.

Calling daily plan generation repeatedly must not duplicate tasks.

---

# 59. Task Status

Possible states:

```text
pending
in_progress
completed
skipped
missed
not_required
```

---

# 60. Weight Tracking

Endpoints:

```text
GET
/api/v1/me/weight

POST
/api/v1/me/weight

PUT
/api/v1/me/weight/:date

GET
/api/v1/me/weight/history
```

One official entry per local calendar day.

---

# 61. Weight Logging Flow

```text
Authenticated User
      ↓
Resolve Local Date
      ↓
Validate 20–500 kg
      ↓
Insert / update permitted daily record
      ↓
Complete weight task
      ↓
Recalculate daily summary
      ↓
Return weight progress
```

---

# 62. Water Tracking

Endpoints:

```text
GET
/api/v1/me/water/today

POST
/api/v1/me/water

DELETE
/api/v1/me/water/:entryId

GET
/api/v1/me/water/history
```

---

# 63. Water Entry Example

Request:

```json
{
  "amountMl": 500,
  "clientOperationId": "..."
}
```

Response should include updated day totals:

```json
{
  "entry": {},
  "today": {
    "totalMl": 2000,
    "targetMl": 3000,
    "remainingMl": 1000,
    "completionPercent": 66.67
  }
}
```

---

# 64. Meal Tracking

Endpoints:

```text
GET
/api/v1/me/meals/today

PUT
/api/v1/me/meals/:mealId/log

GET
/api/v1/me/meals/history
```

---

# 65. Meal Log Request

Conceptually:

```json
{
  "status": "completed",
  "selections": [
    {
      "optionGroupId": 12,
      "optionId": 44
    }
  ],
  "notes": null,
  "clientOperationId": "..."
}
```

---

# 66. Meal Validation

Backend must verify:

* Meal belongs to user's active diet.
* Meal applies to requested date.
* Selected group belongs to meal.
* Option belongs to group.
* Minimum group selection count satisfied.
* Maximum selection count not exceeded.
* No duplicate option submission.

Flutter cannot be trusted for this validation.

---

# 67. Workout Session API

Endpoints:

```text
GET
/api/v1/me/workout/today

POST
/api/v1/me/workouts/start

GET
/api/v1/me/workouts/:sessionId

POST
/api/v1/me/workouts/:sessionId/sets

PATCH
/api/v1/me/workout-sets/:setId

DELETE
/api/v1/me/workout-sets/:setId

POST
/api/v1/me/workouts/:sessionId/complete

POST
/api/v1/me/workouts/:sessionId/skip
```

---

# 68. Start Workout Flow

```text
Resolve today's workout
      ↓
Verify training day
      ↓
Check existing session
      ↓
Create workout session
      ↓
Snapshot planned workout
      ↓
Create workout session exercises
      ↓
Mark daily task in_progress
      ↓
Return session
```

This should run in one transaction.

---

# 69. Workout Snapshot

When a workout begins, copy:

```text
Exercise name

Tracking type

Planned sets

Rep range

Rest

```

into session records.

That protects historical accuracy.

---

# 70. Workout Set Logging

Example:

```json
{
  "exerciseSessionId": 881,
  "setNumber": 1,
  "setType": "working",
  "weightKg": 100,
  "reps": 12,
}
```

Validation depends on exercise tracking type.

---

# 71. Tracking-Type Validation

### `weight_reps`

Allow:

```text
weight
reps
```

### `reps_only`

Require:

```text
reps
```

### `duration`

Require:

```text
durationSeconds
```

### `distance`

Require:

```text
distanceMeters
```

---

# 72. Previous Performance

Endpoint:

```text
GET
/api/v1/me/exercises/:exerciseId/previous-performance
```

Response:

```text
Last workout date

Previous sets

Highest weight

Highest completed reps

Recent sessions
```

This powers progressive-overload UX in Flutter.

---

# 73. Workout Completion

Before completion:

* Session exists.
* Session belongs to authenticated user.
* Status isn't completed.
* Required exercises have valid state.
* Set data passes validation.

Then:

```text
complete session
complete workout task
calculate summary
audit if appropriate
```

---

# 74. Cardio Tracking

Endpoints:

```text
GET
/api/v1/me/cardio/today

POST
/api/v1/me/cardio

PATCH
/api/v1/me/cardio/:logId

DELETE
/api/v1/me/cardio/:logId

GET
/api/v1/me/cardio/history
```

Multiple cardio sessions per day are allowed.

---

# 75. Cardio Progress

Backend calculates:

```text
Actual Minutes

Target Minimum

Target Maximum

Completion %
```

If the minimum is reached:

```text
task = completed
```

unless business configuration says otherwise.

---

# 76. Progress Module

Endpoints:

```text
GET
/api/v1/me/progress

GET
/api/v1/me/progress/weight

GET
/api/v1/me/progress/workouts

GET
/api/v1/me/progress/cardio

GET
/api/v1/me/progress/water

GET
/api/v1/me/progress/nutrition

GET
/api/v1/me/progress/weekly

GET
/api/v1/me/progress/monthly
```

---

# 77. Weight Goal Formula

For loss goal:

```text
progress =
(startingWeight - currentWeight)
/
(startingWeight - targetWeight)
× 100
```

Clamp:

```text
0–100
```

Also return:

```text
weightLostKg

remainingKg
```

---

# 78. Weight Trend

Backend calculates:

```text
Daily weight

7-day calendar average

Previous 7-day average

Weekly change

Long-term change
```

Do not make Flutter calculate the official trend independently.

---

# 79. Workout Progress

Return per exercise:

```text
Previous performance

Current performance

Max load

Best reps at load

Volume

Session history
```

---

# 80. Training Volume

For applicable completed working sets:

```text
volume = weight × reps
```

Exercise session:

```text
SUM(set volume)
```

Do not use volume for reps-only exercises.

---

# 81. Nutrition Adherence

Possible formula:

```text
completed meal = 1

partial meal = configurable partial credit

skipped/missed meal = 0
```

Then:

```text
achieved / expected × 100
```

The exact weighting belongs in backend configuration.

---

# 82. Water Adherence

```text
min(actual / target, 1) × 100
```

Example:

```text
3000 target
2500 actual

83.33%
```

Going above the target should not produce >100% adherence.

---

# 83. Cardio Adherence

Use configured minimum target.

Example:

```text
Target minimum = 25

Actual = 20

80%
```

Clamp to 100%.

---

# 84. Overall Daily Adherence

Read weights from:

```text
user_adherence_configs
```

Example calculation:

```text
Diet × 0.35

Workout × 0.25

Cardio × 0.15

Water × 0.15

Weight Logging × 0.10
```

Only backend produces the official score.

---

# 85. Daily Summary Service

Implement:

```text
DailySummaryService.recalculate(userId, date)
```

Triggered when:

```text
weight changes

water changes

meal changes

workout changes

cardio changes

plan requirement changes
```

---

# 86. Analytics Snapshots

Daily summaries are operational.

Progress snapshots are analytical.

Worker can aggregate:

```text
daily
weekly
monthly
```

This prevents dashboards from recalculating everything from raw logs repeatedly.

---

# 87. Notification Preferences

User API:

```text
GET
/api/v1/me/notification-settings

PATCH
/api/v1/me/notification-settings
```

Support:

```text
Push

In-app

Local

Quiet hours

Category preferences
```

---

# 88. Reminder Configuration

Admin endpoints:

```text
GET
/api/v1/admin/reminders

POST
/api/v1/admin/reminders

PATCH
/api/v1/admin/reminders/:id

DELETE
/api/v1/admin/reminders/:id
```

---

# 89. Reminder Categories

Support:

```text
meal
workout
cardio
water
weight
```

---

# 90. Reminder Modes

Support:

```text
fixed_time

relative_to_task

interval
```

Examples:

### Fixed

```text
Weight reminder at 08:00
```

### Relative

```text
Meal reminder 15 min before meal
```

### Interval

```text
Water reminder every 90 min
```

---

# 91. Missed Task Job

Worker periodically queries:

```text
status = pending

due_at < now
```

Then:

```text
Check completion
      ↓
Still incomplete?
      ↓
Mark missed when appropriate
      ↓
Generate notification
```

---

# 92. Notification Deduplication

Generate a deterministic key:

```text
userId
+
taskDate
+
taskKey
+
notificationType
```

Example:

```text
54:2026-08-30:meal-123:missed
```

Unique database constraint prevents duplication.

---

# 93. Push Architecture

Use an abstraction:

```text
PushProvider
```

Interface:

```text
sendToDevice()

sendToDevices()
```

Implementation can use the selected push provider.

Business modules must not directly call provider-specific SDK code.

---

# 94. Notification Delivery

Flow:

```text
Create Notification
      ↓
Create Delivery Record
      ↓
Worker Claims Pending Delivery
      ↓
Send
      ↓
Success?
   ↙       ↘
 YES       NO
 ↓          ↓
sent      retry
```

Persist failures.

---

# 95. Worker Architecture

Initially, remain within Node + MySQL.

Run:

```text
API process

Worker process
```

from the same codebase.

Example:

```text
npm run start:api

npm run start:worker
```

Do not introduce Redis solely for V1 unless scaling requirements make it necessary.

---

# 96. Worker Concurrency

Multiple worker instances must not process the same job simultaneously.

Use MySQL transactional claim patterns.

Concept:

```text
START TRANSACTION

select pending work for update

mark processing

COMMIT
```

Then perform external operation.

---

# 97. Background Job Frequencies

Conceptually:

```text
Daily Plan Generation
periodic / on demand

Missed Task Detection
every few minutes

Notification Delivery
frequent

Daily Summary
event-driven + repair pass

Progress Snapshot
daily / weekly / monthly
```

Exact cadence belongs in configuration.

---

# 98. On-Demand Daily Plan Generation

Do not rely solely on cron.

When Flutter calls:

```text
GET /me/today
```

the backend should ensure today's tasks exist.

Thus:

```text
scheduler failure
```

does not make the app unusable.

---

# 99. Idempotency Middleware

Flutter offline retries require idempotency.

Mutation requests may include:

```text
Idempotency-Key:
550e8400-e29b-41d4-a716-446655440000
```

Middleware:

```text
Check key
      ↓
Existing successful operation?
      ↓
Return stored response
```

Otherwise process normally and store result.

---

# 100. Idempotency Scope

Scope by:

```text
authenticated user

operation ID
```

Never globally trust a client-generated key without user scope.

---

# 101. Offline Synchronization Considerations

Backend must support retries for:

* Weight
* Water
* Meals
* Workout sets
* Cardio

Each mutation response should include:

```text
serverId

createdAt

updatedAt
```

Flutter maintains local-to-server mapping.

---

# 102. Optimistic Concurrency

For mutable records, consider:

```text
updatedAt
```

or a version number.

Flutter sends expected version.

If server record changed:

```text
409 CONFLICT
```

This becomes especially useful for offline editing.

---

# 103. Audit Logging

Record important admin actions.

Examples:

```text
USER_CREATED

USER_DISABLED

WORKOUT_PLAN_CREATED

WORKOUT_VERSION_PUBLISHED

DIET_VERSION_PUBLISHED

WORKOUT_ASSIGNED

DIET_ASSIGNED

WEIGHT_GOAL_CHANGED

REMINDER_CHANGED
```

---

# 104. Audit Service

Central function:

```text
AuditService.record({
  actor,
  action,
  entity,
  before,
  after
})
```

Do not manually create inconsistent audit records throughout controllers.

---

# 105. Audit Privacy

Never include:

```text
password hashes

refresh tokens

access tokens

push provider credentials
```

in before/after JSON.

---

# 106. Pagination

Admin list APIs must use pagination.

Query:

```text
?page=1
&limit=25
```

Set a maximum limit.

Example:

```text
max = 100
```

Do not allow:

```text
limit=1000000
```

---

# 107. Filtering

Example:

```text
GET /admin/users
?search=...
&status=active
&page=1
```

Workout plans:

```text
?status=active
&search=...
```

Exercise library:

```text
?muscleGroup=...
&equipment=...
&trackingType=...
```

---

# 108. Sorting

Whitelist sortable columns.

Do not directly insert client strings into SQL:

```text
ORDER BY ${query.sort}
```

Map:

```text
createdAt → created_at

name → name
```

through a whitelist.

---

# 109. SQL Security

All values must use parameterized queries.

Never:

```text
"SELECT * FROM users WHERE email = '" + email + "'"
```

Use prepared values.

---

# 110. Database Index Review

Indexes should correspond to actual access patterns such as:

```text
user + date

user + status + date

plan + version

assignment effective dates

notification status + scheduled time

daily task status + due time

exercise history
```

Do not add indexes indiscriminately.

---

# 111. Query Performance Requirements

Common endpoints such as:

```text
/me/today
```

should avoid N+1 queries.

Prefer:

```text
small number of purposeful queries
```

over:

```text
one query per meal
one query per exercise
one query per set
```

---

# 112. Timezone Rules

Database timestamps:

```text
UTC
```

User configuration:

```text
IANA timezone
```

Example:

```text
Asia/Beirut
```

User dates such as:

```text
2026-08-30
```

represent the user's local calendar day.

---

# 113. Timezone Utility

Create shared service:

```text
UserDateService
```

Methods:

```text
getCurrentLocalDate(timezone)

localDateTimeToUtc()

utcToUserLocal()

startOfUserDayUtc()

endOfUserDayUtc()
```

Avoid timezone calculations scattered throughout modules.

---

# 114. Security Middleware Order

Recommended order:

```text
Request ID

Security Headers

CORS

Rate Limit

Authentication

Authorization

Route Validation

Controller

Error Handler
```

---

# 115. CORS

Only the React admin needs browser CORS.

Allow configured dashboard origins.

Do not use unrestricted production:

```text
*
```

for authenticated browser APIs.

Flutter native networking isn't governed by browser CORS.

---

# 116. Rate Limiting

Stricter limits:

```text
/login

/forgot-password

/reset-password
```

Normal authenticated API:

higher reasonable limits.

Notification/device registration endpoints should also be protected against abuse.

---

# 117. Request Size Limits

Set reasonable request body maximum.

Workout set logging and meal logging should never require huge JSON requests.

Reject excessive payloads.

---

# 118. Health Endpoints

Basic:

```text
GET /api/v1/health
```

Response:

```json
{
  "status": "healthy"
}
```

Readiness:

```text
GET /api/v1/health/ready
```

Checks database connectivity.

---

# 119. Metrics

Eventually track:

```text
request duration

error rate

database latency

notification failures

worker backlog

daily task failures
```

Do not expose internal metrics publicly without protection.

---

# 120. Testing Architecture

Testing is part of every backend phase.

Folders:

```text
tests/
├── unit/
├── integration/
├── api/
├── security/
└── fixtures/
```

---

# 121. Unit Tests

Test service logic without HTTP.

Examples:

```text
Weight progress formula

7-day average

Water adherence

Cardio adherence

Meal selection validation

Assignment overlap

Reminder eligibility

Daily task generation

Notification deduplication
```

---

# 122. Repository Integration Tests

Use a test MySQL database.

Test:

```text
foreign keys

transactions

unique constraints

repository queries

effective-date lookup

pagination
```

Do not mock the database for these tests.

---

# 123. API Tests

Test full request lifecycle.

Example:

```text
login

create user

create workout

publish version

assign workout

resolve today

start workout

record set

complete workout

retrieve progress
```

---

# 124. Authorization Tests

Mandatory cases:

```text
User A cannot retrieve User B data

User A cannot modify User B data

User cannot call admin API

Disabled user cannot authenticate

Invalid token is rejected

Expired token is rejected

Revoked refresh token fails
```

---

# 125. Critical Workout Tests

Test:

```text
published plan cannot change

draft can change

only published version can be assigned

session snapshots configuration

historical workout survives configuration changes

duplicate workout session prevented

sets persist correctly
```

---

# 126. Critical Diet Tests

Test:

```text
option belongs to group

group belongs to meal

meal belongs to assigned version

minimum selections

maximum selections

published diet immutable

historical meal retains snapshots
```

---

# 127. Notification Tests

Test:

```text
missed task creates notification

same task does not duplicate notification

quiet hours honored

disabled category ignored

push disabled but in-app enabled

delivery failure retries
```

---

# 128. Idempotency Tests

Send same operation twice:

```text
POST water +500
```

with same key.

Expected:

```text
one water entry
```

not two.

---

# 129. Development Fixtures

Fixtures should provide generic test data.

Examples:

```text
Admin User

Regular User

Workout Plan

Diet Plan

Exercise

Weight Goal
```

These are test fixtures, not production personal seed data.

---

# 130. Migration Strategy

Use numbered migrations.

Example:

```text
001_roles_users.sql
002_auth_sessions.sql
003_reference_data.sql
004_exercises.sql
005_workout_plans.sql
006_diet_plans.sql
007_assignments.sql
008_targets.sql
009_reminders.sql
010_daily_tasks.sql
011_tracking.sql
012_notifications.sql
013_progress.sql
014_idempotency.sql
015_audit.sql
016_views.sql
```

---

# 131. Migration Requirements

Every migration must have:

```text
migration number

description

forward operation
```

Production migrations are never silently edited after deployment.

Create a new migration instead.

---

# 132. Seed Policy

Production configuration should not depend on personal seed data.

Seeds may include:

```text
roles

basic reference units

generic muscle groups

test/demo data only in non-production environments
```

Actual workout and diet plans are entered through the admin dashboard.

---

# 133. API Documentation

Every endpoint needs:

```text
Description

Authentication

Permission

Request parameters

Request body

Success response

Validation errors

Business errors
```

---

# 134. Backend Implementation Phases

The backend should be implemented in clearly separated phases.

---

# PHASE B0 — Project Foundation

Build:

```text
Node project

TypeScript

Fastify

linting

formatting

test runner

environment validation

logger

health route
```

## Deliverables

```text
npm run dev

npm run build

npm run test

npm run lint
```

must work.

## Exit Criteria

* Server starts.
* TypeScript strict mode passes.
* Health endpoint works.
* Environment validation works.
* Global errors work.
* Logging works.

---

# PHASE B1 — Database Foundation

Implement:

```text
MySQL pool

transaction helper

migration runner

migration history

schema

test database
```

## Exit Criteria

From empty MySQL:

```text
npm run db:migrate
```

creates the entire database.

Integration tests can rebuild the test database.

---

# PHASE B2 — Authentication

Implement:

```text
users

roles

password hashing

login

access tokens

refresh rotation

logout

authentication middleware

authorization middleware
```

## Exit Criteria

Admin and normal users can authenticate.

Unauthorized requests fail correctly.

---

# PHASE B3 — User Management

Implement:

```text
Admin user list

Create user

Edit user

Disable user

Enable user

Current user profile
```

## Exit Criteria

React dashboard can completely manage users through API.

---

# PHASE B4 — Exercise Library

Implement:

```text
muscle groups

equipment

exercises

filtering

search

archive
```

## Exit Criteria

Admin can build a reusable exercise catalog.

---

# PHASE B5 — Workout Plan Core

Implement:

```text
workout plans

versions

days

exercises

per-set targets

ordering
```

## Exit Criteria

A workout can be built entirely through REST APIs.

---

# PHASE B6 — Workout Publishing

Implement:

```text
draft validation

publishing

immutability

version duplication

audit
```

## Exit Criteria

Published workouts cannot be edited.

---

# PHASE B7 — Diet Plan Core

Implement:

```text
food library

diet plans

versions

meals

option groups

options

ordering
```

## Exit Criteria

A complete diet can be represented entirely through configuration.

---

# PHASE B8 — Diet Publishing

Implement:

```text
validation

publishing

immutability

version duplication

audit
```

---

# PHASE B9 — Assignments

Implement:

```text
workout assignment

diet assignment

effective dates

overlap detection

assignment history
```

## Exit Criteria

Different users can have different active plans.

---

# PHASE B10 — Goals & Targets

Implement:

```text
weight goals

water targets

water quick-add values

cardio targets

cardio weekdays

adherence configuration
```

---

# PHASE B11 — Daily Plan Engine

Implement:

```text
timezone resolution

today endpoint

active assignment resolution

meal resolution

workout resolution

water/cardio/weight requirements

daily task materialization
```

## Exit Criteria

Calling:

```text
GET /api/v1/me/today
```

fully describes today's user experience.

This is a major milestone.

---

# PHASE B12 — Weight & Water Tracking

Implement:

```text
weight CRUD

water entries

water totals

task completion

daily summary recalculation
```

---

# PHASE B13 — Meal Tracking

Implement:

```text
meal logs

selections

meal validation

partial/skipped states

daily task synchronization
```

---

# PHASE B14 — Workout Execution

Implement:

```text
start workout

session snapshots

exercise sessions

sets

complete workout

skip workout

previous performance
```

## Exit Criteria

Flutter can perform and save a complete workout.

This is another major milestone.

---

# PHASE B15 — Cardio Tracking

Implement:

```text
cardio logging

target comparison

history

daily task completion
```

---

# PHASE B16 — Progress Engine

Implement:

```text
weight progress

weight averages

goal progress

nutrition adherence

workout adherence

water adherence

cardio adherence

overall adherence

exercise progression
```

---

# PHASE B17 — Daily & Periodic Analytics

Implement:

```text
daily summaries

weekly progress

monthly progress

snapshots

admin user analytics
```

---

# PHASE B18 — Reminder Engine

Implement:

```text
reminder rules

weekday applicability

fixed-time rules

relative rules

interval rules

quiet hours
```

---

# PHASE B19 — Missed Task Engine

Implement:

```text
overdue detection

missed state

notification generation

deduplication
```

---

# PHASE B20 — Notification Delivery

Implement:

```text
in-app notifications

device registration

push abstraction

push worker

delivery status

retry
```

---

# PHASE B21 — Offline / Idempotency

Implement:

```text
Idempotency-Key

stored operation responses

safe retries

concurrency conflict handling
```

## Exit Criteria

Flutter can safely retry mutations after losing connectivity.

---

# PHASE B22 — Audit & Administration

Implement:

```text
audit service

audit queries

admin audit API
```

---

# PHASE B23 — Security Hardening

Review:

```text
CORS

headers

rate limits

password rules

token expiration

refresh rotation

request limits

SQL parameterization

authorization coverage

logging privacy
```

---

# PHASE B24 — Performance Hardening

Analyze:

```text
/me/today

user analytics

workout history

weight history

notification workers
```

Use:

```text
EXPLAIN ANALYZE
```

where appropriate.

Review indexes based on actual production-like query patterns.

---

# PHASE B25 — Complete Automated Test Suite

Required:

```text
unit

integration

API

security

business workflows
```

Critical workflows must be covered end-to-end.

---

# PHASE B26 — Production Readiness

Implement:

```text
production environment

graceful shutdown

health checks

logging

worker deployment

migration deployment process

database backups

monitoring

alerting
```

---

# 135. Critical End-to-End Backend Scenario

Before declaring V1 ready, this entire scenario must work automatically:

```text
ADMIN LOGIN
      ↓
CREATE USER
      ↓
CREATE EXERCISES
      ↓
CREATE WORKOUT
      ↓
CREATE WORKOUT VERSION
      ↓
CONFIGURE DAYS
      ↓
CONFIGURE EXERCISES
      ↓
PUBLISH
      ↓
CREATE DIET
      ↓
CONFIGURE MEALS
      ↓
CONFIGURE OPTIONS
      ↓
PUBLISH
      ↓
ASSIGN BOTH TO USER
      ↓
CONFIGURE WEIGHT GOAL
      ↓
CONFIGURE WATER TARGET
      ↓
CONFIGURE CARDIO TARGET
      ↓
USER LOGIN
      ↓
GET TODAY
      ↓
LOG WEIGHT
      ↓
LOG WATER
      ↓
LOG MEALS
      ↓
START WORKOUT
      ↓
LOG EVERY SET
      ↓
COMPLETE WORKOUT
      ↓
LOG CARDIO
      ↓
CALCULATE DAILY ADHERENCE
      ↓
CALCULATE WEIGHT PROGRESS
      ↓
VIEW WEEKLY PROGRESS
```

No manual database manipulation should be required.

---

# 136. Critical Reminder Scenario

This scenario must also work:

```text
Meal scheduled for 13:00
      ↓
Grace period expires
      ↓
Meal not logged
      ↓
Daily task becomes overdue
      ↓
Missed-task worker detects it
      ↓
Notification dedupe key generated
      ↓
In-app notification created
      ↓
Push delivery created
      ↓
User receives notification
      ↓
User opens meal screen
      ↓
Logs meal
      ↓
Task updates
```

---

# 137. Critical Offline Scenario

```text
Flutter loses internet
      ↓
User enters +500 ml water
      ↓
Flutter stores locally
      ↓
Internet returns
      ↓
Flutter sends request with Idempotency-Key
      ↓
Backend creates one water event
      ↓
Response is saved for operation
      ↓
Flutter accidentally retries
      ↓
Backend returns original response
      ↓
No duplicate water
```

---

# 138. Backend Definition of MVP

Backend MVP requires:

1. Authentication
2. Admin users
3. Exercise library
4. Workout configuration
5. Workout versions
6. Workout publishing
7. Diet configuration
8. Diet versions
9. Diet publishing
10. Assignments
11. Weight goals
12. Water targets
13. Cardio targets
14. `/me/today`
15. Weight logging
16. Water logging
17. Meal logging
18. Workout sessions
19. Set logging
20. Cardio logging
21. Basic progress
22. Authorization tests

Once this exists, both React and Flutter can support the core product.

---

# 139. Full Backend V1 Definition

Full V1 additionally requires:

1. Daily tasks
2. Adherence
3. Weekly analytics
4. Monthly analytics
5. Strength progression
6. Reminder engine
7. Missed tasks
8. In-app notifications
9. Push notifications
10. Notification preferences
11. Quiet hours
12. Idempotency
13. Flutter offline support API
14. Audit logs
15. Full security suite
16. Performance review
17. Background workers
18. Production health/readiness
19. Monitoring
20. Backups

---

# 140. Recommended Implementation Order

The actual coding order should be:

```text
1. Backend bootstrap

2. Database migration system

3. Authentication

4. User management

5. Exercise library

6. Workout configuration

7. Workout version publishing

8. Diet configuration

9. Diet version publishing

10. Plan assignments

11. Goals / Water / Cardio Targets

12. Daily Plan Engine

13. Weight Tracking

14. Water Tracking

15. Meal Tracking

16. Workout Execution

17. Cardio Tracking

18. Progress Engine

19. Daily Summaries

20. Analytics

21. Reminder Engine

22. Missed Task Engine

23. Notification Center

24. Push Delivery

25. Idempotency / Offline Sync

26. Audit

27. Security Hardening

28. Performance Hardening

29. Full Testing

30. Production Deployment
```

---

# 141. Most Important Backend Milestones

## Milestone 1 — Configuration Backend

Admin can configure:

```text
Exercises

Workout Plans

Diet Plans
```

without database or source-code changes.

---

## Milestone 2 — Assignment Backend

Admin can assign:

```text
Diet

Workout

Weight Goal

Water Target

Cardio Target
```

to any user.

---

## Milestone 3 — Daily Plan Backend

```text
GET /api/v1/me/today
```

correctly resolves the entire user's day.

---

## Milestone 4 — Tracking Backend

Flutter can log:

```text
Weight

Water

Meals

Workout Sets

Cardio
```

---

## Milestone 5 — Progress Backend

The server can calculate:

```text
Weight trend

Goal progress

Workout progression

Nutrition adherence

Water adherence

Cardio adherence

Overall adherence
```

---

## Milestone 6 — Notification Backend

The server knows:

```text
What should have happened?

When should it have happened?

Did the user do it?

Should we remind them?
```

---

## Milestone 7 — Production Backend

System is:

```text
Secure

Tested

Observable

Backed up

Deployable

Recoverable
```

---

# 142. Backend Rules That Must Never Be Broken

### Rule 1

Flutter never directly accesses MySQL.

### Rule 2

React never directly accesses MySQL.

### Rule 3

Clients never decide authorization.

### Rule 4

Published plan versions are historical records.

### Rule 5

Configuration changes must not rewrite history.

### Rule 6

User IDs for self-service come from authentication.

### Rule 7

Every external request is validated.

### Rule 8

Every multi-table critical write uses a transaction.

### Rule 9

Offline retries must be idempotent.

### Rule 10

Official progress calculations happen server-side.

### Rule 11

Time-sensitive logic uses the user's timezone.

### Rule 12

Notifications must be deduplicated.

### Rule 13

Business logic belongs in services, not controllers.

### Rule 14

SQL belongs in repositories, not routes.

### Rule 15

Admin-created workout/diet content comes from configuration, never source code.

---

# 143. Final Backend Architecture

```text
                 ┌───────────────────────┐
                 │     React Admin       │
                 └───────────┬───────────┘
                             │
                             │
┌────────────────┐           │           ┌────────────────┐
│ Flutter Mobile │───────────┼───────────│ Future Clients │
└───────┬────────┘           │           └────────────────┘
        │                    │
        └────────────┬───────┘
                     │
              REST /api/v1
                     │
        ┌────────────▼────────────┐
        │        Fastify          │
        │                         │
        │ Routes                  │
        │ Authentication          │
        │ Authorization           │
        │ Validation              │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │       Services          │
        │                         │
        │ Business Rules          │
        │ Transactions            │
        │ Plan Resolution         │
        │ Progress                │
        │ Reminders               │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │      Repositories       │
        │                         │
        │ Parameterized SQL       │
        │ Queries                 │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │         MySQL           │
        │                         │
        │ Configuration           │
        │ History                 │
        │ Tracking                │
        │ Analytics               │
        └─────────────────────────┘

                Background Worker
                       │
        ┌──────────────┼─────────────┐
        │              │             │
     Reminders      Analytics     Push Delivery
```

---

# 144. Final Backend Objective

The backend is complete when it can answer these questions without help from React or Flutter:

```text
Who is this user?

What are they allowed to do?

What diet are they assigned?

What workout are they assigned?

What should they do today?

What have they eaten today?

How much water have they consumed?

What workout did they perform?

What weight and reps did they use?

How much cardio did they perform?

What is their current body weight?

Are they progressing toward their goal?

How adherent were they today?

What have they missed?

Should they receive a reminder?

What should the admin see about their progress?
```

If Node.js can authoritatively answer all of those questions, the backend architecture is doing its job.

---

# 145. Final Implementation Principle

Development should follow:

```text
DATABASE
    ↓
REPOSITORY
    ↓
SERVICE
    ↓
API CONTRACT
    ↓
CONTROLLER
    ↓
REACT / FLUTTER
```

Not:

```text
BUILD SCREEN
    ↓
GUESS DATA
    ↓
CREATE RANDOM API
    ↓
PATCH DATABASE
```

The backend must be deliberately designed as the stable foundation of the entire platform.

The highest-priority first deliverable after project bootstrap should therefore be:

```text
Authentication
      +
Exercise Library
      +
Workout Configuration
      +
Workout Versioning
      +
Workout Publishing
```

because once the React dashboard can create an entirely new workout and publish it **without any source-code modification**, the most important configuration-driven requirement of the platform has been proven.
