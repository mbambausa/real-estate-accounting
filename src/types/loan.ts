// src/types/loan.ts

export type LoanType = 'mortgage' | 'seller-financing' | 'related-party' | 'other';
export type LoanPaymentFrequency = 'monthly' | 'quarterly' | 'annual';
export type LoanStatus = 'active' | 'pending' | 'paid-off' | 'defaulted' | 'cancelled';
export type InterestRateType = 'fixed' | 'variable'; // Example, adjust as needed

export interface Loan {
  id: string;
  entity_id: string; // The entity that owns this loan receivable
  borrower_name: string; // Name of the person/entity who borrowed the money
  description?: string; // A descriptive name or memo for the loan itself
  loan_type: LoanType;
  original_principal: number; // Stored as a float/real
  current_principal: number;  // Stored as a float/real
  interest_rate: number;      // Annual interest rate, e.g., 0.05 for 5%
  interest_rate_type: InterestRateType;
  origination_date: number;   // Unix timestamp in seconds (align with D1's unixepoch())
  maturity_date: number;      // Unix timestamp in seconds
  payment_frequency: LoanPaymentFrequency;
  payment_amount: number;     // The scheduled payment amount
  status: LoanStatus;
  collateral_description?: string;
  collateral_value?: number;   // Stored as a float/real
  next_payment_date?: number;  // Unix timestamp in seconds
  created_at: number;         // Unix timestamp in seconds
  updated_at: number;         // Unix timestamp in seconds
  // Potential future fields not in current D1 schema but in your TS type:
  // borrower_id?: string; // If you link borrowers to an entities table or a dedicated borrowers table
}

export type LoanScheduleStatus = 'scheduled' | 'paid' | 'pending_payment' | 'skipped' | 'missed';

export interface LoanScheduleEntry { // Renamed from LoanPayment to better match D1 'loan_schedules'
  id: string;
  loan_id: string;
  payment_number: number;
  payment_date: number;          // Scheduled payment date (Unix timestamp in seconds)
  total_payment: number;         // Scheduled total payment amount
  principal_portion: number;
  interest_portion: number;
  remaining_balance: number;     // Expected remaining balance after this scheduled payment
  status: LoanScheduleStatus;
  actual_payment_date?: number;   // Actual date payment was made (Unix timestamp in seconds)
  actual_payment_amount?: number; // Actual amount paid, if different from scheduled
  transaction_id?: string;        // Link to the accounting transaction recording the payment
  created_at: number;            // Unix timestamp in seconds
  updated_at: number;            // Unix timestamp in seconds
}

// Input types for creating/updating loans
// Omitting id, created_at, updated_at, current_principal (usually calculated or starts as original)
export interface LoanInput {
  entity_id: string;
  borrower_name: string;
  description?: string;
  loan_type: LoanType;
  original_principal: number;
  interest_rate: number;
  interest_rate_type: InterestRateType;
  origination_date: number; // Unix timestamp in seconds
  maturity_date: number;    // Unix timestamp in seconds
  payment_frequency: LoanPaymentFrequency;
  payment_amount: number;
  status: LoanStatus; // Initial status, e.g., 'pending' or 'active'
  collateral_description?: string;
  collateral_value?: number;
  next_payment_date?: number;
}

// You might also want an input type for recording a payment against a loan schedule entry
export interface RecordLoanPaymentInput {
  loan_schedule_id: string; // ID of the loan_schedules entry being paid
  actual_payment_date: number; // Unix timestamp in seconds
  actual_payment_amount: number;
  transaction_id: string; // ID of the accounting transaction
  // new_status?: LoanScheduleStatus; // e.g., 'paid'
}