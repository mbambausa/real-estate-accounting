// src/lib/services/account-service.ts
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { Database, createDbClient } from '@db/db';
import type { DbExecuteResult } from '@db/db'; // Fix 1: Use type-only import
import type { DbChartOfAccount, AccountSystemType as DbAccountSystemType } from '@db/schema';
// Assuming your application-level types might be slightly different or include more business logic.
// For now, we'll primarily use DbChartOfAccount for direct D1 interaction.
// import type { Account as AppAccount, AccountInput as AppAccountInput, AccountType, ExpenseSubtype } from '@/types/account';
import { AppError, ErrorCode } from '@utils/errors';
import { defaultChartOfAccounts } from '@lib/accounting/chartOfAccounts';
import type { ChartOfAccountsItem } from '@lib/accounting/chartOfAccounts'; // Fix 2: Use type-only import

// Define an input type specific to this service, aligning with DbChartOfAccount fields
export interface ChartOfAccountInput {
  code: string;
  name: string;
  type: DbAccountSystemType; // Use DbAccountSystemType from schema
  subtype?: string | null;
  description?: string | null;
  is_recoverable?: boolean;
  recovery_percentage?: number | null;
  tax_category?: string | null;
  is_active?: boolean;
  parent_id?: string | null; // Use parent_id (UUID of parent)
}

