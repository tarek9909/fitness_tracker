import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Status of a meal logging attempt relative to its scheduled window
enum MealTimeStatus {
  onTime,
  beforeTime,
  afterTime,
}

/// Structured result of validating a meal's scheduled time against current clock
class MealTimeValidationResult {
  final MealTimeStatus status;
  final TimeOfDay scheduledTime;
  final TimeOfDay windowStart;
  final TimeOfDay windowEnd;
  final int differenceMinutes;
  final String mealName;
  final bool hasExplicitSchedule;

  const MealTimeValidationResult({
    required this.status,
    required this.scheduledTime,
    required this.windowStart,
    required this.windowEnd,
    required this.differenceMinutes,
    required this.mealName,
    required this.hasExplicitSchedule,
  });

  bool get isEarly => status == MealTimeStatus.beforeTime;
  bool get isLate => status == MealTimeStatus.afterTime;
  bool get isOutOfWindow => status != MealTimeStatus.onTime;
  bool get isOnTime => status == MealTimeStatus.onTime;

  String get formattedScheduledTime => formatTimeOfDay(scheduledTime);
  String get formattedWindowStart => formatTimeOfDay(windowStart);
  String get formattedWindowEnd => formatTimeOfDay(windowEnd);
  String get formattedWindow => '$formattedWindowStart – $formattedWindowEnd';

  String get formattedDifference {
    final abs = differenceMinutes.abs();
    final hrs = abs ~/ 60;
    final mins = abs % 60;
    final buffer = StringBuffer();
    if (hrs > 0) {
      buffer.write('$hrs hr${hrs == 1 ? "" : "s"} ');
    }
    if (mins > 0 || hrs == 0) {
      buffer.write('$mins min${mins == 1 ? "" : "s"}');
    }
    return '${buffer.toString().trim()} ${isEarly ? "early" : "late"}';
  }

  String get dialogTitle =>
      isEarly ? 'Early Nutrition Logging' : 'Delayed Nutrition Logging';

  static String formatTimeOfDay(TimeOfDay tod) {
    final hour = tod.hourOfPeriod == 0 ? 12 : tod.hourOfPeriod;
    final min = tod.minute.toString().padLeft(2, '0');
    final period = tod.period == DayPeriod.am ? 'AM' : 'PM';
    return '$hour:$min $period';
  }
}

/// Evaluates whether a nutrition meal is being logged within its recommended window
class MealTimeValidator {
  /// Validates a meal map against a target or current time of day
  static MealTimeValidationResult validate(
    Map<String, dynamic> meal, {
    TimeOfDay? currentTime,
  }) {
    final now = currentTime ?? TimeOfDay.now();
    final mealName = (meal['name'] ?? meal['meal_name'] ?? 'Meal').toString();
    final rawTime = meal['scheduled_time'] ??
        meal['scheduledTime'] ??
        meal['meal_time'] ??
        meal['mealTime'] ??
        meal['time'];

    int graceMinutes = 60;
    final rawGrace = meal['default_grace_minutes'] ??
        meal['defaultGraceMinutes'] ??
        meal['grace_minutes'] ??
        meal['graceMinutes'];
    if (rawGrace is num) {
      graceMinutes = rawGrace.toInt();
    }

    TimeOfDay targetTime;
    bool hasExplicit = false;

    if (rawTime != null && rawTime.toString().trim().isNotEmpty) {
      final parsed = _parseTimeOfDay(rawTime.toString().trim());
      if (parsed != null) {
        targetTime = parsed;
        hasExplicit = true;
      } else {
        targetTime = _inferTargetTime(mealName, meal['meal_order'] ?? meal['order_index']);
      }
    } else {
      targetTime = _inferTargetTime(mealName, meal['meal_order'] ?? meal['order_index']);
    }

    final targetMinutes = targetTime.hour * 60 + targetTime.minute;
    final currentMinutes = now.hour * 60 + now.minute;

    final startMinutes = (targetMinutes - graceMinutes).clamp(0, 1439);
    final endMinutes = (targetMinutes + graceMinutes).clamp(0, 1439);

    final windowStart = TimeOfDay(hour: startMinutes ~/ 60, minute: startMinutes % 60);
    final windowEnd = TimeOfDay(hour: endMinutes ~/ 60, minute: endMinutes % 60);

    MealTimeStatus status;
    int differenceMinutes = 0;

    if (currentMinutes < startMinutes) {
      status = MealTimeStatus.beforeTime;
      differenceMinutes = startMinutes - currentMinutes;
    } else if (currentMinutes > endMinutes) {
      status = MealTimeStatus.afterTime;
      differenceMinutes = currentMinutes - endMinutes;
    } else {
      status = MealTimeStatus.onTime;
    }

    return MealTimeValidationResult(
      status: status,
      scheduledTime: targetTime,
      windowStart: windowStart,
      windowEnd: windowEnd,
      differenceMinutes: differenceMinutes,
      mealName: mealName,
      hasExplicitSchedule: hasExplicit,
    );
  }

