import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:fitness_mobile_app/core/api/api_client.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';
import 'package:fitness_mobile_app/features/workout/workout_plan_builder_screen.dart';
import 'package:fitness_mobile_app/features/diet/diet_plan_builder_screen.dart';

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
  group('Workout & Diet Builder Widget Full Flow Suite', () {
    testWidgets('WorkoutPlanBuilderScreen: renders days and exercises, supports add and edit',
        (tester) async {
      var days = [
        {
          'id': 101,
          'weekday': 1,
          'name': 'Upper Body Power',
          'is_rest_day': 0,
          'order_index': 1,
          'notes': 'Heavy pressing focus',
          'exercises': [
            {
              'id': 201,
              'exercise_id': 1,
              'name': 'Bench Press',
              'target_sets': 4,
              'target_reps_min': 6,
              'target_reps_max': 8,
              'rest_seconds': 120,
              'notes': 'Touch chest',
              'sets': [
                {'target_reps_min': 6, 'target_reps_max': 8, 'target_weight_kg': 100}
              ],
            }
          ],
        },
        {
          'id': 102,
          'weekday': 2,
          'name': 'Rest Day',
          'is_rest_day': 1,
          'order_index': 2,
          'notes': 'Light walk',
          'exercises': [],
        }
      ];

      var postDayCalled = false;

      final client = await createMockClient((req) async {
        if (req.method == 'GET' && req.url.path == '/api/v1/me/workout-plans/1') {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'id': 1,
                'name': 'Strength Protocol',
                'description': 'Periodized strength',
                'goal_category': 'strength',
                'versions': [
                  {'id': 10, 'version_number': 1, 'status': 'draft'}
                ],
              },
            }),
            200,
          );
        }
        if (req.method == 'GET' && req.url.path == '/api/v1/me/workout-plans/1/versions/10') {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'id': 10,
                'version_number': 1,
                'status': 'draft',
                'days': days,
              },
            }),
            200,
          );
        }
        if (req.method == 'GET' && req.url.path == '/api/v1/exercises') {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': [
                {'id': 1, 'name': 'Bench Press', 'target_muscle_group': 'Chest'},
                {'id': 2, 'name': 'Squat', 'target_muscle_group': 'Legs'},
              ],
            }),
            200,
          );
        }
        if (req.method == 'POST' && req.url.path == '/api/v1/me/workout-plans/1/versions/10/days') {
          postDayCalled = true;
          final body = jsonDecode(req.body);
          days.add({
            'id': 103,
            'weekday': body['weekdayNumber'] ?? 3,
            'name': body['name'] ?? 'New Day',
            'is_rest_day': body['isRestDay'] == true ? 1 : 0,
            'order_index': 3,
            'notes': body['notes'] ?? '',
            'exercises': [],
          });
          return http.Response(jsonEncode({'success': true, 'data': {'id': 103}}), 201);
        }
        if (req.method == 'PATCH' && req.url.path.startsWith('/api/v1/me/workout-plans/1/days/')) {
          return http.Response(jsonEncode({'success': true, 'data': {}}), 200);
        }
        if (req.method == 'DELETE' && req.url.path.startsWith('/api/v1/me/workout-plans/1/days/')) {
          return http.Response(jsonEncode({'success': true, 'data': {}}), 200);
        }
        return http.Response('{}', 404);
      });

      await tester.pumpWidget(MaterialApp(
        home: WorkoutPlanBuilderScreen(apiClient: client, planId: 1),
      ));
      await tester.pumpAndSettle();

      expect(find.textContaining('Upper Body Power'), findsOneWidget);
      expect(find.text('Bench Press'), findsOneWidget);
      expect(find.textContaining('Rest Day'), findsOneWidget);

      // Tap add day button
      final addDayFinder = find.text('Add day');
      expect(addDayFinder, findsOneWidget);
      await tester.tap(addDayFinder);
      await tester.pumpAndSettle();
      expect(find.text('Add workout day'), findsOneWidget);

      // Fill day name and save
      await tester.enterText(find.byType(TextField).first, 'Leg Power Day');
      await tester.tap(find.text('Save'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(postDayCalled, isTrue);
    });

    testWidgets('DietPlanBuilderScreen: renders meals and option groups, supports add and edit',
        (tester) async {
      var meals = [
        {
          'id': 501,
          'name': 'Breakfast',
          'scheduled_time': '08:00',
          'is_required': 1,
          'notes': 'Drink water',
          'option_groups': [
            {
              'id': 601,
              'name': 'Protein Choice',
              'is_required': 1,
              'min_selections': 1,
              'max_selections': 1,
              'options': [
                {
                  'id': 701,
                  'label': 'Scrambled Eggs',
                  'calories_snapshot': 240,
                  'protein_g_snapshot': 20,
                  'carbs_g_snapshot': 2,
                  'fat_g_snapshot': 16,
                  'quantity': 200,
                }
              ],
            }
          ],
        }
      ];

      var postMealCalled = false;

      final client = await createMockClient((req) async {
        if (req.method == 'GET' && req.url.path == '/api/v1/me/diet-plans/2') {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'id': 2,
                'name': 'Keto Cut Plan',
                'description': 'High fat ketogenic cut',
                'versions': [
                  {'id': 20, 'version_number': 1, 'status': 'draft'}
                ],
              },
            }),
            200,
          );
        }
        if (req.method == 'GET' && req.url.path == '/api/v1/me/diet-plans/2/versions/20') {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'id': 20,
                'version_number': 1,
                'status': 'draft',
                'meals': meals,
              },
            }),
            200,
          );
        }
        if (req.method == 'GET' && req.url.path == '/api/v1/foods') {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': [
                {'id': 1, 'name': 'Eggs', 'calories': 140, 'protein_g': 12},
              ],
            }),
            200,
          );
        }
        if (req.method == 'POST' && req.url.path == '/api/v1/me/diet-plans/2/versions/20/meals') {
          postMealCalled = true;
          final body = jsonDecode(req.body);
          meals.add({
            'id': 502,
            'name': body['name'] ?? 'Lunch',
            'scheduled_time': body['scheduledTime'] ?? '13:00',
            'is_required': body['isRequired'] == true ? 1 : 0,
            'notes': body['notes'] ?? '',
            'option_groups': [],
          });
          return http.Response(jsonEncode({'success': true, 'data': {'meals': meals}}), 201);
        }
        if (req.method == 'PATCH' && req.url.path.startsWith('/api/v1/me/diet-plans/2/meals/')) {
          return http.Response(jsonEncode({'success': true, 'data': {'meals': meals}}), 200);
        }
        if (req.method == 'DELETE' && req.url.path.startsWith('/api/v1/me/diet-plans/2/meals/')) {
          return http.Response(jsonEncode({'success': true, 'data': {}}), 200);
        }
        return http.Response('{}', 404);
      });

      await tester.pumpWidget(MaterialApp(
        home: DietPlanBuilderScreen(apiClient: client, planId: 2),
      ));
      await tester.pumpAndSettle();

      expect(find.textContaining('Breakfast'), findsOneWidget);
      expect(find.textContaining('Protein Choice'), findsOneWidget);
      expect(find.text('Scrambled Eggs'), findsOneWidget);

      // Tap Add Meal
      final addMealFinder = find.text('Add meal');
      expect(addMealFinder, findsOneWidget);
      await tester.tap(addMealFinder);
      await tester.pumpAndSettle();
      expect(find.text('Add meal'), findsWidgets);

      // Fill meal name and save
      await tester.enterText(find.byType(TextField).first, 'Lunch Bowl');
      await tester.tap(find.text('Save'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(postMealCalled, isTrue);
    });
  });
}
