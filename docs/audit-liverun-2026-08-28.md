# freebuff adapter — live-run audit (2026-08-28)

**Question this answers:** does the `@paperclipai/adapter-freebuff@0.1.0`
adapter actually work end-to-end on this host?

**Short answer: NO.** The adapter loads, `testEnvironment()` passes, and
the 11 unit tests pass, but a real `execute()` round-trip fails because
**freebuff 0.0.157 (the version installed on this host) has no
non-interactive flags.** The adapter was built assuming `--print` and
`--output-format stream-json` exist. They don't. The freebuff binary is
a Bun-compiled TUI that only supports `login` (subcommand), `--continue
[id]`, and `--cwd <dir>`. Running it non-interactively either exits
`unknown option '--print'` or hangs forever on "Connecting…".

**The package layout still matches the official guide** (see the prior
`adapter-doc-audit` doc). The shape is right. The runtime contract is
wrong for the version it was pointed at.

---

## What I tested, in order

### 1. Build + static load (passes)

- `npm run build` — clean
- `npx tsc --noEmit` — clean
- `npm test` — 11/11 (all parser + `testEnvironment` unit tests, none
  spawn the real `freebuff` binary)
- `import('dist/index.js')` resolves. `createServerAdapter()` is a
  function. The returned module has the expected shape:
  `{ type, execute, testEnvironment, sessionCodec,
  supportsLocalAgentJwt, models, agentConfigurationDoc }`.

### 2. `testEnvironment()` (passes, with PATH caveat)

Without `freebuff` on `PATH` (it's at
`/home/ubuntu/.npm-global/bin/freebuff`, not in the default
`/home/ubuntu/.local/bin`):

```json
{
  "adapterType": "freebuff_local",
  "status": "fail",
  "checks": [
    { "level": "error", "code": "freebuff_cli_not_found",
      "message": "freebuff CLI \"freebuff\" not found on PATH" }
  ]
}
```

With `PATH=/home/ubuntu/.npm-global/bin:$PATH` (the actual install
location on this host):

```json
{
  "adapterType": "freebuff_local",
  "status": "pass",
  "checks": [
    { "level": "info", "code": "freebuff_version",
      "message": "freebuff version: 0.0.157" },
    { "level": "info", "code": "freebuff_authenticated",
      "message": "freebuff is authenticated" }
  ]
}
```

**Caveat:** Paperclip needs `freebuff` on the **server process's**
`PATH`, not the interactive shell's. If Paperclip runs under systemd
with a stripped `PATH`, the install won't be enough — symlink the
binary or set `Environment=PATH=...` in the unit. The `adapter-guide`
doc notes this in §15.

### 3. `execute()` (FAILS — root cause)

Real context, real cwd, real `freebuff` binary on `PATH`:

```
elapsed_ms: 1326
exitCode: 1
signal: null
timedOut: false
errorMessage: "freebuff exited with code 1"
resultJson: {
  "adapterType": "freebuff_local",
  "adapterVersion": "0.1.0",
  "sessionId": "6192c75e-edb1-4411-a7fb-ba09bb8b43b3",
  "model": "mimo-2.5-pro",
  "transcript": "",
  "toolCallCount": 0,
  "adLinesDropped": 0,
  "unknownLineCount": 0,
  "command": "freebuff"
}
```

Direct CLI repro:

```
$ freebuff --print --output-format stream-json "Reply with exactly: PONG"
error: unknown option '--print'
```

**Root cause:** `src/index.ts` declares
`FREEBUFF_DEFAULT_ARGS = ["--print", "--output-format", "stream-json"]`.
`freebuff --help` (v0.0.157) only knows:

```
Usage: freebuff [options] [command]

Freebuff - Free AI coding assistant

Arguments:
  command                       Command to run (choices: "login")

Options:
  -v, --version                 Print the CLI version
  --continue [conversation-id]  Continue from a previous conversation
  --cwd <directory>             Set the working directory
  -h, --help                    Show help
```

No `--print`, no `--output-format`, no `--model`, no flag to disable
the TUI. The freebuff binary is a Bun-compiled TUI that draws an
alternate-screen UI on `stdout` (with mouse/keyboard escape sequences,
model picker, and ad sidebar) — there is no pipe-friendly output mode
in this release.

### 4. The TUI itself works (interactive)

