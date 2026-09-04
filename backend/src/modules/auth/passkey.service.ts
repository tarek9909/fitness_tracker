import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  WebAuthnCredential,
} from '@simplewebauthn/server';
import { getDatabasePool } from '../../database/pool.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService, LoginResult } from './auth.service.js';
import { env } from '../../config/env.js';
import { ValidationError, UnauthorizedError, ConflictError, NotFoundError, ForbiddenError } from '../../shared/errors/app-error.js';
import { logger } from '../../config/logger.js';

export type PasskeyRegistrationOptions = PublicKeyCredentialCreationOptionsJSON & {
  challengeId: string;
};

export type PasskeyLoginOptions = PublicKeyCredentialRequestOptionsJSON & {
  challengeId: string;
};

type StoredCredential = WebAuthnCredential & {
  databaseId: number;
  userId: number;
  userStatus: string;
  credentialFormat: string;
  deviceName: string;
};

function base64Url(bytes: Uint8Array | Buffer): string {
  return Buffer.from(bytes).toString('base64url');
}

function asUint8Array(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(value, 'base64url')) as unknown as Uint8Array<ArrayBuffer>;
}

export class PasskeyService {
  private db = getDatabasePool();
  private authRepo = new AuthRepository();
  private authService = new AuthService();

  private getRpId(): string {
    return env.webauthnRpId;
  }

  private getRpName(): string {
    return env.webauthnRpName;
  }

  private getExpectedOrigins(): string[] {
    return env.webauthnExpectedOrigins;
  }

  private async consumeChallenge(challengeId: string, ceremonyType: 'registration' | 'authentication', userId?: number) {
    const whereUser = userId === undefined ? '' : ' AND user_id = ?';
    const params: Array<string | number> = [challengeId, ceremonyType];
    if (userId !== undefined) params.push(userId);

    const challenge = await this.db.queryOne<any>(
      `SELECT * FROM auth_webauthn_challenges
       WHERE id = ? AND ceremony_type = ?${whereUser}`,
      params
    );

    if (!challenge) {
      throw ceremonyType === 'registration'
        ? new ValidationError('Registration challenge not found or mismatched user')
        : new UnauthorizedError('Authentication challenge expired or not found', 'CHALLENGE_NOT_FOUND');
    }

    if (new Date(challenge.expires_at) < new Date()) {
      await this.db.execute('DELETE FROM auth_webauthn_challenges WHERE id = ?', [challengeId]);
      throw ceremonyType === 'registration'
        ? new ValidationError('Registration challenge has expired')
        : new UnauthorizedError('Authentication challenge has expired', 'CHALLENGE_EXPIRED');
    }

    // Consume before cryptographic verification so a challenge can never be
    // accepted twice, including under concurrent requests.
    const consumed = await this.db.execute(
      `DELETE FROM auth_webauthn_challenges
       WHERE id = ? AND ceremony_type = ?${whereUser}`,
      params
    );
    if (consumed.affectedRows !== 1) {
      throw ceremonyType === 'registration'
        ? new ValidationError('Registration challenge has already been consumed')
        : new UnauthorizedError('Authentication challenge has already been consumed', 'CHALLENGE_REPLAY');
    }

    return challenge;
  }

