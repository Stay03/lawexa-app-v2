// Message pack statuses
export type TMessagePackStatus = 'pending' | 'completed' | 'failed' | 'refunded';

// Message pack resource
export interface IMessagePack {
  id: number;
  quantity: number;
  messages_total: number;
  messages_remaining: number;
  amount: number;
  formatted_amount: string;
  currency: string;
  status: TMessagePackStatus;
  status_label: string;
  paid_at: string | null;
  created_at: string;
}

// POST /message-packs/purchase response data
export interface IMessagePackPurchaseData {
  authorization_url: string;
  access_code: string;
  reference: string;
  quantity: number;
  messages: number;
  amount: number;
  currency: string;
}

// GET /message-packs/balance response data
export interface IPaygBalance {
  payg_remaining: number;
}

// GET /message-packs response
export interface IMessagePacksResponse {
  success: boolean;
  message: string;
  data: IMessagePack[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number | null;
    to: number | null;
  };
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
}

// Message pack list query params
export interface IMessagePackListParams {
  status?: TMessagePackStatus;
  page?: number;
  per_page?: number;
}

// AI messages limit from GET /users/limits
export interface IAiMessagesLimit {
  limit_type: 'ai_messages';
  plan_limit: number | null;
  hard_limit: number | null;
  used: number;
  remaining: number | null;
  resets_at: string;
  payg_remaining: number;
  total_remaining: number | null;
}

// Generic limit shape for other limit types
export interface IGenericLimit {
  limit_type: string;
  plan_limit: number | null;
  hard_limit: number | null;
  used: number;
  remaining: number | null;
  resets_at: string;
}

// GET /users/limits response data
export interface IUserLimits {
  note_creations: IGenericLimit;
  bookmarks: IGenericLimit;
  ai_messages: IAiMessagesLimit;
}
