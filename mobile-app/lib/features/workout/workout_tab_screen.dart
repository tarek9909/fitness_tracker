import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';
import 'workout_execution_screen.dart';
import 'workout_plans_screen.dart';

import '../../core/storage/local_cache.dart';

class WorkoutTabScreen extends StatefulWidget {
  final ApiClient apiClient;
  final LocalCache? localCache;

  const WorkoutTabScreen({
    super.key,
    required this.apiClient,
    this.localCache,
  });

  @override
  State<WorkoutTabScreen> createState() => _WorkoutTabScreenState();
}

class _WorkoutTabScreenState extends State<WorkoutTabScreen> {
  bool _isLoading = true;
  String? _errorMessage;
  Map<String, dynamic>? _todayPlan;
  Map<String, dynamic>? _activeSession;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final planRes = await widget.apiClient.get('/me/today');
      if (widget.localCache != null && planRes != null) {
        await widget.localCache!.writeJson('workout_tab_today_plan', planRes);
      }

      Map<String, dynamic>? sessionRes;
      try {
        final rawSession = await widget.apiClient.get('/me/workouts/active');
        if (rawSession is Map<String, dynamic>) {
          sessionRes = rawSession['data'] is Map<String, dynamic>
              ? rawSession['data'] as Map<String, dynamic>
              : rawSession;
        }
      } catch (_) {}

