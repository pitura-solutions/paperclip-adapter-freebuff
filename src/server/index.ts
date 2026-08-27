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

export const freebuffAdapter = createServerAdapter();
export { execute, testEnvironment, sessionCodec };
