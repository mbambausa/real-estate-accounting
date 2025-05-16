// src/lib/services/entity-account-service.ts
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { Database, createDbClient } from '@db/db';
import type { DbExecuteResult } from '@db/db'; // Fix: Use type-only import
import type { DbEntityAccount, DbChartOfAccount } from '@db/schema';
import { AppError, ErrorCode } from '@utils/errors';
import { createEntityService, EntityService } from './entity-service';
import { createAccountService, AccountService } from './account-service';

// Define an input type specific to this service
export interface EntityAccountInput {
  entity_id: string;
  account_id: string; // This is the UUID ID from chart_of_accounts table
  custom_name?: string | null;
  is_active?: boolean;
  recovery_type?: string | null;
  recovery_percentage?: number | null;
}

// Define the shape of the data returned by JOIN queries
export interface JoinedEntityAccount extends DbEntityAccount {
  account_code: string; // From the joined chart_of_accounts table
  account_name: string; // From the joined chart_of_accounts table
  account_type: DbChartOfAccount['type'];
  account_subtype?: DbChartOfAccount['subtype'];
  account_is_recoverable?: DbChartOfAccount['is_recoverable'];
  // user_id is already on DbEntityAccount, but ensure it's selected if needed for auth checks directly on joined results
}

export class EntityAccountService {
  private db: Database;
  private entityService: EntityService; // To validate entity existence and ownership
  private accountService: AccountService; // To validate account existence and ownership
  private TABLE_NAME = 'entity_accounts';
  private COA_TABLE_NAME = 'chart_of_accounts'; // Chart of Accounts table name
  private ENTITIES_TABLE_NAME = 'entities';

  constructor(d1: D1Database) {
    this.db = createDbClient(d1);
    // It's good practice for services to instantiate other services they depend on,
    // or have them injected, to ensure they use the same DB instance or configuration.
    this.entityService = createEntityService(d1);
    this.accountService = createAccountService(d1);
  }

  /**
   * Get all entity-account mappings for a specific entity, ensuring the entity belongs to the user.
   * @param entityId The ID of the entity.
   * @param userId The ID of the user.
   * @returns A promise that resolves to an array of JoinedEntityAccount objects.
   */
  async getAccountsForEntity(entityId: string, userId: string): Promise<JoinedEntityAccount[]> {
    // First, verify the entity exists and belongs to the user.
    const entity = await this.entityService.getEntityById(entityId, userId);
    if (!entity) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Entity not found or access denied.', 404);
    }

