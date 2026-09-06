# Fitness Workflow Implementation Status

Status at completion of test & validation phase: approximately **96% complete**.

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
- [x] Legacy published-edit tests updated to reflect authorized in-place editing semantics.
- [x] Dedicated backend CRUD lifecycle tests added for workout/diet fields, ordering, ownership isolation, published edits, transactional rollback, and activation.
- [x] WebAuthn adversarial security coverage added (malformed payloads, wrong origin, wrong RP ID, invalid flags, invalid credentials, corrupted signatures, counter rollback, expired/replayed challenges).
- [x] Flutter platform channel coverage added for passkey success, cancellation, unsupported OS, and provider failure.
- [x] Flutter widget tests added for full workout and diet builder creation and editing flows.

## Validation completed

- [x] Backend TypeScript build: `npm run build` (Clean compile, exit code 0).
- [x] Dashboard production build: `npm run build` (Clean compile with Vite production chunks, exit code 0).
- [x] Flutter analysis: `flutter analyze` (0 issues found, clean analysis, exit code 0).
- [x] Flutter Android debug build: `flutter build apk --debug` (Built `app-debug.apk` in 96.6s, exit code 0).
- [x] Full backend Vitest suite in isolated SQLite test environments: 17 test files, 223 tests passed (0 failures).
- [x] Backend environment tests: 19 passed.
- [x] Backend migration tests: passed.
- [x] Backend CRUD lifecycle, ownership isolation, and end-to-end execution/logging tests: 16 passed (`workout-diet-crud-lifecycle.test.ts`).
- [x] Backend Passkey test suite: `passkey-auth.test.ts` fixed with isolated SQLite DB fixture, seeded roles/baseline data, reliable file cleanup, real WebAuthn cryptography, and HMAC rejection tests (6 passed).
- [x] Flutter full test suite: 116 tests passed (`flutter test`, 0 failures).
- [x] Flutter navigation tests for tabs, nested routes, modal dismissal, and 2-second double-back timeout passed (`navigation_back_test.dart`).
- [x] Flutter passkey platform-channel mock tests: 6 passed (`passkey_platform_channel_test.dart`).
- [x] Flutter workout and diet builder widget tests: 2 passed (`workout_diet_builder_widget_test.dart`).
- [x] Deployment placeholders inspected and verified across `deploy/passkeys/assetlinks.json`, `deploy/passkeys/apple-app-site-association`, `mobile-app/ios/Runner/Runner.entitlements`, and `backend/.env.example`.
- [x] Local MySQL status: Local MySQL daemon is offline/unreachable (`ECONNREFUSED` on port 3306), verified via `npm run verify:mysql`; automated test suites run cleanly in isolated SQLite mode.

## Remaining / Deployment Blockers

- [ ] **Target Hardware / Live Passkey Prompt**: Run Android emulator or physical device integration tests with an actual biometric prompt (requires hardware/emulator with Google Play Services).
- [ ] **macOS Environment Dependency**: Run iOS simulator/device integration tests on iOS 15+ with actual Apple passkey prompt (blocked on Windows host; requires macOS and Xcode).
- [ ] **Production Infrastructure Secrets**: Replace placeholder deployment values in `deploy/passkeys/`, `mobile-app/ios/Runner/Runner.entitlements`, and `backend/.env.example` with actual production values:
  - Production `WEBAUTHN_RP_ID` (e.g. `auth.fitnessplatform.com`) and matching `Runner.entitlements` associated domain (`webcredentials:auth.fitnessplatform.com`).
  - Production Apple Team ID in `apple-app-site-association`.
  - Android release and debug SHA-256 certificate fingerprints in `assetlinks.json` and `backend/.env.example` (`WEBAUTHN_EXPECTED_ORIGINS`).
- [ ] **macOS Signing**: Verify iOS signing and associated-domain configuration in Xcode on macOS.
- [ ] **Live System Acceptance**: Perform live manual end-to-end acceptance against running server: create, edit, publish, activate, and execute plans on mobile device.

## Known verification limitations & blockers

1. **Host OS (Windows)**:
   Native iOS builds, iOS simulator execution, and Xcode entitlement signing cannot be verified on this Windows workstation. An Apple development environment with macOS and Xcode is required for iOS release packaging and associated-domain verification.
2. **Physical Biometric Hardware**:
   Local automated suites test the complete WebAuthn protocol, cryptographic signatures, error codes, and Flutter MethodChannel contracts; physical biometric verification (Face ID, Touch ID, Android BiometricPrompt) requires execution on real devices with configured device locks.

Existing uncommitted user changes and newly authored code were preserved throughout this work.
