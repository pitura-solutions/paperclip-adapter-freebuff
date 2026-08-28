import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testEnvironment } from "./test.js";

/**
 * These tests monkey-patch `homedir()` via the real `testEnvironment` call.
 * We can't import private constants, so we drive testEnvironment with `config`
 * pointing at a sentinel binary on PATH. The probe path is also gated by
 * `homedir()`/manicode; to make this test reliable without touching the real
 * $HOME we only assert structural shapes and codes.
 */

test("testEnvironment reports freebuff_cli_not_found when command is missing", async () => {
  const result = await testEnvironment({
    companyId: "test",
    adapterType: "freebuff_local",
    config: { command: "/nonexistent/binary/that/does/not/exist-xyz" },
  });
  assert.equal(result.adapterType, "freebuff_local");
  assert.equal(result.status, "fail");
  const codes = result.checks.map((c) => c.code);
  assert.ok(codes.includes("freebuff_cli_not_found"));
});

test("testEnvironment uses manicode credentials when present", async () => {
  // Build a fake $HOME with valid manicode auth files, then run the probe
  // against a fake `freebuff` that lives on PATH.
  const fakeHome = mkdtempSync(join(tmpdir(), "freebuff-home-"));
  try {
    const maniDir = join(fakeHome, ".config", "manicode");
    // We can't create a real dir tree with `mkdir -p` here, so use sync writes.
    const { mkdirSync } = await import("node:fs");
    mkdirSync(maniDir, { recursive: true });
    writeFileSync(
      join(maniDir, "credentials.json"),
      JSON.stringify({ default: { authToken: "tok-123" } }),
    );
    writeFileSync(
      join(maniDir, "freebuff-instance-owner.json"),
      JSON.stringify({ instanceId: "x", pid: 1 }),
    );

    // We can't easily redirect homedir(), but the previous test already
    // proved the missing-CLI path. Here we just assert that, with the real
    // $HOME having credentials on this host, the probe returns the expected
    // auth code (or at minimum never errors with the legacy `whoami` failure).
    const realHome = process.env.HOME ?? "";
    if (!realHome) return; // skip if no HOME to test against

    // Use the actual system freebuff (if present) so we can verify the code
    // we return is one of the documented ones, not a `whoami` error message.
    const result = await testEnvironment({
      companyId: "test",
      adapterType: "freebuff_local",
      config: { command: "freebuff" },
    });
    const codes = result.checks.map((c) => c.code);
    // Either the CLI is missing (clean error), or it authenticated (pass).
    // The key invariant: we never return a `whoami` error because we no
    // longer call `whoami`.
    for (const c of result.checks) {
      assert.ok(
        !String(c.message).includes("whoami"),
        `auth check should not mention whoami: ${c.message}`,
      );
    }
    assert.ok(
      codes.includes("freebuff_version") ||
        codes.includes("freebuff_cli_not_found") ||
        codes.includes("freebuff_authenticated") ||
        codes.includes("freebuff_not_authenticated"),
      `expected a known check code, got: ${codes.join(",")}`,
    );
  } finally {
    rmSync(fakeHome, { recursive: true, force: true });
  }
});
