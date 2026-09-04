import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fitness_mobile_app/core/api/api_client.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/storage/local_cache.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';
import 'package:fitness_mobile_app/main.dart';

class _TestApiClient extends ApiClient {
  _TestApiClient({required super.authSession, required super.syncCoordinator});

  @override
  Future<dynamic> get(String endpoint) async => <String, dynamic>{};
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<Widget> buildApp(HomeNavigationObserver observer) async {
    final storage = InMemorySecureStorageService();
    final authSession = AuthSession(storage: storage);
    final syncCoordinator = SyncCoordinator(
      storage: storage,
      authSession: authSession,
    );
    await authSession.saveSession(
      accessToken: 'test-access',
      refreshToken: 'test-refresh',
      userJson: {
        'id': 1,
        'firstName': 'Test',
        'lastName': 'User',
        'email': 'test@example.com',
        'role': 'user',
        'timezone': 'UTC',
      },
    );

    return MaterialApp(
      navigatorObservers: [observer],
      home: MainNavigationShell(
        apiClient: _TestApiClient(
          authSession: authSession,
          syncCoordinator: syncCoordinator,
        ),
        authSession: authSession,
        syncCoordinator: syncCoordinator,
        localCache: LocalCache(storage),
        navigationObserver: observer,
      ),
    );
  }

  testWidgets('back from another tab returns to Home', (tester) async {
    final observer = HomeNavigationObserver();
    await tester.pumpWidget(await buildApp(observer));
    await tester.pump();

    await tester.tap(find.byIcon(Icons.person_outline));
    await tester.pump();
    expect(find.text('Profile & Settings'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pump();

    expect(find.text('Kinetic Wellness'), findsOneWidget);
  });

  testWidgets('back from a pushed page returns to Home', (tester) async {
    final observer = HomeNavigationObserver();
    await tester.pumpWidget(await buildApp(observer));
    await tester.pump();

    await tester.tap(find.byIcon(Icons.person_outline));
    await tester.pump();
    final navigator =
        Navigator.of(tester.element(find.byType(MainNavigationShell)));
    navigator.push(
      MaterialPageRoute<void>(
        builder: (_) => const Scaffold(body: Text('Detail page')),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Detail page'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    expect(find.text('Kinetic Wellness'), findsOneWidget);
  });

  testWidgets('home first back confirms, second back exits, and timeout resets', (tester) async {
    final observer = HomeNavigationObserver();
    var exitCalls = 0;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'SystemNavigator.pop') exitCalls++;
      return null;
    });
    addTearDown(() => TestDefaultBinaryMessengerBinding.instance
        .defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null));

    await tester.pumpWidget(await buildApp(observer));
    await tester.pump();

    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(find.text('Press back again to exit'), findsOneWidget);
    expect(exitCalls, 0);

    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(exitCalls, 1);

    await tester.pump(const Duration(seconds: 3));
    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(exitCalls, 1);
    expect(find.text('Press back again to exit'), findsOneWidget);
  });

  testWidgets('dialog routes dismiss normally instead of collapsing the shell', (tester) async {
    final observer = HomeNavigationObserver();
    await tester.pumpWidget(await buildApp(observer));
    await tester.pump();

    showDialog<void>(
      context: tester.element(find.byType(MainNavigationShell)),
      builder: (_) => const AlertDialog(content: Text('Modal route')),
    );
    await tester.pumpAndSettle();
    expect(find.text('Modal route'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('Modal route'), findsNothing);
    expect(find.text('Kinetic Wellness'), findsOneWidget);
  });
}
