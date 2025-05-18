// src/lib/accounting/chartOfAccounts.ts

// Use 'import type' for types
// Assuming AccountType and ExpenseSubtype are defined in your main application types
// and are compatible with how they are used here.
import type { AccountSystemType as AccountType } from '@db/schema';
import type { ExpenseSubtype } from '../../types/account';

export interface ChartOfAccountsItem {
  code: string;
  name: string;
  type: AccountType;
  /**
   * Further classification, especially for expenses.
   * Uses ExpenseSubtype for type safety if primarily for expenses.
   */
  subtype?: ExpenseSubtype | string | null; // Allow ExpenseSubtype or other strings if needed
  /**
   * Explicitly marks if an expense account is recoverable.
   * Recommended for clarity, especially for expense accounts.
   */
  isRecoverable?: boolean;
  /**
   * Code of the parent account, for hierarchical structures within this default definition.
   * The AccountService will translate this to parent_id (UUID) when seeding the database.
   */
  parentCode?: string | null;
  /**
   * Indicates if this account is a control account.
   * Control accounts have their balances derived from subsidiary ledgers (e.g., Accounts Receivable).
   */
  isControlAccount?: boolean;
  /**
   * Normal balance side of the account (debit or credit).
   * Crucial for the Account class logic.
   */
  normalBalance: 'debit' | 'credit'; // Made non-optional as it's critical
  /**
   * Brief explanation of what the account is used for.
   */
  description?: string | null;
}

