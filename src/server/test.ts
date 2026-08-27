/**
 * freebuff adapter — environment diagnostics.
 *
 * Called by Paperclip's Hire Agent form when the user clicks "Test Environment".
 * Returns whether the freebuff CLI is installed, on PATH, and authenticated.
 *
 * Authentication probe: freebuff 0.0.15x has no `whoami` subcommand (it errors
 * with "Allowed choices are login"), so we read the manicode config files that
 * `freebuff login` writes:
 *   - ~/.config/manicode/credentials.json   -> non-empty `default.authToken`
 *   - ~/.config/manicode/freebuff-instance-owner.json -> file present
 * If those exist and the authToken is non-empty, the host is authenticated.
 * We also still shell out to `<command> login --help` as a fallback that proves
 * the CLI is runnable and acknowledges the `login` subcommand.
 */

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type {
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
  AdapterEnvironmentCheck,
} from "@paperclipai/adapter-utils";

import { ADAPTER_TYPE, FREEBUFF_DEFAULT_COMMAND } from "../index.js";

const execFileAsync = promisify(execFile);

const MANICODE_DIR = join(homedir(), ".config", "manicode");
const CREDENTIALS_PATH = join(MANICODE_DIR, "credentials.json");
const INSTANCE_OWNER_PATH = join(MANICODE_DIR, "freebuff-instance-owner.json");

function readAuthToken(): string | null {
  try {
    if (!existsSync(CREDENTIALS_PATH)) return null;
    const raw = readFileSync(CREDENTIALS_PATH, "utf8");
    const parsed = JSON.parse(raw) as {
      default?: { authToken?: unknown };
    };
    const token = parsed?.default?.authToken;
    return typeof token === "string" && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

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

async function checkAuthenticated(
  command: string,
): Promise<AdapterEnvironmentCheck> {
  // Primary: read the manicode credentials file that `freebuff login` writes.
  const token = readAuthToken();
  const instanceFilePresent = existsSync(INSTANCE_OWNER_PATH);
  if (token && instanceFilePresent) {
    return {
      level: "info",
      code: "freebuff_authenticated",
      message: "freebuff is authenticated",
      detail: `manicode credentials present at ${CREDENTIALS_PATH}`,
    };
  }

  // Fallback: shell out to `freebuff login --help` to confirm the CLI is
  // runnable and exposes the `login` subcommand. We do NOT call `whoami`
  // because freebuff 0.0.15x rejects it ("Allowed choices are login").
  try {
    await execFileAsync(command, ["login", "--help"], { timeout: 10_000 });
  } catch {
    return {
      level: "error",
      code: "freebuff_not_authenticated",
      message: "freebuff is not authenticated",
      hint: `Run \`${command} login\` on the host to authenticate. ` +
        `Expected files: ${CREDENTIALS_PATH} and ${INSTANCE_OWNER_PATH}`,
    };
  }

  if (!token) {
    return {
      level: "error",
      code: "freebuff_not_authenticated",
      message: "freebuff is not authenticated",
      detail: `Missing or empty ${CREDENTIALS_PATH} (default.authToken)`,
      hint: `Run \`${command} login\` on the host to authenticate`,
    };
  }
  return {
    level: "error",
    code: "freebuff_not_authenticated",
    message: "freebuff is not authenticated",
    detail: `Found auth token in ${CREDENTIALS_PATH} but ${INSTANCE_OWNER_PATH} is missing`,
    hint: `Run \`${command} login\` on the host to complete first-time setup`,
  };
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