  /// Parses common time string formats like "08:30:00", "08:30", "8:30 AM", "14:00"
  static TimeOfDay? _parseTimeOfDay(String timeStr) {
    try {
      final lower = timeStr.toLowerCase().trim();
      final isPm = lower.contains('pm');
      final isAm = lower.contains('am');
      final cleaned = lower.replaceAll('am', '').replaceAll('pm', '').trim();
      final parts = cleaned.split(':');

      if (parts.isNotEmpty) {
        int hour = int.parse(parts[0]);
        int minute = parts.length > 1 ? int.parse(parts[1]) : 0;

        if (isPm && hour < 12) hour += 12;
        if (isAm && hour == 12) hour = 0;

        return TimeOfDay(hour: hour.clamp(0, 23), minute: minute.clamp(0, 59));
      }
    } catch (_) {}
    return null;
  }

  /// Infers standard meal time based on conventional nutrition timing or sequence
  static TimeOfDay _inferTargetTime(String name, dynamic orderIndex) {
    final lower = name.toLowerCase();

    if (lower.contains('breakfast')) {
      return const TimeOfDay(hour: 8, minute: 0);
    } else if (lower.contains('morning snack') || lower.contains('mid-morning')) {
      return const TimeOfDay(hour: 10, minute: 30);
    } else if (lower.contains('lunch') || lower.contains('midday')) {
      return const TimeOfDay(hour: 13, minute: 0);
    } else if (lower.contains('afternoon') || lower.contains('snack')) {
      return const TimeOfDay(hour: 16, minute: 30);
    } else if (lower.contains('dinner') || lower.contains('supper')) {
      return const TimeOfDay(hour: 19, minute: 30);
    } else if (lower.contains('post-workout')) {
      return const TimeOfDay(hour: 18, minute: 0);
    } else if (lower.contains('pre-workout')) {
      return const TimeOfDay(hour: 15, minute: 0);
    }

    final order = (orderIndex is num) ? orderIndex.toInt() : null;
    if (order != null) {
      switch (order) {
        case 1:
          return const TimeOfDay(hour: 8, minute: 0);
        case 2:
          return const TimeOfDay(hour: 13, minute: 0);
        case 3:
          return const TimeOfDay(hour: 19, minute: 30);
        case 4:
          return const TimeOfDay(hour: 16, minute: 30);
        default:
          return const TimeOfDay(hour: 12, minute: 0);
      }
    }

    return const TimeOfDay(hour: 12, minute: 0);
  }
}

/// Presents a high-priority dialog asking the user to confirm an out-of-schedule meal log
Future<bool?> showMealTimeOverrideDialog({
  required BuildContext context,
  required Map<String, dynamic> meal,
  required MealTimeValidationResult validation,
}) {
  final colors = AppThemeColors.of(context);
  final isEarly = validation.isEarly;
  final accentColor = isEarly ? colors.amber : colors.rose;

  return showDialog<bool>(
    context: context,
    builder: (ctx) {
      return Dialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.xl),
          side: BorderSide(color: accentColor.withValues(alpha: 0.3)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Warning Icon & Status Pill
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: accentColor.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.schedule_outlined,
                      color: accentColor,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: accentColor.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            isEarly ? 'EARLY NUTRITION' : 'DELAYED NUTRITION',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                              color: accentColor,
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          validation.dialogTitle,
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: colors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Timing comparison Card
              Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: colors.surfaceElevated,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  border: Border.all(color: colors.border),
                ),
                child: Column(
                  children: [
                    _buildTimingRow(
                      context: ctx,
                      label: 'Prescribed Meal',
                      value: validation.mealName,
                      icon: Icons.restaurant,
                      valueColor: colors.textPrimary,
                    ),
                    const Divider(height: 16),
                    _buildTimingRow(
                      context: ctx,
                      label: 'Scheduled Window',
                      value: validation.formattedWindow,
                      icon: Icons.access_time,
                      valueColor: colors.primary,
                    ),
                    const Divider(height: 16),
                    _buildTimingRow(
                      context: ctx,
                      label: 'Current Time',
                      value: '${MealTimeValidationResult.formatTimeOfDay(TimeOfDay.now())} (${validation.formattedDifference})',
                      icon: Icons.timelapse,
                      valueColor: accentColor,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // Advisory note
              Text(
                isEarly
                    ? 'You are logging this meal earlier than planned. Logging before your scheduled window may alter metabolic pacing and energy distribution.'
                    : 'You are logging this meal later than prescribed. Delayed intake can shift digestion and recovery nutrient timing.',
                style: TextStyle(
                  fontSize: 12,
                  color: colors.textSecondary,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Would you like to confirm and override the scheduled time for this meal?',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: colors.textPrimary,
                ),
              ),
              const SizedBox(height: 20),

              // Action buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: BorderSide(color: colors.border),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadii.md),
                        ),
                      ),
                      onPressed: () => Navigator.pop(ctx, false),
                      child: Text(
                        'Cancel',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: colors.textSecondary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accentColor,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadii.md),
                        ),
                      ),
                      icon: const Icon(Icons.check, size: 16),
                      label: const Text(
                        'Override & Log',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      onPressed: () => Navigator.pop(ctx, true),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    },
  );
}

Widget _buildTimingRow({
  required BuildContext context,
  required String label,
  required String value,
  required IconData icon,
  required Color valueColor,
}) {
  final colors = AppThemeColors.of(context);
  return Row(
    children: [
      Icon(icon, size: 16, color: colors.textMuted),
      const SizedBox(width: 8),
      Text(
        label,
        style: TextStyle(fontSize: 12, color: colors.textSecondary),
      ),
      const Spacer(),
      Flexible(
        child: Text(
          value,
          textAlign: TextAlign.end,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: valueColor,
          ),
        ),
      ),
    ],
  );
}
