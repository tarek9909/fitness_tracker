import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';

/// Single set draft holding live controllers for per-set prescriptions (kept for backward compatibility)
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

/// Workout Exercise Editor Modal
/// Directly aligns with the web admin dashboard flow (WorkoutPlanBuilderPage.tsx):
/// 1. Select Exercise (Searchable library dropdown / picker with quick presets fallback)
/// 2. Working Sets, Min Reps, Max Reps (3-column layout)
/// 3. Rest (seconds) with quick preset chips
/// 4. Technique & Cue Notes
/// 5. Mark as Optional Movement
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

  /// Opens the editor inside a modal bottom sheet
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
  String _selectedMuscleGroupName = '';
  String _trackingType = 'weight_reps';
  bool _useCustomExercise = false;
  final TextEditingController _customNameCtrl = TextEditingController();

  // Dashboard-parity form controllers
  late final TextEditingController _setsCtrl;
  late final TextEditingController _repsMinCtrl;
  late final TextEditingController _repsMaxCtrl;
  late final TextEditingController _restCtrl;
  late final TextEditingController _weightCtrl;
  late final TextEditingController _durationCtrl;
  late final TextEditingController _distanceCtrl;
  late final TextEditingController _notesCtrl;
  bool _isOptional = false;

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
    _selectedMuscleGroupName = e?['primary_muscle_group_name']?.toString() ??
        e?['target_muscle_group']?.toString() ??
        e?['muscle_group_name']?.toString() ?? '';
    _customNameCtrl.text = _selectedExerciseName;

    final rawTrackingType = e?['tracking_type_snapshot'] ?? e?['tracking_type'];
    if (rawTrackingType != null && rawTrackingType.toString().isNotEmpty) {
      _trackingType = rawTrackingType.toString();
    }

    final targetSets = _asInt(e?['target_sets']) ?? ((e?['sets'] as List?)?.length ?? 3);
    _setsCtrl = TextEditingController(text: '${targetSets < 1 ? 3 : targetSets}');

    final usesReps = _supportsRepsFor(_trackingType);
    _repsMinCtrl = TextEditingController(text: usesReps ? '${e?['target_reps_min'] ?? e?['reps_min'] ?? 8}' : '');
    _repsMaxCtrl = TextEditingController(text: usesReps ? '${e?['target_reps_max'] ?? e?['reps_max'] ?? 12}' : '');
    _restCtrl = TextEditingController(text: '${e?['rest_seconds'] ?? 90}');
    final firstSet = (e?['sets'] as List?)?.isNotEmpty == true
        ? (e?['sets'] as List).first
        : null;
    _weightCtrl = TextEditingController(text: '${firstSet is Map ? firstSet['target_weight_kg'] ?? firstSet['targetWeightKg'] ?? '' : ''}');
    _durationCtrl = TextEditingController(text: '${e?['target_duration_seconds'] ?? (firstSet is Map ? firstSet['target_duration_seconds'] ?? firstSet['targetDurationSeconds'] ?? '' : '')}');
    _distanceCtrl = TextEditingController(text: '${e?['target_distance_meters'] ?? (firstSet is Map ? firstSet['target_distance_meters'] ?? firstSet['targetDistanceMeters'] ?? '' : '')}');
    _notesCtrl = TextEditingController(text: e?['notes']?.toString() ?? '');
    _isOptional = e?['is_optional'] == 1 || e?['isOptional'] == true;

    _fetchLibrary();
  }

  @override
  void dispose() {
    _customNameCtrl.dispose();
    _setsCtrl.dispose();
    _repsMinCtrl.dispose();
    _repsMaxCtrl.dispose();
    _restCtrl.dispose();
    _weightCtrl.dispose();
    _durationCtrl.dispose();
    _distanceCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  int? _asInt(dynamic v) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v);
    return null;
  }

  bool _supportsRepsFor(String trackingType) =>
      trackingType != 'duration' && trackingType != 'distance';

  bool get _supportsReps => _supportsRepsFor(_trackingType);
  bool get _supportsWeight =>
      _trackingType == 'weight_reps' || _trackingType == 'weight_duration';
  bool get _supportsDuration =>
      _trackingType == 'duration' || _trackingType == 'weight_duration';
  bool get _supportsDistance => _trackingType == 'distance';

  void _startCustomExercise({String? name}) {
    setState(() {
      _useCustomExercise = true;
      _selectedExerciseId = null;
      _selectedExerciseName = name ?? '';
      _selectedMuscleGroupName = name == null ? '' : 'Custom';
      _customNameCtrl.text = name ?? '';
      _trackingType = 'weight_reps';
      _repsMinCtrl.text = '8';
      _repsMaxCtrl.text = '12';
      _durationCtrl.clear();
      _distanceCtrl.clear();
      _weightCtrl.clear();
      _errorMessage = null;
    });
  }

  void _useLibraryExercise() {
    setState(() {
      _useCustomExercise = false;
      _selectedExerciseId = null;
      _selectedExerciseName = '';
      _selectedMuscleGroupName = '';
      _errorMessage = null;
    });
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
          if (_library.isEmpty && widget.existing == null) {
            _useCustomExercise = true;
          }
          if (_selectedExerciseId == null &&
              _selectedExerciseName.isEmpty &&
              _library.isNotEmpty &&
              !_useCustomExercise &&
              widget.existing == null) {
            final first = _library.first;
            _selectedExerciseId = _asInt(first['id']);
            _selectedExerciseName = first['name']?.toString() ?? 'Exercise';
            _selectedMuscleGroupName =
                first['primary_muscle_group_name']?.toString() ??
                    first['target_muscle_group']?.toString() ??
                    first['muscle_group_name']?.toString() ??
                    '';
            _customNameCtrl.text = _selectedExerciseName;
            if (first['tracking_type'] != null) {
              _trackingType = first['tracking_type'].toString();
            }
          } else if (_selectedExerciseId != null && _library.isNotEmpty) {
            final match = _library.firstWhere(
              (item) => _asInt(item['id']) == _selectedExerciseId,
              orElse: () => null,
            );
            if (match != null) {
              _selectedExerciseName = match['name']?.toString() ?? _selectedExerciseName;
              _selectedMuscleGroupName = match['primary_muscle_group_name']?.toString() ??
                  match['target_muscle_group']?.toString() ??
                  match['muscle_group_name']?.toString() ?? '';
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
      _useCustomExercise = false;
      _selectedExerciseId = _asInt(item['id']);
      _selectedExerciseName = item['name']?.toString() ?? 'Exercise';
      _selectedMuscleGroupName = item['primary_muscle_group_name']?.toString() ??
          item['target_muscle_group']?.toString() ??
          item['muscle_group_name']?.toString() ?? '';
      _customNameCtrl.text = _selectedExerciseName;
      if (item['tracking_type'] != null) {
        _trackingType = item['tracking_type'].toString();
      }
    });
  }

  Future<int?> _ensureExerciseId() async {
    if (_selectedExerciseId != null) return _selectedExerciseId;
    final name = _selectedExerciseName.trim().isNotEmpty
        ? _selectedExerciseName.trim()
        : _customNameCtrl.text.trim();
    if (name.isEmpty) return null;

    final lowerName = name.toLowerCase();

    // 1. Search existing library
    final existingLib = _library.firstWhere(
      (item) => item['name']?.toString().trim().toLowerCase() == lowerName,
      orElse: () => null,
    );
    if (existingLib != null && _asInt(existingLib['id']) != null) {
      final id = _asInt(existingLib['id']);
      _selectedExerciseId = id;
      return id;
    }

    // 2. Search server by exact name
    try {
      final searchRes = await widget.apiClient.get(
        '/exercises?search=${Uri.encodeComponent(name)}&limit=5',
      );
      List<dynamic> searchItems = [];
      if (searchRes is Map && searchRes['data'] is List) {
        searchItems = searchRes['data'] as List;
      } else if (searchRes is List) {
        searchItems = searchRes;
      }
      final searchMatch = searchItems.firstWhere(
        (item) => item['name']?.toString().trim().toLowerCase() == lowerName,
        orElse: () => null,
      );
      if (searchMatch != null && _asInt(searchMatch['id']) != null) {
        final id = _asInt(searchMatch['id']);
        _selectedExerciseId = id;
        return id;
      }
    } catch (_) {}

    // 3. Create the custom exercise through the user-scoped exercise endpoint.
    // Never silently substitute another library exercise: that would save a
    // different movement than the one the user entered.
    try {
      final res = await widget.apiClient.post('/exercises', body: {
        'name': name,
        'trackingType': _trackingType,
        'instructions': 'Added via workout plan builder',
      });
      if (res is Map && res['data'] is Map && res['data']['id'] != null) {
        final id = _asInt(res['data']['id']);
        _selectedExerciseId = id;
        return id;
      }
      if (res is Map && res['id'] != null) {
        final id = _asInt(res['id']);
        _selectedExerciseId = id;
        return id;
      }
    } catch (_) {}

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
        _errorMessage = _useCustomExercise
            ? 'Enter a name for the custom exercise'
            : 'Select an exercise from the library or choose Create custom exercise';
      });
      return;
    }

    final targetSets = int.tryParse(_setsCtrl.text.trim());
    if (targetSets == null || targetSets < 1) {
      setState(() {
        _saving = false;
        _errorMessage = 'Please enter valid target sets (minimum 1)';
      });
      return;
    }

    int? repsMin;
    int? repsMax;
    if (_supportsReps) {
      repsMin = int.tryParse(_repsMinCtrl.text.trim());
      if (repsMin == null || repsMin < 1) {
        setState(() {
          _saving = false;
          _errorMessage = 'Please enter valid minimum reps (minimum 1)';
        });
        return;
      }

      repsMax = int.tryParse(_repsMaxCtrl.text.trim());
      if (repsMax != null && repsMax < repsMin) {
        setState(() {
          _saving = false;
          _errorMessage = 'Max reps cannot be less than Min reps';
        });
        return;
      }
    }

    double? targetWeight;
    if (_supportsWeight && _weightCtrl.text.trim().isNotEmpty) {
      targetWeight = double.tryParse(_weightCtrl.text.trim());
      if (targetWeight == null || targetWeight < 0 || targetWeight > 1000) {
        setState(() {
          _saving = false;
          _errorMessage = 'Target weight must be between 0 and 1,000 kg';
        });
        return;
      }
    }

    int? targetDuration;
    if (_supportsDuration) {
      targetDuration = int.tryParse(_durationCtrl.text.trim());
      if (targetDuration == null || targetDuration < 1 || targetDuration > 86400) {
        setState(() {
          _saving = false;
          _errorMessage = 'Enter a duration between 1 and 86,400 seconds';
        });
        return;
      }
    }

    double? targetDistance;
    if (_supportsDistance) {
      targetDistance = double.tryParse(_distanceCtrl.text.trim());
      if (targetDistance == null || targetDistance <= 0 || targetDistance > 1000000) {
        setState(() {
          _saving = false;
          _errorMessage = 'Enter a distance between 0.01 and 1,000,000 meters';
        });
        return;
      }
    }

    final restSeconds = int.tryParse(_restCtrl.text.trim()) ?? 90;
    if (restSeconds < 0) {
      setState(() {
        _saving = false;
        _errorMessage = 'Rest seconds cannot be negative';
      });
      return;
    }

    final notes = _notesCtrl.text.trim();

    // Build complete payload matching dashboard
    final payload = <String, dynamic>{
      if (exId != null) 'exerciseId': exId,
      'targetSets': targetSets,
      if (repsMin != null) 'repsMin': repsMin,
      if (repsMax != null) 'repsMax': repsMax,
      if (targetDuration != null) 'targetDurationSeconds': targetDuration,
      if (targetDistance != null) 'targetDistanceMeters': targetDistance,
      'restSeconds': restSeconds,
      if (notes.isNotEmpty) 'notes': notes,
      'isOptional': _isOptional,
      // Generated sets array for complete downstream compatibility
      'sets': List.generate(targetSets, (index) => {
        'setNumber': index + 1,
        if (repsMin != null) 'targetRepsMin': repsMin,
        if (repsMax != null) 'targetRepsMax': repsMax,
        if (targetWeight != null) 'targetWeightKg': targetWeight,
        if (targetDuration != null) 'targetDurationSeconds': targetDuration,
        if (targetDistance != null) 'targetDistanceMeters': targetDistance,
        'restSeconds': restSeconds,
        if (notes.isNotEmpty) 'notes': notes,
      }),
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
            final muscle = item['primary_muscle_group_name']?.toString().toLowerCase() ??
                item['target_muscle_group']?.toString().toLowerCase() ??
                item['muscle_group_name']?.toString().toLowerCase() ?? '';
            final matchesQuery = _searchQuery.isEmpty || name.contains(_searchQuery.toLowerCase());
            final matchesGroup = _selectedMuscleGroup == 'All' ||
                muscle.contains(_selectedMuscleGroup.toLowerCase());
            return matchesQuery && matchesGroup;
          }).toList();

          return Container(
            height: MediaQuery.of(context).size.height * 0.8,
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
                    hintText: 'Search exercises...',
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
                SizedBox(
                  width: double.infinity,
                  child: PremiumButton(
                    text: _searchQuery.trim().isEmpty
                        ? 'Create custom exercise'
                        : 'Create "${_searchQuery.trim()}" as custom',
                    isSecondary: true,
                    icon: const Icon(Icons.add_circle_outline, size: 18),
                    onPressed: () {
                      _startCustomExercise(
                        name: _searchQuery.trim().isEmpty
                            ? null
                            : _searchQuery.trim(),
                      );
                      Navigator.pop(pickerCtx);
                    },
                  ),
                ),
                const SizedBox(height: 12),
                // List of exercises
                Expanded(
                  child: filtered.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.fitness_center_rounded, size: 40, color: colors.primary),
                                const SizedBox(height: 12),
                                Text(
                                  _searchQuery.trim().isEmpty ? 'No matching exercises' : 'No catalog match for "${_searchQuery.trim()}"',
                                  style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
                                  textAlign: TextAlign.center,
                                ),
                                const SizedBox(height: 6),
                                Text('You can add this as your custom exercise:', style: TextStyle(color: colors.textMuted, fontSize: 12)),
                                if (_searchQuery.trim().isNotEmpty) ...[
                                  const SizedBox(height: 14),
                                  ElevatedButton.icon(
                                    onPressed: () {
                                      final q = _searchQuery.trim();
                                      _startCustomExercise(name: q);
                                      Navigator.pop(pickerCtx);
                                    },
                                    icon: const Icon(Icons.add_circle_outline, size: 18),
                                    label: Text('Use "$_searchQuery" as Custom Exercise'),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: colors.primary,
                                      foregroundColor: colors.onPrimary,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        )
                      : ListView.separated(
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => Divider(height: 1, color: colors.border),
                          itemBuilder: (context, idx) {
                            final item = filtered[idx];
                            final name = item['name']?.toString() ?? 'Exercise';
                            final muscle = item['primary_muscle_group_name']?.toString() ??
                                item['target_muscle_group']?.toString() ??
                                item['muscle_group_name']?.toString() ?? 'General';
                            final isSel = _selectedExerciseId == _asInt(item['id']);

                            return ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                              title: Text(
                                '$name ($muscle)',
                                style: TextStyle(
                                  fontWeight: isSel ? FontWeight.w800 : FontWeight.w600,
                                  color: isSel ? colors.primary : colors.textPrimary,
                                ),
                              ),
                              trailing: isSel ? Icon(Icons.check_circle, color: colors.primary, size: 20) : null,
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

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final isEditing = widget.existing != null;
    final title = isEditing
        ? 'Edit ${_selectedExerciseName.isNotEmpty ? _selectedExerciseName : "Exercise"}'
        : (widget.dayName != null ? 'Add Exercise to ${widget.dayName}' : 'Add Exercise to Workout Day');

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.90,
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
                    color: colors.primaryMuted,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                  ),
                  child: Icon(Icons.fitness_center_rounded, color: colors.primary, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: colors.textPrimary,
                          letterSpacing: -0.3,
                        ),
                      ),
                      if (widget.dayName != null && isEditing)
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

          // Form Body (Clean Dashboard Flow)
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              children: [
                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 14),
                    decoration: BoxDecoration(
                      color: colors.roseMuted,
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      border: Border.all(color: colors.rose.withValues(alpha: 0.5)),
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

                // 1. SELECT EXERCISE (Dashboard FormField)
                Text(
                  'Select Exercise',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),

                if (!isEditing) ...[
                  Row(
                    children: [
                      Expanded(
                        child: PremiumButton(
                          text: 'Library exercise',
                          height: 42,
                          isSecondary: _useCustomExercise,
                          icon: const Icon(Icons.menu_book_outlined, size: 17),
                          onPressed: _useLibraryExercise,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: PremiumButton(
                          text: 'Custom exercise',
                          height: 42,
                          isSecondary: !_useCustomExercise,
                          icon: const Icon(Icons.edit_note_outlined, size: 17),
                          onPressed: _startCustomExercise,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                ],

                if (!isEditing &&
                    (_useCustomExercise ||
                        (_library.isEmpty && !_loadingLibrary))) ...[
                  // Empty Library or Quick Presets
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: colors.surfaceElevated,
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      border: Border.all(color: colors.amber.withValues(alpha: 0.4)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.edit_note_rounded, color: colors.amber, size: 18),
                            const SizedBox(width: 6),
                            Text(
                              'Name Your Exercise',
                              style: TextStyle(fontWeight: FontWeight.w700, color: colors.textPrimary, fontSize: 13),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          key: const Key('input-custom-exercise-name'),
                          controller: _customNameCtrl,
                          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600),
                          onChanged: (val) => setState(() => _selectedExerciseName = val),
                          decoration: InputDecoration(
                            hintText: 'e.g., Barbell Bench Press, Incline DB Curl...',
                            filled: true,
                            fillColor: colors.card,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: BorderSide(color: colors.border),
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        DropdownButtonFormField<String>(
                          initialValue: _trackingType,
                          isExpanded: true,
                          decoration: InputDecoration(
                            labelText: 'How will you track it?',
                            filled: true,
                            fillColor: colors.card,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(AppRadii.md),
                              borderSide: BorderSide(color: colors.border),
                            ),
                          ),
                          items: const [
                            DropdownMenuItem(value: 'weight_reps', child: Text('Weight and reps')),
                            DropdownMenuItem(value: 'reps_only', child: Text('Reps only')),
                            DropdownMenuItem(value: 'duration', child: Text('Duration')),
                            DropdownMenuItem(value: 'distance', child: Text('Distance')),
                            DropdownMenuItem(value: 'weight_duration', child: Text('Weight and duration')),
                            DropdownMenuItem(value: 'custom', child: Text('Custom tracking')),
                          ],
                          onChanged: (value) {
                            if (value == null) return;
                            setState(() {
                              _trackingType = value;
                              if (!_supportsReps) {
                                _repsMinCtrl.clear();
                                _repsMaxCtrl.clear();
                              } else if (_repsMinCtrl.text.isEmpty) {
                                _repsMinCtrl.text = '8';
                                _repsMaxCtrl.text = '12';
                              }
                            });
                          },
                        ),
                        const SizedBox(height: 10),
                        Text('Quick Presets:', style: TextStyle(color: colors.textSecondary, fontSize: 11, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: _commonPresets.map((preset) {
                            final pName = preset['name']!;
                            final isSel = _selectedExerciseName == pName;
                            return InkWell(
                              onTap: () {
                                setState(() {
                                  _selectedExerciseId = null;
                                  _selectedExerciseName = pName;
                                  _selectedMuscleGroupName = preset['group'] ?? '';
                                  _trackingType = preset['type'] ?? 'weight_reps';
                                  _customNameCtrl.text = pName;
                                });
                              },
                              borderRadius: BorderRadius.circular(6),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                                decoration: BoxDecoration(
                                  color: isSel ? colors.primary.withValues(alpha: 0.18) : colors.card,
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: isSel ? colors.primary : colors.border),
                                ),
                                child: Text(
                                  pName,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                                    color: isSel ? colors.primary : colors.textPrimary,
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                  ),
                ] else ...[
                  // Exercise Dropdown / Selector Card
                  InkWell(
                    onTap: isEditing ? null : () => _showExercisePickerSheet(colors),
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: colors.surfaceElevated,
                        borderRadius: BorderRadius.circular(AppRadii.md),
                        border: Border.all(color: colors.border),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.fitness_center_rounded, color: colors.primary, size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _selectedExerciseName.isNotEmpty
                                      ? (_selectedMuscleGroupName.isNotEmpty
                                          ? '$_selectedExerciseName ($_selectedMuscleGroupName)'
                                          : _selectedExerciseName)
                                      : 'Choose Exercise...',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: _selectedExerciseName.isNotEmpty ? colors.textPrimary : colors.textMuted,
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (!isEditing)
                            Icon(Icons.keyboard_arrow_down_rounded, color: colors.textSecondary),
                        ],
                      ),
                    ),
                  ),
                ],

                const SizedBox(height: 18),

                // 2. WORKING SETS, MIN REPS, MAX REPS (3-Column Layout from Dashboard)
                Row(
                  children: [
                    // Working Sets
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                'Working Sets',
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: colors.textPrimary),
                              ),
                              Text(' *', style: TextStyle(color: colors.rose, fontSize: 12)),
                            ],
                          ),
                          const SizedBox(height: 6),
                          TextField(
                            key: const Key('input-target-sets'),
                            controller: _setsCtrl,
                            keyboardType: TextInputType.number,
                            style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
                            decoration: InputDecoration(
                              hintText: 'e.g. 3',
                              filled: true,
                              fillColor: colors.surfaceElevated,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(AppRadii.md),
                                borderSide: BorderSide(color: colors.border),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (_supportsReps) ...[
                      const SizedBox(width: 10),
                      // Min Reps
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  'Min Reps',
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: colors.textPrimary),
                                ),
                                Text(' *', style: TextStyle(color: colors.rose, fontSize: 12)),
                              ],
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              key: const Key('input-reps-min'),
                              controller: _repsMinCtrl,
                              keyboardType: TextInputType.number,
                              style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
                              decoration: InputDecoration(
                                hintText: 'e.g. 8',
                                filled: true,
                                fillColor: colors.surfaceElevated,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(AppRadii.md),
                                  borderSide: BorderSide(color: colors.border),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      // Max Reps
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Max Reps',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: colors.textPrimary),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              key: const Key('input-reps-max'),
                              controller: _repsMaxCtrl,
                              keyboardType: TextInputType.number,
                              style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
                              decoration: InputDecoration(
                                hintText: 'e.g. 12',
                                filled: true,
                                fillColor: colors.surfaceElevated,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(AppRadii.md),
                                  borderSide: BorderSide(color: colors.border),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),

                if (_supportsWeight || _supportsDuration || _supportsDistance) ...[
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      if (_supportsWeight)
                        Expanded(
                          child: TextField(
                            key: const Key('input-target-weight'),
                            controller: _weightCtrl,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
                            decoration: InputDecoration(
                              labelText: 'Target weight (kg)',
                              hintText: 'Optional',
                              filled: true,
                              fillColor: colors.surfaceElevated,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadii.md), borderSide: BorderSide(color: colors.border)),
                            ),
                          ),
                        ),
                      if (_supportsWeight && (_supportsDuration || _supportsDistance)) const SizedBox(width: 10),
                      if (_supportsDuration)
                        Expanded(
                          child: TextField(
                            key: const Key('input-target-duration'),
                            controller: _durationCtrl,
                            keyboardType: TextInputType.number,
                            style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
                            decoration: InputDecoration(
                              labelText: 'Duration (sec)',
                              hintText: 'e.g. 30',
                              filled: true,
                              fillColor: colors.surfaceElevated,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadii.md), borderSide: BorderSide(color: colors.border)),
                            ),
                          ),
                        ),
                      if (_supportsDistance)
                        Expanded(
                          child: TextField(
                            key: const Key('input-target-distance'),
                            controller: _distanceCtrl,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
                            decoration: InputDecoration(
                              labelText: 'Distance (m)',
                              hintText: 'e.g. 1000',
                              filled: true,
                              fillColor: colors.surfaceElevated,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadii.md), borderSide: BorderSide(color: colors.border)),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],

                const SizedBox(height: 18),

                // 3. REST (SECONDS)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Rest (seconds)',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.textPrimary),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      key: const Key('input-rest-seconds'),
                      controller: _restCtrl,
                      keyboardType: TextInputType.number,
                      style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
                      decoration: InputDecoration(
                        hintText: 'e.g. 90',
                        filled: true,
                        fillColor: colors.surfaceElevated,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppRadii.md),
                          borderSide: BorderSide(color: colors.border),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    // Rest Quick Chips
                    Wrap(
                      spacing: 8,
                      children: ['45', '60', '90', '120', '180'].map((sec) {
                        final isSel = _restCtrl.text.trim() == sec;
                        return ChoiceChip(
                          label: Text('${sec}s', style: const TextStyle(fontSize: 12)),
                          selected: isSel,
                          selectedColor: colors.primary,
                          backgroundColor: colors.surfaceElevated,
                          labelStyle: TextStyle(
                            color: isSel ? colors.onPrimary : colors.textSecondary,
                            fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                          ),
                          onSelected: (_) => setState(() => _restCtrl.text = sec),
                        );
                      }).toList(),
                    ),
                  ],
                ),

                const SizedBox(height: 18),

                // 4. TECHNIQUE & CUE NOTES (Dashboard FormField)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Technique & Cue Notes',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.textPrimary),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      key: const Key('input-exercise-notes'),
                      controller: _notesCtrl,
                      maxLines: 2,
                      style: TextStyle(color: colors.textPrimary, fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'e.g. Pause 1 second at the bottom, maintain neutral spine',
                        hintStyle: TextStyle(color: colors.textMuted, fontSize: 12),
                        filled: true,
                        fillColor: colors.surfaceElevated,
                        contentPadding: const EdgeInsets.all(12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppRadii.md),
                          borderSide: BorderSide(color: colors.border),
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 14),

                // 5. OPTIONAL MOVEMENT CHECKBOX/SWITCH
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: colors.surfaceElevated,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    border: Border.all(color: colors.border),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Mark as Optional Movement',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: colors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Accessory / Finisher movement that can be skipped',
                              style: TextStyle(fontSize: 11, color: colors.textMuted),
                            ),
                          ],
                        ),
                      ),
                      Switch(
                        key: const Key('checkbox-is-optional'),
                        value: _isOptional,
                        activeThumbColor: colors.primary,
                        onChanged: (val) => setState(() => _isOptional = val),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),
              ],
            ),
          ),

          // Bottom Action Buttons (Dashboard Parity)
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
                    text: isEditing ? 'Save Changes' : 'Add to Day',
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
}
