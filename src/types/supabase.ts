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
          name: string
          owner_company_id: string | null
          owner_name: string | null
          owner_person_id: string | null
          subscriber_count: number | null
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
          name: string
          owner_company_id?: string | null
          owner_name?: string | null
          owner_person_id?: string | null
          subscriber_count?: number | null
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
          name?: string
          owner_company_id?: string | null
          owner_name?: string | null
          owner_person_id?: string | null
          subscriber_count?: number | null
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
      companies: {
        Row: {
          created_at: string
          description: string | null
          founded_year: number | null
          id: string
          logo_url: string | null
          name: string
          tmdb_id: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          founded_year?: number | null
          id?: string
          logo_url?: string | null
          name: string
          tmdb_id?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          founded_year?: number | null
          id?: string
          logo_url?: string | null
          name?: string
          tmdb_id?: number | null
          updated_at?: string
          website?: string | null
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
          average_rating: number
          backdrop: string | null
          backdrop_url: string | null
          created_at: string
          id: string
          is_featured: boolean | null
          is_nollywood: boolean | null
          is_trending: boolean | null
          language: string | null
          needs_review: boolean | null
          nfvcb_rating: Database["public"]["Enums"]["nfvcb_rating"] | null
          poster_url: string | null
          release_type: string | null
          runtime_minutes: number | null
          source: string | null
          source_video_id: string | null
          status: Database["public"]["Enums"]["film_status"]
          streaming_links: Json | null
          synopsis: string | null
          tagline: string | null
          title: string
          tmdb_id: number | null
          tmdb_rating: number | null
          trailer_external_url: string | null
          trailer_source: string
          trailer_youtube_id: string | null
          updated_at: string
          view_count: number
          year: number | null
          youtube_watch_url: string | null
        }
        Insert: {
          average_rating?: number
          backdrop?: string | null
          backdrop_url?: string | null
          created_at?: string
          id?: string
          is_featured?: boolean | null
          is_nollywood?: boolean | null
          is_trending?: boolean | null
          language?: string | null
          needs_review?: boolean | null
          nfvcb_rating?: Database["public"]["Enums"]["nfvcb_rating"] | null
          poster_url?: string | null
          release_type?: string | null
          runtime_minutes?: number | null
          source?: string | null
          source_video_id?: string | null
          status?: Database["public"]["Enums"]["film_status"]
          streaming_links?: Json | null
          synopsis?: string | null
          tagline?: string | null
          title: string
          tmdb_id?: number | null
          tmdb_rating?: number | null
          trailer_external_url?: string | null
          trailer_source?: string
          trailer_youtube_id?: string | null
          updated_at?: string
          view_count?: number
          year?: number | null
          youtube_watch_url?: string | null
        }
        Update: {
          average_rating?: number
          backdrop?: string | null
          backdrop_url?: string | null
          created_at?: string
          id?: string
          is_featured?: boolean | null
          is_nollywood?: boolean | null
          is_trending?: boolean | null
          language?: string | null
          needs_review?: boolean | null
          nfvcb_rating?: Database["public"]["Enums"]["nfvcb_rating"] | null
          poster_url?: string | null
          release_type?: string | null
          runtime_minutes?: number | null
          source?: string | null
          source_video_id?: string | null
          status?: Database["public"]["Enums"]["film_status"]
          streaming_links?: Json | null
          synopsis?: string | null
          tagline?: string | null
          title?: string
          tmdb_id?: number | null
          tmdb_rating?: number | null
          trailer_external_url?: string | null
          trailer_source?: string
          trailer_youtube_id?: string | null
          updated_at?: string
          view_count?: number
          year?: number | null
          youtube_watch_url?: string | null
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
      people: {
        Row: {
          bio: string | null
          biography: string | null
          birthplace: string | null
          claimed_by: string | null
          created_at: string
          date_of_birth: string | null
          gender: string | null
          id: string
          is_spotlight: boolean | null
          is_verified: boolean
          known_for_department: string | null
          name: string
          nationality: string | null
          needs_review: boolean | null
          photo_url: string | null
          popularity_score: number
          source: string | null
          status: string | null
          tmdb_id: number | null
          updated_at: string
          youtube_channel_id: string | null
          youtube_handle: string | null
          youtube_stats: Json | null
        }
        Insert: {
          bio?: string | null
          biography?: string | null
          birthplace?: string | null
          claimed_by?: string | null
          created_at?: string
          date_of_birth?: string | null
          gender?: string | null
          id?: string
          is_spotlight?: boolean | null
          is_verified?: boolean
          known_for_department?: string | null
          name: string
          nationality?: string | null
          needs_review?: boolean | null
          photo_url?: string | null
          popularity_score?: number
          source?: string | null
          status?: string | null
          tmdb_id?: number | null
          updated_at?: string
          youtube_channel_id?: string | null
          youtube_handle?: string | null
          youtube_stats?: Json | null
        }
        Update: {
          bio?: string | null
          biography?: string | null
          birthplace?: string | null
          claimed_by?: string | null
          created_at?: string
          date_of_birth?: string | null
          gender?: string | null
          id?: string
          is_spotlight?: boolean | null
          is_verified?: boolean
          known_for_department?: string | null
          name?: string
          nationality?: string | null
          needs_review?: boolean | null
          photo_url?: string | null
          popularity_score?: number
          source?: string | null
          status?: string | null
          tmdb_id?: number | null
          updated_at?: string
          youtube_channel_id?: string | null
          youtube_handle?: string | null
          youtube_stats?: Json | null
        }
        Relationships: []
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
          body: string | null
          created_at: string
          film_id: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          film_id: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          film_id?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
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
      merge_films: {
        Args: { primary_id: string; secondary_id: string }
        Returns: undefined
      }
      merge_people: {
        Args: { primary_id: string; secondary_id: string }
        Returns: undefined
      }
      refresh_all_popularity_scores: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
      film_status: "released" | "upcoming" | "in_production" | "post-production"
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
      film_status: ["released", "upcoming", "in_production", "post-production"],
      nfvcb_rating: ["G", "PG", "PG-13", "15", "18"],
      user_role: ["fan", "professional", "admin", "admin_limited"],
    },
  },
} as const
