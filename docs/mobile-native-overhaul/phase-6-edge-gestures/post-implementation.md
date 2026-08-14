# Phase 6: edge gestures, what shipped

Date: 14 August 2026.

## Measured

Filmed at 390x844 across ten screens, asking the RENDERED page rather than the
source, because a Tailwind class that does not compile is a class that is not
there and the source cannot tell you that.

| | |
|---|---|
| Sideways scrollers found on those ten screens | 21 |
| Contained | **21** |
| Exposed | 0 |

Two elements reported a sideways-scrolling overflow style and were checked by
hand rather than waved away: the two composer textareas. They wrap
(`white-space: pre-wrap`), and with four hundred characters typed in,
`scrollWidth` equals `clientWidth`. They cannot scroll sideways, so there is
nothing to contain.

## What changed

- `overscroll-x-contain` on 21 scrollers across 18 files: the notes formatting
  toolbar and the reaction tray first, since those two sit at the bezel, then
  the ten tab strips, the composer chip rows, the pasted-content strips, the
  folder-picker breadcrumb and the AI answer code blocks and tables.
- `overscroll-behavior-x: contain` in the two stylesheets that own wide tables:
  statute schedules and radar reports.
- `TabRow`'s docblock corrected. It still described the statute country row as
  an edge-bleed wrapper outside the tablist; that was superseded on 7 August.
- The case detail law-type tabs now scroll. They are data-driven and had no
  scroller at all, so a case carrying many law types overflowed its column with
  nothing on screen to say so. Found by the research, not by a report.

## The two wrapper switches

For whoever builds the Android and iOS shells. This is the whole of what makes
the device's own back gesture work properly inside the app.

**iOS, WKWebView.** After creating the web view, set
`webView.allowsBackForwardNavigationGestures = true`. The default is `false`,
which means no back-swipe at all. With it on, the system edge-swipe walks the
web view's own history, and because every overlay in v2 is exactly one history
entry, the swipe closes a sheet or a picture viewer exactly like the Back button
does.

**Android, WebView.** Add an `OnBackPressedCallback` to the Activity's
`onBackPressedDispatcher`; inside it call `webView.goBack()`. Keep the callback
enabled only while `webView.canGoBack()` is true, updating that in
`doUpdateVisitedHistory`, so that when the web history is empty the gesture
falls through and leaves the app. Set
`android:enableOnBackInvokedCallback="true"` in the manifest for the Android 13+
predictive-back animation. **If none of this is wired, the first back gesture
kills the app** with the whole web history still standing.

## What this does not do

It does not stop the system edge-swipe, anywhere, and it was never going to.
That gesture belongs to the OS and is claimed before the page sees it. What
keeps it honest is that every step in v2 is a real history entry, which phase 5
finished. This phase's work is about the browser's own overscroll navigation and
about scroll chaining, and nothing more.
