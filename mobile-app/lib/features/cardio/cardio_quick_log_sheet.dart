import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';

/// Opens the Cardio Quick Log Bottom Sheet, designed to feel instant and lightweight like the Water sheet.
Future<bool?> showCardioQuickLogSheet({
  required BuildContext context,
  required ApiClient apiClient,
  num? targetMinutes,
  num? completedMinutes,
  String? defaultActivityName,
  VoidCallback? onLogged,
  VoidCallback? onViewHistory,
}) {
  final colors = AppThemeColors.of(context);

  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    sheetAnimationStyle: const AnimationStyle(
      duration: Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    ),
    backgroundColor: colors.card,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.lg)),
    ),
    builder: (ctx) => CardioQuickLogSheet(
      apiClient: apiClient,
      targetMinutes: targetMinutes,
      completedMinutes: completedMinutes,
      defaultActivityName: defaultActivityName,
      onLogged: onLogged,
      onViewHistory: onViewHistory,
    ),
  );
}

class CardioQuickLogSheet extends StatefulWidget {
  final ApiClient apiClient;
  final num? targetMinutes;
  final num? completedMinutes;
  final String? defaultActivityName;
  final VoidCallback? onLogged;
  final VoidCallback? onViewHistory;

  const CardioQuickLogSheet({
    super.key,
    required this.apiClient,
    this.targetMinutes,
    this.completedMinutes,
    this.defaultActivityName,
    this.onLogged,
    this.onViewHistory,
  });

  @override
  State<CardioQuickLogSheet> createState() => _CardioQuickLogSheetState();
}

class _CardioQuickLogSheetState extends State<CardioQuickLogSheet> {
  List<Map<String, dynamic>> _activities = [
    {'id': 1, 'name': 'Running'},
    {'id': 2, 'name': 'Treadmill'},
    {'id': 3, 'name': 'Cycling'},
    {'id': 4, 'name': 'Walking'},
  ];
  int? _selectedActivityId = 1;
  bool _isSubmitting = false;

  final _durationController = TextEditingController();
  final _inclineController = TextEditingController();
  final _speedController = TextEditingController();

  final _durationFocus = FocusNode();
  final _inclineFocus = FocusNode();
  final _speedFocus = FocusNode();

  static const List<int> _durationPresets = [15, 20, 30, 45, 60];
  List<Map<String, dynamic>> _recentSessions = [];

  @override
  void initState() {
    super.initState();
    _fetchActivities();
    _fetchRecentSessions();
  }