  async generateRegistrationOptions(userId: number): Promise<PasskeyRegistrationOptions> {
    const user = await this.db.queryOne<any>(
      'SELECT id, email, first_name, last_name FROM users WHERE id = ?',
      [userId]
    );
    if (!user) throw new NotFoundError('User not found');

    const challengeBytes = crypto.randomBytes(32);
    const challenge = base64Url(challengeBytes);
    const challengeId = uuidv4();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;

    await this.db.execute(
      `INSERT INTO auth_webauthn_challenges (id, user_id, challenge, ceremony_type, expires_at)
       VALUES (?, ?, ?, 'registration', ?)`,
      [challengeId, user.id, challenge, expiresAt]
    );

    const existing = await this.db.query<any>(
      'SELECT credential_id, transports FROM user_passkeys WHERE user_id = ? AND credential_format = ?',
      [userId, 'webauthn-cose']
    );

    const options = await generateRegistrationOptions({
      rpName: this.getRpName(),
      rpID: this.getRpId(),
      userName: user.email,
      userID: new Uint8Array(Buffer.from(String(user.id))),
      userDisplayName: displayName,
      challenge: challengeBytes,
      timeout: 60000,
      attestationType: 'none',
      excludeCredentials: existing.map((credential: any) => ({
        id: credential.credential_id,
        type: 'public-key' as const,
        transports: credential.transports ? credential.transports.split(',') : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      supportedAlgorithmIDs: [-7, -257],
    });

    return { ...options, challengeId };
  }

  async verifyRegistration(
    userId: number,
    data: {
      challengeId: string;
      response: RegistrationResponseJSON;
      deviceName?: string;
    }
  ): Promise<{ id: number; credentialId: string; deviceName: string }> {
    const challenge = await this.consumeChallenge(data.challengeId, 'registration', userId);

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: data.response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: this.getExpectedOrigins(),
        expectedRPID: this.getRpId(),
        expectedType: 'webauthn.create',
        requireUserPresence: true,
        requireUserVerification: false,
        supportedAlgorithmIDs: [-7, -257],
      });
    } catch (error: any) {
      logger.warn({ err: error?.message }, 'WebAuthn registration verification failed');
      throw new ValidationError('Passkey registration verification failed');
    }

    if (!verification.verified) {
      throw new ValidationError('Passkey registration verification failed');
    }

    const credentialId = verification.registrationInfo.credential.id;
    const existing = await this.db.queryOne<any>(
      'SELECT id FROM user_passkeys WHERE credential_id = ?',
      [credentialId]
    );
    if (existing) throw new ConflictError('This passkey credential is already registered');

    const deviceName = data.deviceName?.trim() || 'Passkey Authenticator';
    const transports = verification.registrationInfo.credential.transports?.join(',') || 'internal';
    const publicKey = base64Url(verification.registrationInfo.credential.publicKey);

    const insertResult = await this.db.execute(
      `INSERT INTO user_passkeys
       (user_id, credential_id, public_key, credential_format, counter, device_name, transports, aaguid)
       VALUES (?, ?, ?, 'webauthn-cose', ?, ?, ?, ?)`,
      [
        userId,
        credentialId,
        publicKey,
        verification.registrationInfo.credential.counter,
        deviceName,
        transports,
        verification.registrationInfo.aaguid || null,
      ]
    );

    return { id: insertResult.insertId, credentialId, deviceName };
  }

  async generateLoginOptions(email?: string): Promise<PasskeyLoginOptions> {
    const challengeBytes = crypto.randomBytes(32);
    const challenge = base64Url(challengeBytes);
    const challengeId = uuidv4();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    let userId: number | null = null;
    let allowCredentials: Array<{ id: string; type: 'public-key'; transports?: any[] }> | undefined;

    if (email?.trim()) {
      const user = await this.authRepo.findUserByEmail(email.trim());
      if (user) {
        userId = user.id;
        const credentials = await this.db.query<any>(
          'SELECT credential_id, transports FROM user_passkeys WHERE user_id = ? AND credential_format = ?',
          [user.id, 'webauthn-cose']
        );
        if (credentials.length > 0) {
          allowCredentials = credentials.map((credential: any) => ({
            id: credential.credential_id,
            type: 'public-key' as const,
            transports: credential.transports ? credential.transports.split(',') : undefined,
          }));
        }
      }
    }

    await this.db.execute(
      `INSERT INTO auth_webauthn_challenges (id, user_id, challenge, ceremony_type, expires_at)
       VALUES (?, ?, ?, 'authentication', ?)`,
      [challengeId, userId, challenge, expiresAt]
    );

    const options = await generateAuthenticationOptions({
      rpID: this.getRpId(),
      challenge: challengeBytes,
      timeout: 60000,
      userVerification: 'preferred',
      allowCredentials,
    });

    return { ...options, challengeId };
  }

