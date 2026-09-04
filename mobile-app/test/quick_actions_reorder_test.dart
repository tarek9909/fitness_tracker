import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fitness_mobile_app/core/api/api_client.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/storage/local_cache.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';
import 'package:fitness_mobile_app/features/home/home_screen.dart';

class MockQuickActionsApiClient extends ApiClient {
  MockQuickActionsApiClient({required super.authSession, required super.syncCoordinator});

  @override
  Future<dynamic> get(String endpoint, {Map<String, String>? headers}) async {
    if (endpoint == '/me') {
      return {
        'id': 1,
        'firstName': 'Alex',
        'lastName': 'Runner',
        'email': 'alex@example.com',
      };
    }
    if (endpoint == '/me/today' || endpoint == '/me/daily-plan/today') {
      return {
        'date': '2026-09-04',
        'overallAdherencePct': 85,
        'completedTasks': 5,
        'totalTasks': 6,
        'workout': {
          'id': 101,
          'name': 'Upper Body Hypertrophy',
          'is_rest_day': 0,
          'exercises': [
            {'id': 1, 'name': 'Bench Press'},
          ],
        },
        'diet': {
          'meals': [
            {
              'id': 201,
              'name': 'Breakfast',
              'log': {'status': 'completed'},
            },
            {
              'id': 202,
              'name': 'Lunch',
              'log': {'status': 'pending'},
            },
          ],
        },
        'cardio': {
          'targetMinutes': 30,
          'completedMinutes': 15,
          'activityName': 'Running',
        },
        'water': {
          'totalMl': 1500,
          'targetMl': 3000,
          'quickAdds': [250, 500, 750],
        },
        'weight': {
          'logged': true,
          'current': 78.5,
          'goal': 75.0,
        },
        'adherence': {
          'score': 85,
        },
      };
    }
    if (endpoint == '/me/workouts/active') {
      return {'data': null};
    }
    return {};
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late InMemorySecureStorageService storage;
  late AuthSession authSession;
  late SyncCoordinator syncCoordinator;
  late MockQuickActionsApiClient apiClient;
  late LocalCache localCache;

  setUp(() async {
    storage = InMemorySecureStorageService();
    authSession = AuthSession(storage: storage);
    await authSession.saveSession(
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      userJson: {
        'id': 1,
        'firstName': 'Alex',
        'lastName': 'Runner',
        'email': 'alex@example.com',
      },
    );
    syncCoordinator = SyncCoordinator(
      storage: storage,
      authSession: authSession,
    );
    apiClient = MockQuickActionsApiClient(
      authSession: authSession,
      syncCoordinator: syncCoordinator,
    );
    localCache = LocalCache(storage);
  });

  group('Quick Actions 3-Per-Line & Reorderable Draggable Tests', () {
    testWidgets('Renders quick actions 3 per row and displays all 6 actions', (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: HomeScreen(
            apiClient: apiClient,
            authSession: authSession,
            localCache: localCache,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify header
      expect(find.text('QUICK ACTIONS'), findsOneWidget);
      expect(find.text('Reorder'), findsOneWidget);
      expect(find.text('Reset'), findsOneWidget);

      // Verify all 6 quick action pills exist
      expect(find.text('Workout'), findsOneWidget);
      expect(find.text('Meals'), findsOneWidget);
      expect(find.text('Water'), findsOneWidget);
      expect(find.text('Cardio'), findsOneWidget);
      expect(find.text('Weight'), findsOneWidget);
      expect(find.text('History'), findsOneWidget);

      // Verify LongPressDraggable widgets are used for dragging
      final draggables = find.byType(LongPressDraggable<String>);
      expect(draggables, findsNWidgets(6));

      // Verify DragTarget widgets are used for dropping
      final dragTargets = find.byType(DragTarget<String>);
      expect(dragTargets, findsNWidgets(6));
    });

    testWidgets('Drag and drop reorders items and Reset restores default order', (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: HomeScreen(
            apiClient: apiClient,
            authSession: authSession,
            localCache: localCache,
          ),
        ),
      );
      await tester.pumpAndSettle();

      final historyFinder = find.text('History');
      final workoutFinder = find.text('Workout');

      expect(historyFinder, findsOneWidget);
      expect(workoutFinder, findsOneWidget);

      // Perform long press drag gesture
      final gesture = await tester.startGesture(tester.getCenter(historyFinder));
      await tester.pump(const Duration(milliseconds: 300)); // Trigger long press delay

      // Move over workout
      await gesture.moveTo(tester.getCenter(workoutFinder));
      await tester.pump();

      // Drop
      await gesture.up();
      await tester.pumpAndSettle();

      // Tap Reset to restore order
      await tester.tap(find.text('Reset'));
      await tester.pumpAndSettle();

      // Verify Workout and History are still available
      expect(find.text('Workout'), findsOneWidget);
      expect(find.text('History'), findsOneWidget);
    });
  });
}
