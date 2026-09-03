import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/theme/app_theme.dart';
import 'package:fitness_mobile_app/core/theme/theme_controller.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ThemeController & AppTheme Dual-Theme Suite', () {
    test('ThemeController defaults to dark theme and updates mode', () async {
      final storage = InMemorySecureStorageService();
      final controller = ThemeController(storage: storage);
      expect(controller.themeMode, equals(ThemeMode.dark));

      bool notified = false;
      controller.addListener(() => notified = true);

      await controller.setThemeMode(ThemeMode.light);
      expect(controller.themeMode, equals(ThemeMode.light));
      expect(notified, isTrue);

      final saved = await storage.read('app_theme_mode');
      expect(saved, equals('light'));
    });

    test('ThemeController restores persisted theme mode from storage', () async {
      final storage = InMemorySecureStorageService();
      await storage.write('app_theme_mode', 'light');

      final controller = ThemeController(storage: storage);
      await controller.init();

      expect(controller.themeMode, equals(ThemeMode.light));
    });

    testWidgets('AppThemeColors dynamically resolves Light and Dark palette',
        (WidgetTester tester) async {
      late AppThemeColors darkColors;
      late AppThemeColors lightColors;

      await tester.pumpWidget(
        MaterialApp(
          key: const ValueKey('dark_app'),
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: ThemeMode.dark,
          home: Builder(
            builder: (context) {
              darkColors = AppThemeColors.of(context);
              return const SizedBox();
            },
          ),
        ),
      );

      expect(darkColors.isDark, isTrue);
      expect(darkColors.background, equals(AppColors.background));
      expect(darkColors.textPrimary, equals(AppColors.textPrimary));

      await tester.pumpWidget(
        MaterialApp(
          key: const ValueKey('light_app'),
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: ThemeMode.light,
          home: Builder(
            builder: (context) {
              lightColors = AppThemeColors.of(context);
              return const SizedBox();
            },
          ),
        ),
      );

      expect(lightColors.isDark, isFalse);
      expect(lightColors.background, equals(AppColors.lightBackground));
      expect(lightColors.textPrimary, equals(AppColors.lightTextPrimary));
      expect(lightColors.card, equals(AppColors.lightCard));
    });
  });
}
