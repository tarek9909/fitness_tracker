class UserModel {
  final int id;
  final String role;
  final String firstName;
  final String? lastName;
  final String email;
  final String timezone;

  UserModel({
    required this.id,
    required this.role,
    required this.firstName,
    this.lastName,
    required this.email,
    required this.timezone,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'],
      role: json['role'] ?? json['role_name'] ?? 'user',
      firstName: json['firstName'] ?? json['first_name'] ?? '',
      lastName: json['lastName'] ?? json['last_name'],
      email: json['email'] ?? '',
      timezone: json['timezone'] ?? 'UTC',
    );
  }
}

class DailyTaskModel {
  final int id;
  final String taskKey;
  final String taskType;
  final String title;
  final String status;
  final bool isCompleted;
  final String? scheduledTime;

  DailyTaskModel({
    required this.id,
    required this.taskKey,
    required this.taskType,
    required this.title,
    required this.status,
    required this.isCompleted,
    this.scheduledTime,
  });

  factory DailyTaskModel.fromJson(Map<String, dynamic> json) {
    return DailyTaskModel(
      id: json['id'] ?? 0,
      taskKey: json['taskKey'] ?? json['task_key'] ?? '',
      taskType: json['taskType'] ?? json['task_type'] ?? '',
      title: json['title'] ?? '',
      status: json['status'] ?? 'pending',
      isCompleted: json['isCompleted'] ?? (json['status'] == 'completed'),
      scheduledTime: json['scheduledTime'] ?? json['scheduled_time'],
    );
  }
}

class DailyWaterModel {
  final int totalMl;
  final int targetMl;
  final int remainingMl;
  final int completionPercent;
  final List<int> quickAdds;

  DailyWaterModel({
    required this.totalMl,
    required this.targetMl,
    required this.remainingMl,
    required this.completionPercent,
    required this.quickAdds,
  });

  factory DailyWaterModel.fromJson(Map<String, dynamic> json) {
    final rawQuickAdds = json['quickAdds'] as List<dynamic>? ?? [];
    final parsedQuickAdds = <int>[];
    for (final q in rawQuickAdds) {
      if (q is int) {
        parsedQuickAdds.add(q);
      } else if (q is num) {
        parsedQuickAdds.add(q.toInt());
      } else if (q is Map) {
        final amt = q['amount_ml'] ?? q['amountMl'];
        if (amt is num) {
          parsedQuickAdds.add(amt.toInt());
        } else if (amt is String) {
          final parsed = int.tryParse(amt);
          if (parsed != null) parsedQuickAdds.add(parsed);
        }
      }
    }
    final rawTotal = json['totalMl'] ?? json['total_water_ml'] ?? 0;
    final rawTarget = json['targetMl'] ?? json['target_ml'] ?? 0;
    final rawRem = json['remainingMl'] ?? 0;
    final rawPct = json['completionPercent'] ?? 0;

    return DailyWaterModel(
      totalMl: rawTotal is num ? rawTotal.toInt() : (int.tryParse(rawTotal.toString()) ?? 0),
      targetMl: rawTarget is num ? rawTarget.toInt() : (int.tryParse(rawTarget.toString()) ?? 0),
      remainingMl: rawRem is num ? rawRem.toInt() : (int.tryParse(rawRem.toString()) ?? 0),
      completionPercent: rawPct is num ? rawPct.toInt() : (int.tryParse(rawPct.toString()) ?? 0),
      quickAdds: parsedQuickAdds,
    );
  }
}

class DailyWeightModel {
  final double? current;
  final bool logged;
  final Map<String, dynamic>? goal;

  DailyWeightModel({
    this.current,
    required this.logged,
    this.goal,
  });

  factory DailyWeightModel.fromJson(Map<String, dynamic> json) {
    final rawCurrent = json['current'];
    return DailyWeightModel(
      current: rawCurrent != null
          ? (rawCurrent is num ? rawCurrent.toDouble() : double.tryParse(rawCurrent.toString()))
          : null,
      logged: json['logged'] == true || json['logged'] == 1,
      goal: json['goal'] is Map ? Map<String, dynamic>.from(json['goal']) : null,
    );
  }
}

class DailyPlanModel {
  final String date;
  final int weekday;
  final String timezone;
  final DailyWeightModel weight;
  final DailyWaterModel water;
  final Map<String, dynamic> diet;
  final Map<String, dynamic>? workout;
  final Map<String, dynamic> cardio;
  final List<DailyTaskModel> tasks;
  final int completedTasks;
  final int totalTasks;
  final int overallAdherencePct;

  DailyPlanModel({
    required this.date,
    required this.weekday,
    required this.timezone,
    required this.weight,
    required this.water,
    required this.diet,
    this.workout,
    required this.cardio,
    required this.tasks,
    required this.completedTasks,
    required this.totalTasks,
    required this.overallAdherencePct,
  });

  factory DailyPlanModel.fromJson(Map<String, dynamic> json) {
    final summary = json['summary'] != null
        ? Map<String, dynamic>.from(json['summary'])
        : <String, dynamic>{};
    final rawTasks = json['tasks'] as List<dynamic>? ?? [];
    final taskList = rawTasks
        .whereType<Map>()
        .map((t) => DailyTaskModel.fromJson(Map<String, dynamic>.from(t)))
        .toList();

    final rawWeekday = json['weekday'] ?? 1;
    final rawCompTasks = summary['completedTasks'] ?? 0;
    final rawTotalTasks = summary['totalTasks'] ?? 0;
    final rawAdherence = summary['overallAdherencePct'] ?? 0;

    return DailyPlanModel(
      date: json['date']?.toString() ?? '',
      weekday: rawWeekday is num ? rawWeekday.toInt() : (int.tryParse(rawWeekday.toString()) ?? 1),
      timezone: json['timezone']?.toString() ?? 'UTC',
      weight: DailyWeightModel.fromJson(json['weight'] is Map
          ? Map<String, dynamic>.from(json['weight'])
          : {}),
      water: DailyWaterModel.fromJson(json['water'] is Map
          ? Map<String, dynamic>.from(json['water'])
          : {}),
      diet: json['diet'] is Map
          ? Map<String, dynamic>.from(json['diet'])
          : <String, dynamic>{},
      workout: json['workout'] is Map
          ? Map<String, dynamic>.from(json['workout'])
          : null,
      cardio: json['cardio'] is Map
          ? Map<String, dynamic>.from(json['cardio'])
          : <String, dynamic>{},
      tasks: taskList,
      completedTasks: rawCompTasks is num ? rawCompTasks.toInt() : (int.tryParse(rawCompTasks.toString()) ?? 0),
      totalTasks: rawTotalTasks is num ? rawTotalTasks.toInt() : (int.tryParse(rawTotalTasks.toString()) ?? 0),
      overallAdherencePct: rawAdherence is num ? rawAdherence.toInt() : (int.tryParse(rawAdherence.toString()) ?? 0),
    );
  }
}
