import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fitness_mobile_app/core/theme/app_theme.dart';
import 'package:fitness_mobile_app/core/widgets/premium_widgets.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Premium Widgets UI Component Suite', () {
    testWidgets(
        'PremiumButton renders label, handles onTap, shows loading spinner',
        (WidgetTester tester) async {
      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.darkTheme,
          home: Scaffold(
            body: PremiumButton(
              text: 'Save Changes',
              onPressed: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.text('Save Changes'), findsOneWidget);
      await tester.tap(find.text('Save Changes'));
      expect(tapped, isTrue);

      // Verify loading state renders spinner
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.darkTheme,
          home: Scaffold(
            body: PremiumButton(
              text: 'Save Changes',
              loading: true,
              onPressed: () {},
            ),
          ),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Save Changes'), findsNothing);
    });

    testWidgets('StatusBadge displays label and custom accent color',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: StatusBadge(
              label: 'COMPLETED',
              color: AppColors.primary,
            ),
          ),
        ),
      );

      expect(find.text('COMPLETED'), findsOneWidget);
    });

    testWidgets('MetricCard renders title, value and subtitle properly',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: MetricCard(
              title: 'Workouts',
              value: '18',
              subtitle: 'completed sessions',
              icon: Icons.fitness_center,
            ),
          ),
        ),
      );

      expect(find.text('WORKOUTS'), findsOneWidget);
      expect(find.text('18'), findsOneWidget);
      expect(find.text('completed sessions'), findsOneWidget);
    });

    testWidgets(
        'EmptyStateWidget and ErrorStateWidget render actionable messages',
        (WidgetTester tester) async {
      bool retried = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ErrorStateWidget(
              message: 'Failed to synchronize data',
              onRetry: () => retried = true,
            ),
          ),
        ),
      );

      expect(find.text('Something went wrong'), findsOneWidget);
      expect(find.text('Failed to synchronize data'), findsOneWidget);
      await tester.tap(find.text('Try Again'));
      expect(retried, isTrue);
    });

    testWidgets(
        'PremiumScaffold, PremiumAppBar, and PremiumNavigationBar render cleanly',
        (WidgetTester tester) async {
      int tappedIndex = -1;

      await tester.pumpWidget(
        MaterialApp(
          home: PremiumScaffold(
            appBar: const PremiumAppBar(
              titleText: 'Premium Test Bar',
            ),
            body: const Center(child: Text('Content Area')),
            bottomNavigationBar: PremiumNavigationBar(
              currentIndex: 0,
              onTap: (idx) => tappedIndex = idx,
              items: const [
                PremiumNavigationBarItem(icon: Icons.today, label: 'Today'),
                PremiumNavigationBarItem(icon: Icons.person, label: 'Profile'),
              ],
            ),
          ),
        ),
      );

      expect(find.text('Premium Test Bar'), findsOneWidget);
      expect(find.text('Content Area'), findsOneWidget);
      expect(find.text('Today'), findsOneWidget);
      expect(find.text('Profile'), findsOneWidget);

      await tester.tap(find.text('Profile'));
      expect(tappedIndex, 1);
    });

    testWidgets(
        'PremiumProgressBar and PremiumChoiceButton render and handle taps',
        (WidgetTester tester) async {
      bool buttonTapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                const PremiumProgressBar(value: 0.65),
                PremiumChoiceButton(
                  label: '+250 ml',
                  icon: Icons.water_drop,
                  onPressed: () => buttonTapped = true,
                ),
              ],
            ),
          ),
        ),
      );

      expect(find.byType(PremiumProgressBar), findsOneWidget);
      expect(find.text('+250 ml'), findsOneWidget);
      await tester.tap(find.text('+250 ml'));
      expect(buttonTapped, isTrue);
    });
  });
}
