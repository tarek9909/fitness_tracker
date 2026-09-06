# Kinetic Wellness Mobile Application

Production-grade cross-platform Flutter mobile application for daily fitness tracking, workout execution, meal logging, and offline synchronization.

---

## 1. Architecture & Security Overview

- **Hardware-Backed Keystore / Keychain Storage**:
  - All JWT access tokens, refresh tokens, and user profile metadata are stored exclusively via `flutter_secure_storage` with Android `EncryptedSharedPreferences` / Hardware Keystore and iOS Keychain.
  - Zero storage of credentials in unencrypted `SharedPreferences`.
  - Storage is abstracted via `SecureStorageService`, enabling unit tests to execute against fast in-memory fakes.
- **Durable Offline Mutation Queue & Sync Coordinator**:
  - `SyncCoordinator` serializes mutation operations and attaches persistent `Idempotency-Key` headers.
  - Uses `connectivity_plus` to automatically detect network restoration and flush queued operations.
  - Bounded exponential backoff (`min(300, 3 * 2^retryCount)`) on 5xx/429/transient network errors.
  - Single-flight 401 token refresh with immediate queued request retry.
  - Non-destructive terminal conflict preservation (`SyncOperationStatus.failed`), keeping mutations available for user inspection, manual retry, or discard.
- **Push Device Registration & Token Abstraction**:
  - `PushTokenProvider` interface provides an injectable token acquisition layer.
  - `UnconfiguredPushTokenProvider` operates by default in local development/CI, returning `null` and ensuring zero fake/fabricated tokens are submitted to the backend.
  - `PushRegistrationService` generates and persists a stable per-install UUID in encrypted `SecureStorageService` (`install_device_uuid`), registering genuine push tokens via authenticated `POST /api/v1/me/devices` (`deviceUuid`, `platform`, `pushToken`, `appVersion`).
  - Registration is non-blocking, de-duplicated across identical sessions/tokens, and automatically triggered on login, session startup, and token refresh.
  - Logout clears session registration cache to prevent stale user associations.

---

## 2. Platform Scaffolding & Configuration

### Android Configuration (`android/`)
- **Minimum SDK**: `minSdkVersion = 21` (required for `flutter_secure_storage` hardware keystore encryption).
- **Keystore Security**: `android:allowBackup="false"` configured in `android/app/src/main/AndroidManifest.xml` to prevent unauthorized extraction of hardware keys.
- **Permissions**: `android.permission.INTERNET` and `android.permission.ACCESS_NETWORK_STATE`.
- **FCM Push Notification Setup (Production Prerequisite)**:
  - Download `google-services.json` from Firebase Console and place in `mobile-app/android/app/`.
  - Provide a concrete `PushTokenProvider` implementation backed by `FirebaseMessaging.instance.getToken()`.

### iOS Configuration (`ios/`)
- **Keychain Accessibility**: Configured with `KeychainAccessibility.first_unlock` for background sync access.
- **Deployment Target**: iOS 13.0+.
- **APNs Push Notification Setup (Production Prerequisite)**:
  - Enable *Push Notifications* and *Background Modes (Remote notifications)* capabilities in Xcode (`ios/Runner.xcworkspace`).
  - Upload Apple APNs Auth Key (`.p8`) to push server / Firebase.

---

## 3. Development Execution

### Android Emulator:
```powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1
```

### iOS Simulator / Desktop:
```powershell
flutter run --dart-define=API_BASE_URL=http://localhost:4000/api/v1
```

### Physical Device over Local Network:
```powershell
flutter run --dart-define=API_BASE_URL=http://192.168.1.100:4000/api/v1
```

---

## 4. Production Release Build & Packaging

### Android Release APK / App Bundle:
1. Configure release keystore credentials in `android/key.properties`:
   ```properties
   storePassword=your-keystore-password
   keyPassword=your-key-password
   keyAlias=your-key-alias
   storeFile=/path/to/upload-keystore.jks
   ```
2. Build command (enforces HTTPS encryption):
   ```powershell
   flutter build apk --release --dart-define=API_BASE_URL=https://api.fitnessplatform.com/api/v1
   # Or for Google Play Store:
   flutter build appbundle --release --dart-define=API_BASE_URL=https://api.fitnessplatform.com/api/v1
   ```

### iOS Release IPA:
1. Configure Apple Developer signing certificate and provisioning profile in Xcode (`ios/Runner.xcworkspace`).
2. Build command (enforces HTTPS encryption):
   ```powershell
   flutter build ipa --release --dart-define=API_BASE_URL=https://api.fitnessplatform.com/api/v1
   ```

---

## 5. Verification & Testing

All **53 unit, widget, storage, configuration, models, sync, and push registration tests (53 tests across 10 files/suites)** pass with 0 static analysis issues:

```powershell
# 1. Static code analysis (0 issues)
flutter analyze

# 2. Automated test suite (53 tests across 10 files/suites)
flutter test
```
