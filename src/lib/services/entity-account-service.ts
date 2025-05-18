// src/lib/services/entity-account-service.ts
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { Database, createDbClient } from '@db/db';
import type { DbExecuteResult } from '@db/db';
import type { DbEntityAccount, DbChartOfAccount, DbEntity } from '@db/schema';
import { AppError, ErrorCode } from '@utils/errors';
import { createEntityService, EntityService } from './entity-service';
import { createAccountService, AccountService } from './account-service';

/**
 * Application-level representation of a linked entity-account, with boolean flags.
 */
export interface AppEntityAccount {
  id: string;
  user_id: string;
  entity_id: string;
  account_id: string;
  custom_name: string | null;
  is_active: boolean;
  recovery_type: string | null;
  recovery_percentage: number | null;
  created_at: number;
  updated_at: number;
  account_code: string;
  account_name: string;
  account_type: DbChartOfAccount['type'];
  account_subtype: DbChartOfAccount['subtype'] | null;
  account_is_recoverable: boolean;
}

// Maps raw joined DB row to AppEntityAccount, converting numeric flags to booleans
function mapJoined(raw: any): AppEntityAccount {
  return {
    id: raw.id,
    user_id: raw.user_id,
    entity_id: raw.entity_id,
    account_id: raw.account_id,
    custom_name: raw.custom_name,
    is_active: raw.is_active === 1,
    recovery_type: raw.recovery_type,
    recovery_percentage: raw.recovery_percentage,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    account_code: raw.account_code,
    account_name: raw.account_name,
    account_type: raw.account_type,
    account_subtype: raw.account_subtype,
    account_is_recoverable: raw.account_is_recoverable === 1,
  };
}

export class EntityAccountService {
  private db: Database;
  private entityService: EntityService;
  private accountService: AccountService;
  private TABLE_NAME = 'entity_accounts';
  private COA_TABLE_NAME = 'chart_of_accounts';

  constructor(d1: D1Database) {
    this.db = createDbClient(d1);
    this.entityService = createEntityService(d1);
    this.accountService = createAccountService(d1);
  }

  /**
   * Retrieves all accounts linked to an entity, with flags mapped.
   */
  async getAccountsForEntity(entityId: string, userId: string): Promise<AppEntityAccount[]> {
    await this.entityService.getEntityById(entityId, userId);
    const sql = `
      SELECT
        ea.*, coa.code AS account_code, coa.name AS account_name,
        coa.type AS account_type, coa.subtype AS account_subtype,
        coa.is_recoverable AS account_is_recoverable
      FROM ${this.TABLE_NAME} ea
      JOIN ${this.COA_TABLE_NAME} coa ON ea.account_id = coa.id
      WHERE ea.entity_id = ? AND ea.user_id = ?
      ORDER BY coa.code
    `;
    try {
      const rows = await this.db.query<any>(sql, [entityId, userId]);
      return rows.map(mapJoined);
    } catch (err: unknown) {
      console.error('EntityAccountService.getAccountsForEntity error:', err);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to retrieve accounts for entity.', 500, err);
    }
  }

  /**
   * Retrieves all entities linked to a specific account for a user.
   * @param accountId The ID of the account to get linked entities for.
   * @param userId The ID of the user who owns the account.
   * @returns A promise that resolves to an array of entities with link information.
   */
  async getAccountEntityLinks(accountId: string, userId: string): Promise<Array<DbEntity & { entity_account_link_id: string; entity_account_is_active: number; entity_account_custom_name: string | null }>> {
    // First verify the account exists and belongs to the user
    const account = await this.accountService.getAccountById(accountId, userId);
    if (!account) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Account not found or access denied.', 404);
    }

    const sql = `
      SELECT e.*, 
             ea.id as entity_account_link_id, 
             ea.is_active as entity_account_is_active,
             ea.custom_name as entity_account_custom_name
      FROM entities e
      INNER JOIN ${this.TABLE_NAME} ea ON e.id = ea.entity_id
      WHERE ea.account_id = ? 
      AND ea.user_id = ?
      ORDER BY e.name
    `;
    
