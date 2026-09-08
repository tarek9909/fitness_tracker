import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';

/// Data class representing standard meal structure presets
class DietMealPreset {
  final String name;
  final String suggestedTime;
  final IconData icon;
  final String subtitle;

  const DietMealPreset({
    required this.name,
    required this.suggestedTime,
    required this.icon,
    required this.subtitle,
  });
}

/// A comprehensive, high-end redesign of the Diet Meal Editor Modal.
/// Provides standard meal templates, interactive time picker, grace period config,
/// optional starter option group seeding, and full payload alignment.
class DietMealEditorModal extends StatefulWidget {
  final ApiClient apiClient;
  final int planId;
  final int versionId;
  final String? planName;
  final Map<String, dynamic>? existing;

  const DietMealEditorModal({
    super.key,
    required this.apiClient,
    required this.planId,
    required this.versionId,
    this.planName,
    this.existing,
  });

  /// Opens the editor inside a luxurious modal bottom sheet
  static Future<bool?> show(
    BuildContext context, {
    required ApiClient apiClient,
    required int planId,
    required int versionId,
    String? planName,
    Map<String, dynamic>? existing,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DietMealEditorModal(
        apiClient: apiClient,
        planId: planId,
        versionId: versionId,
        planName: planName,
        existing: existing,
      ),
    );
  }

  @override
  State<DietMealEditorModal> createState() => _DietMealEditorModalState();
}

class _DietMealEditorModalState extends State<DietMealEditorModal> {
  late final TextEditingController _nameCtrl;
  late final TextEditingController _timeCtrl;
  late final TextEditingController _notesCtrl;

  late TimeOfDay _selectedTime;
  late bool _isRequired;
  late int _graceMinutes;
  late bool _seedStarterGroups;

  final Set<String> _selectedStarterGroupNames = {'Protein Source', 'Carb Source'};
  bool _saving = false;
  String? _errorMessage;

  static const List<DietMealPreset> _presets = [
    DietMealPreset(name: 'Breakfast', suggestedTime: '08:00', icon: Icons.wb_sunny_outlined, subtitle: 'Morning fuel'),
    DietMealPreset(name: 'Morning Snack', suggestedTime: '10:30', icon: Icons.apple_outlined, subtitle: 'Mid-morning energy'),
    DietMealPreset(name: 'Lunch', suggestedTime: '13:00', icon: Icons.restaurant_outlined, subtitle: 'Mid-day nutrition'),
    DietMealPreset(name: 'Afternoon Snack', suggestedTime: '16:00', icon: Icons.cookie_outlined, subtitle: 'Afternoon refresh'),
    DietMealPreset(name: 'Pre-Workout', suggestedTime: '17:00', icon: Icons.bolt_outlined, subtitle: 'Training priming'),
    DietMealPreset(name: 'Post-Workout', suggestedTime: '19:00', icon: Icons.fitness_center_outlined, subtitle: 'Muscle recovery'),
    DietMealPreset(name: 'Dinner', suggestedTime: '20:00', icon: Icons.dinner_dining_outlined, subtitle: 'Evening nourishment'),
    DietMealPreset(name: 'Bedtime Snack', suggestedTime: '22:00', icon: Icons.nightlight_outlined, subtitle: 'Overnight recovery'),
  ];

  static const List<String> _quickTimes = ['07:30', '08:00', '12:30', '13:00', '18:30', '20:00'];
  static const List<int> _graceOptions = [30, 45, 60, 90, 120];

  static const List<Map<String, dynamic>> _starterGroupDefs = [
    {'name': 'Protein Source', 'required': true, 'min': 1, 'max': 1, 'desc': 'e.g. Chicken, Eggs, Whey'},
    {'name': 'Carb Source', 'required': true, 'min': 1, 'max': 1, 'desc': 'e.g. Oats, Rice, Sweet Potato'},
    {'name': 'Veggies & Greens', 'required': false, 'min': 0, 'max': 2, 'desc': 'e.g. Spinach, Broccoli'},
    {'name': 'Healthy Fats', 'required': false, 'min': 0, 'max': 1, 'desc': 'e.g. Olive Oil, Almonds'},
  ];

