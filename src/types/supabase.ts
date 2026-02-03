/**
 * Generated Supabase types from the current public schema.
 * Regenerate with: npm run gen:types
 * Source: supabase gen types typescript --project-id <id> --schema public
 *
 * IMPORTANT: After regenerating, re-add the graphql_public schema below
 * (between __InternalSupabase and public). Codegen does not emit it; it provides
 * GraphQL API support and is required for type correctness.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  /** Preserve when regenerating types – codegen does not emit this. */
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      asset_themes: {
        Row: {
          asset_id: string
          theme_id: string
        }
        Insert: {
          asset_id: string
          theme_id: string
        }
        Update: {
          asset_id?: string
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_themes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_themes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_themes_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          condition_score: number | null
          created_at: string
          id: string
          org_id: string
          property_id: string
          serial: string | null
          space_id: string | null
          updated_at: string
        }
        Insert: {
          condition_score?: number | null
          created_at?: string
          id?: string
          org_id: string
          property_id: string
          serial?: string | null
          space_id?: string | null
          updated_at?: string
        }
        Update: {
          condition_score?: number | null
          created_at?: string
          id?: string
          org_id?: string
          property_id?: string
          serial?: string | null
          space_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          org_id: string
          parent_id: string
          parent_type: string
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          org_id: string
          parent_id: string
          parent_type: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          org_id?: string
          parent_id?: string
          parent_type?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          items: Json
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          items?: Json
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          items?: Json
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_documents: {
        Row: {
          created_at: string
          expiry_date: string | null
          file_url: string | null
          id: string
          org_id: string
          status: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          org_id: string
          status?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          org_id?: string
          status?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_rules: {
        Row: {
          created_at: string
          id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_sources: {
        Row: {
          created_at: string
          id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_sources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_tokens: {
        Row: {
          created_at: string
          id: string
          task_id: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_id: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          channel: string
          created_at: string
          external_ref: string | null
          id: string
          org_id: string
          property_id: string | null
          subject: string | null
          task_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          external_ref?: string | null
          id?: string
          org_id: string
          property_id?: string | null
          subject?: string | null
          task_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          external_ref?: string | null
          id?: string
          org_id?: string
          property_id?: string | null
          subject?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          attachment_id: string
          created_at: string
          id: string
          org_id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          attachment_id: string
          created_at?: string
          id?: string
          org_id: string
          task_id: string
          updated_at?: string
        }
        Update: {
          attachment_id?: string
          created_at?: string
          id?: string
          org_id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          first_name: string | null
          id: string
          invited_by: string
          last_name: string | null
          org_id: string
          role: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invited_by: string
          last_name?: string | null
          org_id: string
          role?: string
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invited_by?: string
          last_name?: string | null
          org_id?: string
          role?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          created_at: string
          id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      listed_buildings: {
        Row: {
          applies_to: string
          created_at: string
          id: string
          is_listed: boolean
          listing_grade: string | null
          notes: string | null
          org_id: string
          property_id: string
          space_id: string | null
        }
        Insert: {
          applies_to: string
          created_at?: string
          id?: string
          is_listed: boolean
          listing_grade?: string | null
          notes?: string | null
          org_id: string
          property_id: string
          space_id?: string | null
        }
        Update: {
          applies_to?: string
          created_at?: string
          id?: string
          is_listed?: boolean
          listing_grade?: string | null
          notes?: string | null
          org_id?: string
          property_id?: string
          space_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listed_buildings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listed_buildings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listed_buildings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listed_buildings_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_name: string | null
          author_role: string | null
          author_user_id: string | null
          body: string
          conversation_id: string
          created_at: string
          direction: string
          id: string
          org_id: string
          raw_payload: Json | null
          source: string
        }
        Insert: {
          author_name?: string | null
          author_role?: string | null
          author_user_id?: string | null
          body: string
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          org_id: string
          raw_payload?: Json | null
          source: string
        }
        Update: {
          author_name?: string | null
          author_role?: string | null
          author_user_id?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          org_id?: string
          raw_payload?: Json | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          org_id: string
          plan_id: string | null
          seat_count: number | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          usage_limits: Json | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          org_id: string
          plan_id?: string | null
          seat_count?: number | null
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          usage_limits?: Json | null
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          org_id?: string
          plan_id?: string | null
          seat_count?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          usage_limits?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "org_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      org_usage: {
        Row: {
          compliance_docs_count: number
          last_updated: string
          org_id: string
          property_count: number
          staff_count: number
          storage_used_bytes: number
        }
        Insert: {
          compliance_docs_count?: number
          last_updated?: string
          org_id: string
          property_count?: number
          staff_count?: number
          storage_used_bytes?: number
        }
        Update: {
          compliance_docs_count?: number
          last_updated?: string
          org_id?: string
          property_count?: number
          staff_count?: number
          storage_used_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_members: {
        Row: {
          assigned_properties: string[] | null
          created_at: string
          id: string
          org_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_properties?: string[] | null
          created_at?: string
          id?: string
          org_id: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_properties?: string[] | null
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          org_type: Database["public"]["Enums"]["org_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name?: string
          org_type: Database["public"]["Enums"]["org_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          org_type?: Database["public"]["Enums"]["org_type"]
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          icon_color_hex: string | null
          icon_name: string | null
          id: string
          is_archived: boolean
          nickname: string | null
          org_id: string
          owner_email: string | null
          owner_name: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          address: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          icon_color_hex?: string | null
          icon_name?: string | null
          id?: string
          is_archived?: boolean
          nickname?: string | null
          org_id: string
          owner_email?: string | null
          owner_name?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          icon_color_hex?: string | null
          icon_name?: string | null
          id?: string
          is_archived?: boolean
          nickname?: string | null
          org_id?: string
          owner_email?: string | null
          owner_name?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_details: {
        Row: {
          created_at: string
          floor_count: number | null
          listing_grade: string | null
          org_id: string
          ownership_type: Database["public"]["Enums"]["ownership_type"] | null
          property_id: string
          site_type: Database["public"]["Enums"]["site_type"] | null
          total_area_sqft: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          floor_count?: number | null
          listing_grade?: string | null
          org_id: string
          ownership_type?: Database["public"]["Enums"]["ownership_type"] | null
          property_id: string
          site_type?: Database["public"]["Enums"]["site_type"] | null
          total_area_sqft?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          floor_count?: number | null
          listing_grade?: string | null
          org_id?: string
          ownership_type?: Database["public"]["Enums"]["ownership_type"] | null
          property_id?: string
          site_type?: Database["public"]["Enums"]["site_type"] | null
          total_area_sqft?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_details_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_details_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_details_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
        ]
      }
      property_image_actions: {
        Row: {
          action_type: string
          created_at: string | null
          id: string
          image_version_id: string | null
          metadata: Json | null
          property_id: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          id?: string
          image_version_id?: string | null
          metadata?: Json | null
          property_id: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          id?: string
          image_version_id?: string | null
          metadata?: Json | null
          property_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_image_actions_image_version_id_fkey"
            columns: ["image_version_id"]
            isOneToOne: false
            referencedRelation: "property_image_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_image_actions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_image_actions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
        ]
      }
      property_image_versions: {
        Row: {
          annotation_summary: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_archived: boolean | null
          is_original: boolean | null
          metadata: Json | null
          original_file_url: string | null
          property_id: string
          storage_path: string
          thumbnail_path: string | null
          version_number: number
        }
        Insert: {
          annotation_summary?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_archived?: boolean | null
          is_original?: boolean | null
          metadata?: Json | null
          original_file_url?: string | null
          property_id: string
          storage_path: string
          thumbnail_path?: string | null
          version_number: number
        }
        Update: {
          annotation_summary?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_archived?: boolean | null
          is_original?: boolean | null
          metadata?: Json | null
          original_file_url?: string | null
          property_id?: string
          storage_path?: string
          thumbnail_path?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_image_versions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_image_versions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
        ]
      }
      property_legal: {
        Row: {
          agent_contact: Json | null
          created_at: string
          landlord_name: string | null
          lease_end: string | null
          lease_start: string | null
          org_id: string
          property_id: string
          purchase_date: string | null
          updated_at: string
        }
        Insert: {
          agent_contact?: Json | null
          created_at?: string
          landlord_name?: string | null
          lease_end?: string | null
          lease_start?: string | null
          org_id: string
          property_id: string
          purchase_date?: string | null
          updated_at?: string
        }
        Update: {
          agent_contact?: Json | null
          created_at?: string
          landlord_name?: string | null
          lease_end?: string | null
          lease_start?: string | null
          org_id?: string
          property_id?: string
          purchase_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_legal_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_legal_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_legal_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
        ]
      }
      property_themes: {
        Row: {
          property_id: string
          theme_id: string
        }
        Insert: {
          property_id: string
          theme_id: string
        }
        Update: {
          property_id?: string
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_themes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_themes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_themes_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      property_utilities: {
        Row: {
          account_number: string | null
          created_at: string
          id: string
          meter_serial: string | null
          org_id: string
          property_id: string
          supplier: string | null
          type: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          created_at?: string
          id?: string
          meter_serial?: string | null
          org_id: string
          property_id: string
          supplier?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          created_at?: string
          id?: string
          meter_serial?: string | null
          org_id?: string
          property_id?: string
          supplier?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_utilities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_utilities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_utilities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_items: {
        Row: {
          created_at: string
          frequency: string
          id: string
          next_occurrence: string | null
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          frequency: string
          id?: string
          next_occurrence?: string | null
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          frequency?: string
          id?: string
          next_occurrence?: string | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      space_types: {
        Row: {
          created_at: string
          default_ui_group: string
          functional_class: Database["public"]["Enums"]["functional_class"]
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          default_ui_group: string
          functional_class: Database["public"]["Enums"]["functional_class"]
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          default_ui_group?: string
          functional_class?: Database["public"]["Enums"]["functional_class"]
          id?: string
          name?: string
        }
        Relationships: []
      }
      space_ui_groups: {
        Row: {
          created_at: string
          reason: string | null
          space_id: string
          ui_group: string
        }
        Insert: {
          created_at?: string
          reason?: string | null
          space_id: string
          ui_group: string
        }
        Update: {
          created_at?: string
          reason?: string | null
          space_id?: string
          ui_group?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_ui_groups_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: true
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          area_sqm: number | null
          created_at: string
          floor_level: string | null
          id: string
          internal_external:
            | Database["public"]["Enums"]["internal_external"]
            | null
          name: string
          notes: string | null
          org_id: string
          property_id: string
          space_type_id: string | null
          updated_at: string
        }
        Insert: {
          area_sqm?: number | null
          created_at?: string
          floor_level?: string | null
          id?: string
          internal_external?:
            | Database["public"]["Enums"]["internal_external"]
            | null
          name: string
          notes?: string | null
          org_id: string
          property_id: string
          space_type_id?: string | null
          updated_at?: string
        }
        Update: {
          area_sqm?: number | null
          created_at?: string
          floor_level?: string | null
          id?: string
          internal_external?:
            | Database["public"]["Enums"]["internal_external"]
            | null
          name?: string
          notes?: string | null
          org_id?: string
          property_id?: string
          space_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaces_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spaces_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spaces_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spaces_space_type_id_fkey"
            columns: ["space_type_id"]
            isOneToOne: false
            referencedRelation: "space_types"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_tiers: {
        Row: {
          created_at: string
          entitlements: Json
          id: string
          is_active: boolean
          name: string
          price_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          entitlements: Json
          id: string
          is_active?: boolean
          name: string
          price_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          entitlements?: Json
          id?: string
          is_active?: boolean
          name?: string
          price_id?: string | null
          type?: string
        }
        Relationships: []
      }
      task_instances: {
        Row: {
          created_at: string
          id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_instances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_spaces: {
        Row: {
          space_id: string
          task_id: string
        }
        Insert: {
          space_id: string
          task_id: string
        }
        Update: {
          space_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_spaces_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_spaces_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_spaces_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
        ]
      }
      task_teams: {
        Row: {
          task_id: string
          team_id: string
        }
        Insert: {
          task_id: string
          team_id: string
        }
        Update: {
          task_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_teams_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_teams_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      task_themes: {
        Row: {
          task_id: string
          theme_id: string
        }
        Insert: {
          task_id: string
          theme_id: string
        }
        Update: {
          task_id?: string
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_themes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_themes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_themes_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_user_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          org_id: string
          priority: string | null
          property_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          org_id: string
          priority?: string | null
          property_id?: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          org_id?: string
          priority?: string | null
          property_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      themes: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          metadata: Json | null
          name: string
          org_id: string
          parent_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          metadata?: Json | null
          name: string
          org_id: string
          parent_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          org_id?: string
          parent_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "themes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "themes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      assets_view: {
        Row: {
          condition_score: number | null
          created_at: string | null
          id: string | null
          open_tasks_count: number | null
          org_id: string | null
          property_address: string | null
          property_id: string | null
          property_name: string | null
          serial: string | null
          space_id: string | null
          space_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_view: {
        Row: {
          created_at: string | null
          days_until_expiry: number | null
          expiry_date: string | null
          expiry_status: string | null
          id: string | null
          org_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          days_until_expiry?: never
          expiry_date?: string | null
          expiry_status?: never
          id?: string | null
          org_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          days_until_expiry?: never
          expiry_date?: string | null
          expiry_status?: never
          id?: string | null
          org_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      properties_view: {
        Row: {
          address: string | null
          assets_count: number | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          expired_compliance_count: number | null
          icon_color_hex: string | null
          icon_name: string | null
          id: string | null
          nickname: string | null
          open_tasks_count: number | null
          org_id: string | null
          owner_email: string | null
          owner_name: string | null
          spaces_count: number | null
          thumbnail_url: string | null
          updated_at: string | null
          valid_compliance_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks_view: {
        Row: {
          assigned_user_id: string | null
          assignee_user_id: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string | null
          images: Json | null
          org_id: string | null
          priority: string | null
          property_address: string | null
          property_id: string | null
          property_name: string | null
          property_thumbnail_url: string | null
          spaces: Json | null
          status: Database["public"]["Enums"]["task_status"] | null
          teams: Json | null
          themes: Json | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      annotate_property_image:
        | {
            Args: {
              p_annotated_storage_path: string
              p_annotated_thumbnail_path: string
              p_annotation_summary?: string
              p_property_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_annotated_storage_path: string
              p_annotated_thumbnail_path: string
              p_annotation_json?: Json
              p_annotation_summary?: string
              p_original_file_url?: string
              p_property_id: string
            }
            Returns: Json
          }
      archive_property_image_version: {
        Args: { p_property_id: string; p_version_id: string }
        Returns: Json
      }
      archive_task: {
        Args: { p_org: string; p_task_id: string }
        Returns: boolean
      }
      assigned_properties: { Args: never; Returns: string[] }
      call_seed_property_function: {
        Args: { p_org_id: string; p_property_id: string }
        Returns: undefined
      }
      check_duplicate_org_name:
        | { Args: { p_org_name: string; p_user_id: string }; Returns: boolean }
        | {
            Args: {
              p_org_name: string
              p_org_type?: Database["public"]["Enums"]["org_type"]
              p_user_id: string
            }
            Returns: boolean
          }
      check_duplicate_property_address: {
        Args: { p_address: string; p_org_id: string }
        Returns: boolean
      }
      check_user_org_membership: {
        Args: { p_org_id: string }
        Returns: boolean
      }
      create_attachment_record: {
        Args: {
          p_file_name?: string
          p_file_size?: number
          p_file_type?: string
          p_file_url: string
          p_org_id: string
          p_parent_id: string
          p_parent_type: string
          p_thumbnail_url?: string
        }
        Returns: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          org_id: string
          parent_id: string
          parent_type: string
          thumbnail_url: string
          updated_at: string
        }[]
      }
      create_organisation: {
        Args: {
          creator_id: string
          org_name: string
          org_type_value: Database["public"]["Enums"]["org_type"]
        }
        Returns: string
      }
      create_property_v2:
        | { Args: { p_address: string; p_org_id: string }; Returns: Json }
        | {
            Args: {
              p_address: string
              p_icon_color_hex?: string
              p_icon_name?: string
              p_nickname?: string
              p_org_id: string
              p_thumbnail_url?: string
            }
            Returns: Json
          }
      create_task_v2: {
        Args: {
          p_description?: string
          p_due_date?: string
          p_org_id: string
          p_priority?: string
          p_property_id?: string
          p_title: string
        }
        Returns: Json
      }
      current_org_id: { Args: never; Returns: string }
      ensure_user_has_org: { Args: { p_user_id: string }; Returns: string }
      expire_old_invitations: { Args: never; Returns: undefined }
      generate_invitation_token: { Args: never; Returns: string }
      get_task_with_contractor_token: {
        Args: { p_task_id: string; p_token: string }
        Returns: {
          created_at: string
          description: string
          due_date: string
          id: string
          org_id: string
          priority: string
          property_id: string
          status: string
          title: string
          updated_at: string
        }[]
      }
      get_users_info: {
        Args: { user_ids: string[] }
        Returns: {
          avatar_url: string
          email: string
          id: string
          nickname: string
        }[]
      }
      import_property_spaces_from_csv: {
        Args: { p_csv_data: Json; p_org_id: string }
        Returns: Json
      }
      is_org_member: { Args: { org_uuid: string }; Returns: boolean }
      map_internal_external: {
        Args: { p_value: string }
        Returns: Database["public"]["Enums"]["internal_external"]
      }
      map_space_group_to_functional_class: {
        Args: { p_space_group: string }
        Returns: Database["public"]["Enums"]["functional_class"]
      }
      replace_property_image: {
        Args: {
          p_annotation_summary?: string
          p_new_storage_path: string
          p_new_thumbnail_path: string
          p_property_id: string
        }
        Returns: Json
      }
      restore_task: {
        Args: { p_org: string; p_task_id: string }
        Returns: boolean
      }
      seed_property_defaults: {
        Args: { p_org_id: string; p_property_id: string }
        Returns: undefined
      }
      test_user_org_membership: {
        Args: { p_org_id: string }
        Returns: {
          is_member: boolean
          membership_count: number
          org_id: string
          user_id: string
        }[]
      }
      update_property_thumbnail: {
        Args: { p_property_id: string; p_thumbnail_url: string }
        Returns: Json
      }
    }
    Enums: {
      functional_class:
        | "circulation"
        | "habitable"
        | "service"
        | "sanitary"
        | "storage"
        | "mechanical_plant"
        | "it_infrastructure"
        | "electrical"
        | "power_backup"
        | "building_services"
        | "vertical_transport"
        | "external_area"
        | "external_logistics"
      identity_type:
        | "personal"
        | "manager"
        | "staff"
        | "contractor"
        | "contractor_pro"
      internal_external: "internal" | "external"
      org_type: "personal" | "business" | "contractor"
      ownership_type: "owned" | "leased" | "rented" | "managed" | "other"
      site_type:
        | "residential"
        | "commercial"
        | "mixed_use"
        | "industrial"
        | "land"
        | "other"
      task_status: "open" | "in_progress" | "completed" | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      functional_class: [
        "circulation",
        "habitable",
        "service",
        "sanitary",
        "storage",
        "mechanical_plant",
        "it_infrastructure",
        "electrical",
        "power_backup",
        "building_services",
        "vertical_transport",
        "external_area",
        "external_logistics",
      ],
      identity_type: [
        "personal",
        "manager",
        "staff",
        "contractor",
        "contractor_pro",
      ],
      internal_external: ["internal", "external"],
      org_type: ["personal", "business", "contractor"],
      ownership_type: ["owned", "leased", "rented", "managed", "other"],
      site_type: [
        "residential",
        "commercial",
        "mixed_use",
        "industrial",
        "land",
        "other",
      ],
      task_status: ["open", "in_progress", "completed", "archived"],
    },
  },
} as const
