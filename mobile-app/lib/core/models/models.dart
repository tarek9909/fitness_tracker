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
  final List<dynamic> quickAdds;

  DailyWaterModel({
    required this.totalMl,
    required this.targetMl,
    required this.remainingMl,
    required this.completionPercent,
    required this.quickAdds,
  });

  factory DailyWaterModel.fromJson(Map<String, dynamic> json) {
    return DailyWaterModel(
      totalMl: json['totalMl'] ?? json['total_water_ml'] ?? 0,
      targetMl: json['targetMl'] ?? json['target_ml'] ?? 0,
      remainingMl: json['remainingMl'] ?? 0,
      completionPercent: json['completionPercent'] ?? 0,
      quickAdds: json['quickAdds'] ?? [],
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
    return DailyWeightModel(
      current:
          json['current'] != null ? (json['current'] as num).toDouble() : null,
      logged: json['logged'] ?? false,
      goal: json['goal'],
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
    final taskList = (json['tasks'] as List<dynamic>? ?? [])
        .map((t) => DailyTaskModel.fromJson(Map<String, dynamic>.from(t)))
        .toList();

    return DailyPlanModel(
      date: json['date'] ?? '',
      weekday: json['weekday'] ?? 1,
      timezone: json['timezone'] ?? 'UTC',
      weight: DailyWeightModel.fromJson(json['weight'] != null
          ? Map<String, dynamic>.from(json['weight'])
          : {}),
      water: DailyWaterModel.fromJson(json['water'] != null
          ? Map<String, dynamic>.from(json['water'])
          : {}),
      diet: json['diet'] != null
          ? Map<String, dynamic>.from(json['diet'])
          : <String, dynamic>{},
      workout: json['workout'] != null
          ? Map<String, dynamic>.from(json['workout'])
          : null,
      cardio: json['cardio'] != null
          ? Map<String, dynamic>.from(json['cardio'])
          : <String, dynamic>{},
      tasks: taskList,
      completedTasks: summary['completedTasks'] ?? 0,
      totalTasks: summary['totalTasks'] ?? 0,
      overallAdherencePct: summary['overallAdherencePct'] ?? 0,
    );
  }
}
