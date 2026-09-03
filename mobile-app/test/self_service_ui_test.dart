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
import 'package:fitness_mobile_app/features/workout/workout_plans_screen.dart';
import 'package:fitness_mobile_app/features/diet/diet_plans_screen.dart';
import 'package:fitness_mobile_app/features/configuration/fitness_configuration_screen.dart';
import 'package:fitness_mobile_app/features/auth/security_settings_screen.dart';
import 'package:fitness_mobile_app/features/auth/login_screen.dart';

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
  group('Self-Service Features & OTP Security Mobile UI Suite', () {
    testWidgets('WorkoutPlansScreen: displays plans and opens Create Plan dialog', (tester) async {
      final plans = [
        {
          'id': 1,
          'name': 'My Hypertrophy Plan',
          'description': '4-Day private split',
          'is_active': 1,
          'version_status': 'published',
        }
      ];

      final client = await createMockClient((req) async {
        if (req.method == 'GET' && req.url.path.endsWith('/me/workout-plans')) {
          return http.Response(jsonEncode({'success': true, 'data': plans}), 200);
        }
        return http.Response('{}', 404);
      });

      await tester.pumpWidget(MaterialApp(
        home: WorkoutPlansScreen(apiClient: client),
      ));
      await tester.pumpAndSettle();

      expect(find.text('My Hypertrophy Plan'), findsOneWidget);
      expect(find.text('ACTIVE'), findsOneWidget);
      expect(find.text('PUBLISHED'), findsOneWidget);

      // Tap Add Plan
      await tester.tap(find.byTooltip('Create Plan'));
      await tester.pumpAndSettle();

      expect(find.text('Create Workout Plan'), findsOneWidget);
      expect(find.text('Plan Name'), findsOneWidget);
    });

    testWidgets('DietPlansScreen: displays plans and opens Create Diet Plan dialog', (tester) async {
      final plans = [
        {
          'id': 2,
          'name': 'My Custom Macro Cut',
          'description': 'High protein low carb',
          'is_active': 0,
          'version_status': 'draft',
        }
      ];

      final client = await createMockClient((req) async {
        if (req.method == 'GET' && req.url.path.endsWith('/me/diet-plans')) {
          return http.Response(jsonEncode({'success': true, 'data': plans}), 200);
        }
        return http.Response('{}', 404);
      });

      await tester.pumpWidget(MaterialApp(
        home: DietPlansScreen(apiClient: client),
      ));
      await tester.pumpAndSettle();

      expect(find.text('My Custom Macro Cut'), findsOneWidget);
      expect(find.text('DRAFT'), findsOneWidget);

      // Tap Add Diet Plan
      await tester.tap(find.byTooltip('Create Diet Plan'));
      await tester.pumpAndSettle();

      expect(find.text('Create Diet Plan'), findsOneWidget);
      expect(find.text('Plan Name'), findsOneWidget);
      expect(find.text('Calories (kcal)'), findsOneWidget);
    });

    testWidgets('FitnessConfigurationScreen: loads profile, water, and allows tab navigation', (tester) async {
      final config = {
        'profile': {
          'height_cm': 180.5,
          'fitness_goal': 'build_muscle',
          'activity_level': 'moderately_active',
        },
        'weightGoal': {
          'starting_weight_kg': 85.0,
          'target_weight_kg': 80.0,
          'target_date': '2026-12-31',
        },
        'waterTarget': {
          'daily_target_ml': 3500,
        },
        'waterQuickAdds': [
          {'amount_ml': 250},
          {'amount_ml': 500},
          {'amount_ml': 750},
        ],
        'cardioTargets': [
          {
            'id': 10,
            'activity_name': 'running',
            'target_duration_minutes': 45,
            'frequency_per_week': 4,
          }
        ],
        'reminders': [
          {
            'id': 20,
            'title': 'Hydrate Midday',
            'category': 'water',
            'fixed_time': '12:00:00',
          }
        ],
      };

      final client = await createMockClient((req) async {
        if (req.method == 'GET' && req.url.path.endsWith('/me/fitness-configuration')) {
          return http.Response(jsonEncode({'success': true, 'data': config}), 200);
        }
        return http.Response('{}', 404);
      });

      await tester.pumpWidget(MaterialApp(
        home: FitnessConfigurationScreen(apiClient: client),
      ));
      await tester.pumpAndSettle();

      expect(find.text('PHYSICAL METRICS & LEVEL'), findsOneWidget);
      expect(find.text('WEIGHT GOAL TARGETS'), findsOneWidget);

      // Switch to Water Tab
      await tester.tap(find.text('Water'));
      await tester.pumpAndSettle();

      expect(find.text('Daily Water Target (ml)'), findsOneWidget);

      // Switch to Cardio Tab
      await tester.tap(find.text('Cardio'));
      await tester.pumpAndSettle();

      expect(find.text('RUNNING'), findsOneWidget);
      expect(find.text('45 mins • 4 sessions/week'), findsOneWidget);

      // Switch to Reminders Tab
      await tester.tap(find.text('Reminders'));
      await tester.pumpAndSettle();

      expect(find.text('Hydrate Midday'), findsOneWidget);
    });

    testWidgets('SecuritySettingsScreen: requests Password OTP challenge and renders verification form', (tester) async {
      final client = await createMockClient((req) async {
        if (req.method == 'POST' && req.url.path.endsWith('/me/security/password-change/request')) {
          return http.Response(jsonEncode({
            'success': true,
            'data': {'challengeId': 'pwd-ch-123'}
          }), 200);
        }
        return http.Response('{}', 404);
      });

      await tester.pumpWidget(MaterialApp(
        home: SecuritySettingsScreen(
          apiClient: client,
          authSession: client.authSession,
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('CHANGE PASSWORD'), findsOneWidget);
      expect(find.text('Send Verification Code'), findsOneWidget);

      // Tap Send Verification Code
      await tester.tap(find.text('Send Verification Code'));
      await tester.pumpAndSettle();

      // Form updates to OTP entry
      expect(find.text('6-Digit OTP Code'), findsOneWidget);
      expect(find.text('Current Password'), findsOneWidget);
      expect(find.text('New Password'), findsOneWidget);
      expect(find.text('Save Password'), findsOneWidget);
    });

    testWidgets('LoginScreen: Forgot password button triggers recovery dialog', (tester) async {
      final client = await createMockClient((req) async {
        return http.Response('{}', 200);
      });

      await tester.pumpWidget(MaterialApp(
        home: LoginScreen(
          apiClient: client,
          authSession: client.authSession,
        ),
      ));
      await tester.pumpAndSettle();

      // Tap Forgot password?
      await tester.tap(find.text('Forgot password?'));
      await tester.pumpAndSettle();

      expect(find.text('Password Recovery'), findsOneWidget);
      expect(find.text('Send Code'), findsOneWidget);
    });
  });
}
