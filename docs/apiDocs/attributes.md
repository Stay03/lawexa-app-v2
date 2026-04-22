# Attribution Tracking — Endpoint Verification

Black-box verification of the attribution feature against a running server (`http://localhost:8000`) via `curl`. All behaviors were confirmed against the persisted `user_attributions` row using `php artisan tinker`.

**Date:** 2026-04-21
**Endpoints covered:** `POST /api/auth/guest`, `POST /api/auth/register`

---

## 1. Guest token — happy path (all UTM fields)

**Request:**

```bash
curl -X POST http://localhost:8000/api/auth/guest \
  -H "Content-Type: application/json" \
  -d '{
    "fingerprint": "curl_fp_1",
    "device_id": "curl_dev_1",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "spring-2026",
    "utm_term": "legal research",
    "utm_content": "banner-a",
    "referrer_url": "https://www.google.com/search?q=lawexa",
    "landing_url": "https://lawexa.com/?utm_source=google",
    "referral_code": "FRIEND-123"
  }'
```

**Response:** `201 Created`

**Persisted row:**

```json
{
    "user_id": 2532,
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "spring-2026",
    "utm_term": "legal research",
    "utm_content": "banner-a",
    "referrer_url": "https://www.google.com/search?q=lawexa",
    "landing_url": "https://lawexa.com/?utm_source=google",
    "referral_code": "FRIEND-123",
    "referrer_user_id": null,
    "origin_guest_user_id": null,
    "first_touched_at": "2026-04-21T16:23:55Z"
}
```

✅ All fields persisted. `first_touched_at` populated.

---

## 2. First-touch preservation — returning guest cannot overwrite

**Scenario:** Same `device_id` as test 1, different UTM source/campaign.

**Request:**

```bash
curl -X POST http://localhost:8000/api/auth/guest \
  -H "Content-Type: application/json" \
  -d '{"fingerprint":"curl_fp_1","device_id":"curl_dev_1","utm_source":"twitter","utm_campaign":"OVERWRITE-ATTEMPT"}'
```

**Response:** `201 Created` (returns the same existing guest)

**Verification:**

```
users with device_id curl_dev_1: 1
attribution rows for this user: 1
utm_source: google
utm_campaign: spring-2026
```

✅ Original attribution untouched. `firstOrCreate` semantics confirmed.

---

## 3. Referer header fallback

**Scenario:** `referrer_url` omitted from body; `Referer` header provided.

**Request:**

```bash
curl -X POST http://localhost:8000/api/auth/guest \
  -H "Content-Type: application/json" \
  -H "Referer: https://news.ycombinator.com/item?id=42" \
  -d '{"fingerprint":"curl_fp_referer","device_id":"curl_dev_referer","utm_source":"hn"}'
```

**Response:** `201 Created`

**Persisted:**

```
referrer_url: https://news.ycombinator.com/item?id=42
utm_source:   hn
```

✅ Header correctly used as fallback when body field absent.

---

## 4. Same-origin Referer stripped

**Scenario:** `Referer` points back to the app itself — should not be treated as a referral.

**Request:**

```bash
curl -X POST http://localhost:8000/api/auth/guest \
  -H "Referer: http://localhost:8000/pricing" \
  -d '{"fingerprint":"curl_fp_sameorigin","device_id":"curl_dev_sameorigin"}'
```

**Response:** `201 Created`

**Persisted:**

```
referrer_url: NULL
```

✅ Same-origin stripping works. Host comparison against `config('app.url')`.

---

## 5. Guest → registered conversion (first-touch wins)

**Scenario:** Guest captures attribution with `utm_source=linkedin`. User registers later with `utm_source=twitter`. Strict first-touch: LinkedIn must win.

**Requests:**

```bash
# Step 1 — guest with attribution
curl -X POST http://localhost:8000/api/auth/guest \
  -d '{"fingerprint":"conv_fp","device_id":"conv_dev","utm_source":"linkedin","utm_campaign":"FIRST-TOUCH"}'

# Step 2 — register with matching device_id + different UTM
curl -X POST http://localhost:8000/api/auth/register \
  -d '{
    "name":"Converted User",
    "email":"conv-test@example.com",
    "password":"password123","password_confirmation":"password123",
    "fingerprint":"conv_fp","device_id":"conv_dev",
    "utm_source":"twitter","utm_campaign":"SECOND-TOUCH"
  }'
```

