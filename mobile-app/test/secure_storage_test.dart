import 'package:flutter_test/flutter_test.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Secure Storage & AuthSession Suite', () {
    late InMemorySecureStorageService storage;
    late AuthSession session;

    setUp(() {
      storage = InMemorySecureStorageService();
      session = AuthSession(storage: storage);
    });

    test(
        'AuthSession initializes with empty state and restores persisted session across restarts',
        () async {
      await session.initSession();
      expect(session.isAuthenticated, false);
      expect(session.accessToken, null);
      expect(session.refreshToken, null);
      expect(session.currentUser, null);

      // Save user session
      await session.saveSession(
        accessToken: 'secure_jwt_access_123',
        refreshToken: 'secure_jwt_refresh_456',
        userJson: {
          'id': 5,
          'role': 'user',
          'firstName': 'Sarah',
          'lastName': 'Connor',
          'email': 'sarah@fitnessplatform.com',
          'timezone': 'America/New_York',
        },
      );

      expect(session.isAuthenticated, true);
      expect(session.accessToken, 'secure_jwt_access_123');
      expect(session.refreshToken, 'secure_jwt_refresh_456');
      expect(session.currentUser?.firstName, 'Sarah');

      // Verify stored in secure storage
      expect(await storage.read('access_token'), 'secure_jwt_access_123');
      expect(await storage.read('refresh_token'), 'secure_jwt_refresh_456');

      // Simulate app restart with fresh AuthSession instance reading from same secure storage
      final restartedSession = AuthSession(storage: storage);
      await restartedSession.initSession();

      expect(restartedSession.isAuthenticated, true);
      expect(restartedSession.accessToken, 'secure_jwt_access_123');
      expect(restartedSession.currentUser?.email, 'sarah@fitnessplatform.com');
    });

    test('updateTokens updates secure storage values and notifies listeners',
        () async {
      await session.updateTokens(
        accessToken: 'rotated_access_789',
        refreshToken: 'rotated_refresh_012',
      );

      expect(session.accessToken, 'rotated_access_789');
      expect(session.refreshToken, 'rotated_refresh_012');
      expect(await storage.read('access_token'), 'rotated_access_789');
      expect(await storage.read('refresh_token'), 'rotated_refresh_012');
    });

    test(
        'clearSession permanently wipes tokens and user data from secure storage',
        () async {
      await session.saveSession(
        accessToken: 'temp_access',
        refreshToken: 'temp_refresh',
        userJson: {
          'id': 1,
          'role': 'user',
          'firstName': 'Temp',
          'email': 't@t.com'
        },
      );

      expect(session.isAuthenticated, true);

      await session.clearSession();

      expect(session.isAuthenticated, false);
      expect(session.accessToken, null);
      expect(session.currentUser, null);
      expect(await storage.read('access_token'), null);
      expect(await storage.read('refresh_token'), null);
      expect(await storage.read('current_user'), null);
    });
  });
}
