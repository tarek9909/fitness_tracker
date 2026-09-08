import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// The official PulseForge vector brand logo widget.
///
/// Combines a molten solar athletic hexagon badge, upward apex chevron,
/// and an anvil silhouette forged with a biometric heartbeat pulse line.
class PulseForgeLogo extends StatelessWidget {
  final double size;
  final bool showGlow;
  final bool showWordmark;
  final TextStyle? wordmarkStyle;

  const PulseForgeLogo({
    super.key,
    this.size = 48,
    this.showGlow = true,
    this.showWordmark = false,
    this.wordmarkStyle,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    final iconWidget = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: showGlow
            ? [
                BoxShadow(
                  color: colors.primary.withValues(alpha: colors.isDark ? 0.35 : 0.2),
                  blurRadius: size * 0.35,
                  spreadRadius: size * 0.05,
                  offset: const Offset(0, 2),
                ),
              ]
            : null,
      ),
      child: CustomPaint(
        size: Size(size, size),
        painter: _PulseForgeLogoPainter(
          primaryColor: colors.primary,
          amberColor: colors.amber,
          surfaceColor: colors.surfaceElevated,
          isDark: colors.isDark,
        ),
      ),
    );

    if (!showWordmark) {
      return iconWidget;
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        iconWidget,
        SizedBox(width: size * 0.25),
        RichText(
          text: TextSpan(
            style: wordmarkStyle ??
                TextStyle(
                  fontSize: size * 0.45,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                  color: colors.textPrimary,
                ),
            children: [
              const TextSpan(text: 'PULSE'),
              TextSpan(
                text: 'FORGE',
                style: TextStyle(
                  color: colors.primary,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _PulseForgeLogoPainter extends CustomPainter {
  final Color primaryColor;
  final Color amberColor;
  final Color surfaceColor;
  final bool isDark;

  _PulseForgeLogoPainter({
    required this.primaryColor,
    required this.amberColor,
    required this.surfaceColor,
    required this.isDark,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;

    // 1. Draw Hexagonal Carbon Background Badge
    final hexPath = Path();
    for (int i = 0; i < 6; i++) {
      final angle = (i * 60 - 30) * math.pi / 180;
      final x = center.dx + (radius * 0.94) * math.cos(angle);
      final y = center.dy + (radius * 0.94) * math.sin(angle);
      if (i == 0) {
        hexPath.moveTo(x, y);
      } else {
        hexPath.lineTo(x, y);
      }
    }
    hexPath.close();

    // Dark badge fill
    final badgePaint = Paint()
      ..color = isDark ? const Color(0xFF141318) : const Color(0xFFFFFFFF)
      ..style = PaintingStyle.fill;
    canvas.drawPath(hexPath, badgePaint);

    // Glowing rim border
    final rimShader = LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        amberColor,
        primaryColor,
        primaryColor.withValues(alpha: 0.2),
      ],
    ).createShader(Rect.fromCircle(center: center, radius: radius));

    final rimPaint = Paint()
      ..shader = rimShader
      ..style = PaintingStyle.stroke
      ..strokeWidth = math.max(1.5, size.width * 0.035)
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(hexPath, rimPaint);

    // 2. Upward Apex Chevron
    final chevronPath = Path();
    final topY = center.dy - radius * 0.52;
    final midLeft = Offset(center.dx - radius * 0.42, center.dy - radius * 0.12);
    final midRight = Offset(center.dx + radius * 0.42, center.dy - radius * 0.12);
    final thickness = radius * 0.14;

    chevronPath.moveTo(center.dx, topY);
    chevronPath.lineTo(midRight.dx, midRight.dy);
    chevronPath.lineTo(midRight.dx - thickness * 0.8, midRight.dy + thickness * 0.8);
    chevronPath.lineTo(center.dx, topY + thickness * 1.2);
    chevronPath.lineTo(midLeft.dx + thickness * 0.8, midLeft.dy + thickness * 0.8);
    chevronPath.lineTo(midLeft.dx, midLeft.dy);
    chevronPath.close();

    final chevronPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [amberColor, primaryColor],
      ).createShader(Rect.fromCircle(center: center, radius: radius))
      ..style = PaintingStyle.fill;
    canvas.drawPath(chevronPath, chevronPaint);

    // 3. Anvil Silhouette with Integrated Pulse Waveform
    final anvilPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [primaryColor, amberColor],
      ).createShader(Rect.fromCircle(center: center, radius: radius))
      ..style = PaintingStyle.fill;

    final pulsePath = Path();
    // Pulse wave / anvil deck: starts on left horn, pulses dynamically in center, extends to right horn
    final deckY = center.dy + radius * 0.04;
    final barH = radius * 0.12;

    pulsePath.moveTo(center.dx - radius * 0.50, deckY);
    pulsePath.lineTo(center.dx - radius * 0.18, deckY);
    // Pulse drop
    pulsePath.lineTo(center.dx - radius * 0.12, deckY + radius * 0.16);
    // Pulse spike upward into chevron
    pulsePath.lineTo(center.dx, deckY - radius * 0.30);
    // Pulse spike downward
    pulsePath.lineTo(center.dx + radius * 0.10, deckY + radius * 0.32);
    // Return to deck line
    pulsePath.lineTo(center.dx + radius * 0.18, deckY);
    pulsePath.lineTo(center.dx + radius * 0.50, deckY);
    pulsePath.lineTo(center.dx + radius * 0.50, deckY + barH);
    pulsePath.lineTo(center.dx + radius * 0.22, deckY + barH);
    // Pulse lower contour
    pulsePath.lineTo(center.dx + radius * 0.10, deckY + radius * 0.32 + barH);
    pulsePath.lineTo(center.dx, deckY - radius * 0.30 + barH);
    pulsePath.lineTo(center.dx - radius * 0.12, deckY + radius * 0.16 + barH);
    pulsePath.lineTo(center.dx - radius * 0.22, deckY + barH);
    pulsePath.lineTo(center.dx - radius * 0.50, deckY + barH);
    pulsePath.close();

    canvas.drawPath(pulsePath, anvilPaint);

    // 4. Anvil Base / Plinth
    final baseY = center.dy + radius * 0.44;
    final baseWidth = radius * 0.48;
    final baseRect = RRect.fromRectAndRadius(
      Rect.fromCenter(center: Offset(center.dx, baseY), width: baseWidth, height: radius * 0.12),
      Radius.circular(radius * 0.04),
    );
    canvas.drawRRect(baseRect, anvilPaint);

    // Center anvil waist pillar
    final waistPath = Path()
      ..moveTo(center.dx - radius * 0.16, deckY + barH)
      ..lineTo(center.dx + radius * 0.16, deckY + barH)
      ..lineTo(center.dx + radius * 0.22, baseY - radius * 0.06)
      ..lineTo(center.dx - radius * 0.22, baseY - radius * 0.06)
      ..close();
    canvas.drawPath(waistPath, anvilPaint);
  }

  @override
  bool shouldRepaint(covariant _PulseForgeLogoPainter oldDelegate) {
    return oldDelegate.primaryColor != primaryColor ||
        oldDelegate.amberColor != amberColor ||
        oldDelegate.surfaceColor != surfaceColor ||
        oldDelegate.isDark != isDark;
  }
}
