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
      credits: {
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
          coming_soon: boolean | null
          comments_synced_at: string | null
          content_type: string | null
          countries: string[] | null
          created_at: string
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
          coming_soon?: boolean | null
          comments_synced_at?: string | null
          content_type?: string | null
          countries?: string[] | null
          created_at?: string
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
          coming_soon?: boolean | null
          comments_synced_at?: string | null
          content_type?: string | null
          countries?: string[] | null
          created_at?: string
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
      profile_claims: {
        Row: {
          created_at: string
          id: string
          note: string | null
          person_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["claim_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          person_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          person_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          user_id?: string
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
        }
        Insert: {
          added_at?: string
          film_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          film_id?: string
          user_id?: string
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
      find_person_by_name: { Args: { p_name: string }; Returns: string }
      force_promote_to_admin: {
        Args: { user_email: string }
        Returns: undefined
      }
      generate_slug: { Args: { input: string }; Returns: string }
      get_coming_soon_films: { Args: { p_limit?: number }; Returns: Json[] }
      get_duplicate_films: {
        Args: never
        Returns: {
          audience_rating: number | null
          audience_rating_count: number
          average_rating: number
          awards: Json
          backdrop: string | null
          backdrop_url: string | null
          coming_soon: boolean | null
          comments_synced_at: string | null
          content_type: string | null
          countries: string[] | null
          created_at: string
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
      match_film_fuzzy: {
        Args: { query_title: string; threshold?: number }
        Returns: {
          id: string
          sim: number
          title: string
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
      refresh_all_popularity_scores: { Args: never; Returns: undefined }
      refresh_people_enrichment_queue: { Args: never; Returns: number }
      refresh_platform_new_releases: {
        Args: { p_platform: string }
        Returns: undefined
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
      search_films_fuzzy: {
        Args: { lim?: number; q: string }
        Returns: {
          audience_rating: number | null
          audience_rating_count: number
          average_rating: number
          awards: Json
          backdrop: string | null
          backdrop_url: string | null
          coming_soon: boolean | null
          comments_synced_at: string | null
          content_type: string | null
          countries: string[] | null
          created_at: string
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
      film_status:
        | "released"
        | "upcoming"
        | "in_production"
        | "post-production"
        | "announced"
        | "filming"
        | "completed"
        | "cancelled"
      nfvcb_rating: "G" | "PG" | "PG-13" | "15" | "18"
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
      nfvcb_rating: ["G", "PG", "PG-13", "15", "18"],
      user_role: ["fan", "professional", "admin", "admin_limited"],
    },
  },
} as const
