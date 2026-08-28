/**
 * Root metadata for the freebuff Paperclip adapter.
 *
 * Exposed as both a Node entrypoint and the source the Paperclip UI reads
 * when rendering the Hire Agent form for adapter type `freebuff_local`.
 */

export const ADAPTER_TYPE = "freebuff_local" as const;
export const ADAPTER_VERSION = "0.1.0";
export const ADAPTER_DISPLAY_NAME = "freebuff (free, ad-supported)";
export const ADAPTER_DESCRIPTION =
  "freebuff.com CLI — no API key needed. Currently the only known model is MiMo 2.5 Pro.";

export const FREEBUFF_DEFAULT_COMMAND = "freebuff";

// As of freebuff 0.0.157 (latest published), the only flags the CLI accepts
// are --version, --help, --continue [id], and --cwd <dir>. There is no
// --print / --output-format / --model. Defaulting to those nonexistent
// flags caused `error: unknown option '--print'` and a non-zero exit. Keep
// the default empty so the operator's `config.args` controls invocation.
export const FREEBUFF_DEFAULT_ARGS: readonly string[] = [];

// Per the operator: as of this build, the only model freebuff is known to
// expose is MiMo 2.5 Pro. Add more here as freebuff advertises new ones.
export const FREEBUFF_KNOWN_MODELS = [
  { id: "mimo-2.5-pro", label: "MiMo 2.5 Pro" },
] as const;

export type FreebuffModelId = (typeof FREEBUFF_KNOWN_MODELS)[number]["id"];

export const FREEBUFF_AD_LINE_PATTERNS: RegExp[] = [
  /^={3,}\s*$/,
  /freebuff\s+(pro|premium|plus)/i,
  /upgrade to (pro|premium|plus)/i,
  /\bsponsored\b/i,
  /\bads?\s+by\b/i,
  /^\s*\[ad\]/i,
  /sign up for freebuff/i,
];

export interface FreebuffConfig {
  command?: string;
  args?: string[];
  cwd?: string;
  model?: string;
  timeoutSec?: number;
  graceSec?: number;
  env?: Record<string, string>;
  stripAds?: boolean;
  promptTemplate?: string;
}

export const agentConfigurationDoc = `
# freebuff adapter — agent configuration

Spawns the \`freebuff\` CLI as a subprocess. Freebuff handles its own auth,
model selection, and tool calls; this adapter just streams the result.

## Required host setup
- \`freebuff\` on PATH (install: \`npm i -g freebuff\`)
- \`freebuff login\` run at least once on the host

## Freebuff CLI surface (verified against 0.0.157)
The binary exposes ONLY: \`--version\`, \`--help\`, \`--continue [id]\`,
\`--cwd <dir>\`, and the \`login\` subcommand. It is a Bun-compiled TUI
with no non-interactive / pipe-friendly mode. The adapter therefore
CANNOT drive freebuff end-to-end from a non-TTY spawn today. It loads,
the env test passes, and the parser is ready for the day freebuff ships
a \`--print\` or \`--output-format\` flag.

## Config keys
- \`command\`: defaults to \`freebuff\`
- \`args\`: defaults to \`[]\`. Set to e.g. \`["--continue", "<id>"]\` to
  resume, or pass your own flag set if a newer freebuff supports one.
- \`cwd\`: defaults to the host's current working directory
- \`model\`: read-only label stored in the result; the binary itself has
  no \`--model\` flag (TUI picker only)
- \`timeoutSec\`: 0 = no timeout (freebuff runs as long as it needs)
- \`graceSec\`: seconds to wait after SIGTERM before SIGKILL (default 15)
- \`stripAds\`: keep ON; freebuff injects promotional lines and they
  would otherwise pollute the Paperclip transcript
- \`promptTemplate\`: optional override for the prompt prefix
`;

export type { FreebuffConfig as AdapterConfig };

// Required by Paperclip's external adapter loader:
// the package root must re-export `createServerAdapter` so
// `/api/adapters/install` can resolve it from `main`.
//
// We re-export ONLY the factory (no pre-built instance) to avoid the
// ESM TDZ: invoking `createServerAdapter()` during module evaluation
// here would close the import cycle with `./server/index.js` and
// read `ADAPTER_TYPE` before its `const` binding is initialised,
// throwing "Cannot access 'ADAPTER_TYPE' before initialization".
export { createServerAdapter } from "./server/index.js";
