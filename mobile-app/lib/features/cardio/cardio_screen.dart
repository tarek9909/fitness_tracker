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
  final _inclineController = TextEditingController();
  final _speedController = TextEditingController();

  final _durationFocus = FocusNode();
  final _inclineFocus = FocusNode();
  final _speedFocus = FocusNode();

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
    _inclineController.dispose();
    _speedController.dispose();

    _durationFocus.dispose();
    _inclineFocus.dispose();
    _speedFocus.dispose();
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
        if (_inclineController.text.trim().isNotEmpty)
          'inclinePct': double.tryParse(_inclineController.text.trim()),
        if (_speedController.text.trim().isNotEmpty)
          'speedKmh': double.tryParse(_speedController.text.trim()),
      };

      await widget.apiClient.post('/me/cardio', body: payload);

      if (mounted) {
        showPremiumSnackBar(context, 'Cardio session recorded successfully!',
            isSuccess: true);
        _durationController.clear();
        _inclineController.clear();
        _speedController.clear();
        _loadData();
        _tabController.animateTo(1);
      }
    } on OfflineOperationQueued catch (_) {
      if (mounted) {
        showPremiumSnackBar(
            context, 'Cardio session saved offline. Will sync when online.');
        _durationController.clear();
        _inclineController.clear();
        _speedController.clear();
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
            title: 'Activity & Prescription',
            subtitle: 'Record conditioning duration, incline, and speed',
          ),
          const SizedBox(height: 12),
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

          // Duration (Minutes)
          PremiumTextField(
            controller: _durationController,
            focusNode: _durationFocus,
            label: 'Duration (Minutes) *',
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.next,
            onSubmitted: (_) {
              FocusScope.of(context).requestFocus(_inclineFocus);
            },
            prefixIcon: Icons.timer_outlined,
          ),
          const SizedBox(height: 12),

          // Incline & Speed Row
          Row(
            children: [
              Expanded(
                child: PremiumTextField(
                  controller: _inclineController,
                  focusNode: _inclineFocus,
                  label: 'Incline (%)',
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  textInputAction: TextInputAction.next,
                  onSubmitted: (_) {
                    FocusScope.of(context).requestFocus(_speedFocus);
                  },
                  prefixIcon: Icons.trending_up,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: PremiumTextField(
                  controller: _speedController,
                  focusNode: _speedFocus,
                  label: 'Speed (km/h)',
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) {
                    if (!_submitting) _submitCardio();
                  },
                  prefixIcon: Icons.speed_outlined,
                ),
              ),
            ],
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
          final incline = item['incline'] ?? item['incline_pct'];
          final speed = item['speed_kmh'];

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
                    if (incline != null)
                      StatusBadge(
                        icon: Icon(Icons.trending_up,
                            size: 12, color: colors.amber),
                        label: '$incline% incline',
                        color: colors.amber,
                      ),
                    if (speed != null)
                      StatusBadge(
                        icon: Icon(Icons.speed,
                            size: 12, color: colors.primary),
                        label: '$speed km/h',
                        color: colors.primary,
                      ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
