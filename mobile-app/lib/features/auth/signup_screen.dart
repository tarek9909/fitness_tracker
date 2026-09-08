import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_session.dart';
import '../../core/push/push_registration_service.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/theme_controller.dart';
import '../../core/widgets/premium_widgets.dart';
import '../../core/widgets/pulse_forge_logo.dart';

class SignUpScreen extends StatefulWidget {
  final ApiClient apiClient;
  final AuthSession authSession;
  final PushRegistrationService? pushRegistrationService;
  final ThemeController? themeController;

  const SignUpScreen({
    super.key,
    required this.apiClient,
    required this.authSession,
    this.pushRegistrationService,
    this.themeController,
  });

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  final _lastNameFocusNode = FocusNode();
  final _emailFocusNode = FocusNode();
  final _passwordFocusNode = FocusNode();
  final _confirmPasswordFocusNode = FocusNode();

  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isLoading = false;
  String? _errorMessage;

  String? _firstNameError;
  String? _emailError;
  String? _passwordError;
  String? _confirmPasswordError;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();

    _lastNameFocusNode.dispose();
    _emailFocusNode.dispose();
    _passwordFocusNode.dispose();
    _confirmPasswordFocusNode.dispose();
    super.dispose();
  }

  bool _validateForm() {
    bool isValid = true;
    final firstName = _firstNameController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;

    setState(() {
      _errorMessage = null;

      if (firstName.isEmpty) {
        _firstNameError = 'First name is required';
        isValid = false;
      } else {
        _firstNameError = null;
      }

      if (email.isEmpty) {
        _emailError = 'Email address is required';
        isValid = false;
      } else if (!email.contains('@') || !email.contains('.')) {
        _emailError = 'Enter a valid email address';
        isValid = false;
      } else {
        _emailError = null;
      }

      if (password.isEmpty) {
        _passwordError = 'Password is required';
        isValid = false;
      } else if (password.length < 8) {
        _passwordError = 'Password must be at least 8 characters';
        isValid = false;
      } else {
        _passwordError = null;
      }

      if (confirmPassword.isEmpty) {
        _confirmPasswordError = 'Please confirm your password';
        isValid = false;
      } else if (confirmPassword != password) {
        _confirmPasswordError = 'Passwords do not match';
        isValid = false;
      } else {
        _confirmPasswordError = null;
      }
    });

    return isValid;
  }

  Future<void> _handleSignUp() async {
    if (!_validateForm()) return;

    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await widget.apiClient.post('/auth/register', body: {
        'firstName': firstName,
        if (lastName.isNotEmpty) 'lastName': lastName,
        'email': email,
        'password': password,
        'deviceName': 'Flutter Client App',
        'clientType': 'mobile',
      });

      if (res is! Map<String, dynamic>) {
        throw Exception('Invalid registration response received from server');
      }

      final accessToken = res['accessToken'] as String?;
      final refreshToken = res['refreshToken'] as String?;
      final rawUser = res['user'];

      if (accessToken == null ||
          accessToken.isEmpty ||
          refreshToken == null ||
          refreshToken.isEmpty ||
          rawUser is! Map) {
        throw Exception('Registration response is missing session credentials');
      }

      // Save initial tokens to reactive session store
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
        // Fallback profile already saved from registration response
      }

      // Non-blocking device push registration for newly signed up user
      widget.pushRegistrationService?.registerDeviceIfNeeded();

      if (mounted) {
        showPremiumSnackBar(
          context,
          'Welcome to PulseForge, $firstName! Account created.',
        );
        // Dismiss signup screen if it was pushed onto the navigator
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
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
              constraints: const BoxConstraints(maxWidth: 460),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Top Bar with Back Button & Theme Switcher
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        PremiumIconButton(
                          icon: Icons.arrow_back,
                          tooltip: 'Back to Login',
                          onPressed: () => Navigator.pop(context),
                        ),
                        if (widget.themeController != null)
                          PremiumIconButton(
                            icon: colors.isDark
                                ? Icons.light_mode_outlined
                                : Icons.dark_mode_outlined,
                            tooltip: colors.isDark
                                ? 'Switch to Light Theme'
                                : 'Switch to Dark Theme',
                            onPressed: () {
                              widget.themeController!.setThemeMode(
                                colors.isDark
                                    ? ThemeMode.light
                                    : ThemeMode.dark,
                              );
                            },
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Atmospheric Brand Icon & Logo
                    const Center(
                      child: PulseForgeLogo(
                        size: 72,
                        showGlow: true,
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Title & Subtitle
                    Text(
                      'Create Your Account',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                        color: colors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Begin your personalized fitness and health journey',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        color: colors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 28),

                    // Sign Up Form Card
                    PremiumCard(
                      ambientGlow: true,
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (_errorMessage != null) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: colors.rose.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: colors.rose.withValues(alpha: 0.3),
                                ),
                              ),
                              child: Row(
                                children: [
                                  Icon(Icons.error_outline,
                                      size: 18, color: colors.rose),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      _errorMessage!,
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: colors.rose,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 18),
                          ],

                          // Name fields (Row on wider screens, stacked on small)
                          LayoutBuilder(
                            builder: (context, constraints) {
                              if (constraints.maxWidth > 340) {
                                return Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: PremiumTextField(
                                        controller: _firstNameController,
                                        label: 'First Name',
                                        hintText: 'Jane',
                                        textInputAction: TextInputAction.next,
                                        errorText: _firstNameError,
                                        onSubmitted: (_) =>
                                            _lastNameFocusNode.requestFocus(),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: PremiumTextField(
                                        controller: _lastNameController,
                                        focusNode: _lastNameFocusNode,
                                        label: 'Last Name',
                                        hintText: 'Doe (optional)',
                                        textInputAction: TextInputAction.next,
                                        onSubmitted: (_) =>
                                            _emailFocusNode.requestFocus(),
                                      ),
                                    ),
                                  ],
                                );
                              } else {
                                return Column(
                                  children: [
                                    PremiumTextField(
                                      controller: _firstNameController,
                                      label: 'First Name',
                                      hintText: 'Jane',
                                      textInputAction: TextInputAction.next,
                                      errorText: _firstNameError,
                                      onSubmitted: (_) =>
                                          _lastNameFocusNode.requestFocus(),
                                    ),
                                    const SizedBox(height: 14),
                                    PremiumTextField(
                                      controller: _lastNameController,
                                      focusNode: _lastNameFocusNode,
                                      label: 'Last Name',
                                      hintText: 'Doe (optional)',
                                      textInputAction: TextInputAction.next,
                                      onSubmitted: (_) =>
                                          _emailFocusNode.requestFocus(),
                                    ),
                                  ],
                                );
                              }
                            },
                          ),
                          const SizedBox(height: 16),

                          // Email
                          PremiumTextField(
                            controller: _emailController,
                            focusNode: _emailFocusNode,
                            label: 'Email Address',
                            hintText: 'jane.doe@example.com',
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            prefixIcon: Icons.email_outlined,
                            errorText: _emailError,
                            onSubmitted: (_) =>
                                _passwordFocusNode.requestFocus(),
                          ),
                          const SizedBox(height: 16),

                          // Password
                          PremiumTextField(
                            controller: _passwordController,
                            focusNode: _passwordFocusNode,
                            label: 'Password',
                            hintText: 'At least 8 characters',
                            obscureText: _obscurePassword,
                            textInputAction: TextInputAction.next,
                            prefixIcon: Icons.lock_outline,
                            errorText: _passwordError,
                            suffix: IconButton(
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                                size: 20,
                                color: colors.textSecondary,
                              ),
                              onPressed: () {
                                setState(() {
                                  _obscurePassword = !_obscurePassword;
                                });
                              },
                            ),
                            onSubmitted: (_) =>
                                _confirmPasswordFocusNode.requestFocus(),
                          ),
                          const SizedBox(height: 16),

                          // Confirm Password
                          PremiumTextField(
                            controller: _confirmPasswordController,
                            focusNode: _confirmPasswordFocusNode,
                            label: 'Confirm Password',
                            hintText: 'Re-enter your password',
                            obscureText: _obscureConfirmPassword,
                            textInputAction: TextInputAction.done,
                            prefixIcon: Icons.lock_reset_outlined,
                            errorText: _confirmPasswordError,
                            suffix: IconButton(
                              icon: Icon(
                                _obscureConfirmPassword
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                                size: 20,
                                color: colors.textSecondary,
                              ),
                              onPressed: () {
                                setState(() {
                                  _obscureConfirmPassword =
                                      !_obscureConfirmPassword;
                                });
                              },
                            ),
                            onSubmitted: (_) => _handleSignUp(),
                          ),
                          const SizedBox(height: 24),

                          // Submit Button
                          PremiumButton(
                            text: 'Create Account',
                            icon: const Icon(Icons.arrow_forward, size: 18),
                            loading: _isLoading,
                            onPressed: _handleSignUp,
                            height: 50,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Already have an account -> Log In
                    Center(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            'Already have an account? ',
                            style: TextStyle(
                              fontSize: 14,
                              color: colors.textSecondary,
                            ),
                          ),
                          InkWell(
                            onTap: () => Navigator.pop(context),
                            borderRadius: BorderRadius.circular(4),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 4, vertical: 2),
                              child: Text(
                                'Log in',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: colors.primary,
                                ),
                              ),
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
      ),
    );
  }
}
