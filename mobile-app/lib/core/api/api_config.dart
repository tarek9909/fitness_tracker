import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';

class ReleaseConfigurationError implements Exception {
  final String message;
  ReleaseConfigurationError(this.message);

  @override
  String toString() => 'ReleaseConfigurationError: $message';
}

/// Release-safe API Configuration with strict compile-time validation in release mode.
///
/// Environment Setup Guidelines:
/// - Android Emulator (Host Loopback): `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1`
/// - iOS Simulator: `flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/v1`
/// - Physical Devices (Local LAN / Reverse Proxy): `flutter run --dart-define=API_BASE_URL=http://192.168.10.210:3000/api/v1`
/// - Production Release Build: `flutter build apk --release --dart-define=API_BASE_URL=https://api.fitnessplatform.com/api/v1`
class ApiConfig {
  static const String _dartDefinedBaseUrl =
      String.fromEnvironment('API_BASE_URL');

  static String? _activeWorkingBaseUrl;

  static void setActiveWorkingBaseUrl(String url) {
    _activeWorkingBaseUrl = url;
  }

  static void resetActiveWorkingBaseUrl() {
    _activeWorkingBaseUrl = null;
  }

  static String? getActiveWorkingBaseUrl() => _activeWorkingBaseUrl;

  static List<String> getCandidateBaseUrls() {
    if (kReleaseMode || _dartDefinedBaseUrl.trim().isNotEmpty) {
      return [resolveBaseUrl()];
    }
    final allCandidates = !kIsWeb && Platform.isAndroid
        ? [
            'http://127.0.0.1:3000/api/v1',      // ADB reverse port-forwarding for USB physical devices (port 3000)
            'http://127.0.0.1:4000/api/v1',      // ADB reverse port-forwarding for USB physical devices (port 4000)
            'http://192.168.10.210:3000/api/v1', // Active LAN host IP (port 3000)
            'http://192.168.10.210:4000/api/v1', // Active LAN host IP (port 4000)
            'http://localhost:3000/api/v1',      // Localhost port 3000
            'http://localhost:4000/api/v1',      // Localhost port 4000
            'http://10.0.2.2:3000/api/v1',       // Android Emulator host loopback (port 3000)
            'http://10.0.2.2:4000/api/v1',       // Android Emulator host loopback (port 4000)
          ]
        : [
            'http://localhost:3000/api/v1',
            'http://localhost:4000/api/v1',
            'http://127.0.0.1:3000/api/v1',
            'http://127.0.0.1:4000/api/v1',
            'http://192.168.10.210:3000/api/v1',
            'http://192.168.10.210:4000/api/v1',
          ];

    if (_activeWorkingBaseUrl != null && _activeWorkingBaseUrl!.trim().isNotEmpty) {
      final active = _activeWorkingBaseUrl!.trim();
      return [active, ...allCandidates.where((u) => u != active)];
    }
    return allCandidates;
  }

  static String resolveBaseUrl() {
    if (_activeWorkingBaseUrl != null && _activeWorkingBaseUrl!.trim().isNotEmpty) {
      return _activeWorkingBaseUrl!.trim();
    }
    if (!kReleaseMode && _dartDefinedBaseUrl.trim().isEmpty) {
      final candidates = getCandidateBaseUrls();
      if (candidates.isNotEmpty) {
        return candidates.first;
      }
    }
    return validateAndResolveBaseUrl(
      definedUrl: _dartDefinedBaseUrl,
      isReleaseMode: kReleaseMode,
      isAndroid: !kIsWeb && Platform.isAndroid,
    );
  }

  static String validateAndResolveBaseUrl({
    required String definedUrl,
    required bool isReleaseMode,
    bool isAndroid = false,
  }) {
    final trimmed = definedUrl.trim();

    if (isReleaseMode) {
      if (trimmed.isEmpty) {
        throw ReleaseConfigurationError(
          'API_BASE_URL must be explicitly defined for release builds via --dart-define=API_BASE_URL=https://...',
        );
      }

      final Uri uri;
      try {
        uri = Uri.parse(trimmed);
      } catch (e) {
        throw ReleaseConfigurationError(
          'API_BASE_URL is not a valid URI (received: "$trimmed").',
        );
      }

      if (uri.scheme != 'https') {
        throw ReleaseConfigurationError(
          'API_BASE_URL in release builds must use encrypted HTTPS (received: "$trimmed").',
        );
      }

      if (uri.host.trim().isEmpty) {
        throw ReleaseConfigurationError(
          'API_BASE_URL in release builds must include a valid host (received: "$trimmed").',
        );
      }

      if (uri.userInfo.isNotEmpty) {
        throw ReleaseConfigurationError(
          'API_BASE_URL in release builds must not contain embedded user credentials (received: "$trimmed").',
        );
      }

      if (uri.hasPort && (uri.port <= 0 || uri.port > 65535)) {
        throw ReleaseConfigurationError(
          'API_BASE_URL in release builds has an invalid port (received: "$trimmed").',
        );
      }

      var sanitized = trimmed;
      while (sanitized.endsWith('/')) {
        sanitized = sanitized.substring(0, sanitized.length - 1);
      }
      return sanitized;
    }

    // Debug / Profile Mode
    if (trimmed.isNotEmpty) {
      var sanitized = trimmed;
      while (sanitized.endsWith('/')) {
        sanitized = sanitized.substring(0, sanitized.length - 1);
      }
      return sanitized;
    }

    // Default development loopback
    if (isAndroid) {
      return 'http://10.0.2.2:4000/api/v1'; // Android emulator host alias
    }
    return 'http://localhost:4000/api/v1';
  }
}
