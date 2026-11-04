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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          business_id: string
          client_name: string
          client_phone: string | null
          consented_at: string | null
          created_at: string
          ends_at: string
          id: string
          service_id: string | null
          service_name: string
          source: string
          starts_at: string
          status: string
        }
        Insert: {
          business_id: string
          client_name: string
          client_phone?: string | null
          consented_at?: string | null
          created_at?: string
          ends_at: string
          id?: string
          service_id?: string | null
          service_name: string
          source?: string
          starts_at: string
          status?: string
        }
        Update: {
          business_id?: string
          client_name?: string
          client_phone?: string | null
          consented_at?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          service_id?: string | null
          service_name?: string
          source?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          role: string
          user_id: string
        }
        Insert: {
          business_id: string
          role?: string
          user_id: string
        }
        Update: {
          business_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_preferences: {
        Row: {
          business_id: string
          onboarding_completed: boolean
          reminder_hours: number
          reminders_reviewed: boolean
          whatsapp_waitlist: boolean
        }
        Insert: {
          business_id: string
          onboarding_completed?: boolean
          reminder_hours?: number
          reminders_reviewed?: boolean
          whatsapp_waitlist?: boolean
        }
        Update: {
          business_id?: string
          onboarding_completed?: boolean
          reminder_hours?: number
          reminders_reviewed?: boolean
          whatsapp_waitlist?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "business_preferences_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          whatsapp: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          whatsapp?: string
        }
        Relationships: []
      }
      reserved_slugs: {
        Row: {
          slug: string
        }
        Insert: {
          slug: string
        }
        Update: {
          slug?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          duration_minutes: number
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          duration_minutes: number
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      time_blocks: {
        Row: {
          business_id: string
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
        }
        Update: {
          business_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_blocks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      working_hours: {
        Row: {
          business_id: string
          day_of_week: number
          end_time: string
          id: string
          start_time: string
        }
        Insert: {
          business_id: string
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
        }
        Update: {
          business_id?: string
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_appointment: {
        Args: { p_appointment_id: string }
        Returns: undefined
      }
      create_booking: {
        Args: {
          p_client_name: string
          p_client_phone: string
          p_consent: boolean
          p_date: string
          p_service_id: string
          p_slug: string
          p_time: string
        }
        Returns: Json
      }
      create_business: {
        Args: { p_name: string; p_slug: string; p_whatsapp: string }
        Returns: {
          created_at: string
          id: string
          name: string
          slug: string
          whatsapp: string
        }
        SetofOptions: {
          from: "*"
          to: "businesses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_owner_booking: {
        Args: {
          p_business_id: string
          p_client_name: string
          p_client_phone?: string
          p_date: string
          p_reminders?: boolean
          p_service_id: string
          p_time: string
        }
        Returns: string
      }
      create_time_block: {
        Args: {
          p_business_id: string
          p_end_date: string
          p_end_time: string
          p_reason?: string
          p_start_date: string
          p_start_time: string
        }
        Returns: string
      }
      delete_time_block: { Args: { p_block_id: string }; Returns: undefined }
      get_available_slots: {
        Args: { p_date: string; p_service_id: string; p_slug: string }
        Returns: string[]
      }
      get_public_booking_info: { Args: { p_slug: string }; Returns: Json }
      is_business_member: { Args: { p_business_id: string }; Returns: boolean }
      replace_working_hours: {
        Args: { p_business_id: string; p_ranges: Json }
        Returns: undefined
      }
      slots_for: {
        Args: { p_business_id: string; p_date: string; p_service_id: string }
        Returns: {
          slot_time: string
        }[]
      }
      time_span_multirange: { Args: never; Returns: unknown }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
