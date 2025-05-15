// src/types/entity.ts
export interface Entity {
  id: string;
  user_id: string;
  name: string;
  legal_name?: string;
  ein?: string;
  address?: string;
  legal_address?: string;
  business_type?: string;
  parent_id?: string;
  created_at: number;
  updated_at: number;
}

export interface EntityInput {
  name: string;
  legal_name?: string;
  ein?: string;
  address?: string;
  legal_address?: string;
  business_type?: string;
  parent_id?: string;
}