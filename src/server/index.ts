/**
 * freebuff adapter — server barrel.
 *
 * Exports the ServerAdapterModule shape that Paperclip's registry expects.
 */

import { ADAPTER_TYPE, ADAPTER_VERSION, FREEBUFF_KNOWN_MODELS, agentConfigurationDoc } from "../index.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";
import type { ServerAdapterModule } from "@paperclipai/adapter-utils";

export function createServerAdapter(): ServerAdapterModule {
  return {
    type: ADAPTER_TYPE,
    version: ADAPTER_VERSION,
    execute,
    testEnvironment,
    supportsLocalAgentJwt: true,
    supportsSkills: false,
    models: [...FREEBUFF_KNOWN_MODELS],
    agentConfigurationDoc,
  };
}

export const freebuffAdapter = createServerAdapter();
export { execute, testEnvironment };
