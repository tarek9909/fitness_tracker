export interface QueryResult<T = any> {
  rows: T[];
  insertId?: number | bigint;
  affectedRows?: number;
}

export interface DbConnection {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<{ insertId: number; affectedRows: number }>;
}

export interface DatabasePool extends DbConnection {
  withTransaction<T>(callback: (conn: DbConnection) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  healthCheck(): Promise<boolean>;
}
