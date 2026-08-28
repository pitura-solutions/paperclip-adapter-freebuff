/**
 * freebuff adapter — main execute() entrypoint.
 *
 * Spawns the freebuff CLI as a subprocess, parses its stream-json stdout into
 * Paperclip transcript entries, persists the session id in runtime state, and
 * returns an AdapterExecutionResult.
 */

import { spawn } from "node:child_process";
import {
  asString,
  asNumber,
  asStringArray,
  asBoolean,
  parseObject,
  runChildProcess,
  resolveCommandForLogs,
  renderTemplate,
  renderPaperclipWakePrompt,
  selectPaperclipTaskMarkdown,
  joinPromptSections,
  stringifyPaperclipWakePayload,
  DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE,
} from "@paperclipai/adapter-utils/server-utils";
import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";

import {
  ADAPTER_TYPE,
  ADAPTER_VERSION,
  FREEBUFF_DEFAULT_COMMAND,
  FREEBUFF_DEFAULT_ARGS,
  type FreebuffConfig,
} from "../index.js";
import { parseFreebuffLine, type FreebuffEvent } from "./parse-freebuff.js";
import { buildFreebuffEnv } from "./freebuff-env.js";
import {
  buildArgsWithSession,
  mintSessionId,
  readSessionId,
  writeSessionId,
} from "./session.js";

interface TranscriptAccumulator {
  init?: { sessionId: string; model: string };
  assistantLines: string[];
  toolCalls: Array<{ name: string; args: unknown; result?: string }>;
  resultSummary?: string;
  resultExitCode?: number;
  adLinesDropped: number;
  unknownLines: string[];
}

function emptyAccumulator(): TranscriptAccumulator {
  return {
    assistantLines: [],
    toolCalls: [],
    adLinesDropped: 0,
    unknownLines: [],
  };
}

function accumulate(acc: TranscriptAccumulator, ev: FreebuffEvent): void {
  switch (ev.kind) {
    case "init":
      acc.init = { sessionId: ev.sessionId, model: ev.model };
      return;
    case "assistant":
      if (ev.text) acc.assistantLines.push(ev.text);
      return;
    case "tool_call": {
      const existing = acc.toolCalls.find(
        (t) => t.name === ev.name && JSON.stringify(t.args) === JSON.stringify(ev.args),
      );
      if (existing) return;
      acc.toolCalls.push({ name: ev.name, args: ev.args });
      return;
    }
    case "tool_result": {
      const last = [...acc.toolCalls]
        .reverse()
        .find((t) => t.name === ev.name && t.result === undefined);
      if (last) last.result = ev.output;
      return;
    }
    case "result":
      acc.resultSummary = ev.summary;
      acc.resultExitCode = ev.exitCode;
      return;
    case "ad_dropped":
      acc.adLinesDropped += 1;
      return;
    case "unknown":
      if (ev.raw.trim()) acc.unknownLines.push(ev.raw);
      return;
  }
}

function renderTranscript(acc: TranscriptAccumulator): string {
  const out: string[] = [];
  if (acc.init) {
    out.push(`[init] session=${acc.init.sessionId} model=${acc.init.model}`);
  }
  for (const line of acc.assistantLines) out.push(line);
  for (const tc of acc.toolCalls) {
    out.push(`[tool:${tc.name}] ${JSON.stringify(tc.args).slice(0, 200)}`);
    if (tc.result) {
      const preview = tc.result.length > 400 ? tc.result.slice(0, 400) + "…" : tc.result;
      out.push(`[result:${tc.name}] ${preview}`);
    }
  }
  if (acc.resultSummary) {
    out.push(`[done] ${acc.resultSummary}`);
  }
  if (acc.adLinesDropped > 0) {
    out.push(`(${acc.adLinesDropped} ad line(s) dropped)`);
  }
  return out.join("\n");
}

function isFreebuffOnPath(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const which = spawn("which", [command], { stdio: "ignore" });
    which.on("error", () => resolve(false));
    which.on("exit", (code) => resolve(code === 0));
  });
}

const FREEBUFF_DEFAULT_PROMPT_TEMPLATE = [
  'You are "freebuff", an AI coding agent run as a Paperclip employee.',
  "",
  "Paperclip runtime identity:",
  "- Agent ID: {{agentId}}",
  "- Company ID: {{companyId}}",
  "- Run ID: {{runId}}",
  "",
  DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE,
].join("\n");

