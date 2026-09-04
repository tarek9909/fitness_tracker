import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';

/// Opens the Weight Quick Log Bottom Sheet, designed to feel instant and lightweight with previous entries history.
Future<bool?> showWeightQuickLogSheet({
  required BuildContext context,
  required ApiClient apiClient,
  double? currentWeightKg,
  Map<String, dynamic>? goal,
  List<Map<String, dynamic>>? initialEntries,
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
    builder: (ctx) => WeightQuickLogSheet(
      apiClient: apiClient,
      currentWeightKg: currentWeightKg,
      goal: goal,
      initialEntries: initialEntries,
      onLogged: onLogged,
      onViewHistory: onViewHistory,
    ),
  );
}

class WeightQuickLogSheet extends StatefulWidget {
  final ApiClient apiClient;
  final double? currentWeightKg;
  final Map<String, dynamic>? goal;
  final List<Map<String, dynamic>>? initialEntries;
  final VoidCallback? onLogged;
  final VoidCallback? onViewHistory;

  const WeightQuickLogSheet({
    super.key,
    required this.apiClient,
    this.currentWeightKg,
    this.goal,
    this.initialEntries,
    this.onLogged,
    this.onViewHistory,
  });

  @override
  State<WeightQuickLogSheet> createState() => _WeightQuickLogSheetState();
}

class _WeightQuickLogSheetState extends State<WeightQuickLogSheet> {
  final _weightController = TextEditingController();
  final _notesController = TextEditingController();
  final _weightFocus = FocusNode();
  final _notesFocus = FocusNode();
  bool _isSubmitting = false;
  bool _showNotes = false;
  int _activeTab = 0; // 0: Log Weight, 1: Previous Entries (History)

  List<Map<String, dynamic>> _entries = [];
  bool _isLoadingEntries = true;

  static const List<double> _quickAdjusters = [-1.0, -0.5, -0.1, 0.1, 0.5, 1.0];

  @override
  void initState() {
    super.initState();
    if (widget.currentWeightKg != null && widget.currentWeightKg! > 0) {
      _weightController.text = widget.currentWeightKg!.toStringAsFixed(1);
    }
    if (widget.initialEntries != null) {
      _entries = List<Map<String, dynamic>>.from(widget.initialEntries!);
      _isLoadingEntries = false;
    }
    _fetchWeightHistory();
  }

  @override
  void dispose() {
    _weightController.dispose();
    _notesController.dispose();
    _weightFocus.dispose();
    _notesFocus.dispose();
    super.dispose();
  }

