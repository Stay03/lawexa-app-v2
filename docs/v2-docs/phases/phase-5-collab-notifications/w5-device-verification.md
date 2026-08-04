# W5 — Test Spaces and notifications on real phones

This test closes phase 5. Do the test on real phones. Do not use a simulator.

## 1. What you need

- An iPhone. Use the Safari browser. You will install Lawexa on the Home Screen
  during the test. Apple sends notifications only to an installed app.
- An Android phone. Use the Chrome browser.
- A computer with a browser. You need it for the "second account" steps.
- Two accounts: your account, and a second account. Both accounts must be in the
  same space and the same channel. Call them **A** (the phone) and **B** (the
  computer).
- The v2 switch must be on for account A (Settings → Developer).
- A quiet room. Some steps test a sound.

Do the full test one time on each phone.

## 2. How to report a problem

If a step fails, write down these five items:

1. The phone model.
2. The browser.
3. The step number.
4. What you expected.
5. What you saw.

Send me the list. I will repair the problems.

## 3. Install and turn on notifications

1. iPhone only, BEFORE you install: open Lawexa in a Safari tab. Open a channel
   you belong to. Make sure that a bar appears at the top of the channel. Make
   sure that it tells you to add Lawexa to the Home Screen. Make sure that it
   does NOT show an "Enable" button.
2. iPhone only: tap the Share button. Tap "Add to Home Screen". Open Lawexa from
   the Home Screen icon. Do the rest of the test in that window.
3. Open a channel you belong to. Make sure that a bar appears at the top with an
   "Enable" button.
4. Tap "Enable". Make sure that the phone asks for permission. Allow it. Make
   sure that the bar disappears with a smooth movement, not a jump.
5. Close the channel and open it again. Make sure that the bar does not come
   back.
6. Open a second channel. Tap the X on the bar instead of "Enable". Make sure
   that the bar closes smoothly and never returns on this phone.

## 4. When the person says no

Do this section on the Android phone. Do it before section 5.

7. Open the browser settings for the Lawexa site. Find "Notifications". Choose
   "Reset" or "Ask". Then close the settings.
8. Open Lawexa and open a channel. Tap "Enable" on the bar. This time choose
   "Block".
9. Make sure that the bar now says that notifications are blocked for this site,
   and that you can turn them on in your browser settings. Make sure that it
   shows no "Enable" button, because that button could not work.
10. Tap the X. Make sure that the bar closes and does not return.
11. Open the browser settings again and Allow notifications for the site. Reload
    Lawexa. Open a channel and tap "Enable", so that the rest of the test can
    run.

## 5. Live badges (keep the app open)

For these steps, account A is on the phone. Account B writes from the computer.

12. On the phone, open the channel list at `/channels`. From the computer, send a
    plain message to a channel that account A is NOT reading. Make sure that the
    row becomes bold within one second. Make sure that you do not have to
    refresh.
13. From the computer, send a message that says `@` and account A's name. Make
    sure that a gold number appears on the row within one second.
14. Open the Spaces page. Make sure that the space shows a dot for new messages
    and a number for mentions.
15. Look at the browser tab title. Make sure that it shows a number in brackets
    when you have mentions.
16. Open the channel that has the mentions. Read to the bottom. Make sure that
    the bold and the number both clear.
17. Do step 16 again on a second device signed in as account A, if you have one.
    Make sure that the badge clears there too, without a refresh.

## 6. Alerts, sound and pause

18. Tap the bell in the header. Tap the gear button beside it. Make sure that the
    panel changes to "Notification settings". Make sure that you see four
    switches: "Mention alerts", "Sound", "Push notifications" and "Pause alerts".
19. Make sure that you can still see and tap "View all notifications" at the
    bottom of the panel. Do this on the phone, where the screen is short.
20. Turn "Sound" on. Leave "Mention alerts" on. Tap the back arrow. Make sure
    that the notification list comes back. Close the panel.
21. Open a channel. From the computer, mention account A in a DIFFERENT channel.
    Make sure that a small message appears at the bottom of the screen. Make sure
    that you hear one short chime.
22. From the computer, send three more mentions in the same channel quickly. Make
    sure that you hear at most one more chime. Make sure that the alerts do not
    pile up into a stack.
23. Tap "Open" on the alert. Make sure that the channel opens. Make sure that the
    page moves to the mentioned message. Make sure that the message is
    highlighted for a moment.
24. Turn "Pause alerts" on. Make sure that the "Mention alerts" and "Sound" rows
    become faint and say "Paused". Make sure that you can still tap them.
