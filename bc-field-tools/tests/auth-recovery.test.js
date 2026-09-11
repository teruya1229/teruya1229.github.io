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
  const hashParams = {};
  if (hash) {
    hash.split("&").forEach((pair) => {
      const i = pair.indexOf("=");
      const k = decodeURIComponent((i < 0 ? pair : pair.slice(0, i)) || "");
      const v = decodeURIComponent((i < 0 ? "" : pair.slice(i + 1)) || "");
      if (k) hashParams[k] = v;
    });
  }
  const hashKeys = Object.keys(hashParams);
  if (hashKeys.includes("access_token")) {
    const type = String(hashParams.type || "").toLowerCase();
    if (type === "recovery") return "hash_recovery";
    if (!type || type === "magiclink" || type === "email" || type === "signup") {
      return "hash_magic";
    }
    return "hash_other";
  }
  if (keys.includes("token_hash")) {
    const type = String(u.searchParams.get("type") || "").toLowerCase();
    if (type === "recovery") return "token_hash_recovery";
    if (type === "magiclink" || type === "email") return "token_hash_magic";
    return "token_hash_other";
  }
  if (keys.includes("code") && !keys.includes("token") && !keys.includes("token_hash")) {
    return "code";
  }
  if (u.pathname.includes("/auth/v1/verify") && keys.includes("token")) {
    const type = String(u.searchParams.get("type") || "").toLowerCase();
    if (type === "recovery") return "verify_token_email_href_recovery";
    if (type === "magiclink" || type === "email") return "verify_token_email_href_magic";
    return "verify_token_email_href";
  }
  return "other";
}

describe("auth recovery callback classification", () => {
  it("classifies production email href as verify_token (not direct app callback)", () => {
    const href =
      "https://ahtmiobqemzrpqxowevc.supabase.co/auth/v1/verify?token=REDACTED&type=recovery&redirect_to=https://teruya1229.github.io/bc-field-tools/";
    assert.equal(classifyCallbackUrl(href), "verify_token_email_href_recovery");
  });

  it("AUTH-9: hash / token_hash / code forms", () => {
    assert.equal(
      classifyCallbackUrl(
        "https://teruya1229.github.io/bc-field-tools/#access_token=REDACTED&refresh_token=REDACTED&type=recovery"
      ),
      "hash_recovery"
    );
    assert.equal(
      classifyCallbackUrl(
        "https://teruya1229.github.io/bc-field-tools/?token_hash=REDACTED&type=recovery"
      ),
      "token_hash_recovery"
    );
    assert.equal(
      classifyCallbackUrl("https://teruya1229.github.io/bc-field-tools/?code=REDACTED"),
      "code"
    );
  });
});

