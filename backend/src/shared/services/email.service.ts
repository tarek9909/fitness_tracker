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
}

export const emailService = new EmailService();
