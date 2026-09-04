import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/meal_time_validator.dart';
import '../../core/widgets/premium_widgets.dart';

/// Opens the Meal Quick Log Bottom Sheet, designed to feel instant, sleek, and lightweight.
Future<bool?> showMealQuickLogSheet({
  required BuildContext context,
  required ApiClient apiClient,
  required Map<String, dynamic> meal,
  VoidCallback? onLogged,
}) {
  final colors = AppThemeColors.of(context);

  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    sheetAnimationStyle: const AnimationStyle(
      duration: Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    ),
    backgroundColor: colors.card,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.lg)),
    ),
    builder: (ctx) => MealQuickLogSheet(
      apiClient: apiClient,
      meal: meal,
      onLogged: onLogged,
    ),
  );
}

class MealQuickLogSheet extends StatefulWidget {
  final ApiClient apiClient;
  final Map<String, dynamic> meal;
  final VoidCallback? onLogged;

  const MealQuickLogSheet({
    super.key,
    required this.apiClient,
    required this.meal,
    this.onLogged,
  });

  @override
  State<MealQuickLogSheet> createState() => _MealQuickLogSheetState();
}

class _MealQuickLogSheetState extends State<MealQuickLogSheet> {
  final Map<int, Set<int>> _selectedOptions = {}; // groupId -> Set of optionId
  final List<Map<String, dynamic>> _customFoods = [];
  final _notesController = TextEditingController();
  final _customNameController = TextEditingController();
  final _customPortionController = TextEditingController();
  final _customCaloriesController = TextEditingController();
  final _customProteinController = TextEditingController();
  bool _isAddingCustomFood = false;
  String _status = 'completed';
  bool _isSubmitting = false;
  String? _validationError;
  bool _showNotesField = false;

  @override
  void initState() {
    super.initState();
    final log = widget.meal['log'];

    if (log is Map<String, dynamic>) {
      _status = log['status'] as String? ?? 'completed';
      if (log['notes'] != null && log['notes'].toString().trim().isNotEmpty) {
        _notesController.text = log['notes'].toString().trim();
        _showNotesField = true;
      }
      final selections = log['selections'] as List<dynamic>? ?? [];
      for (final s in selections) {
        if (s is Map) {
          final gId = s['diet_meal_option_group_id'] ??
              s['optionGroupId'] ??
              s['option_group_id'];
          final oId =
              s['diet_meal_option_id'] ?? s['optionId'] ?? s['option_id'];
          if (gId is int && oId is int) {
            _selectedOptions.putIfAbsent(gId, () => {}).add(oId);
          } else if (oId == null || s['group_name_snapshot'] == 'Custom Food') {
            final name = s['option_label_snapshot'] ?? s['name'];
            if (name != null) {
              _customFoods.add({
                'name': name.toString(),
                'servingSize': s['unit_code_snapshot'] ?? s['servingSize'],
                'calories': s['calories_snapshot'] ?? s['calories'],
                'proteinG': s['protein_g_snapshot'] ?? s['proteinG'],
              });
            }
          }
        }
      }
      final customList = log['customFoods'] as List<dynamic>? ?? [];
      for (final cf in customList) {
        if (cf is Map) {
          _customFoods.add(Map<String, dynamic>.from(cf));
        }
      }
    }
  }

  @override
  void dispose() {
    _notesController.dispose();
    _customNameController.dispose();
    _customPortionController.dispose();
    _customCaloriesController.dispose();
    _customProteinController.dispose();
    super.dispose();
  }

