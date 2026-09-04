import 'package:flutter/material.dart';

/// Static and baseline Design Tokens for the Fitness OS Mobile App.
/// Pure Monochrome Architectural Design System.
class AppColors {
  // Dark Palette (Monochrome Architectural - Obsidian & Titanium)
  static const Color background = Color(0xFF0A0A0B); // Deep Obsidian Canvas
  static const Color surface = Color(0xFF141416); // Structural Charcoal Surface
  static const Color surfaceElevated = Color(0xFF1C1C1F); // Form fields, elevated cards
  static const Color card = Color(0xFF141416); // Architectural containers
  static const Color cardHover = Color(0xFF222226);
  static const Color border = Color(0xFF26262A); // Single 1px crisp architectural hairline
  static const Color borderHover = Color(0xFF3F3F46);

  // Primary Action Tokens (Pure Titanium White on Obsidian)
  static const Color primary = Color(0xFFFFFFFF); // Pure Titanium White
  static const Color primaryDark = Color(0xFFE4E4E7);
  static const Color primaryMuted = Color(0x1AFFFFFF); // 10% White tint
  static const Color primaryGlow = Color(0x0DFFFFFF); // Subtle pure ambient glow
  static const Color onPrimary = Color(0xFF0A0A0B); // Stark high-contrast black on white

  // Soft Premium Accent Color Tokens (Dark Mode)
  static const Color emerald = Color(0xFF34D399); // Soft Mint / Emerald
  static const Color emeraldMuted = Color(0x2634D399);

  static const Color cyan = Color(0xFF38BDF8); // Soft Sky Cyan
  static const Color cyanMuted = Color(0x2638BDF8);

  static const Color violet = Color(0xFFA78BFA); // Soft Lavender
  static const Color violetMuted = Color(0x26A78BFA);

  static const Color amber = Color(0xFFFBBF24); // Soft Warm Amber
  static const Color amberMuted = Color(0x26FBBF24);

  static const Color rose = Color(0xFFFB7185); // Soft Warm Rose / Coral
  static const Color roseMuted = Color(0x26FB7185);

  // Dark Typography Tokens (Austere high-contrast architectural hierarchy)
  static const Color textPrimary = Color(0xFFFAFAFA);
  static const Color textSecondary = Color(0xFFA1A1AA);
  static const Color textMuted = Color(0xFF71717A);

  // Light Palette (Monochrome Architectural - Concrete & Ink)
  static const Color lightBackground = Color(0xFFF4F4F6); // Crisp Architectural Stone Canvas
  static const Color lightSurface = Color(0xFFFFFFFF); // Stark White Planar Surface
  static const Color lightSurfaceElevated = Color(0xFFECECEE); // Pale Slate Elevated
  static const Color lightCard = Color(0xFFFFFFFF);
  static const Color lightCardHover = Color(0xFFFAFAFA);
  static const Color lightBorder = Color(0xFFE2E2E5); // 1px Precision Hairline Gridline
  static const Color lightBorderHover = Color(0xFF18181B);

  static const Color lightPrimary = Color(0xFF09090B); // Architectural Pitch Black
  static const Color lightPrimaryDark = Color(0xFF18181B);
  static const Color lightPrimaryMuted = Color(0x0D09090B);
  static const Color lightOnPrimary = Color(0xFFFFFFFF); // Crisp White on Black

  // Soft Premium Accent Color Tokens (Light Mode - Pastel Washes & Soft Accents)
  static const Color lightEmerald = Color(0xFF059669); // Soft Deep Mint
  static const Color lightEmeraldMuted = Color(0xFFECFDF5); // Soft Mint Pastel Wash

  static const Color lightCyan = Color(0xFF0284C7); // Soft Sky Blue
  static const Color lightCyanMuted = Color(0xFFF0F9FF); // Soft Sky Wash

  static const Color lightViolet = Color(0xFF7C3AED); // Soft Royal Lavender
  static const Color lightVioletMuted = Color(0xFFF5F3FF); // Soft Lavender Wash

  static const Color lightAmber = Color(0xFFD97706); // Soft Golden Amber
  static const Color lightAmberMuted = Color(0xFFFFFBEB); // Soft Amber Wash

  static const Color lightRose = Color(0xFFE11D48); // Soft Coral Rose
  static const Color lightRoseMuted = Color(0xFFFFF1F2); // Soft Rose Wash

  static const Color lightTextPrimary = Color(0xFF09090B); // Stark Ink Black
  static const Color lightTextSecondary = Color(0xFF52525B);
  static const Color lightTextMuted = Color(0xFF8C8C94);
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
  Color get primaryMuted => isDark ? AppColors.primaryMuted : AppColors.lightPrimaryMuted;
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
        onError: Colors.black,
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
            side: const BorderSide(color: AppColors.border, width: 1.0),
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
        labelColor: AppColors.textPrimary,
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

  /// Light Theme Definition (Monochrome Architectural)
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
            side: const BorderSide(color: AppColors.lightBorder, width: 1.0),
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
        selectedItemColor: AppColors.lightTextPrimary,
        unselectedItemColor: AppColors.lightTextMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      tabBarTheme: const TabBarThemeData(
        labelColor: AppColors.lightTextPrimary,
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
