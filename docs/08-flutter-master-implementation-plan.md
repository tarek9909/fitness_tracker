# Fitness Tracking Platform

# Master Flutter Application Implementation Plan

**Application:** User Mobile Application
**Framework:** Flutter
**Language:** Dart
**Backend:** Node.js REST API
**Database Access:** Through API only
**Authentication:** Access Token + Refresh Session
**Architecture:** Feature-first, offline-capable mobile application
**API Version:** `/api/v1`
**Primary User:** Fitness platform user

---

# 1. Flutter Application Mission

The Flutter application is the daily execution interface of the platform.

Its purpose is to allow users to:

* Log in securely
* View today's fitness plan
* Record body weight
* Record meals
* Select foods consumed
* Record water intake
* Record workout performance
* Record weight used during exercises
* Record repetitions
* Record cardio
* View progress
* View weight trends
* View strength progression
* View adherence
* Receive reminders
* Receive missed-task notifications
* View notification history
* Work temporarily without internet
* Synchronize data when connectivity returns

The Flutter application must not:

* Connect directly to MySQL
* Hard-code workout plans
* Hard-code diet plans
* Calculate authoritative progress independently
* Decide user authorization
* Decide which plan is active
* Decide whether a task is officially missed

Those responsibilities belong to the backend.

---

# 2. Core Mobile Architecture Principle

The Flutter application follows:

```text
BACKEND CONFIGURATION
        ↓
TODAY API
        ↓
FLUTTER DISPLAYS PLAN
        ↓
USER RECORDS ACTIVITY
        ↓
LOCAL SAVE
        ↓
API SYNCHRONIZATION
        ↓
BACKEND VALIDATES
        ↓
BACKEND CALCULATES PROGRESS
        ↓
FLUTTER DISPLAYS RESULT
```

---

# 3. Main Architectural Layers

The Flutter app should have four conceptual layers:

```text
Presentation
     ↓
Domain
     ↓
Data
     ↓
Infrastructure
```

## Presentation

Contains:

* Screens
* Widgets
* State
* Navigation

## Domain

Contains:

* Entities
* Use cases
* Business-facing interfaces

## Data

Contains:

* API models
* Repository implementations
* Local persistence models

## Infrastructure

Contains:

* HTTP
* Secure storage
* Local database
* Connectivity
* Notifications
* Synchronization

---

# 4. Repository Position

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
mobile-app/
```

---

# 5. Recommended Flutter Folder Structure

```text
mobile-app/
│
├── lib/
│   │
│   ├── app/
│   │   ├── app.dart
│   │   ├── bootstrap.dart
│   │   ├── router.dart
│   │   ├── routes.dart
│   │   └── app_lifecycle.dart
│   │
│   ├── core/
│   │   │
│   │   ├── api/
│   │   │   ├── api_client.dart
│   │   │   ├── api_exception.dart
│   │   │   ├── api_response.dart
│   │   │   ├── auth_interceptor.dart
│   │   │   └── retry_policy.dart
│   │   │
│   │   ├── auth/
│   │   │   ├── auth_session.dart
│   │   │   ├── auth_manager.dart
│   │   │   └── token_manager.dart
│   │   │
│   │   ├── database/
│   │   │   ├── app_database.dart
│   │   │   ├── tables/
│   │   │   └── migrations/
│   │   │
│   │   ├── storage/
│   │   │   ├── secure_storage.dart
│   │   │   └── preferences_storage.dart
│   │   │
│   │   ├── connectivity/
│   │   │   └── connectivity_service.dart
│   │   │
│   │   ├── sync/
│   │   │   ├── sync_manager.dart
│   │   │   ├── sync_queue.dart
│   │   │   ├── sync_operation.dart
│   │   │   └── sync_status.dart
│   │   │
│   │   ├── notifications/
│   │   │   ├── notification_service.dart
│   │   │   ├── push_service.dart
│   │   │   ├── local_notification_service.dart
│   │   │   └── notification_router.dart
│   │   │
│   │   ├── errors/
│   │   │   ├── app_error.dart
│   │   │   ├── error_mapper.dart
│   │   │   └── error_codes.dart
│   │   │
│   │   ├── theme/
│   │   │   ├── app_theme.dart
│   │   │   ├── spacing.dart
│   │   │   └── typography.dart
│   │   │
│   │   ├── constants/
│   │   │
│   │   └── utils/
│   │       ├── dates.dart
│   │       ├── numbers.dart
│   │       ├── validators.dart
│   │       └── formatting.dart
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── home/
│   │   ├── daily_plan/
│   │   ├── weight/
│   │   ├── water/
│   │   ├── diet/
│   │   ├── workout/
│   │   ├── cardio/
│   │   ├── progress/
│   │   ├── notifications/
│   │   ├── history/
│   │   └── profile/
│   │
│   └── main.dart
│
├── test/
│   ├── unit/
│   ├── widget/
│   └── fixtures/
│
├── integration_test/
│
├── android/
├── ios/
│
├── assets/
│
├── pubspec.yaml
└── README.md
```

---

# 6. Feature Folder Structure

Each feature should follow a consistent pattern.

Example:

```text
features/workout/
│
├── data/
│   ├── models/
│   ├── data_sources/
│   ├── repositories/
│   └── mappers/
│
├── domain/
│   ├── entities/
│   ├── repositories/
│   └── use_cases/
│
└── presentation/
    ├── screens/
    ├── widgets/
    └── state/
```

This should be repeated for major features.

---

# 7. State Management

Choose one consistent state-management approach.

The architecture should support:

* Async API loading
* Local database loading
* Optimistic updates
* Error states
* Refresh
* Offline state
* Auth state
* Notification state

Avoid mixing multiple state-management paradigms unnecessarily.

---

# 8. Dependency Injection

Centralize dependencies.

Examples:

```text
ApiClient

