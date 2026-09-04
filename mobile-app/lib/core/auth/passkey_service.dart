import 'dart:convert';

import 'package:flutter/services.dart';

import '../api/api_client.dart';
import 'auth_session.dart';

class PasskeyInfo {
  final String credentialId;
  final String deviceName;
  final String? email;
  final String? credentialFormat;

  const PasskeyInfo({
    required this.credentialId,
    required this.deviceName,
    this.email,
    this.credentialFormat,
  });
}

class PasskeyService {
  static const MethodChannel _channel = MethodChannel('com.fitnessplatform.app/passkeys');
  static const _keyCredId = 'mobile_passkey_credential_id';
  static const _keyDevice = 'mobile_passkey_device_name';
  static const _keyEmail = 'mobile_passkey_user_email';

  final ApiClient apiClient;
  final AuthSession authSession;

  PasskeyService({
    required this.apiClient,
    required this.authSession,
  });

  Map<String, dynamic> _withoutChallengeId(dynamic options) {
    if (options is! Map) {
      throw Exception('Invalid passkey options from server');
    }
    final result = Map<String, dynamic>.from(options);
    result.remove('challengeId');
    return result;
  }

  Future<Map<String, dynamic>> _invokePlatform(
    String method,
    Map<String, dynamic> options,
  ) async {
    try {
      final raw = await _channel.invokeMethod<String>(method, {
        'optionsJson': jsonEncode(options),
      });
      if (raw == null || raw.isEmpty) {
        throw Exception('The platform did not return a passkey response');
      }
      final decoded = jsonDecode(raw);
      if (decoded is! Map) {
        throw Exception('The platform returned an invalid passkey response');
      }
      return Map<String, dynamic>.from(decoded);
    } on PlatformException catch (error) {
      if (error.code == 'UNSUPPORTED') {
        throw Exception('Passkeys are not supported on this device. Please use password login.');
      }
      if (error.code == 'CANCELLED') {
        throw Exception('Passkey authentication was cancelled.');
      }
      throw Exception(error.message ?? 'Passkey operation failed');
    } on MissingPluginException {
      throw Exception('Passkeys are not available in this build. Please use password login.');
    }
  }

  Future<bool> hasLocalPasskey() async {
    final credId = await authSession.storage.read(_keyCredId);
    return credId != null && credId.isNotEmpty;
  }

  Future<PasskeyInfo?> getLocalPasskeyInfo() async {
    final credId = await authSession.storage.read(_keyCredId);
    if (credId == null || credId.isEmpty) return null;
    return PasskeyInfo(
      credentialId: credId,
      deviceName: await authSession.storage.read(_keyDevice) ?? 'Mobile Passkey',
      email: await authSession.storage.read(_keyEmail),
      credentialFormat: 'webauthn-cose',
    );
  }

  Future<Map<String, dynamic>> registerDevicePasskey({String? customDeviceName}) async {
    final options = await apiClient.post('/auth/passkey/register-options');
    final registrationResponse = await _invokePlatform(
      'register',
      _withoutChallengeId(options),
    );

    final deviceName = customDeviceName?.trim().isNotEmpty == true
        ? customDeviceName!.trim()
        : 'Mobile App Device';
    final response = await apiClient.post(
      '/auth/passkey/register-verify',
      body: {
        'challengeId': options['challengeId'],
        'response': registrationResponse,
        'deviceName': deviceName,
        'clientType': 'mobile',
      },
    );

    if (response is! Map<String, dynamic>) {
      throw Exception('Passkey registration verification failed');
    }

    final credentialId = registrationResponse['id'] as String?;
    if (credentialId == null || credentialId.isEmpty) {
      throw Exception('Passkey registration did not return a credential ID');
    }
    await authSession.storage.write(_keyCredId, credentialId);
    await authSession.storage.write(_keyDevice, deviceName);
    final email = authSession.currentUser?.email;
    if (email != null) await authSession.storage.write(_keyEmail, email);
    return response;
  }

  Future<void> loginWithPasskey({String? email}) async {
    final storedEmail = await authSession.storage.read(_keyEmail);
    final effectiveEmail = email?.trim().isNotEmpty == true
        ? email!.trim()
        : (storedEmail?.trim().isNotEmpty == true ? storedEmail : null);

    final options = await apiClient.post(
      '/auth/passkey/login-options',
      body: effectiveEmail == null ? null : {'email': effectiveEmail},
    );
    final authenticationResponse = await _invokePlatform(
      'authenticate',
      _withoutChallengeId(options),
    );

    final response = await apiClient.post(
      '/auth/passkey/login-verify',
      body: {
        'challengeId': options['challengeId'],
        'response': authenticationResponse,
        'clientType': 'mobile',
        'deviceName': await authSession.storage.read(_keyDevice) ?? 'Mobile App Device',
      },
    );
    if (response is! Map<String, dynamic>) {
      throw Exception('Invalid response from passkey login');
    }

    final accessToken = response['accessToken'] as String?;
    final refreshToken = response['refreshToken'] as String?;
    final rawUser = response['user'];
    if (accessToken == null || accessToken.isEmpty ||
        refreshToken == null || refreshToken.isEmpty || rawUser is! Map) {
      throw Exception('Login response is missing required session data');
    }

    await authSession.saveSession(
      accessToken: accessToken,
      refreshToken: refreshToken,
      userJson: Map<String, dynamic>.from(rawUser),
    );
    final credentialId = authenticationResponse['id'] as String?;
    if (credentialId != null && credentialId.isNotEmpty) {
      await authSession.storage.write(_keyCredId, credentialId);
    }
    if (effectiveEmail != null) await authSession.storage.write(_keyEmail, effectiveEmail);

    try {
      final meRes = await apiClient.get('/me');
      if (meRes is Map<String, dynamic>) await authSession.updateProfile(meRes);
    } catch (_) {}
  }

  Future<List<Map<String, dynamic>>> fetchServerPasskeys() async {
    final res = await apiClient.get('/me/passkeys');
    if (res is List) {
      return res.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  Future<void> revokePasskey(int passkeyId, {String? credentialId}) async {
    await apiClient.delete('/me/passkeys/$passkeyId');
    final localCredId = await authSession.storage.read(_keyCredId);
    if (credentialId != null && localCredId == credentialId) await clearLocalPasskey();
  }

  Future<void> clearLocalPasskey() async {
    await authSession.storage.delete(_keyCredId);
    await authSession.storage.delete(_keyDevice);
    await authSession.storage.delete(_keyEmail);
  }
}
