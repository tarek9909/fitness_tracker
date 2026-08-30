import 'dart:async';

/// Injectable PushTokenProvider contract for obtaining native device push tokens.
/// Unconfigured/no-op by default in development, CI, and offline environments, ensuring
/// zero fabricated/fake tokens are sent to backend.
abstract class PushTokenProvider {
  /// Friendly identifier of the push provider implementation (e.g. 'unconfigured', 'fcm', 'apns').
  String get providerName;

  /// Returns true if the provider is fully configured with valid platform credentials.
  bool get isConfigured;

  /// Fetches the authoritative native device push token, or returns null if unconfigured or unavailable.
  Future<String?> getPushToken();
}

/// Safe default no-op push token provider that never invents fake tokens.
/// APNs and FCM live credentials remain externally gated.
class UnconfiguredPushTokenProvider implements PushTokenProvider {
  const UnconfiguredPushTokenProvider();

  @override
  String get providerName => 'unconfigured';

  @override
  bool get isConfigured => false;

  @override
  Future<String?> getPushToken() async => null;
}
