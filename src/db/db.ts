// src/db/db.ts
import type { D1Database, D1Result, D1PreparedStatement } from '@cloudflare/workers-types';

/**
 * Interface for the result of an execute operation.
 */
export interface DbExecuteResult {
  success: boolean;
  error?: string;
  meta?: D1Result['meta']; // Includes duration, rows_read, rows_written, last_row_id etc.
  data?: any; // Could be used for specific return values from D1Result if needed
}

/**
 * A wrapper class for Cloudflare D1Database interactions.
 * It standardizes query execution, error handling, and provides transaction support.
 */
export class Database {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
    // Note: PRAGMA foreign_keys = ON; is generally on by default in D1
    // and managed by the platform, unlike standard SQLite CLI.
    // If specific PRAGMAs are needed, they can be executed here or per-transaction.
  }

  /**
   * Executes a SQL query that is expected to return multiple rows.
   * @param sql The SQL query string.
   * @param params Optional array of parameters to bind to the query.
   * @returns A promise that resolves to an array of results of type T.
   * @throws Throws an Error if the D1 query itself reports an error or if an unexpected error occurs.
   */
  async query<T = Record<string, any>>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const ps: D1PreparedStatement = this.db.prepare(sql);
      const d1Result: D1Result<T> = await ps.bind(...params).all();

      if (d1Result.error) {
        console.error(`D1 Query Error: ${d1Result.error}`, { sql, params });
        throw new Error(`D1 Query Error: ${d1Result.error}`);
      }
      return d1Result.results || []; // Ensure results is always an array
    } catch (error: unknown) {
      // Log the error with more context if it's not a D1-originated error already logged
      if (!(error instanceof Error && error.message.startsWith('D1 Query Error:'))) {
        console.error('Database query error:', { sql, params, error });
      }
      // Re-throw or wrap
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unknown database query error occurred.');
    }
  }

  /**
   * Executes a SQL query that is expected to return a single row or null.
   * @param sql The SQL query string.
   * @param params Optional array of parameters to bind to the query.
   * @returns A promise that resolves to a single result of type T or null if not found.
   * @throws Throws an Error if the D1 query itself reports an error or if an unexpected error occurs.
   */
  async queryOne<T = Record<string, any>>(sql: string, params: any[] = []): Promise<T | null> {
    try {
      const ps: D1PreparedStatement = this.db.prepare(sql);
      // D1's .first<T>() method can directly take a type argument.
      const result: T | null = await ps.bind(...params).first<T>();
      return result; // D1 .first() returns the object directly, or null. Errors are thrown.
    } catch (error: unknown) {
      console.error('Database queryOne error:', { sql, params, error });
      if (error instanceof Error) {
        throw error; // D1 errors (like syntax errors) will be caught here
      }
      throw new Error('An unknown database queryOne error occurred.');
    }
  }


  /**
   * Executes a SQL statement that does not return rows (e.g., INSERT, UPDATE, DELETE).
   * @param sql The SQL statement string.
   * @param params Optional array of parameters to bind to the statement.
   * @returns A promise that resolves to a DbExecuteResult object.
   */
  async execute(sql: string, params: any[] = []): Promise<DbExecuteResult> {
    try {
      const ps: D1PreparedStatement = this.db.prepare(sql);
      const d1Result: D1Result = await ps.bind(...params).run();

      if (d1Result.error) {
        console.error(`D1 Execute Error: ${d1Result.error}`, { sql, params });
        return {
          success: false,
          error: `D1 Execute Error: ${d1Result.error}`,
          meta: d1Result.meta,
        };
      }
      return {
        success: true,
        meta: d1Result.meta,
        // data: d1Result, // You could include the full D1Result if needed
      };
    } catch (error: unknown) {
      console.error('Database execute error:', { sql, params, error });
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: 'An unknown database execute error occurred.',
      };
    }
  }

  /**
   * Retrieves a single record from a table by its ID.
   * @param table The name of the table.
   * @param id The ID of the record to retrieve.
   * @returns A promise that resolves to the record of type T or null if not found.
   * @throws Throws an Error if the query fails.
   */
  async getById<T = Record<string, any>>(table: string, id: string): Promise<T | null> {
    // Basic protection against SQL injection for table name.
    // For more robust dynamic table names, consider a whitelist or more advanced validation.
    if (!/^[a-zA-Z0-9_]+$/.test(table)) {
        console.error('Invalid table name for getById:', table);
        throw new Error(`Invalid table name: ${table}`);
    }
    const sql = `SELECT * FROM ${table} WHERE id = ?`;
    return this.queryOne<T>(sql, [id]);
  }

  /**
   * Executes a series of database operations within a transaction.
   * The callback function receives a 'transactionalDb' instance of the Database class,
   * which should be used for all operations within the transaction.
   * Note: D1 does not support traditional BEGIN/COMMIT/ROLLBACK statements directly
   * in the same way as other SQL databases. Instead, it provides batching.
   * This 'transaction' method simulates atomicity for a set of operations using D1's `batch` API.
   * All operations in the batch either succeed or fail together.
   *
   * @param operations An array of D1PreparedStatement objects to be executed in batch.
   * These should be created using `this.db.prepare(...)` NOT `this.prepare(...)`.
   * @returns A promise that resolves to an array of D1Result objects, one for each operation.
   * @throws Throws an error if the batch operation fails.
   */
  async batch(operations: D1PreparedStatement[]): Promise<D1Result[]> {
    try {
      const results: D1Result[] = await this.db.batch(operations);
      // Check each result for individual errors, though D1 batch is typically all-or-nothing.
      for (const result of results) {
        if (result.error) {
          console.error('D1 Batch operation error in one of the statements:', result.error);
          // Even if one statement has an error, D1 might have attempted others.
          // The batch itself would typically throw if the entire batch fails.
          throw new Error(`Error in batch operation: ${result.error}`);
        }
      }
      return results;
    } catch (error: unknown) {
      console.error('Database batch transaction error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unknown database batch transaction error occurred.');
    }
  }

  /**
   * Helper to get the underlying D1Database instance, primarily for creating
   * prepared statements for batch operations.
   */
  get d1Instance(): D1Database {
    return this.db;
  }
}

/**
 * Factory function to create a new Database client instance.
 * This is useful for dependency injection or consistent client creation.
 * @param d1Database The D1Database instance from Cloudflare Workers environment.
 * @returns A new instance of the Database wrapper.
 */
export function createDbClient(d1Database: D1Database): Database {
  return new Database(d1Database);
}