SecureStorage

Database

AuthRepository

DailyPlanRepository

WorkoutRepository

SyncManager

NotificationService
```

Screens should not construct API clients directly.

---

# 9. API Contract

Flutter should use:

```text
contracts/openapi/openapi.yaml
```

as the API reference.

Generated API models/clients may be used if they fit the project cleanly.

Do not manually invent backend response structures.

---

# 10. API Base Configuration

Use environment-specific configuration:

```text
Development
Staging
Production
```

Example conceptual values:

```text
DEV_API_URL

STAGING_API_URL

PRODUCTION_API_URL
```

Never scatter URLs across source files.

---

# 11. Flutter Environments

Support:

```text
development

staging

production
```

Each environment may have:

* API base URL
* App name
* Logging level
* Push notification configuration

---

# 12. Application Startup

Startup sequence:

```text
Initialize Flutter
      ↓
Load Environment
      ↓
Initialize Local Database
      ↓
Initialize Secure Storage
      ↓
Initialize Notifications
      ↓
Initialize API Client
      ↓
Restore Authentication
      ↓
Initialize Sync Manager
      ↓
Start Application
```

---

# 13. Authentication Feature

Feature:

```text
features/auth/
```

Responsibilities:

* Login
* Session restoration
* Token refresh
* Logout
* Authentication failure
* Disabled account
* Expired session

---

# 14. Login Screen

Fields:

```text
Email

Password
```

States:

```text
Idle

Loading

Invalid Credentials

Disabled Account

Network Error

Success
```

---

# 15. Login Flow

```text
User enters credentials
      ↓
POST /api/v1/auth/login
      ↓
Receive access + refresh session
      ↓
Store sensitive session securely
      ↓
Load /api/v1/me
      ↓
Enter application
```

---

# 16. Secure Storage

Store sensitive data such as:

```text
refresh token

session identifier
```

in secure platform storage.

Do not store:

```text
plain password
```

after authentication.

---

# 17. Access Token Management

Access tokens should be managed centrally.

Screens should never manually retrieve or attach tokens.

The API client/interceptor handles authentication.

---

# 18. Refresh Flow

If API returns an authentication-expiration response:

```text
Request
   ↓
401 token expired
   ↓
Refresh session
   ↓
Success?
 ↙       ↘
YES      NO
 ↓        ↓
Retry   Logout
```

Only one refresh should occur at a time.

Concurrent API requests should not trigger many refresh requests.

---

# 19. Logout

Logout should:

```text
Call backend logout
      ↓
Clear secure session
      ↓
Clear private local cache if required
      ↓
Stop synchronization
      ↓
Return to login
```

---

# 20. Navigation Architecture

Recommended bottom navigation:

```text
Home

Plan

Progress

Notifications

Profile
```

---

# 21. Main Routes

Conceptually:

```text
/login

/home

/plan

/plan/diet

/plan/workout

/weight

/water

/cardio

/progress

/progress/weight

/progress/workout

/notifications

/profile
```

---

# 22. Deep Linking

Notifications should support deep links.

Examples:

```text
fitness://meal/123

fitness://workout/today

fitness://water

fitness://weight

fitness://cardio
```

Tapping a notification should open the appropriate feature.

---

# 23. Home Screen Mission

The Home screen is the user's daily command center.

It should primarily be driven by:

```text
GET /api/v1/me/today
```

The backend decides what belongs in today's plan.

---

# 24. Home Screen Structure

Recommended:

```text
Greeting

Today's Progress

Weight Card

Nutrition Card

Workout Card

Cardio Card

Water Card

Missed Tasks

Today's Task List
```

---

# 25. Home Example

```text
Good Morning

TODAY'S PROGRESS

████████░░ 80%

Weight
104.8 kg

Nutrition
6 / 8

Workout
Lower

Cardio
25 / 30 min

Water
2.2 / 3.0 L

Needs Attention
2 Tasks
```

---

# 26. Daily Plan Feature

Feature:

```text
features/daily_plan/
```

Responsibilities:

* Load today's authoritative plan
* Refresh
* Cache locally
* Display task state
* Navigate to task feature
* Update after mutations

---

# 27. Daily Plan API

Primary:

```text
GET /api/v1/me/today
```

Optional historical:

```text
GET /api/v1/me/days/:date
```

---

# 28. Daily Plan Local Cache

Cache latest plan so the user can still open the app during temporary connectivity loss.

Store:

```text
date

meals

workout

water target

cardio target

weight task

task statuses
```

The backend remains authoritative when synchronization resumes.

---

# 29. Refresh Strategy

Refresh daily plan when:

```text
App opens

User manually refreshes

App resumes after long background

Weight logged

Meal logged

Water logged

Workout completed

Cardio logged

Notification action completes a task
```

Avoid reloading the entire home screen after every tiny interaction if local state can update immediately.

---

# 30. Weight Feature

Feature:

```text
features/weight/
```

Responsibilities:

* Enter weight
* Edit today's weight
* Display history
* Display trend
* Sync offline

---

# 31. Weight Screen

Example:

```text
Today's Weight

[ 104.8 ] kg

Save
```

Below:

```text
Yesterday
105.0 kg

7-Day Average
105.3 kg

Target
95 kg
```

---

# 32. Weight Validation

Client validation:

```text
20–500 kg
```

Backend remains authoritative.

---

# 33. Weight Offline Behavior

If offline:

```text
Enter Weight
     ↓
Save Locally
     ↓
Mark Pending Sync
     ↓
Update UI
```

Once online:

```text
Sync
     ↓
Server validates
```

---

# 34. Water Feature

Feature:

```text
features/water/
```

Responsibilities:

* Show target
* Show current total
* Quick add
* Custom amount
* Delete entry
* History
* Offline logging

---

# 35. Water UX

Main display:

```text
Water

