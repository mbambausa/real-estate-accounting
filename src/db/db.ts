// src/db/db.ts
import type { D1Database } from '@cloudflare/workers-types';

export interface DbResult {
  success: boolean;
  error?: string;
  data?: any;
}

export class Database {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const result = await this.db.prepare(sql).bind(...params).all();
      // D1 'all()' result has a results array and potentially an error string
      if (result.error) {
         // Treat D1-specific errors as errors
         throw new Error(`D1 Query Error: ${result.error}`);
      }
      return result.results as T[];
    } catch (error: unknown) { // Explicitly type caught error as unknown
      console.error('Database query error:', error);
      // Check if it's an Error instance before re-throwing
      if (error instanceof Error) {
        throw error;
      } else {
        // Wrap unexpected error types
        throw new Error('An unknown database query error occurred');
      }
    }
  }

  async execute(sql: string, params: any[] = []): Promise<DbResult> {
    try {
      const result = await this.db.prepare(sql).bind(...params).run();
       // D1 'run()' result has a success flag and potentially an error string
       if (result.error) {
          return {
             success: false,
             error: `D1 Execute Error: ${result.error}`
          };
       }
      return {
        success: true,
        data: result
      };
    } catch (error: unknown) { // Explicitly type caught error as unknown
      console.error('Database execute error:', error);
       // Check if it's an Error instance before accessing message
      if (error instanceof Error) {
         return {
            success: false,
            error: error.message
         };
      } else {
          return {
            success: false,
            error: 'An unknown database execute error occurred'
         };
      }
    }
  }

  async getById<T = any>(table: string, id: string): Promise<T | null> {
    try {
      const result = await this.db
        .prepare(`SELECT * FROM ${table} WHERE id = ?`)
        .bind(id)
        .first();
      // D1 'first()' returns the object or null, errors are thrown as exceptions
      return result as T || null;
    } catch (error: unknown) { // Explicitly type caught error as unknown
      console.error(`Error getting ${table} by ID:`, error);
       // Check if it's an Error instance before re-throwing
      if (error instanceof Error) {
        throw error;
      } else {
        // Wrap unexpected error types
        throw new Error(`An unknown error occurred getting ${table} by ID`);
      }
    }
  }
}

// Factory function to create database client
export function createDbClient(db: D1Database): Database {
  return new Database(db);
}