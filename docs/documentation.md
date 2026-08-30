# Fitness Tracking Platform

## Complete Product & Technical Documentation

**Version:** 1.0
**Architecture:** Multi-User Fitness Management & Tracking Platform

---

# 1. Project Overview

The Fitness Tracking Platform is a multi-user application designed to manage and track:

* Nutrition plans
* Workout plans
* Daily body weight
* Workout performance
* Cardio
* Water intake
* Goals
* Progress
* Daily adherence
* Missed activities
* Reminders
* Notifications

The system consists of three main applications:

```text
                         ┌──────────────────────┐
                         │       MySQL          │
                         │      Database        │
                         └──────────┬───────────┘
                                    │
                                    │
                         ┌──────────▼───────────┐
                         │      Node.js API     │
                         │      REST Backend    │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    │                                │
          ┌─────────▼─────────┐            ┌─────────▼─────────┐
          │ React + Vite      │            │ Flutter Mobile    │
          │ Admin Dashboard   │            │ User Application  │
          └───────────────────┘            └───────────────────┘
```

The Node.js backend is the central authority for business logic and data.

The MySQL database is the persistent source of truth.

The React + Vite application is used by administrators.

The Flutter application is used by fitness platform users.

---

# 2. Technology Stack

## Backend

* Node.js
* REST API
* MySQL
* JWT authentication
* Refresh tokens
* Password hashing
* Validation middleware
* Role-based authorization

## Admin Dashboard

* React
* Vite
* JavaScript/TypeScript as selected during implementation
* REST API communication
* Responsive dashboard UI
* Charts and analytics

## User Application

* Flutter
* Dart
* REST API
* Local persistence
* Offline synchronization
* Push notifications
* Local notifications

## Database

* MySQL
* Relational schema
* Foreign keys
* Indexes
* Transactions
* Unique constraints

---

# 3. Core Architecture Principle

The application must separate:

1. Configuration
2. User assignments
3. User execution
4. Historical records
5. Analytics

The most important distinction is:

```text
PLAN
=
What the user is supposed to do

LOG
=
What the user actually did
```

These must never be treated as the same data.

For example:

```text
Workout Plan

Leg Press
4 × 8–12
```

is different from:

```text
Workout Log

Set 1: 100 kg × 12
Set 2: 100 kg × 11
Set 3: 105 kg × 10
Set 4: 105 kg × 9
```

Changing the plan must never modify historical workout records.

---

# 4. Multi-User Architecture

The platform must support multiple users from the beginning.

Each user can have their own:

* Profile
* Diet plan
* Workout plan
* Goals
* Water target
* Cardio target
* Reminder preferences
* Notification preferences
* Weight history
* Diet history
* Workout history
* Cardio history
* Water history
* Progress history

The system must never assume that all users share the same plan.

---

# 5. User Roles

## 5.1 Super Administrator

The administrator can:

* Create users
* Edit users
* Disable users
* Reset user access
* Create diet plans
* Edit diet plans
* Delete/archive diet plans
* Create workout plans
* Edit workout plans
* Configure weekly schedules
* Create exercises
* Edit exercises
* Archive exercises
* Configure goals
* Configure cardio targets
* Configure water targets
* Configure reminders
* Assign plans to users
* View user progress
* View adherence
* View missed tasks
* View workout history
* View diet history
* View water history
* View cardio history
* View weight history
* View analytics
* Manage system settings

---

# 6. User

A normal user can:

* Log in
* View assigned diet
* View today's meals
* Record meals
* Select food options
* View assigned workout
* Record workout sets
* Record weight used
* Record repetitions
* Record cardio
* Record water
* Record daily weight
* View goals
* View progress
* View workout history
* View diet history
* View water history
* View cardio history
* View notifications
* Receive reminders
* Receive missed-task notifications
* Configure allowed notification preferences

Users cannot modify the underlying plan configuration unless explicitly authorized.

---

# 7. Admin Dashboard

The administrator interface must be implemented using:

```text
React + Vite
```

The dashboard is responsible for configuration and monitoring.

---

# 8. Admin Dashboard Main Sections

Recommended sections:

```text
Dashboard
Users
Diet Plans
Workout Plans
Exercise Library
Goals
Cardio
Water
Notifications
Reminders
Analytics
Settings
Audit Logs
```

---

# 9. Admin Dashboard Overview

The main dashboard should display system-level statistics.

Example:

```text
Total Users
Active Users
Inactive Users
Users Completing Today's Workout
Users With Missed Tasks
Average Diet Adherence
Average Workout Adherence
Average Cardio Adherence
Average Water Adherence
```

The administrator should be able to filter statistics by:

* Date
* User
* Plan
* Status

---

# 10. User Management

Administrators can create users.

User information may include:

* First name
* Last name
* Email
* Password/reset mechanism
* Date of birth if required
* Height
* Starting weight
* Target weight
* Time zone
* Account status
* Assigned diet plan
* Assigned workout plan
* Notification preferences

Only fields required by the product should be stored.

---

# 11. User Profile

Each user should have a profile page.

The admin should be able to view:

```text
User Information
Current Plan
Starting Weight
Current Weight
Target Weight
Weight Lost
Remaining Weight
Goal Progress
Diet Adherence
Workout Adherence
Cardio Adherence
Water Adherence
Recent Notifications
Recent Missed Tasks
```

---

# 12. Diet Management

The diet must be fully configurable through the admin dashboard.

The diet must not be hard-coded into the Flutter application.

The administrator should be able to:

