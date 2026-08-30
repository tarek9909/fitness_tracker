import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface EnvConfig {
  nodeEnv: 'development' | 'production' | 'test';
  appHost: string;
  appPort: number;
  trustProxy: boolean;
  dbClient: 'mysql' | 'sqlite';
  databaseHost?: string;
  databasePort?: number;
  databaseName?: string;
  databaseUser?: string;
  databasePassword?: string;
  databasePoolMin: number;
  databasePoolMax: number;
  sqliteDbPath: string;
  accessTokenSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenSecret: string;
  refreshTokenTtlDays: number;
  cookieSecret: string;
  cookieSameSite: 'strict' | 'lax';
  adminAllowedOrigins: string[];
  logLevel: string;
  emailProvider: 'smtp' | 'mock' | 'none';
  pushProvider: 'mock' | 'none';
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom?: string;
  passwordResetBaseUrl: string;
  reminderWorkerIntervalSeconds: number;
  rateLimitMax: number;
}

const defaultDevAccessSecret = 'development-access-secret-32-chars-minimum-key';
const defaultDevRefreshSecret = 'development-refresh-secret-32-chars-minimum-key';
const defaultDevCookieSecret = 'development-cookie-signing-secret-32-chars-key';

function isBlankValue(value: string | undefined): boolean {
  return value === undefined || value.trim() === '';
}

function isPlaceholderValue(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') return false;
  const lower = trimmed.toLowerCase();
  return (
    lower.includes('change_me') ||
    lower.includes('changeme') ||
    lower.includes('replace_me') ||
    lower.includes('replaceme') ||
    (lower.startsWith('<') && lower.endsWith('>')) ||
    lower.includes('placeholder') ||
    lower.includes('your_secret') ||
    lower.includes('your_password') ||
    lower.includes('your_api_key') ||
    lower.includes('generate_random') ||
    lower.includes('generate_32_char') ||
    lower.includes('strong_local_password') ||
    lower === 'secret' ||
    lower === 'password' ||
    lower === 'admin'
  );
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]';
}

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
  fieldName: string
): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const trimmed = String(value).trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`FATAL: ${fieldName} must be a positive integer between ${min} and ${max} (received: "${value}")`);
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`FATAL: ${fieldName} must be a positive integer between ${min} and ${max} (received: "${value}")`);
  }
  return parsed;
}

