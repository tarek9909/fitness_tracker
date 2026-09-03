import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:fitness_mobile_app/core/api/api_client.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';
import 'package:fitness_mobile_app/core/widgets/premium_widgets.dart';
import 'package:fitness_mobile_app/features/workout/workout_execution_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<ApiClient> createTestApiClient({
    required Future<http.Response> Function(http.Request request) handler,
  }) async {
    final mockClient = MockClient(handler);
    final storage = InMemorySecureStorageService();
    final authSession = AuthSession(storage: storage);
    await authSession.saveSession(
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      userJson: {
        'id': 1,
        'role': 'user',
        'firstName': 'Athlete',
        'email': 'athlete@test.com',
      },
    );
    final syncCoordinator = SyncCoordinator(
      storage: storage,
      authSession: authSession,
      httpClient: mockClient,
    );
    await syncCoordinator.initCoordinator(autoFlush: false);

    return ApiClient(
      authSession: authSession,
      syncCoordinator: syncCoordinator,
      httpClient: mockClient,
    );
  }

  group('WorkoutExecutionScreen - Dynamic Targets & Neutral Defaults', () {
    testWidgets(
        'New set with planned targets pre-fills planned target values (no hardcoded fake defaults)',
        (WidgetTester tester) async {
      http.Request? capturedSetRequest;

      final sessionData = {
        'id': 10,
        'status': 'in_progress',
        'exercises': [
          {
            'id': 201,
            'exercise_name': 'Barbell Bench Press',
            'planned_sets': 3,
            'reps_min_target': 8,
            'reps_max_target': 12,
            'target_weight_kg': 65.0,
            'sets': <dynamic>[],
          }
        ],
      };

      final apiClient = await createTestApiClient(
        handler: (request) async {
          if (request.method == 'GET' &&
              request.url.path.endsWith('/me/workouts/10')) {
            return http.Response(
              jsonEncode({'success': true, 'data': sessionData}),
              200,
            );
          }
          if (request.method == 'POST' &&
              request.url.path.endsWith('/me/workouts/10/sets')) {
            capturedSetRequest = request;
            final body = jsonDecode(request.body) as Map<String, dynamic>;
            final updatedSession = {
              'id': 10,
              'status': 'in_progress',
              'exercises': [
                {
                  'id': 201,
                  'exercise_name': 'Barbell Bench Press',
                  'planned_sets': 3,
                  'reps_min_target': 8,
                  'reps_max_target': 12,
                  'target_weight_kg': 65.0,
                  'rir_target': 2,
                  'sets': [
                    {
                      'id': 301,
                      'set_number': body['setNumber'],
                      'weight_kg': body['weightKg'],
                      'reps': body['reps'],
                      'completed': 1,
                    }
                  ],
                }
              ],
            };
            return http.Response(
              jsonEncode({'success': true, 'data': updatedSession}),
              200,
            );
          }
          return http.Response('{"error": "not found"}', 404);
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: WorkoutExecutionScreen(
            apiClient: apiClient,
            existingSessionId: 10,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify exercise rendered with target info
      expect(find.text('Barbell Bench Press'), findsOneWidget);
      expect(find.text('Target: 3 Sets × 8-12 reps'), findsOneWidget);
      expect(find.text('Log Set'), findsWidgets);

      // Open Log Set for Set 1
      await tester.tap(find.byKey(const Key('log_set_button_201_1')));
      await tester.pumpAndSettle();

      // Verify dialog is open
      expect(find.text('Log Set 1'), findsOneWidget);

      // Verify inputs pre-filled with planned target (65kg, 8 reps) instead of fake 80kg/10reps
      final weightField = tester.widget<PremiumTextField>(
          find.byKey(const Key('set_dialog_weight_input')));
      final repsField = tester.widget<PremiumTextField>(
          find.byKey(const Key('set_dialog_reps_input')));

      expect(weightField.controller.text, equals('65'));
      expect(repsField.controller.text, equals('8'));

      // Tap Save Set
      await tester.tap(find.byKey(const Key('set_dialog_save_button')));
      await tester.pumpAndSettle();

      // Verify request payload
      expect(capturedSetRequest, isNotNull);
      final sentBody =
          jsonDecode(capturedSetRequest!.body) as Map<String, dynamic>;
      expect(sentBody['sessionExerciseId'], equals(201));
      expect(sentBody['setNumber'], equals(1));
      expect(sentBody['weightKg'], equals(65.0));
      expect(sentBody['reps'], equals(8));
      expect(sentBody['completed'], isTrue);
    });

    testWidgets(
        'New set with no planned targets opens with empty neutral inputs and validates required reps',
        (WidgetTester tester) async {
      http.Request? capturedSetRequest;

      final sessionData = {
        'id': 20,
        'status': 'in_progress',
        'exercises': [
          {
            'id': 202,
            'exercise_name': 'Custom Calisthenics',
            'planned_sets': 2,
            'reps_min_target': null,
            'reps_max_target': null,
            'target_weight_kg': null,
            'sets': <dynamic>[],
          }
        ],
      };

      final apiClient = await createTestApiClient(
        handler: (request) async {
          if (request.method == 'GET' &&
              request.url.path.endsWith('/me/workouts/20')) {
            return http.Response(
              jsonEncode({'success': true, 'data': sessionData}),
              200,
            );
          }
          if (request.method == 'POST' &&
              request.url.path.endsWith('/me/workouts/20/sets')) {
            capturedSetRequest = request;
            return http.Response(
              jsonEncode({'success': true, 'data': sessionData}),
              200,
            );
          }
          return http.Response('{"error": "not found"}', 404);
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: WorkoutExecutionScreen(
            apiClient: apiClient,
            existingSessionId: 20,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Open Log Set for Set 1
      await tester.tap(find.byKey(const Key('log_set_button_202_1')));
      await tester.pumpAndSettle();

      final weightField = tester.widget<PremiumTextField>(
          find.byKey(const Key('set_dialog_weight_input')));
      final repsField = tester.widget<PremiumTextField>(
          find.byKey(const Key('set_dialog_reps_input')));

      // Must NOT invent fake defaults like 80kg or 10 reps
      expect(weightField.controller.text, isEmpty);
      expect(repsField.controller.text, isEmpty);

      // Attempt to save without reps -> triggers validation error
      await tester.tap(find.byKey(const Key('set_dialog_save_button')));
      await tester.pumpAndSettle();

      expect(find.text('Please enter at least 1 rep'), findsOneWidget);
      expect(capturedSetRequest, isNull); // Request was blocked by validation

      // Enter valid reps and weight
      await tester.enterText(
          find.byKey(const Key('set_dialog_weight_input')), '0');
      await tester.enterText(
          find.byKey(const Key('set_dialog_reps_input')), '15');
      await tester.pumpAndSettle();

      // Tap Save Set
      await tester.tap(find.byKey(const Key('set_dialog_save_button')));
      await tester.pumpAndSettle();

      // Verify payload sent
      expect(capturedSetRequest, isNotNull);
      final sentBody =
          jsonDecode(capturedSetRequest!.body) as Map<String, dynamic>;
      expect(sentBody['sessionExerciseId'], equals(202));
      expect(sentBody['setNumber'], equals(1));
      expect(sentBody['weightKg'], equals(0.0));
      expect(sentBody['reps'], equals(15));
    });

    testWidgets(
        'Editing an existing logged set preserves prior logged values and saves updates',
        (WidgetTester tester) async {
      http.Request? capturedSetRequest;

      final sessionData = {
        'id': 30,
        'status': 'in_progress',
        'exercises': [
          {
            'id': 203,
            'exercise_name': 'Incline Dumbbell Press',
            'planned_sets': 2,
            'reps_min_target': 10,
            'reps_max_target': 12,
            'target_weight_kg': 28.0,
            'sets': [
              {
                'id': 401,
                'set_number': 1,
                'weight_kg': 32.5,
                'reps': 10,
                'completed': 1,
              }
            ],
          }
        ],
      };

      final apiClient = await createTestApiClient(
        handler: (request) async {
          if (request.method == 'GET' &&
              request.url.path.endsWith('/me/workouts/30')) {
            return http.Response(
              jsonEncode({'success': true, 'data': sessionData}),
              200,
            );
          }
          if (request.method == 'POST' &&
              request.url.path.endsWith('/me/workouts/30/sets')) {
            capturedSetRequest = request;
            return http.Response(
              jsonEncode({'success': true, 'data': sessionData}),
              200,
            );
          }
          return http.Response('{"error": "not found"}', 404);
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: WorkoutExecutionScreen(
            apiClient: apiClient,
            existingSessionId: 30,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify Set 1 is shown as completed with logged values
      expect(find.text('32.5 kg × 10 reps'), findsOneWidget);
      expect(find.text('Edit'), findsOneWidget);

      // Tap Edit
      await tester.tap(find.byKey(const Key('log_set_button_203_1')));
      await tester.pumpAndSettle();

      // Verify Edit dialog title
      expect(find.text('Edit Set 1'), findsOneWidget);

      // Verify previous logged values are populated
      final weightField = tester.widget<PremiumTextField>(
          find.byKey(const Key('set_dialog_weight_input')));
      final repsField = tester.widget<PremiumTextField>(
          find.byKey(const Key('set_dialog_reps_input')));

      expect(weightField.controller.text, equals('32.5'));
      expect(repsField.controller.text, equals('10'));

      // Update reps to 11
      await tester.enterText(
          find.byKey(const Key('set_dialog_reps_input')), '11');
      await tester.pumpAndSettle();

      // Tap Save Set
      await tester.tap(find.byKey(const Key('set_dialog_save_button')));
      await tester.pumpAndSettle();

      // Verify payload sent with edited reps and preserved weight
      expect(capturedSetRequest, isNotNull);
      final sentBody =
          jsonDecode(capturedSetRequest!.body) as Map<String, dynamic>;
      expect(sentBody['sessionExerciseId'], equals(203));
      expect(sentBody['setNumber'], equals(1));
      expect(sentBody['weightKg'], equals(32.5));
      expect(sentBody['reps'], equals(11));
    });

    testWidgets(
        'Finish workout sends clean empty payload when no optional notes or rating are entered (no synthetic notes)',
        (WidgetTester tester) async {
      http.Request? capturedCompleteRequest;

      final sessionData = {
        'id': 40,
        'status': 'in_progress',
        'exercises': <dynamic>[],
      };

      final apiClient = await createTestApiClient(
        handler: (request) async {
          if (request.method == 'GET' &&
              request.url.path.endsWith('/me/workouts/40')) {
            return http.Response(
              jsonEncode({'success': true, 'data': sessionData}),
              200,
            );
          }
          if (request.method == 'POST' &&
              request.url.path.endsWith('/me/workouts/40/complete')) {
            capturedCompleteRequest = request;
            return http.Response(
              jsonEncode({
                'success': true,
                'data': {'id': 40, 'status': 'completed'}
              }),
              200,
            );
          }
          return http.Response('{"error": "not found"}', 404);
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: WorkoutExecutionScreen(
            apiClient: apiClient,
            existingSessionId: 40,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap Finish in AppBar
      await tester.tap(find.text('Finish'));
      await tester.pumpAndSettle();

      // Verify Finish Workout dialog is displayed
      expect(find.text('Finish Workout'), findsWidgets);
      expect(find.text('Session Notes (optional)'), findsOneWidget);

      // Tap Finish Workout inside dialog without entering notes or rating
      await tester.tap(find.widgetWithText(PremiumButton, 'Finish Workout'));
      await tester.pumpAndSettle();

      // Verify no synthetic note "Completed on mobile app" or rating 5 was injected
      expect(capturedCompleteRequest, isNotNull);
      final sentBody =
          jsonDecode(capturedCompleteRequest!.body) as Map<String, dynamic>;
      expect(sentBody.containsKey('notes'), isFalse);
      expect(sentBody.containsKey('rating'), isFalse);
    });

    testWidgets(
        'Finish workout sends explicit user notes and star rating when entered',
        (WidgetTester tester) async {
      http.Request? capturedCompleteRequest;

      final sessionData = {
        'id': 50,
        'status': 'in_progress',
        'exercises': <dynamic>[],
      };

      final apiClient = await createTestApiClient(
        handler: (request) async {
          if (request.method == 'GET' &&
              request.url.path.endsWith('/me/workouts/50')) {
            return http.Response(
              jsonEncode({'success': true, 'data': sessionData}),
              200,
            );
          }
          if (request.method == 'POST' &&
              request.url.path.endsWith('/me/workouts/50/complete')) {
            capturedCompleteRequest = request;
            return http.Response(
              jsonEncode({
                'success': true,
                'data': {'id': 50, 'status': 'completed'}
              }),
              200,
            );
          }
          return http.Response('{"error": "not found"}', 404);
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: WorkoutExecutionScreen(
            apiClient: apiClient,
            existingSessionId: 50,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap Finish in AppBar
      await tester.tap(find.text('Finish'));
      await tester.pumpAndSettle();

      // Enter notes
      await tester.enterText(
        find.widgetWithText(PremiumTextField, 'Session Notes (optional)'),
        'Felt strong on bench press today',
      );

      // Select 4-star rating (the 4th star button)
      final starButtons = find.byType(PremiumIconButton);
      await tester.tap(starButtons.at(3));
      await tester.pumpAndSettle();

      // Tap Finish Workout
      await tester.tap(find.widgetWithText(PremiumButton, 'Finish Workout'));
      await tester.pumpAndSettle();

      // Verify payload contains explicit user values
      expect(capturedCompleteRequest, isNotNull);
      final sentBody =
          jsonDecode(capturedCompleteRequest!.body) as Map<String, dynamic>;
      expect(sentBody['notes'], equals('Felt strong on bench press today'));
      expect(sentBody['rating'], equals(4));
    });

    testWidgets(
        'Absent planned sets renders unconfigured message without inventing a synthetic set, and Add Set logs set 1',
        (WidgetTester tester) async {
      http.Request? capturedSetRequest;

      final sessionData = {
        'id': 60,
        'status': 'in_progress',
        'exercises': [
          {
            'id': 206,
            'exercise_name': 'Custom Kettlebell Swing',
            'planned_sets': null,
            'sets': <dynamic>[],
          }
        ],
      };

      final apiClient = await createTestApiClient(
        handler: (request) async {
          if (request.method == 'GET' &&
              request.url.path.endsWith('/me/workouts/60')) {
            return http.Response(
              jsonEncode({'success': true, 'data': sessionData}),
              200,
            );
          }
          if (request.method == 'POST' &&
              request.url.path.endsWith('/me/workouts/60/sets')) {
            capturedSetRequest = request;
            final body = jsonDecode(request.body) as Map<String, dynamic>;
            final updatedSession = {
              'id': 60,
              'status': 'in_progress',
              'exercises': [
                {
                  'id': 206,
                  'exercise_name': 'Custom Kettlebell Swing',
                  'planned_sets': null,
                  'sets': [
                    {
                      'id': 601,
                      'set_number': body['setNumber'],
                      'weight_kg': body['weightKg'],
                      'reps': body['reps'],
                      'completed': 1,
                    }
                  ],
                }
              ],
            };
            return http.Response(
              jsonEncode({'success': true, 'data': updatedSession}),
              200,
            );
          }
          return http.Response('{"error": "not found"}', 404);
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: WorkoutExecutionScreen(
            apiClient: apiClient,
            existingSessionId: 60,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify unconfigured message rendered and NO synthetic Set 1 card
      expect(find.text('No planned sets configured.'), findsOneWidget);
      expect(find.byKey(const Key('add_set_button_206')), findsOneWidget);
      expect(find.text('Set 1'), findsNothing);

      // Tap Add Set
      await tester.tap(find.byKey(const Key('add_set_button_206')));
      await tester.pumpAndSettle();

      // Dialog opens for Set 1
      expect(find.text('Log Set 1'), findsOneWidget);

      await tester.enterText(
          find.byKey(const Key('set_dialog_weight_input')), '24');
      await tester.enterText(
          find.byKey(const Key('set_dialog_reps_input')), '20');
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('set_dialog_save_button')));
      await tester.pumpAndSettle();

      expect(capturedSetRequest, isNotNull);
      final sentBody =
          jsonDecode(capturedSetRequest!.body) as Map<String, dynamic>;
      expect(sentBody['sessionExerciseId'], equals(206));
      expect(sentBody['setNumber'], equals(1));
      expect(sentBody['weightKg'], equals(24.0));
      expect(sentBody['reps'], equals(20));
    });

    testWidgets(
        'Duration tracking type displays duration field and sends only durationSeconds',
        (WidgetTester tester) async {
      http.Request? capturedSetRequest;

      final sessionData = {
        'id': 70,
        'status': 'in_progress',
        'exercises': [
          {
            'id': 207,
            'exercise_name': 'Plank',
            'tracking_type': 'duration',
            'planned_sets': 1,
            'sets': <dynamic>[],
          }
        ],
      };

      final apiClient = await createTestApiClient(
        handler: (request) async {
          if (request.method == 'GET' &&
              request.url.path.endsWith('/me/workouts/70')) {
            return http.Response(
              jsonEncode({'success': true, 'data': sessionData}),
              200,
            );
          }
          if (request.method == 'POST' &&
              request.url.path.endsWith('/me/workouts/70/sets')) {
            capturedSetRequest = request;
            return http.Response(
              jsonEncode({'success': true, 'data': sessionData}),
              200,
            );
          }
          return http.Response('{"error": "not found"}', 404);
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: WorkoutExecutionScreen(
            apiClient: apiClient,
            existingSessionId: 70,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Open Log Set for Set 1
      await tester.tap(find.byKey(const Key('log_set_button_207_1')));
      await tester.pumpAndSettle();

      // Verify duration input is present and weight/reps inputs are absent
      expect(
          find.byKey(const Key('set_dialog_duration_input')), findsOneWidget);
      expect(find.byKey(const Key('set_dialog_weight_input')), findsNothing);
      expect(find.byKey(const Key('set_dialog_reps_input')), findsNothing);

      // Enter 90 seconds
      await tester.enterText(
          find.byKey(const Key('set_dialog_duration_input')), '90');
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('set_dialog_save_button')));
      await tester.pumpAndSettle();

      expect(capturedSetRequest, isNotNull);
      final sentBody =
          jsonDecode(capturedSetRequest!.body) as Map<String, dynamic>;
      expect(sentBody['sessionExerciseId'], equals(207));
      expect(sentBody['setNumber'], equals(1));
      expect(sentBody['durationSeconds'], equals(90));
      expect(sentBody.containsKey('weightKg'), isFalse);
      expect(sentBody.containsKey('reps'), isFalse);
    });

    testWidgets(
        'Loads and displays /me/exercises/:exerciseId/previous-performance when session lacks it',
        (WidgetTester tester) async {
      final sessionData = {
        'id': 80,
        'status': 'in_progress',
        'exercises': [
          {
            'id': 208,
            'exercise_id': 5,
            'exercise_name': 'Overhead Press',
            'planned_sets': 3,
            'sets': <dynamic>[],
          }
        ],
      };

      final apiClient = await createTestApiClient(
        handler: (request) async {
          if (request.method == 'GET' &&
              request.url.path.endsWith('/me/workouts/80')) {
            return http.Response(
              jsonEncode({'success': true, 'data': sessionData}),
              200,
            );
          }
          if (request.method == 'GET' &&
              request.url.path
                  .endsWith('/me/exercises/5/previous-performance')) {
            return http.Response(
              jsonEncode({
                'success': true,
                'data': {
                  'exerciseId': 5,
                  'maxWeightKg': 50.0,
                  'recentSets': [
                    {
                      'weight_kg': 45.0,
                      'reps': 8,
                    }
                  ],
                },
              }),
              200,
            );
          }
          return http.Response('{"error": "not found"}', 404);
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: WorkoutExecutionScreen(
            apiClient: apiClient,
            existingSessionId: 80,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify that previous performance was loaded and displayed
      expect(
          find.text('Last session: 45.0 kg × 8 reps'), findsOneWidget);
    });

    testWidgets(
        'Restores active workout session from local cache when offline or resuming',
        (WidgetTester tester) async {
      final cachedSession = {
        'id': 99,
        'status': 'in_progress',
        'exercises': [
          {
            'id': 299,
            'exercise_name': 'Locally Restored Pull-ups',
            'tracking_type': 'bodyweight_reps',
            'planned_sets': 3,
            'sets': [
              {
                'id': 991,
                'set_number': 1,
                'reps': 12,
                'completed': 1,
              }
            ],
          }
        ],
      };

      final apiClient = await createTestApiClient(
        handler: (request) async {
          // Simulate offline/network failure
          return http.Response('{"error": "offline"}', 503);
        },
      );

      // Pre-seed local cache
      final storage = apiClient.authSession.storage;
      await storage.write(
          'active_workout_session.1', jsonEncode(cachedSession));

      await tester.pumpWidget(
        MaterialApp(
          home: WorkoutExecutionScreen(
            apiClient: apiClient,
            existingSessionId: 99,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify that the locally cached session was restored and rendered
      expect(find.text('Locally Restored Pull-ups'), findsOneWidget);
      expect(find.text('12 reps'), findsOneWidget);
    });
  });
}
