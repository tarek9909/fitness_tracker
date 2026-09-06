import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_session.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/storage/local_cache.dart';
import '../../core/widgets/premium_widgets.dart';
import '../workout/workout_execution_screen.dart';
import '../weight/weight_screen.dart';
import '../cardio/cardio_screen.dart';
import '../cardio/cardio_quick_log_sheet.dart';
import '../diet/meal_quick_log_sheet.dart';
import '../weight/weight_quick_log_sheet.dart';
import '../workout/workout_plans_screen.dart';
import '../diet/diet_plans_screen.dart';
import '../history/history_screen.dart';

class _QuickActionData {
  final String id;
  final IconData icon;
  final String label;
  final String badge;
  final Color color;
  final VoidCallback onTap;

  const _QuickActionData({
    required this.id,
    required this.icon,
    required this.label,
    required this.badge,
    required this.color,
    required this.onTap,
  });
}

class HomeScreen extends StatefulWidget {
  final ApiClient apiClient;
  final AuthSession authSession;
  final LocalCache? localCache;
  final bool showAppBar;
  final VoidCallback? onOpenProfile;
  final VoidCallback? onOpenWorkout;
  final VoidCallback? onOpenMeals;
  final VoidCallback? onOpenCardio;

  const HomeScreen({
    super.key,
    required this.apiClient,
    required this.authSession,
    this.localCache,
    this.showAppBar = true,
    this.onOpenProfile,
    this.onOpenWorkout,
    this.onOpenMeals,
    this.onOpenCardio,
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
  bool _tasksCollapsed = false;
  bool _mealsCollapsed = false;

  List<String> _quickActionOrder = [
    'workout',
    'meals',
    'water',
    'cardio',
    'weight',
    'history',
  ];

  String get _quickActionsCacheKey {
    final userId = widget.authSession.currentUser?.id;
    return 'cache.quick_actions_order.${userId ?? "default"}';
  }

  Future<void> _loadQuickActionsOrder() async {
    if (widget.localCache == null) return;
    try {
      final cached = await widget.localCache!.readJson(_quickActionsCacheKey);
      if (cached is Map<String, dynamic> && cached['order'] is List) {
        final loaded = (cached['order'] as List).map((e) => e.toString()).toList();
        const validItems = ['workout', 'meals', 'water', 'cardio', 'weight', 'history'];
        final merged = loaded.where((id) => validItems.contains(id)).toList();
        for (final item in validItems) {
          if (!merged.contains(item)) {
            merged.add(item);
          }
        }
        if (mounted && merged.isNotEmpty) {
          setState(() {
            _quickActionOrder = merged;
          });
        }
      }
    } catch (_) {}
  }

  Future<void> _saveQuickActionsOrder() async {
    if (widget.localCache == null) return;
    try {
      await widget.localCache!.writeJson(_quickActionsCacheKey, {
        'order': _quickActionOrder,
      });
    } catch (_) {}
  }

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
    _loadQuickActionsOrder();
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
      final loadingWidget = Center(
        child: CircularProgressIndicator(color: colors.primary),
      );
      return widget.showAppBar
          ? PremiumScaffold(body: loadingWidget)
          : loadingWidget;
    }

    if (_error != null || _plan == null) {
      final errorWidget = ErrorStateWidget(
        message: _error ?? 'Could not load daily plan',
        onRetry: _fetchTodayPlan,
      );
      return widget.showAppBar
          ? PremiumScaffold(body: errorWidget)
          : errorWidget;
    }

    final content = RefreshIndicator(
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

            // Greeting Section
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _plan!.date,
                  style: TextStyle(
                    fontSize: 14,
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Good morning, ${user?.firstName ?? "Alex"}.',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                    color: colors.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Quick Navigation Hub (Workout, Meals, Water, Cardio)
            _buildQuickNavHub(colors),
            const SizedBox(height: 20),

            // Overall Daily Progress Card (Adherence Ring with Ambient Glow)
            _buildAdherenceCard(colors),
            const SizedBox(height: 20),

            // Weight Journey
            _buildWeightJourney(colors),
            const SizedBox(height: 20),

            // Today's Progress Bento
            _buildProgressBento(colors),
            const SizedBox(height: 20),

            // Today's Tasks Checklist
            _buildTasksList(colors),
            const SizedBox(height: 20),

            // Side-by-Side: Training Session & Cardio Target
            _buildTrainingAndCardioSection(colors),
            const SizedBox(height: 16),

            // Meals & Nutrition Detailed Card
            _buildNutritionCard(colors),
            const SizedBox(height: 16),

            // Side-by-Side: Hydration Tracker & Morning Body Weight
            _buildHydrationAndWeightSection(colors),
          ],
        ),
      ),
    );

    if (!widget.showAppBar) {
      return content;
    }

    return PremiumScaffold(
      appBar: PremiumAppBar(
        title: Row(
          children: [
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: widget.onOpenProfile,
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: colors.surfaceElevated,
                  border:
                      Border.all(color: Colors.white.withValues(alpha: 0.1)),
                ),
                child: ClipOval(
                  child: Icon(Icons.person,
                      size: 20, color: colors.textSecondary),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Kinetic Wellness',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                  color: colors.textPrimary,
                ),
              ),
            ),
          ],
        ),
        actions: [
          PremiumIconButton(
            icon: Icons.sync,
            color: colors.primary,
            onPressed: _fetchTodayPlan,
            tooltip: 'Sync Agenda',
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: content,
    );
  }

  Widget _buildResumeWorkoutBanner(AppThemeColors colors) {
    final sessionName =
        _activeSession['workout_name_snapshot'] as String? ?? 'Workout Session';
    final sessionId = (_activeSession['id'] is num)
        ? (_activeSession['id'] as num).toInt()
        : int.tryParse(_activeSession['id']?.toString() ?? '0') ?? 0;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.primary.withValues(alpha: 0.4)),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isNarrow = constraints.maxWidth < 340;
          if (isNarrow) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: colors.primaryMuted,
                        borderRadius: BorderRadius.circular(AppRadii.md),
                      ),
                      child: Icon(Icons.play_circle_filled,
                          color: colors.primary, size: 20),
                    ),
                    const SizedBox(width: 10),
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
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: colors.textPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: PremiumButton(
                        text: 'Discard',
                        isSecondary: true,
                        isDanger: true,
                        onPressed: _discardActiveWorkout,
                        height: 32,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: PremiumButton(
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
                    ),
                  ],
                ),
              ],
            );
          }

          return Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: colors.primaryMuted,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                ),
                child: Icon(Icons.play_circle_filled,
                    color: colors.primary, size: 22),
              ),
              const SizedBox(width: 10),
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
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              PremiumButton(
                text: 'Discard',
                isSecondary: true,
                isDanger: true,
                onPressed: _discardActiveWorkout,
                height: 32,
              ),
              const SizedBox(width: 6),
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
          );
        },
      ),
    );
  }

  Widget _buildAdherenceCard(AppThemeColors colors) {
    final pct = _plan!.overallAdherencePct;
    return PremiumCard(
      padding: const EdgeInsets.all(20),
      ambientGlow: true,
      child: Row(
        children: [
          SizedBox(
            width: 84,
            height: 84,
            child: Stack(
              fit: StackFit.expand,
              children: [
                CircularProgressIndicator(
                  value: 1.0,
                  strokeWidth: 8,
                  color: colors.surfaceElevated,
                ),
                CircularProgressIndicator(
                  value: (pct / 100.0).clamp(0.0, 1.0),
                  strokeWidth: 8,
                  strokeCap: StrokeCap.round,
                  backgroundColor: Colors.transparent,
                  valueColor: AlwaysStoppedAnimation(colors.primary),
                ),
                Center(
                  child: Text(
                    '$pct%',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      color: colors.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Today's Adherence",
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  pct >= 80
                      ? 'On track for weekly goal.'
                      : '${_plan!.completedTasks} of ${_plan!.totalTasks} planned tasks completed',
                  style: TextStyle(
                    fontSize: 13,
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWeightJourney(AppThemeColors colors) {
    final weight = _plan!.weight;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Weight Journey',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: colors.textPrimary,
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              flex: 6,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: _openWeightSheet,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  child: PremiumCard(
                    padding: const EdgeInsets.all(18),
                    ambientGlow: true,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                'CURRENT WEIGHT',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.5,
                                  color: colors.textSecondary,
                                ),
                              ),
                            ),
                            const SizedBox(width: 4),
                            Icon(Icons.edit_outlined, size: 14, color: colors.textMuted),
                          ],
                        ),
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Flexible(
                          child: Text(
                            weight.logged ? '${weight.current}' : '—',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w900,
                              color: colors.primary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'kg',
                          style: TextStyle(
                            fontSize: 14,
                            color: colors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: weight.logged ? 0.73 : 0.0,
                        minHeight: 6,
                        backgroundColor: colors.surfaceElevated,
                        valueColor: AlwaysStoppedAnimation(colors.primary),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Flexible(
                          child: Text(
                            'Start: 88kg',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                fontSize: 11, color: colors.textMuted),
                          ),
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            'Goal: 75kg',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                fontSize: 11, color: colors.textMuted),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
            Expanded(
              flex: 4,
              child: PremiumCard(
                padding: const EdgeInsets.all(18),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.trending_down,
                        size: 36, color: colors.textSecondary),
                    const SizedBox(height: 8),
                    Text(
                      '-1.2 kg',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: colors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'this week',
                      style: TextStyle(fontSize: 12, color: colors.textMuted),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildQuickNavHub(AppThemeColors colors) {
    final workout = _plan!.workout;
    final hasWorkout = workout != null;
    final isRestDay = hasWorkout &&
        (workout['is_rest_day'] == 1 ||
            workout['is_rest_day'] == true ||
            workout['isRestDay'] == true);
    final workoutStatus = hasWorkout && !isRestDay ? 'Start' : (isRestDay ? 'Rest' : 'Browse');

    final meals = (_plan!.diet['meals'] as List<dynamic>? ?? []);
    final mealsLogged = meals
        .where((m) => m['log'] != null && m['log']['status'] == 'completed')
        .length;

    final cardio = _plan!.cardio;
    final num completedCardioMinutes = num.tryParse((cardio['completedMinutes'] ??
            cardio['completed_minutes'] ??
            cardio['totalMinutes'] ??
            0)
        .toString()) ?? 0;

    final water = _plan!.water;
    final weight = _plan!.weight;
    final weightBadge = weight.logged && weight.current != null
        ? '${weight.current!.toStringAsFixed(1).replaceAll(RegExp(r'\.0$'), '')}kg'
        : 'Log';

    final actionMap = <String, _QuickActionData>{
      'workout': _QuickActionData(
        id: 'workout',
        icon: Icons.fitness_center,
        label: 'Workout',
        badge: workoutStatus,
        color: colors.primary,
        onTap: _navigateToWorkout,
      ),
      'meals': _QuickActionData(
        id: 'meals',
        icon: Icons.restaurant,
        label: 'Meals',
        badge: '$mealsLogged/${meals.length}',
        color: colors.violet,
        onTap: _navigateToMeals,
      ),
      'water': _QuickActionData(
        id: 'water',
        icon: Icons.water_drop,
        label: 'Water',
        badge: '${water.totalMl}ml',
        color: colors.cyan,
        onTap: _openWaterSheet,
      ),
      'cardio': _QuickActionData(
        id: 'cardio',
        icon: Icons.directions_run,
        label: 'Cardio',
        badge: '${completedCardioMinutes.toInt()}m',
        color: colors.rose,
        onTap: _openCardioSheet,
      ),
      'weight': _QuickActionData(
        id: 'weight',
        icon: Icons.monitor_weight_outlined,
        label: 'Weight',
        badge: weightBadge,
        color: colors.violet,
        onTap: _openWeightSheet,
      ),
      'history': _QuickActionData(
        id: 'history',
        icon: Icons.history,
        label: 'History',
        badge: 'Logs',
        color: colors.amber,
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (ctx) => HistoryScreen(
                apiClient: widget.apiClient,
                localCache: widget.localCache,
              ),
            ),
          ).then((_) => _fetchTodayPlan());
        },
      ),
    };

    final orderedActions = _quickActionOrder
        .map((id) => actionMap[id])
        .whereType<_QuickActionData>()
        .toList();

    // Chunk actions into 3 items per line
    final rows = <List<_QuickActionData>>[];
    for (int i = 0; i < orderedActions.length; i += 3) {
      final end = (i + 3 < orderedActions.length) ? i + 3 : orderedActions.length;
      rows.add(orderedActions.sublist(i, end));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Row(
                children: [
                  Text(
                    'QUICK ACTIONS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: colors.textSecondary,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: colors.surfaceElevated,
                        borderRadius: BorderRadius.circular(AppRadii.sm),
                        border: Border.all(
                          color: colors.border.withValues(alpha: 0.4),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.drag_indicator, size: 10, color: colors.textSecondary),
                          const SizedBox(width: 2),
                          Flexible(
                            child: Text(
                              'Reorder',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w600,
                                color: colors.textSecondary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(AppRadii.sm),
                onTap: () {
                  setState(() {
                    _quickActionOrder = [
                      'workout',
                      'meals',
                      'water',
                      'cardio',
                      'weight',
                      'history',
                    ];
                  });
                  _saveQuickActionsOrder();
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.refresh, size: 12, color: colors.textSecondary),
                      const SizedBox(width: 3),
                      Text(
                        'Reset',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        for (int r = 0; r < rows.length; r++) ...[
          if (r > 0) const SizedBox(height: 8),
          Row(
            children: [
              for (int c = 0; c < 3; c++) ...[
                if (c > 0) const SizedBox(width: 8),
                Expanded(
                  child: c < rows[r].length
                      ? _buildReorderableActionPill(
                          item: rows[r][c],
                          colors: colors,
                        )
                      : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildReorderableActionPill({
    required _QuickActionData item,
    required AppThemeColors colors,
  }) {
    return DragTarget<String>(
      onWillAcceptWithDetails: (details) => details.data != item.id,
      onAcceptWithDetails: (details) {
        final draggedId = details.data;
        final oldIndex = _quickActionOrder.indexOf(draggedId);
        final targetIndex = _quickActionOrder.indexOf(item.id);
        if (oldIndex != -1 && targetIndex != -1 && oldIndex != targetIndex) {
          setState(() {
            final moved = _quickActionOrder.removeAt(oldIndex);
            _quickActionOrder.insert(targetIndex, moved);
          });
          _saveQuickActionsOrder();
        }
      },
      builder: (context, candidateData, rejectedData) {
        final isHovered = candidateData.isNotEmpty;
        return LongPressDraggable<String>(
          data: item.id,
          delay: const Duration(milliseconds: 220),
          hapticFeedbackOnStart: true,
          feedback: Material(
            color: Colors.transparent,
            child: SizedBox(
              width: 105,
              child: Transform.scale(
                scale: 1.06,
                child: _buildQuickNavPill(
                  item: item,
                  colors: colors,
                  onTap: () {},
                  isFeedback: true,
                ),
              ),
            ),
          ),
          childWhenDragging: Opacity(
            opacity: 0.28,
            child: _buildQuickNavPill(
              item: item,
              colors: colors,
              onTap: () {},
            ),
          ),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            transform: isHovered
                ? Matrix4.diagonal3Values(1.04, 1.04, 1.0)
                : Matrix4.identity(),
            decoration: isHovered
                ? BoxDecoration(
                    borderRadius: BorderRadius.circular(AppRadii.sm),
                    boxShadow: [
                      BoxShadow(
                        color: colors.isDark
                            ? const Color(0x33000000)
                            : const Color(0x14000000),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  )
                : null,
            child: _buildQuickNavPill(
              item: item,
              colors: colors,
              onTap: item.onTap,
            ),
          ),
        );
      },
    );
  }

  Widget _buildQuickNavPill({
    required _QuickActionData item,
    required AppThemeColors colors,
    required VoidCallback onTap,
    bool isFeedback = false,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.sm),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 4),
          decoration: BoxDecoration(
            color: isFeedback ? colors.surfaceElevated : colors.card,
            borderRadius: BorderRadius.circular(AppRadii.sm),
            border: Border.all(
              color: isFeedback ? colors.primary : colors.border,
              width: 1.0,
            ),
            boxShadow: isFeedback
                ? [
                    BoxShadow(
                      color: colors.isDark ? const Color(0x33000000) : const Color(0x14000000),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const SizedBox(width: 14),
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: colors.surfaceElevated,
                    ),
                    child: Icon(item.icon, size: 16, color: item.color),
                  ),
                  Icon(
                    Icons.drag_indicator,
                    size: 13,
                    color: colors.textSecondary.withValues(alpha: 0.35),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: colors.textPrimary,
                ),
              ),
              const SizedBox(height: 3),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                decoration: BoxDecoration(
                  color: colors.surfaceElevated,
                  borderRadius: BorderRadius.circular(AppRadii.xs),
                  border: Border.all(
                    color: colors.border,
                    width: 1.0,
                  ),
                ),
                child: Text(
                  item.badge,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 9.0,
                    fontWeight: FontWeight.w700,
                    color: colors.textSecondary,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _navigateToWorkout() {
    if (widget.onOpenWorkout != null) {
      widget.onOpenWorkout!();
      return;
    }
    final workout = _plan?.workout;
    final hasPlan = workout != null;
    final isRestDay = hasPlan &&
        (workout['is_rest_day'] == 1 ||
            workout['is_rest_day'] == true ||
            workout['isRestDay'] == true);
    final activeSession = workout?['activeSession'] is Map
        ? workout!['activeSession'] as Map<String, dynamic>
        : null;
    final isCompleted = activeSession != null &&
        (activeSession['status'] == 'completed' ||
            activeSession['status'] == 'finished');
    final completedSessionId = isCompleted
        ? (activeSession['id'] is num
            ? (activeSession['id'] as num).toInt()
            : int.tryParse(activeSession['id']?.toString() ?? ''))
        : null;

    if (hasPlan && !isRestDay) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (ctx) => WorkoutExecutionScreen(
            apiClient: widget.apiClient,
            workoutDayId: workout['id'],
            existingSessionId: completedSessionId,
            isReadOnly: isCompleted,
          ),
        ),
      ).then((_) => _fetchTodayPlan());
    } else {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (ctx) => WorkoutPlansScreen(
            apiClient: widget.apiClient,
          ),
        ),
      ).then((_) => _fetchTodayPlan());
    }
  }

  void _openMealSheet([Map<String, dynamic>? specificMeal]) {
    final rawMeals = (_plan?.diet['meals'] as List<dynamic>? ?? []);
    Map<String, dynamic>? targetMeal = specificMeal;
    if (targetMeal == null) {
      for (final m in rawMeals) {
        if (m is Map) {
          final map = Map<String, dynamic>.from(m);
          final log = map['log'];
          if (log == null || (log is Map && log['status'] != 'completed')) {
            targetMeal = map;
            break;
          }
        }
      }
      if (targetMeal == null && rawMeals.isNotEmpty && rawMeals.first is Map) {
        targetMeal = Map<String, dynamic>.from(rawMeals.first as Map);
      }
    }

    if (targetMeal != null) {
      showMealQuickLogSheet(
        context: context,
        apiClient: widget.apiClient,
        meal: targetMeal,
        onLogged: _fetchTodayPlan,
      );
    } else {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (ctx) => DietPlansScreen(
            apiClient: widget.apiClient,
          ),
        ),
      ).then((_) => _fetchTodayPlan());
    }
  }

  void _navigateToMeals() {
    if (widget.onOpenMeals != null) {
      widget.onOpenMeals!();
      return;
    }
    _openMealSheet();
  }

  void _openCardioSheet() {
    final cardio = _plan?.cardio ?? {};
    final cardioTarget = cardio['target'] is Map ? cardio['target'] : null;
    final num targetCardioMinutes = num.tryParse((cardio['targetMinutes'] ??
            cardio['target_minutes'] ??
            cardioTarget?['min_duration_minutes'] ??
            cardioTarget?['target_minutes_min'] ??
            0)
        .toString()) ?? 0;
    final num completedCardioMinutes = num.tryParse((cardio['completedMinutes'] ??
            cardio['completed_minutes'] ??
            cardio['totalMinutes'] ??
            0)
        .toString()) ?? 0;
    final activityName = (cardio['activityName'] ??
            cardio['activity_name'] ??
            cardioTarget?['activity_name'] ??
            'Running')
        .toString();

    showCardioQuickLogSheet(
      context: context,
      apiClient: widget.apiClient,
      targetMinutes: targetCardioMinutes,
      completedMinutes: completedCardioMinutes,
      defaultActivityName: activityName,
      onLogged: _fetchTodayPlan,
      onViewHistory: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (ctx) => CardioScreen(apiClient: widget.apiClient),
          ),
        ).then((_) => _fetchTodayPlan());
      },
    );
  }

  void _openWaterSheet() {
    final colors = AppThemeColors.of(context);
    final water = _plan?.water;
    if (water == null) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.lg)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Row(
                          children: [
                            Icon(Icons.water_drop, color: colors.cyan, size: 24),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                'Hydration Quick Log',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  color: colors.textPrimary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      StatusBadge(
                        label: '${water.totalMl} / ${water.targetMl} ml',
                        color: colors.cyan,
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  PremiumProgressBar(
                    value: water.targetMl > 0
                        ? (water.totalMl / water.targetMl).clamp(0.0, 1.0)
                        : 0.0,
                    height: 8,
                    color: colors.cyan,
                    backgroundColor: colors.surfaceElevated,
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'QUICK ADD PRESETS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.6,
                      color: colors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      ...water.quickAdds.map((ml) => PremiumChoiceButton(
                            label: '+$ml ml',
                            accentColor: colors.cyan,
                            onPressed: () async {
                              Navigator.pop(ctx);
                              await _quickAddWater(ml);
                            },
                          )),
                      PremiumChoiceButton(
                        label: '+250 ml',
                        accentColor: colors.cyan,
                        onPressed: () async {
                          Navigator.pop(ctx);
                          await _quickAddWater(250);
                        },
                      ),
                      PremiumChoiceButton(
                        label: '+500 ml',
                        accentColor: colors.cyan,
                        onPressed: () async {
                          Navigator.pop(ctx);
                          await _quickAddWater(500);
                        },
                      ),
                      PremiumChoiceButton(
                        label: 'Custom',
                        icon: Icons.edit,
                        accentColor: colors.cyan,
                        onPressed: () {
                          Navigator.pop(ctx);
                          _showCustomWaterDialog();
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _openWeightSheet() {
    final weight = _plan?.weight;
    showWeightQuickLogSheet(
      context: context,
      apiClient: widget.apiClient,
      currentWeightKg: weight?.current,
      goal: weight?.goal,
      onLogged: _fetchTodayPlan,
      onViewHistory: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (ctx) => WeightScreen(apiClient: widget.apiClient),
          ),
        ).then((_) => _fetchTodayPlan());
      },
    );
  }

  Widget _buildProgressBento(AppThemeColors colors) {
    final workout = _plan!.workout;
    final meals = (_plan!.diet['meals'] as List<dynamic>? ?? []);
    final mealsLogged = meals
        .where(
            (m) => m['log'] != null && m['log']['status'] == 'completed')
        .length;
    final cardio = _plan!.cardio;
    final cardioTarget = cardio['target'] is Map ? cardio['target'] : null;
    final num targetCardioMinutes = num.tryParse((cardio['targetMinutes'] ??
            cardio['target_minutes'] ??
            cardioTarget?['min_duration_minutes'] ??
            cardioTarget?['target_minutes_min'] ??
            0)
        .toString()) ?? 0;
    final num completedCardioMinutes = num.tryParse((cardio['completedMinutes'] ??
            cardio['completed_minutes'] ??
            cardio['totalMinutes'] ??
            0)
        .toString()) ?? 0;
    final water = _plan!.water;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                "Today's Progress",
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: colors.textPrimary,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'Tap cards to log',
              style: TextStyle(
                fontSize: 11,
                color: colors.textMuted,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            // Nutrition Bento
            Expanded(
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: _navigateToMeals,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  child: PremiumCard(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: colors.surfaceElevated,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(Icons.restaurant,
                                  size: 18, color: colors.primary),
                            ),
                            Icon(Icons.arrow_forward_ios,
                                size: 12, color: colors.textMuted),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'NUTRITION',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.6,
                            color: colors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '$mealsLogged/${meals.length}',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: colors.textPrimary,
                          ),
                        ),
                        Text(
                          'Meals logged',
                          style: TextStyle(fontSize: 11, color: colors.textMuted),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            // Workout Bento
            Expanded(
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: _navigateToWorkout,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  child: PremiumCard(
                    padding: const EdgeInsets.all(14),
                    color: colors.primary.withValues(alpha: 0.08),
                    border: BorderSide(
                        color: colors.primary.withValues(alpha: 0.25)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: colors.primary,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(Icons.fitness_center,
                                  size: 18, color: colors.onPrimary),
                            ),
                            Icon(Icons.arrow_forward_ios,
                                size: 12, color: colors.primary),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'WORKOUT',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.6,
                            color: colors.primary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          workout != null ? 'Active' : 'Rest',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: colors.primary,
                          ),
                        ),
                        Text(
                          workout?['name'] ?? 'Rest & Recovery',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              fontSize: 11,
                              color: colors.primary.withValues(alpha: 0.7)),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            // Cardio Bento
            Expanded(
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: _openCardioSheet,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  child: PremiumCard(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: colors.surfaceElevated,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(Icons.directions_run,
                                  size: 18, color: colors.cyan),
                            ),
                            Icon(Icons.arrow_forward_ios,
                                size: 12, color: colors.textMuted),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'CARDIO',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.6,
                            color: colors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${completedCardioMinutes.toInt()}/${targetCardioMinutes.toInt()}m',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: colors.textPrimary,
                          ),
                        ),
                        Text(
                          completedCardioMinutes >= targetCardioMinutes && targetCardioMinutes > 0
                              ? 'Goal completed'
                              : 'Tap to log cardio',
                          style: TextStyle(fontSize: 11, color: colors.cyan),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            // Water Bento
            Expanded(
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: _openWaterSheet,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  child: PremiumCard(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: colors.surfaceElevated,
                                shape: BoxShape.circle,
                              ),
                              child:
                                  Icon(Icons.water_drop, size: 18, color: colors.cyan),
                            ),
                            Icon(Icons.arrow_forward_ios,
                                size: 12, color: colors.textMuted),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'WATER',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.6,
                            color: colors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${(water.totalMl / 1000).toStringAsFixed(1)}/${(water.targetMl / 1000).toStringAsFixed(1)}L',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: colors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(2),
                          child: LinearProgressIndicator(
                            value: water.targetMl > 0
                                ? (water.totalMl / water.targetMl).clamp(0.0, 1.0)
                                : 0.0,
                            minHeight: 4,
                            backgroundColor: colors.surfaceElevated,
                            valueColor: AlwaysStoppedAnimation(colors.cyan),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildTrainingAndCardioSection(AppThemeColors colors) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: _buildWorkoutCard(colors)),
          const SizedBox(width: 10),
          Expanded(child: _buildCardioCard(colors)),
        ],
      ),
    );
  }

  Widget _buildWorkoutCard(AppThemeColors colors) {
    final workout = _plan?.workout;
    final hasPlan = workout != null;
    final isRestDay = hasPlan &&
        (workout['is_rest_day'] == 1 || workout['is_rest_day'] == true);
    final exercises = (workout?['exercises'] as List?) ?? [];
    final exerciseCount = exercises.length;
    final activeSession = workout?['activeSession'] is Map
        ? workout!['activeSession'] as Map<String, dynamic>
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
      padding: const EdgeInsets.all(12),
      ambientGlow: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.fitness_center_rounded,
                      color: colors.textPrimary,
                      size: 14,
                    ),
                    const SizedBox(width: 5),
                    Flexible(
                      child: Text(
                        'TRAINING SESSION',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: colors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (hasPlan && !isRestDay) ...[
                const SizedBox(width: 4),
                if (isCompleted)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 1.5),
                    decoration: BoxDecoration(
                      color: colors.emeraldMuted,
                      borderRadius: BorderRadius.circular(AppRadii.xs),
                      border: Border.all(
                          color: colors.emerald.withValues(alpha: 0.35),
                          width: 1.0),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check_circle_rounded,
                            size: 10, color: colors.emerald),
                        const SizedBox(width: 3),
                        Text(
                          'Done',
                          style: TextStyle(
                            color: colors.emerald,
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 5, vertical: 1.5),
                    decoration: BoxDecoration(
                      color: colors.surfaceElevated,
                      borderRadius: BorderRadius.circular(AppRadii.xs),
                      border: Border.all(color: colors.border, width: 1.0),
                    ),
                    child: Text(
                      '$exerciseCount Ex',
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          // Workout Title
          Text(
            !hasPlan
                ? 'No Workout'
                : (isRestDay
                    ? 'Rest & Recovery'
                    : (workout['name'] ?? 'Assigned Workout')),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: colors.textPrimary,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 4),
          // Subtext
          Text(
            !hasPlan
                ? 'No protocol assigned'
                : (isRestDay
                    ? 'Active muscle recovery'
                    : (isCompleted
                        ? 'Workout completed & saved'
                        : '$exerciseCount working exercises')),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              color: isCompleted ? colors.emerald : colors.textSecondary,
              fontWeight: isCompleted ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
          const Spacer(),
          const SizedBox(height: 12),
          // Action Button
          if (hasPlan && !isRestDay)
            isCompleted
                ? PremiumButton(
                    text: 'View Completed',
                    icon: const Icon(Icons.visibility_rounded, size: 15),
                    height: 34,
                    width: double.infinity,
                    isSecondary: true,
                    onPressed: () async {
                      await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (ctx) => WorkoutExecutionScreen(
                            apiClient: widget.apiClient,
                            workoutDayId: workout['id'],
                            existingSessionId: completedSessionId,
                            isReadOnly: true,
                          ),
                        ),
                      );
                      _fetchTodayPlan();
                    },
                  )
                : PremiumButton(
                    text: 'Start',
                    icon: const Icon(Icons.play_arrow_rounded, size: 16),
                    height: 34,
                    width: double.infinity,
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
                  )
          else
            PremiumButton(
              text: isRestDay ? 'Rest Day' : 'Browse',
              height: 34,
              width: double.infinity,
              isSecondary: true,
              onPressed: isRestDay
                  ? null
                  : () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (ctx) => WorkoutPlansScreen(
                            apiClient: widget.apiClient,
                          ),
                        ),
                      ).then((_) => _fetchTodayPlan());
                    },
            ),
        ],
      ),
    );
  }

  Widget _buildCardioCard(AppThemeColors colors) {
    final cardio = _plan?.cardio ?? {};
    final cardioTarget = cardio['target'] is Map ? cardio['target'] : null;
    final num? targetMinutes = num.tryParse((cardio['targetMinutes'] ??
            cardio['target_minutes'] ??
            cardioTarget?['min_duration_minutes'] ??
            cardioTarget?['target_minutes_min'] ??
            '')
        .toString());
    final num completedMinutes = num.tryParse((cardio['completedMinutes'] ??
            cardio['completed_minutes'] ??
            cardio['totalMinutes'] ??
            0)
        .toString()) ?? 0;
    final activityName = (cardio['activityName'] ??
            cardio['activity_name'] ??
            cardioTarget?['activity_name'] ??
            'Cardio')
        .toString();
    final hasTarget = targetMinutes != null && targetMinutes > 0;
    final isDone = hasTarget && completedMinutes >= targetMinutes;

    return PremiumCard(
      padding: const EdgeInsets.all(12),
      ambientGlow: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.directions_run_rounded,
                      color: colors.textPrimary,
                      size: 14,
                    ),
                    const SizedBox(width: 5),
                    Flexible(
                      child: Text(
                        'CARDIO TARGET',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: colors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (hasTarget) ...[
                const SizedBox(width: 4),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                  decoration: BoxDecoration(
                    color: colors.surfaceElevated,
                    borderRadius: BorderRadius.circular(AppRadii.xs),
                    border: Border.all(color: colors.border, width: 1.0),
                  ),
                  child: Text(
                    isDone
                        ? 'Done'
                        : '${completedMinutes.toInt()}/${targetMinutes.toInt()}m',
                    style: TextStyle(
                      color: isDone ? colors.textPrimary : colors.textSecondary,
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          // Activity Title
          Text(
            activityName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          // Metric & Progress
          if (hasTarget) ...[
            Text(
              '${completedMinutes.toInt()} of ${targetMinutes.toInt()} min logged',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11, color: colors.textSecondary),
            ),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadii.xs),
              child: LinearProgressIndicator(
                value: (completedMinutes / targetMinutes).clamp(0.0, 1.0),
                minHeight: 3,
                backgroundColor: colors.surfaceElevated,
                valueColor: AlwaysStoppedAnimation<Color>(
                  colors.textPrimary,
                ),
              ),
            ),
          ] else
            Text(
              'Optional conditioning',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11, color: colors.textMuted),
            ),
          const Spacer(),
          const SizedBox(height: 12),
          // Action Button
          PremiumButton(
            text: 'Log Cardio',
            icon: const Icon(Icons.add_rounded, size: 16),
            height: 34,
            width: double.infinity,
            isSecondary: true,
            onPressed: _openCardioSheet,
          ),
        ],
      ),
    );
  }

  Widget _buildCompactMealItem(Map<String, dynamic> meal, AppThemeColors colors) {
    final isLogged =
        meal['log'] != null && meal['log']['status'] == 'completed';
    final name = (meal['name'] ?? 'Meal').toString();

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _openMealSheet(meal),
        borderRadius: BorderRadius.circular(AppRadii.sm),
        child: Container(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: isLogged
                ? colors.surfaceElevated.withValues(alpha: 0.35)
                : colors.surface,
            borderRadius: BorderRadius.circular(AppRadii.sm),
            border: Border.all(
              color: isLogged
                  ? colors.border.withValues(alpha: 0.4)
                  : colors.border,
              width: 1.0,
            ),
          ),
          child: Row(
            children: [
              // Mini architectural checkbox indicator
              Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  color: isLogged ? colors.textPrimary : Colors.transparent,
                  borderRadius: BorderRadius.circular(AppRadii.xs),
                  border: Border.all(
                    color: isLogged
                        ? colors.textPrimary
                        : colors.border.withValues(alpha: 0.8),
                    width: 1.0,
                  ),
                ),
                child: isLogged
                    ? Icon(
                        Icons.check,
                        size: 10,
                        color: colors.background,
                      )
                    : null,
              ),
              const SizedBox(width: 6),
              // Category Icon
              Icon(
                Icons.restaurant_menu_rounded,
                size: 12,
                color: isLogged ? colors.textMuted : colors.textSecondary,
              ),
              const SizedBox(width: 5),
              // Meal Name
              Expanded(
                child: Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: isLogged ? FontWeight.w400 : FontWeight.w600,
                    decoration: isLogged ? TextDecoration.lineThrough : null,
                    color: isLogged ? colors.textMuted : colors.textPrimary,
                  ),
                ),
              ),
              if (!isLogged) ...[
                const SizedBox(width: 2),
                Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 8,
                  color: colors.textMuted.withValues(alpha: 0.6),
                ),
              ] else ...[
                const SizedBox(width: 2),
                Icon(
                  Icons.edit_rounded,
                  size: 9,
                  color: colors.textMuted.withValues(alpha: 0.7),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNutritionCard(AppThemeColors colors) {
    if (_plan?.diet == null) {
      return const SizedBox.shrink();
    }

    final rawMeals = _plan!.diet['meals'] as List<dynamic>? ?? [];
    final meals = rawMeals
        .whereType<Map>()
        .map((m) => Map<String, dynamic>.from(m))
        .toList();

    final completedCount = meals
        .where((m) => m['log'] != null && m['log']['status'] == 'completed')
        .length;
    final totalCount = meals.length;
    final progress = totalCount > 0 ? (completedCount / totalCount) : 0.0;

    return PremiumCard(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      ambientGlow: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Sleek Architectural Micro Header
          InkWell(
            onTap: () {
              setState(() {
                _mealsCollapsed = !_mealsCollapsed;
              });
            },
            borderRadius: BorderRadius.circular(AppRadii.xs),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 2.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.restaurant_rounded,
                          size: 14,
                          color: colors.textSecondary,
                        ),
                        const SizedBox(width: 5),
                        Flexible(
                          child: Text(
                            "NUTRITION & MEALS",
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                              color: colors.textPrimary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 5, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: colors.surfaceElevated,
                            borderRadius: BorderRadius.circular(AppRadii.xs),
                            border:
                                Border.all(color: colors.border, width: 1.0),
                          ),
                          child: Text(
                            '$completedCount/$totalCount',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: colors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 36,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(AppRadii.xs),
                          child: LinearProgressIndicator(
                            value: progress,
                            minHeight: 3,
                            backgroundColor: colors.surfaceElevated,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              colors.textPrimary,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        '${(progress * 100).toInt()}%',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: colors.textSecondary,
                        ),
                      ),
                      const SizedBox(width: 2),
                      Icon(
                        _mealsCollapsed
                            ? Icons.keyboard_arrow_down_rounded
                            : Icons.keyboard_arrow_up_rounded,
                        size: 16,
                        color: colors.textMuted,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          if (!_mealsCollapsed) ...[
            const SizedBox(height: 8),
            if (meals.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Text(
                  'No meal protocols scheduled for today.',
                  style: TextStyle(fontSize: 11, color: colors.textMuted),
                ),
              )
            else
              LayoutBuilder(
                builder: (context, constraints) {
                  final isTwoColumn = constraints.maxWidth >= 280;
                  if (!isTwoColumn) {
                    return Column(
                      mainAxisSize: MainAxisSize.min,
                      children: meals.map((meal) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: _buildCompactMealItem(meal, colors),
                        );
                      }).toList(),
                    );
                  }

                  final rows = <Widget>[];
                  for (int i = 0; i < meals.length; i += 2) {
                    final first = meals[i];
                    final second = (i + 1 < meals.length) ? meals[i + 1] : null;

                    rows.add(
                      Row(
                        children: [
                          Expanded(child: _buildCompactMealItem(first, colors)),
                          if (second != null) ...[
                            const SizedBox(width: 8),
                            Expanded(child: _buildCompactMealItem(second, colors)),
                          ] else
                            const Expanded(child: SizedBox.shrink()),
                        ],
                      ),
                    );
                    if (i + 2 < meals.length) {
                      rows.add(const SizedBox(height: 6));
                    }
                  }

                  return Column(
                    mainAxisSize: MainAxisSize.min,
                    children: rows,
                  );
                },
              ),
          ],
        ],
      ),
    );
  }



  Widget _buildHydrationAndWeightSection(AppThemeColors colors) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: _buildWaterCard(colors)),
          const SizedBox(width: 10),
          Expanded(child: _buildWeightCard(colors)),
        ],
      ),
    );
  }

  Widget _buildWaterCard(AppThemeColors colors) {
    final water = _plan?.water;
    final totalMl = water?.totalMl ?? 0;
    final targetMl = water?.targetMl ?? 0;
    final hasTarget = targetMl > 0;
    final isDone = hasTarget && totalMl >= targetMl;

    return PremiumCard(
      padding: const EdgeInsets.all(12),
      ambientGlow: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row
          Row(
            children: [
              Icon(
                Icons.water_drop_rounded,
                color: colors.textPrimary,
                size: 14,
              ),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  'HYDRATION',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                    color: colors.textSecondary,
                  ),
                ),
              ),
              if (hasTarget) ...[
                const SizedBox(width: 4),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                  decoration: BoxDecoration(
                    color: colors.surfaceElevated,
                    borderRadius: BorderRadius.circular(AppRadii.xs),
                    border: Border.all(color: colors.border, width: 1.0),
                  ),
                  child: Text(
                    isDone
                        ? 'Done'
                        : (targetMl >= 1000
                            ? '${(totalMl / 1000).toStringAsFixed(1)}/${(targetMl / 1000).toStringAsFixed(1)}L'
                            : '$totalMl/${targetMl}ml'),
                    style: TextStyle(
                      color: isDone ? colors.textPrimary : colors.textSecondary,
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          // Intake Title
          Text(
            '$totalMl ml',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          // Metric & Progress
          if (hasTarget) ...[
            Text(
              isDone
                  ? 'Daily target reached'
                  : '${targetMl - totalMl} ml to target',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11, color: colors.textSecondary),
            ),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadii.xs),
              child: LinearProgressIndicator(
                value: (totalMl / targetMl).clamp(0.0, 1.0),
                minHeight: 3,
                backgroundColor: colors.surfaceElevated,
                valueColor: AlwaysStoppedAnimation<Color>(
                  colors.textPrimary,
                ),
              ),
            ),
          ] else
            Text(
              'Daily intake logged',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11, color: colors.textMuted),
            ),
          const Spacer(),
          const SizedBox(height: 12),
          // Action Button
          PremiumButton(
            text: 'Log Water',
            icon: const Icon(Icons.add_rounded, size: 16),
            height: 34,
            width: double.infinity,
            isSecondary: true,
            onPressed: _openWaterSheet,
          ),
        ],
      ),
    );
  }

  Widget _buildWeightCard(AppThemeColors colors) {
    final weight = _plan?.weight;
    final isLogged = weight?.logged ?? false;
    final currentWeight = weight?.current;
    final rawGoal = weight?.goal;
    final num? targetWeight = rawGoal != null
        ? num.tryParse((rawGoal['target_weight'] ??
                rawGoal['target_weight_kg'] ??
                rawGoal['goal_weight'] ??
                rawGoal['weight'] ??
                '')
            .toString())
        : null;

    return PremiumCard(
      padding: const EdgeInsets.all(12),
      ambientGlow: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row
          Row(
            children: [
              Icon(
                Icons.monitor_weight_rounded,
                color: colors.textPrimary,
                size: 14,
              ),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  'BODY WEIGHT',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                    color: colors.textSecondary,
                  ),
                ),
              ),
              const SizedBox(width: 4),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                decoration: BoxDecoration(
                  color: colors.surfaceElevated,
                  borderRadius: BorderRadius.circular(AppRadii.xs),
                  border: Border.all(color: colors.border, width: 1.0),
                ),
                child: Text(
                  isLogged ? 'Logged' : 'Pending',
                  style: TextStyle(
                    color: isLogged ? colors.textPrimary : colors.textSecondary,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Weight Title
          Text(
            isLogged && currentWeight != null
                ? '${currentWeight.toStringAsFixed(1).replaceAll(RegExp(r'\.0$'), '')} kg'
                : 'Not Recorded',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          // Subtext & Goal / Status
          Text(
            isLogged
                ? (targetWeight != null
                    ? 'Target: ${targetWeight.toStringAsFixed(1).replaceAll(RegExp(r'\.0$'), '')} kg'
                    : 'Morning check-in done')
                : (targetWeight != null
                    ? 'Target: ${targetWeight.toStringAsFixed(1).replaceAll(RegExp(r'\.0$'), '')} kg'
                    : 'Daily morning weigh-in'),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              color: colors.textSecondary,
            ),
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadii.xs),
            child: LinearProgressIndicator(
              value: isLogged ? 1.0 : 0.0,
              minHeight: 3,
              backgroundColor: colors.surfaceElevated,
              valueColor: AlwaysStoppedAnimation<Color>(
                colors.textPrimary,
              ),
            ),
          ),
          const Spacer(),
          const SizedBox(height: 12),
          // Action Button
          PremiumButton(
            text: isLogged ? 'Update' : 'Log Weight',
            icon: Icon(isLogged ? Icons.edit_rounded : Icons.add_rounded, size: 16),
            height: 34,
            width: double.infinity,
            isSecondary: isLogged,
            onPressed: _openWeightSheet,
          ),
        ],
      ),
    );
  }

  IconData _getTaskCategoryIcon(DailyTaskModel task) {
    final type = task.taskType.toLowerCase();
    final key = task.taskKey.toLowerCase();
    final title = task.title.toLowerCase();

    if (type.contains('workout') || key.contains('workout') || title.contains('workout')) {
      return Icons.fitness_center_rounded;
    } else if (type.contains('cardio') || key.contains('cardio') || title.contains('cardio')) {
      return Icons.directions_run_rounded;
    } else if (type.contains('meal') ||
        type.contains('diet') ||
        type.contains('nutrition') ||
        key.contains('meal') ||
        title.contains('meal') ||
        title.contains('shake') ||
        title.contains('eat')) {
      return Icons.restaurant_rounded;
    } else if (type.contains('water') ||
        key.contains('water') ||
        title.contains('water') ||
        title.contains('hydrate')) {
      return Icons.water_drop_rounded;
    } else if (type.contains('weight') || key.contains('weight') || title.contains('weight')) {
      return Icons.monitor_weight_rounded;
    }
    return Icons.task_alt_rounded;
  }

  void _onTaskTap(DailyTaskModel task, AppThemeColors colors) {
    final type = task.taskType.toLowerCase();
    final key = task.taskKey.toLowerCase();
    final title = task.title.toLowerCase();

    if (type.contains('workout') || key.contains('workout') || title.contains('workout')) {
      _navigateToWorkout();
    } else if (type.contains('cardio') || key.contains('cardio') || title.contains('cardio')) {
      _openCardioSheet();
    } else if (type.contains('meal') ||
        type.contains('diet') ||
        type.contains('nutrition') ||
        key.contains('meal') ||
        title.contains('meal') ||
        title.contains('shake') ||
        title.contains('eat')) {
      _navigateToMeals();
    } else if (type.contains('water') ||
        key.contains('water') ||
        title.contains('water') ||
        title.contains('hydrate')) {
      _openWaterSheet();
    } else if (type.contains('weight') || key.contains('weight') || title.contains('weight')) {
      _openWeightSheet();
    }
  }

  Widget _buildCompactTaskItem(DailyTaskModel task, AppThemeColors colors) {
    final isDone = task.isCompleted;
    final catIcon = _getTaskCategoryIcon(task);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _onTaskTap(task, colors),
        borderRadius: BorderRadius.circular(AppRadii.sm),
        child: Container(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: isDone
                ? colors.surfaceElevated.withValues(alpha: 0.35)
                : colors.surface,
            borderRadius: BorderRadius.circular(AppRadii.sm),
            border: Border.all(
              color: isDone
                  ? colors.border.withValues(alpha: 0.4)
                  : colors.border,
              width: 1.0,
            ),
          ),
          child: Row(
            children: [
              // Mini architectural checkbox indicator
              Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  color: isDone ? colors.textPrimary : Colors.transparent,
                  borderRadius: BorderRadius.circular(AppRadii.xs),
                  border: Border.all(
                    color: isDone
                        ? colors.textPrimary
                        : colors.border.withValues(alpha: 0.8),
                    width: 1.0,
                  ),
                ),
                child: isDone
                    ? Icon(
                        Icons.check,
                        size: 10,
                        color: colors.background,
                      )
                    : null,
              ),
              const SizedBox(width: 6),
              // Category Icon
              Icon(
                catIcon,
                size: 12,
                color: isDone ? colors.textMuted : colors.textSecondary,
              ),
              const SizedBox(width: 5),
              // Task Title
              Expanded(
                child: Text(
                  task.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: isDone ? FontWeight.w400 : FontWeight.w600,
                    decoration: isDone ? TextDecoration.lineThrough : null,
                    color: isDone ? colors.textMuted : colors.textPrimary,
                  ),
                ),
              ),
              if (!isDone) ...[
                const SizedBox(width: 2),
                Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 8,
                  color: colors.textMuted.withValues(alpha: 0.6),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTasksList(AppThemeColors colors) {
    if (_plan?.tasks == null || _plan!.tasks.isEmpty) {
      return const SizedBox.shrink();
    }

    final tasks = _plan!.tasks;
    final completedCount = tasks.where((t) => t.isCompleted).length;
    final totalCount = tasks.length;
    final progress = totalCount > 0 ? (completedCount / totalCount) : 0.0;

    return PremiumCard(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      ambientGlow: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Sleek Architectural Micro Header
          InkWell(
            onTap: () {
              setState(() {
                _tasksCollapsed = !_tasksCollapsed;
              });
            },
            borderRadius: BorderRadius.circular(AppRadii.xs),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 2.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.check_circle_outline_rounded,
                          size: 14,
                          color: colors.textSecondary,
                        ),
                        const SizedBox(width: 5),
                        Flexible(
                          child: Text(
                            "TODAY'S TASKS",
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                              color: colors.textPrimary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 5, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: colors.surfaceElevated,
                            borderRadius: BorderRadius.circular(AppRadii.xs),
                            border:
                                Border.all(color: colors.border, width: 1.0),
                          ),
                          child: Text(
                            '$completedCount/$totalCount',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: colors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 36,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(AppRadii.xs),
                          child: LinearProgressIndicator(
                            value: progress,
                            minHeight: 3,
                            backgroundColor: colors.surfaceElevated,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              colors.textPrimary,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        '${(progress * 100).toInt()}%',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: colors.textSecondary,
                        ),
                      ),
                      const SizedBox(width: 2),
                      Icon(
                        _tasksCollapsed
                            ? Icons.keyboard_arrow_down_rounded
                            : Icons.keyboard_arrow_up_rounded,
                        size: 16,
                        color: colors.textMuted,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          if (!_tasksCollapsed) ...[
            const SizedBox(height: 8),
            // Compact 2-Column Micro-Grid
            LayoutBuilder(
              builder: (context, constraints) {
                final isTwoColumn = constraints.maxWidth >= 280;
                if (!isTwoColumn) {
                  return Column(
                    mainAxisSize: MainAxisSize.min,
                    children: tasks.map((task) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: _buildCompactTaskItem(task, colors),
                      );
                    }).toList(),
                  );
                }

                final rows = <Widget>[];
                for (int i = 0; i < tasks.length; i += 2) {
                  final first = tasks[i];
                  final second = (i + 1 < tasks.length) ? tasks[i + 1] : null;

                  rows.add(
                    Row(
                      children: [
                        Expanded(child: _buildCompactTaskItem(first, colors)),
                        if (second != null) ...[
                          const SizedBox(width: 8),
                          Expanded(child: _buildCompactTaskItem(second, colors)),
                        ] else
                          const Expanded(child: SizedBox.shrink()),
                      ],
                    ),
                  );
                  if (i + 2 < tasks.length) {
                    rows.add(const SizedBox(height: 6));
                  }
                }

                return Column(
                  mainAxisSize: MainAxisSize.min,
                  children: rows,
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}
