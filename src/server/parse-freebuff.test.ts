import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFreebuffLine, isAdLine } from "./parse-freebuff.js";

test("parses init event", () => {
  const ev = parseFreebuffLine('{"type":"init","session_id":"abc","model":"deepseek-v4"}', {});
  assert.equal(ev.kind, "init");
  if (ev.kind === "init") {
    assert.equal(ev.sessionId, "abc");
    assert.equal(ev.model, "deepseek-v4");
  }
});

test("parses assistant event", () => {
  const ev = parseFreebuffLine('{"type":"assistant","text":"hello"}', {});
  assert.equal(ev.kind, "assistant");
  if (ev.kind === "assistant") assert.equal(ev.text, "hello");
});

test("parses tool_call + tool_result", () => {
  const tc = parseFreebuffLine('{"type":"tool_call","name":"read_file","args":{"path":"x"}}', {});
  assert.equal(tc.kind, "tool_call");
  const tr = parseFreebuffLine('{"type":"tool_result","name":"read_file","output":"contents"}', {});
  assert.equal(tr.kind, "tool_result");
});

test("parses result event", () => {
  const ev = parseFreebuffLine('{"type":"result","summary":"done","exit_code":0}', {});
  assert.equal(ev.kind, "result");
  if (ev.kind === "result") {
    assert.equal(ev.summary, "done");
    assert.equal(ev.exitCode, 0);
  }
});

test("strips ad lines by default", () => {
  const ev = parseFreebuffLine("Upgrade to freebuff pro today!", {});
  assert.equal(ev.kind, "ad_dropped");
});

test("keeps ad lines when stripAds=false", () => {
  const ev = parseFreebuffLine("Upgrade to freebuff pro today!", { stripAds: false });
  assert.equal(ev.kind, "unknown");
});

test("isAdLine matches known patterns", () => {
  assert.equal(isAdLine("sponsored content"), true);
  assert.equal(isAdLine("[ad] something"), true);
  assert.equal(isAdLine("normal freebuff output"), false);
});

test("empty line is unknown", () => {
  const ev = parseFreebuffLine("", {});
  assert.equal(ev.kind, "unknown");
});

test("malformed JSON is unknown when not stripAds", () => {
  const ev = parseFreebuffLine("not json at all", { stripAds: false });
  assert.equal(ev.kind, "unknown");
});
