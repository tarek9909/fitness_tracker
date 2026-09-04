import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../auth/auth_session.dart';
import '../sync/sync_coordinator.dart';
import 'api_config.dart';

class OfflineOperationQueued implements Exception {
  final String operationId;
  OfflineOperationQueued(this.operationId);

  @override
  String toString() => 'Operation queued for synchronization: $operationId';
}

/// Release-ready Mobile API Client integrating secure authentication,
/// single-flight token refresh, idempotency headers, and durable offline sync coordination.
class ApiClient {
  final AuthSession authSession;
  final SyncCoordinator syncCoordinator;
  final http.Client _httpClient;
  void Function()? onTokenRefreshed;

  Completer<bool>? _refreshCompleter;

  ApiClient({
    required this.authSession,
    required this.syncCoordinator,
    http.Client? httpClient,
    this.onTokenRefreshed,
  }) : _httpClient = httpClient ?? http.Client();

  Future<dynamic> get(String endpoint) async => _request('GET', endpoint);

  Future<dynamic> post(String endpoint, {Map<String, dynamic>? body}) async =>
      _request('POST', endpoint, body: body);

  Future<dynamic> put(String endpoint, {Map<String, dynamic>? body}) async =>
      _request('PUT', endpoint, body: body);

  Future<dynamic> patch(String endpoint, {Map<String, dynamic>? body}) async =>
      _request('PATCH', endpoint, body: body);

  Future<dynamic> delete(String endpoint) async => _request('DELETE', endpoint);

  Future<dynamic> _request(
    String method,
    String endpoint, {
    Map<String, dynamic>? body,
    bool canRefresh = true,
  }) async {
    final isMutation = method == 'POST' || method == 'PUT' || method == 'PATCH';
    final isSecuritySensitive = endpoint.contains('/security/') ||
        endpoint.contains('/auth/') ||
        endpoint.contains('/password-reset');
    final canEnqueue = isMutation && !isSecuritySensitive;
    // Empty-body mutations still need an operation id for safe retries.
    final requestBody = body == null && isMutation
        ? <String, dynamic>{}
        : body == null
            ? null
            : Map<String, dynamic>.from(body);
    final operationId = canEnqueue
        ? (requestBody?['clientOperationId'] as String? ?? _newOperationId())
        : null;
    if (operationId != null) requestBody!['clientOperationId'] = operationId;

    try {
      final response = await _sendRequest(method, endpoint, requestBody)
          .timeout(const Duration(seconds: 15));

      if (response.statusCode == 401 &&
          canRefresh &&
          !endpoint.endsWith('/auth/refresh') &&
          !endpoint.endsWith('/auth/login')) {
        final refreshed = await _refreshAccessTokenSingleFlight();
        if (refreshed) {
          return _request(method, endpoint,
              body: requestBody, canRefresh: false);
        }
      }

      return _decodeResponse(response);
    } on TimeoutException {
      if (operationId != null) {
        await syncCoordinator.enqueue(
          method: method,
          endpoint: endpoint,
          body: requestBody!,
          operationId: operationId,
        );
        throw OfflineOperationQueued(operationId);
      }
      rethrow;
    } on SocketException {
      if (operationId != null) {
        await syncCoordinator.enqueue(
          method: method,
          endpoint: endpoint,
          body: requestBody!,
          operationId: operationId,
        );
        throw OfflineOperationQueued(operationId);
      }
      rethrow;
    } on HttpException {
      if (operationId != null) {
        await syncCoordinator.enqueue(
          method: method,
          endpoint: endpoint,
          body: requestBody!,
          operationId: operationId,
        );
        throw OfflineOperationQueued(operationId);
      }
      rethrow;
    } on http.ClientException {
      if (operationId != null) {
        await syncCoordinator.enqueue(
          method: method,
          endpoint: endpoint,
          body: requestBody!,
          operationId: operationId,
        );
        throw OfflineOperationQueued(operationId);
      }
      rethrow;
    }
  }

