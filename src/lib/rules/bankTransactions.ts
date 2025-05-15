// src/lib/rules/bankTransactions.ts
import type { Rule } from './engine';

/**
 * Bank-specific rules for common transaction patterns
 */
export const bankTransactionRules: Rule[] = [
  // Monthly Maintenance Fee
  {
    id: 'bank-monthly-fee',
    name: 'Monthly Bank Fee',
    description: 'Categorize monthly maintenance fees',
    isActive: true,
    priority: 100,
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: 'MONTHLY MAINT FEE',
        caseSensitive: false
      }
    ],
    action: {
      accountId: 'bank-fees', // This should match your actual account ID
      isDebit: true,
      description: 'Monthly Bank Maintenance Fee'
    }
  },
  
  // Wire Transfer Fee
  {
    id: 'wire-fee',
    name: 'Wire Transfer Fee',
    description: 'Categorize wire transfer fees',
    isActive: true,
    priority: 100,
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: 'WIRE FEE',
        caseSensitive: false
      }
    ],
    action: {
      accountId: 'bank-fees', // This should match your actual account ID
      isDebit: true,
      description: 'Wire Transfer Fee'
    }
  },
  
  // NSF/Return Item Fee
  {
    id: 'nsf-fee',
    name: 'NSF/Return Item Fee',
    description: 'Categorize NSF or returned item fees',
    isActive: true,
    priority: 100,
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: 'NSF FEE',
        caseSensitive: false
      }
    ],
    action: {
      accountId: 'bank-fees', // This should match your actual account ID
      isDebit: true,
      description: 'NSF/Return Item Fee'
    }
  },
  
  // ATM Fee
  {
    id: 'atm-fee',
    name: 'ATM Fee',
    description: 'Categorize ATM fees',
    isActive: true,
    priority: 100,
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: 'ATM FEE',
        caseSensitive: false
      }
    ],
    action: {
      accountId: 'bank-fees', // This should match your actual account ID
      isDebit: true,
      description: 'ATM Fee'
    }
  },
  
  // Interest Earned
  {
    id: 'interest-earned',
    name: 'Interest Earned',
    description: 'Categorize interest earned on bank accounts',
    isActive: true,
    priority: 100,
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: 'INTEREST PAID',
        caseSensitive: false
      }
    ],
    action: {
      accountId: 'interest-income', // This should match your actual account ID
      isDebit: false,
      description: 'Bank Interest Income'
    }
  },
  
  // Direct Deposit (Rent Income)
  {
    id: 'direct-deposit-rent',
    name: 'Direct Deposit - Rent',
    description: 'Categorize direct deposits for rent payments',
    isActive: true,
    priority: 90,
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: 'DIRECT DEPOSIT',
        caseSensitive: false
      },
      {
        field: 'amount',
        operator: 'greaterThan',
        value: 500
      }
    ],
    action: {
      accountId: 'rental-income', // This should match your actual account ID
      isDebit: false,
      description: 'Rent Payment - Direct Deposit'
    }
  }
];

/**
 * Get bank transaction rules
 */
export function getBankTransactionRules(): Rule[] {
  return [...bankTransactionRules];
}

/**
 * Create custom bank transaction rule
 */
export function createCustomBankRule(
  name: string,
  description: string,
  textPattern: string,
  accountId: string,
  isDebit: boolean
): Rule {
  return {
    id: crypto.randomUUID(),
    name,
    description,
    isActive: true,
    priority: 50, // Default priority for custom rules
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: textPattern,
        caseSensitive: false
      }
    ],
    action: {
      accountId,
      isDebit,
      description: name
    }
  };
}