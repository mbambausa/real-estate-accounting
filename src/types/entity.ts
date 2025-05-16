// src/types/entity.ts

/**
 * Represents a legal entity, property, or company within the system.
 * Aligns with the 'entities' D1 table (DbEntity).
 */
export interface Entity {
  id: string;
  user_id: string;
  name: string;
  legal_name?: string | null;
  ein?: string | null;
  address?: string | null;
  legal_address?: string | null;
  business_type?: string | null;
  parent_id?: string | null; // For parent-subsidiary relationships
  created_at: number; // Unix timestamp (seconds)
  updated_at: number; // Unix timestamp (seconds)
}

/**
 * Input payload for creating or updating an Entity.
 */
export interface EntityInput {
  name: string;
  legal_name?: string | null;
  ein?: string | null;
  address?: string | null;
  legal_address?: string | null;
  business_type?: string | null;
  parent_id?: string | null;
}