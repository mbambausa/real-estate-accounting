// tests/unit/account.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountService, createAccountService, type ChartOfAccountInput } from '../../src/lib/services/account-service';
import type { DbChartOfAccount, AccountSystemType } from '../../src/db/schema';
import { AppError, ErrorCode } from '../../src/utils/errors';
import type { D1Database, D1PreparedStatement, D1Result } from '@cloudflare/workers-types';
import { defaultChartOfAccounts } from '../../src/lib/accounting/chartOfAccounts'; 
import type { ChartOfAccountsItem } from '../../src/lib/accounting/chartOfAccounts';

const mockDbQuery = vi.fn();
const mockDbQueryOne = vi.fn();
const mockDbExecute = vi.fn();
const mockDbBatch = vi.fn();
const mockD1Prepare = vi.fn();
const mockD1Bind = vi.fn();

const mockPreparedStatement = {
  bind: mockD1Bind,
  // Add other methods like first(), all(), run() if your service's batch operations use them on prepared statements directly
};
mockD1Prepare.mockReturnValue(mockPreparedStatement);
mockD1Bind.mockReturnThis(); // Assuming bind is chainable or returns the statement; adjust if it returns Promise<D1Result>

vi.mock('@db/db', () => ({
  createDbClient: vi.fn(() => ({
    query: mockDbQuery,
    queryOne: mockDbQueryOne,
    execute: mockDbExecute,
    batch: mockDbBatch,
    d1Instance: { 
        prepare: mockD1Prepare,
    }
  })),
}));

const mockD1Instance = {} as D1Database;
const testUserId = 'user-unit-test-123';
const now = Math.floor(Date.now() / 1000);

// Helper to create a complete mock DbChartOfAccount - fixed to avoid duplicate properties
const createMockDbChartOfAccount = (
    overrides: Partial<DbChartOfAccount> & { id: string; user_id: string; code: string; name: string; type: AccountSystemType }
): DbChartOfAccount => {
    // Extract is_active and is_recoverable from overrides to handle them separately
    const { is_active, is_recoverable, ...restOverrides } = overrides;
    
    // Convert boolean values to numeric if needed
    const numericIsActive = typeof is_active === 'boolean' 
        ? (is_active ? 1 : 0) 
        : (is_active ?? 1);
    
    const numericIsRecoverable = typeof is_recoverable === 'boolean' 
        ? (is_recoverable ? 1 : 0) 
        : (is_recoverable ?? 0);
    
    return {
        subtype: null,
        description: null,
        recovery_percentage: null,
        tax_category: null,
        parent_id: null,
        created_at: overrides.created_at || now,
        updated_at: overrides.updated_at || now,
        ...restOverrides,
        is_active: numericIsActive,
        is_recoverable: numericIsRecoverable,
    };
};

