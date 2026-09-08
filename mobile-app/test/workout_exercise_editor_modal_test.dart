import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:fitness_mobile_app/core/api/api_client.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';
import 'package:fitness_mobile_app/features/workout/workout_exercise_editor_modal.dart';

Future<ApiClient> createMockClient(
    Future<http.Response> Function(http.Request) handler) async {
  final storage = InMemorySecureStorageService();
  final authSession = AuthSession(storage: storage);
  await authSession.saveSession(
    accessToken: 'test-token',
    refreshToken: 'test-refresh',
    userJson: {
      'id': 1,
      'email': 'user@example.com',
      'firstName': 'Test',
      'lastName': 'User',
    },
  );
  final mockHttp = MockClient(handler);
  final syncCoordinator =
      SyncCoordinator(storage: storage, authSession: authSession, httpClient: mockHttp);
  return ApiClient(
    authSession: authSession,
    syncCoordinator: syncCoordinator,
    httpClient: mockHttp,
  );
}

void main() {
  group('WorkoutExerciseEditorModal Tests (Dashboard Parity)', () {
    testWidgets('Renders with empty library and shows custom exercise creator',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final client = await createMockClient((req) async {
        if (req.url.path == '/api/v1/exercises' && req.method == 'GET') {
          return http.Response(jsonEncode({'status': 'success', 'data': []}), 200);
        }
        return http.Response(jsonEncode({'status': 'error'}), 404);
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) => ElevatedButton(
                onPressed: () => WorkoutExerciseEditorModal.show(
                  ctx,
                  apiClient: client,
                  planId: 10,
                  dayId: 20,
                  dayName: 'Chest Day',
                ),
                child: const Text('Open Modal'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Modal'));
      await tester.pumpAndSettle();

      // Verify Header matches dashboard: Add Exercise to Chest Day
      expect(find.text('Add Exercise to Chest Day'), findsOneWidget);
      expect(find.text('Select Exercise'), findsOneWidget);
      expect(find.text('Name Your Exercise'), findsOneWidget);
      expect(find.text('Quick Presets:'), findsOneWidget);

      // Verify quick suggestion chips exist
      expect(find.text('Barbell Bench Press'), findsOneWidget);
      expect(find.text('Barbell Back Squat'), findsOneWidget);

      // Verify 3-column inputs match dashboard
      expect(find.text('Working Sets'), findsOneWidget);
      expect(find.text('Min Reps'), findsOneWidget);
      expect(find.text('Max Reps'), findsOneWidget);
      expect(find.text('Rest (seconds)'), findsOneWidget);
      expect(find.text('Technique & Cue Notes'), findsOneWidget);
      expect(find.text('Mark as Optional Movement'), findsOneWidget);
      expect(find.text('Add to Day'), findsOneWidget);
    });

    testWidgets('Fills fields and submits full payload for a new exercise',
        (tester) async {
      Map<String, dynamic>? capturedBody;

      final client = await createMockClient((req) async {
        if (req.url.path == '/api/v1/exercises' && req.method == 'GET') {
          return http.Response(
            jsonEncode({
              'status': 'success',
              'data': [
                {
                  'id': 55,
                  'name': 'Incline Dumbbell Press',
                  'primary_muscle_group_name': 'Chest',
                  'tracking_type': 'weight_reps',
                },
              ],
            }),
            200,
          );
        }
        if (req.url.path == '/api/v1/me/workout-plans/10/days/20/exercises' &&
            req.method == 'POST') {
          capturedBody = jsonDecode(req.body) as Map<String, dynamic>;
          return http.Response(
            jsonEncode({'status': 'success', 'data': {'id': 99}}),
            201,
          );
        }
        return http.Response(jsonEncode({'status': 'error'}), 404);
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) => ElevatedButton(
                onPressed: () => WorkoutExerciseEditorModal.show(
                  ctx,
                  apiClient: client,
                  planId: 10,
                  dayId: 20,
                  dayName: 'Upper Body',
                ),
                child: const Text('Open Modal'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Modal'));
      await tester.pumpAndSettle();

      // Selected exercise should default to first library item with muscle group format
      expect(find.text('Incline Dumbbell Press (Chest)'), findsOneWidget);

      // Scroll to bottom and tap Add to Day
      final saveBtn = find.widgetWithText(ElevatedButton, 'Add to Day');
      await tester.ensureVisible(saveBtn);
      await tester.tap(saveBtn);
      await tester.pumpAndSettle();

      // Verify captured payload matches complete schema
      expect(capturedBody, isNotNull);
      expect(capturedBody!['exerciseId'], 55);
      expect(capturedBody!['targetSets'], 3);
      expect(capturedBody!['repsMin'], 8);
      expect(capturedBody!['repsMax'], 12);
      expect(capturedBody!['restSeconds'], 90);
      expect(capturedBody!['isOptional'], false);
      expect(capturedBody!['sets'], isA<List>());
      expect((capturedBody!['sets'] as List).length, 3);
    });

    testWidgets('Pre-populates existing exercise data when editing',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final client = await createMockClient((req) async {
        if (req.url.path == '/api/v1/exercises' && req.method == 'GET') {
          return http.Response(
            jsonEncode({
              'status': 'success',
              'data': [
                {'id': 70, 'name': 'Deadlift', 'primary_muscle_group_name': 'Back'}
              ],
            }),
            200,
          );
        }
        return http.Response(jsonEncode({'status': 'error'}), 404);
      });

      final existingExercise = {
        'id': 400,
        'exercise_id': 70,
        'exercise_name': 'Deadlift',
        'primary_muscle_group_name': 'Back',
        'target_sets': 4,
        'target_reps_min': 5,
        'target_reps_max': 5,
        'rest_seconds': 180,
        'is_optional': 1,
        'notes': 'Heavy working sets',
      };

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) => ElevatedButton(
                onPressed: () => WorkoutExerciseEditorModal.show(
                  ctx,
                  apiClient: client,
                  planId: 10,
                  dayId: 20,
                  existing: existingExercise,
                ),
                child: const Text('Open Modal'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Modal'));
      await tester.pumpAndSettle();

      // Check title reflects edit mode
      expect(find.text('Edit Deadlift'), findsOneWidget);
      expect(find.text('Deadlift (Back)'), findsOneWidget);
      expect(find.text('Save Changes'), findsOneWidget);
      expect(find.text('Mark as Optional Movement'), findsOneWidget);
    });

    testWidgets('Selects preset and auto-resolves exercise ID via POST /exercises',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      Map<String, dynamic>? createdExerciseBody;
      Map<String, dynamic>? addedExerciseBody;

      final client = await createMockClient((req) async {
        if (req.url.path == '/api/v1/exercises' && req.method == 'GET') {
          return http.Response(jsonEncode({'status': 'success', 'data': []}), 200);
        }
        if (req.url.path == '/api/v1/exercises' && req.method == 'POST') {
          createdExerciseBody = jsonDecode(req.body) as Map<String, dynamic>;
          return http.Response(
            jsonEncode({
              'status': 'success',
              'data': {
                'id': 101,
                'name': createdExerciseBody?['name'] ?? 'Barbell Bench Press',
                'tracking_type': 'weight_reps',
              },
            }),
            201,
          );
        }
        if (req.url.path == '/api/v1/me/workout-plans/10/days/20/exercises' &&
            req.method == 'POST') {
          addedExerciseBody = jsonDecode(req.body) as Map<String, dynamic>;
          return http.Response(
            jsonEncode({'status': 'success', 'data': {'id': 999}}),
            201,
          );
        }
        return http.Response(jsonEncode({'status': 'error'}), 404);
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) => ElevatedButton(
                onPressed: () => WorkoutExerciseEditorModal.show(
                  ctx,
                  apiClient: client,
                  planId: 10,
                  dayId: 20,
                  dayName: 'Chest Day',
                ),
                child: const Text('Open Modal'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Modal'));
      await tester.pumpAndSettle();

      // Tap preset 'Barbell Bench Press'
      await tester.tap(find.text('Barbell Bench Press'));
      await tester.pumpAndSettle();

      // Tap Add to Day
      await tester.tap(find.text('Add to Day'));
      await tester.pumpAndSettle();

      expect(createdExerciseBody, isNotNull);
      expect(createdExerciseBody!['name'], equals('Barbell Bench Press'));
      expect(addedExerciseBody, isNotNull);
      expect(addedExerciseBody!['exerciseId'], equals(101));
    });
  });
}
