// tests/unit/api/accountsApi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import { GET as getAllAccounts, POST as createAccount } from '../../../src/functions/api/accounts/index';
import { GET as getAccountById, PUT as updateAccountById, DELETE as deleteAccountById } from '../../../src/functions/api/accounts/[id]';
import { AppError, ErrorCode } from '../../../src/utils/errors';
import type { RuntimeEnv } from '../../../src/env.d';
import type { ChartOfAccountInput } from '../../../src/lib/services/account-service';
import type { DbChartOfAccount, AccountSystemType } from '../../../src/db/schema'; // Added AccountSystemType
import * as zodSchemas from '../../../src/functions/api/utils/zodSchemas'; // For typing the mock

const mockAccountService = {
  getAllAccounts: vi.fn(),
  getAccountById: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
};

vi.mock('@lib/services/account-service', () => ({
  createAccountService: vi.fn(() => mockAccountService),
}));

const mockValidateRequestBody = vi.fn();
// Corrected vi.mock for zodSchemas
vi.mock('@functions/api/utils/zodSchemas', async () => {
    const actualModule = await vi.importActual<typeof import('../../../src/functions/api/utils/zodSchemas')>('../../../src/functions/api/utils/zodSchemas');
    return {
      ...actualModule, // Spread actual module exports
      validateRequestBody: mockValidateRequestBody, // Override only validateRequestBody
    };
});

const testUserId = 'test-user-id-123';
const mockRuntimeEnv: Partial<RuntimeEnv> = {
  DB: {} as any, 
};

// Helper to create a full DbChartOfAccount mock object
const createFullDbChartOfAccountMock = (
    data: Partial<DbChartOfAccount> & { id: string; code: string; name: string; type: AccountSystemType }
): DbChartOfAccount => {
    // Extract boolean fields to convert them to numbers
    const { is_active, is_recoverable, ...restData } = data;
    
    // Convert to number values if they're booleans
    const numericIsActive = typeof is_active === 'boolean' 
        ? (is_active ? 1 : 0) 
        : (is_active ?? 1);
        
    const numericIsRecoverable = typeof is_recoverable === 'boolean' 
        ? (is_recoverable ? 1 : 0) 
        : (is_recoverable ?? 0);
        
    return {
        user_id: testUserId,
        subtype: null,
        description: null,
        recovery_percentage: null,
        is_active: numericIsActive,
        is_recoverable: numericIsRecoverable,
        tax_category: null,
        parent_id: null,
        created_at: Date.now() / 1000,
        updated_at: Date.now() / 1000,
        ...restData,
    };
};

const createMockApiContext = (
  method: string = 'GET',
  body: any = null,
  params: Record<string, string | undefined> = {},
  user: { id: string; role?: string; email?: string; name?: string } | null = { id: testUserId } // Updated user type to match AppUser more closely
): APIContext => {
  const requestUrl = `http://localhost/api/accounts${params.id ? `/${params.id}` : ''}`;
  const request = new Request(requestUrl, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    request,
    params,
    locals: {
      user: user,
      session: user ? { user: user, expires: '' } : null, // Basic mock session
      runtime: {
        env: mockRuntimeEnv as RuntimeEnv,
        ctx: {} as any, 
        cf: {} as any,  
      },
      // csrfToken can be added if needed for POST/PUT tests not using API routes that skip CSRF
    },
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn(), has: vi.fn(), getAll: vi.fn(), serialize: vi.fn()},
    redirect: vi.fn(),
    url: new URL(requestUrl),
    clientAddress: '127.0.0.1',
    site: new URL('http://localhost'),
    generator: 'Astro vX.Y.Z', // Example value
    props: {},
    slots: { has: vi.fn(), render: vi.fn() },
    // astroGlobal: {} as any, // Deprecated, ensure your Astro version doesn't need this
  } as unknown as APIContext; 
};