* Create diet plans
* Edit diet plans
* Archive diet plans
* Add meals
* Remove meals
* Reorder meals
* Configure meal times
* Add foods
* Configure quantities
* Configure units
* Create alternatives
* Create option groups
* Configure nutritional values
* Enable/disable foods
* Assign plans to users

---

# 13. Diet Structure

The conceptual structure should be:

```text
Diet Plan
    │
    ├── Meal
    │     │
    │     ├── Option Group
    │     │      ├── Food Option
    │     │      ├── Food Option
    │     │      └── Food Option
    │     │
    │     └── Option Group
    │            ├── Food Option
    │            ├── Food Option
    │            └── Food Option
    │
    └── Meal
```

This allows the administrator to create alternatives.

For example, a meal could contain:

```text
Carbohydrate
    Option A
    Option B
    Option C

Protein
    Option A
    Option B
    Option C
```

The user selects what they actually consumed.

---

# 14. Food Configuration

Each food option may contain:

```text
Food Name
Quantity
Unit
Calories
Protein
Carbohydrates
Fat
Notes
Active Status
```

Nutritional values should only be calculated when configured by the administrator or obtained from a trusted nutritional source.

The application must not invent nutritional values.

---

# 15. Meal Tracking

The user should be able to record whether a meal was completed.

Example:

```text
Breakfast
✓ Completed
```

If the meal contains alternatives, the user should also be able to specify what was consumed.

Example:

```text
Breakfast

Carbohydrate:
French Bread

Protein:
Eggs
```

The selected foods should be stored in the user's meal log.

---

# 16. Nutrition Adherence

The system should calculate:

* Meals completed
* Meals missed
* Meals partially completed
* Daily diet adherence
* Weekly diet adherence
* Monthly diet adherence

If calories/macros are configured, the system may also calculate:

* Daily calories
* Protein
* Carbohydrates
* Fat

---

# 17. Workout Management

The workout system must be **fully configurable from the React + Vite admin dashboard**.

Workout plans must never be hard-coded in React or Flutter.

Administrators must be able to create and manage workouts without modifying source code.

---

# 18. Workout Plan Configuration

An administrator can create:

```text
Workout Plan
```

with:

* Plan name
* Description
* Goal
* Status
* Start date
* End date
* Notes
* Version

A plan contains a weekly schedule.

---

# 19. Weekly Workout Schedule

The administrator must be able to configure each day.

Example interface:

| Day       | Workout      | Type          | Active |
| --------- | ------------ | ------------- | ------ |
| Monday    | Configurable | Training/Rest | Yes    |
| Tuesday   | Configurable | Training/Rest | Yes    |
| Wednesday | Configurable | Training/Rest | Yes    |
| Thursday  | Configurable | Training/Rest | Yes    |
| Friday    | Configurable | Training/Rest | Yes    |
| Saturday  | Configurable | Training/Rest | Yes    |
| Sunday    | Configurable | Training/Rest | Yes    |

The example above describes the configuration mechanism only.

The actual workout schedule is entered through the dashboard.

The system must not hard-code a specific user's workout schedule.

---

# 20. Workout Day Configuration

Each workout day contains an ordered list of exercises.

Administrators can:

* Add exercises
* Remove exercises
* Reorder exercises
* Change exercises
* Change sets
* Change repetitions
* Change rest period
* Add notes
* Add instructions
* Configure RIR
* Enable/disable exercises

---

# 21. Exercise Configuration

Each workout exercise should support:

| Field        | Description            |
| ------------ | ---------------------- |
| Exercise     | Exercise from library  |
| Sets         | Number of working sets |
| Minimum reps | Minimum target         |
| Maximum reps | Maximum target         |
| Rest         | Rest duration          |
| Order        | Exercise order         |
| Notes        | Technique instructions |
| Video URL    | Optional video         |
| RIR target   | Optional target        |
| Active       | Exercise status        |

---

# 22. Exercise Library

Exercises should exist in a reusable exercise library.

Each exercise can contain:

```text
Name
Description
Muscle Group
Equipment
Instructions
Video URL
Active Status
```

Possible categories:

```text
Chest
Back
Shoulders
Biceps
Triceps
Quadriceps
Hamstrings
Glutes
Calves
Core
Cardio
Other
```

The administrator can:

* Create exercises
* Edit exercises
* Archive exercises
* Categorize exercises
* Add instructions
* Add videos

Archived exercises must remain available for historical workout records.

---

# 23. Workout Builder

The admin dashboard should provide a visual workout builder.

Recommended workflow:

```text
Workout Plans
      ↓
Create/Edit Plan
      ↓
Weekly Schedule
      ↓
Select Day
      ↓
Add Exercise
      ↓
Configure Sets/Reps/Rest
      ↓
Add Notes
      ↓
Reorder Exercises
      ↓
Save
      ↓
Assign Plan
```

Drag-and-drop exercise ordering is recommended.

---

# 24. No Hard-Coded Workout Plans

The applications must never contain hard-coded workout logic such as:

```javascript
if (day === "monday") {
    // fixed workout
}
```

or:

```javascript
const workout = [...]
```

Workout plans must come from the backend API.

The Flutter app should request the currently assigned plan from the backend.

Example:

```text
GET /api/user/workout/today
```

---

# 25. Workout Plan Assignment

Administrators can assign workout plans to individual users.

Conceptually:

```text
User
  ↓
Workout Plan
  ↓
Weekly Schedule
  ↓
Workout Day
  ↓
Exercises
```

Multiple users can have different plans.

---

# 26. Workout Plan Versioning

Workout plans must support versions.

When a plan is changed, historical records must remain associated with the previous version.

Example:

```text
Workout Plan V1
January

Workout Plan V2
February
```

Historical workouts must not change when V2 is created.

---