2,250 / 3,000 ml

750 ml remaining
```

Quick actions:

```text
+250

+500

+750

+1000

Custom
```

---

# 36. Optimistic Water Updates

When user presses:

```text
+500 ml
```

UI should update immediately.

Then:

```text
save local operation
      ↓
send to API
```

If API fails permanently:

* Mark sync error
* Allow retry
* Correct total if needed

---

# 37. Water Entry History

Show:

```text
08:00    500 ml

10:30    250 ml

12:45    500 ml
```

Allow deleting an incorrect entry.

---

# 38. Diet Feature

Feature:

```text
features/diet/
```

Responsibilities:

* Today's meals
* Meal schedule
* Option groups
* Food choices
* Completion
* Partial completion
* Skip
* Notes
* History
* Offline support

---

# 39. Diet Home

Example:

```text
Today's Meals

09:00 Breakfast      Completed

11:00 Snack          Completed

13:00 Lunch          Pending

15:00 Snack          Pending
```

---

# 40. Meal Detail

Example:

```text
Breakfast

Carbohydrate
Choose 1

○ French Bread
○ Oat Bread
○ Potato

Protein
Choose 1

○ Eggs
○ Cheese
○ Labneh
○ Turkey
```

The actual options come from backend configuration.

---

# 41. Meal Group Rules

Flutter should display:

```text
Choose exactly 1

Choose at least 1

Choose up to 3

Optional
```

based on backend values:

```text
minSelectionCount

maxSelectionCount

isRequired
```

---

# 42. Meal Client Validation

Before submit:

* Required groups satisfied
* Maximum selections not exceeded
* No invalid duplicates

Backend validates again.

---

# 43. Meal Completion States

Support:

```text
Completed

Partial

Skipped
```

Pending is implicit before logging.

---

# 44. Meal Logging Flow

```text
Open Meal
    ↓
Select Choices
    ↓
Choose Status
    ↓
Save Locally
    ↓
Update UI
    ↓
Send API
    ↓
Backend Validates
    ↓
Refresh Daily Progress
```

---

# 45. Diet History

Allow browsing:

```text
Today

Yesterday

Previous Days
```

Show what was selected historically.

Do not rebuild old meals from the current plan configuration.

Use historical server data.

---

# 46. Workout Feature

Feature:

```text
features/workout/
```

This is one of the most important features in the application.

Responsibilities:

* Today's workout
* Start workout
* Workout exercises
* Previous performance
* Set logging
* Weight
* Reps
* Duration/distance depending on type
* Exercise completion
* Workout completion
* Offline persistence
* Session recovery

---

# 47. Workout Landing Screen

Example:

```text
Today's Workout

Lower

6 Exercises

Estimated exercises:
Leg Press
Leg Curl
Bulgarian Split Squat
...

[ Start Workout ]
```

---

# 48. Start Workout Flow

```text
Tap Start
     ↓
POST /api/v1/me/workouts/start
     ↓
Receive Workout Session Snapshot
     ↓
Save Session Locally
     ↓
Open Workout Screen
```

If offline and the workout plan was previously cached, offline start may be supported later with appropriate local IDs.

For MVP, online start is acceptable if required.

Full V1 should support offline workout execution.

---

# 49. Workout Session Screen

Recommended layout:

```text
Lower

1 / 6

Leg Press

Target
4 × 8–12

Previous
100 × 12
100 × 11
105 × 10
105 × 9

TODAY

Set 1
Weight [      ]
Reps   [      ]
Set 2
...
```

---

# 50. Workout Exercise Navigation

Allow:

```text
Previous Exercise

Next Exercise

Exercise List
```

Users should be able to move between exercises without losing set data.

---

# 51. Set Logging

For `weight_reps`:

```text
Weight

Reps

Set Type

Notes
```

---

# 52. Set Types

Support:

```text
Warmup

Working

Drop

Backoff

Other
```

Default:

```text
Working
```

---

# 53. Dynamic Workout Input

Input fields depend on tracking type.

## Weight + Reps

```text
Weight
Reps
```

## Reps Only

```text
Reps
```

## Duration

```text
Duration
```

## Distance

```text
Distance
Duration optional
```

## Weight + Duration

```text
Weight
Duration
```

---

# 54. Previous Performance

The workout UI should display recent relevant history.

Example:

```text
Previous Session

105 kg × 12
105 kg × 11
110 kg × 8
```

This data comes from backend endpoint.

---

# 55. Previous Performance Loading

Do not block the entire workout screen if previous performance fails to load.

The current workout can remain usable.

Show history as supplementary data.

---

# 56. Workout Autosave

Workout input should persist locally immediately.

Example:

```text
User enters 100 kg × 12
       ↓
Local DB Save
       ↓
UI marks saved locally
       ↓
Sync to backend
```

This protects users from losing workout data.

---

# 57. Workout Sync Status

Possible subtle UI states:

```text
Saved

Syncing

Offline

Sync Error
```

Do not interrupt the workout with excessive dialogs.

---

# 58. Workout Completion

Tap:

```text
Complete Workout
```

Then validate local required data.

Confirm:

```text
Complete workout?
```

Submit to backend.

On success:

```text
Workout Completed
```

Show summary.

---

# 59. Workout Summary

Example:

```text
Workout Completed

Duration
58 min

Exercises
6 / 6

Working Sets
17

Total Volume
X kg
```

Volume is only shown where meaningful.

---

# 60. Workout Recovery

If application closes during workout:

```text
App Reopens
     ↓
Detect Active Session
     ↓
Resume Workout?
```

The user should not lose the session.

---

# 61. Cardio Feature

Feature:

```text
features/cardio/
```

Responsibilities:

* Display target
* Record session
* Duration
* Speed
* Incline
* Distance
* Calories optional
* Notes
* History
* Offline logging

---

# 62. Cardio Screen

Example:

```text
Today's Cardio

