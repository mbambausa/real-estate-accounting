-- migrations/0001_initial.sql
-- Database Schema: Real Estate Accounting
-- Version: 1.1 (Revised with DROP statements and unixepoch)
-- Date: 2025-05-15

-- Drop tables in reverse order of dependency (or an order that works)
-- This is to ensure a clean slate, especially during development.
DROP TABLE IF EXISTS transaction_lines;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS entity_accounts;
DROP TABLE IF EXISTS journals;
DROP TABLE IF EXISTS chart_of_accounts; -- Referenced by entity_accounts, also self-references
DROP TABLE IF EXISTS entities;          -- Referenced by many, also self-references
DROP TABLE IF EXISTS auth_accounts;     -- References users
DROP TABLE IF EXISTS sessions;          -- References users
DROP TABLE IF EXISTS verification_tokens; -- No FKs out
DROP TABLE IF EXISTS users;             -- Base table

-- Users (Manages application users and authentication via Auth.js)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Auth.js: OAuth accounts
CREATE TABLE IF NOT EXISTS auth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  CONSTRAINT uq_auth_accounts_provider UNIQUE (provider, provider_account_id)
);
CREATE INDEX IF NOT EXISTS idx_auth_accounts_user_id ON auth_accounts(user_id);

-- Auth.js: Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_token ON sessions(session_token);

-- Auth.js: Verification Tokens
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires INTEGER NOT NULL,
  CONSTRAINT uq_verification_tokens_identifier_token UNIQUE (identifier, token)
);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);

-- Entities (Properties, Companies, etc.)
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  legal_name TEXT,
  ein TEXT,
  address TEXT,
  legal_address TEXT,
  business_type TEXT,
  parent_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_entities_user_id ON entities(user_id);
CREATE INDEX IF NOT EXISTS idx_entities_parent_id ON entities(parent_id);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(user_id, name);

-- Chart of Accounts (User-specific master list)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'asset', 'liability', 'equity', 'income', 'expense'
  subtype TEXT,
  description TEXT,
  is_recoverable INTEGER NOT NULL DEFAULT 0,
  recovery_percentage REAL DEFAULT 100.0,
  is_active INTEGER NOT NULL DEFAULT 1,
  tax_category TEXT,
  parent_id TEXT REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT uq_chart_of_accounts_code_user UNIQUE (user_id, code)
);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_user_id ON chart_of_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent_id ON chart_of_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type ON chart_of_accounts(user_id, type);

-- Entity Accounts (Links accounts from CoA to specific entities)
CREATE TABLE IF NOT EXISTS entity_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
  custom_name TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  recovery_type TEXT,
  recovery_percentage REAL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CONSTRAINT uq_entity_accounts_entity_account UNIQUE (entity_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_entity_accounts_user_id ON entity_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_accounts_entity_id ON entity_accounts(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_accounts_account_id ON entity_accounts(account_id);

-- Journals (Optional grouping for transactions)
CREATE TABLE IF NOT EXISTS journals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_journals_user_id ON journals(user_id);
CREATE INDEX IF NOT EXISTS idx_journals_entity_id ON journals(entity_id);

-- Transactions (Master record for financial events)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  journal_id TEXT REFERENCES journals(id) ON DELETE SET NULL,
  date INTEGER NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'posted', 'voided'
  is_reconciled INTEGER NOT NULL DEFAULT 0,
  document_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_entity_id ON transactions(entity_id);
CREATE INDEX IF NOT EXISTS idx_transactions_journal_id ON transactions(journal_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(user_id, entity_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(user_id, entity_id, status);

-- Transaction Lines (Double-entry lines)
CREATE TABLE IF NOT EXISTS transaction_lines (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  entity_account_id TEXT NOT NULL REFERENCES entity_accounts(id) ON DELETE RESTRICT,
  amount REAL NOT NULL, -- Always positive
  is_debit INTEGER NOT NULL, -- 1 for debit, 0 for credit
  memo TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_transaction_id ON transaction_lines(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_entity_account_id ON transaction_lines(entity_account_id);