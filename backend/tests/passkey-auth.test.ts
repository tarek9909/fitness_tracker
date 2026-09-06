import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { encodeCBOR } from '@levischuck/tiny-cbor';
import { buildApp } from '../src/app/app.js';
import { runMigrations } from '../src/database/migrate.js';
import { seedDatabase } from '../src/database/seed.js';
import { getDatabasePool, closeDatabasePool, resetDatabasePool } from '../src/database/pool.js';
import { FastifyInstance } from 'fastify';
import { env } from '../src/config/env.js';

const testDbDir = path.resolve(process.cwd(), 'tests', '.tmp');
const testDbPath = path.resolve(testDbDir, `passkey_auth_${process.pid}_${Date.now()}.db`);

describe('Passkey (FIDO2 / WebAuthn) Authentication Test Suite', () => {
  let app: FastifyInstance;
  let testUserToken: string;
  let testUserId: number;
  const testEmail = 'passkey_test_user@fitnessplatform.com';
  const origDbClient = env.dbClient;

  // Generate an EC P-256 keypair and complete WebAuthn binary responses to
  // exercise the same standard contract used by browsers and native bridges.
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' }) as { x?: string; y?: string };
  const testCredentialId = crypto.randomBytes(16).toString('base64url');

  const decode = (value: string) => Buffer.from(value, 'base64url');
  const webAuthnResponse = (challenge: string, type: 'webauthn.create' | 'webauthn.get', counter: number) => {
    const clientDataJSON = Buffer.from(JSON.stringify({ type, challenge, origin: 'http://localhost' }));
    const rpIdHash = crypto.createHash('sha256').update('localhost').digest();
    const authData = Buffer.alloc(37);
    rpIdHash.copy(authData, 0);
    authData[32] = type === 'webauthn.create' ? 0x41 : 0x01; // user present; attested data on registration
    authData.writeUInt32BE(counter, 33);

    if (type === 'webauthn.create') {
      const credentialId = decode(testCredentialId);
      const credentialPublicKey = encodeCBOR(new Map<any, any>([
        [1, 2], [3, -7], [-1, 1], [-2, decode(jwk.x!)], [-3, decode(jwk.y!)],
      ]));
      const attestedData = Buffer.concat([
        Buffer.alloc(16),
        Buffer.from([(credentialId.length >> 8) & 0xff, credentialId.length & 0xff]),
        credentialId,
        Buffer.from(credentialPublicKey),
      ]);
      return {
        id: testCredentialId,
        rawId: testCredentialId,
        type: 'public-key',
        clientExtensionResults: {},
        response: {
          clientDataJSON: clientDataJSON.toString('base64url'),
          attestationObject: Buffer.from(encodeCBOR(new Map<any, any>([
            ['fmt', 'none'], ['attStmt', new Map<any, any>()], ['authData', Buffer.concat([authData, attestedData])],
          ]))).toString('base64url'),
        },
      };
    }

    const signedData = Buffer.concat([
      authData,
      crypto.createHash('sha256').update(clientDataJSON).digest(),
    ]);
    const signature = crypto.createSign('SHA256').update(signedData).sign(privateKey);
    return {
      id: testCredentialId,
      rawId: testCredentialId,
      type: 'public-key',
      clientExtensionResults: {},
      response: {
        clientDataJSON: clientDataJSON.toString('base64url'),
        authenticatorData: authData.toString('base64url'),
        signature: signature.toString('base64url'),
      },
    };
  };

  const customWebAuthnResponse = (
    challenge: string,
    counter: number,
    overrides?: {
      origin?: string;
      rpId?: string;
      flags?: number;
      corruptSig?: boolean;
      credentialId?: string;
    }
  ) => {
    const origin = overrides?.origin ?? 'http://localhost';
    const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin }));
    const rpIdHash = crypto.createHash('sha256').update(overrides?.rpId ?? 'localhost').digest();
    const authData = Buffer.alloc(37);
    rpIdHash.copy(authData, 0);
    authData[32] = overrides?.flags !== undefined ? overrides.flags : 0x01;
    authData.writeUInt32BE(counter, 33);

    const signedData = Buffer.concat([
      authData,
      crypto.createHash('sha256').update(clientDataJSON).digest(),
    ]);
    let signature = crypto.createSign('SHA256').update(signedData).sign(privateKey);
    if (overrides?.corruptSig) {
      const copy = Buffer.from(signature);
      copy[copy.length - 1] ^= 0xff;
      signature = copy;
    }
    const credId = overrides?.credentialId ?? testCredentialId;
    return {
      id: credId,
      rawId: credId,
      type: 'public-key',
      clientExtensionResults: {},
      response: {
        clientDataJSON: clientDataJSON.toString('base64url'),
        authenticatorData: authData.toString('base64url'),
        signature: signature.toString('base64url'),
      },
    };
  };

  beforeAll(async () => {
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }

    process.env.SQLITE_DB_PATH = testDbPath;
    env.sqliteDbPath = testDbPath;
    env.dbClient = 'sqlite';
    resetDatabasePool();

    await runMigrations();
    await seedDatabase();
    const db = getDatabasePool();

    // Ensure test user exists
    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default || bcryptModule;
    const passHash = await bcrypt.hash('Password123!', 10);
    const existing = await db.queryOne<any>('SELECT id FROM users WHERE email = ?', [testEmail]);
    if (!existing) {
      const res = await db.execute(
        `INSERT INTO users (role_id, first_name, last_name, email, password_hash, status)
         VALUES (3, 'Passkey', 'Tester', ?, ?, 'active')`,
        [testEmail, passHash]
      );
      testUserId = res.insertId;
    } else {
      testUserId = existing.id;
      await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passHash, testUserId]);
    }

    app = await buildApp();
    await app.ready();

    // Log in with password to get token for registration tests
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: testEmail, password: 'Password123!' },
    });
    testUserToken = loginRes.json().data.accessToken;
  });

  it('1. Registration Options: requires authentication and generates challenge', async () => {
    // Unauthenticated request fails with 401
    const unauthRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/register-options',
    });
    expect(unauthRes.statusCode).toBe(401);

    // Authenticated request succeeds
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/register-options',
      headers: { authorization: `Bearer ${testUserToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.challengeId).toBeDefined();
    expect(body.data.challenge).toBeDefined();
    expect(body.data.rp.name).toBeDefined();
    expect(body.data.user.name).toBe(testEmail);
  });

  it('2. Registration Verify: registers new passkey credential and prevents duplicates', async () => {
    // 1. Get fresh challenge
    const optRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/register-options',
      headers: { authorization: `Bearer ${testUserToken}` },
    });
    const challengeId = optRes.json().data.challengeId;

    // 2. Register credential
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/register-verify',
      headers: { authorization: `Bearer ${testUserToken}` },
      payload: {
        challengeId,
        response: webAuthnResponse(optRes.json().data.challenge, 'webauthn.create', 0),
        deviceName: 'Pixel 8 Pro (Test Authenticator)',
        transports: ['internal', 'hybrid'],
      },
    });
    expect(regRes.statusCode).toBe(201);
    const regBody = regRes.json();
    expect(regBody.success).toBe(true);
    expect(regBody.data.credentialId).toBe(testCredentialId);
    expect(regBody.data.deviceName).toBe('Pixel 8 Pro (Test Authenticator)');

    // 3. Challenge is consumed: replay fails
    const replayRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/register-verify',
      headers: { authorization: `Bearer ${testUserToken}` },
      payload: {
        challengeId,
        response: webAuthnResponse(optRes.json().data.challenge, 'webauthn.create', 0),
      },
    });
    expect(replayRes.statusCode).toBe(400);

    // 4. Duplicate credentialId fails with 409
    const optRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/register-options',
      headers: { authorization: `Bearer ${testUserToken}` },
    });
    const dupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/register-verify',
      headers: { authorization: `Bearer ${testUserToken}` },
      payload: {
        challengeId: optRes2.json().data.challengeId,
        response: webAuthnResponse(optRes2.json().data.challenge, 'webauthn.create', 0), // duplicate
      },
    });
    expect(dupRes.statusCode).toBe(409);
  });

  it('3. Login Options: returns challenge and allowCredentials for registered user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-options',
      payload: { email: testEmail },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.challengeId).toBeDefined();
    expect(body.data.challenge).toBeDefined();
    expect(body.data.allowCredentials).toBeDefined();
    expect(body.data.allowCredentials.some((c: any) => c.id === testCredentialId)).toBe(true);
  });

  it('4. Login Verify: cryptographically verifies signature and issues valid session tokens', async () => {
    // 1. Fetch challenge
    const optRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-options',
      payload: { email: testEmail },
    });
    const { challengeId, challenge } = optRes.json().data;

    // 5. Submit to login-verify
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-verify',
      payload: {
        challengeId,
        response: webAuthnResponse(challenge, 'webauthn.get', 1),
        deviceName: 'Pixel 8 Pro (Test Authenticator)',
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginBody = loginRes.json();
    expect(loginBody.success).toBe(true);
    expect(loginBody.data.accessToken).toBeDefined();
    expect(loginBody.data.refreshToken).toBeDefined();
    expect(loginBody.data.user.email).toBe(testEmail);

    // 6. Verify accessToken accesses protected endpoints
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${loginBody.data.accessToken}` },
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().data.email).toBe(testEmail);

    // 7. Anti-replay: cannot use same challenge again
    const replayRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-verify',
      payload: {
        challengeId,
        response: webAuthnResponse(challenge, 'webauthn.get', 2),
      },
    });
    expect(replayRes.statusCode).toBe(401);
  });

  it('5. Adversarial WebAuthn Security: verifies rejection of malformed payloads, wrong origins, wrong RP IDs, invalid flags, unknown credentials, invalid signatures, counter rollback, and expired challenges', async () => {
    // A. Malformed payload rejected with 400
    const malformedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-verify',
      payload: {
        challengeId: 'some-challenge-id',
        response: { id: testCredentialId },
      },
    });
    expect(malformedRes.statusCode).toBe(400);

    // B. Wrong origin rejected with 401 SIGNATURE_INVALID
    const optOrigin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-options',
      payload: { email: testEmail },
    });
    const wrongOriginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-verify',
      payload: {
        challengeId: optOrigin.json().data.challengeId,
        response: customWebAuthnResponse(optOrigin.json().data.challenge, 2, { origin: 'https://phishing-attacker.com' }),
      },
    });
    expect(wrongOriginRes.statusCode).toBe(401);
    expect(wrongOriginRes.json().error.code).toBe('SIGNATURE_INVALID');

    // C. Wrong RP ID rejected with 401 SIGNATURE_INVALID
    const optRp = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-options',
      payload: { email: testEmail },
    });
    const wrongRpRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-verify',
      payload: {
        challengeId: optRp.json().data.challengeId,
        response: customWebAuthnResponse(optRp.json().data.challenge, 2, { rpId: 'attacker.example.com' }),
      },
    });
    expect(wrongRpRes.statusCode).toBe(401);
    expect(wrongRpRes.json().error.code).toBe('SIGNATURE_INVALID');

    // D. Invalid flags (UP flag bit 0 cleared) rejected with 401 SIGNATURE_INVALID
    const optFlags = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-options',
      payload: { email: testEmail },
    });
    const invalidFlagsRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-verify',
      payload: {
        challengeId: optFlags.json().data.challengeId,
        response: customWebAuthnResponse(optFlags.json().data.challenge, 2, { flags: 0x00 }),
      },
    });
    expect(invalidFlagsRes.statusCode).toBe(401);
    expect(invalidFlagsRes.json().error.code).toBe('SIGNATURE_INVALID');

    // E. Unknown credential rejected with 401 UNKNOWN_CREDENTIAL
    const optUnknown = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-options',
      payload: { email: testEmail },
    });
    const unknownCredRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-verify',
      payload: {
        challengeId: optUnknown.json().data.challengeId,
        response: customWebAuthnResponse(optUnknown.json().data.challenge, 2, { credentialId: 'unregistered-credential-id-999' }),
      },
    });
    expect(unknownCredRes.statusCode).toBe(401);
    expect(unknownCredRes.json().error.code).toBe('UNKNOWN_CREDENTIAL');

    // F. Invalid signature rejected with 401 SIGNATURE_INVALID
    const optSig = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-options',
      payload: { email: testEmail },
    });
    const invalidSigRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-verify',
      payload: {
        challengeId: optSig.json().data.challengeId,
        response: customWebAuthnResponse(optSig.json().data.challenge, 2, { corruptSig: true }),
      },
    });
    expect(invalidSigRes.statusCode).toBe(401);
    expect(invalidSigRes.json().error.code).toBe('SIGNATURE_INVALID');

    // G. Counter rollback / clone detection: counter 1 <= stored counter 1 rejected with 401 SIGNATURE_INVALID
    const optCounter = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-options',
      payload: { email: testEmail },
    });
    const rollbackRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-verify',
      payload: {
        challengeId: optCounter.json().data.challengeId,
        response: customWebAuthnResponse(optCounter.json().data.challenge, 1),
      },
    });
    expect(rollbackRes.statusCode).toBe(401);
    expect(rollbackRes.json().error.code).toBe('SIGNATURE_INVALID');

    // H. Expired challenge rejected with 401 CHALLENGE_EXPIRED
    const db = getDatabasePool();
    const expiredId = crypto.randomUUID();
    await db.execute(
      `INSERT INTO auth_webauthn_challenges (id, user_id, challenge, ceremony_type, expires_at)
       VALUES (?, ?, 'expired-challenge-token', 'authentication', ?)`,
      [expiredId, testUserId, new Date(Date.now() - 300000)],
    );
    const expiredRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-verify',
      payload: {
        challengeId: expiredId,
        response: customWebAuthnResponse('expired-challenge-token', 5),
      },
    });
    expect(expiredRes.statusCode).toBe(401);
    expect(expiredRes.json().error.code).toBe('CHALLENGE_EXPIRED');
  });

  it('6. Passkey Management: lists user passkeys and allows revocation', async () => {
    // Legacy HMAC records are retained for visibility but can never be used
    // as WebAuthn credentials after the cryptographic migration.
    const db = getDatabasePool();
    const legacyCredentialId = 'legacy-hmac-passkey-fixture';
    const legacy = await db.queryOne<any>('SELECT id FROM user_passkeys WHERE credential_id = ?', [legacyCredentialId]);
    if (!legacy) {
      await db.execute(
        `INSERT INTO user_passkeys (user_id, credential_id, public_key, credential_format, counter, device_name)
         VALUES (?, ?, ?, 'legacy-hmac', 0, 'Legacy HMAC fixture')`,
        [testUserId, legacyCredentialId, 'hmac:unsupported-fixture'],
      );
    }
    const legacyOptions = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-options',
      payload: { email: testEmail },
    });
    const legacyLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/passkey/login-verify',
      payload: {
        challengeId: legacyOptions.json().data.challengeId,
        response: {
          id: legacyCredentialId,
          rawId: legacyCredentialId,
          type: 'public-key',
          clientExtensionResults: {},
          response: { clientDataJSON: 'dGVzdA', authenticatorData: 'dGVzdA', signature: 'dGVzdA' },
        },
      },
    });
    expect(legacyLogin.statusCode).toBe(401);
    expect(legacyLogin.json().error.code).toBe('PASSKEY_REENROLL_REQUIRED');

    // List passkeys
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/me/passkeys',
      headers: { authorization: `Bearer ${testUserToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json();
    expect(listBody.success).toBe(true);
    expect(Array.isArray(listBody.data)).toBe(true);
    const registered = listBody.data.find((p: any) => p.credentialId === testCredentialId);
    expect(registered).toBeDefined();
    expect(registered.deviceName).toBe('Pixel 8 Pro (Test Authenticator)');

    // Delete passkey
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/me/passkeys/${registered.id}`,
      headers: { authorization: `Bearer ${testUserToken}` },
    });
    expect(delRes.statusCode).toBe(200);

    // Confirm it is gone
    const listRes2 = await app.inject({
      method: 'GET',
      url: '/api/v1/me/passkeys',
      headers: { authorization: `Bearer ${testUserToken}` },
    });
    expect(listRes2.json().data.some((p: any) => p.credentialId === testCredentialId)).toBe(false);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await closeDatabasePool();
    env.dbClient = origDbClient;
    resetDatabasePool();

    try {
      const filesToDelete = [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`];
      for (const file of filesToDelete) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    } catch {
      // Ignore cleanup error
    }
  });
});
