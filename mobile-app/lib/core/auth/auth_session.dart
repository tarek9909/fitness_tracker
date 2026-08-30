import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../models/models.dart';
import '../storage/secure_storage_service.dart';

/// Secure AuthSession managing hardware-encrypted token and user state.
/// Zero storage of credentials in unencrypted SharedPreferences.
class AuthSession extends ChangeNotifier {
  final SecureStorageService _storage;

  String? _accessToken;
  String? _refreshToken;
  UserModel? _currentUser;
  bool _isLoading = true;

  AuthSession({SecureStorageService? storage})
      : _storage = storage ?? FlutterSecureStorageService();

  String? get accessToken => _accessToken;
  String? get refreshToken => _refreshToken;
  UserModel? get currentUser => _currentUser;
  bool get isAuthenticated => _accessToken != null && _currentUser != null;
  bool get isLoading => _isLoading;
  SecureStorageService get storage => _storage;

  Future<void> initSession() async {
    _accessToken = await _storage.read('access_token');
    _refreshToken = await _storage.read('refresh_token');
    final userJson = await _storage.read('current_user');

    if (_accessToken != null && userJson != null) {
      try {
        _currentUser = UserModel.fromJson(jsonDecode(userJson));
      } catch (_) {
        await clearSession();
      }
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<void> saveSession({
    required String accessToken,
    required String refreshToken,
    required Map<String, dynamic> userJson,
  }) async {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    _currentUser = UserModel.fromJson(userJson);

    await _storage.write('access_token', accessToken);
    await _storage.write('refresh_token', refreshToken);
    await _storage.write('current_user', jsonEncode(userJson));

    notifyListeners();
  }

  Future<void> clearSession() async {
    _accessToken = null;
    _refreshToken = null;
    _currentUser = null;

    await _storage.delete('access_token');
    await _storage.delete('refresh_token');
    await _storage.delete('current_user');

    notifyListeners();
  }

  Future<void> updateTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    await _storage.write('access_token', accessToken);
    await _storage.write('refresh_token', refreshToken);
    notifyListeners();
  }

  Future<void> updateProfile(Map<String, dynamic> userJson) async {
    _currentUser = UserModel.fromJson(userJson);
    await _storage.write('current_user', jsonEncode(userJson));
    notifyListeners();
  }
}
