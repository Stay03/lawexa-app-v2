# Research — how our stack can tell whether somebody is actually looking

Asked by @staynjokede, 2026-08-11, before we settle on a method for suppressing
email when the person is already watching the message arrive.

**Short answer: we do not need to build a presence mechanism. We already have a
better signal than presence, it is already stored server-side, and it already
means what we need it to mean.**

---

## 1. What our stack can already tell the server

### a. The read pointer — the strong one

`POST /channels/{uuid}/read`, driven by `v2/features/channels/mark-read.ts`.

It fires only when **all** of these hold:

- the channel screen is open, **and**
- `document.visibilityState` is visible — a background tab marks nothing, **and**
- the newest message has been in the viewport for a **full second**.

It also fires when the person sends a message, or presses jump-to-latest.

So "they read it" does not mean "the app was open". It means a human's eyes were
on that message, on a visible tab, for a second. That is a much stronger claim
than most systems can make, and it is exactly the question an email suppressor
needs to ask.

**It is already persisted server-side** — it is what drives the unread badges. No
new endpoint, no new client work, nothing to design.

### b. Presence — the tempting one, and the wrong one

We do run Reverb presence rooms per channel (`presence-channels.{uuid}`,
`v2/features/channels/room.ts`), and Reverb can tell the server who is
subscribed (`PresenceChannelSubscribe` / `PresenceChannelUnsubscribe`).

**Do not build the email rule on it.** A websocket stays open in a background
tab. Browsers throttle timers but keep sockets alive, so "subscribed to the
presence room" means *this person has a tab open somewhere*, not *this person is
looking*. Building suppression on presence would silently swallow emails for
people who left a tab open on Friday — the worst failure direction, because
nobody ever finds out about an email that was not sent.

Presence answers "who is here now" for faces on screen. It should keep doing
only that.

### c. The active-channel registry — client-only, worth knowing about

`v2/runtime/realtime/active-channel.ts` already implements exactly this idea for
in-app toasts: never notify the conversation the user is looking at. It is
client-side and invisible to the server, so it cannot serve email. It is worth
knowing that the principle is already house style — we are not inventing a
policy, we are extending one to a channel the server owns.

---

## 2. What the industry actually does

- **Slack** marks somebody Away after **30 minutes** of no keyboard or mouse on
  desktop, and **30–60 seconds** after the mobile app is backgrounded. Email
  goes out when you are not actively engaged, and is **bundled** — every 15
  minutes or hourly, by preference.
- The important part is not the threshold. It is that email is a *consequence of
  absence*, never a consequence of an event. We currently email on the event.

That single inversion is the whole fix, and @backendclaude has already named it.

---

## 3. Recommendation

**Use the read pointer. Do not add a heartbeat, and do not use presence.**

1. Hold the email briefly — a few minutes is enough, and it need not match
   Slack's 30, because our signal is sharper than Slack's "no mouse movement".
2. When the timer fires, ask one question: **has this person's read pointer
   passed this message?** If yes, drop the email. If no, send it.
3. Bundle if more than one thing is waiting for the same person.

**Why no heartbeat.** A "last active anywhere" ping would tell us the person is
in the app but says nothing about whether they saw *this* message. Somebody deep
in another channel for an hour should still be emailed about a mention they
never opened. The read pointer answers the precise question; a heartbeat answers
a vaguer one and costs a new mechanism to maintain.

**Two things to write into the plan so nobody "fixes" them later:**

- The mark-read call is **fire-and-forget**. If it fails, the pointer stays put
  and the person gets an email for something they did read. **An extra email,
  never a missing one.** That is the correct direction for this to break, and it
  should be stated, because it looks like a bug to anybody who meets it cold.
- The pointer is **per channel and member-only**. A previewer reading a public
  channel they never joined does not advance it. That is right — they are not a
  member and are not being emailed.

**One gap this does not close.** Mute is currently one switch for in-app, push
and email together (confirmed by @backendclaude at the dispatch site). Somebody
who wants the badge but not the inbox cannot say so. That is a genuine missing
control, separate from the timing fix, and it is the part of the owner's
original ask that is real.

---

## 4. What the frontend has to build

For the timing fix: **nothing.** The signal exists, it is already sent, and it
already means the right thing.

If the split control lands (badge yes, email no), the frontend work is the
channel menu's notification group — today one radio set of All / Mentions only /
Muted — becoming a shape that carries email separately. Small, and it waits on
the backend contract.

**Do not assume the storage is already there.** A per-account table of delivery
methods DOES exist and looks exactly like the right home for this, but nothing
in the messaging side reads it — it is used only by Radar, to decide where a
scan alert goes (@backendclaude, checked 2026-08-11). Anybody picking this up
who finds that table will think the hard part is done. It is not.

Sources: [Slack presence and status](https://api.slack.com/apis/presence-and-status),
[Guide to Slack notifications](https://slack.com/help/articles/360025446073-Guide-to-Slack-notifications),
[When Slack goes inactive](https://staygreenonslack.com/when-does-slack-go-inactive),
[Reverb presence channels](https://codecourse.com/watch/realtime-with-laravel-reverb/how-presence-channels-work),
[Reverb presence subscribe/unsubscribe events](https://github.com/laravel/reverb/issues/185)
