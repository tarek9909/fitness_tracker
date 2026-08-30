import 'package:flutter_test/flutter_test.dart';
import 'package:fitness_mobile_app/core/models/models.dart';

void main() {
  group('Flutter Mobile App Models Suite', () {
    test('DailyPlanModel parsing correctly extracts agenda and adherence', () {
      final json = {
        'date': '2026-08-30',
        'weekday': 7,
        'timezone': 'UTC',
        'weight': {
          'current': 91.2,
          'logged': true,
          'goal': {
            'targetWeightKg': 82.0,
            'startWeightKg': 95.0,
            'progressPct': 29,
          },
        },
        'water': {
          'totalMl': 2500,
          'targetMl': 3500,
          'remainingMl': 1000,
          'completionPercent': 71,
          'quickAdds': [250, 500, 750],
        },
        'diet': {
          'meals': [
            {
              'id': 1,
              'name': 'Breakfast',
              'scheduled_time': '08:00:00',
              'log': {'status': 'completed'},
            }
          ]
        },
        'workout': {
          'id': 1,
          'name': 'Upper Body Hypertrophy',
          'is_rest_day': 0,
        },
        'cardio': {
          'targetMinutes': 30,
          'completedMinutes': 30,
        },
        'tasks': [
          {
            'id': 1,
            'task_key': 'weight_morning',
            'task_type': 'weight',
            'title': 'Log Morning Weight',
            'status': 'completed',
          },
          {
            'id': 2,
            'task_key': 'workout_session',
            'task_type': 'workout',
            'title': 'Complete Workout Session',
            'status': 'completed',
          },
        ],
        'summary': {
          'completedTasks': 2,
          'totalTasks': 2,
          'overallAdherencePct': 100,
        },
      };

      final plan = DailyPlanModel.fromJson(json);

      expect(plan.date, '2026-08-30');
      expect(plan.weekday, 7);
      expect(plan.weight.current, 91.2);
      expect(plan.water.totalMl, 2500);
      expect(plan.tasks.length, 2);
      expect(plan.completedTasks, 2);
      expect(plan.overallAdherencePct, 100);
    });
  });
}
