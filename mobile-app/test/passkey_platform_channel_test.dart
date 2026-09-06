import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:fitness_mobile_app/core/api/api_client.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/auth/passkey_service.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('com.fitnessplatform.app/passkeys');
  late InMemorySecureStorageService storage;
  late AuthSession authSession;
  late SyncCoordinator syncCoordinator;

  setUp(() {
    storage = InMemorySecureStorageService();
    authSession = AuthSession(storage: storage);
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  ApiClient createMockClient(Future<http.Response> Function(http.Request) handler) {
    final mockHttp = MockClient(handler);
    syncCoordinator = SyncCoordinator(
      storage: storage,
      authSession: authSession,
      httpClient: mockHttp,
    );
    return ApiClient(
      authSession: authSession,
      syncCoordinator: syncCoordinator,
      httpClient: mockHttp,
    );
  }

  group('Passkey Platform Channel & Service Unit Tests', () {
    test('registerDevicePasskey succeeds on valid platform bridge response', () async {
      await authSession.saveSession(
        accessToken: 'access-123',
        refreshToken: 'refresh-123',
        userJson: {
          'id': 1,
          'email': 'user@example.com',
          'firstName': 'John',
          'lastName': 'Doe',
        },
      );

      final client = createMockClient((req) async {
        if (req.method == 'POST' && req.url.path == '/api/v1/auth/passkey/register-options') {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'challengeId': 'reg-challenge-xyz',
                'challenge': 'dGVzdC1jaGFsbGVuZ2U',
                'rp': {'name': 'FitnessPlatform', 'id': 'localhost'},
                'user': {'id': '1', 'name': 'user@example.com', 'displayName': 'John Doe'},
              },
            }),
            200,
          );
        }
        if (req.method == 'POST' && req.url.path == '/api/v1/auth/passkey/register-verify') {
          final body = jsonDecode(req.body);
          expect(body['challengeId'], 'reg-challenge-xyz');
          expect(body['deviceName'], 'Pixel 9 Pro');
          expect(body['clientType'], 'mobile');
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'id': 42,
                'credentialId': 'cred-uuid-12345',
                'deviceName': 'Pixel 9 Pro',
              },
            }),
            201,
          );
        }
        return http.Response('Not found', 404);
      });

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'register') {
          final args = call.arguments as Map;
          final options = jsonDecode(args['optionsJson'] as String);
          expect(options['challenge'], 'dGVzdC1jaGFsbGVuZ2U');
          return jsonEncode({
            'id': 'cred-uuid-12345',
            'rawId': 'cred-uuid-12345',
            'type': 'public-key',
            'response': {
              'clientDataJSON': 'dGVzdA',
              'attestationObject': 'dGVzdA',
            },
          });
        }
        throw PlatformException(code: 'UNIMPLEMENTED');
      });

      final service = PasskeyService(apiClient: client, authSession: authSession);
      final res = await service.registerDevicePasskey(customDeviceName: 'Pixel 9 Pro');

      expect(res['credentialId'], 'cred-uuid-12345');
      expect(await service.hasLocalPasskey(), isTrue);
      final info = await service.getLocalPasskeyInfo();
      expect(info?.credentialId, 'cred-uuid-12345');
      expect(info?.deviceName, 'Pixel 9 Pro');
      expect(info?.email, 'user@example.com');
    });

    test('loginWithPasskey succeeds and establishes session', () async {
      await storage.write('mobile_passkey_credential_id', 'cred-uuid-login');
      await storage.write('mobile_passkey_user_email', 'member@example.com');

      final client = createMockClient((req) async {
        if (req.method == 'POST' && req.url.path == '/api/v1/auth/passkey/login-options') {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'challengeId': 'login-challenge-abc',
                'challenge': 'bG9naW4tY2hhbGxlbmdl',
                'rpId': 'localhost',
              },
            }),
            200,
          );
        }
        if (req.method == 'POST' && req.url.path == '/api/v1/auth/passkey/login-verify') {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'accessToken': 'new-access-token',
                'refreshToken': 'new-refresh-token',
                'user': {
                  'id': 10,
                  'email': 'member@example.com',
                  'firstName': 'Active',
                  'lastName': 'Member',
                },
              },
            }),
            200,
          );
        }
        if (req.method == 'GET' && req.url.path == '/api/v1/me') {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'id': 10,
                'email': 'member@example.com',
                'first_name': 'Active',
                'last_name': 'Member',
              },
            }),
            200,
          );
        }
        return http.Response('Not found', 404);
      });

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'authenticate') {
          return jsonEncode({
            'id': 'cred-uuid-login',
            'rawId': 'cred-uuid-login',
            'type': 'public-key',
            'response': {
              'clientDataJSON': 'dGVzdA',
              'authenticatorData': 'dGVzdA',
              'signature': 'dGVzdA',
            },
          });
        }
        throw PlatformException(code: 'UNIMPLEMENTED');
      });

      final service = PasskeyService(apiClient: client, authSession: authSession);
      await service.loginWithPasskey(email: 'member@example.com');

      expect(authSession.isAuthenticated, isTrue);
      expect(authSession.accessToken, 'new-access-token');
      expect(authSession.currentUser?.email, 'member@example.com');
    });

    test('handles user cancellation gracefully', () async {
      final client = createMockClient((req) async {
        if (req.method == 'POST' && req.url.path == '/api/v1/auth/passkey/login-options') {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'challengeId': 'cancel-challenge',
                'challenge': 'dGVzdA',
              },
            }),
            200,
          );
        }
        return http.Response('Not found', 404);
      });

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        throw PlatformException(code: 'CANCELLED', message: 'User cancelled prompt');
      });

      final service = PasskeyService(apiClient: client, authSession: authSession);
      expect(
        () => service.loginWithPasskey(email: 'test@example.com'),
        throwsA(predicate((e) => e.toString().contains('Passkey authentication was cancelled.'))),
      );
    });

    test('handles unsupported OS / device by recommending password login', () async {
      final client = createMockClient((req) async {
        if (req.method == 'POST' && req.url.path == '/api/v1/auth/passkey/login-options') {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {'challengeId': 'c1', 'challenge': 'dGVzdA'},
            }),
            200,
          );
        }
        return http.Response('Not found', 404);
      });

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        throw PlatformException(code: 'UNSUPPORTED', message: 'API level < 28');
      });

      final service = PasskeyService(apiClient: client, authSession: authSession);
      expect(
        () => service.loginWithPasskey(email: 'test@example.com'),
        throwsA(predicate((e) => e.toString().contains('Passkeys are not supported on this device. Please use password login.'))),
      );
    });

    test('handles platform provider failure with informative error', () async {
      final client = createMockClient((req) async {
        if (req.method == 'POST' && req.url.path == '/api/v1/auth/passkey/login-options') {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {'challengeId': 'c1', 'challenge': 'dGVzdA'},
            }),
            200,
          );
        }
        return http.Response('Not found', 404);
      });

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        throw PlatformException(code: 'PROVIDER_ERROR', message: 'Google Play Services unavailable');
      });

      final service = PasskeyService(apiClient: client, authSession: authSession);
      expect(
        () => service.loginWithPasskey(email: 'test@example.com'),
        throwsA(predicate((e) => e.toString().contains('Google Play Services unavailable'))),
      );
    });

    test('revocation and clearing of local passkey', () async {
      await storage.write('mobile_passkey_credential_id', 'to-be-revoked');
      await storage.write('mobile_passkey_device_name', 'Old Phone');
      await storage.write('mobile_passkey_user_email', 'user@example.com');

      var deleteCalled = false;
      final client = createMockClient((req) async {
        if (req.method == 'DELETE' && req.url.path == '/api/v1/me/passkeys/99') {
          deleteCalled = true;
          return http.Response(jsonEncode({'success': true}), 200);
        }
        return http.Response('Not found', 404);
      });

      final service = PasskeyService(apiClient: client, authSession: authSession);
      expect(await service.hasLocalPasskey(), isTrue);

      await service.revokePasskey(99, credentialId: 'to-be-revoked');
      expect(deleteCalled, isTrue);
      expect(await service.hasLocalPasskey(), isFalse);
    });
  });
}
