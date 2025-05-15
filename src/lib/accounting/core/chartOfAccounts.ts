// src/lib/accounting/core/chartOfAccounts.ts

// Use 'import type' for types
import type { AccountType, ExpenseSubtype } from '../../../types/account'; // Adjusted for a typical structure

export interface ChartOfAccountsItem {
  code: string;
  name: string;
  type: AccountType;
  /**
   * Further classification, especially for expenses.
   * Uses ExpenseSubtype for type safety if primarily for expenses.
   */
  subtype?: ExpenseSubtype | string; // Allow ExpenseSubtype or other strings if needed
  /**
   * Explicitly marks if an expense account is recoverable.
   * Recommended for clarity, especially for expense accounts.
   */
  isRecoverable?: boolean;
  /**
   * Code of the parent account, for hierarchical structures.
   */
  parentCode?: string;
  /**
   * Indicates if this account is a control account.
   * Control accounts have their balances derived from subsidiary ledgers (e.g., Accounts Receivable).
   */
  isControlAccount?: boolean;
  /**
   * Normal balance side of the account (debit or credit).
   * While derivable from 'type', explicitly stating can be useful for validation/reporting.
   */
  normalBalance?: 'debit' | 'credit';
  /**
   * Brief explanation of what the account is used for.
   */
  description?: string;
}

