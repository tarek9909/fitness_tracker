import 'package:flutter/material.dart';

/// Static and baseline design tokens for the PulseForge mobile app.
///
/// Design Direction:
/// "Dark monochrome architectural with restrained neon accents."
///
/// Principles:
/// 1. Monochrome foundation dominates the interface (Obsidian, Charcoal, Zinc, Titanium).
/// 2. White / Titanium for primary actions and important values.
/// 3. Zinc / Graphite for secondary text, borders, dividers, and inactive states.
/// 4. Soft emerald, cyan, violet, amber, and rose ONLY as functional accent colors.
/// 5. Minimal glow, sharp compact geometry, strong typography, high information density.
/// 6. Large, highly readable numbers and architectural 1px gridline borders.
/// 7. Colors guide attention and communicate meaning, never used to decorate.
///
/// Strict Prohibitions:
/// - No large neon backgrounds
/// - Never make every card colorful
/// - No excessive gradients
/// - No RGB / gaming aesthetics or heavy outer glows
/// - No colorful illustrations
///
/// High-end athletic performance system aesthetic.
class AppColors {
  // Dark Palette (Solar Lava - Carbon & Molten Flame)
  static const Color background = Color(0xFF0D0D11); // Deep Carbon Smoke Canvas
  static const Color surface = Color(0xFF15151B); // Dark Vulcanite Slate
  static const Color surfaceElevated = Color(0xFF1D1D26); // Form fields, elevated cards
  static const Color card = Color(0xFF15151B); // Architectural containers
  static const Color cardHover = Color(0xFF22222E);
  static const Color border = Color(0xFF2B2220); // Warm Hairline Border
  static const Color borderHover = Color(0xFF4A342B); // Heated Copper Accent

  // Primary Action Tokens (Molten Solar Lava)
  static const Color primary = Color(0xFFFF5500); // Radiant Molten Orange
  static const Color primaryDark = Color(0xFFE04500); // Deep Flame
  static const Color primaryMuted = Color(0x26FF5500); // 15% Molten Wash
  static const Color primaryGlow = Color(0x33FF5500); // Radiant Warm Ambient Glow
  static const Color onPrimary = Color(0xFFFFFFFF); // Stark high-contrast white on molten orange

  // Soft Premium Accent Color Tokens (Dark Mode)
  static const Color emerald = Color(0xFF10B981); // Mint Vitality
  static const Color emeraldMuted = Color(0x2610B981);

  static const Color cyan = Color(0xFF38BDF8); // Cool Recovery Cyan
  static const Color cyanMuted = Color(0x2638BDF8);

  static const Color violet = Color(0xFFA78BFA); // Soft Lavender
  static const Color violetMuted = Color(0x26A78BFA);

  static const Color amber = Color(0xFFF59E0B); // Golden Solar Amber
  static const Color amberMuted = Color(0x26F59E0B);

  static const Color rose = Color(0xFFEF4444); // Crimson Flame / Heat Zone
  static const Color roseMuted = Color(0x26EF4444);

  // Dark Typography Tokens (Austere high-contrast architectural hierarchy)
  static const Color textPrimary = Color(0xFFFAFAFA);
  static const Color textSecondary = Color(0xFFA39E9B);
  static const Color textMuted = Color(0xFF736D6B);

  // Light Palette (Solar Daylight - Warm Porcelain & Heated Terracotta)
  static const Color lightBackground = Color(0xFFF9F8F6); // Crisp Warm Porcelain Canvas
  static const Color lightSurface = Color(0xFFFFFFFF); // Stark White Planar Surface
  static const Color lightSurfaceElevated = Color(0xFFF3EFE9); // Pale Warm Slate
  static const Color lightCard = Color(0xFFFFFFFF);
  static const Color lightCardHover = Color(0xFFFAF8F5);
  static const Color lightBorder = Color(0xFFE8E2D9); // Precision Warm Hairline
  static const Color lightBorderHover = Color(0xFFD47036); // Heated Terracotta Accent

  static const Color lightPrimary = Color(0xFFEA580C); // Terracotta Molten Orange
  static const Color lightPrimaryDark = Color(0xFFC2410C);
  static const Color lightPrimaryMuted = Color(0x1AEA580C); // Warm Orange Wash
  static const Color lightPrimaryGlow = Color(0x20EA580C);
  static const Color lightOnPrimary = Color(0xFFFFFFFF); // Crisp White on Terracotta

  // Soft Premium Accent Color Tokens (Light Mode - Pastel Washes & Soft Accents)
  static const Color lightEmerald = Color(0xFF059669); // Deep Mint
  static const Color lightEmeraldMuted = Color(0xFFECFDF5);

