/**
 * freebuff adapter — environment diagnostics.
 *
 * Called by Paperclip's Hire Agent form when the user clicks "Test Environment".
 * Returns whether the freebuff CLI is installed, on PATH, and authenticated.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
  AdapterEnvironmentCheck,
} from "@paperclipai/adapter-utils";

import { ADAPTER_TYPE, FREEBUFF_DEFAULT_COMMAND } from "../index.js";

const execFileAsync = promisify(execFile);

type FreebuffTestConfig = {
  command?: string;
  args?: string[];
};

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

async function checkCliInstalled(command: string): Promise<AdapterEnvironmentCheck | null> {
  try {
    await execFileAsync(command, ["--version"], { timeout: 10_000 });
    return null;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      return {
        level: "error",
        code: "freebuff_cli_not_found",
        message: `freebuff CLI "${command}" not found on PATH`,
        hint: "Install with: npm install -g freebuff",
      };
    }
    return null;
  }
}

async function checkCliVersion(command: string): Promise<AdapterEnvironmentCheck> {
  try {
    const { stdout } = await execFileAsync(command, ["--version"], {
      timeout: 10_000,
    });
    const version = stdout.trim();
    if (version) {
      return {
        level: "info",
        code: "freebuff_version",
        message: `freebuff version: ${version}`,
      };
    }
    return {
      level: "warn",
      code: "freebuff_version_unknown",
      message: "Could not determine freebuff version",
    };
  } catch {
    return {
      level: "warn",
      code: "freebuff_version_unknown",
      message: "Could not determine freebuff version",
    };
  }
}

async function checkAuthenticated(command: string): Promise<AdapterEnvironmentCheck> {
  try {
    await execFileAsync(command, ["whoami"], { timeout: 10_000 });
    return {
      level: "info",
      code: "freebuff_authenticated",
      message: "freebuff is authenticated",
    };
  } catch {
    return {
      level: "error",
      code: "freebuff_not_authenticated",
      message: "freebuff is not authenticated",
      hint: "Run `freebuff login` on the host to authenticate",
    };
  }
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const cfg = (ctx.config ?? {}) as FreebuffTestConfig;
  const command = asString(cfg.command, FREEBUFF_DEFAULT_COMMAND);
  const checks: AdapterEnvironmentCheck[] = [];
  const testedAt = new Date().toISOString();

  const installedError = await checkCliInstalled(command);
  if (installedError) {
    checks.push(installedError);
    return { adapterType: ADAPTER_TYPE, status: "fail", checks, testedAt };
  }

  checks.push(await checkCliVersion(command));
  checks.push(await checkAuthenticated(command));

  const status = checks.some((c) => c.level === "error")
    ? "fail"
    : checks.some((c) => c.level === "warn")
      ? "warn"
      : "pass";

  return { adapterType: ADAPTER_TYPE, status, checks, testedAt };
}
