// src/lib/accounting/core/transaction.ts
import Decimal from 'decimal.js';

export interface TransactionLine {
  id: string;
  accountId: string;
  amount: number;
  isDebit: boolean;
  description?: string;
  metadata?: Record<string, any>;
}

export interface TransactionData {
  id: string;
  date: Date;
  description: string;
  entityId: string;
  lines: TransactionLine[];
  status?: 'draft' | 'posted' | 'void';
  reference?: string;
  metadata?: Record<string, any>;
}

export class Transaction {
  id: string;
  date: Date;
  description: string;
  entityId: string;
  lines: TransactionLine[];
  status: 'draft' | 'posted' | 'void';
  reference?: string;
  metadata?: Record<string, any>;

  constructor(data: TransactionData) {
    this.id = data.id;
    this.date = data.date;
    this.description = data.description;
    this.entityId = data.entityId;
    this.lines = data.lines;
    this.status = data.status || 'draft';
    this.reference = data.reference;
    this.metadata = data.metadata;
  }

  /**
   * Check if the transaction is balanced (debits = credits)
   */
  isBalanced(): boolean {
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const line of this.lines) {
      if (line.isDebit) {
        totalDebits = totalDebits.plus(line.amount);
      } else {
        totalCredits = totalCredits.plus(line.amount);
      }
    }

    // Using Decimal.js for precise financial calculations
    return totalDebits.equals(totalCredits);
  }

  /**
   * Add a transaction line
   */
  addLine(line: Omit<TransactionLine, 'id'>): string {
    const id = crypto.randomUUID();
    this.lines.push({
      id,
      ...line
    });
    return id;
  }

  /**
   * Remove a transaction line
   */
  removeLine(lineId: string): boolean {
    const initialLength = this.lines.length;
    this.lines = this.lines.filter(line => line.id !== lineId);
    return this.lines.length !== initialLength;
  }

  /**
   * Get total amount (sum of all debits or credits)
   */
  getTotalAmount(): number {
    let total = new Decimal(0);
    
    // Since transaction should be balanced, we can sum either debits or credits
    for (const line of this.lines) {
      if (line.isDebit) {
        total = total.plus(line.amount);
      }
    }
    
    return total.toNumber();
  }

  /**
   * Post the transaction
   */
  post(): boolean {
    if (!this.isBalanced()) {
      return false;
    }
    
    this.status = 'posted';
    return true;
  }

  /**
   * Void the transaction
   */
  void(): boolean {
    if (this.status !== 'posted') {
      return false;
    }
    
    this.status = 'void';
    return true;
  }
}