  @override
  void initState() {
    super.initState();
    final e = widget.existing;

    _nameCtrl = TextEditingController(text: e?['name']?.toString() ?? '');
    final rawTime = e?['scheduled_time']?.toString() ?? e?['meal_time']?.toString() ?? '08:00';
    final parsedTime = _parseTime(rawTime);
    _selectedTime = parsedTime;
    _timeCtrl = TextEditingController(
      text: '${_selectedTime.hour.toString().padLeft(2, '0')}:${_selectedTime.minute.toString().padLeft(2, '0')}',
    );

    _notesCtrl = TextEditingController(text: e?['notes']?.toString() ?? e?['description']?.toString() ?? '');
    _isRequired = e?['is_required'] != 0 && e?['isRequired'] != false;
    _graceMinutes = _asInt(e?['default_grace_minutes'] ?? e?['defaultGraceMinutes']) ?? 60;
    _seedStarterGroups = widget.existing == null;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _timeCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  int? _asInt(dynamic v) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v);
    return null;
  }

  TimeOfDay _parseTime(String timeStr) {
    try {
      final parts = timeStr.split(':');
      if (parts.length >= 2) {
        final h = int.tryParse(parts[0]) ?? 8;
        final m = int.tryParse(parts[1]) ?? 0;
        return TimeOfDay(hour: h.clamp(0, 23), minute: m.clamp(0, 59));
      }
    } catch (_) {}
    return const TimeOfDay(hour: 8, minute: 0);
  }

  void _applyPreset(DietMealPreset preset) {
    setState(() {
      _nameCtrl.text = preset.name;
      final parsed = _parseTime(preset.suggestedTime);
      _selectedTime = parsed;
      _timeCtrl.text = preset.suggestedTime;
      _errorMessage = null;
    });
  }

  void _applyQuickTime(String timeStr) {
    setState(() {
      _timeCtrl.text = timeStr;
      _selectedTime = _parseTime(timeStr);
    });
  }

  Future<void> _pickNativeTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _selectedTime,
      builder: (context, child) {
        final colors = AppThemeColors.of(context);
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: ColorScheme.dark(
              primary: colors.primary,
              onPrimary: colors.onPrimary,
              surface: colors.card,
              onSurface: colors.textPrimary,
            ),
          ),
          child: child ?? const SizedBox.shrink(),
        );
      },
    );

    if (picked != null) {
      setState(() {
        _selectedTime = picked;
        _timeCtrl.text = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
      });
    }
  }

  Future<void> _handleSave() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      setState(() => _errorMessage = 'Meal name is required.');
      return;
    }

    final timeText = _timeCtrl.text.trim();
    String formattedTime = '08:00:00';
    if (timeText.isNotEmpty) {
      final parts = timeText.split(':');
      if (parts.length == 2) {
        formattedTime = '${parts[0].padLeft(2, '0')}:${parts[1].padLeft(2, '0')}:00';
      } else if (parts.length == 3) {
        formattedTime = timeText;
      }
    }

    setState(() {
      _saving = true;
      _errorMessage = null;
    });

    final payload = <String, dynamic>{
      'name': name,
      'scheduledTime': formattedTime,
      'isRequired': _isRequired,
      'defaultGraceMinutes': _graceMinutes,
      'notes': _notesCtrl.text.trim(),
    };

    final mealId = _asInt(widget.existing?['id']);

    try {
      if (mealId == null) {
        // Create new meal
        final res = await widget.apiClient.post(
          '/me/diet-plans/${widget.planId}/versions/${widget.versionId}/meals',
          body: payload,
        );

        // Optionally seed selected starter option groups
        if (_seedStarterGroups && _selectedStarterGroupNames.isNotEmpty) {
          int? newMealId;
          if (res is Map) {
            final data = (res['data'] is Map) ? res['data'] as Map : res;
            if (data['id'] != null) {
              newMealId = _asInt(data['id']);
            } else if (data['meal'] is Map && data['meal']['id'] != null) {
              newMealId = _asInt(data['meal']['id']);
            }
            if (newMealId == null && data['meals'] is List) {
              final meals = data['meals'] as List;
              for (final m in meals.reversed) {
                if (m is Map && (m['name'] == name || m['meal_name'] == name)) {
                  newMealId = _asInt(m['id']);
                  break;
                }
              }
              if (newMealId == null && meals.isNotEmpty && meals.last is Map) {
                newMealId = _asInt(meals.last['id']);
              }
            }
          }

          if (newMealId != null) {
            for (final groupDef in _starterGroupDefs) {
              final gName = groupDef['name'] as String;
              if (_selectedStarterGroupNames.contains(gName)) {
                try {
                  await widget.apiClient.post(
                    '/me/diet-plans/${widget.planId}/meals/$newMealId/option-groups',
                    body: {
                      'name': gName,
                      'isRequired': groupDef['required'],
                      'minSelections': groupDef['min'],
                      'maxSelections': groupDef['max'],
                      'notes': groupDef['desc'],
                    },
                  );
                } catch (_) {
                  // Non-fatal: meal is created, starter groups can be added manually
                }
              }
            }
          }
        }
      } else {
        // Update existing meal
        await widget.apiClient.patch(
          '/me/diet-plans/${widget.planId}/meals/$mealId',
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

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final isEditing = widget.existing != null;

    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadii.xl)),
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
                    color: colors.amberMuted,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                  ),
                  child: Icon(Icons.restaurant_menu_rounded, color: colors.amber, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isEditing ? 'Edit Meal' : 'Add Meal',
                        style: TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w800,
                          color: colors.textPrimary,
                          letterSpacing: -0.3,
                        ),
                      ),
                      if (widget.planName != null)
                        Text(
                          widget.planName!,
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

                // 1. QUICK MEAL PRESETS (Morning, Mid-day, Evening)
                _buildPresetsSection(colors),

                const SizedBox(height: 16),

                // 2. MEAL NAME & TIMING
                _buildMealDetailsSection(colors),

                const SizedBox(height: 16),

                // 3. GRACE PERIOD & COMPLIANCE
                _buildComplianceSection(colors),

                const SizedBox(height: 16),

                // 4. STARTER OPTION GROUPS (FOR NEW MEALS)
                if (!isEditing) ...[
                  _buildStarterGroupsSection(colors),
                  const SizedBox(height: 16),
                ],

                // 5. PREPARATION & COACH NOTES
                _buildNotesSection(colors),

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
                    text: isEditing ? 'Save Changes' : 'Save',
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

  Widget _buildPresetsSection(AppThemeColors colors) {
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
              Text(
                'QUICK MEAL TEMPLATES',
                style: TextStyle(
                  color: colors.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                ),
              ),
              const Spacer(),
              Text(
                'Tap to pre-fill',
                style: TextStyle(fontSize: 11, color: colors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _presets.map((preset) {
              final isCurrent = _nameCtrl.text.toLowerCase() == preset.name.toLowerCase();
              return ActionChip(
                avatar: Icon(
                  preset.icon,
                  size: 16,
                  color: isCurrent ? colors.onPrimary : colors.amber,
                ),
                label: Text(
                  preset.name,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w500,
                    color: isCurrent ? colors.onPrimary : colors.textPrimary,
                  ),
                ),
                backgroundColor: isCurrent ? colors.primary : colors.card,
                side: BorderSide(
                  color: isCurrent ? colors.primary : colors.border,
                ),
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                onPressed: () => _applyPreset(preset),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildMealDetailsSection(AppThemeColors colors) {
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
          Text(
            'MEAL IDENTITY & SCHEDULE',
            style: TextStyle(
              color: colors.textMuted,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 12),

          // Meal Name
          Text(
            'Meal Name',
            style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          TextField(
            controller: _nameCtrl,
            style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700),
            decoration: InputDecoration(
              hintText: 'e.g., High-Protein Breakfast',
              prefixIcon: Icon(Icons.edit_note_rounded, color: colors.textMuted, size: 20),
              filled: true,
              fillColor: colors.card,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: colors.border),
              ),
            ),
          ),

          const SizedBox(height: 14),

          // Scheduled Time Picker
          Row(
            children: [
              Text(
                'Suggested Time',
                style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
              ),
              const Spacer(),
              InkWell(
                onTap: _pickNativeTime,
                borderRadius: BorderRadius.circular(4),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.access_time_rounded, size: 14, color: colors.primary),
                      const SizedBox(width: 4),
                      Text(
                        'Open Clock Picker',
                        style: TextStyle(fontSize: 11, color: colors.primary, fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),

          // Time Card with interactive click & text
          InkWell(
            onTap: _pickNativeTime,
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: colors.border),
              ),
              child: Row(
                children: [
                  Icon(Icons.schedule_rounded, color: colors.primary, size: 20),
                  const SizedBox(width: 10),
                  Text(
                    _timeCtrl.text.isEmpty ? '08:00' : _timeCtrl.text,
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: colors.textPrimary,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: colors.surfaceElevated,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: colors.border),
                    ),
                    child: Text(
                      'Change',
                      style: TextStyle(fontSize: 11, color: colors.textSecondary, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 8),

          // Quick Time Chips
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: _quickTimes.map((t) {
              final isCurrent = _timeCtrl.text == t;
              return InkWell(
                onTap: () => _applyQuickTime(t),
                borderRadius: BorderRadius.circular(4),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isCurrent ? colors.primary : colors.card,
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: isCurrent ? colors.primary : colors.border),
                  ),
                  child: Text(
                    t,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: isCurrent ? colors.onPrimary : colors.textSecondary,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildComplianceSection(AppThemeColors colors) {
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
          Text(
            'ADHERENCE & REMINDERS',
            style: TextStyle(
              color: colors.textMuted,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 12),

          // Required Meal Switch
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Required Meal',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: colors.textPrimary),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _isRequired
                          ? 'Mandatory: impacts daily dietary compliance and macro score'
                          : 'Flexible: optional snack or flex meal without score penalty',
                      style: TextStyle(fontSize: 11, color: colors.textMuted),
                    ),
                  ],
                ),
              ),
              Switch(
                value: _isRequired,
                activeThumbColor: colors.primary,
                onChanged: (val) => setState(() => _isRequired = val),
              ),
            ],
          ),

          const SizedBox(height: 12),
          Divider(height: 1, color: colors.border),
          const SizedBox(height: 12),

          // Logging Grace Window
          Row(
            children: [
              Text(
                'Logging Grace Window',
                style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
              ),
              const Spacer(),
              Text(
                '$_graceMinutes mins',
                style: TextStyle(color: colors.primary, fontWeight: FontWeight.w700, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Allowed window after scheduled time before reminder or overdue status.',
            style: TextStyle(fontSize: 11, color: colors.textMuted),
          ),
          const SizedBox(height: 8),

          Wrap(
            spacing: 6,
            children: _graceOptions.map((mins) {
              final isCurrent = _graceMinutes == mins;
              return ChoiceChip(
                label: Text('${mins}m'),
                selected: isCurrent,
                selectedColor: colors.primary,
                backgroundColor: colors.card,
                labelStyle: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: isCurrent ? colors.onPrimary : colors.textPrimary,
                ),
                side: BorderSide(color: isCurrent ? colors.primary : colors.border),
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                onSelected: (val) {
                  if (val) setState(() => _graceMinutes = mins);
                },
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildStarterGroupsSection(AppThemeColors colors) {
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
              Icon(Icons.auto_awesome_rounded, color: colors.amber, size: 16),
              const SizedBox(width: 6),
              Text(
                'STARTER OPTION GROUPS',
                style: TextStyle(
                  color: colors.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                ),
              ),
              const Spacer(),
              Switch(
                value: _seedStarterGroups,
                activeThumbColor: colors.amber,
                onChanged: (val) => setState(() => _seedStarterGroups = val),
              ),
            ],
          ),
          Text(
            'Automatically initialize meal components so you can add food options directly.',
            style: TextStyle(fontSize: 11, color: colors.textMuted),
          ),
          if (_seedStarterGroups) ...[
            const SizedBox(height: 10),
            ..._starterGroupDefs.map((def) {
              final name = def['name'] as String;
              final desc = def['desc'] as String;
              final isChecked = _selectedStarterGroupNames.contains(name);

              return CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                activeColor: colors.amber,
                checkColor: Colors.black,
                title: Text(
                  name,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: colors.textPrimary,
                  ),
                ),
                subtitle: Text(
                  desc,
                  style: TextStyle(fontSize: 11, color: colors.textMuted),
                ),
                value: isChecked,
                onChanged: (val) {
                  setState(() {
                    if (val == true) {
                      _selectedStarterGroupNames.add(name);
                    } else {
                      _selectedStarterGroupNames.remove(name);
                    }
                  });
                },
              );
            }),
          ],
        ],
      ),
    );
  }

  Widget _buildNotesSection(AppThemeColors colors) {
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
          Text(
            'PREPARATION & COACH GUIDANCE',
            style: TextStyle(
              color: colors.textMuted,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _notesCtrl,
            maxLines: 2,
            style: TextStyle(color: colors.textPrimary, fontSize: 13),
            decoration: InputDecoration(
              hintText: 'e.g. Drink 500ml water with meal. Consume within 45 min post-workout. Weigh foods raw.',
              hintStyle: TextStyle(color: colors.textMuted, fontSize: 12),
              filled: true,
              fillColor: colors.card,
              contentPadding: const EdgeInsets.all(12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: colors.border),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
