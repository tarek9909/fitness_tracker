import 'dart:convert';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load notifications: $e')),
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to mark notification as read: $e')),
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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('All notifications marked as read')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  Future<void> _dismissNotification(int id) async {
    try {
      await widget.apiClient.post('/me/notifications/$id/dismiss');
      setState(() {
        _notifications.removeWhere((n) => n['id'] == id);
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Notification dismissed')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  Future<void> _handleNotificationClick(dynamic notification) async {
    final id = notification['id'] as int?;
    if (id != null) {
      _markRead(id);
    }

    final deepLink = (notification['deep_link'] as String? ?? '').toLowerCase();
    final category = (notification['category'] as String? ?? '').toLowerCase();

    Map<String, dynamic>? metadata;
    final rawMeta = notification['metadata'];
    if (rawMeta is Map<String, dynamic>) {
      metadata = rawMeta;
    } else if (rawMeta is String && rawMeta.isNotEmpty) {
      try {
        metadata = jsonDecode(rawMeta) as Map<String, dynamic>?;
      } catch (_) {}
    }

    final workoutDayId = notification['workout_plan_day_id'] ??
        metadata?['workoutPlanDayId'] ??
        metadata?['workout_plan_day_id'];
    final sessionId = notification['workout_session_id'] ??
        metadata?['workoutSessionId'] ??
        metadata?['sessionId'] ??
        metadata?['workout_session_id'];
    final mealId = notification['diet_meal_id'] ??
        metadata?['dietMealId'] ??
        metadata?['mealId'] ??
        metadata?['diet_meal_id'];

    if (deepLink.contains('workout') || category.contains('workout')) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => WorkoutExecutionScreen(
            apiClient: widget.apiClient,
            workoutDayId: workoutDayId is int
                ? workoutDayId
                : (workoutDayId != null
                    ? int.tryParse(workoutDayId.toString())
                    : null),
            existingSessionId: sessionId is int
                ? sessionId
                : (sessionId != null
                    ? int.tryParse(sessionId.toString())
                    : null),
          ),
        ),
      );
    } else if (deepLink.contains('meal') ||
        deepLink.contains('diet') ||
        category.contains('diet') ||
        category.contains('meal')) {
      if (mealId != null) {
        final parsedMealId =
            mealId is int ? mealId : int.tryParse(mealId.toString()) ?? 0;
        try {
          final res = await widget.apiClient.get('/me/today');
          final data =
              res is Map<String, dynamic> && res['data'] is Map<String, dynamic>
                  ? res['data'] as Map<String, dynamic>
                  : (res is Map<String, dynamic> ? res : <String, dynamic>{});
          final diet = data['diet'] as Map<String, dynamic>?;
          final meals = diet?['meals'] as List<dynamic>? ?? [];
          final match = meals.firstWhere(
            (m) =>
                m is Map &&
                (m['id'] == parsedMealId || m['diet_meal_id'] == parsedMealId),
            orElse: () => null,
          );
          if (match != null && match is Map && mounted) {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => MealLoggingScreen(
                  apiClient: widget.apiClient,
                  meal: Map<String, dynamic>.from(match),
                ),
              ),
            );
          } else if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Meal not found in current diet plan'),
              ),
            );
          }
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  'Failed to load meal details: ${e.toString().replaceAll('Exception: ', '')}',
                ),
              ),
            );
          }
        }
      }
    } else if (deepLink.contains('cardio') || category.contains('cardio')) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => CardioScreen(apiClient: widget.apiClient),
        ),
      );
    } else if (deepLink.contains('weight') || category.contains('weight')) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => WeightScreen(apiClient: widget.apiClient),
        ),
      );
    }
  }

  Future<void> _showNotificationSettings() async {
    Map<String, dynamic>? settings;
    bool loadingSettings = true;
    String? settingsError;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
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
                child: const CircularProgressIndicator(color: AppColors.cyan),
              );
            }

            if (settingsError != null) {
              return SizedBox(
                height: 300,
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.cloud_off,
                          color: AppColors.rose, size: 40),
                      const SizedBox(height: 12),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Text(
                          'Could not load notification settings: $settingsError',
                          textAlign: TextAlign.center,
                          style:
                              const TextStyle(color: AppColors.textSecondary),
                        ),
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () => setSheetState(() {
                          settingsError = null;
                          loadingSettings = true;
                        }),
                        child: const Text('Retry'),
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
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    SnackBar(content: Text('Failed to update setting: $e')),
                  );
                }
              }
            }

            return DraggableScrollableSheet(
              initialChildSize: 0.7,
              maxChildSize: 0.9,
              minChildSize: 0.5,
              expand: false,
              builder: (_, scrollCtrl) {
                return ListView(
                  controller: scrollCtrl,
                  padding: const EdgeInsets.all(20),
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: AppColors.border,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Notification Preferences',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 16),
                    SwitchListTile(
                      title: const Text('Push Notifications'),
                      subtitle:
                          const Text('Receive push alerts on your device'),
                      value: pushEnabled == true || pushEnabled == 1,
                      activeThumbColor: AppColors.cyan,
                      onChanged: (val) => updateSetting('pushEnabled', val),
                    ),
                    SwitchListTile(
                      title: const Text('In-App Alerts'),
                      subtitle: const Text('Show banners while using the app'),
                      value: inAppEnabled == true || inAppEnabled == 1,
                      activeThumbColor: AppColors.cyan,
                      onChanged: (val) => updateSetting('inAppEnabled', val),
                    ),
                    const Divider(height: 24),
                    const Text('CATEGORY REMINDERS',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                            color: AppColors.cyan)),
                    const SizedBox(height: 8),
                    SwitchListTile(
                      title: const Text('Workout Reminders'),
                      value: workoutReminders == true || workoutReminders == 1,
                      activeThumbColor: AppColors.cyan,
                      onChanged: (val) =>
                          updateSetting('workoutReminders', val),
                    ),
                    SwitchListTile(
                      title: const Text('Meal Reminders'),
                      value: mealReminders == true || mealReminders == 1,
                      activeThumbColor: AppColors.cyan,
                      onChanged: (val) => updateSetting('mealReminders', val),
                    ),
                    SwitchListTile(
                      title: const Text('Hydration Reminders'),
                      value: waterReminders == true || waterReminders == 1,
                      activeThumbColor: AppColors.cyan,
                      onChanged: (val) => updateSetting('waterReminders', val),
                    ),
                    SwitchListTile(
                      title: const Text('Weight Check-in Reminders'),
                      value: weightReminders == true || weightReminders == 1,
                      activeThumbColor: AppColors.cyan,
                      onChanged: (val) => updateSetting('weightReminders', val),
                    ),
                  ],
                );
              },
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _notifications
        .where((n) => n['status'] == 'unread' || n['is_read'] == 0)
        .length;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Notifications',
            style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.surface,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'Notification Settings',
            onPressed: _showNotificationSettings,
          ),
          if (unreadCount > 0)
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Mark all read',
                  style: TextStyle(
                      color: AppColors.cyan, fontWeight: FontWeight.w600)),
            ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.cyan))
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.cloud_off,
                            size: 48, color: AppColors.rose),
                        const SizedBox(height: 16),
                        Text(
                          'Failed to load notifications: $_errorMessage',
                          textAlign: TextAlign.center,
                          style:
                              const TextStyle(color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: _fetchNotifications,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : _notifications.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.notifications_none,
                              size: 54, color: AppColors.textSecondary),
                          SizedBox(height: 12),
                          Text('No new notifications',
                              style: TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 16)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _fetchNotifications,
                      color: AppColors.cyan,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
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
                                color: AppColors.rose.withValues(alpha: 0.8),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.delete_outline,
                                  color: Colors.white),
                            ),
                            onDismissed: (_) => _dismissNotification(id),
                            child: InkWell(
                              onTap: () => _handleNotificationClick(n),
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: isUnread
                                      ? AppColors.cyan.withValues(alpha: 0.08)
                                      : AppColors.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isUnread
                                        ? AppColors.cyan.withValues(alpha: 0.4)
                                        : AppColors.border,
                                  ),
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _getCategoryIcon(category, isUnread),
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
                                                        ? FontWeight.bold
                                                        : FontWeight.w600,
                                                    fontSize: 15,
                                                    color: Colors.white,
                                                  ),
                                                ),
                                              ),
                                              if (isUnread)
                                                Container(
                                                  width: 8,
                                                  height: 8,
                                                  decoration:
                                                      const BoxDecoration(
                                                    color: AppColors.cyan,
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
                                                  ? Colors.white70
                                                  : AppColors.textSecondary,
                                              height: 1.35,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }

  Widget _getCategoryIcon(String category, bool isUnread) {
    IconData iconData;
    Color color;

    switch (category) {
      case 'workout':
        iconData = Icons.fitness_center;
        color = AppColors.cyan;
        break;
      case 'diet':
        iconData = Icons.restaurant_menu;
        color = AppColors.primary;
        break;
      case 'water':
        iconData = Icons.water_drop_outlined;
        color = AppColors.cyan;
        break;
      case 'cardio':
        iconData = Icons.directions_run;
        color = AppColors.rose;
        break;
      default:
        iconData = Icons.notifications_active_outlined;
        color = AppColors.amber;
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
