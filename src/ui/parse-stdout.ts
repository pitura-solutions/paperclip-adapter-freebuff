/**
 * UI side: parses freebuff's stream-json stdout into a renderable
 * transcript array that the Paperclip UI knows how to display.
 */

import { parseFreebuffLine, type FreebuffEvent } from "../server/parse-freebuff.js";

export interface UiTranscriptEntry {
  kind: "init" | "assistant" | "tool_call" | "tool_result" | "result" | "ad_dropped" | "unknown";
  text?: string;
  name?: string;
  args?: unknown;
  output?: string;
  summary?: string;
  exitCode?: number;
  raw?: string;
}

export function parseStdout(
  raw: string,
  opts: { stripAds?: boolean } = {},
): UiTranscriptEntry[] {
  const stripAds = opts.stripAds !== false;
  const out: UiTranscriptEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue;
    const ev = parseFreebuffLine(line, { stripAds }) as FreebuffEvent;
    switch (ev.kind) {
      case "init":
        out.push({ kind: "init", text: `session=${ev.sessionId} model=${ev.model}` });
        break;
      case "assistant":
        if (ev.text) out.push({ kind: "assistant", text: ev.text });
        break;
      case "tool_call":
        out.push({ kind: "tool_call", name: ev.name, args: ev.args });
        break;
      case "tool_result":
        out.push({ kind: "tool_result", name: ev.name, output: ev.output });
        break;
      case "result":
        out.push({ kind: "result", summary: ev.summary, exitCode: ev.exitCode });
        break;
      case "ad_dropped":
        if (!stripAds) out.push({ kind: "ad_dropped", raw: ev.raw });
        break;
      case "unknown":
        out.push({ kind: "unknown", raw: ev.raw });
        break;
    }
  }
  return out;
}
