import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';

class FitnessConfigurationScreen extends StatefulWidget {
  final ApiClient apiClient;

  const FitnessConfigurationScreen({super.key, required this.apiClient});

  @override
  State<FitnessConfigurationScreen> createState() =>
      _FitnessConfigurationScreenState();
}

class _FitnessConfigurationScreenState
    extends State<FitnessConfigurationScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  String? _errorMessage;

  // Configuration state
  Map<String, dynamic>? _config;

  // Controllers
  final _heightCtrl = TextEditingController();
  String _fitnessGoal = 'general_fitness';
  String _activityLevel = 'moderately_active';

  final _startWeightCtrl = TextEditingController();
  final _targetWeightCtrl = TextEditingController();
  final _targetDateCtrl = TextEditingController();

  final _waterTargetCtrl = TextEditingController();
  final _quickAddsCtrl = TextEditingController();

  List<dynamic> _cardioTargets = [];
  List<dynamic> _reminders = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadConfiguration();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _heightCtrl.dispose();
    _startWeightCtrl.dispose();
    _targetWeightCtrl.dispose();
    _targetDateCtrl.dispose();
    _waterTargetCtrl.dispose();
    _quickAddsCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadConfiguration() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await widget.apiClient.get('/me/fitness-configuration');
      final data = res is Map<String, dynamic> && res['data'] != null
          ? res['data'] as Map<String, dynamic>
          : (res is Map<String, dynamic> ? res : <String, dynamic>{});

      _config = data;

      final profile = data['profile'] as Map<String, dynamic>?;
      if (profile != null) {
        if (profile['height_cm'] != null) {
          _heightCtrl.text = profile['height_cm'].toString();
        }
        if (profile['fitness_goal'] != null) {
          _fitnessGoal = profile['fitness_goal'].toString();
        }
        if (profile['activity_level'] != null) {
          _activityLevel = profile['activity_level'].toString();
        }
      }

      final weightGoal = data['weightGoal'] as Map<String, dynamic>?;
      if (weightGoal != null) {
        if (weightGoal['starting_weight_kg'] != null) {
          _startWeightCtrl.text = weightGoal['starting_weight_kg'].toString();
        }
        if (weightGoal['target_weight_kg'] != null) {
          _targetWeightCtrl.text = weightGoal['target_weight_kg'].toString();
        }
        if (weightGoal['target_date'] != null) {
          _targetDateCtrl.text = weightGoal['target_date'].toString();
        }
      }

      final water = data['waterTarget'] as Map<String, dynamic>?;
      if (water != null) {
        final target = water['daily_target_ml'] ?? water['dailyTargetMl'];
        if (target != null) _waterTargetCtrl.text = target.toString();
      }

      final quickAdds = data['waterQuickAdds'] as List<dynamic>?;
      if (quickAdds != null && quickAdds.isNotEmpty) {
        final amounts = quickAdds.map((q) => q['amount_ml'] ?? q['amountMl']).toList();
        _quickAddsCtrl.text = amounts.join(', ');
      } else {
        _quickAddsCtrl.text = '250, 500, 750, 1000';
      }

      final cardio = data['cardioTargets'] as List<dynamic>?;
      if (cardio != null) _cardioTargets = cardio;

      final reminders = data['reminders'] as List<dynamic>?;
      if (reminders != null) _reminders = reminders;

      setState(() {
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

  Future<void> _saveProfileAndWeight() async {
    try {
      // 1. Update profile metrics
      await widget.apiClient.patch('/me', body: {
        if (_heightCtrl.text.trim().isNotEmpty)
          'heightCm': double.tryParse(_heightCtrl.text.trim()),
        'fitnessGoal': _fitnessGoal,
        'activityLevel': _activityLevel,
      });

      // 2. Update weight goal if filled
      final startW = double.tryParse(_startWeightCtrl.text.trim());
      final targetW = double.tryParse(_targetWeightCtrl.text.trim());
      if (startW != null && targetW != null) {
        await widget.apiClient.put('/me/goals/weight', body: {
          'startWeightKg': startW,
          'targetWeightKg': targetW,
          if (_targetDateCtrl.text.trim().isNotEmpty)
            'targetDate': _targetDateCtrl.text.trim(),
        });
      }

      if (mounted) {
        showPremiumSnackBar(context, 'Profile & goals updated successfully');
        _loadConfiguration();
      }
    } catch (e) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Update failed: ${e.toString().replaceAll("Exception: ", "")}',
          isError: true,
        );
      }
    }
  }

  Future<void> _saveWaterSettings() async {
    try {
      final target = int.tryParse(_waterTargetCtrl.text.trim());
      if (target != null) {
        await widget.apiClient.put('/me/goals/water', body: {
          'dailyTargetMl': target,
        });
      }

      final quickAddStrings = _quickAddsCtrl.text.split(',');
      final options = quickAddStrings
          .map((s) => int.tryParse(s.trim()))
          .where((v) => v != null && v >= 50 && v <= 5000)
          .cast<int>()
          .toList();

      if (options.isNotEmpty) {
        await widget.apiClient.put('/me/goals/water-quick-add', body: {
          'options': options,
        });
      }

      if (mounted) {
        showPremiumSnackBar(context, 'Water targets saved');
        _loadConfiguration();
      }
    } catch (e) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Save failed: ${e.toString().replaceAll("Exception: ", "")}',
          isError: true,
        );
      }
    }
  }

  Future<void> _showAddCardioDialog() async {
    final minCtrl = TextEditingController(text: '30');
    final freqCtrl = TextEditingController(text: '3');
    String type = 'running';

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
              title: Text('Add Cardio Goal',
                  style: TextStyle(
                      fontWeight: FontWeight.w800, color: colors.textPrimary)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    value: type,
                    dropdownColor: colors.surfaceElevated,
                    decoration: InputDecoration(
                      labelText: 'Activity Type',
                      labelStyle: TextStyle(color: colors.textSecondary),
                      filled: true,
                      fillColor: colors.surfaceElevated,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadii.lg),
                        borderSide: BorderSide(color: colors.border),
                      ),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'running', child: Text('Running / Jogging')),
                      DropdownMenuItem(value: 'cycling', child: Text('Cycling')),
                      DropdownMenuItem(value: 'swimming', child: Text('Swimming')),
                      DropdownMenuItem(value: 'walking', child: Text('Brisk Walking')),
                      DropdownMenuItem(value: 'rowing', child: Text('Rowing')),
                    ],
                    onChanged: (val) {
                      if (val != null) setDialogState(() => type = val);
                    },
                  ),
                  const SizedBox(height: 12),
                  PremiumTextField(
                    label: 'Target Duration (minutes)',
                    controller: minCtrl,
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 12),
                  PremiumTextField(
                    label: 'Weekly Frequency (sessions)',
                    controller: freqCtrl,
                    keyboardType: TextInputType.number,
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
                  text: 'Add Target',
                  onPressed: () async {
                    final mins = int.tryParse(minCtrl.text.trim()) ?? 30;
                    final freq = int.tryParse(freqCtrl.text.trim()) ?? 3;
                    Navigator.pop(ctx);
                    try {
                      await widget.apiClient.post('/me/goals/cardio', body: {
                        'activityName': type,
                        'targetMinutes': mins,
                        'frequencyPerWeek': freq,
                      });
                      if (mounted) {
                        showPremiumSnackBar(context, 'Cardio goal added');
                        _loadConfiguration();
                      }
                    } catch (e) {
                      if (mounted) {
                        showPremiumSnackBar(
                          context,
                          'Failed: ${e.toString().replaceAll("Exception: ", "")}',
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

  Future<void> _showAddReminderDialog() async {
    final titleCtrl = TextEditingController();
    final timeCtrl = TextEditingController(text: '09:00:00');
    String category = 'water';

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
              title: Text('New Reminder',
                  style: TextStyle(
                      fontWeight: FontWeight.w800, color: colors.textPrimary)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  PremiumTextField(
                    label: 'Reminder Title',
                    hint: 'e.g. Drink 500ml Water',
                    controller: titleCtrl,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: category,
                    dropdownColor: colors.surfaceElevated,
                    decoration: InputDecoration(
                      labelText: 'Category',
                      labelStyle: TextStyle(color: colors.textSecondary),
                      filled: true,
                      fillColor: colors.surfaceElevated,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadii.lg),
                        borderSide: BorderSide(color: colors.border),
                      ),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'water', child: Text('Hydration / Water')),
                      DropdownMenuItem(value: 'meal', child: Text('Meal / Nutrition')),
                      DropdownMenuItem(value: 'workout', child: Text('Workout Session')),
                      DropdownMenuItem(value: 'weight', child: Text('Morning Weigh-In')),
                      DropdownMenuItem(value: 'cardio', child: Text('Cardio Activity')),
                    ],
                    onChanged: (val) {
                      if (val != null) setDialogState(() => category = val);
                    },
                  ),
                  const SizedBox(height: 12),
                  PremiumTextField(
                    label: 'Scheduled Time (HH:MM:SS)',
                    hint: '09:00:00',
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
                  text: 'Create',
                  onPressed: () async {
                    final title = titleCtrl.text.trim();
                    final time = timeCtrl.text.trim();
                    if (title.isEmpty) return;
                    Navigator.pop(ctx);
                    try {
                      await widget.apiClient.post('/me/reminders', body: {
                        'title': title,
                        'category': category,
                        'mode': 'fixed_time',
                        'fixedTime': time.isNotEmpty ? time : '09:00:00',
                      });
                      if (mounted) {
                        showPremiumSnackBar(context, 'Reminder scheduled');
                        _loadConfiguration();
                      }
                    } catch (e) {
                      if (mounted) {
                        showPremiumSnackBar(
                          context,
                          'Failed: ${e.toString().replaceAll("Exception: ", "")}',
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
        title: const Text('Goals & Configuration'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: colors.primary,
          labelColor: colors.primary,
          unselectedLabelColor: colors.textSecondary,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          tabs: const [
            Tab(text: 'Profile'),
            Tab(text: 'Water'),
            Tab(text: 'Cardio'),
            Tab(text: 'Reminders'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_errorMessage!, style: TextStyle(color: colors.rose)),
                      const SizedBox(height: 12),
                      PremiumButton(text: 'Retry', onPressed: _loadConfiguration),
                    ],
                  ),
                )
              : TabBarView(
                  controller: _tabController,
                  children: [
                    // Tab 1: Profile & Weight Goal
                    ListView(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      children: [
                        PremiumCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('PHYSICAL METRICS & LEVEL',
                                  style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.8,
                                      color: colors.textSecondary)),
                              const SizedBox(height: 12),
                              PremiumTextField(
                                label: 'Height (cm)',
                                controller: _heightCtrl,
                                keyboardType: TextInputType.number,
                              ),
                              const SizedBox(height: 12),
                              DropdownButtonFormField<String>(
                                value: _fitnessGoal,
                                dropdownColor: colors.surfaceElevated,
                                decoration: InputDecoration(
                                  labelText: 'Primary Fitness Goal',
                                  labelStyle: TextStyle(color: colors.textSecondary),
                                  filled: true,
                                  fillColor: colors.surfaceElevated,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(AppRadii.lg),
                                    borderSide: BorderSide(color: colors.border),
                                  ),
                                ),
                                items: const [
                                  DropdownMenuItem(value: 'lose_weight', child: Text('Fat Loss / Weight Reduction')),
                                  DropdownMenuItem(value: 'build_muscle', child: Text('Hypertrophy / Muscle Gain')),
                                  DropdownMenuItem(value: 'maintenance', child: Text('Body Recomposition / Maintenance')),
                                  DropdownMenuItem(value: 'general_fitness', child: Text('General Health & Mobility')),
                                ],
                                onChanged: (val) {
                                  if (val != null) setState(() => _fitnessGoal = val);
                                },
                              ),
                              const SizedBox(height: 12),
                              DropdownButtonFormField<String>(
                                value: _activityLevel,
                                dropdownColor: colors.surfaceElevated,
                                decoration: InputDecoration(
                                  labelText: 'Daily Activity Level',
                                  labelStyle: TextStyle(color: colors.textSecondary),
                                  filled: true,
                                  fillColor: colors.surfaceElevated,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(AppRadii.lg),
                                    borderSide: BorderSide(color: colors.border),
                                  ),
                                ),
                                items: const [
                                  DropdownMenuItem(value: 'sedentary', child: Text('Sedentary (Desk Job)')),
                                  DropdownMenuItem(value: 'lightly_active', child: Text('Lightly Active (1-2 workouts/wk)')),
                                  DropdownMenuItem(value: 'moderately_active', child: Text('Moderately Active (3-5 workouts/wk)')),
                                  DropdownMenuItem(value: 'very_active', child: Text('Very Active (6-7 workouts/wk)')),
                                ],
                                onChanged: (val) {
                                  if (val != null) setState(() => _activityLevel = val);
                                },
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        PremiumCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('WEIGHT GOAL TARGETS',
                                  style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.8,
                                      color: colors.textSecondary)),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: PremiumTextField(
                                      label: 'Starting (kg)',
                                      controller: _startWeightCtrl,
                                      keyboardType: TextInputType.number,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: PremiumTextField(
                                      label: 'Target (kg)',
                                      controller: _targetWeightCtrl,
                                      keyboardType: TextInputType.number,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              PremiumTextField(
                                label: 'Target Date (YYYY-MM-DD)',
                                hint: 'e.g. 2026-12-31',
                                controller: _targetDateCtrl,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                        PremiumButton(
                          text: 'Save Profile & Goals',
                          onPressed: _saveProfileAndWeight,
                        ),
                      ],
                    ),

                    // Tab 2: Water Target & Presets
                    ListView(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      children: [
                        PremiumCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('HYDRATION GOALS & QUICK-ADDS',
                                  style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.8,
                                      color: colors.textSecondary)),
                              const SizedBox(height: 12),
                              PremiumTextField(
                                label: 'Daily Water Target (ml)',
                                hint: 'e.g. 3000',
                                controller: _waterTargetCtrl,
                                keyboardType: TextInputType.number,
                              ),
                              const SizedBox(height: 16),
                              PremiumTextField(
                                label: 'Quick-Add Presets (comma-separated ml)',
                                hint: '250, 500, 750, 1000',
                                controller: _quickAddsCtrl,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'These presets appear on your daily log for quick one-tap hydration logging.',
                                style: TextStyle(
                                    fontSize: 12, color: colors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                        PremiumButton(
                          text: 'Save Water Configuration',
                          onPressed: _saveWaterSettings,
                        ),
                      ],
                    ),

                    // Tab 3: Cardio Targets
                    ListView(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('ACTIVE CARDIO TARGETS',
                                style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.8,
                                    color: colors.textSecondary)),
                            TextButton.icon(
                              icon: const Icon(Icons.add, size: 16),
                              label: const Text('Add Goal'),
                              onPressed: _showAddCardioDialog,
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        if (_cardioTargets.isEmpty)
                          PremiumCard(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 24),
                              child: Center(
                                child: Text('No weekly cardio goals configured.',
                                    style: TextStyle(color: colors.textSecondary)),
                              ),
                            ),
                          )
                        else
                          ..._cardioTargets.map((c) {
                            final map = c as Map<String, dynamic>;
                            final id = map['id'] as int;
                            final name = map['activity_name'] ??
                                map['activity_name_snapshot'] ??
                                'Cardio';
                            final mins = map['target_duration_minutes'] ??
                                map['duration_minutes'] ??
                                30;
                            final freq = map['frequency_per_week'] ?? 3;

                            return Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: PremiumCard(
                                child: Row(
                                  children: [
                                    Icon(Icons.directions_run, color: colors.cyan),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            name.toString().toUpperCase(),
                                            style: TextStyle(
                                                fontWeight: FontWeight.w700,
                                                fontSize: 14,
                                                color: colors.textPrimary),
                                          ),
                                          Text(
                                            '$mins mins • $freq sessions/week',
                                            style: TextStyle(
                                                fontSize: 12,
                                                color: colors.textSecondary),
                                          ),
                                        ],
                                      ),
                                    ),
                                    IconButton(
                                      icon: Icon(Icons.delete_outline,
                                          size: 18, color: colors.rose),
                                      onPressed: () async {
                                        try {
                                          await widget.apiClient
                                              .delete('/me/goals/cardio/$id');
                                          _loadConfiguration();
                                        } catch (_) {}
                                      },
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }),
                      ],
                    ),

                    // Tab 4: Custom User Reminders
                    ListView(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('MY REMINDERS',
                                style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.8,
                                    color: colors.textSecondary)),
                            TextButton.icon(
                              icon: const Icon(Icons.add, size: 16),
                              label: const Text('Add Reminder'),
                              onPressed: _showAddReminderDialog,
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        if (_reminders.isEmpty)
                          PremiumCard(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 24),
                              child: Center(
                                child: Text('No custom reminders active.',
                                    style: TextStyle(color: colors.textSecondary)),
                              ),
                            ),
                          )
                        else
                          ..._reminders.map((r) {
                            final map = r as Map<String, dynamic>;
                            final id = map['id'] as int;
                            final title = map['title'] ?? map['name'] ?? 'Reminder';
                            final cat = map['category'] ?? 'general';
                            final time = map['fixed_time'] ?? map['fixedTime'] ?? 'Scheduled';

                            return Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: PremiumCard(
                                child: Row(
                                  children: [
                                    Icon(Icons.alarm, color: colors.primary),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            title.toString(),
                                            style: TextStyle(
                                                fontWeight: FontWeight.w700,
                                                fontSize: 14,
                                                color: colors.textPrimary),
                                          ),
                                          Text(
                                            '$cat • $time',
                                            style: TextStyle(
                                                fontSize: 12,
                                                color: colors.textSecondary),
                                          ),
                                        ],
                                      ),
                                    ),
                                    IconButton(
                                      icon: Icon(Icons.delete_outline,
                                          size: 18, color: colors.rose),
                                      onPressed: () async {
                                        try {
                                          await widget.apiClient
                                              .delete('/me/reminders/$id');
                                          _loadConfiguration();
                                        } catch (_) {}
                                      },
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }),
                      ],
                    ),
                  ],
                ),
    );
  }
}
