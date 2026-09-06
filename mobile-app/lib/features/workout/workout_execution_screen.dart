import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/storage/local_cache.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';

class WorkoutExecutionScreen extends StatefulWidget {
  final ApiClient apiClient;
  final int? workoutDayId;
  final int? existingSessionId;
  final bool isReadOnly;

  const WorkoutExecutionScreen({
    super.key,
    required this.apiClient,
    this.workoutDayId,
    this.existingSessionId,
    this.isReadOnly = false,
  });

  @override
  State<WorkoutExecutionScreen> createState() => _WorkoutExecutionScreenState();
}

class _WorkoutExecutionScreenState extends State<WorkoutExecutionScreen> {
  Map<String, dynamic>? _session;
  bool _isLoading = true;

  bool get _isSessionCompleted =>
      widget.isReadOnly ||
      _session?['status'] == 'completed' ||
      _session?['status'] == 'finished';
  late final LocalCache _localCache;
  Timer? _sessionTimer;
  int _sessionSeconds = 0;
  Timer? _restTimer;
  int _restSecondsRemaining = 0;

  final Map<String, TextEditingController> _inlineWeightControllers = {};
  final Map<String, TextEditingController> _inlineRepsControllers = {};
  final Map<String, TextEditingController> _inlineDurationControllers = {};
  final Map<String, TextEditingController> _inlineDistanceControllers = {};
  final Map<int, int> _extraSetsCount = {};

  String get _activeSessionCacheKey {
    final userId = widget.apiClient.authSession.currentUser?.id;
    return 'active_workout_session.${userId ?? 'anonymous'}';
  }

  @override
  void initState() {
    super.initState();
    _localCache = LocalCache(widget.apiClient.authSession.storage);
    if (!widget.isReadOnly) {
      _startSessionTimer();
    }
    _startOrResumeSession();
  }

  @override
  void dispose() {
    _sessionTimer?.cancel();
    _restTimer?.cancel();
    for (final c in _inlineWeightControllers.values) {
      c.dispose();
    }
    for (final c in _inlineRepsControllers.values) {
      c.dispose();
    }
    for (final c in _inlineDurationControllers.values) {
      c.dispose();
    }
    for (final c in _inlineDistanceControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _startSessionTimer() {
    _sessionTimer?.cancel();
    _sessionTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (mounted) {
        setState(() {
          _sessionSeconds++;
        });
      }
    });
  }