# 27. Workout Execution

The Flutter application displays the configured workout.

The user records actual performance.

Example:

```text
Exercise
Target: 4 × 8–12

Set 1
Weight: 100 kg
Reps: 12

Set 2
Weight: 100 kg
Reps: 11

Set 3
Weight: 105 kg
Reps: 10

Set 4
Weight: 105 kg
Reps: 9
```

The system stores the actual performance separately from the plan.

---

# 28. Workout Tracking Fields

Each workout set can contain:

```text
Weight
Repetitions
RIR
Duration if applicable
Notes
Completed
```

The system should allow exercises to have different tracking requirements.

For example:

* Weight + reps
* Duration
* Distance
* Reps only

---

# 29. Workout History

When starting an exercise, the Flutter app should display relevant historical information.

Example:

```text
Previous Workout

Leg Press

100 kg × 12
100 kg × 11
105 kg × 10
105 kg × 9
```

This allows users to compare current performance with previous sessions.

---

# 30. Progressive Overload

The application should provide historical performance information.

It should not automatically change the user's training weight unless an explicit progression system is implemented and enabled.

The user remains responsible for entering the actual training weight.

---

# 31. Cardio System

Cardio targets must be configurable from the admin dashboard.

Configuration may include:

```text
Activity Type
Target Duration
Minimum Duration
Maximum Duration
Target Speed
Target Incline
Frequency
Notes
```

Example configuration:

```text
Activity:
Treadmill

Target Duration:
25–30 minutes

Incline:
12

Speed:
5–6 km/h
```

These values are examples of configuration fields and must not be hard-coded.

---

# 32. Cardio Tracking

The user can record:

```text
Activity
Duration
Speed
Incline
Distance
Calories if available
Notes
```

The system calculates target completion.

Example:

```text
Target: 30 minutes
Actual: 28 minutes

Completion:
93.3%
```

---

# 33. Water Tracking

Every user should have a configurable daily water target.

Example:

```text
Daily Target
3000 ml
```

The user can add water through quick buttons.

Example:

```text
250 ml
500 ml
750 ml
1000 ml
```

The user can also manually enter an amount.

---

# 34. Water Progress

The application should display:

```text
Water

2,000 / 3,000 ml

66.7%
```

The system should support:

* Daily intake
* Weekly average
* Monthly average
* Target completion
* Missed target
* Remaining amount

---

# 35. Weight Tracking

Users can enter their body weight every day.

Fields:

```text
User
Date
Weight
Unit
Optional Note
Created At
```

The system should prevent accidental duplicate daily records where appropriate.

---

# 36. Weight Analytics

The application should calculate:

* Current weight
* Starting weight
* Target weight
* Total weight lost
* Remaining weight
* Daily change
* Weekly change
* 7-day average
* Monthly trend

The 7-day average is important because daily weight naturally fluctuates.

---

# 37. Goal System

Each user can have goals.

Possible goal types:

```text
Weight
Body weight
Workout performance
Cardio
Water
Diet adherence
```

A weight goal may contain:

```text
Starting Weight
Target Weight
Start Date
Target Date
```

---

# 38. Weight Goal Progress

The system calculates:

```text
progress =
(startingWeight - currentWeight)
/
(startingWeight - targetWeight)
× 100
```

The value should be limited to:

```text
0%–100%
```

The UI should show:

```text
Starting Weight
Current Weight
Target Weight
Weight Lost
Remaining
Progress %
```

---

# 39. Daily Tracking System

Every user should have a daily activity view.

Example structure:

```text
Today's Tasks

Nutrition
□ Breakfast
□ Snack
□ Lunch
□ Snack
□ Dinner

Workout
□ Workout

Cardio
□ Cardio

Hydration
□ Water Target

Body
□ Weight
```

The actual number of meals/tasks comes from configuration.

---

# 40. Daily Log

A daily log acts as the summary of the user's day.

Conceptually:

```text
Daily Log
 ├── Weight
 ├── Meals
 ├── Workout
 ├── Cardio
 ├── Water
 ├── Notifications
 └── Adherence
```

The underlying detailed records should remain in separate tables.

---

# 41. Daily Adherence

The system should calculate daily adherence.

Possible categories:

```text
Diet
Workout
Cardio
Water
Weight
```

The weighting should be configurable.

Example:

| Category | Example Weight |
| -------- | -------------: |
| Diet     |            35% |
| Workout  |            25% |
| Cardio   |            15% |
| Water    |            15% |
| Weight   |            10% |

These are configuration examples and should not be hard-coded.

---

# 42. Weekly Progress

The user should see a weekly summary.

Example:

```text
Weekly Summary

Weight
Starting Average: X
Ending Average: Y

Weight Change
-X kg

Diet
XX%

Workout
X / X

Cardio
X / X

Water
XX%

Overall Adherence
XX%
```

---

# 43. Progress Charts

The Flutter application should display:

## Weight Chart

* Daily weight
* 7-day average
* Goal line

## Strength Chart

* Exercise performance over time
* Weight progression
* Repetition progression

## Cardio Chart

* Minutes per day
* Weekly cardio minutes
* Target vs actual

## Water Chart

* Daily water
* Weekly average
* Target

## Adherence Chart

* Daily adherence
* Weekly adherence
* Monthly adherence

---

# 44. Missed Activity System

The backend must detect activities that were expected but not completed.

Examples:

```text
Meal not logged
Workout not completed
Cardio not logged
Water target incomplete
Weight not recorded
```

The system should determine when an activity becomes overdue based on its configured schedule.

---

# 45. Notifications

The application must provide an in-app notification system.

Notification categories include:

### Meal Reminder

