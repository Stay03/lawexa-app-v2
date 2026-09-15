// System health — the one call behind the operations dashboard's health panel.
import { apiClient } from './client';
import type { SystemHealthResponse } from '@/types/system-health';

/**
 * `GET /api/health`. Answers without a token (measured 2026-08-12); it is sent
 * through the usual client anyway so it shares the base URL and interceptors
 * rather than becoming a second way of talking to the API.
 *
 * A DEGRADED SYSTEM ANSWERS 503 AND THE BODY IS THE POINT OF THE CALL. The
 * endpoint returns the same envelope with `status` set to the server's own word
 * and `checks` naming what is wrong. Axios rejects every non-2xx by default and
 * the client's interceptor only special-cases 401, so without the line below
 * the hook reported an error and the panel rendered "Couldn't reach the health
 * check" — at the exact moment the health check had reached us and said what
 * was broken. Measured on production 14 Sep 2026: degraded is reachable via
 * `failed.last_hour >= 20`, any queue at 500 pending, or workers stopped.
 *
 * 503 ONLY. A 500 or a gateway error is a real transport failure and still
 * rejects, because "the API fell over" and "the API says it is unwell" are
 * different news and the panel says different things about them.
 */
async function getHealth(): Promise<SystemHealthResponse> {
  const response = await apiClient.get<SystemHealthResponse>('/health', {
    validateStatus: (status) => status === 200 || status === 503,
  });
  /* A 503 body we have never seen would otherwise render an empty card that
     looks fine. If the payload does not carry checks, fail the way an
     unreachable endpoint fails, which is the honest outcome and the one the
     panel already draws. */
  if (!response.data?.data?.checks) {
    throw new Error(`Health check answered ${response.status} without a checks payload`);
  }
  return response.data;
}

export const systemHealthApi = {
  getHealth,
};
