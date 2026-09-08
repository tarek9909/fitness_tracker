import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';

class DietPlanBuilderScreen extends StatefulWidget {
  final ApiClient apiClient;
  final int planId;

  const DietPlanBuilderScreen({super.key, required this.apiClient, required this.planId});

  @override
  State<DietPlanBuilderScreen> createState() => _DietPlanBuilderScreenState();
}

class _DietPlanBuilderScreenState extends State<DietPlanBuilderScreen> {
  Map<String, dynamic>? _plan;
  bool _loading = true;
  String? _error;

  Map<String, dynamic>? get _version => _plan?['version'] is Map ? Map<String, dynamic>.from(_plan!['version'] as Map) : null;
  List<Map<String, dynamic>> get _meals => ((_version?['meals'] as List?) ?? const []).whereType<Map>().map(Map<String, dynamic>.from).toList();
  int? _id(dynamic value) => value is num ? value.toInt() : int.tryParse('$value');

  @override
  void initState() { super.initState(); _reload(); }

  Future<void> _reload() async {
    if (mounted) setState(() { _loading = true; _error = null; });
    try {
      final response = await widget.apiClient.get('/me/diet-plans/${widget.planId}');
      final raw = response is Map && response['data'] is Map ? response['data'] as Map : response as Map;
      final plan = Map<String, dynamic>.from(raw);
      final versions = (plan['versions'] as List?)?.whereType<Map>().toList() ?? const [];
      Map<String, dynamic>? version = plan['version'] is Map ? Map<String, dynamic>.from(plan['version']) : null;
      if (version == null && versions.isNotEmpty) {
        final selected = versions.firstWhere((item) => item['status'] == 'draft', orElse: () => versions.first);
        version = Map<String, dynamic>.from(selected);
      }
      final versionId = _id(version?['id']);
      if (versionId != null) {
        final detail = await widget.apiClient.get('/me/diet-plans/${widget.planId}/versions/$versionId');
        if (detail is Map) version = Map<String, dynamic>.from(detail['data'] is Map ? detail['data'] as Map : detail);
      }
      plan['version'] = version;
      if (mounted) setState(() { _plan = plan; _loading = false; });
    } catch (error) {
      if (mounted) setState(() { _error = '$error'.replaceAll('Exception: ', ''); _loading = false; });
    }
  }

  Future<void> _mutate(Future<void> Function() action, String success) async {
    try {
      await action();
      await _reload();
      if (mounted) showPremiumSnackBar(context, success, isSuccess: true);
    } catch (error) {
      if (mounted) showPremiumSnackBar(context, '$error'.replaceAll('Exception: ', ''), isError: true);
    }
  }

