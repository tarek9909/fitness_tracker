import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/storage/local_cache.dart';

class HistoryScreen extends StatefulWidget {
  final ApiClient apiClient;
  final LocalCache? localCache;

  const HistoryScreen({super.key, required this.apiClient, this.localCache});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  List<dynamic> _workouts = [];
  List<dynamic> _meals = [];
  List<dynamic> _water = [];
  List<dynamic> _cardio = [];
  List<dynamic> _weight = [];
  bool _loading = true;
  String? _errorMessage;
  bool _showingCachedData = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    _fetchAllHistory();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchAllHistory() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
      _showingCachedData = false;
    });

    try {
      final sources = [
        ('workouts', '/me/workouts/history?limit=50'),
        ('meals', '/me/meals/history?limit=50'),
        ('water', '/me/water/history?limit=50'),
        ('cardio', '/me/cardio/history?limit=50'),
        ('weight', '/me/weight/history?limit=50'),
      ];
      final results = await Future.wait(sources.map((source) async {
        try {
          final result = await widget.apiClient.get(source.$2);
          if (widget.localCache != null) {
            await widget.localCache!
                .writeJson('cache.history.${source.$1}', result);
          }
          return result;
        } catch (_) {
          _showingCachedData = true;
          return widget.localCache?.readJson('cache.history.${source.$1}');
        }
      }));

      final hasAnyData = results.any((result) => result != null);
      if (!hasAnyData) {
        throw Exception('No synchronized history is available offline');
      }

      if (mounted) {
        setState(() {
          _workouts = _asList(results[0]);
          _meals = _asList(results[1]);
          _water = _asList(results[2]);
          _cardio = _asList(results[3]);
          _weight = _asList(results[4]);
          _loading = false;
          _errorMessage = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _loading = false;
        });
      }
    }
  }

  List<dynamic> _asList(dynamic response) {
    if (response is List<dynamic>) return response;
    if (response is Map<String, dynamic>) {
      if (response['history'] is List<dynamic>) {
        return response['history'] as List<dynamic>;
      }
      if (response['data'] is List<dynamic>) {
        return response['data'] as List<dynamic>;
      }
      if (response['data'] is Map<String, dynamic> &&
          response['data']['history'] is List<dynamic>) {
        return response['data']['history'] as List<dynamic>;
      }
      if (response['entries'] is List<dynamic>) {
        return response['entries'] as List<dynamic>;
      }
      if (response['items'] is List<dynamic>) {
        return response['items'] as List<dynamic>;
      }
    }
    return const [];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Activity History',
            style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.surface,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: AppColors.cyan,
          labelColor: AppColors.cyan,
          unselectedLabelColor: AppColors.textSecondary,
          tabs: const [
            Tab(text: 'Workouts'),
            Tab(text: 'Meals'),
            Tab(text: 'Water'),
            Tab(text: 'Cardio'),
            Tab(text: 'Weight'),
          ],
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.cyan))
          : _errorMessage != null && !_showingCachedData
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.cloud_off,
                            size: 48, color: AppColors.rose),
                        const SizedBox(height: 16),
                        Text(
                          'Failed to load history: $_errorMessage',
                          textAlign: TextAlign.center,
                          style:
                              const TextStyle(color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: _fetchAllHistory,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : Column(
                  children: [
                    if (_showingCachedData)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                        color: AppColors.amber.withValues(alpha: 0.14),
                        child: const Text(
                          'Offline mode: showing the last synchronized history.',
                          style:
                              TextStyle(color: AppColors.amber, fontSize: 12),
                        ),
                      ),
                    Expanded(
                      child: TabBarView(
                        controller: _tabController,
                        children: [
                          _buildWorkoutList(),
                          _buildMealList(),
                          _buildWaterList(),
                          _buildCardioList(),
                          _buildWeightList(),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildWorkoutList() {
    if (_workouts.isEmpty) {
      return _buildEmpty('No workout history recorded yet');
    }
    return RefreshIndicator(
      onRefresh: _fetchAllHistory,
      color: AppColors.cyan,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _workouts.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, idx) {
          final w = _workouts[idx];
          final name = w['workout_name_snapshot'] as String? ?? 'Workout';
          final date =
              (w['session_date'] ?? w['workout_date']) as String? ?? '';
          final exerciseCount = w['exercise_count'] ?? 0;
          final setsCount = w['completed_sets_count'] ?? 0;

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
                    Text(name,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                            color: Colors.white)),
                    Text(date,
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.textSecondary)),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _buildBadge(Icons.fitness_center,
                        '$exerciseCount exercises', AppColors.cyan),
                    const SizedBox(width: 8),
                    _buildBadge(Icons.check_circle_outline,
                        '$setsCount completed sets', AppColors.primary),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildMealList() {
    if (_meals.isEmpty) return _buildEmpty('No meal history recorded yet');
    return RefreshIndicator(
      onRefresh: _fetchAllHistory,
      color: AppColors.cyan,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _meals.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, idx) {
          final m = _meals[idx];
          final name = m['meal_name'] as String? ?? 'Meal';
          final date = (m['log_date'] ?? m['meal_date']) as String? ?? '';
          final status = m['status'] as String? ?? 'completed';

          return Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                            color: Colors.white)),
                    const SizedBox(height: 4),
                    Text(date,
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.textSecondary)),
                  ],
                ),
                _buildBadge(
                  Icons.restaurant,
                  status.toUpperCase(),
                  status == 'completed' ? AppColors.primary : AppColors.amber,
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildWaterList() {
    if (_water.isEmpty) {
      return _buildEmpty('No water intake history recorded yet');
    }
    return RefreshIndicator(
      onRefresh: _fetchAllHistory,
      color: AppColors.cyan,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _water.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, idx) {
          final w = _water[idx];
          final amount = (w['amount_ml'] ?? w['total_ml'] ?? 0);
          final date = (w['intake_date'] ?? w['logged_at'] ?? '') as String;

          return Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(date,
                    style: const TextStyle(fontSize: 14, color: Colors.white)),
                _buildBadge(Icons.water_drop, '$amount ml', AppColors.cyan),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildCardioList() {
    if (_cardio.isEmpty) {
      return _buildEmpty('No cardio activity history recorded yet');
    }
    return RefreshIndicator(
      onRefresh: _fetchAllHistory,
      color: AppColors.cyan,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _cardio.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, idx) {
          final c = _cardio[idx];
          final activityName = c['activity_name'] as String? ?? 'Cardio';
          final duration = c['duration_minutes'] ?? 0;
          final date = c['cardio_date'] as String? ?? '';

          return Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(activityName,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                            color: Colors.white)),
                    const SizedBox(height: 4),
                    Text(date,
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.textSecondary)),
                  ],
                ),
                _buildBadge(
                    Icons.timer_outlined, '$duration min', AppColors.rose),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildWeightList() {
    if (_weight.isEmpty) {
      return _buildEmpty('No weight log history recorded yet');
    }
    return RefreshIndicator(
      onRefresh: _fetchAllHistory,
      color: AppColors.cyan,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _weight.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, idx) {
          final w = _weight[idx];
          final weightKg = w['weight_kg'];
          final date =
              (w['measurement_date'] ?? w['entry_date'] ?? '') as String;

          return Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(date,
                    style: const TextStyle(fontSize: 14, color: Colors.white)),
                _buildBadge(Icons.scale, '$weightKg kg', AppColors.cyan),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildBadge(IconData icon, String label, Color color) {
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

  Widget _buildEmpty(String message) {
    return Center(
      child: Text(message,
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 15)),
    );
  }
}
