// src/lib/accounting/transaction.ts
import Decimal from 'decimal.js';

export interface TransactionLine {
  /** Unique identifier for the transaction line (e.g., UUID). */
  id: string;
  /** * Identifier of the account (from the Ledger's Account map, 
   * typically Account.id which is a UUID) this line affects. 
   */
  accountId: string;
  /** The monetary value of this line (always stored as positive). */
  amount: number;
  /** True if this line represents a debit, false if it's a credit. */
  isDebit: boolean;
  /** Optional description or memo for this specific line item. */
  description?: string;
  /** Optional metadata for custom fields or tracking. */
  metadata?: Record<string, any>;
}

export interface TransactionData {
  /** Unique identifier for the transaction (e.g., UUID). */
  id: string;
  /** Date of the transaction. */
  date: Date;
  /** General description of the transaction. */
  description: string;
  /** Identifier of the entity this transaction belongs to. */
  entityId: string;
  /** Array of transaction lines (debits and credits). */
  lines: TransactionLine[]; // Should have at least 2 lines for a valid transaction
  /** Current status of the transaction. */
  status?: 'draft' | 'posted' | 'void';
  /** Optional reference number (e.g., check number, invoice number). */
  reference?: string;
  /** Optional metadata for custom fields or tracking. */
  metadata?: Record<string, any>;
}

export class Transaction {
  public readonly id: string;
  public date: Date;
  public description: string;
  public readonly entityId: string;
  public lines: TransactionLine[];
  public status: 'draft' | 'posted' | 'void';
  public reference?: string;
  public metadata?: Record<string, any>;

  constructor(data: TransactionData) {
    if (!data.id) throw new Error("Transaction ID is required.");
    if (!data.date) throw new Error("Transaction date is required.");
    if (!data.description?.trim()) throw new Error("Transaction description is required.");
    if (!data.entityId) throw new Error("Transaction entityId is required.");
    if (!data.lines || data.lines.length < 2) {
        throw new Error("Transaction must have at least two lines (e.g., one debit, one credit).");
    }
    
    this.id = data.id;
    this.date = data.date;
    this.description = data.description;
    this.entityId = data.entityId;
    // Ensure lines have IDs and positive amounts
    this.lines = data.lines.map(line => ({
        id: line.id || crypto.randomUUID(), 
        accountId: line.accountId,
        amount: Math.abs(line.amount), // Ensure amount is positive
        isDebit: line.isDebit,
        description: line.description,
        metadata: line.metadata,
    }));
    this.status = data.status || 'draft';
    this.reference = data.reference;
    this.metadata = data.metadata;

    // Optional: Check balance if status is 'posted' on construction, though typically post() handles this.
    // if (this.status === 'posted' && !this.isBalanced()) {
    //   throw new Error("Cannot create a 'posted' transaction that is not balanced.");
    // }
  }

  /**
   * Checks if the transaction is balanced (total debits equal total credits).
   * Uses Decimal.js for precise financial calculations.
   * @returns {boolean} True if balanced, false otherwise.
   */
  isBalanced(): boolean {
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const line of this.lines) {
      const amount = new Decimal(line.amount); // line.amount is already positive
      if (line.isDebit) {
        totalDebits = totalDebits.plus(amount);
      } else {
        totalCredits = totalCredits.plus(amount);
      }
    }
    return totalDebits.equals(totalCredits);
  }

  /**
   * Adds a new transaction line to this transaction.
   * @param {Omit<TransactionLine, 'id'>} lineData - Data for the new line, excluding the ID.
   * @returns {string} The ID of the newly added transaction line.
   * @throws {Error} If the transaction is already 'posted' or 'void'.
   */
  addLine(lineData: Omit<TransactionLine, 'id'>): string {
    if (this.status === 'posted' || this.status === 'void') {
      throw new Error(`Cannot add lines to a transaction with status: ${this.status}.`);
    }
    if (typeof lineData.amount !== 'number' || typeof lineData.isDebit !== 'boolean' || !lineData.accountId) {
        throw new Error("Invalid line data: amount, isDebit, and accountId are required.");
    }
    const id = crypto.randomUUID();
    this.lines.push({
      id,
      accountId: lineData.accountId,
      amount: Math.abs(lineData.amount), // Ensure amount is positive
      isDebit: lineData.isDebit,
      description: lineData.description,
      metadata: lineData.metadata,
    });
    return id;
  }

  /**
   * Removes a transaction line by its ID.
   * @param {string} lineId - The ID of the transaction line to remove.
   * @returns {boolean} True if a line was removed, false otherwise.
   * @throws {Error} If the transaction is already 'posted' or 'void'.
   */
  removeLine(lineId: string): boolean {
    if (this.status === 'posted' || this.status === 'void') {
      throw new Error(`Cannot remove lines from a transaction with status: ${this.status}.`);
    }
    const initialLength = this.lines.length;
    this.lines = this.lines.filter(line => line.id !== lineId);
    return this.lines.length < initialLength;
  }

  /**
   * Gets the total monetary value of the transaction (sum of all debits or all credits).
   * @returns {number} The total amount.
   */
  getTotalAmount(): number {
    let totalDebits = new Decimal(0);
    // Since a transaction should be balanced to be meaningful,
    // summing debits (or credits) gives the transaction's total value.
    for (const line of this.lines) {
      if (line.isDebit) {
        totalDebits = totalDebits.plus(new Decimal(line.amount));
      }
    }
    return totalDebits.toNumber();
  }

  /**
   * Posts the transaction if it is balanced and currently a draft.
   * @returns {boolean} True if the transaction was successfully posted, false otherwise.
   * @throws {Error} If trying to post a transaction that is not a draft or fails validation.
   */
  post(): boolean {
    if (this.status !== 'draft') {
      throw new Error(`Cannot post transaction. Current status: ${this.status}. Expected 'draft'.`);
    }
    if (this.lines.length < 2) {
        // This check is also in constructor, but good to have pre-posting as well.
        console.warn(`Transaction ${this.id} must have at least two lines to be posted.`);
        return false;
    }
    if (!this.isBalanced()) {
      console.warn(`Transaction ${this.id} is not balanced. Cannot post.`);
      return false;
    }
    
    this.status = 'posted';
    return true;
  }

  /**
   * Voids the transaction if it has been posted.
   * @returns {boolean} True if the transaction was successfully voided, false otherwise.
   * @throws {Error} If trying to void a transaction that is not 'posted'.
   */
  void(): boolean {
    if (this.status !== 'posted') {
      throw new Error(`Cannot void transaction. Current status: ${this.status}. Expected 'posted'.`);
    }
    
    this.status = 'void';
    // Note: In a full accounting system, voiding often creates reversing entries.
    // For this model, changing status is a simplified representation.
    return true;
  }
}
