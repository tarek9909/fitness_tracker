import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';
import 'diet_plan_builder_screen.dart';

class DietPlansScreen extends StatefulWidget {
  final ApiClient apiClient;

  const DietPlansScreen({super.key, required this.apiClient});

  @override
  State<DietPlansScreen> createState() => _DietPlansScreenState();
}

class _DietPlansScreenState extends State<DietPlansScreen> {
  bool _isLoading = true;
  String? _errorMessage;
  List<dynamic> _plans = [];

  @override
  void initState() {
    super.initState();
    _loadPlans();
  }

  Future<void> _loadPlans() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await widget.apiClient.get('/me/diet-plans');
      if (res is Map<String, dynamic> && res['data'] is List) {
        setState(() {
          _plans = res['data'] as List<dynamic>;
          _isLoading = false;
        });
      } else if (res is List) {
        setState(() {
          _plans = res;
          _isLoading = false;
        });
      } else {
        setState(() {
          _plans = [];
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

  Future<void> _showCreatePlanDialog() async {
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final calCtrl = TextEditingController(text: '2200');
    final proCtrl = TextEditingController(text: '160');
    final carbCtrl = TextEditingController(text: '220');
    final fatCtrl = TextEditingController(text: '65');
    String? error;

    await showPremiumDialog(
      context: context,
      builder: (ctx) {
        final colors = AppThemeColors.of(ctx);
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            return AlertDialog(
              backgroundColor: colors.card,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadii.xl),
                side: BorderSide(color: colors.border),
              ),
              title: Text(
                'Create Diet Plan',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  color: colors.textPrimary,
                ),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    PremiumTextField(
                      label: 'Plan Name',
                      hint: 'e.g. Lean Bulk Nutrition',
                      controller: nameCtrl,
                      errorText: error,
                      onChanged: (_) {
                        if (error != null) setDialogState(() => error = null);
                      },
                    ),
                    const SizedBox(height: 12),
                    PremiumTextField(
                      label: 'Description (optional)',
                      hint: 'e.g. High protein, moderate carb macro split',
                      controller: descCtrl,
                      maxLines: 2,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: PremiumTextField(
                            label: 'Calories (kcal)',
                            controller: calCtrl,
                            keyboardType: TextInputType.number,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: PremiumTextField(
                            label: 'Protein (g)',
                            controller: proCtrl,
                            keyboardType: TextInputType.number,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: PremiumTextField(
                            label: 'Carbs (g)',
                            controller: carbCtrl,
                            keyboardType: TextInputType.number,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: PremiumTextField(
                            label: 'Fats (g)',
                            controller: fatCtrl,
                            keyboardType: TextInputType.number,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              actions: [
                PremiumButton(
                  text: 'Cancel',
                  isSecondary: true,
                  onPressed: () => Navigator.pop(ctx),
                ),
                PremiumButton(
                  text: 'Create Plan',
                  onPressed: () async {
                    final name = nameCtrl.text.trim();
                    if (name.isEmpty) {
                      setDialogState(() => error = 'Plan name is required');
                      return;
                    }
                    Navigator.pop(ctx);
                    try {
                      final cal = int.tryParse(calCtrl.text.trim());
                      final pro = int.tryParse(proCtrl.text.trim());
                      final carb = int.tryParse(carbCtrl.text.trim());
                      final fat = int.tryParse(fatCtrl.text.trim());
                      final payload = <String, dynamic>{
                        'name': name,
                        if (descCtrl.text.trim().isNotEmpty)
                          'description': descCtrl.text.trim(),
                        if (cal != null) 'dailyCaloriesTarget': cal,
                        if (pro != null) 'dailyProteinTargetG': pro,
                        if (carb != null) 'dailyCarbsTargetG': carb,
                        if (fat != null) 'dailyFatTargetG': fat,
                      };
                      await widget.apiClient.post('/me/diet-plans', body: payload);
                      if (mounted) {
                        showPremiumSnackBar(
                            context, 'Diet plan created successfully');
                        _loadPlans();
                      }
                    } catch (e) {
                      if (mounted) {
                        showPremiumSnackBar(
                          context,
                          'Failed to create plan: ${e.toString().replaceAll("Exception: ", "")}',
                          isError: true,
                        );
                      }
                    }
                  },
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return PremiumScaffold(
      appBar: PremiumAppBar(
        title: const Text('My Diet Plans'),
        actions: [
          PremiumIconButton(
            icon: Icons.add,
            color: colors.primary,
            tooltip: 'Create Diet Plan',
            onPressed: _showCreatePlanDialog,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.error_outline, size: 48, color: colors.rose),
                        const SizedBox(height: 16),
                        Text(
                          _errorMessage!,
                          textAlign: TextAlign.center,
                          style: TextStyle(color: colors.textSecondary),
                        ),
                        const SizedBox(height: 16),
                        PremiumButton(
                          text: 'Retry',
                          onPressed: _loadPlans,
                        ),
                      ],
                    ),
                  ),
                )
              : _plans.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.xl),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.restaurant_menu,
                                size: 56, color: colors.textMuted),
                            const SizedBox(height: 16),
                            Text(
                              'No Diet Plans Yet',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: colors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Create personalized meal plans with structured meals, options, and nutrient targets.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 14,
                                color: colors.textSecondary,
                              ),
                            ),
                            const SizedBox(height: 24),
                            PremiumButton(
                              text: 'Create Your First Diet Plan',
                              icon: const Icon(Icons.add, size: 18),
                              onPressed: _showCreatePlanDialog,
                            ),
                          ],
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadPlans,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        itemCount: _plans.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final plan = _plans[index] as Map<String, dynamic>;
                          final planId = plan['id'] as int;
                          final name = plan['name'] as String? ?? 'Diet Plan';
                          final desc = plan['description'] as String?;
                          final isActive = plan['is_active'] == 1 ||
                              plan['isActive'] == true ||
                              plan['active_assignment_id'] != null;
                          final versionStatus =
                              plan['version_status'] ?? plan['status'] ?? 'draft';

                          return PremiumCard(
                            onTap: () async {
                              await Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => DietPlanBuilderScreen(
                                    apiClient: widget.apiClient,
                                    planId: planId,
                                  ),
                                ),
                              );
                              _loadPlans();
                            },
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: isActive
                                        ? colors.primaryMuted
                                        : colors.surfaceElevated,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Icon(
                                    Icons.restaurant,
                                    color: isActive
                                        ? colors.primary
                                        : colors.textSecondary,
                                    size: 24,
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              name,
                                              style: TextStyle(
                                                fontWeight: FontWeight.w700,
                                                fontSize: 16,
                                                color: colors.textPrimary,
                                              ),
                                            ),
                                          ),
                                          if (isActive)
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 8,
                                                      vertical: 3),
                                              decoration: BoxDecoration(
                                                color: colors.primaryMuted,
                                                borderRadius:
                                                    BorderRadius.circular(6),
                                                border: Border.all(
                                                    color: colors.primary
                                                        .withValues(
                                                            alpha: 0.3)),
                                              ),
                                              child: Text(
                                                'ACTIVE',
                                                style: TextStyle(
                                                  fontSize: 10,
                                                  fontWeight:
                                                      FontWeight.w800,
                                                  color: colors.primary,
                                                ),
                                              ),
                                            ),
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      if (desc != null && desc.isNotEmpty)
                                        Text(
                                          desc,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: colors.textSecondary,
                                          ),
                                        ),
                                      const SizedBox(height: 8),
                                      Row(
                                        children: [
                                          Container(
                                            padding:
                                                const EdgeInsets.symmetric(
                                                    horizontal: 6,
                                                    vertical: 2),
                                            decoration: BoxDecoration(
                                              color: colors.surfaceElevated,
                                              borderRadius:
                                                  BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              versionStatus
                                                  .toString()
                                                  .toUpperCase(),
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w600,
                                                color: versionStatus ==
                                                        'published'
                                                    ? colors.cyan
                                                    : colors.amber,
                                              ),
                                            ),
                                          ),
                                          const Spacer(),
                                          Icon(Icons.chevron_right,
                                              size: 18,
                                              color: colors.textMuted),
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
                    ),
    );
  }
}

