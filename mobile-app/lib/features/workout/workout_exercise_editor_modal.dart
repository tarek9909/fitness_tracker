import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';

/// Single set draft holding live controllers for per-set prescriptions
class WorkoutSetDraft {
  final TextEditingController repsMin;
  final TextEditingController repsMax;
  final TextEditingController weight;
  final TextEditingController duration;
  final TextEditingController distance;
  final TextEditingController rest;
  final TextEditingController notes;

  WorkoutSetDraft({
    String? repsMin,
    String? repsMax,
    String? weight,
    String? duration,
    String? distance,
    String? rest,
    String? notes,
  })  : repsMin = TextEditingController(text: repsMin ?? ''),
        repsMax = TextEditingController(text: repsMax ?? ''),
        weight = TextEditingController(text: weight ?? ''),
        duration = TextEditingController(text: duration ?? ''),
        distance = TextEditingController(text: distance ?? ''),
        rest = TextEditingController(text: rest ?? '90'),
        notes = TextEditingController(text: notes ?? '');

  void dispose() {
    repsMin.dispose();
    repsMax.dispose();
    weight.dispose();
    duration.dispose();
    distance.dispose();
    rest.dispose();
    notes.dispose();
  }
}

/// A comprehensive, high-end redesign of the Workout Exercise Editor Modal.
/// Provides tracking-type adaptive controls, searchable library, custom exercise fallback,
/// quick presets, and complete payload construction.
class WorkoutExerciseEditorModal extends StatefulWidget {
  final ApiClient apiClient;
  final int planId;
  final int dayId;
  final String? dayName;
  final Map<String, dynamic>? existing;

  const WorkoutExerciseEditorModal({
    super.key,
    required this.apiClient,
    required this.planId,
    required this.dayId,
    this.dayName,
    this.existing,
  });

  /// Opens the editor inside a luxurious modal bottom sheet
  static Future<bool?> show(
    BuildContext context, {
    required ApiClient apiClient,
    required int planId,
    required int dayId,
    String? dayName,
    Map<String, dynamic>? existing,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => WorkoutExerciseEditorModal(
        apiClient: apiClient,
        planId: planId,
        dayId: dayId,
        dayName: dayName,
        existing: existing,
      ),
    );
  }

  @override
  State<WorkoutExerciseEditorModal> createState() => _WorkoutExerciseEditorModalState();
}

class _WorkoutExerciseEditorModalState extends State<WorkoutExerciseEditorModal> {
  // Library state
  List<dynamic> _library = [];
  bool _loadingLibrary = true;
  String _searchQuery = '';
  String _selectedMuscleGroup = 'All';

  // Selected exercise state
  int? _selectedExerciseId;
  String _selectedExerciseName = '';
  String _trackingType = 'weight_reps'; // weight_reps, reps_only, duration, distance
  final TextEditingController _customNameCtrl = TextEditingController();

  // Top-level targets
  int _targetSets = 3;
  late final TextEditingController _repsMinCtrl;
  late final TextEditingController _repsMaxCtrl;
  late final TextEditingController _weightCtrl;
  late final TextEditingController _durationCtrl;
  late final TextEditingController _distanceCtrl;
  late final TextEditingController _restCtrl;
  late final TextEditingController _notesCtrl;
  bool _isOptional = false;

  // Per-set drafts
  final List<WorkoutSetDraft> _setDrafts = [];
  bool _saving = false;
  String? _errorMessage;

  static const List<String> _muscleGroupOptions = [
    'All', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quadriceps', 'Hamstrings', 'Glutes', 'Core', 'Cardio'
  ];

  static const List<Map<String, String>> _commonPresets = [
    {'name': 'Barbell Bench Press', 'type': 'weight_reps', 'group': 'Chest'},
    {'name': 'Incline Dumbbell Press', 'type': 'weight_reps', 'group': 'Chest'},
    {'name': 'Barbell Back Squat', 'type': 'weight_reps', 'group': 'Quadriceps'},
    {'name': 'Leg Press 45°', 'type': 'weight_reps', 'group': 'Quadriceps'},
    {'name': 'Romanian Deadlift (RDL)', 'type': 'weight_reps', 'group': 'Hamstrings'},
    {'name': 'Lat Pulldown', 'type': 'weight_reps', 'group': 'Back'},
    {'name': 'Barbell Bent-Over Row', 'type': 'weight_reps', 'group': 'Back'},
    {'name': 'Overhead Dumbbell Press', 'type': 'weight_reps', 'group': 'Shoulders'},
    {'name': 'Dumbbell Lateral Raise', 'type': 'weight_reps', 'group': 'Shoulders'},
    {'name': 'Barbell Bicep Curl', 'type': 'weight_reps', 'group': 'Biceps'},
    {'name': 'Tricep Rope Pushdown', 'type': 'weight_reps', 'group': 'Triceps'},
    {'name': 'Plank Hold', 'type': 'duration', 'group': 'Core'},
    {'name': 'Pull-Up / Chin-Up', 'type': 'reps_only', 'group': 'Back'},
    {'name': 'Treadmill Run', 'type': 'distance', 'group': 'Cardio'},
  ];

