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
  group('WorkoutExerciseEditorModal Tests', () {
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

      // Verify Header and empty library UI
      expect(find.text('Add Exercise'), findsOneWidget);
      expect(find.text('Chest Day'), findsOneWidget);
      expect(find.text('Name Your Exercise'), findsOneWidget);
      expect(find.text('Quick Presets:'), findsOneWidget);

      // Verify quick suggestion chips exist
      expect(find.text('Barbell Bench Press'), findsOneWidget);
      expect(find.text('Barbell Back Squat'), findsOneWidget);

      // Verify prescription section
      expect(find.text('TARGET PRESCRIPTION'), findsOneWidget);
      expect(find.text('Apply Defaults'), findsOneWidget);
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
                  'target_muscle_group': 'Chest',
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
                ),
                child: const Text('Open Modal'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Modal'));
      await tester.pumpAndSettle();

      // Selected exercise should default to first library item
      expect(find.text('Incline Dumbbell Press'), findsOneWidget);

      // Scroll to bottom and tap Save
      final saveBtn = find.widgetWithText(ElevatedButton, 'Save Exercise');
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
                {'id': 70, 'name': 'Deadlift', 'target_muscle_group': 'Back'}
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
        'target_sets': 4,
        'target_reps_min': 5,
        'target_reps_max': 5,
        'rest_seconds': 180,
        'is_optional': 1,
        'notes': 'Heavy working sets',
        'sets': [
          {
            'set_number': 1,
            'target_reps_min': 5,
            'target_reps_max': 5,
            'target_weight_kg': 140,
            'rest_seconds': 180,
            'notes': 'Form check',
          },
          {
            'set_number': 2,
            'target_reps_min': 5,
            'target_reps_max': 5,
            'target_weight_kg': 140,
            'rest_seconds': 180,
          },
        ],
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
      expect(find.text('Edit Exercise'), findsOneWidget);
      expect(find.text('Deadlift'), findsWidgets);
      expect(find.text('SET 1'), findsOneWidget);
      expect(find.text('SET 2'), findsOneWidget);

      // Verify coach notes and optional toggle are visible
      expect(find.text('Exercise Coach Notes'), findsOneWidget);
      expect(find.text('Optional Exercise'), findsOneWidget);
    });
  });
}
