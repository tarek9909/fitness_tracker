import 'package:flutter_test/flutter_test.dart';
import 'package:fitness_mobile_app/core/models/models.dart';

void main() {
  group('Mobile Models & Unconfigured State Audit (Req #88 & #96)', () {
    test(
        'DailyWeightModel parses unlogged weight as null without inventing defaults',
        () {
      final unloggedJson = {
        'current': null,
        'logged': false,
        'goal': null,
      };

      final model = DailyWeightModel.fromJson(unloggedJson);
      expect(model.current, isNull);
      expect(model.logged, isFalse);
      expect(model.goal, isNull);
    });

    test('DailyWeightModel parses recorded weight accurately', () {
      final loggedJson = {
        'current': 83.4,
        'logged': true,
        'goal': {
          'startWeightKg': 90.0,
          'targetWeightKg': 80.0,
          'progressPct': 66,
        },
      };

      final model = DailyWeightModel.fromJson(loggedJson);
      expect(model.current, equals(83.4));
      expect(model.logged, isTrue);
      expect(model.goal?['targetWeightKg'], equals(80.0));
    });

    test('DailyPlanModel parses unassigned workout as null without crashing',
        () {
      final unassignedJson = {
        'date': '2026-08-30',
        'weekday': 7,
        'timezone': 'UTC',
        'weight': {'current': null, 'logged': false},
        'water': {
          'totalMl': 0,
          'targetMl': 3000,
          'remainingMl': 3000,
          'completionPercent': 0,
          'quickAdds': []
        },
        'diet': {'meals': []},
        'workout': null,
        'cardio': {},
        'tasks': [],
        'summary': {
          'completedTasks': 0,
          'totalTasks': 0,
          'overallAdherencePct': 100,
        },
      };

      final plan = DailyPlanModel.fromJson(unassignedJson);
      expect(plan.workout, isNull);
      expect(plan.tasks, isEmpty);
      expect(plan.completedTasks, equals(0));
      expect(plan.totalTasks, equals(0));
      expect(plan.overallAdherencePct, equals(100));
    });

    test('DailyPlanModel parses rest day workout properly', () {
      final restDayJson = {
        'date': '2026-08-30',
        'weekday': 7,
        'timezone': 'UTC',
        'weight': {'current': null, 'logged': false},
        'water': {
          'totalMl': 1500,
          'targetMl': 3000,
          'remainingMl': 1500,
          'completionPercent': 50,
          'quickAdds': []
        },
        'diet': {'meals': []},
        'workout': {
          'id': 4,
          'name': 'Rest Day',
          'is_rest_day': 1,
          'exercises': [],
        },
        'cardio': {},
        'tasks': [],
        'summary': {
          'completedTasks': 1,
          'totalTasks': 2,
          'overallAdherencePct': 50,
        },
      };

      final plan = DailyPlanModel.fromJson(restDayJson);
      expect(plan.workout, isNotNull);
      expect(plan.workout?['is_rest_day'], equals(1));
      expect(plan.overallAdherencePct, equals(50));
    });

    test('DailyPlanModel parses custom quickAdds and cardio targets', () {
      final json = {
        'date': '2026-08-30',
        'weekday': 7,
        'timezone': 'UTC',
        'weight': {'current': 75.0, 'logged': true},
        'water': {
          'totalMl': 1200,
          'targetMl': 3000,
          'remainingMl': 1800,
          'completionPercent': 40,
          'quickAdds': [350, 700, 1000]
        },
        'diet': {'meals': []},
        'workout': null,
        'cardio': {
          'targetMinutes': 45,
          'completedMinutes': 30,
          'activityName': 'Treadmill Incline Walk'
        },
        'tasks': [],
        'summary': {
          'completedTasks': 1,
          'totalTasks': 3,
          'overallAdherencePct': 33,
        },
      };

      final plan = DailyPlanModel.fromJson(json);
      expect(plan.water.quickAdds, equals([350, 700, 1000]));
      expect(plan.cardio['targetMinutes'], equals(45));
      expect(plan.cardio['completedMinutes'], equals(30));
      expect(plan.cardio['activityName'], equals('Treadmill Incline Walk'));
    });
  });
}
