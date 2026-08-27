/**
 * Env builder for the freebuff subprocess.
 *
 * Paperclip's adapter-utils gives us `buildPaperclipEnv(agent)` to inject the
 * standard PAPERCLIP_* vars; we layer freebuff-specific vars on top and
 * sanitize anything dangerous.
 */

import { buildPaperclipEnv } from "@paperclipai/adapter-utils/server-utils";
import type { FreebuffConfig } from "../index.js";

export function buildFreebuffEnv(
  agent: { id: string; companyId: string; name?: string | null },
  config: Pick<FreebuffConfig, "env" | "model">,
  paperclipRunId: string,
  paperclipApiKey: string | null,
): Record<string, string> {
  const env: Record<string, string> = {
    ...buildPaperclipEnv(agent),
    PAPERCLIP_RUN_ID: paperclipRunId,
    NO_COLOR: "1",
  };
  if (paperclipApiKey) {
    env.PAPERCLIP_API_KEY = paperclipApiKey;
  }
  if (config.model && config.model !== "auto") {
    env.FREEBUFF_MODEL = config.model;
  }
  for (const [k, v] of Object.entries(config.env ?? {})) {
    if (typeof v === "string" && !k.startsWith("PAPERCLIP_")) {
      env[k] = v;
    }
  }
  return env;
}
