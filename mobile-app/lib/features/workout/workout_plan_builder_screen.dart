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
              Text(
                title,
                style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.w800),
              ),
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
                  Expanded(
                    child: PremiumButton(
                      text: 'Cancel',
                      isSecondary: true,
                      onPressed: () => Navigator.pop(sheetContext, false),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: PremiumButton(
                      text: 'Save',
                      onPressed: () => Navigator.pop(sheetContext, true),
                    ),
                  ),
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
    final goal = TextEditingController(text: _plan?['goal']?.toString() ?? _plan?['goal_category']?.toString() ?? '');
    final saved = await _showFormSheet('Edit Workout Plan', [
      PremiumTextField(label: 'Plan name', controller: name),
      const SizedBox(height: 14),
      PremiumTextField(label: 'Description', controller: description, maxLines: 3),
      const SizedBox(height: 14),
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
                  Text(
                    existing == null ? 'Add workout day' : 'Edit workout day',
                    style: TextStyle(color: colors.textPrimary, fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Flexible(
                    child: SingleChildScrollView(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          PremiumTextField(label: 'Day name', controller: name),
                          const SizedBox(height: 14),
                          DropdownButtonFormField<int>(
                            initialValue: weekday,
                            dropdownColor: colors.card,
                            decoration: InputDecoration(
                              labelText: 'Weekday',
                              filled: true,
                              fillColor: colors.surfaceElevated,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadii.md), borderSide: BorderSide(color: colors.border)),
                              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadii.md), borderSide: BorderSide(color: colors.border)),
                            ),
                            items: List.generate(7, (index) => DropdownMenuItem(value: index + 1, child: Text('Day ${index + 1}'))),
                            onChanged: (value) => setSheetState(() => weekday = value ?? weekday),
                          ),
                          const SizedBox(height: 10),
                          Material(
                            color: Colors.transparent,
                            child: SwitchListTile(
                              title: Text('Rest day', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600)),
                              subtitle: Text('No workouts or exercises scheduled for this day', style: TextStyle(color: colors.textSecondary, fontSize: 12)),
                              value: rest,
                              onChanged: (value) => setSheetState(() => rest = value),
                            ),
                          ),
                          const SizedBox(height: 14),
                          PremiumTextField(label: 'Day notes', controller: notes, maxLines: 2),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Row(
                    children: [
                      Expanded(
                        child: PremiumButton(
                          text: 'Cancel',
                          isSecondary: true,
                          onPressed: () => Navigator.pop(sheetContext, false),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: PremiumButton(
                          text: 'Save',
                          onPressed: () => Navigator.pop(sheetContext, true),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
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
    final days = _days;
    final exercises = days.fold<int>(0, (count, day) => count + ((day['exercises'] as List?)?.length ?? 0));

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
                title: 'PLAN SUMMARY',
                value: '${days.length} Days • $exercises Exercises',
                subtitle: 'Saved & ready in backend API',
                icon: Icons.fitness_center,
                accentColor: colors.primary,
              ),
              const SizedBox(height: 16),
              Text(
                'Activate this plan version as your active routine starting from your selected date?',
                style: TextStyle(color: colors.textSecondary, fontSize: 13, height: 1.4),
              ),
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
    final date = await showDatePicker(context: context, initialDate: DateTime.now(), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 1825)));
    if (date == null) return;
    final value = '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    await _mutate(() => widget.apiClient.post('/me/workout-plans/${widget.planId}/activate', body: {'effectiveFrom': value}).then((_) {}), 'Workout plan activated');
  }

  Future<void> _makeActive() async {
    final now = DateTime.now();
    final today = '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    await _mutate(() => widget.apiClient.post('/me/workout-plans/${widget.planId}/activate', body: {'effectiveFrom': today}).then((_) {}), 'Workout plan activated as your current agenda');
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    if (_loading) return const PremiumScaffold(body: Center(child: CircularProgressIndicator()));
    if (_error != null || _plan == null) return PremiumScaffold(appBar: const PremiumAppBar(title: Text('Workout plan')), body: Center(child: PremiumButton(text: 'Retry', onPressed: _reload)));

    final name = _plan!['name']?.toString() ?? 'Workout plan';
    final published = _version?['status'] == 'published';
    final isCurrentlyActive = _plan!['is_currently_active'] == true || _plan!['is_currently_active'] == 1;
    final days = _days;
    final totalExercises = days.fold<int>(0, (sum, day) => sum + ((day['exercises'] as List?)?.length ?? 0));

    return PremiumScaffold(
      appBar: PremiumAppBar(
        title: Text(name),
        actions: [
          IconButton(onPressed: _editPlan, icon: const Icon(Icons.edit_outlined), tooltip: 'Edit plan details'),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (value) {
              if (value == 'activate') _reviewAndActivate();
              if (value == 'clone') widget.apiClient.post('/me/workout-plans/${widget.planId}/clone').then((_) => _reload());
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'activate', child: Text('Custom date activation...')),
              const PopupMenuItem(value: 'clone', child: Text('Clone as draft')),
            ],
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.md),
        children: [
          // Spacious Hero Card
          PremiumCard(
            ambientGlow: true,
            padding: const EdgeInsets.all(AppSpacing.md),
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
                        Icon(Icons.calendar_today, size: 14, color: colors.textMuted),
                        const SizedBox(width: 4),
                        Text('${days.length} Days • $totalExercises Ex', style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  _plan!['description']?.toString() ?? 'Configure your complete weekly workout routine, sets, and rest times.',
                  style: TextStyle(color: colors.textSecondary, fontSize: 13, height: 1.4),
                ),
                if ((_plan!['goal'] ?? _plan!['goal_category'] ?? '').toString().isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: colors.surfaceElevated,
                          borderRadius: BorderRadius.circular(AppRadii.sm),
                          border: Border.all(color: colors.border),
                        ),
                        child: Text(
                          'Focus: ${(_plan!['goal'] ?? _plan!['goal_category']).toString().toUpperCase()}',
                          style: TextStyle(color: colors.primary, fontSize: 11, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 12),
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
                          'Currently Active Routine',
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
          const SizedBox(height: 14),

          // Schedule Section Header
          SectionHeader(
            title: 'SEVEN-DAY SCHEDULE (${days.length}/7)',
            trailing: TextButton.icon(
              onPressed: _editDay,
              icon: const Icon(Icons.add_circle_outline, size: 18),
              label: const Text('Add day', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
          const SizedBox(height: 4),

          if (days.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: PremiumCard(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  children: [
                    Icon(Icons.calendar_view_week, size: 40, color: colors.textMuted),
                    const SizedBox(height: 12),
                    Text('Start with a full weekly schedule', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700, fontSize: 15)),
                    const SizedBox(height: 6),
                    Text('Generate standard 7-day routine structure with rest days pre-filled', textAlign: TextAlign.center, style: TextStyle(color: colors.textSecondary, fontSize: 12.5)),
                    const SizedBox(height: 16),
                    PremiumButton(text: 'Create 7 days', onPressed: _createWeek, icon: const Icon(Icons.auto_awesome, size: 16)),
                  ],
                ),
              ),
            ),

          ...days.asMap().entries.map((entry) {
            final dayIndex = entry.key;
            final day = entry.value;
            final dayId = _asInt(day['id']);
            final exercises = (day['exercises'] as List?)?.whereType<Map>().map(Map<String, dynamic>.from).toList() ?? [];
            final restDay = day['is_rest_day'] == 1 || day['isRestDay'] == true;

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
                    // Day Card Top Bar with 1-Click Tap to Edit & Zero Overflow
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () => _editDay(existing: day),
                            borderRadius: BorderRadius.circular(AppRadii.sm),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${day['name'] ?? 'Day'}${restDay ? ' • REST' : ''}',
                                  style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w800, fontSize: 16),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                if (day['weekday'] != null) ...[
                                  const SizedBox(height: 5),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: colors.surfaceElevated,
                                      borderRadius: BorderRadius.circular(4),
                                      border: Border.all(color: colors.border.withValues(alpha: 0.6)),
                                    ),
                                    child: Text(
                                      'Day ${day['weekday']}',
                                      style: TextStyle(color: colors.textSecondary, fontSize: 10.5, fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        _buildActionCapsule(
                          colors: colors,
                          canMoveUp: dayIndex > 0,
                          canMoveDown: dayIndex < days.length - 1,
                          onUp: () => _reorderDay(dayIndex, -1),
                          onDown: () => _reorderDay(dayIndex, 1),
                          onEdit: () => _editDay(existing: day),
                          onDelete: () => _deleteDay(day),
                          editTooltip: 'Edit day',
                          deleteTooltip: 'Delete day',
                        ),
                      ],
                    ),

                    if ((day['notes']?.toString() ?? '').isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: colors.surfaceElevated,
                          borderRadius: BorderRadius.circular(AppRadii.sm),
                          border: Border.all(color: colors.border.withValues(alpha: 0.6)),
                        ),
                        child: Text(
                          day['notes'].toString(),
                          style: TextStyle(color: colors.textSecondary, fontSize: 12.5),
                        ),
                      ),
                    ],

                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'EXERCISES (${exercises.length})',
                            style: TextStyle(color: colors.textMuted, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        InkWell(
                          onTap: dayId == null ? null : () => _editExercise(dayId, dayName: day['name']?.toString()),
                          borderRadius: BorderRadius.circular(AppRadii.sm),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.add_circle_outline, size: 15, color: colors.primary),
                                const SizedBox(width: 4),
                                Text('Add exercise', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: colors.primary)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),

                    if (!restDay) ...[
                      if (exercises.isEmpty)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Center(
                            child: Text(
                              'No exercises added yet. Tap "Add exercise" above.',
                              style: TextStyle(color: colors.textMuted, fontSize: 12.5),
                            ),
                          ),
                        )
                      else
                        ...exercises.asMap().entries.map((exerciseEntry) {
                          final index = exerciseEntry.key;
                          final exercise = exerciseEntry.value;
                          final setCount = exercise['target_sets'] ?? (exercise['sets'] as List?)?.length ?? 0;
                          final reps = exercise['target_reps_min'] ?? exercise['reps_min'];
                          final maxReps = exercise['target_reps_max'] ?? exercise['reps_max'];
                          final firstSet = (exercise['sets'] as List?)?.isNotEmpty == true
                              ? (exercise['sets'] as List).first
                              : null;
                          final weight = firstSet is Map
                              ? firstSet['target_weight_kg'] ?? firstSet['targetWeightKg']
                              : null;
                          final duration = exercise['target_duration_seconds'] ??
                              (firstSet is Map
                                  ? firstSet['target_duration_seconds'] ?? firstSet['targetDurationSeconds']
                                  : null);
                          final distance = exercise['target_distance_meters'] ??
                              (firstSet is Map
                                  ? firstSet['target_distance_meters'] ?? firstSet['targetDistanceMeters']
                                  : null);
                          final exerciseSummary = [
                            '$setCount sets',
                            if (reps != null) '$reps${maxReps != null ? '-$maxReps' : ''} reps',
                            if (weight != null) '$weight kg',
                            if (duration != null) '$duration sec',
                            if (distance != null) '$distance m',
                          ].join(' • ');

                          return Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Material(
                              color: colors.surfaceElevated.withValues(alpha: 0.5),
                              borderRadius: BorderRadius.circular(12),
                              child: InkWell(
                                onTap: dayId == null ? null : () => _editExercise(dayId, existing: exercise, dayName: day['name']?.toString()),
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: colors.border.withValues(alpha: 0.7)),
                                  ),
                                  child: Row(
                                    children: [
                                      // Reorder arrows
                                      Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          InkWell(
                                            onTap: index > 0 ? () => _reorderExercise(day, index, -1) : null,
                                            child: Icon(
                                              Icons.arrow_drop_up,
                                              size: 18,
                                              color: index > 0 ? colors.textSecondary : colors.textMuted.withValues(alpha: 0.3),
                                            ),
                                          ),
                                          InkWell(
                                            onTap: index < exercises.length - 1 ? () => _reorderExercise(day, index, 1) : null,
                                            child: Icon(
                                              Icons.arrow_drop_down,
                                              size: 18,
                                              color: index < exercises.length - 1 ? colors.textSecondary : colors.textMuted.withValues(alpha: 0.3),
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
                                              '${exercise['exercise_name'] ?? exercise['name'] ?? 'Exercise'}${exercise['is_optional'] == 1 ? ' (optional)' : ''}',
                                              style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700, fontSize: 13.5),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              exerciseSummary,
                                              style: TextStyle(color: colors.textSecondary, fontSize: 11.5),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
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
                                        onPressed: dayId == null ? null : () => _editExercise(dayId, existing: exercise, dayName: day['name']?.toString()),
                                        tooltip: 'Edit exercise',
                                      ),
                                      IconButton(
                                        visualDensity: VisualDensity.compact,
                                        padding: EdgeInsets.zero,
                                        constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                        icon: Icon(Icons.delete_outline, size: 15, color: colors.rose),
                                        onPressed: () => _deleteExercise(exercise),
                                        tooltip: 'Delete exercise',
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          );
                        }),
                    ] else
                      Padding(
                        padding: const EdgeInsets.all(8),
                        child: Text('Rest day — no exercises scheduled.', style: TextStyle(color: colors.textMuted)),
                      ),
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

