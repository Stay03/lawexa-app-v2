# Payments Handover — Frontend Context for Flutterwave (International) Addition

**Audience:** Backend team adding Flutterwave alongside the existing Paystack integration so users outside Nigeria can pay in non-NGN currencies.

**Goal of this doc:** Tell backend exactly what the frontend currently does today (with Paystack), so the backend contract for the new provider can be designed without breaking anything.

**TL;DR for backend:**
- Frontend never talks to Paystack directly. It calls *our* API; our API calls Paystack; our API returns `authorization_url` + `reference` to the frontend.
- The frontend then redirects the browser to `authorization_url`, and after the user pays, Paystack redirects them back to a `callback_url` we provided. The frontend reads `?reference=...` (or `?trxref=...`) off the URL and calls *our* verify endpoint.
- That entire pattern is provider-agnostic. **If Flutterwave returns the same shape (`authorization_url`, `reference`) the frontend needs almost no changes** to support a new provider — except for letting the user choose the provider (and currency) before checkout.

---

## 1. The Two Payment Flows

There are exactly two user-initiated payment flows in this app today. Both are NGN-only.

### Flow A — Subscriptions (recurring, plan-based)
A user picks a plan from `/pricing`, pays once, and is auto-renewed by Paystack on the plan interval (daily / monthly / annually).

### Flow B — Message Packs (one-time, pay-as-you-go)
A user buys 1–10 "packs" of AI messages (10 messages per pack, NGN 2,000 per pack). Non-recurring; charge once, credit added to their account.

There is also a "free plan subscribe" flow (`POST /subscriptions/subscribe`) that doesn't touch Paystack at all — it's just an enrollment call, no money. Out of scope for Flutterwave.

---

## 2. Subscriptions — Full Contract