  Future<void> _fetchWeightHistory() async {
    try {
      final res = await widget.apiClient.get('/me/weight');
      if (res is Map<String, dynamic> && res['entries'] is List && mounted) {
        final list = (res['entries'] as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        setState(() {
          _entries = list;
          _isLoadingEntries = false;
          // If no weight pre-filled and recent entries exist, prefill with latest
          if (_weightController.text.trim().isEmpty && list.isNotEmpty) {
            final latestKg = num.tryParse((list.first['weight_kg'] ?? list.first['weightKg'] ?? 0).toString());
            if (latestKg != null && latestKg > 0) {
              _weightController.text = latestKg.toStringAsFixed(1);
            }
          }
        });
      } else if (mounted) {
        setState(() => _isLoadingEntries = false);
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingEntries = false);
    }
  }

  void _adjustWeight(double delta) {
    final current = double.tryParse(_weightController.text.trim()) ??
        (widget.currentWeightKg != null && widget.currentWeightKg! > 0
            ? widget.currentWeightKg!
            : 70.0);
    final updated = (current + delta).clamp(20.0, 500.0);
    setState(() {
      _weightController.text = updated.toStringAsFixed(1);
    });
  }

  Future<void> _submitWeight() async {
    final weight = double.tryParse(_weightController.text.trim());
    if (weight == null || weight < 20 || weight > 500) {
      showPremiumSnackBar(
        context,
        'Please enter a valid weight between 20 and 500 kg',
        isError: true,
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final notes = _notesController.text.trim();
      final payload = {
        'weightKg': weight,
        if (notes.isNotEmpty) 'notes': notes,
      };

      await widget.apiClient.post('/me/weight', body: payload);
      await _fetchWeightHistory();

      if (mounted) {
        widget.onLogged?.call();
        Navigator.of(context).pop(true);
        showPremiumSnackBar(
          context,
          'Body weight of ${weight.toStringAsFixed(1)} kg logged successfully!',
          isSuccess: true,
        );
      }
    } on OfflineOperationQueued catch (_) {
      if (mounted) {
        widget.onLogged?.call();
        Navigator.of(context).pop(true);
        showPremiumSnackBar(
          context,
          'Weight saved offline. Will sync when online.',
        );
      }
    } catch (e) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Error logging weight: ${e.toString().replaceAll("Exception: ", "")}',
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  String _formatDate(dynamic dateStr) {
    if (dateStr == null) return '';
    try {
      final parsed = DateTime.tryParse(dateStr.toString());
      if (parsed == null) return dateStr.toString();
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final entryDate = DateTime(parsed.year, parsed.month, parsed.day);
      final diff = today.difference(entryDate).inDays;
      if (diff == 0) return 'Today';
      if (diff == 1) return 'Yesterday';
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${months[parsed.month - 1]} ${parsed.day}, ${parsed.year}';
    } catch (_) {
      return dateStr.toString();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final isLoggedToday = widget.currentWeightKg != null && widget.currentWeightKg! > 0;
    final goal = widget.goal;
    final targetWeight = goal != null
        ? num.tryParse((goal['targetWeightKg'] ?? goal['target_weight_kg'] ?? 0).toString())
        : null;
    final progressPct = goal != null
        ? num.tryParse((goal['progressPct'] ?? goal['progress_pct'] ?? 0).toString())
        : null;

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
                          color: colors.violet.withValues(alpha: 0.15),
                        ),
                        child: Icon(Icons.monitor_weight_outlined,
                            color: colors.violet, size: 20),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          'Weight Quick Log',
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
                Flexible(
                  child: StatusBadge(
                    label: isLoggedToday
                        ? '${widget.currentWeightKg!.toStringAsFixed(1)} kg logged'
                        : 'Not logged today',
                    color: isLoggedToday ? colors.violet : colors.textMuted,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Segmented Tab Toggle (Log Today | Previous Entries)
            _buildTabSelector(colors),

            if (_activeTab == 0) ...[
              // TAB 0: LOG WEIGHT FORM
              // Goal progress banner if goal is available
              if (goal != null && targetWeight != null && targetWeight > 0) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: colors.violet.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    border: Border.all(
                      color: colors.violet.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              'WEIGHT GOAL TARGET: ${targetWeight.toStringAsFixed(1)} kg',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5,
                                color: colors.violet,
                              ),
                            ),
                          ),
                          if (progressPct != null) ...[
                            const SizedBox(width: 8),
                            Text(
                              '${progressPct.toInt()}%',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: colors.violet,
                              ),
                            ),
                          ],
                        ],
                      ),
                      if (progressPct != null) ...[
                        const SizedBox(height: 6),
                        PremiumProgressBar(
                          value: (progressPct / 100.0).clamp(0.0, 1.0),
                          height: 6,
                          color: colors.violet,
                          backgroundColor: colors.surfaceElevated,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 14),
              ],

              // Weight input field
              Text(
                'TODAY\'S WEIGHT (KG)',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.6,
                  color: colors.textSecondary,
                ),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _weightController,
                focusNode: _weightFocus,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: colors.textPrimary,
                ),
                decoration: InputDecoration(
                  hintText: 'e.g. 75.5',
                  prefixIcon: Icon(Icons.monitor_weight_outlined,
                      size: 22, color: colors.violet),
                  suffixText: 'kg',
                  suffixStyle: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: colors.textSecondary,
                  ),
                  filled: true,
                  fillColor: colors.surfaceElevated,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    borderSide: BorderSide(color: colors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    borderSide: BorderSide(color: colors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    borderSide: BorderSide(color: colors.violet, width: 1.8),
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Quick Adjust Buttons
              Text(
                'QUICK ADJUST',
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
                children: _quickAdjusters.map((delta) {
                  final label = delta > 0
                      ? '+${delta.toStringAsFixed(1)} kg'
                      : '${delta.toStringAsFixed(1)} kg';
                  return PremiumChoiceButton(
                    label: label,
                    accentColor: colors.violet,
                    onPressed: () => _adjustWeight(delta),
                  );
                }).toList(),
              ),
              const SizedBox(height: 14),

              // Optional Notes Toggle / Field
              if (!_showNotes && _notesController.text.isEmpty)
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: () => setState(() => _showNotes = true),
                    icon: Icon(Icons.note_add_outlined,
                        size: 16, color: colors.textSecondary),
                    label: Text(
                      'Add notes (optional)',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: colors.textSecondary,
                      ),
                    ),
                  ),
                )
              else ...[
                Text(
                  'NOTES (OPTIONAL)',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _notesController,
                  focusNode: _notesFocus,
                  maxLines: 2,
                  style: TextStyle(
                    fontSize: 13,
                    color: colors.textPrimary,
                  ),
                  decoration: InputDecoration(
                    hintText: 'e.g. Fasted morning weigh-in after wake-up',
                    filled: true,
                    fillColor: colors.surfaceElevated,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
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
                      borderSide: BorderSide(color: colors.violet, width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],

              const SizedBox(height: 12),

              // Submit Button
              PremiumButton(
                text: _isSubmitting
                    ? 'Saving...'
                    : (isLoggedToday ? 'Update Weight' : 'Log Body Weight'),
                icon: const Icon(Icons.check, size: 18),
                loading: _isSubmitting,
                onPressed: _isSubmitting ? () {} : _submitWeight,
                height: 46,
              ),

              // Recent Entries Preview below the button
              if (_entries.isNotEmpty) ...[
                const SizedBox(height: 18),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        'RECENT ENTRIES',
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
                    GestureDetector(
                      onTap: () => setState(() => _activeTab = 1),
                      child: Text(
                        'See all (${_entries.length}) →',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: colors.violet,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ..._entries.take(3).toList().asMap().entries.map((item) {
                  return _buildEntryTile(item.value, item.key, colors);
                }),
              ],
            ] else ...[
              // TAB 1: FULL PREVIOUS ENTRIES HISTORY
              if (_isLoadingEntries)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 32),
                  child: Center(
                    child: CircularProgressIndicator(color: colors.violet),
                  ),
                )
              else if (_entries.isEmpty)
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: colors.surfaceElevated,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    border: Border.all(color: colors.border),
                  ),
                  child: Column(
                    children: [
                      Icon(Icons.history, size: 40, color: colors.textMuted),
                      const SizedBox(height: 10),
                      Text(
                        'No Previous Entries Found',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: colors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Log your weight today to start tracking your journey.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: colors.textSecondary),
                      ),
                      const SizedBox(height: 12),
                      PremiumButton(
                        text: 'Log Weight Now',
                        onPressed: () => setState(() => _activeTab = 0),
                        height: 36,
                      ),
                    ],
                  ),
                )
              else ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        'RECORDED WEIGH-INS (${_entries.length})',
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
                    Text(
                      'Tap entry to pre-fill',
                      style: TextStyle(
                        fontSize: 11,
                        color: colors.textMuted,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ..._entries.asMap().entries.map((item) {
                  return _buildEntryTile(item.value, item.key, colors);
                }),
              ],
            ],

