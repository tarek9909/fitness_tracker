import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../api/api_config.dart';
import '../auth/auth_session.dart';
import '../storage/secure_storage_service.dart';

String generateUuidV4() {
  final rnd = Random.secure();
  final bytes = List<int>.generate(16, (_) => rnd.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}';
}

enum SyncOperationStatus {
  pending,
  inFlight,
  failed,
  authRequired,
}

class SyncOperation {
  final String operationId;
  final String method;
  final String endpoint;
  final Map<String, dynamic> body;
  final DateTime queuedAt;
  SyncOperationStatus status;
  int retryCount;
  DateTime? nextRetryAt;
  String? errorMessage;

  SyncOperation({
    required this.operationId,
    required this.method,
    required this.endpoint,
    required this.body,
    required this.queuedAt,
    this.status = SyncOperationStatus.pending,
    this.retryCount = 0,
    this.nextRetryAt,
    this.errorMessage,
  });

  factory SyncOperation.fromJson(Map<String, dynamic> json) {
    return SyncOperation(
      operationId: json['operationId'] as String,
      method: json['method'] as String,
      endpoint: json['endpoint'] as String,
      body: (json['body'] as Map).cast<String, dynamic>(),
      queuedAt: DateTime.parse(json['queuedAt'] as String),
      status: SyncOperationStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => SyncOperationStatus.pending,
      ),
      retryCount: json['retryCount'] as int? ?? 0,
      nextRetryAt: json['nextRetryAt'] != null
          ? DateTime.tryParse(json['nextRetryAt'] as String)
          : null,
      errorMessage: json['errorMessage'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'operationId': operationId,
        'method': method,
        'endpoint': endpoint,
        'body': body,
        'queuedAt': queuedAt.toIso8601String(),
        'status': status.name,
        'retryCount': retryCount,
        'nextRetryAt': nextRetryAt?.toIso8601String(),
        'errorMessage': errorMessage,
      };
}

/// Durable Sync Coordinator managing offline mutations, network listeners,
/// exponential backoff retries, single-flight refresh, and non-destructive terminal conflict preservation.
class SyncCoordinator extends ChangeNotifier {
  static const String _storageKey = 'pending_sync_operations';

  final SecureStorageService _storage;
  final AuthSession _authSession;
  final http.Client _httpClient;
  final Connectivity _connectivity;

  List<SyncOperation> _operations = [];
  bool _isFlushing = false;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  Completer<bool>? _refreshCompleter;

  SyncCoordinator({
    required SecureStorageService storage,
    required AuthSession authSession,
    http.Client? httpClient,
    Connectivity? connectivity,
  })  : _storage = storage,
        _authSession = authSession,
        _httpClient = httpClient ?? http.Client(),
        _connectivity = connectivity ?? Connectivity();

  List<SyncOperation> get operations => List.unmodifiable(_operations);
  int get pendingCount => _operations
      .where((op) => op.status == SyncOperationStatus.pending)
      .length;
  int get failedCount =>
      _operations.where((op) => op.status == SyncOperationStatus.failed).length;
  int get authRequiredCount => _operations
      .where((op) => op.status == SyncOperationStatus.authRequired)
      .length;
  bool get isFlushing => _isFlushing;

  /// Re-arm operations paused by an expired session after a successful login.
  Future<void> resumeAfterAuthentication() async {
    var resumed = false;
    for (final op in _operations) {
      if (op.status == SyncOperationStatus.authRequired) {
        op.status = SyncOperationStatus.pending;
        op.errorMessage = null;
        op.nextRetryAt = null;
        resumed = true;
      }
    }
    if (!resumed) return;
    await _saveQueue();
    if (!_isFlushing) await flushQueue();
  }

  Future<void> initCoordinator({bool autoFlush = true}) async {
    await _loadQueue();

    // Listen for network connectivity restoration
    try {
      _connectivitySubscription =
          _connectivity.onConnectivityChanged.listen((results) {
        final hasConnection = results.any((r) => r != ConnectivityResult.none);
        if (hasConnection && pendingCount > 0 && !_isFlushing) {
          flushQueue();
        }
      });
    } catch (_) {
      // Ignored if platform does not support connectivity stream (e.g. headless unit tests)
    }

    if (autoFlush && pendingCount > 0) {
      await flushQueue();
    }
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    super.dispose();
  }

