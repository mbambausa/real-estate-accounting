// src/db/schema.ts
/**
 * TypeScript interfaces mirroring the D1 database schema.
 * Timestamps are stored as Unix epoch seconds (number).
 * Booleans are stored as INTEGER (0 for false, 1 for true).
 */

export interface DbUser {
  id: string;
  name?: string | null;
  email: string;
  password_hash?: string | null; // Nullable if using only OAuth
  email_verified: number; // 0 or 1
  image?: string | null;
  created_at: number;
  updated_at: number;
}

export interface DbAuthAccount {
  id: string;
  user_id: string;
  type: string;
  provider: string;
  provider_account_id: string;
  refresh_token?: string | null;
  access_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
  session_state?: string | null;
}

export interface DbSession {
  id: string;
  session_token: string;
  user_id: string;
  expires: number;
}

export interface DbVerificationToken {
  identifier: string;
  token: string;
  expires: number;
}

export interface DbEntity {
  id: string;
  user_id: string;
  name: string;
  legal_name?: string | null;
  ein?: string | null;
  address?: string | null;
  legal_address?: string | null;
  business_type?: string | null;
  parent_id?: string | null;
  created_at: number;
  updated_at: number;
}

export type AccountSystemType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface DbChartOfAccount {
  id: string;
  user_id: string;
  code: string;
  name: string;
  type: AccountSystemType;
  subtype?: string | null;
  description?: string | null;
  is_recoverable: number; // 0 or 1
  recovery_percentage?: number | null; // e.g., 100.0 for 100%
  is_active: number; // 0 or 1
  tax_category?: string | null;
  parent_id?: string | null;
  created_at: number;
  updated_at: number;
}

export interface DbEntityAccount {
  id: string;
  user_id: string; // Denormalized for easier access control/querying
  entity_id: string;
  account_id: string; // Refers to DbChartOfAccount.id
  custom_name?: string | null;
  is_active: number; // 0 or 1, for this specific entity-account link
  recovery_type?: string | null; // Entity-specific override
  recovery_percentage?: number | null; // Entity-specific override
  created_at: number;
  updated_at: number;
}

export type TransactionStatusType = 'pending' | 'posted' | 'voided';

export interface DbTransaction {
  id: string;
  user_id: string;
  entity_id: string;
  journal_id?: string | null;
  date: number; // Unix timestamp
  description: string;
  reference?: string | null;
  status: TransactionStatusType;
  is_reconciled: number; // 0 or 1
  document_url?: string | null;
  created_at: number;
  updated_at: number;
}

export interface DbTransactionLine {
  id: string;
  transaction_id: string;
  entity_account_id: string; // Refers to DbEntityAccount.id
  amount: number; // Always positive
  is_debit: number; // 1 for debit, 0 for credit
  memo?: string | null;
  created_at: number;
  // No updated_at by design, journal entries are typically immutable.
}

// Interfaces for future tables (can be uncommented and defined when needed)
/*
export interface DbLoan { ... }
export interface DbLoanSchedule { ... }
export interface DbTransactionRule { ... }
export interface DbRuleCondition { ... }
export interface DbRuleAction { ... }
export interface DbDocument { ... }
*/