// src/types/entity.ts

/**
 * Represents a property or business entity owned by a user.
 * Mirrors the `entities` table, converting integer flags to booleans.
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
  parent_id?: string | null;
  is_active: boolean;
  allows_sub_entities: boolean;
  created_at: number;
  updated_at: number;
}

/**
 * Payload for creating/updating an Entity.
 * Excludes auto-generated fields (`id`, `user_id`, timestamps).
 */
export interface EntityInput {
  name: string;
  legal_name?: string | null;
  ein?: string | null;
  address?: string | null;
  legal_address?: string | null;
  business_type?: string | null;
  parent_id?: string | null;
  is_active?: boolean;
  allows_sub_entities?: boolean;
}
