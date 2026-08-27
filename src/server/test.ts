/**
 * freebuff adapter — environment diagnostics.
 *
 * Called by Paperclip's Hire Agent form when the user clicks "Test Environment".
 * Returns whether the freebuff CLI is installed, on PATH, and authenticated.
 */

import { spawn } from "node:child_process";
import { ADAPTER_TYPE, ADAPTER_VERSION, FREEBUFF_DEFAULT_COMMAND } from "../index.js";

interface Diagnostics {
  ok: boolean;
  version?: string;
  authenticated?: boolean;
  models?: string[];
  errors: string[];
  hints: string[];
}

function run(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("error", (err) => resolve({ code: 127, stdout, stderr: stderr + `\n${err.message}` }));
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

export async function testEnvironment(
  config: { command?: string } = {},
): Promise<Diagnostics> {
  const out: Diagnostics = { ok: false, errors: [], hints: [] };
  const command = config.command ?? FREEBUFF_DEFAULT_COMMAND;

  const which = await run("which", [command]);
  if (which.code !== 0) {
    out.errors.push(`freebuff binary not found on PATH (looked for "${command}")`);
    out.hints.push("Install with: npm install -g freebuff");
    return out;
  }

  const version = await run(command, ["--version"]);
  if (version.code === 0) {
    out.version = version.stdout.trim() || version.stderr.trim();
  } else {
    out.errors.push(`freebuff --version failed: ${version.stderr.trim()}`);
    return out;
  }

  const whoami = await run(command, ["whoami"]);
  if (whoami.code === 0) {
    out.authenticated = true;
  } else {
    out.authenticated = false;
    out.errors.push("freebuff not authenticated");
    out.hints.push("Run `freebuff login` on the host to authenticate");
  }

  const models = await run(command, ["models", "--json"]);
  if (models.code === 0) {
    try {
      const parsed = JSON.parse(models.stdout) as unknown;
      if (Array.isArray(parsed)) {
        out.models = parsed.filter((m): m is string => typeof m === "string");
      } else if (parsed && typeof parsed === "object" && "models" in parsed) {
        const m = (parsed as { models: unknown }).models;
        if (Array.isArray(m)) out.models = m.filter((x): x is string => typeof x === "string");
      }
    } catch {
      // freebuff may not support --json; leave models undefined
    }
  }

  out.ok = out.authenticated === true && out.errors.length === 0;
  return out;
}

export const adapterType = ADAPTER_TYPE;
export const adapterVersion = ADAPTER_VERSION;