```text
Breakfast is scheduled for 9:00 AM.
```

### Missed Meal

```text
You haven't logged your lunch yet.
```

### Workout Reminder

```text
Today's workout is ready.
```

### Cardio Reminder

```text
You haven't completed today's cardio.
```

### Water Reminder

```text
You are below your water target.
```

### Weight Reminder

```text
Don't forget to record today's weight.
```

### Progress Notification

```text
Great job! You completed your weekly goal.
```

---

# 46. Notification Center

The Flutter application should have a notification screen.

Notifications can have:

```text
Unread
Read
Dismissed
```

The user should be able to:

* Open notification
* Mark as read
* Dismiss notification
* Navigate to the related task

---

# 47. Notification Preferences

Users should be able to configure notification preferences.

Example:

```text
Water Reminders
Enabled

Meal Reminders
Enabled

Workout Reminders
Enabled

Cardio Reminders
Enabled

Weight Reminder
Enabled
```

Users should be able to disable categories where permitted.

---

# 48. Reminder Configuration

Administrators should be able to configure reminder rules.

Possible settings:

```text
Reminder Type
Trigger Time
Repeat Interval
Grace Period
Active Status
```

Example:

```text
Water reminder
Every 90 minutes
08:00–22:00
```

The values should be configurable.

---

# 49. Notification Deduplication

The system must prevent repeated notifications for the same event.

For example, the user should not receive:

```text
Lunch missed
Lunch missed
Lunch missed
Lunch missed
```

every few minutes.

Notifications should use:

* Event identifiers
* Cooldowns
* Notification status
* Scheduled timestamps

---

# 50. Time Zones

Each user must have a timezone.

Example:

```text
Asia/Beirut
```

The backend must use the user's timezone when determining:

* Meal schedules
* Workout schedules
* Cardio reminders
* Water reminders
* Weight reminders
* Missed tasks

Server timestamps should be stored consistently.

---

# 51. Flutter Mobile Application

The user application must be implemented with:

```text
Flutter + Dart
```

The Flutter application communicates only with the Node.js API.

It must not connect directly to MySQL.

---

# 52. Flutter Architecture

Recommended feature-based architecture:

```text
lib/
├── core/
│   ├── networking/
│   ├── storage/
│   ├── notifications/
│   ├── authentication/
│   ├── theme/
│   └── utilities/
│
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── diet/
│   ├── workout/
│   ├── weight/
│   ├── water/
│   ├── cardio/
│   ├── progress/
│   └── notifications/
│
└── main.dart
```

The UI layer should remain separate from networking and data persistence.

---

# 53. Flutter Navigation

Recommended bottom navigation:

```text
Home
Plan
Progress
Notifications
Profile
```

---

# 54. Flutter Home Screen

The home screen should provide an overview of today's status.

Example:

```text
Good Morning

Today's Weight
105.2 kg

Daily Progress
████████░░ 80%

Nutrition
6 / 8 completed

Workout
Pull

Cardio
28 / 30 min

Water
2.4 / 3.0 L

Tasks
✓ Breakfast
✓ Snack
✓ Lunch
○ Cardio
○ Water
○ Dinner
```

The actual values are retrieved from the backend.

---

# 55. Flutter Diet Screen

The user can:

* View today's meals
* View meal times
* View food options
* Select consumed food
* Mark meals complete
* View nutritional information when configured

---

# 56. Flutter Workout Screen

The user sees:

```text
Today's Workout

Exercise
Target

Set 1
Weight
Reps

Set 2
Weight
Reps

Set 3
Weight
Reps
```

Previous performance should be visible.

---

# 57. Flutter Weight Screen

The user can:

* Enter today's weight
* View previous measurements
* View chart
* View 7-day average
* View goal progress

---

# 58. Flutter Water Screen

The user can:

* Add water
* Manually enter water
* View today's total
* View target
* View remaining amount
* View historical intake

---

# 59. Flutter Cardio Screen

The user can record:

```text
Activity
Duration
Speed
Incline
Distance
Notes
```

The app displays target vs actual.

---

# 60. Flutter Progress Screen

The progress screen should display:

```text
Weight Progress
Workout Progress
Cardio Progress
Water Progress
Diet Adherence
Goal Progress
```

Charts should be simple and readable.

---

# 61. Offline Support

The Flutter application should support basic offline logging.

For example, if the user records:

```text
Water +500 ml
```

without internet access, the application should store the record locally.

When the connection returns:

```text
Local Record
      ↓
Sync Queue
      ↓
Node.js API
      ↓
MySQL
```

---

# 62. Sync Status

Local records should have synchronization states:

```text
pending
synced
failed
```

Failed records should be retried.

The application should avoid creating duplicate server records during synchronization.

---

# 63. Backend Architecture

Recommended Node.js structure:

```text
backend/
├── src/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── repositories/
│   ├── middleware/
│   ├── validators/
│   ├── jobs/
│   ├── notifications/
│   ├── auth/
│   ├── database/
│   └── app/
│
├── migrations/
├── seeds/
├── tests/
├── package.json
└── .env.example
```

Business logic should live in services rather than directly inside route handlers.

---

# 64. REST API

Suggested API structure:

```text
/api/auth
/api/users
/api/plans
/api/diets
/api/meals
/api/foods
/api/workouts
/api/exercises
/api/weight
/api/cardio
/api/water
/api/goals
/api/progress
/api/notifications
/api/reminders
/api/admin
```

---

# 65. Authentication

Authentication should use:

```text
Access Token
+
Refresh Token
```

Passwords must be securely hashed.

Plaintext passwords must never be stored.

Access tokens should have an expiration time.

