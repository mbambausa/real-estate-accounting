-- Database Schema: Real Estate Accounting
-- Version: 1.2 (Revised to use INTEGER for amounts/percentages, aligning with project plan)
-- Date: 2025-05-17

-- Drop tables in reverse order of dependency
DROP TABLE IF EXISTS transaction_lines;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS password_reset_tokens; -- Added for password reset functionality
DROP TABLE IF EXISTS entity_accounts;
DROP TABLE IF EXISTS journals;
DROP TABLE IF EXISTS chart_of_accounts; 
DROP TABLE IF EXISTS entities;          
DROP TABLE IF EXISTS auth_accounts;     
DROP TABLE IF EXISTS sessions;          
DROP TABLE IF EXISTS verification_tokens; 
DROP TABLE IF EXISTS users;             

-- Users (Manages application users and authentication via Auth.js)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- e.g., UUID
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT, -- Stores Argon2 hash
  email_verified INTEGER NOT NULL DEFAULT 0, -- 0 for false, 1 for true
  image TEXT, -- URL to profile image
  role TEXT DEFAULT 'user', -- For RBAC (e.g., 'user', 'admin')
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Auth.js: OAuth accounts (links OAuth provider accounts to users)
CREATE TABLE IF NOT EXISTS auth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- e.g., 'oauth', 'email', 'credentials'
  provider TEXT NOT NULL, -- e.g., 'google', 'github'
  provider_account_id TEXT NOT NULL, -- User's ID on the provider
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER, -- Unix timestamp
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT, -- For some OAuth providers
  CONSTRAINT uq_auth_accounts_provider UNIQUE (provider, provider_account_id)
);
CREATE INDEX IF NOT EXISTS idx_auth_accounts_user_id ON auth_accounts(user_id);

-- Auth.js: Sessions (stores user sessions for Auth.js database strategy or D1 adapter)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL -- Unix timestamp when the session expires
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_token ON sessions(session_token);

-- Auth.js: Verification Tokens (for email verification, passwordless sign-in)
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL, -- Typically user's email
  token TEXT NOT NULL UNIQUE, -- The verification token itself
  expires INTEGER NOT NULL, -- Unix timestamp when the token expires
  CONSTRAINT uq_verification_tokens_identifier_token UNIQUE (identifier, token)
);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);

-- Password Reset Tokens (For custom password reset flow)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY, -- e.g., UUID
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, -- Store a hash of the token, not the token itself
  expires_at INTEGER NOT NULL, -- Unix timestamp
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  is_used INTEGER NOT NULL DEFAULT 0 -- 0 for false, 1 for true
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- Entities (Properties, Companies, etc., owned by a user)
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY, -- e.g., UUID
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  legal_name TEXT,
  ein TEXT, -- Employer Identification Number
  address TEXT, -- General address
  legal_address TEXT, -- Official legal address
  business_type TEXT, -- e.g., 'Sole Proprietorship', 'LLC', 'S-Corp'
  parent_id TEXT REFERENCES entities(id) ON DELETE SET NULL, -- For parent-subsidiary structures
  is_active INTEGER NOT NULL DEFAULT 1, -- 0 for false, 1 for true
  allows_sub_entities INTEGER NOT NULL DEFAULT 1, -- 0 for false, 1 for true
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_entities_user_id ON entities(user_id);
CREATE INDEX IF NOT EXISTS idx_entities_parent_id ON entities(parent_id);
CREATE INDEX IF NOT EXISTS idx_entities_name_user ON entities(user_id, name); -- Common query

