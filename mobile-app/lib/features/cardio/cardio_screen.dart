import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load cardio data: $e')),
        );
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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Please enter a valid duration in minutes')),
      );
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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Cardio session recorded successfully!'),
            backgroundColor: AppColors.primary,
          ),
        );
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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content:
                Text('Cardio session saved offline. Will sync when online.'),
            backgroundColor: AppColors.primary,
          ),
        );
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error logging cardio: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Cardio Tracking',
            style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.surface,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.cyan,
          labelColor: AppColors.cyan,
          unselectedLabelColor: AppColors.textSecondary,
          tabs: const [
            Tab(icon: Icon(Icons.add_circle_outline), text: 'Log Activity'),
            Tab(icon: Icon(Icons.history), text: 'Session History'),
          ],
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.cyan))
          : TabBarView(
              controller: _tabController,
              children: [
                _buildLogForm(),
                _buildHistoryList(),
              ],
            ),
    );
  }

  Widget _buildLogForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Activity Selector
          const Text('Select Activity',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<int>(
                value: _selectedActivityId,
                isExpanded: true,
                dropdownColor: AppColors.surface,
                items: _activities.map((a) {
                  return DropdownMenuItem<int>(
                    value: a['id'] as int,
                    child: Text(a['name'] as String? ?? 'Cardio'),
                  );
                }).toList(),
                onChanged: (val) => setState(() => _selectedActivityId = val),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Duration & Distance Row
          Row(
            children: [
              Expanded(
                child: _buildTextField(
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
              const SizedBox(width: 14),
              Expanded(
                child: _buildTextField(
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
          const SizedBox(height: 16),

          // Calories & Heart Rate Row
          Row(
            children: [
              Expanded(
                child: _buildTextField(
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
              const SizedBox(width: 14),
              Expanded(
                child: _buildTextField(
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
          const SizedBox(height: 16),

          // Speed & Incline Row
          Row(
            children: [
              Expanded(
                child: _buildTextField(
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
              const SizedBox(width: 14),
              Expanded(
                child: _buildTextField(
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
          const SizedBox(height: 16),

          // Notes
          _buildTextField(
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
          ElevatedButton(
            onPressed: _submitting ? null : _submitCardio,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.cyan,
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              elevation: 2,
            ),
            child: _submitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.black,
                    ),
                  )
                : const Text(
                    'Record Cardio Session',
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    FocusNode? focusNode,
    TextInputAction? textInputAction,
    ValueChanged<String>? onSubmitted,
    TextInputType keyboardType = TextInputType.text,
    IconData? prefixIcon,
    int maxLines = 1,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        keyboardType: keyboardType,
        textInputAction: textInputAction,
        onSubmitted: onSubmitted,
        maxLines: maxLines,
        style: const TextStyle(color: Colors.white, fontSize: 14),
        decoration: InputDecoration(
          labelText: label,
          labelStyle:
              const TextStyle(color: AppColors.textSecondary, fontSize: 13),
          prefixIcon: prefixIcon != null
              ? Icon(prefixIcon, color: AppColors.textSecondary, size: 20)
              : null,
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
    );
  }

  Widget _buildHistoryList() {
    if (_history.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.directions_run,
                size: 48, color: AppColors.textSecondary),
            SizedBox(height: 12),
            Text('No cardio sessions recorded yet',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 15)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppColors.cyan,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _history.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, idx) {
          final item = _history[idx];
          final activityName = item['activity_name'] as String? ?? 'Cardio';
          final duration = item['duration_minutes'] ?? 0;
          final date = item['cardio_date'] as String? ?? '';
          final distance = item['distance_km'];
          final calories = item['calories_burned'];

          return Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      activityName,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          color: Colors.white),
                    ),
                    Text(
                      date,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    _buildStatBadge(
                        Icons.timer_outlined, '$duration min', AppColors.cyan),
                    if (distance != null) ...[
                      const SizedBox(width: 8),
                      _buildStatBadge(
                          Icons.straighten, '$distance km', AppColors.primary),
                    ],
                    if (calories != null) ...[
                      const SizedBox(width: 8),
                      _buildStatBadge(Icons.local_fire_department,
                          '$calories kcal', AppColors.amber),
                    ],
                  ],
                ),
                if (item['notes'] != null &&
                    (item['notes'] as String).isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    item['notes'] as String,
                    style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
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

  Widget _buildStatBadge(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(label,
              style: TextStyle(
                  color: color, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
