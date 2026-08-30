import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

class WeightScreen extends StatefulWidget {
  final ApiClient apiClient;

  const WeightScreen({super.key, required this.apiClient});

  @override
  State<WeightScreen> createState() => _WeightScreenState();
}

class _WeightScreenState extends State<WeightScreen> {
  final _weightController = TextEditingController();
  final _notesController = TextEditingController();
  final _notesFocusNode = FocusNode();
  Map<String, dynamic>? _weightData;
  bool _isLoading = true;
  bool _isSaving = false;
  String? _errorMessage;

  @override
  void dispose() {
    _weightController.dispose();
    _notesController.dispose();
    _notesFocusNode.dispose();
    super.dispose();
  }

  Future<void> _fetchWeightHistory() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final data = await widget.apiClient.get('/me/weight');
      if (mounted) {
        setState(() {
          _weightData = data is Map<String, dynamic> ? data : null;
          _isLoading = false;
          if (data is Map<String, dynamic> && data['currentWeightKg'] != null) {
            _weightController.text = data['currentWeightKg'].toString();
          }
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
    _fetchWeightHistory();
  }

  Future<void> _saveWeight() async {
    final val = double.tryParse(_weightController.text.trim());
    if (val == null || val < 20 || val > 500) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Please enter a valid weight in kg (20–500)')),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      final notes = _notesController.text.trim();
      await widget.apiClient.post('/me/weight', body: {
        'weightKg': val,
        if (notes.isNotEmpty) 'notes': notes,
      });
      if (mounted) {
        _fetchWeightHistory();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Body weight logged successfully!')),
        );
      }
    } on OfflineOperationQueued catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Weight logged offline. Will sync when online.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to log weight: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
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
        appBar: AppBar(title: const Text('Body Weight Tracker')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.cloud_off, size: 48, color: AppColors.rose),
                const SizedBox(height: 16),
                Text(
                  'Failed to load weight records: $_errorMessage',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: _fetchWeightHistory,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final goal = _weightData?['goal'];
    final entries = (_weightData?['entries'] as List<dynamic>? ?? []);

    return Scaffold(
      appBar: AppBar(title: const Text('Body Weight Tracker')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Log Input Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Log Today\'s Weight',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _weightController,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      textInputAction: TextInputAction.next,
                      onSubmitted: (_) {
                        FocusScope.of(context).requestFocus(_notesFocusNode);
                      },
                      decoration: const InputDecoration(
                        labelText: 'Weight',
                        suffixText: 'kg',
                        prefixIcon: Icon(Icons.monitor_weight_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _notesController,
                      focusNode: _notesFocusNode,
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) {
                        if (!_isSaving) _saveWeight();
                      },
                      decoration: const InputDecoration(
                        labelText: 'Notes (optional)',
                        prefixIcon: Icon(Icons.note_alt_outlined),
                      ),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: _isSaving ? null : _saveWeight,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: _isSaving
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Log Weight'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Goal Progress Summary
            if (goal != null)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('WEIGHT GOAL PROGRESS',
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5,
                                color: AppColors.violet)),
                        Text('${goal['progressPct'] ?? 0}% Complete',
                            style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: LinearProgressIndicator(
                        value: ((goal['progressPct'] ?? 0) / 100.0)
                            .clamp(0.0, 1.0),
                        minHeight: 8,
                        backgroundColor: AppColors.card,
                        valueColor:
                            const AlwaysStoppedAnimation(AppColors.primary),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Start: ${goal['startWeightKg']} kg',
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.textMuted)),
                        Text('Lost: ${goal['weightLostKg']} kg',
                            style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textPrimary)),
                        Text('Target: ${goal['targetWeightKg']} kg',
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.cyan)),
                      ],
                    ),
                  ],
                ),
              ),

            const SizedBox(height: 20),
            const Text('Recent Entries',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 10),

            ...entries.map((e) {
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text('${e['weight_kg']} kg',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: Text(e['measurement_date'] ?? '',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textMuted)),
                  trailing: const Icon(Icons.check_circle,
                      size: 18, color: AppColors.primary),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
