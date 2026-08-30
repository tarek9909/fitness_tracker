import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import '../api/api_client.dart';
import '../auth/auth_session.dart';
import '../storage/secure_storage_service.dart';
import '../sync/sync_coordinator.dart';
import 'push_token_provider.dart';

/// Service responsible for managing hardware-backed device UUID persistence
/// and registering genuine push tokens with the backend via authenticated
/// POST /api/v1/me/devices.
class PushRegistrationService {
  final ApiClient apiClient;
  final SecureStorageService storage;
  final PushTokenProvider pushTokenProvider;
  final AuthSession authSession;
  final String platform;
  final String appVersion;

  bool _isRegistering = false;
  String? _lastRegisteredSignature;

  PushRegistrationService({
    required this.apiClient,
    required this.storage,
    PushTokenProvider? pushTokenProvider,
    required this.authSession,
    String? platform,
    String? appVersion,
  })  : pushTokenProvider =
            pushTokenProvider ?? const UnconfiguredPushTokenProvider(),
        platform = platform ?? _resolvePlatform(),
        appVersion = appVersion ?? '1.0.0';

  static String _resolvePlatform() {
    try {
      if (kIsWeb) return 'android';
      return Platform.isIOS ? 'ios' : 'android';
    } catch (_) {
      return 'android';
    }
  }

  /// Retrieves or generates a stable per-install UUID in encrypted secure storage.
  /// This ID persists across app restarts and logins on this specific install.
  Future<String> getOrGenerateDeviceUuid() async {
    final existing = await storage.read('install_device_uuid');
    if (existing != null && existing.trim().isNotEmpty) {
      return existing.trim();
    }
    final newUuid = generateUuidV4();
    await storage.write('install_device_uuid', newUuid);
    return newUuid;
  }

  /// Attempts to register the device token with the backend.
  /// Non-blocking, single-flighted, and completely safe with no-op providers
  /// (bypasses network call entirely if no real token is supplied).
  Future<bool> registerDeviceIfNeeded() async {
    if (!authSession.isAuthenticated) {
      return false;
    }

    if (_isRegistering) {
      return false;
    }

    _isRegistering = true;
    try {
      final token = await pushTokenProvider.getPushToken();
      if (token == null || token.trim().isEmpty) {
        // No-op / unconfigured provider: do not fabricate tokens or make network requests.
        return false;
      }

      final deviceUuid = await getOrGenerateDeviceUuid();
      final userId = authSession.currentUser?.id ?? 0;
      final signature = '$userId:$token:$deviceUuid:$platform:$appVersion';

      if (_lastRegisteredSignature == signature) {
        // Already registered under this exact user session & token
        return true;
      }

      await apiClient.post('/me/devices', body: {
        'deviceUuid': deviceUuid,
        'platform': platform,
        'pushToken': token.trim(),
        'appVersion': appVersion,
      });

      _lastRegisteredSignature = signature;
      return true;
    } catch (e) {
      debugPrint('Push device registration failed gracefully: $e');
      return false;
    } finally {
      _isRegistering = false;
    }
  }

  /// Clears in-memory registration state upon logout or user transition
  /// to ensure new user sessions register under their own authenticated identity.
  void clearRegistrationState() {
    _lastRegisteredSignature = null;
  }
}
