// src/lib/accounting/core/ledger.ts

import { Account } from './account';
// Import AccountType as a type
import type { AccountType } from '../../../types/account'; // Assuming AccountType is exported from here
import { Journal } from './journal';
import { Transaction } from './transaction';

export class Ledger {
  /** The owning entity’s identifier */
  private entityId: string;

  /** Map of accountId → Account */
  private accounts: Map<string, Account> = new Map();

  /** Map of journalId → Journal */
  private journals: Map<string, Journal> = new Map();

  /** All recorded transactions for this ledger */
  private transactions: Transaction[] = [];

  /**
   * Initialize a new ledger for a single entity.
   * @param entityId  Identifier of the entity (e.g. company or department)
   */
  constructor(entityId: string) {
    this.entityId = entityId;
  }

  /**
   * Returns the entity ID this ledger belongs to.
   */
  getEntityId(): string {
    return this.entityId;
  }

  /**
   * Add an account to this ledger.
   * @param account  The account to register
   */
  addAccount(account: Account): void {
    if (this.accounts.has(account.id)) {
      console.warn(`Ledger: Account with ID [${account.id}] already exists. Overwriting.`);
    }
    this.accounts.set(account.id, account);
  }

  /**
   * Retrieve an account by its ID.
   * @param accountId The ID of the account to retrieve.
   * @returns The Account object if found, otherwise undefined.
   */
  getAccount(accountId: string): Account | undefined {
    return this.accounts.get(accountId);
  }

  /**
   * List all accounts registered on this ledger.
   * @returns An array of all Account objects.
   */
  getAllAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }

  /**
   * List accounts filtered by type (e.g. 'asset', 'expense').
   * @param type The AccountType to filter by.
   * @returns An array of Account objects matching the specified type.
   */
  getAccountsByType(type: AccountType): Account[] { // Correctly typed parameter
    return this.getAllAccounts().filter(account => account.type === type);
  }

  /**
   * Add a journal to this ledger.
   * @param journal The Journal object to add.
   */
  addJournal(journal: Journal): void {
    if (this.journals.has(journal.id)) {
      console.warn(`Ledger: Journal with ID [${journal.id}] already exists. Overwriting.`);
    }
    this.journals.set(journal.id, journal);
  }

  /**
   * Retrieve a journal by its ID.
   * @param journalId The ID of the journal to retrieve.
   * @returns The Journal object if found, otherwise undefined.
   */
  getJournal(journalId: string): Journal | undefined {
    return this.journals.get(journalId);
  }

  /**
   * Record a transaction.
   * The transaction must belong to this ledger’s entity, be balanced,
   * and all its lines must refer to existing accounts in this ledger.
   * If successful, it applies the transaction lines to the respective accounts.
   * @param transaction The Transaction object to record.
   * @returns true if the transaction was successfully recorded and applied; false otherwise.
   */
  recordTransaction(transaction: Transaction): boolean {
    // Reject transactions for other entities
    if (transaction.entityId !== this.entityId) {
      console.warn(`Ledger: Transaction [${transaction.id}] entity [${transaction.entityId}] does not match ledger entity [${this.entityId}]. Transaction rejected.`);
      return false;
    }

    // Ensure debits = credits
    if (!transaction.isBalanced()) {
      console.warn(`Ledger: Transaction [${transaction.id}] is not balanced. Transaction rejected.`);
      return false;
    }

    // Verify all accounts in transaction lines exist in this ledger
    for (const line of transaction.lines) {
      if (!this.accounts.has(line.accountId)) {
        console.warn(`Ledger: Account [${line.accountId}] in transaction [${transaction.id}] not found in ledger. Transaction rejected.`);
        return false;
      }
    }

    // Apply each line to its account
    // This loop is now safe because we've checked all accounts exist.
    transaction.lines.forEach(line => {
      const account = this.getAccount(line.accountId)!; // '!' is safe due to the check above
      account.applyTransaction(line.amount, line.isDebit);
    });

    // Persist the transaction
    this.transactions.push(transaction);
    // console.log(`Ledger: Transaction [${transaction.id}] recorded successfully for entity [${this.entityId}].`);
    return true;
  }

  /**
   * Get all transactions recorded on this ledger.
   * @returns An array of all Transaction objects.
   */
  getAllTransactions(): Transaction[] {
    return this.transactions;
  }

  /**
   * Get all transactions affecting a specific account.
   * @param accountId The ID of the account.
   * @returns An array of Transaction objects that include a line affecting the specified account.
   */
  getTransactionsForAccount(accountId: string): Transaction[] {
    return this.transactions.filter(tx =>
      tx.lines.some(line => line.accountId === accountId)
    );
  }

  /**
   * Returns the current balance of the given account.
   * @param accountId The ID of the account.
   * @returns The balance of the account, or 0 if the account is not found.
   */
  getAccountBalance(accountId: string): number {
    const account = this.getAccount(accountId);
    return account ? account.balance : 0;
  }

  /**
   * Generate a trial balance.
   * A trial balance lists all accounts and their debit or credit balances.
   * The total debits should equal total credits.
   * This implementation assumes account.balance reflects the net value,
   * and account.isDebitNormal() or account.isCreditNormal() determines its typical side.
   * Abnormal balances (e.g., an asset with a credit balance) will be shown accordingly.
   * @returns An array of objects, each representing an account's trial balance line.
   */
  generateTrialBalance(): Array<{
    accountId: string;
    accountName: string;
    debit: number;
    credit: number;
  }> {
    return this.getAllAccounts().map(account => {
      const balance = account.balance; // This is the net balance from the Account object
      let debitAmount = 0;
      let creditAmount = 0;

      if (account.isDebitNormal()) { // Typically Assets, Expenses
        if (balance >= 0) {
          debitAmount = balance;
        } else {
          // Abnormal balance for a debit-normal account (e.g., Asset with a credit balance)
          creditAmount = Math.abs(balance);
        }
      } else if (account.isCreditNormal()) { // Typically Liabilities, Equity, Income
        if (balance >= 0) {
          // Assuming positive balance here means a natural credit balance for these types
          creditAmount = balance;
        } else {
          // Abnormal balance for a credit-normal account (e.g., Liability with a debit balance)
          debitAmount = Math.abs(balance);
        }
      } else {
        // Should not happen if all accounts have a defined normal balance side (debit or credit)
        // If balance is non-zero and type is unknown how to classify, log or place based on sign.
        if (balance > 0) debitAmount = balance;
        if (balance < 0) creditAmount = Math.abs(balance);
         console.warn(`Account [${account.id}] - ${account.name} has an indeterminate normal balance type for trial balance.`);
      }

      return {
        accountId: account.id,
        accountName: account.name,
        debit: debitAmount,
        credit: creditAmount,
      };
    });
  }
}
