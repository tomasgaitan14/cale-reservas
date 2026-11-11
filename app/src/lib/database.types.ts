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
      appointments: {
        Row: {
          business_id: string
          client_name: string
          client_phone: string | null
          consented_at: string | null
          created_at: string
          ends_at: string
          id: string
          professional_id: string | null
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
          professional_id?: string | null
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
          professional_id?: string | null
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
      business_billing: {
        Row: {
          billing_day: number
          billing_day_configured_at: string | null
          billing_exempt: boolean
          billing_status: string
          business_id: string
          current_period_end: string | null
          initial_charge_amount: number | null
          last_payment_status: string | null
          mercadopago_plan_id: string | null
          mercadopago_subscription_id: string | null
          promotion_applied_at: string | null
          promotion_code: string | null
          promotion_price: number | null
          updated_at: string
        }
        Insert: {
          billing_day?: number
          billing_day_configured_at?: string | null
          billing_exempt?: boolean
          billing_status?: string
          business_id: string
          current_period_end?: string | null
          initial_charge_amount?: number | null
          last_payment_status?: string | null
          mercadopago_plan_id?: string | null
          mercadopago_subscription_id?: string | null
          promotion_applied_at?: string | null
          promotion_code?: string | null
          promotion_price?: number | null
          updated_at?: string
        }
        Update: {
          billing_day?: number
          billing_day_configured_at?: string | null
          billing_exempt?: boolean
          billing_status?: string
          business_id?: string
          current_period_end?: string | null
          initial_charge_amount?: number | null
          last_payment_status?: string | null
          mercadopago_plan_id?: string | null
          mercadopago_subscription_id?: string | null
          promotion_applied_at?: string | null
          promotion_code?: string | null
          promotion_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_billing_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_branding: {
        Row: {
          accent_color: string
          business_id: string
          logo_path: string | null
          primary_color: string
          secondary_color: string
        }
        Insert: {
          accent_color?: string
          business_id: string
          logo_path?: string | null
          primary_color?: string
          secondary_color?: string
        }
        Update: {
          accent_color?: string
          business_id?: string
          logo_path?: string | null
          primary_color?: string
          secondary_color?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_branding_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_invitations: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string
          display_name: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string
          display_name: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string
          display_name?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_invitations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          display_name: string | null
          email: string | null
          role: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          display_name?: string | null
          email?: string | null
          role?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          display_name?: string | null
          email?: string | null
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
          allow_cross_professional_overlap: boolean
          reminder_hours: number
          reminders_reviewed: boolean
          whatsapp_waitlist: boolean
        }
        Insert: {
          business_id: string
          onboarding_completed?: boolean
          allow_cross_professional_overlap?: boolean
          reminder_hours?: number
          reminders_reviewed?: boolean
          whatsapp_waitlist?: boolean
        }
        Update: {
          business_id?: string
          onboarding_completed?: boolean
          allow_cross_professional_overlap?: boolean
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
          plan: string
          slug: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          slug: string
          whatsapp: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          slug?: string
          whatsapp?: string
        }
        Relationships: []
      }
      push_jobs: {
        Row: {
          appointment_id: string | null
          attempts: number
          available_at: string
          created_at: string
          id: string
          kind: string
          lease_id: string | null
          subscription_id: string
        }
        Insert: {
          appointment_id?: string | null
          attempts?: number
          available_at?: string
          created_at?: string
          id?: string
          kind: string
          lease_id?: string | null
          subscription_id: string
        }
        Update: {
          appointment_id?: string | null
          attempts?: number
          available_at?: string
          created_at?: string
          id?: string
          kind?: string
          lease_id?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_jobs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_jobs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          business_id: string
          created_at: string
          endpoint: string
          id: string
          last_test_at: string | null
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          business_id: string
          created_at?: string
          endpoint: string
          id?: string
          last_test_at?: string | null
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          business_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_test_at?: string | null
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_deliveries: {
        Row: {
          appointment_id: string
          attempts: number
          business_id: string
          connection_id: string | null
          created_at: string
          delivered_at: string | null
          id: string
          last_error_at: string | null
          last_error_code: string | null
          meta_message_id: string | null
          read_at: string | null
          reminder_hours: number
          scheduled_for: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          attempts?: number
          business_id: string
          connection_id?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          meta_message_id?: string | null
          read_at?: string | null
          reminder_hours: number
          scheduled_for: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          attempts?: number
          business_id?: string
          connection_id?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          meta_message_id?: string | null
          read_at?: string | null
          reminder_hours?: number
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_deliveries_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_deliveries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_deliveries_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
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
          professional_id: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          duration_minutes: number
          id?: string
          name: string
          professional_id: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          name?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_professional_member_fk"
            columns: ["business_id", "professional_id"]
            isOneToOne: false
            referencedRelation: "business_members"
            referencedColumns: ["business_id", "user_id"]
          },
        ]
      }
      time_blocks: {
        Row: {
          business_id: string
          created_at: string
          ends_at: string
          id: string
          professional_id: string | null
          reason: string | null
          starts_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          ends_at: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          starts_at: string
        }
        Update: {
          business_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          professional_id?: string | null
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
      whatsapp_connections: {
        Row: {
          business_id: string
          connected_at: string | null
          connection_status: string
          created_at: string
          credential_reference: string | null
          display_phone_number: string | null
          id: string
          phone_number_id: string | null
          updated_at: string
          waba_id: string | null
        }
        Insert: {
          business_id: string
          connected_at?: string | null
          connection_status?: string
          created_at?: string
          credential_reference?: string | null
          display_phone_number?: string | null
          id?: string
          phone_number_id?: string | null
          updated_at?: string
          waba_id?: string | null
        }
        Update: {
          business_id?: string
          connected_at?: string | null
          connection_status?: string
          created_at?: string
          credential_reference?: string | null
          display_phone_number?: string | null
          id?: string
          phone_number_id?: string | null
          updated_at?: string
          waba_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_events_retention: {
        Row: {
          failed_days: number
          processed_days: number
          singleton: boolean
          stored_days: number
          updated_at: string
        }
        Insert: {
          failed_days?: number
          processed_days?: number
          singleton?: boolean
          stored_days?: number
          updated_at?: string
        }
        Update: {
          failed_days?: number
          processed_days?: number
          singleton?: boolean
          stored_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_webhook_events: {
        Row: {
          attempts: number
          error_code: string | null
          event_at: string | null
          event_key: string
          id: string
          kind: string
          last_error_at: string | null
          last_error_code: string | null
          lease_expires_at: string | null
          lease_id: string | null
          meta_message_id: string | null
          next_attempt_at: string
          payload: Json
          phone_number_id: string | null
          process_status: string
          processed_at: string | null
          received_at: string
          result_code: string | null
          status_value: string | null
          waba_id: string | null
        }
        Insert: {
          attempts?: number
          error_code?: string | null
          event_at?: string | null
          event_key: string
          id?: string
          kind: string
          last_error_at?: string | null
          last_error_code?: string | null
          lease_expires_at?: string | null
          lease_id?: string | null
          meta_message_id?: string | null
          next_attempt_at?: string
          payload: Json
          phone_number_id?: string | null
          process_status?: string
          processed_at?: string | null
          received_at?: string
          result_code?: string | null
          status_value?: string | null
          waba_id?: string | null
        }
        Update: {
          attempts?: number
          error_code?: string | null
          event_at?: string | null
          event_key?: string
          id?: string
          kind?: string
          last_error_at?: string | null
          last_error_code?: string | null
          lease_expires_at?: string | null
          lease_id?: string | null
          meta_message_id?: string | null
          next_attempt_at?: string
          payload?: Json
          phone_number_id?: string | null
          process_status?: string
          processed_at?: string | null
          received_at?: string
          result_code?: string | null
          status_value?: string | null
          waba_id?: string | null
        }
        Relationships: []
      }
      working_hours: {
        Row: {
          business_id: string
          day_of_week: number
          end_time: string
          id: string
          professional_id: string
          start_time: string
        }
        Insert: {
          business_id: string
          day_of_week: number
          end_time: string
          id?: string
          professional_id: string
          start_time: string
        }
        Update: {
          business_id?: string
          day_of_week?: number
          end_time?: string
          id?: string
          professional_id?: string
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
          {
            foreignKeyName: "working_hours_business_professional_fk"
            columns: ["business_id", "professional_id"]
            isOneToOne: false
            referencedRelation: "business_members"
            referencedColumns: ["business_id", "user_id"]
          },
        ]
      }
    }
    Views: {
      whatsapp_webhook_events_health: {
        Row: {
          events: number | null
          kind: string | null
          oldest_received_at: string | null
          process_status: string | null
          result_code: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_whatsapp_status_event: {
        Args: { p_event_id: string; p_lease_id: string }
        Returns: string
      }
      cancel_appointment: {
        Args: { p_appointment_id: string }
        Returns: undefined
      }
      change_business_member_role: {
        Args: { p_business_id: string; p_role: string; p_user_id: string }
        Returns: undefined
      }
      claim_pending_invitations: { Args: never; Returns: number }
      claim_push_jobs: {
        Args: never
        Returns: {
          auth: string
          endpoint: string
          id: string
          kind: string
          lease_id: string
          p256dh: string
          subscription_id: string
        }[]
      }
      claim_whatsapp_events: {
        Args: { p_lease_seconds?: number; p_limit?: number }
        Returns: {
          id: string
          lease_id: string
        }[]
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
          plan: string
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
          p_professional_id?: string
          p_reason?: string
          p_start_date: string
          p_start_time: string
        }
        Returns: string
      }
      defer_whatsapp_event: {
        Args: {
          p_backoff_base: string
          p_backoff_max: string
          p_event_id: string
          p_final_code: string
          p_final_status: string
          p_wait: string
          p_waiting_code: string
        }
        Returns: string
      }
      delete_time_block: { Args: { p_block_id: string }; Returns: undefined }
      finish_push_job: {
        Args: { p_id: string; p_lease_id: string; p_status: string }
        Returns: undefined
      }
      finish_whatsapp_event: {
        Args: { p_event_id: string; p_result_code: string; p_status: string }
        Returns: string
      }
      get_available_slots: {
        Args: { p_date: string; p_service_id: string; p_slug: string }
        Returns: string[]
      }
      get_business_branding: { Args: { p_business_id: string }; Returns: Json }
      get_public_businesses: { Args: never; Returns: Json }
      get_public_booking_info: { Args: { p_slug: string }; Returns: Json }
      has_push_subscription: {
        Args: { p_business_id: string; p_endpoint: string }
        Returns: boolean
      }
      ingest_whatsapp_events: { Args: { p_items: Json }; Returns: Json }
      is_business_admin: { Args: { p_business_id: string }; Returns: boolean }
      is_business_member: { Args: { p_business_id: string }; Returns: boolean }
      purge_whatsapp_webhook_events: { Args: never; Returns: Json }
      record_whatsapp_event_error: {
        Args: { p_error_code: string; p_event_id: string; p_lease_id: string }
        Returns: string
      }
      register_push_subscription: {
        Args: {
          p_auth: string
          p_business_id: string
          p_endpoint: string
          p_p256dh: string
        }
        Returns: undefined
      }
      remove_business_member: {
        Args: { p_business_id: string; p_user_id: string }
        Returns: undefined
      }
      remove_push_subscription: {
        Args: { p_endpoint: string }
        Returns: undefined
      }
      replace_working_hours: {
        Args: { p_business_id: string; p_professional_id?: string; p_ranges: Json }
        Returns: undefined
      }
      request_push_test: { Args: { p_endpoint: string }; Returns: undefined }
      requeue_whatsapp_events: {
        Args: { p_phone_number_id: string }
        Returns: number
      }
      revoke_business_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      save_business_branding: {
        Args: {
          p_accent: string
          p_business_id: string
          p_logo_path: string
          p_primary: string
          p_secondary: string
        }
        Returns: undefined
      }
      slots_for: {
        Args: { p_business_id: string; p_date: string; p_service_id: string }
        Returns: {
          slot_time: string
        }[]
      }
      time_span_multirange: { Args: never; Returns: unknown }
      whatsapp_delivery_rank: { Args: { p_status: string }; Returns: number }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