// Implementation of our simplified chart of accounts
// This is a starting point and would typically be much more extensive
// and potentially configurable or loaded from a database per user/entity.
export const defaultChartOfAccounts: ChartOfAccountsItem[] = [
  // == ASSETS (1000-1999) ==
  // Current Assets (1000-1499)
  { code: '1000', name: 'Current Assets', type: 'asset', normalBalance: 'debit', description: 'Top-level current assets category.' },
  { code: '1010', name: 'Cash and Cash Equivalents', type: 'asset', parentCode: '1000', normalBalance: 'debit', description: 'Operating bank accounts, petty cash.' },
  { code: '1020', name: 'Checking Account', type: 'asset', parentCode: '1010', normalBalance: 'debit' },
  { code: '1030', name: 'Savings Account', type: 'asset', parentCode: '1010', normalBalance: 'debit' },
  { code: '1040', name: 'Petty Cash', type: 'asset', parentCode: '1010', normalBalance: 'debit' },
  
  { code: '1100', name: 'Accounts Receivable', type: 'asset', parentCode: '1000', isControlAccount: true, normalBalance: 'debit', description: 'Amounts due from tenants for rent.' },
  { code: '1110', name: 'Tenant Receivables', type: 'asset', parentCode: '1100', normalBalance: 'debit' },
  
  { code: '1200', name: 'Prepaid Expenses', type: 'asset', parentCode: '1000', normalBalance: 'debit', description: 'Expenses paid in advance, like insurance.' },
  { code: '1210', name: 'Prepaid Insurance', type: 'asset', parentCode: '1200', normalBalance: 'debit' },
  
  { code: '1300', name: 'Security Deposits Held (Asset)', type: 'asset', parentCode: '1000', normalBalance: 'debit', description: 'Cash held in a separate bank account for tenant security deposits. A corresponding liability exists.' },

  // Fixed Assets (1500-1999) - For properties owned by the entity itself
  { code: '1500', name: 'Fixed Assets', type: 'asset', normalBalance: 'debit', description: 'Long-term assets like land and buildings.' },
  { code: '1510', name: 'Land', type: 'asset', parentCode: '1500', normalBalance: 'debit' },
  { code: '1520', name: 'Buildings', type: 'asset', parentCode: '1500', normalBalance: 'debit' },
  { code: '1525', name: 'Accumulated Depreciation - Buildings', type: 'asset', parentCode: '1520', normalBalance: 'credit', description: 'Contra-asset account for building depreciation.' },
  { code: '1530', name: 'Furniture and Fixtures', type: 'asset', parentCode: '1500', normalBalance: 'debit' },
  { code: '1535', name: 'Accumulated Depreciation - Furniture', type: 'asset', parentCode: '1530', normalBalance: 'credit', description: 'Contra-asset account.' },


  // == LIABILITIES (2000-2999) ==
  { code: '2000', name: 'Current Liabilities', type: 'liability', normalBalance: 'credit', description: 'Short-term obligations.'},
  { code: '2010', name: 'Accounts Payable', type: 'liability', parentCode: '2000', isControlAccount: true, normalBalance: 'credit', description: 'Amounts owed to suppliers and vendors.' },
  { code: '2100', name: 'Tenant Security Deposits (Liability)', type: 'liability', parentCode: '2000', normalBalance: 'credit', description: 'Obligation to return security deposits to tenants.' },
  { code: '2200', name: 'Unearned Rent Revenue', type: 'liability', parentCode: '2000', normalBalance: 'credit', description: 'Rent received from tenants in advance.' },
  { code: '2300', name: 'Property Taxes Payable', type: 'liability', parentCode: '2000', normalBalance: 'credit' },
  { code: '2400', name: 'Accrued Expenses', type: 'liability', parentCode: '2000', normalBalance: 'credit' },


  { code: '2500', name: 'Long-Term Liabilities', type: 'liability', normalBalance: 'credit', description: 'Obligations due in more than one year.'},
  { code: '2510', name: 'Mortgage Payable', type: 'liability', parentCode: '2500', normalBalance: 'credit' },
  { code: '2520', name: 'Notes Payable - Long Term', type: 'liability', parentCode: '2500', normalBalance: 'credit' },


  // == EQUITY (3000-3999) ==
  { code: '3000', name: 'Equity', type: 'equity', normalBalance: 'credit', description: "Owner's stake in the company."},
  { code: '3010', name: "Owner's Capital / Common Stock", type: 'equity', parentCode: '3000', normalBalance: 'credit' },
  { code: '3020', name: "Owner's Draws / Dividends", type: 'equity', parentCode: '3000', normalBalance: 'debit', description: 'Withdrawals by the owner or dividends paid (contra-equity).' },
  { code: '3030', name: 'Retained Earnings', type: 'equity', parentCode: '3000', normalBalance: 'credit' },


  // == INCOME / REVENUE (4000-4999) ==
  { code: '4000', name: 'Operating Revenue', type: 'income', normalBalance: 'credit', description: 'Income from primary business activities.'},
  { code: '4010', name: 'Rental Income', type: 'income', parentCode: '4000', normalBalance: 'credit' },
  { code: '4020', name: 'Late Fee Income', type: 'income', parentCode: '4000', normalBalance: 'credit' },
  { code: '4030', name: 'Other Property Income', type: 'income', parentCode: '4000', normalBalance: 'credit', description: 'e.g., laundry, parking fees.' },
  
  { code: '4500', name: 'Non-Operating Income', type: 'income', normalBalance: 'credit', description: 'Income from secondary activities.'},
  { code: '4510', name: 'Interest Income', type: 'income', parentCode: '4500', normalBalance: 'credit' },


  // == EXPENSES (5000-5999) ==
  // Operating Expenses - Property Specific
  { code: '5000', name: 'Property Operating Expenses', type: 'expense', normalBalance: 'debit', description: 'Expenses directly related to property operations.'},
  { code: '5010', name: 'Property Management Fees', type: 'expense', parentCode: '5000', subtype: 'non-recoverable', isRecoverable: false, normalBalance: 'debit' },
  { code: '5010-R', name: 'Property Management Fees (Recoverable)', type: 'expense', parentCode: '5000', subtype: 'recoverable', isRecoverable: true, normalBalance: 'debit' },
  { code: '5020', name: 'Repairs and Maintenance', type: 'expense', parentCode: '5000', subtype: 'non-recoverable', isRecoverable: false, normalBalance: 'debit' },
  { code: '5020-R', name: 'Repairs and Maintenance (Recoverable)', type: 'expense', parentCode: '5000', subtype: 'recoverable', isRecoverable: true, normalBalance: 'debit' },
  { code: '5030', name: 'Utilities', type: 'expense', parentCode: '5000', subtype: 'non-recoverable', isRecoverable: false, normalBalance: 'debit' },
  { code: '5030-R', name: 'Utilities (Recoverable)', type: 'expense', parentCode: '5000', subtype: 'recoverable', isRecoverable: true, normalBalance: 'debit' },
  { code: '5040', name: 'Property Insurance', type: 'expense', parentCode: '5000', normalBalance: 'debit' }, // Often non-recoverable or part of CAM
  { code: '5050', name: 'Property Taxes', type: 'expense', parentCode: '5000', normalBalance: 'debit' }, // Often non-recoverable or part of CAM

  // General & Administrative Expenses
  { code: '5100', name: 'General & Administrative Expenses', type: 'expense', normalBalance: 'debit', description: 'Overhead expenses.'},
  { code: '5110', name: 'Bank Service Charges', type: 'expense', parentCode: '5100', normalBalance: 'debit' },
  { code: '5120', name: 'Office Supplies & Software', type: 'expense', parentCode: '5100', normalBalance: 'debit' },
  { code: '5130', name: 'Professional Fees', type: 'expense', parentCode: '5100', normalBalance: 'debit', description: 'Legal, accounting, consulting fees.' },
  { code: '5140', name: 'Licenses and Permits', type: 'expense', parentCode: '5100', normalBalance: 'debit'},

  // Financial Expenses
  { code: '5800', name: 'Financial Expenses', type: 'expense', normalBalance: 'debit'},
  { code: '5810', name: 'Mortgage Interest Expense', type: 'expense', parentCode: '5800', normalBalance: 'debit' },
  { code: '5820', name: 'Loan Fees & Other Interest', type: 'expense', parentCode: '5800', normalBalance: 'debit' },

  // Depreciation & Amortization
  { code: '5900', name: 'Depreciation & Amortization', type: 'expense', normalBalance: 'debit'},
  { code: '5910', name: 'Depreciation Expense - Buildings', type: 'expense', parentCode: '5900', normalBalance: 'debit' },
  { code: '5920', name: 'Depreciation Expense - Furniture & Fixtures', type: 'expense', parentCode: '5900', normalBalance: 'debit' },
  { code: '5930', name: 'Amortization Expense - Loan Costs', type: 'expense', parentCode: '5900', normalBalance: 'debit' },
];

