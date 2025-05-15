// src/lib/accounting/core/account.ts

// Use 'import type' for types
import type { AccountType, ExpenseSubtype } from '../../../types/account'; // Adjusted for a typical structure
import Decimal from 'decimal.js';

/**
 * Defines the data required to create or define an account.
 * This often corresponds to a record from a Chart of Accounts definition.
 */
export interface AccountDefinition {
  /** Unique identifier for this account (e.g., UUID). */
  id: string;
  /** Standardized account code (e.g., "1010" for Cash). */
  code: string;
  /** Human-readable name for the account (e.g., “Operating Cash Account”). */
  name: string;
  /** The fundamental type of the account. */
  type: AccountType;
  /**
   * Further classification, e.g., for expenses indicating recoverability.
   * Can use ExpenseSubtype for type safety or allow other strings.
   */
  subtype?: ExpenseSubtype | string;
  /** A brief explanation of what the account is used for. */
  description?: string;
  /** Whether the account is currently active and can be used in transactions. */
  isActive: boolean;
  /**
   * The ID of the parent account, for hierarchical chart of accounts.
   * If using codes for hierarchy, this might be `parentCode`.
   */
  parentAccountId?: string;
  /**
   * Explicitly defines the normal balance side of the account.
   * Crucial for correctly handling contra accounts (e.g., Accumulated Depreciation, Owner's Draws).
   */
  normalBalance: 'debit' | 'credit'; // Made non-optional for clarity
   /**
   * Optional flag indicating if this is a control account.
   * Control accounts (e.g., Accounts Receivable) typically have their balances
   * detailed in a subsidiary ledger.
   */
  isControlAccount?: boolean;
  /**
   * For expense accounts, explicitly marks if it is recoverable.
   */
  isRecoverable?: boolean; // Specific to expense accounts, aligns with ChartOfAccountsItem
}

export class Account {
  public readonly id: string;
  public readonly code: string;
  public name: string;
  public readonly type: AccountType;
  public subtype?: ExpenseSubtype | string;
  public description?: string;
  public isActive: boolean;
  public readonly parentAccountId?: string;
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
    this.normalBalance = definition.normalBalance; // Ensure this is provided
    this.isControlAccount = definition.isControlAccount;
    this.isRecoverable = definition.isRecoverable;

    this._balance = new Decimal(0);
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

    const decimalAmount = new Decimal(amount);

    if (this.isDebitNormal()) {
      // For debit-normal accounts (Assets, Expenses, Drawings):
      // Debits increase the balance, Credits decrease the balance.
      this._balance = isDebit ? this._balance.plus(decimalAmount) : this._balance.minus(decimalAmount);
    } else {
      // For credit-normal accounts (Liabilities, Equity, Income, Contra-Assets like Acc. Dep.):
      // Credits increase the balance, Debits decrease the balance.
      this._balance = isDebit ? this._balance.minus(decimalAmount) : this._balance.plus(decimalAmount);
    }
  }
}
