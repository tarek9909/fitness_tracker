import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fitness_mobile_app/core/api/api_client.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/storage/local_cache.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';
import 'package:fitness_mobile_app/core/theme/theme_controller.dart';
import 'package:fitness_mobile_app/features/diet/meal_logging_screen.dart';
import 'package:fitness_mobile_app/features/home/home_screen.dart';
import 'package:fitness_mobile_app/features/workout/workout_execution_screen.dart';
import 'package:fitness_mobile_app/features/history/history_screen.dart';
import 'package:fitness_mobile_app/features/cardio/cardio_screen.dart';
import 'package:fitness_mobile_app/features/weight/weight_screen.dart';
import 'package:fitness_mobile_app/features/progress/progress_screen.dart';
import 'package:fitness_mobile_app/features/notifications/notifications_screen.dart';
import 'package:fitness_mobile_app/main.dart';

class MockApiClient extends ApiClient {
  MockApiClient({required super.authSession, required super.syncCoordinator});

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
    if (endpoint == '/me/today') {
      return {
        'date': '2026-09-03',
        'overallAdherencePct': 85,
        'completedTasks': 5,
        'totalTasks': 6,
        'workout': {
          'id': 101,
          'name': 'Upper Body Hypertrophy & Power',
          'is_rest_day': 0,
          'exercises': [
            {'id': 1, 'name': 'Bench Press'},
            {'id': 2, 'name': 'Barbell Row'},
          ],
        },
        'diet': {
          'meals': [
            {
              'id': 201,
              'name': 'Post-Workout High Protein Shake & Oatmeal',
              'scheduled_time': '12:30 PM',
              'log': {'status': 'completed'},
            },
            {
              'id': 202,
              'name': 'Grilled Chicken Breast with Steamed Broccoli',
              'scheduled_time': '06:00 PM',
              'log': null,
            },
          ],
        },
        'cardio': {
          'targetMinutes': 30,
          'completedMinutes': 25,
          'activityName': 'High-Intensity Treadmill Intervals',
        },
        'water': {
          'totalMl': 2250,
          'targetMl': 3000,
          'quickAdds': [250, 500, 750],
        },
        'weight': {
          'logged': true,
          'current': 78.5,
        },
        'tasks': [
          {'id': 1, 'title': 'Complete Morning Mobility Routine', 'isCompleted': true},
          {'id': 2, 'title': 'Hydrate 1000ml before midday', 'isCompleted': true},
        ],
      };
    }
    if (endpoint == '/me/workouts/active') {
      return {
        'id': 999,
        'workout_name_snapshot': 'Push Hypertrophy Heavy Session',
        'status': 'in_progress',
      };
    }
    if (endpoint.startsWith('/me/workouts/')) {
      return {
        'id': 999,
        'workout_name_snapshot': 'Push Hypertrophy Heavy Session',
        'exercises': [
          {
            'id': 1,
            'exercise_name': 'Incline Dumbbell Chest Press with Rotation',
            'tracking_type': 'weight_reps',
            'planned_sets': 3,
            'reps_min_target': 8,
            'reps_max_target': 12,
            'target_weight_kg': 32.5,
            'previous_performance': {
              'weight_kg': 30.0,
              'reps': 10,
            },
            'sets': [
              {
                'set_number': 1,
                'completed': 1,
                'weight_kg': 32.5,
                'reps': 10,
              },
            ],
          },
        ],
      };
    }
    if (endpoint.startsWith('/me/meals/history')) {
      return [
        {
          'id': 1,
          'meal_name': 'Grilled Salmon Fillet with Brown Rice & Steamed Greens',
          'meal_date': '2026-09-02',
          'status': 'completed',
          'total_calories': 680,
        },
      ];
    }
    if (endpoint.startsWith('/me/workouts/history')) {
      return [
        {
          'id': 1,
          'workout_name_snapshot': 'Comprehensive Full Body Functional Strength Phase 2',
          'session_date': '2026-09-02',
          'exercise_count': 7,
          'completed_sets_count': 21,
        },
      ];
    }
    if (endpoint.startsWith('/me/cardio/history')) {
      return [
        {
          'id': 1,
          'activity_name': 'Outdoor High-Intensity Interval Sprinting',
          'cardio_date': '2026-09-02',
          'duration_minutes': 45,
          'distance_km': 6.5,
          'calories_burned': 520,
        },
      ];
    }
    if (endpoint.startsWith('/me/cardio/activities')) {
      return [
        {'id': 1, 'name': 'Running'},
        {'id': 2, 'name': 'Cycling'},
      ];
    }
    if (endpoint.startsWith('/me/weight')) {
      return {
        'currentWeightKg': 78.5,
        'goal': {
          'startWeightKg': 88.0,
          'targetWeightKg': 75.0,
          'weightLostKg': 9.5,
          'progressPct': 73,
        },
        'entries': [
          {'id': 1, 'weight_kg': 78.5, 'measurement_date': '2026-09-03'},
          {'id': 2, 'weight_kg': 79.0, 'measurement_date': '2026-09-02'},
        ],
      };
    }
    if (endpoint.startsWith('/me/progress')) {
      return {
        'workouts': {'completedSessions': 24, 'totalSets': 180},
        'cardio': {'totalMinutes': 450, 'totalCalories': 3800},
        'weight': {'currentWeightKg': 78.5},
      };
    }
    if (endpoint.startsWith('/me/notifications')) {
      return [
        {
          'id': 1,
          'title': 'Time to execute your Push Hypertrophy Heavy Session!',
          'body': 'Your coach scheduled high-intensity sets today. Drink water and warm up.',
          'status': 'unread',
          'category': 'workout',
        },
      ];
    }
    return {};
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('RenderFlex Overflow Detection Tests (360x640 mobile screen)', () {
    late InMemorySecureStorageService storage;
    late AuthSession authSession;
    late SyncCoordinator syncCoordinator;
    late MockApiClient apiClient;
    late LocalCache localCache;
    late ThemeController themeController;

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
      apiClient = MockApiClient(
        authSession: authSession,
        syncCoordinator: syncCoordinator,
      );
      localCache = LocalCache(storage);
      themeController = ThemeController(storage: storage);
    });

