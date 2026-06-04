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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          org_id: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_extraction_history: {
        Row: {
          extracted_at: string | null
          id: string
          org_id: string
          payload: Json
          task_id: string | null
        }
        Insert: {
          extracted_at?: string | null
          id?: string
          org_id: string
          payload: Json
          task_id?: string | null
        }
        Update: {
          extracted_at?: string | null
          id?: string
          org_id?: string
          payload?: Json
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_extraction_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_extraction_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_extraction_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_extraction_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_extractions: {
        Row: {
          confidence: number | null
          created_at: string
          extracted: Json | null
          id: string
          model_id: string | null
          org_id: string | null
          task_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          extracted?: Json | null
          id?: string
          model_id?: string | null
          org_id?: string | null
          task_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          extracted?: Json | null
          id?: string
          model_id?: string | null
          org_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_extractions_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_extractions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_extractions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_extractions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_extractions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_extractions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_models: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          name: string
          provider: string | null
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          name: string
          provider?: string | null
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          name?: string
          provider?: string | null
          version?: string
        }
        Relationships: []
      }
      ai_prompts: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          model_id: string | null
          org_id: string | null
          prompt: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          model_id?: string | null
          org_id?: string | null
          prompt: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          model_id?: string | null
          org_id?: string | null
          prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompts_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_prompts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_responses: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          org_id: string | null
          prompt_id: string | null
          response: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id?: string | null
          prompt_id?: string | null
          response?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id?: string | null
          prompt_id?: string | null
          response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_responses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_responses_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_type: string | null
          category: string | null
          condition_score: number | null
          created_at: string
          icon_name: string | null
          id: string
          metadata: Json | null
          name: string
          notes: string | null
          org_id: string
          property_id: string
          serial_number: string | null
          space_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          asset_type?: string | null
          category?: string | null
          condition_score?: number | null
          created_at?: string
          icon_name?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          notes?: string | null
          org_id: string
          property_id: string
          serial_number?: string | null
          space_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          asset_type?: string | null
          category?: string | null
          condition_score?: number | null
          created_at?: string
          icon_name?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          notes?: string | null
          org_id?: string
          property_id?: string
          serial_number?: string | null
          space_id?: string | null
          status?: string | null
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
            referencedRelation: "compliance_property_summary"
            referencedColumns: ["property_id"]
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
      attachment_spaces: {
        Row: {
          attachment_id: string
          created_at: string
          org_id: string
          space_id: string
        }
        Insert: {
          attachment_id: string
          created_at?: string
          org_id: string
          space_id: string
        }
        Update: {
          attachment_id?: string
          created_at?: string
          org_id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachment_spaces_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachment_spaces_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachment_spaces_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          ai_confidence: number | null
          category: string | null
          created_at: string
          document_type: string | null
          expiry_date: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          metadata: Json | null
          notes: string | null
          ocr_text: string | null
          org_id: string
          parent_id: string
          parent_type: string
          renewal_frequency: string | null
          status: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          category?: string | null
          created_at?: string
          document_type?: string | null
          expiry_date?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          ocr_text?: string | null
          org_id: string
          parent_id: string
          parent_type: string
          renewal_frequency?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          category?: string | null
          created_at?: string
          document_type?: string | null
          expiry_date?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          ocr_text?: string | null
          org_id?: string
          parent_id?: string
          parent_type?: string
          renewal_frequency?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
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
      checklist_template_items: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_archived: boolean | null
          is_yes_no: boolean | null
          order_index: number | null
          org_id: string
          requires_signature: boolean | null
          template_id: string
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_archived?: boolean | null
          is_yes_no?: boolean | null
          order_index?: number | null
          org_id: string
          requires_signature?: boolean | null
          template_id: string
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_archived?: boolean | null
          is_yes_no?: boolean | null
          order_index?: number | null
          org_id?: string
          requires_signature?: boolean | null
          template_id?: string
          title?: string
          updated_at?: string | null
          updated_by?: string | null
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
            foreignKeyName: "checklist_template_items_template_fk"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates_with_items"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates_with_items"
            referencedColumns: ["template_id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean | null
          is_locked: boolean | null
          is_yes_no: boolean | null
          name: string
          org_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          is_locked?: boolean | null
          is_yes_no?: boolean | null
          name: string
          org_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          is_locked?: boolean | null
          is_yes_no?: boolean | null
          name?: string
          org_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      compliance_assignments: {
        Row: {
          assigned_at: string | null
          id: string
          last_applied_at: string | null
          last_triggered_at: string | null
          next_due_at: string | null
          org_id: string
          property_id: string
          recurrence_type: string | null
          recurrence_value: number | null
          rule_version_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          last_applied_at?: string | null
          last_triggered_at?: string | null
          next_due_at?: string | null
          org_id: string
          property_id: string
          recurrence_type?: string | null
          recurrence_value?: number | null
          rule_version_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          id?: string
          last_applied_at?: string | null
          last_triggered_at?: string | null
          next_due_at?: string | null
          org_id?: string
          property_id?: string
          recurrence_type?: string | null
          recurrence_value?: number | null
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
      compliance_documents: {
        Row: {
          ai_confidence: number | null
          created_at: string
          document_type: string | null
          expiry_date: string | null
          file_url: string | null
          frequency: string | null
          hazards: string[] | null
          icon_name: string | null
          id: string
          linked_asset_ids: string[] | null
          next_due_date: string | null
          notes: string | null
          org_id: string
          property_id: string | null
          rule_id: string | null
          status: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          created_at?: string
          document_type?: string | null
          expiry_date?: string | null
          file_url?: string | null
          frequency?: string | null
          hazards?: string[] | null
          icon_name?: string | null
          id?: string
          linked_asset_ids?: string[] | null
          next_due_date?: string | null
          notes?: string | null
          org_id: string
          property_id?: string | null
          rule_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          created_at?: string
          document_type?: string | null
          expiry_date?: string | null
          file_url?: string | null
          frequency?: string | null
          hazards?: string[] | null
          icon_name?: string | null
          id?: string
          linked_asset_ids?: string[] | null
          next_due_date?: string | null
          notes?: string | null
          org_id?: string
          property_id?: string | null
          rule_id?: string | null
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
          {
            foreignKeyName: "compliance_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "compliance_property_summary"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "compliance_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_events: {
        Row: {
          body: string | null
          details: Json | null
          due_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          occurred_at: string | null
          org_id: string
          property_id: string | null
          rule_id: string | null
          severity: string | null
          task_id: string | null
          title: string | null
        }
        Insert: {
          body?: string | null
          details?: Json | null
          due_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          occurred_at?: string | null
          org_id: string
          property_id?: string | null
          rule_id?: string | null
          severity?: string | null
          task_id?: string | null
          title?: string | null
        }
        Update: {
          body?: string | null
          details?: Json | null
          due_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string | null
          org_id?: string
          property_id?: string | null
          rule_id?: string | null
          severity?: string | null
          task_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "compliance_property_summary"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "compliance_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "compliance_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
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
      compliance_recommendations: {
        Row: {
          asset_ids: string[] | null
          compliance_document_id: string
          created_at: string
          hazards: string[] | null
          id: string
          org_id: string
          property_id: string | null
          recommended_action: string
          recommended_tasks: Json | null
          risk_level: string
          space_ids: string[] | null
          status: string
          updated_at: string
        }
        Insert: {
          asset_ids?: string[] | null
          compliance_document_id: string
          created_at?: string
          hazards?: string[] | null
          id?: string
          org_id: string
          property_id?: string | null
          recommended_action: string
          recommended_tasks?: Json | null
          risk_level?: string
          space_ids?: string[] | null
          status?: string
          updated_at?: string
        }
        Update: {
          asset_ids?: string[] | null
          compliance_document_id?: string
          created_at?: string
          hazards?: string[] | null
          id?: string
          org_id?: string
          property_id?: string | null
          recommended_action?: string
          recommended_tasks?: Json | null
          risk_level?: string
          space_ids?: string[] | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_recommendations_compliance_document_id_fkey"
            columns: ["compliance_document_id"]
            isOneToOne: true
            referencedRelation: "compliance_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_recommendations_compliance_document_id_fkey"
            columns: ["compliance_document_id"]
            isOneToOne: true
            referencedRelation: "compliance_portfolio_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_recommendations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_recommendations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "compliance_property_summary"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "compliance_recommendations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_recommendations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
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
      compliance_spaces: {
        Row: {
          compliance_document_id: string
          created_at: string
          id: string
          org_id: string
          space_id: string
        }
        Insert: {
          compliance_document_id: string
          created_at?: string
          id?: string
          org_id: string
          space_id: string
        }
        Update: {
          compliance_document_id?: string
          created_at?: string
          id?: string
          org_id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_spaces_compliance_document_id_fkey"
            columns: ["compliance_document_id"]
            isOneToOne: false
            referencedRelation: "compliance_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_spaces_compliance_document_id_fkey"
            columns: ["compliance_document_id"]
            isOneToOne: false
            referencedRelation: "compliance_portfolio_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_spaces_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_spaces_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
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
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_task_access_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_task_access_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_task_access_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
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
            referencedRelation: "compliance_property_summary"
            referencedColumns: ["property_id"]
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
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
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
      escalation_events: {
        Row: {
          created_at: string | null
          event: Json
          id: string
          org_id: string
          rule_id: string | null
          signal_id: string | null
          task_id: string | null
        }
        Insert: {
          created_at?: string | null
          event: Json
          id?: string
          org_id: string
          rule_id?: string | null
          signal_id?: string | null
          task_id?: string | null
        }
        Update: {
          created_at?: string | null
          event?: Json
          id?: string
          org_id?: string
          rule_id?: string | null
          signal_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalation_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "escalation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_events_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string | null
          enabled: boolean | null
          id: string
          name: string
          org_id: string
          trigger_type: string
        }
        Insert: {
          actions: Json
          conditions: Json
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          name: string
          org_id: string
          trigger_type: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          name?: string
          org_id?: string
          trigger_type?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string | null
          created_by: string | null
          group_id: string
          id: string
          is_deleted: boolean | null
          org_id: string
          property_id: string | null
          space_id: string | null
          team_id: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string | null
          created_by?: string | null
          group_id: string
          id?: string
          is_deleted?: boolean | null
          org_id: string
          property_id?: string | null
          space_id?: string | null
          team_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string | null
          created_by?: string | null
          group_id?: string
          id?: string
          is_deleted?: boolean | null
          org_id?: string
          property_id?: string | null
          space_id?: string | null
          team_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
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
          {
            foreignKeyName: "group_members_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "compliance_property_summary"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "group_members_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          accent_color: string | null
          archived_at: string | null
          archived_by: string | null
          category: string | null
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_name: string | null
          display_order: number | null
          icon: string | null
          id: string
          image_url: string | null
          is_archived: boolean | null
          metadata: Json | null
          name: string
          org_id: string
          parent_group_id: string | null
          slug: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          accent_color?: string | null
          archived_at?: string | null
          archived_by?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_name?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_archived?: boolean | null
          metadata?: Json | null
          name: string
          org_id: string
          parent_group_id?: string | null
          slug?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          accent_color?: string | null
          archived_at?: string | null
          archived_by?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_name?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_archived?: boolean | null
          metadata?: Json | null
          name?: string
          org_id?: string
          parent_group_id?: string | null
          slug?: string | null
          updated_at?: string | null
          updated_by?: string | null
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
            foreignKeyName: "groups_parent_group_fk"
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
      icon_library: {
        Row: {
          aliases: string[] | null
          category: string | null
          description: string | null
          id: string
          name: string
          search_vector: unknown
          stroke_width: number | null
          svg_path: string | null
          tags: string[] | null
        }
        Insert: {
          aliases?: string[] | null
          category?: string | null
          description?: string | null
          id?: string
          name: string
          search_vector?: unknown
          stroke_width?: number | null
          svg_path?: string | null
          tags?: string[] | null
        }
        Update: {
          aliases?: string[] | null
          category?: string | null
          description?: string | null
          id?: string
          name?: string
          search_vector?: unknown
          stroke_width?: number | null
          svg_path?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      icon_search_synonyms: {
        Row: {
          expansion: string[]
          word: string
        }
        Insert: {
          expansion: string[]
          word: string
        }
        Update: {
          expansion?: string[]
          word?: string
        }
        Relationships: []
      }
      labels: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          org_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          org_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "labels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
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
      notification_channels: {
        Row: {
          created_at: string | null
          destination: string
          enabled: boolean | null
          id: string
          org_id: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          destination: string
          enabled?: boolean | null
          id?: string
          org_id: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          destination?: string
          enabled?: boolean | null
          id?: string
          org_id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
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
          assigned_properties: string[] | null
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          assigned_properties?: string[] | null
          created_at?: string
          id?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          assigned_properties?: string[] | null
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
          org_type: Database["public"]["Enums"]["org_type"]
          slug: string | null
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          org_type?: Database["public"]["Enums"]["org_type"]
          slug?: string | null
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          org_type?: Database["public"]["Enums"]["org_type"]
          slug?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          health_score: number | null
          icon_color_hex: string | null
          icon_name: string | null
          id: string
          last_environmental_scan_at: string | null
          nickname: string | null
          org_id: string | null
          owner_email: string | null
          owner_name: string | null
          thumbnail_url: string | null
          units: number | null
          updated_at: string
        }
        Insert: {
          address: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          health_score?: number | null
          icon_color_hex?: string | null
          icon_name?: string | null
          id?: string
          last_environmental_scan_at?: string | null
          nickname?: string | null
          org_id?: string | null
          owner_email?: string | null
          owner_name?: string | null
          thumbnail_url?: string | null
          units?: number | null
          updated_at?: string
        }
        Update: {
          address?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          health_score?: number | null
          icon_color_hex?: string | null
          icon_name?: string | null
          id?: string
          last_environmental_scan_at?: string | null
          nickname?: string | null
          org_id?: string | null
          owner_email?: string | null
          owner_name?: string | null
          thumbnail_url?: string | null
          units?: number | null
          updated_at?: string
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
            referencedRelation: "compliance_property_summary"
            referencedColumns: ["property_id"]
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
            referencedRelation: "compliance_property_summary"
            referencedColumns: ["property_id"]
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
            referencedRelation: "compliance_property_summary"
            referencedColumns: ["property_id"]
          },
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
            referencedRelation: "compliance_property_summary"
            referencedColumns: ["property_id"]
          },
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
          ai_recommendation: Json | null
          body: string | null
          created_at: string | null
          due_at: string | null
          id: string
          metadata: Json | null
          org_id: string
          property_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          scope: string | null
          severity: string | null
          snooze_until: string | null
          source: string
          status: string
          task_id: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          ai_recommendation?: Json | null
          body?: string | null
          created_at?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
          property_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          scope?: string | null
          severity?: string | null
          snooze_until?: string | null
          source?: string
          status?: string
          task_id?: string | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          ai_recommendation?: Json | null
          body?: string | null
          created_at?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
          property_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          scope?: string | null
          severity?: string | null
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
            referencedRelation: "compliance_property_summary"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "signals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
        ]
      }
      space_types: {
        Row: {
          created_at: string
          default_icon: string | null
          default_ui_group: string
          functional_class: Database["public"]["Enums"]["functional_class"]
          icon_alternates: Json | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          default_icon?: string | null
          default_ui_group?: string
          functional_class?: Database["public"]["Enums"]["functional_class"]
          icon_alternates?: Json | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          default_icon?: string | null
          default_ui_group?: string
          functional_class?: Database["public"]["Enums"]["functional_class"]
          icon_alternates?: Json | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      spaces: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          icon: string | null
          icon_name: string | null
          id: string
          is_archived: boolean | null
          name: string
          org_id: string
          parent_space_id: string | null
          property_id: string
          space_type_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          icon_name?: string | null
          id?: string
          is_archived?: boolean | null
          name: string
          org_id: string
          parent_space_id?: string | null
          property_id: string
          space_type_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          icon_name?: string | null
          id?: string
          is_archived?: boolean | null
          name?: string
          org_id?: string
          parent_space_id?: string | null
          property_id?: string
          space_type_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
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
            referencedRelation: "compliance_property_summary"
            referencedColumns: ["property_id"]
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
      subtasks: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          completed: boolean
          created_at: string | null
          created_by: string | null
          id: string
          is_archived: boolean | null
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
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          completed?: boolean
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_archived?: boolean | null
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
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          completed?: boolean
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_archived?: boolean | null
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
          updated_at?: string | null
          updated_by?: string | null
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
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
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
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates_with_items"
            referencedColumns: ["template_id"]
          },
        ]
      }
      task_activity: {
        Row: {
          activity_type: string
          body: string | null
          created_at: string | null
          created_by: string | null
          id: string
          metadata: Json | null
          org_id: string
          task_id: string | null
        }
        Insert: {
          activity_type: string
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
          task_id?: string | null
        }
        Update: {
          activity_type?: string
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
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
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
        ]
      }
      task_compliance_events: {
        Row: {
          clause_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          org_id: string
          rule_id: string | null
          status: string | null
          task_id: string
        }
        Insert: {
          clause_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id: string
          rule_id?: string | null
          status?: string | null
          task_id: string
        }
        Update: {
          clause_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          rule_id?: string | null
          status?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_compliance_events_clause_id_fkey"
            columns: ["clause_id"]
            isOneToOne: false
            referencedRelation: "compliance_clauses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_compliance_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_compliance_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "compliance_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_compliance_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_compliance_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_compliance_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_compliance_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
        ]
      }
      task_groups: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string | null
          created_by: string | null
          group_id: string
          id: string
          is_archived: boolean | null
          is_deleted: boolean | null
          org_id: string
          task_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string | null
          created_by?: string | null
          group_id: string
          id?: string
          is_archived?: boolean | null
          is_deleted?: boolean | null
          org_id: string
          task_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string | null
          created_by?: string | null
          group_id?: string
          id?: string
          is_archived?: boolean | null
          is_deleted?: boolean | null
          org_id?: string
          task_id?: string
          updated_at?: string | null
          updated_by?: string | null
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
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_groups_task_fk"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
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
            foreignKeyName: "task_groups_task_fk"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_groups_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_groups_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_groups_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_groups_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
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
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_images_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_images_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_images_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
        ]
      }
      task_labels: {
        Row: {
          label_id: string
          org_id: string
          task_id: string
        }
        Insert: {
          label_id: string
          org_id: string
          task_id: string
        }
        Update: {
          label_id?: string
          org_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_labels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_labels_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_labels_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_labels_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_labels_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
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
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
        ]
      }
      task_recurrence: {
        Row: {
          created_at: string | null
          id: string
          next_run: string
          org_id: string
          rule: Json
          task_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          next_run: string
          org_id: string
          rule: Json
          task_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          next_run?: string
          org_id?: string
          rule?: Json
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_recurrence_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_recurrence_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_recurrence_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_recurrence_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
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
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_spaces_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
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
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_themes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
            referencedColumns: ["id"]
          },
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
      task_threads: {
        Row: {
          created_at: string | null
          id: string
          org_id: string
          task_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id: string
          task_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_threads_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_threads_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "task_repeat_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_threads_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_threads_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks_view"
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
          compliance_due_at: string | null
          compliance_event_id: string | null
          compliance_level: string | null
          compliance_metadata: Json | null
          compliance_rule_id: string | null
          compliance_source_id: string | null
          compliance_status: string | null
          created_at: string | null
          description: string | null
          due_at: string | null
          icon_name: string | null
          id: string
          image_url: string | null
          is_compliance: boolean | null
          metadata: Json
          milestones: Json | null
          org_id: string | null
          owner_team_id: string | null
          owner_user_id: string | null
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
          compliance_due_at?: string | null
          compliance_event_id?: string | null
          compliance_level?: string | null
          compliance_metadata?: Json | null
          compliance_rule_id?: string | null
          compliance_source_id?: string | null
          compliance_status?: string | null
          created_at?: string | null
          description?: string | null
          due_at?: string | null
          icon_name?: string | null
          id?: string
          image_url?: string | null
          is_compliance?: boolean | null
          metadata?: Json
          milestones?: Json | null
          org_id?: string | null
          owner_team_id?: string | null
          owner_user_id?: string | null
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
          compliance_due_at?: string | null
          compliance_event_id?: string | null
          compliance_level?: string | null
          compliance_metadata?: Json | null
          compliance_rule_id?: string | null
          compliance_source_id?: string | null
          compliance_status?: string | null
          created_at?: string | null
          description?: string | null
          due_at?: string | null
          icon_name?: string | null
          id?: string
          image_url?: string | null
          is_compliance?: boolean | null
          metadata?: Json
          milestones?: Json | null
          org_id?: string | null
          owner_team_id?: string | null
          owner_user_id?: string | null
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
            foreignKeyName: "tasks_compliance_event_id_fkey"
            columns: ["compliance_event_id"]
            isOneToOne: false
            referencedRelation: "compliance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_compliance_rule_id_fkey"
            columns: ["compliance_rule_id"]
            isOneToOne: false
            referencedRelation: "compliance_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_compliance_source_id_fkey"
            columns: ["compliance_source_id"]
            isOneToOne: false
            referencedRelation: "compliance_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organisation_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_team_id_fkey"
            columns: ["owner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "compliance_property_summary"
            referencedColumns: ["property_id"]
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
      thread_message_attachments: {
        Row: {
          ai_caption: string | null
          file_type: string | null
          file_url: string | null
          id: string
          message_id: string
          metadata: Json | null
          org_id: string
          storage_path: string
          uploaded_at: string | null
        }
        Insert: {
          ai_caption?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          message_id: string
          metadata?: Json | null
          org_id: string
          storage_path: string
          uploaded_at?: string | null
        }
        Update: {
          ai_caption?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          message_id?: string
          metadata?: Json | null
          org_id?: string
          storage_path?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "thread_message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "thread_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_messages: {
        Row: {
          ai_summary: Json | null
          body: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          org_id: string
          sender_id: string | null
          task_id: string
          thread_id: string
        }
        Insert: {
          ai_summary?: Json | null
          body?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
          sender_id?: string | null
          task_id: string
          thread_id: string
        }
        Update: {
          ai_summary?: Json | null
          body?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
          sender_id?: string | null
          task_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "compliance_upcoming"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_repeat_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "task_threads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      assets_view: {
        Row: {
          asset_type: string | null
          category: string | null
          condition_score: number | null
          created_at: string | null
          icon_name: string | null
          id: string | null
          metadata: Json | null
          name: string | null
          open_tasks_count: number | null
          org_id: string | null
          property_address: string | null
          property_id: string | null
          property_name: string | null
          serial_number: string | null
          space_id: string | null
          space_name: string | null
          status: string | null
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
            referencedRelation: "compliance_property_summary"
            referencedColumns: ["property_id"]
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
      checklist_templates_with_items: {
        Row: {
          is_yes_no: boolean | null
          item_id: string | null
          item_title: string | null
          order_index: number | null
          org_id: string | null
          template_id: string | null
          template_name: string | null
        }
        Relationships: []
      }
      compliance_org_health: {
        Row: {
          completed: number | null
          critical_overdue: number | null
          last_update: string | null
          org_id: string | null
          total_tasks: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organisation_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_portfolio_view: {
        Row: {
          ai_confidence: number | null
          document_type: string | null
          expiry_date: string | null
          expiry_state: string | null
          hazards: string[] | null
          id: string | null
          linked_asset_ids: string[] | null
          next_due_date: string | null
          org_id: string | null
          property_id: string | null
          property_name: string | null
          space_ids: string[] | null
          status: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "compliance_property_summary"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "compliance_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_property_summary: {
        Row: {
          completed: number | null
          due_soon: number | null
          org_id: string | null
          overdue: number | null
          property_id: string | null
          property_name: string | null
          total: number | null
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
      compliance_upcoming: {
        Row: {
          days_until_due: number | null
          due_at: string | null
          id: string | null
          org_id: string | null
          property_id: string | null
          title: string | null
          urgency: string | null
        }
        Insert: {
          days_until_due?: never
          due_at?: string | null
          id?: string | null
          org_id?: string | null
          property_id?: string | null
          title?: string | null
          urgency?: never
        }
        Update: {
          days_until_due?: never
          due_at?: string | null
          id?: string | null
          org_id?: string | null
          property_id?: string | null
          title?: string | null
          urgency?: never
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
            referencedRelation: "compliance_property_summary"
            referencedColumns: ["property_id"]
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
      task_repeat_rules: {
        Row: {
          id: string | null
          org_id: string | null
          repeat_rule: Json | null
        }
        Insert: {
          id?: string | null
          org_id?: string | null
          repeat_rule?: never
        }
        Update: {
          id?: string | null
          org_id?: string | null
          repeat_rule?: never
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organisation_id_fkey"
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
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string | null
          images: Json | null
          milestones: Json | null
          org_id: string | null
          priority: string | null
          property_address: string | null
          property_id: string | null
          property_name: string | null
          property_thumbnail_url: string | null
          spaces: Json | null
          status: string | null
          teams: Json | null
          themes: Json | null
          title: string | null
          updated_at: string | null
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
            referencedRelation: "compliance_property_summary"
            referencedColumns: ["property_id"]
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
      ai_icon_search: {
        Args: { query_text?: string }
        Returns: {
          aliases: string[] | null
          category: string | null
          description: string | null
          id: string
          name: string
          search_vector: unknown
          stroke_width: number | null
          svg_path: string | null
          tags: string[] | null
        }[]
        SetofOptions: {
          from: "*"
          to: "icon_library"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
      apply_checklist_template: {
        Args: { p_org: string; p_task: string; p_template: string }
        Returns: undefined
      }
      apply_template_to_task: {
        Args: { task: string; template: string }
        Returns: undefined
      }
      archive_property_image_version: {
        Args: { p_property_id: string; p_version_id: string }
        Returns: Json
      }
      archive_task: {
        Args: { p_org: string; p_task_id: string }
        Returns: undefined
      }
      assigned_properties: { Args: never; Returns: string[] }
      can_access_task: { Args: { task_id: string }; Returns: boolean }
      check_duplicate_org_name: {
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
      compliance_event_daily_expiry_check: { Args: never; Returns: undefined }
      create_compliance_task: {
        Args: {
          p_due: string
          p_level: string
          p_org: string
          p_property: string
          p_rule: string
          p_title: string
        }
        Returns: string
      }
      create_organisation: {
        Args: {
          creator_id: string
          org_name: string
          org_type_value: Database["public"]["Enums"]["org_type"]
        }
        Returns: string
      }
      create_property_v2: {
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
      create_task_full: {
        Args: {
          p_assigned_teams: string[]
          p_assigned_user: string
          p_compliance_level: string
          p_description: string
          p_due_at: string
          p_groups: string[]
          p_images: Json
          p_is_compliance: boolean
          p_metadata: Json
          p_org: string
          p_priority: string
          p_property: string
          p_space_ids: string[]
          p_subtasks: Json
          p_template: string
          p_title: string
        }
        Returns: string
      }
      create_task_safe: {
        Args: { p_org: string; p_payload: Json; p_property: string }
        Returns: string
      }
      create_template_from_task: {
        Args: { p_name: string; p_org: string; p_task: string }
        Returns: string
      }
      current_contractor_token: { Args: never; Returns: string }
      current_org_id: { Args: never; Returns: string }
      current_user_id: { Args: never; Returns: string }
      delete_task_full: {
        Args: { p_org: string; p_task_id: string }
        Returns: undefined
      }
      expire_stale_environmental_signals: { Args: never; Returns: number }
      generate_recurring_task_instance: {
        Args: { p_recur: string }
        Returns: undefined
      }
      generate_unique_org_slug: { Args: { base: string }; Returns: string }
      generate_unique_slug: { Args: { base: string }; Returns: string }
      get_compliance_summary: { Args: { p_org: string }; Returns: Json }
      get_users_info: {
        Args: { user_ids: string[] }
        Returns: {
          avatar_url: string
          email: string
          id: string
          nickname: string
        }[]
      }
      lock_checklist_template: {
        Args: { p_org: string; p_template: string }
        Returns: undefined
      }
      process_all_recurrences: { Args: never; Returns: undefined }
      process_compliance_schedules: { Args: never; Returns: undefined }
      process_escalations: { Args: never; Returns: undefined }
      purge_completed_tasks: {
        Args: { p_days: number; p_org: string }
        Returns: number
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
        Returns: undefined
      }
      save_ai_extraction: {
        Args: { p_data: Json; p_task: string }
        Returns: undefined
      }
      seed_onboarding_demo_for_property: {
        Args: { p_property_id: string }
        Returns: undefined
      }
      seed_property_defaults: {
        Args: { p_org_id: string; p_property_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      subtask_sign: {
        Args: { subtask: string; user_id: string }
        Returns: undefined
      }
      subtask_unsign: { Args: { subtask: string }; Returns: undefined }
      task_ai_confidence: { Args: { task_id: string }; Returns: number }
      task_get_ai_metadata: { Args: { task_id: string }; Returns: Json }
      task_get_repeat_rule: { Args: { task_id: string }; Returns: Json }
      task_next_due_date: { Args: { task_id: string }; Returns: string }
      task_set_ai_metadata: {
        Args: { ai: Json; task_id: string }
        Returns: undefined
      }
      task_set_repeat_rule: {
        Args: { rule: Json; task_id: string }
        Returns: undefined
      }
      unlock_checklist_template: {
        Args: { p_org: string; p_template: string }
        Returns: undefined
      }
      update_org_compliance_summary: {
        Args: { org: string }
        Returns: undefined
      }
      update_property_geo: {
        Args: {
          p_address_components?: Json
          p_address_formatted?: string
          p_address_validated?: boolean
          p_geo_accuracy_m?: number
          p_latitude?: number
          p_longitude?: number
          p_place_id?: string
          p_property_id: string
        }
        Returns: boolean
      }
      update_property_thumbnail: {
        Args: { p_property_id: string; p_thumbnail_url: string }
        Returns: Json
      }
      update_thread_ai_summary: {
        Args: { p_summary: Json; p_thread_id: string }
        Returns: undefined
      }
      validate_task_payload: {
        Args: { p_priority: string; p_space_ids: string[]; p_title: string }
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
      org_type: "personal" | "business" | "contractor"
      ownership_type: "owned" | "leased" | "rented" | "managed" | "other"
      site_type:
        | "residential"
        | "commercial"
        | "mixed_use"
        | "industrial"
        | "land"
        | "other"
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
    },
  },
} as const