  static const Color lightCyan = Color(0xFF0284C7); // Sky Cyan
  static const Color lightCyanMuted = Color(0xFFF0F9FF);

  static const Color lightViolet = Color(0xFF7C3AED); // Royal Lavender
  static const Color lightVioletMuted = Color(0xFFF5F3FF);

  static const Color lightAmber = Color(0xFFD97706); // Golden Amber
  static const Color lightAmberMuted = Color(0xFFFFFBEB);

  static const Color lightRose = Color(0xFFE11D48); // Coral Rose
  static const Color lightRoseMuted = Color(0xFFFFF1F2);

  static const Color lightTextPrimary = Color(0xFF1C1917); // Warm Espresso Ink
  static const Color lightTextSecondary = Color(0xFF57534E);
  static const Color lightTextMuted = Color(0xFF8E8883);
}

/// Dynamic contextual theme colors that resolve seamlessly according to Brightness
class AppThemeColors {
  final Brightness brightness;

  const AppThemeColors(this.brightness);

  bool get isDark => brightness == Brightness.dark;

  static AppThemeColors of(BuildContext context) {
    final b = Theme.of(context).brightness;
    return AppThemeColors(b);
  }

  Color get background => isDark ? AppColors.background : AppColors.lightBackground;
  Color get surface => isDark ? AppColors.surface : AppColors.lightSurface;
  Color get surfaceElevated => isDark ? AppColors.surfaceElevated : AppColors.lightSurfaceElevated;
  Color get card => isDark ? AppColors.card : AppColors.lightCard;
  Color get cardHover => isDark ? AppColors.cardHover : AppColors.lightCardHover;
  Color get border => isDark ? AppColors.border : AppColors.lightBorder;
  Color get borderHover => isDark ? AppColors.borderHover : AppColors.lightBorderHover;

  Color get primary => isDark ? AppColors.primary : AppColors.lightPrimary;
  Color get primaryDark => isDark ? AppColors.primaryDark : AppColors.lightPrimaryDark;
  Color get primaryMuted => isDark ? AppColors.primaryMuted : AppColors.lightPrimaryMuted;
  Color get primaryGlow => isDark ? AppColors.primaryGlow : AppColors.lightPrimaryGlow;
  Color get onPrimary => isDark ? AppColors.onPrimary : AppColors.lightOnPrimary;

  Color get emerald => isDark ? AppColors.emerald : AppColors.lightEmerald;
  Color get emeraldMuted => isDark ? AppColors.emeraldMuted : AppColors.lightEmeraldMuted;

  Color get cyan => isDark ? AppColors.cyan : AppColors.lightCyan;
  Color get cyanMuted => isDark ? AppColors.cyanMuted : AppColors.lightCyanMuted;

  Color get violet => isDark ? AppColors.violet : AppColors.lightViolet;
  Color get violetMuted => isDark ? AppColors.violetMuted : AppColors.lightVioletMuted;

  Color get amber => isDark ? AppColors.amber : AppColors.lightAmber;
  Color get amberMuted => isDark ? AppColors.amberMuted : AppColors.lightAmberMuted;

  Color get rose => isDark ? AppColors.rose : AppColors.lightRose;
  Color get roseMuted => isDark ? AppColors.roseMuted : AppColors.lightRoseMuted;

  Color get textPrimary => isDark ? AppColors.textPrimary : AppColors.lightTextPrimary;
  Color get textSecondary => isDark ? AppColors.textSecondary : AppColors.lightTextSecondary;
  Color get textMuted => isDark ? AppColors.textMuted : AppColors.lightTextMuted;

  List<BoxShadow> get cardShadow => isDark
      ? const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 16,
            offset: Offset(0, 4),
          ),
        ]
      : const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 2,
            offset: Offset(0, 1),
          ),
        ];
}

class AppSpacing {
  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 16.0;
  static const double lg = 24.0;
  static const double xl = 32.0;
}

class AppRadii {
  static const double xs = 2.0;
  static const double sm = 4.0;
  static const double md = 6.0;
  static const double lg = 8.0;
  static const double xl = 10.0;
  static const double full = 999.0;
}

