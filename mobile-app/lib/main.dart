import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import 'features/cardio/cardio_quick_log_sheet.dart';
import 'features/progress/progress_screen.dart';
import 'features/history/history_screen.dart';
import 'features/notifications/notifications_screen.dart';
import 'features/workout/workout_plans_screen.dart';
import 'features/workout/workout_tab_screen.dart';
import 'features/diet/diet_plans_screen.dart';
import 'features/diet/meals_tab_screen.dart';
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
  final HomeNavigationObserver navigationObserver = HomeNavigationObserver();

  FitnessApp({
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
          navigatorObservers: [navigationObserver],
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
                  navigationObserver: navigationObserver,
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

/// Collapses any pushed page back to the root shell when the user goes back.
/// Modal routes are intentionally excluded so dialogs and bottom sheets can
/// still dismiss normally.
class HomeNavigationObserver extends NavigatorObserver {
  VoidCallback? onReturnToHome;
  bool _isCollapsingToHome = false;

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPop(route, previousRoute);

    if (_isCollapsingToHome ||
        previousRoute == null ||
        route is! PageRoute<dynamic>) {
      return;
    }

    final navigatorState = navigator;
    if (navigatorState == null) return;

    _isCollapsingToHome = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      try {
        if (navigatorState.mounted) {
          navigatorState.popUntil((candidate) => candidate.isFirst);
          onReturnToHome?.call();
        }
      } finally {
        _isCollapsingToHome = false;
      }
    });
  }
}

class MainNavigationShell extends StatefulWidget {
  final ApiClient apiClient;
  final AuthSession authSession;
  final SyncCoordinator syncCoordinator;
  final LocalCache localCache;
  final PushRegistrationService? pushRegistrationService;
  final ThemeController? themeController;
  final HomeNavigationObserver? navigationObserver;

  const MainNavigationShell({
    super.key,
    required this.apiClient,
    required this.authSession,
    required this.syncCoordinator,
    required this.localCache,
    this.pushRegistrationService,
    this.themeController,
    this.navigationObserver,
  });

  @override
  State<MainNavigationShell> createState() => _MainNavigationShellState();
}

class _MainNavigationShellState extends State<MainNavigationShell> {
  int _currentIndex = 0;
  bool _isSyncing = false;
  DateTime? _lastBackPressAt;
  Timer? _backExitTimer;

  @override
  void initState() {
    super.initState();
    widget.navigationObserver?.onReturnToHome = _returnToHome;
  }

