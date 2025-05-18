// src/lib/rules/engine.ts
import type { Transaction, TransactionLine } from '@accounting/transaction'; // Using path alias for robustness

export interface RuleCondition {
  field: string; // Path to the field in the transaction object (e.g., "description", "amount", "metadata.category")
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'greaterThan' | 'lessThan' | 'isTrue' | 'isFalse' | 'isDefined' | 'isNotDefined';
  value?: any; // Value to compare against (not needed for isTrue, isFalse, isDefined, isNotDefined)
  caseSensitive?: boolean; // For string operations
}

export interface RuleAction {
  accountId: string; // The account ID to use for the categorized line
  isDebit: boolean;  // Whether the categorized line is a debit
  description?: string; // Optional description for the categorized line
  metadata?: Record<string, any>; // Optional metadata for the categorized line
  // Future: could include split percentages, multiple lines, etc.
}

export interface Rule {
  id: string;
  name: string;
  description?: string;
  entityId?: string; // If undefined, the rule is global (applies to all entities)
  isActive: boolean;
  priority: number; // Higher numbers typically mean higher priority
  conditions: RuleCondition[]; // Conditions are ANDed
  action: RuleAction;
}

/**
 * Represents a simplified version of an incoming item to be categorized,
 * like a line from a bank statement.
 */
export interface CategorizableItem {
  id: string; // Original ID of the item, if any
  date: Date;
  description: string;
  amount: number; // The single amount of the item (e.g., bank withdrawal is positive, deposit is positive)
  type: 'debit' | 'credit'; // Indicates if the bank item was a debit (money out) or credit (money in) to the bank account
  entityId: string;
  metadata?: Record<string, any>;
  // Potentially other fields like original_payee, bank_transaction_id etc.
}


export class RuleEngine {
  private rules: Rule[];

  constructor(rules: Rule[] = []) {
    // Store a copy and sort by priority immediately for efficiency if ruleset is static or changes infrequently
    // If rules are added/removed often, sorting might be better done in findMatchingRule
    this.rules = [...rules].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Add a rule to the engine. Rules will be re-sorted.
   */
  addRule(rule: Rule): void {
    // Prevent duplicate rule IDs
    if (this.rules.some(r => r.id === rule.id)) {
        console.warn(`RuleEngine: Rule with ID [${rule.id}] already exists. Not adding.`);
        return;
    }
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority); // Re-sort
  }

  /**
   * Remove a rule by ID
   */
  removeRule(ruleId: string): boolean {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter(rule => rule.id !== ruleId);
    // No need to re-sort if only removing
    return this.rules.length !== initialLength;
  }

  /**
   * Get all rules, sorted by priority.
   */
  getAllRules(): Rule[] {
    return [...this.rules]; // Return a copy
  }

  /**
   * Get active rules applicable to a specific entity, sorted by priority.
   * Global rules (no entityId) are included.
   */
  getRulesForEntity(entityId: string): Rule[] {
    return this.rules.filter(rule =>
      rule.isActive && (!rule.entityId || rule.entityId === entityId)
    );
    // Note: this.rules is already sorted by priority
  }

  /**
   * Evaluates a single condition against a given value.
   */
  private evaluateCondition(condition: RuleCondition, value: any): boolean {
    const { operator, value: expectedValue, caseSensitive = false } = condition;

    switch (operator) {
      case 'isDefined':
        return value !== undefined && value !== null;
      case 'isNotDefined':
        return value === undefined || value === null;
      case 'isTrue':
        return value === true;
      case 'isFalse':
        return value === false;
    }

    // For operators requiring an expectedValue, if the actual value is undefined/null,
    // it generally shouldn't match unless expectedValue is also undefined/null (for 'equals').
    if (value === undefined || value === null) {
      return operator === 'equals' && (expectedValue === undefined || expectedValue === null);
    }

    if (typeof value === 'string' && (typeof expectedValue === 'string' || expectedValue instanceof RegExp)) {
      const strValue = caseSensitive ? value : value.toLowerCase();
      const strExpected = (typeof expectedValue === 'string' && !caseSensitive) ? expectedValue.toLowerCase() : expectedValue;

      switch (operator) {
        case 'equals':
          return strValue === strExpected;
        case 'contains':
          return typeof strExpected === 'string' && strValue.includes(strExpected);
        case 'startsWith':
          return typeof strExpected === 'string' && strValue.startsWith(strExpected);
        case 'endsWith':
          return typeof strExpected === 'string' && strValue.endsWith(strExpected);
        case 'regex':
          // For regex, 'value' is the original string, 'expectedValue' is the pattern string
          try {
            return new RegExp(expectedValue as string, caseSensitive ? '' : 'i').test(value);
          } catch (e) {
            console.warn(`RuleEngine: Invalid regex pattern "${expectedValue}" in rule condition.`, e);
            return false;
          }
        default:
          // If operator is numeric but types are string, try to convert, or return false
          if (['greaterThan', 'lessThan'].includes(operator) && typeof expectedValue === 'number') {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                return this.evaluateCondition(condition, numValue); // Recurse with numeric value
            }
          }
          return false; // Operator not applicable to string or type mismatch
      }
    }

