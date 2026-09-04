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
        if (detail is Map && detail['data'] is Map) version = Map<String, dynamic>.from(detail['data'] as Map);
      }
      plan['version'] = version;
      if (mounted) setState(() { _plan = plan; _loading = false; });
    } catch (error) {
      if (mounted) setState(() { _error = '$error'.replaceAll('Exception: ', ''); _loading = false; });
    }
  }

  Future<void> _mutate(Future<void> Function() action, String success) async {
    try { await action(); await _reload(); if (mounted) showPremiumSnackBar(context, success); }
    catch (error) { if (mounted) showPremiumSnackBar(context, '$error'.replaceAll('Exception: ', ''), isError: true); }
  }

  Future<bool?> _dialog(String title, List<Widget> children) => showPremiumDialog<bool>(
    context: context,
    builder: (dialogContext) {
      final colors = AppThemeColors.of(dialogContext);
      return AlertDialog(
        backgroundColor: colors.card,
        title: Text(title, style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w800)),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: children)),
        actions: [PremiumButton(text: 'Cancel', isSecondary: true, onPressed: () => Navigator.pop(dialogContext, false)), PremiumButton(text: 'Save', onPressed: () => Navigator.pop(dialogContext, true))],
      );
    },
  );

  Future<void> _editPlan() async {
    final name = TextEditingController(text: _plan?['name']?.toString() ?? '');
    final description = TextEditingController(text: _plan?['description']?.toString() ?? '');
    final saved = await _dialog('Edit diet plan', [PremiumTextField(label: 'Plan name', controller: name), const SizedBox(height: 12), PremiumTextField(label: 'Description', controller: description, maxLines: 2)]);
    final payload = {'name': name.text.trim(), 'description': description.text.trim()};
    name.dispose(); description.dispose();
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
    final saved = await showPremiumDialog<bool>(context: context, builder: (dialogContext) {
      return StatefulBuilder(builder: (context, setState) => AlertDialog(
        title: Text(existing == null ? 'Add meal' : 'Edit meal'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [PremiumTextField(label: 'Meal name', controller: name), PremiumTextField(label: 'Time', controller: time), SwitchListTile(title: const Text('Required meal'), value: required, onChanged: (value) => setState(() => required = value)), PremiumTextField(label: 'Meal notes', controller: notes, maxLines: 2)]),
        actions: [PremiumButton(text: 'Cancel', isSecondary: true, onPressed: () => Navigator.pop(dialogContext, false)), PremiumButton(text: 'Save', onPressed: () => Navigator.pop(dialogContext, true))],
      ));
    });
    final mealId = _id(existing?['id']);
    final payload = {'name': name.text.trim(), 'scheduledTime': time.text.trim(), 'notes': notes.text.trim(), 'isRequired': required};
    name.dispose(); time.dispose(); notes.dispose();
    if (saved != true || payload['name'] == '') return;
    await _mutate(() async {
      if (mealId == null) await widget.apiClient.post('/me/diet-plans/${widget.planId}/versions/$versionId/meals', body: payload);
      else await widget.apiClient.patch('/me/diet-plans/${widget.planId}/meals/$mealId', body: payload);
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
    final saved = await showPremiumDialog<bool>(context: context, builder: (dialogContext) => StatefulBuilder(builder: (context, setState) => AlertDialog(
      title: Text(existing == null ? 'Add option group' : 'Edit option group'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [PremiumTextField(label: 'Group name', controller: name), SwitchListTile(title: const Text('Required group'), value: required, onChanged: (value) => setState(() => required = value)), Row(children: [Expanded(child: PremiumTextField(label: 'Minimum', controller: min, keyboardType: TextInputType.number)), const SizedBox(width: 8), Expanded(child: PremiumTextField(label: 'Maximum', controller: max, keyboardType: TextInputType.number))]), PremiumTextField(label: 'Group notes', controller: notes, maxLines: 2)]),
      actions: [PremiumButton(text: 'Cancel', isSecondary: true, onPressed: () => Navigator.pop(dialogContext, false)), PremiumButton(text: 'Save', onPressed: () => Navigator.pop(dialogContext, true))],
    )));
    final groupId = _id(existing?['id']);
    final payload = {'name': name.text.trim(), 'isRequired': required, 'minSelections': int.tryParse(min.text) ?? 0, 'maxSelections': int.tryParse(max.text) ?? 1, 'notes': notes.text.trim()};
    name.dispose(); min.dispose(); max.dispose(); notes.dispose();
    if (saved != true || payload['name'] == '') return;
    await _mutate(() async { if (groupId == null) await widget.apiClient.post('/me/diet-plans/${widget.planId}/meals/$mealId/groups', body: payload); else await widget.apiClient.put('/me/diet-plans/${widget.planId}/option-groups/$groupId', body: payload); }, existing == null ? 'Option group added' : 'Option group updated');
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
    var foodId = _id(existing?['food_id']) ?? (foods.isNotEmpty ? _id(foods.first['id']) : null);
    final quantity = TextEditingController(text: '${existing?['serving_quantity'] ?? existing?['quantity'] ?? 100}');
    final label = TextEditingController(text: existing?['custom_label']?.toString() ?? existing?['label']?.toString() ?? '');
    final notes = TextEditingController(text: existing?['notes']?.toString() ?? '');
    final saved = await _dialogWithState('Add food option', (setState) => [
      if (foods.isEmpty) const Text('No foods are available in the catalog.') else DropdownButtonFormField<int>(initialValue: foodId, isExpanded: true, items: foods.map((food) => DropdownMenuItem<int>(value: _id(food['id']), child: Text('${food['name'] ?? 'Food'}'))).toList(), onChanged: (value) => setState(() => foodId = value), decoration: const InputDecoration(labelText: 'Food (nutrition is calculated by server)')),
      PremiumTextField(label: 'Custom label', controller: label),
      PremiumTextField(label: 'Quantity', controller: quantity, keyboardType: TextInputType.number),
      PremiumTextField(label: 'Notes / alternative guidance', controller: notes, maxLines: 2),
    ]);
    final optionId = _id(existing?['id']);
    final payload = {'foodId': foodId, 'customLabel': label.text.trim(), 'servingQuantity': double.tryParse(quantity.text) ?? 100, 'notes': notes.text.trim()};
    quantity.dispose(); label.dispose(); notes.dispose();
    if (saved != true || foodId == null) return;
    await _mutate(() async { if (optionId == null) await widget.apiClient.post('/me/diet-plans/${widget.planId}/option-groups/$groupId/options', body: payload); else await widget.apiClient.put('/me/diet-plans/${widget.planId}/options/$optionId', body: payload); }, existing == null ? 'Food option added' : 'Food option updated');
  }

  Future<bool?> _dialogWithState(String title, List<Widget> Function(void Function(void Function())) children) => showPremiumDialog<bool>(context: context, builder: (dialogContext) {
    return StatefulBuilder(builder: (context, setState) => AlertDialog(title: Text(title), content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: children(setState))), actions: [PremiumButton(text: 'Cancel', isSecondary: true, onPressed: () => Navigator.pop(dialogContext, false)), PremiumButton(text: 'Save', onPressed: () => Navigator.pop(dialogContext, true))]));
  });

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
    final confirmed = await showDialog<bool>(context: context, builder: (context) => AlertDialog(title: const Text('Review and activate'), content: Text('${_meals.length} meals and $groups option groups are saved in the API. Activate this published version?'), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Activate'))]));
    if (confirmed != true || _version?['status'] != 'published') return;
    final date = await showDatePicker(context: context, initialDate: DateTime.now(), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 1825))); if (date == null) return;
    final value = '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    await _mutate(() => widget.apiClient.post('/me/diet-plans/${widget.planId}/activate', body: {'effectiveFrom': value}).then((_) {}), 'Diet plan activated');
  }

  Future<void> _publish() async { final id = _id(_version?['id']); if (id == null) return; await _mutate(() => widget.apiClient.post('/me/diet-plans/${widget.planId}/versions/$id/publish').then((_) {}), 'Diet version published'); }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    if (_loading) return const PremiumScaffold(body: Center(child: CircularProgressIndicator()));
    if (_error != null || _plan == null) return PremiumScaffold(appBar: const PremiumAppBar(title: Text('Diet plan')), body: Center(child: PremiumButton(text: 'Retry', onPressed: _reload)));
    final published = _version?['status'] == 'published';
    return PremiumScaffold(appBar: PremiumAppBar(title: Text(_plan!['name']?.toString() ?? 'Diet plan'), actions: [IconButton(onPressed: _editPlan, icon: const Icon(Icons.edit)), PopupMenuButton<String>(onSelected: (value) { if (value == 'publish') _publish(); if (value == 'activate') _reviewAndActivate(); }, itemBuilder: (_) => [if (!published) const PopupMenuItem(value: 'publish', child: Text('Publish')), if (published) const PopupMenuItem(value: 'activate', child: Text('Review & activate'))])]), body: ListView(padding: const EdgeInsets.all(AppSpacing.md), children: [
      PremiumCard(child: Text(_plan!['description']?.toString() ?? 'Configure meals, alternatives, servings, and nutrition.', style: TextStyle(color: colors.textSecondary))),
      const SizedBox(height: 14),
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('MEALS (${_meals.length})', style: TextStyle(color: colors.textSecondary, fontWeight: FontWeight.w800)), TextButton.icon(onPressed: _editMeal, icon: const Icon(Icons.add, size: 16), label: const Text('Add meal'))]),
      ..._meals.asMap().entries.map((mealEntry) {
        final mealIndex = mealEntry.key; final meal = mealEntry.value; final mealId = _id(meal['id']);
        final groups = ((meal['optionGroups'] ?? meal['option_groups']) as List?)?.whereType<Map>().map(Map<String, dynamic>.from).toList() ?? [];
        return Padding(padding: const EdgeInsets.only(bottom: 12), child: PremiumCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Expanded(child: Text('${meal['name'] ?? 'Meal'}${meal['is_required'] == 1 ? ' • REQUIRED' : ''}', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w800, fontSize: 16))), IconButton(onPressed: () => _reorderMeals(mealIndex, -1), icon: const Icon(Icons.keyboard_arrow_up)), IconButton(onPressed: () => _reorderMeals(mealIndex, 1), icon: const Icon(Icons.keyboard_arrow_down)), IconButton(onPressed: () => _editMeal(existing: meal), icon: const Icon(Icons.edit_outlined)), IconButton(onPressed: () => _deleteMeal(meal), icon: Icon(Icons.delete_outline, color: colors.rose))]),
          if ((meal['notes']?.toString() ?? '').isNotEmpty) Text(meal['notes'].toString(), style: TextStyle(color: colors.textSecondary)),
          Align(alignment: Alignment.centerRight, child: TextButton.icon(onPressed: mealId == null ? null : () => _editGroup(mealId), icon: const Icon(Icons.add, size: 16), label: const Text('Add group'))),
          ...groups.asMap().entries.map((groupEntry) {
            final group = groupEntry.value; final groupId = _id(group['id']); final options = ((group['options'] as List?) ?? const []).whereType<Map>().map(Map<String, dynamic>.from).toList();
            return Container(margin: const EdgeInsets.only(bottom: 8), padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: colors.surfaceElevated, borderRadius: BorderRadius.circular(8), border: Border.all(color: colors.border)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(mainAxisAlignment: MainAxisAlignment.end, children: [IconButton(onPressed: () => _reorderGroups(groups, groupEntry.key, -1), icon: const Icon(Icons.keyboard_arrow_up, size: 18)), IconButton(onPressed: () => _reorderGroups(groups, groupEntry.key, 1), icon: const Icon(Icons.keyboard_arrow_down, size: 18))]),
              Row(children: [Expanded(child: Text('${group['name'] ?? 'Option group'}${group['is_required'] == 1 ? ' • REQUIRED' : ''}', style: TextStyle(color: colors.cyan, fontWeight: FontWeight.w700))), IconButton(onPressed: groupId == null ? null : () => _editGroup(mealId!, existing: group), icon: const Icon(Icons.edit_outlined)), IconButton(onPressed: () => _deleteGroup(group), icon: Icon(Icons.delete_outline, color: colors.rose))]),
              if ((group['notes']?.toString() ?? '').isNotEmpty) Text(group['notes'].toString(), style: TextStyle(color: colors.textSecondary)),
              Align(alignment: Alignment.centerRight, child: TextButton.icon(onPressed: groupId == null ? null : () => _editOption(groupId), icon: const Icon(Icons.add, size: 16), label: const Text('Add food option'))),
              ...options.asMap().entries.map((optionEntry) { final option = optionEntry.value; return ListTile(contentPadding: EdgeInsets.zero, title: Text('${option['food_name'] ?? option['custom_label'] ?? option['label'] ?? 'Food'}'), subtitle: Text('${option['serving_quantity'] ?? option['quantity'] ?? '-'} • ${option['calories'] ?? '-'} kcal • ${option['protein_g'] ?? '-'}g protein'), leading: Column(mainAxisAlignment: MainAxisAlignment.center, children: [IconButton(onPressed: () => _reorderOptions(options, optionEntry.key, -1), icon: const Icon(Icons.arrow_upward, size: 16)), IconButton(onPressed: () => _reorderOptions(options, optionEntry.key, 1), icon: const Icon(Icons.arrow_downward, size: 16))]), trailing: Wrap(children: [IconButton(onPressed: groupId == null ? null : () => _editOption(groupId, existing: option), icon: const Icon(Icons.edit_outlined)), IconButton(onPressed: () => _deleteOption(option), icon: Icon(Icons.delete_outline, color: colors.rose))])); }),
            ]));
          }),
        ])));
      }),
    ]));
  }
}
