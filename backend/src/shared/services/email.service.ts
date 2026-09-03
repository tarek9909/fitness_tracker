import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { ValidationError } from '../errors/app-error.js';

export interface SentEmailRecord {
  to: string;
  subject: string;
  text: string;
  html?: string;
  sentAt: Date;
}

export const testSentEmails: SentEmailRecord[] = [];
export const testOtpStore = new Map<string, string>();

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (env.emailProvider === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpSecure ?? false,
        auth: env.smtpUser
          ? {
              user: env.smtpUser,
              pass: env.smtpPassword,
            }
          : undefined,
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      });
    }
  }

  async verifyTransport(): Promise<boolean> {
    if (env.emailProvider === 'none') {
      throw new ValidationError('Email delivery provider is not configured on this environment.');
    }
    if (env.emailProvider === 'mock' || env.nodeEnv === 'test') {
      return true;
    }
    if (!this.transporter) {
      throw new ValidationError('SMTP transport is not configured.');
    }
    await this.transporter.verify();
    return true;
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    if (env.emailProvider === 'none') {
      throw new ValidationError('Password reset email delivery provider is not configured on this environment.');
    }

    const separator = env.passwordResetBaseUrl.includes('?') ? '&' : '?';
    const resetUrl = `${env.passwordResetBaseUrl}${separator}token=${encodeURIComponent(token)}`;
    const subject = 'Password Reset Request - Fitness Platform';
    const textContent = `Hello,\n\nYou requested a password reset for your Fitness Platform account.\n\nPlease reset your password using the following link or token within 60 minutes:\n${resetUrl}\n\nToken: ${token}\n\nIf you did not request this, please ignore this email.`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your Fitness Platform account.</p>
        <p>Click the button below to reset your password within 60 minutes:</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
        </p>
        <p>Or use this token directly: <code>${token}</code></p>
        <p style="color: #64748b; font-size: 13px; margin-top: 30px;">If you did not request this password reset, no further action is required.</p>
      </div>
    `;

    if (env.emailProvider === 'mock' || env.nodeEnv === 'test') {
      testSentEmails.push({
        to: email,
        subject,
        text: textContent,
        html: htmlContent,
        sentAt: new Date(),
      });
      logger.info({ recipient: email }, 'Mock email dispatched for password reset');
      return;
    }

    if (env.emailProvider === 'smtp' && this.transporter) {
      try {
        await this.transporter.sendMail({
          from: env.smtpFrom,
          to: email,
          subject,
          text: textContent,
          html: htmlContent,
        });
        logger.info({ recipient: email }, 'Transactional password reset email sent via SMTP');
      } catch (error) {
        logger.error({ error, recipient: email }, 'Failed to deliver password reset email via SMTP');
        throw new Error('Failed to deliver password reset email');
      }
    }
  }

  async sendOtpEmail(options: {
    to: string;
    purpose: 'password_reset' | 'password_change' | 'email_change_current' | 'email_change_new';
    otp: string;
    expiryMinutes: number;
  }): Promise<void> {
    const { to, purpose, otp, expiryMinutes } = options;

    if (env.emailProvider === 'none') {
      throw new ValidationError('Email delivery provider is not configured on this environment.');
    }

    let subject = 'Your Verification Code - Fitness Platform';
    let actionDesc = 'verify your account action';

    switch (purpose) {
      case 'password_reset':
        subject = 'Password Recovery Code - Fitness Platform';
        actionDesc = 'reset your account password';
        break;
      case 'password_change':
        subject = 'Security Verification: Password Change Code - Fitness Platform';
        actionDesc = 'confirm your password change';
        break;
      case 'email_change_current':
        subject = 'Security Verification: Current Email Confirmation Code - Fitness Platform';
        actionDesc = 'authorize an email address change request for your account';
        break;
      case 'email_change_new':
        subject = 'Security Verification: Verify Your New Email Address - Fitness Platform';
        actionDesc = 'verify and claim this email address for your Fitness Platform account';
        break;
    }

    const textContent = `Hello,\n\nYour one-time verification code to ${actionDesc} is:\n\n${otp}\n\nThis code will expire in ${expiryMinutes} minutes. If you did not request this, please secure your account immediately.\n\nFitness Platform Security Team`;

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 22px; font-weight: 700;">Verification Code</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 8px;">Use the code below to ${actionDesc}</p>
        </div>
        <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e293b;">${otp}</span>
        </div>
        <p style="color: #475569; font-size: 14px; line-height: 1.5; text-align: center;">
          This code expires in <strong>${expiryMinutes} minutes</strong>.<br />
          If you did not initiate this request, no changes will be made.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
          Fitness Platform Security &bull; Please do not reply to this email
        </p>
      </div>
    `;

    if (env.emailProvider === 'mock' || env.nodeEnv === 'test') {
      testSentEmails.push({
        to,
        subject,
        text: textContent,
        html: htmlContent,
        sentAt: new Date(),
      });
      testOtpStore.set(`${to.toLowerCase()}:${purpose}`, otp);
      testOtpStore.set(to.toLowerCase(), otp);
      logger.info({ recipient: to, purpose }, 'Mock email dispatched for OTP challenge');
      return;
    }

    if (env.emailProvider === 'smtp' && this.transporter) {
      try {
        await this.transporter.sendMail({
          from: env.smtpFrom,
          to,
          subject,
          text: textContent,
          html: htmlContent,
        });
        logger.info({ recipient: to, purpose }, 'Transactional OTP email dispatched via SMTP');
      } catch (error) {
        logger.error({ error, recipient: to, purpose }, 'Failed to deliver OTP email via SMTP');
        throw new Error('Failed to deliver verification email');
      }
    }
  }
}

export const emailService = new EmailService();
