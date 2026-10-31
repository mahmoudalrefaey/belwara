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
  plan: string;
  created_at: string;
}

export interface UsageResponse {
  plan: string;
  receipts: { used: number; limit: number };
  chat: { used: number; limit: number };
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: number;
}

/* ─── Receipt ──────────────────────────────────────────────────────── */

export type ReceiptStatus = "processing" | "ready" | "needs_review" | "failed";

export interface ReceiptSummary {
  receipt_id: number;
  user_id: number;
  status: ReceiptStatus;
  review_reasons: string[] | null;
  merchant_name: string | null;
  receipt_date: string | null;
  total_amount: number | string | null;
  total_taxes: number | string;
  other: number | string;
  currency: string | null;
  category: string | null;
  source_filename: string | null;
  has_image: boolean;
  created_at: string;
}

export interface ReceiptItemResponse {
  item_id: number;
  receipt_id: number;
  item_name: string;
  quantity: number | string; // a count or a weight; decimals come as strings
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

export interface ReceiptItemInput {
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  taxes: number;
}

export interface ReceiptUpdate {
  merchant_name?: string;
  receipt_date?: string;
  total_amount?: number;
  total_taxes?: number;
  other?: number;
  currency?: string;
  category?: string | null;
  items?: ReceiptItemInput[];
}

export interface UploadResponse {
  message: string;
  receipts: ReceiptSummary[];
}

export interface LabeledTotal {
  label: string;
  total: number;
}

export interface DashboardResponse {
  currencies: { currency: string; total: number; receipts: number }[];
  currency: string | null;
  total: number;
  receipts: number;
  average: number;
  this_month: number;
  by_month: LabeledTotal[];
  by_merchant: LabeledTotal[];
  by_category: LabeledTotal[];
  needs_review: number;
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

export interface ChatThreadSummary {
  thread_id: string;
  title: string;
  last_message_at: string;
}

export interface ChatMessageOut {
  role: "user" | "assistant";
  content: string;
  created_at: string;
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
