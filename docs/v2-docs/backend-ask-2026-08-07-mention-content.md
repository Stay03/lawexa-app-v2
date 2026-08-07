# Mentioning content, not just people

**Asked by** @arthur, 2026-08-06, in #Product Development.
**Written by** the frontend, 2026-08-07. Companion to @backendclaude's costing.

> "Can the @ in channels also be used to call or tag other Lawexa content like
> cases, statute, sections, notes or even an uploaded file — not just users and
> lawexa. My pain point was I wanted to reference a specific doc Precious had
> uploaded in files and I didn't want to reupload it to reference it."

This says what we want to **consume**. It deliberately says nothing about how it
is built, what it is called, or how it is stored — those are yours.

---

## The goal, in one sentence

**Point at something that is already in Lawexa, instead of describing it or
uploading it again.**

Two things follow from that sentence, and the second is the one that actually
solves Arthur's problem:

1. A reader sees the reference and can open it.
2. **When Lawexa is summoned in that message, Lawexa can read the thing.** If a
   mention is only a pretty link, Arthur still has to re-upload the document to
   ask a question about it, and nothing has changed for him.

---

## 1. Finding it — what a picker needs

Someone types `@` and then keeps typing. We ask for matches and show a list.

For each suggestion we need enough to **tell two similar things apart**, because
legal titles collide constantly:

- **What it is** — a case, a statute, a section of a statute, a note, a file.
- **Its title**, as it should be displayed.
- **One line of context**, whatever makes it unambiguous for that kind. A
  citation for a case. The country and year for a statute. Its parent statute
  for a section. The folder or the channel for a file.
- **Something stable to insert**, which we store and send back.

Two constraints on the search itself:

- **It must only return things this person is allowed to open.** We will not
  filter on our side, and we should not have to.
- **We would like to bias towards this channel and this space.** Arthur's actual
  case was a file somebody uploaded *in the room he was standing in*. If the
  files of the current channel rank first, the feature works on the first try.

## 2. Sending it

Whatever we insert has to survive the round trip and come back on the message.

## 3. Reading it back — what a message must carry

When we render a message that mentions content, we need to draw the reference
**without a second request per mention.** A feed of fifty messages must not
become fifty lookups.

Per reference, on the message:

- What kind of thing it is.
- Its title **as it is now**, not as it was when it was mentioned.
- An address we can link to.
- Its id.

## 4. When it goes wrong

These are not edge cases; they are next month.

- **It was renamed.** Show the current name. That is why the title should travel
  with the message rather than being frozen into the text.
- **It was deleted.** Tell us. We will draw it as removed rather than as a link
  that 404s.
- **This reader cannot open it.** Tell us that too, and separately from deleted.
  A member who joined later, or someone outside the space a file belongs to, must
  see that a document exists and that it is not theirs to open — not a broken
  link, and not silence.

We already handle exactly this shape elsewhere: a quiz whose channel was deleted
carries `channel_deleted`, and the reader gets an honest state instead of a dead
tap.

## 5. The half that matters most

**When a message mentions content and Lawexa is summoned in the same message,
Lawexa should have the content.**

That is the whole of Arthur's ask. "I didn't want to reupload it to reference
it" is not about links — it is about being able to say *"@lawexa summarise
@Land Use Act section 28"* and have it work.

We do not need this in the first version, and we would rather have the picker
early than wait. But if the shape you choose now makes this impossible later, it
is worth an extra day now.

---

## What we are not asking for

- Not mentioning content in a **direct message** — those do not exist yet.
- Not mentioning **people's private notes**. Only what the reader can already
  reach.
- Not a new kind of search UI. The person picker already exists
  (`v2/features/channels/composer/`); this is the same control with more kinds of
  row in it.

## What we will build once it exists

A row in the mention list per kind, with an icon and its one line of context. An
inline chip in the message that opens the thing. Removed and no-access states.
Roughly a day and a half on our side, once the shape is settled.

## Open question back to you

`@` is one key doing two jobs — people and content. The alternative is a second
key (`#`, say) for content, which is what Slack does and what Notion does not.

**We think one key is right**, because a person naming a case does not want to
remember which key it lives under, and the list can group by kind. But it means
the list can get long, so grouping and ranking matter more than they do today.
Say if you disagree — it changes what search has to return, and it is cheaper to
disagree now.
