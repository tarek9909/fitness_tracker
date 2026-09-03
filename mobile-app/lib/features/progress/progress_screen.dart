import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';

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
          titleText: 'Progress & Analytics',
        ),
        body: ErrorStateWidget(
          message: _errorMessage!,
          onRetry: _fetchProgress,
        ),
      );
    }

    final workouts = _progress?['workouts'];
    final cardio = _progress?['cardio'];

    return PremiumScaffold(
      appBar: const PremiumAppBar(
        titleText: 'Progress & Analytics',
      ),
      body: RefreshIndicator(
        onRefresh: _fetchProgress,
        color: colors.primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header & Time Filters
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Analytics Overview',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                            color: colors.textPrimary,
                          ),
                        ),
                        Text(
                          'Tracking your performance metrics',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13,
                            color: colors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Time Filters Row
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildTimeFilterPill('7D', false, colors),
                    _buildTimeFilterPill('30D', true, colors),
                    _buildTimeFilterPill('3M', false, colors),
                    _buildTimeFilterPill('6M', false, colors),
                    _buildTimeFilterPill('1Y', false, colors),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Top Level 4-Metric Grid (Stitch design)
              Row(
                children: [
                  Expanded(
                    child: PremiumCard(
                      padding: const EdgeInsets.all(14),
                      ambientGlow: true,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Icon(Icons.restaurant,
                                  color: colors.primary, size: 20),
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: colors.primary,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          Text(
                            '92%',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: colors.textPrimary,
                            ),
                          ),
                          Text(
                            'Diet Adherence',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: PremiumCard(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.directions_run,
                              color: colors.cyan, size: 20),
                          const SizedBox(height: 14),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Flexible(
                                child: Text(
                                  '${cardio?['totalMinutes'] ?? 145}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w900,
                                    color: colors.textPrimary,
                                  ),
                                ),
                              ),
                              Text(
                                ' / 150',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: colors.textMuted,
                                ),
                              ),
                            ],
                          ),
                          Text(
                            'Cardio Mins',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: PremiumCard(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.fitness_center,
                              color: colors.textSecondary, size: 20),
                          const SizedBox(height: 14),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Flexible(
                                child: Text(
                                  '${workouts?['totalSets'] != null ? (workouts!['totalSets'] * 120 / 1000).round() : 12}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w900,
                                    color: colors.textPrimary,
                                  ),
                                ),
                              ),
                              Text(
                                'k',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: colors.textSecondary,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                          Text(
                            'Total Volume (kg)',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: PremiumCard(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.bedtime,
                              color: colors.primary, size: 20),
                          const SizedBox(height: 14),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Flexible(
                                child: Text(
                                  '94',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w900,
                                    color: colors.textPrimary,
                                  ),
                                ),
                              ),
                              Text(
                                ' / 100',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: colors.textMuted,
                                ),
                              ),
                            ],
                          ),
                          Text(
                            'Recovery Score',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Weight Trend Chart Card
              PremiumCard(
                padding: const EdgeInsets.all(20),
                ambientGlow: true,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Weight Trend',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  color: colors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '30 Day History & 7-Day Moving Avg',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: colors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: colors.primary,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Actual',
                              style: TextStyle(
                                fontSize: 11,
                                color: colors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    WeightTrendChart(
                      primaryColor: colors.primary,
                      gridColor: Colors.white.withValues(alpha: 0.08),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Strength Progression Card
              PremiumCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Bench Press 1RM',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: colors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Estimated Progression (kg)',
                      style: TextStyle(
                        fontSize: 12,
                        color: colors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 16),
                    StrengthProgressionChart(
                      primaryColor: colors.primary,
                      barBgColor: colors.surfaceElevated,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTimeFilterPill(
      String label, bool isSelected, AppThemeColors colors) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: isSelected ? colors.primary : colors.surfaceElevated,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(
          color: isSelected
              ? colors.primary
              : Colors.white.withValues(alpha: 0.08),
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.bold,
          color: isSelected ? colors.onPrimary : colors.textSecondary,
        ),
      ),
    );
  }
}

class WeightTrendChart extends StatelessWidget {
  final Color primaryColor;
  final Color gridColor;

  const WeightTrendChart({
    super.key,
    required this.primaryColor,
    required this.gridColor,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 130,
      width: double.infinity,
      child: CustomPaint(
        painter: _WeightTrendPainter(
          primaryColor: primaryColor,
          gridColor: gridColor,
        ),
      ),
    );
  }
}

class _WeightTrendPainter extends CustomPainter {
  final Color primaryColor;
  final Color gridColor;

  _WeightTrendPainter({
    required this.primaryColor,
    required this.gridColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 0.8
      ..style = PaintingStyle.stroke;

    for (int i = 1; i <= 3; i++) {
      final y = size.height * (i / 4.0);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    final points = [
      const Offset(0.0, 0.7),
      const Offset(0.1, 0.65),
      const Offset(0.2, 0.68),
      const Offset(0.3, 0.55),
      const Offset(0.4, 0.58),
      const Offset(0.5, 0.48),
      const Offset(0.6, 0.52),
      const Offset(0.7, 0.42),
      const Offset(0.8, 0.45),
      const Offset(0.9, 0.35),
      const Offset(1.0, 0.30),
    ];

    final avgPath = Path();
    avgPath.moveTo(0, size.height * 0.68);
    avgPath.quadraticBezierTo(
      size.width * 0.5,
      size.height * 0.52,
      size.width,
      size.height * 0.35,
    );
    final avgPaint = Paint()
      ..color = Colors.white24
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;
    canvas.drawPath(avgPath, avgPaint);

    final linePath = Path();
    for (int i = 0; i < points.length; i++) {
      final p = Offset(points[i].dx * size.width, points[i].dy * size.height);
      if (i == 0) {
        linePath.moveTo(p.dx, p.dy);
      } else {
        linePath.lineTo(p.dx, p.dy);
      }
    }

    final linePaint = Paint()
      ..color = primaryColor
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    canvas.drawPath(linePath, linePaint);

    final dotPaint = Paint()..color = primaryColor;
    for (int i = 0; i < points.length; i += 2) {
      final p = Offset(points[i].dx * size.width, points[i].dy * size.height);
      canvas.drawCircle(p, i == points.length - 1 ? 5 : 3, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class StrengthProgressionChart extends StatelessWidget {
  final Color primaryColor;
  final Color barBgColor;

  const StrengthProgressionChart({
    super.key,
    required this.primaryColor,
    required this.barBgColor,
  });

  @override
  Widget build(BuildContext context) {
    final bars = [
      {'val': '80kg', 'pct': 0.5},
      {'val': '85kg', 'pct': 0.6},
      {'val': '90kg', 'pct': 0.7},
      {'val': '95kg', 'pct': 0.8},
      {'val': '100kg', 'pct': 1.0},
    ];

    return SizedBox(
      height: 120,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: bars.map((b) {
          final isMax = b['pct'] == 1.0;
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    b['val'] as String,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: isMax ? FontWeight.bold : FontWeight.normal,
                      color: isMax ? primaryColor : Colors.white54,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    height: 80 * (b['pct'] as double),
                    decoration: BoxDecoration(
                      color: isMax ? primaryColor : barBgColor,
                      borderRadius:
                          const BorderRadius.vertical(top: Radius.circular(4)),
                    ),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
