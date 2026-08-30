import 'dart:convert';

import 'secure_storage_service.dart';

/// Encrypted, small-payload cache for read-only API responses.
///
/// This is deliberately separate from the mutation queue: cached records are
/// disposable and are never treated as authoritative when the API is online.
class LocalCache {
  final SecureStorageService _storage;

  const LocalCache(this._storage);

  Future<dynamic> readJson(String key) async {
    final raw = await _storage.read(key);
    if (raw == null || raw.isEmpty) return null;
    try {
      return jsonDecode(raw);
    } catch (_) {
      await _storage.delete(key);
      return null;
    }
  }

  Future<void> writeJson(String key, dynamic value) async {
    await _storage.write(key, jsonEncode(value));
  }

  Future<void> delete(String key) => _storage.delete(key);
}
