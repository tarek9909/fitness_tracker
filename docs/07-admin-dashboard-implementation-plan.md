# Fitness Tracking Platform

# Master Admin Dashboard Implementation Plan

**Application:** Administration Dashboard
**Frontend:** React + Vite
**Language:** TypeScript
**Backend:** Node.js REST API
**API Base:** `/api/v1/admin`
**Authentication:** Access Token + Refresh Session
**Purpose:** Configuration, administration, monitoring, and analytics

---

# 1. Dashboard Mission

The admin dashboard is the configuration and monitoring interface of the fitness platform.

Administrators must be able to manage the entire platform without:

* Modifying backend source code
* Modifying Flutter source code
* Manually editing MySQL
* Running SQL manually for ordinary operations

The dashboard should allow administrators to configure:

* Users
* Exercise library
* Workout plans
* Workout versions
* Workout days
* Workout exercises
* Sets
* Repetitions
* Rest periods
* Diet plans
* Diet versions
* Meals
* Meal schedules
* Option groups
* Food choices
* Plan assignments
* Weight goals
* Water targets
* Cardio targets
* Reminder rules
* Notification settings
* Adherence settings
* Analytics
* Audit history

The dashboard is an administrative client of the Node.js backend.

It must not contain independent business rules that conflict with the backend.

---

# 2. Core Dashboard Principle

The dashboard should manage:

```text id="tij3pb"
CONFIGURATION
      +
ASSIGNMENT
      +
MONITORING
```

The Flutter application manages:

```text id="zmeaqg"
USER EXECUTION
```

The backend remains authoritative for:

```text id="sah03e"
Validation
Authorization
Progress
Adherence
Daily Plan Resolution
Notifications
Historical Integrity
```

---

# 3. Recommended Frontend Stack

Use:

```text id="85ihp3"
React
Vite
TypeScript

React Router

Server-state/query library

Form-management library

Schema validation

Drag-and-drop library

Charting library

Date/time library

Reusable component system
```

A practical implementation may use:

```text id="xd3oee"
React Router

TanStack Query

React Hook Form

Zod

dnd-kit
```

The specific UI component library can be chosen separately.

The most important rule is architectural consistency.

---

# 4. Dashboard Location

Within the repository:

```text id="n0jgnu"
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
└── infrastructure/
```

This document covers:

```text id="bhqjlo"
admin-dashboard/
```

---

# 5. Recommended Dashboard Folder Structure

```text id="57cc7w"
admin-dashboard/
│
├── public/
│
├── src/
│   │
│   ├── app/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   │
│   │   ├── router/
│   │   │   ├── router.tsx
│   │   │   ├── routes.ts
│   │   │   └── route-guards.tsx
│   │   │
│   │   ├── providers/
│   │   │   ├── AppProviders.tsx
│   │   │   ├── QueryProvider.tsx
│   │   │   ├── AuthProvider.tsx
│   │   │   └── ThemeProvider.tsx
│   │   │
│   │   └── error/
│   │       └── AppErrorBoundary.tsx
│   │
│   ├── api/
│   │   ├── client/
│   │   │   ├── api-client.ts
│   │   │   ├── auth-interceptor.ts
│   │   │   └── api-errors.ts
│   │   │
│   │   ├── generated/
│   │   │
│   │   └── types/
│   │
│   ├── auth/
│   │   ├── auth-store.ts
│   │   ├── auth-service.ts
│   │   ├── permissions.ts
│   │   └── guards/
│   │
│   ├── layouts/
│   │   ├── AuthLayout/
│   │   ├── DashboardLayout/
│   │   ├── Sidebar/
│   │   ├── Topbar/
│   │   └── PageLayout/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── forms/
│   │   ├── tables/
│   │   ├── charts/
│   │   ├── feedback/
│   │   ├── dialogs/
│   │   ├── filters/
│   │   └── navigation/
│   │
│   ├── features/
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── exercises/
│   │   ├── workout-plans/
│   │   ├── diet-plans/
│   │   ├── foods/
│   │   ├── assignments/
│   │   ├── goals/
│   │   ├── water-targets/
│   │   ├── cardio-targets/
│   │   ├── reminders/
│   │   ├── notifications/
│   │   ├── analytics/
│   │   ├── audit/
│   │   └── settings/
│   │
│   ├── hooks/
│   │
│   ├── utils/
│   │   ├── dates.ts
│   │   ├── formatting.ts
│   │   ├── validation.ts
│   │   └── numbers.ts
│   │
│   ├── constants/
│   │
│   ├── styles/
│   │
│   └── types/
│
├── tests/
│   ├── unit/
│   ├── component/
│   └── integration/
│
├── .env.example
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

# 6. Feature Folder Pattern

Every major feature should follow a predictable structure.

Example:

```text id="hvj9vl"
features/workout-plans/
│
├── api/
│   ├── workout-plan.api.ts
│   └── workout-plan.queries.ts
│
├── components/
│   ├── WorkoutPlanTable.tsx
│   ├── WorkoutVersionList.tsx
│   ├── WorkoutDayEditor.tsx
│   ├── ExerciseEditor.tsx
│   └── WorkoutPreview.tsx
│
├── forms/
│   ├── WorkoutPlanForm.tsx
│   └── schemas.ts
│
├── pages/
│   ├── WorkoutPlansPage.tsx
│   ├── WorkoutPlanDetailsPage.tsx
│   └── WorkoutBuilderPage.tsx
│
├── hooks/
│
├── types.ts
│
└── constants.ts
```

This keeps functionality local to each domain.

---

# 7. Application Providers

At application startup:

```text id="zydxzk"
App
 ↓
