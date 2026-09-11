"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const authSrc = fs.readFileSync(path.join(root, "auth-client.js"), "utf8");
const appSrc = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSrc = fs.readFileSync(path.join(root, "index.html"), "utf8");

function classifyCallbackUrl(href) {
  const u = new URL(href);
  const keys = Array.from(u.searchParams.keys());
  const hash = String(u.hash || "").replace(/^#/, "");
  const hashKeys = hash
    ? hash.split("&").map((p) => decodeURIComponent(p.split("=")[0] || "")).filter(Boolean)
    : [];
  if (hashKeys.includes("access_token") && (hashKeys.includes("type") || /type=recovery/.test(hash))) {
    return "hash";
  }
  if (keys.includes("token_hash") && u.searchParams.get("type") === "recovery") {
    return "token_hash";
  }
  if (keys.includes("code") && !keys.includes("token") && !keys.includes("token_hash")) {
    return "code";
  }
  if (u.pathname.includes("/auth/v1/verify") && keys.includes("token") && u.searchParams.get("type") === "recovery") {
    return "verify_token_email_href";
  }
  return "other";
}

describe("auth recovery callback classification", () => {
  it("classifies production email href as verify_token (not direct app callback)", () => {
    const href =
      "https://ahtmiobqemzrpqxowevc.supabase.co/auth/v1/verify?token=REDACTED&type=recovery&redirect_to=https://teruya1229.github.io/bc-field-tools/";
    assert.equal(classifyCallbackUrl(href), "verify_token_email_href");
  });

  it("AUTH-9: hash / token_hash / code forms", () => {
    assert.equal(
      classifyCallbackUrl(
        "https://teruya1229.github.io/bc-field-tools/#access_token=REDACTED&refresh_token=REDACTED&type=recovery"
      ),
      "hash"
    );
    assert.equal(
      classifyCallbackUrl(
        "https://teruya1229.github.io/bc-field-tools/?token_hash=REDACTED&type=recovery"
      ),
      "token_hash"
    );
    assert.equal(
      classifyCallbackUrl("https://teruya1229.github.io/bc-field-tools/?code=REDACTED"),
      "code"
    );
  });
});

describe("auth-client / app wiring", () => {
  it("exports updatePassword and updatePasswordWithRecovery", () => {
    assert.match(authSrc, /updatePassword,/);
    assert.match(authSrc, /updatePasswordWithRecovery,/);
    assert.match(authSrc, /ensureValidSession,/);
    assert.match(authSrc, /ensureValidAccessToken,/);
    assert.match(authSrc, /isLoggedIn,/);
    assert.match(authSrc, /AUTH_UI_VISIBLE\s*=\s*false/);
    assert.match(authSrc, /bcfd-ai-auth-v1/);
    assert.match(authSrc, /grant_type=pkce/);
    assert.match(authSrc, /grant_type=refresh_token/);
    assert.match(authSrc, /code_challenge/);
    assert.doesNotMatch(authSrc, /localStorage/);
  });

  it("app.js uses updatePassword and ensureValidSession", () => {
    assert.match(appSrc, /auth\.updatePassword\(/);
    assert.match(appSrc, /ensureValidAccessToken|ensureValidSession/);
    assert.match(appSrc, /typeof auth\.isLoggedIn === "function"/);
    assert.match(appSrc, /openAiAuthEscapeHatch/);
    assert.match(appSrc, /AIの認証が切れています/);
  });

  it("requestPasswordReset does not always return success on failure path", () => {
    assert.match(authSrc, /recover_failed/);
    assert.match(authSrc, /mapRecoverFailure/);
    assert.match(authSrc, /network_error/);
  });

  it("cache buster bumped for auth assets", () => {
    assert.match(indexSrc, /auth-client\.js\?v=20260911-005/);
    assert.match(indexSrc, /app\.js\?v=20260911-005/);
  });
});

describe("persistent auth wiring", () => {
  it("keeps case IndexedDB name separate from auth IDB", () => {
    const storageSrc = fs.readFileSync(path.join(root, "storage.js"), "utf8");
    assert.match(storageSrc, /bc-field-diagnosis/);
    assert.match(authSrc, /bcfd-ai-auth-v1/);
    assert.doesNotMatch(authSrc, /DB_NAME\s*=\s*"bc-field-diagnosis"/);
  });
});
