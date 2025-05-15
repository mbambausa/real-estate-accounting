// src/lib/rules/ruleDefinitions.ts
import type { Rule, RuleCondition, RuleAction } from './engine'; // Import RuleCondition for better typing

/**
 * Default rule definitions for common transaction types.
 * IMPORTANT: The 'accountId' values here are placeholders (e.g., 'bank-fees')
 * and MUST be updated to match actual account IDs/codes from your Chart of Accounts.
 */
export const defaultRules: Rule[] = [
  // Bank Service Fee
  {
    id: 'std-bank-fee-service', // Standardized ID
    name: 'Bank Service Fee',
    description: 'Automatically categorize general bank service fees based on description.',
    isActive: true,
    priority: 100, // High priority for common specific fees
    conditions: [
      {
        field: 'description', // Field in CategorizableItem
        operator: 'contains',
        value: 'SERVICE FEE',
        caseSensitive: false
      }
    ],
    action: {
      accountId: '5100', // Example: Placeholder, map to actual COA code for Bank Fees
      isDebit: true,     // Bank fees are typically expenses (debits)
      description: 'Bank Service Fee'
    }
  },
  {
    id: 'std-bank-fee-monthly',
    name: 'Monthly Bank Maintenance Fee',
    description: 'Categorize monthly maintenance fees from bank statements.',
    isActive: true,
    priority: 101, // Slightly higher if more specific than general "SERVICE FEE"
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: 'MONTHLY MAINT FEE',
        caseSensitive: false,
      },
    ],
    action: {
      accountId: '5100', // Example: Placeholder
      isDebit: true,
      description: 'Monthly Bank Maintenance Fee',
    },
  },
  // Interest Income
  {
    id: 'std-interest-income',
    name: 'Interest Income',
    description: 'Automatically categorize interest income earned on bank accounts.',
    isActive: true,
    priority: 100,
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: 'INTEREST', // Common keyword, might need refinement (e.g., "INTEREST PAID TO YOU")
        caseSensitive: false
      },
      {
        field: 'type', // Assuming CategorizableItem has a 'type' of 'credit' for income from bank
        operator: 'equals',
        value: 'credit'
      }
    ],
    action: {
      accountId: '4500', // Example: Placeholder, map to actual COA code for Interest Income
      isDebit: false,    // Income increases with a credit
      description: 'Interest Income'
    }
  },
  // Property Tax Payment
  {
    id: 'std-property-tax',
    name: 'Property Tax Payment',
    description: 'Automatically categorize property tax payments.',
    isActive: true,
    priority: 90, // General expenses might have slightly lower priority than specific fees
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: 'PROPERTY TAX',
        caseSensitive: false
      },
      {
        field: 'type', // Assuming CategorizableItem has a 'type' of 'debit' for payments from bank
        operator: 'equals',
        value: 'debit'
      }
    ],
    action: {
      accountId: '5050', // Example: Placeholder, map to actual COA code for Property Tax Expense
      isDebit: true,     // Expenses are debits
      description: 'Property Tax Payment'
    }
  },
  // Mortgage Payment
  // Note: Mortgage payments often need to be split (principal vs. interest).
  // A simple rule might categorize the whole thing to an expense or a clearing account first.
  // Advanced rules would be needed for automatic splitting.
  {
    id: 'std-mortgage-payment',
    name: 'Mortgage Payment (Full)',
    description: 'Categorize full mortgage payments (further splitting may be needed).',
    isActive: true,
    priority: 89, // Priority for general categorization
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: 'MORTGAGE PAYMENT', // Common keyword
        caseSensitive: false
      },
      {
        field: 'description', // More specific variants
        operator: 'contains',
        value: 'LOAN PAYMENT',
        caseSensitive: false
      },
       // Add more specific conditions if needed, e.g., payee name
    ],
    action: {
      // This often goes to a clearing account or directly to Mortgage Expense if principal reduction is handled separately
      accountId: '5800', // Example: Placeholder for Mortgage Interest Expense or a generic "Mortgage Payment" expense
      isDebit: true,
      description: 'Mortgage Payment'
    }
  },
  // Insurance Payment
  {
    id: 'std-insurance-payment',
    name: 'Insurance Payment',
    description: 'Automatically categorize insurance payments.',
    isActive: true,
    priority: 90,
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: 'INSURANCE',
        caseSensitive: false
      },
      {
        field: 'type',
        operator: 'equals',
        value: 'debit'
      }
    ],
    action: {
      accountId: '5040', // Example: Placeholder for Insurance Expense
      isDebit: true,
      description: 'Insurance Payment'
    }
  }
];

/**
 * Load default rules.
 * @returns A shallow copy of the default rules array.
 */
export function getDefaultRules(): Rule[] {
  return [...defaultRules]; // Return a copy to prevent modification of the original
}

// Define a more specific type for the input conditions for createCustomRule
export type CustomRuleConditionInput = {
  field: string;
  operator: RuleCondition['operator']; // Use the operator type from RuleCondition
  value?: any; // Value is optional for some operators like 'isDefined'
  caseSensitive?: boolean;
};

/**
 * Create a custom rule.
 * @param name - Human-readable name for the rule.
 * @param description - Detailed description of the rule.
 * @param conditions - Array of conditions for the rule.
 * @param accountId - The account ID for the rule's action.
 * @param isDebit - Whether the action results in a debit.
 * @returns A new Rule object.
 */
export function createCustomRule(
  name: string,
  customRuleDescription: string, // Renamed to avoid conflict with Rule.description
  conditions: CustomRuleConditionInput[],
  accountId: string,
  isDebit: boolean,
  entityId?: string, // Optional entityId for the custom rule
  priority: number = 50 // Allow custom priority, default to 50
): Rule {
  return {
    id: crypto.randomUUID(),
    name,
    description: customRuleDescription,
    isActive: true, // New rules are active by default
    priority,        // Use provided priority or default
    entityId,        // Assign entityId if provided
    conditions: conditions.map(c => ({
      field: c.field,
      operator: c.operator, // Now correctly typed
      value: c.value,
      caseSensitive: c.caseSensitive === undefined ? false : c.caseSensitive, // Default caseSensitive to false
    })),
    action: {
      accountId,
      isDebit,
      description: name // Action description defaults to the rule name
    }
  };
}