  @override
  void didUpdateWidget(covariant MainNavigationShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.navigationObserver != widget.navigationObserver) {
      oldWidget.navigationObserver?.onReturnToHome = null;
      widget.navigationObserver?.onReturnToHome = _returnToHome;
    }
  }

  @override
  void dispose() {
    widget.navigationObserver?.onReturnToHome = null;
    _backExitTimer?.cancel();
    super.dispose();
  }

  void _returnToHome() {
    if (!mounted) return;
    _backExitTimer?.cancel();
    _backExitTimer = null;
    _lastBackPressAt = null;
    if (_currentIndex != 0) {
      setState(() => _currentIndex = 0);
    }
  }

  void _handleBack() {
    if (_currentIndex != 0) {
      _returnToHome();
      return;
    }

    final now = DateTime.now();
    final lastBackPressAt = _lastBackPressAt;
    if (lastBackPressAt != null &&
        now.difference(lastBackPressAt) <= const Duration(seconds: 2)) {
      _backExitTimer?.cancel();
      _backExitTimer = null;
      SystemNavigator.pop();
      return;
    }

    _lastBackPressAt = now;
    _backExitTimer?.cancel();
    _backExitTimer = Timer(const Duration(seconds: 2), () {
      _lastBackPressAt = null;
      _backExitTimer = null;
    });

    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      const SnackBar(
        content: Text('Press back again to exit'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    final screens = [
      HomeScreen(
        apiClient: widget.apiClient,
        authSession: widget.authSession,
        localCache: widget.localCache,
        showAppBar: false,
        onOpenProfile: () => setState(() => _currentIndex = 4),
        onOpenWorkout: () => setState(() => _currentIndex = 1),
        onOpenMeals: () => setState(() => _currentIndex = 2),
        onOpenCardio: () => setState(() => _currentIndex = 3),
      ),
      WorkoutTabScreen(
        apiClient: widget.apiClient,
        localCache: widget.localCache,
      ),
      MealsTabScreen(
        apiClient: widget.apiClient,
        localCache: widget.localCache,
      ),
      CardioScreen(apiClient: widget.apiClient),
      _buildProfileScreen(colors),
    ];

    return PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleBack();
      },
      child: PremiumScaffold(
        appBar: _currentIndex == 0
            ? PremiumAppBar(
                title: Row(
                  children: [
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => setState(() => _currentIndex = 4),
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: colors.surfaceElevated,
                          border: Border.all(
                            color: colors.border,
                            width: 1.0,
                          ),
                        ),
                        child: ClipOval(
                          child: Icon(Icons.person,
                              size: 20, color: colors.textSecondary),
                        ),
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
                  _buildTopActionToolbar(colors),
                ],
              )
            : (_currentIndex == 4
                ? const PremiumAppBar(
                    titleText: 'Profile & Settings',
                  )
                : null),
        body: Column(
          children: [
            _buildSyncStatusBanner(colors),
            Expanded(
              child: AnimatedIndexedStack(
                index: _currentIndex,
                children: screens,
              ),
            ),
          ],
        ),
        bottomNavigationBar: PremiumNavigationBar(
          currentIndex: _currentIndex,
          onTap: (idx) {
            if (idx == 3) {
              showCardioQuickLogSheet(
                context: context,
                apiClient: widget.apiClient,
                onViewHistory: () {
                  setState(() => _currentIndex = 3);
                },
              );
              return;
            }
            setState(() => _currentIndex = idx);
          },
          items: const [
            PremiumNavigationBarItem(
              icon: Icons.home_outlined,
              activeIcon: Icons.home,
              label: 'Home',
            ),
            PremiumNavigationBarItem(
              icon: Icons.fitness_center_outlined,
              activeIcon: Icons.fitness_center,
              label: 'Workout',
            ),
            PremiumNavigationBarItem(
              icon: Icons.restaurant_outlined,
              activeIcon: Icons.restaurant,
              label: 'Meals',
            ),
            PremiumNavigationBarItem(
              icon: Icons.directions_run_outlined,
              activeIcon: Icons.directions_run,
              label: 'Cardio',
            ),
            PremiumNavigationBarItem(
              icon: Icons.person_outline,
              activeIcon: Icons.person,
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleSync() async {
    if (_isSyncing) return;
    setState(() => _isSyncing = true);
    try {
      await widget.syncCoordinator.flushQueue();
      if (mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.check_circle, color: Colors.white, size: 18),
                SizedBox(width: 8),
                Text('Agenda synchronized successfully'),
              ],
            ),
            duration: const Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Sync failed. Please check connection.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSyncing = false);
      }
    }
  }

  Widget _buildTopActionToolbar(AppThemeColors colors) {
    return Container(
      height: 38,
      margin: const EdgeInsets.only(right: 12),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadii.sm),
        border: Border.all(
          color: colors.border,
          width: 1.0,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.sm),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            _buildActionItem(
              icon: Icons.notifications_none_rounded,
              tooltip: 'Alerts',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) =>
                        NotificationsScreen(apiClient: widget.apiClient),
                  ),
                );
              },
              colors: colors,
            ),
            _buildActionDivider(colors),
            _buildActionItem(
              icon: Icons.insights_rounded,
              tooltip: 'Analytics & Progress',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => ProgressScreen(apiClient: widget.apiClient),
                  ),
                );
              },
              colors: colors,
            ),
            _buildActionDivider(colors),
            _buildActionItem(
              icon: Icons.history_rounded,
              tooltip: 'Activity History',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => HistoryScreen(
                      apiClient: widget.apiClient,
                      localCache: widget.localCache,
                    ),
                  ),
                );
              },
              colors: colors,
            ),
            _buildActionDivider(colors),
            _buildActionItem(
              icon: Icons.sync_rounded,
              tooltip: 'Sync Agenda',
              color: colors.primary,
              isLoading: _isSyncing,
              onTap: _handleSync,
              colors: colors,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionDivider(AppThemeColors colors) {
    return Container(
      width: 1,
      height: 18,
      color: colors.border.withValues(alpha: colors.isDark ? 0.25 : 0.2),
    );
  }

  Widget _buildActionItem({
    required IconData icon,
    required String tooltip,
    required VoidCallback onTap,
    required AppThemeColors colors,
    Color? color,
    bool isLoading = false,
  }) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: isLoading ? null : onTap,
          child: SizedBox(
            width: 36,
            height: 38,
            child: Center(
              child: isLoading
                  ? SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: colors.primary,
                      ),
                    )
                  : Icon(
                      icon,
                      size: 19,
                      color: color ?? colors.textSecondary,
                    ),
            ),
          ),
        ),
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
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) =>
                    FitnessConfigurationScreen(apiClient: widget.apiClient),
              ),
            );
          },
          child: Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: colors.primaryMuted,
                child: Text(
                  (user != null && user.firstName.trim().isNotEmpty)
                      ? user.firstName.trim()[0].toUpperCase()
                      : 'U',
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
                      '${user?.firstName ?? "User"} ${user?.lastName ?? ""}'
                          .trim(),
                      style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: colors.textPrimary),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      user?.email ?? '',
                      style:
                          TextStyle(fontSize: 13, color: colors.textSecondary),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(Icons.edit_outlined,
                            size: 14, color: colors.primary),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            'Edit Profile & Goals',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: colors.primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, size: 20, color: colors.textMuted),
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
                        isSelected:
                            themeController.themeMode == ThemeMode.system,
                        onTap: () =>
                            themeController.setThemeMode(ThemeMode.system),
                        colors: colors,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildThemeModeButton(
                        label: 'Light',
                        icon: Icons.light_mode_outlined,
                        isSelected:
                            themeController.themeMode == ThemeMode.light,
                        onTap: () =>
                            themeController.setThemeMode(ThemeMode.light),
                        colors: colors,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildThemeModeButton(
                        label: 'Dark',
                        icon: Icons.dark_mode_outlined,
                        isSelected: themeController.themeMode == ThemeMode.dark,
                        onTap: () =>
                            themeController.setThemeMode(ThemeMode.dark),
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
                    style:
                        TextStyle(fontSize: 12, color: colors.textSecondary)),
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
                    style:
                        TextStyle(fontSize: 12, color: colors.textSecondary)),
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
                    style:
                        TextStyle(fontSize: 12, color: colors.textSecondary)),
                trailing: Icon(Icons.chevron_right,
                    size: 20, color: colors.textMuted),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => FitnessConfigurationScreen(
                          apiClient: widget.apiClient),
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
                    style:
                        TextStyle(fontSize: 12, color: colors.textSecondary)),
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
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 20,
              color: isSelected ? colors.primary : colors.textSecondary,
            ),
            const SizedBox(height: 6),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? colors.primary : colors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
