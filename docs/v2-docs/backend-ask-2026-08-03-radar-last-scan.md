# Radar list ask — August 3, 2026

For the backend team. One small ask. It describes what we want. You choose
how to build it.

## Tell us how each radar's last scan ended, in the radar LIST

- The app now warns a user on a radar's own page when its newest scan
  failed or was skipped.
- We also want a small warning mark on that radar's row in the radar LIST,
  so a broken radar is visible without opening it.
- The list data today only carries WHEN the last scan ran
  (`last_scan_at`). It does not say how it ended.
- We want: each radar in the list also carries how its last scan ended
  (the same status words the scan objects already use).
- That is the whole ask.
