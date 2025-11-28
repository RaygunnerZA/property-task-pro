export type UUID = string;

export interface BaseEntity {
  id: UUID;
  org_id: UUID;
  created_at: string;
  updated_at: string;
}