  Future<bool?> _showFormSheet(String title, List<Widget> fields) {
    return showPremiumModalSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) {
        final colors = AppThemeColors.of(sheetContext);
        return Padding(
          padding: EdgeInsets.only(
            left: AppSpacing.lg,
            right: AppSpacing.lg,
            top: AppSpacing.md,
            bottom: MediaQuery.of(sheetContext).viewInsets.bottom + AppSpacing.lg,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: AppSpacing.md),
              Flexible(
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: fields,
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Row(
                children: [
                  Expanded(child: PremiumButton(text: 'Cancel', isSecondary: true, onPressed: () => Navigator.pop(sheetContext, false))),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(child: PremiumButton(text: 'Save', onPressed: () => Navigator.pop(sheetContext, true))),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _editPlan() async {
    final name = TextEditingController(text: _plan?['name']?.toString() ?? '');
    final description = TextEditingController(text: _plan?['description']?.toString() ?? '');
    final saved = await _showFormSheet('Edit diet plan', [
      PremiumTextField(label: 'Plan name', controller: name),
      const SizedBox(height: 14),
      PremiumTextField(label: 'Description', controller: description, maxLines: 3),
    ]);
    final payload = {'name': name.text.trim(), 'description': description.text.trim()};
    if (saved != true || payload['name'] == '') return;
    await _mutate(() => widget.apiClient.patch('/me/diet-plans/${widget.planId}', body: payload).then((_) {}), 'Diet plan updated');
  }

  Future<void> _editMeal({Map<String, dynamic>? existing}) async {
    final versionId = _id(_version?['id']);
    if (versionId == null) return;
    final name = TextEditingController(text: existing?['name']?.toString() ?? '');
    final time = TextEditingController(text: existing?['scheduled_time']?.toString() ?? existing?['meal_time']?.toString() ?? '08:00');
    final notes = TextEditingController(text: existing?['notes']?.toString() ?? '');
    var required = existing?['is_required'] != 0 && existing?['isRequired'] != false;

    final saved = await showPremiumModalSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) {
        final colors = AppThemeColors.of(sheetContext);
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                left: AppSpacing.lg,
                right: AppSpacing.lg,
                top: AppSpacing.md,
                bottom: MediaQuery.of(sheetContext).viewInsets.bottom + AppSpacing.lg,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(existing == null ? 'Add meal' : 'Edit meal', style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
                  const SizedBox(height: AppSpacing.md),
                  Flexible(
                    child: SingleChildScrollView(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          PremiumTextField(label: 'Meal name', controller: name),
                          const SizedBox(height: 14),
                          PremiumTextField(label: 'Scheduled time', controller: time, hintText: 'e.g. 08:00'),
                          const SizedBox(height: 10),
                          Material(
                            color: Colors.transparent,
                            child: SwitchListTile(
                              title: Text('Required meal', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600)),
                              subtitle: Text('Mandatory meal slot for this diet plan', style: TextStyle(color: colors.textSecondary, fontSize: 12)),
                              value: required,
                              onChanged: (value) => setSheetState(() => required = value),
                            ),
                          ),
                          const SizedBox(height: 14),
                          PremiumTextField(label: 'Meal notes', controller: notes, maxLines: 2),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Row(
                    children: [
                      Expanded(child: PremiumButton(text: 'Cancel', isSecondary: true, onPressed: () => Navigator.pop(sheetContext, false))),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(child: PremiumButton(text: 'Save', onPressed: () => Navigator.pop(sheetContext, true))),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    final mealId = _id(existing?['id']);
    final payload = {'name': name.text.trim(), 'scheduledTime': time.text.trim(), 'notes': notes.text.trim(), 'isRequired': required};
    if (saved != true || payload['name'] == '') return;
    await _mutate(() async {
      if (mealId == null) {
        await widget.apiClient.post('/me/diet-plans/${widget.planId}/versions/$versionId/meals', body: payload);
      } else {
        await widget.apiClient.patch('/me/diet-plans/${widget.planId}/meals/$mealId', body: payload);
      }
    }, existing == null ? 'Meal added' : 'Meal updated');
  }

  Future<void> _deleteMeal(Map<String, dynamic> meal) async {
    final id = _id(meal['id']); if (id == null) return;
    await _mutate(() => widget.apiClient.delete('/me/diet-plans/${widget.planId}/meals/$id').then((_) {}), 'Meal deleted');
  }

  Future<void> _reorderMeals(int index, int delta) async {
    final target = index + delta; if (target < 0 || target >= _meals.length) return;
    final first = _id(_meals[index]['id']); final second = _id(_meals[target]['id']); if (first == null || second == null) return;
    await _mutate(() async { await widget.apiClient.patch('/me/diet-plans/${widget.planId}/meals/$first', body: {'orderIndex': target + 1}); await widget.apiClient.patch('/me/diet-plans/${widget.planId}/meals/$second', body: {'orderIndex': index + 1}); }, 'Meal order updated');
  }

  Future<void> _editGroup(int mealId, {Map<String, dynamic>? existing}) async {
    final name = TextEditingController(text: existing?['name']?.toString() ?? '');
    final min = TextEditingController(text: '${existing?['min_selection_count'] ?? existing?['min_selections'] ?? 1}');
    final max = TextEditingController(text: '${existing?['max_selection_count'] ?? existing?['max_selections'] ?? 1}');
    final notes = TextEditingController(text: existing?['notes']?.toString() ?? '');
    var required = existing?['is_required'] == 1 || existing?['isRequired'] == true;

    final saved = await showPremiumModalSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: AppSpacing.lg,
            right: AppSpacing.lg,
            top: AppSpacing.md,
            bottom: MediaQuery.of(sheetContext).viewInsets.bottom + AppSpacing.lg,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(existing == null ? 'Add option group' : 'Edit option group', style: TextStyle(color: AppThemeColors.of(sheetContext).textPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: AppSpacing.md),
              Flexible(
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      PremiumTextField(label: 'Group name', controller: name),
                      const SizedBox(height: 10),
                      Material(
                        color: Colors.transparent,
                        child: SwitchListTile(
                          title: Text('Required group', style: TextStyle(color: AppThemeColors.of(sheetContext).textPrimary, fontWeight: FontWeight.w600)),
                          value: required,
                          onChanged: (value) => setSheetState(() => required = value),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(child: PremiumTextField(label: 'Minimum selections', controller: min, keyboardType: TextInputType.number)),
                          const SizedBox(width: 12),
                          Expanded(child: PremiumTextField(label: 'Maximum selections', controller: max, keyboardType: TextInputType.number)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      PremiumTextField(label: 'Group notes', controller: notes, maxLines: 2),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Row(
                children: [
                  Expanded(child: PremiumButton(text: 'Cancel', isSecondary: true, onPressed: () => Navigator.pop(sheetContext, false))),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(child: PremiumButton(text: 'Save', onPressed: () => Navigator.pop(sheetContext, true))),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    final groupId = _id(existing?['id']);
    final payload = {'name': name.text.trim(), 'isRequired': required, 'minSelections': int.tryParse(min.text) ?? 0, 'maxSelections': int.tryParse(max.text) ?? 1, 'notes': notes.text.trim()};
    if (saved != true || payload['name'] == '') return;
    await _mutate(() async {
      if (groupId == null) {
        await widget.apiClient.post('/me/diet-plans/${widget.planId}/meals/$mealId/groups', body: payload);
      } else {
        await widget.apiClient.put('/me/diet-plans/${widget.planId}/option-groups/$groupId', body: payload);
      }
    }, existing == null ? 'Option group added' : 'Option group updated');
  }

  Future<void> _deleteGroup(Map<String, dynamic> group) async { final id = _id(group['id']); if (id == null) return; await _mutate(() => widget.apiClient.delete('/me/diet-plans/${widget.planId}/option-groups/$id').then((_) {}), 'Option group deleted'); }

  Future<void> _reorderGroups(List<Map<String, dynamic>> groups, int index, int delta) async {
    final target = index + delta;
    if (target < 0 || target >= groups.length) return;
    final first = _id(groups[index]['id']);
    final second = _id(groups[target]['id']);
    if (first == null || second == null) return;
    await _mutate(() async {
      await widget.apiClient.put('/me/diet-plans/${widget.planId}/option-groups/$first', body: {'orderIndex': target + 1});
      await widget.apiClient.put('/me/diet-plans/${widget.planId}/option-groups/$second', body: {'orderIndex': index + 1});
    }, 'Option group order updated');
  }

  Future<void> _editOption(int groupId, {Map<String, dynamic>? existing}) async {
    List<dynamic> foods = [];
    try { final response = await widget.apiClient.get('/foods'); foods = response is Map && response['data'] is List ? response['data'] as List : response is List ? response : []; } catch (_) {}
    if (!mounted) return;
    var foodId = _id(existing?['food_id']) ?? (foods.isNotEmpty ? _id(foods.first['id']) : null);
    final quantity = TextEditingController(text: '${existing?['serving_quantity'] ?? existing?['quantity'] ?? 100}');
    final label = TextEditingController(text: existing?['custom_label']?.toString() ?? existing?['label']?.toString() ?? '');
    final notes = TextEditingController(text: existing?['notes']?.toString() ?? '');

    final saved = await showPremiumModalSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) {
          final colors = AppThemeColors.of(sheetContext);
          return Padding(
            padding: EdgeInsets.only(
              left: AppSpacing.lg,
              right: AppSpacing.lg,
              top: AppSpacing.md,
              bottom: MediaQuery.of(sheetContext).viewInsets.bottom + AppSpacing.lg,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(existing == null ? 'Add food option' : 'Edit food option', style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
                const SizedBox(height: AppSpacing.md),
                Flexible(
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (foods.isEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Text('No foods are available in the catalog.', style: TextStyle(color: colors.textMuted)),
                          )
                        else
                          DropdownButtonFormField<int>(
                            initialValue: foodId,
                            isExpanded: true,
                            dropdownColor: colors.card,
                            items: foods.map((food) => DropdownMenuItem<int>(value: _id(food['id']), child: Text('${food['name'] ?? 'Food'}'))).toList(),
                            onChanged: (value) => setSheetState(() => foodId = value),
                            decoration: InputDecoration(
                              labelText: 'Food (nutrition auto-calculated)',
                              filled: true,
                              fillColor: colors.surfaceElevated,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadii.md), borderSide: BorderSide(color: colors.border)),
                              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadii.md), borderSide: BorderSide(color: colors.border)),
                            ),
                          ),
                        const SizedBox(height: 14),
                        PremiumTextField(label: 'Custom label (optional)', controller: label),
                        const SizedBox(height: 14),
                        PremiumTextField(label: 'Serving quantity (g / ml)', controller: quantity, keyboardType: TextInputType.number),
                        const SizedBox(height: 14),
                        PremiumTextField(label: 'Notes / alternative guidance', controller: notes, maxLines: 2),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                Row(
                  children: [
                    Expanded(child: PremiumButton(text: 'Cancel', isSecondary: true, onPressed: () => Navigator.pop(sheetContext, false))),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(child: PremiumButton(text: 'Save', onPressed: () => Navigator.pop(sheetContext, true))),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );

    final optionId = _id(existing?['id']);
    final payload = {'foodId': foodId, 'customLabel': label.text.trim(), 'servingQuantity': double.tryParse(quantity.text) ?? 100, 'notes': notes.text.trim()};
    if (saved != true || foodId == null) return;
    await _mutate(() async {
      if (optionId == null) {
        await widget.apiClient.post('/me/diet-plans/${widget.planId}/option-groups/$groupId/options', body: payload);
      } else {
        await widget.apiClient.put('/me/diet-plans/${widget.planId}/options/$optionId', body: payload);
      }
    }, existing == null ? 'Food option added' : 'Food option updated');
  }

  Future<void> _deleteOption(Map<String, dynamic> option) async { final id = _id(option['id']); if (id == null) return; await _mutate(() => widget.apiClient.delete('/me/diet-plans/${widget.planId}/options/$id').then((_) {}), 'Food option deleted'); }

  Future<void> _reorderOptions(List<Map<String, dynamic>> options, int index, int delta) async {
    final target = index + delta; if (target < 0 || target >= options.length) return;
    final first = _id(options[index]['id']); final second = _id(options[target]['id']); if (first == null || second == null) return;
    await _mutate(() async { await widget.apiClient.put('/me/diet-plans/${widget.planId}/options/$first', body: {'orderIndex': target + 1}); await widget.apiClient.put('/me/diet-plans/${widget.planId}/options/$second', body: {'orderIndex': index + 1}); }, 'Food option order updated');
  }

  Future<void> _reviewAndActivate() async {
    await _reload(); if (!mounted) return;
    final groups = _meals.fold<int>(0, (count, meal) {
      final rawGroups = meal['optionGroups'] ?? meal['option_groups'];
      return count + (rawGroups is List ? rawGroups.length : 0);
    });

    final confirmed = await showPremiumModalSheet<bool>(
      context: context,
      builder: (sheetContext) {
        final colors = AppThemeColors.of(sheetContext);
        return Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Review and activate', style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              MetricCard(
                title: 'PLAN NUTRITION SUMMARY',
                value: '${_meals.length} Meals • $groups Option Groups',
                subtitle: 'Saved & verified in backend API',
                icon: Icons.restaurant,
                accentColor: colors.primary,
              ),
              const SizedBox(height: 16),
              Text('Activate this diet plan version as your active nutrition starting from your selected date?', style: TextStyle(color: colors.textSecondary, fontSize: 13, height: 1.4)),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(child: PremiumButton(text: 'Cancel', isSecondary: true, onPressed: () => Navigator.pop(sheetContext, false))),
                  const SizedBox(width: 12),
                  Expanded(child: PremiumButton(text: 'Activate', onPressed: () => Navigator.pop(sheetContext, true))),
                ],
              ),
            ],
          ),
        );
      },
    );

    if (confirmed != true) return;
    if (!mounted) return;
    final date = await showDatePicker(context: context, initialDate: DateTime.now(), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 1825))); if (date == null) return;
    final value = '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    await _mutate(() => widget.apiClient.post('/me/diet-plans/${widget.planId}/activate', body: {'effectiveFrom': value}).then((_) {}), 'Diet plan activated');
  }

  Future<void> _makeActive() async {
    final now = DateTime.now();
    final today = '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    await _mutate(() => widget.apiClient.post('/me/diet-plans/${widget.planId}/activate', body: {'effectiveFrom': today}).then((_) {}), 'Diet plan activated as your active nutrition');
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    if (_loading) return const PremiumScaffold(body: Center(child: CircularProgressIndicator()));
    if (_error != null || _plan == null) return PremiumScaffold(appBar: const PremiumAppBar(title: Text('Diet plan')), body: Center(child: PremiumButton(text: 'Retry', onPressed: _reload)));
    final published = _version?['status'] == 'published';
    final isCurrentlyActive = _plan!['is_currently_active'] == true || _plan!['is_currently_active'] == 1;
    final totalMeals = _meals.length;

    return PremiumScaffold(
      appBar: PremiumAppBar(
        title: Text(_plan!['name']?.toString() ?? 'Diet plan'),
        actions: [
          IconButton(onPressed: _editPlan, icon: const Icon(Icons.edit_outlined), tooltip: 'Edit plan details'),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (value) { if (value == 'activate') _reviewAndActivate(); },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'activate', child: Text('Custom date activation...')),
            ],
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
        children: [
          // Spacious Hero Card
          PremiumCard(
            ambientGlow: true,
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        StatusBadge(
                          label: (_version?['status']?.toString() ?? 'DRAFT').toUpperCase(),
                          color: published ? colors.primary : colors.cyan,
                        ),
                        if (isCurrentlyActive) ...[
                          const SizedBox(width: 6),
                          StatusBadge(
                            label: 'ACTIVE',
                            color: colors.primary,
                          ),
                        ],
                      ],
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.restaurant_menu, size: 14, color: colors.textMuted),
                        const SizedBox(width: 4),
                        Text('$totalMeals Scheduled Meals', style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  _plan!['description']?.toString() ?? 'Configure daily meals, macro targets, portion sizes, and alternative food choices.',
                  style: TextStyle(color: colors.textSecondary, fontSize: 13.5, height: 1.45),
                ),
                const SizedBox(height: 14),
                if (isCurrentlyActive)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: colors.primaryMuted,
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      border: Border.all(color: colors.primary.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.check_circle, size: 16, color: colors.primary),
                        const SizedBox(width: 8),
                        Text(
                          'Currently Active Nutrition Plan',
                          style: TextStyle(color: colors.primary, fontWeight: FontWeight.w700, fontSize: 13),
                        ),
                      ],
                    ),
                  )
                else
                  SizedBox(
                    width: double.infinity,
                    child: PremiumButton(
                      text: 'Make Active Plan',
                      icon: const Icon(Icons.flash_on, size: 16),
                      height: 38,
                      onPressed: _makeActive,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),

          // Meals Section Header
          SectionHeader(
            title: 'MEALS ($totalMeals)',
            trailing: TextButton.icon(
              onPressed: _editMeal,
              icon: const Icon(Icons.add_circle_outline, size: 18),
              label: const Text('Add meal', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
          const SizedBox(height: 8),

          if (_meals.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: PremiumCard(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  children: [
                    Icon(Icons.restaurant, size: 40, color: colors.textMuted),
                    const SizedBox(height: 12),
                    Text('No meals configured yet', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700, fontSize: 15)),
                    const SizedBox(height: 6),
                    Text('Add your first meal slot (e.g. Breakfast, Lunch, Post-workout) to build your diet plan', textAlign: TextAlign.center, style: TextStyle(color: colors.textSecondary, fontSize: 12.5)),
                    const SizedBox(height: 16),
                    PremiumButton(text: 'Add meal', onPressed: _editMeal, icon: const Icon(Icons.add, size: 16)),
                  ],
                ),
              ),
            ),

          ..._meals.asMap().entries.map((mealEntry) {
            final mealIndex = mealEntry.key;
            final meal = mealEntry.value;
            final mealId = _id(meal['id']);
            final groups = ((meal['optionGroups'] ?? meal['option_groups']) as List?)?.whereType<Map>().map(Map<String, dynamic>.from).toList() ?? [];
            final scheduledTime = meal['scheduled_time'] ?? meal['meal_time'] ?? '';

            return Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: Container(
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: colors.border.withValues(alpha: 0.8)),
                ),
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Meal Header Row with Zero-Overflow & 1-Click Tap to Edit
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () => _editMeal(existing: meal),
                            borderRadius: BorderRadius.circular(AppRadii.sm),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  meal['name'] ?? 'Meal',
                                  style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w800, fontSize: 16),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 5),
                                Wrap(
                                  spacing: 6,
                                  runSpacing: 4,
                                  children: [
                                    if (scheduledTime.isNotEmpty)
                                      StatusBadge(label: scheduledTime, color: colors.cyan),
                                    if (meal['is_required'] == 1 || meal['isRequired'] == true)
                                      StatusBadge(label: 'REQUIRED', color: colors.primary),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        _buildActionCapsule(
                          colors: colors,
                          canMoveUp: mealIndex > 0,
                          canMoveDown: mealIndex < _meals.length - 1,
                          onUp: () => _reorderMeals(mealIndex, -1),
                          onDown: () => _reorderMeals(mealIndex, 1),
                          onEdit: () => _editMeal(existing: meal),
                          onDelete: () => _deleteMeal(meal),
                          editTooltip: 'Edit meal',
                          deleteTooltip: 'Delete meal',
                        ),
                      ],
                    ),

                    if ((meal['notes']?.toString() ?? '').isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: colors.surfaceElevated,
                          borderRadius: BorderRadius.circular(AppRadii.sm),
                          border: Border.all(color: colors.border.withValues(alpha: 0.6)),
                        ),
                        child: Text(meal['notes'].toString(), style: TextStyle(color: colors.textSecondary, fontSize: 12.5)),
                      ),
                    ],

                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'OPTION GROUPS (${groups.length})',
                            style: TextStyle(color: colors.textMuted, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        InkWell(
                          onTap: mealId == null ? null : () => _editGroup(mealId),
                          borderRadius: BorderRadius.circular(AppRadii.sm),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.add_circle_outline, size: 15, color: colors.primary),
                                const SizedBox(width: 4),
                                Text('Add group', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: colors.primary)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),

                    if (groups.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Text('No food option groups configured for this meal.', style: TextStyle(color: colors.textMuted, fontSize: 12.5)),
                      )
                    else
                      ...groups.asMap().entries.map((groupEntry) {
                        final groupIndex = groupEntry.key;
                        final group = groupEntry.value;
                        final groupId = _id(group['id']);
                        final options = ((group['options'] as List?) ?? const []).whereType<Map>().map(Map<String, dynamic>.from).toList();

                        return Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(AppSpacing.md),
                          decoration: BoxDecoration(
                            color: colors.surfaceElevated.withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: colors.border.withValues(alpha: 0.7)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Group Header with 1-Click Tap to Edit & Restyled Actions
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: InkWell(
                                      onTap: groupId == null ? null : () => _editGroup(mealId!, existing: group),
                                      borderRadius: BorderRadius.circular(AppRadii.sm),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            group['name'] ?? 'Option group',
                                            style: TextStyle(color: colors.primary, fontWeight: FontWeight.w800, fontSize: 14),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(height: 4),
                                          Wrap(
                                            spacing: 6,
                                            runSpacing: 4,
                                            children: [
                                              if (group['is_required'] == 1 || group['isRequired'] == true)
                                                StatusBadge(label: 'REQUIRED', color: colors.cyan),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: colors.card,
                                                  borderRadius: BorderRadius.circular(4),
                                                  border: Border.all(color: colors.border.withValues(alpha: 0.6)),
                                                ),
                                                child: Text(
                                                  'Min ${group['min_selection_count'] ?? group['min_selections'] ?? 1} • Max ${group['max_selection_count'] ?? group['max_selections'] ?? 1}',
                                                  style: TextStyle(color: colors.textSecondary, fontSize: 10.5, fontWeight: FontWeight.w600),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  _buildActionCapsule(
                                    colors: colors,
                                    canMoveUp: groupIndex > 0,
                                    canMoveDown: groupIndex < groups.length - 1,
                                    onUp: () => _reorderGroups(groups, groupIndex, -1),
                                    onDown: () => _reorderGroups(groups, groupIndex, 1),
                                    onEdit: groupId == null ? () {} : () => _editGroup(mealId!, existing: group),
                                    onDelete: () => _deleteGroup(group),
                                    editTooltip: 'Edit group',
                                    deleteTooltip: 'Delete group',
                                  ),
                                ],
                              ),

                              if ((group['notes']?.toString() ?? '').isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Text(group['notes'].toString(), style: TextStyle(color: colors.textSecondary, fontSize: 12)),
                              ],

                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      'FOOD OPTIONS (${options.length})',
                                      style: TextStyle(color: colors.textMuted, fontSize: 10.5, fontWeight: FontWeight.w700, letterSpacing: 0.4),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  InkWell(
                                    onTap: groupId == null ? null : () => _editOption(groupId),
                                    borderRadius: BorderRadius.circular(AppRadii.sm),
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(Icons.add, size: 14, color: colors.primary),
                                          const SizedBox(width: 3),
                                          Text('Add option', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: colors.primary)),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),

                              if (options.isEmpty)
                                Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 6),
                                  child: Text('No food options added to this group.', style: TextStyle(color: colors.textMuted, fontSize: 12)),
                                )
                              else
                                ...options.asMap().entries.map((optionEntry) {
                                  final optionIndex = optionEntry.key;
                                  final option = optionEntry.value;
                                  final foodLabel = option['food_name'] ?? option['custom_label'] ?? option['label'] ?? 'Food';
                                  final quantityVal = option['serving_quantity'] ?? option['quantity'] ?? '-';
                                  final cals = option['calories'] ?? option['calories_snapshot'];
                                  final protein = option['protein_g'] ?? option['protein_g_snapshot'];

                                  return Padding(
                                    padding: const EdgeInsets.only(top: 6),
                                    child: Material(
                                      color: colors.card,
                                      borderRadius: BorderRadius.circular(10),
                                      child: InkWell(
                                        onTap: groupId == null ? null : () => _editOption(groupId, existing: option),
                                        borderRadius: BorderRadius.circular(10),
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                          decoration: BoxDecoration(
                                            borderRadius: BorderRadius.circular(10),
                                            border: Border.all(color: colors.border.withValues(alpha: 0.7)),
                                          ),
                                          child: Row(
                                            children: [
                                              // Compact Reorder Arrows
                                              Column(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  InkWell(
                                                    onTap: optionIndex > 0 ? () => _reorderOptions(options, optionIndex, -1) : null,
                                                    child: Icon(
                                                      Icons.arrow_drop_up,
                                                      size: 18,
                                                      color: optionIndex > 0 ? colors.textSecondary : colors.textMuted.withValues(alpha: 0.3),
                                                    ),
                                                  ),
                                                  InkWell(
                                                    onTap: optionIndex < options.length - 1 ? () => _reorderOptions(options, optionIndex, 1) : null,
                                                    child: Icon(
                                                      Icons.arrow_drop_down,
                                                      size: 18,
                                                      color: optionIndex < options.length - 1 ? colors.textSecondary : colors.textMuted.withValues(alpha: 0.3),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(width: 8),
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Text(
                                                      foodLabel.toString(),
                                                      style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700, fontSize: 13.5),
                                                      maxLines: 1,
                                                      overflow: TextOverflow.ellipsis,
                                                    ),
                                                    const SizedBox(height: 2),
                                                    Wrap(
                                                      spacing: 6,
                                                      runSpacing: 2,
                                                      children: [
                                                        Text('${quantityVal}g', style: TextStyle(color: colors.textSecondary, fontSize: 11.5, fontWeight: FontWeight.w600)),
                                                        if (cals != null) Text('• $cals kcal', style: TextStyle(color: colors.textSecondary, fontSize: 11.5)),
                                                        if (protein != null) Text('• ${protein}g protein', style: TextStyle(color: colors.textSecondary, fontSize: 11.5)),
                                                      ],
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              const SizedBox(width: 4),
                                              IconButton(
                                                visualDensity: VisualDensity.compact,
                                                padding: EdgeInsets.zero,
                                                constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                                icon: const Icon(Icons.edit_outlined, size: 15),
                                                onPressed: groupId == null ? null : () => _editOption(groupId, existing: option),
                                                tooltip: 'Edit food option',
                                              ),
                                              IconButton(
                                                visualDensity: VisualDensity.compact,
                                                padding: EdgeInsets.zero,
                                                constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                                icon: Icon(Icons.delete_outline, size: 15, color: colors.rose),
                                                onPressed: () => _deleteOption(option),
                                                tooltip: 'Delete food option',
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
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

  Widget _buildActionCapsule({
    required AppThemeColors colors,
    required VoidCallback onUp,
    required VoidCallback onDown,
    required VoidCallback onEdit,
    required VoidCallback onDelete,
    bool canMoveUp = true,
    bool canMoveDown = true,
    String? editTooltip,
    String? deleteTooltip,
  }) {
    return Container(
      height: 32,
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border.withValues(alpha: 0.8)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Tooltip(
            message: 'Move up',
            child: InkWell(
              onTap: canMoveUp ? onUp : null,
              borderRadius: const BorderRadius.horizontal(left: Radius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 6),
                child: Icon(
                  Icons.keyboard_arrow_up,
                  size: 17,
                  color: canMoveUp ? colors.textSecondary : colors.textMuted.withValues(alpha: 0.35),
                ),
              ),
            ),
          ),
          Container(width: 1, height: 14, color: colors.border.withValues(alpha: 0.6)),
          Tooltip(
            message: 'Move down',
            child: InkWell(
              onTap: canMoveDown ? onDown : null,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 6),
                child: Icon(
                  Icons.keyboard_arrow_down,
                  size: 17,
                  color: canMoveDown ? colors.textSecondary : colors.textMuted.withValues(alpha: 0.35),
                ),
              ),
            ),
          ),
          Container(width: 1, height: 14, color: colors.border.withValues(alpha: 0.6)),
          Tooltip(
            message: editTooltip ?? 'Edit',
            child: InkWell(
              onTap: onEdit,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 6),
                child: Icon(Icons.edit_outlined, size: 15, color: colors.textSecondary),
              ),
            ),
          ),
          Container(width: 1, height: 14, color: colors.border.withValues(alpha: 0.6)),
          Tooltip(
            message: deleteTooltip ?? 'Delete',
            child: InkWell(
              onTap: onDelete,
              borderRadius: const BorderRadius.horizontal(right: Radius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 6),
                child: Icon(Icons.delete_outline, size: 15, color: colors.rose),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

