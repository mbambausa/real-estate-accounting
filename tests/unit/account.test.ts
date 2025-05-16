// tests/unit/account.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountService, createAccountService, type ChartOfAccountInput } from '../../src/lib/services/account-service';
import type { DbChartOfAccount, AccountSystemType } from '../../src/db/schema';
import { AppError, ErrorCode } from '../../src/utils/errors';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { defaultChartOfAccounts } from '../../src/lib/accounting/core/chartOfAccounts'; // For initialize test

// Mock the Database wrapper from '@/db/db'
const mockDbQuery = vi.fn();
const mockDbQueryOne = vi.fn();
const mockDbExecute = vi.fn();
const mockDbBatch = vi.fn();
const mockD1Prepare = vi.fn().mockReturnThis(); // For batch operations
const mockD1Bind = vi.fn().mockReturnThis();   // For batch operations

vi.mock('@db/db', () => ({
  createDbClient: vi.fn(() => ({
    query: mockDbQuery,
    queryOne: mockDbQueryOne,
    execute: mockDbExecute,
    batch: mockDbBatch,
    d1Instance: { // Mock the d1Instance to return a mock prepare
        prepare: mockD1Prepare,
    }
  })),
}));

// Mock D1Database type for constructor
const mockD1Instance = {} as D1Database;

