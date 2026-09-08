import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:fitness_mobile_app/core/api/api_client.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';
import 'package:fitness_mobile_app/features/diet/diet_food_option_editor_modal.dart';
import 'package:fitness_mobile_app/features/workout/workout_exercise_editor_modal.dart';

Future<ApiClient> _client(
  Future<http.Response> Function(http.Request) handler,
) async {
  final storage = InMemorySecureStorageService();
  final auth = AuthSession(storage: storage);
  await auth.saveSession(
    accessToken: 'test-token',
    refreshToken: 'test-refresh',
    userJson: {'id': 1, 'email': 'test@example.com', 'firstName': 'Test'},
  );
  final httpClient = MockClient(handler);
  return ApiClient(
    authSession: auth,
    syncCoordinator: SyncCoordinator(
      storage: storage,
      authSession: auth,
      httpClient: httpClient,
    ),
    httpClient: httpClient,
  );
}

void main() {
  testWidgets('custom exercise is created and added with complete targets',
      (tester) async {
    Map<String, dynamic>? createBody;
    Map<String, dynamic>? planExerciseBody;
    final api = await _client((request) async {
      if (request.method == 'GET' && request.url.path == '/api/v1/exercises') {
        return http.Response(
          jsonEncode({'success': true, 'data': [
            {'id': 1, 'name': 'Bench Press', 'tracking_type': 'weight_reps'},
          ]}),
          200,
        );
      }
      if (request.method == 'POST' && request.url.path == '/api/v1/exercises') {
        createBody = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(
          jsonEncode({'success': true, 'data': {'id': 55}}),
          201,
        );
      }
      if (request.method == 'POST' &&
          request.url.path == '/api/v1/me/workout-plans/10/days/20/exercises') {
        planExerciseBody = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(jsonEncode({'success': true, 'data': {'id': 77}}), 201);
      }
      return http.Response('{}', 404);
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () => WorkoutExerciseEditorModal.show(
                context,
                apiClient: api,
                planId: 10,
                dayId: 20,
              ),
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Custom exercise'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('input-custom-exercise-name')),
      'Sled Drag',
    );
    await tester.tap(find.text('Add to Day'));
    await tester.pumpAndSettle();

    expect(createBody?['name'], 'Sled Drag');
    expect(createBody?['trackingType'], 'weight_reps');
    expect(planExerciseBody?['exerciseId'], 55);
    expect(planExerciseBody?['targetSets'], 3);
    expect(planExerciseBody?['sets'], hasLength(3));
    expect(planExerciseBody?['sets'][0]['targetRepsMin'], 8);
  });

  testWidgets('food option can be selected, portioned, and saved',
      (tester) async {
    Map<String, dynamic>? payload;
    final api = await _client((request) async {
      if (request.method == 'GET' && request.url.path == '/api/v1/foods') {
        return http.Response(
          jsonEncode({'success': true, 'data': [
            {
              'id': 3,
              'name': 'Chicken breast',
              'reference_quantity': 100,
              'reference_unit_id': 1,
              'unit_code': 'g',
              'calories': 165,
              'protein_g': 31,
              'carbs_g': 0,
              'fat_g': 3.6,
              'fiber_g': 0,
            },
          ]}),
          200,
        );
      }
      if (request.method == 'POST' &&
          request.url.path ==
              '/api/v1/me/diet-plans/10/option-groups/30/options') {
        payload = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(jsonEncode({'success': true, 'data': {'id': 90}}), 201);
      }
      return http.Response('{}', 404);
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () => DietFoodOptionEditorModal.show(
                context,
                apiClient: api,
                planId: 10,
                groupId: 30,
              ),
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Chicken breast'));
    await tester.pumpAndSettle();
    final quantityField = find.widgetWithText(TextField, 'Quantity');
    await tester.ensureVisible(quantityField);
    await tester.enterText(quantityField, '150');
    await tester.tap(find.text('Add food'));
    await tester.pumpAndSettle();

    expect(payload?['foodId'], 3);
    expect(payload?['servingQuantity'], 150.0);
    expect(payload?['servingUnitId'], 1);
    expect(payload?['calories'], 247.5);
    expect(payload?['proteinG'], 46.5);
  });
}
