import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:fitness_mobile_app/core/api/api_client.dart';
import 'package:fitness_mobile_app/core/api/api_config.dart';
import 'package:fitness_mobile_app/core/auth/auth_session.dart';
import 'package:fitness_mobile_app/core/storage/secure_storage_service.dart';
import 'package:fitness_mobile_app/core/sync/sync_coordinator.dart';
import 'package:fitness_mobile_app/core/theme/app_theme.dart';
import 'package:fitness_mobile_app/features/auth/login_screen.dart';
import 'package:fitness_mobile_app/features/auth/signup_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    ApiConfig.setActiveWorkingBaseUrl('http://127.0.0.1:3000/api/v1');
  });

  tearDown(() {
    ApiConfig.resetActiveWorkingBaseUrl();
  });

  Widget createTestWidget({
    required ApiClient apiClient,
    required AuthSession authSession,
    Widget? child,
  }) {
    return MaterialApp(
      theme: AppTheme.lightTheme,
      home: child ??
          SignUpScreen(
            apiClient: apiClient,
            authSession: authSession,
          ),
    );
  }

  testWidgets('SignUpScreen renders title, input fields, and action buttons',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 1920);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

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

    await tester.pumpWidget(createTestWidget(
      apiClient: apiClient,
      authSession: authSession,
    ));
    await tester.pumpAndSettle();

    expect(find.text('Create Your Account'), findsOneWidget);
    expect(find.text('First Name'), findsOneWidget);
    expect(find.text('Last Name'), findsOneWidget);
    expect(find.text('Email Address'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.text('Confirm Password'), findsOneWidget);
    expect(find.text('Create Account'), findsOneWidget);
    expect(find.text('Log in'), findsOneWidget);
  });

  testWidgets('SignUpScreen enforces validation on empty and invalid fields',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 1920);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

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

    await tester.pumpWidget(createTestWidget(
      apiClient: apiClient,
      authSession: authSession,
    ));
    await tester.pumpAndSettle();

    // Tap submit with empty fields
    await tester.tap(find.text('Create Account'));
    await tester.pumpAndSettle();

    expect(find.text('First name is required'), findsOneWidget);
    expect(find.text('Email address is required'), findsOneWidget);
    expect(find.text('Password is required'), findsOneWidget);

    final textFields = find.byType(TextField);
    await tester.enterText(textFields.at(0), 'John'); // first name
    await tester.enterText(textFields.at(2), 'invalid-email'); // email
    await tester.enterText(textFields.at(3), 'short'); // password
    await tester.enterText(textFields.at(4), 'mismatch'); // confirm password

    await tester.tap(find.text('Create Account'));
    await tester.pumpAndSettle();

    expect(find.text('Enter a valid email address'), findsOneWidget);
    expect(find.text('Password must be at least 8 characters'), findsOneWidget);
    expect(find.text('Passwords do not match'), findsOneWidget);
  });

  testWidgets('SignUpScreen successfully registers, saves session, and registers device',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 1920);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final storage = InMemorySecureStorageService();
    final authSession = AuthSession(storage: storage);

    late http.Request capturedRequest;
    final mockClient = MockClient((request) async {
      if (request.url.path.endsWith('/auth/register')) {
        capturedRequest = request;
        return http.Response(
          jsonEncode({
            'success': true,
            'data': {
              'user': {
                'id': 42,
                'role': 'user',
                'firstName': 'Sarah',
                'lastName': 'Connor',
                'email': 'sarah@resistance.org',
                'timezone': 'UTC',
              },
              'accessToken': 'reg-access-token',
              'refreshToken': 'reg-refresh-token',
              'expiresInSeconds': 900,
            }
          }),
          201,
        );
      }
      if (request.url.path.endsWith('/me')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': {
              'id': 42,
              'role': 'user',
              'firstName': 'Sarah',
              'lastName': 'Connor',
              'email': 'sarah@resistance.org',
              'timezone': 'UTC',
            }
          }),
          200,
        );
      }
      return http.Response('{"success":false}', 404);
    });

    final syncCoordinator = SyncCoordinator(
      storage: storage,
      authSession: authSession,
      httpClient: mockClient,
    );
    final apiClient = ApiClient(
      authSession: authSession,
      syncCoordinator: syncCoordinator,
      httpClient: mockClient,
    );

    await tester.pumpWidget(createTestWidget(
      apiClient: apiClient,
      authSession: authSession,
    ));
    await tester.pumpAndSettle();

    final textFields = find.byType(TextField);
    await tester.enterText(textFields.at(0), 'Sarah');
    await tester.enterText(textFields.at(1), 'Connor');
    await tester.enterText(textFields.at(2), 'sarah@resistance.org');
    await tester.enterText(textFields.at(3), 'FutureLeader123!');
    await tester.enterText(textFields.at(4), 'FutureLeader123!');

    await tester.tap(find.text('Create Account'));
    await tester.pumpAndSettle();

    expect(authSession.isAuthenticated, isTrue);
    expect(authSession.currentUser?.email, 'sarah@resistance.org');
    expect(authSession.currentUser?.firstName, 'Sarah');
    expect(authSession.accessToken, 'reg-access-token');

    final body = jsonDecode(capturedRequest.body) as Map<String, dynamic>;
    expect(body['firstName'], 'Sarah');
    expect(body['lastName'], 'Connor');
    expect(body['email'], 'sarah@resistance.org');
    expect(body['password'], 'FutureLeader123!');
  });

  testWidgets('SignUpScreen displays server conflict error message',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 1920);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final storage = InMemorySecureStorageService();
    final authSession = AuthSession(storage: storage);

    final mockClient = MockClient((request) async {
      return http.Response(
        jsonEncode({
          'success': false,
          'error': {
            'code': 'EMAIL_ALREADY_EXISTS',
            'message': 'Email already in use',
          }
        }),
        409,
      );
    });

    final syncCoordinator = SyncCoordinator(
      storage: storage,
      authSession: authSession,
      httpClient: mockClient,
    );
    final apiClient = ApiClient(
      authSession: authSession,
      syncCoordinator: syncCoordinator,
      httpClient: mockClient,
    );

    await tester.pumpWidget(createTestWidget(
      apiClient: apiClient,
      authSession: authSession,
    ));
    await tester.pumpAndSettle();

    final textFields = find.byType(TextField);
    await tester.enterText(textFields.at(0), 'Sarah');
    await tester.enterText(textFields.at(2), 'duplicate@example.com');
    await tester.enterText(textFields.at(3), 'Password123!');
    await tester.enterText(textFields.at(4), 'Password123!');

    await tester.tap(find.text('Create Account'));
    await tester.pumpAndSettle();

    expect(authSession.isAuthenticated, isFalse);
    expect(find.text('Email already in use'), findsOneWidget);
  });

  testWidgets('LoginScreen navigates to SignUpScreen on tapping Sign up',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 1920);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

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

    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.lightTheme,
      home: LoginScreen(
        apiClient: apiClient,
        authSession: authSession,
      ),
    ));
    await tester.pumpAndSettle();

    final signUpButton = find.text('Sign up');
    expect(signUpButton, findsOneWidget);
    await tester.tap(signUpButton);
    await tester.pumpAndSettle();

    expect(find.text('Create Your Account'), findsOneWidget);
    expect(find.text('Create Account'), findsOneWidget);

    // Tap back icon button
    await tester.tap(find.byIcon(Icons.arrow_back));
    await tester.pumpAndSettle();

    expect(find.text('Log In'), findsOneWidget);
  });
}
