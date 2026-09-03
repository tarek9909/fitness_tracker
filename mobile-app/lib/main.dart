import 'package:flutter/material.dart';
import 'core/api/api_client.dart';
import 'core/auth/auth_session.dart';
import 'core/push/push_registration_service.dart';
import 'core/push/push_token_provider.dart';
import 'core/storage/secure_storage_service.dart';
import 'core/storage/local_cache.dart';
import 'core/sync/sync_coordinator.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_controller.dart';
import 'core/widgets/premium_widgets.dart';
import 'features/auth/login_screen.dart';
import 'features/home/home_screen.dart';
import 'features/cardio/cardio_screen.dart';
import 'features/progress/progress_screen.dart';
import 'features/notifications/notifications_screen.dart';
import 'features/workout/workout_plans_screen.dart';
import 'features/diet/diet_plans_screen.dart';
import 'features/configuration/fitness_configuration_screen.dart';
import 'features/auth/security_settings_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final storage = FlutterSecureStorageService();
  final authSession = AuthSession(storage: storage);
  final syncCoordinator = SyncCoordinator(
    storage: storage,
    authSession: authSession,
  );
  final themeController = ThemeController(storage: storage);

  await authSession.initSession();
  await syncCoordinator.initCoordinator();
  await themeController.init();

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
    themeController: themeController,
  ));
}

class FitnessApp extends StatelessWidget {
  final AuthSession authSession;
  final SyncCoordinator syncCoordinator;
  final ApiClient apiClient;
  final LocalCache? localCache;
  final PushRegistrationService? pushRegistrationService;
  final ThemeController? themeController;

  const FitnessApp({
    super.key,
    required this.authSession,
    required this.syncCoordinator,
    required this.apiClient,
    this.localCache,
    this.pushRegistrationService,
    this.themeController,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveThemeController = themeController ?? ThemeController();

    return ListenableBuilder(
      listenable: Listenable.merge([authSession, effectiveThemeController]),
      builder: (context, _) {
        return MaterialApp(
          title: 'Kinetic Wellness',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: effectiveThemeController.themeMode,
          home: authSession.isAuthenticated
              ? MainNavigationShell(
                  apiClient: apiClient,
                  authSession: authSession,
                  syncCoordinator: syncCoordinator,
                  localCache: localCache ?? LocalCache(authSession.storage),
                  pushRegistrationService: pushRegistrationService,
                  themeController: effectiveThemeController,
                )
              : LoginScreen(
                  apiClient: apiClient,
                  authSession: authSession,
                  pushRegistrationService: pushRegistrationService,
                  themeController: effectiveThemeController,
                ),
        );
      },
    );
  }
}

class MainNavigationShell extends StatefulWidget {
  final ApiClient apiClient;
  final AuthSession authSession;
  final SyncCoordinator syncCoordinator;
  final LocalCache localCache;
  final PushRegistrationService? pushRegistrationService;
  final ThemeController? themeController;

  const MainNavigationShell({
    super.key,
    required this.apiClient,
    required this.authSession,
    required this.syncCoordinator,
    required this.localCache,
    this.pushRegistrationService,
    this.themeController,
  });

  @override
  State<MainNavigationShell> createState() => _MainNavigationShellState();
}

class _MainNavigationShellState extends State<MainNavigationShell> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    final screens = [
      HomeScreen(
          apiClient: widget.apiClient,
          authSession: widget.authSession,
          localCache: widget.localCache),
      CardioScreen(apiClient: widget.apiClient),
      ProgressScreen(apiClient: widget.apiClient),
      NotificationsScreen(apiClient: widget.apiClient),
      _buildProfileScreen(colors),
    ];

