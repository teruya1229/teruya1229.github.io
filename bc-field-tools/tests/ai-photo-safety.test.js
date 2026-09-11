"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const MAX_JPEG_BYTES = 4 * 1024 * 1024;
const SURVEY_SLOT_KEYS = new Set([
  "panel-overview",
  "main-breaker",
  "branch-labels",
  "ac-nameplate",
  "existing-outlet",
  "indoor-place",
  "outdoor-place",
  "route-plan",
]);

const UNSAFE_PATTERNS = [
  /施工可能/,
  /施工不可/,
  /安全です/,
  /問題なし/,
  /活線ではない/,
  /配線サイズ/,
  /\d+\s*sq/i,
  /カバーを外/,
  /停止を解除/,
  /見積を確定/,
];

function containsUnsafePhrase(text) {
  const s = String(text || "");
  return UNSAFE_PATTERNS.some((re) => re.test(s));
}

function isSurveySlotKey(slotKey) {
  return SURVEY_SLOT_KEYS.has(slotKey);
}

function parseReadingPayload(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const cats = new Set([
    "panel_label",
    "breaker_label",
    "outlet_label",
    "route_observation",
    "other_visible_observation",
  ]);
  if (!cats.has(raw.category)) return null;
  if (typeof raw.summary !== "string" || !raw.summary || raw.summary.length > 300) return null;
  if (!Array.isArray(raw.candidates) || raw.candidates.length > 6) return null;
  if (!Array.isArray(raw.evidence) || raw.evidence.length > 6) return null;
  if (!Array.isArray(raw.uncertainty) || raw.uncertainty.length > 6) return null;
  if (!Array.isArray(raw.requiredFollowUp) || raw.requiredFollowUp.length > 6) return null;
  if (!Array.isArray(raw.disclaimers) || raw.disclaimers.length > 6) return null;
  return raw;
}

function classifyOpenAIFetchError(err) {
  const name = err && typeof err === "object" && err.name ? String(err.name) : "";
  if (name === "AbortError") {
    return {
      status: 504,
      code: "model_timeout",
      message:
        "AIの読取りが45秒以内に完了しませんでした。写真は保存されていません。",
    };
  }
  return null;
}

describe("ai photo safety / limits", () => {
  it("allows only survey 8 slotKeys", () => {
    assert.equal(isSurveySlotKey("panel-overview"), true);
    assert.equal(isSurveySlotKey("route-plan"), true);
    assert.equal(isSurveySlotKey("exec-before"), false);
    assert.equal(isSurveySlotKey("comp-panel"), false);
    assert.equal(SURVEY_SLOT_KEYS.size, 8);
  });

  it("enforces 4MiB limit constant", () => {
    assert.equal(MAX_JPEG_BYTES, 4 * 1024 * 1024);
  });

  it("detects unsafe phrases without rewriting", () => {
    assert.equal(containsUnsafePhrase("銘板に型番が見えます"), false);
    assert.equal(containsUnsafePhrase("この写真から施工可能です"), true);
    assert.equal(containsUnsafePhrase("活線ではないと判断できます"), true);
    assert.equal(containsUnsafePhrase("配線サイズは2.0sqです"), true);
  });

  it("accepts minimal valid reading and rejects oversized arrays", () => {
    const ok = parseReadingPayload({
      category: "panel_label",
      summary: "確認候補です。",
      candidates: [],
      evidence: [],
      uncertainty: ["判読困難"],
      requiredFollowUp: ["現地確認"],
      disclaimers: ["断定しません。"],
    });
    assert.ok(ok);
    const bad = parseReadingPayload({
      category: "panel_label",
      summary: "x",
      candidates: new Array(7).fill({ label: "a", value: "b", confidence: "low" }),
      evidence: [],
      uncertainty: [],
      requiredFollowUp: [],
      disclaimers: [],
    });
    assert.equal(bad, null);
  });
});

