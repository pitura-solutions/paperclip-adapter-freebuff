/**
 * CLI side: pretty-print a freebuff transcript event for `paperclipai run --watch`.
 */

import type { UiTranscriptEntry } from "../ui/parse-stdout.js";

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";

export function formatEvent(entry: UiTranscriptEntry): string {
  switch (entry.kind) {
    case "init":
      return `${DIM}▸ ${entry.text}${RESET}`;
    case "assistant":
      return `${entry.text ?? ""}`;
    case "tool_call":
      return `${CYAN}⚙ ${entry.name}${RESET} ${DIM}${JSON.stringify(entry.args).slice(0, 160)}${RESET}`;
    case "tool_result": {
      const preview = (entry.output ?? "").length > 200 ? (entry.output ?? "").slice(0, 200) + "…" : entry.output ?? "";
      return `${DIM}  ↳ ${preview}${RESET}`;
    }
    case "result":
      return `${GREEN}${BOLD}✓ ${entry.summary ?? "done"}${RESET} ${DIM}(exit ${entry.exitCode ?? 0})${RESET}`;
    case "ad_dropped":
      return `${YELLOW}${DIM}[ad dropped]${RESET}`;
    case "unknown":
      return `${MAGENTA}${DIM}? ${entry.raw?.slice(0, 200) ?? ""}${RESET}`;
  }
}