// Implementation of our simplified chart of accounts
// This is a starting point and would typically be much more extensive
// and potentially configurable or loaded from a database per user/entity.
export const defaultChartOfAccounts: ChartOfAccountsItem[] = [
  // == ASSETS (1000-1999) ==
  // Current Assets (1000-1499)
  { code: '1010', name: 'Cash and Cash Equivalents', type: 'asset', normalBalance: 'debit', description: 'Operating bank accounts, petty cash.' },
  { code: '1020', name: 'Checking Account', type: 'asset', parentCode: '1010', normalBalance: 'debit' },
  { code: '1030', name: 'Savings Account', type: 'asset', parentCode: '1010', normalBalance: 'debit' },
  { code: '1040', name: 'Petty Cash', type: 'asset', parentCode: '1010', normalBalance: 'debit' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', isControlAccount: true, normalBalance: 'debit', description: 'Amounts due from tenants for rent.' },
  { code: '1110', name: 'Tenant Receivables', type: 'asset', parentCode: '1100', normalBalance: 'debit' }, // Specific A/R from tenants
  { code: '1200', name: 'Prepaid Expenses', type: 'asset', normalBalance: 'debit', description: 'Expenses paid in advance, like insurance.' },
  { code: '1210', name: 'Prepaid Insurance', type: 'asset', parentCode: '1200', normalBalance: 'debit' },
  { code: '1300', name: 'Security Deposits Held in Trust (Asset)', type: 'asset', normalBalance: 'debit', description: 'Cash held in a separate bank account for tenant security deposits. A corresponding liability exists.' },

  // Fixed Assets (1500-1999) - For properties owned by the entity itself
  { code: '1500', name: 'Land', type: 'asset', normalBalance: 'debit' },
  { code: '1510', name: 'Buildings', type: 'asset', normalBalance: 'debit' },
  { code: '1515', name: 'Accumulated Depreciation - Buildings', type: 'asset', normalBalance: 'credit', description: 'Contra-asset account for building depreciation.' }, // Note: Contra-asset has credit normal balance
  { code: '1520', name: 'Furniture and Fixtures', type: 'asset', normalBalance: 'debit' },
  { code: '1525', name: 'Accumulated Depreciation - Furniture', type: 'asset', normalBalance: 'credit', description: 'Contra-asset account.' },


  // == LIABILITIES (2000-2999) ==
  // Current Liabilities (2000-2499)
  { code: '2010', name: 'Accounts Payable', type: 'liability', isControlAccount: true, normalBalance: 'credit', description: 'Amounts owed to suppliers and vendors.' },
  { code: '2100', name: 'Tenant Security Deposits Payable', type: 'liability', normalBalance: 'credit', description: 'Obligation to return security deposits to tenants.' },
  { code: '2200', name: 'Unearned Rent Revenue', type: 'liability', normalBalance: 'credit', description: 'Rent received from tenants in advance.' },
  { code: '2300', name: 'Property Taxes Payable', type: 'liability', normalBalance: 'credit' },

  // Long-Term Liabilities (2500-2999)
  { code: '2500', name: 'Mortgage Payable', type: 'liability', normalBalance: 'credit' },
  { code: '2510', name: 'Notes Payable - Long Term', type: 'liability', normalBalance: 'credit' },


  // == EQUITY (3000-3999) ==
  { code: '3010', name: 'Owner\'s Capital', type: 'equity', normalBalance: 'credit' },
  { code: '3020', name: 'Owner\'s Draws', type: 'equity', normalBalance: 'debit', description: 'Withdrawals by the owner (contra-equity).' }, // Note: Contra-equity has debit normal balance
  { code: '3030', name: 'Retained Earnings', type: 'equity', normalBalance: 'credit' },


  // == INCOME / REVENUE (4000-4999) ==
  { code: '4010', name: 'Rental Income', type: 'income', normalBalance: 'credit' },
  { code: '4020', name: 'Late Fee Income', type: 'income', normalBalance: 'credit' },
  { code: '4030', name: 'Other Property Income', type: 'income', normalBalance: 'credit' },
  { code: '4500', name: 'Interest Income', type: 'income', normalBalance: 'credit' },


  // == EXPENSES (5000-5999) ==
  // Operating Expenses - Property Specific
  { code: '5010', name: 'Property Management Fees', type: 'expense', subtype: 'non-recoverable', isRecoverable: false, normalBalance: 'debit' },
  { code: '5010-R', name: 'Property Management Fees (Recoverable)', type: 'expense', subtype: 'recoverable', isRecoverable: true, normalBalance: 'debit' },
  { code: '5020', name: 'Repairs and Maintenance', type: 'expense', subtype: 'non-recoverable', isRecoverable: false, normalBalance: 'debit' },
  { code: '5020-R', name: 'Repairs and Maintenance (Recoverable)', type: 'expense', subtype: 'recoverable', isRecoverable: true, normalBalance: 'debit' },
  { code: '5030', name: 'Utilities', type: 'expense', subtype: 'non-recoverable', isRecoverable: false, normalBalance: 'debit' },
  { code: '5030-R', name: 'Utilities (Recoverable)', type: 'expense', subtype: 'recoverable', isRecoverable: true, normalBalance: 'debit' },
  { code: '5040', name: 'Property Insurance', type: 'expense', normalBalance: 'debit' },
  { code: '5050', name: 'Property Taxes', type: 'expense', normalBalance: 'debit' },

  // General & Administrative Expenses
  { code: '5100', name: 'Bank Fees', type: 'expense', normalBalance: 'debit' },
  { code: '5110', name: 'Office Supplies', type: 'expense', normalBalance: 'debit' },
  { code: '5120', name: 'Professional Fees (Legal, Accounting)', type: 'expense', normalBalance: 'debit' },

  // Financial Expenses
  { code: '5800', name: 'Mortgage Interest Expense', type: 'expense', normalBalance: 'debit' },
  { code: '5900', name: 'Depreciation Expense', type: 'expense', normalBalance: 'debit' },
];

/**
 * Function to retrieve the default chart of accounts.
 * In a real application, this might fetch from a database or a configuration file,
 * potentially personalized for a user or entity.
 */
export function getDefaultChartOfAccounts(): ChartOfAccountsItem[] {
  return defaultChartOfAccounts;
}

/**
 * Finds an account in a given chart of accounts by its code.
 * @param chart The chart of accounts to search.
 * @param code The account code to find.
 * @returns The ChartOfAccountsItem if found, otherwise undefined.
 */
export function findAccountByCode(chart: ChartOfAccountsItem[], code: string): ChartOfAccountsItem | undefined {
  return chart.find(account => account.code === code);
}

/**
 * Builds a hierarchical (tree) representation of the chart of accounts.
 * Note: This is a simplified example; a more robust version would handle cycles
 * and ensure parent codes exist.
 */
export interface HierarchicalChartOfAccountsItem extends ChartOfAccountsItem {
  children: HierarchicalChartOfAccountsItem[];
}

export function buildHierarchy(
  items: ChartOfAccountsItem[],
  parentCode: string | null = null
): HierarchicalChartOfAccountsItem[] {
  const children: HierarchicalChartOfAccountsItem[] = [];
  for (const item of items) {
    if ((parentCode === null && !item.parentCode) || item.parentCode === parentCode) {
      const node: HierarchicalChartOfAccountsItem = {
        ...item,
        children: buildHierarchy(items, item.code),
      };
      children.push(node);
    }
  }
  return children;
}