    const sql = `
      SELECT
        ea.id, ea.user_id, ea.entity_id, ea.account_id, ea.custom_name,
        ea.is_active, ea.recovery_type, ea.recovery_percentage,
        ea.created_at, ea.updated_at,
        coa.code as account_code, coa.name as account_name,
        coa.type as account_type, coa.subtype as account_subtype,
        coa.is_recoverable as account_is_recoverable
      FROM ${this.TABLE_NAME} ea
      JOIN ${this.COA_TABLE_NAME} coa ON ea.account_id = coa.id
      WHERE ea.entity_id = ? AND ea.user_id = ?
      ORDER BY coa.code
    `;
    // We also filter by ea.user_id for an extra layer of security,
    // though entity validation should cover ownership.
    try {
      return await this.db.query<JoinedEntityAccount>(sql, [entityId, userId]);
    } catch (error: unknown) {
      console.error('EntityAccountService.getAccountsForEntity error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to retrieve accounts for entity.', 500, error);
    }
  }

  /**
   * Get a specific entity-account mapping by its ID, ensuring it belongs to the user.
   * @param id The ID of the entity_accounts record.
   * @param userId The ID of the user.
   * @returns A promise that resolves to a JoinedEntityAccount object or null.
   */
  async getEntityAccountById(id: string, userId: string): Promise<JoinedEntityAccount | null> {
    const sql = `
      SELECT
        ea.id, ea.user_id, ea.entity_id, ea.account_id, ea.custom_name,
        ea.is_active, ea.recovery_type, ea.recovery_percentage,
        ea.created_at, ea.updated_at,
        coa.code as account_code, coa.name as account_name,
        coa.type as account_type, coa.subtype as account_subtype,
        coa.is_recoverable as account_is_recoverable
      FROM ${this.TABLE_NAME} ea
      JOIN ${this.COA_TABLE_NAME} coa ON ea.account_id = coa.id
      WHERE ea.id = ? AND ea.user_id = ?
    `;
    // user_id on entity_accounts table ensures direct ownership check.
    try {
      return await this.db.queryOne<JoinedEntityAccount>(sql, [id, userId]);
    } catch (error: unknown) {
      console.error('EntityAccountService.getEntityAccountById error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to retrieve entity-account mapping by ID.', 500, error);
    }
  }

  /**
   * Get a specific entity-account mapping by entity ID and chart of account ID.
   * @param entityId The ID of the entity.
   * @param accountId The UUID ID of the chart_of_accounts record.
   * @param userId The ID of the user.
   * @returns A promise that resolves to a DbEntityAccount object or null.
   */
  async getEntityAccountByEntityAndAccount(entityId: string, accountId: string, userId: string): Promise<DbEntityAccount | null> {
    // Verify entity and account belong to the user first (optional, but good for defense in depth)
    // const entity = await this.entityService.getEntityById(entityId, userId);
    // if (!entity) throw new AppError(ErrorCode.NOT_FOUND, 'Entity not found or access denied.', 404);
    // const account = await this.accountService.getAccountById(accountId, userId);
    // if (!account) throw new AppError(ErrorCode.NOT_FOUND, 'Chart of account record not found or access denied.', 404);

    const sql = `
      SELECT * FROM ${this.TABLE_NAME}
      WHERE entity_id = ? AND account_id = ? AND user_id = ?
    `;
    try {
      // This returns DbEntityAccount as it's a direct query without the join for full details
      return await this.db.queryOne<DbEntityAccount>(sql, [entityId, accountId, userId]);
    } catch (error: unknown) {
      console.error('EntityAccountService.getEntityAccountByEntityAndAccount error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to retrieve entity-account mapping.', 500, error);
    }
  }

  /**
   * Create a new entity-account mapping.
   * @param data The data for the new mapping.
   * @param userId The ID of the user.
   * @returns A promise that resolves to the newly created JoinedEntityAccount object.
   */
  async createEntityAccount(data: EntityAccountInput, userId: string): Promise<JoinedEntityAccount> {
    // Validate that the entity exists and belongs to the user
    const entity = await this.entityService.getEntityById(data.entity_id, userId);
    if (!entity) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Entity not found or access denied.', 404);
    }

    // Validate that the chart of account record (using account_id) exists and belongs to the user
    const account = await this.accountService.getAccountById(data.account_id, userId);
    if (!account) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Chart of account record not found or access denied.', 404);
    }

    // Check if mapping already exists
    const existingMapping = await this.getEntityAccountByEntityAndAccount(data.entity_id, data.account_id, userId);
    if (existingMapping) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'This account is already linked to this entity.', 400);
    }

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const sql = `
      INSERT INTO ${this.TABLE_NAME} (
        id, user_id, entity_id, account_id, custom_name,
        is_active, recovery_type, recovery_percentage,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      id, userId, data.entity_id, data.account_id, data.custom_name || null,
      data.is_active === false ? 0 : 1, // Default to active
      data.recovery_type || null,
      // Use account's default recovery_percentage if not provided in input
      data.recovery_percentage === undefined ? account.recovery_percentage : data.recovery_percentage,
      now, now
    ];

    try {
      const result: DbExecuteResult = await this.db.execute(sql, params);
      if (!result.success) {
        throw new AppError(ErrorCode.DATABASE_ERROR, result.error || 'Failed to create entity-account mapping.', 500);
      }

      const newMapping = await this.getEntityAccountById(id, userId);
      if (!newMapping) {
        throw new AppError(ErrorCode.DATABASE_ERROR, 'Entity-account mapping was created but could not be retrieved.', 500);
      }
      return newMapping;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      console.error('EntityAccountService.createEntityAccount error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'An unexpected error occurred while creating entity-account mapping.', 500, error);
    }
  }

  /**
   * Update an existing entity-account mapping.
   * @param id The ID of the entity_accounts record to update.
   * @param data The partial data for updating.
   * @param userId The ID of the user.
   * @returns A promise that resolves to the updated JoinedEntityAccount object.
   */
  async updateEntityAccount(id: string, data: Partial<Omit<EntityAccountInput, 'entity_id' | 'account_id'>>, userId: string): Promise<JoinedEntityAccount> {
    // Omit entity_id and account_id from input as they shouldn't be changed on an existing link.
    const existingMapping = await this.getEntityAccountById(id, userId);
    if (!existingMapping) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Entity-account mapping not found or access denied.', 404);
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    const now = Math.floor(Date.now() / 1000);

    // Helper to add field to update if it's defined in input and different from existing
    const addUpdateField = (key: keyof typeof data, dbKey: keyof DbEntityAccount, transform?: (val: any) => any) => {
      if (data[key] !== undefined) {
        const newValue = transform ? transform(data[key]) : data[key];
        if (newValue !== (existingMapping as any)[dbKey] || (newValue === null && (existingMapping as any)[dbKey] !== null)) {
          updateFields.push(`${dbKey.toString()} = ?`);
          updateValues.push(newValue === undefined ? null : newValue);
        }
      }
    };

    addUpdateField('custom_name', 'custom_name');
    addUpdateField('is_active', 'is_active', (v) => v ? 1 : 0);
    addUpdateField('recovery_type', 'recovery_type');
    addUpdateField('recovery_percentage', 'recovery_percentage');

    if (updateFields.length === 0) {
      return existingMapping;
    }

    updateFields.push('updated_at = ?');
    updateValues.push(now);

    const sql = `
      UPDATE ${this.TABLE_NAME}
      SET ${updateFields.join(', ')}
      WHERE id = ? AND user_id = ?
    `;
    const params = [...updateValues, id, userId];

    try {
      const result: DbExecuteResult = await this.db.execute(sql, params);
      if (!result.success) {
        throw new AppError(ErrorCode.DATABASE_ERROR, result.error || 'Failed to update entity-account mapping.', 500);
      }

      const updatedMapping = await this.getEntityAccountById(id, userId);
      if (!updatedMapping) {
        throw new AppError(ErrorCode.DATABASE_ERROR, 'Entity-account mapping was updated but could not be retrieved.', 500);
      }
      return updatedMapping;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      console.error('EntityAccountService.updateEntityAccount error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'An unexpected error occurred while updating entity-account mapping.', 500, error);
    }
  }

  /**
   * Delete an entity-account mapping.
   * @param id The ID of the entity_accounts record to delete.
   * @param userId The ID of the user.
   * @returns A promise that resolves to true if deletion was successful.
   */
  async deleteEntityAccount(id: string, userId: string): Promise<boolean> {
    const mapping = await this.getEntityAccountById(id, userId); // Ensures it belongs to user
    if (!mapping) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Entity-account mapping not found or access denied.', 404);
    }

    // TODO: Check if this entity_account link is used in any transaction_lines.
    // If so, prevent deletion or handle accordingly (e.g., archive).
    // This requires TransactionService.

    const sql = `DELETE FROM ${this.TABLE_NAME} WHERE id = ? AND user_id = ?`;
    try {
      const result: DbExecuteResult = await this.db.execute(sql, [id, userId]);
      if (!result.success) {
        throw new AppError(ErrorCode.DATABASE_ERROR, result.error || 'Failed to delete entity-account mapping.', 500);
      }
      return (result.meta?.changes ?? 0) > 0;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      console.error('EntityAccountService.deleteEntityAccount error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'An unexpected error occurred while deleting entity-account mapping.', 500, error);
    }
  }

  /**
   * Initialize entity accounts for a given entity from the user's chart of accounts.
   * Links all active accounts from the user's CoA to the specified entity.
   * This is idempotent; it won't create duplicate links.
   * @param entityId The ID of the entity.
   * @param userId The ID of the user.
   * @returns A promise that resolves to the number of new entity-account links created.
   */
  async initializeEntityAccounts(entityId: string, userId: string): Promise<number> {
    const entity = await this.entityService.getEntityById(entityId, userId);
    if (!entity) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Entity not found or access denied.', 404);
    }

    const allUserCoaAccounts = await this.accountService.getAllAccounts(userId);
    const existingEntityLinks = await this.getAccountsForEntity(entityId, userId);
    const existingLinkedAccountIds = new Set(existingEntityLinks.map(link => link.account_id));

    const accountsToLink = allUserCoaAccounts.filter(coaAccount =>
      coaAccount.is_active === 1 && !existingLinkedAccountIds.has(coaAccount.id)
    );

    if (accountsToLink.length === 0) {
      console.log(`No new accounts to link for entity ${entityId}.`);
      return 0;
    }

    const now = Math.floor(Date.now() / 1000);
    const operations: D1PreparedStatement[] = [];

    for (const coaAccount of accountsToLink) {
      const linkId = crypto.randomUUID();
      const sql = `
        INSERT INTO ${this.TABLE_NAME} (
          id, user_id, entity_id, account_id, custom_name, is_active,
          recovery_type, recovery_percentage, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      operations.push(
        this.db.d1Instance.prepare(sql).bind(
          linkId, userId, entityId, coaAccount.id,
          null, // custom_name
          1,    // is_active
          null, // recovery_type (could inherit from coaAccount.subtype if logic dictates)
          coaAccount.recovery_percentage, // inherit from coaAccount
          now, now
        )
      );
    }

    let insertedCount = 0;
    try {
      const results = await this.db.batch(operations);
      results.forEach(result => {
        if (result.success && result.meta?.changes && result.meta.changes > 0) {
          insertedCount += result.meta.changes;
        } else if (!result.success){
            console.warn('Failed to insert an entity-account link during initialization:', result.error);
        }
      });
      return insertedCount;
    } catch (error: unknown) {
      console.error('EntityAccountService.initializeEntityAccounts batch error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to initialize entity accounts.', 500, error);
    }
  }
}

/**
 * Factory function to create an instance of EntityAccountService.
 * @param d1 The D1Database instance.
 * @returns A new EntityAccountService instance.
 */
export function createEntityAccountService(d1: D1Database): EntityAccountService {
  return new EntityAccountService(d1);
}
