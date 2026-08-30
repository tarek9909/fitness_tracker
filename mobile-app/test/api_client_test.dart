import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:fitness_mobile_app/core/api/api_client.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('empty-body mutations send an idempotency payload instead of crashing',
      () async {
    late http.Request capturedRequest;
    final mockClient = MockClient((request) async {
      capturedRequest = request;
      return http.Response(
        jsonEncode({
          'success': true,
          'data': {'message': 'ok'}
        }),
        200,
      );
    });

    final storage = InMemorySecureStorageService();
    final authSession = AuthSession(storage: storage);
    await authSession.saveSession(
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      userJson: {
        'id': 2,
        'role': 'user',
        'firstName': 'Tester',
        'email': 't@test.com'
      },
    );
    final syncCoordinator = SyncCoordinator(
      storage: storage,
      authSession: authSession,
      httpClient: mockClient,
    );
    await syncCoordinator.initCoordinator(autoFlush: false);

    final apiClient = ApiClient(
      authSession: authSession,
      syncCoordinator: syncCoordinator,
      httpClient: mockClient,
    );
    final result = await apiClient.post('/me/notifications/1/read');

    expect(result['message'], 'ok');
    final requestBody =
        jsonDecode(capturedRequest.body) as Map<String, dynamic>;
    expect(requestBody['clientOperationId'], isA<String>());
    expect(requestBody['clientOperationId'], isNotEmpty);
    expect(capturedRequest.headers['Idempotency-Key'], isNotEmpty);
  });

  test(
      '401 refresh retry preserves identical body and idempotency headers across retry for empty-body mutation',
      () async {
    final capturedRequests = <http.Request>[];
    var callCount = 0;

    final mockClient = MockClient((request) async {
      capturedRequests.add(request);
      callCount++;

      if (request.url.path.endsWith('/auth/refresh')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': {
              'accessToken': 'new-access-token',
              'refreshToken': 'new-refresh-token',
            }
          }),
          200,
        );
      }

      // First attempt on mutation endpoint fails with 401
      if (callCount == 1) {
        return http.Response(
          jsonEncode({
            'success': false,
            'error': {'code': 'UNAUTHORIZED', 'message': 'Token expired'}
          }),
          401,
        );
      }

      // Second attempt after refresh succeeds with 200
      return http.Response(
        jsonEncode({
          'success': true,
          'data': {'started': true}
        }),
        200,
      );
    });

    final storage = InMemorySecureStorageService();
    final authSession = AuthSession(storage: storage);
    await authSession.saveSession(
      accessToken: 'expired-access-token',
      refreshToken: 'valid-refresh-token',
      userJson: {
        'id': 1,
        'role': 'user',
        'firstName': 'Tester',
        'email': 'tester@fitnessplatform.com'
      },
    );
    final syncCoordinator = SyncCoordinator(
      storage: storage,
      authSession: authSession,
      httpClient: mockClient,
    );
    await syncCoordinator.initCoordinator(autoFlush: false);

    final apiClient = ApiClient(
      authSession: authSession,
      syncCoordinator: syncCoordinator,
      httpClient: mockClient,
    );

    // Call empty-body mutation
    final result = await apiClient.post('/me/workouts/start');
    expect(result['started'], true);

    // Assert total requests:
    // Request 1: POST /me/workouts/start (returned 401)
    // Request 2: POST /auth/refresh (returned 200)
    // Request 3: POST /me/workouts/start (returned 200)
    expect(capturedRequests.length, 3);
    expect(capturedRequests[0].url.path, endsWith('/me/workouts/start'));
    expect(capturedRequests[1].url.path, endsWith('/auth/refresh'));
    expect(capturedRequests[2].url.path, endsWith('/me/workouts/start'));

    // Assert headers: first has expired token, retry has new token
    expect(capturedRequests[0].headers['Authorization'],
        'Bearer expired-access-token');
    expect(capturedRequests[2].headers['Authorization'],
        'Bearer new-access-token');

    // Assert identical operation ID and idempotency headers across retry
    final initialBody =
        jsonDecode(capturedRequests[0].body) as Map<String, dynamic>;
    final retryBody =
        jsonDecode(capturedRequests[2].body) as Map<String, dynamic>;

    final initialOpId = initialBody['clientOperationId'];
    final retryOpId = retryBody['clientOperationId'];

    expect(initialOpId, isNotNull);
    expect(retryOpId, equals(initialOpId));
    expect(capturedRequests[0].headers['Idempotency-Key'], equals(initialOpId));
    expect(capturedRequests[2].headers['Idempotency-Key'], equals(initialOpId));
    expect(
        capturedRequests[0].headers['X-Idempotency-Key'], equals(initialOpId));
    expect(
        capturedRequests[2].headers['X-Idempotency-Key'], equals(initialOpId));
    expect(capturedRequests[2].body, equals(capturedRequests[0].body));
  });

  test('AuthSession updateProfile updates current user and secure storage',
      () async {
    final storage = InMemorySecureStorageService();
    final authSession = AuthSession(storage: storage);
    await authSession.saveSession(
      accessToken: 'acc',
      refreshToken: 'ref',
      userJson: {
        'id': 1,
        'role': 'user',
        'firstName': 'Initial',
        'email': 'i@test.com'
      },
    );

    expect(authSession.currentUser?.firstName, 'Initial');

    await authSession.updateProfile({
      'id': 1,
      'role': 'user',
      'firstName': 'AuthoritativeProfile',
      'email': 'i@test.com',
    });

    expect(authSession.currentUser?.firstName, 'AuthoritativeProfile');
    final storedJson = await storage.read('current_user');
    expect(storedJson, contains('AuthoritativeProfile'));
  });
}
