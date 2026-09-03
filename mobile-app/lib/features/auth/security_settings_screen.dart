import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_session.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/premium_widgets.dart';

class SecuritySettingsScreen extends StatefulWidget {
  final ApiClient apiClient;
  final AuthSession authSession;

  const SecuritySettingsScreen({
    super.key,
    required this.apiClient,
    required this.authSession,
  });

  @override
  State<SecuritySettingsScreen> createState() => _SecuritySettingsScreenState();
}

class _SecuritySettingsScreenState extends State<SecuritySettingsScreen> {
  // Password change state
  String? _pwdChallengeId;
  final _pwdOtpCtrl = TextEditingController();
  final _currentPwdCtrl = TextEditingController();
  final _newPwdCtrl = TextEditingController();
  final _confirmPwdCtrl = TextEditingController();
  bool _isRequestingPwdOtp = false;
  bool _isVerifyingPwd = false;
  String? _pwdError;

  // Email change state
  String? _currentEmailChallengeId;
  String? _newEmailChallengeId;
  final _newEmailCtrl = TextEditingController();
  final _currentEmailOtpCtrl = TextEditingController();
  final _newEmailOtpCtrl = TextEditingController();
  final _emailChangePwdCtrl = TextEditingController();
  bool _isRequestingEmailOtp = false;
  bool _isVerifyingEmail = false;
  String? _emailError;

  @override
  void dispose() {
    _pwdOtpCtrl.dispose();
    _currentPwdCtrl.dispose();
    _newPwdCtrl.dispose();
    _confirmPwdCtrl.dispose();
    _newEmailCtrl.dispose();
    _currentEmailOtpCtrl.dispose();
    _newEmailOtpCtrl.dispose();
    _emailChangePwdCtrl.dispose();
    super.dispose();
  }

