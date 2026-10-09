"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const consent = require("./consent.js");

const AUTH_ID = "abcdefghijklmnopqrstuvwxyz234567";
const CONSENT_URL = "https://teruya1229.github.io/bc-field-tools/oauth/consent/?authorization_id=" + AUTH_ID;

function supabaseWith(handlers) {
  return {
    auth: {
      getUser: handlers.getUser,
      signInWithPassword: handlers.signInWithPassword,
      oauth: {
        getAuthorizationDetails: handlers.getAuthorizationDetails,
        approveAuthorization: handlers.approveAuthorization,
        denyAuthorization: handlers.denyAuthorization
      }
    }
  };
}

describe("oauth consent page", () => {
  it("direct access without authorization_id does not call the SDK", async () => {
    let calls = 0;
    const state = await consent.loadConsentState({
      search: "",
      supabase: supabaseWith({
        getUser: async () => {
          calls += 1;
          return { data: { user: null } };
        },
        getAuthorizationDetails: async () => {
          calls += 1;
          return { data: null, error: null };
        }
      })
    });
    assert.equal(state.view, "error");
    assert.equal(state.code, "missing_authorization_id");
    assert.equal(calls, 0);
  });

  it("rejects a malformed authorization_id before calling the SDK", async () => {
    let calls = 0;
    const state = await consent.loadConsentState({
      search: "?authorization_id=not-a-real-grant",
      supabase: supabaseWith({
        getUser: async () => {
          calls += 1;
          return { data: { user: null } };
        },
        getAuthorizationDetails: async () => {
          calls += 1;
          return { data: null, error: null };
        }
      })
    });
    assert.equal(state.view, "error");
    assert.equal(state.code, "invalid_authorization_id");
    assert.equal(calls, 0);
  });

  it("invalid authorization_id surfaces the SDK error", async () => {
    const state = await consent.loadConsentState({
      search: "?authorization_id=" + AUTH_ID,
      supabase: supabaseWith({
        getUser: async () => ({ data: { user: { email: "user@example.com" } } }),
        getAuthorizationDetails: async (id) => {
          assert.equal(id, AUTH_ID);
          return { data: null, error: { message: "authorization not found" } };
        }
      })
    });
    assert.equal(state.view, "error");
    assert.equal(state.code, "invalid_authorization_id");
    assert.match(state.message, /authorization not found/);
  });

  it("keeps the GitHub Pages consent URL, including authorization_id, as the login return", () => {
    const href = consent.loginReturnHref(
      "https://teruya1229.github.io/bc-field-tools/oauth/consent/?authorization_id=" + AUTH_ID.toUpperCase() + "&next=https://evil.example#access_token=secret"
    );
    assert.equal(href, CONSENT_URL);
  });

  it("drops a login return URL that is not the consent page", () => {
    assert.equal(
      consent.loginReturnHref("https://evil.example/phish?authorization_id=" + AUTH_ID),
      ""
    );
  });

  it("asks for login and preserves the return URL when nobody is signed in", async () => {
    const state = await consent.loadConsentState({
      search: "?authorization_id=" + AUTH_ID,
      returnUrl: CONSENT_URL,
      supabase: supabaseWith({
        getUser: async () => ({ data: { user: null } }),
        getAuthorizationDetails: async () => {
          throw new Error("details must wait for login");
        }
      })
    });
    assert.equal(state.view, "login");
    assert.equal(state.authorizationId, AUTH_ID);
    assert.equal(state.returnUrl, CONSENT_URL);
  });

  it("shows client.name and scope after login", async () => {
    const state = await consent.loadConsentState({
      search: "?authorization_id=" + AUTH_ID,
      supabase: supabaseWith({
        getUser: async () => ({ data: { user: { email: "user@example.com" } } }),
        getAuthorizationDetails: async () => ({
          data: {
            authorization_id: AUTH_ID,
            client: { name: "担当アプリ" },
            scope: "openid email",
            redirect_uri: "https://client.example/callback"
          },
          error: null
        })
      })
    });
    assert.equal(state.view, "consent");
    assert.equal(state.clientName, "担当アプリ");
    assert.equal(state.redirectUri, "https://client.example/callback");
    assert.deepEqual(state.scopes, ["openid", "email"]);
    assert.equal(state.email, "user@example.com");
  });

  it("redirects when consent was already stored", async () => {
    const state = await consent.loadConsentState({
      search: "?authorization_id=" + AUTH_ID,
      supabase: supabaseWith({
        getUser: async () => ({ data: { user: { email: "user@example.com" } } }),
        getAuthorizationDetails: async () => ({
          data: { redirect_url: "https://client.example/callback?code=ready" },
          error: null
        })
      })
    });
    assert.equal(state.view, "redirect");
    assert.equal(state.redirectUrl, "https://client.example/callback?code=ready");
  });

  it("approve and deny skip the SDK redirect and return its redirect_url once each", async () => {
    const calls = [];
    const supabase = supabaseWith({
      approveAuthorization: async (id, options) => {
        calls.push("approve:" + id + ":" + options.skipBrowserRedirect);
        return { data: { redirect_url: "https://client.example/callback?code=1" }, error: null };
      },
      denyAuthorization: async (id, options) => {
        calls.push("deny:" + id + ":" + options.skipBrowserRedirect);
        return { data: { redirect_url: "https://client.example/callback?error=access_denied" }, error: null };
      }
    });
    const approved = await consent.submitDecision({
      supabase: supabase,
      decision: "approve",
      authorizationId: AUTH_ID
    });
    const denied = await consent.submitDecision({
      supabase: supabase,
      decision: "deny",
      authorizationId: AUTH_ID
    });
    assert.equal(approved.redirectUrl, "https://client.example/callback?code=1");
    assert.equal(denied.redirectUrl, "https://client.example/callback?error=access_denied");
    assert.deepEqual(calls, ["approve:" + AUTH_ID + ":true", "deny:" + AUTH_ID + ":true"]);
  });

  it("does not accept a non-http redirect_url from approve or an already stored consent", async () => {
    const approved = await consent.submitDecision({
      supabase: supabaseWith({
        approveAuthorization: async () => ({ data: { redirect_url: "javascript:alert(1)" }, error: null })
      }),
      decision: "approve",
      authorizationId: AUTH_ID
    });
    assert.equal(approved.view, "error");
    assert.equal(approved.code, "unsafe_redirect");
    const stored = await consent.loadConsentState({
      search: "?authorization_id=" + AUTH_ID,
      supabase: supabaseWith({
        getUser: async () => ({ data: { user: { email: "user@example.com" } } }),
        getAuthorizationDetails: async () => ({
          data: { redirect_url: "data:text/html,hi" },
          error: null
        })
      })
    });
    assert.equal(stored.view, "error");
    assert.equal(stored.code, "unsafe_redirect");
    assert.equal(consent.safeRedirectUrl("https://user:pass@client.example/callback"), "");
  });

  it("reports login failure without dropping the authorization id", async () => {
    const result = await consent.signInWithPassword(
      supabaseWith({
        signInWithPassword: async () => ({ data: { user: null }, error: { message: "Invalid login" } })
      }),
      "user@example.com",
      "wrong"
    );
    assert.equal(result.ok, false);
    assert.match(result.message, /Invalid login/);
  });

  it("does not adopt another project's session", async () => {
    let adopted = 0;
    const state = await consent.loadConsentState({
      search: "?authorization_id=" + AUTH_ID,
      adoptSession: async () => {
        adopted += 1;
        return { ok: true };
      },
      supabase: supabaseWith({
        getUser: async () => ({ data: { user: null } }),
        getAuthorizationDetails: async () => {
          throw new Error("details must wait for this project's login");
        }
      })
    });
    assert.equal(adopted, 0);
    assert.equal(state.view, "login");
  });

  it("uses the OAuth server project and not the AI番頭 config", () => {
    const dir = __dirname;
    const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
    const js = fs.readFileSync(path.join(dir, "consent.js"), "utf8");
    const config = fs.readFileSync(path.join(dir, "consent-config.js"), "utf8");
    const cases = fs.readFileSync(path.join(dir, "../../bc-cases-config.js"), "utf8");
    assert.match(html, /id="consent-app"/);
    assert.match(html, /\/bc-field-tools\/oauth\/consent\/consent\.js\?v=20261009b/);
    assert.match(html, /\/bc-field-tools\/oauth\/consent\/consent-config\.js\?v=20261009b/);
    assert.match(html, /\/bc-field-tools\/oauth\/consent\/reset\//);
    assert.doesNotMatch(html, /bc-cases-config/);
    assert.match(js, /BC_OAUTH_CONSENT_CONFIG/);
    assert.match(js, /getAuthorizationDetails/);
    assert.match(js, /approveAuthorization/);
    assert.match(js, /denyAuthorization/);
    assert.match(js, /skipBrowserRedirect/);
    assert.match(js, /storageKey: "bc-oauth-consent\.auth\.v1"/);
    assert.doesNotMatch(js, /sessionStorage|adoptSession|readSharedSession|BC_FIELD_CASES_CONFIG|ai-bantou|xvrrlwlgoxbrkhlfyznx/);
    assert.match(config, /https:\/\/ahtmiobqemzrpqxowevc\.supabase\.co/);
    assert.match(config, /sb_publishable_SYwwQp9WZO2Uop_scQa1aQ_vy4oXHEq/);
    assert.doesNotMatch(config, /xvrrlwlgoxbrkhlfyznx/);
    assert.match(cases, /https:\/\/xvrrlwlgoxbrkhlfyznx\.supabase\.co/);
    const estimate = fs.readFileSync(path.join(dir, "../../index.html"), "utf8");
    assert.doesNotMatch(estimate, /oauth\/consent/);
  });
});
