// src/lib/accounting/core/journal.ts
import { Transaction } from './transaction';
import Decimal from 'decimal.js'; // Import Decimal.js

export interface JournalDefinition {
  id: string;
  name: string;
  description?: string;
  entityId: string;
}

export class Journal {
  id: string;
  name: string;
  description?: string;
  entityId: string;
  transactions: Transaction[] = [];

  constructor(definition: JournalDefinition) {
    this.id = definition.id;
    this.name = definition.name;
    this.description = definition.description;
    this.entityId = definition.entityId;
  }

  /**
   * Add a transaction to the journal.
   * The transaction must belong to this journal's entity and be balanced.
   * @param transaction The Transaction object to add.
   * @returns true if the transaction was successfully added; false otherwise.
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

    // Optionally, check if transaction is already in this journal to prevent duplicates
    if (this.transactions.some(t => t.id === transaction.id)) {
        console.warn(`Journal [${this.name}/${this.id}]: Transaction [${transaction.id}] already exists in this journal. Transaction not added again.`);
        return false;
    }

    this.transactions.push(transaction);
    return true;
  }

  /**
   * Remove a transaction from the journal by its ID.
   * @param transactionId The ID of the transaction to remove.
   * @returns true if a transaction was removed; false otherwise.
   */
  removeTransaction(transactionId: string): boolean {
    const initialLength = this.transactions.length;
    this.transactions = this.transactions.filter(t => t.id !== transactionId);
    return this.transactions.length !== initialLength;
  }

  /**
   * Get all transactions currently in the journal.
   * @returns An array of Transaction objects.
   */
  getAllTransactions(): Transaction[] {
    return this.transactions;
  }

  /**
   * Get transactions within a specific date range (inclusive).
   * @param startDate The start date of the range.
   * @param endDate The end date of the range.
   * @returns An array of Transaction objects within the date range.
   */
  getTransactionsByDateRange(startDate: Date, endDate: Date): Transaction[] {
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();

    return this.transactions.filter(transaction => {
      // Assuming transaction.date is a Date object as per Transaction class
      const txTimestamp = transaction.date.getTime();
      return txTimestamp >= startTimestamp && txTimestamp <= endTimestamp;
    });
  }

  /**
   * Get a specific transaction by its ID.
   * @param transactionId The ID of the transaction to find.
   * @returns The Transaction object if found, otherwise undefined.
   */
  getTransactionById(transactionId: string): Transaction | undefined {
    return this.transactions.find(t => t.id === transactionId);
  }

  /**
   * Get total debits recorded in this journal.
   * Uses Decimal.js for precise calculation.
   * @returns The total debit amount as a number.
   */
  getTotalDebits(): number {
    let total = new Decimal(0);
    this.transactions.forEach(transaction => {
      transaction.lines.forEach(line => {
        if (line.isDebit) {
          total = total.plus(new Decimal(line.amount));
        }
      });
    });
    return total.toNumber();
  }

  /**
   * Get total credits recorded in this journal.
   * Uses Decimal.js for precise calculation.
   * @returns The total credit amount as a number.
   */
  getTotalCredits(): number {
    let total = new Decimal(0);
    this.transactions.forEach(transaction => {
      transaction.lines.forEach(line => {
        if (!line.isDebit) { // This means it's a credit
          total = total.plus(new Decimal(line.amount));
        }
      });
    });
    return total.toNumber();
  }
}
