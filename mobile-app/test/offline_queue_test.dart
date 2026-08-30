import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('SyncCoordinator & Offline Queue Suite', () {
    late InMemorySecureStorageService storage;
    late AuthSession authSession;

    setUp(() async {
      storage = InMemorySecureStorageService();
      authSession = AuthSession(storage: storage);
      await authSession.saveSession(
        accessToken: 'valid_access_token',
        refreshToken: 'valid_refresh_token',
        userJson: {
          'id': 2,
          'role': 'user',
          'firstName': 'Tester',
          'email': 't@test.com'
        },
      );
    });

    test(
        'Enqueue stores mutation securely and restores across coordinator re-initialization',
        () async {
      final mockClient = MockClient((request) async {
        return http.Response(
            jsonEncode({
              'success': true,
              'data': {'logged': true}
            }),
            201);
      });

      final coordinator = SyncCoordinator(
        storage: storage,
        authSession: authSession,
        httpClient: mockClient,
      );
      await coordinator.initCoordinator();

      expect(coordinator.pendingCount, 0);

      await coordinator.enqueue(
        method: 'POST',
        endpoint: '/me/water',
        body: {'amountMl': 500},
        operationId: 'water-op-1',
      );

      // Verify persisted in storage
      final storedJson = await storage.read('pending_sync_operations');
      expect(storedJson, isNotNull);

      // Simulate app restart
      final restartedCoordinator = SyncCoordinator(
        storage: storage,
        authSession: authSession,
        httpClient: mockClient,
      );
      await restartedCoordinator.initCoordinator(autoFlush: false);

      expect(restartedCoordinator.operations.length, 1);
      expect(restartedCoordinator.operations.first.operationId, 'water-op-1');
      expect(restartedCoordinator.operations.first.endpoint, '/me/water');
    });

    test(
        'Successful flush executes pending operations and clears queue from secure storage',
        () async {
      final executedRequests = <http.Request>[];
      final mockClient = MockClient((request) async {
        executedRequests.add(request);
        return http.Response(
            jsonEncode({
              'success': true,
              'data': {'logged': true}
            }),
            200);
      });

      final coordinator = SyncCoordinator(
        storage: storage,
        authSession: authSession,
        httpClient: mockClient,
      );
      await coordinator.initCoordinator();

      await coordinator.enqueue(
        method: 'POST',
        endpoint: '/me/water',
        body: {'amountMl': 250},
        operationId: 'sync-water-1',
      );

      await coordinator.flushQueue();

      expect(coordinator.pendingCount, 0);
      expect(coordinator.operations.isEmpty, true);
      expect(await storage.read('pending_sync_operations'), isNull);
      expect(
          executedRequests
              .any((r) => r.headers['Idempotency-Key'] == 'sync-water-1'),
          true);
    });

    test(
        'Retryable 500 server error applies bounded exponential backoff without dropping mutation',
        () async {
      final mockClient = MockClient((request) async {
        return http.Response(
            jsonEncode({
              'success': false,
              'error': {'code': 'INTERNAL_ERROR', 'message': 'DB busy'}
            }),
            500);
      });

      final coordinator = SyncCoordinator(
        storage: storage,
        authSession: authSession,
        httpClient: mockClient,
      );
      await coordinator.initCoordinator();

      await coordinator.enqueue(
        method: 'POST',
        endpoint: '/me/workouts/start',
        body: {'planDayId': 1},
        operationId: 'retry-workout-1',
      );

      await coordinator.flushQueue();

      expect(coordinator.operations.length, 1);
      final op = coordinator.operations.first;
      expect(op.status, SyncOperationStatus.pending);
      expect(op.retryCount, 1);
      expect(op.nextRetryAt, isNotNull);
      expect(op.nextRetryAt!.isAfter(DateTime.now()), true);
    });

    test(
        'Terminal 409 conflict error preserves operation in failed state for user action instead of deleting',
        () async {
      final mockClient = MockClient((request) async {
        return http.Response(
            jsonEncode({
              'success': false,
              'error': {
                'code': 'ASSIGNMENT_OVERLAP',
                'message': 'Date range overlaps with existing assignment'
              }
            }),
            409);
      });

      final coordinator = SyncCoordinator(
        storage: storage,
        authSession: authSession,
        httpClient: mockClient,
      );
      await coordinator.initCoordinator();

      await coordinator.enqueue(
        method: 'POST',
        endpoint: '/admin/users/1/assignments',
        body: {'planVersionId': 2},
        operationId: 'conflict-op-1',
      );

      await coordinator.flushQueue();

      expect(coordinator.operations.length, 1);
      expect(coordinator.failedCount, 1);
      final op = coordinator.operations.first;
      expect(op.status, SyncOperationStatus.failed);
      expect(op.errorMessage, 'Date range overlaps with existing assignment');

      // User discards operation
      await coordinator.discardOperation('conflict-op-1');
      expect(coordinator.operations.isEmpty, true);
      expect(await storage.read('pending_sync_operations'), isNull);
    });

    test(
        '401 during sync triggers single-flight token refresh and retries operation',
        () async {
      int requestCount = 0;
      final mockClient = MockClient((request) async {
        requestCount++;
        if (request.url.path.endsWith('/me/cardio') && requestCount == 1) {
          return http.Response(
              jsonEncode({
                'success': false,
                'error': {'code': 'TOKEN_EXPIRED'}
              }),
              401);
        }
        if (request.url.path.endsWith('/auth/refresh')) {
          return http.Response(
              jsonEncode({
                'success': true,
                'data': {
                  'accessToken': 'new_refreshed_access',
                  'refreshToken': 'new_refreshed_refresh'
                }
              }),
              200);
        }
        if (request.url.path.endsWith('/me/cardio') && requestCount == 3) {
          return http.Response(
              jsonEncode({
                'success': true,
                'data': {'cardioId': 10}
              }),
              201);
        }
        return http.Response('', 404);
      });

      final coordinator = SyncCoordinator(
        storage: storage,
        authSession: authSession,
        httpClient: mockClient,
      );
      await coordinator.initCoordinator();

      await coordinator.enqueue(
        method: 'POST',
        endpoint: '/me/cardio',
        body: {'cardioActivityId': 1, 'durationMinutes': 30},
        operationId: 'cardio-op-1',
      );

      await coordinator.flushQueue();

      expect(coordinator.operations.isEmpty, true);
      expect(authSession.accessToken, 'new_refreshed_access');
    });

    test(
        'Queue deserialization is resilient against corrupt individual records and preserves valid operations',
        () async {
      // Store a JSON queue containing one valid operation and one malformed/non-map entry
      final mixedQueue = [
        {
          'operationId': '00000000-0000-4000-8000-000000000001',
          'method': 'POST',
          'endpoint': '/me/water',
          'body': {'amountMl': 300},
          'queuedAt': DateTime.now().toIso8601String(),
          'status': 'pending',
        },
        'corrupted-string-entry',
      ];
      await storage.write('pending_sync_operations', jsonEncode(mixedQueue));

      final coordinator = SyncCoordinator(
        storage: storage,
        authSession: authSession,
      );
      await coordinator.initCoordinator(autoFlush: false);

      // Both operations preserved: 1 pending valid, 1 failed corrupted record
      expect(coordinator.operations.length, 2);
      expect(coordinator.operations.first.endpoint, '/me/water');
      expect(coordinator.operations.first.status, SyncOperationStatus.pending);
      expect(coordinator.operations.last.status, SyncOperationStatus.failed);
      expect(coordinator.operations.last.errorMessage,
          contains('Deserialization error'));
    });

    test('generateUuidV4 generates valid RFC 4122 version 4 UUIDs', () {
      final uuid = generateUuidV4();
      final uuidRegex = RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
      expect(uuidRegex.hasMatch(uuid), isTrue);
    });
  });
}