class DietPlanDetailScreen extends StatefulWidget {
  final ApiClient apiClient;
  final int planId;

  const DietPlanDetailScreen({
    super.key,
    required this.apiClient,
    required this.planId,
  });

  @override
  State<DietPlanDetailScreen> createState() => _DietPlanDetailScreenState();
}

class _DietPlanDetailScreenState extends State<DietPlanDetailScreen> {
  bool _isLoading = true;
  String? _errorMessage;
  Map<String, dynamic>? _plan;

  Map<String, dynamic>? _normalisePlan(Map<String, dynamic>? data) {
    if (data == null) return null;
    final normalized = Map<String, dynamic>.from(data);
    if (normalized['version'] is Map<String, dynamic> ||
        normalized['currentVersion'] is Map<String, dynamic>) {
      return normalized;
    }
    final versions = normalized['versions'] as List<dynamic>? ?? const [];
    Map<String, dynamic>? selected;
    for (final raw in versions) {
      if (raw is! Map) continue;
      final version = Map<String, dynamic>.from(raw);
      selected ??= version;
      if (version['status'] == 'draft') {
        selected = version;
        break;
      }
    }
    normalized['version'] = selected;
    return normalized;
  }

  int? get _currentVersionId {
    final version = _plan?['version'] as Map<String, dynamic>? ??
        _plan?['currentVersion'] as Map<String, dynamic>?;
    final value = version?['id'];
    return value is int ? value : int.tryParse('$value');
  }

