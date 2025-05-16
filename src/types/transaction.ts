// src/types/transaction.ts

export type TransactionStatus = 'pending' | 'posted' | 'voided';

/**
 * Represents a financial transaction header.
 * Aligns with the 'transactions' D1 table (DbTransaction).
 */
export interface Transaction {
  id: string;
  user_id: string;
  entity_id: string;
  journal_id?: string | null; // Optional link to a journal
  date: number; // Unix timestamp (seconds)
  description: string;
  reference?: string | null;
  status: TransactionStatus;
  is_reconciled: boolean; // Stored as 0 or 1 in DB
  document_url?: string | null;
  created_at: number; // Unix timestamp (seconds)
  updated_at: number; // Unix timestamp (seconds)
  lines?: TransactionLine[]; // For convenience when fetching a full transaction with its lines
}

/**
 * Represents a single line item within a financial transaction (a debit or a credit).
 * Aligns with the 'transaction_lines' D1 table (DbTransactionLine).
 */
export interface TransactionLine {
  id: string;
  transaction_id: string;
  entity_account_id: string; // Refers to 'entity_accounts.id'
  amount: number; // Always positive
  is_debit: boolean; // True for debit, false for credit (stored as 0 or 1 in DB)
  memo?: string | null; // Line-specific description
  created_at: number; // Unix timestamp (seconds)
  // updated_at is intentionally omitted as transaction lines are typically immutable post-creation.
}

/**
 * Input payload for creating a single transaction line.
 */
export interface TransactionLineInput {
  entity_account_id: string; // ID of the 'entity_accounts' record
  amount: number; // Always positive
  is_debit: boolean;
  memo?: string | null;
}

/**
 * Input payload for creating a new Transaction with its lines.
 */
export interface TransactionInput {
  // user_id will be derived from the authenticated session on the server.
  entity_id: string;
  journal_id?: string | null;
  date: number; // Unix timestamp (seconds). Frontend should convert Date to this.
  description: string;
  reference?: string | null;
  status?: TransactionStatus; // Defaults to 'pending' or 'posted' based on system logic
  is_reconciled?: boolean; // Defaults to false
  document_url?: string | null;
  lines: TransactionLineInput[];
}