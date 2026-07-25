# Ops runbook: Coolify deploy fails with `ENOSPC: no space left on device`

First occurrence: July 17, 2026 (commit eb49024, wave-3 deploy). Diagnosis: the Coolify host's
Docker partition (`/var/lib/docker`) filled up — build cache + old images + cache mounts across
~130 deployments. NOT a repo problem (build context was 19.67MB; same commit builds green
locally). Coolify keeps the previous container running on a failed build, so prod stays safe.
The `$NIXPACKS_PATH UndefinedVar` warning in build logs is harmless Nixpacks template noise.

**Second occurrence: July 25, 2026 (commit bd132db).** Same signature, and it failed EARLIER in
the pipeline than the first one — inside `npm ci`, at step 7/11, before a single file was
compiled (`npm warn tar TAR_ENTRY_ERROR ENOSPC: no space left on device, write`). Failing during
dependency extraction rather than during `next build` means the host had less headroom this time,
not more. The prevention section below was NOT applied after the first occurrence; it is now the
main action, not an optional follow-up. Two failures a week apart on a host that keeps adding
build cache is a schedule, not an accident.

## Fix, safest-first (SSH as root/docker user)

1. **Assess (read-only):**
   ```bash
   df -h              # the mount holding /var/lib/docker near 100% confirms it
   docker system df   # RECLAIMABLE column — but see the warning below
   ```
   **`docker system df` UNDER-REPORTS THE BUILD CACHE, BADLY.** On July 25 it declared
   `Build Cache … 472.3MB`; `docker builder prune -af` then reclaimed **6.251GB** from that
   same cache — 13× more. It reports the cache *records* it can account for, not the cache
   *mounts* (`--mount=type=cache`, which is where the npm cache lives). So never conclude
   "the cache is small, the problem must be elsewhere" from this table. Run
   `docker system df -v` for the itemised view, or just prune the cache first — it is the
   zero-risk step regardless.

   Read the table for what it IS reliable about: **Local Volumes**. On July 25 those were
   29.66GB with `0B` reclaimable and every volume active — that is the database and uploads,
   and it is untouchable. Knowing that up front is what keeps a tired operator away from
   `--volumes`.
2. **Coolify built-in cleanup first:** UI → Servers → (server) → **Cleanup Storage** action
   (newer builds: Configuration → Advanced / Docker Cleanup tab). Only touches
   Coolify-managed resources; won't run mid-deploy. Re-check `df -h`; if several GB freed, skip
   to Redeploy.
3. **Manual prunes (safe on a live host).** This exact pair recovered **9.04GB** on July 25,
   from 493MB free, which was ample — the full image prune below was not needed:
   ```bash
   docker builder prune -af                      # July 25: 6.251GB. Zero risk — cache only.
   docker image prune -a --filter "until=72h"    # July 25: 2.788GB. KEEPS the last 3 days of
                                                 # images, so Coolify can still roll back.
   df -h                                         # stop here if you have a few GB
   ```
   Only if that is not enough:
   ```bash
   docker system prune    # stopped containers, unused networks, dangling images
   docker image prune -a  # EVERY unused image — you lose rollback to older builds
   ```
   **⚠️ NEVER blindly `docker system prune -a --volumes`** — `--volumes` deletes unattached
   volumes = permanent data loss if a DB/uploads live on this host. Check first:
   `docker volume ls` + `docker ps -a --format '{{.Names}}: {{.Mounts}}'`. When in doubt, leave
   volumes alone.
4. **If still tight — container logs:**
   ```bash
   du -sh /var/lib/docker/containers/*/*-json.log 2>/dev/null | sort -h | tail
   ```

## Never touch
Coolify's own containers/volumes (`coolify`, `coolify-db`, `coolify-redis`,
`coolify-realtime`, **`coolify-proxy`** — killing the proxy downs every app) and `/data`
(Coolify config/SSL).

## Prevention (do once)
UI → Servers → (server) → Configuration → Advanced (Docker Cleanup):
- Enable **Force Docker Cleanup** + **Frequency** cron (e.g. `0 3 * * *`) + **Threshold** ~80%.
- Leave "unused volumes" cleanup OFF unless certain; "unused networks" is safe.
- Log rotation in `/etc/docker/daemon.json`:
  `{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }`
  then `systemctl restart docker` in a maintenance window (restarts containers).
- Add a Coolify notification channel for disk warnings.

## After cleanup
`df -h` shows a few GB free (an `npm ci` + `next build` needs real headroom) → app →
**Redeploy** the failed commit. No code changes needed.

Sources: Coolify automated-cleanup docs, Coolify discussions #610/#3192, Docker prune docs.
