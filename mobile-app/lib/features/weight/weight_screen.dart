import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';

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
      showPremiumSnackBar(
        context,
        'Please enter a valid weight in kg (20–500)',
        isError: true,
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
        showPremiumSnackBar(
          context,
          'Body weight logged successfully!',
          isSuccess: true,
        );
      }
    } on OfflineOperationQueued catch (_) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Weight logged offline. Will sync when online.',
        );
      }
    } catch (e) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Failed to log weight: $e',
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    if (_isLoading) {
      return PremiumScaffold(
        body:
            Center(child: CircularProgressIndicator(color: colors.primary)),
      );
    }

    if (_errorMessage != null) {
      return PremiumScaffold(
        appBar: const PremiumAppBar(
          titleText: 'Body Weight Tracker',
        ),
        body: ErrorStateWidget(
          message: _errorMessage!,
          onRetry: _fetchWeightHistory,
        ),
      );
    }

    final goal = _weightData?['goal'];
    final entries = (_weightData?['entries'] as List<dynamic>? ?? []);

    return PremiumScaffold(
      appBar: const PremiumAppBar(
        titleText: 'Body Weight Tracker',
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Log Input Card
            PremiumCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Log Today\'s Weight',
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          color: colors.textPrimary)),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: PremiumTextField(
                          controller: _weightController,
                          label: 'Weight (kg)',
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                        ),
                      ),
                      const SizedBox(width: 12),
                      PremiumButton(
                        text: 'Save',
                        onPressed: _isSaving ? null : _saveWeight,
                        loading: _isSaving,
                        height: 48,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // Goal Card
            if (goal != null) ...[
              PremiumCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Weight Goal',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                            color: colors.textPrimary,
                          ),
                        ),
                        StatusBadge(
                          label: '${goal['progressPct'] ?? 0}% Complete',
                          color: colors.primary,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    PremiumProgressBar(
                      value:
                          ((goal['progressPct'] ?? 0) / 100.0).clamp(0.0, 1.0),
                      height: 8,
                      color: colors.primary,
                      backgroundColor: colors.surfaceElevated,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Start: ${goal['startWeightKg']} kg',
                            style: TextStyle(
                                fontSize: 12, color: colors.textMuted)),
                        Text('Delta: ${goal['weightLostKg']} kg',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: colors.textPrimary)),
                        Text('Target: ${goal['targetWeightKg']} kg',
                            style: TextStyle(
                                fontSize: 12, color: colors.cyan)),
                      ],
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 20),
            const SectionHeader(
              title: 'Recent Entries',
              subtitle: 'Previous recorded morning weigh-ins',
            ),
            const SizedBox(height: 8),

            if (entries.isEmpty)
              const EmptyStateWidget(
                icon: Icons.monitor_weight_outlined,
                title: 'No Recorded Entries',
                description:
                    'Start tracking your morning body weight regularly.',
              )
            else
              ...entries.map((e) {
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: PremiumCard(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${e['weight_kg']} kg',
                                style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 16,
                                    color: colors.textPrimary)),
                            const SizedBox(height: 2),
                            Text(e['measurement_date'] ?? '',
                                style: TextStyle(
                                    fontSize: 12, color: colors.textMuted)),
                          ],
                        ),
                        StatusBadge(
                          label: 'Recorded',
                          color: colors.primary,
                          icon: Icon(Icons.check,
                              size: 12, color: colors.primary),
                        ),
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}
