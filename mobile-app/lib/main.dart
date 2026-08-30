import 'package:flutter/material.dart';
import 'core/api/api_client.dart';
import 'core/auth/auth_session.dart';
import 'core/push/push_registration_service.dart';
import 'core/push/push_token_provider.dart';
import 'core/storage/secure_storage_service.dart';
import 'core/storage/local_cache.dart';
import 'core/sync/sync_coordinator.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/login_screen.dart';
import 'features/home/home_screen.dart';
import 'features/cardio/cardio_screen.dart';
import 'features/history/history_screen.dart';
import 'features/weight/weight_screen.dart';
import 'features/progress/progress_screen.dart';
import 'features/notifications/notifications_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final storage = FlutterSecureStorageService();
  final authSession = AuthSession(storage: storage);
  final syncCoordinator = SyncCoordinator(
    storage: storage,
    authSession: authSession,
  );

  await authSession.initSession();
  await syncCoordinator.initCoordinator();

  final apiClient = ApiClient(
    authSession: authSession,
    syncCoordinator: syncCoordinator,
  );
  final localCache = LocalCache(storage);

  final pushRegistrationService = PushRegistrationService(
    apiClient: apiClient,
    storage: storage,
    pushTokenProvider: const UnconfiguredPushTokenProvider(),
    authSession: authSession,
  );

  apiClient.onTokenRefreshed = () {
    pushRegistrationService.registerDeviceIfNeeded();
  };

  // Validate persisted session with authoritative /me endpoint on startup
  if (authSession.isAuthenticated) {
    try {
      final me = await apiClient.get('/me');
      if (me is Map<String, dynamic>) {
        await authSession.updateProfile(me);
      }
      // Non-blocking device registration check on valid startup session
      pushRegistrationService.registerDeviceIfNeeded();
    } catch (_) {
      // If validation/refresh failed, authSession will be cleared by apiClient
    }
  }

  runApp(FitnessApp(
    authSession: authSession,
    syncCoordinator: syncCoordinator,
    apiClient: apiClient,
    localCache: localCache,
    pushRegistrationService: pushRegistrationService,
  ));
}

class FitnessApp extends StatelessWidget {
  final AuthSession authSession;
  final SyncCoordinator syncCoordinator;
  final ApiClient apiClient;
  final LocalCache? localCache;
  final PushRegistrationService? pushRegistrationService;

  const FitnessApp({
    super.key,
    required this.authSession,
    required this.syncCoordinator,
    required this.apiClient,
    this.localCache,
    this.pushRegistrationService,
  });

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: authSession,
      builder: (context, _) {
        return MaterialApp(
          title: 'Fitness Platform',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.darkTheme,
          home: authSession.isAuthenticated
              ? MainNavigationShell(
                  apiClient: apiClient,
                  authSession: authSession,
                  syncCoordinator: syncCoordinator,
                  localCache: localCache ?? LocalCache(authSession.storage),
                  pushRegistrationService: pushRegistrationService,
                )
              : LoginScreen(
                  apiClient: apiClient,
                  authSession: authSession,
                  pushRegistrationService: pushRegistrationService,
                ),
        );
      },
    );
  }
}

class MainNavigationShell extends StatefulWidget {
  final ApiClient apiClient;
  final LocalCache localCache;
  final AuthSession authSession;
  final SyncCoordinator syncCoordinator;
  final PushRegistrationService? pushRegistrationService;

  const MainNavigationShell({
    super.key,
    required this.apiClient,
    required this.localCache,
    required this.authSession,
    required this.syncCoordinator,
    this.pushRegistrationService,
  });

  @override
  State<MainNavigationShell> createState() => _MainNavigationShellState();
}