describe("magic link callback classification", () => {
  it("classifies hash magiclink as normal session candidate (not recovery)", () => {
    assert.equal(
      classifyCallbackUrl(
        "https://teruya1229.github.io/bc-field-tools/#access_token=REDACTED&refresh_token=REDACTED&type=magiclink"
      ),
      "hash_magic"
    );
    assert.equal(
      classifyCallbackUrl(
        "https://teruya1229.github.io/bc-field-tools/#access_token=REDACTED&refresh_token=REDACTED"
      ),
      "hash_magic"
    );
  });

  it("classifies token_hash magiclink", () => {
    assert.equal(
      classifyCallbackUrl(
        "https://teruya1229.github.io/bc-field-tools/?token_hash=REDACTED&type=magiclink"
      ),
      "token_hash_magic"
    );
  });

  it("classifies dashboard magic verify href", () => {
    const href =
      "https://ahtmiobqemzrpqxowevc.supabase.co/auth/v1/verify?token=REDACTED&type=magiclink&redirect_to=https://teruya1229.github.io/bc-field-tools/";
    assert.equal(classifyCallbackUrl(href), "verify_token_email_href_magic");
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
    assert.match(authSrc, /requestMagicLink/);
    assert.match(authSrc, /detectAuthCallbackFromUrl/);
    assert.match(authSrc, /establishOwnerSession/);
    assert.match(authSrc, /bc\.teruya@gmail\.com/);
    assert.doesNotMatch(authSrc, /localStorage/);
  });

  it("app.js uses updatePassword and ensureValidSession", () => {
    assert.match(appSrc, /auth\.updatePassword\(/);
    assert.match(appSrc, /ensureValidAccessToken|ensureValidSession/);
    assert.match(appSrc, /typeof auth\.isLoggedIn === "function"/);
    assert.match(appSrc, /openAiAuthEscapeHatch/);
    assert.match(appSrc, /AIの認証が切れています/);
    assert.match(appSrc, /requestMagicLink/);
    assert.match(appSrc, /detectAuthCallbackFromUrl/);
    assert.match(appSrc, /await auth\.whenReady\(\)/);
    assert.match(appSrc, /data-action="ai-reauth"/);
    assert.match(appSrc, /needsReauth/);
    assert.match(appSrc, /aiErrorNeedsReauth/);
    assert.match(appSrc, /\["code", "token_hash", "type", "error", "error_description", "error_code", "v"\]/);
  });

  it("requestPasswordReset does not always return success on failure path", () => {
    assert.match(authSrc, /recover_failed/);
    assert.match(authSrc, /mapRecoverFailure/);
    assert.match(authSrc, /network_error/);
  });

  it("cache buster bumped for auth assets", () => {
    assert.match(indexSrc, /auth-client\.js\?v=20260911-010/);
    assert.match(indexSrc, /app\.js\?v=20260911-010/);
  });

  it("hides password login UI and shows magic reauth", () => {
    assert.match(indexSrc, /ai-auth-magic-btn/);
    assert.match(indexSrc, /AIを再認証/);
    assert.match(indexSrc, /id="ai-auth-password-block"/);
    assert.match(indexSrc, /id="ai-auth-magic-block"/);
    assert.match(indexSrc, /同じChrome/);
    assert.doesNotMatch(indexSrc, /Safari/);
    assert.doesNotMatch(indexSrc, /同じ端末で届いた/);
  });

  it("exposes a single APP_VERSION for menu and footer", () => {
    assert.match(appSrc, /const APP_VERSION = "2026\.09\.11-010"/);
    assert.match(appSrc, /CACHE_BUSTER = APP_VERSION\.replace/);
    assert.match(appSrc, /applyAppVersionLabels/);
    assert.match(indexSrc, /id="menu-app-version"/);
    assert.match(indexSrc, /id="app-version-footer"/);
  });
});

describe("persistent auth wiring", () => {
  it("keeps case IndexedDB name separate from auth IDB", () => {
    const storageSrc = fs.readFileSync(path.join(root, "storage.js"), "utf8");
    assert.match(storageSrc, /bc-field-diagnosis/);
    assert.match(authSrc, /bcfd-ai-auth-v1/);
    assert.doesNotMatch(authSrc, /DB_NAME\s*=\s*"bc-field-diagnosis"/);
  });

  it("does not treat magiclink as recovery session", () => {
    assert.match(authSrc, /MAGIC_LINK_TYPES/);
    assert.match(authSrc, /kind: "magic"/);
    assert.match(authSrc, /clearRecovery\(\)/);
  });

  it("snapshots auth callback before view URL rewrite can drop code/hash", () => {
    assert.match(authSrc, /bootAuthCallback = snapshotAuthCallbackFromLocation\(\)/);
    assert.match(authSrc, /auth_callback_recovered_from_snapshot/);
    assert.match(authSrc, /auth_callback_snapshot/);
    assert.match(appSrc, /keepHash/);
    assert.match(appSrc, /token_hash/);
    assert.match(authSrc, /MSG_MAGIC_SAME_DEVICE/);
    assert.match(authSrc, /同じChrome/);
    assert.doesNotMatch(authSrc, /Safari/);
    assert.match(authSrc, /pkce_exchange_skipped/);
  });
});