    testWidgets('HomeScreen renders without any RenderFlex overflow on 360x640',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
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
      expect(find.text('TRAINING SESSION'), findsOneWidget);
    });

    testWidgets(
        'MealLoggingScreen renders without any RenderFlex overflow on 360x640',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: MealLoggingScreen(
            apiClient: apiClient,
            meal: const {
              'id': 201,
              'name': 'Post-Workout High Protein Shake & Oatmeal',
              'optionGroups': [
                {
                  'id': 1,
                  'name': 'Complex Carbohydrate & Fiber Selection',
                  'max_selections': 2,
                  'min_selections': 1,
                  'options': [
                    {
                      'id': 11,
                      'custom_label': 'Rolled Oats with Cinnamon & Chia Seeds',
                      'calories': 250,
                      'protein_g': 8,
                    },
                  ],
                },
              ],
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('MEAL STATUS'), findsOneWidget);
    });

    testWidgets(
        'WorkoutExecutionScreen renders without any RenderFlex overflow on 360x640',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: WorkoutExecutionScreen(
            apiClient: apiClient,
            existingSessionId: 999,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Live Workout Tracker'), findsOneWidget);
    });

    testWidgets(
        'HistoryScreen renders without any RenderFlex overflow on 360x640',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: HistoryScreen(
            apiClient: apiClient,
            localCache: localCache,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Activity History'), findsOneWidget);
    });

    testWidgets(
        'WeightScreen renders without any RenderFlex overflow on 360x640',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: WeightScreen(
            apiClient: apiClient,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Body Weight Tracker'), findsOneWidget);
    });

    testWidgets(
        'CardioScreen renders without any RenderFlex overflow on 360x640',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: CardioScreen(
            apiClient: apiClient,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Cardio Tracking'), findsOneWidget);
    });

    testWidgets(
        'ProgressScreen renders without any RenderFlex overflow on 360x640',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: ProgressScreen(
            apiClient: apiClient,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Progress & Analytics'), findsOneWidget);
    });

    testWidgets(
        'NotificationsScreen renders without any RenderFlex overflow on 360x640',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: NotificationsScreen(
            apiClient: apiClient,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Notifications'), findsOneWidget);
    });

    testWidgets(
        'MainNavigationShell renders without any RenderFlex overflow on 360x640',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: MainNavigationShell(
            apiClient: apiClient,
            authSession: authSession,
            localCache: localCache,
            syncCoordinator: syncCoordinator,
            themeController: themeController,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(MainNavigationShell), findsOneWidget);
    });
  });
}
