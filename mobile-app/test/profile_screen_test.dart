import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/api/api_client.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';
import 'package:fitness_mobile_app/core/theme/theme_controller.dart';
import 'package:fitness_mobile_app/core/storage/local_cache.dart';
import 'package:fitness_mobile_app/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('MainNavigationShell renders Profile tab without layout exceptions',
      (WidgetTester tester) async {
    final storage = InMemorySecureStorageService();
    final authSession = AuthSession(storage: storage);
    final syncCoordinator = SyncCoordinator(
      storage: storage,
      authSession: authSession,
    );
    final apiClient = ApiClient(
      authSession: authSession,
      syncCoordinator: syncCoordinator,
    );
    final themeController = ThemeController(storage: storage);

    await authSession.saveSession(
      accessToken: 'test-access',
      refreshToken: 'test-refresh',
      userJson: {
        'id': 1,
        'firstName': 'Tarek',
        'lastName': 'Aswad',
        'email': 'tarek.aswad@fitnessplatform.com',
        'role': 'user',
        'timezone': 'UTC',
      },
    );

    await tester.pumpWidget(
      MaterialApp(
        home: MainNavigationShell(
          apiClient: apiClient,
          authSession: authSession,
          syncCoordinator: syncCoordinator,
          localCache: LocalCache(storage),
          themeController: themeController,
        ),
      ),
    );

    await tester.pumpAndSettle();

    // Tap the Profile tab (index 4)
    final profileTab = find.byIcon(Icons.person_outline);
    expect(profileTab, findsOneWidget);
    await tester.tap(profileTab);
    await tester.pumpAndSettle();

    // Verify Profile content rendered without error
    expect(find.text('Profile & Settings'), findsOneWidget);
    expect(find.text('Tarek Aswad'), findsOneWidget);
    expect(find.text('tarek.aswad@fitnessplatform.com'), findsOneWidget);
    expect(find.text('APPEARANCE & THEME'), findsOneWidget);
  });
}
