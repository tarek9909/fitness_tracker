import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_session.dart';
import '../../core/push/push_registration_service.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/theme_controller.dart';
import '../../core/widgets/premium_widgets.dart';

class LoginScreen extends StatefulWidget {
  final ApiClient apiClient;
  final AuthSession authSession;
  final PushRegistrationService? pushRegistrationService;
  final ThemeController? themeController;

  const LoginScreen({
    super.key,
    required this.apiClient,
    required this.authSession,
    this.pushRegistrationService,
    this.themeController,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _passwordFocusNode = FocusNode();
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _passwordFocusNode.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = 'Please enter your email and password';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await widget.apiClient.post('/auth/login', body: {
        'email': email,
        'password': password,
        'deviceName': 'Flutter Client App',
      });

      if (res is! Map<String, dynamic>) {
        throw Exception('Invalid login response');
      }
      final accessToken = res['accessToken'] as String?;
      final refreshToken = res['refreshToken'] as String?;
      final rawUser = res['user'];
      if (accessToken == null ||
          accessToken.isEmpty ||
          refreshToken == null ||
          refreshToken.isEmpty ||
          rawUser is! Map) {
        throw Exception('Login response is missing required session data');
      }

      // Save initial tokens so subsequent authenticated calls succeed
      await widget.authSession.saveSession(
        accessToken: accessToken,
        refreshToken: refreshToken,
        userJson: Map<String, dynamic>.from(rawUser),
      );

      // Load authoritative /me profile from the server
      try {
        final meRes = await widget.apiClient.get('/me');
        if (meRes is Map<String, dynamic>) {
          await widget.authSession.updateProfile(meRes);
        }
      } catch (_) {
        // Fallback already saved from login response
      }

      // Non-blocking device registration on authenticated session
      widget.pushRegistrationService?.registerDeviceIfNeeded();
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return PremiumScaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (widget.themeController != null) ...[
                    Align(
                      alignment: Alignment.topRight,
                      child: PremiumIconButton(
                        icon: colors.isDark
                            ? Icons.light_mode_outlined
                            : Icons.dark_mode_outlined,
                        tooltip: colors.isDark
                            ? 'Switch to Light Theme'
                            : 'Switch to Dark Theme',
                        onPressed: () {
                          widget.themeController!.setThemeMode(
                            colors.isDark ? ThemeMode.light : ThemeMode.dark,
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],

                  // Architectural Brand Monogram (Clean, matte, non-radiant)
                  Center(
                    child: Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: colors.surfaceElevated,
                        borderRadius: BorderRadius.circular(AppRadii.xl),
                        border: Border.all(
                          color: colors.primary.withValues(alpha: 0.4),
                          width: 1.5,
                        ),
                      ),
                      child: Center(
                        child: Icon(
                          Icons.bolt,
                          size: 32,
                          color: colors.primary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'FITNESS TRACKER',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.6,
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Precision athletic training, nutrition & daily command center',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: colors.textSecondary,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Structured Login Form Card
                  PremiumCard(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_errorMessage != null)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 12),
                            margin: const EdgeInsets.only(bottom: 20),
                            decoration: BoxDecoration(
                              color: colors.roseMuted,
                              border: Border.all(
                                  color: colors.rose.withValues(alpha: 0.3)),
                              borderRadius: BorderRadius.circular(AppRadii.md),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.error_outline,
                                    color: colors.rose, size: 18),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    _errorMessage!,
                                    style: TextStyle(
                                      color: colors.rose,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),

                        PremiumTextField(
                          label: 'Email Address',
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          prefixIcon: Icons.email_outlined,
                          onSubmitted: (_) {
                            FocusScope.of(context).requestFocus(_passwordFocusNode);
                          },
                        ),
                        const SizedBox(height: 16),
                        PremiumTextField(
                          label: 'Password',
                          controller: _passwordController,
                          focusNode: _passwordFocusNode,
                          obscureText: true,
                          textInputAction: TextInputAction.done,
                          prefixIcon: Icons.lock_outline,
                          onSubmitted: (_) {
                            if (!_isLoading) _handleLogin();
                          },
                        ),
                        const SizedBox(height: 24),
                        PremiumButton(
                          text: 'Sign In',
                          loading: _isLoading,
                          onPressed: _handleLogin,
                          height: 48,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
