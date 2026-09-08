import 'package:flutter_test/flutter_test.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/api/api_client.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';
import 'package:fitness_mobile_app/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FitnessApp widget renders LoginScreen when unauthenticated',
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

    await tester.pumpWidget(
      FitnessApp(
        authSession: authSession,
        syncCoordinator: syncCoordinator,
        apiClient: apiClient,
      ),
    );

    expect(find.text('PulseForge'), findsOneWidget);
    expect(find.text('Email'), findsOneWidget);
    expect(find.text('Log In'), findsOneWidget);
  });
}
