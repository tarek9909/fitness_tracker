import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/storage/local_cache.dart';
import '../../core/widgets/premium_widgets.dart';

class HistoryScreen extends StatefulWidget {
  final ApiClient apiClient;
  final LocalCache? localCache;

  const HistoryScreen({super.key, required this.apiClient, this.localCache});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  List<dynamic> _workouts = [];
  List<dynamic> _meals = [];
  List<dynamic> _water = [];
  List<dynamic> _cardio = [];
  List<dynamic> _weight = [];
  bool _loading = true;
  String? _errorMessage;
  bool _showingCachedData = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    _fetchAllHistory();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchAllHistory() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
      _showingCachedData = false;
    });

    try {
      final sources = [
        ('workouts', '/me/workouts/history?limit=50'),
        ('meals', '/me/meals/history?limit=50'),
        ('water', '/me/water/history?limit=50'),
        ('cardio', '/me/cardio/history?limit=50'),
        ('weight', '/me/weight/history?limit=50'),
      ];
      final results = await Future.wait(sources.map((source) async {
        try {
          final result = await widget.apiClient.get(source.$2);
          if (widget.localCache != null) {
            await widget.localCache!
                .writeJson('cache.history.${source.$1}', result);
          }
          return result;
        } catch (_) {
          _showingCachedData = true;
          return widget.localCache?.readJson('cache.history.${source.$1}');
        }
      }));

      final hasAnyData = results.any((result) => result != null);
      if (!hasAnyData) {
        throw Exception('No synchronized history is available offline');
      }

      if (mounted) {
        setState(() {
          _workouts = _asList(results[0]);
          _meals = _asList(results[1]);
          _water = _asList(results[2]);
          _cardio = _asList(results[3]);
          _weight = _asList(results[4]);
          _loading = false;
          _errorMessage = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _loading = false;
        });
      }
    }
  }

  List<dynamic> _asList(dynamic response) {
    if (response is List<dynamic>) return response;
    if (response is Map<String, dynamic>) {
      if (response['history'] is List<dynamic>) {
        return response['history'] as List<dynamic>;
      }
      if (response['data'] is List<dynamic>) {
        return response['data'] as List<dynamic>;
      }
      if (response['sessions'] is List<dynamic>) {
        return response['sessions'] as List<dynamic>;
      }
      if (response['logs'] is List<dynamic>) {
        return response['logs'] as List<dynamic>;
      }
    }
    return const [];
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return PremiumScaffold(
      appBar: PremiumAppBar(
        titleText: 'Activity History',
        bottom: PremiumTabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: const [
            Tab(text: 'Workouts'),
            Tab(text: 'Nutrition'),
            Tab(text: 'Hydration'),
            Tab(text: 'Cardio'),
            Tab(text: 'Body Weight'),
          ],
        ),
      ),
      body: _loading
          ? Center(
              child: CircularProgressIndicator(color: colors.primary))
          : _errorMessage != null
              ? ErrorStateWidget(
                  message: _errorMessage!,
                  onRetry: _fetchAllHistory,
                )
              : Column(
                  children: [
                    if (_showingCachedData)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                        color: colors.amberMuted,
                        child: Text(
                          'Offline mode: showing the last synchronized history.',
                          style: TextStyle(
                              color: colors.amber,
                              fontSize: 12,
                              fontWeight: FontWeight.w600),
                        ),
                      ),
                    Expanded(
                      child: PremiumTabView(
                        controller: _tabController,
                        children: [
                          _buildWorkoutList(colors),
                          _buildMealList(colors),
                          _buildWaterList(colors),
                          _buildCardioList(colors),
                          _buildWeightList(colors),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildWorkoutList(AppThemeColors colors) {
    if (_workouts.isEmpty) {
      return const EmptyStateWidget(
        icon: Icons.fitness_center_rounded,
        title: 'No Workouts Logged',
        description: 'You have not recorded any workouts yet.',
      );
    }
    return RefreshIndicator(
      onRefresh: _fetchAllHistory,
      color: colors.primary,
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: _workouts.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, idx) {
          final w = _workouts[idx];
          final name = w['workout_name_snapshot'] as String? ?? 'Workout Session';
          final date =
              (w['session_date'] ?? w['workout_date']) as String? ?? '';
          final exerciseCount = w['exercise_count'] ?? 0;
          final setsCount = w['completed_sets_count'] ?? 0;

          return PremiumCard(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: colors.primaryMuted,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    border: Border.all(
                      color: colors.border,
                      width: 1.0,
                    ),
                  ),
                  child: Icon(
                    Icons.fitness_center_rounded,
                    color: colors.primary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 15,
                                letterSpacing: -0.2,
                                color: colors.textPrimary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 7, vertical: 2.5),
                            decoration: BoxDecoration(
                              color: colors.surfaceElevated,
                              borderRadius:
                                  BorderRadius.circular(AppRadii.sm),
                              border: Border.all(
                                color: colors.border.withValues(alpha: 0.25),
                                width: 1.0,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.calendar_today_rounded,
                                    size: 10, color: colors.textSecondary),
                                const SizedBox(width: 4),
                                Text(
                                  date,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: colors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        children: [
                          StatusBadge(
                            icon: Icon(Icons.fitness_center,
                                size: 12, color: colors.cyan),
                            label: '$exerciseCount exercises',
                            color: colors.cyan,
                          ),
                          StatusBadge(
                            icon: Icon(Icons.check_circle_outline,
                                size: 12, color: colors.primary),
                            label: '$setsCount sets logged',
                            color: colors.primary,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildMealList(AppThemeColors colors) {
    if (_meals.isEmpty) {
      return const EmptyStateWidget(
        icon: Icons.restaurant_rounded,
        title: 'No Meals Logged',
        description: 'No nutrition logs found in your activity history.',
      );
    }
    return RefreshIndicator(
      onRefresh: _fetchAllHistory,
      color: colors.primary,
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: _meals.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, idx) {
          final m = _meals[idx];
          final name = m['meal_name'] as String? ?? 'Nutrition Entry';
          final status = m['status'] as String? ?? 'completed';
          final date = (m['meal_date'] ?? m['entry_date'] ?? '') as String;
          final calories = m['total_calories'];

          return PremiumCard(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: colors.amberMuted,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    border: Border.all(
                      color: colors.border,
                      width: 1.0,
                    ),
                  ),
                  child: Icon(
                    Icons.restaurant_rounded,
                    color: colors.amber,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 15,
                                letterSpacing: -0.2,
                                color: colors.textPrimary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          StatusBadge(
                            label: status.toUpperCase(),
                            color: status == 'completed'
                                ? colors.primary
                                : (status == 'skipped'
                                    ? colors.rose
                                    : colors.amber),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.calendar_today_rounded,
                                  size: 11, color: colors.textSecondary),
                              const SizedBox(width: 4),
                              Text(
                                date,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: colors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                          if (calories != null)
                            StatusBadge(
                              icon: Icon(Icons.local_fire_department_rounded,
                                  size: 12, color: colors.amber),
                              label: '$calories kcal',
                              color: colors.amber,
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildWaterList(AppThemeColors colors) {
    if (_water.isEmpty) {
      return const EmptyStateWidget(
        icon: Icons.water_drop_rounded,
        title: 'No Water Logged',
        description: 'You have not tracked your daily hydration yet.',
      );
    }
    return RefreshIndicator(
      onRefresh: _fetchAllHistory,
      color: colors.primary,
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: _water.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, idx) {
          final entry = _water[idx];
          final totalMl = entry['total_ml'] ?? entry['amount_ml'] ?? 0;
          final date =
              (entry['intake_date'] ?? entry['entry_date'] ?? '') as String;
          final pct = (totalMl / 3000 * 100).clamp(0, 100).toInt();

          return PremiumCard(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: colors.cyanMuted,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    border: Border.all(
                      color: colors.border,
                      width: 1.0,
                    ),
                  ),
                  child: Icon(
                    Icons.water_drop_rounded,
                    color: colors.cyan,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        date,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: colors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$pct% of 3,000 ml target',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                StatusBadge(
                  icon: Icon(Icons.water_drop, size: 12, color: colors.cyan),
                  label: '$totalMl ml',
                  color: colors.cyan,
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildCardioList(AppThemeColors colors) {
    if (_cardio.isEmpty) {
      return const EmptyStateWidget(
        icon: Icons.directions_run_rounded,
        title: 'No Cardio History',
        description: 'You have not recorded any cardio sessions yet.',
      );
    }
    return RefreshIndicator(
      onRefresh: _fetchAllHistory,
      color: colors.primary,
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: _cardio.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, idx) {
          final c = _cardio[idx];
          final activity = c['activity_name'] as String? ?? 'Cardio Session';
          final duration = c['duration_minutes'] ?? 0;
          final date =
              (c['cardio_date'] ?? c['session_date'] ?? '') as String;
          final incline = c['incline'] ?? c['incline_pct'];
          final speed = c['speed_kmh'];

          return PremiumCard(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: colors.cyanMuted,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    border: Border.all(
                      color: colors.border,
                      width: 1.0,
                    ),
                  ),
                  child: Icon(
                    Icons.directions_run_rounded,
                    color: colors.cyan,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              activity.toUpperCase(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 14,
                                letterSpacing: 0.2,
                                color: colors.textPrimary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 7, vertical: 2.5),
                            decoration: BoxDecoration(
                              color: colors.surfaceElevated,
                              borderRadius:
                                  BorderRadius.circular(AppRadii.sm),
                              border: Border.all(
                                color: colors.border.withValues(alpha: 0.25),
                                width: 1.0,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.calendar_today_rounded,
                                    size: 10, color: colors.textSecondary),
                                const SizedBox(width: 4),
                                Text(
                                  date,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: colors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        children: [
                          StatusBadge(
                            icon: Icon(Icons.timer_outlined,
                                size: 12, color: colors.cyan),
                            label: '$duration min',
                            color: colors.cyan,
                          ),
                          if (incline != null)
                            StatusBadge(
                              icon: Icon(Icons.trending_up,
                                  size: 12, color: colors.amber),
                              label: '$incline% incline',
                              color: colors.amber,
                            ),
                          if (speed != null)
                            StatusBadge(
                              icon: Icon(Icons.speed,
                                  size: 12, color: colors.primary),
                              label: '$speed km/h',
                              color: colors.primary,
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildWeightList(AppThemeColors colors) {
    if (_weight.isEmpty) {
      return const EmptyStateWidget(
        icon: Icons.monitor_weight_outlined,
        title: 'No Weight Logged',
        description: 'You have not recorded your morning weigh-in history.',
      );
    }
    return RefreshIndicator(
      onRefresh: _fetchAllHistory,
      color: colors.primary,
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: _weight.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, idx) {
          final w = _weight[idx];
          final kg = w['weight_kg'] ?? w['weightKg'] ?? 0;
          final date =
              (w['date'] ?? w['weigh_in_date'] ?? w['created_at'] ?? '')
                  as String;

          return PremiumCard(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: colors.violetMuted,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    border: Border.all(
                      color: colors.border,
                      width: 1.0,
                    ),
                  ),
                  child: Icon(
                    Icons.monitor_weight_rounded,
                    color: colors.violet,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    date,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: colors.textPrimary,
                    ),
                  ),
                ),
                StatusBadge(
                  icon: Icon(Icons.monitor_weight,
                      size: 12, color: colors.violet),
                  label: '$kg kg',
                  color: colors.violet,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