    if (typeof value === 'number' && typeof expectedValue === 'number') {
      switch (operator) {
        case 'equals':
          return value === expectedValue;
        case 'greaterThan':
          return value > expectedValue;
        case 'lessThan':
          return value < expectedValue;
        default:
          return false; // Operator not applicable to number
      }
    }
    
    if (typeof value === 'boolean' && typeof expectedValue === 'boolean' && operator === 'equals') {
        return value === expectedValue;
    }

    // Default comparison for other types if operator is 'equals'
    if (operator === 'equals') {
        return value === expectedValue;
    }

    console.warn(`RuleEngine: Could not evaluate condition for operator "${operator}" with value type "${typeof value}" and expected type "${typeof expectedValue}".`);
    return false;
  }

  /**
   * Finds the highest priority active rule that matches the given item.
   * @param item The item to be categorized (e.g., a bank transaction feed item).
   * @returns The matching Rule object or null if no rule matches.
   */
  findMatchingRule(item: CategorizableItem): Rule | null {
    const applicableRules = this.rules.filter(rule =>
        rule.isActive && (!rule.entityId || rule.entityId === item.entityId)
      );
    // this.rules is already sorted by priority in constructor/addRule

    for (const rule of applicableRules) {
      let allConditionsMet = true;
      if (rule.conditions.length === 0) { // Rule with no conditions always matches
        allConditionsMet = true;
      } else {
        for (const condition of rule.conditions) {
          const { field } = condition;
          // Access value from the item. Handles dot notation for nested properties.
          const valueToTest = field.includes('.')
            ? this.getNestedValue(item, field)
            : (item as any)[field];

          if (!this.evaluateCondition(condition, valueToTest)) {
            allConditionsMet = false;
            break; // No need to check other conditions for this rule
          }
        }
      }

      if (allConditionsMet) {
        return rule; // Return the first matching rule (due to priority sort)
      }
    }
    return null; // No rule matched
  }

  /**
   * Applies a matching rule to a categorizable item and returns the details
   * for one side of the accounting transaction.
   * This method DOES NOT create the full double-entry transaction.
   * It suggests the categorization for the "other" side of an entry
   * (e.g., if item is a bank withdrawal, this provides the expense line).
   *
   * @param item The item to be categorized.
   * @returns An object representing the transaction line to be created, or null if no rule applies.
   */
  getRuleApplicationResult(item: CategorizableItem): (Omit<TransactionLine, 'id' | 'transaction_id' | 'created_at' | 'updated_at'> & { ruleId: string }) | null {
    const rule = this.findMatchingRule(item);

    if (!rule) {
      return null;
    }

    const { accountId, isDebit, description: ruleActionDescription, metadata } = rule.action;
    
    // The amount for the categorized line is the amount of the bank item.
    // The `isDebit` from the rule action determines if this categorized line is a debit or credit.
    // Example:
    // Bank item: Withdrawal (debit to bank) of $50 for "OFFICE DEPOT"
    // Rule matches "OFFICE DEPOT", action: { accountId: 'office-supplies', isDebit: true }
    // This means the 'office-supplies' account should be debited by $50.
    // The corresponding credit to the bank account needs to be handled by the calling service.

    return {
      accountId: accountId,
      amount: item.amount, // Use the amount from the categorizable item
      isDebit: isDebit,
      description: ruleActionDescription || item.description, // Use rule's desc, fallback to item's
      metadata: metadata,
      ruleId: rule.id // Include the ID of the rule that matched
    };
  }


  /**
   * Gets a value from an object using a dot-separated path string.
   * @param obj The object to traverse.
   * @param path The dot-separated path (e.g., "metadata.category.name").
   * @returns The value at the path, or undefined if the path is not found.
   */
  private getNestedValue(obj: any, path: string): any {
    if (!path) return undefined;
    return path.split('.').reduce((current, key) => {
      return (current && typeof current === 'object' && key in current) ? current[key] : undefined;
    }, obj);
  }
}