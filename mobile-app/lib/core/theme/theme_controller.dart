import 'package:flutter/material.dart';
import '../storage/secure_storage_service.dart';

/// Manages and persists application theme mode (System, Light, Dark).
class ThemeController extends ChangeNotifier {
  static const String _storageKey = 'app_theme_mode';
  final SecureStorageService? _storage;
  ThemeMode _themeMode;

  ThemeController({
    SecureStorageService? storage,
    ThemeMode initialMode = ThemeMode.dark,
  })  : _storage = storage,
        _themeMode = initialMode;

  ThemeMode get themeMode => _themeMode;

  bool isDarkMode(BuildContext context) {
    if (_themeMode == ThemeMode.dark) return true;
    if (_themeMode == ThemeMode.light) return false;
    return MediaQuery.platformBrightnessOf(context) == Brightness.dark;
  }

  /// Initialize theme mode from persistent secure storage
  Future<void> init() async {
    if (_storage == null) return;
    try {
      final saved = await _storage!.read(_storageKey);
      if (saved == 'light') {
        _themeMode = ThemeMode.light;
      } else if (saved == 'dark') {
        _themeMode = ThemeMode.dark;
      } else if (saved == 'system') {
        _themeMode = ThemeMode.system;
      }
      notifyListeners();
    } catch (_) {
      // Fallback to initialMode if read fails
    }
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    if (_themeMode == mode) return;
    _themeMode = mode;
    notifyListeners();
    if (_storage != null) {
      try {
        final val = mode == ThemeMode.light
            ? 'light'
            : (mode == ThemeMode.dark ? 'dark' : 'system');
        await _storage!.write(_storageKey, val);
      } catch (_) {}
    }
  }
}