  void _startRestTimer([int durationSeconds = 90]) {
    _restTimer?.cancel();
    setState(() => _restSecondsRemaining = durationSeconds);
    _restTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      if (_restSecondsRemaining <= 1) {
        t.cancel();
        setState(() => _restSecondsRemaining = 0);
        showPremiumSnackBar(context, 'Rest complete! Ready for next set 💪', isSuccess: true);
      } else {
        setState(() => _restSecondsRemaining--);
      }
    });
  }

  String _formatDuration(int totalSeconds) {
    final m = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final s = (totalSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  String _formatPerfWeight(dynamic val) {
    if (val == null) return '';
    if (val is double) return val.toString();
    final d = double.tryParse(val.toString());
    if (d != null && d % 1 == 0 && !val.toString().endsWith('.0')) {
      return d.toInt().toString();
    }
    return val.toString();
  }

  String _formatNum(dynamic val) {
    if (val == null) return '';
    final n = num.tryParse(val.toString());
    if (n == null) return val.toString();
    return (n % 1 == 0) ? n.toInt().toString() : n.toString();
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
        if (res['duration_seconds'] != null) {
          final d = res['duration_seconds'];
          _sessionSeconds = d is int ? d : (int.tryParse(d.toString()) ?? _sessionSeconds);
        } else if (res['started_at'] != null && res['completed_at'] != null) {
          try {
            final start = DateTime.parse(res['started_at'].toString());
            final end = DateTime.parse(res['completed_at'].toString());
            _sessionSeconds = end.difference(start).inSeconds;
          } catch (_) {}
        }
        final isCompleted = widget.isReadOnly ||
            res['status'] == 'completed' ||
            res['status'] == 'finished';
        if (isCompleted) {
          _sessionTimer?.cancel();
        }
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
    int? rir,
    int? durationSeconds,
    double? distanceMeters,
    String? notes,
  }) async {
    if (_session == null || _isSessionCompleted) return;

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
        if (rir != null) body['rir'] = rir;
        break;
      case 'weight_reps':
      default:
        if (weight != null) body['weightKg'] = weight;
        if (reps != null) body['reps'] = reps;
        if (rir != null) body['rir'] = rir;
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
            if (rir != null) 'rir': rir,
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
    if (_session == null || _isSessionCompleted) return;
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
          key: const Key('confirm_finish_workout_button'),
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
        body: Center(child: CircularProgressIndicator(color: colors.primary)),
      );
    }

    final exercises = (_session?['exercises'] as List<dynamic>? ?? []);
    final workoutName = _session?['workout_name_snapshot'] as String? ??
        _session?['name'] as String? ??
        'Active Workout';

    int completedExercises = 0;
    for (final ex in exercises) {
      final sets = (ex['sets'] as List<dynamic>? ?? []);
      final hasCompletedSet = sets.any((s) => s['completed'] == 1 || s['completed'] == true);
      if (hasCompletedSet) completedExercises++;
    }

    return PremiumScaffold(
      appBar: PremiumAppBar(
        leading: IconButton(
          icon: Icon(Icons.close_rounded, color: colors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _isSessionCompleted ? 'Workout Completed' : 'Live Workout Tracker',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.0,
                color: _isSessionCompleted ? colors.emerald : colors.primary,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              workoutName,
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w900,
                color: colors.textPrimary,
                letterSpacing: -0.3,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 8),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: colors.surfaceElevated,
              borderRadius: BorderRadius.circular(AppRadii.full),
              border: Border.all(
                color: _isSessionCompleted
                    ? colors.emerald.withValues(alpha: 0.35)
                    : (colors.isDark ? Colors.white.withValues(alpha: 0.08) : colors.border),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _isSessionCompleted ? Icons.check_circle_rounded : Icons.timer_outlined,
                  size: 14,
                  color: _isSessionCompleted ? colors.emerald : colors.cyan,
                ),
                const SizedBox(width: 4),
                Text(
                  _formatDuration(_sessionSeconds),
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: _isSessionCompleted ? colors.emerald : colors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          if (_isSessionCompleted)
            Container(
              margin: const EdgeInsets.only(right: 12),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: colors.emeraldMuted,
                borderRadius: BorderRadius.circular(AppRadii.full),
                border: Border.all(color: colors.emerald.withValues(alpha: 0.35)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.lock_rounded, size: 13, color: colors.emerald),
                  const SizedBox(width: 4),
                  Text(
                    'Finalized',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: colors.emerald,
                    ),
                  ),
                ],
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: PremiumButton(
                text: 'Finish',
                onPressed: _showFinishWorkoutDialog,
                icon: const Icon(Icons.check_circle_rounded, size: 16),
                height: 34,
              ),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          // Workout Progress Overview Card (Stitch Active Workout Segmented Progress)
          PremiumCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Text(
                        'PROGRESS',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
                          color: colors.textSecondary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        '$completedExercises of ${exercises.length} Exercises',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.end,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: colors.emerald,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: LinearProgressIndicator(
                    value: exercises.isNotEmpty ? completedExercises / exercises.length : 0.0,
                    backgroundColor: colors.surfaceElevated,
                    valueColor: AlwaysStoppedAnimation<Color>(colors.emerald),
                    minHeight: 6,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Exercises List
          ...List.generate(exercises.length, (idx) {
            final ex = exercises[idx] as Map<String, dynamic>;
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

            final baseSets = plannedSets != null
                ? (sets.length > plannedSets ? sets.length : plannedSets)
                : sets.length;
            final extraCount = _extraSetsCount[ex['id'] as int] ?? 0;
            final totalSets = max(baseSets, extraCount);

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
              targetRepsDesc = repsMin == repsMax ? '$repsMin reps' : '$repsMin-$repsMax reps';
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

            final prevPerf = ex['previous_performance'] ??
                ex['previousPerformance'] ??
                ex['last_session_performance'] ??
                ex['history'];

            final targetWeight = ex['target_weight_kg'] ??
                ex['targetWeightKg'] ??
                ex['planned_weight_kg'] ??
                ex['plannedWeightKg'] ??
                (prevPerf is Map
                    ? (prevPerf['weight_kg'] ??
                        prevPerf['weightKg'] ??
                        prevPerf['maxWeightKg'])
                    : null);
            final targetReps =
                repsMin ?? repsMax ?? (prevPerf is Map ? prevPerf['reps'] : null);
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
                    'Last session: ${fw != null ? '${_formatPerfWeight(fw)} kg' : ''}${fw != null && fr != null ? ' × ' : ''}${fr != null ? '${_formatNum(fr)} reps' : ''}';
              } else if (prevPerf['weight_kg'] != null ||
                  prevPerf['weightKg'] != null ||
                  prevPerf['reps'] != null) {
                final pw = prevPerf['weight_kg'] ?? prevPerf['weightKg'];
                final pr = prevPerf['reps'];
                prevPerfDesc =
                    'Last session: ${pw != null ? '${_formatPerfWeight(pw)} kg' : ''}${pw != null && pr != null ? ' × ' : ''}${pr != null ? '${_formatNum(pr)} reps' : ''}';
              } else if (maxW != null) {
                prevPerfDesc = 'Previous Best: ${_formatNum(maxW)} kg';
              }
            } else if (prevPerf is String && prevPerf.isNotEmpty) {
              prevPerfDesc = 'Last session: $prevPerf';
            }

            final exerciseName = ex['exercise_name'] ?? ex['exerciseName'] ?? 'Exercise';

            return Container(
              margin: const EdgeInsets.only(bottom: 16),
              child: PremiumCard(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: colors.violetMuted,
                            borderRadius: BorderRadius.circular(AppRadii.md),
                            border: Border.all(
                              color: colors.violet.withValues(alpha: 0.25),
                            ),
                          ),
                          child: Icon(Icons.fitness_center_rounded, color: colors.violet, size: 18),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                exerciseName,
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: colors.textPrimary,
                                ),
                              ),
                              if (targetHeader.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(
                                  targetHeader,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: colors.cyan,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (prevPerfDesc != null) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: colors.amberMuted,
                          borderRadius: BorderRadius.circular(AppRadii.sm),
                          border: Border.all(color: colors.amber.withValues(alpha: 0.35)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.history_rounded, size: 13, color: colors.amber),
                            const SizedBox(width: 5),
                            Flexible(
                              child: Text(
                                prevPerfDesc,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: colors.amber,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 14),

                    if (totalSets == 0) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: colors.surfaceElevated,
                          borderRadius: BorderRadius.circular(AppRadii.md),
                          border: Border.all(color: colors.border),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'No planned sets configured.',
                              style: TextStyle(
                                color: colors.textMuted,
                                fontSize: 13,
                              ),
                            ),
                            if (!_isSessionCompleted)
                              PremiumButton(
                                key: Key('add_set_button_${ex['id']}'),
                                text: 'Add Set',
                                onPressed: () {
                                  setState(() {
                                    _extraSetsCount[ex['id'] as int] = 1;
                                  });
                                },
                                icon: const Icon(Icons.add, size: 16),
                                height: 32,
                              ),
                          ],
                        ),
                      ),
                    ] else ...[
                      _buildTableHeader(trackingType, colors),
                      const SizedBox(height: 4),

                      ...List.generate(totalSets, (sIdx) {
                        final setNum = sIdx + 1;
                        Map<String, dynamic>? loggedSet;
                        for (final s in sets) {
                          if (s is Map && (s['set_number'] ?? s['setNumber']) == setNum) {
                            loggedSet = Map<String, dynamic>.from(s);
                            break;
                          }
                        }

                        return _buildInlineSetRow(
                          exercise: ex,
                          setNum: setNum,
                          trackingType: trackingType,
                          targetWeight: targetWeight,
                          targetReps: targetReps,
                          loggedSet: loggedSet,
                          prevPerf: prevPerf,
                          colors: colors,
                        );
                      }),

                      if (totalSets > 0 && !_isSessionCompleted) ...[
                        const SizedBox(height: 6),
                        Align(
                          alignment: Alignment.centerRight,
                          child: PremiumButton(
                            key: Key('add_extra_set_button_${ex['id']}'),
                            text: 'Add Extra Set',
                            isSecondary: true,
                            icon: const Icon(Icons.add, size: 14),
                            onPressed: () {
                              setState(() {
                                final current = _extraSetsCount[ex['id'] as int] ?? baseSets;
                                _extraSetsCount[ex['id'] as int] = current + 1;
                              });
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
          }),
          const SizedBox(height: 24),
        ],
      ),
      bottomNavigationBar: _isSessionCompleted
          ? Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              decoration: BoxDecoration(
                color: colors.isDark ? const Color(0xFF181818) : Colors.white,
                border: Border(
                  top: BorderSide(
                    color: colors.isDark
                        ? Colors.white.withValues(alpha: 0.08)
                        : colors.border,
                  ),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 48,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: colors.emeraldMuted,
                        borderRadius: BorderRadius.circular(AppRadii.md),
                        border: Border.all(
                          color: colors.emerald.withValues(alpha: 0.35),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.verified_rounded,
                              color: colors.emerald, size: 22),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Workout Completed',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 13,
                                    color: colors.emerald,
                                  ),
                                ),
                                Text(
                                  'Summary is finalized and saved',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: colors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  PremiumButton(
                    text: 'Close',
                    onPressed: () => Navigator.pop(context),
                    height: 48,
                  ),
                ],
              ),
            )
          : Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              decoration: BoxDecoration(
                color: colors.isDark ? const Color(0xFF181818) : Colors.white,
                border: Border(
                  top: BorderSide(
                    color: colors.isDark
                        ? Colors.white.withValues(alpha: 0.08)
                        : colors.border,
                  ),
                ),
              ),
              child: Row(
                children: [
                  // Rest Timer Pill Button
                  InkWell(
                    onTap: () {
                      if (_restSecondsRemaining > 0) {
                        _restTimer?.cancel();
                        setState(() => _restSecondsRemaining = 0);
                      } else {
                        _startRestTimer(90);
                      }
                    },
                    borderRadius: BorderRadius.circular(AppRadii.full),
                    child: Container(
                      height: 48,
                      padding: const EdgeInsets.symmetric(horizontal: 18),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(AppRadii.full),
                        border: Border.all(
                          color: _restSecondsRemaining > 0
                              ? colors.cyan
                              : (colors.isDark
                                  ? Colors.white.withValues(alpha: 0.12)
                                  : colors.border),
                        ),
                        color: _restSecondsRemaining > 0
                            ? colors.cyan.withValues(alpha: 0.12)
                            : (colors.isDark
                                ? const Color(0xFF222222)
                                : colors.surface),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.timer_outlined,
                            size: 18,
                            color: _restSecondsRemaining > 0
                                ? colors.cyan
                                : colors.textSecondary,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _restSecondsRemaining > 0
                                ? 'Rest ${_formatDuration(_restSecondsRemaining)}'
                                : 'Rest 1:30',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                              color: _restSecondsRemaining > 0
                                  ? colors.cyan
                                  : colors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Finish Workout Button
                  Expanded(
                    child: PremiumButton(
                      key: const Key('finish_workout_button'),
                      text: 'Finish Workout',
                      icon: const Icon(Icons.flag_rounded, size: 18),
                      onPressed: _showFinishWorkoutDialog,
                      height: 48,
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  TextEditingController _getWeightCtrl(
      int exId, int setNum, dynamic targetWeight, dynamic loggedWeight) {
    final key = '${exId}_$setNum';
    if (!_inlineWeightControllers.containsKey(key)) {
      String initial = '';
      if (loggedWeight != null) {
        initial = _formatNum(loggedWeight);
      } else if (targetWeight != null) {
        initial = _formatNum(targetWeight);
      }
      _inlineWeightControllers[key] = TextEditingController(text: initial);
    }
    return _inlineWeightControllers[key]!;
  }

  TextEditingController _getRepsCtrl(
      int exId, int setNum, dynamic targetReps, dynamic loggedReps) {
    final key = '${exId}_$setNum';
    if (!_inlineRepsControllers.containsKey(key)) {
      String initial = '';
      if (loggedReps != null) {
        initial = _formatNum(loggedReps);
      } else if (targetReps != null) {
        initial = _formatNum(targetReps);
      }
      _inlineRepsControllers[key] = TextEditingController(text: initial);
    }
    return _inlineRepsControllers[key]!;
  }

  TextEditingController _getDurationCtrl(
      int exId, int setNum, dynamic loggedDuration) {
    final key = '${exId}_$setNum';
    if (!_inlineDurationControllers.containsKey(key)) {
      _inlineDurationControllers[key] =
          TextEditingController(text: loggedDuration?.toString() ?? '');
    }
    return _inlineDurationControllers[key]!;
  }

  TextEditingController _getDistanceCtrl(
      int exId, int setNum, dynamic loggedDistance) {
    final key = '${exId}_$setNum';
    if (!_inlineDistanceControllers.containsKey(key)) {
      _inlineDistanceControllers[key] =
          TextEditingController(text: loggedDistance?.toString() ?? '');
    }
    return _inlineDistanceControllers[key]!;
  }

  Future<void> _handleInlineLogSet({
    required Map<String, dynamic> exercise,
    required int setNumber,
    required String trackingType,
    Map<String, dynamic>? loggedSet,
  }) async {
    if (_isSessionCompleted) return;

    final exId = exercise['id'] as int;
    final isDuration = trackingType == 'duration' ||
        trackingType == 'time_only' ||
        trackingType == 'distance_duration' ||
        trackingType == 'weight_duration';
    final isDistance =
        trackingType == 'distance' || trackingType == 'distance_duration';
    final isWeight = trackingType == 'weight_reps' ||
        trackingType == 'weight_duration' ||
        trackingType == 'custom';
    final isReps = trackingType == 'weight_reps' ||
        trackingType == 'reps_only' ||
        trackingType == 'bodyweight_reps' ||
        trackingType == 'custom';

    final weightCtrl = _inlineWeightControllers['${exId}_$setNumber'];
    final repsCtrl = _inlineRepsControllers['${exId}_$setNumber'];
    final durCtrl = _inlineDurationControllers['${exId}_$setNumber'];
    final distCtrl = _inlineDistanceControllers['${exId}_$setNumber'];

    int? parsedReps;
    double? parsedWeight;
    int? parsedDuration;
    double? parsedDistance;

    if (isDuration) {
      final text = durCtrl?.text.trim() ?? '';
      parsedDuration = int.tryParse(text);
      if (parsedDuration == null || parsedDuration < 1) {
        showPremiumSnackBar(context, 'Please enter valid duration seconds',
            isError: true);
        return;
      }
    }

    if (isDistance) {
      final text = distCtrl?.text.trim() ?? '';
      parsedDistance = double.tryParse(text);
      if (parsedDistance == null || parsedDistance < 0) {
        showPremiumSnackBar(context, 'Please enter a valid distance',
            isError: true);
        return;
      }
    }

    if (isReps) {
      final repsText = repsCtrl?.text.trim() ?? '';
      parsedReps = int.tryParse(repsText);
      if (parsedReps == null || parsedReps < 1) {
        showPremiumSnackBar(context, 'Please enter at least 1 rep',
            isError: true);
        return;
      }

      if (isWeight) {
        final weightText = weightCtrl?.text.trim() ?? '';
        if (weightText.isNotEmpty) {
          parsedWeight = double.tryParse(weightText);
          if (parsedWeight == null || parsedWeight < 0) {
            showPremiumSnackBar(context, 'Please enter a valid weight',
                isError: true);
            return;
          }
        }
      }
    }

    await _logSet(
      sessionExerciseId: exId,
      setNum: setNumber,
      trackingType: trackingType,
      weight: parsedWeight,
      reps: parsedReps,
      rir: null,
      durationSeconds: parsedDuration,
      distanceMeters: parsedDistance,
    );
  }

  Widget _buildTableHeader(String trackingType, AppThemeColors colors) {
    final isWeight = trackingType == 'weight_reps' ||
        trackingType == 'weight_duration' ||
        trackingType == 'custom';
    final isReps = trackingType == 'weight_reps' ||
        trackingType == 'reps_only' ||
        trackingType == 'bodyweight_reps' ||
        trackingType == 'custom';
    final isDuration = trackingType == 'duration' ||
        trackingType == 'time_only' ||
        trackingType == 'distance_duration' ||
        trackingType == 'weight_duration';
    final isDistance =
        trackingType == 'distance' || trackingType == 'distance_duration';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: Row(
        children: [
          SizedBox(
            width: 28,
            child: Text(
              'SET',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.8,
                color: colors.textMuted,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'PREVIOUS',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.8,
                color: colors.textMuted,
              ),
            ),
          ),
          if (isWeight) ...[
            const SizedBox(width: 6),
            SizedBox(
              width: 58,
              child: Text(
                'KG',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                  color: colors.textMuted,
                ),
              ),
            ),
          ],
          if (isReps) ...[
            const SizedBox(width: 6),
            SizedBox(
              width: 52,
              child: Text(
                'REPS',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                  color: colors.textMuted,
                ),
              ),
            ),
          ],
          if (isDuration && !isReps) ...[
            const SizedBox(width: 6),
            SizedBox(
              width: 56,
              child: Text(
                'SEC',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                  color: colors.textMuted,
                ),
              ),
            ),
          ],
          if (isDistance) ...[
            const SizedBox(width: 6),
            SizedBox(
              width: 60,
              child: Text(
                'METERS',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                  color: colors.textMuted,
                ),
              ),
            ),
          ],
          const SizedBox(width: 8),
          SizedBox(
            width: 36,
            child: Center(
              child: Icon(
                Icons.check_rounded,
                size: 16,
                color: colors.textMuted,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInlineSetRow({
    required Map<String, dynamic> exercise,
    required int setNum,
    required String trackingType,
    required dynamic targetWeight,
    required dynamic targetReps,
    required Map<String, dynamic>? loggedSet,
    required dynamic prevPerf,
    required AppThemeColors colors,
  }) {
    final exId = exercise['id'] as int;
    final isDone = loggedSet != null &&
        (loggedSet['completed'] == 1 || loggedSet['completed'] == true);

    final weightCtrl = _getWeightCtrl(
      exId,
      setNum,
      targetWeight,
      loggedSet != null
          ? (loggedSet['weight_kg'] ?? loggedSet['weightKg'])
          : null,
    );
    final repsCtrl = _getRepsCtrl(
      exId,
      setNum,
      targetReps,
      loggedSet != null ? loggedSet['reps'] : null,
    );
    final durCtrl = _getDurationCtrl(
      exId,
      setNum,
      loggedSet != null
          ? (loggedSet['duration_seconds'] ?? loggedSet['durationSeconds'])
          : null,
    );
    final distCtrl = _getDistanceCtrl(
      exId,
      setNum,
      loggedSet != null
          ? (loggedSet['distance_meters'] ?? loggedSet['distanceMeters'])
          : null,
    );

    final isDuration = trackingType == 'duration' ||
        trackingType == 'time_only' ||
        trackingType == 'distance_duration' ||
        trackingType == 'weight_duration';
    final isDistance =
        trackingType == 'distance' || trackingType == 'distance_duration';
    final isWeight = trackingType == 'weight_reps' ||
        trackingType == 'weight_duration' ||
        trackingType == 'custom';
    final isReps = trackingType == 'weight_reps' ||
        trackingType == 'reps_only' ||
        trackingType == 'bodyweight_reps' ||
        trackingType == 'custom';

    // Format previous or target info cleanly without .00
    String prevSummary = '—';
    if (targetWeight != null && targetReps != null) {
      prevSummary =
          '${_formatNum(targetWeight)} kg × ${_formatNum(targetReps)}';
    } else if (targetWeight != null) {
      prevSummary = '${_formatNum(targetWeight)} kg';
    } else if (targetReps != null) {
      prevSummary = '${_formatNum(targetReps)} reps';
    } else if (prevPerf != null &&
        prevPerf is Map &&
        prevPerf['sets'] is List) {
      final prevSets = prevPerf['sets'] as List;
      Map? match;
      for (final s in prevSets) {
        if (s is Map &&
            (s['set_number'] ?? s['setNumber']) == setNum) {
          match = s;
          break;
        }
      }
      if (match != null) {
        final pWeight = match['weight_kg'] ?? match['weightKg'];
        final pReps = match['reps'];
        if (pWeight != null && pReps != null) {
          prevSummary =
              '${_formatNum(pWeight)} kg × ${_formatNum(pReps)}';
        } else if (pReps != null) {
          prevSummary = '${_formatNum(pReps)} reps';
        }
      }
    }

    final inputBg = isDone
        ? colors.emeraldMuted.withValues(alpha: colors.isDark ? 0.22 : 0.65)
        : (colors.isDark ? const Color(0xFF222224) : const Color(0xFFF4F4F5));
    final inputBorder = isDone
        ? colors.emerald.withValues(alpha: 0.35)
        : (colors.isDark
            ? Colors.white.withValues(alpha: 0.1)
            : const Color(0xFFE4E4E7));

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: isDone
            ? colors.emeraldMuted.withValues(alpha: colors.isDark ? 0.15 : 0.45)
            : colors.surfaceElevated,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(
          color: isDone
              ? colors.emerald.withValues(alpha: 0.4)
              : (colors.isDark
                  ? Colors.white.withValues(alpha: 0.08)
                  : colors.border),
          width: isDone ? 1.2 : 1.0,
        ),
      ),
      child: Row(
        children: [
          // 1. SET NUMBER BADGE
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: isDone
                  ? colors.emeraldMuted
                  : (colors.isDark ? const Color(0xFF262626) : colors.surface),
              borderRadius: BorderRadius.circular(AppRadii.sm),
              border: Border.all(
                color: isDone
                    ? colors.emerald.withValues(alpha: 0.4)
                    : colors.border,
              ),
            ),
            child: Center(
              child: Text(
                '$setNum',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: isDone ? colors.emerald : colors.textSecondary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),

          // 2. PREVIOUS / TARGET SUMMARY
          Expanded(
            child: Text(
              prevSummary,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: isDone ? colors.textMuted : colors.textSecondary,
                decoration: isDone ? TextDecoration.lineThrough : null,
              ),
            ),
          ),

          // 3. WEIGHT INPUT
          if (isWeight) ...[
            const SizedBox(width: 6),
            Container(
              width: 58,
              height: 38,
              decoration: BoxDecoration(
                color: inputBg,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: inputBorder),
              ),
              child: TextField(
                key: const Key('set_dialog_weight_input'),
                controller: weightCtrl,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                textAlign: TextAlign.center,
                readOnly: _isSessionCompleted,
                enableInteractiveSelection: !_isSessionCompleted,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: isDone ? colors.emerald : colors.textPrimary,
                ),
                decoration: InputDecoration(
                  hintText: _formatNum(targetWeight).isNotEmpty
                      ? _formatNum(targetWeight)
                      : 'kg',
                  hintStyle: TextStyle(fontSize: 11, color: colors.textMuted),
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 9),
                ),
              ),
            ),
          ],

          // 4. REPS INPUT
          if (isReps) ...[
            const SizedBox(width: 6),
            Container(
              width: 52,
              height: 38,
              decoration: BoxDecoration(
                color: inputBg,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: inputBorder),
              ),
              child: TextField(
                key: const Key('set_dialog_reps_input'),
                controller: repsCtrl,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                readOnly: _isSessionCompleted,
                enableInteractiveSelection: !_isSessionCompleted,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: isDone ? colors.emerald : colors.textPrimary,
                ),
                decoration: InputDecoration(
                  hintText: _formatNum(targetReps).isNotEmpty
                      ? _formatNum(targetReps)
                      : 'reps',
                  hintStyle: TextStyle(fontSize: 11, color: colors.textMuted),
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 9),
                ),
              ),
            ),
          ],

          // 5. DURATION INPUT
          if (isDuration && !isReps) ...[
            const SizedBox(width: 6),
            Container(
              width: 56,
              height: 38,
              decoration: BoxDecoration(
                color: inputBg,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: inputBorder),
              ),
              child: TextField(
                key: const Key('set_dialog_duration_input'),
                controller: durCtrl,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                readOnly: _isSessionCompleted,
                enableInteractiveSelection: !_isSessionCompleted,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: isDone ? colors.emerald : colors.textPrimary,
                ),
                decoration: const InputDecoration(
                  hintText: 'sec',
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(vertical: 9),
                ),
              ),
            ),
          ],

          // 6. DISTANCE INPUT
          if (isDistance) ...[
            const SizedBox(width: 6),
            Container(
              width: 60,
              height: 38,
              decoration: BoxDecoration(
                color: inputBg,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: inputBorder),
              ),
              child: TextField(
                key: const Key('set_dialog_distance_input'),
                controller: distCtrl,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                textAlign: TextAlign.center,
                readOnly: _isSessionCompleted,
                enableInteractiveSelection: !_isSessionCompleted,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: isDone ? colors.emerald : colors.textPrimary,
                ),
                decoration: const InputDecoration(
                  hintText: 'meters',
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(vertical: 9),
                ),
              ),
            ),
          ],

          const SizedBox(width: 8),

          // 7. SINGLE LOG BUTTON (Checkmark)
          InkWell(
            key: Key('log_set_button_${exId}_$setNum'),
            onTap: _isSessionCompleted
                ? null
                : () {
                    _handleInlineLogSet(
                      exercise: exercise,
                      setNumber: setNum,
                      trackingType: trackingType,
                      loggedSet: loggedSet,
                    );
                  },
            borderRadius: BorderRadius.circular(AppRadii.full),
            child: Container(
              key: const Key('set_dialog_save_button'),
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isDone
                    ? colors.emerald
                    : (colors.isDark
                        ? const Color(0xFF27272A)
                        : const Color(0xFFF4F4F5)),
                border: Border.all(
                  color: isDone ? colors.emerald : colors.border,
                  width: 1.5,
                ),
              ),
              child: Center(
                child: Icon(
                  Icons.check_rounded,
                  size: 18,
                  color: isDone ? Colors.white : colors.textMuted,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
