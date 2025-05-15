// src/db/schema.ts

// Import shared types if they are directly applicable or define specific DB types here.
// For simplicity, we'll redefine some basic enum-like types here or assume they'd be imported.

/**
 * Represents the structure of the 'users' table in the D1 database.
 * Used for application users and Auth.js authentication.
 */
export interface DbUser {
  id: string; // PRIMARY KEY
  name?: string | null;
  email: string; // UNIQUE NOT NULL
  password_hash: string; // NOT NULL
  email_verified?: number | null; // INTEGER DEFAULT 0 (0 for false, 1 for true)
  image?: string | null;
  created_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  updated_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
}

/**
 * Represents the structure of the 'accounts' table in D1.
 * Used by Auth.js for linking OAuth accounts to users.
 */
export interface DbAuthAccount {
  id: string; // PRIMARY KEY
  user_id: string; // NOT NULL, FK to users.id
  type: string; // NOT NULL (e.g., 'oauth', 'email')
  provider: string; // NOT NULL (e.g., 'google', 'credentials')
  provider_account_id: string; // NOT NULL
  refresh_token?: string | null;
  access_token?: string | null;
  expires_at?: number | null; // INTEGER, Unix timestamp (seconds)
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
  session_state?: string | null;
  // Auth.js v5 adapter might add/expect:
  // oauth_token_secret?: string | null;
  // oauth_token?: string | null;
}

/**
 * Represents the structure of the 'sessions' table in D1.
 * Used by Auth.js for storing user sessions.
 */
export interface DbSession {
  id: string; // PRIMARY KEY
  session_token: string; // NOT NULL UNIQUE
  user_id: string; // NOT NULL, FK to users.id
  expires: number; // TIMESTAMP NOT NULL (likely stored as Unix timestamp in seconds)
}

/**
 * Represents the structure of the 'verification_tokens' table in D1.
 * Used by Auth.js for email verification, password reset, etc.
 */
export interface DbVerificationToken {
  identifier: string; // NOT NULL
  token: string; // PRIMARY KEY (typically, or at least UNIQUE)
  expires: number; // TIMESTAMP NOT NULL (likely stored as Unix timestamp in seconds)
}

/**
 * Represents the structure of the 'entities' table in D1.
 * For managing real estate entities, properties, or companies.
 */
export interface DbEntity {
  id: string; // PRIMARY KEY
  user_id: string; // NOT NULL, FK to users.id
  name: string; // NOT NULL
  legal_name?: string | null;
  ein?: string | null;
  address?: string | null;
  legal_address?: string | null; // As per your 0001_initial.sql
  business_type?: string | null;
  parent_id?: string | null; // FK to entities.id
  created_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  updated_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
}

// From your src/types/account.ts, ensure these are consistent or imported
export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type ExpenseSubtype = 'recoverable' | 'non-recoverable' | 'other';

/**
 * Represents the structure of the 'chart_of_accounts' table in D1.
 * This is the master chart of accounts.
 * Your D1 schema has 'accounts' as the table name.
 */
export interface DbChartOfAccount { // D1 table name: accounts
  code: string; // PRIMARY KEY (as per your D1 schema for 'accounts')
  name: string; // NOT NULL, Account name (e.g., "Cash")
  type: AccountType; // NOT NULL
  subtype?: ExpenseSubtype | string | null; // Allow ExpenseSubtype or other strings
  description?: string | null;
  is_recoverable?: number | null; // BOOLEAN DEFAULT false (0 for false, 1 for true)
  tax_category?: string | null;
  is_active?: number | null; // BOOLEAN DEFAULT true (1 for true, 0 for false)
  created_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  updated_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  // Note: user_id was in your TS type for Account, but not directly in the 'accounts' master table in the plan.
  // If master accounts are global, user_id might not be here. If they are user-specific templates, it would be.
  // The 'entity_accounts' table links these to entities (which are user-specific).
}

/**
 * Represents the structure of the 'entity_accounts' table in D1 (from project plan).
 * This table links specific entities to accounts from the master chart_of_accounts,
 * allowing for customizations or specific balances.
 */
export interface DbEntityAccount {
  id: string; // PRIMARY KEY
  entity_id: string; // NOT NULL, FK to entities.id
  account_code: string; // NOT NULL, FK to accounts.code (master chart_of_accounts)
  custom_name?: string | null;
  is_active?: number | null; // BOOLEAN DEFAULT true (0 for false, 1 for true)
  recovery_type?: string | null;
  recovery_percentage?: number | null; // REAL DEFAULT 100.0
  created_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  updated_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
}


/**
 * Represents the structure of the 'journals' table in D1.
 * (Your 0001_initial.sql for journals was simple, this could be expanded later if needed)
 */
export interface DbJournal {
  id: string; // PRIMARY KEY
  entity_id: string; // NOT NULL, FK to entities.id
  name: string; // NOT NULL
  description?: string | null;
  created_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  updated_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
}

export type TransactionStatus = 'pending' | 'committed' | 'voided'; // Consistent with src/types/transaction.ts

/**
 * Represents the structure of the 'transactions' table in D1.
 */