describe('Accounts API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/accounts', () => {
    it('should return 401 if user is not authenticated', async () => {
      const context = createMockApiContext('GET', null, {}, null); 
      const response = await getAllAccounts(context);
      expect(response.status).toBe(401);
      const json = await response.json() as { error: string }; // Type assertion
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 200 and list of accounts for authenticated user', async () => {
      const mockAccountsData = [
        { id: '1', code: '1010', name: 'Cash', type: 'asset' as AccountSystemType, is_active: 1, is_recoverable: 0 }
      ];
      const mockAccounts = mockAccountsData.map(d => createFullDbChartOfAccountMock(d));
      mockAccountService.getAllAccounts.mockResolvedValue(mockAccounts);
      const context = createMockApiContext();
      
      const response = await getAllAccounts(context);
      expect(response.status).toBe(200);
      const json = await response.json() as DbChartOfAccount[]; // Type assertion
      expect(json).toEqual(mockAccounts);
      expect(mockAccountService.getAllAccounts).toHaveBeenCalledWith(testUserId);
    });

    it('should return 500 if service throws an error', async () => {
        mockAccountService.getAllAccounts.mockRejectedValue(new AppError(ErrorCode.DATABASE_ERROR, "DB fail", 500));
        const context = createMockApiContext();
        const response = await getAllAccounts(context);
        expect(response.status).toBe(500);
        const json = await response.json() as { error: string }; // Type assertion
        expect(json.error).toBe('DB fail');
    });
  });

  describe('POST /api/accounts', () => {
    const accountInput: ChartOfAccountInput = { code: '1020', name: 'New Account', type: 'asset' };
    
    // Create a partial DB account with numeric values for is_active/is_recoverable
    const createdAccountMock = {
        id: 'new-acc-id',
        code: accountInput.code,
        name: accountInput.name,
        type: accountInput.type as AccountSystemType,
        is_active: 1,  // numeric representation
        is_recoverable: 0  // numeric representation
    };
    
    // Use the helper function to create a complete mock
    const createdAccount = createFullDbChartOfAccountMock(createdAccountMock);

    it('should return 401 if user is not authenticated', async () => {
      const context = createMockApiContext('POST', accountInput, {}, null);
      const response = await createAccount(context);
      expect(response.status).toBe(401);
    });

    it('should return 201 and created account for valid data', async () => {
      mockValidateRequestBody.mockResolvedValue(accountInput);
      mockAccountService.createAccount.mockResolvedValue(createdAccount);
      const context = createMockApiContext('POST', accountInput);

      const response = await createAccount(context);
      expect(mockValidateRequestBody).toHaveBeenCalledWith(context.request, zodSchemas.chartOfAccountInputSchema);
      expect(mockAccountService.createAccount).toHaveBeenCalledWith(accountInput, testUserId);
      expect(response.status).toBe(201);
      const responseJson = await response.json() as DbChartOfAccount;
      expect(responseJson).toEqual(createdAccount);
    });

    it('should return 400 if validation fails', async () => {
      const validationErrorDetails = { code: ["Code is bad"] };
      const validationError = new AppError(ErrorCode.VALIDATION_ERROR, "Validation failed", 400, validationErrorDetails);
      mockValidateRequestBody.mockRejectedValue(validationError);
      const context = createMockApiContext('POST', { code: 'bad' }); 

      const response = await createAccount(context);
      expect(response.status).toBe(400);
      const json = await response.json() as { error: string, details: any }; // Type assertion
      expect(json.error).toBe("Validation failed");
      expect(json.details).toEqual(validationErrorDetails);
    });
  });

  describe('GET /api/accounts/[id]', () => {
    const accountId = 'acc-test-id';
    it('should return 401 if unauthenticated', async () => {
        const context = createMockApiContext('GET', null, { id: accountId }, null);
        const response = await getAccountById(context);
        expect(response.status).toBe(401);
    });

    it('should return 200 and the account if found', async () => {
        const mockAccountData = { 
            id: accountId, 
            name: 'Test Account', 
            code: 'T01', 
            type: 'asset' as AccountSystemType, 
            is_active: 1, 
            is_recoverable: 0
        };
        const mockAccount = createFullDbChartOfAccountMock(mockAccountData);
        mockAccountService.getAccountById.mockResolvedValue(mockAccount);
        const context = createMockApiContext('GET', null, { id: accountId });
        const response = await getAccountById(context);
        expect(response.status).toBe(200);
        const responseJson = await response.json() as DbChartOfAccount;
        expect(responseJson).toEqual(mockAccount);
        expect(mockAccountService.getAccountById).toHaveBeenCalledWith(accountId, testUserId);
    });

    it('should return 404 if account not found', async () => {
        mockAccountService.getAccountById.mockResolvedValue(null);
        const context = createMockApiContext('GET', null, { id: 'not-found-id' });
        const response = await getAccountById(context);
        expect(response.status).toBe(404);
        const json = await response.json() as { error: string }; // Type assertion
        expect(json.error).toBe('Account not found or access denied.');
    });
  });

  describe('PUT /api/accounts/[id]', () => {
    const accountId = 'acc-to-update';
    const updateData: Partial<ChartOfAccountInput> = { name: 'Updated Name' };
    
    // Using numeric values for is_active/is_recoverable
    const updatedAccountMock = {
        id: accountId, 
        name: 'Updated Name', 
        code: 'U01', 
        type: 'asset' as AccountSystemType,
        is_active: 1,
        is_recoverable: 0
    };
    
    const updatedDbAccount = createFullDbChartOfAccountMock(updatedAccountMock);

    it('should return 200 and updated account for valid data', async () => {
        mockValidateRequestBody.mockResolvedValue(updateData);
        mockAccountService.updateAccount.mockResolvedValue(updatedDbAccount);
        const context = createMockApiContext('PUT', updateData, { id: accountId });
        
        const response = await updateAccountById(context);
        expect(response.status).toBe(200);
        const responseJson = await response.json() as DbChartOfAccount;
        expect(responseJson).toEqual(updatedDbAccount);
        // Pass zodSchemas.partialChartOfAccountInputSchema to validateRequestBody mock check
        expect(mockValidateRequestBody).toHaveBeenCalledWith(context.request, zodSchemas.partialChartOfAccountInputSchema);
        expect(mockAccountService.updateAccount).toHaveBeenCalledWith(accountId, updateData, testUserId);
    });
  });

  describe('DELETE /api/accounts/[id]', () => {
    const accountId = 'acc-to-delete';
    it('should return 200 and success message on successful deletion', async () => {
        mockAccountService.deleteAccount.mockResolvedValue(true);
        const context = createMockApiContext('DELETE', null, { id: accountId });

        const response = await deleteAccountById(context);
        expect(response.status).toBe(200);
        const responseJson = await response.json() as { message: string };
        expect(responseJson).toEqual({ message: 'Account deleted successfully.' });
        expect(mockAccountService.deleteAccount).toHaveBeenCalledWith(accountId, testUserId);
    });

    it('should return 500 if delete service returns false', async () => {
        mockAccountService.deleteAccount.mockResolvedValue(false);
        const context = createMockApiContext('DELETE', null, { id: accountId });
        const response = await deleteAccountById(context);
        expect(response.status).toBe(500);
        const json = await response.json() as { error: string }; // Type assertion
        expect(json.error).toBe('Failed to delete account.');
    });
  });
});