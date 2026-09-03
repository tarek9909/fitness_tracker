import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_session.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/storage/local_cache.dart';
import '../../core/widgets/premium_widgets.dart';
import '../workout/workout_execution_screen.dart';
import '../diet/meal_logging_screen.dart';
import '../weight/weight_screen.dart';
import '../cardio/cardio_screen.dart';

class HomeScreen extends StatefulWidget {
  final ApiClient apiClient;
  final AuthSession authSession;
  final LocalCache? localCache;

  const HomeScreen({
    super.key,
    required this.apiClient,
    required this.authSession,
    this.localCache,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  DailyPlanModel? _plan;
  dynamic _activeSession;
  bool _isLoading = true;
  String? _error;
  String? _staleMessage;

  String? get _cacheKey {
    final userId = widget.authSession.currentUser?.id;
    return userId == null ? null : 'cache.today_plan.$userId';
  }

  Future<void> _fetchTodayPlan() async {
    setState(() {
      _isLoading = true;
      _error = null;
      _staleMessage = null;
    });

    try {
      final res = await widget.apiClient.get('/me/today');
      final cacheKey = _cacheKey;
      if (cacheKey != null && widget.localCache != null) {
        await widget.localCache!.writeJson(cacheKey, res);
      }
      dynamic activeRes;
      try {
        final rawActive = await widget.apiClient.get('/me/workouts/active');
        activeRes =
            rawActive is Map<String, dynamic> && rawActive['data'] != null
                ? rawActive['data']
                : rawActive;
      } catch (_) {}

      if (mounted) {
        setState(() {
          _plan = DailyPlanModel.fromJson(res);
          _activeSession = activeRes;
          _isLoading = false;
          _staleMessage = null;
        });
      }
    } catch (e) {
      final cacheKey = _cacheKey;
      final cached = cacheKey != null && widget.localCache != null
          ? await widget.localCache!.readJson(cacheKey)
          : null;
      if (cached is Map<String, dynamic> && mounted) {
        setState(() {
          _plan = DailyPlanModel.fromJson(cached);
          _error = null;
          _staleMessage = 'Offline mode: showing your last synchronized plan.';
          _isLoading = false;
        });
        return;
      }
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _discardActiveWorkout() async {
    if (_activeSession == null) return;
    final colors = AppThemeColors.of(context);
    final confirm = await showPremiumDialog<bool>(
      context: context,
      title: 'Discard Active Workout?',
      content: Text(
        'Are you sure you want to discard this in-progress workout? Logged sets in this session will not be saved.',
        style: TextStyle(
          fontSize: 14,
          color: colors.textSecondary,
          height: 1.4,
        ),
      ),
      actions: [
        PremiumButton(
          text: 'Keep Workout',
          isSecondary: true,
          onPressed: () => Navigator.pop(context, false),
        ),
        PremiumButton(
          text: 'Discard',
          isDanger: true,
          onPressed: () => Navigator.pop(context, true),
        ),
      ],
    );
    if (confirm != true) return;

    final sessionId = _activeSession['id'];
    try {
      await widget.apiClient.post('/me/workouts/$sessionId/discard');
      setState(() => _activeSession = null);
      if (mounted) {
        showPremiumSnackBar(
          context,
          'In-progress workout discarded',
          isSuccess: true,
        );
      }
    } catch (e) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Error: $e',
          isError: true,
        );
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _fetchTodayPlan();
  }

  Future<void> _quickAddWater(int amountMl) async {
    try {
      await widget.apiClient.post('/me/water', body: {
        'amountMl': amountMl,
      });
      if (mounted) _fetchTodayPlan();
    } on OfflineOperationQueued catch (_) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Water logged offline. Will sync when online.',
        );
      }
    } catch (e) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Failed to log water: $e',
          isError: true,
        );
      }
    }
  }

  void _showCustomWaterDialog() {
    final customMlController = TextEditingController();
    showPremiumDialog(
      context: context,
      title: 'Custom Water Intake',
      content: PremiumTextField(
        controller: customMlController,
        label: 'Amount in ml',
        hint: 'e.g. 350',
        keyboardType: TextInputType.number,
        textInputAction: TextInputAction.done,
        onSubmitted: (val) {
          final parsed = int.tryParse(val.trim());
          if (parsed != null && parsed > 0 && parsed <= 5000) {
            Navigator.pop(context);
            _quickAddWater(parsed);
          }
        },
      ),
      actions: [
        PremiumButton(
          text: 'Cancel',
          isSecondary: true,
          onPressed: () => Navigator.pop(context),
        ),
        PremiumButton(
          text: 'Add Water',
          onPressed: () {
            final parsed = int.tryParse(customMlController.text.trim());
            if (parsed == null || parsed <= 0 || parsed > 5000) {
              showPremiumSnackBar(
                context,
                'Please enter a valid amount (1–5000 ml)',
                isError: true,
              );
              return;
            }
            Navigator.pop(context);
            _quickAddWater(parsed);
          },
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final user = widget.authSession.currentUser;

    if (_isLoading) {
      return PremiumScaffold(
        body: Center(
          child: CircularProgressIndicator(color: colors.primary),
        ),
      );
    }

    if (_error != null || _plan == null) {
      return PremiumScaffold(
        body: ErrorStateWidget(
          message: _error ?? 'Could not load daily plan',
          onRetry: _fetchTodayPlan,
        ),
      );
    }

    return PremiumScaffold(
      appBar: PremiumAppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Hello, ${user?.firstName ?? "Athlete"} 👋',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: colors.textPrimary,
              ),
            ),
            Text(
              _plan!.date,
              style: TextStyle(fontSize: 12, color: colors.textMuted),
            ),
          ],
        ),
        actions: [
          PremiumIconButton(
            icon: Icons.refresh,
            onPressed: _fetchTodayPlan,
            tooltip: 'Refresh Agenda',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchTodayPlan,
        color: colors.primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_activeSession != null) ...[
                _buildResumeWorkoutBanner(colors),
                const SizedBox(height: 16),
              ],
              if (_staleMessage != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: colors.amberMuted,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    border: Border.all(
                      color: colors.amber.withValues(alpha: 0.35),
                    ),
                  ),
                  child: Text(
                    _staleMessage!,
                    style: TextStyle(
                      color: colors.amber,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Overall Daily Progress Card (Clean architectural surface, no radiant gradient)
              _buildAdherenceCard(colors),
              const SizedBox(height: 16),

              // Today's Workout Card
              _buildWorkoutCard(colors),
              const SizedBox(height: 16),

              // Cardio Conditioning Card
              _buildCardioCard(colors),
              const SizedBox(height: 16),

              // Meals & Nutrition Card
              _buildNutritionCard(colors),
              const SizedBox(height: 16),

              // Hydration Card
              _buildWaterCard(colors),
              const SizedBox(height: 16),

              // Morning Body Weight Card
              _buildWeightCard(colors),
              const SizedBox(height: 16),

              // Daily Tasks Checklist
              _buildTasksList(colors),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildResumeWorkoutBanner(AppThemeColors colors) {
    final sessionName =
        _activeSession['workout_name_snapshot'] as String? ?? 'Workout Session';
    final sessionId = _activeSession['id'] as int;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.primary.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: colors.primaryMuted,
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: Icon(Icons.play_circle_filled,
                color: colors.primary, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Workout In Progress',
                  style: TextStyle(
                    color: colors.primary,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  sessionName,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),
          PremiumButton(
            text: 'Discard',
            isSecondary: true,
            isDanger: true,
            onPressed: _discardActiveWorkout,
            height: 32,
          ),
          const SizedBox(width: 8),
          PremiumButton(
            text: 'Resume',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => WorkoutExecutionScreen(
                    apiClient: widget.apiClient,
                    existingSessionId: sessionId,
                  ),
                ),
              ).then((_) => _fetchTodayPlan());
            },
            height: 32,
          ),
        ],
      ),
    );
  }

  Widget _buildAdherenceCard(AppThemeColors colors) {
    final pct = _plan!.overallAdherencePct;
    return PremiumCard(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "TODAY'S ADHERENCE",
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '$pct%',
                  style: TextStyle(
                    fontSize: 34,
                    fontWeight: FontWeight.w900,
                    color: colors.textPrimary,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${_plan!.completedTasks} of ${_plan!.totalTasks} planned tasks completed',
                  style: TextStyle(
                    fontSize: 13,
                    color: colors.textMuted,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            width: 64,
            height: 64,
            child: Stack(
              fit: StackFit.expand,
              children: [
                CircularProgressIndicator(
                  value: (pct / 100.0).clamp(0.0, 1.0),
                  strokeWidth: 6,
                  backgroundColor: colors.surfaceElevated,
                  valueColor: AlwaysStoppedAnimation(colors.primary),
                ),
                Center(
                  child: Icon(
                    pct >= 100 ? Icons.check : Icons.bolt,
                    color: pct >= 100 ? colors.primary : colors.amber,
                    size: 24,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWorkoutCard(AppThemeColors colors) {
    final workout = _plan!.workout;
    final hasPlan = workout != null;
    final isRestDay = hasPlan &&
        (workout['is_rest_day'] == 1 || workout['is_rest_day'] == true);

    return PremiumCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.fitness_center, color: colors.cyan, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'TRAINING SESSION',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                      color: colors.cyan,
                    ),
                  ),
                ],
              ),
              if (hasPlan && !isRestDay)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: colors.cyanMuted,
                    borderRadius: BorderRadius.circular(AppRadii.sm),
                  ),
                  child: Text(
                    '${(workout['exercises'] as List?)?.length ?? 0} Exercises',
                    style: TextStyle(
                      color: colors.cyan,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            !hasPlan
                ? 'No Workout Assigned'
                : (isRestDay
                    ? 'Rest & Active Recovery'
                    : (workout['name'] ?? 'Assigned Workout')),
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            !hasPlan
                ? 'No workout protocol currently assigned to your profile.'
                : (isRestDay
                    ? 'No scheduled lifting today. Rest and recover your muscle tissues.'
                    : 'Execute today\'s working sets and log repetitions & load.'),
            style: TextStyle(fontSize: 13, color: colors.textSecondary),
          ),
          const SizedBox(height: 16),
          if (hasPlan && !isRestDay)
            PremiumButton(
              text: 'Start Workout Session',
              icon: const Icon(Icons.play_arrow, size: 18),
              onPressed: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (ctx) => WorkoutExecutionScreen(
                      apiClient: widget.apiClient,
                      workoutDayId: workout['id'],
                    ),
                  ),
                );
                _fetchTodayPlan();
              },
              width: double.infinity,
            ),
        ],
      ),
    );
  }

  Widget _buildNutritionCard(AppThemeColors colors) {
    final meals = (_plan!.diet['meals'] as List<dynamic>? ?? []);

    return PremiumCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.restaurant, color: colors.amber, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'NUTRITION & MEALS',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                      color: colors.amber,
                    ),
                  ),
                ],
              ),
              StatusBadge(
                label:
                    '${meals.where((m) => m['log'] != null && m['log']['status'] == 'completed').length}/${meals.length} Logged',
                color: colors.amber,
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...meals.map((meal) {
            final isLogged =
                meal['log'] != null && meal['log']['status'] == 'completed';
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: colors.surfaceElevated,
                borderRadius: BorderRadius.circular(AppRadii.md),
                border: Border.all(
                  color: isLogged
                      ? colors.primary.withValues(alpha: 0.3)
                      : colors.border,
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(
                        isLogged ? Icons.check_circle : Icons.circle_outlined,
                        size: 18,
                        color:
                            isLogged ? colors.primary : colors.textMuted,
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            meal['name'] ?? 'Meal',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                              decoration:
                                  isLogged ? TextDecoration.lineThrough : null,
                              color: isLogged
                                  ? colors.textMuted
                                  : colors.textPrimary,
                            ),
                          ),
                          if (meal['scheduled_time'] != null)
                            Text(
                              meal['scheduled_time'],
                              style: TextStyle(
                                  fontSize: 11, color: colors.textMuted),
                            ),
                        ],
                      ),
                    ],
                  ),
                  PremiumButton(
                    text: isLogged ? 'Edit' : 'Log Food',
                    isSecondary: true,
                    onPressed: () async {
                      await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (ctx) => MealLoggingScreen(
                            apiClient: widget.apiClient,
                            meal: meal,
                          ),
                        ),
                      );
                      _fetchTodayPlan();
                    },
                    height: 32,
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildCardioCard(AppThemeColors colors) {
    final cardio = _plan!.cardio;
    final targetMinutes = cardio['targetMinutes'] ?? cardio['target_minutes'];
    final completedMinutes = cardio['completedMinutes'] ??
        cardio['completed_minutes'] ??
        cardio['totalMinutes'] ??
        0;
    final activityName =
        cardio['activityName'] ?? cardio['activity_name'] ?? 'Cardio Session';
    final hasTarget = targetMinutes != null && targetMinutes > 0;
    final isDone = hasTarget && completedMinutes >= targetMinutes;

    return PremiumCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.directions_run, color: colors.rose, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'CARDIO TARGET',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
              if (hasTarget)
                StatusBadge(
                  label: isDone
                      ? 'Goal Met'
                      : '$completedMinutes / $targetMinutes min',
                  color: isDone ? colors.primary : colors.rose,
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            activityName,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: colors.textPrimary,
            ),
          ),
          if (hasTarget) ...[
            const SizedBox(height: 8),
            PremiumProgressBar(
              value: (completedMinutes / targetMinutes).clamp(0.0, 1.0),
              height: 6,
              color: colors.rose,
              backgroundColor: colors.surfaceElevated,
            ),
          ],
          const SizedBox(height: 12),
          PremiumButton(
            text: 'Log Cardio Session',
            icon: const Icon(Icons.add, size: 16, color: Colors.white),
            height: 38,
            onPressed: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (ctx) => CardioScreen(
                    apiClient: widget.apiClient,
                  ),
                ),
              );
              _fetchTodayPlan();
            },
            width: double.infinity,
          ),
        ],
      ),
    );
  }

  Widget _buildWaterCard(AppThemeColors colors) {
    final water = _plan!.water;
    final quickAdds = water.quickAdds;

    return PremiumCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.water_drop, color: colors.cyan, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'HYDRATION TRACKER',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
              StatusBadge(
                label: '${water.totalMl} / ${water.targetMl} ml',
                color: colors.cyan,
              ),
            ],
          ),
          const SizedBox(height: 12),
          PremiumProgressBar(
            value: water.targetMl > 0
                ? (water.totalMl / water.targetMl).clamp(0.0, 1.0)
                : 0.0,
            height: 8,
            color: colors.cyan,
            backgroundColor: colors.surfaceElevated,
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                ...quickAdds.map((ml) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: _buildWaterButton(ml, '+$ml ml', colors),
                    )),
                PremiumChoiceButton(
                  onPressed: _showCustomWaterDialog,
                  icon: Icons.add,
                  label: 'Custom',
                  accentColor: colors.cyan,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWaterButton(int ml, String label, AppThemeColors colors) {
    return PremiumChoiceButton(
      onPressed: () => _quickAddWater(ml),
      label: label,
      accentColor: colors.cyan,
    );
  }

  Widget _buildWeightCard(AppThemeColors colors) {
    final weight = _plan!.weight;
    return PremiumCard(
      padding: EdgeInsets.zero,
      child: PremiumListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: colors.violetMuted,
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          child: Icon(Icons.monitor_weight_outlined,
              color: colors.violet, size: 22),
        ),
        title: Text('Morning Body Weight',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 15,
              color: colors.textPrimary,
            )),
        subtitle: Text(
          weight.logged
              ? '${weight.current} kg logged today'
              : 'Not recorded yet today',
          style: TextStyle(
              color: weight.logged ? colors.primary : colors.textMuted,
              fontSize: 13),
        ),
        trailing: PremiumButton(
          text: weight.logged ? 'Update' : 'Log',
          onPressed: () async {
            await Navigator.push(
              context,
              MaterialPageRoute(
                builder: (ctx) => WeightScreen(apiClient: widget.apiClient),
              ),
            );
            _fetchTodayPlan();
          },
          height: 34,
        ),
      ),
    );
  }

  Widget _buildTasksList(AppThemeColors colors) {
    return PremiumCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'TODAY\'S AGENDA CHECKLIST',
            style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
                color: colors.textSecondary),
          ),
          const SizedBox(height: 12),
          ..._plan!.tasks.map((task) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Icon(
                    task.isCompleted
                        ? Icons.check_box
                        : Icons.check_box_outline_blank,
                    size: 20,
                    color: task.isCompleted
                        ? colors.primary
                        : colors.textMuted,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      task.title,
                      style: TextStyle(
                        fontSize: 14,
                        decoration: task.isCompleted
                            ? TextDecoration.lineThrough
                            : null,
                        color: task.isCompleted
                            ? colors.textMuted
                            : colors.textPrimary,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
