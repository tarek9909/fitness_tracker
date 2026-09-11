import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/meal_time_validator.dart';
import '../../core/widgets/premium_widgets.dart';
import 'meal_quick_log_sheet.dart';
import 'diet_plans_screen.dart';

import '../../core/storage/local_cache.dart';

class MealsTabScreen extends StatefulWidget {
  final ApiClient apiClient;
  final LocalCache? localCache;

  const MealsTabScreen({
    super.key,
    required this.apiClient,
    this.localCache,
  });

  @override
  State<MealsTabScreen> createState() => _MealsTabScreenState();
}

class _MealsTabScreenState extends State<MealsTabScreen> {
  bool _isLoading = true;
  String? _errorMessage;
  Map<String, dynamic>? _todayPlan;

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
      final res = await widget.apiClient.get('/me/today');
      if (widget.localCache != null && res != null) {
        await widget.localCache!.writeJson('meals_tab_today_plan', res);
      }

      if (mounted) {
        setState(() {
          _todayPlan = res is Map<String, dynamic>
              ? (res['data'] is Map<String, dynamic>
                  ? res['data'] as Map<String, dynamic>
                  : res)
              : null;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (widget.localCache != null) {
        final cached = await widget.localCache!.readJson('meals_tab_today_plan');
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
        titleText: 'Nutrition & Meals',
        actions: [
          PremiumIconButton(
            icon: Icons.menu_book_outlined,
            color: colors.primary,
            tooltip: 'Diet Plans',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => DietPlansScreen(apiClient: widget.apiClient),
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
                          title: 'Unable to load meals',
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
                        _buildMacroOverviewCard(colors),
                        const SizedBox(height: 16),
                        _buildMealsList(colors),
                        const SizedBox(height: 20),
                        _buildQuickActions(colors),
                      ],
                    ),
            ),
    );
  }

  Widget _buildMacroOverviewCard(AppThemeColors colors) {
    final diet = _todayPlan?['diet'] as Map<String, dynamic>? ?? {};
    final targetCalories = diet['targetCalories'] ?? diet['target_calories'] ?? 2000;
    final meals = (diet['meals'] as List<dynamic>? ?? []);

    int consumedCalories = 0;
    int consumedProtein = 0;

    for (final m in meals) {
      final log = m['log'] as Map<String, dynamic>?;
      if (log != null && log['status'] == 'completed') {
        consumedCalories += (log['calories'] as num? ?? m['target_calories'] as num? ?? 0).toInt();
        consumedProtein += (log['protein_g'] as num? ?? m['target_protein_g'] as num? ?? 0).toInt();
      }
    }

    final double progress = targetCalories > 0
        ? (consumedCalories / targetCalories).clamp(0.0, 1.0)
        : 0.0;

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
                  'DAILY NUTRITION TARGET',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                    color: colors.textSecondary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              StatusBadge(
                label: '$consumedCalories / $targetCalories kcal',
                color: const Color(0xFF10B981),
              ),
            ],
          ),
          const SizedBox(height: 12),
          PremiumProgressBar(
            value: progress,
            height: 8,
            color: const Color(0xFF10B981),
            backgroundColor: colors.surfaceElevated,
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _buildMacroMiniStat(
                  label: 'Calories',
                  value: '$consumedCalories kcal',
                  color: const Color(0xFF10B981),
                  colors: colors,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMacroMiniStat(
                  label: 'Protein',
                  value: '${consumedProtein}g',
                  color: colors.primary,
                  colors: colors,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMacroMiniStat(
                  label: 'Target',
                  value: '$targetCalories kcal',
                  color: colors.amber,
                  colors: colors,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMacroMiniStat({
    required String label,
    required String value,
    required Color color,
    required AppThemeColors colors,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        borderRadius: BorderRadius.circular(AppRadii.sm),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(fontSize: 10, color: colors.textMuted),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMealsList(AppThemeColors colors) {
    final diet = _todayPlan?['diet'] as Map<String, dynamic>? ?? {};
    final meals = (diet['meals'] as List<dynamic>? ?? []);

    if (meals.isEmpty) {
      return PremiumCard(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            Icon(Icons.restaurant_outlined, size: 40, color: colors.textMuted),
            const SizedBox(height: 12),
            Text(
              'No Meals Prescribed Today',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: colors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Assign or build a diet plan to structure your daily nutrition.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: colors.textSecondary),
            ),
            const SizedBox(height: 16),
            PremiumButton(
              text: 'View Diet Plans',
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => DietPlansScreen(apiClient: widget.apiClient),
                  ),
                ).then((_) => _loadData());
              },
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                'SCHEDULED MEALS',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                  color: colors.textSecondary,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${meals.length} Meals',
              style: TextStyle(fontSize: 11, color: colors.textMuted),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ...meals.map((meal) {
          final m = meal as Map<String, dynamic>;
          final name = m['name'] as String? ?? 'Meal';
          final log = m['log'] as Map<String, dynamic>?;
          final isLogged = log != null && log['status'] == 'completed';
          final calories = m['target_calories'] ?? m['targetCalories'];
          final time = m['scheduled_time'] ?? m['scheduledTime'];
          final timeValidation = MealTimeValidator.validate(m);

          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: PremiumCard(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: isLogged ? const Color(0x2610B981) : colors.surfaceElevated,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      isLogged ? Icons.check : Icons.restaurant,
                      size: 18,
                      color: isLogged ? const Color(0xFF10B981) : colors.textSecondary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: colors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: 6,
                          runSpacing: 3,
                          children: [
                            if (calories != null)
                              Text(
                                '$calories kcal',
                                style: TextStyle(fontSize: 11, color: colors.textMuted),
                              ),
                            if (!isLogged)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                decoration: BoxDecoration(
                                  color: timeValidation.isOnTime
                                      ? const Color(0x2610B981)
                                      : (timeValidation.isEarly
                                          ? colors.amber.withValues(alpha: 0.15)
                                          : colors.rose.withValues(alpha: 0.15)),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  timeValidation.isOnTime
                                      ? 'On Time'
                                      : (timeValidation.isEarly
                                          ? 'Early (${timeValidation.formattedScheduledTime})'
                                          : 'Delayed (${timeValidation.formattedScheduledTime})'),
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: timeValidation.isOnTime
                                        ? const Color(0xFF10B981)
                                        : (timeValidation.isEarly ? colors.amber : colors.rose),
                                  ),
                                ),
                              )
                            else if (time != null)
                              Text(
                                '$time',
                                style: TextStyle(fontSize: 11, color: colors.textMuted),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  PremiumButton(
                    text: isLogged ? 'Edit' : 'Log Food',
                    isSecondary: isLogged,
                    onPressed: () async {
                      await showMealQuickLogSheet(
                        context: context,
                        apiClient: widget.apiClient,
                        meal: m,
                        onLogged: _loadData,
                      );
                    },
                    height: 34,
                  ),
                ],
              ),
            ),
          );
        }),
      ],
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
                    builder: (_) => DietPlansScreen(apiClient: widget.apiClient),
                  ),
                ).then((_) => _loadData());
              },
              child: Row(
                children: [
                  Icon(Icons.menu_book, color: colors.primary, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Diet Plans',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: colors.textPrimary,
                          ),
                        ),
                        Text(
                          'View nutritional regimens',
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
