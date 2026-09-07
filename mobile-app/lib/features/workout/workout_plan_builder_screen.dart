import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';
import 'workout_exercise_editor_modal.dart';

class WorkoutPlanBuilderScreen extends StatefulWidget {
  final ApiClient apiClient;
  final int planId;

  const WorkoutPlanBuilderScreen({super.key, required this.apiClient, required this.planId});

  @override
  State<WorkoutPlanBuilderScreen> createState() => _WorkoutPlanBuilderScreenState();
}


class _WorkoutPlanBuilderScreenState extends State<WorkoutPlanBuilderScreen> {
  Map<String, dynamic>? _plan;
  bool _loading = true;
  String? _error;

  List<Map<String, dynamic>> get _days => ((_plan?['version']?['days'] as List?) ?? const [])
      .whereType<Map>()
      .map((day) => Map<String, dynamic>.from(day))
      .toList();

  Map<String, dynamic>? get _version => _plan?['version'] is Map
      ? Map<String, dynamic>.from(_plan!['version'] as Map)
      : null;

  int? _asInt(dynamic value) => value is num ? value.toInt() : int.tryParse('$value');

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    if (mounted) setState(() { _loading = true; _error = null; });
    try {
      final response = await widget.apiClient.get('/me/workout-plans/${widget.planId}');
      final raw = response is Map && response['data'] is Map ? response['data'] as Map : response as Map;
      final plan = Map<String, dynamic>.from(raw);
      final versions = (plan['versions'] as List?)?.whereType<Map>().toList() ?? const [];
      Map<String, dynamic>? version = plan['version'] is Map ? Map<String, dynamic>.from(plan['version']) : null;
      version ??= versions.cast<Map<String, dynamic>?>().firstWhere(
        (item) => item?['status'] == 'draft',
        orElse: () => versions.isEmpty ? null : Map<String, dynamic>.from(versions.first),
      );
      final versionId = _asInt(version?['id']);
      if (versionId != null) {
        final detail = await widget.apiClient.get('/me/workout-plans/${widget.planId}/versions/$versionId');
        if (detail is Map) {
          version = Map<String, dynamic>.from(detail['data'] is Map ? detail['data'] as Map : detail);
        }
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
      if (mounted) showPremiumSnackBar(context, success);
    } catch (error) {
      if (mounted) showPremiumSnackBar(context, '$error'.replaceAll('Exception: ', ''), isError: true);
    }
  }

  Future<void> _editPlan() async {
    final name = TextEditingController(text: _plan?['name']?.toString() ?? '');
    final description = TextEditingController(text: _plan?['description']?.toString() ?? '');
    final goal = TextEditingController(text: _plan?['goal']?.toString() ?? _plan?['goal_category']?.toString() ?? '');
    final saved = await _formDialog('Edit Workout Plan', [
      PremiumTextField(label: 'Plan name', controller: name),
      const SizedBox(height: 12),
      PremiumTextField(label: 'Description', controller: description, maxLines: 2),
      const SizedBox(height: 12),
      PremiumTextField(label: 'Goal / focus', controller: goal),
    ]);
    final payload = {
      'name': name.text.trim(),
      'description': description.text.trim(),
      'goalCategory': goal.text.trim(),
    };
    if (saved != true) return;
    await _mutate(() async {
      await widget.apiClient.patch('/me/workout-plans/${widget.planId}', body: payload);
    }, 'Workout plan updated');
  }

