#!/usr/bin/env node
/**
 * freebuff adapter — CLI entry.
 *
 * Currently a placeholder for `paperclip run --adapter freebuff_local`; the
 * real work happens inside the Paperclip server runtime.
 */

import { ADAPTER_TYPE, ADAPTER_VERSION } from "../index.js";

const args = process.argv.slice(2);
const cmd = args[0];

switch (cmd) {
  case "--version":
  case "version":
    console.log(`${ADAPTER_TYPE} ${ADAPTER_VERSION}`);
    break;
  case "--help":
  case "help":
  default:
    console.log(`@paperclipai/adapter-freebuff ${ADAPTER_VERSION}`);
    console.log("");
    console.log("Spawns the freebuff CLI as a subprocess for Paperclip agents.");
    console.log("");
    console.log("Usage inside Paperclip: assign an issue to a freebuff_local agent.");
    console.log("Standalone:");
    console.log("  paperclip-adapter-freebuff version");
    console.log("  paperclip-adapter-freebuff test-env   # check freebuff on PATH + auth");
    break;
  case "test-env": {
    const { testEnvironment } = await import("../server/test.js");
    const diag = await testEnvironment({});
    console.log(JSON.stringify(diag, null, 2));
    process.exit(diag.ok ? 0 : 1);
  }
}
