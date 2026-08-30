import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/storage/local_cache.dart';
import '../../core/theme/app_theme.dart';

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

  String get _activeSessionCacheKey {
    final userId = widget.apiClient.authSession.currentUser?.id;
    return 'active_workout_session.${userId ?? 'anonymous'}';
  }

  @override
  void initState() {
    super.initState();
    _localCache = LocalCache(widget.apiClient.authSession.storage);
    _startOrResumeSession();
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
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to load session: $e')),
          );
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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Set saved offline. Will sync when online.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to log set: $e')),
        );
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
    int? selectedRating;

    await showDialog(
      context: context,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Finish Workout'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (totalCompletedSets == 0) ...[
                      Container(
                        padding: const EdgeInsets.all(8),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: AppColors.amber.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                              color: AppColors.amber.withValues(alpha: 0.5)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.info_outline,
                                color: AppColors.amber, size: 20),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'No completed sets recorded in this session.',
                                style: TextStyle(
                                    fontSize: 12, color: AppColors.amber),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Text(
                        'Log at least one completed set before finishing.',
                        style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                      ),
                    ],
                    const Text(
                      'Great work! Rate this session or leave any workout notes before finishing.',
                    ),
                    const SizedBox(height: 16),
                    const Text('Rating (optional):',
                        style: TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 13)),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(5, (index) {
                        final starValue = index + 1;
                        final isSelected = selectedRating != null &&
                            starValue <= selectedRating!;
                        return IconButton(
                          icon: Icon(
                            isSelected ? Icons.star : Icons.star_border,
                            color: isSelected ? Colors.amber : Colors.grey,
                            size: 28,
                          ),
                          onPressed: () {
                            setDialogState(() {
                              selectedRating = (selectedRating == starValue)
                                  ? null
                                  : starValue;
                            });
                          },
                        );
                      }),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: notesController,
                      maxLines: 3,
                      textInputAction: TextInputAction.done,
                      decoration: const InputDecoration(
                        labelText: 'Session Notes (optional)',
                        hintText: 'e.g. Felt strong on bench press today',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogCtx),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: canFinish ? () {
                    final trimmed = notesController.text.trim();
                    Navigator.pop(dialogCtx);
                    _completeWorkout(
                      notes: trimmed.isNotEmpty ? trimmed : null,
                      rating: selectedRating,
                    );
                  } : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Finish Workout'),
                ),
              ],
            );
          },
        );
      },
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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Workout session completed! Great job! 🎉')),
        );
        Navigator.pop(context);
      }
    } on OfflineOperationQueued catch (_) {
      await _clearLocalSession();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Workout completion queued for sync! 🎉')),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to complete workout: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body:
            Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    final exercises = (_session?['exercises'] as List<dynamic>? ?? []);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Live Workout Tracker'),
        actions: [
          TextButton.icon(
            onPressed: _showFinishWorkoutDialog,
            icon: const Icon(Icons.check_circle, color: AppColors.primary),
            label: const Text('Finish',
                style: TextStyle(
                    color: AppColors.primary, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: exercises.length,
        itemBuilder: (ctx, idx) {
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

          final prevPerf = ex['previous_performance'] ??
              ex['previousPerformance'] ??
              ex['last_session_performance'] ??
              ex['history'];
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
              final frir = first['rir'];
              prevPerfDesc =
                  'Last session: ${fw != null ? '$fw kg' : ''}${fw != null && fr != null ? ' × ' : ''}${fr != null ? '$fr reps' : ''}${frir != null ? ' (RIR $frir)' : ''}';
            } else if (prevPerf['weight_kg'] != null ||
                prevPerf['weightKg'] != null ||
                prevPerf['reps'] != null) {
              final pw = prevPerf['weight_kg'] ?? prevPerf['weightKg'];
              final pr = prevPerf['reps'];
              final prir = prevPerf['rir'];
              prevPerfDesc =
                  'Last session: ${pw != null ? '$pw kg' : ''}${pw != null && pr != null ? ' × ' : ''}${pr != null ? '$pr reps' : ''}${prir != null ? ' (RIR $prir)' : ''}';
            } else if (maxW != null) {
              prevPerfDesc = 'Previous Best: $maxW kg';
            }
          } else if (prevPerf is String && prevPerf.isNotEmpty) {
            prevPerfDesc = 'Last session: $prevPerf';
          }

          return Card(
            margin: const EdgeInsets.only(bottom: 16),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          ex['exercise_name'] ??
                              ex['exerciseName'] ??
                              'Exercise',
                          style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                      ),
                      if (targetHeader.isNotEmpty)
                        Text(
                          targetHeader,
                          style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.cyan,
                              fontWeight: FontWeight.w600),
                        ),
                    ],
                  ),
                  if (prevPerfDesc != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      prevPerfDesc,
                      style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.amber,
                          fontWeight: FontWeight.w500),
                    ),
                  ],
                  const SizedBox(height: 12),
                  if (totalSets == 0) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'No planned sets configured.',
                            style: TextStyle(
                                color: AppColors.textMuted, fontSize: 13),
                          ),
                          ElevatedButton.icon(
                            key: Key('add_set_button_${ex['id']}'),
                            onPressed: () {
                              _showLogSetDialog(
                                exercise: ex,
                                setNumber: 1,
                                trackingType: trackingType,
                                previousPerformance:
                                    prevPerf is Map ? prevPerf : null,
                              );
                            },
                            icon: const Icon(Icons.add, size: 16),
                            label: const Text('Add Set',
                                style: TextStyle(fontSize: 12)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              minimumSize: const Size(80, 32),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ] else ...[
                    ...List.generate(totalSets, (sIdx) {
                      final setNum = sIdx + 1;
                      final loggedSet = sets.firstWhere(
                        (s) => (s['set_number'] ?? s['setNumber']) == setNum,
                        orElse: () => null,
                      ) as Map<String, dynamic>?;
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
                          completedSummary =
                              '${loggedSet['reps'] ?? 0} reps (RIR ${loggedSet['rir'] ?? 0})';
                        } else {
                          completedSummary =
                              '${loggedSet['weight_kg'] ?? loggedSet['weightKg'] ?? 0} kg × ${loggedSet['reps'] ?? 0} reps (RIR ${loggedSet['rir'] ?? 0})';
                        }
                      }

                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: isDone
                              ? AppColors.primary.withValues(alpha: 0.1)
                              : AppColors.surface,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                              color: isDone
                                  ? AppColors.primary.withValues(alpha: 0.4)
                                  : AppColors.border),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Set $setNum',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold, fontSize: 13)),
                            if (isDone)
                              Text(
                                completedSummary,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textPrimary),
                              )
                            else
                              const Text('—',
                                  style: TextStyle(color: AppColors.textMuted)),
                            ElevatedButton(
                              key: Key('log_set_button_${ex['id']}_$setNum'),
                              onPressed: () {
                                _showLogSetDialog(
                                  exercise: ex,
                                  setNumber: setNum,
                                  trackingType: trackingType,
                                  loggedSet: loggedSet,
                                  previousPerformance:
                                      prevPerf is Map ? prevPerf : null,
                                );
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: isDone
                                    ? AppColors.surface
                                    : AppColors.primary,
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 4),
                                minimumSize: const Size(60, 30),
                              ),
                              child: Text(isDone ? 'Edit' : 'Log Set',
                                  style: const TextStyle(fontSize: 11)),
                            ),
                          ],
                        ),
                      );
                    }),
                    if (sets.length >= totalSets && totalSets > 0) ...[
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton.icon(
                          key: Key('add_extra_set_button_${ex['id']}'),
                          onPressed: () {
                            _showLogSetDialog(
                              exercise: ex,
                              setNumber: sets.length + 1,
                              trackingType: trackingType,
                              previousPerformance:
                                  prevPerf is Map ? prevPerf : null,
                            );
                          },
                          icon: const Icon(Icons.add, size: 14),
                          label: const Text('Add Extra Set',
                              style: TextStyle(fontSize: 11)),
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

    final dynamic loggedRir = loggedSet?['rir'];
    final dynamic targetRir = exercise['rir_target'] ??
        exercise['planned_rir_snapshot'] ??
        exercise['target_rir'] ??
        exercise['targetRir'] ??
        previousPerformance?['rir'];

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

    String initialRir = '';
    if (loggedRir != null) {
      initialRir = loggedRir.toString();
    } else if (targetRir != null) {
      initialRir = (targetRir is num && targetRir % 1 == 0)
          ? targetRir.toInt().toString()
          : targetRir.toString();
    }

    final initialDuration = loggedDuration?.toString() ?? '';
    final initialDistance = loggedDistance?.toString() ?? '';

    final weightCtrl = TextEditingController(text: initialWeight);
    final repsCtrl = TextEditingController(text: initialReps);
    final rirCtrl = TextEditingController(text: initialRir);
    final durationCtrl = TextEditingController(text: initialDuration);
    final distanceCtrl = TextEditingController(text: initialDistance);

    final repsFocus = FocusNode();
    final rirFocus = FocusNode();

    String? weightError;
    String? repsError;
    String? rirError;
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

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            return AlertDialog(
              title: Text(loggedSet != null
                  ? 'Edit Set $setNumber'
                  : 'Log Set $setNumber'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (isWeightTracking) ...[
                      TextField(
                        key: const Key('set_dialog_weight_input'),
                        controller: weightCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        textInputAction: TextInputAction.next,
                        onSubmitted: (_) {
                          FocusScope.of(context).requestFocus(repsFocus);
                        },
                        decoration: InputDecoration(
                          labelText: 'Weight (kg)',
                          hintText:
                              targetWeight != null ? '$targetWeight kg' : '0.0',
                          errorText: weightError,
                        ),
                        onChanged: (_) {
                          if (weightError != null) {
                            setDialogState(() => weightError = null);
                          }
                        },
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (isRepTracking) ...[
                      TextField(
                        key: const Key('set_dialog_reps_input'),
                        controller: repsCtrl,
                        focusNode: repsFocus,
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.next,
                        onSubmitted: (_) {
                          FocusScope.of(context).requestFocus(rirFocus);
                        },
                        decoration: InputDecoration(
                          labelText: 'Reps Completed',
                          hintText:
                              targetReps != null ? '$targetReps' : 'e.g. 10',
                          errorText: repsError,
                        ),
                        onChanged: (_) {
                          if (repsError != null) {
                            setDialogState(() => repsError = null);
                          }
                        },
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        key: const Key('set_dialog_rir_input'),
                        controller: rirCtrl,
                        focusNode: rirFocus,
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.done,
                        decoration: InputDecoration(
                          labelText: 'RIR (Reps in Reserve)',
                          hintText: targetRir != null ? '$targetRir' : '0 - 10',
                          errorText: rirError,
                        ),
                        onChanged: (_) {
                          if (rirError != null) {
                            setDialogState(() => rirError = null);
                          }
                        },
                      ),
                    ],
                    if (isDistanceTracking) ...[
                      TextField(
                        key: const Key('set_dialog_distance_input'),
                        controller: distanceCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        textInputAction: TextInputAction.next,
                        decoration: InputDecoration(
                          labelText: 'Distance (meters)',
                          hintText: 'e.g. 1000',
                          errorText: distanceError,
                        ),
                        onChanged: (_) {
                          if (distanceError != null) {
                            setDialogState(() => distanceError = null);
                          }
                        },
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (isDurationTracking) ...[
                      TextField(
                        key: const Key('set_dialog_duration_input'),
                        controller: durationCtrl,
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.done,
                        decoration: InputDecoration(
                          labelText: 'Duration (seconds)',
                          hintText: 'e.g. 60',
                          errorText: durationError,
                        ),
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
                TextButton(
                  key: const Key('set_dialog_cancel_button'),
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  key: const Key('set_dialog_save_button'),
                  onPressed: () {
                    int? parsedReps;
                    int? parsedRir;
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

                      final rirText = rirCtrl.text.trim();
                      if (rirText.isNotEmpty) {
                        parsedRir = int.tryParse(rirText);
                        if (parsedRir == null ||
                            parsedRir < 0 ||
                            parsedRir > 10) {
                          setDialogState(() {
                            rirError = 'RIR must be an integer from 0 to 10';
                          });
                          return;
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
                      rir: parsedRir,
                      durationSeconds: parsedDuration,
                      distanceMeters: parsedDistance,
                    );
                  },
                  child: const Text('Save Set'),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