Target
25–30 min

Activity
Treadmill

Duration
[ 28 ]

Speed
[ 5.5 ]

Incline
[ 12 ]

Save
```

Actual fields depend on backend activity configuration.

---

# 63. Cardio Completion

After save:

```text
28 / 30 min

Target minimum achieved
```

Use backend-computed completion values after sync.

---

# 64. Progress Feature

Feature:

```text
features/progress/
```

Responsibilities:

* Weight progress
* Goal progress
* Strength progression
* Water
* Cardio
* Diet adherence
* Overall adherence
* Weekly summary
* Monthly summary

---

# 65. Progress Home

Recommended sections:

```text
Overview

Weight

Strength

Nutrition

Water

Cardio
```

---

# 66. Progress Overview

Display:

```text
Current Weight

Starting Weight

Target Weight

Weight Lost

Remaining

Goal %

Weekly Adherence
```

---

# 67. Weight Progress Chart

Display:

```text
Daily Weight

7-Day Average

Target Line
```

The official averaged values should come from backend where available.

---

# 68. Strength Progress

Allow exercise selection:

```text
Exercise

Leg Press
```

Then display:

```text
Recent Weight

Best Weight

Rep Progression

Training Volume

Session History
```

---

# 69. Nutrition Progress

Show:

```text
Meals Expected

Completed

Partial

Skipped

Weekly Adherence
```

---

# 70. Water Progress

Show:

```text
Daily Intake

Target

Weekly Average

Completion %
```

---

# 71. Cardio Progress

Show:

```text
Minutes

Weekly Total

Target Completion

Session History
```

---

# 72. Notifications Feature

Feature:

```text
features/notifications/
```

Responsibilities:

* In-app notification list
* Unread count
* Read
* Dismiss
* Deep link navigation
* Push handling
* Notification preferences

---

# 73. Notification Center

Example:

```text
Notifications

Today

Lunch has not been logged

Water intake is below target

Today's workout is ready
```

---

# 74. Notification States

Support:

```text
Unread

Read

Dismissed
```

---

# 75. Notification Interaction

When tapped:

```text
Notification
     ↓
Read
     ↓
Resolve deep link
     ↓
Open relevant feature
```

Examples:

```text
Meal → Meal Detail

Workout → Workout Screen

Water → Water Screen

Weight → Weight Entry

Cardio → Cardio Screen
```

---

# 76. Push Notification Architecture

Push system flow:

```text
Backend
   ↓
Push Provider
   ↓
Device
   ↓
Flutter Handler
   ↓
Notification Router
   ↓
Relevant Screen
```

---

# 77. Push Device Registration

After successful login and notification permission:

```text
Device Push Token
      ↓
POST device registration
      ↓
Backend stores device
```

Update registration when token changes.

---

# 78. Local Notifications

Flutter may schedule local notifications where appropriate.

However:

> Missed-task decisions remain authoritative on the backend.

Local notifications should not invent task completion status.

---

# 79. Notification Permission UX

Do not request notification permission immediately without context.

Prefer:

```text
Explain benefit
     ↓
Ask permission
```

Example:

> Enable reminders for meals, water, workouts, and missed tasks.

---

# 80. Profile Feature

Feature:

```text
features/profile/
```

Display:

```text
Name

Email

Height

Timezone

Notification Settings

Logout
```

---

# 81. Profile Editing

Allow backend-permitted fields only.

Do not let user modify:

```text
assigned workout

assigned diet

admin-controlled targets
```

unless the product explicitly supports this later.

---

# 82. Notification Preferences

User may configure:

```text
Meal Reminders

Workout Reminders

Cardio Reminders

Water Reminders

Weight Reminders

Progress Notifications
```

Also:

```text
Push

In-App

Local
```

according to backend permissions.

---

# 83. Offline Architecture

Offline capability is a major part of Full V1.

Core principle:

```text
USER ACTION
     ↓
LOCAL DATABASE
     ↓
SYNC QUEUE
     ↓
API
     ↓
BACKEND
```

Do not design:

```text
User Action
     ↓
API
     ↓
Only then update UI
```

for every important tracking interaction.

---

# 84. Local Database

Use a proper local relational/data persistence solution.

Store:

```text
Daily Plan Cache

Workout Session

Workout Sets

Meal Logs

Water Entries

Weight

Cardio

Sync Queue

Notification Cache
```

---

# 85. What Should Be Cached Locally

Cache:

```text
Authenticated User Summary

Today's Plan

Recent Plans Required for Current Day

Active Workout Session

Recent Progress Summary

Notification List

Pending User Actions
```

Do not attempt to mirror the entire server database.

---

# 86. Sync Queue Structure

Each operation should contain:

```text
localId

clientOperationId

entityType

operationType

endpoint

payload

createdAt

status

attemptCount

lastAttemptAt

lastError
```

---

# 87. Sync Status

Use:

```text
pending

syncing

synced

failed
```

Possibly:

```text
conflict
```

for mutable-record conflicts.

---

# 88. Idempotency

Each offline mutation should generate a UUID:

```text
clientOperationId
```

Send as:

```text
Idempotency-Key
```

to backend.

Example:

```text
550e8400-e29b-41d4-a716-446655440000
```

---

# 89. Idempotent Water Example

Offline:

```text
+500 ml
```

Stored with:

```text
operationId = X
```

Then sent.

If app retries:

```text
same operationId
```

Backend returns original response.

No duplicate water entry is created.

---

# 90. Sync Priority

Suggested priority:

```text
1. Authentication-dependent changes

2. Active workout sets

3. Weight

4. Meals

5. Water

6. Cardio

7. Non-critical preferences
```

Exact implementation may vary.

---

# 91. Connectivity Changes

When connectivity returns:

```text
Connectivity Service
      ↓