      if (mounted) {
        setState(() {
          _todayPlan = planRes is Map<String, dynamic>
              ? (planRes['data'] is Map<String, dynamic>
                  ? planRes['data'] as Map<String, dynamic>
                  : planRes)
              : null;
          _activeSession = sessionRes;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (widget.localCache != null) {
        final cached = await widget.localCache!.readJson('workout_tab_today_plan');
        if (cached is Map<String, dynamic> && mounted) {
          setState(() {
            _todayPlan = cached['data'] is Map<String, dynamic>
                ? cached['data'] as Map<String, dynamic>
                : cached;
            _isLoading = false;
          });
          return;
        }
      }
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return PremiumScaffold(
      appBar: PremiumAppBar(
        titleText: 'Workout & Training',
        actions: [
          PremiumIconButton(
            icon: Icons.calendar_view_week_outlined,
            color: colors.primary,
            tooltip: 'Workout Plans',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => WorkoutPlansScreen(apiClient: widget.apiClient),
                ),
              ).then((_) => _loadData());
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator(color: colors.primary))
          : RefreshIndicator(
              onRefresh: _loadData,
              color: colors.primary,
              child: _errorMessage != null
                  ? ListView(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      children: [
                        EmptyStateWidget(
                          icon: Icons.error_outline,
                          title: 'Unable to load workout',
                          description: _errorMessage!,
                        ),
                        const SizedBox(height: 16),
                        PremiumButton(
                          text: 'Retry',
                          onPressed: _loadData,
                        ),
                      ],
                    )
                  : ListView(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      children: [
                        if (_activeSession != null) ...[
                          _buildActiveSessionCard(colors),
                          const SizedBox(height: 16),
                        ],
                        _buildTodayWorkoutSection(colors),
                        const SizedBox(height: 20),
                        _buildQuickActions(colors),
                      ],
                    ),
            ),
    );
  }

  Widget _buildActiveSessionCard(AppThemeColors colors) {
    final session = _activeSession!;
    final name = session['workout_name'] ?? session['name'] ?? 'Workout Session';

    return PremiumCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: colors.primary,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'IN PROGRESS',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                  color: colors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            name,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'You have an active workout session in progress.',
            style: TextStyle(fontSize: 12, color: colors.textSecondary),
          ),
          const SizedBox(height: 14),
          PremiumButton(
            text: 'Resume Workout Session',
            icon: const Icon(Icons.play_arrow, size: 18),
            onPressed: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => WorkoutExecutionScreen(
                    apiClient: widget.apiClient,
                    existingSessionId: session['id'],
                  ),
                ),
              );
              _loadData();
            },
            width: double.infinity,
          ),
        ],
      ),
    );
  }

  Widget _buildTodayWorkoutSection(AppThemeColors colors) {
    final workout = _todayPlan?['workout'] is Map<String, dynamic>
        ? _todayPlan!['workout'] as Map<String, dynamic>
        : null;
    final hasPlan = workout != null && workout.isNotEmpty;
    final isRestDay = hasPlan &&
        (workout['isRestDay'] == true ||
            workout['is_rest_day'] == true ||
            workout['is_rest_day'] == 1);
    final workoutName = workout?['name'] as String? ?? 'Scheduled Workout';
    final exercises = (workout?['exercises'] as List<dynamic>? ?? []);

    if (isRestDay) {
      return PremiumCard(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: colors.primaryMuted,
              ),
              child: Icon(Icons.nightlight_round, size: 28, color: colors.primary),
            ),
            const SizedBox(height: 12),
            Text(
              'Rest & Recovery Day',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: colors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'No training prescribed for today. Focus on mobility, hydration, and restful recovery.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: colors.textSecondary),
            ),
            const SizedBox(height: 16),
            PremiumButton(
              text: 'Start Free Workout',
              isSecondary: true,
              icon: const Icon(Icons.add, size: 16),
              onPressed: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => WorkoutExecutionScreen(apiClient: widget.apiClient),
                  ),
                );
                _loadData();
              },
            ),
          ],
        ),
      );
    }

    if (!hasPlan) {
      return PremiumCard(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            Icon(Icons.fitness_center, size: 40, color: colors.textMuted),
            const SizedBox(height: 12),
            Text(
              'No Workout Plan Assigned',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: colors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Choose or configure a training routine from your workout plans library.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: colors.textSecondary),
            ),
            const SizedBox(height: 16),
            PremiumButton(
              text: 'Explore Workout Plans',
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => WorkoutPlansScreen(apiClient: widget.apiClient),
                  ),
                ).then((_) => _loadData());
              },
            ),
          ],
        ),
      );
    }

    final activeSession = workout['activeSession'] is Map
        ? workout['activeSession'] as Map<String, dynamic>
        : null;
    final isCompleted = activeSession != null &&
        (activeSession['status'] == 'completed' ||
            activeSession['status'] == 'finished');
    final completedSessionId = isCompleted
        ? (activeSession['id'] is num
            ? (activeSession['id'] as num).toInt()
            : int.tryParse(activeSession['id']?.toString() ?? ''))
        : null;

    return PremiumCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  workoutName,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: colors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              if (isCompleted)
                StatusBadge(
                  label: 'Completed',
                  color: colors.emerald,
                )
              else
                StatusBadge(
                  label: '${exercises.length} Exercises',
                  color: colors.primary,
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            isCompleted
                ? 'Regimen completed and locked for today'
                : 'Target sets and movements for today\'s regimen',
            style: TextStyle(
              fontSize: 12,
              color: isCompleted ? colors.emerald : colors.textSecondary,
              fontWeight: isCompleted ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
          const SizedBox(height: 16),
          ...exercises.asMap().entries.map((entry) {
            final idx = entry.key + 1;
            final ex = entry.value as Map<String, dynamic>;
            final exName = ex['name'] ?? ex['exercise_name'] ?? 'Exercise $idx';
            final sets = ex['targetSets'] ?? ex['target_sets'] ?? ex['sets'] ?? 3;
            final reps = ex['targetReps'] ?? ex['target_reps'] ?? '8-12';

            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: isCompleted
                      ? colors.emeraldMuted.withValues(alpha: colors.isDark ? 0.15 : 0.45)
                      : colors.surfaceElevated,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                  border: isCompleted
                      ? Border.all(color: colors.emerald.withValues(alpha: 0.35))
                      : null,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 26,
                      height: 26,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: isCompleted ? colors.emeraldMuted : colors.primaryMuted,
                        borderRadius: BorderRadius.circular(AppRadii.xs),
                      ),
                      child: isCompleted
                          ? Icon(Icons.check, size: 14, color: colors.emerald)
                          : Text(
                              '$idx',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: colors.primary,
                              ),
                            ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        exName,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: colors.textPrimary,
                        ),
                      ),
                    ),
                    Text(
                      '$sets sets × $reps',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isCompleted ? colors.emerald : colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
          const SizedBox(height: 12),
          if (isCompleted)
            PremiumButton(
              text: 'View Completed Workout',
              icon: const Icon(Icons.visibility_rounded, size: 18),
              isSecondary: true,
              onPressed: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => WorkoutExecutionScreen(
                      apiClient: widget.apiClient,
                      workoutDayId: workout['id'],
                      existingSessionId: completedSessionId,
                      isReadOnly: true,
                    ),
                  ),
                );
                _loadData();
              },
              width: double.infinity,
              height: 48,
            )
          else
            PremiumButton(
              text: 'Start Workout Session',
              icon: const Icon(Icons.play_arrow, size: 18),
              onPressed: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => WorkoutExecutionScreen(
                      apiClient: widget.apiClient,
                      workoutDayId: workout['id'],
                    ),
                  ),
                );
                _loadData();
              },
              width: double.infinity,
              height: 48,
            ),
        ],
      ),
    );
  }

  Widget _buildQuickActions(AppThemeColors colors) {
    return Row(
      children: [
        Expanded(
          child: PremiumCard(
            padding: const EdgeInsets.all(12),
            child: InkWell(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => WorkoutPlansScreen(apiClient: widget.apiClient),
                  ),
                ).then((_) => _loadData());
              },
              child: Row(
                children: [
                  Icon(Icons.list_alt, color: colors.primary, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Workout Plans',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: colors.textPrimary,
                          ),
                        ),
                        Text(
                          'View & edit routines',
                          style: TextStyle(fontSize: 10, color: colors.textMuted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
