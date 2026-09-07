import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:fitness_mobile_app/core/api/api_client.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';
import 'package:fitness_mobile_app/features/diet/diet_meal_editor_modal.dart';

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
  group('DietMealEditorModal Tests', () {
    testWidgets('Renders Add Meal modal with templates and initial defaults',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final client = await createMockClient((req) async {
        return http.Response(jsonEncode({'status': 'error'}), 404);
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) => ElevatedButton(
                onPressed: () => DietMealEditorModal.show(
                  ctx,
                  apiClient: client,
                  planId: 10,
                  versionId: 2,
                  planName: 'Lean Bulk Plan',
                ),
                child: const Text('Open Modal'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Modal'));
      await tester.pumpAndSettle();

      // Verify Header & Plan Name
      expect(find.text('Add Meal'), findsOneWidget);
      expect(find.text('Lean Bulk Plan'), findsOneWidget);

      // Verify Quick Meal Presets
      expect(find.text('Breakfast'), findsOneWidget);
      expect(find.text('Lunch'), findsOneWidget);
      expect(find.text('Dinner'), findsOneWidget);
      expect(find.text('Pre-Workout'), findsOneWidget);
      expect(find.text('Post-Workout'), findsOneWidget);

      // Verify Section Headers
      expect(find.text('QUICK MEAL TEMPLATES'), findsOneWidget);
      expect(find.text('MEAL IDENTITY & SCHEDULE'), findsOneWidget);
      expect(find.text('ADHERENCE & REMINDERS'), findsOneWidget);
      expect(find.text('STARTER OPTION GROUPS'), findsOneWidget);
      expect(find.text('PREPARATION & COACH GUIDANCE'), findsOneWidget);

      // Verify Initial Time & Grace Window
      expect(find.text('08:00'), findsWidgets);
      expect(find.text('60m'), findsOneWidget);
    });

    testWidgets('Tapping preset updates meal name and suggested time',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final client = await createMockClient((req) async {
        return http.Response(jsonEncode({'status': 'error'}), 404);
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) => ElevatedButton(
                onPressed: () => DietMealEditorModal.show(
                  ctx,
                  apiClient: client,
                  planId: 10,
                  versionId: 2,
                ),
                child: const Text('Open Modal'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Modal'));
      await tester.pumpAndSettle();

      // Tap Post-Workout template
      await tester.tap(find.text('Post-Workout'));
      await tester.pumpAndSettle();

      // Verify TextField has "Post-Workout" and suggested time is 19:00
      final nameFieldFinder = find.byWidgetPredicate(
        (w) => w is TextField && w.controller?.text == 'Post-Workout',
      );
      expect(nameFieldFinder, findsOneWidget);
      expect(find.text('19:00'), findsOneWidget);
    });

    testWidgets('Submitting creates new meal with complete payload and seeds starter groups',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      Map<String, dynamic>? capturedMealBody;
      final seededGroups = <Map<String, dynamic>>[];

      final client = await createMockClient((req) async {
        if (req.url.path == '/api/v1/me/diet-plans/10/versions/2/meals' &&
            req.method == 'POST') {
          capturedMealBody = jsonDecode(req.body) as Map<String, dynamic>;
          return http.Response(
            jsonEncode({
              'status': 'success',
              'data': {
                'meals': [
                  {
                    'id': 77,
                    'name': capturedMealBody?['name'],
                    'meal_order': 1,
                  }
                ]
              }
            }),
            201,
          );
        }
        if (req.url.path == '/api/v1/me/diet-plans/10/meals/77/option-groups' &&
            req.method == 'POST') {
          seededGroups.add(jsonDecode(req.body) as Map<String, dynamic>);
          return http.Response(
            jsonEncode({'status': 'success', 'data': {'id': 88}}),
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
                onPressed: () => DietMealEditorModal.show(
                  ctx,
                  apiClient: client,
                  planId: 10,
                  versionId: 2,
                ),
                child: const Text('Open Modal'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Modal'));
      await tester.pumpAndSettle();

      // Choose Breakfast preset
      await tester.tap(find.text('Breakfast'));
      await tester.pumpAndSettle();

      // Tap Save button
      final saveBtn = find.widgetWithText(ElevatedButton, 'Save');
      await tester.tap(saveBtn);
      await tester.pumpAndSettle();

      // Verify meal payload
      expect(capturedMealBody, isNotNull);
      expect(capturedMealBody!['name'], 'Breakfast');
      expect(capturedMealBody!['scheduledTime'], '08:00:00');
      expect(capturedMealBody!['isRequired'], true);
      expect(capturedMealBody!['defaultGraceMinutes'], 60);

      // Verify starter groups were seeded (Protein Source and Carb Source by default)
      expect(seededGroups.length, 2);
      expect(seededGroups.any((g) => g['name'] == 'Protein Source'), isTrue);
      expect(seededGroups.any((g) => g['name'] == 'Carb Source'), isTrue);
    });

    testWidgets('Pre-populates existing meal when in edit mode',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final existingMeal = {
        'id': 45,
        'name': 'Power Dinner',
        'scheduled_time': '20:30:00',
        'is_required': 0,
        'default_grace_minutes': 90,
        'notes': 'High fiber veggies preferred',
      };

      final client = await createMockClient((req) async {
        return http.Response(jsonEncode({'status': 'error'}), 404);
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) => ElevatedButton(
                onPressed: () => DietMealEditorModal.show(
                  ctx,
                  apiClient: client,
                  planId: 10,
                  versionId: 2,
                  existing: existingMeal,
                ),
                child: const Text('Open Modal'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Modal'));
      await tester.pumpAndSettle();

      // Verify Edit mode header
      expect(find.text('Edit Meal'), findsOneWidget);

      // Verify pre-filled fields
      expect(find.text('Power Dinner'), findsOneWidget);
      expect(find.text('20:30'), findsOneWidget);

      final notesFinder = find.byWidgetPredicate(
        (w) => w is TextField && w.controller?.text == 'High fiber veggies preferred',
      );
      expect(notesFinder, findsOneWidget);

      // In edit mode, starter groups section is not shown
      expect(find.text('STARTER OPTION GROUPS'), findsNothing);
    });
  });
}
