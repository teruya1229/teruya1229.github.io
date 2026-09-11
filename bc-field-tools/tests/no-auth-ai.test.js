/**
 * No-login AI wiring checks for bc-field-tools.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const appSrc = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSrc = fs.readFileSync(path.join(root, "index.html"), "utf8");
const configSrc = fs.readFileSync(path.join(root, "supabase", "config.toml"), "utf8");
const indexTs = fs.readFileSync(
  path.join(root, "supabase", "functions", "ai-photo-proxy", "index.ts"),
  "utf8"
);
const safetyTs = fs.readFileSync(
  path.join(root, "supabase", "functions", "ai-photo-proxy", "safety.ts"),
  "utf8"
);

describe("login removed", () => {
  it("does not ship auth-client or auth UI", () => {
    assert.equal(fs.existsSync(path.join(root, "auth-client.js")), false);
    assert.doesNotMatch(indexSrc, /auth-client\.js/);
    assert.doesNotMatch(indexSrc, /ai-auth-panel|open-ai-auth-btn|AIを再認証|ログイン用リンク/);
    assert.doesNotMatch(appSrc, /BCFDAiAuth|ensureValidAccessToken|requestMagicLink|AIの認証が切れています/);
    assert.doesNotMatch(appSrc, /service_role|OPENAI_API_KEY|sk-/);
  });

  it("calls ai-photo-proxy directly with public anon key only", () => {
    assert.match(appSrc, /AI_PHOTO_PROXY_URL/);
    assert.match(appSrc, /functions\/v1\/ai-photo-proxy/);
    assert.match(appSrc, /Authorization: "Bearer " \+ SUPABASE_ANON_KEY/);
    assert.match(appSrc, /SUPABASE_ANON_KEY\s*=/);
    assert.doesNotMatch(appSrc, /service_role/);
    assert.doesNotMatch(appSrc, /"role":"service_role"/);
  });

  it("bumps version to 013", () => {
    assert.match(appSrc, /const APP_VERSION = "2026\.09\.11-013"/);
    assert.match(indexSrc, /app\.js\?v=20260911-013/);
    assert.match(indexSrc, /id="menu-app-version"/);
    assert.match(indexSrc, /id="app-version-footer"/);
    assert.match(indexSrc, /ai-field-logic\.js\?v=20260911-013/);
  });
});

describe("edge no-jwt abuse controls", () => {
  it("disables verify_jwt and drops email JWT gate", () => {
    assert.match(configSrc, /verify_jwt\s*=\s*false/);
    assert.doesNotMatch(indexTs, /AI_ALLOWED_EMAILS/);
    assert.doesNotMatch(indexTs, /emailFromAuthorization/);
    assert.doesNotMatch(indexTs, /ai_access_denied/);
  });

  it("requires allowlisted Origin and keeps payload / rate limits", () => {
    assert.match(indexTs, /origin_forbidden/);
    assert.match(safetyTs, /RATE_LIMIT_MAX_PER_WINDOW/);
    assert.match(safetyTs, /DAILY_GLOBAL_MAX/);
    assert.match(indexTs, /checkClientRateLimit/);
    assert.match(indexTs, /checkDailyGlobalBudget/);
    assert.match(safetyTs, /MAX_JPEG_BYTES\s*=\s*4 \* 1024 \* 1024/);
    assert.match(indexTs, /MAX_REQUEST_BYTES/);
  });
});

describe("case db untouched", () => {
  it("keeps cases IndexedDB name", () => {
    const storageSrc = fs.readFileSync(path.join(root, "storage.js"), "utf8");
    assert.match(storageSrc, /bc-field-diagnosis/);
    assert.doesNotMatch(appSrc, /bcfd-ai-auth-v1/);
  });
});
