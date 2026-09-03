import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';

class ProgressScreen extends StatefulWidget {
  final ApiClient apiClient;

  const ProgressScreen({super.key, required this.apiClient});

  @override
  State<ProgressScreen> createState() => _ProgressScreenState();
}

class _ProgressScreenState extends State<ProgressScreen> {
  Map<String, dynamic>? _progress;
  bool _isLoading = true;
  String? _errorMessage;

  Future<void> _fetchProgress() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final res = await widget.apiClient.get('/me/progress');
      if (mounted) {
        setState(() {
          _progress = res is Map<String, dynamic> ? res : null;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _fetchProgress();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    if (_isLoading) {
      return PremiumScaffold(
        body:
            Center(child: CircularProgressIndicator(color: colors.primary)),
      );
    }

    if (_errorMessage != null) {
      return PremiumScaffold(
        appBar: const PremiumAppBar(
          titleText: 'Progress & Analytics',
        ),
        body: ErrorStateWidget(
          message: _errorMessage!,
          onRetry: _fetchProgress,
        ),
      );
    }

    final workouts = _progress?['workouts'];
    final cardio = _progress?['cardio'];
    final weight = _progress?['weight'];

    return PremiumScaffold(
      appBar: const PremiumAppBar(
        titleText: 'Progress & Analytics',
      ),
      body: RefreshIndicator(
        onRefresh: _fetchProgress,
        color: colors.primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SectionHeader(
                title: 'Performance Overview',
                subtitle: 'Aggregated analytics across training disciplines',
              ),
              const SizedBox(height: 8),

              // KPI Row
              Row(
                children: [
                  Expanded(
                    child: MetricCard(
                      title: 'Workouts',
                      value: '${workouts?['completedSessions'] ?? 0}',
                      subtitle: '${workouts?['totalSets'] ?? 0} working sets',
                      icon: Icons.fitness_center,
                      accentColor: colors.cyan,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: MetricCard(
                      title: 'Cardio',
                      value: '${cardio?['totalMinutes'] ?? 0}m',
                      subtitle: '${cardio?['totalCalories'] ?? 0} kcal burned',
                      icon: Icons.directions_run,
                      accentColor: colors.amber,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Detailed Workout Volume Card
              PremiumCard(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.fitness_center,
                                color: colors.cyan, size: 18),
                            const SizedBox(width: 8),
                            Text('RESISTANCE TRAINING',
                                style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 12,
                                    letterSpacing: 0.5,
                                    color: colors.cyan)),
                          ],
                        ),
                        StatusBadge(
                          label:
                              '${workouts?['completedSessions'] ?? 0} Sessions',
                          color: colors.cyan,
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text(
                      '${workouts?['completedSessions'] ?? 0} Workouts Completed',
                      style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: colors.textPrimary),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${workouts?['totalSets'] ?? 0} completed working sets tracked across all muscle groups',
                      style: TextStyle(
                          color: colors.textSecondary, fontSize: 13),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // Detailed Cardio Card
              PremiumCard(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.directions_run,
                                color: colors.amber, size: 18),
                            const SizedBox(width: 8),
                            Text('CARDIO CONDITIONING',
                                style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 12,
                                    letterSpacing: 0.5,
                                    color: colors.amber)),
                          ],
                        ),
                        StatusBadge(
                          label: '${cardio?['totalMinutes'] ?? 0} min',
                          color: colors.amber,
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text(
                      '${cardio?['totalMinutes'] ?? 0} Total Cardio Minutes',
                      style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: colors.textPrimary),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${cardio?['totalCalories'] ?? 0} active kcal burned across logged sessions',
                      style: TextStyle(
                          color: colors.textSecondary, fontSize: 13),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // Detailed Weight Card
              if (weight != null)
                PremiumCard(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.trending_down,
                                  color: colors.primary, size: 18),
                              const SizedBox(width: 8),
                              Text('BODY COMPOSITION',
                                  style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 12,
                                      letterSpacing: 0.5,
                                      color: colors.primary)),
                            ],
                          ),
                          StatusBadge(
                            label: weight['currentWeightKg'] != null
                                ? '${weight['currentWeightKg']} kg'
                                : 'Pending',
                            color: colors.primary,
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Text(
                        weight['currentWeightKg'] != null
                            ? '${weight['currentWeightKg']} kg Current'
                            : 'No Weight Logged',
                        style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: colors.textPrimary),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        weight['targetWeightKg'] != null
                            ? 'Goal: ${weight['targetWeightKg']} kg (${weight['weightLostKg'] ?? 0} kg total delta)'
                            : 'No target body weight goal currently assigned',
                        style: TextStyle(
                            color: colors.textSecondary, fontSize: 13),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
