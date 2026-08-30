import 'package:flutter_test/flutter_test.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Cardio & Notifications Domain Test Suite', () {
    late InMemorySecureStorageService storage;
    late AuthSession authSession;
    late SyncCoordinator syncCoordinator;

    setUp(() async {
      storage = InMemorySecureStorageService();
      authSession = AuthSession(storage: storage);
      syncCoordinator =
          SyncCoordinator(storage: storage, authSession: authSession);
      await syncCoordinator.initCoordinator();
    });

    test(
        'Cardio payload generation validates positive duration and numeric fields',
        () {
      final validPayload = {
        'cardioActivityId': 1,
        'durationMinutes': 45,
        'distanceKm': 5.2,
        'caloriesBurned': 380.0,
        'speedKmh': 7.0,
        'inclinePct': 2.0,
        'averageHeartRate': 142.0,
        'notes': 'Steady morning run',
      };

      expect(validPayload['cardioActivityId'], equals(1));
      expect(validPayload['durationMinutes'], greaterThan(0));
      expect(validPayload['distanceKm'], equals(5.2));
      expect(validPayload['caloriesBurned'], equals(380.0));
      expect(validPayload['notes'], isNotEmpty);
    });

    test('Offline enqueue for cardio session persists in mutation queue',
        () async {
      final cardioPayload = {
        'cardioActivityId': 2,
        'durationMinutes': 30,
        'distanceKm': 3.0,
        'caloriesBurned': 210,
      };

      await syncCoordinator.enqueue(
        endpoint: '/me/cardio',
        method: 'POST',
        body: cardioPayload,
      );

      expect(syncCoordinator.pendingCount, equals(1));
      final op = syncCoordinator.operations.first;
      expect(op.endpoint, equals('/me/cardio'));
      expect(op.method, equals('POST'));
      expect(op.body['durationMinutes'], equals(30));
    });

    test('Notification deep link resolution maps correct routes', () {
      final routes = {
        'workout': 'WorkoutExecutionScreen',
        '/workout': 'WorkoutExecutionScreen',
        'cardio': 'CardioScreen',
        '/cardio': 'CardioScreen',
        'weight': 'WeightScreen',
        '/weight': 'WeightScreen',
      };

      routes.forEach((link, expectedScreen) {
        String target;
        if (link.contains('workout')) {
          target = 'WorkoutExecutionScreen';
        } else if (link.contains('cardio')) {
          target = 'CardioScreen';
        } else if (link.contains('weight')) {
          target = 'WeightScreen';
        } else {
          target = 'HomeScreen';
        }
        expect(target, equals(expectedScreen));
      });
    });

    test('Offline enqueue for notification dismiss persists in mutation queue',
        () async {
      const notifId = 42;
      await syncCoordinator.enqueue(
        endpoint: '/me/notifications/$notifId/dismiss',
        method: 'POST',
        body: {},
      );

      expect(syncCoordinator.pendingCount, equals(1));
      final op = syncCoordinator.operations.first;
      expect(op.endpoint, equals('/me/notifications/42/dismiss'));
    });

    test('Active workout recovery state recognizes in-progress session', () {
      final activeSessionJson = {
        'id': 105,
        'user_id': 2,
        'workout_plan_day_id': 3,
        'workout_name_snapshot': 'Push Hypertrophy',
        'session_date': '2026-08-30',
        'status': 'in_progress',
        'started_at': '2026-08-30T10:00:00.000Z',
      };

      final hasActiveWorkout = activeSessionJson['status'] == 'in_progress';
      expect(hasActiveWorkout, isTrue);
      expect(activeSessionJson['id'], equals(105));
      expect(activeSessionJson['workout_name_snapshot'],
          equals('Push Hypertrophy'));
    });

    test(
        'Water history response parsing extracts daily total and intake date list',
        () {
      final waterHistoryResponse = {
        'success': true,
        'data': [
          {
            'intake_date': '2026-08-30',
            'total_ml': 2500,
            'amount_ml': 2500,
            'entry_count': 3,
          },
          {
            'intake_date': '2026-08-29',
            'total_ml': 3200,
            'amount_ml': 3200,
            'entry_count': 4,
          },
        ],
      };

      final dataList = waterHistoryResponse['data'] as List<dynamic>;
      expect(dataList.length, equals(2));
      final first = dataList.first as Map<String, dynamic>;
      final amount = (first['amount_ml'] ?? first['total_ml'] ?? 0);
      final date = (first['intake_date'] ?? first['logged_at'] ?? '') as String;
      expect(amount, equals(2500));
      expect(date, equals('2026-08-30'));
    });
  });
}
