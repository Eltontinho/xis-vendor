export type MessageRole = "axis" | "user";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
}

export type ConversationState =
  | "greeting"
  | "collecting_info"
  | "presenting_offer"
  | "reserving"
  | "payment_pending"
  | "completed";

export type LotName = "lote1" | "lote2" | "lote3";

export type PaymentStatus = "none" | "pending" | "approved" | "rejected";

export interface VendorConversation {
  id: string;
  driver_phone: string | null;
  driver_name: string | null;
  driver_city: string | null;
  messages: ChatMessage[];
  current_state: ConversationState;
  lot_offered: LotName | null;
  payment_status: PaymentStatus;
  created_at: string;
}

export interface LotInventory {
  city: string;
  lot: LotName;
  total: number;
  reserved: number;
  sold: number;
}

export type LockStatus = "active" | "expired" | "converted";

export interface LotLock {
  id: string;
  driver_phone: string;
  city: string;
  lot: LotName;
  status: LockStatus;
  expires_at: string;
  created_at: string;
}

export interface ReserveRequest {
  driver_phone: string;
  driver_name: string;
  driver_city: string;
  lot: LotName;
  conversation_id: string;
}

export interface ReserveResponse {
  success: boolean;
  available?: boolean;
  checkout_url?: string;
  lock_id?: string;
  expires_at?: string;
  error?: string;
}