Error Boundary
 ↓
Query Provider
 ↓
Authentication Provider
 ↓
Theme Provider
 ↓
Router
```

Keep providers centralized.

Do not scatter global providers throughout feature components.

---

# 8. API Contract Strategy

The dashboard must consume the backend's formal API contract.

Primary source:

```text id="7p1fh5"
contracts/openapi/openapi.yaml
```

Prefer generated TypeScript API types where possible.

The dashboard should not manually redefine every backend response if generation is practical.

---

# 9. API Client

Create one centralized API client.

Responsibilities:

```text id="axnbqz"
Base URL

Access Token

Refresh handling

Request ID handling

Standard errors

Timeouts

Abort/cancellation
```

Do not use random `fetch()` calls throughout pages.

---

# 10. Environment Configuration

Example:

```text id="k6xx3p"
VITE_API_BASE_URL=
VITE_APP_NAME=
VITE_ENVIRONMENT=
```

Do not place secrets inside Vite environment variables.

Anything shipped in the frontend bundle is public.

---

# 11. Authentication Architecture

The dashboard must support:

```text id="qjwvgm"
Login
Session restoration
Token refresh
Logout
Protected routes
Permission checks
Expired session handling
```

---

# 12. Login Page

Route:

```text id="8cvfss"
/login
```

Fields:

```text id="2ci5bf"
Email
Password
```

States:

```text id="44s4pt"
Idle
Submitting
Invalid Credentials
Disabled Account
Network Error
Success
```

---

# 13. Authentication Flow

```text id="bm4cpn"
Admin submits credentials
      ↓
POST /api/v1/auth/login
      ↓
Backend authenticates
      ↓
Access/session returned
      ↓
Dashboard stores session securely
      ↓
GET /api/v1/me
      ↓
Verify role
      ↓
Load dashboard
```

---

# 14. Authorization

The dashboard may hide unauthorized UI.

However:

> Hiding UI is not authorization.

Backend must still reject unauthorized requests.

Dashboard permissions are for UX.

---

# 15. Route Guards

Recommended guards:

```text id="6bt74j"
RequireAuth

RequireAdmin
```

Example:

```text id="87kotx"
/dashboard
/users
/workouts
/diets
```

require admin access.

---

# 16. Dashboard Layout

Primary layout:

```text id="nx5h4m"
┌─────────────────────────────────────────┐
│ Topbar                                  │
├──────────────┬──────────────────────────┤
│ Sidebar      │ Page                     │
│              │                          │
│ Dashboard    │                          │
│ Users        │                          │
│ Plans        │                          │
│ Exercises    │                          │
│ Analytics    │                          │
│ Settings     │                          │
└──────────────┴──────────────────────────┘
```

---

# 17. Main Navigation

Recommended:

```text id="7y82rc"
Dashboard

Users

Plans
  ├── Workout Plans
  └── Diet Plans

Library
  ├── Exercises
  └── Foods

Assignments

Targets
  ├── Weight Goals
  ├── Water Targets
  └── Cardio Targets

Reminders

Notifications

Analytics

Audit Logs

Settings
```

---

# 18. Dashboard Home

Route:

```text id="50cdrl"
/dashboard
```

Cards may include:

```text id="avatzd"
Total Users

Active Users

Users With Missed Tasks

Today's Workouts

Today's Diet Adherence

Today's Water Adherence

Today's Cardio Adherence
```

---

# 19. Dashboard Charts

Possible charts:

```text id="g6fwlf"
User Activity

Workout Completion

Meal Completion

Average Adherence

Weight Change Distribution

Water Target Completion
```

The dashboard should use aggregated backend endpoints.

Do not load raw logs for global dashboard charts.

---

# 20. User Management

Routes:

```text id="6pzyjn"
/users

/users/new

/users/:userId
```

---

# 21. Users List

Columns:

```text id="68uqml"
Name

Email

Status

Current Weight

Target Weight

Workout Plan

Diet Plan

Last Activity

Created At
```

Actions:

```text id="5kxucu"
View

Edit

Disable

Enable
```

---

# 22. User Search & Filters

Support:

```text id="hazwf7"
Search by name/email

Status

Plan

Date Created

Pagination
```

Filters should map directly to backend query parameters.

---

# 23. Create User

Form fields may include:

```text id="8t0ia3"
First Name

Last Name

Email

Password / Invite Mode

Height

Date of Birth

Gender

Timezone

Status
```

Do not make unnecessary fields mandatory.

---

# 24. User Detail Page

Recommended tabs:

```text id="p5s1dx"
Overview

Plans

Weight

Nutrition

Workouts

Water

Cardio

Progress

Notifications

History
```

---

# 25. User Overview

Display:

```text id="yk430b"
Current Weight

Starting Weight

Target Weight

Weight Lost

Weight Remaining

Goal Progress

Diet Adherence

Workout Adherence

Water Adherence

Cardio Adherence

Recent Tasks
```

---

# 26. Exercise Library

Routes:

```text id="q6giy1"
/exercises

/exercises/new

/exercises/:exerciseId/edit
```

---

# 27. Exercise List

Columns:

```text id="3y5dji"
Name

Primary Muscle Group

Equipment

Tracking Type

Status
```

Filters:

```text id="97k2ep"
Search

Muscle Group

Equipment

