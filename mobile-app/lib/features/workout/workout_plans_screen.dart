import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';
import 'workout_plan_builder_screen.dart';
import 'workout_exercise_editor_modal.dart';

class WorkoutPlansScreen extends StatefulWidget {
  final ApiClient apiClient;

  const WorkoutPlansScreen({super.key, required this.apiClient});

  @override
  State<WorkoutPlansScreen> createState() => _WorkoutPlansScreenState();
}

class _WorkoutPlansScreenState extends State<WorkoutPlansScreen> {
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
      final res = await widget.apiClient.get('/me/workout-plans');
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

  Future<void> _quickActivatePlan(int planId) async {
    try {
      final now = DateTime.now();
      final today = '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
      await widget.apiClient.post(
        '/me/workout-plans/$planId/activate',
        body: {'effectiveFrom': today},
      );
      if (mounted) {
        showPremiumSnackBar(context, 'Workout plan activated as your current agenda', isSuccess: true);
        _loadPlans();
      }
    } catch (e) {
      if (mounted) {
        showPremiumSnackBar(context, 'Failed to activate plan: $e', isError: true);
      }
    }
  }

  Future<void> _showCreatePlanDialog() async {
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final goalCtrl = TextEditingController();
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
                'Create Workout Plan',
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
                      hint: 'e.g. 4-Day Hypertrophy Split',
                      controller: nameCtrl,
                      errorText: error,
                      onChanged: (_) {
                        if (error != null) setDialogState(() => error = null);
                      },
                    ),
                    const SizedBox(height: 12),
                    PremiumTextField(
                      label: 'Description (optional)',
                      hint: 'e.g. High-frequency upper/lower focus',
                      controller: descCtrl,
                      maxLines: 2,
                    ),
                    const SizedBox(height: 12),
                    PremiumTextField(
                      label: 'Goal / focus (optional)',
                      hint: 'e.g. Strength, hypertrophy, or conditioning',
                      controller: goalCtrl,
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
                      final payload = <String, dynamic>{
                        'name': name,
                        if (descCtrl.text.trim().isNotEmpty)
                          'description': descCtrl.text.trim(),
                        if (goalCtrl.text.trim().isNotEmpty)
                          'goalCategory': goalCtrl.text.trim(),
                      };
                      await widget.apiClient.post('/me/workout-plans', body: payload);
                      if (mounted) {
                        showPremiumSnackBar(
                          context,
                          'Workout plan created successfully',
                        );
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
        title: const Text('My Workout Plans'),
        actions: [
          PremiumIconButton(
            icon: Icons.add,
            color: colors.primary,
            tooltip: 'Create Plan',
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
                            Icon(Icons.fitness_center,
                                size: 56, color: colors.textMuted),
                            const SizedBox(height: 16),
                            Text(
                              'No Workout Plans Yet',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: colors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Design your own customized training split with tailored sets, reps, and exercises.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 14,
                                color: colors.textSecondary,
                              ),
                            ),
                            const SizedBox(height: 24),
                            PremiumButton(
                              text: 'Create Your First Plan',
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
                          final name = plan['name'] as String? ?? 'Untitled Plan';
                          final desc = plan['description'] as String?;
                          final isActive = plan['is_currently_active'] == 1 ||
                              plan['is_currently_active'] == true ||
                              plan['is_active'] == 1 ||
                              plan['isActive'] == true ||
                              plan['active_assignment_id'] != null;
                          final versionStatus =
                              plan['latest_version_status'] ?? plan['version_status'] ?? plan['status'] ?? 'draft';

                          return PremiumCard(
                            onTap: () async {
                              await Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => WorkoutPlanBuilderScreen(
                                    apiClient: widget.apiClient,
                                    planId: planId,
                                  ),
                                ),
                              );
                              _loadPlans();
                            },
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
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
                                        Icons.fitness_center,
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
                                              if (!isActive)
                                                Padding(
                                                  padding: const EdgeInsets.only(right: 6),
                                                  child: InkWell(
                                                    onTap: () => _quickActivatePlan(planId),
                                                    borderRadius: BorderRadius.circular(AppRadii.sm),
                                                    child: Container(
                                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                      decoration: BoxDecoration(
                                                        color: colors.primaryMuted,
                                                        borderRadius: BorderRadius.circular(AppRadii.sm),
                                                        border: Border.all(color: colors.primary.withValues(alpha: 0.4)),
                                                      ),
                                                      child: Row(
                                                        mainAxisSize: MainAxisSize.min,
                                                        children: [
                                                          Icon(Icons.flash_on, size: 12, color: colors.primary),
                                                          const SizedBox(width: 4),
                                                          Text(
                                                            'Set Active',
                                                            style: TextStyle(
                                                              fontSize: 11,
                                                              fontWeight: FontWeight.w700,
                                                              color: colors.primary,
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                  ),
                                                ),
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
                              ],
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}

class WorkoutPlanDetailScreen extends StatefulWidget {
  final ApiClient apiClient;
  final int planId;

  const WorkoutPlanDetailScreen({
    super.key,
    required this.apiClient,
    required this.planId,
  });

  @override
  State<WorkoutPlanDetailScreen> createState() =>
      _WorkoutPlanDetailScreenState();
}

class _WorkoutPlanDetailScreenState extends State<WorkoutPlanDetailScreen> {
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
      final res =
          await widget.apiClient.get('/me/workout-plans/${widget.planId}');
      final data = res is Map<String, dynamic> && res['data'] != null
          ? res['data'] as Map<String, dynamic>
          : (res is Map<String, dynamic> ? res : null);
      var normalized = _normalisePlan(data);
      final versionId = normalized?['version'] is Map
          ? (normalized!['version']['id'] as num?)?.toInt()
          : null;
      if (normalized != null && versionId != null) {
        final versionRes = await widget.apiClient.get(
          '/me/workout-plans/${widget.planId}/versions/$versionId',
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
        '/me/workout-plans/${widget.planId}/activate',
        body: {'effectiveFrom': selectedDate},
      );
      if (mounted) {
        showPremiumSnackBar(context, 'Plan activated as your current agenda');
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
          await widget.apiClient.post('/me/workout-plans/${widget.planId}/clone');
      final clonedId = res is Map<String, dynamic> && res['data'] != null
          ? res['data']['id']
          : null;
      if (mounted) {
        showPremiumSnackBar(context, 'Plan cloned to a new draft copy');
        if (clonedId != null) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => WorkoutPlanDetailScreen(
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

  Future<void> _showAddDayDialog() async {
    final dayNameCtrl = TextEditingController();
    int selectedWeekday = 1;
    final weekdays = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    ];

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
                'Add Training Day',
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
                    label: 'Day Title',
                    hint: 'e.g. Chest & Triceps',
                    controller: dayNameCtrl,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<int>(
                    initialValue: selectedWeekday,
                    dropdownColor: colors.surfaceElevated,
                    decoration: InputDecoration(
                      labelText: 'Scheduled Weekday',
                      labelStyle: TextStyle(color: colors.textSecondary),
                      filled: true,
                      fillColor: colors.surfaceElevated,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadii.lg),
                        borderSide: BorderSide(color: colors.border),
                      ),
                    ),
                    items: List.generate(7, (i) {
                      final dayNum = i + 1;
                      final isTaken = takenWeekdays.contains(dayNum);
                      return DropdownMenuItem(
                        value: dayNum,
                        enabled: !isTaken,
                        child: Text(
                          isTaken ? '${weekdays[i]} (already in plan)' : weekdays[i],
                          style: TextStyle(
                            color: isTaken ? colors.textSecondary.withOpacity(0.4) : colors.textPrimary,
                          ),
                        ),
                      );
                    }),
                    onChanged: (val) {
                      if (val != null) {
                        setDialogState(() => selectedWeekday = val);
                      }
                    },
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
                  text: 'Add Day',
                  onPressed: () async {
                    final name = dayNameCtrl.text.trim();
                    if (name.isEmpty) return;
                    Navigator.pop(ctx);
                    try {
                      final versionId = _currentVersionId;
                      if (versionId == null) return;
                      await widget.apiClient.post(
                        '/me/workout-plans/${widget.planId}/versions/$versionId/days',
                        body: {
                          'name': name,
                          'weekdayNumber': selectedWeekday,
                        },
                      );
                      if (mounted) {
                        showPremiumSnackBar(context, 'Day added to workout');
                        _loadPlanDetails();
                      }
                    } catch (e) {
                      if (mounted) {
                        showPremiumSnackBar(
                          context,
                          'Failed to add day: ${e.toString().replaceAll("Exception: ", "")}',
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

  Future<void> _showAddExerciseDialog(int dayId, {Map<String, dynamic>? existing, String? dayName}) async {
    final changed = await WorkoutExerciseEditorModal.show(
      context,
      apiClient: widget.apiClient,
      planId: widget.planId,
      dayId: dayId,
      dayName: dayName,
      existing: existing,
    );
    if (changed == true && mounted) {
      showPremiumSnackBar(context, existing == null ? 'Exercise added to workout' : 'Exercise updated');
      _loadPlanDetails();
    }
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
        appBar: const PremiumAppBar(title: Text('Plan Details')),
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

    final planName = _plan!['name'] as String? ?? 'Workout Plan';
    final desc = _plan!['description'] as String?;
    final version = _plan!['version'] as Map<String, dynamic>? ??
        _plan!['currentVersion'] as Map<String, dynamic>?;
    final versionStatus = version?['status'] as String? ?? 'draft';
    final isDraft = versionStatus == 'draft';
    final isActive = _plan!['is_currently_active'] == 1 ||
        _plan!['is_currently_active'] == true ||
        _plan!['is_active'] == 1 ||
        _plan!['isActive'] == true ||
        _plan!['active_assignment_id'] != null;
    final days = (version?['days'] as List<dynamic>?) ?? [];

    return PremiumScaffold(
      appBar: PremiumAppBar(
        title: Text(planName),
        actions: [
          PopupMenuButton<String>(
            icon: Icon(Icons.more_vert, color: colors.textPrimary),
            color: colors.surfaceElevated,
            onSelected: (val) {
              if (val == 'clone') _clonePlan();
              if (val == 'activate') _activatePlan();
            },
            itemBuilder: (ctx) => [
              if (!isActive)
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
                    if (isActive)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: colors.primaryMuted,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: colors.primary.withValues(alpha: 0.3)),
                        ),
                        child: Text(
                          'CURRENT ACTIVE',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: colors.primary,
                          ),
                        ),
                      )
                    else
                      PremiumButton(
                        text: 'Activate Plan',
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
                'WORKOUT DAYS (${days.length})',
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
                  label: const Text('Add Day'),
                  onPressed: _showAddDayDialog,
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (days.isEmpty)
            PremiumCard(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Column(
                    children: [
                      Icon(Icons.calendar_today_outlined,
                          size: 36, color: colors.textMuted),
                      const SizedBox(height: 8),
                      Text(
                        'No training days added yet.',
                        style: TextStyle(color: colors.textSecondary),
                      ),
                      if (isDraft) ...[
                        const SizedBox(height: 12),
                        PremiumButton(
                          text: 'Add Day',
                          isSecondary: true,
                          onPressed: _showAddDayDialog,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            )
          else
            ...days.map((day) {
              final dayMap = day as Map<String, dynamic>;
              final dayId = dayMap['id'] as int;
              final dayName = dayMap['name'] as String? ?? 'Day';
              final exercises =
                  (dayMap['exercises'] as List<dynamic>?) ?? [];

              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: PremiumCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            dayName,
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: colors.textPrimary,
                            ),
                          ),
                          if (isDraft)
                            TextButton.icon(
                              icon: const Icon(Icons.add, size: 14),
                              label: const Text('Add Exercise'),
                              onPressed: () => _showAddExerciseDialog(dayId, dayName: dayName),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (exercises.isEmpty)
                        Text(
                          'No exercises programmed for this day.',
                          style: TextStyle(
                            fontSize: 12,
                            color: colors.textMuted,
                          ),
                        )
                      else
                        ...exercises.map((ex) {
                          final exMap = ex as Map<String, dynamic>;
                          final exName = exMap['exercise_name'] ??
                              exMap['name'] ??
                              'Exercise';
                          final sets = exMap['target_sets'] ?? 3;
                          final rMin = exMap['target_reps_min'] ??
                              exMap['reps_min'];
                          final rMax = exMap['target_reps_max'] ??
                              exMap['reps_max'];
                          final rest = exMap['rest_seconds'] ?? 90;
                          final exId = exMap['id'] as int;

                          return Container(
                            margin: const EdgeInsets.only(bottom: 6),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: colors.surfaceElevated,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: colors.border),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        exName.toString(),
                                        style: TextStyle(
                                          fontWeight: FontWeight.w600,
                                          fontSize: 14,
                                          color: colors.textPrimary,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '$sets sets • ${rMin != null && rMax != null ? "$rMin-$rMax" : (rMin ?? "")} reps • ${rest}s rest',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: colors.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                if (isDraft) ...[
                                  IconButton(
                                    icon: const Icon(Icons.edit_outlined, size: 18),
                                    onPressed: () => _showAddExerciseDialog(dayId, existing: exMap, dayName: dayName),
                                  ),
                                  IconButton(
                                    icon: Icon(Icons.delete_outline,
                                        size: 18, color: colors.rose),
                                    onPressed: () async {
                                      try {
                                        await widget.apiClient.delete(
                                          '/me/workout-plans/${widget.planId}/exercises/$exId',
                                        );
                                        _loadPlanDetails();
                                      } catch (_) {}
                                    },
                                  ),
                                ],
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
