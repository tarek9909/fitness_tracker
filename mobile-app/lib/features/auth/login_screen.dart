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

  Future<void> _showForgotPasswordDialog() async {
    final resetEmailCtrl =
        TextEditingController(text: _emailController.text.trim());
    final otpCtrl = TextEditingController();
    final newPwdCtrl = TextEditingController();
    String? challengeId;
    String? error;
    bool sendingOtp = false;
    bool verifying = false;

    await showPremiumDialog(
      context: context,
      builder: (ctx) {
        final colors = AppThemeColors.of(ctx);
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            return AlertDialog(
              backgroundColor: colors.card,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadii.xl),
                side: BorderSide(color: colors.border),
              ),
              title: Text(
                'Password Recovery',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  color: colors.textPrimary,
                ),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (error != null) ...[
                      Text(error!,
                          style: TextStyle(color: colors.rose, fontSize: 13)),
                      const SizedBox(height: 8),
                    ],
                    if (challengeId == null) ...[
                      Text(
                        'Enter your account email address. We will send a 6-digit recovery code.',
                        style: TextStyle(
                            fontSize: 13, color: colors.textSecondary),
                      ),
                      const SizedBox(height: 14),
                      PremiumTextField(
                        label: 'Email Address',
                        controller: resetEmailCtrl,
                        keyboardType: TextInputType.emailAddress,
                      ),
                    ] else ...[
                      Text(
                        'Enter the 6-digit code sent to ${resetEmailCtrl.text} and your new password.',
                        style: TextStyle(
                            fontSize: 13, color: colors.textSecondary),
                      ),
                      const SizedBox(height: 14),
                      PremiumTextField(
                        label: '6-Digit Recovery Code',
                        hint: '123456',
                        controller: otpCtrl,
                        keyboardType: TextInputType.number,
                      ),
                      const SizedBox(height: 12),
                      PremiumTextField(
                        label: 'New Password',
                        controller: newPwdCtrl,
                        obscureText: true,
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                PremiumButton(
                  text: 'Cancel',
                  isSecondary: true,
                  onPressed: () => Navigator.pop(ctx),
                ),
                if (challengeId == null)
                  PremiumButton(
                    text: 'Send Code',
                    loading: sendingOtp,
                    onPressed: () async {
                      final email = resetEmailCtrl.text.trim();
                      if (email.isEmpty || !email.contains('@')) {
                        setDialogState(
                            () => error = 'Please enter a valid email');
                        return;
                      }
                      setDialogState(() {
                        sendingOtp = true;
                        error = null;
                      });
                      try {
                        final res = await widget.apiClient.post(
                          '/auth/password-reset/request',
                          body: {'email': email},
                        );
                        final chId =
                            res is Map<String, dynamic> && res['data'] != null
                                ? res['data']['challengeId'] as String?
                                : null;
                        setDialogState(() {
                          challengeId = chId ?? 'challenge-active';
                          sendingOtp = false;
                        });
                      } catch (e) {
                        setDialogState(() {
                          error = e.toString().replaceAll('Exception: ', '');
                          sendingOtp = false;
                        });
                      }
                    },
                  )
                else
                  PremiumButton(
                    text: 'Reset Password',
                    loading: verifying,
                    onPressed: () async {
                      final otp = otpCtrl.text.trim();
                      final newPwd = newPwdCtrl.text;
                      if (otp.length != 6) {
                        setDialogState(
                            () => error = 'Enter complete 6-digit code');
                        return;
                      }
                      if (newPwd.length < 8) {
                        setDialogState(() =>
                            error = 'Password must be at least 8 characters');
                        return;
                      }
                      setDialogState(() {
                        verifying = true;
                        error = null;
                      });
                      try {
                        await widget.apiClient.post(
                          '/auth/password-reset/verify',
                          body: {
                            'challengeId': challengeId,
                            'otp': otp,
                            'newPassword': newPwd,
                          },
                        );
                        if (!ctx.mounted || !mounted) return;
                        Navigator.pop(ctx);
                        setState(() {
                          _emailController.text = resetEmailCtrl.text.trim();
                        });
                        if (mounted) {
                          showPremiumSnackBar(
                            context,
                            'Password reset successful! You can now log in.',
                          );
                        }
                      } catch (e) {
                        setDialogState(() {
                          error = e.toString().replaceAll('Exception: ', '');
                          verifying = false;
                        });
                      }
                    },
                  ),
              ],
            );
          },
        );
      },
    );
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

                  // Atmospheric Brand Icon
                  Center(
                    child: Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: colors.surfaceElevated,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.08),
                          width: 1,
                        ),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x0DD4FF00),
                            blurRadius: 20,
                            offset: Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Center(
                        child: Icon(
                          Icons.fitness_center,
                          size: 32,
                          color: colors.primary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Kinetic Wellness',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.5,
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Sign in to your account',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: colors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Structured Login Form Card
                  PremiumCard(
                    padding: const EdgeInsets.all(28),
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
                          label: 'Email',
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          prefixIcon: Icons.mail_outline,
                          onSubmitted: (_) {
                            FocusScope.of(context).requestFocus(_passwordFocusNode);
                          },
                        ),
                        const SizedBox(height: 18),
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
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Remember me',
                              style: TextStyle(
                                fontSize: 13,
                                color: colors.textSecondary,
                              ),
                            ),
                            InkWell(
                              onTap: _showForgotPasswordDialog,
                              child: Padding(
                                padding: const EdgeInsets.symmetric(vertical: 4),
                                child: Text(
                                  'Forgot password?',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: colors.primary,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                        PremiumButton(
                          text: 'Log In',
                          icon: const Icon(Icons.arrow_forward, size: 18),
                          loading: _isLoading,
                          onPressed: _handleLogin,
                          height: 50,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  Center(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          "Don't have an account? ",
                          style: TextStyle(
                            fontSize: 14,
                            color: colors.textSecondary,
                          ),
                        ),
                        Text(
                          'Sign up',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: colors.primary,
                          ),
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