Tracking Type

Active/Archived
```

---

# 28. Exercise Editor

Fields:

```text id="3cstyy"
Name

Description

Muscle Groups

Primary Muscle Group

Equipment

Tracking Type

Instructions

Video URL

Status
```

---

# 29. Exercise Tracking Type UX

If:

```text id="ueybqz"
weight_reps
```

show:

```text id="bixw7k"
Weight + Reps
```

If:

```text id="1tr76k"
duration
```

show:

```text id="u94jsh"
Duration
```

If:

```text id="696q4j"
distance
```

show:

```text id="ge3qss"
Distance
```

The workout builder should adapt to the tracking type.

---

# 30. Workout Plan Management

Routes:

```text id="2gobd5"
/workout-plans

/workout-plans/new

/workout-plans/:planId

/workout-plans/:planId/versions/:versionId
```

---

# 31. Workout Plans List

Columns:

```text id="o3z5ei"
Plan Name

Status

Current Published Version

Last Updated

Assigned Users
```

Actions:

```text id="a5x54x"
Open

Create Draft Version

Archive
```

---

# 32. Workout Plan Creation

Fields:

```text id="ykzfq6"
Name

Description

Goal
```

Creating the plan should automatically allow creation of:

```text id="qkgdkv"
Version 1 Draft
```

or this can be a separate explicit action.

---

# 33. Workout Plan Version Page

Display:

```text id="2yhkss"
Version Number

Status

Created By

Created At

Published At

Change Notes
```

Actions depend on status.

---

# 34. Draft Version Actions

Draft:

```text id="u157uy"
Edit

Preview

Validate

Publish

Delete Draft
```

Published:

```text id="7tvurj"
View

Duplicate as New Draft
```

No edit action for published versions.

---

# 35. Workout Builder

This is one of the most important dashboard screens.

The builder should make complex configuration understandable.

Recommended layout:

```text id="thw183"
┌─────────────────────────────────────────┐
│ Workout Plan: Fat Loss V2               │
│ Status: Draft                           │
├─────────────────────────────────────────┤
│ Monday     Tuesday     Wednesday ...    │
├─────────────────────────────────────────┤
│ Tuesday: Lower                          │
│                                         │
│ 1. Leg Press                            │
│    4 sets | 8–12 reps | 120 sec         │
│                                         │
│ 2. Leg Curl                             │
│    3 sets | 10–15 reps | 90 sec         │
│                                         │
│ [+ Add Exercise]                        │
└─────────────────────────────────────────┘
```

---

# 36. Weekly Schedule Editor

For each weekday:

```text id="4rk6by"
Training Day
or
Rest Day
```

Training day fields:

```text id="vtlbvq"
Name

Description

Notes
```

---

# 37. Exercise Picker

When adding an exercise:

```text id="sdkklt"
Search exercise
 ↓
Filter
 ↓
Select
```

Show:

```text id="o2zb1h"
Name

Muscle group

Equipment

Tracking type
```

---

# 38. Workout Exercise Editor

Fields:

```text id="z16yjx"
Exercise

Sets

Minimum Reps

Maximum Reps

Rest

Optional

Notes
```

Fields should change depending on tracking type.

---

# 39. Drag and Drop

Workout exercises should support drag-and-drop ordering.

After reorder:

```text id="d0gzsi"
POST /exercises/reorder
```

or equivalent API.

Optimistically update UI but rollback if server save fails.

---

# 40. Per-Set Advanced Editor

Optional advanced mode:

```text id="rtdfww"
Set 1
8–12 reps
100 kg optional target

Set 2
8–12 reps

Set 3
8–12 reps
```

Most workouts can use generic exercise targets.

Per-set configuration should remain optional.

---

# 41. Workout Preview

Provide a preview that resembles the Flutter workout experience.

Example:

```text id="fzin8j"
Tuesday — Lower

Leg Press
4 × 8–12

Seated Leg Curl
3 × 10–15

...
```

This helps admins verify plans before publishing.

---

# 42. Workout Publish Flow

Click:

```text id="ujfjny"
Publish Version
```

Then:

```text id="egcppb"
Frontend validates required fields
      ↓
Backend validation request
      ↓
Errors?
   ↙       ↘
YES        NO
 ↓          ↓
Show      Confirm Publish
errors        ↓
             Publish
```

---

# 43. Publish Validation Errors

Display backend errors clearly.

Example:

```text id="7s0403"
Tuesday:

Exercise 3 has no target sets.

Thursday:

Duplicate exercise order.
```

Do not reduce this to:

```text id="7nf4vj"
Something went wrong.
```

---

# 44. Diet Plan Management

Routes:

```text id="bhzwt7"
/diet-plans

/diet-plans/new

/diet-plans/:planId

/diet-plans/:planId/versions/:versionId
```

---

# 45. Diet Plans List

Columns:

```text id="jhz0im"
Plan Name

Status

Published Version

Assigned Users

Updated At
```

---

# 46. Diet Builder

Recommended structure:

```text id="k6zkvj"
Diet Plan Version

Meal 1
09:00 Breakfast

    Carbohydrate Group
       Option A
       Option B
       Option C

    Protein Group
       Option A
       Option B

Meal 2
11:00 Snack
...
```

---

# 47. Meal Editor

Fields:

```text id="4fkqeg"
Meal Name

Scheduled Time

Required

Grace Period

Description
```

---

# 48. Option Group Editor

Fields:

```text id="p0a0bx"
Group Name