Sync Manager
      ↓
Process Pending Queue
```

Avoid triggering many concurrent synchronization passes.

---

# 92. Sync Concurrency

Only one operation affecting the same logical record should sync at a time.

Workout sets should preserve local ordering.

---

# 93. Conflict Handling

Example:

```text
Local weight changed

Server weight changed independently
```

Backend may return:

```text
409 CONFLICT
```

Flutter should:

* Preserve local data
* Show conflict state
* Allow retry/resolution where needed

For simple append-only water entries, idempotency avoids most conflict issues.

---

# 94. Sync Failure Screen

Provide:

```text
Unsynced Data

3 items need attention
```

Allow:

```text
Retry All

Retry Item
```

Do not silently discard failed records.

---

# 95. Offline Indicator

When offline:

```text
Offline
Changes will sync automatically.
```

Use a small banner rather than blocking the user.

---

# 96. Error Architecture

Map backend errors into application errors.

Examples:

```text
NetworkError

UnauthorizedError

ForbiddenError

ValidationError

ConflictError

ServerError
```

---

# 97. Error Code Mapping

Backend:

```text
ASSIGNMENT_OVERLAP
```

is mostly admin-side.

Mobile-relevant examples:

```text
TOKEN_EXPIRED

RESOURCE_NOT_FOUND

WORKOUT_ALREADY_COMPLETED

TASK_ALREADY_COMPLETED

VALIDATION_ERROR

IDEMPOTENCY_CONFLICT
```

Handle based on code.

Do not parse message text.

---

# 98. User-Friendly Errors

Backend message:

```text
WORKOUT_ALREADY_COMPLETED
```

Mobile:

> This workout has already been completed.

Network:

> You're offline. Your changes are saved and will sync automatically.

---

# 99. Loading States

Every feature should support:

```text
Initial Loading

Refresh

Mutation

Offline Cached State
```

Do not show blank screens.

---

# 100. Empty States

Examples:

```text
No workout today.

Enjoy your recovery day.
```

```text
No notifications yet.
```

```text
No weight history yet.
```

---

# 101. Skeletons

Use skeleton/loading placeholders for:

```text
Home

Progress

History
```

where they improve perceived performance.

---

# 102. Optimistic Updates

Good candidates:

```text
Water add

Meal complete

Notification read

Notification dismiss
```

Workout sets are also local-first.

Weight can update locally first.

Rollback/reconcile if server rejects.

---

# 103. Pull to Refresh

Useful for:

```text
Home

Notifications

Progress

History
```

Refresh should not delete unsynced local data.

---

# 104. Date & Time Rules

User schedules are based on user timezone.

Flutter should display:

```text
09:00
```

as the plan's local schedule.

Server timestamps should be converted appropriately.

---

# 105. Midnight Handling

A user may keep the app open across midnight.

The application should detect local-day change.

Then:

```text
Invalidate previous today's plan
      ↓
Load new day
```

Do not continue showing yesterday indefinitely.

---

# 106. Day Change During Active Workout

If a workout starts before midnight and ends after midnight:

Keep the workout associated with the date/session established by backend.

Do not move it to the new day automatically.

---

# 107. App Lifecycle

Handle:

```text
Foreground

Background

Resumed

Terminated
```

On resume:

* Check auth validity
* Check day change
* Check pending sync
* Refresh notifications if appropriate

---

# 108. Keyboard UX

Workout and weight entry rely heavily on numeric input.

Use appropriate numeric keyboards.

Provide:

```text
Next

Done
```

navigation.

Do not force excessive tapping between set fields.

---

# 109. Workout Fast Entry

Workout logging must be extremely efficient.

Possible row:

```text
SET   KG      REPS

1     [100]   [12]

2     [100]   [11]     [2]
```

Users should be able to complete sets rapidly.

---

# 110. Copy Previous Set

Useful shortcut:

```text
Copy Previous
```

Example:

Set 2 prefilled with Set 1 weight.

Do not automatically submit copied values until user confirms/completes set.

---

# 111. Previous Workout Prefill

Optional later feature:

```text
Use Previous Weights
```

This may prefill targets locally.

It must never overwrite actual previous history.

---

# 112. Rest Timer

Optional but useful workout feature.

When completing a set:

```text
Rest Timer
```

may start based on configured rest seconds.

The timer is a client UX feature.

It does not need to be authoritative backend data.

---

# 113. Rest Timer Controls

Support:

```text
Pause

Skip

+30 sec
```

Do not block workout entry while timer runs.

---

# 114. Workout Session Duration

Track:

```text
startedAt

completedAt
```

Backend remains authoritative after sync.

Flutter may display live elapsed duration.

---

# 115. Accessibility

Minimum:

```text
Semantic labels

Large tap targets

Readable text

Contrast

Screen reader support

Keyboard accessibility where relevant

Dynamic text support
```

---

# 116. Localization Readiness

Even if V1 launches in one language, avoid hard-coded strings throughout widgets.

Structure for future:

```text
English

Arabic
```

is highly relevant for this product.

Use localization files from the beginning if practical.

---

# 117. RTL Readiness

If Arabic is planned, support RTL layouts.

Workout numeric fields should remain intuitive under RTL.

Test:

```text
English LTR

Arabic RTL
```

before Arabic release.

---

# 118. Units

Server stores canonical values such as:

```text
kg

ml

km
```

Flutter may later support display preferences.

For V1, canonical metric units are acceptable.

---

# 119. Charts

Charts should remain readable on mobile.

Avoid showing too many data series at once.

Weight:

```text
Daily Weight

7-Day Average
```

Workout:

```text
Load or volume trend
```

---

# 120. History Feature

Feature:

```text
features/history/
```

Possible categories:

```text
Weight

Meals

Workouts

Cardio

Water
```

Use pagination or date-based loading.

Do not download all historical records.

---

# 121. Workout History

Show:

```text
Date

