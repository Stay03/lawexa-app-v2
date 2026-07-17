# Ops runbook: Coolify deploy fails with `ENOSPC: no space left on device`

First occurrence: July 17, 2026 (commit eb49024, wave-3 deploy). Diagnosis: the Coolify host's
Docker partition (`/var/lib/docker`) filled up — build cache + old images + cache mounts across
~130 deployments. NOT a repo problem (build context was 19.67MB; same commit builds green
locally). Coolify keeps the previous container running on a failed build, so prod stays safe.
The `$NIXPACKS_PATH UndefinedVar` warning in build logs is harmless Nixpacks template noise.

## Fix, safest-first (SSH as root/docker user)

1. **Assess (read-only):**
   ```bash
   df -h              # the mount holding /var/lib/docker near 100% confirms it
   docker system df   # RECLAIMABLE column = your headroom (Build Cache + Images usually huge)
   ```
2. **Coolify built-in cleanup first:** UI → Servers → (server) → **Cleanup Storage** action
   (newer builds: Configuration → Advanced / Docker Cleanup tab). Only touches
   Coolify-managed resources; won't run mid-deploy. Re-check `df -h`; if several GB freed, skip
   to Redeploy.
3. **Manual prunes (safe on a live host):**
   ```bash
   docker builder prune --keep-storage 5g   # biggest safe win (includes the npm cache mount)
   # or: docker builder prune -af           # clears ALL build cache; next build just slower
   docker system prune                      # stopped containers, unused networks, dangling images
   docker image prune -a                    # any image not backing a RUNNING container
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