  private async findCredential(credentialId: string): Promise<StoredCredential | null> {
    const row = await this.db.queryOne<any>(
      `SELECT up.*, u.status as user_status
       FROM user_passkeys up
       JOIN users u ON u.id = up.user_id
       WHERE up.credential_id = ?`,
      [credentialId]
    );
    if (!row) return null;

    return {
      id: row.credential_id,
      publicKey: asUint8Array(row.public_key),
      counter: Number(row.counter || 0),
      transports: row.transports ? row.transports.split(',') : undefined,
      databaseId: row.id,
      userId: row.user_id,
      userStatus: row.user_status,
      credentialFormat: row.credential_format || 'legacy-unverified',
      deviceName: row.device_name,
    };
  }

  async verifyLogin(
    data: {
      challengeId: string;
      response: AuthenticationResponseJSON;
      deviceName?: string;
    },
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    const challenge = await this.consumeChallenge(data.challengeId, 'authentication');
    const credential = await this.findCredential(data.response.id);

    if (!credential) {
      throw new UnauthorizedError('Passkey credential is not recognized on this account', 'UNKNOWN_CREDENTIAL');
    }
    if (credential.credentialFormat !== 'webauthn-cose') {
      throw new UnauthorizedError(
        'This passkey must be registered again from a password-authenticated session',
        'PASSKEY_REENROLL_REQUIRED'
      );
    }
    if (credential.userStatus !== 'active') {
      throw new ForbiddenError('Account is disabled or inactive', 'ACCOUNT_DISABLED');
    }
    if (challenge.user_id !== null && Number(challenge.user_id) !== credential.userId) {
      throw new UnauthorizedError('Passkey credential does not belong to the requested account', 'CREDENTIAL_ACCOUNT_MISMATCH');
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: data.response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: this.getExpectedOrigins(),
        expectedRPID: this.getRpId(),
        expectedType: 'webauthn.get',
        credential: {
          id: credential.id,
          publicKey: credential.publicKey,
          counter: credential.counter,
          transports: credential.transports,
        },
        requireUserVerification: false,
      });
    } catch (error: any) {
      logger.warn({ err: error?.message, credentialId: credential.id }, 'WebAuthn authentication verification failed');
      throw new UnauthorizedError('Passkey cryptographic signature verification failed', 'SIGNATURE_INVALID');
    }

    if (!verification.verified) {
      throw new UnauthorizedError('Passkey cryptographic signature verification failed', 'SIGNATURE_INVALID');
    }

    const counterUpdate = await this.db.execute(
      `UPDATE user_passkeys
       SET counter = ?, last_used_at = CURRENT_TIMESTAMP
       WHERE id = ? AND credential_format = ? AND counter = ?`,
      [verification.authenticationInfo.newCounter, credential.databaseId, 'webauthn-cose', credential.counter]
    );
    if (counterUpdate.affectedRows !== 1) {
      throw new UnauthorizedError('Passkey counter changed during authentication', 'COUNTER_CONFLICT');
    }

    const user = await this.db.queryOne<any>(
      `SELECT u.*, r.name as role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [credential.userId]
    );
    if (!user) throw new NotFoundError('Authenticated user not found');

    return this.authService.issueSession(
      user,
      data.deviceName || credential.deviceName || 'Passkey Device',
      ipAddress,
      userAgent
    );
  }

  async listUserPasskeys(userId: number): Promise<Array<{
    id: number;
    credentialId: string;
    deviceName: string;
    credentialFormat: string;
    createdAt: string;
    lastUsedAt: string | null;
  }>> {
    const rows = await this.db.query<any>(
      `SELECT id,
              credential_id as credentialId,
              device_name as deviceName,
              credential_format as credentialFormat,
              created_at as createdAt,
              last_used_at as lastUsedAt
       FROM user_passkeys
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  }

  async deleteUserPasskey(userId: number, passkeyId: number): Promise<boolean> {
    const result = await this.db.execute(
      'DELETE FROM user_passkeys WHERE id = ? AND user_id = ?',
      [passkeyId, userId]
    );
    if (result.affectedRows === 0) {
      throw new NotFoundError('Passkey not found or unauthorized to delete');
    }
    return true;
  }
}
