/**
 * UI side: maps the Hire Agent form values into the adapterConfig JSON blob
 * that gets stored on the agent.
 */

import { ADAPTER_TYPE } from "../index.js";

export interface FreebuffFormValues {
  command?: string;
  model?: string;
  timeoutSec?: number;
  stripAds?: boolean;
  extraEnv?: Array<{ key: string; value: string }>;
}

export function buildConfig(values: FreebuffFormValues): {
  adapterType: typeof ADAPTER_TYPE;
  adapterConfig: Record<string, unknown>;
} {
  const cfg: Record<string, unknown> = {
    command: values.command?.trim() || "freebuff",
    model: values.model?.trim() || "auto",
    stripAds: values.stripAds !== false,
  };
  if (values.timeoutSec && values.timeoutSec > 0) cfg.timeoutSec = values.timeoutSec;
  const env: Record<string, string> = {};
  for (const { key, value } of values.extraEnv ?? []) {
    if (key && value) env[key] = value;
  }
  if (Object.keys(env).length > 0) cfg.env = env;
  return { adapterType: ADAPTER_TYPE, adapterConfig: cfg };
}
