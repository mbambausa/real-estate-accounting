// src/types/account.ts

/**
 * The broad categories of all accounts.
 * Aligns with DbChartOfAccount['type'].
 */
export type AccountSystemType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

/**
 * For expense accounts, indicates whether they are
 * recoverable (and to what extent) or non-recoverable.
 */
export type ExpenseSubtype = 'recoverable' | 'non-recoverable' | 'other'; // Can be extended

/**
 * Represents a definition of an account in the Chart of Accounts for application use.
 * This interface aligns with the structure of the 'chart_of_accounts' D1 table
 * (represented by DbChartOfAccount), converting numerical booleans to actual booleans.
 */
export interface ChartOfAccount {
  /** Unique system-generated identifier (UUID) for this account definition. */
  id: string;
  /** Identifier of the user who owns this chart of accounts entry. */
  user_id: string;
  /** User-defined code for the account (e.g., "1010", "6050"). Unique per user. */
  code: string;
  /** Human-readable name for the account (e.g., “Operating Cash Account”, “Office Supplies”). */
  name: string;
  /** The fundamental type of the account. */
  type: AccountSystemType;
  /**
   * Further classification, e.g., for expenses indicating recoverability,
   * or more specific types like 'current_asset', 'long_term_liability'.
   */
  subtype?: string | null; // Could use ExpenseSubtype here if type === 'expense'
  /** A brief explanation of what the account is used for. */
  description?: string | null;
  /**
   * For expense accounts, explicitly marks if it is recoverable.
   */
  is_recoverable: boolean; // Application-level boolean
  /**
   * Percentage (0–100) of a recoverable expense that is expected to be reimbursed.
   * Only relevant when is_recoverable is true.
   */
  recovery_percentage?: number | null;
  /** Whether the account is currently active and can be used in transactions. */
  is_active: boolean; // Application-level boolean
  /** Optional link to tax form lines or categories. */
  tax_category?: string | null;
  /**
   * The ID (UUID) of the parent account, for hierarchical chart of accounts.
   * Null if it's a top-level account.
   */
  parent_id?: string | null;
  /** Timestamp (Unix seconds) when this account definition was created. */
  created_at: number;
  /** Timestamp (Unix seconds) when this account definition was last updated. */
  updated_at: number;
}

/**
 * Input payload when creating or updating a Chart of Account definition.
 * Fields mirror those on ChartOfAccount, excluding system-generated `id`, `user_id`,
 * `created_at`, and `updated_at`. Booleans are expected as booleans.
 */
export interface ChartOfAccountInput {
  code: string;
  name: string;
  type: AccountSystemType;
  subtype?: string | null;
  description?: string | null;
  is_recoverable?: boolean; // Defaults to false if not provided in service
  recovery_percentage?: number | null;
  is_active?: boolean;      // Defaults to true if not provided in service
  tax_category?: string | null;
  parent_id?: string | null;
}

// The other type files (entity.ts, transaction.ts, loan.ts) from updated_type_definitions_v1
// were also confirmed to be largely okay, with minor adjustments like removing updated_at from TransactionLine.