            const SizedBox(height: 12),

            // History Link
            if (widget.onViewHistory != null)
              Center(
                child: TextButton.icon(
                  onPressed: () {
                    Navigator.of(context).pop();
                    widget.onViewHistory!();
                  },
                  icon: Icon(Icons.show_chart,
                      size: 16, color: colors.textSecondary),
                  label: Text(
                    'Open Full Weight Trends & Analytics',
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

  Widget _buildTabSelector(AppThemeColors colors) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _activeTab = 0),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 7),
                decoration: BoxDecoration(
                  color: _activeTab == 0 ? colors.violet : Colors.transparent,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                alignment: Alignment.center,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.edit_note,
                      size: 15,
                      color: _activeTab == 0 ? colors.onPrimary : colors.textSecondary,
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        'Log Weight',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: _activeTab == 0 ? colors.onPrimary : colors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _activeTab = 1),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 7),
                decoration: BoxDecoration(
                  color: _activeTab == 1 ? colors.violet : Colors.transparent,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                alignment: Alignment.center,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.history,
                      size: 15,
                      color: _activeTab == 1 ? colors.onPrimary : colors.textSecondary,
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        _entries.isNotEmpty ? 'History (${_entries.length})' : 'History',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: _activeTab == 1 ? colors.onPrimary : colors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEntryTile(Map<String, dynamic> entry, int index, AppThemeColors colors) {
    final weightKg = num.tryParse((entry['weight_kg'] ?? entry['weightKg'] ?? 0).toString())?.toDouble() ?? 0.0;
    final dateStr = (entry['measurement_date'] ?? entry['measurementDate'] ?? entry['created_at'] ?? '').toString();
    final formattedDate = _formatDate(dateStr);
    final notes = (entry['notes'] ?? '').toString().trim();

    // Calculate delta relative to previous chronological entry (index + 1 in desc list)
    double? delta;
    if (index + 1 < _entries.length) {
      final prevKg = num.tryParse((_entries[index + 1]['weight_kg'] ?? _entries[index + 1]['weightKg'] ?? 0).toString())?.toDouble();
      if (prevKg != null && prevKg > 0) {
        delta = weightKg - prevKg;
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            // Pre-fill weight input and switch to log tab
            setState(() {
              _weightController.text = weightKg.toStringAsFixed(1);
              _activeTab = 0;
            });
            showPremiumSnackBar(
              context,
              'Loaded ${weightKg.toStringAsFixed(1)} kg into input',
            );
          },
          borderRadius: BorderRadius.circular(AppRadii.md),
          child: PremiumCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: colors.violet.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.monitor_weight_outlined, size: 18, color: colors.violet),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            '${weightKg.toStringAsFixed(1)} kg',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: colors.textPrimary,
                            ),
                          ),
                          if (delta != null) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                              decoration: BoxDecoration(
                                color: delta < 0
                                    ? const Color(0xFF10B981).withValues(alpha: 0.15)
                                    : (delta > 0
                                        ? colors.rose.withValues(alpha: 0.15)
                                        : colors.textMuted.withValues(alpha: 0.15)),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    delta < 0
                                        ? Icons.arrow_downward
                                        : (delta > 0 ? Icons.arrow_upward : Icons.remove),
                                    size: 10,
                                    color: delta < 0
                                        ? const Color(0xFF10B981)
                                        : (delta > 0 ? colors.rose : colors.textMuted),
                                  ),
                                  const SizedBox(width: 2),
                                  Text(
                                    '${delta.abs().toStringAsFixed(1)} kg',
                                    style: TextStyle(
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w700,
                                      color: delta < 0
                                          ? const Color(0xFF10B981)
                                          : (delta > 0 ? colors.rose : colors.textMuted),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              formattedDate,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 11, color: colors.textMuted),
                            ),
                          ),
                          if (notes.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Icon(Icons.notes, size: 11, color: colors.textMuted),
                            const SizedBox(width: 2),
                            Flexible(
                              child: Text(
                                notes,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontStyle: FontStyle.italic,
                                  color: colors.textSecondary,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, size: 16, color: colors.textMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