  Future<http.Response> _sendRequest(
    String method,
    String endpoint,
    Map<String, dynamic>? body,
  ) async {
    final candidateUrls = ApiConfig.getCandidateBaseUrls();
    final cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/$endpoint';
    final token = authSession.accessToken;
    final opId = body?['clientOperationId'] as String?;

    final headers = <String, String>{
      'Content-Type': 'application/json',
      'X-Client-Type': 'mobile',
      if (token != null) 'Authorization': 'Bearer $token',
      if (opId != null) 'Idempotency-Key': opId,
      if (opId != null) 'X-Idempotency-Key': opId,
    };
    final payload = body == null ? null : jsonEncode(body);

    dynamic lastException;

    for (int i = 0; i < candidateUrls.length; i++) {
      final baseUrl = candidateUrls[i];
      final cleanBase = baseUrl.endsWith('/')
          ? baseUrl.substring(0, baseUrl.length - 1)
          : baseUrl;
      final uri = Uri.parse('$cleanBase$cleanEndpoint');

      try {
        final timeoutDuration =
            candidateUrls.length > 1 && i < candidateUrls.length - 1
                ? const Duration(seconds: 3)
                : const Duration(seconds: 15);

        final Future<http.Response> requestFuture;
        switch (method.toUpperCase()) {
          case 'POST':
            requestFuture =
                _httpClient.post(uri, headers: headers, body: payload);
            break;
          case 'PUT':
            requestFuture =
                _httpClient.put(uri, headers: headers, body: payload);
            break;
          case 'PATCH':
            requestFuture =
                _httpClient.patch(uri, headers: headers, body: payload);
            break;
          case 'DELETE':
            requestFuture = _httpClient.delete(uri, headers: headers);
            break;
          default:
            requestFuture = _httpClient.get(uri, headers: headers);
            break;
        }

        final response = await requestFuture.timeout(timeoutDuration);
        ApiConfig.setActiveWorkingBaseUrl(baseUrl);
        return response;
      } catch (e) {
        lastException = e;
        if (baseUrl == ApiConfig.getActiveWorkingBaseUrl()) {
          ApiConfig.resetActiveWorkingBaseUrl();
        }
        if (i == candidateUrls.length - 1) {
          rethrow;
        }
      }
    }

    if (lastException != null) {
      throw lastException;
    }
    throw const SocketException(
        'Unable to reach backend API on any candidate address');
  }

  dynamic _decodeResponse(http.Response response) {
    final decoded =
        response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (decoded is Map<String, dynamic> && decoded.containsKey('data')) {
        return decoded['data'];
      }
      return decoded;
    }

    String errorMsg = 'Request failed (${response.statusCode})';
    if (decoded is Map) {
      if (decoded['error'] is Map && decoded['error']['message'] != null) {
        errorMsg = decoded['error']['message'].toString();
      } else if (decoded['message'] != null) {
        errorMsg = decoded['message'].toString();
      } else if (decoded['error'] != null) {
        errorMsg = decoded['error'].toString();
      }
    }
    throw Exception(errorMsg);
  }

  Future<bool> _refreshAccessTokenSingleFlight() async {
    if (_refreshCompleter != null) {
      return _refreshCompleter!.future;
    }

    final completer = Completer<bool>();
    _refreshCompleter = completer;

    try {
      final success = await _doRefreshAccessToken();
      completer.complete(success);
      return success;
    } catch (_) {
      completer.complete(false);
      return false;
    } finally {
      _refreshCompleter = null;
    }
  }

  Future<bool> _doRefreshAccessToken() async {
    final refreshToken = authSession.refreshToken;
    if (refreshToken == null) return false;
    try {
      final baseUrl = ApiConfig.resolveBaseUrl();
      final cleanBase = baseUrl.endsWith('/')
          ? baseUrl.substring(0, baseUrl.length - 1)
          : baseUrl;
      final uri = Uri.parse('$cleanBase/auth/refresh');
      final response = await _httpClient
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

      final decoded = jsonDecode(response.body);
      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          decoded['data'] == null) {
        throw Exception('Refresh failed');
      }

      await authSession.updateTokens(
        accessToken: decoded['data']['accessToken'],
        refreshToken: decoded['data']['refreshToken'] ?? refreshToken,
      );
      onTokenRefreshed?.call();
      return true;
    } catch (_) {
      await authSession.clearSession();
      return false;
    }
  }

  String _newOperationId() => generateUuidV4();
}
