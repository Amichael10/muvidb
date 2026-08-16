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
      actor_credit_requests: {
        Row: {
          applied_credit_id: string | null
          applied_film_id: string | null
          character_name: string | null
          created_at: string
          credit_id: string | null
          evidence_url: string | null
          film_id: string | null
          id: string
          note: string | null
          person_id: string
          proposed_film: Json | null
          rejection_reason: string | null
          request_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_note: string | null
          role: string | null
          status: string
          submitted_by: string
          updated_at: string
        }
        Insert: {
          applied_credit_id?: string | null
          applied_film_id?: string | null
          character_name?: string | null
          created_at?: string
          credit_id?: string | null
          evidence_url?: string | null
          film_id?: string | null
          id?: string
          note?: string | null
          person_id: string
          proposed_film?: Json | null
          rejection_reason?: string | null
          request_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          role?: string | null
          status?: string
          submitted_by: string
          updated_at?: string
        }
        Update: {
          applied_credit_id?: string | null
          applied_film_id?: string | null
          character_name?: string | null
          created_at?: string
          credit_id?: string | null
          evidence_url?: string | null
          film_id?: string | null
          id?: string
          note?: string | null
          person_id?: string
          proposed_film?: Json | null
          rejection_reason?: string | null
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          role?: string | null
          status?: string
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "actor_credit_requests_applied_credit_id_fkey"
            columns: ["applied_credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actor_credit_requests_applied_film_id_fkey"
            columns: ["applied_film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actor_credit_requests_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actor_credit_requests_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actor_credit_requests_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actor_credit_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actor_credit_requests_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      actor_profile_access: {
        Row: {
          access_role: string
          claim_id: string | null
          created_at: string
          granted_at: string
          granted_by: string | null
          id: string
          person_id: string
          revoked_at: string | null
          revoked_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_role?: string
          claim_id?: string | null
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          person_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_role?: string
          claim_id?: string | null
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          person_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "actor_profile_access_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "profile_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actor_profile_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actor_profile_access_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actor_profile_access_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actor_profile_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_actions: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      allowlisted_ips: {
        Row: {
          created_at: string
          ip: string
          note: string | null
        }
        Insert: {
          created_at?: string
          ip: string
          note?: string | null
        }
        Update: {
          created_at?: string
          ip?: string
          note?: string | null
        }
        Relationships: []
      }
      artist_outreach: {
        Row: {
          contacted_at: string | null
          created_at: string
          id: string
          last_message: string | null
          notes: string | null
          person_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contacted_at?: string | null
          created_at?: string
          id?: string
          last_message?: string | null
          notes?: string | null
          person_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contacted_at?: string | null
          created_at?: string
          id?: string
          last_message?: string | null
          notes?: string | null
          person_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_outreach_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_jobs: {
        Row: {
          id: string
          last_message: string | null
          last_run: string | null
          status: string
        }
        Insert: {
          id: string
          last_message?: string | null
          last_run?: string | null
          status?: string
        }
        Update: {
          id?: string
          last_message?: string | null
          last_run?: string | null
          status?: string
        }
        Relationships: []
      }
      blocked_ips: {
        Row: {
          blocked_by: string
          created_at: string
          expires_at: string | null
          ip: string
          reason: string | null
        }
        Insert: {
          blocked_by?: string
          created_at?: string
          expires_at?: string | null
          ip: string
          reason?: string | null
        }
        Update: {
          blocked_by?: string
          created_at?: string
          expires_at?: string | null
          ip?: string
          reason?: string | null
        }
        Relationships: []
      }
      channel_flags: {
        Row: {
          channel_id: string
          created_at: string | null
          details: string | null
          id: string
          reason: string
          status: string
          user_id: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          details?: string | null
          id?: string
          reason: string
          status?: string
          user_id?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          details?: string | null
          id?: string
          reason?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_flags_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_videos: {
        Row: {
          channel_id: string
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          film_id: string | null
          id: string
          is_hidden: boolean | null
          match_confidence: number | null
          match_status: string | null
          published_at: string | null
          thumbnail_url: string | null
          title: string | null
          video_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          film_id?: string | null
          id?: string
          is_hidden?: boolean | null
          match_confidence?: number | null
          match_status?: string | null
          published_at?: string | null
          thumbnail_url?: string | null
          title?: string | null
          video_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          film_id?: string | null
          id?: string
          is_hidden?: boolean | null
          match_confidence?: number | null
          match_status?: string | null
          published_at?: string | null
          thumbnail_url?: string | null
          title?: string | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_videos_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_videos_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          banner_url: string | null
          category: string | null
          channel_handle: string | null
          channel_id: string | null
          channel_url: string | null
          country: string | null
          created_at: string | null
          description: string | null
          id: string
          is_featured: boolean | null
          mubi_slug: string | null
          name: string
          owner_company_id: string | null
          owner_name: string | null
          owner_person_id: string | null
          slug: string | null
          subscriber_count: number | null
          sync_enabled: boolean
          thumbnail_url: string | null
          videos_last_fetched_at: string | null
        }
        Insert: {
          banner_url?: string | null
          category?: string | null
          channel_handle?: string | null
          channel_id?: string | null
          channel_url?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean | null
          mubi_slug?: string | null
          name: string
          owner_company_id?: string | null
          owner_name?: string | null
          owner_person_id?: string | null
          slug?: string | null
          subscriber_count?: number | null
          sync_enabled?: boolean
          thumbnail_url?: string | null
          videos_last_fetched_at?: string | null
        }
        Update: {
          banner_url?: string | null
          category?: string | null
          channel_handle?: string | null
          channel_id?: string | null
          channel_url?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean | null
          mubi_slug?: string | null
          name?: string
          owner_company_id?: string | null
          owner_name?: string | null
          owner_person_id?: string | null
          slug?: string | null
          subscriber_count?: number | null
          sync_enabled?: boolean
          thumbnail_url?: string | null
          videos_last_fetched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_owner_company_id_fkey"
            columns: ["owner_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_owner_person_id_fkey"
            columns: ["owner_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      cinemas: {
        Row: {
          address: string | null
          awards: Json
          booking_url: string | null
          chain: string | null
          city: string
          created_at: string | null
          description: string | null
          google_maps_url: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          scrape_adapter: string | null
          scrape_config: Json | null
          scrape_enabled: boolean | null
          scrape_failure_count: number | null
          scrape_last_error: string | null
          screens_count: number | null
          seating_capacity: number | null
          showtimes_last_fetched_at: string | null
          state: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          awards?: Json
          booking_url?: string | null
          chain?: string | null
          city: string
          created_at?: string | null
          description?: string | null
          google_maps_url?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          scrape_adapter?: string | null
          scrape_config?: Json | null
          scrape_enabled?: boolean | null
          scrape_failure_count?: number | null
          scrape_last_error?: string | null
          screens_count?: number | null
          seating_capacity?: number | null
          showtimes_last_fetched_at?: string | null
          state?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          awards?: Json
          booking_url?: string | null
          chain?: string | null
          city?: string
          created_at?: string | null
          description?: string | null
          google_maps_url?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          scrape_adapter?: string | null
          scrape_config?: Json | null
          scrape_enabled?: boolean | null
          scrape_failure_count?: number | null
          scrape_last_error?: string | null
          screens_count?: number | null
          seating_capacity?: number | null
          showtimes_last_fetched_at?: string | null
          state?: string | null
          website?: string | null
        }
        Relationships: []
      }
      collection_films: {
        Row: {
          collection_id: string | null
          created_at: string | null
          display_order: number | null
          film_id: string | null
          id: string
        }
        Insert: {
          collection_id?: string | null
          created_at?: string | null
          display_order?: number | null
          film_id?: string | null
          id?: string
        }
        Update: {
          collection_id?: string | null
          created_at?: string | null
          display_order?: number | null
          film_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_films_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_films_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          awards: Json
          company_type: string | null
          created_at: string
          description: string | null
          employees: string | null
          focus: string | null
          founded_year: number | null
          headquarters: string | null
          id: string
          instagram_url: string | null
          languages: string | null
          logo_url: string | null
          mubi_slug: string | null
          name: string
          slug: string | null
          tmdb_id: number | null
          twitter_url: string | null
          updated_at: string
          website: string | null
          years_active: string | null
          youtube_url: string | null
        }
        Insert: {
          awards?: Json
          company_type?: string | null
          created_at?: string
          description?: string | null
          employees?: string | null
          focus?: string | null
          founded_year?: number | null
          headquarters?: string | null
          id?: string
          instagram_url?: string | null
          languages?: string | null
          logo_url?: string | null
          mubi_slug?: string | null
          name: string
          slug?: string | null
          tmdb_id?: number | null
          twitter_url?: string | null
          updated_at?: string
          website?: string | null
          years_active?: string | null
          youtube_url?: string | null
        }
        Update: {
          awards?: Json
          company_type?: string | null
          created_at?: string
          description?: string | null
          employees?: string | null
          focus?: string | null
          founded_year?: number | null
          headquarters?: string | null
          id?: string
          instagram_url?: string | null
          languages?: string | null
          logo_url?: string | null
          mubi_slug?: string | null
          name?: string
          slug?: string | null
          tmdb_id?: number | null
          twitter_url?: string | null
          updated_at?: string
          website?: string | null
          years_active?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      contributions: {
        Row: {
          created_at: string
          id: string
          image_path: string | null
          image_url: string | null
          note: string | null
          payload: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string | null
          target_id: string | null
          target_table: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_path?: string | null
          image_url?: string | null
          note?: string | null
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          target_id?: string | null
          target_table?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string | null
          image_url?: string | null
          note?: string | null
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          target_id?: string | null
          target_table?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          channels_visible: boolean | null
          code: string | null
          continent: string | null
          created_at: string | null
          films_visible: boolean | null
          id: string
          is_active: boolean | null
          name: string
          nationality: string | null
          people_visible: boolean | null
          slug: string
        }
        Insert: {
          channels_visible?: boolean | null
          code?: string | null
          continent?: string | null
          created_at?: string | null
          films_visible?: boolean | null
          id?: string
          is_active?: boolean | null
          name: string
          nationality?: string | null
          people_visible?: boolean | null
          slug: string
        }
        Update: {
          channels_visible?: boolean | null
          code?: string | null
          continent?: string | null
          created_at?: string | null
          films_visible?: boolean | null
          id?: string
          is_active?: boolean | null
          name?: string
          nationality?: string | null
          people_visible?: boolean | null
          slug?: string
        }
        Relationships: []
      }
      credit_candidates: {
        Row: {
          confidence: number
          created_at: string
          credit_type: string
          film_id: string
          frame_support: number
          id: string
          job_id: string | null
          matched_person_id: string | null
          ocr_confidence: number | null
          raw_name: string
          reviewed_at: string | null
          reviewed_by: string | null
          role_or_character: string | null
          source_frame_index: number | null
          source_frame_sec: number | null
          source_layout: Json | null
          source_ocr_text: string | null
          source_video_sec: number | null
          status: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          credit_type?: string
          film_id: string
          frame_support?: number
          id?: string
          job_id?: string | null
          matched_person_id?: string | null
          ocr_confidence?: number | null
          raw_name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_or_character?: string | null
          source_frame_index?: number | null
          source_frame_sec?: number | null
          source_layout?: Json | null
          source_ocr_text?: string | null
          source_video_sec?: number | null
          status?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          credit_type?: string
          film_id?: string
          frame_support?: number
          id?: string
          job_id?: string | null
          matched_person_id?: string | null
          ocr_confidence?: number | null
          raw_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_or_character?: string | null
          source_frame_index?: number | null
          source_frame_sec?: number | null
          source_layout?: Json | null
          source_ocr_text?: string | null
          source_video_sec?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_candidates_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "credit_harvest_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_candidates_matched_person_id_fkey"
            columns: ["matched_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_harvest_control: {
        Row: {
          id: number
          pause_requested_at: string | null
          paused: boolean
          resumed_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          pause_requested_at?: string | null
          paused?: boolean
          resumed_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          pause_requested_at?: string | null
          paused?: boolean
          resumed_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      credit_harvest_jobs: {
        Row: {
          attempts: number
          candidates_found: number
          channel_id: string | null
          created_at: string
          error: string | null
          film_id: string
          heartbeat_at: string | null
          id: string
          outcome: string | null
          priority: number
          processed_at: string | null
          roll_end_pct: number | null
          roll_start_pct: number | null
          started_at: string | null
          status: string
          worker_id: string | null
        }
        Insert: {
          attempts?: number
          candidates_found?: number
          channel_id?: string | null
          created_at?: string
          error?: string | null
          film_id: string
          heartbeat_at?: string | null
          id?: string
          outcome?: string | null
          priority?: number
          processed_at?: string | null
          roll_end_pct?: number | null
          roll_start_pct?: number | null
          started_at?: string | null
          status?: string
          worker_id?: string | null
        }
        Update: {
          attempts?: number
          candidates_found?: number
          channel_id?: string | null
          created_at?: string
          error?: string | null
          film_id?: string
          heartbeat_at?: string | null
          id?: string
          outcome?: string | null
          priority?: number
          processed_at?: string | null
          roll_end_pct?: number | null
          roll_start_pct?: number | null
          started_at?: string | null
          status?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_harvest_jobs_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: true
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_harvest_logs: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          film_id: string | null
          id: number
          job_id: string | null
          level: string
          message: string
          worker_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          film_id?: string | null
          id?: number
          job_id?: string | null
          level?: string
          message: string
          worker_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          film_id?: string | null
          id?: number
          job_id?: string | null
          level?: string
          message?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_harvest_logs_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_harvest_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "credit_harvest_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_harvest_workers: {
        Row: {
          current_film_id: string | null
          current_job_id: string | null
          failure_count: number
          last_message: string | null
          last_seen_at: string
          machine_name: string
          process_id: number | null
          processed_count: number
          started_at: string
          status: string
          stopped_at: string | null
          worker_id: string
        }
        Insert: {
          current_film_id?: string | null
          current_job_id?: string | null
          failure_count?: number
          last_message?: string | null
          last_seen_at?: string
          machine_name: string
          process_id?: number | null
          processed_count?: number
          started_at?: string
          status?: string
          stopped_at?: string | null
          worker_id: string
        }
        Update: {
          current_film_id?: string | null
          current_job_id?: string | null
          failure_count?: number
          last_message?: string | null
          last_seen_at?: string
          machine_name?: string
          process_id?: number | null
          processed_count?: number
          started_at?: string
          status?: string
          stopped_at?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_harvest_workers_current_film_id_fkey"
            columns: ["current_film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_harvest_workers_current_job_id_fkey"
            columns: ["current_job_id"]
            isOneToOne: false
            referencedRelation: "credit_harvest_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_metadata_candidates: {
        Row: {
          age_rating: string | null
          confidence: number
          created_at: string
          film_id: string
          id: string
          job_id: string | null
          language: string | null
          production_company: string | null
          release_year: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          source_description: string | null
          source_evidence: Json
          source_title: string | null
          source_url: string | null
          status: string
          synopsis: string | null
          updated_at: string
        }
        Insert: {
          age_rating?: string | null
          confidence?: number
          created_at?: string
          film_id: string
          id?: string
          job_id?: string | null
          language?: string | null
          production_company?: string | null
          release_year?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          source_description?: string | null
          source_evidence?: Json
          source_title?: string | null
          source_url?: string | null
          status?: string
          synopsis?: string | null
          updated_at?: string
        }
        Update: {
          age_rating?: string | null
          confidence?: number
          created_at?: string
          film_id?: string
          id?: string
          job_id?: string | null
          language?: string | null
          production_company?: string | null
          release_year?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          source_description?: string | null
          source_evidence?: Json
          source_title?: string | null
          source_url?: string | null
          status?: string
          synopsis?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_metadata_candidates_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_metadata_candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "credit_harvest_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      credits: {
        Row: {
          billing_order: number | null
          character_name: string | null
          created_at: string
          film_id: string
          id: string
          person_id: string
          role: string
          source: string | null
        }
        Insert: {
          billing_order?: number | null
          character_name?: string | null
          created_at?: string
          film_id: string
          id?: string
          person_id: string
          role: string
          source?: string | null
        }
        Update: {
          billing_order?: number | null
          character_name?: string | null
          created_at?: string
          film_id?: string
          id?: string
          person_id?: string
          role?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credits_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      credits_case_dupe_backup: {
        Row: {
          billing_order: number | null
          character_name: string | null
          created_at: string
          film_id: string
          id: string
          person_id: string
          role: string
        }
        Insert: {
          billing_order?: number | null
          character_name?: string | null
          created_at?: string
          film_id: string
          id?: string
          person_id: string
          role: string
        }
        Update: {
          billing_order?: number | null
          character_name?: string | null
          created_at?: string
          film_id?: string
          id?: string
          person_id?: string
          role?: string
        }
        Relationships: []
      }
      credits_role_cleanup_backup: {
        Row: {
          backed_up_at: string
          billing_order: number | null
          character_name: string | null
          film_id: string | null
          id: string
          person_id: string | null
          reason: string
          role: string | null
        }
        Insert: {
          backed_up_at?: string
          billing_order?: number | null
          character_name?: string | null
          film_id?: string | null
          id: string
          person_id?: string | null
          reason: string
          role?: string | null
        }
        Update: {
          backed_up_at?: string
          billing_order?: number | null
          character_name?: string | null
          film_id?: string | null
          id?: string
          person_id?: string | null
          reason?: string
          role?: string | null
        }
        Relationships: []
      }
      critic_reviews: {
        Row: {
          avatar_url: string | null
          created_at: string
          critic_id: string | null
          critic_name: string | null
          critic_title: string | null
          film_id: string
          id: string
          is_anonymous: boolean
          is_featured: boolean
          quote: string
          rating: number | null
          review_url: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          critic_id?: string | null
          critic_name?: string | null
          critic_title?: string | null
          film_id: string
          id?: string
          is_anonymous?: boolean
          is_featured?: boolean
          quote: string
          rating?: number | null
          review_url?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          critic_id?: string | null
          critic_name?: string | null
          critic_title?: string | null
          film_id?: string
          id?: string
          is_anonymous?: boolean
          is_featured?: boolean
          quote?: string
          rating?: number | null
          review_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "critic_reviews_critic_id_fkey"
            columns: ["critic_id"]
            isOneToOne: false
            referencedRelation: "critics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "critic_reviews_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      critics: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          handle: string | null
          id: string
          is_verified: boolean
          name: string
          platform: string | null
          profile_url: string | null
          publication: string | null
          slug: string
          title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          handle?: string | null
          id?: string
          is_verified?: boolean
          name: string
          platform?: string | null
          profile_url?: string | null
          publication?: string | null
          slug: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          handle?: string | null
          id?: string
          is_verified?: boolean
          name?: string
          platform?: string | null
          profile_url?: string | null
          publication?: string | null
          slug?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dedupe_ignored_pairs: {
        Row: {
          created_at: string
          entity_type: string
          id: string
          ignored_by: string | null
          left_record_id: string
          reason: string | null
          right_record_id: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          id?: string
          ignored_by?: string | null
          left_record_id: string
          reason?: string | null
          right_record_id: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          id?: string
          ignored_by?: string | null
          left_record_id?: string
          reason?: string | null
          right_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dedupe_ignored_pairs_ignored_by_fkey"
            columns: ["ignored_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dedupe_scan_runs: {
        Row: {
          candidate_groups: number
          completed_at: string | null
          entity_type: string
          id: string
          records_scanned: number
          started_at: string
          summary: Json
        }
        Insert: {
          candidate_groups?: number
          completed_at?: string | null
          entity_type: string
          id?: string
          records_scanned?: number
          started_at?: string
          summary?: Json
        }
        Update: {
          candidate_groups?: number
          completed_at?: string | null
          entity_type?: string
          id?: string
          records_scanned?: number
          started_at?: string
          summary?: Json
        }
        Relationships: []
      }
      deletion_logs: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          entity_id: string | null
          entity_name: string
          entity_type: string
          id: string
          metadata: Json | null
          reason: string | null
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          entity_id?: string | null
          entity_name: string
          entity_type: string
          id?: string
          metadata?: Json | null
          reason?: string | null
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          entity_id?: string | null
          entity_name?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      film_companies: {
        Row: {
          company_id: string
          film_id: string
          role: Database["public"]["Enums"]["company_film_role"]
        }
        Insert: {
          company_id: string
          film_id: string
          role?: Database["public"]["Enums"]["company_film_role"]
        }
        Update: {
          company_id?: string
          film_id?: string
          role?: Database["public"]["Enums"]["company_film_role"]
        }
        Relationships: [
          {
            foreignKeyName: "film_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_companies_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      film_countries: {
        Row: {
          country_id: string
          film_id: string
        }
        Insert: {
          country_id: string
          film_id: string
        }
        Update: {
          country_id?: string
          film_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "film_countries_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_countries_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      film_embeddings: {
        Row: {
          content_hash: string
          embedding: string
          film_id: string
          model: string
          updated_at: string
        }
        Insert: {
          content_hash: string
          embedding: string
          film_id: string
          model?: string
          updated_at?: string
        }
        Update: {
          content_hash?: string
          embedding?: string
          film_id?: string
          model?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "film_embeddings_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: true
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      film_genres: {
        Row: {
          film_id: string
          genre_id: string
        }
        Insert: {
          film_id: string
          genre_id: string
        }
        Update: {
          film_id?: string
          genre_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "film_genres_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      film_reactions: {
        Row: {
          created_at: string
          film_id: string | null
          id: string
          reaction_type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          film_id?: string | null
          id?: string
          reaction_type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          film_id?: string | null
          id?: string
          reaction_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "film_reactions_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      film_related: {
        Row: {
          computed_at: string
          film_id: string
          rank: number
          reason: string | null
          related_id: string
          score: number
        }
        Insert: {
          computed_at?: string
          film_id: string
          rank: number
          reason?: string | null
          related_id: string
          score: number
        }
        Update: {
          computed_at?: string
          film_id?: string
          rank?: number
          reason?: string | null
          related_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "film_related_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_related_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      film_watch_links: {
        Row: {
          created_at: string | null
          distributor: string
          film_id: string
          id: string
          url: string
        }
        Insert: {
          created_at?: string | null
          distributor: string
          film_id: string
          id?: string
          url: string
        }
        Update: {
          created_at?: string | null
          distributor?: string
          film_id?: string
          id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "film_watch_links_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      films: {
        Row: {
          audience_rating: number | null
          audience_rating_count: number
          average_rating: number
          awards: Json
          backdrop: string | null
          backdrop_url: string | null
          box_office_currency: string | null
          box_office_domestic: number | null
          box_office_opening_weekend: number | null
          box_office_source: string | null
          box_office_updated_at: string | null
          box_office_worldwide: number | null
          budget: number | null
          coming_soon: boolean | null
          comments_synced_at: string | null
          content_kind: string | null
          content_kind_checked_at: string | null
          content_kind_confidence: number | null
          content_type: string | null
          countries: string[] | null
          created_at: string
          distributor: string | null
          duration: number | null
          episode_count: number | null
          episode_number: number | null
          genres: string[] | null
          id: string
          imdb_id: string | null
          imdb_rating: number | null
          imdb_vote_count: number | null
          is_featured: boolean | null
          is_in_cinemas: boolean | null
          is_nollywood: boolean | null
          is_published: boolean
          is_top_10: boolean | null
          is_trending: boolean | null
          language: string | null
          languages: string[] | null
          liked_percent: number | null
          mubi_id: number | null
          mubi_slug: string | null
          needs_review: boolean | null
          nfvcb_rating: Database["public"]["Enums"]["nfvcb_rating"] | null
          nfvcb_rating_source: string | null
          nfvcb_rating_verified_at: string | null
          original_title: string | null
          poster_url: string | null
          release_date: string | null
          release_type: string | null
          runtime_minutes: number | null
          season_count: number | null
          season_number: number | null
          series_id: string | null
          slug: string | null
          source: string | null
          source_video_id: string | null
          status: Database["public"]["Enums"]["film_status"]
          streaming_links: Json | null
          synopsis: string | null
          tagline: string | null
          title: string
          tmdb_id: number | null
          tmdb_rating: number | null
          tmdb_vote_count: number | null
          trailer_external_url: string | null
          trailer_source: string
          trailer_youtube_id: string | null
          updated_at: string
          view_count: number
          year: number | null
          youtube_watch_url: string | null
        }
        Insert: {
          audience_rating?: number | null
          audience_rating_count?: number
          average_rating?: number
          awards?: Json
          backdrop?: string | null
          backdrop_url?: string | null
          box_office_currency?: string | null
          box_office_domestic?: number | null
          box_office_opening_weekend?: number | null
          box_office_source?: string | null
          box_office_updated_at?: string | null
          box_office_worldwide?: number | null
          budget?: number | null
          coming_soon?: boolean | null
          comments_synced_at?: string | null
          content_kind?: string | null
          content_kind_checked_at?: string | null
          content_kind_confidence?: number | null
          content_type?: string | null
          countries?: string[] | null
          created_at?: string
          distributor?: string | null
          duration?: number | null
          episode_count?: number | null
          episode_number?: number | null
          genres?: string[] | null
          id?: string
          imdb_id?: string | null
          imdb_rating?: number | null
          imdb_vote_count?: number | null
          is_featured?: boolean | null
          is_in_cinemas?: boolean | null
          is_nollywood?: boolean | null
          is_published?: boolean
          is_top_10?: boolean | null
          is_trending?: boolean | null
          language?: string | null
          languages?: string[] | null
          liked_percent?: number | null
          mubi_id?: number | null
          mubi_slug?: string | null
          needs_review?: boolean | null
          nfvcb_rating?: Database["public"]["Enums"]["nfvcb_rating"] | null
          nfvcb_rating_source?: string | null
          nfvcb_rating_verified_at?: string | null
          original_title?: string | null
          poster_url?: string | null
          release_date?: string | null
          release_type?: string | null
          runtime_minutes?: number | null
          season_count?: number | null
          season_number?: number | null
          series_id?: string | null
          slug?: string | null
          source?: string | null
          source_video_id?: string | null
          status?: Database["public"]["Enums"]["film_status"]
          streaming_links?: Json | null
          synopsis?: string | null
          tagline?: string | null
          title: string
          tmdb_id?: number | null
          tmdb_rating?: number | null
          tmdb_vote_count?: number | null
          trailer_external_url?: string | null
          trailer_source?: string
          trailer_youtube_id?: string | null
          updated_at?: string
          view_count?: number
          year?: number | null
          youtube_watch_url?: string | null
        }
        Update: {
          audience_rating?: number | null
          audience_rating_count?: number
          average_rating?: number
          awards?: Json
          backdrop?: string | null
          backdrop_url?: string | null
          box_office_currency?: string | null
          box_office_domestic?: number | null
          box_office_opening_weekend?: number | null
          box_office_source?: string | null
          box_office_updated_at?: string | null
          box_office_worldwide?: number | null
          budget?: number | null
          coming_soon?: boolean | null
          comments_synced_at?: string | null
          content_kind?: string | null
          content_kind_checked_at?: string | null
          content_kind_confidence?: number | null
          content_type?: string | null
          countries?: string[] | null
          created_at?: string
          distributor?: string | null
          duration?: number | null
          episode_count?: number | null
          episode_number?: number | null
          genres?: string[] | null
          id?: string
          imdb_id?: string | null
          imdb_rating?: number | null
          imdb_vote_count?: number | null
          is_featured?: boolean | null
          is_in_cinemas?: boolean | null
          is_nollywood?: boolean | null
          is_published?: boolean
          is_top_10?: boolean | null
          is_trending?: boolean | null
          language?: string | null
          languages?: string[] | null
          liked_percent?: number | null
          mubi_id?: number | null
          mubi_slug?: string | null
          needs_review?: boolean | null
          nfvcb_rating?: Database["public"]["Enums"]["nfvcb_rating"] | null
          nfvcb_rating_source?: string | null
          nfvcb_rating_verified_at?: string | null
          original_title?: string | null
          poster_url?: string | null
          release_date?: string | null
          release_type?: string | null
          runtime_minutes?: number | null
          season_count?: number | null
          season_number?: number | null
          series_id?: string | null
          slug?: string | null
          source?: string | null
          source_video_id?: string | null
          status?: Database["public"]["Enums"]["film_status"]
          streaming_links?: Json | null
          synopsis?: string | null
          tagline?: string | null
          title?: string
          tmdb_id?: number | null
          tmdb_rating?: number | null
          tmdb_vote_count?: number | null
          trailer_external_url?: string | null
          trailer_source?: string
          trailer_youtube_id?: string | null
          updated_at?: string
          view_count?: number
          year?: number | null
          youtube_watch_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "films_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      films_pg13_remap_backup: {
        Row: {
          film_id: string
          previous_rating: string
          remapped_at: string
          remapped_to: string
        }
        Insert: {
          film_id: string
          previous_rating: string
          remapped_at?: string
          remapped_to: string
        }
        Update: {
          film_id?: string
          previous_rating?: string
          remapped_at?: string
          remapped_to?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          followed_at: string
          person_id: string
          user_id: string
        }
        Insert: {
          followed_at?: string
          person_id: string
          user_id: string
        }
        Update: {
          followed_at?: string
          person_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          admin_notes: string | null
          answers: Json
          availability: string | null
          content_idea: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          introduction: string | null
          job_id: string
          location: string | null
          phone: string | null
          portfolio_links: string | null
          resume_content_type: string | null
          resume_filename: string | null
          resume_path: string | null
          social_links: string | null
          status: string
        }
        Insert: {
          admin_notes?: string | null
          answers?: Json
          availability?: string | null
          content_idea?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          introduction?: string | null
          job_id: string
          location?: string | null
          phone?: string | null
          portfolio_links?: string | null
          resume_content_type?: string | null
          resume_filename?: string | null
          resume_path?: string | null
          social_links?: string | null
          status?: string
        }
        Update: {
          admin_notes?: string | null
          answers?: Json
          availability?: string | null
          content_idea?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          introduction?: string | null
          job_id?: string
          location?: string | null
          phone?: string | null
          portfolio_links?: string | null
          resume_content_type?: string | null
          resume_filename?: string | null
          resume_path?: string | null
          social_links?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_postings: {
        Row: {
          application_form: Json
          apply_email: string | null
          apply_url: string | null
          created_at: string
          department: string | null
          description_md: string
          employment_type: string
          experience_level: string | null
          id: string
          is_published: boolean
          location: string | null
          published_at: string | null
          salary_text: string | null
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          application_form?: Json
          apply_email?: string | null
          apply_url?: string | null
          created_at?: string
          department?: string | null
          description_md?: string
          employment_type?: string
          experience_level?: string | null
          id?: string
          is_published?: boolean
          location?: string | null
          published_at?: string | null
          salary_text?: string | null
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          application_form?: Json
          apply_email?: string | null
          apply_url?: string | null
          created_at?: string
          department?: string | null
          description_md?: string
          employment_type?: string
          experience_level?: string | null
          id?: string
          is_published?: boolean
          location?: string | null
          published_at?: string | null
          salary_text?: string | null
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      nfvcb_pending_matches: {
        Row: {
          approved_on: string | null
          candidate_film_id: string | null
          candidate_title: string | null
          created_at: string
          director: string | null
          id: string
          language: string | null
          major_cast: string[]
          official_title: string
          producer: string | null
          production_company: string | null
          rating: string | null
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          runtime_minutes: number | null
          source_month: string
          status: string
        }
        Insert: {
          approved_on?: string | null
          candidate_film_id?: string | null
          candidate_title?: string | null
          created_at?: string
          director?: string | null
          id?: string
          language?: string | null
          major_cast?: string[]
          official_title: string
          producer?: string | null
          production_company?: string | null
          rating?: string | null
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          runtime_minutes?: number | null
          source_month: string
          status?: string
        }
        Update: {
          approved_on?: string | null
          candidate_film_id?: string | null
          candidate_title?: string | null
          created_at?: string
          director?: string | null
          id?: string
          language?: string | null
          major_cast?: string[]
          official_title?: string
          producer?: string | null
          production_company?: string | null
          rating?: string | null
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          runtime_minutes?: number | null
          source_month?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfvcb_pending_matches_candidate_film_id_fkey"
            columns: ["candidate_film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfvcb_pending_matches_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_cinema_films: {
        Row: {
          admin_decision: string | null
          external_id: string | null
          first_seen_at: string | null
          id: string
          last_seen_at: string | null
          last_seen_cinema_id: string | null
          poster_url: string | null
          promoted_film_id: string | null
          rating: string | null
          runtime_minutes: number | null
          showtime_count: number | null
          source: string | null
          synopsis: string | null
          title: string
        }
        Insert: {
          admin_decision?: string | null
          external_id?: string | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          last_seen_cinema_id?: string | null
          poster_url?: string | null
          promoted_film_id?: string | null
          rating?: string | null
          runtime_minutes?: number | null
          showtime_count?: number | null
          source?: string | null
          synopsis?: string | null
          title: string
        }
        Update: {
          admin_decision?: string | null
          external_id?: string | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          last_seen_cinema_id?: string | null
          poster_url?: string | null
          promoted_film_id?: string | null
          rating?: string | null
          runtime_minutes?: number | null
          showtime_count?: number | null
          source?: string | null
          synopsis?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_cinema_films_last_seen_cinema_id_fkey"
            columns: ["last_seen_cinema_id"]
            isOneToOne: false
            referencedRelation: "cinemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_cinema_films_promoted_film_id_fkey"
            columns: ["promoted_film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_cinema_showtimes: {
        Row: {
          cinema_id: string
          created_at: string
          format: string
          id: string
          last_seen_at: string
          pending_film_id: string
          price: number | null
          screen_name: string | null
          show_date: string
          show_time: string
          source: string | null
          ticket_url: string | null
        }
        Insert: {
          cinema_id: string
          created_at?: string
          format?: string
          id?: string
          last_seen_at?: string
          pending_film_id: string
          price?: number | null
          screen_name?: string | null
          show_date: string
          show_time: string
          source?: string | null
          ticket_url?: string | null
        }
        Update: {
          cinema_id?: string
          created_at?: string
          format?: string
          id?: string
          last_seen_at?: string
          pending_film_id?: string
          price?: number | null
          screen_name?: string | null
          show_date?: string
          show_time?: string
          source?: string | null
          ticket_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_cinema_showtimes_cinema_id_fkey"
            columns: ["cinema_id"]
            isOneToOne: false
            referencedRelation: "cinemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_cinema_showtimes_pending_film_id_fkey"
            columns: ["pending_film_id"]
            isOneToOne: false
            referencedRelation: "pending_cinema_films"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          awards: Json
          bio: string | null
          birthplace: string | null
          claimed_by: string | null
          created_at: string
          date_of_birth: string | null
          facebook_url: string | null
          film_count: number | null
          gender: string | null
          id: string
          instagram_url: string | null
          is_spotlight: boolean | null
          is_verified: boolean
          known_for_department: string | null
          mubi_id: number | null
          mubi_slug: string | null
          name: string
          name_key: string | null
          nationality: string | null
          needs_review: boolean | null
          photo_cutout_attempted_at: string | null
          photo_cutout_error: string | null
          photo_cutout_source_url: string | null
          photo_cutout_status: string | null
          photo_cutout_url: string | null
          photo_url: string | null
          popularity_score: number
          profile_views: number | null
          slug: string | null
          source: string | null
          status: string | null
          tiktok_url: string | null
          tmdb_id: number | null
          twitter_url: string | null
          updated_at: string
          youtube_channel_id: string | null
          youtube_handle: string | null
          youtube_stats: Json | null
        }
        Insert: {
          awards?: Json
          bio?: string | null
          birthplace?: string | null
          claimed_by?: string | null
          created_at?: string
          date_of_birth?: string | null
          facebook_url?: string | null
          film_count?: number | null
          gender?: string | null
          id?: string
          instagram_url?: string | null
          is_spotlight?: boolean | null
          is_verified?: boolean
          known_for_department?: string | null
          mubi_id?: number | null
          mubi_slug?: string | null
          name: string
          name_key?: string | null
          nationality?: string | null
          needs_review?: boolean | null
          photo_cutout_attempted_at?: string | null
          photo_cutout_error?: string | null
          photo_cutout_source_url?: string | null
          photo_cutout_status?: string | null
          photo_cutout_url?: string | null
          photo_url?: string | null
          popularity_score?: number
          profile_views?: number | null
          slug?: string | null
          source?: string | null
          status?: string | null
          tiktok_url?: string | null
          tmdb_id?: number | null
          twitter_url?: string | null
          updated_at?: string
          youtube_channel_id?: string | null
          youtube_handle?: string | null
          youtube_stats?: Json | null
        }
        Update: {
          awards?: Json
          bio?: string | null
          birthplace?: string | null
          claimed_by?: string | null
          created_at?: string
          date_of_birth?: string | null
          facebook_url?: string | null
          film_count?: number | null
          gender?: string | null
          id?: string
          instagram_url?: string | null
          is_spotlight?: boolean | null
          is_verified?: boolean
          known_for_department?: string | null
          mubi_id?: number | null
          mubi_slug?: string | null
          name?: string
          name_key?: string | null
          nationality?: string | null
          needs_review?: boolean | null
          photo_cutout_attempted_at?: string | null
          photo_cutout_error?: string | null
          photo_cutout_source_url?: string | null
          photo_cutout_status?: string | null
          photo_cutout_url?: string | null
          photo_url?: string | null
          popularity_score?: number
          profile_views?: number | null
          slug?: string | null
          source?: string | null
          status?: string | null
          tiktok_url?: string | null
          tmdb_id?: number | null
          twitter_url?: string | null
          updated_at?: string
          youtube_channel_id?: string | null
          youtube_handle?: string | null
          youtube_stats?: Json | null
        }
        Relationships: []
      }
      people_enrichment_evidence: {
        Row: {
          created_at: string
          evidence_excerpt: string | null
          field_name: string
          id: string
          identity_anchor: string | null
          proposed_value: string
          queue_id: string
          research_run_id: string | null
          retrieved_at: string
          source_domain: string | null
          source_tier: number
          source_title: string | null
          source_url: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          evidence_excerpt?: string | null
          field_name: string
          id?: string
          identity_anchor?: string | null
          proposed_value: string
          queue_id: string
          research_run_id?: string | null
          retrieved_at?: string
          source_domain?: string | null
          source_tier?: number
          source_title?: string | null
          source_url: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          evidence_excerpt?: string | null
          field_name?: string
          id?: string
          identity_anchor?: string | null
          proposed_value?: string
          queue_id?: string
          research_run_id?: string | null
          retrieved_at?: string
          source_domain?: string | null
          source_tier?: number
          source_title?: string | null
          source_url?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_enrichment_evidence_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "people_enrichment_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_enrichment_evidence_research_run_id_fkey"
            columns: ["research_run_id"]
            isOneToOne: false
            referencedRelation: "people_enrichment_research_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      people_enrichment_history: {
        Row: {
          action: string
          changed_fields: string[]
          created_at: string
          id: string
          note: string | null
          person_id: string
          previous_data: Json
          proposed_data: Json
          queue_id: string | null
          reviewed_by: string | null
          source_details: Json
        }
        Insert: {
          action: string
          changed_fields?: string[]
          created_at?: string
          id?: string
          note?: string | null
          person_id: string
          previous_data?: Json
          proposed_data?: Json
          queue_id?: string | null
          reviewed_by?: string | null
          source_details?: Json
        }
        Update: {
          action?: string
          changed_fields?: string[]
          created_at?: string
          id?: string
          note?: string | null
          person_id?: string
          previous_data?: Json
          proposed_data?: Json
          queue_id?: string | null
          reviewed_by?: string | null
          source_details?: Json
        }
        Relationships: [
          {
            foreignKeyName: "people_enrichment_history_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_enrichment_history_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "people_enrichment_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_enrichment_history_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      people_enrichment_queue: {
        Row: {
          attempt_count: number
          candidate_data: Json
          created_at: string
          current_completeness: number
          field_sources: Json
          id: string
          last_attempt_at: string | null
          match_confidence: number | null
          match_reasons: string[]
          matched_credits: string[]
          missing_fields: string[]
          person_id: string
          priority_score: number
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_note: string | null
          source_name: string | null
          source_record_id: string | null
          source_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          candidate_data?: Json
          created_at?: string
          current_completeness?: number
          field_sources?: Json
          id?: string
          last_attempt_at?: string | null
          match_confidence?: number | null
          match_reasons?: string[]
          matched_credits?: string[]
          missing_fields?: string[]
          person_id: string
          priority_score?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          source_name?: string | null
          source_record_id?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          candidate_data?: Json
          created_at?: string
          current_completeness?: number
          field_sources?: Json
          id?: string
          last_attempt_at?: string | null
          match_confidence?: number | null
          match_reasons?: string[]
          matched_credits?: string[]
          missing_fields?: string[]
          person_id?: string
          priority_score?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          source_name?: string | null
          source_record_id?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_enrichment_queue_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_enrichment_queue_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      people_enrichment_research_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          estimated_cost: number
          grounding_metadata: Json
          id: string
          identity_confidence: number | null
          identity_reasons: string[]
          input_fingerprint: string
          model: string
          prompt_version: string
          provider: string
          queue_id: string
          raw_response: Json
          search_queries: string[]
          started_at: string
          status: string
          token_usage: Json
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          estimated_cost?: number
          grounding_metadata?: Json
          id?: string
          identity_confidence?: number | null
          identity_reasons?: string[]
          input_fingerprint: string
          model: string
          prompt_version: string
          provider?: string
          queue_id: string
          raw_response?: Json
          search_queries?: string[]
          started_at?: string
          status: string
          token_usage?: Json
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          estimated_cost?: number
          grounding_metadata?: Json
          id?: string
          identity_confidence?: number | null
          identity_reasons?: string[]
          input_fingerprint?: string
          model?: string
          prompt_version?: string
          provider?: string
          queue_id?: string
          raw_response?: Json
          search_queries?: string[]
          started_at?: string
          status?: string
          token_usage?: Json
        }
        Relationships: [
          {
            foreignKeyName: "people_enrichment_research_runs_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "people_enrichment_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      person_box_office_rankings: {
        Row: {
          category: string
          created_at: string
          criteria: string | null
          film_ids: string[]
          films: string[]
          gross_label: string
          gross_ngn_estimate: number
          id: string
          person_id: string
          rank: number
          source_name: string
          source_page: number | null
          source_url: string | null
          updated_at: string
          year: number
        }
        Insert: {
          category: string
          created_at?: string
          criteria?: string | null
          film_ids?: string[]
          films?: string[]
          gross_label: string
          gross_ngn_estimate: number
          id?: string
          person_id: string
          rank: number
          source_name: string
          source_page?: number | null
          source_url?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          category?: string
          created_at?: string
          criteria?: string | null
          film_ids?: string[]
          films?: string[]
          gross_label?: string
          gross_ngn_estimate?: number
          id?: string
          person_id?: string
          rank?: number
          source_name?: string
          source_page?: number | null
          source_url?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "person_box_office_rankings_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_new_releases: {
        Row: {
          created_at: string
          display_order: number
          entry_source: string
          film_id: string
          id: string
          is_hidden: boolean
          platform: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          entry_source?: string
          film_id: string
          id?: string
          is_hidden?: boolean
          platform: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          entry_source?: string
          film_id?: string
          id?: string
          is_hidden?: boolean
          platform?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_new_releases_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      plays: {
        Row: {
          banner_url: string | null
          city: string | null
          country: string | null
          created_at: string
          director: string | null
          genre: string | null
          id: string
          performance_time: string | null
          playwright: string | null
          poster_url: string | null
          producer: string | null
          run_end_date: string | null
          run_start_date: string | null
          slug: string
          source_url: string | null
          status: string
          synopsis: string | null
          title: string
          updated_at: string
          venue: string | null
          year: number | null
        }
        Insert: {
          banner_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          director?: string | null
          genre?: string | null
          id?: string
          performance_time?: string | null
          playwright?: string | null
          poster_url?: string | null
          producer?: string | null
          run_end_date?: string | null
          run_start_date?: string | null
          slug: string
          source_url?: string | null
          status?: string
          synopsis?: string | null
          title: string
          updated_at?: string
          venue?: string | null
          year?: number | null
        }
        Update: {
          banner_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          director?: string | null
          genre?: string | null
          id?: string
          performance_time?: string | null
          playwright?: string | null
          poster_url?: string | null
          producer?: string | null
          run_end_date?: string | null
          run_start_date?: string | null
          slug?: string
          source_url?: string | null
          status?: string
          synopsis?: string | null
          title?: string
          updated_at?: string
          venue?: string | null
          year?: number | null
        }
        Relationships: []
      }
      profile_claims: {
        Row: {
          approval_email_sent_at: string | null
          contacted_at: string | null
          created_at: string
          id: string
          note: string | null
          person_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_note: string | null
          social_handle: string | null
          social_platform: string | null
          social_url: string | null
          status: Database["public"]["Enums"]["claim_status"]
          telegram_notification_error: string | null
          telegram_notified_at: string | null
          user_id: string
          verification_code: string
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          approval_email_sent_at?: string | null
          contacted_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          person_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          social_handle?: string | null
          social_platform?: string | null
          social_url?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          telegram_notification_error?: string | null
          telegram_notified_at?: string | null
          user_id: string
          verification_code?: string
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          approval_email_sent_at?: string | null
          contacted_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          person_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          social_handle?: string | null
          social_platform?: string | null
          social_url?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          telegram_notification_error?: string | null
          telegram_notified_at?: string | null
          user_id?: string
          verification_code?: string
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_claims_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_claims_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_avatar_url: string | null
          author_name: string | null
          body: string | null
          created_at: string
          external_id: string | null
          film_id: string
          id: string
          likes: number
          rating: number
          sentiment_score: number | null
          source: string
          source_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          author_avatar_url?: string | null
          author_name?: string | null
          body?: string | null
          created_at?: string
          external_id?: string | null
          film_id: string
          id?: string
          likes?: number
          rating: number
          sentiment_score?: number | null
          source?: string
          source_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string | null
          body?: string | null
          created_at?: string
          external_id?: string | null
          film_id?: string
          id?: string
          likes?: number
          rating?: number
          sentiment_score?: number | null
          source?: string
          source_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_alert_log: {
        Row: {
          ip: string
          last_alert_at: string
          last_hits: number | null
          last_message: string | null
        }
        Insert: {
          ip: string
          last_alert_at?: string
          last_hits?: number | null
          last_message?: string | null
        }
        Update: {
          ip?: string
          last_alert_at?: string
          last_hits?: number | null
          last_message?: string | null
        }
        Relationships: []
      }
      scrape_ip_buckets: {
        Row: {
          hits: number
          ip: string
          sample_paths: string[]
          updated_at: string
          user_agent: string | null
          window_start: string
        }
        Insert: {
          hits?: number
          ip: string
          sample_paths?: string[]
          updated_at?: string
          user_agent?: string | null
          window_start: string
        }
        Update: {
          hits?: number
          ip?: string
          sample_paths?: string[]
          updated_at?: string
          user_agent?: string | null
          window_start?: string
        }
        Relationships: []
      }
      showtimes: {
        Row: {
          cinema_id: string
          created_at: string | null
          film_id: string
          format: string
          id: string
          is_available: boolean | null
          last_seen_at: string | null
          price: number | null
          screen_name: string | null
          show_date: string
          show_time: string
          source: string | null
          ticket_url: string | null
        }
        Insert: {
          cinema_id: string
          created_at?: string | null
          film_id: string
          format?: string
          id?: string
          is_available?: boolean | null
          last_seen_at?: string | null
          price?: number | null
          screen_name?: string | null
          show_date: string
          show_time: string
          source?: string | null
          ticket_url?: string | null
        }
        Update: {
          cinema_id?: string
          created_at?: string | null
          film_id?: string
          format?: string
          id?: string
          is_available?: boolean | null
          last_seen_at?: string | null
          price?: number | null
          screen_name?: string | null
          show_date?: string
          show_time?: string
          source?: string | null
          ticket_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "showtimes_cinema_id_fkey"
            columns: ["cinema_id"]
            isOneToOne: false
            referencedRelation: "cinemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showtimes_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      social_assets: {
        Row: {
          content_item_id: string
          created_at: string
          file_size_bytes: number | null
          format: Database["public"]["Enums"]["social_asset_format"]
          height: number | null
          id: string
          mime_type: string
          public_url: string
          render_metadata: Json
          storage_bucket: string
          storage_path: string
          template_version: number | null
          width: number | null
        }
        Insert: {
          content_item_id: string
          created_at?: string
          file_size_bytes?: number | null
          format: Database["public"]["Enums"]["social_asset_format"]
          height?: number | null
          id?: string
          mime_type: string
          public_url: string
          render_metadata?: Json
          storage_bucket: string
          storage_path: string
          template_version?: number | null
          width?: number | null
        }
        Update: {
          content_item_id?: string
          created_at?: string
          file_size_bytes?: number | null
          format?: Database["public"]["Enums"]["social_asset_format"]
          height?: number | null
          id?: string
          mime_type?: string
          public_url?: string
          render_metadata?: Json
          storage_bucket?: string
          storage_path?: string
          template_version?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_assets_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "social_content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      social_calendar: {
        Row: {
          created_at: string
          created_by: string | null
          draft_id: string | null
          id: string
          notes: string | null
          priority: string
          scheduled_date: string
          scheduled_time: string | null
          selection_locked: boolean
          series_id: string | null
          source: string
          status: Database["public"]["Enums"]["editorial_calendar_status"]
          subject_entity_id: string | null
          subject_entity_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          draft_id?: string | null
          id?: string
          notes?: string | null
          priority?: string
          scheduled_date: string
          scheduled_time?: string | null
          selection_locked?: boolean
          series_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["editorial_calendar_status"]
          subject_entity_id?: string | null
          subject_entity_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          draft_id?: string | null
          id?: string
          notes?: string | null
          priority?: string
          scheduled_date?: string
          scheduled_time?: string | null
          selection_locked?: boolean
          series_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["editorial_calendar_status"]
          subject_entity_id?: string | null
          subject_entity_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_calendar_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "social_content_series"
            referencedColumns: ["id"]
          },
        ]
      }
      social_connections: {
        Row: {
          connection_metadata: Json
          created_at: string
          created_by: string | null
          display_name: string | null
          external_account_id: string
          external_parent_id: string | null
          granted_scopes: string[]
          id: string
          last_verified_at: string | null
          platform: Database["public"]["Enums"]["social_platform"]
          profile_image_url: string | null
          refresh_token_expires_at: string | null
          status: Database["public"]["Enums"]["social_connection_status"]
          token_expires_at: string | null
          token_secret_id: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          connection_metadata?: Json
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          external_account_id: string
          external_parent_id?: string | null
          granted_scopes?: string[]
          id?: string
          last_verified_at?: string | null
          platform: Database["public"]["Enums"]["social_platform"]
          profile_image_url?: string | null
          refresh_token_expires_at?: string | null
          status?: Database["public"]["Enums"]["social_connection_status"]
          token_expires_at?: string | null
          token_secret_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          connection_metadata?: Json
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          external_account_id?: string
          external_parent_id?: string | null
          granted_scopes?: string[]
          id?: string
          last_verified_at?: string | null
          platform?: Database["public"]["Enums"]["social_platform"]
          profile_image_url?: string | null
          refresh_token_expires_at?: string | null
          status?: Database["public"]["Enums"]["social_connection_status"]
          token_expires_at?: string | null
          token_secret_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      social_content_events: {
        Row: {
          actor_user_id: string | null
          content_item_id: string
          created_at: string
          event_data: Json
          event_type: string
          id: string
          platform_variant_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          content_item_id: string
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          platform_variant_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          content_item_id?: string
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          platform_variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_content_events_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "social_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_content_events_platform_variant_id_fkey"
            columns: ["platform_variant_id"]
            isOneToOne: false
            referencedRelation: "social_platform_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      social_content_items: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          content_type: string
          created_at: string
          created_by: string | null
          generation_method: string
          generation_notes: string | null
          id: string
          internal_notes: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          source_entity_id: string
          source_entity_type: string
          source_snapshot: Json
          status: Database["public"]["Enums"]["social_content_status"]
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          content_type: string
          created_at?: string
          created_by?: string | null
          generation_method?: string
          generation_notes?: string | null
          id?: string
          internal_notes?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          source_entity_id: string
          source_entity_type: string
          source_snapshot: Json
          status?: Database["public"]["Enums"]["social_content_status"]
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          content_type?: string
          created_at?: string
          created_by?: string | null
          generation_method?: string
          generation_notes?: string | null
          id?: string
          internal_notes?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          source_entity_id?: string
          source_entity_type?: string
          source_snapshot?: Json
          status?: Database["public"]["Enums"]["social_content_status"]
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_content_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "social_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      social_content_series: {
        Row: {
          active: boolean
          category: string
          config: Json
          cooldown_days: number
          created_at: string
          default_frequency: string
          description: string | null
          figma_template_key: string | null
          id: string
          min_candidate_score: number
          min_reviews: number
          name: string
          preferred_format: string
          preferred_platforms: string[]
          requires_photo: boolean
          requires_poster: boolean
          requires_reviews: boolean
          requires_streaming: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          config?: Json
          cooldown_days?: number
          created_at?: string
          default_frequency?: string
          description?: string | null
          figma_template_key?: string | null
          id?: string
          min_candidate_score?: number
          min_reviews?: number
          name: string
          preferred_format?: string
          preferred_platforms?: string[]
          requires_photo?: boolean
          requires_poster?: boolean
          requires_reviews?: boolean
          requires_streaming?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          config?: Json
          cooldown_days?: number
          created_at?: string
          default_frequency?: string
          description?: string | null
          figma_template_key?: string | null
          id?: string
          min_candidate_score?: number
          min_reviews?: number
          name?: string
          preferred_format?: string
          preferred_platforms?: string[]
          requires_photo?: boolean
          requires_poster?: boolean
          requires_reviews?: boolean
          requires_streaming?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_drafts: {
        Row: {
          ai_model: string | null
          angle_id: string | null
          angle_json: Json
          approved_at: string | null
          approved_by: string | null
          calendar_id: string | null
          candidate_score: number | null
          caption_style: string | null
          content_json: Json
          created_at: string
          created_by: string | null
          edited_content_json: Json | null
          editor_notes: string | null
          entity_id: string
          entity_type: string
          fact_pack_json: Json
          figma_template_key: string | null
          id: string
          prompt_version: string | null
          published_at: string | null
          selection_reason: Json
          series_id: string | null
          status: Database["public"]["Enums"]["editorial_draft_status"]
          updated_at: string
          validation_results: Json
        }
        Insert: {
          ai_model?: string | null
          angle_id?: string | null
          angle_json?: Json
          approved_at?: string | null
          approved_by?: string | null
          calendar_id?: string | null
          candidate_score?: number | null
          caption_style?: string | null
          content_json?: Json
          created_at?: string
          created_by?: string | null
          edited_content_json?: Json | null
          editor_notes?: string | null
          entity_id: string
          entity_type: string
          fact_pack_json?: Json
          figma_template_key?: string | null
          id?: string
          prompt_version?: string | null
          published_at?: string | null
          selection_reason?: Json
          series_id?: string | null
          status?: Database["public"]["Enums"]["editorial_draft_status"]
          updated_at?: string
          validation_results?: Json
        }
        Update: {
          ai_model?: string | null
          angle_id?: string | null
          angle_json?: Json
          approved_at?: string | null
          approved_by?: string | null
          calendar_id?: string | null
          candidate_score?: number | null
          caption_style?: string | null
          content_json?: Json
          created_at?: string
          created_by?: string | null
          edited_content_json?: Json | null
          editor_notes?: string | null
          entity_id?: string
          entity_type?: string
          fact_pack_json?: Json
          figma_template_key?: string | null
          id?: string
          prompt_version?: string | null
          published_at?: string | null
          selection_reason?: Json
          series_id?: string | null
          status?: Database["public"]["Enums"]["editorial_draft_status"]
          updated_at?: string
          validation_results?: Json
        }
        Relationships: [
          {
            foreignKeyName: "social_drafts_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "social_calendar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_drafts_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "social_content_series"
            referencedColumns: ["id"]
          },
        ]
      }
      social_entity_history: {
        Row: {
          angle: string | null
          calendar_id: string | null
          caption_style: string | null
          country: string | null
          created_at: string
          draft_id: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          platforms: string[]
          profession: string | null
          published_at: string
          series_id: string | null
        }
        Insert: {
          angle?: string | null
          calendar_id?: string | null
          caption_style?: string | null
          country?: string | null
          created_at?: string
          draft_id?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          platforms?: string[]
          profession?: string | null
          published_at?: string
          series_id?: string | null
        }
        Update: {
          angle?: string | null
          calendar_id?: string | null
          caption_style?: string | null
          country?: string | null
          created_at?: string
          draft_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          platforms?: string[]
          profession?: string | null
          published_at?: string
          series_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_entity_history_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "social_calendar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_entity_history_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "social_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_entity_history_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "social_content_series"
            referencedColumns: ["id"]
          },
        ]
      }
      social_generation_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          model: string
          output_tokens: number | null
          prompt_version: number | null
          provider: string
          success: boolean
          task_type: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model: string
          output_tokens?: number | null
          prompt_version?: number | null
          provider?: string
          success?: boolean
          task_type: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string
          output_tokens?: number | null
          prompt_version?: number | null
          provider?: string
          success?: boolean
          task_type?: string
        }
        Relationships: []
      }
      social_news_events: {
        Row: {
          confidence: number | null
          created_at: string
          description: string | null
          detected_at: string
          draft_id: string | null
          entity_id: string | null
          entity_type: string | null
          event_date: string | null
          event_type: string
          id: string
          metadata: Json
          source_type: string
          source_url: string | null
          status: Database["public"]["Enums"]["editorial_event_status"]
          title: string
          updated_at: string
          urgency: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          description?: string | null
          detected_at?: string
          draft_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_date?: string | null
          event_type: string
          id?: string
          metadata?: Json
          source_type?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["editorial_event_status"]
          title: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          description?: string | null
          detected_at?: string
          draft_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_date?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          source_type?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["editorial_event_status"]
          title?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_news_events_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "social_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_platform_variants: {
        Row: {
          caption: string
          connection_id: string | null
          content_item_id: string
          created_at: string
          external_permalink: string | null
          external_post_id: string | null
          hashtags: string[]
          id: string
          last_error_code: string | null
          last_error_message: string | null
          mentions: string[]
          platform: Database["public"]["Enums"]["social_platform"]
          platform_options: Json
          published_at: string | null
          scheduled_for: string | null
          selected_asset_id: string | null
          status: Database["public"]["Enums"]["social_variant_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          caption?: string
          connection_id?: string | null
          content_item_id: string
          created_at?: string
          external_permalink?: string | null
          external_post_id?: string | null
          hashtags?: string[]
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          mentions?: string[]
          platform: Database["public"]["Enums"]["social_platform"]
          platform_options?: Json
          published_at?: string | null
          scheduled_for?: string | null
          selected_asset_id?: string | null
          status?: Database["public"]["Enums"]["social_variant_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          caption?: string
          connection_id?: string | null
          content_item_id?: string
          created_at?: string
          external_permalink?: string | null
          external_post_id?: string | null
          hashtags?: string[]
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          mentions?: string[]
          platform?: Database["public"]["Enums"]["social_platform"]
          platform_options?: Json
          published_at?: string | null
          scheduled_for?: string | null
          selected_asset_id?: string | null
          status?: Database["public"]["Enums"]["social_variant_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_platform_variants_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_platform_variants_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "social_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_platform_variants_selected_asset_id_fkey"
            columns: ["selected_asset_id"]
            isOneToOne: false
            referencedRelation: "social_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      social_prompt_templates: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          prompt: string
          task_type: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          prompt: string
          task_type: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          prompt?: string
          task_type?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      social_publish_jobs: {
        Row: {
          attempt_count: number
          available_at: string
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          last_error_code: string | null
          last_error_details: Json | null
          last_error_message: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          platform_variant_id: string
          provider_publish_id: string | null
          provider_response: Json | null
          scheduled_for: string
          started_at: string | null
          status: Database["public"]["Enums"]["social_job_status"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          available_at: string
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          last_error_code?: string | null
          last_error_details?: Json | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          platform_variant_id: string
          provider_publish_id?: string | null
          provider_response?: Json | null
          scheduled_for: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["social_job_status"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error_code?: string | null
          last_error_details?: Json | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          platform_variant_id?: string
          provider_publish_id?: string | null
          provider_response?: Json | null
          scheduled_for?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["social_job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_publish_jobs_platform_variant_id_fkey"
            columns: ["platform_variant_id"]
            isOneToOne: false
            referencedRelation: "social_platform_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      social_templates: {
        Row: {
          content_type: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          template_config: Json
          updated_at: string
          version: number
        }
        Insert: {
          content_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          template_config?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          content_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          template_config?: Json
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      spotlights: {
        Row: {
          created_at: string | null
          featured_film_ids: string[] | null
          id: string
          is_active: boolean | null
          person_id: string
          photo_url: string | null
          story: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          featured_film_ids?: string[] | null
          id?: string
          is_active?: boolean | null
          person_id: string
          photo_url?: string | null
          story: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          featured_film_ids?: string[] | null
          id?: string
          is_active?: boolean | null
          person_id?: string
          photo_url?: string | null
          story?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spotlights_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_credits: {
        Row: {
          billing_order: number | null
          character_name: string | null
          created_at: string
          id: string
          person_id: string
          play_id: string
          role: string
        }
        Insert: {
          billing_order?: number | null
          character_name?: string | null
          created_at?: string
          id?: string
          person_id: string
          play_id: string
          role?: string
        }
        Update: {
          billing_order?: number | null
          character_name?: string | null
          created_at?: string
          id?: string
          person_id?: string
          play_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_credits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_credits_play_id_fkey"
            columns: ["play_id"]
            isOneToOne: false
            referencedRelation: "plays"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          created_at: string
          details: Json | null
          duration_ms: number | null
          id: string
          items_created: number | null
          items_failed: number | null
          items_processed: number | null
          items_updated: number | null
          message: string | null
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          id?: string
          items_created?: number | null
          items_failed?: number | null
          items_processed?: number | null
          items_updated?: number | null
          message?: string | null
          source: string
          status: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          id?: string
          items_created?: number | null
          items_failed?: number | null
          items_processed?: number | null
          items_updated?: number | null
          message?: string | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      top_10_films: {
        Row: {
          created_at: string | null
          film_id: string
          id: string
          rank: number
        }
        Insert: {
          created_at?: string | null
          film_id: string
          id?: string
          rank: number
        }
        Update: {
          created_at?: string | null
          film_id?: string
          id?: string
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "top_10_films_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      trailer_review_queue: {
        Row: {
          channel_name: string | null
          created_at: string
          duration: string | null
          film_id: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: string
          video_thumbnail: string | null
          video_title: string | null
          view_count: number | null
          youtube_video_id: string
        }
        Insert: {
          channel_name?: string | null
          created_at?: string
          duration?: string | null
          film_id: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          video_thumbnail?: string | null
          video_title?: string | null
          view_count?: number | null
          youtube_video_id: string
        }
        Update: {
          channel_name?: string | null
          created_at?: string
          duration?: string | null
          film_id?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          video_thumbnail?: string | null
          video_title?: string | null
          view_count?: number | null
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trailer_review_queue_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trailer_review_queue_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          is_banned: boolean | null
          last_sign_in_at: string | null
          linked_profile_id: string | null
          name: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          is_banned?: boolean | null
          last_sign_in_at?: string | null
          linked_profile_id?: string | null
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          is_banned?: boolean | null
          last_sign_in_at?: string | null
          linked_profile_id?: string | null
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_users_linked_profile"
            columns: ["linked_profile_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          added_at: string
          film_id: string
          user_id: string
          watched: boolean
          watched_at: string | null
        }
        Insert: {
          added_at?: string
          film_id: string
          user_id: string
          watched?: boolean
          watched_at?: string | null
        }
        Update: {
          added_at?: string
          film_id?: string
          user_id?: string
          watched?: boolean
          watched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_channels: {
        Row: {
          added_by: string | null
          channel_id: string
          channel_url: string | null
          created_at: string
          description: string | null
          film_count: number
          id: string
          is_active: boolean
          is_featured: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          channel_id: string
          channel_url?: string | null
          created_at?: string
          description?: string | null
          film_count?: number
          id?: string
          is_active?: boolean
          is_featured?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          channel_id?: string
          channel_url?: string | null
          created_at?: string
          description?: string | null
          film_count?: number
          id?: string
          is_active?: boolean
          is_featured?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_channels_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_stats: {
        Row: {
          comment_count: number
          film_id: string
          id: string
          like_count: number
          synced_at: string
          view_count: number
          youtube_video_id: string
        }
        Insert: {
          comment_count?: number
          film_id: string
          id?: string
          like_count?: number
          synced_at?: string
          view_count?: number
          youtube_video_id: string
        }
        Update: {
          comment_count?: number
          film_id?: string
          id?: string
          like_count?: number
          synced_at?: string
          view_count?: number
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_stats_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_upload_alert_log: {
        Row: {
          channel_id: string
          notified_at: string
          title: string | null
          video_id: string
        }
        Insert: {
          channel_id: string
          notified_at?: string
          title?: string | null
          video_id: string
        }
        Update: {
          channel_id?: string
          notified_at?: string
          title?: string | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_upload_alert_log_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_ban_user: {
        Args: { ban_status: boolean; target_user_id: string }
        Returns: undefined
      }
      admin_change_role: {
        Args: { new_role: string; target_user_id: string }
        Returns: undefined
      }
      admin_delete_user: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      apply_people_enrichment_candidate: {
        Args: { p_fields: string[]; p_queue_id: string; p_reviewer_id?: string }
        Returns: Json
      }
      approve_actor_profile_claim: {
        Args: { p_admin_id: string; p_claim_id: string }
        Returns: Json
      }
      approve_credit_candidate: {
        Args: {
          p_candidate_id: string
          p_credit_type: string
          p_matched_person_id?: string
          p_name: string
          p_role_or_character?: string
        }
        Returns: {
          created_person: boolean
          person_id: string
        }[]
      }
      approve_credit_metadata_candidate: {
        Args: {
          p_age_rating?: string
          p_candidate_id: string
          p_language?: string
          p_production_company?: string
          p_release_year?: number
          p_synopsis?: string
        }
        Returns: {
          company_id: string
          created_company: boolean
          film_id: string
        }[]
      }
      batch_certify_films: { Args: { film_uuids: string[] }; Returns: number }
      batch_create_films_from_videos: {
        Args: { video_db_ids: string[] }
        Returns: {
          new_film_id: string
          video_id: string
        }[]
      }
      calculate_popularity_score: {
        Args: { person_uuid: string }
        Returns: number
      }
      claim_credit_harvest_job: {
        Args: { p_worker_id?: string }
        Returns: {
          attempts: number
          channel_id: string
          film_id: string
          id: string
        }[]
      }
      create_pro_profile: {
        Args: {
          pro_bio: string
          pro_name: string
          pro_role: string
          user_id: string
        }
        Returns: string
      }
      external_liked_pct: {
        Args: { avg: number; votes: number }
        Returns: number
      }
      film_base_liked_percent: {
        Args: {
          p_audience_rating: number
          p_imdb_rating: number
          p_imdb_vote_count: number
          p_tmdb_rating: number
          p_tmdb_vote_count: number
        }
        Returns: number
      }
      find_person_by_name: { Args: { p_name: string }; Returns: string }
      force_promote_to_admin: {
        Args: { user_email: string }
        Returns: undefined
      }
      generate_slug: { Args: { input: string }; Returns: string }
      get_coming_soon_films: { Args: { p_limit?: number }; Returns: Json[] }
      get_credit_candidate_review_films: {
        Args: {
          p_credit_type?: string
          p_limit?: number
          p_min_confidence?: number
          p_offset?: number
          p_search?: string
          p_status?: string
          p_year?: number
        }
        Returns: {
          candidate_count: number
          film_id: string
          max_confidence: number
          total_films: number
        }[]
      }
      get_duplicate_films: {
        Args: never
        Returns: {
          audience_rating: number | null
          audience_rating_count: number
          average_rating: number
          awards: Json
          backdrop: string | null
          backdrop_url: string | null
          box_office_currency: string | null
          box_office_domestic: number | null
          box_office_opening_weekend: number | null
          box_office_source: string | null
          box_office_updated_at: string | null
          box_office_worldwide: number | null
          budget: number | null
          coming_soon: boolean | null
          comments_synced_at: string | null
          content_kind: string | null
          content_kind_checked_at: string | null
          content_kind_confidence: number | null
          content_type: string | null
          countries: string[] | null
          created_at: string
          distributor: string | null
          duration: number | null
          episode_count: number | null
          episode_number: number | null
          genres: string[] | null
          id: string
          imdb_id: string | null
          imdb_rating: number | null
          imdb_vote_count: number | null
          is_featured: boolean | null
          is_in_cinemas: boolean | null
          is_nollywood: boolean | null
          is_published: boolean
          is_top_10: boolean | null
          is_trending: boolean | null
          language: string | null
          languages: string[] | null
          liked_percent: number | null
          mubi_id: number | null
          mubi_slug: string | null
          needs_review: boolean | null
          nfvcb_rating: Database["public"]["Enums"]["nfvcb_rating"] | null
          nfvcb_rating_source: string | null
          nfvcb_rating_verified_at: string | null
          original_title: string | null
          poster_url: string | null
          release_date: string | null
          release_type: string | null
          runtime_minutes: number | null
          season_count: number | null
          season_number: number | null
          series_id: string | null
          slug: string | null
          source: string | null
          source_video_id: string | null
          status: Database["public"]["Enums"]["film_status"]
          streaming_links: Json | null
          synopsis: string | null
          tagline: string | null
          title: string
          tmdb_id: number | null
          tmdb_rating: number | null
          tmdb_vote_count: number | null
          trailer_external_url: string | null
          trailer_source: string
          trailer_youtube_id: string | null
          updated_at: string
          view_count: number
          year: number | null
          youtube_watch_url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "films"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_role: { Args: never; Returns: string }
      get_people_with_counts: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_sort_asc?: boolean
          p_sort_col?: string
          p_spotlight?: string
          p_status?: string
          p_verified?: string
        }
        Returns: {
          created_at: string
          id: string
          is_spotlight: boolean
          is_verified: boolean
          known_for_department: string
          name: string
          photo_url: string
          popularity_score: number
          total_filmography_count: number
          traditional_credits_count: number
          youtube_filmography_count: number
        }[]
      }
      get_platform_new_releases: {
        Args: { p_platforms?: string[] }
        Returns: {
          display_order: number
          entry_source: string
          film: Json
          platform: string
          queue_created_at: string
        }[]
      }
      increment_profile_views: {
        Args: { person_uuid: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_clickbait_title: { Args: { t: string }; Returns: boolean }
      is_social_studio_admin: { Args: never; Returns: boolean }
      match_film_fuzzy: {
        Args: { query_title: string; threshold?: number }
        Returns: {
          id: string
          sim: number
          title: string
        }[]
      }
      match_films_by_embedding: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          film_id: string
          similarity: number
        }[]
      }
      match_people_by_name: {
        Args: { p_limit?: number; p_name: string }
        Returns: {
          film_count: number
          id: string
          match_kind: string
          name: string
          photo_url: string
          slug: string
        }[]
      }
      match_person_fuzzy: {
        Args: { query_name: string; threshold?: number }
        Returns: {
          id: string
          name: string
          sim: number
        }[]
      }
      match_related_by_embedding: {
        Args: { match_count?: number; p_film_id: string }
        Returns: {
          film_id: string
          similarity: number
        }[]
      }
      merge_companies: {
        Args: {
          p_metadata?: Json
          p_primary_id: string
          p_secondary_id: string
        }
        Returns: undefined
      }
      merge_companies_group: {
        Args: {
          p_duplicate_ids: string[]
          p_master_id: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      merge_films: {
        Args: {
          p_metadata?: Json
          p_primary_id: string
          p_secondary_id: string
        }
        Returns: undefined
      }
      merge_films_group: {
        Args: {
          p_duplicate_ids: string[]
          p_master_id: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      merge_people:
        | {
            Args: { p_duplicate_ids: string[]; p_master_id: string }
            Returns: undefined
          }
        | {
            Args: {
              p_metadata?: Json
              p_primary_id: string
              p_secondary_id: string
            }
            Returns: undefined
          }
      merge_people_group: {
        Args: {
          p_duplicate_ids: string[]
          p_master_id: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      person_name_key: { Args: { n: string }; Returns: string }
      promote_pending_cinema_film: {
        Args: {
          p_existing_film_id?: string
          p_film_data?: Json
          p_pending_id: string
        }
        Returns: string
      }
      purge_old_deletion_logs: { Args: never; Returns: number }
      reaction_liked_blend: {
        Args: { base_liked: number; dislikes: number; likes: number }
        Returns: number
      }
      recompute_film_liked_percent: {
        Args: { p_film_id: string }
        Returns: number
      }
      recover_stale_credit_harvest_jobs: {
        Args: { p_stale_after_minutes?: number }
        Returns: number
      }
      refresh_all_popularity_scores: { Args: never; Returns: undefined }
      refresh_people_enrichment_queue: { Args: never; Returns: number }
      refresh_platform_new_releases: {
        Args: { p_platform: string }
        Returns: undefined
      }
      reject_credit_metadata_candidate: {
        Args: { p_candidate_id: string }
        Returns: undefined
      }
      review_actor_credit_request: {
        Args: {
          p_admin_id: string
          p_decision: string
          p_note?: string
          p_request_id: string
        }
        Returns: Json
      }
      review_people_enrichment_candidate: {
        Args: {
          p_note?: string
          p_queue_id: string
          p_reviewer_id?: string
          p_status: string
        }
        Returns: undefined
      }
      score10_liked_pct: { Args: { score: number }; Returns: number }
      search_films_fuzzy: {
        Args: { lim?: number; q: string }
        Returns: {
          audience_rating: number | null
          audience_rating_count: number
          average_rating: number
          awards: Json
          backdrop: string | null
          backdrop_url: string | null
          box_office_currency: string | null
          box_office_domestic: number | null
          box_office_opening_weekend: number | null
          box_office_source: string | null
          box_office_updated_at: string | null
          box_office_worldwide: number | null
          budget: number | null
          coming_soon: boolean | null
          comments_synced_at: string | null
          content_kind: string | null
          content_kind_checked_at: string | null
          content_kind_confidence: number | null
          content_type: string | null
          countries: string[] | null
          created_at: string
          distributor: string | null
          duration: number | null
          episode_count: number | null
          episode_number: number | null
          genres: string[] | null
          id: string
          imdb_id: string | null
          imdb_rating: number | null
          imdb_vote_count: number | null
          is_featured: boolean | null
          is_in_cinemas: boolean | null
          is_nollywood: boolean | null
          is_published: boolean
          is_top_10: boolean | null
          is_trending: boolean | null
          language: string | null
          languages: string[] | null
          liked_percent: number | null
          mubi_id: number | null
          mubi_slug: string | null
          needs_review: boolean | null
          nfvcb_rating: Database["public"]["Enums"]["nfvcb_rating"] | null
          nfvcb_rating_source: string | null
          nfvcb_rating_verified_at: string | null
          original_title: string | null
          poster_url: string | null
          release_date: string | null
          release_type: string | null
          runtime_minutes: number | null
          season_count: number | null
          season_number: number | null
          series_id: string | null
          slug: string | null
          source: string | null
          source_video_id: string | null
          status: Database["public"]["Enums"]["film_status"]
          streaming_links: Json | null
          synopsis: string | null
          tagline: string | null
          title: string
          tmdb_id: number | null
          tmdb_rating: number | null
          tmdb_vote_count: number | null
          trailer_external_url: string | null
          trailer_source: string
          trailer_youtube_id: string | null
          updated_at: string
          view_count: number
          year: number | null
          youtube_watch_url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "films"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_people_fuzzy: {
        Args: { lim?: number; q: string }
        Returns: {
          awards: Json
          bio: string | null
          birthplace: string | null
          claimed_by: string | null
          created_at: string
          date_of_birth: string | null
          facebook_url: string | null
          film_count: number | null
          gender: string | null
          id: string
          instagram_url: string | null
          is_spotlight: boolean | null
          is_verified: boolean
          known_for_department: string | null
          mubi_id: number | null
          mubi_slug: string | null
          name: string
          name_key: string | null
          nationality: string | null
          needs_review: boolean | null
          photo_cutout_attempted_at: string | null
          photo_cutout_error: string | null
          photo_cutout_source_url: string | null
          photo_cutout_status: string | null
          photo_cutout_url: string | null
          photo_url: string | null
          popularity_score: number
          profile_views: number | null
          slug: string | null
          source: string | null
          status: string | null
          tiktok_url: string | null
          tmdb_id: number | null
          twitter_url: string | null
          updated_at: string
          youtube_channel_id: string | null
          youtube_handle: string | null
          youtube_stats: Json | null
        }[]
        SetofOptions: {
          from: "*"
          to: "people"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_credit_harvest_paused: {
        Args: { p_paused: boolean }
        Returns: {
          id: number
          pause_requested_at: string | null
          paused: boolean
          resumed_at: string | null
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "credit_harvest_control"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      suggest_similar_people: {
        Args: { p_limit?: number; p_name: string }
        Returns: {
          film_count: number
          id: string
          name: string
          photo_url: string
          score: number
          slug: string
        }[]
      }
      tmdb_liked_pct: { Args: { avg: number; votes: number }; Returns: number }
      upsert_person_by_name: {
        Args: { p_extra?: Json; p_name: string }
        Returns: string
      }
    }
    Enums: {
      claim_status: "pending" | "approved" | "rejected"
      company_film_role: "production" | "distribution"
      credit_role:
        | "actor"
        | "director"
        | "writer"
        | "producer"
        | "cinematographer"
        | "editor"
        | "composer"
        | "costume_designer"
      editorial_calendar_status:
        | "planned"
        | "selecting"
        | "subject_selected"
        | "draft_ready"
        | "needs_review"
        | "approved"
        | "designed"
        | "published"
        | "skipped"
        | "cancelled"
      editorial_draft_status:
        | "generating"
        | "draft"
        | "needs_review"
        | "approved"
        | "designed"
        | "published"
        | "rejected"
      editorial_event_status:
        | "new"
        | "reviewed"
        | "converted_to_draft"
        | "ignored"
        | "expired"
      film_status:
        | "released"
        | "upcoming"
        | "in_production"
        | "post-production"
        | "announced"
        | "filming"
        | "completed"
        | "cancelled"
      nfvcb_rating: "G" | "PG" | "12" | "12A" | "PG-13" | "15" | "18" | "RE"
      social_asset_format:
        | "portrait_4_5"
        | "square_1_1"
        | "vertical_9_16"
        | "landscape_16_9"
        | "video_vertical_9_16"
      social_connection_status:
        | "pending"
        | "connected"
        | "expired"
        | "revoked"
        | "error"
      social_content_status:
        | "generating"
        | "draft"
        | "ready_for_review"
        | "approved"
        | "scheduled"
        | "publishing"
        | "partially_published"
        | "published"
        | "failed"
        | "rejected"
        | "archived"
      social_job_status:
        | "queued"
        | "processing"
        | "retrying"
        | "succeeded"
        | "failed"
        | "dead_letter"
        | "cancelled"
      social_platform: "instagram" | "facebook" | "threads" | "tiktok"
      social_variant_status:
        | "draft"
        | "approved"
        | "scheduled"
        | "publishing"
        | "published"
        | "uploaded_as_draft"
        | "failed"
        | "skipped"
      user_role: "fan" | "professional" | "admin" | "admin_limited"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      claim_status: ["pending", "approved", "rejected"],
      company_film_role: ["production", "distribution"],
      credit_role: [
        "actor",
        "director",
        "writer",
        "producer",
        "cinematographer",
        "editor",
        "composer",
        "costume_designer",
      ],
      editorial_calendar_status: [
        "planned",
        "selecting",
        "subject_selected",
        "draft_ready",
        "needs_review",
        "approved",
        "designed",
        "published",
        "skipped",
        "cancelled",
      ],
      editorial_draft_status: [
        "generating",
        "draft",
        "needs_review",
        "approved",
        "designed",
        "published",
        "rejected",
      ],
      editorial_event_status: [
        "new",
        "reviewed",
        "converted_to_draft",
        "ignored",
        "expired",
      ],
      film_status: [
        "released",
        "upcoming",
        "in_production",
        "post-production",
        "announced",
        "filming",
        "completed",
        "cancelled",
      ],
      nfvcb_rating: ["G", "PG", "12", "12A", "PG-13", "15", "18", "RE"],
      social_asset_format: [
        "portrait_4_5",
        "square_1_1",
        "vertical_9_16",
        "landscape_16_9",
        "video_vertical_9_16",
      ],
      social_connection_status: [
        "pending",
        "connected",
        "expired",
        "revoked",
        "error",
      ],
      social_content_status: [
        "generating",
        "draft",
        "ready_for_review",
        "approved",
        "scheduled",
        "publishing",
        "partially_published",
        "published",
        "failed",
        "rejected",
        "archived",
      ],
      social_job_status: [
        "queued",
        "processing",
        "retrying",
        "succeeded",
        "failed",
        "dead_letter",
        "cancelled",
      ],
      social_platform: ["instagram", "facebook", "threads", "tiktok"],
      social_variant_status: [
        "draft",
        "approved",
        "scheduled",
        "publishing",
        "published",
        "uploaded_as_draft",
        "failed",
        "skipped",
      ],
      user_role: ["fan", "professional", "admin", "admin_limited"],
    },
  },
} as const