**Persisted on registered user:**

```
utm_source:           linkedin
utm_campaign:         FIRST-TOUCH
origin_guest_user_id: 2535        (the guest row)
first_touched_at:     2026-04-21T16:24:57Z   (preserved from guest)
```

✅ First-touch preserved. Audit pointer `origin_guest_user_id` set correctly. Register-time UTM discarded.

---

## 6. Direct register — no prior guest

**Scenario:** User registers without ever having been a guest.

**Request:**

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -d '{
    "name":"Brand New","email":"brandnew@example.com",
    "password":"password123","password_confirmation":"password123",
    "utm_source":"facebook","utm_campaign":"cold-traffic"
  }'
```

**Persisted:**

```
utm_source:           facebook
utm_campaign:         cold-traffic
origin_guest_user_id: NULL
```

✅ Falls through to register payload. `origin_guest_user_id` correctly null.

---

## 7. Bare register — no UTM, no prior guest

**Scenario:** Zero attribution data available anywhere.

**Request:**

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -d '{"name":"Bare","email":"bare@example.com","password":"password123","password_confirmation":"password123"}'
```

**Persisted:**

```
attribution row exists:  yes
utm_source:              NULL
first_touched_at:        2026-04-21T16:26:13Z
```

✅ Attribution row is always created — even for direct traffic. `first_touched_at` is still set. This keeps reporting simple (no `LEFT JOIN` gymnastics to distinguish "direct" from "missing").

---

## 8. ⚠ Semantic trade-off: direct-traffic first-touch beats later UTM

**Scenario:** Guest is created with **no** UTM (direct visit). User returns later, clicks a UTM ad, registers on same device. What happens?

**Requests:**

```bash
# Guest, direct traffic
curl -X POST http://localhost:8000/api/auth/guest \
  -d '{"fingerprint":"direct_fp","device_id":"direct_dev"}'

# Later register with UTM
curl -X POST http://localhost:8000/api/auth/register \
  -d '{
    "name":"Direct First","email":"direct-first@example.com",
    "password":"password123","password_confirmation":"password123",
    "fingerprint":"direct_fp","device_id":"direct_dev",
    "utm_source":"ad-i-clicked-later","utm_campaign":"should-not-apply"
  }'
```

**Persisted:**

```
utm_source:           NULL
origin_guest_user_id: 2538
```

**Analysis:** This is strict first-touch behavior — the user's *first* interaction was direct, so that is their attribution, even if they later clicked a paid ad. Marketing should be aware: users who browse the site before a paid campaign reaches them will appear as "direct" in the data, not attributed to the campaign. This is a documented choice, not a bug.

**Mitigation if this matters:** FE can re-write the guest row's `utm_*` fields at conversion by adding a backend endpoint that allows "upgrade" only when the existing attribution is fully null. Out of scope for v1.

---

## 9. Pre-feature guest (no attribution row) → register

**Scenario:** A guest created before the feature shipped has no attribution row. The guest is matched by device on register.

**Steps:**

1. Create guest with UTM.
2. Manually `DELETE FROM user_attributions WHERE user_id = <guest id>`.
3. Register with matching `device_id` and fresh UTM fields.

**Persisted on registered user:**

```
utm_source:           register-time-utm   (from register payload)
origin_guest_user_id: NULL
```

✅ Falls through to register payload when prior guest has no attribution row. No crash.

**Minor observation:** `origin_guest_user_id` is NULL here even though a prior guest *was* matched by device. The field means "origin of the attribution data" — and since the data came from the register payload, not the guest, NULL is semantically correct. Document clearly if this matters for future audit queries.

---

## 10. Referer fallback works on `/auth/register` too

**Request:**

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Referer: https://reddit.com/r/law" \
  -d '{"name":"Reg Referer","email":"regreferer@example.com","password":"password123","password_confirmation":"password123"}'
