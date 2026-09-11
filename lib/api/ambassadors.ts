import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type {
  AmbassadorApplication,
  AmbassadorCodeState,
  AmbassadorDailySignup,
  AmbassadorFinancials,
  AmbassadorListParams,
  AmbassadorPerformance,
  AmbassadorListResponse,
  ApproveAmbassadorData,
  RejectAmbassadorData,
} from '@/types/ambassador';

// Hoisted out of the object below so `getAllApplications` can call it. One
// implementation, one URL — a second copy of the path is a second thing to
// change.
const getAdminList = async (params: AmbassadorListParams = {}): Promise<AmbassadorListResponse> => {
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
};

/**
 * Every application, walked a page at a time until there is nothing new.
 *
 * ── WHY THE APPLICATIONS SCREEN CALLS THIS ─────────────────────────────────
 * `GET /admin/ambassador-applications` filters on `status` and on nothing
 * else, and caps `per_page` at 50. Measured 2026-09-10: `search`, `country`,
 * `level`, `university` and `sort=reviewed_at` each returned all 153
 * applications unfiltered, and asking for 100 per page returned 50. So the
 * applications screen takes every row from here and filters, searches, sorts
 * and pages them itself. `perPage` defaults to the cap because asking for more
 * changes nothing.
 *
 * ── WHY THE FINANCIALS SCREEN CALLS THIS ───────────────────────────────────
 * A financials row carries no university, no level and no country: those three
 * live on the APPLICATION and nowhere else. `/admin/ambassadors/financials`
 * takes no parameters at all, so there is nothing to ask it for — the two are
 * joined client-side on `application_uuid` → application `uuid`. Measured
 * 2026-09-09: all 113 financial rows carry an `application_uuid`, all 113 find
 * an application, and university, level and country are set on every one.
 *
 * No `status` is sent. The join is by uuid, so a pending or rejected
 * application costs one row of memory and saves an assumption about which
 * statuses can appear in the financials list.
 *
 * The walk stops on a page that adds no NEW uuid rather than on `last_page`
 * alone, and `MAX_PAGES` sits under both: a request loop against admin routes
 * is worse than a short list.
 */
const getAllApplications = async (perPage = 50): Promise<AmbassadorApplication[]> => {
  const MAX_PAGES = 50;
  const seen = new Set<string>();
  const all: AmbassadorApplication[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await getAdminList({ page, per_page: perPage });
    const batch = response.data ?? [];

    let added = 0;
    for (const application of batch) {
      if (seen.has(application.uuid)) continue;
      seen.add(application.uuid);
      all.push(application);
      added += 1;
    }

    if (added === 0) break;

    const lastPage = response.pagination?.last_page;
    if (typeof lastPage === 'number' && page >= lastPage) break;
  }

  return all;
};

/**
 * Admin Ambassador Applications API. All endpoints require role:admin.
 */
export const adminAmbassadorsApi = {
  getAdminList,
  getAllApplications,

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

  // Every ambassador and what their referrals were worth. One call, no paging:
  // ambassadors who referred nobody are INCLUDED with zeros, because "did
  // nothing" and "not in the list" are different answers.
  getFinancials: async (): Promise<ApiResponse<AmbassadorFinancials>> => {
    const response = await apiClient.get<ApiResponse<AmbassadorFinancials>>(
      '/admin/ambassadors/financials'
    );
    return response.data;
  },

  /**
   * The day-by-day record behind `unusual_activity`.
   *
   * This is what makes the flag usable rather than accusing: it cannot itself
   * tell a lecture-hall demo from somebody farming, so an admin needs the days
   * to decide. Newest first, and only days that had signups.
   */
  getDailySignups: async (
    userUuid: string,
    days = 30
  ): Promise<ApiResponse<{ days: number; signups: AmbassadorDailySignup[] }>> => {
    const response = await apiClient.get<
      ApiResponse<{ days: number; signups: AmbassadorDailySignup[] }>
    >(`/admin/ambassadors/${userUuid}/daily-signups`, { params: { days } });
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
   *
   * ── THE RETURN IS DELIBERATELY UNTYPED, AND THAT IS A SCAR ─────────────────
   * This was first written as returning `AmbassadorCodeState`, the same shape
   * as `getCode`. That was a GUESS — nobody measured it — and it is wrong, so
   * the screen wrote a shape with no `current` into its cache and claiming a
   * code appeared to do nothing at all (@arthur, 2026-08-11). Callers must
   * REFETCH after this succeeds rather than read what it hands back. Typing it
   * as `unknown` is what stops the next person assuming again.
   */
  claimCode: async (code: string): Promise<ApiResponse<unknown>> => {
    const response = await apiClient.post<ApiResponse<unknown>>(
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
