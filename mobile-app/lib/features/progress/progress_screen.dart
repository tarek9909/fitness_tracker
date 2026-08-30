import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

class ProgressScreen extends StatefulWidget {
  final ApiClient apiClient;

  const ProgressScreen({super.key, required this.apiClient});

  @override
  State<ProgressScreen> createState() => _ProgressScreenState();
}

class _ProgressScreenState extends State<ProgressScreen> {
  Map<String, dynamic>? _progress;
  bool _isLoading = true;
  String? _errorMessage;

  Future<void> _fetchProgress() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final res = await widget.apiClient.get('/me/progress');
      if (mounted) {
        setState(() {
          _progress = res is Map<String, dynamic> ? res : null;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _fetchProgress();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body:
            Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    if (_errorMessage != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Progress & Analytics')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.cloud_off, size: 48, color: AppColors.rose),
                const SizedBox(height: 16),
                Text(
                  'Failed to load progress analytics: $_errorMessage',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: _fetchProgress,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final workouts = _progress?['workouts'];
    final cardio = _progress?['cardio'];
    final weight = _progress?['weight'];

    return Scaffold(
      appBar: AppBar(title: const Text('Progress & Analytics')),
      body: RefreshIndicator(
        onRefresh: _fetchProgress,
        color: AppColors.primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Workout Volume Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.fitness_center, color: AppColors.cyan),
                          SizedBox(width: 8),
                          Text('WORKOUT SESSIONS',
                              style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                  color: AppColors.cyan)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        '${workouts?['completedSessions'] ?? 0} Workouts Completed',
                        style: const TextStyle(
                            fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${workouts?['totalSets'] ?? 0} working sets logged',
                        style: const TextStyle(
                            color: AppColors.textSecondary, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Cardio Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.directions_run, color: AppColors.amber),
                          SizedBox(width: 8),
                          Text('CARDIO CONDITIONING',
                              style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                  color: AppColors.amber)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        '${cardio?['totalMinutes'] ?? 0} Total Minutes',
                        style: const TextStyle(
                            fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${cardio?['totalCalories'] ?? 0} active kcal burned',
                        style: const TextStyle(
                            color: AppColors.textSecondary, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Weight Card
              if (weight != null)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.trending_down, color: AppColors.primary),
                            SizedBox(width: 8),
                            Text('BODY COMPOSITION',
                                style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                    color: AppColors.primary)),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          weight['currentWeightKg'] != null
                              ? '${weight['currentWeightKg']} kg Current'
                              : 'No Weight Logged',
                          style: const TextStyle(
                              fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          weight['targetWeightKg'] != null
                              ? 'Goal: ${weight['targetWeightKg']} kg (${weight['weightLostKg'] ?? 0} kg lost)'
                              : 'No weight goal configured',
                          style: const TextStyle(
                              color: AppColors.textSecondary, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
