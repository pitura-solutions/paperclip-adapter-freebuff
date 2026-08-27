# @paperclipai/adapter-freebuff

**Paperclip external adapter for the freebuff CLI** — give a Paperclip agent the world's strongest free coding agent without managing an LLM key.

> If it can receive a heartbeat, now it can code with freebuff.com.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)]()
[![Built for Paperclip](https://img.shields.io/badge/built%20for-Paperclip-8b5cf6)]()
[![Adapter type: freebuff_local](https://img.shields.io/badge/adapter-freebuff__local-orange)]()

---

## What This Does

Spawns the `freebuff` CLI as a subprocess and streams its output into a Paperclip-compatible transcript. Freebuff is free, ad-supported, and model-locked (Deepseek v4 / MiMo 2.5 Pro / GLM 5.2 / Minimax M3 / Gemini 3.1 Flash Lite) — you don't bring a key, freebuff does.

### Adapter capabilities

- **Subprocess adapter** — same shape as Paperclip's built-in `process` adapter, plus structured stdout parsing
- **Streamed transcript** — every freebuff line becomes a Paperclip `TranscriptEntry` (assistant / tool_call / tool_result / result)
- **Ad-line fence** — freebuff injects ad/upsell lines into stdout; this adapter detects and drops them so Paperclip transcripts stay clean
- **Session continuity** — uses `freebuff --continue` flag to resume prior session, persisted in Paperclip `runtime.sessionParams.sessionId`
- **Ad noise detector** — heuristic line classifier: lines matching freebuff's known ad format are stripped before transcript emission
- **No external secrets** — relies on `freebuff` being already authenticated on the host (run `freebuff login` once)

### What this adapter intentionally does NOT do

- **No LLM key management** — freebuff uses its own model pool
- **No tool-calling loop** — freebuff drives its own tool calls internally; the adapter just spawns and parses
- **No model selection** — freebuff routes to its model pool; pick via freebuff config, not here

---

## Quick Start

### 1. Install freebuff CLI

```bash
npm install -g freebuff
freebuff login  # one-time auth
```

### 2. Drop the adapter into Paperclip

```bash
# From your Paperclip repo root:
cd packages/adapters
git clone https://github.com/pitura-solutions/paperclip-adapter-freebuff freebuff
```

Or install from npm (once published):

```bash
pnpm add @paperclipai/adapter-freebuff
```

### 3. Apply registry patches

You need to register the adapter in 3 places:

- `server/src/adapters/registry.ts` — add `freebuffAdapter` with `supportsLocalAgentJwt: true`
- `server/src/adapters/builtin-adapter-types.ts` — add `"freebuff_local"` to the type union
- `ui/src/adapters/registry.ts` + `ui/src/adapters/adapter-display-registry.ts` — register the UI side

See [`REGISTRY_PATCHES.md`](./REGISTRY_PATCHES.md) for the exact diffs. Then:

```bash
cd ../../..   # back to paperclip root
pnpm install
pnpm -r build
```

### 4. (Alternative) Install via API

Once published, the adapter can be installed without forking Paperclip:

```bash
curl -X POST http://localhost:3100/api/adapters/install \
  -H "Authorization: Bearer $PAPERCLIP_BOARD_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"npm","package":"@paperclipai/adapter-freebuff"}'
```

### 5. Hire an agent

In the Paperclip UI → Org Chart → Hire Agent:

1. **Adapter Type**: freebuff_local
2. **Model**: `auto` (recommended; freebuff picks from its pool) or a specific freebuff model id
3. **Test Environment**: validates `freebuff` is on PATH and authenticated

Then create an issue and assign it to the new agent.

---

## Architecture

```
packages/adapters/freebuff/
├── package.json
├── README.md
├── REGISTRY_PATCHES.md
└── src/
    ├── index.ts                  # Root metadata, types, constants
    ├── server/
    │   ├── index.ts              # Server barrel — execute, sessionCodec, listSkills
    │   ├── execute.ts            # Subprocess spawn + stdout parsing + transcript emit
    │   ├── parse-freebuff.ts     # freebuff line classifier (assistant / tool / ad)
    │   ├── freebuff-env.ts       # Env builder, command resolution
    │   ├── test.ts               # Environment diagnostics (freebuff on PATH, auth check)
    │   └── session.ts            # Session id mint + resume
    ├── ui/
    │   ├── index.ts
    │   ├── parse-stdout.ts       # Stdout JSON lines → TranscriptEntry[]
    │   └── build-config.ts       # Form values → adapterConfig JSON
    └── cli/
        ├── index.ts
        └── format-event.ts       # Terminal pretty-print for paperclipai run --watch
```

### How a run works

1. Paperclip's heartbeat dispatcher wakes the agent and calls `execute(ctx)`
2. Adapter reads `ctx.config` for: `command` (default `freebuff`), `args` (default `["--print", "--output-format", "stream-json"]`), `cwd`, `timeoutSec`, `model`
3. Adapter resolves `freebuff` on PATH; bails with a clear error if missing
4. Adapter builds env: `PAPERCLIP_RUN_ID` + `PAPERCLIP_API_KEY` (from `ctx.authToken`) + freebuff-specific vars (`FREEBUFF_MODEL` if set, `NO_COLOR=1` for clean transcript)
5. Adapter mints/resumes a freebuff session id (stored in `ctx.runtime.sessionParams.sessionId`); first run gets a fresh id, subsequent runs get `--continue <id>`
6. Subprocess spawned via `runChildProcess`; stdout parsed line-by-line
7. Each line classified as `assistant` / `tool_call` / `tool_result` / `result` / `ad` (dropped)
8. Final `result` line is returned; on success, exit code 0 + `resultJson.summary`
9. Adapter posts final summary as the run's result; Paperclip moves the issue to `done`

### Freebuff output format

Freebuff emits a stream of JSON lines when invoked with `--output-format stream-json`:

```json
{"type":"init","session_id":"abc-123","model":"deepseek-v4"}
{"type":"assistant","text":"Reading the file…"}
{"type":"tool_call","name":"read_file","args":{"path":"src/index.ts"}}
{"type":"tool_result","name":"read_file","output":"…"}
{"type":"assistant","text":"Now editing line 42…"}
{"type":"result","summary":"Edited src/index.ts","exit_code":0}
```

Lines outside this format (freebuff ads, banner text, prompts) are detected by `parse-freebuff.ts` and dropped.

---

## Configuration

| Key | Type | Default | Notes |
| --- | --- | --- | --- |
| `command` | string | `"freebuff"` | Path to the freebuff binary; absolute or on PATH |
| `args` | string[] | `["--print", "--output-format", "stream-json"]` | Args passed to freebuff |
| `cwd` | string | `process.cwd()` | Working directory for the subprocess |
| `model` | string | `"auto"` | Freebuff model id; `auto` lets freebuff pick |
| `timeoutSec` | number | `0` (no timeout) | Kill subprocess after N seconds |
| `graceSec` | number | `15` | SIGTERM grace before SIGKILL |
| `env` | object | `{}` | Extra env vars passed to freebuff |
| `stripAds` | boolean | `true` | Drop freebuff ad lines from transcript |

---

## Development

```bash
git clone https://github.com/pitura-solutions/paperclip-adapter-freebuff
cd paperclip-adapter-freebuff
pnpm install
pnpm typecheck
pnpm build
```

To test against a live Paperclip instance, drop the cloned repo into `packages/adapters/freebuff` of your Paperclip checkout, apply the registry patches, and trigger a run.

---

## License

MIT — same as Paperclip.