-- Chart of Accounts (User-specific master list of accounts)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id TEXT PRIMARY KEY, -- e.g., UUID
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL, -- User-defined account code/number
  name TEXT NOT NULL, -- User-defined account name
  type TEXT NOT NULL, -- GAAP types: 'asset', 'liability', 'equity', 'income', 'expense'
  subtype TEXT, -- More specific category, e.g., 'cash', 'accounts_receivable'
  description TEXT,
  is_recoverable INTEGER NOT NULL DEFAULT 0, -- 0 for false, 1 for true
  -- Store percentage as basis points (integer, e.g., 100.00% = 10000, 2.5% = 250)
  recovery_percentage INTEGER DEFAULT 10000, -- Default 100.00%
  is_active INTEGER NOT NULL DEFAULT 1, -- 0 for false, 1 for true
  tax_category TEXT, -- For linking to tax forms/lines
  parent_id TEXT REFERENCES chart_of_accounts(id) ON DELETE SET NULL, -- For hierarchical CoA
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT uq_chart_of_accounts_code_user UNIQUE (user_id, code) -- Code must be unique per user
);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_user_id ON chart_of_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent_id ON chart_of_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type_user ON chart_of_accounts(user_id, type);

-- Entity Accounts (Links accounts from user's CoA to specific entities, allowing overrides)
CREATE TABLE IF NOT EXISTS entity_accounts (
  id TEXT PRIMARY KEY, -- e.g., UUID
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Denormalized for easier access control
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT, -- Prevent deleting CoA if used
  custom_name TEXT, -- Optional override for account name specific to this entity
  is_active INTEGER NOT NULL DEFAULT 1, -- 0 for false, 1 for true, for this specific entity-account link
  recovery_type TEXT, -- Entity-specific override for recovery treatment
  -- Store percentage as basis points (integer, e.g., 100.00% = 10000)
  recovery_percentage INTEGER, -- Entity-specific override, NULL means use CoA default
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT uq_entity_accounts_entity_account UNIQUE (entity_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_entity_accounts_user_id ON entity_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_accounts_entity_id ON entity_accounts(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_accounts_account_id ON entity_accounts(account_id);

-- Journals (Optional: for grouping transactions, e.g., 'Sales Journal', 'Purchase Journal')
CREATE TABLE IF NOT EXISTS journals (
  id TEXT PRIMARY KEY, -- e.g., UUID
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_journals_user_id ON journals(user_id);
CREATE INDEX IF NOT EXISTS idx_journals_entity_id ON journals(entity_id);

-- Transactions (Master record for financial events, header for journal entries)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY, -- e.g., UUID
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  journal_id TEXT REFERENCES journals(id) ON DELETE SET NULL, -- Optional link to a journal
  date INTEGER NOT NULL, -- Unix timestamp of the transaction date (not creation date)
  description TEXT NOT NULL,
  reference TEXT, -- e.g., check number, invoice number
  status TEXT NOT NULL DEFAULT 'posted', -- 'pending', 'posted', 'voided'
  is_reconciled INTEGER NOT NULL DEFAULT 0, -- 0 for false, 1 for true
  document_url TEXT, -- Link to Cloudflare R2 object
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_entity_id ON transactions(entity_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date_entity ON transactions(user_id, entity_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_status_entity ON transactions(user_id, entity_id, status);

-- Transaction Lines (Represents individual debit/credit lines of a double-entry transaction)
CREATE TABLE IF NOT EXISTS transaction_lines (
  id TEXT PRIMARY KEY, -- e.g., UUID
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  -- Link to the specific account instance for an entity
  entity_account_id TEXT NOT NULL REFERENCES entity_accounts(id) ON DELETE RESTRICT, 
  -- Amount stored as an INTEGER in cents (e.g., $123.45 is stored as 12345)
  amount INTEGER NOT NULL, -- Always positive. Debit/Credit determined by `is_debit`.
  is_debit INTEGER NOT NULL, -- 1 for debit, 0 for credit
  memo TEXT, -- Optional line-item specific description
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
  -- No updated_at by design, journal entry lines are typically immutable to maintain audit trail integrity
);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_transaction_id ON transaction_lines(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_entity_account_id ON transaction_lines(entity_account_id);
