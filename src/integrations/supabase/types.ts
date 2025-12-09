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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      checklist_template_items: {
        Row: {
          created_at: string | null
          id: string
          is_yes_no: boolean | null
          order_index: number | null
          org_id: string
          template_id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_yes_no?: boolean | null
          order_index?: number | null
          org_id: string
          template_id: string
          title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_yes_no?: boolean | null
          order_index?: number | null
          org_id?: string
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_fk"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: []
      }
      compliance_assignments: {
        Row: {
          assigned_at: string | null
          id: string
          org_id: string
          property_id: string
          rule_version_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          org_id: string
          property_id: string
          rule_version_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          id?: string
          org_id?: string
          property_id?: string
          rule_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_assignments_rule_version_id_fkey"
            columns: ["rule_version_id"]
            isOneToOne: false
            referencedRelation: "compliance_rule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_clauses: {
        Row: {
          category: string | null
          confidence: number | null
          created_at: string | null
          critic_notes: string | null
          flagged: boolean | null
          id: string
          org_id: string
          rule_id: string | null
          text: string
          updated_at: string | null
          version_id: string | null
        }
        Insert: {
          category?: string | null
          confidence?: number | null
          created_at?: string | null
          critic_notes?: string | null
          flagged?: boolean | null
          id?: string
          org_id: string
          rule_id?: string | null
          text: string
          updated_at?: string | null
          version_id?: string | null
        }
        Update: {
          category?: string | null
          confidence?: number | null
          created_at?: string | null
          critic_notes?: string | null
          flagged?: boolean | null
          id?: string
          org_id?: string
          rule_id?: string | null
          text?: string
          updated_at?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_clauses_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "compliance_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_clauses_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "compliance_rule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_jobs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          org_id: string
          source_id: string | null
          status: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          org_id: string
          source_id?: string | null
          status?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          org_id?: string
          source_id?: string | null
          status?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "compliance_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_reviews: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          org_id: string
          reviewer_id: string | null
          rule_id: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          org_id: string
          reviewer_id?: string | null
          rule_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          reviewer_id?: string | null
          rule_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_reviews_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "compliance_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_rule_reviews: {
        Row: {
          comments: string | null
          created_at: string
          id: string
          org_id: string | null
          review_type: Database["public"]["Enums"]["compliance_review_type"]
          reviewer_id: string | null
          rule_id: string
          verdict: Database["public"]["Enums"]["compliance_review_verdict"]
        }
        Insert: {
          comments?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          review_type: Database["public"]["Enums"]["compliance_review_type"]
          reviewer_id?: string | null
          rule_id: string
          verdict: Database["public"]["Enums"]["compliance_review_verdict"]
        }
        Update: {
          comments?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          review_type?: Database["public"]["Enums"]["compliance_review_type"]
          reviewer_id?: string | null
          rule_id?: string
          verdict?: Database["public"]["Enums"]["compliance_review_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "compliance_rule_reviews_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_rule_reviews_rule_fk"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "compliance_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_rule_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          org_id: string
          rule_id: string | null
          version_number: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          org_id: string
          rule_id?: string | null
          version_number: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          org_id?: string
          rule_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "compliance_rule_versions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "compliance_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_rules: {
        Row: {
          ai_confidence: number | null
          ai_consensus: boolean
          country: string
          created_at: string
          created_by: string | null
          domain: Database["public"]["Enums"]["compliance_domain"]
          effective_from: string | null
          entity_type: string | null
          id: string
          last_updated: string | null
          obligation_text: string
          obligation_type: Database["public"]["Enums"]["compliance_obligation_type"]
          org_id: string | null
          region_or_city: string | null
          source_id: string
          source_quote: string
          source_reference: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["compliance_rule_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_consensus?: boolean
          country: string
          created_at?: string
          created_by?: string | null
          domain: Database["public"]["Enums"]["compliance_domain"]
          effective_from?: string | null
          entity_type?: string | null
          id?: string
          last_updated?: string | null
          obligation_text: string
          obligation_type: Database["public"]["Enums"]["compliance_obligation_type"]
          org_id?: string | null
          region_or_city?: string | null
          source_id: string
          source_quote: string
          source_reference?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["compliance_rule_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_consensus?: boolean
          country?: string
          created_at?: string
          created_by?: string | null
          domain?: Database["public"]["Enums"]["compliance_domain"]
          effective_from?: string | null
          entity_type?: string | null
          id?: string
          last_updated?: string | null
          obligation_text?: string
          obligation_type?: Database["public"]["Enums"]["compliance_obligation_type"]
          org_id?: string | null
          region_or_city?: string | null
          source_id?: string
          source_quote?: string
          source_reference?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["compliance_rule_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_rules_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_rules_source_fk"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "compliance_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_sources: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          jurisdiction_hint: string | null
          notes: string | null
          org_id: string | null
          source_type: Database["public"]["Enums"]["compliance_source_type"]
          title: string
          url_or_path: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          jurisdiction_hint?: string | null
          notes?: string | null
          org_id?: string | null
          source_type?: Database["public"]["Enums"]["compliance_source_type"]
          title: string
          url_or_path?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          jurisdiction_hint?: string | null
          notes?: string | null
          org_id?: string | null
          source_type?: Database["public"]["Enums"]["compliance_source_type"]
          title?: string
          url_or_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_sources_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_task_access: {
        Row: {
          accessed_at: string | null
          contractor_token: string
          id: string
          org_id: string | null
          task_id: string
        }
        Insert: {
          accessed_at?: string | null
          contractor_token: string
          id?: string
          org_id?: string | null
          task_id: string
        }
        Update: {
          accessed_at?: string | null
          contractor_token?: string
          id?: string
          org_id?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_task_access_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_task_access_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          channel: string
          created_at: string | null
          external_ref: string | null
          id: string
          org_id: string
          property_id: string | null
          subject: string | null
          task_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          external_ref?: string | null
          id?: string
          org_id: string
          property_id?: string | null
          subject?: string | null
          task_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
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
            foreignKeyName: "conversations_organisation_id_fkey"
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
            foreignKeyName: "conversations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          org_id: string
          property_id: string | null
          space_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          org_id: string
          property_id?: string | null
          space_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          org_id?: string
          property_id?: string | null
          space_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_fk"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          icon: string | null
          id: string
          image_url: string | null
          name: string
          org_id: string
          parent_group_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name: string
          org_id: string
          parent_group_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name?: string
          org_id?: string
          parent_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_parent_fk"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_parent_group_id_fkey"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_name: string
          author_role: string | null
          author_user_id: string | null
          body: string
          conversation_id: string
          created_at: string | null
          direction: string
          id: string
          org_id: string
          raw_payload: Json | null
          source: string
        }
        Insert: {
          author_name: string
          author_role?: string | null
          author_user_id?: string | null
          body: string
          conversation_id: string
          created_at?: string | null
          direction: string
          id?: string
          org_id: string
          raw_payload?: Json | null
          source: string
        }
        Update: {
          author_name?: string
          author_role?: string | null
          author_user_id?: string | null
          body?: string
          conversation_id?: string
          created_at?: string | null
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
          {
            foreignKeyName: "messages_organisation_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_compliance_summary: {
        Row: {
          compliant: number | null
          id: string
          non_compliant: number | null
          org_id: string
          pending: number | null
          total_rules: number | null
          updated_at: string | null
        }
        Insert: {
          compliant?: number | null
          id?: string
          non_compliant?: number | null
          org_id: string
          pending?: number | null
          total_rules?: number | null
          updated_at?: string | null
        }
        Update: {
          compliant?: number | null
          id?: string
          non_compliant?: number | null
          org_id?: string
          pending?: number | null
          total_rules?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      organisation_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
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
          billing_email: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string | null
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug?: string | null
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          created_at: string | null
          health_score: number | null
          icon_color_hex: string | null
          icon_name: string | null
          id: string
          nickname: string | null
          org_id: string | null
          thumbnail_url: string | null
          units: number | null
        }
        Insert: {
          address: string
          created_at?: string | null
          health_score?: number | null
          icon_color_hex?: string | null
          icon_name?: string | null
          id?: string
          nickname?: string | null
          org_id?: string | null
          thumbnail_url?: string | null
          units?: number | null
        }
        Update: {
          address?: string
          created_at?: string | null
          health_score?: number | null
          icon_color_hex?: string | null
          icon_name?: string | null
          id?: string
          nickname?: string | null
          org_id?: string | null
          thumbnail_url?: string | null
          units?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_compliance_status: {
        Row: {
          id: string
          org_id: string
          property_id: string
          reason: string | null
          rule_version_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          property_id: string
          reason?: string | null
          rule_version_id?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          property_id?: string
          reason?: string | null
          rule_version_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_compliance_status_rule_version_id_fkey"
            columns: ["rule_version_id"]
            isOneToOne: false
            referencedRelation: "compliance_rule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_categories: {
        Row: {
          description: string | null
          id: string
          name: string
          org_id: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
          org_id: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          body: string | null
          created_at: string | null
          due_at: string | null
          id: string
          metadata: Json | null
          org_id: string
          property_id: string | null
          snooze_until: string | null
          source: string
          status: string
          task_id: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
          property_id?: string | null
          snooze_until?: string | null
          source?: string
          status?: string
          task_id?: string | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
          property_id?: string | null
          snooze_until?: string | null
          source?: string
          status?: string
          task_id?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          org_id: string
          parent_space_id: string | null
          property_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          org_id: string
          parent_space_id?: string | null
          property_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          org_id?: string
          parent_space_id?: string | null
          property_id?: string
          updated_at?: string | null
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
            foreignKeyName: "spaces_organisation_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spaces_parent_fk"
            columns: ["parent_space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spaces_parent_space_id_fkey"
            columns: ["parent_space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spaces_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          completed: boolean
          created_at: string | null
          created_by: string | null
          id: string
          is_completed: boolean
          is_yes_no: boolean | null
          order_index: number
          org_id: string
          requires_signature: boolean | null
          signed_at: string | null
          signed_by: string | null
          task_id: string
          template_id: string | null
          title: string
        }
        Insert: {
          completed?: boolean
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_completed?: boolean
          is_yes_no?: boolean | null
          order_index?: number
          org_id: string
          requires_signature?: boolean | null
          signed_at?: string | null
          signed_by?: string | null
          task_id: string
          template_id?: string | null
          title: string
        }
        Update: {
          completed?: boolean
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_completed?: boolean
          is_yes_no?: boolean | null
          order_index?: number
          org_id?: string
          requires_signature?: boolean | null
          signed_at?: string | null
          signed_by?: string | null
          task_id?: string
          template_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_type: string
          file_url: string
          id: string
          message_id: string | null
          org_id: string | null
          task_id: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_type: string
          file_url: string
          id?: string
          message_id?: string | null
          org_id?: string | null
          task_id?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          message_id?: string | null
          org_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "task_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_groups: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          org_id: string
          task_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          org_id: string
          task_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          org_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_groups_group_fk"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_groups_task_fk"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_groups_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_image_actions: {
        Row: {
          action_type: string | null
          created_at: string | null
          extended_metadata: Json | null
          id: string
          image_version_id: string | null
          metadata: Json | null
          org_id: string | null
          task_image_id: string | null
          user_id: string | null
        }
        Insert: {
          action_type?: string | null
          created_at?: string | null
          extended_metadata?: Json | null
          id?: string
          image_version_id?: string | null
          metadata?: Json | null
          org_id?: string | null
          task_image_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string | null
          created_at?: string | null
          extended_metadata?: Json | null
          id?: string
          image_version_id?: string | null
          metadata?: Json | null
          org_id?: string | null
          task_image_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_image_actions_image_version_id_fkey"
            columns: ["image_version_id"]
            isOneToOne: false
            referencedRelation: "task_image_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_image_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_image_actions_task_image_id_fkey"
            columns: ["task_image_id"]
            isOneToOne: false
            referencedRelation: "task_images"
            referencedColumns: ["id"]
          },
        ]
      }
      task_image_versions: {
        Row: {
          ai_metadata: Json | null
          annotation_json: Json | null
          annotation_summary: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_original: boolean | null
          org_id: string | null
          storage_path: string | null
          task_image_id: string | null
          version_number: number | null
        }
        Insert: {
          ai_metadata?: Json | null
          annotation_json?: Json | null
          annotation_summary?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_original?: boolean | null
          org_id?: string | null
          storage_path?: string | null
          task_image_id?: string | null
          version_number?: number | null
        }
        Update: {
          ai_metadata?: Json | null
          annotation_json?: Json | null
          annotation_summary?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_original?: boolean | null
          org_id?: string | null
          storage_path?: string | null
          task_image_id?: string | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "task_image_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_image_versions_task_image_id_fkey"
            columns: ["task_image_id"]
            isOneToOne: false
            referencedRelation: "task_images"
            referencedColumns: ["id"]
          },
        ]
      }
      task_images: {
        Row: {
          ai_caption: string | null
          created_at: string | null
          created_by: string | null
          display_name: string | null
          file_type: string | null
          id: string
          image_url: string | null
          is_deleted: boolean | null
          latest_version_id: string | null
          org_id: string | null
          original_filename: string | null
          status: string | null
          storage_path: string | null
          task_id: string | null
        }
        Insert: {
          ai_caption?: string | null
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          file_type?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean | null
          latest_version_id?: string | null
          org_id?: string | null
          original_filename?: string | null
          status?: string | null
          storage_path?: string | null
          task_id?: string | null
        }
        Update: {
          ai_caption?: string | null
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          file_type?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean | null
          latest_version_id?: string | null
          org_id?: string | null
          original_filename?: string | null
          status?: string | null
          storage_path?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_images_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_images_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_messages: {
        Row: {
          author_name: string | null
          author_role: string | null
          body_html: string | null
          body_text: string | null
          created_at: string | null
          id: string
          message_type: string | null
          org_id: string | null
          source: string | null
          task_id: string | null
        }
        Insert: {
          author_name?: string | null
          author_role?: string | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          id?: string
          message_type?: string | null
          org_id?: string | null
          source?: string | null
          task_id?: string | null
        }
        Update: {
          author_name?: string | null
          author_role?: string | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          id?: string
          message_type?: string | null
          org_id?: string | null
          source?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          annotation_required: boolean | null
          assigned_team_ids: string[]
          assigned_user_id: string | null
          assigned_vendor_name: string | null
          completed_at: string | null
          compliance_level: string | null
          created_at: string | null
          description: string | null
          due_at: string | null
          id: string
          image_url: string | null
          is_compliance: boolean | null
          metadata: Json
          org_id: string | null
          priority: string | null
          property_id: string | null
          source: string | null
          space_ids: string[] | null
          status: string | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          annotation_required?: boolean | null
          assigned_team_ids?: string[]
          assigned_user_id?: string | null
          assigned_vendor_name?: string | null
          completed_at?: string | null
          compliance_level?: string | null
          created_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          image_url?: string | null
          is_compliance?: boolean | null
          metadata?: Json
          org_id?: string | null
          priority?: string | null
          property_id?: string | null
          source?: string | null
          space_ids?: string[] | null
          status?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          annotation_required?: boolean | null
          assigned_team_ids?: string[]
          assigned_user_id?: string | null
          assigned_vendor_name?: string | null
          completed_at?: string | null
          compliance_level?: string | null
          created_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          image_url?: string | null
          is_compliance?: boolean | null
          metadata?: Json
          org_id?: string | null
          priority?: string | null
          property_id?: string | null
          source?: string | null
          space_ids?: string[] | null
          status?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organisation_id_fkey"
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
        ]
      }
      teams: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          icon: string | null
          id: string
          image_url: string | null
          member_ids: string[]
          name: string
          org_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          member_ids?: string[]
          name: string
          org_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          member_ids?: string[]
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_organisation_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_task: { Args: { task_id: string }; Returns: boolean }
      current_contractor_token: { Args: never; Returns: string }
      current_org_id: { Args: never; Returns: string }
      current_user_id: { Args: never; Returns: string }
      generate_unique_org_slug: { Args: { base: string }; Returns: string }
      generate_unique_slug: { Args: { base: string }; Returns: string }
      update_org_compliance_summary: {
        Args: { org: string }
        Returns: undefined
      }
    }
    Enums: {
      compliance_domain:
        | "safety"
        | "occupancy"
        | "landlord_duties"
        | "data_protection"
        | "building_maintenance"
        | "other"
      compliance_obligation_type:
        | "must_do"
        | "must_not_do"
        | "must_document"
        | "must_report"
      compliance_review_type: "ai_critic" | "ai_cross_model" | "human"
      compliance_review_verdict: "ok" | "uncertain" | "incorrect"
      compliance_rule_status:
        | "extracted"
        | "critiqued"
        | "disagreed"
        | "approved"
        | "rejected"
      compliance_source_type: "pdf_upload" | "url" | "manual"
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
      compliance_domain: [
        "safety",
        "occupancy",
        "landlord_duties",
        "data_protection",
        "building_maintenance",
        "other",
      ],
      compliance_obligation_type: [
        "must_do",
        "must_not_do",
        "must_document",
        "must_report",
      ],
      compliance_review_type: ["ai_critic", "ai_cross_model", "human"],
      compliance_review_verdict: ["ok", "uncertain", "incorrect"],
      compliance_rule_status: [
        "extracted",
        "critiqued",
        "disagreed",
        "approved",
        "rejected",
      ],
      compliance_source_type: ["pdf_upload", "url", "manual"],
    },
  },
} as const
