// Live execute() round-trip with the corrected defaults.
// Spawns the real freebuff binary (with the new default empty args)
// to confirm we no longer hit "unknown option --print" and to log what
// actually happens (the binary is TUI-only, so we expect either a hang
// or a non-zero exit that is NOT an argument parse error).

import { createServerAdapter } from "../dist/server/index.js";
import { spawn } from "node:child_process";

const adapter = createServerAdapter();

const ctx = {
  companyId: "test",
  agent: {
    id: "agent-live-test",
    companyId: "test",
    name: "live-test",
  },
  runId: "run-live-test",
  authToken: null,
  config: {
    command: "freebuff",
    timeoutSec: 8,
    graceSec: 2,
    stripAds: true,
    cwd: process.cwd(),
  },
  context: {
    taskTitle: "Reply with exactly: PONG",
    taskBody: "Reply with exactly: PONG",
  },
  runtime: {
    sessionParams: null,
  },
  onLog: async (stream, chunk) => {
    process.stdout.write(`[${stream}] ${chunk}`);
  },
  onMeta: async (meta) => {
    console.log("--- meta ---");
    console.log(JSON.stringify(meta, null, 2));
  },
};

const t0 = Date.now();
let spawnProc = null;
ctx.onSpawn = (p) => { spawnProc = p; return Promise.resolve(); };

const result = await adapter.execute(ctx);
const elapsed = Date.now() - t0;

console.log("\n--- result ---");
console.log(JSON.stringify(result, null, 2));
console.log(`\nElapsed: ${elapsed}ms`);
if (spawnProc) {
  console.log(`PID: ${spawnProc.pid}, killed: ${spawnProc.killed}, signalCode: ${spawnProc.signalCode}`);
}
