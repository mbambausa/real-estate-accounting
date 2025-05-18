// src/db/db.ts
import type { D1Database, D1Result, D1PreparedStatement } from '@cloudflare/workers-types';

/**
 * Interface for the result of an execute operation (INSERT, UPDATE, DELETE).
 */
export interface DbExecuteResult {
  success: boolean;
  error?: string;
  meta?: D1Result['meta']; // Includes duration, rows_read, rows_written, last_row_id etc.
  // data?: any; // D1Result from run() doesn't have a 'data' field for rows.
}

/**
 * A wrapper class for Cloudflare D1Database interactions.
 * It standardizes query execution, error handling, and provides batch operation support.
 */
export class Database {
  private readonly db: D1Database;

  constructor(db: D1Database) {
    if (!db) {
      // This should ideally not happen if the environment is set up correctly.
      console.error("FATAL: D1Database instance was not provided to Database constructor.");
      throw new Error("Database instance is required.");
    }
    this.db = db;
    // Note: PRAGMA foreign_keys = ON; is generally enabled by default in D1
    // and managed by the platform. If needed for specific sessions/transactions,
    // it could be executed, but D1 aims to enforce schema constraints.
  }

  /**
   * Executes a SQL query expected to return multiple rows.
   * @param sql The SQL query string (e.g., "SELECT * FROM users WHERE status = ?").
   * @param params Optional array of parameters to bind to the query.
   * @returns A promise that resolves to an array of results of type T.
   * @throws Throws an Error if the D1 query execution reports an error or an unexpected error occurs.
   */
  async query<T = Record<string, any>>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const ps: D1PreparedStatement = this.db.prepare(sql);
      const d1Result: D1Result<T> = await ps.bind(...params).all();

