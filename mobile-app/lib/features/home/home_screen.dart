import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_session.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/storage/local_cache.dart';
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
    final sessionId = _activeSession['id'];
    try {
      await widget.apiClient.post('/me/workouts/$sessionId/discard');
      setState(() => _activeSession = null);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('In-progress workout discarded')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Water logged offline. Will sync when online.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to log water: $e')),
        );
      }
    }
  }

  void _showCustomWaterDialog() {
    final customMlController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Custom Water Intake'),
          content: TextField(
            controller: customMlController,
            keyboardType: TextInputType.number,
            autofocus: true,
            textInputAction: TextInputAction.done,
            decoration: const InputDecoration(
              labelText: 'Amount in ml',
              hintText: 'e.g. 350',
              suffixText: 'ml',
            ),
            onSubmitted: (val) {
              final parsed = int.tryParse(val.trim());
              if (parsed != null && parsed > 0 && parsed <= 5000) {
                Navigator.pop(ctx);
                _quickAddWater(parsed);
              }
            },
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                final parsed = int.tryParse(customMlController.text.trim());
                if (parsed == null || parsed <= 0 || parsed > 5000) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content:
                            Text('Please enter a valid amount (1–5000 ml)')),
                  );
                  return;
                }
                Navigator.pop(ctx);
                _quickAddWater(parsed);
              },
              child: const Text('Add Water'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.authSession.currentUser;

    if (_isLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    if (_error != null || _plan == null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.cloud_off, size: 48, color: AppColors.rose),
              const SizedBox(height: 16),
              Text(_error ?? 'Could not load daily plan',
                  style: const TextStyle(color: AppColors.textSecondary)),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _fetchTodayPlan,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Hello, ${user?.firstName ?? "Athlete"} 👋',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            Text(
              _plan!.date,
              style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchTodayPlan,
            tooltip: 'Refresh Agenda',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchTodayPlan,
        color: AppColors.primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_activeSession != null) ...[
                _buildResumeWorkoutBanner(),
                const SizedBox(height: 16),
              ],
              if (_staleMessage != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.amber.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                        color: AppColors.amber.withValues(alpha: 0.45)),
                  ),
                  child: Text(_staleMessage!,
                      style: const TextStyle(
                          color: AppColors.amber, fontSize: 12)),
                ),
                const SizedBox(height: 16),
              ],

              // Overall Daily Progress Card
              _buildAdherenceCard(),
              const SizedBox(height: 16),

              // Today's Workout Card
              _buildWorkoutCard(),
              const SizedBox(height: 16),

              // Cardio Conditioning Card
              _buildCardioCard(),
              const SizedBox(height: 16),

              // Meals & Nutrition Card
              _buildNutritionCard(),
              const SizedBox(height: 16),

              // Hydration Card
              _buildWaterCard(),
              const SizedBox(height: 16),

              // Morning Body Weight Card
              _buildWeightCard(),
              const SizedBox(height: 16),

              // Daily Tasks Checklist
              _buildTasksList(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildResumeWorkoutBanner() {
    final sessionName =
        _activeSession['workout_name_snapshot'] as String? ?? 'Workout Session';
    final sessionId = _activeSession['id'] as int;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.play_circle_filled,
                color: AppColors.primary, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Workout In Progress',
                    style: TextStyle(
                        color: AppColors.primary,
                        fontSize: 12,
                        fontWeight: FontWeight.bold)),
                const SizedBox(height: 2),
                Text(sessionName,
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 15)),
              ],
            ),
          ),
          TextButton(
            onPressed: _discardActiveWorkout,
            child: const Text('Discard',
                style: TextStyle(color: AppColors.rose, fontSize: 12)),
          ),
          const SizedBox(width: 4),
          ElevatedButton(
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
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text('Resume',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          ),
        ],
      ),
    );
  }

  Widget _buildAdherenceCard() {
    final pct = _plan!.overallAdherencePct;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary.withValues(alpha: 0.15),
            AppColors.cyan.withValues(alpha: 0.08),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "TODAY'S ADHERENCE",
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '$pct%',
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${_plan!.completedTasks} of ${_plan!.totalTasks} planned tasks completed',
                  style: const TextStyle(
                      fontSize: 13, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          SizedBox(
            width: 60,
            height: 60,
            child: Stack(
              fit: StackFit.expand,
              children: [
                CircularProgressIndicator(
                  value: pct / 100.0,
                  strokeWidth: 6,
                  backgroundColor: AppColors.surface,
                  valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                ),
                Center(
                  child: Icon(
                    pct >= 100 ? Icons.check : Icons.local_fire_department,
                    color: pct >= 100 ? AppColors.primary : AppColors.amber,
                    size: 26,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWorkoutCard() {
    final workout = _plan!.workout;
    final hasPlan = workout != null;
    final isRestDay = hasPlan &&
        (workout['is_rest_day'] == 1 || workout['is_rest_day'] == true);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.fitness_center, color: AppColors.cyan, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'TRAINING SESSION',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                          color: AppColors.cyan),
                    ),
                  ],
                ),
                if (hasPlan && !isRestDay)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.cyan.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${(workout['exercises'] as List?)?.length ?? 0} Exercises',
                      style: const TextStyle(
                          color: AppColors.cyan,
                          fontSize: 11,
                          fontWeight: FontWeight.bold),
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
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              !hasPlan
                  ? 'No workout protocol currently assigned to your profile.'
                  : (isRestDay
                      ? 'No scheduled lifting today. Rest and recover your muscle tissues.'
                      : 'Execute today\'s working sets and log repetitions & load.'),
              style:
                  const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            if (hasPlan && !isRestDay)
              ElevatedButton.icon(
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
                icon: const Icon(Icons.play_arrow),
                label: const Text('Start Workout Session'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.cyan,
                  minimumSize: const Size.fromHeight(44),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildNutritionCard() {
    final meals = (_plan!.diet['meals'] as List<dynamic>? ?? []);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.restaurant, color: AppColors.amber, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'NUTRITION & MEALS',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                          color: AppColors.amber),
                    ),
                  ],
                ),
                Text(
                  '${meals.where((m) => m['log'] != null && m['log']['status'] == 'completed').length}/${meals.length} Logged',
                  style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ...meals.map((meal) {
              final isLogged =
                  meal['log'] != null && meal['log']['status'] == 'completed';
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                      color: isLogged
                          ? AppColors.primary.withValues(alpha: 0.3)
                          : AppColors.border),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(
                          isLogged ? Icons.check_circle : Icons.circle_outlined,
                          size: 18,
                          color: isLogged
                              ? AppColors.primary
                              : AppColors.textMuted,
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
                                decoration: isLogged
                                    ? TextDecoration.lineThrough
                                    : null,
                                color: isLogged
                                    ? AppColors.textMuted
                                    : AppColors.textPrimary,
                              ),
                            ),
                            if (meal['scheduled_time'] != null)
                              Text(
                                meal['scheduled_time'],
                                style: const TextStyle(
                                    fontSize: 11, color: AppColors.textMuted),
                              ),
                          ],
                        ),
                      ],
                    ),
                    TextButton(
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
                      child: Text(isLogged ? 'Edit' : 'Log Food'),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildCardioCard() {
    final cardio = _plan!.cardio;
    final targetMinutes = cardio['targetMinutes'] ??
        cardio['target_minutes'] ??
        cardio['min_duration_minutes'] ??
        cardio['durationMinutes'];
    final completedMinutes = cardio['completedMinutes'] ??
        cardio['completed_minutes'] ??
        cardio['totalMinutes'] ??
        0;
    final activityName =
        cardio['activityName'] ?? cardio['activity_name'] ?? 'Cardio Session';
    final hasTarget = targetMinutes != null && targetMinutes > 0;
    final isDone = hasTarget && completedMinutes >= targetMinutes;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.directions_run, color: AppColors.rose, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'CARDIO CONDITIONING',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                          color: AppColors.rose),
                    ),
                  ],
                ),
                if (hasTarget)
                  Text(
                    '$completedMinutes / $targetMinutes mins',
                    style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.bold),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              activityName,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              hasTarget
                  ? (isDone
                      ? 'Target achieved! $completedMinutes min completed today.'
                      : 'Prescribed: $targetMinutes min. $completedMinutes min logged so far.')
                  : (completedMinutes > 0
                      ? '$completedMinutes min logged today.'
                      : 'No specific cardio prescribed for today. Log extra conditioning if completed.'),
              style:
                  const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (ctx) => CardioScreen(apiClient: widget.apiClient),
                  ),
                );
                _fetchTodayPlan();
              },
              icon: const Icon(Icons.directions_run, size: 18),
              label: Text(isDone ? 'Log More Cardio' : 'Log Cardio Session'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.rose,
                minimumSize: const Size.fromHeight(40),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWaterCard() {
    final water = _plan!.water;
    final quickAdds = water.quickAdds;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.water_drop, color: Color(0xFF38BDF8), size: 20),
                    SizedBox(width: 8),
                    Text(
                      'HYDRATION',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                          color: Color(0xFF38BDF8)),
                    ),
                  ],
                ),
                Text(
                  water.targetMl > 0
                      ? '${water.totalMl} / ${water.targetMl} ml'
                      : '${water.totalMl} ml logged',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: water.targetMl > 0
                    ? (water.totalMl / water.targetMl).clamp(0.0, 1.0)
                    : null,
                minHeight: 8,
                backgroundColor: AppColors.surface,
                valueColor: const AlwaysStoppedAnimation(Color(0xFF38BDF8)),
              ),
            ),
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  ...quickAdds.map((ml) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: _buildWaterButton(ml, '+$ml ml'),
                      )),
                  OutlinedButton.icon(
                    onPressed: _showCustomWaterDialog,
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Custom',
                        style: TextStyle(
                            fontSize: 12, fontWeight: FontWeight.bold)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF38BDF8),
                      side: const BorderSide(color: Color(0x4038BDF8)),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWaterButton(int ml, String label) {
    return OutlinedButton(
      onPressed: () => _quickAddWater(ml),
      style: OutlinedButton.styleFrom(
        foregroundColor: const Color(0xFF38BDF8),
        side: const BorderSide(color: Color(0x4038BDF8)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      ),
      child: Text(label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildWeightCard() {
    final weight = _plan!.weight;
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.violet.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.monitor_weight_outlined,
              color: AppColors.violet, size: 22),
        ),
        title: const Text('Morning Body Weight',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        subtitle: Text(
          weight.logged
              ? '${weight.current} kg logged today'
              : 'Not recorded yet today',
          style: TextStyle(
              color: weight.logged ? AppColors.primary : AppColors.textMuted,
              fontSize: 13),
        ),
        trailing: ElevatedButton(
          onPressed: () async {
            await Navigator.push(
              context,
              MaterialPageRoute(
                builder: (ctx) => WeightScreen(apiClient: widget.apiClient),
              ),
            );
            _fetchTodayPlan();
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.violet,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          ),
          child: Text(weight.logged ? 'Update' : 'Log'),
        ),
      ),
    );
  }

  Widget _buildTasksList() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'TODAY\'S AGENDA CHECKLIST',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                  color: AppColors.textSecondary),
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
                          ? AppColors.primary
                          : AppColors.textMuted,
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
                              ? AppColors.textMuted
                              : AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