25. From the computer, send another mention. Make sure that no message appears
    and no sound plays. Make sure that the badge number still goes up.
26. Turn "Pause alerts" off again.
27. Open a channel and stay in it. From the computer, mention account A in THAT
    SAME channel. Make sure that no alert appears and no sound plays. The message
    itself must appear in the conversation.
28. Open the channel menu (the ⋯ button). Set "Muted". From the computer, send a
    plain message to that channel. Make sure that nothing sounds, nothing pops
    up, and the row does NOT become bold.
29. From the computer, mention account A in the muted channel. Make sure that the
    gold mention number still appears. This must work. A mute must never hide a
    direct mention.
30. Set the channel back to "All messages".

## 7. Push notifications (close the app)

31. Turn "Sound" and "Mention alerts" back on. Close Lawexa completely. On
    Android, swipe it away. On iPhone, close the app from the app switcher.
32. From the computer, mention account A. Wait up to thirty seconds. Make sure
    that a notification appears on the phone.
33. Tap the notification. Make sure that Lawexa opens on the right channel. Make
    sure that the page moves to the mentioned message and highlights it.
34. Now put Lawexa in the background WITHOUT closing it (go to the Home Screen).
    From the computer, mention account A again. Make sure that a notification
    appears. Listen carefully: you must hear ONE sound, the phone's own
    notification sound. You must not hear a second chime from Lawexa.
35. Open the app again. An alert message about that mention MUST be waiting on
    the screen — it must not have disappeared while you were away. Make sure it
    has an X to close it, and that "Open" still goes to the message.
36. Now keep Lawexa OPEN and in front of you, on a case page. From the computer,
    mention account A. Make sure that NO system notification appears. Make sure
    that you get the in-app alert instead.
37. Open the bell, then the gear. Turn "Push notifications" OFF. Close the app.
    From the computer, mention account A. Wait one minute. Make sure that NO
    notification arrives.
38. Open the app. Open the bell, then the gear. Make sure that "Push
    notifications" is still OFF. It must not have turned itself back on.
39. Turn "Push notifications" ON again. Close and reopen the app. Make sure that
    the switch is still on.
40. Sign out on the phone. From the computer, mention account A again. Wait one
    minute. Make sure that NO notification arrives on the phone.

## 8. Touch and keyboard

41. Sign in again. Open a channel. Touch and hold one of your own messages. Make
    sure that a sheet opens with the actions. Make sure that you can edit and
    delete from it.
42. Touch and hold somebody else's message. Make sure that the sheet opens and
    that it does not offer to delete their message (unless you are an admin).
43. Tap each of these and make sure each is easy to hit with a finger: the tabs
    (Chat / Lists / Files), the pin and save buttons in the header, the ⋯ menu,
    the "Enable" and X on the notification bar, the send button.
44. On the computer, use only the keyboard. Press Tab from the top of a channel.
    Make sure that the focus ring is always visible. Make sure that the order is
    sensible: header, notification bar, tabs, conversation, message box.
45. On the computer, move to the tabs with Tab. Then use the Left and Right arrow
    keys. Make sure that the tab changes. Make sure that the web address changes
    too.
46. On the computer, open the bell with the keyboard. Reach the gear with Tab and
    press Enter. Make sure that you can reach all four switches with Tab and turn
    them with Space. Make sure that the back arrow returns you to the list.

## 9. The old web addresses

47. Open each of these addresses on the phone. Make sure that each one lands on
    the new Invitations page and that the address bar ends in `/invitations`:
    `/channel-invitations`, `/space-invitations`, `/organization-invitations`.
48. Open `/settings/organization`. Make sure that it lands on the new
    Organization page at `/organization`.
49. Open an old notification from the bell that points at one of those addresses.
    Make sure that it still works.

## 10. Dark mode and motion

50. Set the phone to dark mode. Do steps 3, 21 and 41 again. Make sure that you
    can read all the text.
51. Turn on "Reduce Motion" in the phone settings. Open a channel. Make sure that
    the notification bar and the alerts appear at once, without animation. Make
    sure that nothing is broken.

## 11. One thing to watch and report

52. Open `/channels`. If you have a muted channel, tell me whether it appears in
    this list. Both answers are acceptable. I need to know which one is true, so
    write down what you see. (The server decides this; our screen handles
    either.)

## 12. When the test is complete

Phase 5 is complete when:

- All the steps pass on the iPhone and on the Android phone.
- The testers run their team messages in v2 for one full working day.

Then tell me. I will write the phase-5 close-out and start the next phase.
