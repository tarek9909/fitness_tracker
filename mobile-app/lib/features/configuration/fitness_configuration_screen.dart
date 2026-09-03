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

  // Controllers
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _dateOfBirthCtrl = TextEditingController();
  final _heightCtrl = TextEditingController();
  final _timezoneCtrl = TextEditingController();
  final _localeCtrl = TextEditingController();
  String _gender = '';
  String _unitSystem = 'metric';
  String _goalType = 'maintain_weight';

  final _startWeightCtrl = TextEditingController();
  final _targetWeightCtrl = TextEditingController();
  final _goalStartDateCtrl = TextEditingController();
  final _targetDateCtrl = TextEditingController();
  final _goalNotesCtrl = TextEditingController();

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

  String _displayWeight(double kilograms) {
    final value = _unitSystem == 'imperial' ? kilograms * 2.20462 : kilograms;
    return value.toStringAsFixed(1);
  }

  void _changeUnitSystem(String nextUnitSystem) {
    if (nextUnitSystem == _unitSystem) return;

    final height = double.tryParse(_heightCtrl.text.trim());
    final startWeight = double.tryParse(_startWeightCtrl.text.trim());
    final targetWeight = double.tryParse(_targetWeightCtrl.text.trim());
    final switchingToImperial = nextUnitSystem == 'imperial';

    setState(() {
      if (height != null) {
        _heightCtrl.text = (switchingToImperial ? height / 2.54 : height * 2.54).toStringAsFixed(1);
      }
      if (startWeight != null) {
        _startWeightCtrl.text = (switchingToImperial ? startWeight * 2.20462 : startWeight / 2.20462).toStringAsFixed(1);
      }
      if (targetWeight != null) {
        _targetWeightCtrl.text = (switchingToImperial ? targetWeight * 2.20462 : targetWeight / 2.20462).toStringAsFixed(1);
      }
      _unitSystem = nextUnitSystem;
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _phoneCtrl.dispose();
    _dateOfBirthCtrl.dispose();
    _heightCtrl.dispose();
    _timezoneCtrl.dispose();
    _localeCtrl.dispose();
    _startWeightCtrl.dispose();
    _targetWeightCtrl.dispose();
    _goalStartDateCtrl.dispose();
    _targetDateCtrl.dispose();
    _goalNotesCtrl.dispose();
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

      final profile = data['profile'] as Map<String, dynamic>?;
      if (profile != null) {
        _firstNameCtrl.text = '${profile['firstName'] ?? profile['first_name'] ?? ''}';
        _lastNameCtrl.text = '${profile['lastName'] ?? profile['last_name'] ?? ''}';
        _phoneCtrl.text = '${profile['phone'] ?? ''}';
        _dateOfBirthCtrl.text = '${profile['dateOfBirth'] ?? profile['date_of_birth'] ?? ''}';
        _timezoneCtrl.text = '${profile['timezone'] ?? ''}';
        _localeCtrl.text = '${profile['locale'] ?? ''}';
        _gender = '${profile['gender'] ?? ''}';
        _unitSystem = profile['unitSystem'] == 'imperial' || profile['unit_system'] == 'imperial'
            ? 'imperial'
            : 'metric';
        final height = profile['heightCm'] ?? profile['height_cm'];
        final heightValue = height is num ? height.toDouble() : double.tryParse('$height');
        if (heightValue != null) {
          _heightCtrl.text = _unitSystem == 'imperial'
              ? (heightValue / 2.54).toStringAsFixed(1)
              : heightValue.toString();
        }
      }

      final weightGoal = data['weightGoal'] as Map<String, dynamic>?;
      if (weightGoal != null) {
        final goal = '${weightGoal['goal_type'] ?? weightGoal['goalType'] ?? ''}';
        if (['lose_weight', 'gain_weight', 'build_muscle', 'maintain_weight'].contains(goal)) {
          _goalType = goal;
        }
        final startW = weightGoal['starting_weight_kg'] ?? weightGoal['start_weight_kg'] ?? weightGoal['startWeightKg'];
        final startKg = startW is num ? startW.toDouble() : double.tryParse('$startW');
        if (startKg != null) _startWeightCtrl.text = _displayWeight(startKg);
        final targetW = weightGoal['target_weight_kg'] ?? weightGoal['targetWeightKg'];
        final targetKg = targetW is num ? targetW.toDouble() : double.tryParse('$targetW');
        if (targetKg != null) _targetWeightCtrl.text = _displayWeight(targetKg);
        _goalStartDateCtrl.text = '${weightGoal['start_date'] ?? weightGoal['startDate'] ?? ''}';
        _targetDateCtrl.text = '${weightGoal['target_date'] ?? weightGoal['targetDate'] ?? ''}';
        _goalNotesCtrl.text = '${weightGoal['notes'] ?? ''}';
      }

      final water = data['waterTarget'] as Map<String, dynamic>?;
      if (water != null) {
        final target = water['target_ml'] ?? water['daily_target_ml'] ?? water['dailyTargetMl'] ?? water['targetMl'];
        if (target != null) _waterTargetCtrl.text = target.toString();
      }

      final quickAdds = (data['waterQuickAdd'] ?? data['waterQuickAdds']) as List<dynamic>?;
      if (quickAdds != null && quickAdds.isNotEmpty) {
        final amounts = quickAdds
            .map((q) => q is Map ? (q['amount_ml'] ?? q['amountMl']) : q)
            .where((a) => a != null)
            .toList();
        _quickAddsCtrl.text = amounts.join(', ');
      } else {
        _quickAddsCtrl.clear();
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
      final heightInput = double.tryParse(_heightCtrl.text.trim());
      final startInput = double.tryParse(_startWeightCtrl.text.trim());
      final targetInput = double.tryParse(_targetWeightCtrl.text.trim());

      // Persist the complete self-service profile.
      final profileBody = <String, dynamic>{
        'firstName': _firstNameCtrl.text.trim(),
        'lastName': _lastNameCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim().isNotEmpty ? _phoneCtrl.text.trim() : null,
        'dateOfBirth': _dateOfBirthCtrl.text.trim().isNotEmpty ? _dateOfBirthCtrl.text.trim() : null,
        if (heightInput != null)
          'heightCm': _unitSystem == 'imperial' ? heightInput * 2.54 : heightInput,
        'gender': _gender.isNotEmpty ? _gender : null,
        'unitSystem': _unitSystem,
      };
      if (_timezoneCtrl.text.trim().isNotEmpty) {
        profileBody['timezone'] = _timezoneCtrl.text.trim();
      }
      if (_localeCtrl.text.trim().isNotEmpty) {
        profileBody['locale'] = _localeCtrl.text.trim();
      }
      await widget.apiClient.patch('/me', body: profileBody);

      // Update the goal only when both weights are explicitly provided.
      if (startInput != null && targetInput != null) {
        await widget.apiClient.put('/me/goals/weight', body: {
          'goalType': _goalType,
          'startWeightKg': _unitSystem == 'imperial' ? startInput / 2.20462 : startInput,
          'targetWeightKg': _unitSystem == 'imperial' ? targetInput / 2.20462 : targetInput,
          if (_goalStartDateCtrl.text.trim().isNotEmpty)
            'startDate': _goalStartDateCtrl.text.trim(),
          if (_targetDateCtrl.text.trim().isNotEmpty)
            'targetDate': _targetDateCtrl.text.trim(),
          if (_goalNotesCtrl.text.trim().isNotEmpty)
            'notes': _goalNotesCtrl.text.trim(),
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
    final minCtrl = TextEditingController();
    final freqCtrl = TextEditingController();
    List<dynamic> activities = const [];
    try {
      final response = await widget.apiClient.get('/me/cardio/activities');
      activities = response is Map<String, dynamic> && response['data'] is List<dynamic>
          ? response['data'] as List<dynamic>
          : response is List<dynamic>
              ? response
              : const [];
    } catch (_) {
      if (mounted) {
        showPremiumSnackBar(context, 'Unable to load cardio activities', isError: true);
      }
      return;
    }
    if (activities.isEmpty) {
      if (mounted) {
        showPremiumSnackBar(context, 'No cardio activities are available', isError: true);
      }
      return;
    }

    int? selectedActivityId = (activities.first is Map)
        ? (activities.first['id'] as num?)?.toInt()
        : null;
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
              title: Text('Add Cardio Goal',
                  style: TextStyle(
                      fontWeight: FontWeight.w800, color: colors.textPrimary)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<int>(
                    initialValue: selectedActivityId,
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
                    items: activities
                        .whereType<Map>()
                        .map((activity) {
                          final id = (activity['id'] as num?)?.toInt();
                          if (id == null) return null;
                          return DropdownMenuItem<int>(
                            value: id,
                            child: Text('${activity['name'] ?? 'Cardio activity'}'),
                          );
                        })
                        .whereType<DropdownMenuItem<int>>()
                        .toList(),
                    onChanged: (val) {
                      if (val != null) setDialogState(() => selectedActivityId = val);
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
                    label: 'Weekly Frequency (1-7 sessions)',
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
                    final mins = int.tryParse(minCtrl.text.trim());
                    final freq = int.tryParse(freqCtrl.text.trim());
                    if (selectedActivityId == null || mins == null || mins < 1 || freq == null || freq < 1 || freq > 7) {
                      showPremiumSnackBar(context, 'Enter a valid activity, duration, and weekly frequency', isError: true);
                      return;
                    }
                    Navigator.pop(ctx);
                    try {
                      await widget.apiClient.post('/me/goals/cardio', body: {
                        'cardioActivityId': selectedActivityId,
                        'minDurationMinutes': mins,
                        'maxDurationMinutes': mins,
                        'weekdays': List<int>.generate(freq, (index) => index + 1),
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
                    initialValue: category,
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
                              Text('PROFILE & PHYSICAL METRICS',
                                  style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.8,
                                      color: colors.textSecondary)),
                              const SizedBox(height: 12),
                              PremiumTextField(
                                label: 'First Name',
                                controller: _firstNameCtrl,
                              ),
                              const SizedBox(height: 12),
                              PremiumTextField(
                                label: 'Last Name',
                                controller: _lastNameCtrl,
                              ),
                              const SizedBox(height: 12),
                              PremiumTextField(
                                label: 'Phone (optional)',
                                controller: _phoneCtrl,
                                keyboardType: TextInputType.phone,
                              ),
                              const SizedBox(height: 12),
                              PremiumTextField(
                                label: 'Date of Birth (YYYY-MM-DD)',
                                controller: _dateOfBirthCtrl,
                              ),
                              const SizedBox(height: 12),
                              PremiumTextField(
                                label: _unitSystem == 'imperial' ? 'Height (inches)' : 'Height (cm)',
                                controller: _heightCtrl,
                                keyboardType: TextInputType.number,
                              ),
                              const SizedBox(height: 12),
                              DropdownButtonFormField<String>(
                                initialValue: _unitSystem,
                                dropdownColor: colors.surfaceElevated,
                                decoration: InputDecoration(
                                  labelText: 'Unit System',
                                  labelStyle: TextStyle(color: colors.textSecondary),
                                  filled: true,
                                  fillColor: colors.surfaceElevated,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(AppRadii.lg),
                                    borderSide: BorderSide(color: colors.border),
                                  ),
                                ),
                                items: const [
                                  DropdownMenuItem(value: 'metric', child: Text('Metric (kg / cm)')),
                                  DropdownMenuItem(value: 'imperial', child: Text('Imperial (lb / inches)')),
                                ],
                                onChanged: (val) {
                                  if (val != null) _changeUnitSystem(val);
                                },
                              ),
                              const SizedBox(height: 12),
                              DropdownButtonFormField<String>(
                                initialValue: _gender.isEmpty ? null : _gender,
                                dropdownColor: colors.surfaceElevated,
                                decoration: InputDecoration(
                                  labelText: 'Gender (optional)',
                                  labelStyle: TextStyle(color: colors.textSecondary),
                                  filled: true,
                                  fillColor: colors.surfaceElevated,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(AppRadii.lg),
                                    borderSide: BorderSide(color: colors.border),
                                  ),
                                ),
                                items: const [
                                  DropdownMenuItem(value: 'male', child: Text('Male')),
                                  DropdownMenuItem(value: 'female', child: Text('Female')),
                                  DropdownMenuItem(value: 'other', child: Text('Other')),
                                  DropdownMenuItem(value: 'prefer_not_to_say', child: Text('Prefer not to say')),
                                ],
                                onChanged: (val) {
                                  setState(() => _gender = val ?? '');
                                },
                              ),
                              const SizedBox(height: 12),
                              PremiumTextField(
                                label: 'Timezone (IANA, optional)',
                                hint: 'e.g. Asia/Beirut',
                                controller: _timezoneCtrl,
                              ),
                              const SizedBox(height: 12),
                              PremiumTextField(
                                label: 'Locale (optional)',
                                hint: 'e.g. en',
                                controller: _localeCtrl,
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
                                      label: _unitSystem == 'imperial' ? 'Starting (lb)' : 'Starting (kg)',
                                      controller: _startWeightCtrl,
                                      keyboardType: TextInputType.number,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: PremiumTextField(
                                      label: _unitSystem == 'imperial' ? 'Target (lb)' : 'Target (kg)',
                                      controller: _targetWeightCtrl,
                                      keyboardType: TextInputType.number,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              DropdownButtonFormField<String>(
                                initialValue: _goalType,
                                dropdownColor: colors.surfaceElevated,
                                decoration: InputDecoration(
                                  labelText: 'Main Goal Type',
                                  labelStyle: TextStyle(color: colors.textSecondary),
                                  filled: true,
                                  fillColor: colors.surfaceElevated,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(AppRadii.lg),
                                    borderSide: BorderSide(color: colors.border),
                                  ),
                                ),
                                items: const [
                                  DropdownMenuItem(value: 'lose_weight', child: Text('Lose Weight')),
                                  DropdownMenuItem(value: 'gain_weight', child: Text('Gain Weight')),
                                  DropdownMenuItem(value: 'build_muscle', child: Text('Build Muscle')),
                                  DropdownMenuItem(value: 'maintain_weight', child: Text('Maintain Weight')),
                                ],
                                onChanged: (val) {
                                  if (val != null) setState(() => _goalType = val);
                                },
                              ),
                              const SizedBox(height: 12),
                              PremiumTextField(
                                label: 'Goal Start Date (YYYY-MM-DD)',
                                controller: _goalStartDateCtrl,
                              ),
                              const SizedBox(height: 12),
                              PremiumTextField(
                                label: 'Target Date (YYYY-MM-DD)',
                                hint: 'e.g. 2026-12-31',
                                controller: _targetDateCtrl,
                              ),
                              const SizedBox(height: 12),
                              PremiumTextField(
                                label: 'Goal Notes (optional)',
                                hint: 'Add context or milestones for this goal',
                                controller: _goalNotesCtrl,
                                maxLines: 3,
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
