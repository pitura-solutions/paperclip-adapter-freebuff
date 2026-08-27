# Registry Patches for paperclip-adapter-freebuff

Apply these diffs to your Paperclip checkout to register the `freebuff_local` adapter.

---

## 1. `server/src/adapters/registry.ts`

Add the import and the registry entry:

```diff
 import { openrouterAdapter } from "./openrouter/index.js";
+import { freebuffAdapter } from "./freebuff/index.js";
```

```diff
   [openrouterAdapter.type]: openrouterAdapter,
+  [freebuffAdapter.type]: freebuffAdapter,
```

The `freebuffAdapter` exports `supportsLocalAgentJwt: true` so it can mint short-lived Paperclip API tokens (matching the openrouter pattern).

---

## 2. `server/src/adapters/builtin-adapter-types.ts`

```diff
 export type BuiltinAdapterType =
   | "process"
   | "claude_local"
   | "codex_local"
   | "hermes_local"
   | "openrouter"
+  | "freebuff_local"
   | "remote_ssh"
   | "custom";
```

---

## 3. `ui/src/adapters/registry.ts`

```diff
 import { openrouterAdapter } from "./openrouter/index.js";
+import { freebuffAdapter } from "./freebuff/index.js";
```

```diff
   [openrouterAdapter.type]: openrouterAdapter,
+  [freebuffAdapter.type]: freebuffAdapter,
```

---

## 4. `ui/src/adapters/adapter-display-registry.ts`

```diff
   openrouter: {
     label: "OpenRouter",
     description: "300+ AI models via single API key",
     accentColor: "#8b5cf6",
   },
+  freebuff_local: {
+    label: "freebuff (free, ad-supported)",
+    description: "freebuff.com CLI — no API key needed, model-locked to freebuff pool",
+    accentColor: "#f97316",
+  },
```

---

## 5. (Optional) `server/src/adapters/builtin-adapter-types.ts` defaults

If your Paperclip version uses a defaults table for adapter-type metadata, add:

```diff
   openrouter: {
     supportsSkills: true,
     supportsLocalAgentJwt: true,
   },
+  freebuff_local: {
+    supportsSkills: false,
+    supportsLocalAgentJwt: true,
+  },
```

---

## After applying

```bash
cd /path/to/paperclip
pnpm install
pnpm -r build
pnpm dev
```

The `freebuff_local` adapter type will then appear in the Hire Agent form.