  Future<void> _requestPasswordOtp() async {
    setState(() {
      _isRequestingPwdOtp = true;
      _pwdError = null;
    });

    try {
      final res = await widget.apiClient
          .post('/me/security/password-change/request');
      final challengeId = res is Map<String, dynamic>
          ? (res['challengeId'] ??
              (res['data'] is Map ? res['data']['challengeId'] : null)) as String?
          : null;

      if (challengeId == null) {
        throw Exception('Failed to initiate verification challenge');
      }

      setState(() {
        _pwdChallengeId = challengeId;
        _isRequestingPwdOtp = false;
      });

      if (mounted) {
        showPremiumSnackBar(
          context,
          'A 6-digit verification code has been dispatched to your email.',
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _pwdError = e.toString().replaceAll('Exception: ', '');
          _isRequestingPwdOtp = false;
        });
      }
    }
  }

  Future<void> _verifyPasswordChange() async {
    if (_pwdChallengeId == null) return;

    final otp = _pwdOtpCtrl.text.trim();
    final curPwd = _currentPwdCtrl.text;
    final newPwd = _newPwdCtrl.text;
    final confirmPwd = _confirmPwdCtrl.text;

    if (otp.length != 6) {
      setState(() => _pwdError = 'Enter the complete 6-digit verification code');
      return;
    }
    if (curPwd.isEmpty) {
      setState(() => _pwdError = 'Current password is required');
      return;
    }
    if (newPwd.length < 8) {
      setState(() => _pwdError = 'New password must be at least 8 characters');
      return;
    }
    if (newPwd != confirmPwd) {
      setState(() => _pwdError = 'New passwords do not match');
      return;
    }

    setState(() {
      _isVerifyingPwd = true;
      _pwdError = null;
    });

    try {
      await widget.apiClient.post(
        '/me/security/password-change/verify',
        body: {
          'challengeId': _pwdChallengeId,
          'otp': otp,
          'currentPassword': curPwd,
          'newPassword': newPwd,
        },
      );

      if (mounted) {
        showPremiumSnackBar(
          context,
          'Password updated successfully! Please log in with your new credentials.',
        );
        // Revoked session -> log out
        await widget.authSession.clearSession();
        if (mounted) {
          Navigator.of(context).popUntil((route) => route.isFirst);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _pwdError = e.toString().replaceAll('Exception: ', '');
          _isVerifyingPwd = false;
        });
      }
    }
  }

  Future<void> _requestEmailChangeOtp() async {
    final newEmail = _newEmailCtrl.text.trim();
    if (newEmail.isEmpty || !newEmail.contains('@')) {
      setState(() => _emailError = 'Please enter a valid new email address');
      return;
    }

    setState(() {
      _isRequestingEmailOtp = true;
      _emailError = null;
    });

    try {
      final res = await widget.apiClient.post(
        '/me/security/email-change/request',
        body: {'newEmail': newEmail},
      );

      final data = res is Map<String, dynamic> ? res : <String, dynamic>{};
      final inner = data['data'] is Map<String, dynamic>
          ? data['data'] as Map<String, dynamic>
          : data;

      final curChallengeId = inner['currentEmailChallengeId'] as String?;
      final newChallengeId = inner['newEmailChallengeId'] as String?;

      if (curChallengeId == null || newChallengeId == null) {
        throw Exception('Failed to generate dual verification challenges');
      }

      setState(() {
        _currentEmailChallengeId = curChallengeId;
        _newEmailChallengeId = newChallengeId;
        _isRequestingEmailOtp = false;
      });

      if (mounted) {
        showPremiumSnackBar(
          context,
          'Codes sent to both your current email and new email address.',
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _emailError = e.toString().replaceAll('Exception: ', '');
          _isRequestingEmailOtp = false;
        });
      }
    }
  }

  Future<void> _verifyEmailChange() async {
    if (_currentEmailChallengeId == null || _newEmailChallengeId == null) return;

    final curOtp = _currentEmailOtpCtrl.text.trim();
    final newOtp = _newEmailOtpCtrl.text.trim();
    final pwd = _emailChangePwdCtrl.text;

    if (curOtp.length != 6) {
      setState(() => _emailError = 'Enter the 6-digit code sent to your current email');
      return;
    }
    if (newOtp.length != 6) {
      setState(() => _emailError = 'Enter the 6-digit code sent to your new email');
      return;
    }
    if (pwd.isEmpty) {
      setState(() => _emailError = 'Account password is required for confirmation');
      return;
    }

    setState(() {
      _isVerifyingEmail = true;
      _emailError = null;
    });

    try {
      await widget.apiClient.post(
        '/me/security/email-change/verify',
        body: {
          'currentEmailOtp': curOtp,
          'newEmailOtp': newOtp,
          'password': pwd,
        },
      );

      if (mounted) {
        showPremiumSnackBar(
          context,
          'Email changed successfully! Please log in with your new email.',
        );
        await widget.authSession.clearSession();
        if (mounted) {
          Navigator.of(context).popUntil((route) => route.isFirst);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _emailError = e.toString().replaceAll('Exception: ', '');
          _isVerifyingEmail = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final user = widget.authSession.currentUser;

    return PremiumScaffold(
      appBar: const PremiumAppBar(title: Text('Account Security')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          // Security Notice Banner
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: colors.primaryMuted,
              borderRadius: BorderRadius.circular(AppRadii.lg),
              border: Border.all(color: colors.primary.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                Icon(Icons.shield_outlined, color: colors.primary, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'All security operations use OTP verification codes dispatched directly to your verified email.',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: colors.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // --- SECTION 1: CHANGE PASSWORD VIA OTP ---
          PremiumCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.lock_reset, color: colors.primary, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'CHANGE PASSWORD',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8,
                        color: colors.textPrimary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (_pwdError != null) ...[
                  Text(
                    _pwdError!,
                    style: TextStyle(color: colors.rose, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                ],
                if (_pwdChallengeId == null) ...[
                  Text(
                    'To change your password, request a 6-digit one-time passcode (OTP) to your registered email (${user?.email ?? ""}).',
                    style: TextStyle(fontSize: 13, color: colors.textSecondary),
                  ),
                  const SizedBox(height: 16),
                  PremiumButton(
                    text: 'Send Verification Code',
                    icon: const Icon(Icons.mail_outline, size: 18),
                    loading: _isRequestingPwdOtp,
                    onPressed: _requestPasswordOtp,
                  ),
                ] else ...[
                  Text(
                    'Enter the verification code sent to ${user?.email} and your new password.',
                    style: TextStyle(fontSize: 13, color: colors.textSecondary),
                  ),
                  const SizedBox(height: 14),
                  PremiumTextField(
                    label: '6-Digit OTP Code',
                    hint: '123456',
                    controller: _pwdOtpCtrl,
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 12),
                  PremiumTextField(
                    label: 'Current Password',
                    controller: _currentPwdCtrl,
                    obscureText: true,
                  ),
                  const SizedBox(height: 12),
                  PremiumTextField(
                    label: 'New Password',
                    controller: _newPwdCtrl,
                    obscureText: true,
                  ),
                  const SizedBox(height: 12),
                  PremiumTextField(
                    label: 'Confirm New Password',
                    controller: _confirmPwdCtrl,
                    obscureText: true,
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: PremiumButton(
                          text: 'Resend Code',
                          isSecondary: true,
                          onPressed: _requestPasswordOtp,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: PremiumButton(
                          text: 'Save Password',
                          loading: _isVerifyingPwd,
                          onPressed: _verifyPasswordChange,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),

          // --- SECTION 2: CHANGE EMAIL VIA DUAL-OTP ---
          PremiumCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.mark_email_read_outlined,
                        color: colors.cyan, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'CHANGE EMAIL ADDRESS',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8,
                        color: colors.textPrimary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (_emailError != null) ...[
                  Text(
                    _emailError!,
                    style: TextStyle(color: colors.rose, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                ],
                Text(
                  'Current Email: ${user?.email ?? ""}',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Email change requires Dual-OTP verification: you must verify ownership of your current email and your new email.',
                  style: TextStyle(fontSize: 12, color: colors.textSecondary),
                ),
                const SizedBox(height: 14),
                if (_currentEmailChallengeId == null) ...[
                  PremiumTextField(
                    label: 'New Email Address',
                    hint: 'new.email@example.com',
                    controller: _newEmailCtrl,
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 16),
                  PremiumButton(
                    text: 'Request Dual Verification Codes',
                    icon: const Icon(Icons.send, size: 18),
                    loading: _isRequestingEmailOtp,
                    onPressed: _requestEmailChangeOtp,
                  ),
                ] else ...[
                  PremiumTextField(
                    label: 'Current Email OTP',
                    hint: 'Code sent to ${user?.email}',
                    controller: _currentEmailOtpCtrl,
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 12),
                  PremiumTextField(
                    label: 'New Email OTP',
                    hint: 'Code sent to ${_newEmailCtrl.text}',
                    controller: _newEmailOtpCtrl,
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 12),
                  PremiumTextField(
                    label: 'Current Password (to confirm)',
                    controller: _emailChangePwdCtrl,
                    obscureText: true,
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: PremiumButton(
                          text: 'Resend',
                          isSecondary: true,
                          onPressed: _requestEmailChangeOtp,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: PremiumButton(
                          text: 'Confirm Change',
                          loading: _isVerifyingEmail,
                          onPressed: _verifyEmailChange,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