describe('AccountService', () => {
  let accountService: AccountService;
  const testUserId = 'user-unit-test-123';
  const now = Math.floor(Date.now() / 1000);
  const mockAccountId = 'acc-uuid-123';

  beforeEach(() => {
    vi.clearAllMocks();
    accountService = createAccountService(mockD1Instance);
    // Reset mocks for D1PreparedStatement chain used in batch
    mockD1Prepare.mockClear().mockReturnThis();
    mockD1Bind.mockClear().mockReturnThis();
  });

  describe('getAllAccounts', () => {
    it('should return all accounts for a user', async () => {
      const mockAccounts: DbChartOfAccount[] = [
        { id: 'acc-1', user_id: testUserId, code: '1010', name: 'Cash', type: 'asset', is_active: 1, is_recoverable: 0, created_at: now, updated_at: now },
        { id: 'acc-2', user_id: testUserId, code: '5010', name: 'Rent Expense', type: 'expense', is_active: 1, is_recoverable: 0, created_at: now, updated_at: now },
      ];
      mockDbQuery.mockResolvedValue(mockAccounts);

      const result = await accountService.getAllAccounts(testUserId);
      expect(mockDbQuery).toHaveBeenCalledWith(expect.stringContaining('FROM chart_of_accounts WHERE user_id = ?'), [testUserId]);
      expect(result).toEqual(mockAccounts);
    });
  });

  describe('getAccountById', () => {
    it('should return an account by its ID for the user', async () => {
      const mockAccount: DbChartOfAccount = { id: mockAccountId, user_id: testUserId, code: '1010', name: 'Cash', type: 'asset', is_active: 1, is_recoverable: 0, created_at: now, updated_at: now };
      mockDbQueryOne.mockResolvedValue(mockAccount);

      const result = await accountService.getAccountById(mockAccountId, testUserId);
      expect(mockDbQueryOne).toHaveBeenCalledWith(expect.stringContaining('WHERE id = ? AND user_id = ?'), [mockAccountId, testUserId]);
      expect(result).toEqual(mockAccount);
    });

    it('should return null if account not found by ID', async () => {
      mockDbQueryOne.mockResolvedValue(null);
      const result = await accountService.getAccountById('non-existent-id', testUserId);
      expect(result).toBeNull();
    });
  });

  describe('getAccountByCode', () => {
    it('should return an account by its code for the user', async () => {
      const mockAccount: DbChartOfAccount = { id: mockAccountId, user_id: testUserId, code: '1010', name: 'Cash', type: 'asset', is_active: 1, is_recoverable: 0, created_at: now, updated_at: now };
      mockDbQueryOne.mockResolvedValue(mockAccount);

      const result = await accountService.getAccountByCode('1010', testUserId);
      expect(mockDbQueryOne).toHaveBeenCalledWith(expect.stringContaining('WHERE code = ? AND user_id = ?'), ['1010', testUserId]);
      expect(result).toEqual(mockAccount);
    });
  });

  describe('createAccount', () => {
    const accountInput: ChartOfAccountInput = { code: '1020', name: 'New Bank', type: 'asset', is_active: true };
    
    it('should create and return a new account', async () => {
      mockDbQueryOne.mockResolvedValueOnce(null); // For existing account by code check
      mockDbExecute.mockResolvedValue({ success: true, meta: { changes: 1 } });
      // For the getAccountById call after creation
      mockDbQueryOne.mockImplementationOnce(async (sql, params) => {
         // The first param is the generated UUID
        return { id: params[0] as string, user_id: testUserId, ...accountInput, is_recoverable: 0, created_at: now, updated_at: now, is_active: 1 };
      });


      const result = await accountService.createAccount(accountInput, testUserId);
      expect(mockDbExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chart_of_accounts'),
        expect.arrayContaining([testUserId, accountInput.code, accountInput.name, accountInput.type])
      );
      expect(result.code).toBe(accountInput.code);
      expect(result.id).toEqual(expect.any(String)); // UUID
    });

    it('should throw VALIDATION_ERROR if account code already exists for user', async () => {
      const existingAccount: DbChartOfAccount = { id: 'acc-existing', user_id: testUserId, code: '1020', name: 'Old Bank', type: 'asset', is_active: 1, is_recoverable: 0, created_at: now, updated_at: now };
      mockDbQueryOne.mockResolvedValue(existingAccount); // Simulate code already exists

      await expect(accountService.createAccount(accountInput, testUserId))
        .rejects.toThrow(AppError);
      await expect(accountService.createAccount(accountInput, testUserId))
        .rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR, message: expect.stringContaining('already exists') });
    });

    it('should throw VALIDATION_ERROR if parent_id does not exist for user', async () => {
      const inputWithParent: ChartOfAccountInput = { ...accountInput, parent_id: 'non-existent-parent-id' };
      mockDbQueryOne.mockResolvedValueOnce(null); // For existing code check (pass)
      mockDbQueryOne.mockResolvedValueOnce(null); // For parent_id check (fail)

      await expect(accountService.createAccount(inputWithParent, testUserId))
        .rejects.toThrow(AppError);
      await expect(accountService.createAccount(inputWithParent, testUserId))
        .rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR, message: expect.stringContaining('Parent account not found') });
    });
  });

  describe('updateAccount', () => {
    const accountId = 'acc-to-update-uuid';
    const existingAccount: DbChartOfAccount = { id: accountId, user_id: testUserId, code: '3010', name: 'Old Equity', type: 'equity', is_active: 1, is_recoverable: 0, created_at: now, updated_at: now };
    const updateData: Partial<ChartOfAccountInput> = { name: 'Updated Equity Name', is_active: false };

    it('should update and return the account', async () => {
      mockDbQueryOne.mockResolvedValueOnce(existingAccount); // Initial getAccountById
      mockDbExecute.mockResolvedValue({ success: true, meta: { changes: 1 } });
      mockDbQueryOne.mockResolvedValueOnce({ // getAccountById after update
        ...existingAccount, 
        name: 'Updated Equity Name', 
        is_active: 0, 
        updated_at: expect.any(Number) 
      });

      const result = await accountService.updateAccount(accountId, updateData, testUserId);
      expect(mockDbExecute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE chart_of_accounts SET name = ?, is_active = ?, updated_at = ? WHERE id = ? AND user_id = ?'),
        ['Updated Equity Name', 0, expect.any(Number), accountId, testUserId]
      );
      expect(result.name).toBe('Updated Equity Name');
      expect(result.is_active).toBe(0);
    });

    it('should throw NOT_FOUND if account to update does not exist', async () => {
      mockDbQueryOne.mockResolvedValue(null); // Initial getAccountById fails
      await expect(accountService.updateAccount(accountId, updateData, testUserId))
        .rejects.toThrow(AppError);
      await expect(accountService.updateAccount(accountId, updateData, testUserId))
        .rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    });

     it('should throw VALIDATION_ERROR if trying to set parent_id to self', async () => {
      mockDbQueryOne.mockResolvedValueOnce(existingAccount); // Initial getAccountById
      const selfParentUpdate: Partial<ChartOfAccountInput> = { parent_id: accountId };
      
      // The service's updateAccount method in account_service_ts_updated_v1 has this check:
      // if (accountData.parent_id === accountId) { ... }
      // So, no further DB mocks are needed for this specific path.
      await expect(accountService.updateAccount(accountId, selfParentUpdate, testUserId))
        .rejects.toThrow(AppError);
      await expect(accountService.updateAccount(accountId, selfParentUpdate, testUserId))
        .rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR, message: 'An account cannot be its own parent.'});
    });
  });

  describe('deleteAccount', () => {
    const accountId = 'acc-to-delete-uuid';
    const existingAccount: DbChartOfAccount = { id: accountId, user_id: testUserId, code: '7070', name: 'ToDelete', type: 'expense', is_active: 1, is_recoverable: 0, created_at: now, updated_at: now };

    it('should delete an account successfully', async () => {
      mockDbQueryOne.mockResolvedValueOnce(existingAccount); // For getAccountById
      mockDbQueryOne.mockResolvedValueOnce(null); // For checking child accounts (SELECT id FROM chart_of_accounts WHERE parent_id = ? ...)
      mockDbExecute.mockResolvedValue({ success: true, meta: { changes: 1 } });

      const result = await accountService.deleteAccount(accountId, testUserId);
      expect(result).toBe(true);
      expect(mockDbExecute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM chart_of_accounts WHERE id = ? AND user_id = ?'), [accountId, testUserId]);
    });
    
    it('should throw VALIDATION_ERROR if account has child accounts', async () => {
      mockDbQueryOne.mockResolvedValueOnce(existingAccount); // For getAccountById
      mockDbQueryOne.mockResolvedValueOnce({ id: 'child-acc-id', user_id: testUserId, code: '7071', name: 'Child of ToDelete', type: 'expense', parent_id: accountId, is_active: 1, is_recoverable: 0, created_at: now, updated_at: now }); // Has a child

      await expect(accountService.deleteAccount(accountId, testUserId))
        .rejects.toThrow(AppError);
      await expect(accountService.deleteAccount(accountId, testUserId))
        .rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR, message: expect.stringContaining('Cannot delete account that is a parent')});
    });
  });
  
  describe('initializeDefaultAccounts', () => {
    it('should insert default accounts if none exist for the user', async () => {
      mockDbQuery.mockResolvedValueOnce([]); // getAllAccounts returns empty, so initialization proceeds
      mockDbBatch.mockResolvedValue(defaultChartOfAccounts.map(() => ({ success: true, meta: { changes: 1 } } as D1Result))); // Mock batch success

      const result = await accountService.initializeDefaultAccounts(testUserId);
      
      expect(mockDbBatch).toHaveBeenCalled();
      const batchOps = mockDbBatch.mock.calls[0][0] as D1PreparedStatement[];
      expect(batchOps.length).toBe(defaultChartOfAccounts.length);
      // Check one of the prepared statements for user_id binding
      // This is tricky because bind() is chained. We check if d1Instance.prepare was called.
      expect(mockD1Prepare).toHaveBeenCalledTimes(defaultChartOfAccounts.length);
      // Further inspection of `mockD1Bind.mock.calls` could verify params if needed, but it's complex.
      expect(result).toBe(defaultChartOfAccounts.length);
    });

    it('should not insert default accounts if accounts already exist for the user', async () => {
      const mockExistingAccounts: DbChartOfAccount[] = [
        { id: 'some-id', user_id: testUserId, code: defaultChartOfAccounts[0].code, name: 'Existing', type: 'asset', is_active: 1, is_recoverable: 0, created_at: now, updated_at: now }
      ];
      mockDbQuery.mockResolvedValueOnce(mockExistingAccounts); // getAllAccounts returns existing accounts

      const result = await accountService.initializeDefaultAccounts(testUserId);
      expect(mockDbBatch).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });
  
  describe('getAccountHierarchy', () => {
    it('should build and return a hierarchical structure of accounts', async () => {
      const rootAsset: DbChartOfAccount = {id: 'asset-root-id', user_id: testUserId, code: '1000', name: 'Assets', type: 'asset', parent_id: null, is_active: 1, is_recoverable: 0, created_at: now, updated_at: now};
      const childCash: DbChartOfAccount = {id: 'cash-id', user_id: testUserId, code: '1010', name: 'Cash', type: 'asset', parent_id: 'asset-root-id', is_active: 1, is_recoverable: 0, created_at: now, updated_at: now};
      const rootExpense: DbChartOfAccount = {id: 'expense-root-id', user_id: testUserId, code: '5000', name: 'Expenses', type: 'expense', parent_id: null, is_active: 1, is_recoverable: 0, created_at: now, updated_at: now};
      mockDbQuery.mockResolvedValue([rootAsset, childCash, rootExpense]); // Mock getAllAccounts

      const hierarchy = await accountService.getAccountHierarchy(testUserId);
      
      expect(hierarchy.length).toBe(2); // Root: Assets, Expenses
      const assetsNode = hierarchy.find(n => n.id === 'asset-root-id');
      expect(assetsNode).toBeDefined();
      expect((assetsNode as any).children.length).toBe(1);
      expect((assetsNode as any).children[0].id).toBe('cash-id');
    });
  });
});
