// src/utils/financial.ts

/**
 * Format a number as currency
 */
export function formatCurrency(amount: number | string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

/**
 * Check if a transaction is balanced (debits equal credits)
 */
export function isTransactionBalanced(lines: { amount: number }[]): boolean {
  const total = lines.reduce((sum, line) => sum + Number(line.amount), 0);
  return Math.abs(total) < 0.01; // Allow for minor floating point errors
}

/**
 * Calculate account balance based on transaction lines
 */
export function calculateAccountBalance(transactions: { amount: number }[]): number {
  return transactions.reduce((balance, tx) => balance + Number(tx.amount), 0);
}