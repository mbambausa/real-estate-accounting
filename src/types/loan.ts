// src/types/loan.ts

export type LoanType = 'mortgage' | 'seller_financing' | 'related_party' | 'other_receivable' | 'other_payable';
export type LoanPaymentFrequency = 'monthly' | 'quarterly' | 'annually' | 'lump_sum' | 'custom';
export type LoanStatus = 'active' | 'pending_approval' | 'paid_off' | 'defaulted' | 'cancelled' | 'draft';
export type InterestRateType = 'fixed' | 'variable';

/**
 * Represents a loan (note receivable or note payable).
 * Aligns with the 'loans' D1 table (DbLoan).
 */
export interface Loan {
  id: string;
  user_id: string; // From D1 schema, for ownership
  entity_id: string; // The entity that owns this loan (receivable) or owes this loan (payable)
  borrower_name?: string | null; // If receivable, name of the borrower
  lender_name?: string | null;   // If payable, name of the lender
  description?: string | null;
  loan_type: LoanType;
  original_principal: number;
  current_principal: number;
  interest_rate: number; // Annual rate, e.g., 0.05 for 5%
  interest_rate_type: InterestRateType;
  origination_date: number; // Unix timestamp (seconds)
  maturity_date: number;    // Unix timestamp (seconds)
  payment_frequency: LoanPaymentFrequency;
  payment_amount: number;   // Scheduled periodic payment
  status: LoanStatus;
  collateral_description?: string | null;
  collateral_value?: number | null;
  next_payment_date?: number | null; // Unix timestamp (seconds)
  created_at: number; // Unix timestamp (seconds)
  updated_at: number; // Unix timestamp (seconds)
}

export type LoanScheduleStatus = 'scheduled' | 'paid' | 'pending_payment' | 'skipped' | 'missed';

/**
 * Represents an entry in a loan's amortization schedule.
 * Aligns with the 'loan_schedules' D1 table (DbLoanSchedule).
 */
export interface LoanScheduleEntry {
  id: string;
  loan_id: string;
  user_id: string; // From D1 schema
  payment_number: number;
  payment_date: number; // Scheduled payment date (Unix timestamp seconds)
  total_payment: number;
  principal_portion: number;
  interest_portion: number;
  remaining_balance: number; // Expected balance after this payment
  status: LoanScheduleStatus;
  actual_payment_date?: number | null; // Unix timestamp (seconds)
  actual_payment_amount?: number | null;
  transaction_id?: string | null; // Link to the accounting transaction
  created_at: number; // Unix timestamp (seconds)
  updated_at: number; // Unix timestamp (seconds)
}

/**
 * Input payload for creating or updating a Loan.
 * `user_id` is derived from session. `current_principal` usually starts as `original_principal`.
 */
export interface LoanInput {
  entity_id: string;
  borrower_name?: string | null;
  lender_name?: string | null;
  description?: string | null;
  loan_type: LoanType;
  original_principal: number;
  interest_rate: number;
  interest_rate_type: InterestRateType;
  origination_date: number; // Unix timestamp (seconds)
  maturity_date: number;    // Unix timestamp (seconds)
  payment_frequency: LoanPaymentFrequency;
  payment_amount: number;
  status?: LoanStatus; // Initial status, e.g., 'draft' or 'active'
  collateral_description?: string | null;
  collateral_value?: number | null;
  next_payment_date?: number | null;
}

/**
 * Input for recording a payment against a loan schedule entry.
 */
export interface RecordLoanPaymentInput {
  loan_schedule_id: string;
  actual_payment_date: number; // Unix timestamp (seconds)
  actual_payment_amount: number;
  transaction_id?: string; // Optional: ID of the accounting transaction if already created
  // new_status?: LoanScheduleStatus; // Usually becomes 'paid'
}