// Helper to map to DbChartOfAccount for consistency, though direct use is also fine
function mapToDbChartOfAccount(data: any): DbChartOfAccount {
  // Ensure all required fields of DbChartOfAccount are present or have defaults
  return {
    id: data.id,
    user_id: data.user_id,
    code: data.code,
    name: data.name,
    type: data.type,
    subtype: data.subtype || null,
    description: data.description || null,
    is_recoverable: data.is_recoverable ? 1 : 0,
    recovery_percentage: data.recovery_percentage === undefined ? null : data.recovery_percentage,
    is_active: data.is_active === false ? 0 : 1, // Default to true if undefined
    tax_category: data.tax_category || null,
    parent_id: data.parent_id || null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}


export class AccountService {
  private db: Database;
  private TABLE_NAME = 'chart_of_accounts';

  constructor(d1: D1Database) {
    this.db = createDbClient(d1);
  }

  /**
   * Get all accounts for a specific user.
   * @param userId The ID of the user.
   * @returns A promise that resolves to an array of DbChartOfAccount objects.
   */
  async getAllAccounts(userId: string): Promise<DbChartOfAccount[]> {
    const sql = `
      SELECT id, user_id, code, name, type, subtype, description, is_recoverable,
             recovery_percentage, tax_category, is_active, parent_id, created_at, updated_at
      FROM ${this.TABLE_NAME}
      WHERE user_id = ?
      ORDER BY code
    `;
    try {
      return await this.db.query<DbChartOfAccount>(sql, [userId]);
    } catch (error: unknown) {
      console.error('AccountService.getAllAccounts error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to retrieve accounts.', 500, error);
    }
  }

  /**
   * Get accounts by type for a specific user.
   * @param userId The ID of the user.
   * @param type The account type.
   * @returns A promise that resolves to an array of DbChartOfAccount objects.
   */
  async getAccountsByType(userId: string, type: DbAccountSystemType): Promise<DbChartOfAccount[]> {
    const sql = `
      SELECT id, user_id, code, name, type, subtype, description, is_recoverable,
             recovery_percentage, tax_category, is_active, parent_id, created_at, updated_at
      FROM ${this.TABLE_NAME}
      WHERE user_id = ? AND type = ?
      ORDER BY code
    `;
    try {
      return await this.db.query<DbChartOfAccount>(sql, [userId, type]);
    } catch (error: unknown) {
      console.error('AccountService.getAccountsByType error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to retrieve accounts by type.', 500, error);
    }
  }

  /**
   * Get a specific account by its ID, ensuring it belongs to the user.
   * @param id The UUID ID of the account.
   * @param userId The ID of the user.
   * @returns A promise that resolves to a DbChartOfAccount object or null.
   */
  async getAccountById(id: string, userId: string): Promise<DbChartOfAccount | null> {
    const sql = `
      SELECT id, user_id, code, name, type, subtype, description, is_recoverable,
             recovery_percentage, tax_category, is_active, parent_id, created_at, updated_at
      FROM ${this.TABLE_NAME}
      WHERE id = ? AND user_id = ?
    `;
    try {
      return await this.db.queryOne<DbChartOfAccount>(sql, [id, userId]);
    } catch (error: unknown) {
      console.error('AccountService.getAccountById error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to retrieve account by ID.', 500, error);
    }
  }

  /**
   * Get a specific account by its code, ensuring it belongs to the user.
   * @param code The user-defined code of the account.
   * @param userId The ID of the user.
   * @returns A promise that resolves to a DbChartOfAccount object or null.
   */
  async getAccountByCode(code: string, userId: string): Promise<DbChartOfAccount | null> {
    const sql = `
      SELECT id, user_id, code, name, type, subtype, description, is_recoverable,
             recovery_percentage, tax_category, is_active, parent_id, created_at, updated_at
      FROM ${this.TABLE_NAME}
      WHERE code = ? AND user_id = ?
    `;
    try {
      return await this.db.queryOne<DbChartOfAccount>(sql, [code, userId]);
    } catch (error: unknown) {
      console.error('AccountService.getAccountByCode error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to retrieve account by code.', 500, error);
    }
  }

  /**
   * Create a new account in the chart of accounts for a user.
   * @param accountData The data for the new account.
   * @param userId The ID of the user.
   * @returns A promise that resolves to the newly created DbChartOfAccount object.
   */
  async createAccount(accountData: ChartOfAccountInput, userId: string): Promise<DbChartOfAccount> {
    // Check if account code already exists for this user
    const existingAccountByCode = await this.getAccountByCode(accountData.code, userId);
    if (existingAccountByCode) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Account with code ${accountData.code} already exists for this user.`, 400);
    }

    // Validate parent account if parent_id is provided
    if (accountData.parent_id) {
      const parentAccount = await this.getAccountById(accountData.parent_id, userId);
      if (!parentAccount) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Parent account not found or does not belong to the user.', 400);
      }
    }

    const accountId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const sql = `
      INSERT INTO ${this.TABLE_NAME} (
        id, user_id, code, name, type, subtype, description,
        is_recoverable, recovery_percentage, tax_category, is_active, parent_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      accountId, userId, accountData.code, accountData.name, accountData.type,
      accountData.subtype || null, accountData.description || null,
      accountData.is_recoverable ? 1 : 0,
      accountData.recovery_percentage === undefined ? null : accountData.recovery_percentage,
      accountData.tax_category || null,
      accountData.is_active === false ? 0 : 1, // Default to active (1)
      accountData.parent_id || null,
      now, now
    ];

    try {
      const result: DbExecuteResult = await this.db.execute(sql, params);
      if (!result.success) {
        throw new AppError(ErrorCode.DATABASE_ERROR, result.error || 'Failed to create account.', 500);
      }

      const newAccount = await this.getAccountById(accountId, userId);
      if (!newAccount) {
        throw new AppError(ErrorCode.DATABASE_ERROR, 'Account was created but could not be retrieved.', 500);
      }
      return newAccount;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      console.error('AccountService.createAccount error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'An unexpected error occurred while creating the account.', 500, error);
    }
  }

  /**
   * Update an existing account.
   * @param accountId The UUID ID of the account to update.
   * @param accountData The partial data for updating the account.
   * @param userId The ID of the user.
   * @returns A promise that resolves to the updated DbChartOfAccount object.
   */
  async updateAccount(accountId: string, accountData: Partial<ChartOfAccountInput>, userId: string): Promise<DbChartOfAccount> {
    const existingAccount = await this.getAccountById(accountId, userId);
    if (!existingAccount) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Account not found or access denied.', 404);
    }

    // If code is being changed, ensure the new code isn't already taken by another account for this user
    if (accountData.code && accountData.code !== existingAccount.code) {
      const conflictingAccount = await this.getAccountByCode(accountData.code, userId);
      if (conflictingAccount) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, `Account code "${accountData.code}" is already in use.`, 400);
      }
    }
    
    // Validate parent_id if provided and changed
    if (accountData.parent_id && accountData.parent_id !== existingAccount.parent_id) {
        if (accountData.parent_id === accountId) { // Prevent self-parenting
            throw new AppError(ErrorCode.VALIDATION_ERROR, 'An account cannot be its own parent.', 400);
        }
        const parentAccount = await this.getAccountById(accountData.parent_id, userId);
        if (!parentAccount) {
            throw new AppError(ErrorCode.VALIDATION_ERROR, 'Parent account not found or does not belong to the user.', 400);
        }
        // Add circular dependency check if necessary (similar to EntityService)
    } else if (accountData.parent_id === null && existingAccount.parent_id !== null) {
        // Handle setting parent_id to null
    }


    const updateFields: string[] = [];
    const updateValues: any[] = [];
    const now = Math.floor(Date.now() / 1000);

    // Helper to add field to update if it's defined in input and different from existing
    const addUpdateField = (key: keyof ChartOfAccountInput, dbKey: keyof DbChartOfAccount, transform?: (val: any) => any) => {
        if (accountData[key] !== undefined) {
            const newValue = transform ? transform(accountData[key]) : accountData[key];
            // Check if new value is different from existing, or if it's explicitly set to null
            if (newValue !== existingAccount[dbKey] || (newValue === null && existingAccount[dbKey] !== null)) {
                 updateFields.push(`${dbKey.toString()} = ?`);
                 updateValues.push(newValue === undefined ? null : newValue); // Ensure undefined becomes null
            }
        }
    };
    
    addUpdateField('code', 'code');
    addUpdateField('name', 'name');
    addUpdateField('type', 'type');
    addUpdateField('subtype', 'subtype');
    addUpdateField('description', 'description');
    addUpdateField('is_recoverable', 'is_recoverable', (v) => v ? 1 : 0);
    addUpdateField('recovery_percentage', 'recovery_percentage');
    addUpdateField('tax_category', 'tax_category');
    addUpdateField('is_active', 'is_active', (v) => v ? 1 : 0);
    addUpdateField('parent_id', 'parent_id');


    if (updateFields.length === 0) {
      return existingAccount; // No actual changes
    }

    updateFields.push('updated_at = ?');
    updateValues.push(now);

    const sql = `
      UPDATE ${this.TABLE_NAME}
      SET ${updateFields.join(', ')}
      WHERE id = ? AND user_id = ?
    `;
    const params = [...updateValues, accountId, userId];

    try {
      const result: DbExecuteResult = await this.db.execute(sql, params);
      if (!result.success) {
        throw new AppError(ErrorCode.DATABASE_ERROR, result.error || 'Failed to update account.', 500);
      }

      const updatedAccount = await this.getAccountById(accountId, userId);
      if (!updatedAccount) {
        throw new AppError(ErrorCode.DATABASE_ERROR, 'Account was updated but could not be retrieved.', 500);
      }
      return updatedAccount;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      console.error('AccountService.updateAccount error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'An unexpected error occurred while updating the account.', 500, error);
    }
  }

  /**
   * Delete an account.
   * @param accountId The UUID ID of the account to delete.
   * @param userId The ID of the user.
   * @returns A promise that resolves to true if deletion was successful.
   */
  async deleteAccount(accountId: string, userId: string): Promise<boolean> {
    const account = await this.getAccountById(accountId, userId);
    if (!account) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Account not found or access denied.', 404);
    }

    // Check if account is a parent to any other accounts
    const childAccountsSql = `SELECT id FROM ${this.TABLE_NAME} WHERE parent_id = ? AND user_id = ? LIMIT 1`;
    const childAccount = await this.db.queryOne(childAccountsSql, [accountId, userId]);
    if (childAccount) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Cannot delete account that is a parent to other accounts. Reassign child accounts first.', 400);
    }

    // TODO: Check if account is being used in entity_accounts or transactions.
    // This requires EntityAccountService and TransactionService.
    // For now, we proceed with deletion.

    const sql = `DELETE FROM ${this.TABLE_NAME} WHERE id = ? AND user_id = ?`;
    try {
      const result: DbExecuteResult = await this.db.execute(sql, [accountId, userId]);
      if (!result.success) {
        throw new AppError(ErrorCode.DATABASE_ERROR, result.error || 'Failed to delete account.', 500);
      }
      return (result.meta?.changes ?? 0) > 0;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      console.error('AccountService.deleteAccount error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'An unexpected error occurred while deleting the account.', 500, error);
    }
  }

  /**
   * Initialize the chart of accounts for a user with default accounts.
   * This is idempotent; it won't add duplicates if accounts already exist for the user.
   * @param userId The ID of the user for whom to initialize accounts.
   * @returns A promise that resolves to the number of accounts newly inserted.
   */
  async initializeDefaultAccounts(userId: string): Promise<number> {
    const existingUserAccounts = await this.getAllAccounts(userId);
    if (existingUserAccounts.length > 0 && defaultChartOfAccounts.some(defAcc => existingUserAccounts.find(exAcc => exAcc.code === defAcc.code))) {
      console.log(`Default accounts seem to already exist for user ${userId}. Skipping initialization.`);
      return 0; // Already initialized or partially initialized
    }

    const now = Math.floor(Date.now() / 1000);
    let insertedCount = 0;

    // Map codes to newly created IDs for parent_id resolution
    const codeToIdMap = new Map<string, string>();

    // Prepare statements for batching
    const operations: D1PreparedStatement[] = [];

    // First pass: Insert accounts without parent_id or with parents that will be top-level
    const accountsToInsert: (ChartOfAccountsItem & { generatedId: string })[] = [];

    for (const defAcct of defaultChartOfAccounts) {
        const accountId = crypto.randomUUID();
        codeToIdMap.set(defAcct.code, accountId); // Store ID for parent linking
        accountsToInsert.push({ ...defAcct, generatedId: accountId });
    }
    
    for (const accToInsert of accountsToInsert) {
        const parentDbId = accToInsert.parentCode ? codeToIdMap.get(accToInsert.parentCode) || null : null;

        const sql = `
          INSERT INTO ${this.TABLE_NAME} (
            id, user_id, code, name, type, subtype, description, is_recoverable,
            recovery_percentage, tax_category, is_active, parent_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        operations.push(
          this.db.d1Instance.prepare(sql).bind(
            accToInsert.generatedId, userId, accToInsert.code, accToInsert.name, accToInsert.type,
            accToInsert.subtype || null, accToInsert.description || null,
            accToInsert.isRecoverable ? 1 : 0,
            undefined, // recovery_percentage not in defaultChartOfAccountsItem typically
            null, // tax_category
            1, // is_active
            parentDbId, // Use resolved parent_id
            now, now
          )
        );
    }
    
    if (operations.length === 0) return 0;

    try {
      const results = await this.db.batch(operations);
      results.forEach(result => {
        if (result.success && result.meta?.changes && result.meta.changes > 0) {
          insertedCount += result.meta.changes;
        } else if (!result.success) {
          console.warn('Failed to insert a default account:', result.error);
        }
      });
      return insertedCount;
    } catch (error: unknown) {
      console.error('AccountService.initializeDefaultAccounts batch error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to initialize default accounts.', 500, error);
    }
  }

  /**
   * Get account hierarchy for a user.
   * @param userId The ID of the user.
   * @returns A promise that resolves to an array of DbChartOfAccount objects, structured hierarchically.
   */
  async getAccountHierarchy(userId: string): Promise<DbChartOfAccount[]> {
    const allAccounts = await this.getAllAccounts(userId);
    if (!allAccounts || allAccounts.length === 0) {
      return [];
    }

    const accountsById = new Map(allAccounts.map(acc => [acc.id, { ...acc, children: [] as DbChartOfAccount[] }]));
    const rootAccounts: DbChartOfAccount[] = [];

    for (const account of accountsById.values()) {
      if (account.parent_id && accountsById.has(account.parent_id)) {
        const parent = accountsById.get(account.parent_id)!;
        parent.children.push(account);
      } else {
        rootAccounts.push(account);
      }
    }
    return rootAccounts;
  }
}

/**
 * Factory function to create an instance of AccountService.
 * @param d1 The D1Database instance.
 * @returns A new AccountService instance.
 */
export function createAccountService(d1: D1Database): AccountService {
  return new AccountService(d1);
}