// src/functions/api/utils/zodSchemas.ts
import { z } from 'zod';
import type { AccountSystemType } from '@db/schema';
import { AppError, ErrorCode } from '@utils/errors';

// --- General Reusable Schemas ---

// UUID string, optional/null allowed
const idSchema = z
  .string({ required_error: 'ID is required.' })
  .trim()
  .uuid({ message: 'Invalid ID format. Must be a UUID.' })
  .optional()
  .nullable();

// Required UUID string (not optional/nullable)
const requiredIdSchema = z
  .string({ required_error: 'ID is required.' })
  .trim()
  .uuid({ message: 'Invalid ID format. Must be a UUID.' });

// Required trimmed string with configurable length
const requiredString = (fieldName: string, minLength = 1, maxLength?: number) => {
  let schema = z
    .string({ required_error: `${fieldName} is required.` })
    .trim()
    .min(minLength, { message: `${fieldName} must be at least ${minLength} character(s).` });
  if (maxLength) {
    schema = schema.max(maxLength, { message: `${fieldName} cannot exceed ${maxLength} characters.` });
  }
  return schema;
};

// Optional trimmed string, with optional max length
const optionalString = (maxLength?: number) => {
  let schema = z.string().trim().optional().nullable();
  if (maxLength) {
    schema = z
      .string()
      .trim()
      .max(maxLength, { message: `Cannot exceed ${maxLength} characters.` })
      .optional()
      .nullable();
  }
  return schema;
};

// Optional boolean
const optionalBoolean = () => z.boolean().optional();

// Convert currency string or number to integer cents
const currencyStringToCents = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      const num = parseFloat(val.replace(/[^0-9.-]+/g, ''));
      return isNaN(num) ? val : Math.round(num * 100);
    }
    if (typeof val === 'number') {
      return Math.round(val * 100);
    }
    return val;
  },
  z
    .number({ invalid_type_error: 'Amount must be a valid number.' })
    .int({ message: 'Amount must resolve to an integer (in cents).' })
    .finite()
);

const requiredCurrencyInCents = currencyStringToCents.refine(
  (val) => val !== undefined,
  { message: 'Amount is required.' }
);

const percentageAsBasisPointsSchema = z
  .number({ invalid_type_error: 'Percentage must be a number (basis points).' })
  .int({ message: 'Percentage must be an integer (basis points, e.g., 100% = 10000).' })
  .min(0)
  .max(10000)
  .optional()
  .nullable();

// --- Entity Schemas ---

export const entityInputSchema = z
  .object({
    name: requiredString('Entity name', 1, 255),
    legal_name: optionalString(255),
    ein: optionalString()
      .refine((val) => !val || /^\d{2}-?\d{7}$/.test(val), {
        message: 'Invalid EIN format. Expected XX-XXXXXXX or XXXXXXXXX.',
      }),
    address: optionalString(500),
    legal_address: optionalString(500),
    business_type: optionalString(100),
    parent_id: z
      .string()
      .trim()
      .uuid({ message: 'Invalid Parent ID format.' })
      .optional()
      .nullable(),
    // Uncomment if stored in DB:
    // is_active: optionalBoolean(),
    // allows_sub_entities: optionalBoolean(),
  })
  .strict();

export const partialEntityInputSchema = entityInputSchema.partial();

// --- Chart of Account Schemas ---

const accountSystemTypesList: [AccountSystemType, ...AccountSystemType[]] = [
  'asset',
  'liability',
  'equity',
  'income',
  'expense',
];

export const chartOfAccountInputSchema = z
  .object({
    code: requiredString('Account code', 1, 50),
    name: requiredString('Account name', 1, 255),
    type: z.enum(accountSystemTypesList, {
      errorMap: () => ({ message: 'Invalid account type.' }),
    }),
    subtype: optionalString(100),
    description: optionalString(1000),
    is_recoverable: optionalBoolean().default(false),
    recovery_percentage: percentageAsBasisPointsSchema,
    is_active: optionalBoolean().default(true),
    tax_category: optionalString(100),
    parent_id: z
      .string()
      .trim()
      .uuid({ message: 'Invalid Parent Account ID format.' })
      .optional()
      .nullable(),
  })
  .strict();

export const partialChartOfAccountInputSchema = chartOfAccountInputSchema.partial();

// --- Entity Account Schemas ---

export const entityAccountInputSchema = z
  .object({
    entity_id: idSchema,
    account_id: requiredIdSchema,
    custom_name: optionalString(255),
    is_active: optionalBoolean().default(true),
    recovery_type: optionalString(100),
    recovery_percentage: percentageAsBasisPointsSchema,
  })
  .strict();

export const partialEntityAccountInputSchema = entityAccountInputSchema.partial();

// --- Transaction Schemas ---

export const transactionLineInputSchema = z.object({
  entity_account_id: requiredIdSchema,
  amount: requiredCurrencyInCents,
  is_debit: z.boolean({ required_error: 'is_debit (true/false) is required for each line.' }),
  memo: optionalString(500),
});

export const transactionInputSchema = z
  .object({
    entity_id: requiredIdSchema,
    journal_id: z
      .string()
      .trim()
      .uuid({ message: 'Invalid Journal ID format.' })
      .optional()
      .nullable(),
    date: z.number().int().positive({ message: 'Transaction date (Unix timestamp) is required.' }),
    description: requiredString('Transaction description', 1, 1000),
    reference: optionalString(255),
    status: z.enum(['pending', 'posted', 'voided']).optional().default('posted'),
    is_reconciled: optionalBoolean().default(false),
    document_url: z
      .string()
      .trim()
      .url({ message: 'Invalid document URL.' })
      .optional()
      .nullable(),
    lines: z
      .array(transactionLineInputSchema)
      .min(2, { message: 'Transaction must have at least two lines.' })
      .refine((lines) => {
        let debitTotal = 0;
        let creditTotal = 0;
        for (const line of lines) {
          if (line.is_debit) debitTotal += line.amount;
          else creditTotal += line.amount;
        }
        return debitTotal === creditTotal;
      }, { message: 'Transaction debits and credits must balance.' }),
  })
  .strict();

/**
 * Helper to validate request body. Throws AppError on failure.
 */
export async function validateRequestBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = error.flatten().fieldErrors;
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request body. Please check the provided data.',
        400,
        details
      );
    }
    throw new AppError(
      ErrorCode.BAD_REQUEST,
      'Could not parse request body or unexpected error.',
      400
    );
  }
}