Minimum Selections

Maximum Selections

Required

Order
```

Example:

```text id="ojrk3l"
Protein

Minimum: 1
Maximum: 1
Required: Yes
```

---

# 49. Food Option Editor

Fields:

```text id="45ak7b"
Label

Food Library Reference Optional

Quantity

Unit

Calories

Protein

Carbs

Fat

Fiber

Notes
```

Support composite choices.

Example:

```text id="gpehew"
2 Whole Eggs + 3 Egg Whites
```

does not have to reference exactly one food-library record.

---

# 50. Diet Drag-and-Drop

Support reordering:

```text id="uy5juv"
Meals

Groups

Options
```

Use explicit order values.

---

# 51. Diet Preview

Display the plan exactly as a user would conceptually see it:

```text id="p9ukfd"
Breakfast — 09:00

Choose 1 carbohydrate:

○ Option A
○ Option B

Choose 1 protein:

○ Option A
○ Option B
```

---

# 52. Food Library

Routes:

```text id="95wo8o"
/foods

/foods/new

/foods/:foodId/edit
```

Food fields:

```text id="7jcmrc"
Name

Brand

Reference Quantity

Reference Unit

Calories

Protein

Carbs

Fat

Fiber

Notes
```

---

# 53. Assignment Management

Assignments are central to the multi-user design.

Route:

```text id="w1b8lu"
/users/:userId/plans
```

or a dedicated:

```text id="gnvpgn"
/assignments
```

---

# 54. Workout Assignment UI

Admin chooses:

```text id="ruyzgq"
User

Workout Plan

Published Version

Effective From

Effective Until Optional
```

Before submitting, show:

```text id="4htwsh"
Current Assignment

Upcoming Assignment

Historical Assignments
```

---

# 55. Assignment Conflict

Backend may return:

```text id="qgywlc"
ASSIGNMENT_OVERLAP
```

Dashboard should explain:

> The selected dates overlap with an existing workout assignment.

Provide link to conflicting assignment.

---

# 56. Diet Assignment UI

Same architecture as workout assignment.

Only published versions should be selectable.

---

# 57. User Plan Timeline

Useful visualization:

```text id="w4qwxf"
Workout

Jan 1 ───── Mar 31
Plan V1

Apr 1 ─────────────
Plan V2
```

This makes historical assignments easier to understand.

---

# 58. Weight Goal Management

User goal screen:

```text id="c6ide9"
Starting Weight

Target Weight

Start Date

Target Date

Status

Notes
```

Show calculated current progress separately.

---

# 59. Water Target Configuration

Fields:

```text id="zt4a3q"
Daily Target ml

Effective From

Effective Until

Quick Add Values
```

Quick-add editor:

```text id="yo454e"
250 ml

500 ml

750 ml

1000 ml
```

---

# 60. Cardio Target Configuration

Fields:

```text id="b9n5x4"
Activity

Weekdays

Minimum Minutes

Maximum Minutes

Minimum Speed

Maximum Speed

Minimum Incline

Maximum Incline

Distance Range

Effective Dates

Notes
```

---

# 61. Adherence Configuration

If configurable per user:

```text id="nyagsj"
Diet %

Workout %

Cardio %

Water %

Weight Logging %
```

Display:

```text id="r1yd4p"
Total = 100%
```

Prevent submission if total is not 100.

Backend should also validate.

---

# 62. Reminder Management

Route:

```text id="3hoh5m"
/reminders
```

---

# 63. Reminder List

Columns:

```text id="aynfmo"
Name

Category

Scope

Trigger Mode

Time / Interval

Status
```

---

# 64. Reminder Editor

Fields depend on trigger mode.

Common:

```text id="yrcs9h"
Name

Category

Scope

Enabled

Weekdays

Grace Period

Maximum Repeats
```

---

# 65. Fixed-Time Reminder

Fields:

```text id="9shh3s"
Time

Active Days
```

Example:

```text id="dtj4f0"
08:00
Every Day
```

---

# 66. Relative Reminder

Example:

```text id="ae8k32"
15 minutes before meal
```

or:

```text id="19gr07"
60 minutes after scheduled meal
```

UI:

```text id="0bvv0i"
Offset
Before / After
Task
```

---

# 67. Interval Reminder

Example:

```text id="0m6ghj"
Water

Every 90 minutes

08:00 → 22:00
```

---

# 68. Notification Management

Route:

```text id="ic98so"
/notifications
```

Admin should be able to inspect:

```text id="ne2iou"
User

Category

Message

Created

Status

Delivery Status
```

Do not generally allow editing already generated notifications.

---

# 69. Notification Delivery Detail

Show:

```text id="0sa93f"
In-App

Push

Device

Attempt Count

Provider Result

Failure Reason
```

Useful for troubleshooting.

---

# 70. Analytics Architecture

Admin dashboard should consume aggregate APIs.

Never calculate large analytics datasets in the browser from raw history.

---

# 71. Global Analytics

Route:

```text id="tnej7b"
/analytics
```

Possible sections:

```text id="9vl0g8"
Users

Adherence

Weight Progress

Workout Completion

Nutrition

Cardio

Water
```

---

# 72. User Analytics

Inside user profile:

```text id="06iwp5"
Overview

Weight

Diet

Workout

Water

Cardio
```

---

# 73. Weight Analytics

Display:

```text id="t3abwf"
Daily Weight

7-Day Average

Goal Line

Weight Lost

Remaining Weight

