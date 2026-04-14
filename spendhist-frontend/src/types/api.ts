/* ─── User ─────────────────────────────────────────────────────────── */

export interface UserCreate {
  email: string;
  password: string;
  phone_number?: string;
  full_name?: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface UserResponse {
  user_id: number;
  email: string;
  phone_number: string | null;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: number;
}

/* ─── Receipt ──────────────────────────────────────────────────────── */

export interface ReceiptSummary {
  receipt_id: number;
  user_id: number;
  merchant_name: string;
  receipt_date: string;
  total_amount: number | string;
  total_taxes: number | string;
  other: number | string;
  currency: string;
  created_at: string;
}

export interface ReceiptItemResponse {
  item_id: number;
  receipt_id: number;
  item_name: string;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
  taxes: number | string;
}

export interface ReceiptResponse extends ReceiptSummary {
  raw_text: string | null;
  items: ReceiptItemResponse[];
}

export interface PaginatedReceiptsResponse {
  items: ReceiptSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReceiptSearchResponse extends PaginatedReceiptsResponse {
  include_raw_text_in_search: boolean;
}

export interface UploadResponse {
  message: string;
  files: string[];
}

export interface DeleteReceiptResponse {
  message: string;
  receipt_id: number;
}

/* ─── Chat ─────────────────────────────────────────────────────────── */

export interface ChatRequest {
  message: string;
  thread_id?: string;
}

export interface ChatResponse {
  reply: string;
  thread_id: string;
}

/* ─── Client-side models ───────────────────────────────────────────── */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  thread_id?: string;
}

export interface UserPrefs {
  defaultCurrency: "EGP" | "USD" | "SAR";
  theme: "light" | "dark" | "system";
}
