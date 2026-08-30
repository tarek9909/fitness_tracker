import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/api/api_client.dart';
import 'package:fitness_mobile_app/core/push/push_token_provider.dart';
import 'package:fitness_mobile_app/core/push/push_registration_service.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';

class MockTestPushTokenProvider implements PushTokenProvider {
  String? tokenToReturn;
  bool configured;

  MockTestPushTokenProvider({
    this.tokenToReturn = 'test-real-push-token-12345',
    this.configured = true,
  });

  @override
  String get providerName => 'test_mock';

  @override
  bool get isConfigured => configured;

  @override
  Future<String?> getPushToken() async => tokenToReturn;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Mobile Push Registration & PushTokenProvider Suite', () {
    late InMemorySecureStorageService storage;
    late AuthSession authSession;
    late SyncCoordinator syncCoordinator;
    late List<http.Request> capturedRequests;
    late http.Client mockClient;

    setUp(() async {
      storage = InMemorySecureStorageService();
      authSession = AuthSession(storage: storage);
      capturedRequests = [];

      mockClient = MockClient((request) async {
        capturedRequests.add(request);
        if (request.url.path.endsWith('/me/devices')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {'message': 'Push device registered successfully'}
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response(
          jsonEncode({'success': true, 'data': {}}),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      syncCoordinator = SyncCoordinator(
        storage: storage,
        authSession: authSession,
        httpClient: mockClient,
      );
      await syncCoordinator.initCoordinator(autoFlush: false);
    });

    test(
        'UnconfiguredPushTokenProvider is unconfigured and returns null without fabricating fake tokens',
        () async {
      const provider = UnconfiguredPushTokenProvider();
      expect(provider.providerName, equals('unconfigured'));
      expect(provider.isConfigured, isFalse);

      final token = await provider.getPushToken();
      expect(token, isNull);
    });

    test(
        'PushRegistrationService with no-op provider makes zero HTTP requests and sends no fake tokens',
        () async {
      await authSession.saveSession(
        accessToken: 'access_123',
        refreshToken: 'refresh_123',
        userJson: {
          'id': 42,
          'email': 'athlete@fitnessplatform.com',
          'firstName': 'Athlete',
          'role': 'user',
        },
      );

      final apiClient = ApiClient(
        authSession: authSession,
        syncCoordinator: syncCoordinator,
        httpClient: mockClient,
      );

      final service = PushRegistrationService(
        apiClient: apiClient,
        storage: storage,
        pushTokenProvider: const UnconfiguredPushTokenProvider(),
        authSession: authSession,
      );

      final registered = await service.registerDeviceIfNeeded();
      expect(registered, isFalse);
      expect(capturedRequests, isEmpty);
    });

    test(
        'PushRegistrationService generates stable per-install UUID in secure storage and reuses it across sessions',
        () async {
      final apiClient = ApiClient(
        authSession: authSession,
        syncCoordinator: syncCoordinator,
        httpClient: mockClient,
      );

      final service = PushRegistrationService(
        apiClient: apiClient,
        storage: storage,
        pushTokenProvider: const UnconfiguredPushTokenProvider(),
        authSession: authSession,
      );

      final uuid1 = await service.getOrGenerateDeviceUuid();
      expect(uuid1, isNotEmpty);
      expect(
          uuid1,
          matches(RegExp(
              r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')));

      // Verified stored in secure storage
      final storedUuid = await storage.read('install_device_uuid');
      expect(storedUuid, equals(uuid1));

      // Subsequent retrieval returns identical UUID
      final uuid2 = await service.getOrGenerateDeviceUuid();
      expect(uuid2, equals(uuid1));
    });

    test(
        'PushRegistrationService registers real push token via authenticated POST /api/v1/me/devices with accurate payload',
        () async {
      await authSession.saveSession(
        accessToken: 'valid_bearer_token_777',
        refreshToken: 'valid_refresh_token_777',
        userJson: {
          'id': 10,
          'email': 'runner@fitnessplatform.com',
          'firstName': 'Runner',
          'role': 'user',
        },
      );

      final apiClient = ApiClient(
        authSession: authSession,
        syncCoordinator: syncCoordinator,
        httpClient: mockClient,
      );

      final mockProvider = MockTestPushTokenProvider(
        tokenToReturn: 'genuine-fcm-device-token-abc-999',
      );

      final service = PushRegistrationService(
        apiClient: apiClient,
        storage: storage,
        pushTokenProvider: mockProvider,
        authSession: authSession,
        platform: 'android',
        appVersion: '1.0.0',
      );

      final registered = await service.registerDeviceIfNeeded();
      expect(registered, isTrue);

      expect(capturedRequests, hasLength(1));
      final req = capturedRequests.first;
      expect(req.url.path, endsWith('/me/devices'));
      expect(req.headers['Authorization'],
          equals('Bearer valid_bearer_token_777'));

      final body = jsonDecode(req.body) as Map<String, dynamic>;
      expect(body['pushToken'], equals('genuine-fcm-device-token-abc-999'));
      expect(body['platform'], equals('android'));
      expect(body['appVersion'], equals('1.0.0'));
      expect(body['deviceUuid'], isNotEmpty);
    });

    test(
        'PushRegistrationService deduplicates consecutive calls with identical token and user session',
        () async {
      await authSession.saveSession(
        accessToken: 'token_dedupe',
        refreshToken: 'refresh_dedupe',
        userJson: {
          'id': 15,
          'email': 'dedupe@fitnessplatform.com',
          'firstName': 'Dedupe',
          'role': 'user',
        },
      );

      final apiClient = ApiClient(
        authSession: authSession,
        syncCoordinator: syncCoordinator,
        httpClient: mockClient,
      );

      final mockProvider = MockTestPushTokenProvider(
        tokenToReturn: 'same-token-repeated',
      );

      final service = PushRegistrationService(
        apiClient: apiClient,
        storage: storage,
        pushTokenProvider: mockProvider,
        authSession: authSession,
      );

      // First call executes HTTP registration
      final res1 = await service.registerDeviceIfNeeded();
      expect(res1, isTrue);
      expect(capturedRequests, hasLength(1));

      // Second call with same state skips redundant network request
      final res2 = await service.registerDeviceIfNeeded();
      expect(res2, isTrue);
      expect(capturedRequests, hasLength(1));
    });

    test(
        'PushRegistrationService resets cache on logout so new user registers cleanly under own identity',
        () async {
      await authSession.saveSession(
        accessToken: 'user1_token',
        refreshToken: 'user1_refresh',
        userJson: {
          'id': 101,
          'email': 'user1@fitnessplatform.com',
          'firstName': 'User1',
          'role': 'user',
        },
      );

      final apiClient = ApiClient(
        authSession: authSession,
        syncCoordinator: syncCoordinator,
        httpClient: mockClient,
      );

      final mockProvider = MockTestPushTokenProvider(
        tokenToReturn: 'shared-device-token-xyz',
      );

      final service = PushRegistrationService(
        apiClient: apiClient,
        storage: storage,
        pushTokenProvider: mockProvider,
        authSession: authSession,
      );

      // User 1 registers
      await service.registerDeviceIfNeeded();
      expect(capturedRequests, hasLength(1));

      // User 1 logs out
      service.clearRegistrationState();
      await authSession.clearSession();

      // User 2 logs in on the same device
      await authSession.saveSession(
        accessToken: 'user2_token',
        refreshToken: 'user2_refresh',
        userJson: {
          'id': 102,
          'email': 'user2@fitnessplatform.com',
          'firstName': 'User2',
          'role': 'user',
        },
      );

      // User 2 registers under own session
      final user2Registered = await service.registerDeviceIfNeeded();
      expect(user2Registered, isTrue);
      expect(capturedRequests, hasLength(2));
      expect(capturedRequests[1].headers['Authorization'],
          equals('Bearer user2_token'));
    });

    test(
        'PushRegistrationService handles network or server errors gracefully without crashing or throwing',
        () async {
      await authSession.saveSession(
        accessToken: 'failing_token',
        refreshToken: 'failing_refresh',
        userJson: {
          'id': 88,
          'email': 'error@fitnessplatform.com',
          'firstName': 'ErrorUser',
          'role': 'user',
        },
      );

      final errorClient = MockClient((request) async {
        throw const SocketException('Failed host lookup');
      });

      final apiClient = ApiClient(
        authSession: authSession,
        syncCoordinator: syncCoordinator,
        httpClient: errorClient,
      );

      final mockProvider = MockTestPushTokenProvider(
        tokenToReturn: 'valid-token-network-fail',
      );

      final service = PushRegistrationService(
        apiClient: apiClient,
        storage: storage,
        pushTokenProvider: mockProvider,
        authSession: authSession,
      );

      // Should complete without throwing unhandled error and return false
      final registered = await service.registerDeviceIfNeeded();
      expect(registered, isFalse);
    });
  });
}