### 2.1 Initialize new subscription
- Trigger: [pricing/page.tsx](../app/(main)/pricing/page.tsx) when a user clicks **Get Started** on a paid plan
- Client function: `subscriptionsApi.initializePayment(planId, callbackUrl?)` → [lib/api/subscriptions.ts:50-62](../lib/api/subscriptions.ts#L50-L62)

**Request:**
```
POST /subscriptions/initialize
{
  "plan_id": <number>,
  "callback_url": "https://app.lawexa.com/subscription/callback"   // built from window.location.origin
}
```

**Response (`IPaymentInitData`):** [types/subscription.ts:71-77](../types/subscription.ts#L71-L77)
```ts
{
  authorization_url: string,   // Paystack-hosted checkout URL — frontend redirects here
  access_code: string,         // Not currently used by frontend, kept for parity with Paystack
  reference: string,           // Paystack transaction reference
  plan?: IPlan,
  proration?: IProration       // not relevant for new subs
}
```

Frontend behaviour: `window.location.href = data.authorization_url`. No other handling.

### 2.2 Verify subscription payment
- Trigger: Paystack redirects user to our `callback_url` after payment
- Page: [subscription/callback/page.tsx](../app/(main)/subscription/callback/page.tsx)
- Reference extracted from URL — accepts **either** `?reference=` **or** `?trxref=` ([line 33](../app/(main)/subscription/callback/page.tsx#L33))
- Client function: `subscriptionsApi.verifyPayment(reference)` → [lib/api/subscriptions.ts:67-73](../lib/api/subscriptions.ts#L67-L73)

**Request:**
```
GET /subscriptions/verify?reference=<string>
```

**Response (`ISubscription`):** [types/subscription.ts:38-53](../types/subscription.ts#L38-L53)
- Frontend toasts success, then `router.replace('/settings/billing')`
- On error: shows a Retry button and a "Back to Pricing" button. Mutation is **idempotent from the user's perspective** — a `useRef` guards against double-firing in StrictMode.

### 2.3 Upgrade (paid → higher-priced paid)
Same pattern, two endpoints, with a wrinkle: the response can be **either** a payment-init shape **or** a "no payment needed, already done" shape, depending on whether proration credit covers the new amount.

- Initialize: `POST /subscriptions/upgrade` → [lib/api/subscriptions.ts:78-90](../lib/api/subscriptions.ts#L78-L90)
- Verify: `GET /subscriptions/upgrade/verify?reference=...` → [lib/api/subscriptions.ts:95-101](../lib/api/subscriptions.ts#L95-L101)
- Callback page: [subscription/upgrade/callback/page.tsx](../app/(main)/subscription/upgrade/callback/page.tsx)

**Two response shapes for `/subscriptions/upgrade`:** [types/subscription.ts:80-91](../types/subscription.ts#L80-L91)
```ts
// (A) Payment required
IUpgradeInitData = { authorization_url, access_code, reference, proration? }

// (B) Proration covers full amount — no Paystack redirect, upgrade applied immediately
IUpgradeCompleteData = { subscription: ISubscription, proration? }
```

Frontend branches on `'authorization_url' in result.data` to decide whether to redirect or just toast and refresh.

### 2.4 Cancel
- `POST /subscriptions/cancel` — no money movement, just flags `cancelled_at` server-side. Out of scope for Flutterwave.

### 2.5 Notes for Flutterwave parity (subscriptions)
- Flutterwave's recurring product is **payment plans**. Backend will likely need a `flutterwave_plan_code` per `IPlan` (currently there's only an implicit Paystack plan code on the backend).
- The frontend doesn't care which gateway powers a plan — it only needs the `authorization_url` and the right `callback_url`.
- **Decide**: do we want one callback URL that handles both providers (recommended), or per-provider callback URLs? If one URL, backend's verify endpoint must look up the reference and dispatch internally.

---

## 3. Message Packs — Full Contract

### 3.1 Initialize purchase
- Triggers (two places):
  - Pricing page, "Pay As You Go" tab — [pricing/page.tsx](../app/(main)/pricing/page.tsx) (PackTabContent, lines ~309–404)
  - Standalone dialog used in settings — [components/payg/PurchaseDialog.tsx](../components/payg/PurchaseDialog.tsx)
- Client function: `messagePacksApi.purchase(quantity, callbackUrl?)` → [lib/api/message-packs.ts:43-55](../lib/api/message-packs.ts#L43-L55)

**Request:**
```
POST /message-packs/purchase
{
  "quantity": <1..10>,                            // pack count, not message count
  "callback_url": "https://app.lawexa.com/payg/callback"
}
```

**Response (`IMessagePackPurchaseData`):** [types/message-pack.ts:20-28](../types/message-pack.ts#L20-L28)
```ts
{
  authorization_url: string,
  access_code: string,
  reference: string,    // Pattern: msgpack_{quantity}_{timestamp}_{hash} — see note below
  quantity: number,
  messages: number,     // = quantity * 10
  amount: number,       // currently 2000 * quantity (NGN, integer naira not kobo)
  currency: string      // "NGN"
}
```

Frontend behaviour: stashes `reference` in `sessionStorage` (as `payg_reference`) before redirecting, in case the callback URL strips it. Then `window.location.href = authorization_url`.

> **Reference prefix matters:** the backend recognises pack references by the `msgpack_` prefix when processing webhooks. If Flutterwave references are imposed by Flutterwave (we may not be able to choose them), backend will need a different way to disambiguate pack vs subscription (e.g., metadata or a separate `flutterwave_packs/verify` endpoint).

### 3.2 Verify purchase
- Page: [payg/callback/page.tsx](../app/(main)/payg/callback/page.tsx)
- Reference: same `?reference=` / `?trxref=` fallback
- Client function: `messagePacksApi.verify(reference)` → [lib/api/message-packs.ts:60-65](../lib/api/message-packs.ts#L60-L65)

**Request:**
```
GET /message-packs/verify/{reference}        // reference in path (URL-encoded), NOT query
```

> Note the asymmetry: subscriptions use `?reference=` (query string), packs use `/{reference}` (path). Worth aligning if backend ever rewrites this — frontend doesn't care.

**Response (`IMessagePack`):** [types/message-pack.ts:5-17](../types/message-pack.ts#L5-L17). On success the frontend invalidates the balance and limits queries so the new pack appears immediately.

### 3.3 Pricing
- Frontend currently **hardcodes 2,000 NGN per pack** in the UI when displaying the total to the user. The backend echoes `amount` in the purchase response but the pre-checkout total ("Buy - ₦10,000") is computed client-side as `quantity * 2000`.
- For Flutterwave: either backend exposes a "pack price" endpoint, or the frontend learns the per-pack price from a config object, so we can stop hardcoding when adding USD pricing.

---

## 4. Where Currency Lives Today

### User-facing
- **No user-side currency choice exists.** Every plan response carries `currency: "NGN"`. Every pack carries `currency: "NGN"`. The pack price is literally hardcoded as `2000` in the React component.
- `formatNaira()` helper in [components/subscriptions/PlanCard.tsx:408-417](../components/subscriptions/PlanCard.tsx#L408-L417) strips `NGN` and prepends `₦` for display.

### Admin-facing (sponsor reporting only)
There **is** a currency toggle, but it's a **display-only re-conversion for admin analytics** — it doesn't affect what users pay.
- Component: [components/admin/CurrencySettings.tsx](../components/admin/CurrencySettings.tsx)
- Store: [lib/stores/currencyStore.ts](../lib/stores/currencyStore.ts) — Zustand, persisted to localStorage as `lawexa-currency`
- Default: shows USD using a manual exchange rate (default 1500 NGN/USD)
- Used in sponsor usage pages — [app/(admin)/admin/sponsors/[id]/usage/page.tsx](../app/(admin)/admin/sponsors/[id]/usage/page.tsx) — to translate sponsor cost figures into USD for stakeholders. Recent commit `c20af1c`.

**Implication for Flutterwave:** the admin USD toggle is a display hack, not an actual currency system. Real multi-currency support needs `IPlan.currency` and `IMessagePackPurchaseData.currency` to vary, plus prices that aren't NGN-hardcoded on the frontend.

---

## 5. Webhooks (Frontend Awareness)

Webhooks are 100% backend territory — frontend never receives webhooks. **But** there is an admin UI that *inspects* the webhook log.

- Admin page: [app/(admin)/admin/paystack-webhooks/page.tsx](../app/(admin)/admin/paystack-webhooks/page.tsx) (polls every 20s, filterable, manual replay)
- API client: [lib/api/admin-paystack-webhooks.ts](../lib/api/admin-paystack-webhooks.ts)
- Types & known event enum: [types/admin-paystack-webhooks.ts](../types/admin-paystack-webhooks.ts)

Events the type enum currently knows about:
```
handled:    charge.success, subscription.create, subscription.disable,
            subscription.not_renew, invoice.create, invoice.payment_failed,
            refund.pending, refund.processing, refund.processed,
            refund.failed, refund.needs-attention
unhandled:  charge.dispute.*, invoice.update, subscription.enable,
            paymentrequest.*, customeridentification.*
```

**For Flutterwave:** if you want admins to see Flutterwave webhooks in the same UI, either:
- Add a `provider` discriminator on the webhook resource and extend the event-name enum to include Flutterwave names (`charge.completed`, `subscription.cancelled`, etc.), OR
- Add a parallel `/admin/flutterwave-webhooks` resource and frontend route. Cheaper to start with this if event semantics diverge a lot.

---

## 6. What the Frontend Does NOT Know / Do

So backend doesn't make wrong assumptions:

- ❌ No Paystack public key on the frontend. We do not use Paystack's inline JS (`PaystackPop`) — we only redirect to the hosted `authorization_url` returned by our backend.
- ❌ No frontend env var anywhere related to Paystack. The only payment-related env is `NEXT_PUBLIC_APP_URL` (used for building `callback_url`).
- ❌ No client-side signature verification of anything.
- ❌ No retries on the initialize call (the user just clicks the button again if it fails).
- ❌ Frontend doesn't know what country the user is in. Geo-based provider routing must happen server-side (or via an explicit user toggle introduced on the frontend — see §7).

---

## 7. Suggested Contract Shape for Flutterwave Support

These are the questions the backend needs to answer; the frontend will adapt to whatever shape you ship. Listing the options so we can align quickly.

### 7.1 Provider selection
**Option A (cleanest):** Backend decides based on user country / plan currency. Frontend remains unchanged except for showing the appropriate currency on the pricing page. Pro: zero UI work. Con: user can't override (e.g., a Nigerian abroad who wants to pay in USD).

**Option B:** Frontend adds a provider/currency picker on `/pricing` and on the PAYG dialog. Sends `provider: "paystack" | "flutterwave"` (or `currency: "NGN" | "USD"`) in the initialize call. Backend picks gateway from that.

We recommend **B** — explicit currency picker on `/pricing` and on `PurchaseDialog`. It's a small UI change and avoids fragile IP-based routing.

### 7.2 Endpoint surface
Two reasonable shapes:

**(i)** Same endpoints, new field. Add `provider` (or `currency`) to existing `POST /subscriptions/initialize`, `POST /subscriptions/upgrade`, `POST /message-packs/purchase`. Verify endpoints stay the same and dispatch internally on the reference. **Strongly preferred** — minimal frontend churn.

**(ii)** Parallel endpoints — `/subscriptions/initialize/flutterwave`, etc. Avoid unless internal architecture forces it; the frontend then needs branching logic everywhere.

### 7.3 Response shape
Keep `{ authorization_url, access_code, reference }`. Flutterwave's API returns `data.link` — backend should rename it to `authorization_url` before sending to frontend so the frontend stays provider-agnostic.

### 7.4 Callback URLs
Keep the existing two paths:
- `/subscription/callback` (and `/subscription/upgrade/callback`)
- `/payg/callback`

Both already handle `?reference=` and `?trxref=`. Flutterwave appends `?status=&tx_ref=&transaction_id=` — the frontend will need to also accept `?tx_ref=` as a fallback. Easy two-line change ([callback page line 33](../app/(main)/subscription/callback/page.tsx#L33)).

### 7.5 Currency on plans / packs
For multi-currency to actually work, backend should return plans (and the pack price) **per-currency**. Options:
- `IPlan.amount_ngn`, `IPlan.amount_usd` (and frontend picks)
- Plans become currency-scoped — `GET /subscriptions/plans?currency=USD` returns a different `amount` and `formatted_amount`
- A separate `prices` array on each plan

Frontend can support any of these; we just need one chosen.

### 7.6 Reference disambiguation
Today the backend identifies pack payments by `reference.startsWith('msgpack_')`. If Flutterwave forces its own reference format, send metadata (`meta: { purchase_type: 'message_pack' }`) with the charge and rely on that instead of the prefix.

---

## 8. File Index (Frontend)

| Concern | Path |
|---|---|
| Subscription API client | [lib/api/subscriptions.ts](../lib/api/subscriptions.ts) |
| Subscription hooks (React Query) | [lib/hooks/useSubscriptions.ts](../lib/hooks/useSubscriptions.ts) |
| Subscription types | [types/subscription.ts](../types/subscription.ts) |
| Pricing page (subscription + pack triggers) | [app/(main)/pricing/page.tsx](../app/(main)/pricing/page.tsx) |
| Plan card UI | [components/subscriptions/PlanCard.tsx](../components/subscriptions/PlanCard.tsx) |
| Subscription callback | [app/(main)/subscription/callback/page.tsx](../app/(main)/subscription/callback/page.tsx) |
| Upgrade callback | [app/(main)/subscription/upgrade/callback/page.tsx](../app/(main)/subscription/upgrade/callback/page.tsx) |
| Pack API client | [lib/api/message-packs.ts](../lib/api/message-packs.ts) |
| Pack hooks | [lib/hooks/useMessagePacks.ts](../lib/hooks/useMessagePacks.ts) |
| Pack types | [types/message-pack.ts](../types/message-pack.ts) |
| Pack purchase dialog | [components/payg/PurchaseDialog.tsx](../components/payg/PurchaseDialog.tsx) |
| Pack callback | [app/(main)/payg/callback/page.tsx](../app/(main)/payg/callback/page.tsx) |
| Admin webhook viewer | [app/(admin)/admin/paystack-webhooks/page.tsx](../app/(admin)/admin/paystack-webhooks/page.tsx) |
| Admin webhook types | [types/admin-paystack-webhooks.ts](../types/admin-paystack-webhooks.ts) |
| Admin currency toggle (display only) | [components/admin/CurrencySettings.tsx](../components/admin/CurrencySettings.tsx) |
| Currency store | [lib/stores/currencyStore.ts](../lib/stores/currencyStore.ts) |
| Sponsor usage page (currency toggle consumer) | [app/(admin)/admin/sponsors/[id]/usage/page.tsx](../app/(admin)/admin/sponsors/[id]/usage/page.tsx) |
| Existing Paystack subscription API doc | [docs/apiDocs/subscriptions-and-plans.md](apiDocs/subscriptions-and-plans.md) |
| Existing Paystack PAYG API doc | [docs/apiDocs/payg-message-packs-api.md](apiDocs/payg-message-packs-api.md) |

---

## 9. Open Questions for Backend

1. **Provider selection mechanism** — geo-based or user-selected? (Recommend user-selected via currency picker on `/pricing`.)
2. **Endpoint design** — same endpoints with a `provider`/`currency` param, or parallel routes? (Recommend same endpoints.)
3. **Plan pricing model** — are paid plans dual-priced (NGN + USD), or are they currency-scoped (one plan, one currency)?
4. **Message pack pricing in USD** — what's the USD price? Frontend currently hardcodes NGN 2,000 per pack in the UI.
5. **Reference disambiguation for Flutterwave** — can the backend still identify pack-type charges by reference prefix, or do we need metadata-based routing?
6. **Webhook viewer** — extend the existing admin page (single unified view), or add a separate Flutterwave page?
7. **Sponsor campaigns** — currently pack campaigns issue grants from admin only (no payment); will sponsor purchase flows ever exist in Flutterwave? (Asking because [types/admin-sponsors.ts](../types/admin-sponsors.ts) defines `AdminPackCampaign` with `pack_size` and that's the file you had open.)

---

**Bottom line:** the frontend is already provider-agnostic in its mechanics (it just redirects to whatever URL the backend hands it and verifies whatever reference comes back). The work to add Flutterwave is mostly backend (gateway integration, webhook handler, plan/price modelling) plus a small frontend addition for a currency/provider picker and an extra `tx_ref` fallback in the callback pages.
