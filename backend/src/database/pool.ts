import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { DatabasePool, DbConnection } from './types.js';

let poolInstance: DatabasePool | null = null;

class MySQLDatabasePool implements DatabasePool {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: env.databaseHost,
      port: env.databasePort,
      user: env.databaseUser,
      password: env.databasePassword,
      database: env.databaseName,
      waitForConnections: true,
      connectionLimit: env.databasePoolMax,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
  }

  private normalizeSql(sql: string): string {
    return sql
      .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT IGNORE INTO');
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const normalized = this.normalizeSql(sql);
    const [rows] = await this.pool.query(normalized, params);
    return rows as T[];
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async execute(sql: string, params?: any[]): Promise<{ insertId: number; affectedRows: number }> {
    const normalized = this.normalizeSql(sql);
    const [result] = await this.pool.execute(normalized, params) as [mysql.ResultSetHeader, any];
    return {
      insertId: Number(result.insertId || 0),
      affectedRows: Number(result.affectedRows || 0),
    };
  }

  async withTransaction<T>(callback: (conn: DbConnection) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();
    try {
      const connAdapter: DbConnection = {
        query: async <R = any>(sql: string, params?: any[]): Promise<R[]> => {
          const normalized = this.normalizeSql(sql);
          const [rows] = await connection.query(normalized, params);
          return rows as R[];
        },
        queryOne: async <R = any>(sql: string, params?: any[]): Promise<R | null> => {
          const normalized = this.normalizeSql(sql);
          const [rows] = await connection.query(normalized, params) as [any[], any];
          return rows.length > 0 ? (rows[0] as R) : null;
        },
        execute: async (sql: string, params?: any[]): Promise<{ insertId: number; affectedRows: number }> => {
          const normalized = this.normalizeSql(sql);
          const [res] = await connection.execute(normalized, params) as [mysql.ResultSetHeader, any];
          return {
            insertId: Number(res.insertId || 0),
            affectedRows: Number(res.affectedRows || 0),
          };
        },
      };

      const result = await callback(connAdapter);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error({ error }, 'MySQL health check failed');
      return false;
    }
  }
}

class SQLiteDatabasePool implements DatabasePool {
  private db: sqlite3.Database;

  constructor(customPath?: string) {
    const dbPath = customPath || process.env.SQLITE_DB_PATH || env.sqliteDbPath;
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error({ err }, 'Failed to connect to SQLite database');
      }
    });
    this.db.serialize(() => {
      this.db.run('PRAGMA foreign_keys = ON');
      this.db.run('PRAGMA journal_mode = WAL');
    });
  }

  private normalizeSql(sql: string): string {
    // Normalizes MySQL dialect to SQLite if needed
    return sql
      .replace(/\bBIGINT\s+UNSIGNED\s+AUTO_INCREMENT\b/gi, 'INTEGER')
      .replace(/\bINT\s+UNSIGNED\s+AUTO_INCREMENT\b/gi, 'INTEGER')
      .replace(/\bAUTO_INCREMENT\b/gi, 'AUTOINCREMENT')
      .replace(/\bCURRENT_TIMESTAMP\(\d+\)/gi, 'CURRENT_TIMESTAMP')
      .replace(/\bTIMESTAMP\(\d+\)/gi, 'TEXT')
      .replace(/\bTIMESTAMP\b/gi, 'TEXT')
      .replace(/\bDATETIME\(\d+\)/gi, 'TEXT')
      .replace(/\bBOOLEAN\b/gi, 'INTEGER')
      .replace(/\bJSON\b/gi, 'TEXT')
      .replace(/ENGINE\s*=\s*InnoDB/gi, '')
      .replace(/ON\s+UPDATE\s+CURRENT_TIMESTAMP(\(\d+\))?/gi, '');
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const normSql = this.normalizeSql(sql);
    return new Promise<T[]>((resolve, reject) => {
      this.db.all(normSql, params || [], (err, rows) => {
        if (err) return reject(err);
        resolve((rows || []) as T[]);
      });
    });
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async execute(sql: string, params?: any[]): Promise<{ insertId: number; affectedRows: number }> {
    const normSql = this.normalizeSql(sql);
    return new Promise((resolve, reject) => {
      this.db.run(normSql, params || [], function (err) {
        if (err) return reject(err);
        resolve({
          insertId: this.lastID || 0,
          affectedRows: this.changes || 0,
        });
      });
    });
  }

  private txMutex: Promise<any> = Promise.resolve();

  async withTransaction<T>(callback: (conn: DbConnection) => Promise<T>): Promise<T> {
    const runTx = async () => {
      await this.execute('BEGIN TRANSACTION');
      try {
        const result = await callback(this);
        await this.execute('COMMIT');
        return result;
      } catch (error) {
        await this.execute('ROLLBACK').catch(() => {});
        throw error;
      }
    };

    const previous = this.txMutex;
    let resolveTx: () => void;
    this.txMutex = new Promise<void>((resolve) => {
      resolveTx = resolve;
    });

    try {
      await previous.catch(() => {});
      return await runTx();
    } finally {
      resolveTx!();
    }
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error({ error }, 'SQLite health check failed');
      return false;
    }
  }
}

export function getDatabasePool(customPath?: string): DatabasePool {
  if (!poolInstance || customPath) {
    if (env.dbClient === 'mysql') {
      poolInstance = new MySQLDatabasePool();
    } else {
      const pool = new SQLiteDatabasePool(customPath);
      if (!customPath) {
        poolInstance = pool;
      }
      return pool;
    }
  }
  return poolInstance;
}

export async function closeDatabasePool(): Promise<void> {
  if (poolInstance) {
    const current = poolInstance;
    poolInstance = null;
    await current.close();
  }
}

export function resetDatabasePool(): void {
  poolInstance = null;
}

