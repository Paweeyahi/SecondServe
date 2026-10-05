export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: 'consumer' | 'store' | 'rider' | 'admin';
          full_name: string;
          phone: string;
          suspended: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          role: 'consumer' | 'store' | 'rider' | 'admin';
          full_name: string;
          phone: string;
          suspended?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: 'consumer' | 'store' | 'rider' | 'admin';
          full_name?: string;
          phone?: string;
          suspended?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      stores: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          address: string;
          latitude: number;
          longitude: number;
          phone: string;
          delivery_fee: number;
          verified: boolean;
          logo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          address: string;
          latitude: number;
          longitude: number;
          phone: string;
          delivery_fee?: number;
          verified?: boolean;
          logo_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          address?: string;
          latitude?: number;
          longitude?: number;
          phone?: string;
          delivery_fee?: number;
          verified?: boolean;
          logo_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      riders: {
        Row: {
          id: string;
          vehicle_type: 'motorcycle' | 'bicycle' | 'car';
          license_plate: string;
          status: 'available' | 'busy' | 'offline';
          verified: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          vehicle_type: 'motorcycle' | 'bicycle' | 'car';
          license_plate: string;
          status?: 'available' | 'busy' | 'offline';
          verified?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_type?: 'motorcycle' | 'bicycle' | 'car';
          license_plate?: string;
          status?: 'available' | 'busy' | 'offline';
          verified?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          category: 'fresh' | 'bakery' | 'beverage' | 'dry' | 'ready_meal' | 'produce' | 'meat_seafood' | 'dairy' | 'frozen' | 'snacks';
          original_price: number;
          discount_price: number;
          quantity: number;
          expiry_date: string;
          image_url: string;
          status: 'active' | 'sold_out' | 'expired' | 'shared';
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          category: 'fresh' | 'bakery' | 'beverage' | 'dry' | 'ready_meal' | 'produce' | 'meat_seafood' | 'dairy' | 'frozen' | 'snacks';
          original_price: number;
          discount_price: number;
          quantity?: number;
          expiry_date: string;
          image_url: string;
          status?: 'active' | 'sold_out' | 'expired' | 'shared';
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          category?: 'fresh' | 'bakery' | 'beverage' | 'dry' | 'ready_meal' | 'produce' | 'meat_seafood' | 'dairy' | 'frozen' | 'snacks';
          original_price?: number;
          discount_price?: number;
          quantity?: number;
          expiry_date?: string;
          image_url?: string;
          status?: 'active' | 'sold_out' | 'expired' | 'shared';
          created_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          consumer_id: string;
          store_id: string;
          rider_id: string | null;
          delivery_type: 'pickup' | 'delivery';
          delivery_address: string | null;
          delivery_fee: number;
          total_amount: number;
          status: 'pending' | 'confirmed' | 'ready' | 'rider_assigned' | 'picked_up' | 'delivering' | 'completed' | 'cancelled';
          created_at: string;
          /** Platform rate snapshotted at checkout (0.10 = 10%). */
          commission_rate: number;
          /** Generated: (total_amount - delivery_fee) * commission_rate. */
          commission_amount: number;
        };
        Insert: {
          id?: string;
          consumer_id: string;
          store_id: string;
          rider_id?: string | null;
          delivery_type: 'pickup' | 'delivery';
          delivery_address?: string | null;
          delivery_fee?: number;
          total_amount: number;
          status?: 'pending' | 'confirmed' | 'ready' | 'rider_assigned' | 'picked_up' | 'delivering' | 'completed' | 'cancelled';
          created_at?: string;
          commission_rate?: number;
        };
        Update: {
          id?: string;
          consumer_id?: string;
          store_id?: string;
          rider_id?: string | null;
          delivery_type?: 'pickup' | 'delivery';
          delivery_address?: string | null;
          delivery_fee?: number;
          total_amount?: number;
          status?: 'pending' | 'confirmed' | 'ready' | 'rider_assigned' | 'picked_up' | 'delivering' | 'completed' | 'cancelled';
          created_at?: string;
        };
        Relationships: [];
      };
      platform_settings: {
        Row: {
          id: boolean;
          commission_rate: number;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          commission_rate?: number;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          commission_rate?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
        };
        Relationships: [];
      };
      shares: {
        Row: {
          id: string;
          store_id: string;
          product_id: string;
          quantity: number;
          remaining: number;
          pickup_note: string | null;
          foundation_id: string | null;
          delivered_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          product_id: string;
          quantity: number;
          remaining: number;
          pickup_note?: string | null;
          foundation_id?: string | null;
          delivered_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          product_id?: string;
          quantity?: number;
          remaining?: number;
          pickup_note?: string | null;
          foundation_id?: string | null;
          delivered_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      foundations: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          address: string | null;
          phone: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          address?: string | null;
          phone?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          address?: string | null;
          phone?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      share_claims: {
        Row: {
          id: string;
          share_id: string;
          claimer_id: string;
          quantity: number;
          status: 'reserved' | 'collected' | 'cancelled';
          created_at: string;
          resolved_at: string | null;
          cancel_reason: 'timeout' | null;
        };
        Insert: {
          id?: string;
          share_id: string;
          claimer_id: string;
          quantity: number;
          status?: 'reserved' | 'collected' | 'cancelled';
          created_at?: string;
          resolved_at?: string | null;
          cancel_reason?: 'timeout' | null;
        };
        Update: {
          id?: string;
          share_id?: string;
          claimer_id?: string;
          quantity?: number;
          status?: 'reserved' | 'collected' | 'cancelled';
          created_at?: string;
          resolved_at?: string | null;
          cancel_reason?: 'timeout' | null;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          order_id: string;
          consumer_id: string;
          store_id: string | null;
          rider_id: string | null;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          consumer_id: string;
          store_id?: string | null;
          rider_id?: string | null;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          consumer_id?: string;
          store_id?: string | null;
          rider_id?: string | null;
          rating?: number;
          comment?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      place_order: {
        Args: {
          p_store_id: string;
          p_delivery_type: string;
          p_delivery_address: string | null;
          p_items: Json;
        };
        Returns: string;
      };
      update_product: {
        Args: {
          p_product_id: string;
          p_name: string;
          p_category: string;
          p_original_price: number;
          p_discount_price: number;
          p_quantity: number;
          p_expiry_date: string;
          p_image_url: string;
          p_expected_quantity: number;
        };
        Returns: undefined;
      };
      confirm_order: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      mark_order_ready: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      complete_pickup_order: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      cancel_order: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      set_rider_shift: {
        Args: { p_status: string };
        Returns: undefined;
      };
      claim_delivery_job: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      mark_picked_up: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      mark_delivering: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      mark_delivered: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      share_product: {
        Args: {
          p_product_id: string;
          p_pickup_note?: string | null;
          p_foundation_id?: string | null;
        };
        Returns: undefined;
      };
      reviewer_names: {
        Args: { p_ids: string[] };
        Returns: { id: string; display_name: string }[];
      };
      mark_foundation_delivered: {
        Args: { p_share_id: string };
        Returns: undefined;
      };
      admin_save_foundation: {
        Args: {
          p_id: string | null;
          p_name: string;
          p_description: string | null;
          p_address: string | null;
          p_phone: string | null;
          p_active: boolean;
        };
        Returns: string;
      };
      claim_share: {
        Args: { p_share_id: string; p_quantity: number };
        Returns: string;
      };
      cancel_share_claim: {
        Args: { p_claim_id: string };
        Returns: undefined;
      };
      mark_share_collected: {
        Args: { p_claim_id: string };
        Returns: undefined;
      };
      community_share_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_set_store_verified: {
        Args: { p_store_id: string; p_verified: boolean };
        Returns: undefined;
      };
      admin_set_rider_verified: {
        Args: { p_rider_id: string; p_verified: boolean };
        Returns: undefined;
      };
      admin_set_user_suspended: {
        Args: { p_user_id: string; p_suspended: boolean };
        Returns: undefined;
      };
      admin_platform_metrics: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_set_commission_rate: {
        Args: { p_rate: number };
        Returns: undefined;
      };
      admin_commission_summary: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_get_user: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      admin_store_commission: {
        Args: { p_store_id: string };
        Returns: Json;
      };
      admin_store_sales_report: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_list_users: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          role: 'consumer' | 'store' | 'rider' | 'admin';
          full_name: string;
          phone: string;
          email: string | null;
          suspended: boolean;
          created_at: string;
        }[];
      };
      submit_review: {
        Args: {
          p_order_id: string;
          p_target: string;
          p_rating: number;
          p_comment: string | null;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