  Future<void> _loadQueue() async {
    final raw = await _storage.read(_storageKey);
    if (raw != null && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is List<dynamic>) {
          final loaded = <SyncOperation>[];
          for (final item in decoded) {
            try {
              if (item is Map<String, dynamic>) {
                loaded.add(SyncOperation.fromJson(item));
              } else if (item is Map) {
                loaded
                    .add(SyncOperation.fromJson(item.cast<String, dynamic>()));
              } else {
                throw FormatException(
                    'Queue entry is not a JSON object: $item');
              }
            } catch (itemErr) {
              // Preserve corrupt entries as failed operations instead of dropping them
              loaded.add(SyncOperation(
                operationId: generateUuidV4(),
                method: 'POST',
                endpoint: '/sync/corrupted',
                body: <String, dynamic>{'raw': item.toString()},
                queuedAt: DateTime.now(),
                status: SyncOperationStatus.failed,
                errorMessage: 'Deserialization error: $itemErr',
              ));
            }
          }
          _operations = loaded;
        }
      } catch (e) {
        // If whole json root is corrupt, preserve a failed sync operation with raw text
        _operations = [
          SyncOperation(
            operationId: generateUuidV4(),
            method: 'POST',
            endpoint: '/sync/corrupted-payload',
            body: <String, dynamic>{'rawPayload': raw},
            queuedAt: DateTime.now(),
            status: SyncOperationStatus.failed,
            errorMessage: 'Queue payload deserialization error: $e',
          )
        ];
      }
    } else {
      _operations = [];
    }
    notifyListeners();
  }

  Future<void> _saveQueue() async {
    if (_operations.isEmpty) {
      await _storage.delete(_storageKey);
    } else {
      final serialized =
          jsonEncode(_operations.map((op) => op.toJson()).toList());
      await _storage.write(_storageKey, serialized);
    }
    notifyListeners();
  }

  Future<void> enqueue({
    required String method,
    required String endpoint,
    required Map<String, dynamic> body,
    String? operationId,
    bool autoFlush = false,
  }) async {
    final opId = operationId ?? generateUuidV4();

    // Prevent duplicate enqueue
    if (!_operations.any((op) => op.operationId == opId)) {
      final operation = SyncOperation(
        operationId: opId,
        method: method,
        endpoint: endpoint,
        body: body,
        queuedAt: DateTime.now(),
        status: SyncOperationStatus.pending,
      );
      _operations.add(operation);
      await _saveQueue();
    }

    // Attempt immediate background flush if requested
    if (autoFlush && !_isFlushing) {
      await flushQueue();
    }
  }

  Future<void> retryOperation(String operationId) async {
    final op =
        _operations.firstWhere((item) => item.operationId == operationId);
    op.status = SyncOperationStatus.pending;
    op.retryCount = 0;
    op.nextRetryAt = null;
    op.errorMessage = null;
    await _saveQueue();
    if (!_isFlushing) {
      flushQueue();
    }
  }

  Future<void> discardOperation(String operationId) async {
    _operations.removeWhere((item) => item.operationId == operationId);
    await _saveQueue();
  }

  Future<void> clearQueue() async {
    _operations.clear();
    await _storage.delete(_storageKey);
    notifyListeners();
  }

  Future<void> flushQueue() async {
    if (_isFlushing || _operations.isEmpty) return;
    _isFlushing = true;
    notifyListeners();

    try {
      final now = DateTime.now();
      final baseUrl = ApiConfig.resolveBaseUrl();

      for (int i = 0; i < _operations.length; i++) {
        final op = _operations[i];

        // Only process pending operations whose backoff timer has elapsed
        if (op.status != SyncOperationStatus.pending) continue;
        if (op.nextRetryAt != null && op.nextRetryAt!.isAfter(now)) continue;

        op.status = SyncOperationStatus.inFlight;
        notifyListeners();

        try {
          var response = await _executeHttp(baseUrl, op);

          // Handle 401 Unauthorized via single-flight refresh
          if (response.statusCode == 401) {
            final refreshed = await _refreshAccessTokenSingleFlight(baseUrl);
            if (refreshed) {
              response = await _executeHttp(baseUrl, op);
            } else {
              op.status = SyncOperationStatus.authRequired;
              op.errorMessage =
                  'Authentication expired. Sign in to resume synchronization.';
              await _saveQueue();
              break; // Halt sync until user authenticates
            }
          }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            // Succeeded: remove from queue
            _operations.removeAt(i);
            i--;
            await _saveQueue();
          } else if (response.statusCode == 408 ||
              response.statusCode == 429 ||
              response.statusCode >= 500) {
            // Retryable transient server/rate error: bounded exponential backoff
            _applyBackoff(op, 'Server returned status ${response.statusCode}');
            await _saveQueue();
          } else {
            // Terminal client error (400, 403, 404, 409 conflict): preserve for user action
            String msg = 'Request failed (${response.statusCode})';
            try {
              final decoded = jsonDecode(response.body);
              if (decoded['error']?['message'] != null) {
                msg = decoded['error']['message'];
              }
            } catch (_) {}
            op.status = SyncOperationStatus.failed;
            op.errorMessage = msg;
            await _saveQueue();
          }
        } on SocketException catch (e) {
          _applyBackoff(op, 'Network connection unavailable (${e.message})');
          await _saveQueue();
        } on TimeoutException {
          _applyBackoff(op, 'Request timed out');
          await _saveQueue();
        } on http.ClientException catch (e) {
          _applyBackoff(op, 'Client transport error (${e.message})');
          await _saveQueue();
        } catch (e) {
          _applyBackoff(op, 'Unexpected error: $e');
          await _saveQueue();
        }
      }
    } finally {
      _isFlushing = false;
      notifyListeners();
    }
  }

  void _applyBackoff(SyncOperation op, String reason) {
    op.retryCount += 1;
    // Bounded exponential backoff: 3s, 6s, 12s, 24s, 48s, 96s, 192s, max 300s
    final backoffSeconds =
        min(300, (pow(2, min(op.retryCount, 6)) * 3).toInt());
    op.nextRetryAt = DateTime.now().add(Duration(seconds: backoffSeconds));
    op.status = SyncOperationStatus.pending;
    op.errorMessage = reason;
  }

  Future<http.Response> _executeHttp(String baseUrl, SyncOperation op) async {
    final uri = Uri.parse('$baseUrl${op.endpoint}');
    final token = _authSession.accessToken;

    final headers = <String, String>{
      'Content-Type': 'application/json',
      'X-Client-Type': 'mobile',
      if (token != null) 'Authorization': 'Bearer $token',
      'Idempotency-Key': op.operationId,
      'X-Idempotency-Key': op.operationId,
    };
    final payload = jsonEncode(op.body);

    switch (op.method.toUpperCase()) {
      case 'POST':
        return await _httpClient
            .post(uri, headers: headers, body: payload)
            .timeout(const Duration(seconds: 15));
      case 'PUT':
        return await _httpClient
            .put(uri, headers: headers, body: payload)
            .timeout(const Duration(seconds: 15));
      case 'PATCH':
        return await _httpClient
            .patch(uri, headers: headers, body: payload)
            .timeout(const Duration(seconds: 15));
      case 'DELETE':
        return await _httpClient
            .delete(uri, headers: headers)
            .timeout(const Duration(seconds: 15));
      default:
        return await _httpClient
            .get(uri, headers: headers)
            .timeout(const Duration(seconds: 15));
    }
  }

  Future<bool> _refreshAccessTokenSingleFlight(String baseUrl) async {
    if (_refreshCompleter != null) {
      return _refreshCompleter!.future;
    }

    final completer = Completer<bool>();
    _refreshCompleter = completer;

    try {
      final refreshToken = _authSession.refreshToken;
      if (refreshToken == null) {
        completer.complete(false);
        return false;
      }

      final uri = Uri.parse('$baseUrl/auth/refresh');
      final res = await _httpClient
          .post(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'X-Client-Type': 'mobile',
            },
            body: jsonEncode(
                {'refreshToken': refreshToken, 'clientType': 'mobile'}),
          )
          .timeout(const Duration(seconds: 15));

      final decoded = jsonDecode(res.body);
      if (res.statusCode >= 200 &&
          res.statusCode < 300 &&
          decoded['data']?['accessToken'] != null) {
        await _authSession.updateTokens(
          accessToken: decoded['data']['accessToken'],
          refreshToken: decoded['data']['refreshToken'] ?? refreshToken,
        );
        completer.complete(true);
        return true;
      } else {
        await _authSession.clearSession();
        completer.complete(false);
        return false;
      }
    } catch (_) {
      completer.complete(false);
      return false;
    } finally {
      _refreshCompleter = null;
    }
  }
}
