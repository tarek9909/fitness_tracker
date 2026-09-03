import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';

class MealLoggingScreen extends StatefulWidget {
  final ApiClient apiClient;
  final Map<String, dynamic> meal;

  const MealLoggingScreen({
    super.key,
    required this.apiClient,
    required this.meal,
  });

  @override
  State<MealLoggingScreen> createState() => _MealLoggingScreenState();
}

class _MealLoggingScreenState extends State<MealLoggingScreen> {
  final Map<int, Set<int>> _selectedOptions = {}; // groupId -> Set of optionId
  final _notesController = TextEditingController();
  String _status = 'completed';
  bool _isLoading = false;
  String? _validationError;

  @override
  void initState() {
    super.initState();
    final log = widget.meal['log'];
    if (log is Map<String, dynamic>) {
      _status = log['status'] as String? ?? 'completed';
      if (log['notes'] != null && log['notes'].toString().isNotEmpty) {
        _notesController.text = log['notes'].toString();
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
          }
        }
      }
    }
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _submitMealLog() async {
    setState(() {
      _validationError = null;
    });

    final groups = (widget.meal['optionGroups'] as List<dynamic>? ?? []);

    // Validate min selections if not skipped
    if (_status != 'skipped') {
      for (final g in groups) {
        final gId = g['id'] as int;
        final minSel = (g['min_selections'] ??
            g['minSelections'] ??
            (g['is_optional'] == 1 || g['is_optional'] == true ? 0 : 1)) as int;
        final selectedCount = _selectedOptions[gId]?.length ?? 0;
        if (selectedCount < minSel) {
          final gName = g['name'] ?? 'Food group';
          setState(() {
            _validationError =
                'Please select at least $minSel option(s) for $gName';
          });
          return;
        }
      }
    }

    setState(() => _isLoading = true);
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
        if (_notesController.text.trim().isNotEmpty)
          'notes': _notesController.text.trim(),
      };

      await widget.apiClient.put(
        '/me/meals/${widget.meal['id']}/log',
        body: payload,
      );

      if (mounted) {
        showPremiumSnackBar(
          context,
          '${widget.meal['name']} logged successfully!',
          isSuccess: true,
        );
        Navigator.pop(context);
      }
    } on OfflineOperationQueued catch (_) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Meal log saved offline. Will sync when online.',
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
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

    return PremiumScaffold(
      appBar: PremiumAppBar(
        titleText: 'Log ${widget.meal['name']}',
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            PremiumCard(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: colors.amberMuted,
                      borderRadius: BorderRadius.circular(AppRadii.md),
                    ),
                    child: Icon(Icons.restaurant,
                        color: colors.amber, size: 22),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.meal['name'],
                          style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                              color: colors.textPrimary),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Select your status and food choices for this meal.',
                          style: TextStyle(
                              fontSize: 13, color: colors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Status Selector
            PremiumCard(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('MEAL STATUS',
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
                          color: colors.textSecondary)),
                  const SizedBox(height: 12),
                  SegmentedButton<String>(
                    style: ButtonStyle(
                      backgroundColor:
                          WidgetStateProperty.resolveWith<Color>((states) {
                        if (states.contains(WidgetState.selected)) {
                          return colors.primary;
                        }
                        return colors.surfaceElevated;
                      }),
                      foregroundColor:
                          WidgetStateProperty.resolveWith<Color>((states) {
                        if (states.contains(WidgetState.selected)) {
                          return Colors.white;
                        }
                        return colors.textSecondary;
                      }),
                      side: WidgetStateProperty.all(
                          BorderSide(color: colors.border)),
                    ),
                    segments: const [
                      ButtonSegment(
                        value: 'completed',
                        label: Text('Completed',
                            style: TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 13)),
                        icon: Icon(Icons.check_circle_outline, size: 16),
                      ),
                      ButtonSegment(
                        value: 'partial',
                        label: Text('Partial',
                            style: TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 13)),
                        icon: Icon(Icons.incomplete_circle, size: 16),
                      ),
                      ButtonSegment(
                        value: 'skipped',
                        label: Text('Skipped',
                            style: TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 13)),
                        icon: Icon(Icons.cancel_outlined, size: 16),
                      ),
                    ],
                    selected: {_status},
                    onSelectionChanged: (val) {
                      setState(() => _status = val.first);
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            if (_validationError != null)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: colors.roseMuted,
                  border:
                      Border.all(color: colors.rose.withValues(alpha: 0.3)),
                  borderRadius: BorderRadius.circular(AppRadii.md),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline,
                        color: colors.rose, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _validationError!,
                        style: TextStyle(
                            color: colors.rose,
                            fontSize: 13,
                            fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),

            if (_status != 'skipped') ...[
              ...groups.map((group) {
                final gId = group['id'] as int;
                final gName = group['name'] as String? ?? 'Food Choice';
                final isOptional =
                    group['is_optional'] == 1 || group['is_optional'] == true;
                final maxSelections = (group['max_selections'] ??
                    group['maxSelections'] ??
                    1) as int;
                final minSelections = (group['min_selections'] ??
                    group['minSelections'] ??
                    (isOptional ? 0 : 1)) as int;
                final isMulti = maxSelections > 1;
                final opts = (group['options'] as List<dynamic>? ?? []);
                final selectedSet = _selectedOptions[gId] ?? {};

                return Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  child: PremiumCard(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              gName,
                              style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: colors.textPrimary),
                            ),
                            StatusBadge(
                              label: isMulti
                                  ? 'Select up to $maxSelections'
                                  : (minSelections > 0
                                      ? 'Required'
                                      : 'Optional'),
                              color: minSelections > 0
                                  ? colors.primary
                                  : colors.cyan,
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        if (isMulti)
                          ...opts.map((opt) {
                            final optId = opt['id'] as int;
                            final isChecked = selectedSet.contains(optId);

                            return Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              decoration: BoxDecoration(
                                color: isChecked
                                    ? colors.primaryMuted
                                    : colors.surfaceElevated,
                                borderRadius:
                                    BorderRadius.circular(AppRadii.md),
                                border: Border.all(
                                    color: isChecked
                                        ? colors.primary
                                            .withValues(alpha: 0.4)
                                        : colors.border),
                              ),
                              child: PremiumCheckboxTile(
                                value: isChecked,
                                title: opt['custom_label'] ??
                                    opt['food_name'] ??
                                    'Choice',
                                subtitle:
                                    '${opt['calories'] ?? 0} kcal  •  ${opt['protein_g'] ?? 0}g Protein',
                                onChanged: (bool? checked) {
                                  setState(() {
                                    final current = _selectedOptions
                                        .putIfAbsent(gId, () => {});
                                    if (checked == true) {
                                      if (current.length < maxSelections) {
                                        current.add(optId);
                                      }
                                    } else {
                                      current.remove(optId);
                                    }
                                  });
                                },
                              ),
                            );
                          })
                        else
                          Column(
                            children: opts.map<Widget>((opt) {
                              final optId = opt['id'] as int;
                              final isSelected = selectedSet.contains(optId);

                              return Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? colors.primaryMuted
                                      : colors.surfaceElevated,
                                  borderRadius:
                                      BorderRadius.circular(AppRadii.md),
                                  border: Border.all(
                                      color: isSelected
                                          ? colors.primary
                                              .withValues(alpha: 0.4)
                                          : colors.border),
                                ),
                                child: PremiumRadioTile<int>(
                                  value: optId,
                                  groupValue: selectedSet.isNotEmpty
                                      ? selectedSet.first
                                      : -1,
                                  title: opt['custom_label'] ??
                                      opt['food_name'] ??
                                      'Choice',
                                  subtitle:
                                      '${opt['calories'] ?? 0} kcal  •  ${opt['protein_g'] ?? 0}g Protein',
                                  onChanged: (val) {
                                    if (val != null) {
                                      setState(() {
                                        _selectedOptions[gId] = {val};
                                      });
                                    }
                                  },
                                ),
                              );
                            }).toList(),
                          ),
                      ],
                    ),
                  ),
                );
              }),
            ],

            // User Notes Card
            PremiumCard(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('NOTES (OPTIONAL)',
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
                          color: colors.textSecondary)),
                  const SizedBox(height: 8),
                  PremiumTextField(
                    controller: _notesController,
                    maxLines: 2,
                    label: 'Add note (e.g. Substituted olive oil)',
                    textInputAction: TextInputAction.done,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),
            PremiumButton(
              onPressed: _isLoading ? null : _submitMealLog,
              loading: _isLoading,
              text: 'Confirm & Save Meal Log',
              icon: const Icon(Icons.check, size: 18, color: Colors.white),
              height: 48,
            ),
          ],
        ),
      ),
    );
  }
}