Workout

Duration

Exercises
```

Tap:

```text
Workout Detail
```

Then display sets.

---

# 122. Meal History

Show:

```text
Date

Meal

Status

Selected Options
```

---

# 123. Water History

Show daily totals.

Optionally expand to individual entries.

---

# 124. Cardio History

Show:

```text
Date

Activity

Duration

Speed

Incline

Distance
```

---

# 125. Weight History

Show:

```text
Date

Weight

Change
```

---

# 126. Performance Requirements

The application should:

* Start quickly
* Render cached Home quickly
* Avoid blocking on analytics
* Avoid unnecessary full refreshes
* Cache appropriate API results
* Paginate histories
* Lazy-load charts where useful

---

# 127. Image / Media Strategy

Exercise video URLs should open through an appropriate player/browser flow.

Do not download video content into the app unless required later.

---

# 128. Logging

Development logs may include:

```text
request path

status code

sync state

error code
```

Never log:

```text
password

access token

refresh token

sensitive credentials
```

Production logs should be limited.

---

# 129. Crash Reporting

Production should integrate crash/error reporting.

Capture:

```text
App version

OS

Route

Error type
```

Avoid sensitive health/profile payloads in crash metadata.

---

# 130. Analytics Events

Product analytics may track events such as:

```text
login_success

meal_logged

water_added

workout_started

workout_completed

cardio_logged

notification_opened
```

Do not send sensitive detailed health values to analytics platforms unnecessarily.

---

# 131. Testing Structure

```text
test/
├── unit/
├── widget/
└── fixtures/

integration_test/
```

---

# 132. Unit Tests

Test:

```text
Repositories

Mappers

Error Mapping

Sync Queue

Weight Formatting

Water Calculations for Local UI

Workout Input Validation

Meal Selection Validation
```

Official backend calculations do not need duplication in Flutter tests.

---

# 133. Widget Tests

Test:

```text
Login Form

Water Quick Add

Weight Entry

Meal Option Group

Workout Set Row

Notification Item
```

---

# 134. Integration Tests

Test critical user flows.

Example:

```text
Login
 ↓
Home
 ↓
Weight
 ↓
Water
 ↓
Meal
```

---

# 135. Critical Workout Test

Full scenario:

```text
Login

Open Today

Start Workout

Open Exercise

Enter Set 1

Enter Set 2

Navigate to Next Exercise

Return

Verify Set Data Still Exists

Complete Workout

View Completion
```

---

# 136. Offline Integration Test

Scenario:

```text
Go Offline

Add Water

Enter Weight

Log Meal

Log Workout Set

Reconnect

Sync

Verify No Duplicates
```

---

# 137. Authentication Tests

Test:

```text
Valid Login

Invalid Login

Expired Access Token

Successful Refresh

Refresh Failure

Logout

Disabled User
```

---

# 138. Notification Tests

Test:

```text
Foreground Notification

Background Notification

Notification Tap

Deep Link

Unread Count

Read

Dismiss
```

---

# 139. App Update Compatibility

Backend evolves independently.

API versioning should prevent breaking installed mobile clients.

Flutter should target:

```text
/api/v1
```

until a deliberate migration occurs.

---

# 140. Minimum Supported App Version

Backend may eventually return:

```text
minimumSupportedVersion
```

If the app becomes too old:

```text
Update Required
```

This is useful once production adoption grows.

---

# 141. Flutter Development Phases

Development should follow backend readiness.

---

# PHASE F0 — Project Foundation

Build:

```text
Flutter Project

Folder Structure

Environment Config

Routing

State Management

Dependency Injection

Theme

API Client

Error Architecture

Testing Setup
```

## Exit Criteria

Application:

```text
runs

builds

tests

navigates
```

cleanly.

---

# PHASE F1 — Local Infrastructure

Build:

```text
Secure Storage

Local Database

Preferences

Connectivity Service

Sync Queue Base
```

Do this early rather than bolting offline support on at the very end.

---

# PHASE F2 — Authentication

Build:

```text
Login

Token Storage

Session Restore

Refresh

Logout

Auth Routing
```

## Exit Criteria

User can reliably authenticate and reopen app without logging in every time.

---

# PHASE F3 — App Shell

Build:

```text
Bottom Navigation

Home Shell

Plan

Progress

Notifications

Profile
```

Add:

```text
global loading

offline banner

global error handling
```

---

# PHASE F4 — Daily Plan

Connect:

```text
GET /api/v1/me/today
```

Build:

```text
Daily Plan Repository

Local Cache

Home Cards

Task List

Missed Tasks
```

## Exit Criteria

User sees the complete server-configured day.

This is a major milestone.

---

# PHASE F5 — Weight

Build:

```text
Weight Entry

Today's Weight

History

Local Save

Sync
```

---

# PHASE F6 — Water

Build:

```text
Target

Current Total

Quick Add

Custom Add

Delete

History

Optimistic Updates

Offline Queue
```

---

# PHASE F7 — Diet

Build:

```text
Meal List

Meal Detail

Option Groups

Option Selection

Complete

Partial

Skip

Offline Save

Sync
```

## Exit Criteria

User can fully record configured daily meals.

---

# PHASE F8 — Workout Read-Only Plan

Before execution, build:

```text
Today's Workout

Exercise List

Targets

Notes

Tracking Types
```

Verify dynamic backend configuration renders correctly.

---

# PHASE F9 — Workout Execution

Build:

```text
Start Session

Session Persistence

Exercise Navigation

Set Rows

Weight

Reps

Duration

Distance

Local Autosave
```

## Exit Criteria

User can perform a complete workout without losing data.

This is the most important Flutter-specific milestone.

---

# PHASE F10 — Workout History & Previous Performance

Build:

```text
Previous Performance

Recent Sessions