/**
 * Function to retrieve the default chart of accounts.
 */
export function getDefaultChartOfAccounts(): ChartOfAccountsItem[] {
  return defaultChartOfAccounts;
}

/**
 * Finds an account in a given chart of accounts by its code.
 * @param chart The chart of accounts array to search.
 * @param code The account code to find.
 * @returns The ChartOfAccountsItem if found, otherwise undefined.
 */
export function findAccountByCodeInList(chart: ChartOfAccountsItem[], code: string): ChartOfAccountsItem | undefined {
  return chart.find(account => account.code === code);
}

/**
 * Builds a hierarchical (tree) representation of the chart of accounts based on parentCode.
 * Note: This is for the static defaultChartOfAccounts. The database uses parent_id (UUIDs).
 */
export interface HierarchicalChartOfAccountsItem extends ChartOfAccountsItem {
  children: HierarchicalChartOfAccountsItem[];
}

export function buildDefaultCoAHierarchy(
  items: ChartOfAccountsItem[],
  currentParentCode: string | null = null // Changed to null for root
): HierarchicalChartOfAccountsItem[] {
  const children: HierarchicalChartOfAccountsItem[] = [];
  for (const item of items) {
    // Match parentCode for hierarchy. If currentParentCode is null, we are looking for top-level accounts.
    if ((item.parentCode === undefined && currentParentCode === null) || item.parentCode === currentParentCode) {
      const node: HierarchicalChartOfAccountsItem = {
        ...item,
        children: buildDefaultCoAHierarchy(items, item.code), // Recurse with current item's code as the new parentCode
      };
      children.push(node);
    }
  }
  return children.sort((a,b) => a.code.localeCompare(b.code)); // Sort by code
}
