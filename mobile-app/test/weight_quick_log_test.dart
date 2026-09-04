import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fitness_mobile_app/core/api/api_client.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';
import 'package:fitness_mobile_app/features/weight/weight_quick_log_sheet.dart';

class MockWeightApiClient extends ApiClient {
  dynamic postPayload;
  String? postEndpoint;

  MockWeightApiClient({
    required super.authSession,
    required super.syncCoordinator,
  });

  factory MockWeightApiClient.create() {
    final storage = InMemorySecureStorageService();
    final authSession = AuthSession(storage: storage);
    final syncCoordinator = SyncCoordinator(
      storage: storage,
      authSession: authSession,
    );
    return MockWeightApiClient(
      authSession: authSession,
      syncCoordinator: syncCoordinator,
    );
  }

  @override
  Future<dynamic> get(String endpoint, {Map<String, String>? headers}) async {
    if (endpoint.startsWith('/me/weight')) {
      return {
        'currentWeightKg': 78.5,
        'entries': [
          {
            'id': 1,
            'weight_kg': 78.5,
            'measurement_date': '2026-09-04',
            'notes': 'Morning fasted',
          },
          {
            'id': 2,
            'weight_kg': 79.0,
            'measurement_date': '2026-09-03',
            'notes': null,
          },
        ],
      };
    }
    return {};
  }

  @override
  Future<dynamic> post(String endpoint, {dynamic body, Map<String, String>? headers}) async {
    postEndpoint = endpoint;
    postPayload = body;
    return {
      'success': true,
      'data': {
        'weightKg': body?['weightKg'],
        'date': '2026-09-04',
      },
    };
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('WeightQuickLogSheet Widget & Flow Tests', () {
    testWidgets('Renders sheet header, goal target, tabs, and initial weight', (tester) async {
      final mockApi = MockWeightApiClient.create();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WeightQuickLogSheet(
              apiClient: mockApi,
              currentWeightKg: 78.5,
              goal: const {
                'targetWeightKg': 75.0,
                'progressPct': 65,
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Weight Quick Log'), findsOneWidget);
      expect(find.text('78.5 kg logged'), findsOneWidget);
      expect(find.text('WEIGHT GOAL TARGET: 75.0 kg'), findsOneWidget);
      expect(find.text('65%'), findsOneWidget);
      expect(find.text('Log Weight'), findsOneWidget);
      expect(find.textContaining('History'), findsOneWidget);
      expect(find.text('TODAY\'S WEIGHT (KG)'), findsOneWidget);
      expect(find.text('Update Weight'), findsOneWidget);
    });

    testWidgets('Renders previous entries preview and switches to history tab', (tester) async {
      final mockApi = MockWeightApiClient.create();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WeightQuickLogSheet(
              apiClient: mockApi,
              currentWeightKg: 78.5,
              initialEntries: const [
                {
                  'id': 1,
                  'weight_kg': 78.5,
                  'measurement_date': '2026-09-04',
                  'notes': 'Morning fasted',
                },
                {
                  'id': 2,
                  'weight_kg': 79.0,
                  'measurement_date': '2026-09-03',
                  'notes': null,
                },
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Recent entries preview should be visible in Log tab
      expect(find.text('RECENT ENTRIES'), findsOneWidget);
      expect(find.text('78.5 kg'), findsWidgets);
      expect(find.text('Morning fasted'), findsOneWidget);

      // Tap the History tab
      await tester.tap(find.textContaining('History'));
      await tester.pumpAndSettle();

      // Should now display RECORDED WEIGH-INS list
      expect(find.text('RECORDED WEIGH-INS (2)'), findsOneWidget);
      expect(find.text('Tap entry to pre-fill'), findsOneWidget);
      expect(find.text('79.0 kg'), findsOneWidget);

      // Tap on the 79.0 kg entry to pre-fill input
      await tester.tap(find.text('79.0 kg'));
      await tester.pumpAndSettle();

      // Should have switched back to Log Weight tab with 79.0 pre-filled
      expect(find.text('79.0'), findsOneWidget);
    });

    testWidgets('Quick adjust delta buttons adjust the weight input', (tester) async {
      final mockApi = MockWeightApiClient.create();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WeightQuickLogSheet(
              apiClient: mockApi,
              currentWeightKg: 78.0,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Find the "+0.5 kg" quick adjust button and tap it
      final plusHalfButton = find.widgetWithText(InkWell, '+0.5 kg');
      expect(plusHalfButton, findsOneWidget);
      await tester.tap(plusHalfButton);
      await tester.pumpAndSettle();

      // Controller should now have 78.5
      expect(find.text('78.5'), findsOneWidget);

      // Find "-0.1 kg" button and tap it
      final minusTenthButton = find.widgetWithText(InkWell, '-0.1 kg');
      expect(minusTenthButton, findsOneWidget);
      await tester.tap(minusTenthButton);
      await tester.pumpAndSettle();

      // Controller should now have 78.4
      expect(find.text('78.4'), findsOneWidget);
    });

    testWidgets('Submitting weight calls apiClient.post and onLogged callback', (tester) async {
      final mockApi = MockWeightApiClient.create();
      bool loggedCalled = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WeightQuickLogSheet(
              apiClient: mockApi,
              currentWeightKg: 76.2,
              onLogged: () {
                loggedCalled = true;
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap submit button
      await tester.tap(find.text('Update Weight'));
      await tester.pumpAndSettle();

      expect(mockApi.postEndpoint, '/me/weight');
      expect(mockApi.postPayload, isNotNull);
      expect(mockApi.postPayload['weightKg'], 76.2);
      expect(loggedCalled, isTrue);
    });

    testWidgets('Adding optional notes sends notes in payload', (tester) async {
      final mockApi = MockWeightApiClient.create();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WeightQuickLogSheet(
              apiClient: mockApi,
              currentWeightKg: 80.0,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap "Add notes (optional)"
      await tester.tap(find.text('Add notes (optional)'));
      await tester.pumpAndSettle();

      expect(find.text('NOTES (OPTIONAL)'), findsOneWidget);

      // Enter notes
      await tester.enterText(
        find.widgetWithText(TextFormField, 'e.g. Fasted morning weigh-in after wake-up'),
        'Fasted morning post coffee',
      );
      await tester.pumpAndSettle();

      // Submit
      await tester.tap(find.text('Update Weight'));
      await tester.pumpAndSettle();

      expect(mockApi.postPayload['weightKg'], 80.0);
      expect(mockApi.postPayload['notes'], 'Fasted morning post coffee');
    });

    testWidgets('Tapping View Weight History triggers onViewHistory callback', (tester) async {
      final mockApi = MockWeightApiClient.create();
      bool historyCalled = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WeightQuickLogSheet(
              apiClient: mockApi,
              currentWeightKg: 75.0,
              onViewHistory: () {
                historyCalled = true;
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('Open Full Weight Trends & Analytics'));
      await tester.tap(find.text('Open Full Weight Trends & Analytics'));
      await tester.pumpAndSettle();

      expect(historyCalled, isTrue);
    });
  });
}
