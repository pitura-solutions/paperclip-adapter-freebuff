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
  "freebuff.com CLI — no API key needed, model-locked to the freebuff pool (Deepseek v4, MiMo 2.5 Pro, GLM 5.2, Minimax M3, Gemini 3.1 Flash Lite).";

export const FREEBUFF_DEFAULT_COMMAND = "freebuff";
export const FREEBUFF_DEFAULT_ARGS = [
  "--print",
  "--output-format",
  "stream-json",
] as const;

export const FREEBUFF_KNOWN_MODELS = [
  { id: "auto", label: "auto (freebuff picks)" },
  { id: "deepseek-v4", label: "Deepseek v4" },
  { id: "mimo-2.5-pro", label: "MiMo 2.5 Pro" },
  { id: "glm-5.2", label: "GLM 5.2" },
  { id: "MiniMax-M3", label: "MiniMax M3" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
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

Spawns the \`freebuff\` CLI as a subprocess. Freebuff handles its own auth, model
selection, and tool calls; this adapter just streams the result.

## Required host setup
- \`freebuff\` on PATH (install: \`npm i -g freebuff\`)
- \`freebuff login\` run at least once on the host

## Notes
- \`model\`: defaults to \`auto\`; set to a specific freebuff model id to pin it
- \`timeoutSec\`: 0 = no timeout (freebuff runs as long as it needs)
- \`stripAds\`: keep ON; freebuff injects promotional lines into stdout and they
  would otherwise pollute the Paperclip transcript
`;

export type { FreebuffConfig as AdapterConfig };