```

**Persisted:**

```
referrer_url: https://reddit.com/r/law
```

✅ Same fallback rules apply across endpoints.

---

## 11. Validation — rejections

| Scenario | Input | Response |
|----------|-------|----------|
| Invalid URL | `"referrer_url":"not a url"` | `422` — "The referrer url field must be a valid URL." |
| Invalid referral code | `"referral_code":"has spaces!"` | `422` — "The referral code field must only contain letters, numbers, dashes, and underscores." |
| Over-length `utm_source` (101 chars) | 101×`a` | `422` — "The utm source field must not be greater than 100 characters." |
| Over-length `referrer_url` (2115 chars) | 2115-char URL | `422` — "The referrer url field must not be greater than 2048 characters." |

✅ All validation rules fire correctly at the FormRequest layer before hitting the service.

---

## 12. Boundary lengths — accepted

| Field | Length | Result |
|-------|--------|--------|
| `utm_source` | exactly 100 chars | `201`, stored at length 100 |
| `utm_content` | exactly 150 chars | `201`, stored at length 150 |
| `referrer_url` | 2035 chars (under 2048) | `201`, stored at length 2035 |

✅ Exact-limit values pass through without truncation.

---

## 13. Empty strings → null

**Request:**

```bash
curl -X POST http://localhost:8000/api/auth/guest \
  -d '{"fingerprint":"empty1","utm_source":"","referrer_url":"","landing_url":""}'
```

**Persisted:**

```
utm_source:   NULL
referrer_url: NULL
```

✅ Laravel's `ConvertEmptyStringsToNull` middleware + the service's `stringOrNull` helper both correctly collapse `""` to `NULL`. No empty strings polluting the table.

---

## 14. Unicode / multi-byte characters

**Request:** UTF-8 JSON via `--data-binary` (Windows shell mangles `-d` strings containing non-ASCII, unrelated to the app).

```bash
curl -X POST http://localhost:8000/api/auth/guest \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @unicode.json
# unicode.json: {"fingerprint":"uni_fp_v3","utm_source":"naïve-café","utm_campaign":"日本語"}
```

**Persisted:**

```
utm_source:        naïve-café
utm_campaign:      日本語
utm_source bytes:  12
utm_campaign bytes: 9
```

✅ Multi-byte UTF-8 stored and retrieved intact.

---

## Findings summary

| # | Scenario | Status |
|---|----------|--------|
| 1 | Guest with all UTM fields | ✅ |
| 2 | Returning guest — first-touch preserved | ✅ |
| 3 | Referer header fallback | ✅ |
| 4 | Same-origin Referer stripped | ✅ |
| 5 | Guest→register conversion preserves first-touch + audit pointer | ✅ |
| 6 | Register with no prior guest | ✅ |
| 7 | Bare register creates null row (not missing row) | ✅ |
| 8 | Direct-first-touch beats later UTM at register | ✅ semantic trade-off |
| 9 | Pre-feature guest (no attribution row) falls through | ✅ |
| 10 | Referer fallback on `/auth/register` | ✅ |
| 11 | URL, referral_code, length validation | ✅ 422 |
| 12 | Boundary lengths accepted | ✅ |
| 13 | Empty strings → null | ✅ |
| 14 | UTF-8 / CJK characters | ✅ |

---

## Observations worth documenting for consumers

1. **Strict first-touch can surprise marketers.** A user whose first visit was direct will stay "direct" even if they later register via a paid ad. See section 8.
2. **`origin_guest_user_id` semantics.** The field tracks *where the attribution data came from*, not *whether a prior guest was matched*. It is populated only when the guest had an existing attribution row that was copied forward. See section 9.
3. **Attribution row is always created.** Even for pure direct traffic with zero fields. Simplifies analytics queries — always `INNER JOIN`, never `LEFT JOIN` to check existence.

## Not bugs, but ops notes

- During high-volume testing, user creation occasionally hit Meilisearch indexing timeouts (remote service unreachable), producing `500` responses on the User write path. This is pre-existing behavior unrelated to attribution — any user-creating endpoint is affected.
- Windows bash has encoding issues passing UTF-8 via `curl -d`. Use `--data-binary @file.json` for unicode payloads. Server-side handling is fine.
