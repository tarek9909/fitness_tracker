import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fitness_mobile_app/core/api/api_client.dart';
import 'package:fitness_mobile_app/features/diet/meal_quick_log_sheet.dart';
import 'package:fitness_mobile_app/features/diet/meal_logging_screen.dart';

class MockApiClient extends Fake implements ApiClient {
  final List<Map<String, dynamic>> loggedPuts = [];

  @override
  Future<dynamic> put(String path, {dynamic body}) async {
    loggedPuts.add({
      'path': path,
      'body': body,
    });
    return {'success': true, 'data': {'status': 'completed'}};
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient mockApi;

  final testMeal = {
    'id': 105,
    'name': 'High-Protein Lunch',
    'scheduled_time': '13:00:00',
    'default_grace_minutes': 1440,
    'calories': 650,
    'protein_g': 45,
    'optionGroups': [
      {
        'id': 10,
        'name': 'Protein Source',
        'max_selections': 1,
        'min_selections': 1,
        'is_optional': 0,
        'options': [
          {
            'id': 101,
            'custom_label': 'Grilled Chicken Breast',
            'calories': 220,
            'protein_g': 35,
          },
          {
            'id': 102,
            'custom_label': 'Baked Salmon Fillet',
            'calories': 280,
            'protein_g': 32,
          },
        ],
      },
      {
        'id': 20,
        'name': 'Carb Source',
        'max_selections': 1,
        'min_selections': 1,
        'is_optional': 0,
        'options': [
          {
            'id': 201,
            'custom_label': 'Steamed Brown Rice',
            'calories': 210,
            'protein_g': 5,
          },
        ],
      },
    ],
  };

  setUp(() {
    mockApi = MockApiClient();
  });

  group('MealQuickLogSheet - Custom Foods & Non-mandatory Options', () {
    testWidgets('Renders options without requiring all groups and allows single-choice deselection',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MealQuickLogSheet(
              apiClient: mockApi,
              meal: testMeal,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Groups show "Optional Choice" instead of "Required"
      expect(find.text('Optional Choice'), findsNWidgets(2));
      expect(find.text('Required'), findsNothing);

      // Tap on Grilled Chicken Breast to select it
      await tester.tap(find.text('Grilled Chicken Breast'));
      await tester.pumpAndSettle();

      // Tap it again to deselect it (toggling off)
      await tester.tap(find.text('Grilled Chicken Breast'));
      await tester.pumpAndSettle();

      // Submit meal log without selecting any option group
      final submitBtn = find.text('Confirm & Log Meal');
      await tester.ensureVisible(submitBtn);
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      // Should submit successfully without validation errors
      expect(find.textContaining('Please select at least'), findsNothing);
      expect(mockApi.loggedPuts.length, equals(1));
      expect(mockApi.loggedPuts.first['path'], equals('/me/meals/105/log'));
      expect(mockApi.loggedPuts.first['body']['selections'], isEmpty);
    });

    testWidgets('Allows adding custom food inside the meal and submits it in payload',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MealQuickLogSheet(
              apiClient: mockApi,
              meal: testMeal,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap "+ Add custom food"
      final addBtn = find.text('+ Add custom food');
      await tester.ensureVisible(addBtn);
      await tester.tap(addBtn);
      await tester.pumpAndSettle();

      expect(find.text('Add Custom Food'), findsOneWidget);

      // Enter custom food details
      await tester.enterText(
        find.widgetWithText(TextField, 'Food Name / Description *'),
        'Greek Yogurt with Honey',
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Portion'),
        '1 cup (200g)',
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Calories (kcal)'),
        '160',
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Protein (g)'),
        '18',
      );

      // Tap Add Item
      final addItemBtn = find.text('Add Item');
      await tester.ensureVisible(addItemBtn);
      await tester.tap(addItemBtn);
      await tester.pumpAndSettle();

      // Custom food item is now listed
      expect(find.text('Greek Yogurt with Honey'), findsOneWidget);
      expect(find.text('CUSTOM'), findsOneWidget);
      expect(find.textContaining('1 cup (200g) • 160 kcal • 18g Protein'), findsOneWidget);
      expect(find.text('1 added'), findsOneWidget);

      // Submit the meal
      final submitBtn = find.text('Confirm & Log Meal');
      await tester.ensureVisible(submitBtn);
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      expect(mockApi.loggedPuts.length, equals(1));
      final payload = mockApi.loggedPuts.first['body'];
      expect(payload['customFoods'], isNotNull);
      expect(payload['customFoods'].length, equals(1));
      expect(payload['customFoods'].first['name'], equals('Greek Yogurt with Honey'));
      expect(payload['customFoods'].first['servingSize'], equals('1 cup (200g)'));
      expect(payload['customFoods'].first['calories'], equals(160.0));
      expect(payload['customFoods'].first['proteinG'], equals(18.0));
    });

    testWidgets('Custom food can be removed before submission',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MealQuickLogSheet(
              apiClient: mockApi,
              meal: testMeal,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Add a custom food
      final addBtn = find.text('+ Add custom food');
      await tester.ensureVisible(addBtn);
      await tester.tap(addBtn);
      await tester.pumpAndSettle();

      await tester.enterText(
        find.widgetWithText(TextField, 'Food Name / Description *'),
        'Protein Bar',
      );
      final addItemBtn = find.text('Add Item');
      await tester.ensureVisible(addItemBtn);
      await tester.tap(addItemBtn);
      await tester.pumpAndSettle();

      expect(find.text('Protein Bar'), findsOneWidget);

      // Delete the custom food item
      final deleteIcon = find.byIcon(Icons.delete_outline);
      await tester.ensureVisible(deleteIcon);
      await tester.tap(deleteIcon);
      await tester.pumpAndSettle();

      expect(find.text('Protein Bar'), findsNothing);
      expect(find.text('0 added'), findsNothing);
    });
  });

  group('MealLoggingScreen - Custom Foods & Non-mandatory Options', () {
    testWidgets('Allows adding custom food and deselecting options in full screen',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: MealLoggingScreen(
            apiClient: mockApi,
            meal: testMeal,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Option badges show "Optional Choice"
      expect(find.text('Optional Choice'), findsNWidgets(2));

      // Tap to select option
      final optFinder = find.text('Grilled Chicken Breast');
      await tester.ensureVisible(optFinder);
      await tester.tap(optFinder);
      await tester.pumpAndSettle();

      // Tap again to deselect
      await tester.ensureVisible(optFinder);
      await tester.tap(optFinder);
      await tester.pumpAndSettle();

      // Add custom food
      final addBtn = find.text('+ Add custom food');
      await tester.ensureVisible(addBtn);
      await tester.tap(addBtn);
      await tester.pumpAndSettle();

      await tester.enterText(
        find.widgetWithText(TextField, 'Food Name / Description *'),
        'Protein Shake with Almond Milk',
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Calories (kcal)'),
        '210',
      );
      final addItemBtn = find.text('Add Item');
      await tester.ensureVisible(addItemBtn);
      await tester.tap(addItemBtn);
      await tester.pumpAndSettle();

      expect(find.text('Protein Shake with Almond Milk'), findsOneWidget);

      // Submit
      final submitBtn = find.text('Confirm & Save Meal Log');
      await tester.ensureVisible(submitBtn);
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      expect(mockApi.loggedPuts.length, equals(1));
      final payload = mockApi.loggedPuts.first['body'];
      expect(payload['customFoods'], isNotNull);
      expect(payload['customFoods'].first['name'], equals('Protein Shake with Almond Milk'));
    });
  });
}