Refresh tokens should be securely managed and revocable.

---

# 66. Authorization

Every protected endpoint must verify the authenticated user.

The backend must not trust a user ID supplied by the client.

For example:

```text
GET /api/users/123/progress
```

must verify that:

```text
Authenticated user = user 123
```

unless the requester has administrator privileges.

---

# 67. API Response Format

Successful response:

```json
{
  "success": true,
  "data": {}
}
```

Error response:

```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR"
}
```

The API should use consistent HTTP status codes.

---

# 68. API Validation

Validation must happen on the backend.

Examples:

```text
Weight:
20–500 kg

Water:
0–20,000 ml

Workout weight:
>= 0

Repetitions:
>= 0

Cardio duration:
>= 0
```

Frontend validation is useful but cannot replace backend validation.

---

# 69. Database Architecture

The database should be normalized and relational.

Conceptual tables:

```text
users
roles
refresh_tokens

fitness_plans
plan_assignments

diet_plans
diet_meals
diet_option_groups
diet_food_options
foods

workout_plans
workout_plan_days
workout_plan_exercises
exercises

goals

daily_logs
weight_logs
meal_logs
meal_log_items

workout_logs
workout_log_exercises
workout_sets

cardio_logs
water_logs

notification_preferences
notifications
reminder_rules

progress_snapshots

audit_logs
```

The final schema may use different names, but the logical separation should remain.

---

# 70. User Relationships

Conceptually:

```text
User
 │
 ├── Goals
 │
 ├── Plan Assignments
 │      ├── Diet Plan
 │      └── Workout Plan
 │
 ├── Weight Logs
 │
 ├── Daily Logs
 │      ├── Meal Logs
 │      ├── Workout Logs
 │      ├── Cardio Logs
 │      └── Water Logs
 │
 └── Notifications
```

---

# 71. Workout Relationships

Configuration:

```text
workout_plans
      ↓
workout_plan_days
      ↓
workout_plan_exercises
      ↓
exercises
```

Execution:

```text
workout_logs
      ↓
workout_log_exercises
      ↓
workout_sets
```

Configuration and execution must remain separate.

---

# 72. Diet Relationships

Configuration:

```text
diet_plans
      ↓
diet_meals
      ↓
diet_option_groups
      ↓
diet_food_options
      ↓
foods
```

Execution:

```text
meal_logs
      ↓
meal_log_items
```

---

# 73. Daily Logs

A daily log provides a summary of the user's day.

Conceptually:

```text
daily_logs

user_id
date
weight_completed
diet_completed
workout_completed
cardio_completed
water_completed
daily_score
created_at
updated_at
```

The detailed records remain in their respective tables.

---

# 74. Database Constraints

Important constraints should include:

* Foreign keys
* Unique constraints
* Not-null constraints where appropriate
* Check constraints where supported and useful

For example:

```text
user_id + date
```

can be unique for daily weight records.

---

# 75. Database Indexes

Important query fields should be indexed.

Potential indexes include:

```text
users.email

weight_logs(user_id, recorded_at)

water_logs(user_id, recorded_at)

cardio_logs(user_id, recorded_at)

daily_logs(user_id, date)

notifications(user_id, status, scheduled_at)

workout_logs(user_id, workout_date)
```

Indexes should be based on real query patterns.

---

# 76. Transactions

Database transactions should be used for operations that require atomicity.

For example:

Creating a workout:

```text
Workout Log
+
Workout Exercises
+
Workout Sets
```

should either all succeed or all fail.

---

# 77. Plan Versioning

Diet and workout plans should support versioning.

A user assignment should identify the applicable version.

Historical records must not change because an administrator edits the current plan.

---

# 78. Plan Snapshot Principle

When a user executes a plan, historical records should retain enough information to understand what was planned at that time.

This prevents historical analytics from becoming inaccurate after administrators modify plans.

---

# 79. Notification Architecture

The backend should manage notification rules.

Conceptually:

```text
Schedule
     ↓
Reminder Engine
     ↓
Task Status
     ↓
Missed Task Detection
     ↓
Notification
     ↓
Push/Local Notification
```

Notifications should be generated according to user timezone and configured schedules.

---

# 80. Notification Data

A notification can contain:

```text
user_id
type
title
message
related_entity
related_entity_id
scheduled_at
sent_at
read_at
status
created_at
```

Possible statuses:

```text
pending
sent
delivered
read
dismissed
failed
```

---

# 81. Missed Task Detection

The backend should periodically evaluate expected activities.

For example:

```text
Expected:
Lunch at 13:00

Current time:
14:00

Lunch log:
Missing

Result:
Create missed-lunch notification
```

A grace period should be configurable.

---

# 82. Daily Progress Score

The application may calculate an adherence score based on configurable categories.

For example:

```text
Diet
Workout
Cardio
Water
Weight
```

The formula should be centralized in backend business logic.

The frontend should not independently calculate the official score.

---

# 83. Weight Progress Logic

The backend should calculate:

```text
Current Weight
Starting Weight
Target Weight
Weight Lost
Remaining Weight
Progress Percentage
7-Day Average
Weekly Change
```

The Flutter app displays these values.

---

# 84. Analytics Architecture

The backend should provide summarized endpoints.

Instead of downloading thousands of records:

```text
GET /api/users/:id/progress
```

can return aggregated information.

Example:

```json
{
  "currentWeight": 105.2,
  "startingWeight": 108.4,
  "targetWeight": 95,
  "weightLost": 3.2,
  "remainingWeight": 10.2,
  "progressPercent": 23.88,
  "dietAdherence": 91,
  "workoutAdherence": 100,
  "cardioAdherence": 87,
  "waterAdherence": 83
}
```

