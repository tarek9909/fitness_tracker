import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';

class CardioScreen extends StatefulWidget {
  final ApiClient apiClient;

  const CardioScreen({super.key, required this.apiClient});

  @override
  State<CardioScreen> createState() => _CardioScreenState();
}

class _CardioScreenState extends State<CardioScreen>
  with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _activities = [];
  List<dynamic> _history = [];
  bool _loading = true;
  bool _submitting = false;

  // Form State
  int? _selectedActivityId;
  final _durationController = TextEditingController();
  final _distanceController = TextEditingController();
  final _caloriesController = TextEditingController();
  final _speedController = TextEditingController();
  final _inclineController = TextEditingController();
  final _heartRateController = TextEditingController();
  final _notesController = TextEditingController();

  final _durationFocus = FocusNode();
  final _distanceFocus = FocusNode();
  final _caloriesFocus = FocusNode();
  final _heartRateFocus = FocusNode();
  final _speedFocus = FocusNode();
  final _inclineFocus = FocusNode();
  final _notesFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _durationController.dispose();
    _distanceController.dispose();
    _caloriesController.dispose();
    _speedController.dispose();
    _inclineController.dispose();
    _heartRateController.dispose();
    _notesController.dispose();

    _durationFocus.dispose();
    _distanceFocus.dispose();
    _caloriesFocus.dispose();
    _heartRateFocus.dispose();
    _speedFocus.dispose();
    _inclineFocus.dispose();
    _notesFocus.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final actRes = await widget.apiClient.get('/me/cardio/activities');
      final histRes = await widget.apiClient.get('/me/cardio/history');

      final activities = _asList(actRes);
      final history = _asList(histRes);

      setState(() {
        _activities = activities;
        _history = history;
        if (_activities.isNotEmpty && _selectedActivityId == null) {
          _selectedActivityId = _activities.first['id'] as int?;
        }
      });
    } catch (e) {
      if (mounted) {
        showPremiumSnackBar(context, 'Failed to load cardio data: $e',
            isError: true);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<dynamic> _asList(dynamic response) {
    if (response is List<dynamic>) return response;
    if (response is Map<String, dynamic> && response['data'] is List<dynamic>) {
      return response['data'] as List<dynamic>;
    }
    return const [];
  }

  Future<void> _submitCardio() async {
    if (_selectedActivityId == null) return;
    final duration = int.tryParse(_durationController.text.trim());
    if (duration == null || duration <= 0) {
      showPremiumSnackBar(context, 'Please enter a valid duration in minutes',
          isError: true);
      return;
    }

    setState(() => _submitting = true);
    try {
      final payload = {
        'cardioActivityId': _selectedActivityId,
        'durationMinutes': duration,
        if (_distanceController.text.trim().isNotEmpty)
          'distanceKm': double.tryParse(_distanceController.text.trim()),
        if (_caloriesController.text.trim().isNotEmpty)
          'caloriesBurned': double.tryParse(_caloriesController.text.trim()),
        if (_speedController.text.trim().isNotEmpty)
          'speedKmh': double.tryParse(_speedController.text.trim()),
        if (_inclineController.text.trim().isNotEmpty)
          'inclinePct': double.tryParse(_inclineController.text.trim()),
        if (_heartRateController.text.trim().isNotEmpty)
          'averageHeartRate': double.tryParse(_heartRateController.text.trim()),
        if (_notesController.text.trim().isNotEmpty)
          'notes': _notesController.text.trim(),
      };

      await widget.apiClient.post('/me/cardio', body: payload);

      if (mounted) {
        showPremiumSnackBar(context, 'Cardio session recorded successfully!',
            isSuccess: true);
        _durationController.clear();
        _distanceController.clear();
        _caloriesController.clear();
        _speedController.clear();
        _inclineController.clear();
        _heartRateController.clear();
        _notesController.clear();
        _loadData();
        _tabController.animateTo(1);
      }
    } on OfflineOperationQueued catch (_) {
      if (mounted) {
        showPremiumSnackBar(
            context, 'Cardio session saved offline. Will sync when online.');
        _durationController.clear();
        _distanceController.clear();
        _caloriesController.clear();
        _speedController.clear();
        _inclineController.clear();
        _heartRateController.clear();
        _notesController.clear();
      }
    } catch (e) {
      if (mounted) {
        showPremiumSnackBar(context, 'Error logging cardio: $e', isError: true);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return PremiumScaffold(
      appBar: PremiumAppBar(
        titleText: 'Cardio Tracking',
        bottom: PremiumTabBar(
          controller: _tabController,
          tabs: const [
            Tab(
                icon: Icon(Icons.add_circle_outline, size: 18),
                text: 'Log Activity'),
            Tab(icon: Icon(Icons.history, size: 18), text: 'Session History'),
          ],
        ),
      ),
      body: _loading
          ? Center(
              child: CircularProgressIndicator(color: colors.primary))
          : PremiumTabView(
              controller: _tabController,
              children: [
                _buildLogForm(colors),
                _buildHistoryList(colors),
              ],
            ),
    );
  }

  Widget _buildLogForm(AppThemeColors colors) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SectionHeader(
            title: 'Activity & Prescriptions',
            subtitle: 'Choose target conditioning discipline and metrics',
          ),
          const SizedBox(height: 8),
          PremiumDropdownField<int>(
            label: 'Select Activity',
            value: _selectedActivityId,
            items: _activities.map((a) {
              return DropdownMenuItem<int>(
                value: a['id'] as int,
                child: Text(
                  a['name'] as String? ?? 'Cardio',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: colors.textPrimary,
                  ),
                ),
              );
            }).toList(),
            onChanged: (val) => setState(() => _selectedActivityId = val),
          ),
          const SizedBox(height: 16),

          // Duration & Distance Row
          Row(
            children: [
              Expanded(
                child: PremiumTextField(
                  controller: _durationController,
                  focusNode: _durationFocus,
                  label: 'Duration (Minutes) *',
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.next,
                  onSubmitted: (_) {
                    FocusScope.of(context).requestFocus(_distanceFocus);
                  },
                  prefixIcon: Icons.timer_outlined,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: PremiumTextField(
                  controller: _distanceController,
                  focusNode: _distanceFocus,
                  label: 'Distance (km)',
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  textInputAction: TextInputAction.next,
                  onSubmitted: (_) {
                    FocusScope.of(context).requestFocus(_caloriesFocus);
                  },
                  prefixIcon: Icons.straighten_outlined,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Calories & Heart Rate Row
          Row(
            children: [
              Expanded(
                child: PremiumTextField(
                  controller: _caloriesController,
                  focusNode: _caloriesFocus,
                  label: 'Calories Burned',
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.next,
                  onSubmitted: (_) {
                    FocusScope.of(context).requestFocus(_heartRateFocus);
                  },
                  prefixIcon: Icons.local_fire_department_outlined,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: PremiumTextField(
                  controller: _heartRateController,
                  focusNode: _heartRateFocus,
                  label: 'Avg Heart Rate (bpm)',
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.next,
                  onSubmitted: (_) {
                    FocusScope.of(context).requestFocus(_speedFocus);
                  },
                  prefixIcon: Icons.favorite_outline,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Speed & Incline Row
          Row(
            children: [
              Expanded(
                child: PremiumTextField(
                  controller: _speedController,
                  focusNode: _speedFocus,
                  label: 'Speed (km/h)',
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  textInputAction: TextInputAction.next,
                  onSubmitted: (_) {
                    FocusScope.of(context).requestFocus(_inclineFocus);
                  },
                  prefixIcon: Icons.speed_outlined,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: PremiumTextField(
                  controller: _inclineController,
                  focusNode: _inclineFocus,
                  label: 'Incline (%)',
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  textInputAction: TextInputAction.next,
                  onSubmitted: (_) {
                    FocusScope.of(context).requestFocus(_notesFocus);
                  },
                  prefixIcon: Icons.trending_up,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Notes
          PremiumTextField(
            controller: _notesController,
            focusNode: _notesFocus,
            label: 'Session Notes',
            prefixIcon: Icons.notes_outlined,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) {
              if (!_submitting) _submitCardio();
            },
            maxLines: 2,
          ),
          const SizedBox(height: 24),

          // Submit Button
          PremiumButton(
            text: 'Record Cardio Session',
            loading: _submitting,
            onPressed: _submitCardio,
            icon: const Icon(Icons.check, size: 18, color: Colors.white),
            height: 48,
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryList(AppThemeColors colors) {
    if (_history.isEmpty) {
      return const EmptyStateWidget(
        icon: Icons.directions_run,
        title: 'No Cardio History',
        description:
            'You haven\'t logged any cardio sessions yet. Complete your prescribed conditioning today.',
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      color: colors.primary,
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: _history.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, idx) {
          final item = _history[idx];
          final activityName = item['activity_name'] as String? ?? 'Cardio';
          final duration = item['duration_minutes'] ?? 0;
          final date = item['cardio_date'] as String? ?? '';
          final distance = item['distance_km'];
          final calories = item['calories_burned'];

          return PremiumCard(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        activityName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                            color: colors.textPrimary),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      date,
                      style: TextStyle(
                          fontSize: 12, color: colors.textSecondary),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    StatusBadge(
                      icon: Icon(Icons.timer_outlined,
                          size: 12, color: colors.cyan),
                      label: '$duration min',
                      color: colors.cyan,
                    ),
                    if (distance != null)
                      StatusBadge(
                        icon: Icon(Icons.straighten,
                            size: 12, color: colors.primary),
                        label: '$distance km',
                        color: colors.primary,
                      ),
                    if (calories != null)
                      StatusBadge(
                        icon: Icon(Icons.local_fire_department,
                            size: 12, color: colors.amber),
                        label: '$calories kcal',
                        color: colors.amber,
                      ),
                  ],
                ),
                if (item['notes'] != null &&
                    (item['notes'] as String).isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    item['notes'] as String,
                    style: TextStyle(
                        fontSize: 12,
                        color: colors.textMuted,
                        fontStyle: FontStyle.italic),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}