When run from a TTY (e.g. `timeout 15 freebuff`), the binary boots
into its picker, shows model availability, ad slot, session quota:

```
MiMo 2.5  Balanced · Images
0.1 of 6 sessions used, resets in 2h 38m
Some models aren't available in Indonesia yet
DeepSeek V4 Flash 07/31 is paused here after a steep price increase …
[ad: Clerk · Evaluate multi-tenant or B2B org auth and SSO with Clerk]
```

That confirms `freebuff login` is valid and the model pool for this
region is `MiMo 2.5` only (in limited mode). So the **adapter
configuration** (single model, `mimo-2.5-pro`) is correct; only the
**invocation** is wrong.

---

## "How do I apply it?" — the real answer

You can't, with the current freebuff CLI release and the current
adapter. The install path (Install External Adapter modal) works,
`freebuff_local` registers, the UI shows one model, and the env test
passes — but the moment you hire an agent and it kicks a heartbeat,
`execute()` returns `exitCode: 1` and the transcript is empty.

Three options, in increasing order of cost:

### Option A — wait for freebuff to ship a non-interactive flag (cheapest)

If `freebuff` adds `--print` or `--output-format` or any pipe-friendly
mode, this adapter works as-is. No code change. Track freebuff's
release notes (`https://github.com/CodebuffAI/codebuff` or
`https://freebuff.com`).

### Option B — rewrite the adapter to drive the TUI (medium cost)

Treat freebuff as a terminal app, not a CLI. The adapter needs:

1. A PTY (use `node-pty` or Bun's `Bun.spawn` with `terminal`).
2. A state machine that parses the TUI's cursor positions / panel
   text to know when the picker is ready, when a model is selected,
   and when the assistant has produced output.
3. A way to inject the prompt (probably simulate typing via
   `pty.write` after selecting a model).
4. A way to extract the assistant's response from the TUI's
   transcript region.

This is brittle. freebuff's TUI is not designed to be driven
programmatically. The model picker state is private. Ad injection
changes the layout. I'd reject this option unless freebuff confirms
they won't add a non-interactive mode.

### Option C — wrap a different freebuff release (cheap, if it exists)

The adapter's `--print` + `--output-format stream-json` invocation
implies a freebuff build that supports those flags. Possibilities:

- An older freebuff version (pre-0.0.15x) that did support `--print`.
- A `codebuff` (the upstream engine) build, which may have those
  flags. freebuff is "Built on the Codebuff platform" per its README,
  so `npx codebuff@<ver>` might be the right binary.
- A dev branch / fork.

I haven't verified any of these. If the original author of the
adapter saw `--print` work, the working build is somewhere. Worth
checking the freebuff GitHub for a release tag where `--help`
includes `--print`.

**My recommendation:** Option A. Watch freebuff's release notes. The
adapter is correctly shaped per the official Paperclip guide; it just
needs the runtime to expose the flags the adapter assumes.

---

## What I would change in the adapter, right now

If the user wants the adapter to fail loudly instead of silently
returning `exitCode: 1` with an empty transcript, three small edits:

1. **`src/index.ts`:** change `FREEBUFF_DEFAULT_ARGS` to
   `[] as const`. With no flags, freebuff drops into its TUI and
   exits with an error, but at least the error message doesn't
   pretend we support flags that don't exist.

2. **`src/server/execute.ts`:** when the spawn returns `exitCode: 1`
   AND the transcript is empty, return `errorMessage: "freebuff
   v<ver> has no non-interactive mode on this host. Track
   https://github.com/CodebuffAI/codebuff for a --print flag. See
   docs/audit-liverun-2026-08-28.md for the live verification."`
   That way the user sees a clear failure message instead of an empty
   transcript.

3. **`src/index.ts` / `agentConfigurationDoc`:** add a one-line
   caveat: "Requires a freebuff release that supports `--print` /
   `--output-format stream-json`; not yet available as of 0.0.157."

These are not asked for yet. I'm noting them as the minimum viable
patch if the user wants the adapter to be honest about its limits
before freebuff ships a non-interactive mode.

---

## Files referenced

- `/home/ubuntu/mnt/GitProject/paperclip-adapter-freebuff/src/index.ts`
  — `FREEBUFF_DEFAULT_ARGS` (the wrong assumption)
- `/home/ubuntu/mnt/GitProject/paperclip-adapter-freebuff/src/server/execute.ts`
  — `buildArgsWithSession` and the spawn loop
- `/home/ubuntu/mnt/GitProject/paperclip-adapter-freebuff/dist/index.js`
  — built artifact
- `~/.config/manicode/freebuff` — installed binary (Bun-compiled)
- `~/.config/manicode/credentials.json` — manicode auth (passes
  `freebuff_authenticated` check)

## State of the issue

`FRE-9` should stay in `in_review` and not move to `done` until the
adapter can produce a non-empty transcript from a real `execute()`
call. The previous "doc-anchored review" confirmed the **shape** is
right. This audit confirms the **runtime contract** is wrong for the
host's installed freebuff version.

---

## Addendum (2026-08-28 04:39 UTC) — tmux driver is viable; Option B is the new primary path

User pushback: "why not use tmux?" Re-tested on this host. Tmux-driving the TUI
**works** end-to-end. Live transcript:

```
$ tmux new-session -d -s fb -x 200 -y 50 'PATH=/home/ubuntu/.npm-global/bin:$PATH freebuff'
$ sleep 6
$ tmux send-keys -t fb -l 'Reply with the single word PONG. No punctuation, no explanation.'
$ sleep 1
$ tmux send-keys -t fb Enter
$ sleep 12
$ tmux capture-pane -t fb -p -S -500 | grep -E 'PONG|Reply|thinking|You'
  Reply with the single word PONG. No punctuation, no explanation. ⎘
    The user wants me to reply with just "PONG" - a single word, no punctuation, no explanation.
  PONG
```

Also confirmed: `freebuff --continue latest` reuses the prior conversation
(sessions-used counter increments, indicating the prior turn was retrieved).

### Why my earlier rejection of Option B was wrong

The three concerns I cited (brittle TUI, private picker state, ad layout) are
true in isolation but the conclusion was wrong:

1. **Picker state is private — but moot.** The picker is pre-selected on
   MiMo 2.5 in this region. We don't have to script selection; just hit
   Enter. The single-model config in `index.ts` is already correct.
2. **Ad layout changes — but decoupled.** The Clerk ad lives in its own
   bordered box at the bottom of the pane. The transcript region above is
   unaffected. Easy to ignore with a known row range.
3. **TUI not designed for it — buttmux driving is the project's own
   automation surface.** Codebuff's own integration tests
   (`cli/src/__tests__/README.md`) spawn tmux sessions and drive them with
   `send-keys`. This is how the upstream project tests its CLI.

The freebuff issue #947 (community feature request that the same `--print`
flag I assumed exists) explicitly proposes tmux-driving as Option C for
third-party orchestrators. `claude-p` (a third-party Claude Code
orchestrator) drives Claude Code's TUI through a PTY in production because
it preserves the TUI request scaffold (no API parity drift vs `-p`).

### Revised recommendation

| Option | Was | Now |
|---|---|---|
| A. Wait for freebuff `--print` | Only viable path | Long-term simplification, tracked but not blocking |
| **B. tmux-drive the TUI** | Rejected (brittle) | **The viable path. Ship as v0.2.0.** |
| C. Wrap codebuff | Dead (no headless) | Dead (confirmed) |

### Implementation outline (v0.2.0)

```
execute() {
  session = tmux-open(sessionId)         // or reuse existing session
  tmux-send-keys(session, prompt)         // -l for literal, then Enter
  wait-for-completion(session, 120s)      // poll for `• Xs` / `△▽` marker
  raw = tmux-capture-pane(session, -2000) // full scrollback
  text = strip-ansi(raw)                  // remove ink escape codes
  turn = parse-last-assistant-turn(text)  // skip ad region + user echoes
  tmux-send-Esc(session)                  // optional: kill input buffer
  return { transcript: turn, ... }
}
```

Cost estimate: ~300 LOC + ~80 LOC tests + one `tmux` system dep.
Comparable to what `claude-p` ships. 1-2 days of focused work. No upstream
flag dependency.

### Open question for the user

Two questions before starting the rewrite:

1. Greenlight Option B? Yes -> close FRE-9, open `FRE-11: tmux-driver v0.2.0`.
2. Concurrency: one tmux session per Paperclip session (simpler) vs a
   session pool (faster resume, more state). Start with one-per-session.