  @override
  void initState() {
    super.initState();
    _loadPlanDetails();
  }

  Future<void> _loadPlanDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await widget.apiClient.get('/me/diet-plans/${widget.planId}');
      final data = res is Map<String, dynamic> && res['data'] != null
          ? res['data'] as Map<String, dynamic>
          : (res is Map<String, dynamic> ? res : null);
      var normalized = _normalisePlan(data);
      final versionId = normalized?['version'] is Map
          ? (normalized!['version']['id'] as num?)?.toInt()
          : null;
      if (normalized != null && versionId != null) {
        final versionRes = await widget.apiClient.get(
          '/me/diet-plans/${widget.planId}/versions/$versionId',
        );
        final versionData = versionRes is Map<String, dynamic> && versionRes['data'] is Map
            ? Map<String, dynamic>.from(versionRes['data'] as Map)
            : null;
        if (versionData != null) {
          normalized = {...normalized, 'version': versionData};
        }
      }
      if (!mounted) return;
      setState(() {
        _plan = normalized;
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _activatePlan() async {
    final selectedDate = await _pickEffectiveDate();
    if (selectedDate == null) return;
    try {
      await widget.apiClient.post(
        '/me/diet-plans/${widget.planId}/activate',
        body: {'effectiveFrom': selectedDate},
      );
      if (mounted) {
        showPremiumSnackBar(context, 'Diet plan activated as your current agenda');
        _loadPlanDetails();
      }
    } catch (e) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Activation failed: ${e.toString().replaceAll("Exception: ", "")}',
          isError: true,
        );
      }
    }
  }

  Future<void> _publishVersion() async {
    final versionId = _currentVersionId;
    if (versionId == null) return;
    try {
      await widget.apiClient.post(
          '/me/diet-plans/${widget.planId}/versions/$versionId/publish');
      if (mounted) {
        showPremiumSnackBar(
            context, 'Diet version published! You can now activate this plan.');
        _loadPlanDetails();
      }
    } catch (e) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Publish failed: ${e.toString().replaceAll("Exception: ", "")}',
          isError: true,
        );
      }
    }
  }

  Future<String?> _pickEffectiveDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: DateTime(now.year + 5),
    );
    if (picked == null) return null;
    String two(int value) => value.toString().padLeft(2, '0');
    return '${picked.year}-${two(picked.month)}-${two(picked.day)}';
  }

  Future<void> _clonePlan() async {
    try {
      final res =
          await widget.apiClient.post('/me/diet-plans/${widget.planId}/clone');
      final clonedId = res is Map<String, dynamic> && res['data'] != null
          ? res['data']['id']
          : null;
      if (mounted) {
        showPremiumSnackBar(context, 'Diet plan cloned to a new draft copy');
        if (clonedId != null) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => DietPlanDetailScreen(
                apiClient: widget.apiClient,
                planId: clonedId as int,
              ),
            ),
          );
        } else {
          Navigator.pop(context);
        }
      }
    } catch (e) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Cloning failed: ${e.toString().replaceAll("Exception: ", "")}',
          isError: true,
        );
      }
    }
  }

  Future<void> _showAddMealDialog() async {
    final nameCtrl = TextEditingController();
    final timeCtrl = TextEditingController(text: '08:00');

    await showPremiumDialog(
      context: context,
      builder: (ctx) {
        final colors = AppThemeColors.of(ctx);
        return AlertDialog(
          backgroundColor: colors.card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.xl),
            side: BorderSide(color: colors.border),
          ),
          title: Text(
            'Add Meal to Plan',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 18,
              color: colors.textPrimary,
            ),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              PremiumTextField(
                label: 'Meal Name',
                hint: 'e.g. Breakfast, Post-Workout',
                controller: nameCtrl,
              ),
              const SizedBox(height: 12),
              PremiumTextField(
                label: 'Suggested Time (HH:MM)',
                controller: timeCtrl,
              ),
            ],
          ),
          actions: [
            PremiumButton(
              text: 'Cancel',
              isSecondary: true,
              onPressed: () => Navigator.pop(ctx),
            ),
            PremiumButton(
              text: 'Add Meal',
              onPressed: () async {
                final name = nameCtrl.text.trim();
                if (name.isEmpty) return;
                Navigator.pop(ctx);
                try {
                  final versionId = _currentVersionId;
                  if (versionId == null) return;
                  final payload = <String, dynamic>{
                    'name': name,
                    if (timeCtrl.text.trim().isNotEmpty)
                      'scheduledTime': timeCtrl.text.trim(),
                  };
                  await widget.apiClient.post(
                    '/me/diet-plans/${widget.planId}/versions/$versionId/meals',
                    body: payload,
                  );
                  if (mounted) {
                    showPremiumSnackBar(context, 'Meal added to diet plan');
                    _loadPlanDetails();
                  }
                } catch (e) {
                  if (mounted) {
                    showPremiumSnackBar(
                      context,
                      'Failed to add meal: ${e.toString().replaceAll("Exception: ", "")}',
                      isError: true,
                    );
                  }
                }
              },
            ),
          ],
        );
      },
    );
  }

  Future<void> _showAddOptionGroupDialog(int mealId) async {
    final nameCtrl = TextEditingController(text: 'Primary Food Option');

    await showPremiumDialog(
      context: context,
      builder: (ctx) {
        final colors = AppThemeColors.of(ctx);
        return AlertDialog(
          backgroundColor: colors.card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.xl),
            side: BorderSide(color: colors.border),
          ),
          title: Text(
            'Add Option Group',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 18,
              color: colors.textPrimary,
            ),
          ),
          content: PremiumTextField(
            label: 'Group Name',
            hint: 'e.g. Protein Source, Carbs',
            controller: nameCtrl,
          ),
          actions: [
            PremiumButton(
              text: 'Cancel',
              isSecondary: true,
              onPressed: () => Navigator.pop(ctx),
            ),
            PremiumButton(
              text: 'Add Group',
              onPressed: () async {
                final name = nameCtrl.text.trim();
                if (name.isEmpty) return;
                Navigator.pop(ctx);
                try {
                  await widget.apiClient.post(
                    '/me/diet-plans/${widget.planId}/meals/$mealId/groups',
                    body: {
                      'name': name,
                      'isRequired': false,
                      'minSelections': 0,
                      'maxSelections': 1,
                    },
                  );
                  if (mounted) {
                    showPremiumSnackBar(context, 'Option group added');
                    _loadPlanDetails();
                  }
                } catch (e) {
                  if (mounted) {
                    showPremiumSnackBar(
                      context,
                      'Failed to add group: ${e.toString().replaceAll("Exception: ", "")}',
                      isError: true,
                    );
                  }
                }
              },
            ),
          ],
        );
      },
    );
  }

  Future<void> _showAddFoodOptionDialog(int groupId) async {
    List<dynamic> foodCatalog = [];
    bool loadingFoods = true;
    int? selectedFoodId;
    final portionCtrl = TextEditingController(text: '100');

    try {
      final res = await widget.apiClient.get('/foods');
      if (res is Map<String, dynamic> && res['data'] is List) {
        foodCatalog = res['data'] as List<dynamic>;
      } else if (res is List) {
        foodCatalog = res;
      }
      loadingFoods = false;
      if (foodCatalog.isNotEmpty) {
        selectedFoodId = foodCatalog.first['id'] as int;
      }
    } catch (_) {
      loadingFoods = false;
    }

    if (!mounted) return;

    await showPremiumDialog(
      context: context,
      builder: (ctx) {
        final colors = AppThemeColors.of(ctx);
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            return AlertDialog(
              backgroundColor: colors.card,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadii.xl),
                side: BorderSide(color: colors.border),
              ),
              title: Text(
                'Add Food Option',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  color: colors.textPrimary,
                ),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (loadingFoods)
                      const Padding(
                        padding: EdgeInsets.all(16),
                        child: CircularProgressIndicator(),
                      )
                    else if (foodCatalog.isEmpty)
                      Text('No foods available in catalog.',
                          style: TextStyle(color: colors.textSecondary))
                    else
                      DropdownButtonFormField<int>(
                        initialValue: selectedFoodId,
                        dropdownColor: colors.surfaceElevated,
                        isExpanded: true,
                        decoration: InputDecoration(
                          labelText: 'Select Food',
                          labelStyle: TextStyle(color: colors.textSecondary),
                          filled: true,
                          fillColor: colors.surfaceElevated,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadii.lg),
                            borderSide: BorderSide(color: colors.border),
                          ),
                        ),
                        items: foodCatalog.map((food) {
                          return DropdownMenuItem<int>(
                            value: food['id'] as int,
                            child: Text(
                              food['name'] as String? ?? 'Food',
                              style: TextStyle(color: colors.textPrimary),
                            ),
                          );
                        }).toList(),
                        onChanged: (val) {
                          setDialogState(() => selectedFoodId = val);
                        },
                      ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: PremiumTextField(
                            label: 'Portion',
                            controller: portionCtrl,
                            keyboardType: TextInputType.number,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              actions: [
                PremiumButton(
                  text: 'Cancel',
                  isSecondary: true,
                  onPressed: () => Navigator.pop(ctx),
                ),
                PremiumButton(
                  text: 'Add Food',
                  onPressed: () async {
                    if (selectedFoodId == null) return;
                    final portion =
                        double.tryParse(portionCtrl.text.trim()) ?? 100.0;
                    final selectedFood = foodCatalog.cast<dynamic>().firstWhere(
                      (food) => food is Map && food['id'] == selectedFoodId,
                      orElse: () => null,
                    );
                    final servingUnitId = selectedFood is Map
                        ? selectedFood['measurement_unit_id'] as int?
                        : null;

                    Navigator.pop(ctx);
                    try {
                      await widget.apiClient.post(
                        '/me/diet-plans/${widget.planId}/option-groups/$groupId/options',
                        body: {
                          'foodId': selectedFoodId,
                          'servingQuantity': portion,
                          if (servingUnitId != null) 'servingUnitId': servingUnitId,
                        },
                      );
                      if (mounted) {
                        showPremiumSnackBar(context, 'Food option added');
                        _loadPlanDetails();
                      }
                    } catch (e) {
                      if (mounted) {
                        showPremiumSnackBar(
                          context,
                          'Failed to add food: ${e.toString().replaceAll("Exception: ", "")}',
                          isError: true,
                        );
                      }
                    }
                  },
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    if (_isLoading) {
      return const PremiumScaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_errorMessage != null || _plan == null) {
      return PremiumScaffold(
        appBar: const PremiumAppBar(title: Text('Diet Plan Details')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(_errorMessage ?? 'Plan not found',
                  style: TextStyle(color: colors.rose)),
              const SizedBox(height: 12),
              PremiumButton(text: 'Retry', onPressed: _loadPlanDetails),
            ],
          ),
        ),
      );
    }

    final planName = _plan!['name'] as String? ?? 'Diet Plan';
    final desc = _plan!['description'] as String?;
    final version = _plan!['version'] as Map<String, dynamic>? ??
        _plan!['currentVersion'] as Map<String, dynamic>?;
    final versionStatus = version?['status'] as String? ?? 'draft';
    final isDraft = versionStatus == 'draft';
    final meals = (version?['meals'] as List<dynamic>?) ?? [];

    return PremiumScaffold(
      appBar: PremiumAppBar(
        title: Text(planName),
        actions: [
          PopupMenuButton<String>(
            icon: Icon(Icons.more_vert, color: colors.textPrimary),
            color: colors.surfaceElevated,
            onSelected: (val) {
              if (val == 'clone') _clonePlan();
              if (val == 'publish') _publishVersion();
              if (val == 'activate') _activatePlan();
            },
            itemBuilder: (ctx) => [
              if (isDraft)
                const PopupMenuItem(
                  value: 'publish',
                  child: Text('Publish Version'),
                ),
              if (!isDraft)
                const PopupMenuItem(
                  value: 'activate',
                  child: Text('Activate Plan'),
                ),
              const PopupMenuItem(
                value: 'clone',
                child: Text('Clone as New Draft'),
              ),
            ],
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          PremiumCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: isDraft ? colors.amberMuted : colors.cyanMuted,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        versionStatus.toUpperCase(),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: isDraft ? colors.amber : colors.cyan,
                        ),
                      ),
                    ),
                    if (isDraft)
                      PremiumButton(
                        text: 'Publish',
                        height: 32,
                        onPressed: _publishVersion,
                      )
                    else
                      PremiumButton(
                        text: 'Activate',
                        height: 32,
                        onPressed: _activatePlan,
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  planName,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: colors.textPrimary,
                  ),
                ),
                if (desc != null && desc.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(desc, style: TextStyle(color: colors.textSecondary)),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'MEALS (${meals.length})',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                  color: colors.textSecondary,
                ),
              ),
              if (isDraft)
                TextButton.icon(
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Add Meal'),
                  onPressed: _showAddMealDialog,
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (meals.isEmpty)
            PremiumCard(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Column(
                    children: [
                      Icon(Icons.restaurant_outlined,
                          size: 36, color: colors.textMuted),
                      const SizedBox(height: 8),
                      Text(
                        'No meals added to this diet plan yet.',
                        style: TextStyle(color: colors.textSecondary),
                      ),
                      if (isDraft) ...[
                        const SizedBox(height: 12),
                        PremiumButton(
                          text: 'Add Meal',
                          isSecondary: true,
                          onPressed: _showAddMealDialog,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            )
          else
            ...meals.map((meal) {
              final mealMap = meal as Map<String, dynamic>;
              final mealId = mealMap['id'] as int;
              final mealName = mealMap['name'] as String? ?? 'Meal';
              final time = mealMap['meal_time'] ?? mealMap['mealTime'];
              final calories =
                  mealMap['target_calories'] ?? mealMap['targetCalories'];
              final optionGroups =
                  (mealMap['option_groups'] as List<dynamic>?) ?? [];

              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: PremiumCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                mealName,
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: colors.textPrimary,
                                ),
                              ),
                              if (time != null || calories != null)
                                Text(
                                  '${time != null ? "$time • " : ""}${calories != null ? "$calories kcal" : ""}',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: colors.textSecondary,
                                  ),
                                ),
                            ],
                          ),
                          if (isDraft)
                            TextButton.icon(
                              icon: const Icon(Icons.add, size: 14),
                              label: const Text('Add Group'),
                              onPressed: () => _showAddOptionGroupDialog(mealId),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (optionGroups.isEmpty)
                        Text(
                          'No option groups configured.',
                          style: TextStyle(
                            fontSize: 12,
                            color: colors.textMuted,
                          ),
                        )
                      else
                        ...optionGroups.map((group) {
                          final groupMap = group as Map<String, dynamic>;
                          final groupId = groupMap['id'] as int;
                          final groupName =
                              groupMap['name'] as String? ?? 'Group';
                          final options =
                              (groupMap['options'] as List<dynamic>?) ?? [];

                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: colors.surfaceElevated,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: colors.border),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      groupName,
                                      style: TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13,
                                        color: colors.cyan,
                                      ),
                                    ),
                                    if (isDraft)
                                      InkWell(
                                        onTap: () =>
                                            _showAddFoodOptionDialog(groupId),
                                        child: Padding(
                                          padding: const EdgeInsets.all(4),
                                          child: Row(
                                            children: [
                                              Icon(Icons.add,
                                                  size: 14, color: colors.primary),
                                              const SizedBox(width: 2),
                                              Text(
                                                'Add Food',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w600,
                                                  color: colors.primary,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                if (options.isEmpty)
                                  Text(
                                    'No foods added to group.',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: colors.textMuted,
                                    ),
                                  )
                                else
                                  ...options.map((opt) {
                                    final optMap = opt as Map<String, dynamic>;
                                    final foodName = optMap['food_name'] ??
                                        optMap['name'] ??
                                        'Food';
                                    final portion = optMap['portion_amount'] ??
                                        optMap['serving_amount'] ??
                                        100;
                                    final unit = optMap['portion_unit'] ??
                                        optMap['serving_unit'] ??
                                        'g';

                                    return Padding(
                                      padding:
                                          const EdgeInsets.symmetric(vertical: 2),
                                      child: Row(
                                        children: [
                                          Icon(Icons.circle,
                                              size: 6,
                                              color: colors.textSecondary),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: Text(
                                              '$foodName ($portion $unit)',
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: colors.textPrimary,
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
                        }),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