export interface DbTransaction {
  id: string; // PRIMARY KEY
  date: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  description?: string | null; // D1 schema has this as potentially nullable
  reference?: string | null;
  entity_id: string; // NOT NULL, FK to entities.id
  document_url?: string | null;
  is_reconciled?: number | null; // BOOLEAN DEFAULT false (0 for false, 1 for true)
  created_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  updated_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  // Note: user_id was in your TS type for Transaction, but not explicitly in D1 'transactions' table in the plan.
  // It's often good for audit/scoping. If added to D1, add here.
}

/**
 * Represents the structure of the 'transaction_lines' table in D1.
 */
export interface DbTransactionLine {
  id: string; // PRIMARY KEY
  transaction_id: string; // NOT NULL, FK to transactions.id
  account_code: string; // NOT NULL, FK to accounts.code (master chart_of_accounts)
  entity_account_id: string; // NOT NULL, FK to entity_accounts.id
  amount: number; // REAL NOT NULL
  is_debit: number; // BOOLEAN NOT NULL (0 for false/credit, 1 for true/debit)
  description?: string | null; // Line item specific memo/description
  created_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  updated_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
}

export interface DbLoan {
  id: string; // PRIMARY KEY
  entity_id: string; // NOT NULL, FK to entities.id
  borrower_name: string; // NOT NULL
  loan_type: string; // NOT NULL
  description?: string | null;
  original_principal: number; // REAL NOT NULL
  current_principal: number; // REAL NOT NULL
  interest_rate: number; // REAL NOT NULL
  interest_rate_type: string; // NOT NULL
  origination_date: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  maturity_date: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  payment_frequency: string; // NOT NULL
  payment_amount: number; // REAL NOT NULL
  status: string; // NOT NULL (e.g., 'active', 'paid-off')
  collateral_description?: string | null;
  collateral_value?: number | null; // REAL
  next_payment_date?: number | null; // INTEGER, Unix timestamp (seconds)
  created_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  updated_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
}

export interface DbLoanSchedule {
  id: string; // PRIMARY KEY
  loan_id: string; // NOT NULL, FK to loans.id
  payment_number: number; // INTEGER NOT NULL
  payment_date: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  total_payment: number; // REAL NOT NULL
  principal_portion: number; // REAL NOT NULL
  interest_portion: number; // REAL NOT NULL
  remaining_balance: number; // REAL NOT NULL
  status: string; // NOT NULL (e.g., 'scheduled', 'paid')
  actual_payment_date?: number | null; // INTEGER, Unix timestamp (seconds)
  actual_payment_amount?: number | null; // REAL
  transaction_id?: string | null; // FK to transactions.id
  created_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  updated_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
}

/**
 * Represents the structure of the 'transaction_rules' table in D1.
 * For auto-categorization rules.
 */
export interface DbTransactionRule {
  id: string; // PRIMARY KEY
  name: string; // NOT NULL
  description?: string | null;
  priority: number; // INTEGER NOT NULL
  is_active?: number | null; // BOOLEAN DEFAULT true (0 for false, 1 for true)
  entity_specific?: number | null; // BOOLEAN DEFAULT false (0 for false, 1 for true)
  entity_id?: string | null; // FK to entities.id (used if entity_specific is true)
  created_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  updated_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
}

/**
 * Represents the structure of the 'rule_conditions' table in D1.
 * Conditions that must be met for a transaction_rule to apply.
 */
export interface DbRuleCondition {
  id: string; // PRIMARY KEY
  rule_id: string; // NOT NULL, FK to transaction_rules.id
  field: string; // NOT NULL (e.g., 'description', 'amount_debit', 'amount_credit')
  operator: string; // NOT NULL (e.g., 'contains', 'equals', 'greater_than')
  value: string; // NOT NULL (value to compare against, stored as TEXT)
  case_sensitive?: number | null; // BOOLEAN DEFAULT false (0 for false, 1 for true)
  created_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  updated_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
}

/**
 * Represents the structure of the 'rule_actions' table in D1.
 * Actions to take if a transaction_rule's conditions are met.
 */
export interface DbRuleAction {
  id: string; // PRIMARY KEY
  rule_id: string; // NOT NULL, FK to transaction_rules.id
  account_code: string; // NOT NULL, FK to accounts.code (target account for categorization)
  description?: string | null; // Optional description for the resulting transaction line
  is_split?: number | null; // BOOLEAN DEFAULT false (0 for false, 1 for true) - for future use if rules can create split transactions
  created_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  updated_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
}

/**
 * Represents the structure of the 'documents' table in D1.
 * For managing document attachments.
 */
export interface DbDocument {
  id: string; // PRIMARY KEY
  entity_id: string; // NOT NULL, FK to entities.id
  document_type: string; // NOT NULL (e.g., 'invoice', 'receipt', 'bank_statement')
  filename: string; // NOT NULL
  r2_object_key: string; // NOT NULL (key for the object in Cloudflare R2)
  content_type: string; // NOT NULL (MIME type, e.g., 'application/pdf')
  file_size: number; // INTEGER NOT NULL (in bytes)
  description?: string | null;
  transaction_id?: string | null; // FK to transactions.id (if document is linked to a specific transaction)
  created_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
  updated_at: number; // INTEGER NOT NULL, Unix timestamp (seconds)
}