describe("ai photo model / timeout bounds", () => {
  const indexPath = path.join(
    __dirname,
    "..",
    "supabase",
    "functions",
    "ai-photo-proxy",
    "index.ts"
  );
  const safetyPath = path.join(
    __dirname,
    "..",
    "supabase",
    "functions",
    "ai-photo-proxy",
    "safety.ts"
  );
  const appPath = path.join(__dirname, "..", "app.js");

  it("uses gpt-4o-mini without reasoning and max_output_tokens 400", () => {
    const indexSrc = fs.readFileSync(indexPath, "utf8");
    const safetySrc = fs.readFileSync(safetyPath, "utf8");
    assert.match(indexSrc, /OPENAI_MODEL\s*=\s*"gpt-4o-mini"/);
    assert.doesNotMatch(indexSrc, /gpt-5\.6-terra/);
    assert.doesNotMatch(indexSrc, /reasoning\s*:/);
    assert.match(safetySrc, /MAX_OUTPUT_TOKENS\s*=\s*400/);
    assert.match(indexSrc, /max_output_tokens:\s*MAX_OUTPUT_TOKENS/);
    assert.match(indexSrc, /detail:\s*"high"/);
    assert.match(indexSrc, /store:\s*false/);
    assert.match(indexSrc, /status:\s*"suggested"/);
    assert.doesNotMatch(indexSrc, /8788/);
    assert.doesNotMatch(safetySrc, /8788/);
  });

  it("covers fetch + body read + JSON parse with 45s AbortController and Promise.race", () => {
    const indexSrc = fs.readFileSync(indexPath, "utf8");
    const safetySrc = fs.readFileSync(safetyPath, "utf8");
    assert.match(safetySrc, /OPENAI_OPERATION_TIMEOUT_MS\s*=\s*45_000/);
    assert.doesNotMatch(safetySrc, /OPENAI_FETCH_TIMEOUT_MS/);
    assert.doesNotMatch(safetySrc, /90_000/);
    assert.match(indexSrc, /AbortController/);
    assert.match(indexSrc, /Promise\.race/);
    assert.match(indexSrc, /OPENAI_OPERATION_TIMEOUT_MS/);
    assert.match(indexSrc, /controller\.abort\(\)/);
    assert.match(indexSrc, /await res\.text\(\)/);
    assert.match(indexSrc, /JSON\.parse\(bodyText\)/);
    assert.match(indexSrc, /extractOutputText/);
    // output_text を二重に結合すると JSON.parse が壊れるため else-if 必須
    assert.match(
      indexSrc,
      /if\s*\(\s*p\.type\s*===\s*"output_text"[\s\S]*?\}\s*else if\s*\(\s*typeof p\.text\s*===\s*"string"/,
    );
    assert.match(indexSrc, /Do NOT clear deadline here/);
    assert.match(indexSrc, /waitUntil/);
    assert.match(indexSrc, /safeOperation/);
    // Timer clear must not sit between fetch resolve and body read.
    const fetchIdx = indexSrc.indexOf('await fetch("https://api.openai.com/v1/responses"');
    const textIdx = indexSrc.indexOf("await res.text()");
    const clearIdx = indexSrc.indexOf("clearDeadline()");
    assert.ok(fetchIdx > 0 && textIdx > fetchIdx, "body read follows fetch");
    assert.ok(clearIdx > textIdx, "deadline cleared only after body path");
  });

  it("maps AbortError to 504 model_timeout without retry", () => {
    const indexSrc = fs.readFileSync(indexPath, "utf8");
    const classified = classifyOpenAIFetchError({ name: "AbortError" });
    assert.ok(classified);
    assert.equal(classified.status, 504);
    assert.equal(classified.code, "model_timeout");
    assert.match(classified.message, /45秒以内に完了しませんでした/);
    assert.equal(classifyOpenAIFetchError({ name: "TypeError" }), null);
    assert.doesNotMatch(indexSrc, /retry|setTimeout\(\s*\(\)\s*=>\s*callOpenAI/i);
    assert.doesNotMatch(indexSrc, /for\s*\(.*callOpenAI/);
  });

  it("returns CORS headers with allowed-origin errors including 504 path", () => {
    const indexSrc = fs.readFileSync(indexPath, "utf8");
    assert.match(indexSrc, /Access-Control-Allow-Origin/);
    assert.match(
      indexSrc,
      /if\s*\(\s*!result\.ok\s*\)\s*\{\s*return jsonResponse\(\s*result\.status,[\s\S]*?cors,/
    );
    assert.match(indexSrc, /code:\s*result\.code/);
    assert.match(indexSrc, /requestId/);
  });

  it("client uses 55s AbortController, no auto-retry, model_timeout message", () => {
    const appSrc = fs.readFileSync(appPath, "utf8");
    assert.match(appSrc, /AI_CLIENT_TIMEOUT_MS\s*=\s*55000/);
    assert.match(appSrc, /signal:\s*controller\.signal/);
    assert.match(appSrc, /controller\.abort\(\)/);
    assert.match(
      appSrc,
      /55秒以内に応答がありませんでした。元の写真は保存されています。自動再送はしていません。/
    );
    assert.match(
      appSrc,
      /AIの読取りが45秒以内に完了しませんでした。元の写真は保存されています/
    );
    assert.match(appSrc, /ensureAiPrepared|prepareForAi|BCFDImagePrep/);
    assert.match(appSrc, /AI用に写真を準備しています/);
    assert.doesNotMatch(appSrc, /写真は4MB以下のJPEGにしてください/);
    assert.doesNotMatch(appSrc, /JPEG写真を追加してから実行してください/);
    assert.match(appSrc, /if\s*\(\s*rt\.busy\s*\)\s*return/);
    assert.doesNotMatch(appSrc, /runAiReading\([^)]*\)[\s\S]{0,80}runAiReading/);
    assert.match(appSrc, /status:\s*"suggested"/);
    assert.match(appSrc, /AI読取・要確認/);
    assert.match(appSrc, /data-ai="apply"/);
    assert.match(appSrc, /data-ai="reject"/);
  });

  it("keeps suggested-only runtime candidates and safety filter source", () => {
    const indexSrc = fs.readFileSync(indexPath, "utf8");
    const safetySrc = fs.readFileSync(safetyPath, "utf8");
    const appSrc = fs.readFileSync(appPath, "utf8");
    assert.match(indexSrc, /containsUnsafePhrase/);
    assert.match(safetySrc, /施工可能/);
    assert.match(safetySrc, /活線ではない/);
    assert.match(appSrc, /aiPhotoRuntime/);
    assert.doesNotMatch(appSrc, /candidate.*IndexedDB|putAiCandidate|saveAiReading/i);
    assert.match(appSrc, /status:\s*"suggested"/);
  });
});
