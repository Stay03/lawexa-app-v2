import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // --- v2 import boundaries (phase-1 WP3) -----------------------------------
  // Keeps the v2 overhaul layer decoupled from v1. Uses `import/no-restricted-
  // paths` (from eslint-plugin-import, already registered + alias-resolving via
  // eslint-config-next). The two directions live in separate config objects
  // scoped to disjoint file sets, so neither overrides the other.

  // Forward boundary: v2 code may import `lib/api`, `types`, `lib/constants`,
  // and pure utils — but NOT v1 experience code, so v2 can't silently re-couple
  // to the surface it's replacing.
  {
    files: [
      "v2/**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}",
      "app/v2/**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}",
    ],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: ["./v2", "./app/v2"],
              from: "./components",
              // PERMANENT primitive-layer policy (phase-2 "medium pivot",
              // docs/v2-docs/phases/phase-2-design-language/plan.md): the shadcn
              // `components/ui/**` and prompt-kit `components/prompt-kit/**` are
              // library-derived shared primitives — NOT v1 feature code — so v2
              // builds on them directly and never forks them. Every OTHER
              // `components/**` path stays v1 feature code and remains blocked.
              except: ["ui", "prompt-kit"],
              message:
                "v2 must not import v1 feature components. Only components/ui and components/prompt-kit are allowed — they are the shared primitive layer (permanent policy, phase-2 medium pivot).",
            },
            {
              target: ["./v2", "./app/v2"],
              from: "./lib/hooks",
              message:
                "v2 must not import v1 hooks — build a v2 feature queries.ts / hook instead.",
            },
            {
              target: ["./v2", "./app/v2"],
              from: "./lib/stores",
              // `lib/stores/authStore` is the sanctioned v1→v2 token bridge
              // (read by session-sync). Extension required so the resolved
              // file path matches the exception exactly.
              except: ["authStore.ts"],
              message:
                "v2 must not import v1 stores (lib/stores/authStore is the only exception — the sanctioned token bridge).",
            },
            {
              target: ["./v2", "./app/v2"],
              from: "./lib/contexts",
              message:
                "v2 must not import v1 React contexts — use the v2 runtime/session DAL instead.",
            },
            {
              target: ["./v2", "./app/v2"],
              from: "./providers",
              message:
                "v2 must not import v1 providers — v2 mounts its own runtime providers.",
            },
            {
              target: ["./v2", "./app/v2"],
              from: "./lib/realtime",
              message:
                "v2 must not import the v1 Echo singleton — the v2 realtime spine (phase 5) owns sockets.",
            },
            {
              target: ["./v2", "./app/v2"],
              from: "./lib/firebase",
              message:
                "v2 must not import the v1 firebase wiring — v2 push lands with the phase-5 notification spine.",
            },
          ],
        },
      ],
    },
  },

  // Reverse boundary: v1 code (everything outside v2/app-v2, and proxy.ts which
  // legitimately wires the switch) may NOT reach into v2, except the two
  // sanctioned switch touchpoints. Scoped via `ignores` so the rule runs only
  // on v1 files, letting the zone target the whole tree.
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}"],
    ignores: ["v2/**", "app/v2/**", "proxy.ts"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: ".",
              from: "./v2",
              // `@/v2/cookie` (toggle surfaces like DeveloperSettings) and
              // `@/v2/routes.manifest` (proxy) are the only sanctioned crossings.
              except: ["cookie.ts", "routes.manifest.ts"],
              message:
                "v1 code must not import from v2 (only @/v2/cookie and @/v2/routes.manifest are sanctioned crossings).",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
