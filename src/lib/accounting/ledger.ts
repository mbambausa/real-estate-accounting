// src/lib/accounting/ledger.ts

import { Account } from './account';
// Use the same AccountType definition as used in the Account class for consistency
import type { AccountSystemType as AccountType } from '@db/schema.ts'; // Or from where Account.type is defined
import { Journal } from './journal';
import { Transaction } from './transaction';
import Decimal from 'decimal.js';

export class Ledger {
  /** The owning entity’s identifier */
  private readonly entityId: string;

  /** Map of accountId (Account.id - UUID) → Account instance */
  private accounts: Map<string, Account> = new Map();

  /** Map of journalId (Journal.id - UUID) → Journal instance */
  private journals: Map<string, Journal> = new Map();

  /** * All transactions that have been successfully recorded and have affected account balances.
   * These are the transactions that constitute the general ledger for this entity.
   */
  private recordedTransactions: Transaction[] = [];

  /**
   * Initializes a new ledger for a single entity.
   * @param {string} entityId - Identifier of the entity this ledger belongs to.
   * @throws {Error} If entityId is not provided.
   */
  constructor(entityId: string) {
    if (!entityId) {
      throw new Error("Ledger requires an entityId for initialization.");
    }
    this.entityId = entityId;
  }

  /**
   * Returns the entity ID this ledger belongs to.
   * @returns {string} The entity ID.
   */
  public getEntityId(): string {
    return this.entityId;
  }

  /**
   * Adds an account to this ledger's chart of accounts.
   * The account should be an instance of the Account class.
   * @param {Account} account - The account to register.
   * @throws {Error} If an account with the same ID already exists or if the account is not active.
   */
  public addAccount(account: Account): void {
    if (!account || !account.id) {
        throw new Error("Invalid account provided to addAccount.");
    }
    if (this.accounts.has(account.id)) {
      throw new Error(`Ledger: Account with ID [${account.id}] already exists.`);
    }
    // Optionally, only allow adding active accounts to the ledger's CoA
    // if (!account.isActive) {
    //   throw new Error(`Ledger: Cannot add inactive account [${account.id}] - "${account.name}" to the ledger.`);
    // }
    this.accounts.set(account.id, account);
  }

  /**
   * Retrieves an account by its ID from the ledger's chart of accounts.
   * @param {string} accountId - The ID of the account to retrieve.
   * @returns {Account | undefined} The Account object if found, otherwise undefined.
   */
  public getAccount(accountId: string): Account | undefined {
    return this.accounts.get(accountId);
  }

  /**
   * Lists all accounts registered on this ledger.
   * @returns {Account[]} An array of all Account objects.
   */
  public getAllAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Lists accounts filtered by type (e.g. 'asset', 'expense').
   * @param {AccountType} type - The AccountType (AccountSystemType) to filter by.
   * @returns {Account[]} An array of Account objects matching the specified type.
   */
  public getAccountsByType(type: AccountType): Account[] {
    return this.getAllAccounts().filter(account => account.type === type);
  }

  /**
   * Adds a journal to this ledger.
   * Journals are collections of transactions (e.g., General Journal, Sales Journal).
   * @param {Journal} journal - The Journal object to add.
   * @throws {Error} If the journal's entityId does not match the ledger's entityId.
   * @throws {Error} If a journal with the same ID already exists.
   */
  public addJournal(journal: Journal): void {
    if (!journal || !journal.id) {
        throw new Error("Invalid journal provided to addJournal.");
    }
    if (journal.entityId !== this.entityId) {
        throw new Error(`Journal [${journal.id}] for entity [${journal.entityId}] cannot be added to ledger for entity [${this.entityId}].`);
    }
    if (this.journals.has(journal.id)) {
      throw new Error(`Ledger: Journal with ID [${journal.id}] already exists.`);
    }
    this.journals.set(journal.id, journal);
  }

  /**
   * Retrieves a journal by its ID.
   * @param {string} journalId - The ID of the journal to retrieve.
   * @returns {Journal | undefined} The Journal object if found, otherwise undefined.
   */
  public getJournal(journalId: string): Journal | undefined {
    return this.journals.get(journalId);
  }

