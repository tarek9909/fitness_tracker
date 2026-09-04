import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fitness_mobile_app/core/utils/meal_time_validator.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('MealTimeValidator Domain & Timing Logic Tests', () {
    test('Meal logged within scheduled window is marked as onTime', () {
      final meal = {
        'name': 'Breakfast',
        'scheduled_time': '08:30:00',
        'default_grace_minutes': 60,
      };

      // 08:45 AM is inside 07:30 - 09:30 window
      final result = MealTimeValidator.validate(
        meal,
        currentTime: const TimeOfDay(hour: 8, minute: 45),
      );

      expect(result.status, equals(MealTimeStatus.onTime));
      expect(result.isOnTime, isTrue);
      expect(result.isOutOfWindow, isFalse);
      expect(result.isEarly, isFalse);
      expect(result.isLate, isFalse);
      expect(result.differenceMinutes, equals(0));
    });

    test('Meal logged before scheduled window is marked as beforeTime (Early)', () {
      final meal = {
        'name': 'Lunch',
        'scheduled_time': '13:00:00', // 1:00 PM
        'default_grace_minutes': 60, // Window: 12:00 PM - 2:00 PM
      };

      // User attempts to log at 10:30 AM (90 mins before windowStart 12:00)
      final result = MealTimeValidator.validate(
        meal,
        currentTime: const TimeOfDay(hour: 10, minute: 30),
      );

      expect(result.status, equals(MealTimeStatus.beforeTime));
      expect(result.isEarly, isTrue);
      expect(result.isOutOfWindow, isTrue);
      expect(result.differenceMinutes, equals(90));
      expect(result.formattedDifference, contains('1 hr 30 mins early'));
      expect(result.dialogTitle, equals('Early Nutrition Logging'));
    });

    test('Meal logged after scheduled window is marked as afterTime (Delayed)', () {
      final meal = {
        'name': 'Breakfast',
        'scheduled_time': '08:00:00',
        'default_grace_minutes': 60, // Window: 07:00 AM - 09:00 AM
      };

      // User attempts to log at 11:15 AM (135 mins after windowEnd 09:00)
      final result = MealTimeValidator.validate(
        meal,
        currentTime: const TimeOfDay(hour: 11, minute: 15),
      );

      expect(result.status, equals(MealTimeStatus.afterTime));
      expect(result.isLate, isTrue);
      expect(result.isOutOfWindow, isTrue);
      expect(result.differenceMinutes, equals(135));
      expect(result.formattedDifference, contains('2 hrs 15 mins late'));
      expect(result.dialogTitle, equals('Delayed Nutrition Logging'));
    });

    test('Inferred schedule: Meal named "Dinner" without explicit time defaults to 19:30', () {
      final meal = {
        'name': 'Post-Workout Dinner',
        // No scheduled_time provided
        'default_grace_minutes': 60,
      };

      // 19:45 PM is within 18:30 - 20:30
      final onTimeResult = MealTimeValidator.validate(
        meal,
        currentTime: const TimeOfDay(hour: 19, minute: 45),
      );
      expect(onTimeResult.status, equals(MealTimeStatus.onTime));

      // 15:00 PM is early
      final earlyResult = MealTimeValidator.validate(
        meal,
        currentTime: const TimeOfDay(hour: 15, minute: 0),
      );
      expect(earlyResult.status, equals(MealTimeStatus.beforeTime));
      expect(earlyResult.isEarly, isTrue);
    });

    test('Custom grace period is respected', () {
      final meal = {
        'name': 'Pre-Workout Snack',
        'scheduled_time': '16:00:00',
        'default_grace_minutes': 30, // Window: 15:30 - 16:30
      };

      // 15:15 AM is outside 30-min window (early)
      final early = MealTimeValidator.validate(
        meal,
        currentTime: const TimeOfDay(hour: 15, minute: 15),
      );
      expect(early.status, equals(MealTimeStatus.beforeTime));

      // 15:45 is within 30-min window (on time)
      final onTime = MealTimeValidator.validate(
        meal,
        currentTime: const TimeOfDay(hour: 15, minute: 45),
      );
      expect(onTime.status, equals(MealTimeStatus.onTime));
    });
  });

  group('Meal Time Override Dialog Widget Tests', () {
    testWidgets('Override dialog displays timing details and confirms override', (tester) async {
      bool? dialogResult;

      final meal = {
        'name': 'Power Lunch',
        'scheduled_time': '13:00:00',
      };

      final validation = MealTimeValidator.validate(
        meal,
        currentTime: const TimeOfDay(hour: 10, minute: 0),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () async {
                  dialogResult = await showMealTimeOverrideDialog(
                    context: context,
                    meal: meal,
                    validation: validation,
                  );
                },
                child: const Text('Open Dialog'),
              ),
            ),
          ),
        ),
      );

      // Open the override dialog
      await tester.tap(find.text('Open Dialog'));
      await tester.pumpAndSettle();

      // Verify dialog elements
      expect(find.text('Early Nutrition Logging'), findsOneWidget);
      expect(find.text('EARLY NUTRITION'), findsOneWidget);
      expect(find.text('Power Lunch'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.text('Override & Log'), findsOneWidget);

      // Tap "Override & Log" to confirm
      await tester.tap(find.text('Override & Log'));
      await tester.pumpAndSettle();

      expect(dialogResult, isTrue);
    });

    testWidgets('Override dialog dismisses with false when user taps Cancel', (tester) async {
      bool? dialogResult;

      final meal = {
        'name': 'Breakfast',
        'scheduled_time': '08:00:00',
      };

      final validation = MealTimeValidator.validate(
        meal,
        currentTime: const TimeOfDay(hour: 14, minute: 0),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () async {
                  dialogResult = await showMealTimeOverrideDialog(
                    context: context,
                    meal: meal,
                    validation: validation,
                  );
                },
                child: const Text('Open Dialog'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Dialog'));
      await tester.pumpAndSettle();

      expect(find.text('Delayed Nutrition Logging'), findsOneWidget);
      expect(find.text('DELAYED NUTRITION'), findsOneWidget);

      // Tap "Cancel"
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      expect(dialogResult, isFalse);
    });
  });
}
