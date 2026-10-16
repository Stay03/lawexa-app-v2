import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";
import { PHASE_PRODUCTION_SERVER } from "next/constants";

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

/**
 * The deployment id the build used, read back by `next start`. `undefined`
 * when the build output cannot be read, `null` when the build had none.
 *
 * `next start` evaluates this file again, so without this the server resolves
 * its own id from the runtime environment. Production (Coolify, 3 October 2026)
 * builds with no commit SHA and runs with one: the build's files then name
 * every chunk without `?dpl=` and the server's tags name it with, and a first
 * visit downloaded 20 to 31 files twice (243 to 558 KB extra per page,
 * measured on live). Reusing the build's id keeps the two in step.
 */
function builtDeploymentId(): string | null | undefined {
  try {
    const files = JSON.parse(
      readFileSync(join(process.cwd(), ".next", "required-server-files.json"), "utf8"),
    );
    const id = files?.config?.deploymentId;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return undefined;
  }
}

function resolveDeploymentId(phase: string): string | null {
  if (phase === PHASE_PRODUCTION_SERVER) {
    const built = builtDeploymentId();
    if (built !== undefined) return built;
  }
  return resolveBuildId();
}

const nextConfig = (phase: string): NextConfig => {
  const buildId = resolveDeploymentId(phase);
  return {
    // Tie the deployment id to the deployed commit so version skew across a deploy
    // forces clients onto fresh assets (hard reload on stale chunk fetch). Omit
    // `deploymentId` when no SHA is resolvable; `generateBuildId` then supplies the
    // build id (and is otherwise bypassed while `deploymentId` is set).
    generateBuildId: () => buildId,
    ...(buildId ? { deploymentId: buildId } : {}),
    experimental: {
      // How long a prefetched route shell (layout and loading state) stays usable
      // in the browser. Next's default is 300 s; past it, a tap on a kept tab
      // waits for the server to send the shell again before the address changes
      // (374 to 652 ms at CPU x4, traced on live 7 October 2026). 1800 s matches
      // the conversation page's `unstable_dynamicStaleTime`, so the shell lasts
      // as long as the data it frames.
      staleTimes: { static: 1800 },
    },
    async redirects() {
      return [
        {
          source: '/statutes-v2/:slug',
          destination: '/statutes/:slug',
          permanent: true,
        },
        {
          // Other spellings of a statute section's address go to it (Stay, 16
          // October 2026: Lawexa's link `/statutes/criminal-code-act-1916/
          // sec-49` opened the statute at the top; the reader's address is
          // `section-49`, `v2/features/statutes/reader/provision.ts`). Here and
          // not in the route: the route streams behind its `loading.tsx`, so a
          // redirect there arrives as a 200 with a meta refresh; this one is a
          // real 308, before any render, which a link preview follows too.
          source:
            '/statutes/:slug/:spelling(sec|s|art|article)-:num(\\d+[a-zA-Z]*(?:-\\d+[a-zA-Z]*)?)',
          destination: '/statutes/:slug/section-:num',
          permanent: true,
        },
        {
          // The plans live at /pricing. v1's /upgrade page only redirects
          // there, and a v2 in-app link to it crossed into v1 mid-navigation
          // and landed on v2's error screen (Arthur, 16 October 2026). This
          // 308 runs before any render, so an /upgrade link in an e-mail, a
          // push notification or a bookmark lands on the plans in either app.
          source: '/upgrade',
          destination: '/pricing',
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
};

export default nextConfig;
