import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type {
  AmbassadorApplication,
  AmbassadorCodeState,
  AmbassadorListParams,
  AmbassadorPerformance,
  AmbassadorListResponse,
  ApproveAmbassadorData,
  RejectAmbassadorData,
} from '@/types/ambassador';

/**
 * Admin Ambassador Applications API. All endpoints require role:admin.
 */
export const adminAmbassadorsApi = {
  getAdminList: async (params: AmbassadorListParams = {}): Promise<AmbassadorListResponse> => {
    const response = await apiClient.get<AmbassadorListResponse>('/admin/ambassador-applications', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        status: params.status || undefined,
        sort: params.sort || undefined,
        direction: params.direction || undefined,
      },
    });
    return response.data;
  },

  // Optional review_notes. Returns 409 if already approved/rejected.
  approve: async (uuid: string, data: ApproveAmbassadorData): Promise<ApiResponse<AmbassadorApplication>> => {
    const response = await apiClient.patch<ApiResponse<AmbassadorApplication>>(
      `/admin/ambassador-applications/${uuid}/approve`,
      { review_notes: data.review_notes ?? null }
    );
    return response.data;
  },

  // review_notes required (rejection reason). Returns 409 if already decided.
  reject: async (uuid: string, data: RejectAmbassadorData): Promise<ApiResponse<AmbassadorApplication>> => {
    const response = await apiClient.patch<ApiResponse<AmbassadorApplication>>(
      `/admin/ambassador-applications/${uuid}/reject`,
      { review_notes: data.review_notes }
    );
    return response.data;
  },
};

/**
 * Public (signed-in user) Ambassador API. Backs the same endpoints the static
 * /ambassadors apply page uses.
 */
export const ambassadorsApi = {
  // The signed-in user's own application, or `data: null` if they haven't applied.
  //
  // THIS IS ALSO THE DOOR TO THE REFERRAL SCREEN. There is no ambassador user
  // role and there will not be one — roles are a priority ladder where every
  // check asks "at least X", so inserting one in the middle changes the meaning
  // of every existing check for somebody whose abilities do not change at all.
  // An ambassador is an ordinary user with an APPROVED application, so this
  // call, not a role, decides whether the referral screen exists for them.
  getMyApplication: async (): Promise<ApiResponse<AmbassadorApplication>> => {
    const response = await apiClient.get<ApiResponse<AmbassadorApplication>>(
      '/ambassadors/my-application'
    );
    return response.data;
  },

  // Their referral code, plus every code they have retired. `current: null`
  // means they have never claimed one — render the form, not an error.
  getCode: async (): Promise<ApiResponse<AmbassadorCodeState>> => {
    const response = await apiClient.get<ApiResponse<AmbassadorCodeState>>(
      '/ambassadors/code'
    );
    return response.data;
  },

  /**
   * Claim a code, or change to a different one — ONE call does both, and
   * re-claiming a previously retired code simply makes it current again.
   *
   * The caller must surface the server's own answer: `409` somebody else holds
   * it, `422` not an allowed code (use the returned message), `429` more than
   * ten attempts in a minute. There is no way to check a code is free before
   * submitting, so the refusal IS the check.
   *
   * CODES ARE STORED LOWERCASE. `AdaObi` comes back as `adaobi`. Whatever is
   * rendered afterwards must be the code the server returned, never the string
   * that was typed — a code that displays differently from how it resolves is
   * a bug report waiting to happen, and this one gets printed on a face card.
   */
  claimCode: async (code: string): Promise<ApiResponse<AmbassadorCodeState>> => {
    const response = await apiClient.post<ApiResponse<AmbassadorCodeState>>(
      '/ambassadors/code',
      { code }
    );
    return response.data;
  },

  // Their own numbers. No names and no emails come back — an ambassador is not
  // staff — and there is no earnings figure, because nobody has decided they
  // are paid anything.
  getPerformance: async (): Promise<ApiResponse<AmbassadorPerformance>> => {
    const response = await apiClient.get<ApiResponse<AmbassadorPerformance>>(
      '/ambassadors/performance'
    );
    return response.data;
  },
};
