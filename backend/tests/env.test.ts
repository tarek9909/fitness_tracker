import { describe, it, expect } from 'vitest';
import { validateAndLoadEnv } from '../src/config/env.js';

describe('Production Environment Configuration & Validation Suite', () => {
  const validProdBase = {
    NODE_ENV: 'production',
    DB_CLIENT: 'mysql',
    DATABASE_HOST: 'localhost',
    DATABASE_PORT: '3306',
    DATABASE_NAME: 'fitness_platform',
    DATABASE_USER: 'fitness_user',
    DATABASE_PASSWORD: 'prod-secure-database-password-12345',
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.mailprovider.com',
    SMTP_PORT: '587',
    SMTP_USER: 'smtp_user',
    SMTP_PASSWORD: 'smtp_password',
    SMTP_FROM: 'noreply@fitnessplatform.com',
    OTP_PEPPER: 'production-otp-pepper-secret-64-characters-long-key-abc123',
    ACCESS_TOKEN_SECRET: 'production-access-token-secret-64-characters-long-key-abc123456789',
    REFRESH_TOKEN_SECRET: 'production-refresh-token-secret-64-characters-long-key-xyz987654321',
    COOKIE_SECRET: 'production-cookie-signing-secret-64-characters-long-key-qwe123456',
    PASSWORD_RESET_BASE_URL: 'https://app.fitnessplatform.com/reset-password',
    ADMIN_ALLOWED_ORIGINS: 'https://admin.fitnessplatform.com,https://ops.fitnessplatform.com',
    WEBAUTHN_RP_ID: 'auth.fitnessplatform.com',
    WEBAUTHN_RP_NAME: 'Fitness Platform',
    WEBAUTHN_EXPECTED_ORIGINS: 'https://admin.fitnessplatform.com,https://ops.fitnessplatform.com',
  };

  it('Valid production configuration loads successfully with strict defaults', () => {
    const config = validateAndLoadEnv(validProdBase);
    expect(config.nodeEnv).toBe('production');
    expect(config.dbClient).toBe('mysql');
    expect(config.emailProvider).toBe('smtp');
    expect(config.cookieSameSite).toBe('strict');
    expect(config.adminAllowedOrigins).toEqual([
      'https://admin.fitnessplatform.com',
      'https://ops.fitnessplatform.com',
    ]);
  });

  it('Production rejects missing or non-mysql DB_CLIENT', () => {
    const missingDb = { ...validProdBase };
    delete (missingDb as any).DB_CLIENT;
    expect(() => validateAndLoadEnv(missingDb)).toThrow(/FATAL: In production, DB_CLIENT must be explicitly set to "mysql"/);

    const sqliteDb = { ...validProdBase, DB_CLIENT: 'sqlite' };
    expect(() => validateAndLoadEnv(sqliteDb)).toThrow(/FATAL: In production, DB_CLIENT must be explicitly set to "mysql"/);
  });

  it('Production rejects missing or non-smtp EMAIL_PROVIDER', () => {
    const noneEmail = { ...validProdBase, EMAIL_PROVIDER: 'none' };
    expect(() => validateAndLoadEnv(noneEmail)).toThrow(/FATAL: In production, EMAIL_PROVIDER must be explicitly set to "smtp"/);

    const mockEmail = { ...validProdBase, EMAIL_PROVIDER: 'mock' };
    expect(() => validateAndLoadEnv(mockEmail)).toThrow(/FATAL: In production, EMAIL_PROVIDER must be explicitly set to "smtp"/);
  });

  it('Production rejects missing COOKIE_SECRET', () => {
    const env = { ...validProdBase };
    delete (env as any).COOKIE_SECRET;
    expect(() => validateAndLoadEnv(env)).toThrow(/FATAL: COOKIE_SECRET must be set/);
  });

  it('Production rejects development default COOKIE_SECRET', () => {
    const env = {
      ...validProdBase,
      COOKIE_SECRET: 'development-cookie-signing-secret-32-chars-key',
    };
    expect(() => validateAndLoadEnv(env)).toThrow(/FATAL: COOKIE_SECRET must be set/);
  });

  it('Production rejects short COOKIE_SECRET (< 32 characters)', () => {
    const env = {
      ...validProdBase,
      COOKIE_SECRET: 'too-short-secret-key',
    };
    expect(() => validateAndLoadEnv(env)).toThrow(/FATAL: COOKIE_SECRET must be set/);
  });

  it('Production rejects missing or empty ADMIN_ALLOWED_ORIGINS', () => {
    const env = { ...validProdBase };
    delete (env as any).ADMIN_ALLOWED_ORIGINS;
    expect(() => validateAndLoadEnv(env)).toThrow(/FATAL: ADMIN_ALLOWED_ORIGINS must be explicitly configured/);

    const emptyEnv = { ...validProdBase, ADMIN_ALLOWED_ORIGINS: '   ' };
    expect(() => validateAndLoadEnv(emptyEnv)).toThrow(/FATAL: ADMIN_ALLOWED_ORIGINS must be explicitly configured/);
  });

  it('Production rejects unencrypted localhost in ADMIN_ALLOWED_ORIGINS', () => {
    const env = {
      ...validProdBase,
      ADMIN_ALLOWED_ORIGINS: 'http://localhost:5173,https://admin.fitnessplatform.com',
    };
    expect(() => validateAndLoadEnv(env)).toThrow(/cannot contain unencrypted localhost/);

    const envIp = {
      ...validProdBase,
      ADMIN_ALLOWED_ORIGINS: 'http://127.0.0.1:5173',
    };
    expect(() => validateAndLoadEnv(envIp)).toThrow(/cannot contain unencrypted localhost/);
  });

  it('Production rejects unencrypted http:// (non-HTTPS) remote origin in ADMIN_ALLOWED_ORIGINS', () => {
    const env = {
      ...validProdBase,
      ADMIN_ALLOWED_ORIGINS: 'http://admin.fitnessplatform.com',
    };
    expect(() => validateAndLoadEnv(env)).toThrow(/must use HTTPS in production/);
  });

  it('Production rejects missing or default ACCESS_TOKEN_SECRET', () => {
    const env = {
      ...validProdBase,
      ACCESS_TOKEN_SECRET: 'development-access-secret-32-chars-minimum-key',
    };
    expect(() => validateAndLoadEnv(env)).toThrow(/FATAL: ACCESS_TOKEN_SECRET must be set/);
  });

  it('Production rejects missing or default REFRESH_TOKEN_SECRET', () => {
    const env = {
      ...validProdBase,
      REFRESH_TOKEN_SECRET: 'development-refresh-secret-32-chars-minimum-key',
    };
    expect(() => validateAndLoadEnv(env)).toThrow(/FATAL: REFRESH_TOKEN_SECRET must be set/);
  });

  it('Production rejects non-HTTPS PASSWORD_RESET_BASE_URL', () => {
    const env = {
      ...validProdBase,
      PASSWORD_RESET_BASE_URL: 'http://app.fitnessplatform.com/reset',
    };
    expect(() => validateAndLoadEnv(env)).toThrow(/PASSWORD_RESET_BASE_URL must be configured as a valid https:\/\/ URL/);
  });

  it('Validates RATE_LIMIT_MAX with safe defaults and accepts valid values', () => {
    // 1. Defaults to 100 in production when omitted
    const prodConfig = validateAndLoadEnv(validProdBase);
    expect(prodConfig.rateLimitMax).toBe(100);

    // 2. Defaults to 10000 in test mode when omitted
    const testConfig = validateAndLoadEnv({ ...validProdBase, NODE_ENV: 'test', DB_CLIENT: 'sqlite' });
    expect(testConfig.rateLimitMax).toBe(10000);

    // 3. Accepts valid explicit numeric string within [1, 10000]
    const customConfig = validateAndLoadEnv({ ...validProdBase, RATE_LIMIT_MAX: '250' });
    expect(customConfig.rateLimitMax).toBe(250);

    const maxEdgeConfig = validateAndLoadEnv({ ...validProdBase, RATE_LIMIT_MAX: '10000' });
    expect(maxEdgeConfig.rateLimitMax).toBe(10000);

    const minEdgeConfig = validateAndLoadEnv({ ...validProdBase, RATE_LIMIT_MAX: '1' });
    expect(minEdgeConfig.rateLimitMax).toBe(1);
  });

  it('Rejects invalid, non-integer, non-positive, and unreasonably large RATE_LIMIT_MAX values', () => {
    const invalidCases = [
      '0',
      '-1',
      '-50',
      '12.5',
      '0.5',
      'abc',
      '12abc',
      'NaN',
      'Infinity',
      '-Infinity',
      '10001',
      '50000',
    ];

    for (const invalidValue of invalidCases) {
      expect(
        () => validateAndLoadEnv({ ...validProdBase, RATE_LIMIT_MAX: invalidValue }),
        `Expected RATE_LIMIT_MAX="${invalidValue}" to throw`
      ).toThrow(/FATAL: RATE_LIMIT_MAX must be a positive integer between 1 and 10000/);
    }
  });

  it('Production rejects template and example placeholders in required credentials', () => {
    // 1. DATABASE_PASSWORD placeholder
    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        DATABASE_PASSWORD: 'CHANGE_ME_SECURE_MYSQL_PASSWORD',
      })
    ).toThrow(/FATAL: DATABASE_PASSWORD cannot use a template placeholder in production/);

    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        DATABASE_PASSWORD: '<STRONG_LOCAL_PASSWORD>',
      })
    ).toThrow(/FATAL: DATABASE_PASSWORD cannot use a template placeholder in production/);

    // 2. DATABASE_USER placeholder
    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        DATABASE_USER: '<DATABASE_USER_PLACEHOLDER>',
      })
    ).toThrow(/FATAL: DATABASE_USER cannot use a template placeholder in production/);

    // 3. SMTP_PASSWORD placeholder
    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        SMTP_PASSWORD: 'CHANGE_ME_SECURE_SMTP_API_KEY',
      })
    ).toThrow(/FATAL: SMTP_PASSWORD cannot use a template placeholder in production/);

    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        SMTP_PASSWORD: '<SMTP_PASSWORD_PLACEHOLDER>',
      })
    ).toThrow(/FATAL: SMTP_PASSWORD cannot use a template placeholder in production/);

    // 4. SMTP_USER placeholder
    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        SMTP_USER: '<SMTP_USERNAME_PLACEHOLDER>',
      })
    ).toThrow(/FATAL: SMTP_USER cannot use a template placeholder in production/);

    // 5. ACCESS_TOKEN_SECRET placeholder
    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        ACCESS_TOKEN_SECRET: 'CHANGE_ME_GENERATE_RANDOM_64_CHAR_ACCESS_SECRET',
      })
    ).toThrow(/FATAL: ACCESS_TOKEN_SECRET cannot use a template placeholder in production/);

    // 6. REFRESH_TOKEN_SECRET placeholder
    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        REFRESH_TOKEN_SECRET: 'CHANGE_ME_GENERATE_RANDOM_64_CHAR_REFRESH_SECRET',
      })
    ).toThrow(/FATAL: REFRESH_TOKEN_SECRET cannot use a template placeholder in production/);

    // 7. COOKIE_SECRET placeholder
    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        COOKIE_SECRET: 'CHANGE_ME_GENERATE_RANDOM_64_CHAR_COOKIE_SECRET',
      })
    ).toThrow(/FATAL: COOKIE_SECRET cannot use a template placeholder in production/);

    expect(() => validateAndLoadEnv({ ...validProdBase, DATABASE_PASSWORD: '   ' })).toThrow(/must be configured/);
    expect(() => validateAndLoadEnv({ ...validProdBase, SMTP_PASSWORD: '   ' })).toThrow(/must be configured/);
    expect(() => validateAndLoadEnv({ ...validProdBase, ACCESS_TOKEN_SECRET: ' '.repeat(64) })).toThrow(/must be set/);
    expect(() => validateAndLoadEnv({ ...validProdBase, SMTP_HOST: 'smtp.placeholder.example' })).toThrow(/SMTP_HOST cannot use a template placeholder/);
    expect(() => validateAndLoadEnv({ ...validProdBase, SMTP_FROM: 'placeholder@example.com' })).toThrow(/SMTP_FROM cannot use a template placeholder/);
  });

  it('Validates numeric settings with sensible positive bounds and catches invalid inputs', () => {
    // 1. APP_PORT
    expect(() => validateAndLoadEnv({ ...validProdBase, APP_PORT: '0' })).toThrow(/FATAL: APP_PORT must be a positive integer/);
    expect(() => validateAndLoadEnv({ ...validProdBase, APP_PORT: '70000' })).toThrow(/FATAL: APP_PORT must be a positive integer/);
    expect(() => validateAndLoadEnv({ ...validProdBase, APP_PORT: 'abc' })).toThrow(/FATAL: APP_PORT must be a positive integer/);

    // 2. DATABASE_PORT
    expect(() => validateAndLoadEnv({ ...validProdBase, DATABASE_PORT: '0' })).toThrow(/FATAL: DATABASE_PORT must be a positive integer/);
    expect(() => validateAndLoadEnv({ ...validProdBase, DATABASE_PORT: '70000' })).toThrow(/FATAL: DATABASE_PORT must be a positive integer/);

    // 3. SMTP_PORT
    expect(() => validateAndLoadEnv({ ...validProdBase, SMTP_PORT: '0' })).toThrow(/FATAL: SMTP_PORT must be a positive integer/);
    expect(() => validateAndLoadEnv({ ...validProdBase, SMTP_PORT: '70000' })).toThrow(/FATAL: SMTP_PORT must be a positive integer/);

    // 4. DATABASE_POOL_MIN / MAX bounds
    expect(() => validateAndLoadEnv({ ...validProdBase, DATABASE_POOL_MIN: '0' })).toThrow(/FATAL: DATABASE_POOL_MIN must be a positive integer/);
    expect(() => validateAndLoadEnv({ ...validProdBase, DATABASE_POOL_MAX: '0' })).toThrow(/FATAL: DATABASE_POOL_MAX must be a positive integer/);
    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        DATABASE_POOL_MIN: '30',
        DATABASE_POOL_MAX: '10',
      })
    ).toThrow(/cannot exceed DATABASE_POOL_MAX/);

    // 5. ACCESS_TOKEN_TTL_SECONDS
    expect(() => validateAndLoadEnv({ ...validProdBase, ACCESS_TOKEN_TTL_SECONDS: '30' })).toThrow(/FATAL: ACCESS_TOKEN_TTL_SECONDS must be a positive integer between 60 and 86400/);
    expect(() => validateAndLoadEnv({ ...validProdBase, ACCESS_TOKEN_TTL_SECONDS: '100000' })).toThrow(/FATAL: ACCESS_TOKEN_TTL_SECONDS must be a positive integer between 60 and 86400/);

    // 6. REFRESH_TOKEN_TTL_DAYS
    expect(() => validateAndLoadEnv({ ...validProdBase, REFRESH_TOKEN_TTL_DAYS: '0' })).toThrow(/FATAL: REFRESH_TOKEN_TTL_DAYS must be a positive integer between 1 and 365/);
    expect(() => validateAndLoadEnv({ ...validProdBase, REFRESH_TOKEN_TTL_DAYS: '500' })).toThrow(/FATAL: REFRESH_TOKEN_TTL_DAYS must be a positive integer between 1 and 365/);

    // 7. REMINDER_WORKER_INTERVAL_SECONDS
    expect(() => validateAndLoadEnv({ ...validProdBase, REMINDER_WORKER_INTERVAL_SECONDS: '2' })).toThrow(/FATAL: REMINDER_WORKER_INTERVAL_SECONDS must be a positive integer between 5 and 3600/);
    expect(() => validateAndLoadEnv({ ...validProdBase, REMINDER_WORKER_INTERVAL_SECONDS: '4000' })).toThrow(/FATAL: REMINDER_WORKER_INTERVAL_SECONDS must be a positive integer between 5 and 3600/);
  });

  it('Validates PASSWORD_RESET_BASE_URL rejecting credentials, localhost, and malformed URLs', () => {
    // 1. Rejects embedded credentials in production
    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        PASSWORD_RESET_BASE_URL: 'https://user:pass@app.fitnessplatform.com/reset',
      })
    ).toThrow(/cannot contain embedded credentials in production/);

    // 2. Rejects localhost in production
    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        PASSWORD_RESET_BASE_URL: 'https://localhost/reset',
      })
    ).toThrow(/cannot use localhost in production/);

    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        PASSWORD_RESET_BASE_URL: 'https://127.0.0.1/reset',
      })
    ).toThrow(/cannot use localhost in production/);

    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        PASSWORD_RESET_BASE_URL: 'https://[::1]/reset',
      })
    ).toThrow(/cannot use localhost in production/);

    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        PASSWORD_RESET_BASE_URL: 'https://CHANGE_ME.example/reset',
      })
    ).toThrow(/valid https:\/\/ URL in production/);

    // 3. Rejects malformed URL in production
    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        PASSWORD_RESET_BASE_URL: 'https://',
      })
    ).toThrow(/must be configured as a valid https:\/\/ URL in production/);

    // 4. Rejects unparseable URL in development
    expect(() =>
      validateAndLoadEnv({
        NODE_ENV: 'development',
        PASSWORD_RESET_BASE_URL: 'not-a-valid-url',
      })
    ).toThrow(/PASSWORD_RESET_BASE_URL is not a valid URL/);
  });

  it('Validates ADMIN_ALLOWED_ORIGINS strictly rejecting paths, queries, fragments, credentials, and malformed origins', () => {
    // 1. Rejects path component in origin
    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        ADMIN_ALLOWED_ORIGINS: 'https://admin.fitnessplatform.com/dashboard',
      })
    ).toThrow(/must not contain path components/);

    // 2. Rejects query string in origin
    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        ADMIN_ALLOWED_ORIGINS: 'https://admin.fitnessplatform.com?ref=prod',
      })
    ).toThrow(/must not contain query, fragment, or credentials/);

    // 3. Rejects credentials in origin
    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        ADMIN_ALLOWED_ORIGINS: 'https://admin:secret@admin.fitnessplatform.com',
      })
    ).toThrow(/must not contain query, fragment, or credentials/);

    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        ADMIN_ALLOWED_ORIGINS: 'https://localhost:5173',
      })
    ).toThrow(/cannot use localhost or loopback/);

    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        ADMIN_ALLOWED_ORIGINS: 'https://[::1]:5173',
      })
    ).toThrow(/cannot use localhost or loopback/);

    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        ADMIN_ALLOWED_ORIGINS: 'https://CHANGE_ME.example',
      })
    ).toThrow(/cannot use template placeholders/);

    // 4. Rejects malformed origin in production
    expect(() =>
      validateAndLoadEnv({
        ...validProdBase,
        ADMIN_ALLOWED_ORIGINS: 'https://',
      })
    ).toThrow(/contains an invalid HTTPS origin/);

    // 5. Rejects unparseable origin in development
    expect(() =>
      validateAndLoadEnv({
        NODE_ENV: 'development',
        ADMIN_ALLOWED_ORIGINS: 'not-an-origin',
      })
    ).toThrow(/contains an invalid URL origin/);
  });

  it('Rejects unsupported COOKIE_SAME_SITE values', () => {
    expect(() => validateAndLoadEnv({ ...validProdBase, COOKIE_SAME_SITE: 'none' })).toThrow(/COOKIE_SAME_SITE must be/);
    expect(validateAndLoadEnv({ ...validProdBase, COOKIE_SAME_SITE: ' STRICT ' }).cookieSameSite).toBe('strict');
  });
});
