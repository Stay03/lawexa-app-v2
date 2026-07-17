# Push Notifications (FCM) — Frontend → Backend hand-off

## Status (2026-07-13)

- **Frontend push is live and verified in prod.** A Firebase Console test message
  sent directly to a registered device token displays correctly on desktop Chrome
  and Android (service worker, token retrieval, VAPID/project config all confirmed
  working). The Lawexa service worker renders it and deep-links on click.
- **Device registration works.** `POST /notification-channels/push` returns the
  device row and Settings → Notifications shows "On for this device".
- **The gap:** real in-app events (mentions / invites / verification) are not
  producing pushes. Because direct FCM delivery to the stored token works, the
  issue is on the **send-side** (server → FCM), not the client.

## Please verify on the backend

1. **Firebase Admin credentials** for project `lawexa-80a3c` are present in prod
   (service account JSON), and the sender matches `messagingSenderId 365859943014`.
2. The **event → push** path actually fires for the intended events:
   - channel **mentions** (NOT regular messages — mentions only),
   - channel / space / org **invites**,
   - org **verification** outcomes.
3. **Send conditions** aren't over-filtering. Confirm that a mention aimed at a
   user who has ≥1 active device and the app closed does result in a send
   (checks like author ≠ recipient and channel-not-muted are expected; make sure
   there isn't an additional gate silently suppressing everything).
4. **Dead tokens:** on an FCM `UNREGISTERED` response, deactivate the device row.

## Payload contract — send DATA-ONLY (important)

The frontend service worker renders the notification and handles the click, so the
push must be **data-only**. Do **not** include a top-level `notification` block —
FCM will auto-display its own generic notification on top of ours, producing a
**duplicate** (verified: the Firebase Console test, which sends a `notification`
payload, showed two notifications). Put everything in `data`:

**FCM HTTP v1:**
```json
{
  "message": {
    "token": "<device-token>",
    "data": {
      "title": "Amaka mentioned you in #land-law",
      "body": "…short preview text…",
      "url": "/channels/{channelUuid}?m={messageUuid}"
    },
    "webpush": { "headers": { "Urgency": "high", "TTL": "86400" } }
  }
}
```

Keys the service worker reads from `data`:

| key | required | notes |
|-----|----------|-------|
| `title` | yes | notification title |
| `body`  | yes | notification body / preview |
| `url`   | yes | **relative** in-app deep link (opened on tap) |
| `tag`   | no  | de-dupe/replace key (e.g. `mention-{messageUuid}`) |

Suggested `url` per event type (mirrors the existing DB-notification `action_url`s):

| Event | `data.url` |
|-------|-----------|
| Channel mention | `/channels/{channelUuid}?m={messageUuid}` |
| Channel invite  | `/channel-invitations` |
| Space invite    | `/space-invitations` |
| Org invite      | `/organization-invitations` |
| Org verification| `/settings/organization` |

## How the frontend handles it (for reference)

- Service worker (`public/firebase-messaging-sw.js`): `onBackgroundMessage` →
  `showNotification(data.title, { body: data.body, icon: Lawexa, data: { url } })`.
- `notificationclick` → focuses an existing Lawexa tab and navigates it, else
  `clients.openWindow(data.url)`.
- Foreground messages are intentionally ignored — the open-app case is already
  covered by Reverb/Echo, so please don't rely on the client showing anything
  while the tab is focused.
