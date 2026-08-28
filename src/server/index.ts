/**
 * freebuff adapter — server barrel.
 *
 * Exports the ServerAdapterModule shape that Paperclip's registry expects.
 */

import { ADAPTER_TYPE, FREEBUFF_KNOWN_MODELS, agentConfigurationDoc } from "../index.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";
import { sessionCodec } from "./session.js";
import type { ServerAdapterModule } from "@paperclipai/adapter-utils";

export function createServerAdapter(): ServerAdapterModule {
  return {
    type: ADAPTER_TYPE,
    execute,
    testEnvironment,
    sessionCodec,
    supportsLocalAgentJwt: true,
    models: [...FREEBUFF_KNOWN_MODELS],
    agentConfigurationDoc,
  };
}

// NOTE: do NOT eagerly export a pre-built instance here.
// Creating it at module-evaluation time would invoke `createServerAdapter()`,
// which reads `ADAPTER_TYPE` from `../index.js`. If the root re-exports
// from this file, the cycle would hit a TDZ on `ADAPTER_TYPE` and throw.
// The Paperclip install loader calls `createServerAdapter()` itself, so
// we only need to export the factory.

export { execute, testEnvironment, sessionCodec };
