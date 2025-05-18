// src/lib/accounting/account.ts

// Assuming AccountType and ExpenseSubtype are defined in your main application types
// and are compatible with how they are used here.
// If these are specific to the core engine and differ, they should be defined here or imported from a core-specific types file.
import type { AccountSystemType as AccountType } from '@db/schema';
import type { ExpenseSubtype } from '../../types/account';
import Decimal from 'decimal.js';

/**
 * Defines the data required to create or define an account for the in-memory ledger.
 * This often corresponds to a record from a Chart of Accounts definition.
 */
export interface AccountDefinition {
  /** Unique identifier for this account (e.g., UUID from DbChartOfAccount.id). */
  id: string;
  /** Standardized account code (e.g., "1010" for Cash). */
  code: string;
  /** Human-readable name for the account (e.g., “Operating Cash Account”). */
  name: string;
  /** The fundamental type of the account. */
  type: AccountType; // Using AccountSystemType from schema as AccountType
  /**
   * Further classification, e.g., for expenses indicating recoverability.
   * Can use ExpenseSubtype for type safety or allow other strings.
   */
  subtype?: ExpenseSubtype | string | null; // subtype in DbChartOfAccount is string | null
  /** A brief explanation of what the account is used for. */
  description?: string | null;
  /** Whether the account is currently active and can be used in transactions. */
  isActive: boolean; // Derived from DbChartOfAccount.is_active (0 or 1)
  /**
   * The ID of the parent account, for hierarchical chart of accounts.
   * If using codes for hierarchy, this might be `parentCode`.
   * For the in-memory ledger, this is informational unless ledger explicitly builds trees.
   */
  parentAccountId?: string | null; // From DbChartOfAccount.parent_id
  /**
   * Explicitly defines the normal balance side of the account.
   * Crucial for correctly handling contra accounts (e.g., Accumulated Depreciation, Owner's Draws).
   */
  normalBalance: 'debit' | 'credit';
   /**
   * Optional flag indicating if this is a control account.
   * Control accounts (e.g., Accounts Receivable) typically have their balances
   * detailed in a subsidiary ledger.
   */
  isControlAccount?: boolean;
  /**
   * For expense accounts, explicitly marks if it is recoverable.
   * Derived from DbChartOfAccount.is_recoverable.
   */
  isRecoverable?: boolean;
}

export class Account {
  public readonly id: string;
  public readonly code: string;
  public name: string;
  public readonly type: AccountType;
  public subtype?: ExpenseSubtype | string | null;
  public description?: string | null;
  public isActive: boolean;
  public readonly parentAccountId?: string | null;
  public readonly normalBalance: 'debit' | 'credit';
  public readonly isControlAccount?: boolean;
  public readonly isRecoverable?: boolean;

  private _balance: Decimal;

  constructor(definition: AccountDefinition) {
    this.id = definition.id;
    this.code = definition.code;
    this.name = definition.name;
    this.type = definition.type;
    this.subtype = definition.subtype;
    this.description = definition.description;
    this.isActive = definition.isActive;
    this.parentAccountId = definition.parentAccountId;
    
    if (!definition.normalBalance) {
        // Attempt to derive normalBalance if not explicitly provided, though explicit is better.
        // This derivation is a common accounting rule.
        switch (definition.type) {
            case 'asset':
            case 'expense':
                this.normalBalance = 'debit';
                break;
            case 'liability':
            case 'equity':
            case 'income':
                this.normalBalance = 'credit';
                break;
            default:
                // Fallback or throw error if type is unknown and normalBalance isn't set
                console.warn(`Account ${definition.code} (${definition.name}) has unknown type '${definition.type}' and no explicit normalBalance. Defaulting to debit.`);
                this.normalBalance = 'debit'; 
        }
    } else {
        this.normalBalance = definition.normalBalance;
    }
    
    this.isControlAccount = definition.isControlAccount ?? false;
    this.isRecoverable = definition.isRecoverable ?? false;

    this._balance = new Decimal(0); // All accounts start with a zero balance in the ledger
  }

  /**
   * Gets the current balance of the account.
   * @returns {number} The balance as a standard number.
   */
  get balance(): number {
    return this._balance.toNumber();
  }

  /**
   * Gets the current balance of the account as a Decimal instance for precise calculations.
   * @returns {Decimal} The balance as a Decimal object.
   */
  get balanceDecimal(): Decimal {
    return this._balance;
  }

  /**
   * Determines if this account normally has a debit balance.
   * This relies on the explicitly set `normalBalance` property.
   * @returns {boolean} True if the account normally has a debit balance.
   */
  isDebitNormal(): boolean {
    return this.normalBalance === 'debit';
  }

  /**
   * Determines if this account normally has a credit balance.
   * This relies on the explicitly set `normalBalance` property.
   * @returns {boolean} True if the account normally has a credit balance.
   */
  isCreditNormal(): boolean {
    return this.normalBalance === 'credit';
  }

  /**
   * Applies a transaction amount to the account's balance.
   * Uses Decimal.js for precision.
   * @param {number} amount - The monetary value of the transaction line (should be positive).
   * @param {boolean} isDebit - True if the transaction line is a debit, false if it's a credit.
   * @throws {Error} If the account is not active.
   */
  applyTransaction(amount: number, isDebit: boolean): void {
    if (!this.isActive) {
      throw new Error(`Account [${this.code}] "${this.name}" is not active. Cannot apply transaction.`);
    }
    if (amount < 0) {
        // Ensure amount is always positive, direction is handled by isDebit
        console.warn(`Transaction amount for account ${this.code} was negative (${amount}). Using absolute value.`);
        amount = Math.abs(amount);
    }

    const decimalAmount = new Decimal(amount);

    if (this.isDebitNormal()) {
      // For debit-normal accounts (Assets, Expenses, Owner's Draws/Dividends):
      // Debits increase the balance, Credits decrease the balance.
      this._balance = isDebit ? this._balance.plus(decimalAmount) : this._balance.minus(decimalAmount);
    } else {
      // For credit-normal accounts (Liabilities, Equity, Income, Contra-Assets like Acc. Dep.):
      // Credits increase the balance, Debits decrease the balance.
      this._balance = isDebit ? this._balance.minus(decimalAmount) : this._balance.plus(decimalAmount);
    }
  }

  /**
   * Resets the balance of the account to zero.
   * Useful for testing or specific ledger operations.
   */
  resetBalance(): void {
    this._balance = new Decimal(0);
  }
}
