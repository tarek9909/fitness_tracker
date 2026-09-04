import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fitness_mobile_app/core/api/api_client.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/storage/local_cache.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';
import 'package:fitness_mobile_app/core/widgets/premium_widgets.dart';
import 'package:fitness_mobile_app/features/home/home_screen.dart';

class _FakeSecureStorage implements SecureStorageService {
  final Map<String, String> _data = {};

  @override
  Future<void> write(String key, String value) async => _data[key] = value;

  @override
  Future<String?> read(String key) async => _data[key];

  @override
  Future<void> delete(String key) async => _data.remove(key);

  @override
  Future<void> deleteAll() async => _data.clear();
}

class _MockApiClient extends ApiClient {
  _MockApiClient({required super.authSession, required super.syncCoordinator});

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
        'overallAdherencePct': 80,
        'water': {
          'totalMl': 2000,
          'targetMl': 3000,
          'quickAdds': [250, 500],
        },
        'weight': {
          'logged': true,
          'current': 75.0,
          'goal': 72.0,
        },
        'cardio': {
          'targetMinutes': 30,
          'completedMinutes': 15,
        },
        'diet': {
          'meals': [
            {'id': 1, 'name': 'Breakfast Oatmeal & Whey', 'log': {'status': 'completed'}},
            {'id': 2, 'name': 'Grilled Chicken & Rice', 'log': null},
          ],
        },
        'workout': {
          'hasSession': false,
        },
        'tasks': [
          {'id': 1, 'taskType': 'workout', 'title': 'Push Day Session', 'isCompleted': false},
          {'id': 2, 'taskType': 'water', 'title': 'Hydrate 3000ml', 'isCompleted': true},
          {'id': 3, 'taskType': 'cardio', 'title': '20m Zone 2 Run', 'isCompleted': false},
          {'id': 4, 'taskType': 'weight', 'title': 'Morning Weigh-in', 'isCompleted': true},
        ],
      };
    }
    if (endpoint == '/me/workouts/active' || endpoint == '/me/workouts/active-session') {
      return null;
    }
    return {};
  }
}

void main() {
  testWidgets('Today\'s Tasks renders compact micro-grid, progress, and toggles collapse',
      (tester) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() => tester.view.resetPhysicalSize());

    final storage = _FakeSecureStorage();
    final authSession = AuthSession(storage: storage);
    final syncCoordinator = SyncCoordinator(authSession: authSession, storage: storage);
    final localCache = LocalCache(storage);
    final apiClient = _MockApiClient(
      authSession: authSession,
      syncCoordinator: syncCoordinator,
    );

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

    // 1. Verify Header Elements
    expect(find.text("TODAY'S TASKS"), findsOneWidget);
    expect(find.text('2/4'), findsOneWidget);
    expect(find.text('50%'), findsNWidgets(2));

    // 2. Verify Compact Task Items rendered
    expect(find.text('Push Day Session'), findsOneWidget);
    expect(find.text('Hydrate 3000ml'), findsOneWidget);
    expect(find.text('20m Zone 2 Run'), findsOneWidget);
    expect(find.text('Morning Weigh-in'), findsOneWidget);

    // 3. Scroll to Tasks card and Tap Header to Collapse Tasks
    await tester.scrollUntilVisible(
      find.text("TODAY'S TASKS"),
      200.0,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text("TODAY'S TASKS"));
    await tester.pumpAndSettle();

    // After collapsing, task grid is hidden to save space
    expect(find.text('Push Day Session'), findsNothing);
    expect(find.text('Hydrate 3000ml'), findsNothing);
    // Header remains visible
    expect(find.text("TODAY'S TASKS"), findsOneWidget);
    expect(find.text('2/4'), findsOneWidget);

    // 4. Tap Header again to Expand Tasks
    await tester.tap(find.text("TODAY'S TASKS"));
    await tester.pumpAndSettle();

    expect(find.text('Push Day Session'), findsOneWidget);
    expect(find.text('Hydrate 3000ml'), findsOneWidget);

    // 5. Scroll to Nutrition & Meals Card
    await tester.scrollUntilVisible(
      find.text("NUTRITION & MEALS"),
      200.0,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();

    // Verify Nutrition header elements
    expect(find.text("NUTRITION & MEALS"), findsOneWidget);
    expect(
      find.descendant(
        of: find.widgetWithText(PremiumCard, "NUTRITION & MEALS"),
        matching: find.text('1/2'),
      ),
      findsOneWidget,
    );

    // Verify compact meal items rendered
    expect(find.text('Breakfast Oatmeal & Whey'), findsOneWidget);
    expect(find.text('Grilled Chicken & Rice'), findsOneWidget);

    // Tap to collapse meals
    await tester.tap(find.text("NUTRITION & MEALS"));
    await tester.pumpAndSettle();

    expect(find.text('Breakfast Oatmeal & Whey'), findsNothing);
    expect(find.text('Grilled Chicken & Rice'), findsNothing);
    expect(find.text("NUTRITION & MEALS"), findsOneWidget);

    // Tap to expand meals again
    await tester.tap(find.text("NUTRITION & MEALS"));
    await tester.pumpAndSettle();

    expect(find.text('Breakfast Oatmeal & Whey'), findsOneWidget);
    expect(find.text('Grilled Chicken & Rice'), findsOneWidget);
  });
}
