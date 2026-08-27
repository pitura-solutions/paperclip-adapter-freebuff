/**
 * Classifies a freebuff stdout line and returns a normalized event.
 *
 * Freebuff stream-json shape (from the freebuff CLI docs):
 *   {"type":"init","session_id":"…","model":"…"}
 *   {"type":"assistant","text":"…"}
 *   {"type":"tool_call","name":"…","args":{…}}
 *   {"type":"tool_result","name":"…","output":"…"}
 *   {"type":"result","summary":"…","exit_code":0}
 *
 * Anything else (banner text, ad copy, prompts) is matched against
 * FREEBUFF_AD_LINE_PATTERNS and dropped when `stripAds` is true.
 */

import {
  FREEBUFF_AD_LINE_PATTERNS,
  type FreebuffConfig,
} from "../index.js";

export type FreebuffEvent =
  | { kind: "init"; sessionId: string; model: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool_call"; name: string; args: unknown }
  | { kind: "tool_result"; name: string; output: string }
  | { kind: "result"; summary: string; exitCode: number }
  | { kind: "ad_dropped"; raw: string }
  | { kind: "unknown"; raw: string };

export function parseFreebuffLine(
  line: string,
  config: Pick<FreebuffConfig, "stripAds">,
): FreebuffEvent {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "unknown", raw: line };

  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      switch (obj.type) {
        case "init":
          return {
            kind: "init",
            sessionId: typeof obj.session_id === "string" ? obj.session_id : "",
            model: typeof obj.model === "string" ? obj.model : "auto",
          };
        case "assistant":
          return {
            kind: "assistant",
            text: typeof obj.text === "string" ? obj.text : "",
          };
        case "tool_call":
          return {
            kind: "tool_call",
            name: typeof obj.name === "string" ? obj.name : "unknown",
            args: obj.args ?? {},
          };
        case "tool_result":
          return {
            kind: "tool_result",
            name: typeof obj.name === "string" ? obj.name : "unknown",
            output: typeof obj.output === "string" ? obj.output : "",
          };
        case "result":
          return {
            kind: "result",
            summary: typeof obj.summary === "string" ? obj.summary : "",
            exitCode: typeof obj.exit_code === "number" ? obj.exit_code : 0,
          };
        default:
          return { kind: "unknown", raw: line };
      }
    } catch {
      // not JSON, fall through to ad/unknown detection
    }
  }

  if (config.stripAds !== false && isAdLine(trimmed)) {
    return { kind: "ad_dropped", raw: line };
  }
  return { kind: "unknown", raw: line };
}

export function isAdLine(line: string): boolean {
  return FREEBUFF_AD_LINE_PATTERNS.some((re) => re.test(line));
}
