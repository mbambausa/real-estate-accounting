// src/utils/financial.ts
import Decimal from 'decimal.js';

// Project-wide Decimal.js configuration
// Clone this configuration per-instance to avoid global side effects.
const DECIMAL_CONFIG = {
  precision: 20,                // High precision for GAAP intermediate calcs
  rounding: Decimal.ROUND_HALF_EVEN, // Banker's rounding
  toExpNeg: -7,
  toExpPos: 21,
};

/**
 * Creates a new Decimal instance with project-specific configuration.
 * @param value - number, string, or Decimal to wrap
 */
export function newDecimal(value: number | string | Decimal): Decimal {
  const SiteDecimal = Decimal.clone(DECIMAL_CONFIG);
  return new SiteDecimal(value);
}

/**
 * Format an amount (in main currency units) as currency, e.g. 1234.5 → "$1,234.50".
 * @param amount - dollars (or main unit), not cents
 * @param currency - ISO currency code (defaults to USD)
 */
export function formatCurrency(
  amount: number | string | Decimal,
  currency = 'USD'
): string {
  const num = newDecimal(amount).toDP(2).toNumber();
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format an integer amount in cents as currency, e.g. 12345 → "$123.45".
 * @param cents - integer number of cents
 * @param currency - ISO currency code (defaults to USD)
 */
export function formatCentsAsCurrency(
  cents: number,
  currency = 'USD'
): string {
  if (!Number.isInteger(cents)) {
    console.warn('formatCentsAsCurrency received non-integer cents');
  }
  const dollars = newDecimal(cents).dividedBy(100).toDP(2).toNumber();
  return formatCurrency(dollars, currency);
}

/**
 * Check whether a set of transaction lines balances to zero.
 * Uses integer cents for exactness.
 * @param lines - array of { amount: number; is_debit: boolean }
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
 * Calculate account balance (in cents) given transaction lines.
 * Debits add to debit-normal accounts, subtract from credit-normal.
 * @param lines - array of { amount: number; is_debit: boolean }
 * @param accountNormalBalance - 'debit' or 'credit'
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