export function validateAndLoadEnv(source: Record<string, string | undefined> = process.env): EnvConfig {
  const nodeEnvValue = source.NODE_ENV || 'development';
  if (!['development', 'production', 'test'].includes(nodeEnvValue)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const dbClientValue = source.DB_CLIENT || (nodeEnvValue === 'production' ? '' : 'sqlite');
  if (nodeEnvValue === 'production') {
    if (dbClientValue !== 'mysql') {
      throw new Error(`FATAL: In production, DB_CLIENT must be explicitly set to "mysql" (received: "${dbClientValue || 'undefined'}")`);
    }
  } else {
    if (!['mysql', 'sqlite'].includes(dbClientValue)) {
      throw new Error('DB_CLIENT must be mysql or sqlite');
    }
  }

  if (dbClientValue === 'mysql') {
    if (
      isBlankValue(source.DATABASE_HOST) ||
      isBlankValue(source.DATABASE_PORT) ||
      isBlankValue(source.DATABASE_NAME) ||
      isBlankValue(source.DATABASE_USER) ||
      isBlankValue(source.DATABASE_PASSWORD)
    ) {
      throw new Error('FATAL: When DB_CLIENT=mysql, DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, and DATABASE_PASSWORD must be configured.');
    }
    if (nodeEnvValue === 'production') {
      if (isPlaceholderValue(source.DATABASE_PASSWORD)) {
        throw new Error(`FATAL: DATABASE_PASSWORD cannot use a template placeholder in production (received: "${source.DATABASE_PASSWORD}")`);
      }
      if (isPlaceholderValue(source.DATABASE_USER)) {
        throw new Error(`FATAL: DATABASE_USER cannot use a template placeholder in production (received: "${source.DATABASE_USER}")`);
      }
    }
  }

  const emailProviderRaw = source.EMAIL_PROVIDER || (nodeEnvValue === 'test' ? 'mock' : (nodeEnvValue === 'production' ? '' : 'none'));
  if (nodeEnvValue === 'production') {
    if (emailProviderRaw !== 'smtp') {
      throw new Error(`FATAL: In production, EMAIL_PROVIDER must be explicitly set to "smtp" with live server configuration (received: "${emailProviderRaw || 'undefined'}")`);
    }
  } else {
    if (!['smtp', 'mock', 'none'].includes(emailProviderRaw)) {
      throw new Error('FATAL: EMAIL_PROVIDER must be "smtp", "mock", or "none".');
    }
  }

  if (emailProviderRaw === 'smtp') {
    if (
      isBlankValue(source.SMTP_HOST) ||
      isBlankValue(source.SMTP_PORT) ||
      isBlankValue(source.SMTP_USER) ||
      isBlankValue(source.SMTP_PASSWORD) ||
      isBlankValue(source.SMTP_FROM)
    ) {
      throw new Error('FATAL: When EMAIL_PROVIDER=smtp, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM must be configured.');
    }
    if (nodeEnvValue === 'production') {
      if (isPlaceholderValue(source.SMTP_HOST)) {
        throw new Error(`FATAL: SMTP_HOST cannot use a template placeholder in production (received: "${source.SMTP_HOST}")`);
      }
      if (isPlaceholderValue(source.SMTP_PASSWORD)) {
        throw new Error(`FATAL: SMTP_PASSWORD cannot use a template placeholder in production (received: "${source.SMTP_PASSWORD}")`);
      }
      if (isPlaceholderValue(source.SMTP_USER)) {
        throw new Error(`FATAL: SMTP_USER cannot use a template placeholder in production (received: "${source.SMTP_USER}")`);
      }
      if (isPlaceholderValue(source.SMTP_FROM)) {
        throw new Error(`FATAL: SMTP_FROM cannot use a template placeholder in production (received: "${source.SMTP_FROM}")`);
      }
    }
  }

  const accessTokenSecret = source.ACCESS_TOKEN_SECRET || defaultDevAccessSecret;
  const refreshTokenSecret = source.REFRESH_TOKEN_SECRET || defaultDevRefreshSecret;
  const cookieSecret = source.COOKIE_SECRET || defaultDevCookieSecret;

  if (nodeEnvValue === 'production') {
    if (isBlankValue(source.ACCESS_TOKEN_SECRET)) {
      throw new Error('FATAL: ACCESS_TOKEN_SECRET must be set to a secure 32+ character non-default secret in production');
    }
    if (isPlaceholderValue(source.ACCESS_TOKEN_SECRET) || isPlaceholderValue(accessTokenSecret)) {
      throw new Error('FATAL: ACCESS_TOKEN_SECRET cannot use a template placeholder in production');
    }
    if (
      accessTokenSecret.length < 32 ||
      accessTokenSecret === defaultDevAccessSecret ||
      accessTokenSecret.includes('development') ||
      accessTokenSecret.includes('dev-access')
    ) {
      throw new Error('FATAL: ACCESS_TOKEN_SECRET must be set to a secure 32+ character non-default secret in production');
    }

    if (isBlankValue(source.REFRESH_TOKEN_SECRET)) {
      throw new Error('FATAL: REFRESH_TOKEN_SECRET must be set to a secure 32+ character non-default secret in production');
    }
    if (isPlaceholderValue(source.REFRESH_TOKEN_SECRET) || isPlaceholderValue(refreshTokenSecret)) {
      throw new Error('FATAL: REFRESH_TOKEN_SECRET cannot use a template placeholder in production');
    }
    if (
      refreshTokenSecret.length < 32 ||
      refreshTokenSecret.includes('development') ||
      refreshTokenSecret.includes('dev-refresh')
    ) {
      throw new Error('FATAL: REFRESH_TOKEN_SECRET must be set to a secure 32+ character non-default secret in production');
    }

    if (isBlankValue(source.COOKIE_SECRET)) {
      throw new Error('FATAL: COOKIE_SECRET must be set to a secure 32+ character non-default secret in production');
    }
    if (isPlaceholderValue(source.COOKIE_SECRET) || isPlaceholderValue(cookieSecret)) {
      throw new Error('FATAL: COOKIE_SECRET cannot use a template placeholder in production');
    }
    if (
      cookieSecret.length < 32 ||
      cookieSecret === defaultDevCookieSecret ||
      cookieSecret.includes('development') ||
      cookieSecret.includes('dev-cookie')
    ) {
      throw new Error('FATAL: COOKIE_SECRET must be set to a secure 32+ character non-default secret in production');
    }
    const passwordResetUrlRaw = source.PASSWORD_RESET_BASE_URL;
    if (isBlankValue(passwordResetUrlRaw) || isPlaceholderValue(passwordResetUrlRaw) || !passwordResetUrlRaw || !passwordResetUrlRaw.startsWith('https://')) {
      throw new Error('FATAL: PASSWORD_RESET_BASE_URL must be configured as a valid https:// URL in production');
    }
    let parsedResetUrl: URL;
    try {
      parsedResetUrl = new URL(passwordResetUrlRaw);
    } catch {
      throw new Error(`FATAL: PASSWORD_RESET_BASE_URL must be configured as a valid https:// URL in production (received: "${passwordResetUrlRaw}")`);
    }
    if (parsedResetUrl.protocol !== 'https:' || !parsedResetUrl.hostname || parsedResetUrl.hostname.trim() === '') {
      throw new Error(`FATAL: PASSWORD_RESET_BASE_URL must be configured as a valid https:// URL in production (received: "${passwordResetUrlRaw}")`);
    }
    if (parsedResetUrl.username || parsedResetUrl.password) {
      throw new Error(`FATAL: PASSWORD_RESET_BASE_URL cannot contain embedded credentials in production (received: "${passwordResetUrlRaw}")`);
    }
    if (isLoopbackHostname(parsedResetUrl.hostname)) {
      throw new Error(`FATAL: PASSWORD_RESET_BASE_URL cannot use localhost in production (received: "${passwordResetUrlRaw}")`);
    }

    const originsRaw = source.ADMIN_ALLOWED_ORIGINS || '';
    const origins = originsRaw
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
    if (origins.length === 0) {
      throw new Error('FATAL: ADMIN_ALLOWED_ORIGINS must be explicitly configured in production with HTTPS origin(s)');
    }
    for (const origin of origins) {
      if (isPlaceholderValue(origin)) {
        throw new Error(`FATAL: ADMIN_ALLOWED_ORIGINS cannot use template placeholders in production (received: "${origin}")`);
      }
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        throw new Error(`FATAL: ADMIN_ALLOWED_ORIGINS cannot contain unencrypted localhost in production (received: "${origin}")`);
      }
      if (!origin.startsWith('https://')) {
        throw new Error(`FATAL: ADMIN_ALLOWED_ORIGINS must use HTTPS in production (received: "${origin}")`);
      }
      let originUrl: URL;
      try {
        originUrl = new URL(origin);
      } catch {
        throw new Error(`FATAL: ADMIN_ALLOWED_ORIGINS contains an invalid HTTPS origin (received: "${origin}")`);
      }
      if (originUrl.protocol !== 'https:' || !originUrl.hostname) {
        throw new Error(`FATAL: ADMIN_ALLOWED_ORIGINS must use HTTPS in production (received: "${origin}")`);
      }
      if (isLoopbackHostname(originUrl.hostname)) {
        throw new Error(`FATAL: ADMIN_ALLOWED_ORIGINS cannot use localhost or loopback addresses in production (received: "${origin}")`);
      }
      if (originUrl.pathname !== '/' && originUrl.pathname !== '') {
        throw new Error(`FATAL: ADMIN_ALLOWED_ORIGINS origins must not contain path components (received: "${origin}")`);
      }
      if (originUrl.search || originUrl.hash || originUrl.username || originUrl.password) {
        throw new Error(`FATAL: ADMIN_ALLOWED_ORIGINS origins must not contain query, fragment, or credentials (received: "${origin}")`);
      }
    }
  }

  const emailProviderValue = emailProviderRaw as 'smtp' | 'mock' | 'none';
  const pushProviderRaw = source.PUSH_PROVIDER?.trim().toLowerCase() || (nodeEnvValue === 'test' || nodeEnvValue === 'development' ? 'mock' : 'none');
  if (!['mock', 'none', 'disabled'].includes(pushProviderRaw)) {
    throw new Error('FATAL: PUSH_PROVIDER must be "mock", "none", or "disabled".');
  }
  const pushProviderValue = (pushProviderRaw === 'disabled' ? 'none' : pushProviderRaw) as 'mock' | 'none';

  const passwordResetBaseUrl = source.PASSWORD_RESET_BASE_URL || 'https://app.fitnessplatform.local/reset-password';
  if (source.PASSWORD_RESET_BASE_URL && nodeEnvValue !== 'production') {
    try {
      new URL(source.PASSWORD_RESET_BASE_URL);
    } catch {
      throw new Error(`FATAL: PASSWORD_RESET_BASE_URL is not a valid URL (received: "${source.PASSWORD_RESET_BASE_URL}")`);
    }
  }

  const cookieSameSiteRaw = source.COOKIE_SAME_SITE?.trim().toLowerCase() || (nodeEnvValue === 'production' ? 'strict' : 'lax');
  if (cookieSameSiteRaw !== 'strict' && cookieSameSiteRaw !== 'lax') {
    throw new Error(`FATAL: COOKIE_SAME_SITE must be "strict" or "lax" (received: "${source.COOKIE_SAME_SITE}")`);
  }
  const cookieSameSite = cookieSameSiteRaw as 'strict' | 'lax';

  const adminAllowedOrigins = (source.ADMIN_ALLOWED_ORIGINS || (nodeEnvValue === 'production' ? '' : 'http://localhost:5173,http://127.0.0.1:5173'))
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  if (nodeEnvValue !== 'production') {
    for (const origin of adminAllowedOrigins) {
      try {
        new URL(origin);
      } catch {
        throw new Error(`FATAL: ADMIN_ALLOWED_ORIGINS contains an invalid URL origin (received: "${origin}")`);
      }
    }
  }

  const appPort = parseBoundedInteger(source.APP_PORT, 3000, 1, 65535, 'APP_PORT');
  const databasePort = parseBoundedInteger(source.DATABASE_PORT, 3306, 1, 65535, 'DATABASE_PORT');
  const smtpPort = parseBoundedInteger(source.SMTP_PORT, 587, 1, 65535, 'SMTP_PORT');
  const databasePoolMin = parseBoundedInteger(source.DATABASE_POOL_MIN, nodeEnvValue === 'production' ? 5 : 2, 1, 100, 'DATABASE_POOL_MIN');
  const databasePoolMax = parseBoundedInteger(source.DATABASE_POOL_MAX, nodeEnvValue === 'production' ? 20 : 10, 1, 200, 'DATABASE_POOL_MAX');
  if (databasePoolMin > databasePoolMax) {
    throw new Error(`FATAL: DATABASE_POOL_MIN (${databasePoolMin}) cannot exceed DATABASE_POOL_MAX (${databasePoolMax})`);
  }

  const accessTokenTtlSeconds = parseBoundedInteger(source.ACCESS_TOKEN_TTL_SECONDS, 900, 60, 86400, 'ACCESS_TOKEN_TTL_SECONDS');
  const refreshTokenTtlDays = parseBoundedInteger(source.REFRESH_TOKEN_TTL_DAYS, 30, 1, 365, 'REFRESH_TOKEN_TTL_DAYS');
  const reminderWorkerIntervalSeconds = parseBoundedInteger(source.REMINDER_WORKER_INTERVAL_SECONDS, 60, 5, 3600, 'REMINDER_WORKER_INTERVAL_SECONDS');
  const rateLimitMax = parseBoundedInteger(source.RATE_LIMIT_MAX, nodeEnvValue === 'test' ? 10000 : 100, 1, 10000, 'RATE_LIMIT_MAX');

  return {
    nodeEnv: nodeEnvValue as EnvConfig['nodeEnv'],
    appHost: source.APP_HOST || '0.0.0.0',
    appPort,
    trustProxy: source.TRUST_PROXY === 'true',
    dbClient: dbClientValue as EnvConfig['dbClient'],
    databaseHost: source.DATABASE_HOST || 'localhost',
    databasePort,
    databaseName: source.DATABASE_NAME || 'fitness_platform',
    databaseUser: source.DATABASE_USER || 'fitness_user',
    databasePassword: source.DATABASE_PASSWORD || '',
    databasePoolMin,
    databasePoolMax,
    sqliteDbPath: source.SQLITE_DB_PATH || './fitness_local.db',
    accessTokenSecret,
    accessTokenTtlSeconds,
    refreshTokenSecret,
    refreshTokenTtlDays,
    cookieSecret,
    cookieSameSite,
    adminAllowedOrigins,
    logLevel: source.LOG_LEVEL || 'info',
    emailProvider: emailProviderValue,
    pushProvider: pushProviderValue,
    smtpHost: source.SMTP_HOST,
    smtpPort,
    smtpSecure: source.SMTP_SECURE === 'true',
    smtpUser: source.SMTP_USER,
    smtpPassword: source.SMTP_PASSWORD,
    smtpFrom: source.SMTP_FROM || 'noreply@fitnessplatform.local',
    passwordResetBaseUrl,
    reminderWorkerIntervalSeconds,
    rateLimitMax,
  };
}

export const env: EnvConfig = validateAndLoadEnv(process.env);