    try {
      // Specify the exact return type for the query method
      const results = await this.db.query<DbEntity & { 
        entity_account_link_id: string; 
        entity_account_is_active: number; 
        entity_account_custom_name: string | null 
      }>(sql, [accountId, userId]);
      
      return results;
    } catch (error: unknown) {
      console.error('EntityAccountService.getAccountEntityLinks error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to retrieve linked entities for account.', 500, error);
    }
  }

  /**
   * Retrieves a specific link by its ID.
   */
  async getEntityAccountById(id: string, userId: string): Promise<AppEntityAccount | null> {
    const sql = `
      SELECT
        ea.*, coa.code AS account_code, coa.name AS account_name,
        coa.type AS account_type, coa.subtype AS account_subtype,
        coa.is_recoverable AS account_is_recoverable
      FROM ${this.TABLE_NAME} ea
      JOIN ${this.COA_TABLE_NAME} coa ON ea.account_id = coa.id
      WHERE ea.id = ? AND ea.user_id = ?
    `;
    try {
      const raw = await this.db.queryOne<any>(sql, [id, userId]);
      return raw ? mapJoined(raw) : null;
    } catch (err: unknown) {
      console.error('EntityAccountService.getEntityAccountById error:', err);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to retrieve entity-account mapping by ID.', 500, err);
    }
  }

  /**
   * Retrieves the raw mapping without join.
   */
  async getEntityAccountByEntityAndAccount(entityId: string, accountId: string, userId: string): Promise<DbEntityAccount | null> {
    const sql = `SELECT * FROM ${this.TABLE_NAME} WHERE entity_id = ? AND account_id = ? AND user_id = ?`;
    try {
      return await this.db.queryOne<DbEntityAccount>(sql, [entityId, accountId, userId]);
    } catch (err: unknown) {
      console.error('EntityAccountService.getEntityAccountByEntityAndAccount error:', err);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to retrieve entity-account mapping.', 500, err);
    }
  }

  /**
   * Creates a new entity-account link, mapping boolean flags.
   */
  async createEntityAccount(data: Omit<AppEntityAccount, keyof AppEntityAccount | 'id' | 'created_at' | 'updated_at' | 'account_code' | 'account_name' | 'account_type' | 'account_subtype' | 'account_is_recoverable'> & {
    entity_id: string;
    account_id: string;
    custom_name?: string | null;
    is_active?: boolean;
    recovery_type?: string | null;
    recovery_percentage?: number | null;
  }, userId: string): Promise<AppEntityAccount> {
    const entity = await this.entityService.getEntityById(data.entity_id, userId);
    if (!entity) throw new AppError(ErrorCode.NOT_FOUND, 'Entity not found or access denied.', 404);
    const account = await this.accountService.getAccountById(data.account_id, userId);
    if (!account) throw new AppError(ErrorCode.NOT_FOUND, 'Account not found or access denied.', 404);
    const exists = await this.getEntityAccountByEntityAndAccount(data.entity_id, data.account_id, userId);
    if (exists) throw new AppError(ErrorCode.VALIDATION_ERROR, 'This account is already linked to this entity.', 400);

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now()/1000);
    const sql = `
      INSERT INTO ${this.TABLE_NAME} (
        id,user_id,entity_id,account_id,custom_name,is_active,recovery_type,recovery_percentage,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
    `;
    const params = [
      id, userId, data.entity_id, data.account_id, data.custom_name || null,
      data.is_active === false ? 0 : 1,
      data.recovery_type || null,
      data.recovery_percentage == null ? account.recovery_percentage : data.recovery_percentage,
      now, now
    ];
    try {
      const result = await this.db.execute(sql, params);
      if (!result.success) throw new AppError(ErrorCode.DATABASE_ERROR, result.error || 'Failed to create mapping.', 500);
      const newLink = await this.getEntityAccountById(id, userId);
      if (!newLink) throw new AppError(ErrorCode.DATABASE_ERROR, 'Mapping created but not retrievable.', 500);
      return newLink;
    } catch (err: unknown) {
      console.error('EntityAccountService.createEntityAccount error:', err);
      throw err instanceof AppError ? err : new AppError(ErrorCode.DATABASE_ERROR, 'Unexpected error creating mapping.', 500, err);
    }
  }

  /**
   * Updates an existing mapping, converting flags.
   */
  async updateEntityAccount(id: string, data: Partial<{ custom_name: string | null; is_active: boolean; recovery_type: string | null; recovery_percentage: number | null; }>, userId: string): Promise<AppEntityAccount> {
    const existing = await this.getEntityAccountById(id, userId);
    if (!existing) throw new AppError(ErrorCode.NOT_FOUND, 'Mapping not found or access denied.', 404);
    const fields: string[] = [];
    const vals: any[] = [];
    const now = Math.floor(Date.now()/1000);
    const add = (key: string, val: any) => { fields.push(`${key}=?`); vals.push(val); };
    if (data.custom_name !== undefined) add('custom_name', data.custom_name);
    if (data.is_active !== undefined) add('is_active', data.is_active ? 1 : 0);
    if (data.recovery_type !== undefined) add('recovery_type', data.recovery_type);
    if (data.recovery_percentage !== undefined) add('recovery_percentage', data.recovery_percentage);
    if (fields.length === 0) return existing;
    fields.push('updated_at=?'); vals.push(now);
    const sql = `UPDATE ${this.TABLE_NAME} SET ${fields.join(',')} WHERE id=? AND user_id=?`;
    const params = [...vals, id, userId];
    try {
      const result = await this.db.execute(sql, params);
      if (!result.success) throw new AppError(ErrorCode.DATABASE_ERROR, result.error || 'Failed to update mapping.', 500);
      const updated = await this.getEntityAccountById(id, userId);
      if (!updated) throw new AppError(ErrorCode.DATABASE_ERROR, 'Mapping updated but not retrievable.', 500);
      return updated;
    } catch (err: unknown) {
      console.error('EntityAccountService.updateEntityAccount error:', err);
      throw err instanceof AppError ? err : new AppError(ErrorCode.DATABASE_ERROR, 'Unexpected error updating mapping.', 500, err);
    }
  }

  /**
   * Deletes a mapping.
   */
  async deleteEntityAccount(id: string, userId: string): Promise<boolean> {
    const existing = await this.getEntityAccountById(id, userId);
    if (!existing) throw new AppError(ErrorCode.NOT_FOUND, 'Mapping not found or access denied.', 404);
    const sql = `DELETE FROM ${this.TABLE_NAME} WHERE id=? AND user_id=?`;
    try {
      const res = await this.db.execute(sql, [id, userId]);
      return res.success && ((res.meta?.changes||0)>0);
    } catch (err: unknown) {
      console.error('EntityAccountService.deleteEntityAccount error:', err);
      throw err instanceof AppError ? err : new AppError(ErrorCode.DATABASE_ERROR, 'Unexpected error deleting mapping.', 500, err);
    }
  }

  /**
   * Links all active accounts from CoA to entity, idempotently.
   */
  async initializeEntityAccounts(entityId: string, userId: string): Promise<number> {
    await this.entityService.getEntityById(entityId, userId);
    const allAccounts = await this.accountService.getAllAccounts(userId);
    const existing = await this.getAccountsForEntity(entityId, userId);
    const existingIds = new Set(existing.map(e=>e.account_id));
    const toLink = allAccounts.filter(a => a.is_active && !existingIds.has(a.id));
    if (toLink.length===0) return 0;
    const now = Math.floor(Date.now()/1000);
    const ops: D1PreparedStatement[] = [];
    for (const a of toLink) {
      const linkId = crypto.randomUUID();
      const sql = `
        INSERT INTO ${this.TABLE_NAME} (
          id,user_id,entity_id,account_id,custom_name,is_active,recovery_type,recovery_percentage,created_at,updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?)
      `;
      ops.push(
        this.db.d1Instance.prepare(sql).bind(
          linkId,userId,entityId,a.id,null,1,null,a.recovery_percentage,now,now
        )
      );
    }
    let count=0;
    try {
      const results = await this.db.batch(ops);
      results.forEach(r=>{ if (r.success&&r.meta?.changes) count+=r.meta.changes; });
      return count;
    } catch (err: unknown) {
      console.error('EntityAccountService.initializeEntityAccounts batch error:', err);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to initialize entity accounts.', 500, err);
    }
  }
}

export function createEntityAccountService(d1: D1Database): EntityAccountService {
  return new EntityAccountService(d1);
}