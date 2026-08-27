/**
 * Session codec + id mint + resume for freebuff.
 *
 * Freebuff supports `--continue <sessionId>` to resume a prior session.
 * The codec validates and normalizes the `sessionId` field stored in
 * `runtime.sessionParams`, and execute() reads/writes the same key.
 */

import { randomUUID } from "node:crypto";
import type { AdapterExecutionContext, AdapterSessionCodec } from "@paperclipai/adapter-utils";

const SESSION_KEY = "sessionId";

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export const sessionCodec: AdapterSessionCodec = {
  deserialize(raw) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    const id = readNonEmptyString(record.sessionId) ?? readNonEmptyString(record.session_id);
    return id ? { sessionId: id } : null;
  },
  serialize(params) {
    if (!params) return null;
    const id = readNonEmptyString(params.sessionId);
    return id ? { sessionId: id } : null;
  },
  getDisplayId(params) {
    if (!params) return null;
    return readNonEmptyString(params.sessionId);
  },
};

export function readSessionId(ctx: AdapterExecutionContext): string | null {
  const sp = (ctx.runtime?.sessionParams ?? null) as Record<string, unknown> | null;
  if (!sp) return null;
  return readNonEmptyString(sp[SESSION_KEY]);
}

export function writeSessionId(
  ctx: AdapterExecutionContext,
  sessionId: string,
): void {
  if (!ctx.runtime) return;
  const sp = (ctx.runtime.sessionParams ?? {}) as Record<string, unknown>;
  sp[SESSION_KEY] = sessionId;
  ctx.runtime.sessionParams = sp;
}

export function mintSessionId(): string {
  return randomUUID();
}

export function buildArgsWithSession(
  baseArgs: string[],
  sessionId: string | null,
  prompt: string,
): string[] {
  const args = [...baseArgs];
  if (sessionId) {
    args.push("--continue", sessionId);
  }
  args.push(prompt);
  return args;
}