class _MainNavigationShellState extends State<MainNavigationShell> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && widget.authSession.isAuthenticated) {
        widget.syncCoordinator.resumeAfterAuthentication();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      HomeScreen(
          apiClient: widget.apiClient,
          authSession: widget.authSession,
          localCache: widget.localCache),
      CardioScreen(apiClient: widget.apiClient),
      HistoryScreen(apiClient: widget.apiClient, localCache: widget.localCache),
      WeightScreen(apiClient: widget.apiClient),
      _buildProfileScreen(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('FITNESS OS',
            style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1)),
        backgroundColor: AppColors.surface,
        elevation: 0,
        actions: [
          IconButton(
            icon:
                const Icon(Icons.notifications_outlined, color: AppColors.cyan),
            tooltip: 'Notification Center',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) =>
                      NotificationsScreen(apiClient: widget.apiClient),
                ),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          _buildSyncStatusBanner(),
          Expanded(child: screens[_currentIndex]),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (idx) => setState(() => _currentIndex = idx),
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textMuted,
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.today),
            label: 'Today',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.directions_run),
            label: 'Cardio',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.history),
            label: 'History',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.monitor_weight_outlined),
            label: 'Weight',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            label: 'Profile',
          ),
        ],
      ),
    );
  }

  Widget _buildSyncStatusBanner() {
    return ListenableBuilder(
      listenable: widget.syncCoordinator,
      builder: (context, _) {
        final pending = widget.syncCoordinator.pendingCount;
        final failed = widget.syncCoordinator.failedCount;
        final authRequired = widget.syncCoordinator.authRequiredCount;

        if (pending == 0 && failed == 0 && authRequired == 0) {
          return const SizedBox.shrink();
        }

        final isError = failed > 0 || authRequired > 0;
        final bgColor = isError
            ? AppColors.rose.withValues(alpha: 0.2)
            : AppColors.amber.withValues(alpha: 0.2);
        final textColor = isError ? AppColors.rose : AppColors.amber;
        final icon = isError ? Icons.warning_amber_rounded : Icons.sync;
        final text = authRequired > 0
            ? '$authRequired mutation(s) require sign-in to resume'
            : isError
                ? '$failed mutation(s) require review or retry'
                : '$pending mutation(s) queued for sync';

        return SafeArea(
          bottom: false,
          child: Container(
            color: bgColor,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Icon(icon, size: 18, color: textColor),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    text,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: textColor,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () => _showSyncQueueDialog(context),
                  style: TextButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    foregroundColor: textColor,
                  ),
                  child: const Text('View Queue'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showSyncQueueDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return ListenableBuilder(
          listenable: widget.syncCoordinator,
          builder: (ctx, _) {
            final ops = widget.syncCoordinator.operations;
            return Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Offline Mutation Queue',
                        style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      TextButton(
                        onPressed: () => widget.syncCoordinator.flushQueue(),
                        child: const Text('Sync Now'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (ops.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 24),
                      child: Center(
                        child: Text(
                          'Queue is empty. All operations synchronized.',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      ),
                    )
                  else
                    Expanded(
                      child: ListView.builder(
                        itemCount: ops.length,
                        itemBuilder: (ctx, idx) {
                          final op = ops[idx];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              title: Text('${op.method} ${op.endpoint}'),
                              subtitle: Text(
                                op.errorMessage ??
                                    'Status: ${op.status.name} (Retries: ${op.retryCount})',
                                style: TextStyle(
                                  color: op.status == SyncOperationStatus.failed
                                      ? AppColors.rose
                                      : AppColors.textSecondary,
                                  fontSize: 12,
                                ),
                              ),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.refresh, size: 20),
                                    onPressed: () => widget.syncCoordinator
                                        .retryOperation(op.operationId),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline,
                                        size: 20),
                                    onPressed: () => widget.syncCoordinator
                                        .discardOperation(op.operationId),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildProfileScreen() {
    final user = widget.authSession.currentUser;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: AppColors.primaryGlow,
                  child: Text(
                    user?.firstName.isNotEmpty == true
                        ? user!.firstName[0]
                        : 'U',
                    style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary),
                  ),
                ),
                const SizedBox(width: 16),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${user?.firstName} ${user?.lastName ?? ""}',
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      user?.email ?? '',
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        ListTile(
          tileColor: AppColors.surface,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          leading: const Icon(Icons.show_chart, color: AppColors.cyan),
          title: const Text('Progress & Body Analytics'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ProgressScreen(apiClient: widget.apiClient),
              ),
            );
          },
        ),
        const SizedBox(height: 12),
        ListTile(
          tileColor: AppColors.surface,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          leading: const Icon(Icons.notifications_active_outlined,
              color: AppColors.primary),
          title: const Text('Notification History & Preferences'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) =>
                    NotificationsScreen(apiClient: widget.apiClient),
              ),
            );
          },
        ),
        const SizedBox(height: 24),
        ElevatedButton.icon(
          onPressed: () async {
            final refreshToken = widget.authSession.refreshToken;
            if (refreshToken != null && refreshToken.isNotEmpty) {
              try {
                await widget.apiClient.post('/auth/logout', body: {
                  'refreshToken': refreshToken,
                });
              } catch (_) {
                // Ignore network errors during logout
              }
            }
            widget.pushRegistrationService?.clearRegistrationState();
            await widget.authSession.clearSession();
            await widget.syncCoordinator.clearQueue();
          },
          style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.rose.withValues(alpha: 0.2),
              foregroundColor: AppColors.rose),
          icon: const Icon(Icons.logout),
          label: const Text('Sign Out'),
        ),
      ],
    );
  }
}