      // D1Result<T> from .all() includes a 'results' array and an optional 'error'.
      if (d1Result.error) {
        console.error(`D1 Query Error: ${d1Result.error}`, { sql, params, meta: d1Result.meta });
        throw new Error(`D1 Query Error: ${d1Result.error}`);
      }
      return d1Result.results || []; // Ensure 'results' is always an array, even if null/undefined from D1.
    } catch (error: unknown) {
      if (!(error instanceof Error && error.message.startsWith('D1 Query Error:'))) {
        console.error('Unhandled Database.query error:', { sql, params, error });
      }
      // Re-throw the original error or a new generic one
      throw error instanceof Error ? error : new Error('An unknown database query error occurred.');
    }
  }

  /**
   * Executes a SQL query expected to return a single row or null if not found.
   * @param sql The SQL query string (e.g., "SELECT * FROM users WHERE id = ?").
   * @param params Optional array of parameters to bind to the query.
   * @returns A promise that resolves to a single result of type T, or null if no row is found.
   * @throws Throws an Error if the D1 query execution itself fails (e.g., syntax error).
   */
  async queryOne<T = Record<string, any>>(sql: string, params: any[] = []): Promise<T | null> {
    try {
      const ps: D1PreparedStatement = this.db.prepare(sql);
      // D1's .first<T>() method returns the first row as an object, or null if no rows.
      // It throws an error if the query fails (e.g. syntax error).
      const result: T | null = await ps.bind(...params).first<T>();
      return result;
    } catch (error: unknown) {
      console.error('Database.queryOne error:', { sql, params, error });
      throw error instanceof Error ? error : new Error('An unknown database queryOne error occurred.');
    }
  }


  /**
   * Executes a SQL statement that does not return rows (e.g., INSERT, UPDATE, DELETE).
   * @param sql The SQL statement string.
   * @param params Optional array of parameters to bind to the statement.
   * @returns A promise that resolves to a DbExecuteResult object indicating success or failure.
   */
  async execute(sql: string, params: any[] = []): Promise<DbExecuteResult> {
    try {
      const ps: D1PreparedStatement = this.db.prepare(sql);
      const d1Result: D1Result = await ps.bind(...params).run(); // .run() for statements not returning rows.

      // D1Result from .run() primarily contains 'meta' and an optional 'error'.
      // 'success' is usually true if no error is thrown and d1Result.error is not set.
      if (d1Result.error) {
        console.error(`D1 Execute Error: ${d1Result.error}`, { sql, params, meta: d1Result.meta });
        return {
          success: false,
          error: `D1 Execute Error: ${d1Result.error}`,
          meta: d1Result.meta,
        };
      }
      return {
        success: true, // If no error, assume success. D1Result.success is usually true here.
        meta: d1Result.meta,
      };
    } catch (error: unknown) {
      console.error('Unhandled Database.execute error:', { sql, params, error });
      const errorMessage = error instanceof Error ? error.message : 'An unknown database execute error occurred.';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Retrieves a single record from a specified table by its ID.
   * @param table The name of the table (should be validated or from a safe source).
   * @param id The ID of the record to retrieve.
   * @returns A promise that resolves to the record of type T or null if not found.
   * @throws Throws an Error if the table name is invalid or the query fails.
   */
  async getById<T = Record<string, any>>(table: string, id: string | number): Promise<T | null> {
    // Basic protection against SQL injection for table name.
    // Whitelisting table names or using an ORM provides stronger protection if table names are dynamic.
    if (!/^[a-zA-Z0-9_]+$/.test(table)) {
        console.error('Invalid table name provided to Database.getById:', table);
        throw new Error(`Invalid table name: ${table}`);
    }
    const sql = `SELECT * FROM \`${table}\` WHERE id = ?1`; // Use backticks for table name, ?1 for param
    return this.queryOne<T>(sql, [id]);
  }

  /**
   * Executes a series of D1PreparedStatement operations in a batch.
   * D1's batch API ensures that all operations in the batch either succeed or fail together (atomicity).
   *
   * @param operations An array of D1PreparedStatement objects.
   * These should be created using `db.d1Instance.prepare(...)`.
   * @returns A promise that resolves to an array of D1Result objects, one for each operation.
   * @throws Throws an error if the overall batch operation fails.
   */
  async batch(operations: D1PreparedStatement[]): Promise<D1Result[]> {
    if (!operations || operations.length === 0) {
      return []; // Nothing to batch
    }
    try {
      const results: D1Result[] = await this.db.batch(operations);
      // D1's batch is atomic. If it resolves, all statements succeeded relative to each other.
      // Individual D1Result objects in the array might still contain 'error: null' and 'success: true'.
      // It's good practice to check, though errors usually cause the batch promise to reject.
      for (const result of results) {
        if (result.error) {
          // This case might be rare if the batch itself didn't throw.
          console.error('Error in one of the D1 batch results (though batch itself succeeded):', result.error, { meta: result.meta });
          // Depending on requirements, you might throw here or handle partially.
          // For now, we assume if batch() resolves, it's "successful" per D1's atomicity.
        }
      }
      return results;
    } catch (error: unknown) {
      console.error('Database.batch transaction error:', { operationsCount: operations.length, error });
      // Re-throw the original error or a new generic one
      throw error instanceof Error ? error : new Error('An unknown database batch transaction error occurred.');
    }
  }

  /**
   * Provides direct access to the underlying D1Database instance.
   * Useful for operations not covered by this wrapper, or for creating
   * D1PreparedStatements required by the `batch` method.
   * Example: `const ps = db.d1Instance.prepare("INSERT INTO ...")`
   */
  get d1Instance(): D1Database {
    return this.db;
  }
}

/**
 * Factory function to create a new Database client instance.
 * This ensures consistent creation and can be used for dependency injection.
 * @param d1Database The D1Database instance (e.g., from `Astro.locals.runtime.env.DB`).
 * @returns A new instance of the Database wrapper.
 */
export function createDbClient(d1Database: D1Database): Database {
  return new Database(d1Database);
}