  /**
   * Records a transaction in the ledger.
   * The transaction must:
   * 1. Belong to this ledger’s entity.
   * 2. Be balanced (debits equal credits).
   * 3. Be in 'posted' state.
   * 4. Not already be recorded in this ledger (by ID).
   * 5. All its lines must refer to accounts existing and active in this ledger.
   * If successful, it applies the transaction lines to the respective account balances.
   * @param {Transaction} transaction - The Transaction object to record.
   * @returns {boolean} True if the transaction was successfully recorded and applied; false otherwise.
   * @throws {Error} If transaction is null or undefined.
   */
  public recordTransaction(transaction: Transaction): boolean {
    if (!transaction || !transaction.id) {
        throw new Error("Invalid transaction provided to recordTransaction.");
    }
    // 1. Check entity ID
    if (transaction.entityId !== this.entityId) {
      console.warn(`Ledger (Entity: ${this.entityId}): Transaction [${transaction.id}] for entity [${transaction.entityId}] rejected.`);
      return false;
    }

    // 2. Check if transaction is balanced
    if (!transaction.isBalanced()) {
      console.warn(`Ledger (Entity: ${this.entityId}): Transaction [${transaction.id}] is not balanced. Rejected.`);
      return false;
    }
    
    // 3. Check if transaction status allows recording (must be 'posted')
    if (transaction.status !== 'posted') {
      console.warn(`Ledger (Entity: ${this.entityId}): Transaction [${transaction.id}] has status '${transaction.status}'. Only 'posted' transactions can be recorded in the ledger. Rejected.`);
      return false;
    }

    // 4. Check for duplicate transaction ID in this ledger
    if (this.recordedTransactions.some(rt => rt.id === transaction.id)) {
        console.warn(`Ledger (Entity: ${this.entityId}): Transaction [${transaction.id}] has already been recorded. Rejected.`);
        return false;
    }

    // 5. Verify all accounts in transaction lines exist and are active in this ledger
    for (const line of transaction.lines) {
      const account = this.accounts.get(line.accountId);
      if (!account) {
        console.warn(`Ledger (Entity: ${this.entityId}): Account [${line.accountId}] in transaction [${transaction.id}] not found in ledger. Rejected.`);
        return false;
      }
      if (!account.isActive) {
        console.warn(`Ledger (Entity: ${this.entityId}): Account [${line.accountId}] - "${account.name}" in transaction [${transaction.id}] is inactive. Rejected.`);
        return false;
      }
    }

    // All checks passed, apply each line to its account
    transaction.lines.forEach(line => {
      const account = this.getAccount(line.accountId)!; // Existence and activity checked above
      account.applyTransaction(line.amount, line.isDebit);
    });

    // Add to the ledger's list of recorded transactions
    this.recordedTransactions.push(transaction);
    return true;
  }

  /**
   * Gets all transactions recorded in this ledger.
   * @returns {Transaction[]} An array of all recorded Transaction objects.
   */
  public getAllRecordedTransactions(): Transaction[] {
    return this.recordedTransactions;
  }

  /**
   * Gets all recorded transactions affecting a specific account.
   * @param {string} accountId - The ID of the account.
   * @returns {Transaction[]} An array of Transaction objects.
   */
  public getRecordedTransactionsForAccount(accountId: string): Transaction[] {
    return this.recordedTransactions.filter(tx =>
      tx.lines.some(line => line.accountId === accountId)
    );
  }

  /**
   * Returns the current balance of a given account in this ledger.
   * @param {string} accountId - The ID of the account.
   * @returns {number} The balance of the account, or 0 if the account is not found.
   */
  public getAccountBalance(accountId: string): number {
    const account = this.getAccount(accountId);
    return account ? account.balance : 0; // account.balance is a number getter
  }

  /**
   * Generates a trial balance for the current state of the ledger.
   * A trial balance lists all accounts and their debit or credit balances.
   * The total debits should equal total credits.
   * @returns {Array<{ accountId: string; accountCode: string; accountName: string; debit: number; credit: number; }>} 
   * An array of objects, each representing an account's trial balance line.
   */
  public generateTrialBalance(): Array<{
    accountId: string;    // Account UUID
    accountCode: string;  // User-facing account code
    accountName: string;
    debit: number;
    credit: number;
  }> {
    const trialBalanceLines = this.getAllAccounts().map(account => {
      const balance = account.balanceDecimal; // Use Decimal for precision before final conversion
      let debitAmount = new Decimal(0);
      let creditAmount = new Decimal(0);

      if (account.isDebitNormal()) { // Typically Assets, Expenses, Draws
        if (balance.isPositive() || balance.isZero()) {
          debitAmount = balance;
        } else { // Negative balance for a debit-normal account means it has a credit balance (abnormal)
          creditAmount = balance.abs();
        }
      } else { // Credit Normal (Liabilities, Equity, Income, Contra-Assets)
        if (balance.isPositive() || balance.isZero()) {
          // For credit normal accounts, a positive balance on our internal Decimal representation
          // (where credits might be added as positive) means it's a credit balance.
          creditAmount = balance;
        } else { // Negative balance for a credit-normal account means it has a debit balance (abnormal)
          debitAmount = balance.abs();
        }
      }

      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        debit: debitAmount.toNumber(),
        credit: creditAmount.toNumber(),
      };
    });
    
    // Optional: Verify trial balance totals
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);
    trialBalanceLines.forEach(line => {
      totalDebits = totalDebits.plus(line.debit);
      totalCredits = totalCredits.plus(line.credit);
    });

    if (!totalDebits.equals(totalCredits)) {
      console.warn(`Ledger (Entity: ${this.entityId}): Trial Balance is out of balance! Debits: ${totalDebits.toString()}, Credits: ${totalCredits.toString()}`);
      // Depending on strictness, you might throw an error here or return a flag.
    }

    return trialBalanceLines;
  }
}