Exercise History

Workout Summary
```

---

# PHASE F11 — Cardio

Build:

```text
Target

Logging

Dynamic Activity Fields

History

Offline Save

Sync
```

---

# PHASE F12 — Progress

Build:

```text
Overview

Weight

Goal Progress

Strength

Nutrition

Water

Cardio

Weekly Summary
```

---

# PHASE F13 — Notification Center

Build:

```text
Notification List

Unread Count

Read

Dismiss

Deep Links
```

---

# PHASE F14 — Push Notifications

Build:

```text
Permission Flow

Device Registration

Push Token Updates

Foreground Handling

Background Handling

Tap Handling
```

---

# PHASE F15 — Local Notifications

Build local reminder support where appropriate.

Do not duplicate backend missed-task decisions.

---

# PHASE F16 — Offline Tracking Completion

Ensure offline support for:

```text
Weight

Water

Meals

Workout Sets

Cardio
```

---

# PHASE F17 — Sync Engine

Implement:

```text
Queue Processing

Retry

Idempotency

Connectivity Triggers

Exponential Retry Strategy

Failure State
```

---

# PHASE F18 — Conflict Handling

Implement:

```text
409 Conflict

Expired/Changed Records

Deleted Server Resources

Failed Operations
```

Provide user-visible recovery when necessary.

---

# PHASE F19 — History

Build:

```text
Weight History

Meal History

Workout History

Cardio History

Water History
```

---

# PHASE F20 — Profile & Preferences

Build:

```text
Profile

Timezone Display

Notification Preferences

Logout
```

---

# PHASE F21 — Localization / RTL Foundation

Prepare:

```text
Translation Files

LTR/RTL

Date Localization

Number Formatting
```

---

# PHASE F22 — UX Hardening

Review:

```text
Keyboard

Fast Workout Entry

Loading

Offline

Errors

Empty States

Navigation

Accessibility

Large Text

Screen Sizes
```

---

# PHASE F23 — Performance Hardening

Review:

```text
Startup Time

Local DB Queries

Widget Rebuilds

Chart Rendering

Workout Screen Performance

Memory

API Calls
```

---

# PHASE F24 — Full Automated Testing

Complete:

```text
Unit

Widget

Integration

Offline

Authentication

Workout

Notification
```

---

# PHASE F25 — Android Production Preparation

Configure:

```text
Application ID

Signing

Release Build

Push

Permissions

Production API

Store Assets
```

---

# PHASE F26 — iOS Production Preparation

Configure:

```text
Bundle ID

Signing

Push Certificates

Capabilities

Permissions

Production API

Release Build
```

---

# PHASE F27 — Staging Release

Deploy to internal testers.

Test:

```text
Real Device

Push

Background Handling

Offline

Sync

Workout

Notifications

Timezone
```

---

# PHASE F28 — Production Release

Complete:

```text
Production Config

Crash Reporting

Monitoring

Store Submission

Release Notes

Smoke Tests
```

---

# 142. Master Flutter Implementation Order

Actual coding order:

```text
1. Flutter Bootstrap

2. Environment System

3. Routing

4. State Management

5. Dependency Injection

6. API Client

7. Secure Storage

8. Local Database

9. Connectivity

10. Authentication

11. App Shell

12. Daily Plan

13. Weight

14. Water

15. Diet

16. Workout Plan Display

17. Workout Execution

18. Previous Performance

19. Cardio

20. Progress

21. Notification Center

22. Push Notifications

23. Local Notifications

24. Offline Completion

25. Sync Engine

26. Conflict Handling

27. History

28. Profile

29. Localization

30. Accessibility

31. Performance

32. Testing

33. Staging

34. Production
```

---

# 143. Backend Dependency Order

Flutter features should begin only when corresponding API contracts are stable.

Example:

```text
Backend /me/today
       ↓
Flutter Home
```

```text
Backend Meal Logging
       ↓
Flutter Diet
```

```text
Backend Workout Session API
       ↓
Flutter Workout
```

```text
Backend Progress API
       ↓
Flutter Progress
```

---

# 144. What Can Be Built Before Backend Completion

Flutter can build:

```text
Routing

Theme

Local DB

Secure Storage

Authentication UI

Reusable Components

Offline Infrastructure
```

using exact OpenAPI mocks.

Do not invent fake backend schemas that differ from the contract.

---

# 145. Critical Daily User Scenario

Before MVP is complete, this must work:

```text
USER LOGIN
      ↓
OPEN HOME
      ↓
SEE TODAY'S PLAN
      ↓
ENTER WEIGHT
      ↓
ADD WATER
      ↓
LOG BREAKFAST
      ↓
LOG LUNCH
      ↓
START WORKOUT
      ↓
ENTER EACH SET
      ↓
COMPLETE WORKOUT
      ↓
LOG CARDIO
      ↓
VIEW DAILY PROGRESS
```

---

# 146. Critical Workout Scenario

```text
OPEN TODAY'S WORKOUT
      ↓
START
      ↓
SEE PREVIOUS PERFORMANCE
      ↓
ENTER WEIGHT + REPS
      ↓
MOVE BETWEEN EXERCISES
      ↓
BACKGROUND APP
      ↓
REOPEN APP
      ↓
SESSION STILL EXISTS
      ↓
FINISH WORKOUT
      ↓
VIEW SUMMARY
```

No workout data may be lost.

---

# 147. Critical Offline Scenario

```text
USER GOES OFFLINE
      ↓
APP SHOWS OFFLINE STATE
      ↓
USER ADDS WATER
      ↓
USER LOGS WEIGHT
      ↓
USER LOGS MEAL
      ↓
USER LOGS WORKOUT SETS
      ↓
DATA SAVED LOCALLY
      ↓
INTERNET RETURNS
      ↓
SYNC STARTS
      ↓
