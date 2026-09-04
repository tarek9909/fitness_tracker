# Fitness Workflow Implementation Status

Status at pause: approximately **85% complete**.

## Complete

- [x] Backend defaults and runtime configuration standardized on port `4000`.
- [x] Docker health check and API documentation updated for port `4000`.
- [x] Dashboard and Flutter API defaults use port `4000`.
- [x] Centralized Flutter back handling added:
  - [x] Nested pages return to Home.
  - [x] Non-home tabs return to Home.
  - [x] First back on Home shows an exit confirmation message.
  - [x] Second back within two seconds invokes platform exit.
  - [x] Dialog/modal routes dismiss normally.
- [x] Flutter navigation regression coverage added for tabs, nested pages, dialogs, double-back, and timeout behavior.
- [x] Workout self-service plan creation and editing flow added.
- [x] Workout plan metadata supports name, description, and goal/focus.
- [x] Workout weekly schedule supports seven days, rest days, notes, ordering, editing, and deletion.
- [x] Workout exercises support add, edit, delete, reorder, optional status, notes, duration, distance, and rest.
- [x] Workout exercises support per-set reps, weight, duration, distance, rest, and notes.
- [x] Diet self-service plan creation and editing flow added.
- [x] Diet meals support required status, time, notes, ordering, editing, and deletion.
- [x] Diet option groups support required status, selection limits, notes, ordering, editing, and deletion.
- [x] Diet food options support food selection, quantity, serving unit, custom label, notes, alternatives guidance, ordering, editing, and deletion.
- [x] Diet nutrition snapshots are calculated server-side from the selected food and quantity, including calories, protein, carbohydrates, fat, and fiber.
- [x] Workout and diet published versions support authorized in-place edits.
- [x] Published mutations validate structural integrity transactionally.
- [x] Existing workout sessions continue to use their stored snapshots.
- [x] Explicit clone-as-draft actions remain available.
- [x] Self-service plans use `owner_user_id` and private visibility.
- [x] Ownership checks are applied to plan reads and mutations.
- [x] Audit events were added for plan, version, day, exercise, meal, group, and option mutations.
- [x] Migration compatibility added for workout-set aliases, workout-day dates/order, diet ordering aliases, nutrition fields, and legacy passkey records.
- [x] Fake mobile HMAC passkey generation/storage removed.
- [x] Backend passkey verification replaced with `@simplewebauthn/server` `13.3.0`.
- [x] Dashboard WebAuthn handling replaced with `@simplewebauthn/browser` `13.3.0`.
- [x] Standard WebAuthn registration and authentication response payloads are used.
- [x] Challenge expiry, single-use consumption, expected origin, RP ID, flags, credential, signature, and counter checks are implemented.
- [x] Legacy HMAC credentials are marked unsupported and require password login plus re-enrollment.
- [x] Android Credential Manager bridge added for Android 9/API 28+.
- [x] iOS AuthenticationServices bridge added for iOS 15+.
- [x] Unsupported mobile OS/provider errors fall back to password authentication with clear error codes.
- [x] Digital Asset Links, Apple associated-domain, and passkey deployment configuration templates added.

## Validation completed

- [x] Backend TypeScript build: `npm run build`.
- [x] Dashboard production build: `npm run build`.
- [x] Flutter Android debug build: `flutter build apk --debug`.
- [x] Backend environment tests: 19 passed.
- [x] Backend migration tests: passed.
- [x] Real WebAuthn registration/authentication fixture tests: 5 passed.
- [x] Flutter navigation tests for tabs, nested routes, and modal dismissal passed.
- [ ] Re-run the corrected navigation timeout test after pausing changes.

## Remaining

- [ ] Run the complete backend test suite in a clean isolated database.
- [ ] Update legacy tests that still expect published versions to return `PLAN_VERSION_IMMUTABLE`; the selected behavior is now authorized in-place editing.
- [ ] Add or finish dedicated backend CRUD tests for all workout and diet fields, ordering, ownership, published edits, rollback, and activation.
- [ ] Add malformed WebAuthn, wrong origin, wrong RP ID, invalid flags, invalid credential, invalid signature, counter rollback, and challenge mismatch/replay coverage where not already covered.
- [ ] Add Flutter widget tests for the full workout and diet builder flows, including add/edit/delete/reorder operations.
- [ ] Add Flutter platform-channel tests for passkey success, cancellation, unsupported OS, and provider failure.
- [ ] Run Android emulator/device integration tests with an actual platform passkey prompt.
- [ ] Run iOS simulator/device integration tests on iOS 15+ with an actual platform passkey prompt.
- [ ] Replace placeholder deployment values in `deploy/passkeys/`, `mobile-app/ios/Runner/Runner.entitlements`, and `backend/.env.example` with production RP ID, origins, certificate fingerprints, and associated-domain values.
- [ ] Verify iOS signing and associated-domain configuration on macOS/Xcode.
- [ ] Perform final end-to-end acceptance: create, edit, publish, activate, reload, and execute complete workout and diet plans from the mobile app.

## Known verification limitation

The current workspace is on Windows, so the native iOS build and iOS device passkey prompt cannot be executed here. Android compilation succeeded; an Android device/emulator passkey prompt still needs to be exercised during final acceptance.

Existing uncommitted user changes were preserved throughout this work.