---

# 85. Admin Analytics

Administrators should be able to view:

## User Statistics

* Current weight
* Starting weight
* Target weight
* Weight change
* Progress percentage

## Diet

* Completion
* Missed meals
* Adherence

## Workout

* Workout completion
* Exercise performance
* Strength progression

## Cardio

* Minutes
* Completion
* Target vs actual

## Water

* Daily intake
* Average intake
* Target completion

---

# 86. User Analytics

Users should be able to see:

```text
Weight Trend
Workout Progress
Cardio Progress
Water Progress
Diet Adherence
Goal Progress
```

The interface should focus on trends rather than overwhelming the user with raw data.

---

# 87. Weight Trend Principle

Daily weight naturally fluctuates.

The system should therefore emphasize:

```text
Daily Weight
+
7-Day Average
+
Long-Term Trend
```

rather than treating a single daily measurement as a success/failure.

---

# 88. Streaks

The platform may optionally support:

* Diet streak
* Workout streak
* Water streak
* Weight logging streak

Streaks should be secondary motivational features rather than the primary measurement of progress.

---

# 89. Audit Logs

Administrator actions should be recorded.

Example:

```text
Admin changed user target weight

Old:
95 kg

New:
90 kg
```

Audit records may contain:

```text
admin_id
action
entity
entity_id
old_value
new_value
created_at
```

---

# 90. Security Requirements

The application must implement:

* Secure password hashing
* JWT expiration
* Refresh token management
* Role-based access control
* Backend authorization
* Input validation
* SQL parameterization
* Rate limiting
* CORS configuration
* Secure HTTP headers
* Environment variables
* No database credentials in frontend
* No secrets in source control
* Safe logging

---

# 91. Environment Variables

Secrets must be stored in environment variables.

Example:

```text
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD

JWT_SECRET
JWT_REFRESH_SECRET

API_URL

PUSH_NOTIFICATION_CONFIGURATION
```

Provide:

```text
.env.example
```

Do not commit real credentials.

---

# 92. Project Structure

Recommended monorepo:

```text
fitness-platform/
│
├── backend/
│   ├── src/
│   ├── migrations/
│   ├── seeds/
│   ├── tests/
│   ├── package.json
│   └── .env.example
│
├── admin-dashboard/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── .env.example
│
├── mobile-app/
│   ├── lib/
│   ├── android/
│   ├── ios/
│   └── pubspec.yaml
│
└── README.md
```

---

# 93. Admin React Structure

Recommended:

```text
src/
├── components/
├── layouts/
├── pages/
├── features/
│   ├── users/
│   ├── diets/
│   ├── workouts/
│   ├── exercises/
│   ├── goals/
│   ├── notifications/
│   └── analytics/
├── services/
├── hooks/
├── auth/
├── routes/
└── utils/
```

---

# 94. Admin Routes

Suggested routes:

```text
/login

/dashboard

/users
/users/:id

/diets
/diets/:id

/workouts
/workouts/:id

/exercises

/goals

/cardio

/water

/notifications

/reminders

/analytics

/settings

/audit-logs
```

---

# 95. Flutter Features

Recommended feature structure:

```text
auth
dashboard
diet
workout
weight
water
cardio
progress
notifications
profile
```

Each feature should have:

* Models
* API/data layer
* Repository
* State management
* Screens
* Widgets

The exact state-management solution can be selected during implementation.

---

# 96. Offline Data Rules

Offline mode should allow the user to record:

* Water
* Weight
* Meals
* Workout sets
* Cardio

The application should synchronize records when internet connectivity returns.

The backend remains authoritative.

---

# 97. Synchronization Conflict Handling

The system should avoid silent overwrites.

For example, if the same workout record was modified locally and remotely, the synchronization system should have a deterministic conflict policy.

For append-only records such as water entries, duplicate prevention is more important than conflict merging.

---

# 98. Seed Data Policy

The system must provide database migrations and a seed mechanism for development/testing.

However, this documentation intentionally does **not define or require the user's personal diet or workout data to be seeded**.

The actual diet and workout configuration must be entered through the admin dashboard.

The purpose of the platform is to make those plans configurable.

---

# 99. Configuration vs Seed Data

The following must be configurable:

```text
Diet Plans
Meals
Meal Times
Food Options
Nutrition Values

Workout Plans
Weekly Schedule
Exercises
Sets
Reps
Rest
Notes

Cardio Targets
Water Targets
Goals
Reminder Rules
Notification Preferences
```

None of these should require source-code changes.

---

# 100. Testing

## Backend

Test:

* Authentication
* Authorization
* User management
* Diet CRUD
* Workout CRUD
* Exercise CRUD
* Plan assignment
* Plan versioning
* Weight tracking
* Water tracking
* Cardio tracking
* Workout logging
* Meal logging
* Goal calculations
* Progress calculations
* Notification generation
* Missed-task detection

## Admin

Test:

* Login
* Permissions
* User CRUD
* Diet configuration
* Workout configuration
* Exercise management
* Plan assignment
* Analytics

## Flutter

Test:

* Authentication
* Dashboard
* Diet tracking
* Workout tracking
* Weight tracking
* Water tracking
* Cardio tracking
* Progress
* Notifications
* Offline logging
* Synchronization

---

# 101. Error Handling

The backend should provide consistent errors.

Example:

```json
{
  "success": false,
  "message": "Workout set could not be saved",
  "code": "WORKOUT_SET_ERROR"
}
```

Errors should be logged server-side without exposing sensitive information to the client.

---

# 102. Logging

Backend logs should contain:

* Request information
* Errors
* Important system events
* Notification failures
* Synchronization failures