  Future<void> _submitMealLog() async {
    setState(() {
      _validationError = null;
    });

    // Time validation: Present override confirmation if entered before or after scheduled window
    bool timeOverridden = false;
    if (_status != 'skipped') {
      final timeValidation = MealTimeValidator.validate(widget.meal);
      if (timeValidation.isOutOfWindow) {
        final confirmed = await showMealTimeOverrideDialog(
          context: context,
          meal: widget.meal,
          validation: timeValidation,
        );
        if (confirmed != true) {
          return;
        }
        timeOverridden = true;
      }
    }

    setState(() => _isSubmitting = true);
    try {
      final selections = <Map<String, dynamic>>[];
      if (_status != 'skipped') {
        for (final entry in _selectedOptions.entries) {
          for (final optId in entry.value) {
            selections.add({
              'optionGroupId': entry.key,
              'optionId': optId,
            });
          }
        }
      }

      final payload = <String, dynamic>{
        'status': _status,
        'selections': selections,
        if (_customFoods.isNotEmpty) 'customFoods': _customFoods,
        if (_notesController.text.trim().isNotEmpty)
          'notes': _notesController.text.trim(),
        if (timeOverridden) 'timeOverride': true,
      };

      final mealId = widget.meal['id'];
      await widget.apiClient.put(
        '/me/meals/$mealId/log',
        body: payload,
      );

      if (mounted) {
        showPremiumSnackBar(
          context,
          timeOverridden
              ? '${widget.meal['name'] ?? 'Meal'} logged with time override'
              : '${widget.meal['name'] ?? 'Meal'} logged successfully!',
          isSuccess: true,
        );
        widget.onLogged?.call();
        Navigator.pop(context, true);
      }
    } on OfflineOperationQueued catch (_) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Meal log saved offline. Will sync when online.',
        );
        widget.onLogged?.call();
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        showPremiumSnackBar(
          context,
          'Failed to log meal: $e',
          isError: true,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final groups = (widget.meal['optionGroups'] as List<dynamic>? ?? []);
    final mealName = widget.meal['name']?.toString() ?? 'Meal';
    final timeValidation = MealTimeValidator.validate(widget.meal);
    final calories = widget.meal['calories'];
    final protein = widget.meal['protein_g'] ?? widget.meal['protein'];

    num totalDisplayCalories = 0;
    num totalDisplayProtein = 0;
    bool hasActiveSelections = false;

    for (final g in groups) {
      if (g is Map) {
        final gId = g['id'];
        final selectedSet = _selectedOptions[gId] ?? {};
        final opts = (g['options'] as List<dynamic>? ?? []);
        for (final opt in opts) {
          if (opt is Map && selectedSet.contains(opt['id'])) {
            totalDisplayCalories += (opt['calories'] as num? ?? 0);
            totalDisplayProtein += (opt['protein_g'] as num? ?? opt['protein'] as num? ?? 0);
            hasActiveSelections = true;
          }
        }
      }
    }
    for (final cf in _customFoods) {
      totalDisplayCalories += (cf['calories'] as num? ?? 0);
      totalDisplayProtein += (cf['proteinG'] as num? ?? cf['protein_g'] as num? ?? 0);
      hasActiveSelections = true;
    }
    if (!hasActiveSelections) {
      totalDisplayCalories = calories != null ? (calories as num) : 0;
      totalDisplayProtein = protein != null ? (protein as num) : 0;
    }

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.88,
      ),
      padding: EdgeInsets.only(
        left: AppSpacing.lg,
        right: AppSpacing.lg,
        top: AppSpacing.md,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.lg,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Drag handle
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: colors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Sheet Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: colors.amber.withValues(alpha: 0.15),
                        ),
                        child: Icon(
                          Icons.restaurant,
                          color: colors.amber,
                          size: 18,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              mealName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: colors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: timeValidation.isOnTime
                                    ? const Color(0x2610B981)
                                    : (timeValidation.isEarly
                                        ? colors.amber.withValues(alpha: 0.15)
                                        : colors.rose.withValues(alpha: 0.15)),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: timeValidation.isOnTime
                                      ? const Color(0x4D10B981)
                                      : (timeValidation.isEarly
                                          ? colors.amber.withValues(alpha: 0.3)
                                          : colors.rose.withValues(alpha: 0.3)),
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    timeValidation.isOnTime
                                        ? Icons.check_circle_outline
                                        : (timeValidation.isEarly
                                            ? Icons.schedule
                                            : Icons.timelapse),
                                    size: 11,
                                    color: timeValidation.isOnTime
                                        ? const Color(0xFF10B981)
                                        : (timeValidation.isEarly ? colors.amber : colors.rose),
                                  ),
                                  const SizedBox(width: 4),
                                  Flexible(
                                    child: Text(
                                      timeValidation.isOnTime
                                          ? 'On Schedule (${timeValidation.formattedWindow})'
                                          : (timeValidation.isEarly
                                              ? 'Early • Scheduled ${timeValidation.formattedScheduledTime}'
                                              : 'Delayed • Scheduled ${timeValidation.formattedScheduledTime}'),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: timeValidation.isOnTime
                                            ? const Color(0xFF10B981)
                                            : (timeValidation.isEarly ? colors.amber : colors.rose),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (totalDisplayCalories > 0 || totalDisplayProtein > 0 || calories != null || protein != null)
                  StatusBadge(
                    label: [
                      if (totalDisplayCalories > 0 || calories != null) '$totalDisplayCalories kcal',
                      if (totalDisplayProtein > 0 || protein != null) '${totalDisplayProtein}g P',
                    ].join(' • '),
                    color: colors.primary,
                  ),
              ],
            ),
            const SizedBox(height: 16),