IDEMPOTENCY KEYS SENT
      ↓
SERVER ACCEPTS DATA ONCE
      ↓
LOCAL RECORDS MARKED SYNCED
```

---

# 148. Critical Notification Scenario

```text
BACKEND DETECTS MISSED MEAL
      ↓
PUSH ARRIVES
      ↓
USER TAPS
      ↓
APP OPENS
      ↓
MEAL SCREEN OPENS
      ↓
USER LOGS MEAL
      ↓
HOME UPDATES
```

---

# 149. Critical Day Change Scenario

```text
APP OPEN AT 23:55
      ↓
MIDNIGHT PASSES
      ↓
APP DETECTS NEW USER DATE
      ↓
LOAD NEW DAILY PLAN
      ↓
DISPLAY NEW TASKS
```

---

# 150. Flutter Definition of MVP

Flutter MVP requires:

1. Authentication
2. Session restoration
3. Home
4. Today's plan
5. Weight logging
6. Water logging
7. Diet logging
8. Workout display
9. Workout set logging
10. Workout completion
11. Cardio logging
12. Basic progress
13. Notification center
14. Basic local persistence
15. Error handling
16. Offline indication

---

# 151. Flutter Full V1 Definition

Full V1 additionally requires:

1. Complete offline tracking
2. Sync queue
3. Idempotency
4. Conflict handling
5. Push notifications
6. Local notifications
7. Deep links
8. Previous workout performance
9. Exercise progression
10. Weekly progress
11. Monthly progress
12. History screens
13. Notification preferences
14. Active workout recovery
15. Localization readiness
16. Accessibility review
17. Performance review
18. Crash reporting
19. Staging release
20. Production release

---

# 152. Flutter Coding Rules

## Rule 1

Flutter never accesses MySQL directly.

## Rule 2

Flutter never hard-codes personal workout plans.

## Rule 3

Flutter never hard-codes personal diet plans.

## Rule 4

Today's plan comes from backend.

## Rule 5

Official progress comes from backend.

## Rule 6

All important tracking writes persist locally before they can be lost.

## Rule 7

Offline writes use idempotency keys.

## Rule 8

Authentication is centralized.

## Rule 9

API requests use one API client.

## Rule 10

API errors use stable backend error codes.

## Rule 11

Screens do not contain repository/networking implementation.

## Rule 12

Exercise input adapts to tracking type.

## Rule 13

Notifications deep-link into the relevant feature.

## Rule 14

User timezone is respected.

## Rule 15

Unsynced data is never silently deleted.

---

# 153. Most Important Flutter Milestones

## Milestone 1 — Authentication

User can securely log in and maintain a session.

---

## Milestone 2 — Today's Plan

Flutter dynamically renders whatever backend assigns.

This proves no plan is hard-coded.

---

## Milestone 3 — Daily Tracking

User can record:

```text
Weight

Water

Meals

Cardio
```

---

## Milestone 4 — Workout Execution

User can:

```text
Start workout

View exercises

See previous performance

Record every set

Resume interrupted workout

Complete workout
```

This is the most important Flutter milestone.

---

## Milestone 5 — Progress

User can clearly see:

```text
Weight trend

Goal progress

Strength progression

Adherence
```

---

## Milestone 6 — Notifications

User receives reminders and can act directly from them.

---

## Milestone 7 — Offline Reliability

User can continue logging important information without internet.

---

## Milestone 8 — Production

App is:

```text
Stable

Secure

Tested

Observable

Release-ready
```

---

# 154. Final Flutter Architecture

```text
                    Flutter Application
                           │
            ┌──────────────┼──────────────┐
            │              │              │
          Home            Plan         Progress
            │              │              │
            └──────────────┼──────────────┘
                           │
                     Feature Layer
                           │
       ┌───────────────────┼────────────────────┐
       │                   │                    │
     Diet               Workout              Tracking
       │                   │                    │
       └───────────────────┼────────────────────┘
                           │
                      Repositories
                           │
                ┌──────────┴──────────┐
                │                     │
            Local Database          REST API
                │                     │
             Sync Queue          Node.js Backend
                │
                └──── Synchronization ────┘
```

---

# 155. Final Flutter Objective

The Flutter application is complete when a user can answer and perform:

```text
What should I do today?

What meals should I eat?

What did I actually eat?

How much water have I drunk?

What is today's workout?

What did I lift last time?

What weight am I using today?

How many reps did I perform?

Did I complete my workout?

How much cardio did I do?

What is my current weight?

Am I progressing toward my target?

What have I missed?

What reminders do I have?

Can I continue logging if my internet disappears?
```

without requiring:

```text
Admin dashboard access

Database access

Manual spreadsheets

Developer intervention
```

---

# 156. Final Implementation Principle

The Flutter development hierarchy should be:

```text
API CONTRACT
     ↓
DOMAIN MODEL
     ↓
REPOSITORY
     ↓
LOCAL CACHE / API
     ↓
STATE
     ↓
SCREEN
```

and for user writes:

```text
USER ACTION
     ↓
LOCAL SAVE
     ↓
UI UPDATE
     ↓
SYNC QUEUE
     ↓
BACKEND
     ↓
RECONCILIATION
```

The most important early deliverable after authentication should therefore be:

```text
GET /api/v1/me/today
       ↓
HOME
       ↓
WEIGHT
       ↓
WATER
       ↓
DIET
       ↓
WORKOUT
       ↓
CARDIO
```

The most important technical reliability milestone is:

> **A user can begin a workout, record every exercise set, close or background the application, reopen it, continue exactly where they stopped, and later synchronize the session without losing or duplicating any data.**

The most important product milestone is:

> **The Flutter application can display and execute any diet or workout configured through the admin dashboard without requiring a new mobile release.**

Once those two conditions are met, the mobile application is correctly aligned with the configuration-driven architecture of the platform.
