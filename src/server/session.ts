/**
 * Session id mint + resume for freebuff.
 *
 * Freebuff supports `--continue <sessionId>` to resume a prior session.
 * We persist the id in `runtime.sessionParams.sessionId` so Paperclip's
 * runtime carries it across runs of the same agent.
 */

import { randomUUID } from "node:crypto";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";

const SESSION_KEY = "sessionId";

export function readSessionId(ctx: AdapterExecutionContext): string | null {
  const sp = ctx.runtime?.sessionParams as Record<string, unknown> | null;
  if (!sp) return null;
  const v = sp[SESSION_KEY];
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function writeSessionId(
  ctx: AdapterExecutionContext,
  sessionId: string,
): void {
  const sp = (ctx.runtime?.sessionParams ?? {}) as Record<string, unknown>;
  sp[SESSION_KEY] = sessionId;
  if (ctx.runtime) ctx.runtime.sessionParams = sp as never;
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