            // Status Selector Segment
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: colors.surfaceElevated,
                borderRadius: BorderRadius.circular(AppRadii.md),
                border: Border.all(color: colors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _buildStatusTab(
                      value: 'completed',
                      label: 'Completed',
                      icon: Icons.check_circle_outline,
                      colors: colors,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: _buildStatusTab(
                      value: 'partial',
                      label: 'Partial',
                      icon: Icons.incomplete_circle,
                      colors: colors,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: _buildStatusTab(
                      value: 'skipped',
                      label: 'Skipped',
                      icon: Icons.cancel_outlined,
                      colors: colors,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            if (_validationError != null)
              Container(
                padding: const EdgeInsets.all(10),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: colors.roseMuted,
                  border: Border.all(color: colors.rose.withValues(alpha: 0.3)),
                  borderRadius: BorderRadius.circular(AppRadii.md),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: colors.rose, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _validationError!,
                        style: TextStyle(
                          color: colors.rose,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            // Food selection when not skipped
            if (_status != 'skipped') ...[
              if (groups.isNotEmpty) ...[
                ...groups.map((group) {
                  final gId = group['id'] as int;
                  final gName = group['name'] as String? ?? 'Food Choice';
                  final maxSelections = (group['max_selections'] ??
                      group['maxSelections'] ??
                      1) as int;
                  final isMulti = maxSelections > 1;
                  final opts = (group['options'] as List<dynamic>? ?? []);
                  final selectedSet = _selectedOptions[gId] ?? {};

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: colors.surfaceElevated,
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      border: Border.all(color: colors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                gName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: colors.textPrimary,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            StatusBadge(
                              label: isMulti
                                  ? 'Max $maxSelections'
                                  : 'Optional Choice',
                              color: colors.cyan,
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        ...opts.map((opt) {
                          final optId = opt['id'] as int;
                          final isSelected = selectedSet.contains(optId);
                          final optLabel = opt['custom_label'] ??
                              opt['food_name'] ??
                              'Choice';
                          final optCals = opt['calories'];
                          final optProtein = opt['protein_g'];

                          return Material(
                            color: Colors.transparent,
                            child: InkWell(
                              onTap: () {
                                setState(() {
                                  final current = _selectedOptions.putIfAbsent(
                                      gId, () => {});
                                  if (isMulti) {
                                    if (isSelected) {
                                      current.remove(optId);
                                    } else {
                                      if (current.length < maxSelections) {
                                        current.add(optId);
                                      }
                                    }
                                  } else {
                                    if (isSelected) {
                                      current.remove(optId);
                                    } else {
                                      current.clear();
                                      current.add(optId);
                                    }
                                  }
                                });
                              },
                              borderRadius: BorderRadius.circular(AppRadii.sm),
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 6),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? colors.primaryMuted
                                      : colors.card,
                                  borderRadius:
                                      BorderRadius.circular(AppRadii.sm),
                                  border: Border.all(
                                    color: isSelected
                                        ? colors.primary.withValues(alpha: 0.5)
                                        : colors.border.withValues(alpha: 0.6),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      isMulti
                                          ? (isSelected
                                              ? Icons.check_box
                                              : Icons.check_box_outline_blank)
                                          : (isSelected
                                              ? Icons.radio_button_checked
                                              : Icons.radio_button_off),
                                      size: 18,
                                      color: isSelected
                                          ? colors.primary
                                          : colors.textMuted,
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        optLabel.toString(),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: isSelected
                                              ? FontWeight.w700
                                              : FontWeight.w500,
                                          color: colors.textPrimary,
                                        ),
                                      ),
                                    ),
                                    if (optCals != null || optProtein != null) ...[
                                      const SizedBox(width: 8),
                                      Text(
                                        '${optCals ?? 0} kcal${optProtein != null ? " • ${optProtein}g P" : ""}',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: isSelected
                                              ? colors.primary
                                              : colors.textMuted,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          );
                        }),
                      ],
                    ),
                  );
                }),
              ] else ...[
                // Meal has no explicit options, confirm planned nutrition
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: colors.surfaceElevated,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    border: Border.all(color: colors.border),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.check_circle_outline,
                          color: colors.primary, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Planned nutrition: ${calories ?? 0} kcal, ${protein ?? 0}g protein.',
                          style: TextStyle(
                            fontSize: 13,
                            color: colors.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              // Custom Foods & Additions Section
              Container(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: colors.surfaceElevated,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  border: Border.all(
                    color: _customFoods.isNotEmpty
                        ? colors.primary.withValues(alpha: 0.3)
                        : colors.border,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.restaurant_menu, size: 16, color: colors.primary),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'CUSTOM FOODS',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.6,
                              color: colors.textPrimary,
                            ),
                          ),
                        ),
                        if (_customFoods.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          StatusBadge(
                            label: '${_customFoods.length} added',
                            color: colors.primary,
                          ),
                        ],
                      ],
                    ),
                    if (_customFoods.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      ..._customFoods.asMap().entries.map((entry) {
                        final index = entry.key;
                        final food = entry.value;
                        final name = food['name']?.toString() ?? 'Custom Food';
                        final portion = food['servingSize']?.toString();
                        final cals = food['calories'];
                        final prot = food['proteinG'] ?? food['protein_g'];

                        return Container(
                          margin: const EdgeInsets.only(bottom: 6),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          decoration: BoxDecoration(
                            color: colors.card,
                            borderRadius: BorderRadius.circular(AppRadii.sm),
                            border: Border.all(color: colors.border.withValues(alpha: 0.7)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                decoration: BoxDecoration(
                                  color: colors.violet.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  'CUSTOM',
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800,
                                    color: colors.violet,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: colors.textPrimary,
                                      ),
                                    ),
                                    if (portion != null || cals != null || prot != null) ...[
                                      const SizedBox(height: 2),
                                      Text(
                                        [
                                          if (portion != null && portion.isNotEmpty) portion,
                                          if (cals != null) '${cals is num && cals % 1 == 0 ? cals.toInt() : cals} kcal',
                                          if (prot != null) '${prot is num && prot % 1 == 0 ? prot.toInt() : prot}g Protein',
                                        ].join(' • '),
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: colors.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              InkWell(
                                onTap: () {
                                  setState(() {
                                    _customFoods.removeAt(index);
                                  });
                                },
                                borderRadius: BorderRadius.circular(AppRadii.sm),
                                child: Padding(
                                  padding: const EdgeInsets.all(4),
                                  child: Icon(Icons.delete_outline, size: 18, color: colors.rose),
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                    ],
                    const SizedBox(height: 8),
                    if (!_isAddingCustomFood)
                      InkWell(
                        onTap: () => setState(() => _isAddingCustomFood = true),
                        borderRadius: BorderRadius.circular(AppRadii.sm),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(AppRadii.sm),
                            border: Border.all(
                              color: colors.primary.withValues(alpha: 0.4),
                              style: BorderStyle.solid,
                            ),
                            color: colors.primaryMuted.withValues(alpha: 0.3),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.add, size: 16, color: colors.primary),
                              const SizedBox(width: 6),
                              Flexible(
                                child: Text(
                                  '+ Add custom food',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                    color: colors.primary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    else ...[
                      // Inline Add Custom Food form
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: colors.card,
                          borderRadius: BorderRadius.circular(AppRadii.sm),
                          border: Border.all(color: colors.primary.withValues(alpha: 0.5)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'Add Custom Food',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: colors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            PremiumTextField(
                              controller: _customNameController,
                              label: 'Food Name / Description *',
                              hintText: 'e.g. Scrambled Eggs, Protein Shake',
                              textInputAction: TextInputAction.next,
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: PremiumTextField(
                                    controller: _customPortionController,
                                    label: 'Portion',
                                    hintText: 'e.g. 200g',
                                    textInputAction: TextInputAction.next,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: PremiumTextField(
                                    controller: _customCaloriesController,
                                    label: 'Calories (kcal)',
                                    hintText: 'e.g. 220',
                                    keyboardType: TextInputType.number,
                                    textInputAction: TextInputAction.next,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: PremiumTextField(
                                    controller: _customProteinController,
                                    label: 'Protein (g)',
                                    hintText: 'e.g. 24',
                                    keyboardType: TextInputType.number,
                                    textInputAction: TextInputAction.done,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                TextButton(
                                  onPressed: () {
                                    setState(() {
                                      _isAddingCustomFood = false;
                                      _customNameController.clear();
                                      _customPortionController.clear();
                                      _customCaloriesController.clear();
                                      _customProteinController.clear();
                                    });
                                  },
                                  child: Text(
                                    'Cancel',
                                    style: TextStyle(color: colors.textMuted, fontSize: 12),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                PremiumButton(
                                  text: 'Add Item',
                                  height: 32,
                                  onPressed: () {
                                    final name = _customNameController.text.trim();
                                    if (name.isEmpty) return;
                                    final portion = _customPortionController.text.trim();
                                    final cals = num.tryParse(_customCaloriesController.text.trim());
                                    final prot = num.tryParse(_customProteinController.text.trim());

                                    setState(() {
                                      _customFoods.add({
                                        'name': name,
                                        if (portion.isNotEmpty) 'servingSize': portion,
                                        if (cals != null) 'calories': cals,
                                        if (prot != null) 'proteinG': prot,
                                      });
                                      _isAddingCustomFood = false;
                                      _customNameController.clear();
                                      _customPortionController.clear();
                                      _customCaloriesController.clear();
                                      _customProteinController.clear();
                                    });
                                  },
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ] else ...[
              // Skipped state explanation
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: colors.surfaceElevated,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  border: Border.all(color: colors.border),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline,
                        color: colors.textMuted, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'This meal will be recorded as skipped. Nutrition totals will not be added.',
                        style: TextStyle(
                          fontSize: 13,
                          color: colors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Optional Notes
            if (!_showNotesField)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => setState(() => _showNotesField = true),
                  icon: Icon(Icons.edit_note, size: 18, color: colors.textSecondary),
                  label: Text(
                    'Add note (optional)',
                    style: TextStyle(
                      fontSize: 12.5,
                      color: colors.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              )
            else ...[
              const SizedBox(height: 4),
              PremiumTextField(
                controller: _notesController,
                maxLines: 2,
                label: 'Notes (optional)',
                hintText: 'e.g. Swapped olive oil, ate half portion',
                textInputAction: TextInputAction.done,
              ),
              const SizedBox(height: 12),
            ],

            const SizedBox(height: 14),

            // Submit Button
            PremiumButton(
              onPressed: _isSubmitting ? null : _submitMealLog,
              loading: _isSubmitting,
              text: _status == 'skipped'
                  ? 'Mark Meal as Skipped'
                  : 'Confirm & Log Meal',
              icon: Icon(
                _status == 'skipped' ? Icons.close : Icons.check,
                size: 18,
                color: Colors.white,
              ),
              height: 48,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusTab({
    required String value,
    required String label,
    required IconData icon,
    required AppThemeColors colors,
  }) {
    final isSelected = _status == value;
    final activeColor = value == 'skipped'
        ? colors.rose
        : (value == 'partial' ? colors.amber : colors.primary);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => setState(() => _status = value),
        borderRadius: BorderRadius.circular(AppRadii.sm),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? activeColor : Colors.transparent,
            borderRadius: BorderRadius.circular(AppRadii.sm),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 14,
                color: isSelected ? Colors.white : colors.textMuted,
              ),
              const SizedBox(width: 5),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    color: isSelected ? Colors.white : colors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