function buildPrompt(ctx: AdapterExecutionContext, config: FreebuffConfig): string {
  const context = (ctx.context ?? {}) as Record<string, unknown>;
  const template =
    typeof config.promptTemplate === "string" && config.promptTemplate.trim()
      ? config.promptTemplate
      : FREEBUFF_DEFAULT_PROMPT_TEMPLATE;

  const vars: Record<string, unknown> = {
    agentId: ctx.agent.id,
    companyId: ctx.agent.companyId,
    runId: ctx.runId,
    agentName: ctx.agent.name,
    taskId: typeof context.taskId === "string" ? context.taskId : "",
    taskTitle: typeof context.taskTitle === "string" ? context.taskTitle : "",
    taskBody: typeof context.taskBody === "string" ? context.taskBody : "",
    commentId:
      typeof context.commentId === "string"
        ? context.commentId
        : typeof context.wakeCommentId === "string"
          ? context.wakeCommentId
          : "",
    wakeReason: typeof context.wakeReason === "string" ? context.wakeReason : "",
    companyName: typeof context.companyName === "string" ? context.companyName : "",
    projectName: typeof context.projectName === "string" ? context.projectName : "",
  };

  const taskMarkdown = selectPaperclipTaskMarkdown(context, {
    resumedSession: readSessionId(ctx) !== null,
  });
  const wakePrompt = renderPaperclipWakePrompt(context.paperclipWake, {
    resumedSession: readSessionId(ctx) !== null,
  });

  const body = renderTemplate(template, vars);
  return joinPromptSections([body, taskMarkdown, wakePrompt], "\n\n");
}

export async function execute(
  ctx: AdapterExecutionContext,
): Promise<AdapterExecutionResult> {
  const cfg = (ctx.config ?? {}) as FreebuffConfig;
  const command = asString(cfg.command, FREEBUFF_DEFAULT_COMMAND);
  const baseArgs = asStringArray(cfg.args ?? [...FREEBUFF_DEFAULT_ARGS]);
  const cwd = asString(cfg.cwd, process.cwd());
  const model = asString(cfg.model, "auto");
  const timeoutSec = asNumber(cfg.timeoutSec, 0);
  const graceSec = asNumber(cfg.graceSec, 15);
  const stripAds = asBoolean(cfg.stripAds, true);
  const envConfig = parseObject(cfg.env);

  if (!(await isFreebuffOnPath(command))) {
    return {
      exitCode: 127,
      signal: null,
      timedOut: false,
      errorMessage: `freebuff CLI not found on PATH (looked for "${command}"). Install with: npm i -g freebuff`,
      resultJson: { adapterType: ADAPTER_TYPE, adapterVersion: ADAPTER_VERSION },
    };
  }

  const prompt = buildPrompt(ctx, cfg);
  const existingSession = readSessionId(ctx);
  const sessionId = existingSession ?? mintSessionId();
  const args = buildArgsWithSession(baseArgs, existingSession, prompt);

  const env = buildFreebuffEnv(
    ctx.agent,
    { env: envConfig as Record<string, string>, model },
    ctx.runId,
    ctx.authToken ?? null,
  );

  const acc = emptyAccumulator();

  await ctx.onMeta?.({
    adapterType: ADAPTER_TYPE,
    command,
    cwd,
    commandArgs: args,
    env: {
      PAPERCLIP_RUN_ID: env.PAPERCLIP_RUN_ID ?? "",
      FREEBUFF_MODEL: env.FREEBUFF_MODEL ?? "auto",
    },
  });

  const resolvedCommand = await resolveCommandForLogs(command, cwd, env);

  const proc = await runChildProcess(ctx.runId, command, args, {
    cwd,
    env,
    timeoutSec,
    graceSec,
    onLog: async (stream, chunk) => {
      if (stream !== "stdout") {
        await ctx.onLog?.(stream, chunk);
        return;
      }
      const lines = chunk.split(/\r?\n/);
      for (const line of lines) {
        if (!line) continue;
        const ev = parseFreebuffLine(line, { stripAds });
        accumulate(acc, ev);
        if (ev.kind === "ad_dropped" || ev.kind === "unknown") {
          continue;
        }
        await ctx.onLog?.(stream, line + "\n");
      }
    },
    onSpawn: ctx.onSpawn,
  });

  if (acc.init?.sessionId) {
    writeSessionId(ctx, acc.init.sessionId);
  } else if (!existingSession) {
    writeSessionId(ctx, sessionId);
  }

  if (proc.timedOut) {
    return {
      exitCode: proc.exitCode ?? -1,
      signal: proc.signal,
      timedOut: true,
      errorMessage: `freebuff timed out after ${timeoutSec}s`,
      resultJson: {
        adapterType: ADAPTER_TYPE,
        adapterVersion: ADAPTER_VERSION,
        transcript: renderTranscript(acc),
        sessionId: acc.init?.sessionId ?? sessionId,
      },
    };
  }

  const exitCode = proc.exitCode ?? acc.resultExitCode ?? 0;
  const transcript = renderTranscript(acc);
  const ok = exitCode === 0;

  return {
    exitCode,
    signal: proc.signal,
    timedOut: false,
    errorMessage: ok ? null : `freebuff exited with code ${exitCode}`,
    summary: acc.resultSummary ?? transcript.split("\n").pop() ?? "",
    sessionId: acc.init?.sessionId ?? sessionId,
    model: acc.init?.model ?? model,
    resultJson: {
      adapterType: ADAPTER_TYPE,
      adapterVersion: ADAPTER_VERSION,
      sessionId: acc.init?.sessionId ?? sessionId,
      model: acc.init?.model ?? model,
      transcript,
      toolCallCount: acc.toolCalls.length,
      adLinesDropped: acc.adLinesDropped,
      unknownLineCount: acc.unknownLines.length,
      command: resolvedCommand,
    },
  };
}

void stringifyPaperclipWakePayload;