  @override
  void initState() {
    super.initState();
    final e = widget.existing;

    _selectedExerciseId = _asInt(e?['exercise_id']);
    _selectedExerciseName = e?['exercise_name']?.toString() ?? e?['name']?.toString() ?? '';
    _customNameCtrl.text = _selectedExerciseName;

    _targetSets = _asInt(e?['target_sets']) ?? ((e?['sets'] as List?)?.length ?? 3);
    if (_targetSets < 1) _targetSets = 3;

    _repsMinCtrl = TextEditingController(text: '${e?['target_reps_min'] ?? e?['reps_min'] ?? 8}');
    _repsMaxCtrl = TextEditingController(text: '${e?['target_reps_max'] ?? e?['reps_max'] ?? 12}');
    _weightCtrl = TextEditingController();
    _durationCtrl = TextEditingController(text: e?['target_duration_seconds']?.toString() ?? '');
    _distanceCtrl = TextEditingController(text: e?['target_distance_meters']?.toString() ?? '');
    _restCtrl = TextEditingController(text: e?['rest_seconds']?.toString() ?? '90');
    _notesCtrl = TextEditingController(text: e?['notes']?.toString() ?? '');
    _isOptional = e?['is_optional'] == 1 || e?['isOptional'] == true;

    // Detect initial tracking type
    final rawTrackingType = e?['tracking_type_snapshot'] ?? e?['tracking_type'];
    if (rawTrackingType != null && rawTrackingType.toString().isNotEmpty) {
      _trackingType = rawTrackingType.toString();
    } else if (_durationCtrl.text.isNotEmpty && _repsMinCtrl.text.isEmpty) {
      _trackingType = 'duration';
    } else if (_distanceCtrl.text.isNotEmpty) {
      _trackingType = 'distance';
    }

    // Initialize set drafts
    final rawSets = (e?['sets'] as List?)?.whereType<Map>().toList() ?? const [];
    for (var index = 0; index < _targetSets; index++) {
      final raw = index < rawSets.length ? rawSets[index] : const <String, dynamic>{};
      _setDrafts.add(WorkoutSetDraft(
        repsMin: '${raw['target_reps_min'] ?? e?['target_reps_min'] ?? e?['reps_min'] ?? 8}',
        repsMax: '${raw['target_reps_max'] ?? e?['target_reps_max'] ?? e?['reps_max'] ?? 12}',
        weight: raw['target_weight_kg']?.toString(),
        duration: raw['target_duration_seconds']?.toString() ?? e?['target_duration_seconds']?.toString(),
        distance: raw['target_distance_meters']?.toString() ?? e?['target_distance_meters']?.toString(),
        rest: '${raw['rest_seconds'] ?? e?['rest_seconds'] ?? 90}',
        notes: raw['notes']?.toString(),
      ));
    }

    _fetchLibrary();
  }

  @override
  void dispose() {
    _customNameCtrl.dispose();
    _repsMinCtrl.dispose();
    _repsMaxCtrl.dispose();
    _weightCtrl.dispose();
    _durationCtrl.dispose();
    _distanceCtrl.dispose();
    _restCtrl.dispose();
    _notesCtrl.dispose();
    for (final draft in _setDrafts) {
      draft.dispose();
    }
    super.dispose();
  }

