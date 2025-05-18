// src/db/schema.ts

/**
 * TypeScript interfaces mirroring the D1 database schema.
 * - Timestamps are stored as Unix epoch seconds (number).
 * - Booleans are stored as INTEGER (0 for false, 1 for true), reflected as `number` here.
 * - Monetary amounts (e.g., transaction line amounts) are stored as INTEGER in cents.
 * - Percentages (e.g., recovery_percentage) are stored as INTEGER in basis points (e.g., 100.00% = 10000).
 */

export interface DbUser {
  id: string; // UUID
  name?: string | null;
  email: string;
  password_hash?: string | null; // Argon2 hash
  email_verified: number; // 0 or 1
  image?: string | null; // URL
  role?: string | null; // e.g., 'user', 'admin' (defaults to 'user' in DB)
  created_at: number; // Unix epoch
  updated_at: number; // Unix epoch
}

export interface DbAuthAccount {
  id: string; // UUID
  user_id: string;
  type: string;
  provider: string;
  provider_account_id: string;
  refresh_token?: string | null;
  access_token?: string | null;
  expires_at?: number | null; // Unix epoch
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
  session_state?: string | null;
}

export interface DbSession {
  id: string; // UUID
  session_token: string;
  user_id: string;
  expires: number; // Unix epoch
}

export interface DbVerificationToken {
  identifier: string; // Email or other identifier
  token: string; // Unique token
  expires: number; // Unix epoch
}

export interface DbPasswordResetToken {
  id: string; // UUID
  user_id: string;
  token_hash: string; // Hash of the reset token
  expires_at: number; // Unix epoch
  created_at: number; // Unix epoch
  is_used: number; // 0 or 1
}

export interface DbEntity {
  id: string; // UUID
  user_id: string;
  name: string;
  legal_name?: string | null;
  ein?: string | null;
  address?: string | null;
  legal_address?: string | null;
  business_type?: string | null;
  parent_id?: string | null; // Self-referential foreign key for parent entity
  is_active: number; // 0 or 1
  allows_sub_entities: number; // 0 or 1
  created_at: number; // Unix epoch
  updated_at: number; // Unix epoch
}

export type AccountSystemType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface DbChartOfAccount {
  id: string; // UUID
  user_id: string;
  code: string;
  name: string;
  type: AccountSystemType;
  subtype?: string | null;
  description?: string | null;
  is_recoverable: number; // 0 or 1
  recovery_percentage?: number | null; // Integer: Basis points (e.g., 100.00% = 10000). Defaults to 10000 in DB.
  is_active: number; // 0 or 1
  tax_category?: string | null;
  parent_id?: string | null; // Self-referential foreign key for hierarchical CoA
  created_at: number; // Unix epoch
  updated_at: number; // Unix epoch
}

export interface DbEntityAccount {
  id: string; // UUID
  user_id: string;
  entity_id: string;
  account_id: string; // Refers to DbChartOfAccount.id
  custom_name?: string | null;
  is_active: number; // 0 or 1
  recovery_type?: string | null;
  recovery_percentage?: number | null; // Integer: Basis points. Null means use CoA default.
  created_at: number; // Unix epoch
  updated_at: number; // Unix epoch
}

export interface DbJournal {
  id: string; // UUID
  user_id: string;
  entity_id: string;
  name: string;
  description?: string | null;
  created_at: number; // Unix epoch
  updated_at: number; // Unix epoch
}

export type TransactionStatusType = 'pending' | 'posted' | 'voided';

export interface DbTransaction {
  id: string; // UUID
  user_id: string;
  entity_id: string;
  journal_id?: string | null;
  date: number; // Unix epoch (transaction date)
  description: string;
  reference?: string | null;
  status: TransactionStatusType; // Defaults to 'posted' in DB
  is_reconciled: number; // 0 or 1
  document_url?: string | null;
  created_at: number; // Unix epoch
  updated_at: number; // Unix epoch
}

export interface DbTransactionLine {
  id: string; // UUID
  transaction_id: string;
  entity_account_id: string; // Refers to DbEntityAccount.id
  amount: number; // Integer: Stored in cents (e.g., $123.45 is 12345)
  is_debit: number; // 1 for debit, 0 for credit
  memo?: string | null;
  created_at: number; // Unix epoch
  // No updated_at by design in your SQL (immutable ledger lines)
}

// Commented out interfaces for future tables are fine as placeholders.
/*
export interface DbLoan {
  id: string; // UUID
  user_id: string;
  entity_id: string;
  lender_name: string; // Or borrower_name if it's a note receivable
  loan_type: string;
  original_principal: number; // Integer: cents
  current_principal: number; // Integer: cents
  interest_rate: number; // Integer: Basis points (e.g., 5.25% = 525)
  interest_rate_type: 'fixed' | 'variable';
  origination_date: number; // Unix epoch
  maturity_date: number; // Unix epoch
  payment_frequency: string; // e.g., 'monthly', 'quarterly'
  next_payment_date?: number | null; // Unix epoch
  status: string; // e.g., 'active', 'paid_off', 'default'
  created_at: number;
  updated_at: number;
}

export interface DbLoanPayment {
  id: string; // UUID
  loan_id: string;
  payment_date: number; // Unix epoch
  amount_paid: number; // Integer: cents
  principal_paid: number; // Integer: cents
  interest_paid: number; // Integer: cents
  escrow_paid?: number | null; // Integer: cents
  late_fee_paid?: number | null; // Integer: cents
  ending_balance: number; // Integer: cents (after this payment)
  reference?: string | null;
  created_at: number;
}

// ... other future interfaces like DbTransactionRule, DbDocument etc.
*/
