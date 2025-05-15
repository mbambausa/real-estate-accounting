-- migrations/0001_initial.sql

-- Users (shared by your app and NextAuth)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified INTEGER DEFAULT 0,
  image TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- NextAuth: OAuth accounts
CREATE TABLE IF NOT EXISTS accounts (
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
  session_state TEXT
);

-- NextAuth: Session storage
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMP NOT NULL
);

-- NextAuth: Email verification tokens
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT PRIMARY KEY,
  expires TIMESTAMP NOT NULL
);

-- Entities (e.g. companies, properties)
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
CREATE INDEX IF NOT EXISTS idx_entities_user ON entities(user_id);

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,             -- asset, liability, equity, income, expense
  subtype TEXT,                   -- e.g. recoverable, non-recoverable, other
  is_recoverable INTEGER DEFAULT 0,
  recovery_percentage REAL DEFAULT 100,
  parent_id TEXT REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_chart_accounts_user ON chart_of_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_chart_accounts_type ON chart_of_accounts(user_id, type);

-- Journals (for grouping or categorizing transactions)
CREATE TABLE IF NOT EXISTS journals (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Transactions (master record)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  date INTEGER NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending, committed
  is_reconciled INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_entity ON transactions(entity_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);

-- Transaction Lines (double-entry)
CREATE TABLE IF NOT EXISTS transaction_lines (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
  amount REAL NOT NULL,           -- positive = debit, negative = credit
  memo TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_transaction
  ON transaction_lines(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_account
  ON transaction_lines(account_id);