    return PremiumScaffold(
      appBar: PremiumAppBar(
        title: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: colors.surfaceElevated,
                border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
              ),
              child: ClipOval(
                child: Icon(Icons.person, size: 20, color: colors.textSecondary),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Kinetic Wellness',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  letterSpacing: -0.3,
                  color: colors.textPrimary,
                ),
              ),
            ),
          ],
        ),
        actions: [
          PremiumIconButton(
            icon: Icons.sync,
            color: colors.primary,
            tooltip: 'Sync Agenda',
            onPressed: () {
              widget.syncCoordinator.flushQueue();
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          _buildSyncStatusBanner(colors),
          Expanded(child: screens[_currentIndex]),
        ],
      ),
      bottomNavigationBar: PremiumNavigationBar(
        currentIndex: _currentIndex,
        onTap: (idx) => setState(() => _currentIndex = idx),
        items: const [
          PremiumNavigationBarItem(
            icon: Icons.home_outlined,
            activeIcon: Icons.home,
            label: 'Home',
          ),
          PremiumNavigationBarItem(
            icon: Icons.event_note_outlined,
            activeIcon: Icons.event_note,
            label: 'Plan',
          ),
          PremiumNavigationBarItem(
            icon: Icons.insights_outlined,
            activeIcon: Icons.insights,
            label: 'Progress',
          ),
          PremiumNavigationBarItem(
            icon: Icons.notifications_outlined,
            activeIcon: Icons.notifications,
            label: 'Alerts',
          ),
          PremiumNavigationBarItem(
            icon: Icons.person_outline,
            activeIcon: Icons.person,
            label: 'Profile',
          ),
        ],
      ),
    );
  }

  Widget _buildSyncStatusBanner(AppThemeColors colors) {
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
        final bgColor = isError ? colors.roseMuted : colors.amberMuted;
        final textColor = isError ? colors.rose : colors.amber;
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
                PremiumButton(
                  text: 'View Queue',
                  isSecondary: true,
                  onPressed: () => _showSyncQueueDialog(context),
                  height: 28,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showSyncQueueDialog(BuildContext context) {
    final colors = AppThemeColors.of(context);
    showPremiumModalSheet(
      context: context,
      builder: (ctx) {
        return ListenableBuilder(
          listenable: widget.syncCoordinator,
          builder: (ctx, _) {
            final ops = widget.syncCoordinator.operations;
            return Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          'Offline Mutation Queue',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: colors.textPrimary),
                        ),
                      ),
                      const SizedBox(width: 8),
                      PremiumButton(
                        text: 'Sync Now',
                        onPressed: () => widget.syncCoordinator.flushQueue(),
                        height: 32,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (ops.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 32),
                      child: Center(
                        child: Text(
                          'Queue is empty. All operations synchronized.',
                          style: TextStyle(color: colors.textSecondary),
                        ),
                      ),
                    )
                  else
                    SizedBox(
                      height: 360,
                      child: ListView.builder(
                        itemCount: ops.length,
                        itemBuilder: (ctx, idx) {
                          final op = ops[idx];
                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(AppSpacing.sm),
                            decoration: BoxDecoration(
                              color: colors.surfaceElevated,
                              borderRadius: BorderRadius.circular(AppRadii.md),
                              border: Border.all(color: colors.border),
                            ),
                            child: PremiumListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text('${op.method} ${op.endpoint}',
                                  style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                      color: colors.textPrimary)),
                              subtitle: Text(
                                op.errorMessage ??
                                    'Status: ${op.status.name} (Retries: ${op.retryCount})',
                                style: TextStyle(
                                  color: op.status == SyncOperationStatus.failed
                                      ? colors.rose
                                      : colors.textSecondary,
                                  fontSize: 12,
                                ),
                              ),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  PremiumIconButton(
                                    icon: Icons.refresh,
                                    size: 18,
                                    color: colors.cyan,
                                    onPressed: () => widget.syncCoordinator
                                        .retryOperation(op.operationId),
                                  ),
                                  PremiumIconButton(
                                    icon: Icons.delete_outline,
                                    size: 18,
                                    color: colors.rose,
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

  Widget _buildProfileScreen(AppThemeColors colors) {
    final user = widget.authSession.currentUser;
    final themeController = widget.themeController;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        // User Profile Header Card
        PremiumCard(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: colors.primaryMuted,
                child: Text(
                  user?.firstName.isNotEmpty == true ? user!.firstName[0] : 'U',
                  style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: colors.primary),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${user?.firstName} ${user?.lastName ?? ""}',
                      style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: colors.textPrimary),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      user?.email ?? '',
                      style: TextStyle(
                          fontSize: 13, color: colors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Appearance & Theme Selector Card (Light / Dark / System)
        if (themeController != null) ...[
          PremiumCard(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'APPEARANCE & THEME',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _buildThemeModeButton(
                        label: 'System',
                        icon: Icons.brightness_auto,
                        isSelected: themeController.themeMode == ThemeMode.system,
                        onTap: () => themeController.setThemeMode(ThemeMode.system),
                        colors: colors,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildThemeModeButton(
                        label: 'Light',
                        icon: Icons.light_mode_outlined,
                        isSelected: themeController.themeMode == ThemeMode.light,
                        onTap: () => themeController.setThemeMode(ThemeMode.light),
                        colors: colors,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildThemeModeButton(
                        label: 'Dark',
                        icon: Icons.dark_mode_outlined,
                        isSelected: themeController.themeMode == ThemeMode.dark,
                        onTap: () => themeController.setThemeMode(ThemeMode.dark),
                        colors: colors,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],

        // Self-Service Training & Nutrition Plans
        PremiumCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              PremiumListTile(
                leading: Icon(Icons.fitness_center, color: colors.primary),
                title: Text('My Workout Plans',
                    style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: colors.textPrimary)),
                subtitle: Text('Create and manage private training splits',
                    style: TextStyle(fontSize: 12, color: colors.textSecondary)),
                trailing: Icon(Icons.chevron_right,
                    size: 20, color: colors.textMuted),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) =>
                          WorkoutPlansScreen(apiClient: widget.apiClient),
                    ),
                  );
                },
              ),
              Divider(height: 1, color: colors.border),
              PremiumListTile(
                leading: Icon(Icons.restaurant_menu, color: colors.amber),
                title: Text('My Diet Plans',
                    style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: colors.textPrimary)),
                subtitle: Text('Create and manage private meal plans',
                    style: TextStyle(fontSize: 12, color: colors.textSecondary)),
                trailing: Icon(Icons.chevron_right,
                    size: 20, color: colors.textMuted),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) =>
                          DietPlansScreen(apiClient: widget.apiClient),
                    ),
                  );
                },
              ),
              Divider(height: 1, color: colors.border),
              PremiumListTile(
                leading: Icon(Icons.tune, color: colors.cyan),
                title: Text('Goals & Configuration',
                    style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: colors.textPrimary)),
                subtitle: Text('Profile, water, cardio targets, and reminders',
                    style: TextStyle(fontSize: 12, color: colors.textSecondary)),
                trailing: Icon(Icons.chevron_right,
                    size: 20, color: colors.textMuted),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) =>
                          FitnessConfigurationScreen(apiClient: widget.apiClient),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Feature & Security Navigation Tiles
        PremiumCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              PremiumListTile(
                leading: Icon(Icons.security, color: colors.primary),
                title: Text('Account Security & OTP',
                    style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: colors.textPrimary)),
                subtitle: Text('Update password or email with OTP verification',
                    style: TextStyle(fontSize: 12, color: colors.textSecondary)),
                trailing: Icon(Icons.chevron_right,
                    size: 20, color: colors.textMuted),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => SecuritySettingsScreen(
                        apiClient: widget.apiClient,
                        authSession: widget.authSession,
                      ),
                    ),
                  );
                },
              ),
              Divider(height: 1, color: colors.border),
              PremiumListTile(
                leading: Icon(Icons.show_chart, color: colors.cyan),
                title: Text('Progress & Body Analytics',
                    style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: colors.textPrimary)),
                trailing: Icon(Icons.chevron_right,
                    size: 20, color: colors.textMuted),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) =>
                          ProgressScreen(apiClient: widget.apiClient),
                    ),
                  );
                },
              ),
              Divider(height: 1, color: colors.border),
              PremiumListTile(
                leading: Icon(Icons.notifications_active_outlined,
                    color: colors.primary),
                title: Text('Notification History & Preferences',
                    style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: colors.textPrimary)),
                trailing: Icon(Icons.chevron_right,
                    size: 20, color: colors.textMuted),
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
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Sign Out Button
        PremiumButton(
          text: 'Sign Out',
          isDanger: true,
          icon: const Icon(Icons.logout, size: 18, color: Colors.white),
          onPressed: () async {
            final confirm = await showPremiumDialog<bool>(
              context: context,
              title: 'Sign Out',
              content: Text(
                'Are you sure you want to sign out of Fitness OS? Any unsynchronized offline mutations will be cleared.',
                style: TextStyle(
                  fontSize: 14,
                  color: colors.textSecondary,
                  height: 1.4,
                ),
              ),
              actions: [
                PremiumButton(
                  text: 'Cancel',
                  isSecondary: true,
                  onPressed: () => Navigator.pop(context, false),
                ),
                PremiumButton(
                  text: 'Sign Out',
                  isDanger: true,
                  onPressed: () => Navigator.pop(context, true),
                ),
              ],
            );
            if (confirm != true) return;

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
        ),
      ],
    );
  }

  Widget _buildThemeModeButton({
    required String label,
    required IconData icon,
    required bool isSelected,
    required VoidCallback onTap,
    required AppThemeColors colors,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.md),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: isSelected ? colors.primaryMuted : colors.surfaceElevated,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(
            color: isSelected ? colors.primary : colors.border,
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              size: 20,
              color: isSelected ? colors.primary : colors.textSecondary,
            ),
            const SizedBox(height: 6),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected ? colors.primary : colors.textSecondary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