Weekly Change
```

---

# 74. Workout Analytics

Display:

```text id="d63k4i"
Workout Completion

Exercise History

Weight Progression

Rep Progression

Training Volume
```

Exercise selector:

```text id="7r79pj"
Select Exercise
```

Then render its progression.

---

# 75. Nutrition Analytics

Display:

```text id="4aj2ys"
Meals Expected

Meals Completed

Meals Partial

Meals Skipped

Adherence %
```

---

# 76. Water Analytics

Display:

```text id="1psb4q"
Target

Daily Intake

Average Intake

Completion Rate
```

---

# 77. Cardio Analytics

Display:

```text id="jbmc3q"
Target Minutes

Actual Minutes

Weekly Total

Completion %
```

---

# 78. Audit Logs

Route:

```text id="4g0eby"
/audit-logs
```

Columns:

```text id="oq1nrq"
Timestamp

Admin

Action

Entity

Entity ID
```

Filters:

```text id="w1w7b2"
Admin

Action

Entity Type

Date Range
```

---

# 79. Audit Detail

On row click show:

```text id="86l3wh"
Before

After
```

Use a structured diff where practical.

Do not expose secret values.

---

# 80. Settings

Route:

```text id="mkiv3r"
/settings
```

Possible settings:

```text id="kr5j81"
System Name

Default Timezone

Notification Defaults

Default Adherence

Default Pagination
```

Only backend-supported settings should appear.

---

# 81. Server State Strategy

Use server-state management for API resources.

Examples:

```text id="lxowf5"
users

workout plans

diet plans

exercise lists

analytics
```

Do not duplicate all API data into a global frontend store.

---

# 82. Local UI State

Use local/component state for:

```text id="zx7pbn"
Modal open/closed

Selected tab

Temporary drag order

Draft unsaved field state

Table view preference
```

---

# 83. Global Client State

Only use global state when truly global.

Examples:

```text id="b8peph"
Authenticated user

Sidebar collapsed

Theme

Global UI preferences
```

---

# 84. Query Keys

Centralize query keys.

Example:

```text id="051u66"
users.all

users.detail(userId)

workouts.all

workouts.detail(planId)

workouts.version(versionId)

diets.all
```

Avoid arbitrary string keys spread throughout code.

---

# 85. Cache Invalidation

After:

```text id="8s5yv5"
Create User
```

invalidate:

```text id="wn6itm"
users.all
```

After:

```text id="jpyrdg"
Publish Workout Version
```

invalidate:

```text id="jssui0"
workout plan detail

workout versions

assignable versions
```

---

# 86. Form Strategy

Use consistent form architecture.

Each form should have:

```text id="m690q5"
Schema

Default Values

Submit Handler

Backend Error Mapping
```

---

# 87. Client Validation

Validate basic things before sending:

```text id="ymmriv"
Required fields

Email format

Numbers

Rep ranges

Date ranges

Percent totals
```

But backend remains authoritative.

---

# 88. Backend Validation Mapping

If backend returns:

```text id="brlbnh"
VALIDATION_ERROR
```

with field information, map it back into form fields.

Example:

```text id="e7bjj3"
targetRepsMax
```

gets:

> Must be greater than or equal to minimum reps.

---

# 89. Unsaved Changes Protection

Complex screens such as:

```text id="u11ta7"
Workout Builder

Diet Builder
```

should warn before leaving when unsaved changes exist.

---

# 90. Draft Auto-Save

Optional later enhancement:

```text id="7p7fpj"
Auto-save draft changes
```

Do not implement auto-save before ordinary explicit saves are reliable.

For MVP, explicit save is safer.

---

# 91. Confirmation Dialogs

Require confirmation for:

```text id="0rwnty"
Publish Plan

Archive Exercise

Disable User

Cancel Assignment

Delete Draft
```

Do not require confirmation for harmless navigation.

---

# 92. Loading States

Every major data screen should have:

```text id="maaa5j"
Initial Loading

Refresh Loading

Mutation Loading
```

Avoid blank pages during fetch.

---

# 93. Empty States

Examples:

```text id="9z6fm2"
No Workout Plans Yet

Create your first workout plan.
```

```text id="32icvs"
No Users Found

Try changing the filters.
```

---

# 94. Error States

Distinguish:

```text id="zd8e8u"
Network Error

Unauthorized

Forbidden

Not Found

Validation Error

Server Error
```

Do not show the same generic alert for everything.

---

# 95. Toasts

Use toasts for lightweight confirmations:

```text id="u6qiyj"
Workout saved.

User created.

Assignment updated.
```

Use inline errors for failures requiring user action.

---

# 96. Tables

Create reusable table components supporting:

```text id="wpva2n"
Pagination

Sorting

Filtering

Loading

Empty State

Row Actions
```

Do not build every admin table from scratch.

---

# 97. Pagination

Keep pagination server-driven.

Frontend sends:

```text id="qy53w8"
page
limit
```

Backend returns:

```text id="86zbhd"
page

limit

total

totalPages
```

---

# 98. Filter URL State

For list pages, synchronize useful filters into URL query parameters.

Example:

```text id="1fa83c"
/users?status=active&page=2
```

Benefits:

```text id="7sm71h"
Refresh preservation

Shareable URL

Back navigation
```

---

# 99. Date Handling

Dashboard should display dates/times in an understandable format.

Important distinction:

```text id="a68kpx"
Server Timestamp
vs
User Timezone
```

User-specific schedules should indicate the user's timezone.

Example:

```text id="ol243e"
Meal: 09:00 Asia/Beirut
```

---

# 100. Accessibility

Minimum requirements:

```text id="wc684f"
Keyboard navigation

