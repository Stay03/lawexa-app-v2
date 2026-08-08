import { execSync } from "node:child_process";
import type { NextConfig } from "next";

/**
 * Resolve a stable build identifier tied to the deployed commit.
 *
 * Order of precedence:
 *  1. `SOURCE_COMMIT` / `COOLIFY_GIT_COMMIT_SHA` — the commit SHA Coolify
 *     injects into the build (and runtime) environment.
 *  2. `git rev-parse HEAD` — for local and CI builds where those vars are unset
 *     but a checkout is available.
 *  3. `null` — let Next.js fall back to its own generated build id.
 *
 * This value feeds `deploymentId` (the `?dpl=` asset tag + skew-protection
 * header), which is what actually forces clients onto fresh assets after a
 * deploy. It is also wired into `generateBuildId`, but note Next pins `BUILD_ID`
 * to a constant sentinel whenever `deploymentId` is set and drives skew
 * protection off `deploymentId` instead — so `generateBuildId` only takes effect
 * as the fallback path when no SHA is resolvable (deploymentId omitted).
 * `NEXT_DEPLOYMENT_ID`, if set, overrides `deploymentId` inside Next itself.
 */
function resolveBuildId(): string | null {
  const fromEnv = process.env.SOURCE_COMMIT ?? process.env.COOLIFY_GIT_COMMIT_SHA;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  try {
    return execSync("git rev-parse HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

const buildId = resolveBuildId();

const nextConfig: NextConfig = {
  // Tie the deployment id to the deployed commit so version skew across a deploy
  // forces clients onto fresh assets (hard reload on stale chunk fetch). Omit
  // `deploymentId` when no SHA is resolvable; `generateBuildId` then supplies the
  // build id (and is otherwise bypassed while `deploymentId` is set).
  generateBuildId: () => buildId,
  ...(buildId ? { deploymentId: buildId } : {}),
  async redirects() {
    return [
      {
        source: '/statutes-v2/:slug',
        destination: '/statutes/:slug',
        permanent: true,
      },
      {
        // Typo alias: /ambassador (singular) -> /ambassadors
        source: '/ambassador',
        destination: '/ambassadors',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        // Serve the static ambassador landing page at the clean /ambassadors URL.
        source: '/ambassadors',
        destination: '/ambassadors/index.html',
      },
      {
        // The face-card maker an approved ambassador is sent to, at a clean URL
        // for the same reason as the line above: this address is printed in the
        // welcome email and read by people, so it must not end in `.html`.
        //
        // It lives in `public/` rather than the app tree ON PURPOSE. The page is
        // one self-contained file — its display font, its logo and its artwork
        // are all embedded, and it paints the card on a canvas — so routing it
        // through the app would buy nothing and cost it a React runtime.
        //
        // The backend reads this address from a setting
        // (`LAWEXA_AMBASSADOR_FACE_CARD_URL`), so moving it later costs a config
        // change and no deploy.
        source: '/ambassadors/face-card',
        destination: '/ambassadors/face-card/index.html',
      },
    ];
  },
};

export default nextConfig;
