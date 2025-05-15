// src/types/account.ts

/**
 * The broad categories of all accounts.
 */
export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

/**
 * For expense accounts, indicates whether they are
 * recoverable (and to what extent) or non-recoverable.
 */
export type ExpenseSubtype = 'recoverable' | 'non-recoverable' | 'other';

/**
 * Represents a financial account in the system.
 */
export interface Account {
  /** Unique identifier for this account */
  id: string;
  /** Identifier of the user who owns this account */
  user_id: string;
  /** Human-readable name (e.g. “Travel Expenses”) */
  name: string;
  /** Optional ledger or routing number */
  number?: string;
  /** One of the core AccountType values */
  type: AccountType;
  /**
   * For expense accounts, indicates recoverability.
   * Should be omitted for non-expense accounts.
   */
  subtype?: ExpenseSubtype;
  /**
   * Percentage (0–100) of a recoverable expense
   * that is expected to be reimbursed.
   * Only relevant when subtype === 'recoverable'.
   */
  recovery_percentage?: number;
  /** Whether this account is a linked bank account */
  is_bank_account: boolean;
  /** Bank name when is_bank_account is true */
  bank_name?: string;
  /** Current ledger balance (in the smallest currency unit) */
  current_balance: number;
  /** Timestamp (ms since epoch) of last reconciliation */
  last_reconciled?: number;
  /** Timestamp (ms since epoch) when created */
  created_at: number;
  /** Timestamp (ms since epoch) when last updated */
  updated_at: number;
}

/**
 * Input payload when creating or updating an account.
 * Fields mirror those on Account, except system-generated IDs and timestamps.
 */
export interface AccountInput {
  /** Human-readable name */
  name: string;
  /** Optional ledger or routing number */
  number?: string;
  /** Core category for the account */
  type: AccountType;
  /**
   * Expense recoverability subtype.
   * Applicable only when type === 'expense'.
   */
  subtype?: ExpenseSubtype;
  /**
   * Reimbursement percentage for recoverable expenses.
   * Applicable only when subtype === 'recoverable'.
   */
  recovery_percentage?: number;
  /** Is this a linked bank account? */
  is_bank_account: boolean;
  /** Bank name when is_bank_account is true */
  bank_name?: string;
  /** Starting or updated balance; defaults to 0 if omitted */
  current_balance?: number;
}
