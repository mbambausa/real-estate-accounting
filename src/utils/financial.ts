// src/utils/financial.ts
import Decimal from 'decimal.js';

// Global Decimal.js configuration
Decimal.set({
  precision: 20,                    // GAAP often requires high precision for intermediate calculations
  rounding: Decimal.ROUND_HALF_EVEN, // Banker's rounding
  toExpNeg: -7,
  toExpPos: 21,
});

/**
 * Creates a new Decimal instance.
 * Relies on the global Decimal configuration above.
 */
export function newDecimal(value: number | string | Decimal): Decimal {
  return new Decimal(value);
}

/**
 * Format an amount (assumed to be in dollars/main currency unit, not cents) as currency.
 */
export function formatCurrency(
  amount: number | string | Decimal,
  currency = 'USD'
): string {
  const num = newDecimal(amount).toDP(2).toNumber(); // Ensure 2 decimal places
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format an integer amount (in cents) as currency.
 */
export function formatCentsAsCurrency(
  cents: number,
  currency = 'USD'
): string {
  if (!Number.isInteger(cents)) {
    console.warn(
      'formatCentsAsCurrency received non-integer. Potential precision loss.'
    );
  }
  const dollars = newDecimal(cents).dividedBy(100).toDP(2).toNumber();
  return formatCurrency(dollars, currency);
}

/**
 * Check if a transaction (lines with integer cent amounts) is balanced.
 * Lines: { amount: number (cents); is_debit: boolean }[]
 */
export function isTransactionBalancedCents(
  lines: Array<{ amount: number; is_debit: boolean }>
): boolean {
  let balance = newDecimal(0);
  for (const line of lines) {
    const amt = newDecimal(line.amount);
    balance = line.is_debit ? balance.plus(amt) : balance.minus(amt);
  }
  return balance.isZero();
}

/**
 * Calculate account balance (in cents) based on transaction lines.
 * accountNormalBalance: 'debit' | 'credit'
 */
export function calculateAccountBalanceCents(
  lines: Array<{ amount: number; is_debit: boolean }>,
  accountNormalBalance: 'debit' | 'credit'
): number {
  let balance = newDecimal(0);
  for (const line of lines) {
    const amt = newDecimal(line.amount);
    if (accountNormalBalance === 'debit') {
      balance = line.is_debit ? balance.plus(amt) : balance.minus(amt);
    } else {
      balance = !line.is_debit ? balance.plus(amt) : balance.minus(amt);
    }
  }
  return balance.toNumber();
}