  Future<bool?> _formDialog(String title, List<Widget> fields) => showPremiumDialog<bool>(
        context: context,
        builder: (dialogContext) {
          final colors = AppThemeColors.of(dialogContext);
          return AlertDialog(
            backgroundColor: colors.card,
            title: Text(title, style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w800)),
            content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: fields)),
            actions: [
              PremiumButton(text: 'Cancel', isSecondary: true, onPressed: () => Navigator.pop(dialogContext, false)),
              PremiumButton(text: 'Save', onPressed: () => Navigator.pop(dialogContext, true)),
            ],
          );
        },
      );

  Future<void> _createWeek() async {
    final versionId = _asInt(_version?['id']);
    if (versionId == null) return;
    const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    await _mutate(() async {
      for (var index = 0; index < names.length; index++) {
        await widget.apiClient.post('/me/workout-plans/${widget.planId}/versions/$versionId/days', body: {
          'weekdayNumber': index + 1,
          'orderIndex': index + 1,
          'name': names[index],
          'isRestDay': index == 2 || index == 5 || index == 6,
        });
      }
    }, 'Seven-day schedule created');
  }

  Future<void> _editDay({Map<String, dynamic>? existing}) async {
    final versionId = _asInt(_version?['id']);
    if (versionId == null) return;
    final name = TextEditingController(text: existing?['name']?.toString() ?? '');
    final notes = TextEditingController(text: existing?['notes']?.toString() ?? '');
    var weekday = _asInt(existing?['weekday'] ?? existing?['weekday_number']) ?? 1;
    var rest = existing?['is_rest_day'] == 1 || existing?['isRestDay'] == true;
    final saved = await showPremiumDialog<bool>(
      context: context,
      builder: (dialogContext) {
        final colors = AppThemeColors.of(dialogContext);
        return StatefulBuilder(builder: (context, setState) => AlertDialog(
          backgroundColor: colors.card,
          title: Text(existing == null ? 'Add workout day' : 'Edit workout day', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w800)),
          content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
            PremiumTextField(label: 'Day name', controller: name),
            const SizedBox(height: 12),
            DropdownButtonFormField<int>(
              initialValue: weekday,
              items: List.generate(7, (index) => DropdownMenuItem(value: index + 1, child: Text('Day ${index + 1}'))),
              onChanged: (value) => setState(() => weekday = value ?? weekday),
            ),
            SwitchListTile(title: const Text('Rest day'), value: rest, onChanged: (value) => setState(() => rest = value)),
            PremiumTextField(label: 'Day notes', controller: notes, maxLines: 2),
          ])),
          actions: [
            PremiumButton(text: 'Cancel', isSecondary: true, onPressed: () => Navigator.pop(dialogContext, false)),
            PremiumButton(text: 'Save', onPressed: () => Navigator.pop(dialogContext, true)),
          ],
        ));
      },
    );
    final dayId = _asInt(existing?['id']);
    final payload = {'name': name.text.trim(), 'isRestDay': rest, 'notes': notes.text.trim(), 'orderIndex': _asInt(existing?['order_index']) ?? weekday};
    if (saved != true || payload['name'] == '') return;
    await _mutate(() async {
      if (dayId == null) {
        await widget.apiClient.post('/me/workout-plans/${widget.planId}/versions/$versionId/days', body: {...payload, 'weekdayNumber': weekday});
      } else {
        await widget.apiClient.patch('/me/workout-plans/${widget.planId}/days/$dayId', body: payload);
      }
    }, existing == null ? 'Workout day added' : 'Workout day updated');
  }

  Future<void> _deleteDay(Map<String, dynamic> day) async {
    final id = _asInt(day['id']);
    if (id == null) return;
    await _mutate(() => widget.apiClient.delete('/me/workout-plans/${widget.planId}/days/$id').then((_) {}), 'Workout day deleted');
  }

  Future<void> _reorderDay(int index, int delta) async {
    final days = _days;
    final target = index + delta;
    if (target < 0 || target >= days.length) return;
    final first = _asInt(days[index]['id']);
    final second = _asInt(days[target]['id']);
    if (first == null || second == null) return;
    await _mutate(() async {
      await widget.apiClient.patch('/me/workout-plans/${widget.planId}/days/$first', body: {'orderIndex': target + 1});
      await widget.apiClient.patch('/me/workout-plans/${widget.planId}/days/$second', body: {'orderIndex': index + 1});
    }, 'Day order updated');
  }

  Future<void> _editExercise(int dayId, {Map<String, dynamic>? existing, String? dayName}) async {
    final updated = await WorkoutExerciseEditorModal.show(
      context,
      apiClient: widget.apiClient,
      planId: widget.planId,
      dayId: dayId,
      dayName: dayName,
      existing: existing,
    );
    if (updated == true) {
      await _reload();
    }
  }

  Future<void> _deleteExercise(Map<String, dynamic> exercise) async {
    final id = _asInt(exercise['id']);
    if (id == null) return;
    await _mutate(() => widget.apiClient.delete('/me/workout-plans/${widget.planId}/exercises/$id').then((_) {}), 'Exercise deleted');
  }

  Future<void> _reorderExercise(Map<String, dynamic> day, int index, int delta) async {
    final exercises = (day['exercises'] as List?)?.whereType<Map>().map(Map<String, dynamic>.from).toList() ?? [];
    final target = index + delta;
    if (target < 0 || target >= exercises.length) return;
    final first = _asInt(exercises[index]['id']);
    final second = _asInt(exercises[target]['id']);
    if (first == null || second == null) return;
    await _mutate(() async {
      await widget.apiClient.patch('/me/workout-plans/${widget.planId}/exercises/$first', body: {'orderIndex': target + 1});
      await widget.apiClient.patch('/me/workout-plans/${widget.planId}/exercises/$second', body: {'orderIndex': index + 1});
    }, 'Exercise order updated');
  }

  Future<void> _reviewAndActivate() async {
    await _reload();
    if (!mounted) return;
    final version = _version;
    final days = _days;
    final exercises = days.fold<int>(0, (count, day) => count + ((day['exercises'] as List?)?.length ?? 0));
    final confirmed = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: const Text('Review and activate'),
      content: Text('${days.length} days and $exercises exercises are saved in the API. Activate this published version?'),
      actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Activate'))],
    ));
    if (confirmed != true || version?['status'] != 'published') return;
    if (!mounted) return;
    final date = await showDatePicker(context: context, initialDate: DateTime.now(), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 1825)));
    if (date == null) return;
    final value = '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    await _mutate(() => widget.apiClient.post('/me/workout-plans/${widget.planId}/activate', body: {'effectiveFrom': value}).then((_) {}), 'Workout plan activated');
  }

  Future<void> _publish() async {
    final versionId = _asInt(_version?['id']);
    if (versionId == null) return;
    await _mutate(() => widget.apiClient.post('/me/workout-plans/${widget.planId}/versions/$versionId/publish').then((_) {}), 'Workout version published');
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    if (_loading) return const PremiumScaffold(body: Center(child: CircularProgressIndicator()));
    if (_error != null || _plan == null) return PremiumScaffold(appBar: const PremiumAppBar(title: Text('Workout plan')), body: Center(child: PremiumButton(text: 'Retry', onPressed: _reload)));
    final name = _plan!['name']?.toString() ?? 'Workout plan';
    final published = _version?['status'] == 'published';
    final days = _days;
    return PremiumScaffold(
      appBar: PremiumAppBar(title: Text(name), actions: [IconButton(onPressed: _editPlan, icon: const Icon(Icons.edit)), PopupMenuButton<String>(onSelected: (value) { if (value == 'publish') _publish(); if (value == 'activate') _reviewAndActivate(); if (value == 'clone') widget.apiClient.post('/me/workout-plans/${widget.planId}/clone').then((_) => _reload()); }, itemBuilder: (_) => [if (!published) const PopupMenuItem(value: 'publish', child: Text('Publish')), if (published) const PopupMenuItem(value: 'activate', child: Text('Review & activate')), const PopupMenuItem(value: 'clone', child: Text('Clone as draft'))])]),
      body: ListView(padding: const EdgeInsets.all(AppSpacing.md), children: [
        PremiumCard(child: Row(children: [Expanded(child: Text(_plan!['description']?.toString() ?? 'Configure your complete weekly workout.', style: TextStyle(color: colors.textSecondary))), const SizedBox(width: 8), Chip(label: Text((_version?['status']?.toString() ?? 'draft').toUpperCase()))])),
        const SizedBox(height: 14),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('SEVEN-DAY SCHEDULE (${days.length}/7)', style: TextStyle(color: colors.textSecondary, fontWeight: FontWeight.w800)), TextButton.icon(onPressed: _editDay, icon: const Icon(Icons.add, size: 16), label: const Text('Add day'))]),
        if (days.isEmpty) PremiumCard(child: Column(children: [const Text('Start with a full weekly schedule.'), const SizedBox(height: 10), PremiumButton(text: 'Create 7 days', onPressed: _createWeek)])),
        ...days.asMap().entries.map((entry) {
          final dayIndex = entry.key;
          final day = entry.value;
          final dayId = _asInt(day['id']);
          final exercises = (day['exercises'] as List?)?.whereType<Map>().map(Map<String, dynamic>.from).toList() ?? [];
          final restDay = day['is_rest_day'] == 1 || day['isRestDay'] == true;
          return Padding(padding: const EdgeInsets.only(bottom: 12), child: PremiumCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Expanded(child: Text('${day['name'] ?? 'Day'}${restDay ? ' • REST' : ''}', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w800, fontSize: 16))), IconButton(onPressed: () => _reorderDay(dayIndex, -1), icon: const Icon(Icons.keyboard_arrow_up)), IconButton(onPressed: () => _reorderDay(dayIndex, 1), icon: const Icon(Icons.keyboard_arrow_down)), IconButton(onPressed: () => _editDay(existing: day), icon: const Icon(Icons.edit_outlined)), IconButton(onPressed: () => _deleteDay(day), icon: Icon(Icons.delete_outline, color: colors.rose))]),
            if ((day['notes']?.toString() ?? '').isNotEmpty) Text(day['notes'].toString(), style: TextStyle(color: colors.textSecondary)),
            Align(alignment: Alignment.centerRight, child: TextButton.icon(onPressed: dayId == null ? null : () => _editExercise(dayId, dayName: day['name']?.toString()), icon: const Icon(Icons.add, size: 16), label: const Text('Add exercise'))),
            if (!restDay) ...exercises.asMap().entries.map((exerciseEntry) {
              final index = exerciseEntry.key;
              final exercise = exerciseEntry.value;
              final setCount = exercise['target_sets'] ?? (exercise['sets'] as List?)?.length ?? 0;
              final reps = exercise['target_reps_min'] ?? exercise['reps_min'];
              final maxReps = exercise['target_reps_max'] ?? exercise['reps_max'];
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('${exercise['exercise_name'] ?? exercise['name'] ?? 'Exercise'}${exercise['is_optional'] == 1 ? ' (optional)' : ''}'),
                subtitle: Text('$setCount sets • ${reps ?? '-'}${maxReps != null ? '-$maxReps' : ''} reps${exercise['target_duration_seconds'] != null ? ' • ${exercise['target_duration_seconds']} sec' : ''}'),
                leading: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(visualDensity: VisualDensity.compact, padding: EdgeInsets.zero, constraints: const BoxConstraints(), icon: const Icon(Icons.arrow_upward, size: 16), onPressed: () => _reorderExercise(day, index, -1)),
                    const SizedBox(width: 4),
                    IconButton(visualDensity: VisualDensity.compact, padding: EdgeInsets.zero, constraints: const BoxConstraints(), icon: const Icon(Icons.arrow_downward, size: 16), onPressed: () => _reorderExercise(day, index, 1)),
                  ],
                ),
                trailing: Wrap(children: [IconButton(onPressed: dayId == null ? null : () => _editExercise(dayId, existing: exercise, dayName: day['name']?.toString()), icon: const Icon(Icons.edit_outlined)), IconButton(onPressed: () => _deleteExercise(exercise), icon: Icon(Icons.delete_outline, color: colors.rose))]),
              );
            }) else Padding(padding: const EdgeInsets.all(8), child: Text('Rest day — no exercises scheduled.', style: TextStyle(color: colors.textMuted))),
          ])));
        }),
      ]),
    );
  }
}