Sensitive information must not be logged.

Passwords and authentication secrets must never appear in logs.

---

# 103. Performance Requirements

The system should:

* Paginate large lists
* Avoid unnecessary API requests
* Use indexed database queries
* Aggregate analytics server-side
* Cache appropriate configuration data
* Avoid loading complete user histories when only summaries are needed

---

# 104. API Pagination

Large resources should support pagination.

Example:

```text
GET /api/users?page=1&limit=25
```

Responses may contain:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 150
  }
}
```

---

# 105. API Filtering

Admin APIs should support filtering.

Examples:

```text
/users?status=active

/notifications?status=unread

/workouts?active=true

/users/:id/weight?from=2026-08-01&to=2026-08-30
```

---

# 106. Deployment

The platform should be deployable on a Linux server.

Deployment components:

```text
Node.js API
MySQL
React/Vite Admin
Flutter Mobile Application
Reverse Proxy
HTTPS
```

The frontend must never expose database credentials.

---

# 107. Production Environment

Production should use:

```text
HTTPS
Secure cookies/token handling where applicable
Environment variables
Production database credentials
Database backups
Error monitoring
Application logging
Process manager
Reverse proxy
```

---

# 108. Database Backups

The production MySQL database should have automated backups.

Backups should be tested periodically.

At minimum:

```text
Daily backup
Retention policy
Off-server backup where possible
```

---

# 109. Health Check

The backend should provide a health endpoint.

Example:

```text
GET /api/health
```

Response:

```json
{
  "success": true,
  "status": "healthy"
}
```

The endpoint may also check database connectivity.

---

# 110. Important Business Logic Rule

The backend is the authoritative source for:

* Plan assignment
* Progress
* Adherence
* Goals
* Missed tasks
* Notification generation
* Historical records

Flutter and React should display and submit data.

They should not independently redefine business rules.

---

# 111. Main Product Workflow

The complete platform workflow is:

```text
ADMIN CREATES PLAN
        ↓
ADMIN CONFIGURES DIET
        ↓
ADMIN CONFIGURES WORKOUT
        ↓
ADMIN CONFIGURES CARDIO
        ↓
ADMIN CONFIGURES WATER
        ↓
ADMIN CONFIGURES GOALS
        ↓
ADMIN ASSIGNS PLAN TO USER
        ↓
USER OPENS FLUTTER APP
        ↓
APP LOADS TODAY'S PLAN
        ↓
USER RECORDS ACTIVITIES
        ↓
BACKEND SAVES DATA
        ↓
BACKEND CALCULATES PROGRESS
        ↓
SYSTEM DETECTS MISSED ACTIVITIES
        ↓
NOTIFICATION IS GENERATED
        ↓
USER COMPLETES MISSED TASK
        ↓
WEEKLY/MONTHLY ANALYTICS
        ↓
ADMIN CAN MONITOR USER
```

---

# 112. Example Daily Experience

The user's Flutter application may display:

```text
Good Morning

Today's Progress
████████░░ 80%

Weight
105.2 kg

Goal
95 kg

Nutrition
6 / 8

Workout
Completed

Cardio
28 / 30 min

Water
2.4 / 3.0 L
```

Below this:

```text
Today's Tasks

✓ Breakfast
✓ Morning Snack
✓ Lunch
✓ Afternoon Snack
○ Cardio
○ Water Target
○ Dinner
```

---

# 113. Missed Tasks Screen

A dedicated missed-task screen should show:

```text
Needs Attention

⚠ Cardio not completed

⚠ Water target incomplete

⚠ Dinner not logged
```

Each item should provide a direct action.

Example:

```text
Complete Cardio
```

opens the cardio tracking interface.

---

# 114. Notification-to-Action Flow

Notifications should be actionable.

Example:

```text
Notification:
"You haven't logged your water intake recently."

Tap

↓ 

Water Screen

↓ 

+500 ml
```

This minimizes friction.

---

# 115. UX Principle

The application should make logging extremely fast.

Common activities should require minimal interaction.

For example:

```text
+250 ml
+500 ml
+750 ml
+1000 ml
```

for water.

Workout sets should be quick to enter.

Meals should use selectable options rather than requiring the user to type everything.

---

# 116. Data Ownership

Every user-specific record must belong to a user.

Examples:

```text
weight_logs.user_id

water_logs.user_id

cardio_logs.user_id

meal_logs.user_id

workout_logs.user_id
```

Users must only access their own records.

Administrators may access records according to their role.

---

# 117. Historical Integrity

Historical data must never be silently changed because of configuration changes.

Examples:

Changing:

```text
Workout Plan
```

must not modify:

```text
Old Workout Logs
```

Changing:

```text
Diet Plan
```

must not modify:

```text
Old Meal Logs
```

Changing:

```text
Target Weight
```

may change current progress calculations, but previous historical measurements must remain untouched.

---

# 118. Extensibility

The system should be designed so additional tracking types can be added later.

Possible future features:

```text
Sleep
Steps
Body Measurements
Body Fat Percentage
Photos
Supplements
Calories
Macros
Measurements
Personal Records
Exercise RIR
Exercise Tempo
Mood
Energy
Notes
```

The architecture should not prevent these additions.

---

# 119. Important Separation of Responsibilities

## Node.js

Responsible for:

* Authentication
* Authorization
* Business logic
* Data validation
* Calculations
* Notifications
* Reminder processing
* Progress
* Analytics
* Database access

## MySQL

Responsible for:

* Persistent data
* Relationships
* Constraints
* Historical records

## React/Vite Admin

Responsible for:

* Configuration
* Administration
* Monitoring
* Analytics visualization

## Flutter

Responsible for:

* User experience
* Data entry
* Offline storage
* Displaying plans
* Displaying progress
* Notifications

---

# 120. Final Architecture

The final architecture should follow:

```text
                         ┌─────────────────────┐
                         │       MySQL         │
                         │                     │
                         │ Plans               │
                         │ Users               │
                         │ Logs                │
                         │ Progress            │
                         │ Notifications       │
                         └──────────┬──────────┘
                                    │
                                    │
                         ┌──────────▼──────────┐
                         │      Node.js        │
                         │       REST API      │
                         │                     │
                         │ Auth                │
                         │ Business Logic      │
                         │ Progress            │
                         │ Notifications       │
                         │ Reminders           │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    │                                │
          ┌─────────▼─────────┐            ┌─────────▼─────────┐
          │ React + Vite      │            │ Flutter           │
          │ Admin Dashboard   │            │ User Application  │
          │                   │            │                   │
          │ Configure         │            │ Execute Plan      │
          │ Monitor           │            │ Track Activities  │
          │ Analyze           │            │ View Progress     │
          └───────────────────┘            └───────────────────┘