Visible focus

Labels

ARIA where appropriate

Contrast

Accessible dialogs

Accessible drag/drop fallback
```

Drag and drop should not be the only way to reorder.

Provide move up/down controls if necessary.

---

# 101. Responsive Design

Primary target:

```text id="85ngiu"
Desktop administration
```

But the dashboard should remain usable on:

```text id="98xaqh"
Tablet

Large mobile
```

Complex builders may reasonably be optimized for desktop.

---

# 102. Dashboard Security

Never:

```text id="z7jto9"
store passwords

store refresh secrets visibly

expose backend secrets

trust hidden buttons as authorization
```

Avoid rendering raw server stack traces.

---

# 103. XSS Considerations

Exercise instructions and notes may contain user/admin-entered text.

Render as text by default.

Do not blindly use raw HTML rendering.

If rich text is introduced later, sanitize it.

---

# 104. API Error Logging

Frontend can report:

```text id="h8vykb"
requestId

route

error code

environment
```

Do not send access tokens or sensitive form data into client analytics.

---

# 105. Testing Structure

```text id="qzij5z"
tests/
├── unit/
├── component/
└── integration/
```

Critical flows should also have end-to-end browser testing.

---

# 106. Component Tests

Test reusable components such as:

```text id="m99e1t"
Form Fields

Confirmation Dialog

Data Table

Pagination

Workout Exercise Card
```

---

# 107. Feature Tests

Test:

```text id="7z93sw"
Create User

Edit User

Create Exercise

Workout Builder

Diet Builder

Assignments

Targets
```

---

# 108. Workout Builder Tests

Critical cases:

```text id="3v1rd3"
Add day

Set rest day

Add exercise

Edit sets

Edit reps

Reorder exercises

Save draft

Publish validation

Published version read-only
```

---

# 109. Diet Builder Tests

Critical cases:

```text id="nifk5s"
Add meal

Set meal time

Add group

Add option

Reorder

Validation

Publish

Published version read-only
```

---

# 110. Authorization Tests

Ensure normal user role cannot open admin routes.

Frontend:

```text id="26kpjt"
redirect / forbidden screen
```

Backend remains the final authority.

---

# 111. Error Tests

Test:

```text id="uul1ly"
401

403

404

409 assignment conflict

422 validation

500
```

---

# 112. Performance Strategy

Use code splitting for large feature sections.

Example:

```text id="zr3qk3"
Workout Builder

Analytics

Audit Logs
```

can be lazy-loaded.

---

# 113. Avoid Excessive Re-Renders

Complex builders may have many controls.

Use:

```text id="fxpkca"
local form state

memoized derived values where helpful

small components
```

Do not store every text field in global state.

---

# 114. Large Workout Plans

Builder should remain usable with:

```text id="w7gmt2"
many days

many exercises
```

Avoid rebuilding the entire tree for every keystroke unnecessarily.

---

# 115. Large Diet Plans

Same principle for:

```text id="h5zil3"
many meals

many groups

many options
```

---

# 116. Dashboard Development Phases

The dashboard should be developed according to backend readiness.

---

# PHASE D0 — Project Foundation

Build:

```text id="3yks5o"
React + Vite

TypeScript

Router

Providers

API client

Query layer

Error boundary

Theme

Basic component system

Linting

Testing
```

## Exit Criteria

```text id="yxduas"
npm run dev

npm run build

npm run test

npm run lint
```

work successfully.

---

# PHASE D1 — Authentication

Build:

```text id="vqg31n"
Login

Session restoration

Refresh

Logout

Protected routes

Admin role guard
```

## Exit Criteria

Admin can sign in and reach `/dashboard`.

Normal users are rejected.

---

# PHASE D2 — Dashboard Shell

Build:

```text id="m5q0n2"
Sidebar

Topbar

Page header

Breadcrumbs

Responsive layout

Error pages

404
```

---

# PHASE D3 — User Management

Build:

```text id="hvla9d"
Users list

Filters

Create

Edit

Enable

Disable

User profile
```

## Exit Criteria

Administrator can manage users without database access.

---

# PHASE D4 — Reference Libraries

Build:

```text id="k6iffd"
Muscle Groups

Equipment

Exercise Library

Food Library
```

Exercise library is priority.

---

# PHASE D5 — Workout Plan List & Versioning

Build:

```text id="v111fe"
Workout Plans

Create Plan

Plan Detail

Versions

Create Draft Version

Version Status
```

---

# PHASE D6 — Workout Builder

Build:

```text id="1q8l5g"
Weekly Schedule

Training/Rest Days

Exercise Picker

Exercise Configuration

Drag/Drop

Per-set targets

Validation

Preview
```

## Exit Criteria

An administrator can create a complete workout without source-code changes.

This is a major product milestone.

---

# PHASE D7 — Workout Publishing

Build:

```text id="2o8clk"
Validation summary

Publish confirmation

Publish

Published read-only mode

Duplicate version
```

---

# PHASE D8 — Diet Plan List & Versioning

Build:

```text id="3kdy3l"
Diet Plans

Create

Versions

Draft

Published
```

---

# PHASE D9 — Diet Builder

Build:

```text id="0u8wrj"
Meal editor

Schedule

Option groups

Food options

Nutrition

Reordering