describe('AccountService', () => {
  let accountService: AccountService;

  beforeEach(() => {
    vi.clearAllMocks();
    accountService = createAccountService(mockD1Instance);
    mockD1Prepare.mockClear().mockReturnValue(mockPreparedStatement);
    mockD1Bind.mockClear().mockReturnThis();
  });

  describe('getAllAccounts', () => {
    it('should return all accounts for a user', async () => {
      const mockAccountsData = [
        { id: 'acc-1', user_id: testUserId, code: '1010', name: 'Cash', type: 'asset' as AccountSystemType, is_active: 1, is_recoverable: 0 },
        { id: 'acc-2', user_id: testUserId, code: '5010', name: 'Rent Expense', type: 'expense' as AccountSystemType, is_active: 1, is_recoverable: 0 },
      ];
      const mockAccounts = mockAccountsData.map(e => createMockDbChartOfAccount(e));
      mockDbQuery.mockResolvedValue(mockAccounts);

      const result = await accountService.getAllAccounts(testUserId);
      expect(mockDbQuery).toHaveBeenCalledWith(expect.stringMatching(/FROM chart_of_accounts WHERE user_id = \?/), [testUserId]);
      expect(result).toEqual(mockAccounts);
    });
  });

  describe('getAccountById', () => {
    it('should return an account by its ID for the user', async () => {
      const mockAccountId = 'acc-uuid-123';
      const mockAccountData = { id: mockAccountId, user_id: testUserId, code: '1010', name: 'Cash', type: 'asset' as AccountSystemType };
      const mockAccount = createMockDbChartOfAccount(mockAccountData);
      mockDbQueryOne.mockResolvedValue(mockAccount);

      const result = await accountService.getAccountById(mockAccountId, testUserId);
      expect(mockDbQueryOne).toHaveBeenCalledWith(expect.stringMatching(/WHERE id = \? AND user_id = \?/), [mockAccountId, testUserId]);
      expect(result).toEqual(mockAccount);
    });
  });

  describe('createAccount', () => {
    const accountInput: ChartOfAccountInput = { code: '1020', name: 'New Bank', type: 'asset', is_active: true, is_recoverable: false };
    
    it('should create and return a new account', async () => {
      mockDbQueryOne.mockResolvedValueOnce(null); 
      mockDbExecute.mockResolvedValue({ success: true, meta: { changes: 1 } });
      
      mockDbQueryOne.mockImplementationOnce(async (sql, params) => {
        return createMockDbChartOfAccount({ 
            id: params[0] as string, 
            user_id: testUserId, 
            code: accountInput.code,
            name: accountInput.name,
            type: accountInput.type,
            is_active: accountInput.is_active ? 1 : 0, 
            is_recoverable: accountInput.is_recoverable ? 1 : 0,
        });
      });

      const result = await accountService.createAccount(accountInput, testUserId);
      expect(result.code).toBe(accountInput.code);
      expect(result.id).toEqual(expect.any(String));
      expect(result.is_active).toBe(1);
      expect(result.is_recoverable).toBe(0);
    });
  });

  describe('updateAccount', () => {
    const accountId = 'acc-to-update-uuid';
    const existingAccountData = { id: accountId, user_id: testUserId, code: '3010', name: 'Old Equity', type: 'equity' as AccountSystemType, is_active: 1 };
    const existingAccount = createMockDbChartOfAccount(existingAccountData);
    const updateData: Partial<ChartOfAccountInput> = { name: 'Updated Equity Name', is_active: false }; // boolean is_active

    it('should update and return the account', async () => {
      mockDbQueryOne.mockResolvedValueOnce(existingAccount); 
      mockDbExecute.mockResolvedValue({ success: true, meta: { changes: 1 } });
      
      const expectedUpdatedDbAccount = createMockDbChartOfAccount({
          ...existingAccountData,
          id: accountId, // ensure id is passed from existing data
          name: 'Updated Equity Name', 
          is_active: 0, // from updateData.is_active: false, converted to number
          updated_at: expect.any(Number) 
      });
      mockDbQueryOne.mockResolvedValueOnce(expectedUpdatedDbAccount);

      const result = await accountService.updateAccount(accountId, updateData, testUserId);
      expect(mockDbExecute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE chart_of_accounts SET name = ?, is_active = ?, updated_at = ? WHERE id = ? AND user_id = ?'),
        ['Updated Equity Name', 0, expect.any(Number), accountId, testUserId] // is_active is 0
      );
      expect(result.name).toBe('Updated Equity Name');
      expect(result.is_active).toBe(0); // Check numeric is_active
    });
  });

  describe('deleteAccount', () => {
    const accountId = 'acc-to-delete-uuid';
    const existingAccountData = { id: accountId, user_id: testUserId, code: '7070', name: 'ToDelete', type: 'expense' as AccountSystemType };
    const existingAccount = createMockDbChartOfAccount(existingAccountData);
    
    it('should throw VALIDATION_ERROR if account has child accounts', async () => {
      mockDbQueryOne.mockResolvedValueOnce(existingAccount); 
      const childAccountData = { 
          id: 'child-acc-id', 
          user_id: testUserId, 
          code: '7071', 
          name: 'Child of ToDelete', 
          type: 'expense' as AccountSystemType, 
          parent_id: accountId // Correct: only one parent_id
      };
      mockDbQueryOne.mockResolvedValueOnce(createMockDbChartOfAccount(childAccountData)); 

      await expect(accountService.deleteAccount(accountId, testUserId))
        .rejects.toThrow(new AppError(ErrorCode.VALIDATION_ERROR, 'Cannot delete account that is a parent to other accounts. Reassign child accounts first.'));
    });
  });
  
  // ... (initializeDefaultAccounts and getAccountHierarchy tests should be fine with earlier corrections)
  describe('initializeDefaultAccounts', () => {
    it('should insert default accounts if none exist for the user', async () => {
      mockDbQuery.mockResolvedValueOnce([]); 
      const mockD1Results: D1Result[] = defaultChartOfAccounts.map(() => ({ success: true, meta: { changes: 1 } } as D1Result));
      mockDbBatch.mockResolvedValue(mockD1Results);

      const result = await accountService.initializeDefaultAccounts(testUserId);
      
      expect(mockDbBatch).toHaveBeenCalled();
      const batchOps = mockDbBatch.mock.calls[0][0] as D1PreparedStatement[];
      expect(batchOps.length).toBe(defaultChartOfAccounts.length);
      expect(mockD1Prepare).toHaveBeenCalledTimes(defaultChartOfAccounts.length);
      expect(result).toBe(defaultChartOfAccounts.length);
    });
  });
  
  describe('getAccountHierarchy', () => {
    it('should build and return a hierarchical structure of accounts', async () => {
      const rootAssetData = {id: 'asset-root-id', user_id: testUserId, code: '1000', name: 'Assets', type: 'asset' as AccountSystemType, parent_id: null};
      const childCashData = {id: 'cash-id', user_id: testUserId, code: '1010', name: 'Cash', type: 'asset' as AccountSystemType, parent_id: 'asset-root-id'};
      const rootExpenseData = {id: 'expense-root-id', user_id: testUserId, code: '5000', name: 'Expenses', type: 'expense' as AccountSystemType, parent_id: null};
      
      const mockAccounts = [
          createMockDbChartOfAccount(rootAssetData),
          createMockDbChartOfAccount(childCashData),
          createMockDbChartOfAccount(rootExpenseData)
      ];
      mockDbQuery.mockResolvedValue(mockAccounts);

      const hierarchy = await accountService.getAccountHierarchy(testUserId);
      
      expect(hierarchy.length).toBe(2);
      const assetsNode = hierarchy.find(n => n.id === 'asset-root-id') as DbChartOfAccount & { children?: DbChartOfAccount[] };
      expect(assetsNode).toBeDefined();
      expect(assetsNode!.children).toBeDefined();
      expect(assetsNode!.children!.length).toBe(1);
      expect(assetsNode!.children![0].id).toBe('cash-id');
    });
  });
});