  int? _asInt(dynamic v) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v);
    return null;
  }

  Future<void> _fetchLibrary() async {
    setState(() => _loadingLibrary = true);
    try {
      final response = await widget.apiClient.get('/exercises?limit=100');
      List<dynamic> items = [];
      if (response is Map && response['data'] is List) {
        items = response['data'] as List;
      } else if (response is List) {
        items = response;
      }
      if (mounted) {
        setState(() {
          _library = items;
          _loadingLibrary = false;
          if (_selectedExerciseId == null && _selectedExerciseName.isEmpty && _library.isNotEmpty) {
            _selectExercise(_library.first);
          } else if (_selectedExerciseId != null && _library.isNotEmpty) {
            final match = _library.firstWhere(
              (item) => _asInt(item['id']) == _selectedExerciseId,
              orElse: () => null,
            );
            if (match != null) {
              _selectedExerciseName = match['name']?.toString() ?? _selectedExerciseName;
              if (match['tracking_type'] != null) {
                _trackingType = match['tracking_type'].toString();
              }
            }
          }
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingLibrary = false);
    }
  }

  void _selectExercise(dynamic item) {
    setState(() {
      _selectedExerciseId = _asInt(item['id']);
      _selectedExerciseName = item['name']?.toString() ?? 'Exercise';
      _customNameCtrl.text = _selectedExerciseName;
      if (item['tracking_type'] != null) {
        _trackingType = item['tracking_type'].toString();
      }
    });
  }

  void _selectPreset(Map<String, String> preset) {
    setState(() {
      _selectedExerciseName = preset['name']!;
      _customNameCtrl.text = preset['name']!;
      _trackingType = preset['type']!;
      // Find matching item in library if present
      final match = _library.firstWhere(
        (item) => item['name']?.toString().toLowerCase() == preset['name']!.toLowerCase(),
        orElse: () => null,
      );
      if (match != null) {
        _selectedExerciseId = _asInt(match['id']);
      } else {
        _selectedExerciseId = null; // Will auto-create on save
      }
    });
  }

  void _updateSetCount(int newCount) {
    newCount = newCount.clamp(1, 20);
    setState(() {
      _targetSets = newCount;
      while (_setDrafts.length < _targetSets) {
        _setDrafts.add(WorkoutSetDraft(
          repsMin: _repsMinCtrl.text.isNotEmpty ? _repsMinCtrl.text : '8',
          repsMax: _repsMaxCtrl.text.isNotEmpty ? _repsMaxCtrl.text : '12',
          weight: _weightCtrl.text.isNotEmpty ? _weightCtrl.text : null,
          duration: _durationCtrl.text.isNotEmpty ? _durationCtrl.text : null,
          distance: _distanceCtrl.text.isNotEmpty ? _distanceCtrl.text : null,
          rest: _restCtrl.text.isNotEmpty ? _restCtrl.text : '90',
        ));
      }
      while (_setDrafts.length > _targetSets) {
        _setDrafts.removeLast().dispose();
      }
    });
  }

  void _applyDefaultsToAllSets() {
    setState(() {
      for (final draft in _setDrafts) {
        if (_repsMinCtrl.text.isNotEmpty) draft.repsMin.text = _repsMinCtrl.text;
        if (_repsMaxCtrl.text.isNotEmpty) draft.repsMax.text = _repsMaxCtrl.text;
        if (_weightCtrl.text.isNotEmpty) draft.weight.text = _weightCtrl.text;
        if (_durationCtrl.text.isNotEmpty) draft.duration.text = _durationCtrl.text;
        if (_distanceCtrl.text.isNotEmpty) draft.distance.text = _distanceCtrl.text;
        if (_restCtrl.text.isNotEmpty) draft.rest.text = _restCtrl.text;
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Applied default targets to all sets'), duration: Duration(seconds: 1)),
    );
  }

  Future<int?> _ensureExerciseId() async {
    if (_selectedExerciseId != null) return _selectedExerciseId;

    final name = _selectedExerciseName.trim().isNotEmpty
        ? _selectedExerciseName.trim()
        : _customNameCtrl.text.trim();
    if (name.isEmpty) return null;

    // First check if library now has it
    final existingMatch = _library.firstWhere(
      (item) => item['name']?.toString().toLowerCase() == name.toLowerCase(),
      orElse: () => null,
    );
    if (existingMatch != null && _asInt(existingMatch['id']) != null) {
      return _asInt(existingMatch['id']);
    }

    // Attempt to create custom exercise on backend
    try {
      final res = await widget.apiClient.post('/exercises', body: {
        'name': name,
        'trackingType': _trackingType,
        'instructions': 'Added via workout plan builder',
      });
      if (res is Map && res['data'] is Map && res['data']['id'] != null) {
        return _asInt(res['data']['id']);
      }
      if (res is Map && res['id'] != null) {
        return _asInt(res['id']);
      }
    } catch (_) {
      // Fallback: if user is admin, try /admin/exercises
      try {
        final adminRes = await widget.apiClient.post('/admin/exercises', body: {
          'name': name,
          'trackingType': _trackingType,
        });
        if (adminRes is Map && adminRes['data'] is Map && adminRes['data']['id'] != null) {
          return _asInt(adminRes['data']['id']);
        }
      } catch (_) {}
    }

    // If still null but library had at least 1, fallback to first library exercise
    if (_library.isNotEmpty) {
      return _asInt(_library.first['id']);
    }

    return null;
  }

  Future<void> _handleSave() async {
    setState(() {
      _saving = true;
      _errorMessage = null;
    });

    final exId = await _ensureExerciseId();
    if (exId == null && widget.existing == null) {
      setState(() {
        _saving = false;
        _errorMessage = 'Please select or name an exercise to proceed.';
      });
      return;
    }

    final minReps = int.tryParse(_repsMinCtrl.text);
    final maxReps = int.tryParse(_repsMaxCtrl.text);
    if (minReps != null && maxReps != null && maxReps < minReps) {
      setState(() {
        _saving = false;
        _errorMessage = 'Default Max Reps cannot be less than Min Reps.';
      });
      return;
    }

    // Assemble comprehensive payload
    final payload = <String, dynamic>{
      if (exId != null) 'exerciseId': exId,
      'targetSets': _setDrafts.length,
      if (minReps != null) 'repsMin': minReps,
      if (maxReps != null) 'repsMax': maxReps,
      if (int.tryParse(_durationCtrl.text) != null) 'targetDurationSeconds': int.tryParse(_durationCtrl.text),
      if (double.tryParse(_distanceCtrl.text) != null) 'targetDistanceMeters': double.tryParse(_distanceCtrl.text),
      'restSeconds': int.tryParse(_restCtrl.text) ?? 90,
      'isOptional': _isOptional,
      'notes': _notesCtrl.text.trim(),
      'sets': _setDrafts.asMap().entries.map((entry) {
        final s = entry.value;
        final sMin = int.tryParse(s.repsMin.text);
        final sMax = int.tryParse(s.repsMax.text);
        return <String, dynamic>{
          'setNumber': entry.key + 1,
          if (sMin != null) 'targetRepsMin': sMin,
          if (sMax != null) 'targetRepsMax': sMax,
          if (double.tryParse(s.weight.text) != null) 'targetWeightKg': double.tryParse(s.weight.text),
          if (int.tryParse(s.duration.text) != null) 'targetDurationSeconds': int.tryParse(s.duration.text),
          if (double.tryParse(s.distance.text) != null) 'targetDistanceMeters': double.tryParse(s.distance.text),
          if (int.tryParse(s.rest.text) != null) 'restSeconds': int.tryParse(s.rest.text),
          if (s.notes.text.trim().isNotEmpty) 'notes': s.notes.text.trim(),
        };
      }).toList(),
    };

    try {
      final exerciseId = _asInt(widget.existing?['id']);
      if (exerciseId == null) {
        await widget.apiClient.post(
          '/me/workout-plans/${widget.planId}/days/${widget.dayId}/exercises',
          body: payload,
        );
      } else {
        await widget.apiClient.patch(
          '/me/workout-plans/${widget.planId}/exercises/$exerciseId',
          body: payload,
        );
      }
      if (mounted) Navigator.pop(context, true);
    } catch (err) {
      if (mounted) {
        setState(() {
          _saving = false;
          _errorMessage = err.toString().replaceAll('Exception:', '').trim();
        });
      }
    }
  }

  void _showExercisePickerSheet(AppThemeColors colors) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (pickerCtx) {
        return StatefulBuilder(builder: (context, setPickerState) {
          final filtered = _library.where((item) {
            final name = item['name']?.toString().toLowerCase() ?? '';
            final muscle = item['target_muscle_group']?.toString().toLowerCase() ??
                item['muscle_group_name']?.toString().toLowerCase() ?? '';
            final matchesQuery = _searchQuery.isEmpty || name.contains(_searchQuery.toLowerCase());
            final matchesGroup = _selectedMuscleGroup == 'All' ||
                muscle.contains(_selectedMuscleGroup.toLowerCase());
            return matchesQuery && matchesGroup;
          }).toList();

          return Container(
            height: MediaQuery.of(context).size.height * 0.75,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: colors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Text(
                      'Select Exercise',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: colors.textPrimary,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20),
                      onPressed: () => Navigator.pop(pickerCtx),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                // Search Bar
                TextField(
                  onChanged: (v) => setPickerState(() => _searchQuery = v),
                  style: TextStyle(color: colors.textPrimary),
                  decoration: InputDecoration(
                    prefixIcon: Icon(Icons.search, color: colors.textMuted, size: 20),
                    hintText: 'Search 50+ exercises...',
                    filled: true,
                    fillColor: colors.surfaceElevated,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      borderSide: BorderSide(color: colors.border),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                // Muscle group chips
                SizedBox(
                  height: 34,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: _muscleGroupOptions.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 6),
                    itemBuilder: (context, idx) {
                      final group = _muscleGroupOptions[idx];
                      final isSelected = _selectedMuscleGroup == group;
                      return ChoiceChip(
                        label: Text(group, style: TextStyle(fontSize: 12, fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500)),
                        selected: isSelected,
                        selectedColor: colors.primary,
                        backgroundColor: colors.surfaceElevated,
                        labelStyle: TextStyle(color: isSelected ? colors.onPrimary : colors.textSecondary),
                        side: BorderSide(color: isSelected ? colors.primary : colors.border),
                        onSelected: (val) => setPickerState(() => _selectedMuscleGroup = group),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 12),
                // List of exercises
                Expanded(
                  child: filtered.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.search_off_rounded, size: 40, color: colors.textMuted),
                              const SizedBox(height: 8),
                              Text('No matching exercises', style: TextStyle(color: colors.textSecondary, fontWeight: FontWeight.w600)),
                              const SizedBox(height: 4),
                              Text('Use custom name below to add directly', style: TextStyle(color: colors.textMuted, fontSize: 12)),
                            ],
                          ),
                        )
                      : ListView.separated(
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => Divider(height: 1, color: colors.border),
                          itemBuilder: (context, idx) {
                            final item = filtered[idx];
                            final name = item['name']?.toString() ?? 'Exercise';
                            final muscle = item['target_muscle_group']?.toString() ??
                                item['muscle_group_name']?.toString() ?? '';
                            final type = item['tracking_type']?.toString() ?? 'weight_reps';
                            final isSel = _selectedExerciseId == _asInt(item['id']);

                            return ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                              title: Text(
                                name,
                                style: TextStyle(
                                  fontWeight: isSel ? FontWeight.w800 : FontWeight.w600,
                                  color: isSel ? colors.cyan : colors.textPrimary,
                                ),
                              ),
                              subtitle: Row(
                                children: [
                                  if (muscle.isNotEmpty)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      margin: const EdgeInsets.only(right: 6),
                                      decoration: BoxDecoration(
                                        color: colors.surfaceElevated,
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(muscle, style: TextStyle(fontSize: 10, color: colors.textMuted)),
                                    ),
                                  Text(
                                    _formatTrackingType(type),
                                    style: TextStyle(fontSize: 11, color: colors.textSecondary),
                                  ),
                                ],
                              ),
                              trailing: isSel ? Icon(Icons.check_circle, color: colors.cyan, size: 20) : null,
                              onTap: () {
                                _selectExercise(item);
                                Navigator.pop(pickerCtx);
                              },
                            );
                          },
                        ),
                ),
              ],
            ),
          );
        });
      },
    );
  }

  String _formatTrackingType(String type) {
    switch (type) {
      case 'reps_only':
        return 'Reps Only';
      case 'duration':
        return 'Duration / Time';
      case 'distance':
        return 'Cardio / Distance';
      default:
        return 'Weight & Reps';
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final isEditing = widget.existing != null;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.92,
      ),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: colors.border, width: 1),
      ),
      child: Column(
        children: [
          // Drag handle
          Padding(
            padding: const EdgeInsets.only(top: 10, bottom: 6),
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: colors.borderHover,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: colors.cyanMuted,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                  ),
                  child: Icon(Icons.fitness_center_rounded, color: colors.cyan, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isEditing ? 'Edit Exercise' : 'Add Exercise',
                        style: TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w800,
                          color: colors.textPrimary,
                          letterSpacing: -0.3,
                        ),
                      ),
                      if (widget.dayName != null)
                        Text(
                          widget.dayName!,
                          style: TextStyle(fontSize: 12, color: colors.textSecondary),
                        ),
                    ],
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.close_rounded, color: colors.textSecondary),
                  onPressed: () => Navigator.pop(context, false),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: colors.border),

          // Scrollable Content
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              children: [
                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 14),
                    decoration: BoxDecoration(
                      color: colors.roseMuted,
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      border: Border.all(color: colors.rose.withOpacity(0.5)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline_rounded, color: colors.rose, size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: TextStyle(color: colors.rose, fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // 1. EXERCISE SELECTOR CARD
                _buildExerciseSelectorSection(colors),

                const SizedBox(height: 16),

                // 2. TRACKING TYPE SEGMENTED CHIPS
                _buildTrackingTypeSection(colors),

                const SizedBox(height: 16),

                // 3. TARGET PRESCRIPTION & DEFAULTS
                _buildDefaultsSection(colors),

                const SizedBox(height: 16),

                // 4. PER-SET TARGETS LIST
                _buildPerSetSection(colors),

                const SizedBox(height: 16),

                // 5. ADDITIONAL OPTIONS & NOTES
                _buildOptionsSection(colors),

                const SizedBox(height: 20),
              ],
            ),
          ),

          // Bottom Action Bar
          Container(
            padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(context).viewInsets.bottom + 16),
            decoration: BoxDecoration(
              color: colors.surface,
              border: Border(top: BorderSide(color: colors.border, width: 1)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: PremiumButton(
                    text: 'Cancel',
                    isSecondary: true,
                    onPressed: () => Navigator.pop(context, false),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: PremiumButton(
                    text: isEditing ? 'Update Exercise' : 'Save Exercise',
                    loading: _saving,
                    onPressed: _handleSave,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ==========================================
  // SECTION BUILDERS
  // ==========================================

  Widget _buildExerciseSelectorSection(AppThemeColors colors) {
    final hasSelection = _selectedExerciseName.isNotEmpty;

    if (_library.isEmpty && !_loadingLibrary) {
      // Empty Library State: Friendly custom creator + quick presets
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: colors.surfaceElevated,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(color: colors.amber.withOpacity(0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.edit_note_rounded, color: colors.amber, size: 20),
                const SizedBox(width: 8),
                Text(
                  'Name Your Exercise',
                  style: TextStyle(fontWeight: FontWeight.w700, color: colors.textPrimary, fontSize: 14),
                ),
                const Spacer(),
                TextButton(
                  onPressed: _fetchLibrary,
                  style: TextButton.styleFrom(padding: EdgeInsets.zero, visualDensity: VisualDensity.compact),
                  child: Text('Retry Library', style: TextStyle(color: colors.cyan, fontSize: 12)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _customNameCtrl,
              style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600),
              onChanged: (val) => setState(() => _selectedExerciseName = val),
              decoration: InputDecoration(
                hintText: 'e.g., Barbell Bench Press, Incline DB Curl...',
                filled: true,
                fillColor: colors.card,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: colors.border)),
              ),
            ),
            const SizedBox(height: 10),
            Text('Quick Presets:', style: TextStyle(color: colors.textSecondary, fontSize: 11, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _commonPresets.map((preset) {
                final isCur = _selectedExerciseName == preset['name'];
                return ActionChip(
                  label: Text(preset['name']!, style: TextStyle(fontSize: 11, color: isCur ? colors.onPrimary : colors.textPrimary)),
                  backgroundColor: isCur ? colors.primary : colors.card,
                  side: BorderSide(color: isCur ? colors.primary : colors.border),
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  onPressed: () => _selectPreset(preset),
                );
              }).toList(),
            ),
          ],
        ),
      );
    }

    // Standard Library Card with Browse Button
    return InkWell(
      onTap: () => _showExercisePickerSheet(colors),
      borderRadius: BorderRadius.circular(AppRadii.lg),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: colors.surfaceElevated,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(color: hasSelection ? colors.cyan.withOpacity(0.4) : colors.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'EXERCISE MOVEMENT',
                    style: TextStyle(color: colors.textMuted, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    hasSelection ? _selectedExerciseName : 'Tap to select an exercise...',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: hasSelection ? colors.textPrimary : colors.textMuted,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: colors.cyanMuted,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          _formatTrackingType(_trackingType).toUpperCase(),
                          style: TextStyle(color: colors.cyan, fontSize: 9, fontWeight: FontWeight.w800),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${_library.length} exercises in catalog',
                        style: TextStyle(color: colors.textMuted, fontSize: 11),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: colors.border),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    hasSelection ? 'Change' : 'Browse',
                    style: TextStyle(color: colors.textPrimary, fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(width: 4),
                  Icon(Icons.arrow_forward_ios_rounded, size: 10, color: colors.textSecondary),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTrackingTypeSection(AppThemeColors colors) {
    const types = [
      {'id': 'weight_reps', 'label': 'Weight & Reps', 'icon': Icons.fitness_center_rounded},
      {'id': 'reps_only', 'label': 'Reps Only', 'icon': Icons.accessibility_new_rounded},
      {'id': 'duration', 'label': 'Duration', 'icon': Icons.timer_outlined},
      {'id': 'distance', 'label': 'Distance', 'icon': Icons.directions_run_rounded},
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'TRACKING TYPE',
          style: TextStyle(color: colors.textMuted, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.5),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 38,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: types.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, idx) {
              final t = types[idx];
              final isSel = _trackingType == t['id'];
              return InkWell(
                onTap: () => setState(() => _trackingType = t['id'] as String),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: isSel ? colors.primary : colors.surfaceElevated,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: isSel ? colors.primary : colors.border),
                  ),
                  child: Row(
                    children: [
                      Icon(t['icon'] as IconData, size: 16, color: isSel ? colors.onPrimary : colors.textSecondary),
                      const SizedBox(width: 6),
                      Text(
                        t['label'] as String,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                          color: isSel ? colors.onPrimary : colors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildDefaultsSection(AppThemeColors colors) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'TARGET PRESCRIPTION',
                style: TextStyle(color: colors.textMuted, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.5),
              ),
              const Spacer(),
              // Quick sets preset pills
              Row(
                children: [3, 4, 5].map((cnt) {
                  final isCur = _targetSets == cnt;
                  return Padding(
                    padding: const EdgeInsets.only(left: 4),
                    child: InkWell(
                      onTap: () => _updateSetCount(cnt),
                      borderRadius: BorderRadius.circular(4),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: isCur ? colors.cyan : colors.card,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: isCur ? colors.cyan : colors.border),
                        ),
                        child: Text(
                          '$cnt sets',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: isCur ? Colors.black : colors.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Sets stepper & Rest row
          Row(
            children: [
              // Sets Stepper
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Sets', style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Container(
                      height: 46,
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: colors.border),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.remove, size: 18),
                            color: colors.textSecondary,
                            onPressed: _targetSets > 1 ? () => _updateSetCount(_targetSets - 1) : null,
                          ),
                          Text(
                            '$_targetSets',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: colors.textPrimary),
                          ),
                          IconButton(
                            icon: const Icon(Icons.add, size: 18),
                            color: colors.textSecondary,
                            onPressed: _targetSets < 20 ? () => _updateSetCount(_targetSets + 1) : null,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              // Rest Seconds
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Rest (sec)', style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    TextField(
                      controller: _restCtrl,
                      keyboardType: TextInputType.number,
                      style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
                      decoration: InputDecoration(
                        hintText: '90',
                        suffixText: 'sec',
                        suffixStyle: TextStyle(color: colors.textMuted, fontSize: 12),
                        filled: true,
                        fillColor: colors.card,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: colors.border)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Contextual Target Inputs based on trackingType
          if (_trackingType == 'weight_reps' || _trackingType == 'reps_only') ...[
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Default Min Reps', style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      TextField(
                        controller: _repsMinCtrl,
                        keyboardType: TextInputType.number,
                        style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
                        decoration: InputDecoration(
                          hintText: '8',
                          filled: true,
                          fillColor: colors.card,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: colors.border)),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Default Max Reps', style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      TextField(
                        controller: _repsMaxCtrl,
                        keyboardType: TextInputType.number,
                        style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
                        decoration: InputDecoration(
                          hintText: '12',
                          filled: true,
                          fillColor: colors.card,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: colors.border)),
                        ),
                      ),
                    ],
                  ),
                ),
                if (_trackingType == 'weight_reps') ...[
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Target (kg)', style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        TextField(
                          controller: _weightCtrl,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
                          decoration: InputDecoration(
                            hintText: 'e.g. 60',
                            filled: true,
                            fillColor: colors.card,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: colors.border)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 8),
            // Quick rep presets
            Row(
              children: [
                Text('Presets: ', style: TextStyle(color: colors.textMuted, fontSize: 11)),
                _repPresetChip('6-8', 6, 8, colors),
                _repPresetChip('8-12', 8, 12, colors),
                _repPresetChip('10-15', 10, 15, colors),
                _repPresetChip('12-15', 12, 15, colors),
              ],
            ),
          ] else if (_trackingType == 'duration') ...[
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Target Duration (sec)', style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      TextField(
                        controller: _durationCtrl,
                        keyboardType: TextInputType.number,
                        style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
                        decoration: InputDecoration(
                          hintText: 'e.g. 60',
                          suffixText: 'sec',
                          filled: true,
                          fillColor: colors.card,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: colors.border)),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ] else if (_trackingType == 'distance') ...[
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Distance (meters)', style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      TextField(
                        controller: _distanceCtrl,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
                        decoration: InputDecoration(
                          hintText: 'e.g. 1000',
                          suffixText: 'm',
                          filled: true,
                          fillColor: colors.card,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: colors.border)),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Duration (sec)', style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      TextField(
                        controller: _durationCtrl,
                        keyboardType: TextInputType.number,
                        style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
                        decoration: InputDecoration(
                          hintText: 'e.g. 300',
                          suffixText: 'sec',
                          filled: true,
                          fillColor: colors.card,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: colors.border)),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _repPresetChip(String label, int min, int max, AppThemeColors colors) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: InkWell(
        onTap: () {
          setState(() {
            _repsMinCtrl.text = '$min';
            _repsMaxCtrl.text = '$max';
          });
        },
        borderRadius: BorderRadius.circular(4),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: colors.border),
          ),
          child: Text(label, style: TextStyle(fontSize: 10, color: colors.textSecondary, fontWeight: FontWeight.w600)),
        ),
      ),
    );
  }

  Widget _buildPerSetSection(AppThemeColors colors) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'PER-SET PRESCRIPTIONS (${_setDrafts.length})',
              style: TextStyle(color: colors.textMuted, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.5),
            ),
            const Spacer(),
            TextButton.icon(
              onPressed: _applyDefaultsToAllSets,
              icon: Icon(Icons.sync_rounded, size: 14, color: colors.cyan),
              label: Text('Apply Defaults', style: TextStyle(fontSize: 11, color: colors.cyan, fontWeight: FontWeight.w700)),
              style: TextButton.styleFrom(padding: EdgeInsets.zero, visualDensity: VisualDensity.compact),
            ),
          ],
        ),
        const SizedBox(height: 8),

        // Set Cards
        ..._setDrafts.asMap().entries.map((entry) {
          final idx = entry.key;
          final draft = entry.value;

          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: colors.surfaceElevated,
              borderRadius: BorderRadius.circular(AppRadii.md),
              border: Border.all(color: colors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Set Header
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: colors.cyanMuted,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'SET ${idx + 1}',
                        style: TextStyle(
                          color: colors.cyan,
                          fontWeight: FontWeight.w800,
                          fontSize: 11,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                    const Spacer(),
                    if (_setDrafts.length > 1)
                      IconButton(
                        icon: Icon(Icons.delete_outline_rounded, size: 18, color: colors.rose),
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        onPressed: () {
                          setState(() {
                            final removed = _setDrafts.removeAt(idx);
                            removed.dispose();
                            _targetSets = _setDrafts.length;
                          });
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 10),

                // Responsive Fields according to trackingType
                if (_trackingType == 'weight_reps') ...[
                  Row(
                    children: [
                      Expanded(
                        child: _compactField('Min Reps', draft.repsMin, TextInputType.number, colors),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _compactField('Max Reps', draft.repsMax, TextInputType.number, colors),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _compactField('Weight (kg)', draft.weight, const TextInputType.numberWithOptions(decimal: true), colors),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _compactField('Rest (s)', draft.rest, TextInputType.number, colors),
                      ),
                    ],
                  ),
                ] else if (_trackingType == 'reps_only') ...[
                  Row(
                    children: [
                      Expanded(
                        child: _compactField('Min Reps', draft.repsMin, TextInputType.number, colors),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _compactField('Max Reps', draft.repsMax, TextInputType.number, colors),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _compactField('Rest (sec)', draft.rest, TextInputType.number, colors),
                      ),
                    ],
                  ),
                ] else if (_trackingType == 'duration') ...[
                  Row(
                    children: [
                      Expanded(
                        child: _compactField('Duration (sec)', draft.duration, TextInputType.number, colors),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _compactField('Rest (sec)', draft.rest, TextInputType.number, colors),
                      ),
                    ],
                  ),
                ] else if (_trackingType == 'distance') ...[
                  Row(
                    children: [
                      Expanded(
                        child: _compactField('Distance (m)', draft.distance, const TextInputType.numberWithOptions(decimal: true), colors),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _compactField('Duration (s)', draft.duration, TextInputType.number, colors),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _compactField('Rest (s)', draft.rest, TextInputType.number, colors),
                      ),
                    ],
                  ),
                ],

                const SizedBox(height: 8),
                // Compact set notes
                TextField(
                  controller: draft.notes,
                  style: TextStyle(color: colors.textPrimary, fontSize: 12),
                  decoration: InputDecoration(
                    hintText: 'Set ${idx + 1} notes (e.g., RPE 8, drop set, warm-up)...',
                    hintStyle: TextStyle(color: colors.textMuted, fontSize: 11),
                    filled: true,
                    fillColor: colors.card,
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: BorderSide(color: colors.border)),
                  ),
                ),
              ],
            ),
          );
        }),

        const SizedBox(height: 4),
        // Add Set Button
        OutlinedButton.icon(
          onPressed: () => _updateSetCount(_targetSets + 1),
          icon: const Icon(Icons.add, size: 16),
          label: const Text('Add Another Set'),
          style: OutlinedButton.styleFrom(
            foregroundColor: colors.primary,
            side: BorderSide(color: colors.border),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            minimumSize: const Size(double.infinity, 38),
          ),
        ),
      ],
    );
  }

  Widget _compactField(String label, TextEditingController ctrl, TextInputType keyboard, AppThemeColors colors) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(color: colors.textMuted, fontSize: 10, fontWeight: FontWeight.w600)),
        const SizedBox(height: 3),
        TextField(
          controller: ctrl,
          keyboardType: keyboard,
          style: TextStyle(color: colors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700),
          decoration: InputDecoration(
            filled: true,
            fillColor: colors.card,
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: BorderSide(color: colors.border)),
          ),
        ),
      ],
    );
  }

  Widget _buildOptionsSection(AppThemeColors colors) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Optional Exercise',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: colors.textPrimary),
                    ),
                    Text(
                      'Athletes can skip this exercise without penalty',
                      style: TextStyle(fontSize: 11, color: colors.textMuted),
                    ),
                  ],
                ),
              ),
              Switch(
                value: _isOptional,
                activeColor: colors.cyan,
                onChanged: (val) => setState(() => _isOptional = val),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Exercise Coach Notes',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.textSecondary),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _notesCtrl,
            maxLines: 2,
            style: TextStyle(color: colors.textPrimary, fontSize: 13),
            decoration: InputDecoration(
              hintText: 'Tempo cues (e.g. 3-0-1-0), equipment setup, or form guidance...',
              hintStyle: TextStyle(color: colors.textMuted, fontSize: 12),
              filled: true,
              fillColor: colors.card,
              contentPadding: const EdgeInsets.all(12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: colors.border)),
            ),
          ),
        ],
      ),
    );
  }
}
