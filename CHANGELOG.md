# Changelog

## 0.1.0 (2026-08-27)

Initial release of the `freebuff_local` Paperclip external adapter.

- Spawns `freebuff` as a subprocess with `--print --output-format stream-json`
- Parses the stream into Paperclip `TranscriptEntry` rows: init / assistant / tool_call / tool_result / result
- Strips known ad-line patterns from stdout (`FREEBUFF_AD_LINE_PATTERNS` in `src/index.ts`)
- Persists session id in `runtime.sessionParams` and resumes with `--continue`
- `testEnvironment({})` reports binary on PATH, auth, and available models
- Standalone `paperclip-adapter-freebuff version` / `test-env` CLI
- 8 unit tests in `src/server/parse-freebuff.test.ts`
- `REGISTRY_PATCHES.md` describes the diffs needed to register `freebuff_local` in a Paperclip fork

Known limitations: requires the `freebuff` CLI on the host (`npm i -g freebuff` + `freebuff login`).