class AppTheme {
  /// Dark Theme Definition (Monochrome Architectural)
  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.background,
      fontFamily: 'Inter',
      colorScheme: const ColorScheme.dark(
        primary: AppColors.primary,
        onPrimary: AppColors.onPrimary,
        surface: AppColors.surface,
        onSurface: AppColors.textPrimary,
        error: AppColors.rose,
        onError: Colors.white,
      ),
      cardTheme: CardThemeData(
        color: AppColors.card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.lg),
          side: const BorderSide(color: AppColors.border, width: 1.0),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.3,
        ),
        iconTheme: IconThemeData(color: AppColors.textPrimary),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.onPrimary,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, letterSpacing: 0.2),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textPrimary,
          side: const BorderSide(color: AppColors.border, width: 1.0),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.textPrimary,
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceElevated,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: const BorderSide(color: AppColors.border, width: 1.0),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: const BorderSide(color: AppColors.border, width: 1.0),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: const BorderSide(color: AppColors.rose, width: 1.0),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: const BorderSide(color: AppColors.rose, width: 1.2),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 14),
        labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      tabBarTheme: const TabBarThemeData(
        labelColor: AppColors.primary,
        unselectedLabelColor: AppColors.textMuted,
        indicatorColor: AppColors.primary,
        dividerColor: Colors.transparent,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.card,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.lg),
          side: const BorderSide(color: AppColors.border, width: 1.0),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.card,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: AppColors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.lg)),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.border,
        thickness: 1.0,
        space: 1.0,
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: SmoothSlidePageTransitionsBuilder(),
          TargetPlatform.iOS: SmoothSlidePageTransitionsBuilder(),
          TargetPlatform.windows: SmoothSlidePageTransitionsBuilder(),
          TargetPlatform.macOS: SmoothSlidePageTransitionsBuilder(),
          TargetPlatform.linux: SmoothSlidePageTransitionsBuilder(),
        },
      ),
    );
  }

  /// Light Theme Definition (Solar Lava Daylight)
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.lightBackground,
      colorScheme: const ColorScheme.light(
        primary: AppColors.lightPrimary,
        onPrimary: AppColors.lightOnPrimary,
        surface: AppColors.lightSurface,
        onSurface: AppColors.lightTextPrimary,
        error: AppColors.lightRose,
        onError: Colors.white,
      ),
      cardTheme: CardThemeData(
        color: AppColors.lightCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.lg),
          side: const BorderSide(color: AppColors.lightBorder, width: 1.0),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.lightBackground,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: AppColors.lightTextPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.3,
        ),
        iconTheme: IconThemeData(color: AppColors.lightTextPrimary),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.lightPrimary,
          foregroundColor: AppColors.lightOnPrimary,
          elevation: 0,
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, letterSpacing: 0.2),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.lightTextPrimary,
          side: const BorderSide(color: AppColors.lightBorder, width: 1.0),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.lightTextPrimary,
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.lightSurface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: const BorderSide(color: AppColors.lightBorder, width: 1.0),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: const BorderSide(color: AppColors.lightBorder, width: 1.0),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: const BorderSide(color: AppColors.lightPrimary, width: 1.2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: const BorderSide(color: AppColors.lightRose, width: 1.0),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: const BorderSide(color: AppColors.lightRose, width: 1.2),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: const TextStyle(color: AppColors.lightTextMuted, fontSize: 14),
        labelStyle: const TextStyle(color: AppColors.lightTextSecondary, fontSize: 14),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.lightSurface,
        selectedItemColor: AppColors.lightPrimary,
        unselectedItemColor: AppColors.lightTextMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      tabBarTheme: const TabBarThemeData(
        labelColor: AppColors.lightPrimary,
        unselectedLabelColor: AppColors.lightTextMuted,
        indicatorColor: AppColors.lightPrimary,
        dividerColor: Colors.transparent,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.lightCard,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.lg),
          side: const BorderSide(color: AppColors.lightBorder, width: 1.0),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.lightCard,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: AppColors.lightCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.lg)),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.lightBorder,
        thickness: 1.0,
        space: 1.0,
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: SmoothSlidePageTransitionsBuilder(),
          TargetPlatform.iOS: SmoothSlidePageTransitionsBuilder(),
          TargetPlatform.windows: SmoothSlidePageTransitionsBuilder(),
          TargetPlatform.macOS: SmoothSlidePageTransitionsBuilder(),
          TargetPlatform.linux: SmoothSlidePageTransitionsBuilder(),
        },
      ),
    );
  }
}

/// Hardware-accelerated, buttery smooth page transition builder with subtle slide and cubic easing
class SmoothSlidePageTransitionsBuilder extends PageTransitionsBuilder {
  const SmoothSlidePageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final curvedAnimation = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    );

    return SlideTransition(
      position: Tween<Offset>(
        begin: const Offset(0.06, 0.0),
        end: Offset.zero,
      ).animate(curvedAnimation),
      child: FadeTransition(
        opacity: curvedAnimation,
        child: child,
      ),
    );
  }
}
