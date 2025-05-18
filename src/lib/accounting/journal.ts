// src/lib/accounting/journal.ts
import { Transaction } from './transaction'; // Assumes Transaction class from core_transaction_ts_v2
import Decimal from 'decimal.js';

export interface JournalDefinition {
  /** Unique identifier for the journal (e.g., UUID). */
  id: string;
  /** Name of the journal (e.g., "General Journal", "Sales Journal"). */
  name: string;
  /** Optional description of the journal's purpose. */
  description?: string;
  /** Identifier of the entity this journal belongs to. */
  entityId: string;
}

export class Journal {
  public readonly id: string;
  public name: string;
  public description?: string;
  public readonly entityId: string;
  /** Array of transactions recorded in this journal. */
  public transactions: Transaction[] = [];

  /**
   * Creates an instance of a Journal.
   * @param {JournalDefinition} definition - The data to define the journal.
   * @throws {Error} If required definition fields (id, name, entityId) are missing.
   */
  constructor(definition: JournalDefinition) {
    if (!definition.id) throw new Error("Journal ID is required.");
    if (!definition.name?.trim()) throw new Error("Journal name is required.");
    if (!definition.entityId) throw new Error("Journal entityId is required.");
    
    this.id = definition.id;
    this.name = definition.name;
    this.description = definition.description;
    this.entityId = definition.entityId;
  }

  /**
   * Adds a transaction to the journal.
   * The transaction must belong to this journal's entity, be balanced,
   * and not already exist in this journal by ID.
   * @param {Transaction} transaction - The Transaction object to add.
   * @returns {boolean} True if the transaction was successfully added; false otherwise.
   */
  addTransaction(transaction: Transaction): boolean {
    // Ensure transaction is for the same entity
    if (transaction.entityId !== this.entityId) {
      console.warn(`Journal [${this.name}/${this.id}]: Transaction [${transaction.id}] entity [${transaction.entityId}] does not match journal entity [${this.entityId}]. Transaction not added.`);
      return false;
    }

    // Ensure transaction is balanced (delegating this check to the Transaction object itself)
    if (!transaction.isBalanced()) {
      console.warn(`Journal [${this.name}/${this.id}]: Transaction [${transaction.id}] is not balanced. Transaction not added.`);
      return false;
    }

    // Optionally, only allow adding transactions that are at least 'draft' or 'posted'
    // This depends on workflow: if journal is just a collection, any status might be fine.
    // If journal implies a step towards posting, then status matters.
    // if (transaction.status === 'void') {
    //   console.warn(`Journal [${this.name}/${this.id}]: Cannot add a 'void' transaction [${transaction.id}]. Transaction not added.`);
    //   return false;
    // }


    // Check if transaction (by ID) is already in this journal to prevent duplicates
    if (this.transactions.some(t => t.id === transaction.id)) {
        console.warn(`Journal [${this.name}/${this.id}]: Transaction [${transaction.id}] already exists in this journal. Transaction not added again.`);
        return false;
    }

    this.transactions.push(transaction);
    return true;
  }

  /**
   * Removes a transaction from the journal by its ID.
   * @param {string} transactionId - The ID of the transaction to remove.
   * @returns {boolean} True if a transaction was removed; false otherwise.
   */
  removeTransaction(transactionId: string): boolean {
    const initialLength = this.transactions.length;
    this.transactions = this.transactions.filter(t => t.id !== transactionId);
    return this.transactions.length < initialLength;
  }

  /**
   * Gets all transactions currently in the journal.
   * @returns {Transaction[]} An array of Transaction objects.
   */
  getAllTransactions(): Transaction[] {
    return this.transactions;
  }

  /**
   * Gets transactions within a specific date range (inclusive of start and end day).
   * @param {Date} startDate - The start date of the range.
   * @param {Date} endDate - The end date of the range.
   * @returns {Transaction[]} An array of Transaction objects within the date range.
   */
  getTransactionsByDateRange(startDate: Date, endDate: Date): Transaction[] {
    // Set time to beginning of start date for inclusive range
    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);
    const startTimestamp = startOfDay.getTime();

    // Set time to end of end date for inclusive range
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    const endTimestamp = endOfDay.getTime();

    return this.transactions.filter(transaction => {
      const txTimestamp = transaction.date.getTime();
      return txTimestamp >= startTimestamp && txTimestamp <= endTimestamp;
    });
  }

  /**
   * Gets a specific transaction by its ID from this journal.
   * @param {string} transactionId - The ID of the transaction to find.
   * @returns {Transaction | undefined} The Transaction object if found, otherwise undefined.
   */
  getTransactionById(transactionId: string): Transaction | undefined {
    return this.transactions.find(t => t.id === transactionId);
  }

  /**
   * Gets the total debit amount of all transactions recorded in this journal.
   * Uses Decimal.js for precise calculation.
   * @returns {number} The total debit amount.
   */
  getTotalDebits(): number {
    let total = new Decimal(0);
    this.transactions.forEach(transaction => {
      // Consider if only 'posted' transactions should contribute to totals
      // if (transaction.status === 'posted') {
        transaction.lines.forEach(line => {
          if (line.isDebit) {
            total = total.plus(new Decimal(line.amount));
          }
        });
      // }
    });
    return total.toNumber();
  }

  /**
   * Gets the total credit amount of all transactions recorded in this journal.
   * Uses Decimal.js for precise calculation.
   * @returns {number} The total credit amount.
   */
  getTotalCredits(): number {
    let total = new Decimal(0);
    this.transactions.forEach(transaction => {
      // Consider if only 'posted' transactions should contribute to totals
      // if (transaction.status === 'posted') {
        transaction.lines.forEach(line => {
          if (!line.isDebit) { // This means it's a credit
            total = total.plus(new Decimal(line.amount));
          }
        });
      // }
    });
    return total.toNumber();
  }
}
