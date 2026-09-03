import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/storage/local_cache.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';

class WorkoutExecutionScreen extends StatefulWidget {
  final ApiClient apiClient;
  final int? workoutDayId;
  final int? existingSessionId;

  const WorkoutExecutionScreen({
    super.key,
    required this.apiClient,
    this.workoutDayId,
    this.existingSessionId,
  });

  @override
  State<WorkoutExecutionScreen> createState() => _WorkoutExecutionScreenState();
}

class _WorkoutExecutionScreenState extends State<WorkoutExecutionScreen> {
  Map<String, dynamic>? _session;
  bool _isLoading = true;
  late final LocalCache _localCache;
  Timer? _workoutTimer;
  int _elapsedSeconds = 0;

  String get _activeSessionCacheKey {
    final userId = widget.apiClient.authSession.currentUser?.id;
    return 'active_workout_session.${userId ?? 'anonymous'}';
  }

  String get _formattedTimer {
    final m = (_elapsedSeconds ~/ 60).toString().padLeft(2, '0');
    final s = (_elapsedSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  void initState() {
    super.initState();
    _localCache = LocalCache(widget.apiClient.authSession.storage);
    _workoutTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {
          _elapsedSeconds++;
        });
      }
    });
    _startOrResumeSession();
  }

  @override
  void dispose() {
    _workoutTimer?.cancel();
    super.dispose();
  }

  Future<void> _persistSessionLocally(Map<String, dynamic>? session) async {
    if (session == null) return;
    try {
      await _localCache.writeJson(_activeSessionCacheKey, session);
    } catch (_) {}
  }

  Future<void> _clearLocalSession() async {
    try {
      await _localCache.delete(_activeSessionCacheKey);
    } catch (_) {}
  }

  Future<void> _startOrResumeSession() async {
    setState(() => _isLoading = true);

    // Try restoring locally cached active session first
    try {
      final cached = await _localCache.readJson(_activeSessionCacheKey);
      final cachedId = cached is Map<String, dynamic> ? cached['id'] : null;
      final canRestoreCached = cached is Map<String, dynamic> &&
          (widget.existingSessionId == null ||
              cachedId?.toString() == widget.existingSessionId.toString());
      if (canRestoreCached && mounted) {
        setState(() {
          _session = cached;
        });
      }
    } catch (_) {}

    try {
      Map<String, dynamic> res;
      if (widget.existingSessionId != null) {
        final raw = await widget.apiClient
            .get('/me/workouts/${widget.existingSessionId}');
        res = (raw is Map<String, dynamic> && raw['data'] != null)
            ? raw['data'] as Map<String, dynamic>
            : (raw as Map<String, dynamic>);
      } else {
        final raw = await widget.apiClient.post('/me/workouts/start', body: {
          if (widget.workoutDayId != null)
            'workoutPlanDayId': widget.workoutDayId,
        });
        res = (raw is Map<String, dynamic> && raw['data'] != null)
            ? raw['data'] as Map<String, dynamic>
            : (raw as Map<String, dynamic>);
      }

      // Populate previous performance if missing from exercises
      final exercises = List<Map<String, dynamic>>.from(
        (res['exercises'] as List<dynamic>? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map)),
      );

      for (final ex in exercises) {
        final hasPrev = ex['previous_performance'] != null ||
            ex['previousPerformance'] != null ||
            ex['last_session_performance'] != null;
        final exerciseId = ex['exercise_id'] ?? ex['exerciseId'];
        if (!hasPrev && exerciseId != null) {
          try {
            final perfRaw = await widget.apiClient
                .get('/me/exercises/$exerciseId/previous-performance');
            if (perfRaw is Map<String, dynamic>) {
              final perfData = perfRaw['data'] != null &&
                      perfRaw['data'] is Map<String, dynamic>
                  ? perfRaw['data'] as Map<String, dynamic>
                  : perfRaw;
              ex['previous_performance'] = perfData;
            }
          } catch (_) {}
        }
      }
      res['exercises'] = exercises;

      await _persistSessionLocally(res);

      if (mounted) {
        setState(() {
          _session = res;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        if (_session == null) {
          showPremiumSnackBar(context, 'Failed to load session: $e',
              isError: true);
        }
      }
    }
  }

  Future<void> _logSet({
    required int sessionExerciseId,
    required int setNum,
    required String trackingType,
    String setType = 'working',
    double? weight,
    int? reps,
    int? durationSeconds,
    double? distanceMeters,
    String? notes,
  }) async {
    if (_session == null) return;

    final body = <String, dynamic>{
      'sessionExerciseId': sessionExerciseId,
      'setNumber': setNum,
      'setType': setType,
      'completed': true,
    };

    switch (trackingType) {
      case 'duration':
      case 'time_only':
        if (durationSeconds != null) body['durationSeconds'] = durationSeconds;
        break;
      case 'distance_duration':
        if (durationSeconds != null) body['durationSeconds'] = durationSeconds;
        if (distanceMeters != null) body['distanceMeters'] = distanceMeters;
        break;
      case 'distance':
        if (distanceMeters != null) body['distanceMeters'] = distanceMeters;
        break;
      case 'weight_duration':
        if (weight != null) body['weightKg'] = weight;
        if (durationSeconds != null) body['durationSeconds'] = durationSeconds;
        break;
      case 'reps_only':
      case 'bodyweight_reps':
        if (reps != null) body['reps'] = reps;
        break;
      case 'weight_reps':
      default:
        if (weight != null) body['weightKg'] = weight;
        if (reps != null) body['reps'] = reps;
        break;
    }

    if (notes != null && notes.isNotEmpty) {
      body['notes'] = notes;
    }

    try {
      final updated = await widget.apiClient.post(
        '/me/workouts/${_session!['id']}/sets',
        body: body,
      );
      final sessionData =
          (updated is Map<String, dynamic> && updated['data'] != null)
              ? updated['data'] as Map<String, dynamic>
              : (updated is Map<String, dynamic> ? updated : _session);
      await _persistSessionLocally(sessionData);
      if (mounted) {
        setState(() {
          _session = sessionData;
        });
      }
    } on OfflineOperationQueued catch (_) {
      final exercises = List<Map<String, dynamic>>.from(
        (_session?['exercises'] as List<dynamic>? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map)),
      );
      for (final ex in exercises) {
        if (ex['id'] == sessionExerciseId) {
          final sets = List<Map<String, dynamic>>.from(
            (ex['sets'] as List<dynamic>? ?? [])
                .map((s) => Map<String, dynamic>.from(s as Map)),
          );
          final existingIdx = sets
              .indexWhere((s) => (s['set_number'] ?? s['setNumber']) == setNum);
          final newSet = {
            'set_number': setNum,
            'set_type': setType,
            if (weight != null) 'weight_kg': weight,
            if (reps != null) 'reps': reps,
            if (durationSeconds != null) 'duration_seconds': durationSeconds,
            if (distanceMeters != null) 'distance_meters': distanceMeters,
            if (notes != null) 'notes': notes,
            'completed': 1,
          };
          if (existingIdx >= 0) {
            sets[existingIdx] = newSet;
          } else {
            sets.add(newSet);
          }
          ex['sets'] = sets;
        }
      }
      final updatedSession = Map<String, dynamic>.from(_session ?? {});
      updatedSession['exercises'] = exercises;
      await _persistSessionLocally(updatedSession);
      if (mounted) {
        setState(() {
          _session = updatedSession;
        });
        showPremiumSnackBar(
          context,
          'Set saved offline. Will sync when online.',
        );
      }
    } catch (e) {
      if (mounted) {
        showPremiumSnackBar(context, 'Failed to log set: $e', isError: true);
      }
    }
  }

  Future<void> _showFinishWorkoutDialog() async {
    if (_session == null) return;
    final exercises = (_session?['exercises'] as List<dynamic>? ?? []);

    final totalCompletedSets = exercises.fold<int>(0, (sum, ex) {
      final sets = (ex['sets'] as List<dynamic>? ?? []);
      return sum +
          sets
              .where((s) => s['completed'] == 1 || s['completed'] == true)
              .length;
    });
    final canFinish = exercises.isEmpty || totalCompletedSets > 0;

    final notesController = TextEditingController();
    final colors = AppThemeColors.of(context);
    int? selectedRating;

    await showPremiumDialog(
      context: context,
      title: 'Finish Workout',
      content: StatefulBuilder(
        builder: (context, setDialogState) {
          return SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (totalCompletedSets == 0) ...[
                  Container(
                    padding: const EdgeInsets.all(8),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: colors.amberMuted,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                          color: colors.amber.withValues(alpha: 0.4)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.info_outline,
                            color: colors.amber, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'No completed sets recorded in this session.',
                            style:
                                TextStyle(fontSize: 12, color: colors.amber),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    'Log at least one completed set before finishing.',
                    style: TextStyle(fontSize: 12, color: colors.textMuted),
                  ),
                ],
                const Text(
                  'Great work! Rate this session or leave any workout notes before finishing.',
                ),
                const SizedBox(height: 16),
                const Text('Rating (optional):',
                    style:
                        TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(5, (index) {
                    final starValue = index + 1;
                    final isSelected =
                        selectedRating != null && starValue <= selectedRating!;
                    return PremiumIconButton(
                      icon: isSelected ? Icons.star : Icons.star_border,
                      color: isSelected ? colors.amber : colors.textMuted,
                      size: 28,
                      onPressed: () {
                        setDialogState(() {
                          selectedRating =
                              (selectedRating == starValue) ? null : starValue;
                        });
                      },
                    );
                  }),
                ),
                const SizedBox(height: 12),
                PremiumTextField(
                  label: 'Session Notes (optional)',
                  controller: notesController,
                  maxLines: 3,
                  textInputAction: TextInputAction.done,
                ),
              ],
            ),
          );
        },
      ),
      actions: [
        PremiumButton(
          text: 'Cancel',
          isSecondary: true,
          onPressed: () => Navigator.pop(context),
        ),
        PremiumButton(
          text: 'Finish Workout',
          onPressed: canFinish
              ? () {
                  final trimmed = notesController.text.trim();
                  Navigator.pop(context);
                  _completeWorkout(
                    notes: trimmed.isNotEmpty ? trimmed : null,
                    rating: selectedRating,
                  );
                }
              : null,
        ),
      ],
    );
  }

  Future<void> _completeWorkout({String? notes, int? rating}) async {
    if (_session == null) return;
    try {
      final payload = <String, dynamic>{};
      if (notes != null && notes.isNotEmpty) {
        payload['notes'] = notes;
      }
      if (rating != null && rating >= 1 && rating <= 5) {
        payload['rating'] = rating;
      }

      await widget.apiClient.post(
        '/me/workouts/${_session!['id']}/complete',
        body: payload,
      );

      await _clearLocalSession();

      if (mounted) {
        showPremiumSnackBar(
          context,
          'Workout session completed! Great job! 🎉',
          isSuccess: true,
        );
        Navigator.pop(context);
      }
    } on OfflineOperationQueued catch (_) {
      await _clearLocalSession();
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Workout completion queued for sync! 🎉',
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        showPremiumSnackBar(
          context,
          'Failed to complete workout: $e',
          isError: true,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    if (_isLoading) {
      return PremiumScaffold(
        body:
            Center(child: CircularProgressIndicator(color: colors.primary)),
      );
    }

    final exercises = (_session?['exercises'] as List<dynamic>? ?? []);
    final totalExercises = exercises.length;
    final completedExercises = exercises.where((e) {
      final sList = (e['sets'] as List<dynamic>? ?? []);
      final targetS = e['planned_sets'] ?? e['plannedSets'] ?? e['target_sets'] ?? e['targetSets'];
      final targetCount = targetS is int
          ? targetS
          : (int.tryParse(targetS?.toString() ?? '') ?? sList.length);
      final doneSets =
          sList.where((s) => s['completed'] == 1 || s['completed'] == true).length;
      return targetCount > 0 && doneSets >= targetCount;
    }).length;

    return PremiumScaffold(
      appBar: PremiumAppBar(
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.pop(context),
          tooltip: 'Exit Workout',
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Live Workout Tracker',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 1,
                color: colors.textSecondary,
              ),
            ),
            Text(
              _session?['workout_name_snapshot'] as String? ?? 'Workout Session',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: colors.textPrimary,
              ),
            ),
          ],
        ),
        actions: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              color: colors.surfaceElevated,
              borderRadius: BorderRadius.circular(AppRadii.full),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.timer, size: 14, color: colors.primary),
                const SizedBox(width: 4),
                Text(
                  _formattedTimer,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    fontFeatures: const [FontFeature.tabularFigures()],
                    color: colors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: PremiumButton(
              text: 'Finish',
              onPressed: _showFinishWorkoutDialog,
              icon: const Icon(Icons.check, size: 16),
              height: 34,
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: PremiumButton(
            text: 'Complete Workout',
            icon: const Icon(Icons.done_all, size: 18),
            onPressed: _showFinishWorkoutDialog,
            height: 50,
          ),
        ),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: exercises.length + 1,
        itemBuilder: (ctx, idx) {
          if (idx == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Progress',
                        style: TextStyle(
                          fontSize: 14,
                          color: colors.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        '$completedExercises / $totalExercises Exercises',
                        style: TextStyle(
                          fontSize: 14,
                          color: colors.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: List.generate(
                        totalExercises > 0 ? totalExercises : 1, (i) {
                      final isFinished = i < completedExercises;
                      final isCurrent = i == completedExercises;
                      return Expanded(
                        child: Container(
                          height: 6,
                          margin: EdgeInsets.only(
                              right: i < totalExercises - 1 ? 4 : 0),
                          decoration: BoxDecoration(
                            color: isFinished
                                ? colors.primary
                                : (isCurrent
                                    ? colors.primary.withValues(alpha: 0.4)
                                    : colors.surfaceElevated),
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      );
                    }),
                  ),
                ],
              ),
            );
          }

          final ex = exercises[idx - 1] as Map<String, dynamic>;
          final sets = (ex['sets'] as List<dynamic>? ?? []);
          final trackingType =
              (ex['tracking_type'] ?? ex['trackingType'] ?? 'weight_reps')
                  .toString();

          final dynamic rawPlannedSets = ex['planned_sets'] ??
              ex['plannedSets'] ??
              ex['target_sets'] ??
              ex['targetSets'];
          final int? plannedSets = rawPlannedSets is int
              ? rawPlannedSets
              : (rawPlannedSets != null
                  ? int.tryParse(rawPlannedSets.toString())
                  : null);

          // If plannedSets is absent and sets is empty -> totalSets = 0 (clear unconfigured state)
          final totalSets = plannedSets != null
              ? (sets.length > plannedSets ? sets.length : plannedSets)
              : sets.length;

          final repsMin = ex['reps_min_target'] ??
              ex['planned_reps_min_snapshot'] ??
              ex['target_reps_min'] ??
              ex['target_reps'] ??
              ex['targetReps'];
          final repsMax = ex['reps_max_target'] ??
              ex['planned_reps_max_snapshot'] ??
              ex['target_reps_max'];
          String targetRepsDesc = '';
          if (repsMin != null && repsMax != null) {
            if (repsMin == repsMax) {
              targetRepsDesc = '$repsMin reps';
            } else {
              targetRepsDesc = '$repsMin-$repsMax reps';
            }
          } else if (repsMin != null) {
            targetRepsDesc = '$repsMin+ reps';
          } else if (repsMax != null) {
            targetRepsDesc = 'Up to $repsMax reps';
          }

          final targetHeader = plannedSets != null
              ? (targetRepsDesc.isNotEmpty
                  ? 'Target: $plannedSets Sets × $targetRepsDesc'
                  : 'Target: $plannedSets Sets')
              : (targetRepsDesc.isNotEmpty ? 'Target: $targetRepsDesc' : '');

          final dynamic prevPerf = ex['previous_performance'] ??
              ex['previousPerformance'] ??
              ex['last_session_performance'] ??
              ex['history'];
          final Map? prevPerfMap = prevPerf is Map ? prevPerf : null;
          String? prevPerfDesc;
          if (prevPerf is Map) {
            final maxW = prevPerf['maxWeightKg'] ??
                prevPerf['max_weight_kg'] ??
                prevPerf['weight_kg'] ??
                prevPerf['weightKg'];
            final recentSets = prevPerf['recentSets'] as List<dynamic>?;
            if (recentSets != null && recentSets.isNotEmpty) {
              final first = recentSets.first as Map<String, dynamic>;
              final fw = first['weight_kg'] ?? first['weightKg'];
              final fr = first['reps'];
              prevPerfDesc =
                  'Last session: ${fw != null ? '$fw kg' : ''}${fw != null && fr != null ? ' × ' : ''}${fr != null ? '$fr reps' : ''}';
            } else if (prevPerf['weight_kg'] != null ||
                prevPerf['weightKg'] != null ||
                prevPerf['reps'] != null) {
              final pw = prevPerf['weight_kg'] ?? prevPerf['weightKg'];
              final pr = prevPerf['reps'];
              prevPerfDesc =
                  'Last session: ${pw != null ? '$pw kg' : ''}${pw != null && pr != null ? ' × ' : ''}${pr != null ? '$pr reps' : ''}';
            } else if (maxW != null) {
              prevPerfDesc = 'Previous Best: $maxW kg';
            }
          } else if (prevPerf is String && prevPerf.isNotEmpty) {
            prevPerfDesc = 'Last session: $prevPerf';
          }

          final isExerciseCompleted = plannedSets != null &&
              plannedSets > 0 &&
              sets.where((s) => s is Map && (s['completed'] == 1 || s['completed'] == true)).length >=
                  plannedSets;

          return Container(
            margin: const EdgeInsets.only(bottom: 16),
            child: PremiumCard(
              padding: const EdgeInsets.all(18),
              ambientGlow: !isExerciseCompleted,
              border: BorderSide(
                color: isExerciseCompleted
                    ? colors.border
                    : colors.primary.withValues(alpha: 0.3),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: isExerciseCompleted
                              ? colors.surfaceElevated
                              : colors.primary.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isExerciseCompleted
                                ? colors.border
                                : colors.primary.withValues(alpha: 0.25),
                          ),
                        ),
                        child: Center(
                          child: Icon(
                            isExerciseCompleted
                                ? Icons.check
                                : Icons.fitness_center,
                            color: colors.primary,
                            size: 22,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              ex['exercise_name'] ??
                                  ex['exerciseName'] ??
                                  'Exercise',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.bold,
                                decoration: isExerciseCompleted
                                    ? TextDecoration.lineThrough
                                    : null,
                                color: isExerciseCompleted
                                    ? colors.textMuted
                                    : colors.textPrimary,
                              ),
                            ),
                            if (targetHeader.isNotEmpty) ...[
                              const SizedBox(height: 3),
                              Text(
                                targetHeader,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: colors.textSecondary,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                            if (prevPerfDesc != null) ...[
                              const SizedBox(height: 2),
                              Text(
                                prevPerfDesc,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: colors.primary.withValues(alpha: 0.8),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (totalSets == 0) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: colors.surfaceElevated,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: colors.border),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              'No planned sets configured.',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  color: colors.textMuted, fontSize: 13),
                            ),
                          ),
                          const SizedBox(width: 8),
                          PremiumButton(
                            key: Key('add_set_button_${ex['id']}'),
                            text: 'Add Set',
                            onPressed: () {
                              _showLogSetDialog(
                                exercise: ex,
                                setNumber: 1,
                                trackingType: trackingType,
                                previousPerformance: prevPerfMap,
                              );
                            },
                            icon: const Icon(Icons.add, size: 16),
                            height: 32,
                          ),
                        ],
                      ),
                    ),
                  ] else ...[
                    ...List.generate(totalSets, (sIdx) {
                      final setNum = sIdx + 1;
                      Map<String, dynamic>? loggedSet;
                      for (final s in sets) {
                        if (s is Map &&
                            (s['set_number'] ?? s['setNumber']) == setNum) {
                          loggedSet = Map<String, dynamic>.from(s);
                          break;
                        }
                      }
                      final isDone = loggedSet != null &&
                          (loggedSet['completed'] == 1 ||
                              loggedSet['completed'] == true);

                      String completedSummary = '—';
                      if (isDone) {
                        if (trackingType == 'duration' ||
                            trackingType == 'time_only') {
                          final dur = loggedSet['duration_seconds'] ??
                              loggedSet['durationSeconds'] ??
                              0;
                          completedSummary = '$dur s';
                        } else if (trackingType == 'distance_duration') {
                          final dur = loggedSet['duration_seconds'] ??
                              loggedSet['durationSeconds'] ??
                              0;
                          final dist = loggedSet['distance_meters'] ??
                              loggedSet['distanceMeters'] ??
                              0;
                          completedSummary = '$dist m in $dur s';
                        } else if (trackingType == 'distance') {
                          final dist = loggedSet['distance_meters'] ??
                              loggedSet['distanceMeters'] ??
                              0;
                          completedSummary = '$dist m';
                        } else if (trackingType == 'weight_duration') {
                          final weight = loggedSet['weight_kg'] ??
                              loggedSet['weightKg'] ??
                              0;
                          final dur = loggedSet['duration_seconds'] ??
                              loggedSet['durationSeconds'] ??
                              0;
                          completedSummary = '$weight kg in $dur s';
                        } else if (trackingType == 'reps_only' ||
                            trackingType == 'bodyweight_reps') {
                          completedSummary = '${loggedSet['reps'] ?? 0} reps';
                        } else {
                          completedSummary =
                              '${loggedSet['weight_kg'] ?? loggedSet['weightKg'] ?? 0} kg × ${loggedSet['reps'] ?? 0} reps';
                        }
                      }

                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: isDone
                              ? colors.primaryMuted
                              : colors.surfaceElevated,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                              color: isDone
                                  ? colors.primary.withValues(alpha: 0.35)
                                  : colors.border),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Set $setNum',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold, fontSize: 13)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                isDone ? completedSummary : '—',
                                textAlign: TextAlign.center,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                    fontWeight: isDone
                                        ? FontWeight.w600
                                        : FontWeight.normal,
                                    color: isDone
                                        ? colors.textPrimary
                                        : colors.textMuted),
                              ),
                            ),
                            const SizedBox(width: 8),
                            PremiumButton(
                              key: Key('log_set_button_${ex['id']}_$setNum'),
                              text: isDone ? 'Edit' : 'Log Set',
                              isSecondary: isDone,
                              onPressed: () {
                                _showLogSetDialog(
                                  exercise: ex,
                                  setNumber: setNum,
                                  trackingType: trackingType,
                                  loggedSet: loggedSet,
                                  previousPerformance: prevPerfMap,
                                );
                              },
                              height: 30,
                            ),
                          ],
                        ),
                      );
                    }),
                    if (sets.length >= totalSets && totalSets > 0) ...[
                      Align(
                        alignment: Alignment.centerRight,
                        child: PremiumButton(
                          key: Key('add_extra_set_button_${ex['id']}'),
                          text: 'Add Extra Set',
                          isSecondary: true,
                          icon: const Icon(Icons.add, size: 14),
                          onPressed: () {
                            _showLogSetDialog(
                              exercise: ex,
                              setNumber: sets.length + 1,
                              trackingType: trackingType,
                              previousPerformance: prevPerfMap,
                            );
                          },
                          height: 30,
                        ),
                      ),
                    ],
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _showLogSetDialog({
    required Map<String, dynamic> exercise,
    required int setNumber,
    required String trackingType,
    Map<String, dynamic>? loggedSet,
    Map? previousPerformance,
  }) {
    final dynamic loggedWeight =
        loggedSet?['weight_kg'] ?? loggedSet?['weightKg'];
    final dynamic targetWeight = exercise['target_weight_kg'] ??
        exercise['targetWeightKg'] ??
        exercise['planned_weight_kg'] ??
        exercise['plannedWeightKg'] ??
        previousPerformance?['weight_kg'] ??
        previousPerformance?['weightKg'] ??
        previousPerformance?['maxWeightKg'];

    final dynamic loggedReps = loggedSet?['reps'];
    final dynamic targetReps = exercise['reps_min_target'] ??
        exercise['planned_reps_min_snapshot'] ??
        exercise['target_reps_min'] ??
        exercise['target_reps'] ??
        exercise['targetReps'] ??
        exercise['reps_max_target'] ??
        exercise['planned_reps_max_snapshot'] ??
        previousPerformance?['reps'];

    final dynamic loggedDuration =
        loggedSet?['duration_seconds'] ?? loggedSet?['durationSeconds'];
    final dynamic loggedDistance =
        loggedSet?['distance_meters'] ?? loggedSet?['distanceMeters'];

    String initialWeight = '';
    if (loggedWeight != null) {
      initialWeight = (loggedWeight is num)
          ? (loggedWeight % 1 == 0
              ? loggedWeight.toInt().toString()
              : loggedWeight.toString())
          : loggedWeight.toString();
    } else if (targetWeight != null) {
      initialWeight = (targetWeight is num)
          ? (targetWeight % 1 == 0
              ? targetWeight.toInt().toString()
              : targetWeight.toString())
          : targetWeight.toString();
    }

    String initialReps = '';
    if (loggedReps != null) {
      initialReps = loggedReps.toString();
    } else if (targetReps != null) {
      initialReps = targetReps.toString();
    }

    final initialDuration = loggedDuration?.toString() ?? '';
    final initialDistance = loggedDistance?.toString() ?? '';

    final weightCtrl = TextEditingController(text: initialWeight);
    final repsCtrl = TextEditingController(text: initialReps);
    final durationCtrl = TextEditingController(text: initialDuration);
    final distanceCtrl = TextEditingController(text: initialDistance);

    final repsFocus = FocusNode();

    String? weightError;
    String? repsError;
    String? distanceError;
    String? durationError;

    final isDurationTracking = trackingType == 'duration' ||
        trackingType == 'time_only' ||
        trackingType == 'distance_duration' ||
        trackingType == 'weight_duration';
    final isDistanceTracking =
        trackingType == 'distance' || trackingType == 'distance_duration';
    final isWeightTracking = trackingType == 'weight_reps' ||
        trackingType == 'weight_duration' ||
        trackingType == 'custom';
    final isRepTracking = trackingType == 'weight_reps' ||
        trackingType == 'reps_only' ||
        trackingType == 'bodyweight_reps' ||
        trackingType == 'custom';

    showPremiumDialog(
      context: context,
      builder: (ctx) {
        final dialogColors = AppThemeColors.of(ctx);
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            return AlertDialog(
              backgroundColor: dialogColors.card,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadii.xl),
                side: BorderSide(color: dialogColors.border),
              ),
              title: Text(
                loggedSet != null
                    ? 'Edit Set $setNumber'
                    : 'Log Set $setNumber',
                style: TextStyle(
                  color: dialogColors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (isWeightTracking) ...[
                      PremiumTextField(
                        key: const Key('set_dialog_weight_input'),
                        label: 'Weight (kg)',
                        hint: targetWeight != null ? '$targetWeight kg' : '0.0',
                        controller: weightCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        textInputAction: TextInputAction.next,
                        onSubmitted: (_) {
                          FocusScope.of(context).requestFocus(repsFocus);
                        },
                        errorText: weightError,
                        onChanged: (_) {
                          if (weightError != null) {
                            setDialogState(() => weightError = null);
                          }
                        },
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (isRepTracking) ...[
                      PremiumTextField(
                        key: const Key('set_dialog_reps_input'),
                        label: 'Reps Completed',
                        hint: targetReps != null ? '$targetReps' : 'e.g. 10',
                        controller: repsCtrl,
                        focusNode: repsFocus,
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.done,
                        errorText: repsError,
                        onChanged: (_) {
                          if (repsError != null) {
                            setDialogState(() => repsError = null);
                          }
                        },
                      ),
                    ],
                    if (isDistanceTracking) ...[
                      PremiumTextField(
                        key: const Key('set_dialog_distance_input'),
                        label: 'Distance (meters)',
                        hint: 'e.g. 1000',
                        controller: distanceCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        textInputAction: TextInputAction.next,
                        errorText: distanceError,
                        onChanged: (_) {
                          if (distanceError != null) {
                            setDialogState(() => distanceError = null);
                          }
                        },
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (isDurationTracking) ...[
                      PremiumTextField(
                        key: const Key('set_dialog_duration_input'),
                        label: 'Duration (seconds)',
                        hint: 'e.g. 60',
                        controller: durationCtrl,
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.done,
                        errorText: durationError,
                        onChanged: (_) {
                          if (durationError != null) {
                            setDialogState(() => durationError = null);
                          }
                        },
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                PremiumButton(
                  key: const Key('set_dialog_cancel_button'),
                  text: 'Cancel',
                  isSecondary: true,
                  onPressed: () => Navigator.pop(ctx),
                ),
                PremiumButton(
                  key: const Key('set_dialog_save_button'),
                  text: 'Save Set',
                  onPressed: () {
                    int? parsedReps;
                    double? parsedWeight;
                    int? parsedDuration;
                    double? parsedDistance;

                    if (isDurationTracking) {
                      final durText = durationCtrl.text.trim();
                      parsedDuration = int.tryParse(durText);
                      if (parsedDuration == null || parsedDuration < 1) {
                        setDialogState(() {
                          durationError = 'Please enter valid duration seconds';
                        });
                        return;
                      }
                    }

                    if (isDistanceTracking) {
                      final distanceText = distanceCtrl.text.trim();
                      parsedDistance = double.tryParse(distanceText);
                      if (parsedDistance == null || parsedDistance < 0) {
                        setDialogState(() {
                          distanceError = 'Please enter a valid distance';
                        });
                        return;
                      }
                    }

                    if (isRepTracking) {
                      final repsText = repsCtrl.text.trim();
                      parsedReps = int.tryParse(repsText);
                      if (parsedReps == null || parsedReps < 1) {
                        setDialogState(() {
                          repsError = 'Please enter at least 1 rep';
                        });
                        return;
                      }

                      if (isWeightTracking) {
                        final weightText = weightCtrl.text.trim();
                        if (weightText.isNotEmpty) {
                          parsedWeight = double.tryParse(weightText);
                          if (parsedWeight == null || parsedWeight < 0) {
                            setDialogState(() {
                              weightError = 'Please enter a valid weight';
                            });
                            return;
                          }
                        }
                      }
                    }

                    Navigator.pop(ctx);
                    _logSet(
                      sessionExerciseId: exercise['id'] as int,
                      setNum: setNumber,
                      trackingType: trackingType,
                      weight: parsedWeight,
                      reps: parsedReps,
                      durationSeconds: parsedDuration,
                      distanceMeters: parsedDistance,
                    );
                  },
                ),
              ],
            );
          },
        );
      },
    );
  }
}