Preview
```

## Exit Criteria

Administrator can create an entire diet from dashboard configuration.

---

# PHASE D10 — Diet Publishing

Build:

```text id="a0q1mk"
Validation

Publish

Read-only published state

Duplicate version
```

---

# PHASE D11 — Assignments

Build:

```text id="w29ssv"
Workout assignment

Diet assignment

Effective dates

Assignment history

Conflict handling
```

---

# PHASE D12 — Goals & Targets

Build:

```text id="l0x2nn"
Weight Goal

Water Target

Water Quick Add

Cardio Target

Adherence Configuration
```

---

# PHASE D13 — Reminder Configuration

Build:

```text id="l8wwxz"
Reminder list

Create

Edit

Disable

Trigger modes

Weekdays

Grace

Repeats

Active windows
```

---

# PHASE D14 — User Monitoring

Expand user profile with:

```text id="cu396e"
Daily status

Meals

Workout

Water

Cardio

Weight

Missed tasks
```

---

# PHASE D15 — Analytics

Build:

```text id="2tcav3"
Global analytics

User analytics

Weight charts

Workout charts

Diet adherence

Water

Cardio
```

---

# PHASE D16 — Notifications

Build:

```text id="lhmihc"
Notification list

Notification details

Delivery status

Failure inspection
```

---

# PHASE D17 — Audit Logs

Build:

```text id="f0xtx9"
Audit list

Filters

Detail

Before/after comparison
```

---

# PHASE D18 — Settings

Build:

```text id="haj9p4"
System configuration UI

Default configuration

Admin preferences
```

Only include backend-supported settings.

---

# PHASE D19 — UX Hardening

Review:

```text id="u91xc3"
Loading states

Error states

Empty states

Accessibility

Responsive layout

Unsaved changes

Confirmations

Form error mapping
```

---

# PHASE D20 — Performance Hardening

Review:

```text id="7ry6xy"
Bundle size

Code splitting

Query caching

Builder performance

Large tables

Large plan performance
```

---

# PHASE D21 — Full Test Suite

Complete:

```text id="cd92iu"
Unit

Components

Integration

Critical E2E workflows
```

---

# PHASE D22 — Production Build

Complete:

```text id="rizq4l"
Production environment

Build

Static hosting

Nginx

HTTPS

Error monitoring

Production API configuration
```

---

# 117. Dashboard Critical End-to-End Scenario

Before MVP is considered complete:

```text id="ht6z8y"
ADMIN LOGIN
      ↓
CREATE USER
      ↓
CREATE EXERCISE
      ↓
CREATE WORKOUT PLAN
      ↓
CREATE WORKOUT VERSION
      ↓
CONFIGURE WEEK
      ↓
ADD EXERCISES
      ↓
CONFIGURE SETS / REPS / REST
      ↓
PREVIEW
      ↓
PUBLISH
      ↓
CREATE DIET
      ↓
ADD MEALS
      ↓
ADD OPTION GROUPS
      ↓
ADD FOOD OPTIONS
      ↓
PUBLISH
      ↓
ASSIGN WORKOUT
      ↓
ASSIGN DIET
      ↓
CONFIGURE WEIGHT TARGET
      ↓
CONFIGURE WATER TARGET
      ↓
CONFIGURE CARDIO TARGET
```

No SQL or code changes should be required.

---

# 118. Workout Configuration Acceptance Scenario

The most important dashboard-specific acceptance test is:

> A new administrator with no developer access can log in and create a completely different workout program.

They must be able to define:

```text id="jnwkfv"
Workout Name

Monday → Workout A

Tuesday → Rest

Wednesday → Workout B

etc.
```

Then for each workout:

```text id="8a58ph"
Exercise

Sets

Rep Range

Rest

Notes

Order
```

Then publish and assign it to a user.

If this requires a developer, the dashboard has failed one of its main requirements.

---

# 119. Diet Configuration Acceptance Scenario

Administrator can create:

```text id="8xidkg"
Meal
 ↓
Group
 ↓
Option
```

with arbitrary combinations.

Example:

```text id="el0aif"
Breakfast

Choose 1 carbohydrate

Choose 1 protein

Optional vegetables
```

without frontend/backend source changes.

---

# 120. Dashboard Definition of MVP

MVP dashboard requires:

1. Admin authentication.
2. Main layout.
3. User management.
4. Exercise library.
5. Workout plan management.
6. Workout versions.
7. Workout builder.
8. Workout publish workflow.
9. Diet plan management.
10. Diet versions.
11. Diet builder.
12. Diet publish workflow.
13. Workout assignments.
14. Diet assignments.
15. Weight goals.
16. Water targets.
17. Cardio targets.
18. Basic user monitoring.
19. Error handling.
20. Authorization UX.

---

# 121. Full V1 Dashboard

Full V1 additionally requires:

1. Reminder builder.
2. Notification monitoring.
3. User progress analytics.
4. Global analytics.
5. Audit logs.
6. Adherence configuration.
7. Advanced user history.
8. Improved charts.
9. Accessibility review.
10. Performance review.
11. Full E2E test suite.
12. Production monitoring.

---

# 122. Implementation Order

Actual coding order should be:

```text id="d0xabt"
1. React/Vite Bootstrap

2. App Providers

3. Router

4. API Client

5. Authentication

6. Dashboard Layout

7. Users

8. Exercise Library

9. Workout Plan List

10. Workout Versioning

11. Workout Builder

12. Workout Publish Flow

13. Food Library

14. Diet Plans

