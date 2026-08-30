import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('${widget.meal['name']} logged successfully!')),
        );
        Navigator.pop(context);
      }
    } on OfflineOperationQueued catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Meal log saved offline. Will sync when online.')),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to log meal: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final groups = (widget.meal['optionGroups'] as List<dynamic>? ?? []);

    return Scaffold(
      appBar: AppBar(
        title: Text('Log ${widget.meal['name']}'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  const Icon(Icons.restaurant, color: AppColors.amber),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.meal['name'],
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Select your status and food choices for this meal.',
                          style: TextStyle(
                              fontSize: 13, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Status Selector
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('MEAL STATUS',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                            color: AppColors.cyan)),
                    const SizedBox(height: 12),
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(
                          value: 'completed',
                          label: Text('Completed'),
                          icon: Icon(Icons.check_circle_outline, size: 16),
                        ),
                        ButtonSegment(
                          value: 'partial',
                          label: Text('Partial'),
                          icon: Icon(Icons.incomplete_circle, size: 16),
                        ),
                        ButtonSegment(
                          value: 'skipped',
                          label: Text('Skipped'),
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
            ),
            const SizedBox(height: 16),

            if (_validationError != null)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.rose.withValues(alpha: 0.15),
                  border:
                      Border.all(color: AppColors.rose.withValues(alpha: 0.3)),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline,
                        color: AppColors.rose, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _validationError!,
                        style: const TextStyle(
                            color: AppColors.rose, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),

            if (_status != 'skipped') ...[
              ...groups.map((group) {
                final gId = group['id'] as int;
                final opts = (group['options'] as List<dynamic>? ?? []);
                final maxSelections = (group['max_selections'] ??
                    group['maxSelections'] ??
                    1) as int;
                final minSelections = (group['min_selections'] ??
                    group['minSelections'] ??
                    (group['is_optional'] == 1 ? 0 : 1)) as int;
                final selectedSet = _selectedOptions[gId] ?? {};

                return Card(
                  margin: const EdgeInsets.only(bottom: 16),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              group['name'] ?? 'Food Group',
                              style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.cyan),
                            ),
                            Text(
                              maxSelections > 1
                                  ? 'Select $minSelections–$maxSelections'
                                  : (minSelections == 0
                                      ? 'Optional'
                                      : 'Required (1)'),
                              style: const TextStyle(
                                  fontSize: 11, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        if (maxSelections > 1)
                          ...opts.map((opt) {
                            final optId = opt['id'] as int;
                            final isSelected = selectedSet.contains(optId);

                            return Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? AppColors.primary.withValues(alpha: 0.12)
                                    : AppColors.surface,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                    color: isSelected
                                        ? AppColors.primary
                                        : AppColors.border),
                              ),
                              child: CheckboxListTile(
                                value: isSelected,
                                activeColor: AppColors.primary,
                                title: Text(
                                  opt['custom_label'] ??
                                      opt['food_name'] ??
                                      'Choice',
                                  style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600),
                                ),
                                subtitle: Text(
                                  '${opt['calories'] ?? 0} kcal  •  ${opt['protein_g'] ?? 0}g Protein',
                                  style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary),
                                ),
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
                          RadioGroup<int>(
                            groupValue: selectedSet.isNotEmpty
                                ? selectedSet.first
                                : null,
                            onChanged: (val) {
                              if (val != null) {
                                setState(() {
                                  _selectedOptions[gId] = {val};
                                });
                              }
                            },
                            child: Column(
                              children: opts.map<Widget>((opt) {
                                final optId = opt['id'] as int;
                                final isSelected = selectedSet.contains(optId);

                                return Container(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  decoration: BoxDecoration(
                                    color: isSelected
                                        ? AppColors.primary
                                            .withValues(alpha: 0.12)
                                        : AppColors.surface,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                        color: isSelected
                                            ? AppColors.primary
                                            : AppColors.border),
                                  ),
                                  child: RadioListTile<int>(
                                    value: optId,
                                    activeColor: AppColors.primary,
                                    title: Text(
                                      opt['custom_label'] ??
                                          opt['food_name'] ??
                                          'Choice',
                                      style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600),
                                    ),
                                    subtitle: Text(
                                      '${opt['calories'] ?? 0} kcal  •  ${opt['protein_g'] ?? 0}g Protein',
                                      style: const TextStyle(
                                          fontSize: 12,
                                          color: AppColors.textSecondary),
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              }),
            ],

            // User Notes Card
            Card(
              margin: const EdgeInsets.only(bottom: 16),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('NOTES (OPTIONAL)',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                            color: AppColors.cyan)),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _notesController,
                      maxLines: 2,
                      textInputAction: TextInputAction.done,
                      decoration: const InputDecoration(
                        hintText: 'e.g. Substituted with olive oil',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: _isLoading ? null : _submitMealLog,
              child: _isLoading
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('Confirm & Save Meal Log'),
            ),
          ],
        ),
      ),
    );
  }
}