  Future<void> _fetchRecentSessions() async {
    try {
      final res = await widget.apiClient.get('/me/cardio/history?limit=5');
      List<dynamic> list = const [];
      if (res is Map<String, dynamic> && res['data'] is List) {
        list = res['data'];
      } else if (res is List) {
        list = res;
      }
      if (mounted && list.isNotEmpty) {
        setState(() {
          _recentSessions = list
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _durationController.dispose();
    _inclineController.dispose();
    _speedController.dispose();
    _durationFocus.dispose();
    _inclineFocus.dispose();
    _speedFocus.dispose();
    super.dispose();
  }

  Future<void> _fetchActivities() async {
    try {
      final res = await widget.apiClient.get('/me/cardio/activities');
      List<dynamic> list = const [];
      if (res is List<dynamic>) {
        list = res;
      } else if (res is Map<String, dynamic> && res['data'] is List<dynamic>) {
        list = res['data'] as List<dynamic>;
      }

      if (list.isNotEmpty && mounted) {
        final parsed = list
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();

        setState(() {
          _activities = parsed;
          // Match default if passed, otherwise default to first
          if (widget.defaultActivityName != null &&
              widget.defaultActivityName!.trim().isNotEmpty) {
            final match = _activities.firstWhere(
              (a) =>
                  a['name']?.toString().toLowerCase() ==
                  widget.defaultActivityName!.trim().toLowerCase(),
              orElse: () => _activities.first,
            );
            _selectedActivityId = match['id'] as int?;
          } else {
            _selectedActivityId = _activities.first['id'] as int?;
          }
        });
      }
    } catch (_) {
      // Fallback defaults already populated in _activities
    }
  }

  Future<void> _submitCardio() async {
    final duration = int.tryParse(_durationController.text.trim());
    if (duration == null || duration <= 0) {
      showPremiumSnackBar(
        context,
        'Please enter a valid duration in minutes',
        isError: true,
      );
      return;
    }

    final actId = _selectedActivityId ??
        (_activities.isNotEmpty ? _activities.first['id'] as int? : 1) ??
        1;

    setState(() => _isSubmitting = true);

    try {
      final payload = {
        'cardioActivityId': actId,
        'durationMinutes': duration,
        if (_inclineController.text.trim().isNotEmpty)
          'inclinePct': double.tryParse(_inclineController.text.trim()),
        if (_speedController.text.trim().isNotEmpty)
          'speedKmh': double.tryParse(_speedController.text.trim()),
      };

      await widget.apiClient.post('/me/cardio', body: payload);
      await _fetchRecentSessions();

      if (mounted) {
        widget.onLogged?.call();
        Navigator.of(context).pop(true);
        showPremiumSnackBar(
          context,
          'Cardio session of $duration min logged successfully!',
          isSuccess: true,
        );
      }
    } on OfflineOperationQueued catch (_) {
      if (mounted) {
        widget.onLogged?.call();
        Navigator.of(context).pop(true);
        showPremiumSnackBar(
          context,
          'Cardio session saved offline. Will sync when online.',
        );
      }
    } catch (e) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Error logging cardio: ${e.toString().replaceAll("Exception: ", "")}',
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final target = widget.targetMinutes ?? 0;
    final completed = widget.completedMinutes ?? 0;
    final progress = target > 0 ? (completed / target).clamp(0.0, 1.0) : 0.0;

    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.lg,
        right: AppSpacing.lg,
        top: AppSpacing.md,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.lg,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Drag handle
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: colors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Sheet Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: colors.rose.withValues(alpha: 0.15),
                        ),
                        child: Icon(Icons.directions_run,
                            color: colors.rose, size: 20),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          'Cardio Quick Log',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: colors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                StatusBadge(
                  label: target > 0
                      ? '${completed.toInt()} / ${target.toInt()} min'
                      : '${completed.toInt()} min logged',
                  color: colors.rose,
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Progress bar if target is set
            if (target > 0) ...[
              PremiumProgressBar(
                value: progress,
                height: 8,
                color: colors.rose,
                backgroundColor: colors.surfaceElevated,
              ),
              const SizedBox(height: 16),
            ],

            // Quick presets
            Text(
              'QUICK DURATION PRESETS',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6,
                color: colors.textSecondary,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _durationPresets.map((mins) {
                final isSelected = _durationController.text == mins.toString();
                return PremiumChoiceButton(
                  label: '+$mins min',
                  accentColor: colors.rose,
                  isSelected: isSelected,
                  onPressed: () {
                    setState(() {
                      _durationController.text = mins.toString();
                    });
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 18),

            // Activity Selection
            Text(
              'ACTIVITY',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6,
                color: colors.textSecondary,
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: colors.surfaceElevated,
                borderRadius: BorderRadius.circular(AppRadii.sm),
                border: Border.all(color: colors.border),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<int>(
                  value: _selectedActivityId,
                  isExpanded: true,
                  dropdownColor: colors.card,
                  icon: Icon(Icons.arrow_drop_down, color: colors.rose),
                  items: _activities.map((act) {
                    final id = act['id'] as int? ?? 1;
                    final name = act['name']?.toString() ?? 'Cardio';
                    return DropdownMenuItem<int>(
                      value: id,
                      child: Row(
                        children: [
                          Icon(Icons.directions_run,
                              size: 16, color: colors.rose),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: colors.textPrimary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                  onChanged: (newVal) {
                    if (newVal != null) {
                      setState(() => _selectedActivityId = newVal);
                    }
                  },
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Fields: Duration (Required), Incline (Optional), Speed (Optional)
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'DURATION (MIN) *',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: colors.rose,
                        ),
                      ),
                      const SizedBox(height: 4),
                      TextFormField(
                        controller: _durationController,
                        focusNode: _durationFocus,
                        keyboardType: TextInputType.number,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: colors.textPrimary,
                        ),
                        decoration: InputDecoration(
                          hintText: '30',
                          prefixIcon: Icon(Icons.timer_outlined,
                              size: 16, color: colors.rose),
                          filled: true,
                          fillColor: colors.surfaceElevated,
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 10),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadii.sm),
                            borderSide: BorderSide(color: colors.border),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadii.sm),
                            borderSide: BorderSide(color: colors.border),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadii.sm),
                            borderSide:
                                BorderSide(color: colors.rose, width: 1.5),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'INCLINE (%)',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: colors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      TextFormField(
                        controller: _inclineController,
                        focusNode: _inclineFocus,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: colors.textPrimary,
                        ),
                        decoration: InputDecoration(
                          hintText: 'e.g. 5.0',
                          prefixIcon: Icon(Icons.trending_up,
                              size: 16, color: colors.textMuted),
                          filled: true,
                          fillColor: colors.surfaceElevated,
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 10),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadii.sm),
                            borderSide: BorderSide(color: colors.border),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadii.sm),
                            borderSide: BorderSide(color: colors.border),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadii.sm),
                            borderSide:
                                BorderSide(color: colors.rose, width: 1.5),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'SPEED (KM/H)',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: colors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      TextFormField(
                        controller: _speedController,
                        focusNode: _speedFocus,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: colors.textPrimary,
                        ),
                        decoration: InputDecoration(
                          hintText: 'e.g. 10.0',
                          prefixIcon: Icon(Icons.speed,
                              size: 16, color: colors.textMuted),
                          filled: true,
                          fillColor: colors.surfaceElevated,
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 10),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadii.sm),
                            borderSide: BorderSide(color: colors.border),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadii.sm),
                            borderSide: BorderSide(color: colors.border),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadii.sm),
                            borderSide:
                                BorderSide(color: colors.rose, width: 1.5),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Submit Button
            PremiumButton(
              text: _isSubmitting ? 'Logging...' : 'Log Cardio Session',
              icon: const Icon(Icons.check, size: 18),
              loading: _isSubmitting,
              onPressed: _isSubmitting ? () {} : _submitCardio,
              height: 46,
            ),
            if (_recentSessions.isNotEmpty) ...[
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      'RECENT SESSIONS',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.6,
                        color: colors.textSecondary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (widget.onViewHistory != null)
                    GestureDetector(
                      onTap: () {
                        Navigator.of(context).pop();
                        widget.onViewHistory!();
                      },
                      child: Text(
                        'See all →',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: colors.rose,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              ..._recentSessions.take(3).map((s) {
                final mins = s['duration_minutes'] ?? s['durationMinutes'] ?? 0;
                final actName = s['activity_name'] ?? s['activityName'] ?? 'Cardio';
                final speed = s['speed_kmh'] ?? s['speedKmh'];
                final incline = s['incline_pct'] ?? s['inclinePct'];
                return Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: colors.surfaceElevated,
                    borderRadius: BorderRadius.circular(AppRadii.sm),
                    border: Border.all(color: colors.border),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Row(
                          children: [
                            Icon(Icons.directions_run, size: 16, color: colors.rose),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    actName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: colors.textPrimary,
                                    ),
                                  ),
                                  if (speed != null || incline != null)
                                    Text(
                                      [
                                        if (speed != null) '$speed km/h',
                                        if (incline != null) '$incline% incl',
                                      ].join(' • '),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(fontSize: 10.5, color: colors.textMuted),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      StatusBadge(
                        label: '$mins min',
                        color: colors.rose,
                      ),
                    ],
                  ),
                );
              }),
            ],
            const SizedBox(height: 8),

            // History Link
            if (widget.onViewHistory != null)
              Center(
                child: TextButton.icon(
                  onPressed: () {
                    Navigator.of(context).pop();
                    widget.onViewHistory!();
                  },
                  icon: Icon(Icons.history, size: 16, color: colors.textSecondary),
                  label: Text(
                    'View Cardio History & Past Logs',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: colors.textSecondary,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
