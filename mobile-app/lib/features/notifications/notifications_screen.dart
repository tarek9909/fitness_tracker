import 'dart:convert';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';
import '../workout/workout_execution_screen.dart';
import '../diet/meal_logging_screen.dart';
import '../cardio/cardio_screen.dart';
import '../weight/weight_screen.dart';

class NotificationsScreen extends StatefulWidget {
  final ApiClient apiClient;

  const NotificationsScreen({super.key, required this.apiClient});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic> _notifications = [];
  bool _loading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchNotifications();
  }

  Future<void> _fetchNotifications() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });
    try {
      final res = await widget.apiClient.get('/me/notifications');
      final list = _asList(res);
      setState(() {
        _notifications = list;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
        showPremiumSnackBar(
          context,
          'Failed to load notifications: $e',
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<dynamic> _asList(dynamic response) {
    if (response is List<dynamic>) return response;
    if (response is Map<String, dynamic> && response['data'] is List<dynamic>) {
      return response['data'] as List<dynamic>;
    }
    return const [];
  }

  Future<void> _markRead(int id) async {
    try {
      await widget.apiClient.post('/me/notifications/$id/read');
      setState(() {
        for (var n in _notifications) {
          if (n['id'] == id) {
            n['status'] = 'read';
            n['is_read'] = 1;
          }
        }
      });
    } catch (e) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Failed to mark notification as read: $e',
          isError: true,
        );
      }
    }
  }

  Future<void> _markAllRead() async {
    try {
      await widget.apiClient.post('/me/notifications/read-all');
      setState(() {
        for (var n in _notifications) {
          n['status'] = 'read';
          n['is_read'] = 1;
        }
      });
      if (mounted) {
        showPremiumSnackBar(
          context,
          'All notifications marked as read',
          isSuccess: true,
        );
      }
    } catch (e) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Failed to mark all as read: $e',
          isError: true,
        );
      }
    }
  }

  Future<void> _dismissNotification(int id) async {
    final prevList = List<dynamic>.from(_notifications);
    setState(() {
      _notifications.removeWhere((n) => n['id'] == id);
    });
    try {
      await widget.apiClient.post('/me/notifications/$id/dismiss');
    } on OfflineOperationQueued catch (_) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Notification dismissed offline. Will sync when online.',
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _notifications = prevList);
        showPremiumSnackBar(
          context,
          'Failed to dismiss notification: $e',
          isError: true,
        );
      }
    }
  }

  void _handleNotificationClick(Map<String, dynamic> n) {
    final id = n['id'] as int;
    if (n['status'] == 'unread' || n['is_read'] == 0) {
      _markRead(id);
    }

    String? actionUrl = n['action_url'] ?? n['actionUrl'];
    dynamic meta = n['metadata'];
    if (meta is String) {
      try {
        meta = jsonDecode(meta);
      } catch (_) {}
    }

    if (actionUrl == null && meta is Map) {
      actionUrl = meta['actionUrl'] ?? meta['route'];
    }

    if (actionUrl != null) {
      final route = actionUrl.toLowerCase();
      if (route.contains('workout')) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => WorkoutExecutionScreen(apiClient: widget.apiClient),
          ),
        );
      } else if (route.contains('diet') || route.contains('meal')) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => MealLoggingScreen(
              apiClient: widget.apiClient,
              meal: const {'name': 'Scheduled Meal', 'optionGroups': []},
            ),
          ),
        );
      } else if (route.contains('cardio')) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => CardioScreen(apiClient: widget.apiClient),
          ),
        );
      } else if (route.contains('weight')) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => WeightScreen(apiClient: widget.apiClient),
          ),
        );
      }
    }
  }

  Future<void> _showNotificationSettings() async {
    final colors = AppThemeColors.of(context);
    Map<String, dynamic>? settings;
    bool loadingSettings = true;
    String? settingsError;

    await showPremiumModalSheet(
      context: context,
      builder: (sheetCtx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            if (loadingSettings) {
              widget.apiClient.get('/me/notification-settings').then((res) {
                if (ctx.mounted) {
                  setSheetState(() {
                    settings = res is Map<String, dynamic>
                        ? (res['data'] is Map<String, dynamic>
                            ? res['data'] as Map<String, dynamic>
                            : res)
                        : <String, dynamic>{};
                    loadingSettings = false;
                  });
                }
              }).catchError((e) {
                if (ctx.mounted) {
                  setSheetState(() {
                    settings = null;
                    settingsError = e.toString().replaceAll('Exception: ', '');
                    loadingSettings = false;
                  });
                }
              });

              return Container(
                height: 300,
                alignment: Alignment.center,
                child:
                    CircularProgressIndicator(color: colors.primary),
              );
            }

            if (settingsError != null) {
              return SizedBox(
                height: 300,
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.cloud_off,
                          color: colors.rose, size: 40),
                      const SizedBox(height: 12),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Text(
                          'Could not load notification settings: $settingsError',
                          textAlign: TextAlign.center,
                          style:
                              TextStyle(color: colors.textSecondary),
                        ),
                      ),
                      const SizedBox(height: 12),
                      PremiumButton(
                        text: 'Retry',
                        onPressed: () => setSheetState(() {
                          settingsError = null;
                          loadingSettings = true;
                        }),
                      ),
                    ],
                  ),
                ),
              );
            }

            final pushEnabled =
                settings?['pushEnabled'] ?? settings?['push_enabled'] ?? true;
            final inAppEnabled = settings?['inAppEnabled'] ??
                settings?['in_app_enabled'] ??
                true;
            final workoutReminders = settings?['workoutReminders'] ??
                settings?['workout_reminders'] ??
                true;
            final mealReminders = settings?['mealReminders'] ??
                settings?['meal_reminders'] ??
                true;
            final waterReminders = settings?['waterReminders'] ??
                settings?['water_reminders'] ??
                true;
            final weightReminders = settings?['weightReminders'] ??
                settings?['weight_reminders'] ??
                true;

            Future<void> updateSetting(String key, bool val) async {
              setSheetState(() {
                settings![key] = val;
              });
              try {
                await widget.apiClient
                    .patch('/me/notification-settings', body: {
                  key: val,
                });
              } catch (e) {
                if (ctx.mounted) {
                  setSheetState(() {
                    settings![key] = !val;
                  });
                  showPremiumSnackBar(
                    ctx,
                    'Failed to update setting: $e',
                    isError: true,
                  );
                }
              }
            }

            return SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Notification Preferences',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: colors.textPrimary,
                        ),
                      ),
                      PremiumIconButton(
                        icon: Icons.close,
                        size: 18,
                        onPressed: () => Navigator.pop(sheetCtx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  PremiumSwitchTile(
                    title: 'Push Notifications',
                    subtitle: 'Receive push alerts on your device',
                    value: pushEnabled == true || pushEnabled == 1,
                    onChanged: (val) => updateSetting('pushEnabled', val),
                  ),
                  PremiumSwitchTile(
                    title: 'In-App Alerts',
                    subtitle: 'Show banners while using the app',
                    value: inAppEnabled == true || inAppEnabled == 1,
                    onChanged: (val) => updateSetting('inAppEnabled', val),
                  ),
                  const Divider(height: 24),
                  Text('CATEGORY REMINDERS',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                          color: colors.cyan)),
                  const SizedBox(height: 8),
                  PremiumSwitchTile(
                    title: 'Workout Reminders',
                    value: workoutReminders == true || workoutReminders == 1,
                    onChanged: (val) => updateSetting('workoutReminders', val),
                  ),
                  PremiumSwitchTile(
                    title: 'Meal Reminders',
                    value: mealReminders == true || mealReminders == 1,
                    onChanged: (val) => updateSetting('mealReminders', val),
                  ),
                  PremiumSwitchTile(
                    title: 'Hydration Reminders',
                    value: waterReminders == true || waterReminders == 1,
                    onChanged: (val) => updateSetting('waterReminders', val),
                  ),
                  PremiumSwitchTile(
                    title: 'Weight Check-in Reminders',
                    value: weightReminders == true || weightReminders == 1,
                    onChanged: (val) => updateSetting('weightReminders', val),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final unreadCount = _notifications
        .where((n) => n['status'] == 'unread' || n['is_read'] == 0)
        .length;

    return PremiumScaffold(
      appBar: PremiumAppBar(
        titleText: 'Notifications',
        actions: [
          PremiumIconButton(
            icon: Icons.settings_outlined,
            tooltip: 'Notification Settings',
            onPressed: _showNotificationSettings,
          ),
          if (unreadCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: PremiumButton(
                text: 'Mark all read',
                isSecondary: true,
                onPressed: _markAllRead,
                height: 36,
              ),
            ),
        ],
      ),
      body: _loading
          ? Center(
              child: CircularProgressIndicator(color: colors.primary))
          : _errorMessage != null
              ? ErrorStateWidget(
                  message: _errorMessage!,
                  onRetry: _fetchNotifications,
                )
              : _notifications.isEmpty
                  ? const EmptyStateWidget(
                      icon: Icons.notifications_none,
                      title: 'No Notifications',
                      description:
                          'You\'re all caught up! Prescriptions and reminders will show up here.',
                    )
                  : RefreshIndicator(
                      onRefresh: _fetchNotifications,
                      color: colors.primary,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        itemCount: _notifications.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, idx) {
                          final n = _notifications[idx];
                          final isUnread =
                              n['status'] == 'unread' || n['is_read'] == 0;
                          final title = n['title'] as String? ?? 'Notification';
                          final message =
                              (n['body'] ?? n['message']) as String? ?? '';
                          final category = n['category'] as String? ?? 'system';
                          final id = n['id'] as int;

                          return Dismissible(
                            key: Key('notif_$id'),
                            direction: DismissDirection.endToStart,
                            background: Container(
                              alignment: Alignment.centerRight,
                              padding: const EdgeInsets.only(right: 20),
                              decoration: BoxDecoration(
                                color: colors.roseMuted,
                                borderRadius:
                                    BorderRadius.circular(AppRadii.md),
                              ),
                              child: Icon(Icons.delete_outline,
                                  color: colors.rose),
                            ),
                            onDismissed: (_) => _dismissNotification(id),
                            child: PremiumCard(
                              padding: const EdgeInsets.all(AppSpacing.md),
                              color: isUnread
                                  ? colors.primaryMuted
                                  : colors.surface,
                              border: isUnread
                                  ? BorderSide(
                                      color: colors.primary
                                          .withValues(alpha: 0.4))
                                  : BorderSide(color: colors.border),
                              onTap: () => _handleNotificationClick(n),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _getCategoryIcon(category, isUnread, colors),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Expanded(
                                              child: Text(
                                                title,
                                                style: TextStyle(
                                                  fontWeight: isUnread
                                                      ? FontWeight.w800
                                                      : FontWeight.w600,
                                                  fontSize: 15,
                                                  color: colors.textPrimary,
                                                ),
                                              ),
                                            ),
                                            if (isUnread)
                                              Container(
                                                width: 8,
                                                height: 8,
                                                decoration: BoxDecoration(
                                                  color: colors.primary,
                                                  shape: BoxShape.circle,
                                                ),
                                              ),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          message,
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: isUnread
                                                ? colors.textPrimary
                                                : colors.textSecondary,
                                            height: 1.35,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }

  Widget _getCategoryIcon(String category, bool isUnread, AppThemeColors colors) {
    IconData iconData;
    Color color;

    switch (category) {
      case 'workout':
        iconData = Icons.fitness_center;
        color = colors.cyan;
        break;
      case 'diet':
        iconData = Icons.restaurant_menu;
        color = colors.primary;
        break;
      case 'water':
        iconData = Icons.water_drop_outlined;
        color = colors.cyan;
        break;
      case 'cardio':
        iconData = Icons.directions_run;
        color = colors.rose;
        break;
      default:
        iconData = Icons.notifications_active_outlined;
        color = colors.amber;
    }

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(iconData, color: color, size: 20),
    );
  }
}