```

---

# 121. Final Requirements Summary

The completed platform must provide:

### Multi-user

* Multiple accounts
* User isolation
* Admin management
* Role-based authorization

### Nutrition

* Configurable diet plans
* Configurable meals
* Configurable meal times
* Food alternatives
* Quantities
* Nutritional information
* Meal tracking
* Diet adherence

### Workout

* Fully configurable workout plans
* Weekly schedules
* Exercise library
* Sets
* Repetitions
* Rest periods
* Notes
* Exercise ordering
* Plan assignment
* Plan versioning
* Actual workout logging
* Weight/repetition tracking
* Workout history

### Cardio

* Configurable targets
* Duration
* Speed
* Incline
* Distance
* Actual vs target

### Water

* Configurable daily target
* Quick-add amounts
* Manual amounts
* Daily history
* Weekly averages
* Target completion

### Weight

* Daily weight entry
* Weight history
* 7-day average
* Weight trend
* Starting weight
* Target weight
* Weight lost
* Remaining weight
* Goal progress

### Notifications

* Meal reminders
* Workout reminders
* Cardio reminders
* Water reminders
* Weight reminders
* Missed-task notifications
* Progress notifications
* Notification center
* Notification preferences

### Analytics

* Daily progress
* Weekly progress
* Monthly progress
* Diet adherence
* Workout adherence
* Cardio adherence
* Water adherence
* Weight trends
* Strength progression
* Goal progress

### Admin

* User management
* Diet configuration
* Workout configuration
* Exercise library
* Goal configuration
* Cardio configuration
* Water configuration
* Notification configuration
* Analytics
* Audit logs

### Mobile

* Flutter
* Offline logging
* Synchronization
* Push/local notifications
* Fast data entry
* Progress charts

### Backend

* Node.js
* REST API
* Authentication
* Authorization
* Validation
* Business logic
* Notification engine
* Reminder engine
* Analytics
* MySQL integration

### Database

* Normalized relational design
* Foreign keys
* Indexes
* Constraints
* Transactions
* Historical integrity
* Plan versioning

---

# 122. Implementation Principle

The most important rule for the entire project is:

> **Everything that can reasonably be configured by an administrator should be configurable through the admin dashboard rather than hard-coded into the Flutter application or backend business logic.**

This includes:

```text
Diet
Meals
Foods
Food Alternatives
Workout Plans
Workout Days
Exercises
Sets
Repetitions
Rest
Cardio
Water Targets
Goals
Reminder Rules
Notification Preferences
Adherence Weights
```

The backend contains the business rules required to interpret this configuration, while the actual plan content is data managed through the admin dashboard.

The Flutter application renders the configuration assigned to the authenticated user.

The React/Vite dashboard manages that configuration.

The MySQL database stores it.

The Node.js API coordinates everything.

---

# 123. Definition of Done

The project should not be considered complete until:

1. An administrator can create a user.
2. An administrator can create a diet plan.
3. An administrator can configure meals and food alternatives.
4. An administrator can create a workout plan.
5. An administrator can configure the weekly schedule.
6. An administrator can add exercises to a workout.
7. An administrator can configure sets/reps/rest.
8. An administrator can assign diet and workout plans to users.
9. A user can log in through Flutter.
10. A user can see today's diet.
11. A user can record meals.
12. A user can see today's workout.
13. A user can record every workout set.
14. A user can record cardio.
15. A user can record water.
16. A user can record daily weight.
17. The application calculates goal progress.
18. The application calculates adherence.
19. The system detects missed activities.
20. The user receives appropriate notifications.
21. The user can view historical progress.
22. The user can view workout progression.
23. The admin can view user analytics.
24. Historical plans remain accurate after plan changes.
25. Offline Flutter records synchronize correctly.
26. Authentication and authorization are secure.
27. API validation is implemented.
28. Database transactions and constraints are implemented where required.
29. Production configuration does not contain hard-coded secrets.
30. The application is deployable as a production system.

---

# 124. Final Product Definition

The final product is a:

> **Multi-user fitness management, nutrition, workout, hydration, cardio, adherence, notification, and progress-tracking platform.**

Administrators configure individualized plans through a React + Vite dashboard.

Users execute and track those plans through a Flutter mobile application.

Node.js provides the centralized API and business logic.

MySQL provides persistent relational storage.

The system continuously transforms user activity into meaningful progress information while detecting missed tasks and providing timely reminders.

The platform must remain configuration-driven, multi-user, historically accurate, secure, and extensible.
