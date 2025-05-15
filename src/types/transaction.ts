// src/types/transaction.ts

export type TransactionStatus = 'pending' | 'committed' | 'voided'; // Added 'voided' as a common status

export interface Transaction {
  id: string;
  user_id: string; // Assuming this will be in your D1 schema for ownership
  entity_id: string;
  date: number; // Unix timestamp in seconds (align with D1's unixepoch())
  description: string;
  reference?: string; // e.g., check number, invoice number
  document_url?: string; // Link to R2 object for attachments
  status: TransactionStatus;
  is_reconciled: boolean;
  created_at: number; // Unix timestamp in seconds
  updated_at: number; // Unix timestamp in seconds
  lines?: TransactionLine[]; // For convenience when fetching a full transaction
}

export interface TransactionLine {
  id: string;
  transaction_id: string;
  entity_account_id: string; // ID from the entity_accounts table (instance of a COA for an entity)
  amount: number;          // Always positive. Nature (debit/credit) determined by is_debit.
  is_debit: boolean;       // True if this line is a debit, false if a credit.
  description?: string;     // Optional memo/description for this specific line item
  created_at: number;      // Unix timestamp in seconds
  updated_at: number;      // Unix timestamp in seconds
}

export interface TransactionLineInput {
  entity_account_id: string; // ID of the account (from entity_accounts) to be debited/credited
  amount: number;          // The absolute monetary value (always positive)
  is_debit: boolean;       // True if this is a debit, false for a credit
  description?: string;     // Optional line-item description/memo
}

export interface TransactionInput {
  user_id: string; // To associate with the user creating it
  entity_id: string;
  date: number; // Unix timestamp in seconds. Convert from Date/string in handler.
  description: string;
  reference?: string;
  document_url?: string; // Optional, can be added/updated later
  status?: TransactionStatus; // Defaults to 'pending'
  lines: TransactionLineInput[];
}