15. Diet Builder

16. Diet Publish Flow

17. Plan Assignments

18. Weight Goals

19. Water Targets

20. Cardio Targets

21. Reminder Rules

22. User Monitoring

23. Progress Analytics

24. Notifications

25. Audit Logs

26. Settings

27. UX Hardening

28. Testing

29. Performance

30. Production
```

---

# 123. Backend Dependency Order

Do not start a dashboard module until the corresponding backend API is sufficiently stable.

Example:

```text id="zgxyeh"
Backend Exercise API
      ↓
Dashboard Exercise Library
```

Then:

```text id="i85iud"
Backend Workout Configuration
      ↓
Dashboard Workout Builder
```

Then:

```text id="kxhrnq"
Backend Diet Configuration
      ↓
Dashboard Diet Builder
```

---

# 124. Recommended Parallel Workflow

Once API contracts are defined:

```text id="kd2ai0"
Backend Team
     ↕
OpenAPI
     ↕
Dashboard Team
```

Dashboard may initially use API mocks based on the exact OpenAPI schemas.

Mocks must not invent different contracts.

---

# 125. Dashboard Coding Rules

### Rule 1

No direct database access.

### Rule 2

No business-rule duplication where the backend is authoritative.

### Rule 3

No hard-coded personal workout plans.

### Rule 4

No hard-coded personal diet plans.

### Rule 5

No frontend-only authorization.

### Rule 6

All API calls use centralized client infrastructure.

### Rule 7

Complex data belongs in server-state cache, not random global stores.

### Rule 8

Forms have schemas.

### Rule 9

Published plans are displayed read-only.

### Rule 10

Every destructive operation has appropriate confirmation.

### Rule 11

Errors must be actionable.

### Rule 12

Large lists use server pagination.

### Rule 13

Workout and diet builders must preserve unsaved-change awareness.

### Rule 14

User-specific dates must clearly respect timezone.

### Rule 15

Configuration must be possible without a code deployment.

---

# 126. Most Important Dashboard Milestones

## Milestone 1

Admin can authenticate.

---

## Milestone 2

Admin can manage users.

---

## Milestone 3

Admin can manage the exercise library.

---

## Milestone 4

Admin can create and publish a complete workout.

This proves the workout configuration architecture.

---

## Milestone 5

Admin can create and publish a complete diet.

This proves nutrition configuration architecture.

---

## Milestone 6

Admin can assign personalized configuration to users.

---

## Milestone 7

Admin can monitor user execution.

---

## Milestone 8

Admin can manage reminders.

---

## Milestone 9

Admin can analyze progress.

---

## Milestone 10

Dashboard is secure, tested, responsive, and production-ready.

---

# 127. Recommended UI Workflow

The dashboard's primary workflow should feel like:

```text id="qjp8g4"
ADMIN
  ↓
USERS
  ↓
SELECT USER
  ↓
ASSIGN / CONFIGURE
  ↓
MONITOR
  ↓
ANALYZE
```

Configuration workflow:

```text id="de32h2"
PLAN
 ↓
DRAFT VERSION
 ↓
BUILD
 ↓
PREVIEW
 ↓
VALIDATE
 ↓
PUBLISH
 ↓
ASSIGN
```

---

# 128. Final Dashboard Architecture

```text id="k2q2wa"
                 React + Vite
                      │
        ┌─────────────┼─────────────┐
        │             │             │
      Router         Auth          UI
        │             │             │
        └─────────────┼─────────────┘
                      │
                  Features
                      │
     ┌────────────────┼──────────────────┐
     │                │                  │
   Users          Configuration       Analytics
                     │
          ┌──────────┼──────────┐
          │          │          │
       Workout      Diet      Targets
          │          │          │
          └──────────┼──────────┘
                     │
                API Layer
                     │
               /api/v1/admin
                     │
                 Node.js
```

---

# 129. Dashboard Final Objective

The dashboard is complete when an administrator can answer and control:

```text id="y53mep"
Who are my users?

Which users are active?

What workout is assigned to each user?

What diet is assigned?

What is their weight target?

What is their water target?

What is their cardio target?

How do I create a new workout?

How do I change a workout safely?

How do I create a diet?

How do I publish a new version?

How do I assign a plan?

How is a user progressing?

What has the user missed?

Are notifications being delivered?

What changes did administrators make?
```

without:

```text id="lmd70r"
SQL

backend code

Flutter code

manual database editing
```

---

# 130. Final Implementation Principle

The dashboard should be developed around:

```text id="n52jww"
API CONTRACT
      ↓
FEATURE MODULE
      ↓
FORM / TABLE / BUILDER
      ↓
BACKEND VALIDATION
      ↓
CACHE UPDATE
      ↓
USER FEEDBACK
```

Do not build static mock screens first and invent integration later.

The highest-priority dashboard feature after authentication and user management should be:

```text id="djpbzu"
EXERCISE LIBRARY
        ↓
WORKOUT BUILDER
        ↓
WORKOUT PUBLISHING
```

because that proves the core requirement:

> **An administrator can configure a completely new workout plan—including weekly schedule, training days, rest days, exercises, sets, repetitions, rest periods, notes, and ordering—and publish it without changing any application source code.**

After that, the next major milestone is the equivalent:

> **An administrator can create and publish a complete diet plan with meals, times, option groups, food alternatives, quantities, and nutritional data entirely through the dashboard.**

Once both are complete, the dashboard becomes the true configuration center of the platform.
