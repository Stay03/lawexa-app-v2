# Phase 5: back goes back

## What was wrong

There is no `router.back()` anywhere in v2 and no history stack of its own.
Every back affordance is a `<Link>` to a computed parent, which always PUSHES.
Sixteen controls do this. So a reader who opens a channel from the space lobby
and presses the chevron ends up with [lobby, channel, lobby], and the phone's own
Back button then takes them into the channel they just left.

The link is not a mistake. A reader can land in a thread from a notification with
nothing behind them, and `back()` there would take them out of the app. That
trade is documented in the code and it is the right one. The bug is that the
trade is taken every time, including when history really is where the link
points.

Separately: `HomeQuickJump` used plain anchors for Cases, Statutes, Notes and
Quiz, so the four most travelled links on the mobile home screen each tore the
whole app down and rebooted it. The reason written in its docblock was true when
written and stopped being true when those four screens migrated to v2.

## What we build

`useBackTo(parentHref)` returns `{href, onClick}` to spread onto the **existing
Link**. The href never changes. A plain left click takes a history move instead,
but only when the screen immediately behind really is that parent.

**It writes nothing to history, and that is the design.** Two systems already
write history state here: the overlay stamp, so closing a panel pops exactly its
own entry, and scroll memory, so Back restores the reader's place. Both are
documented as fragile. A write that does not spread the existing state erases the
other's stamp; a write issued while a navigation is being processed cancels that
navigation, which would leave a panel that can never close. So instead of a
stamped stack, this reads the Navigation API: `navigation.entries()` and
`currentEntry.index` say exactly what Back would land on. Nothing to clobber.

Support is Baseline as of January 2026 (Chrome and Edge since 2022, Safari 26.2,
Firefox 147). Where it is missing, a short in-memory trail of where this tab has
been answers advisorily, and anything short of certain leaves the control a plain
link that pushes, which is today's behaviour.

The href stays real, so middle click, long press, "open in new tab", a crawler
and a screen reader all keep the destination.

## Scope

Applied to the nine screen back controls. Deliberately **not** applied to the
"Back to X" links inside empty and error states: those are most often reached
cold, where a link is already correct.

Deliberately deferred: the create affordance and a floating action button.
Every create dialog is already URL state that Back closes, and the targets change
when creates become routed screens, so building it now means building it twice.
It belongs to the modals-to-screens phase.
