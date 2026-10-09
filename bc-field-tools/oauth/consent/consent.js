/* OAuth consent for /bc-field-tools/oauth/consent/ only.
   Does not attach any auth UI to the field estimate app. */
(function (global) {
  "use strict";

  function readAuthorizationId(search) {
    var params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
    var id = String(params.get("authorization_id") || "").trim();
    return id || "";
  }

  function isAuthorizationId(id) {
    return /^[a-z2-7]{32}$/.test(String(id || "").toLowerCase());
  }

  function safeRedirectUrl(value) {
    var raw = String(value || "").trim();
    if (!raw || /[\u0000-\u001f\u007f\\]/.test(raw)) return "";
    var url;
    try {
      url = new URL(raw);
    } catch (_e) {
      return "";
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    if (url.username || url.password) return "";
    if (url.origin === "null") return "";
    return url.toString();
  }

  function loginReturnHref(href) {
    var url;
    try {
      url = new URL(href);
    } catch (_e) {
      return "";
    }
    var path = url.pathname.replace(/\/+$/, "");
    var onConsent = path.endsWith("/bc-field-tools/oauth/consent")
      || path.endsWith("/bc-field-tools/oauth/consent/index.html");
    var id = readAuthorizationId(url.search);
    if (!onConsent || !isAuthorizationId(id)) return "";
    url.hash = "";
    url.search = "?authorization_id=" + id.toLowerCase();
    return url.toString();
  }

  function splitScopes(scope) {
    return String(scope || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  function readSharedSession(storage, key) {
    try {
      var raw = storage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.access_token || !parsed.refresh_token) return null;
      return {
        access_token: String(parsed.access_token),
        refresh_token: String(parsed.refresh_token)
      };
    } catch (_e) {
      return null;
    }
  }

  async function loadConsentState(options) {
    var authorizationId = readAuthorizationId(options.search);
    if (!authorizationId) {
      return { view: "error", code: "missing_authorization_id" };
    }
    if (!isAuthorizationId(authorizationId)) {
      return { view: "error", code: "invalid_authorization_id" };
    }
    authorizationId = authorizationId.toLowerCase();
    var user = await currentUser(options.supabase);
    if (!user && typeof options.adoptSession === "function") {
      var adopted = await options.adoptSession();
      if (adopted && adopted.ok) user = await currentUser(options.supabase);
    }
    if (!user) {
      return {
        view: "login",
        authorizationId: authorizationId,
        returnUrl: options.returnUrl || ""
      };
    }
    var detailsResult = await options.supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (!detailsResult || detailsResult.error || !detailsResult.data) {
      return {
        view: "error",
        code: "invalid_authorization_id",
        message: detailsResult && detailsResult.error ? detailsResult.error.message : ""
      };
    }
    var data = detailsResult.data;
    if (!Object.prototype.hasOwnProperty.call(data, "authorization_id")) {
      var already = safeRedirectUrl(data.redirect_url);
      if (!already) return { view: "error", code: "unsafe_redirect" };
      return { view: "redirect", redirectUrl: already };
    }
    return {
      view: "consent",
      authorizationId: authorizationId,
      clientName: data.client && data.client.name ? String(data.client.name) : "",
      scope: data.scope || "",
      scopes: splitScopes(data.scope),
      redirectUri: safeRedirectUrl(data.redirect_uri),
      email: user.email || ""
    };
  }

  async function currentUser(supabase) {
    var result = await supabase.auth.getUser();
    return result && result.data && result.data.user ? result.data.user : null;
  }

  async function signInWithPassword(supabase, email, password) {
    var result = await supabase.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(password || "")
    });
    if (!result || result.error || !result.data || !result.data.user) {
      return {
        ok: false,
        message: result && result.error ? result.error.message : "ログインできませんでした。"
      };
    }
    return { ok: true, email: result.data.user.email || "" };
  }

  async function submitDecision(options) {
    if (!isAuthorizationId(options.authorizationId)) {
      return { view: "error", code: "invalid_authorization_id" };
    }
    var oauth = options.supabase.auth.oauth;
    var consentOptions = { skipBrowserRedirect: true };
    var authorizationId = String(options.authorizationId).toLowerCase();
    var result = options.decision === "deny"
      ? await oauth.denyAuthorization(authorizationId, consentOptions)
      : await oauth.approveAuthorization(authorizationId, consentOptions);
    if (!result || result.error || !result.data || !result.data.redirect_url) {
      return {
        view: "error",
        code: "decision_failed",
        message: result && result.error ? result.error.message : ""
      };
    }
    var redirectUrl = safeRedirectUrl(result.data.redirect_url);
    if (!redirectUrl) return { view: "error", code: "unsafe_redirect" };
    return { view: "redirect", redirectUrl: redirectUrl };
  }

  var api = {
    readAuthorizationId: readAuthorizationId,
    isAuthorizationId: isAuthorizationId,
    safeRedirectUrl: safeRedirectUrl,
    loginReturnHref: loginReturnHref,
    splitScopes: splitScopes,
    readSharedSession: readSharedSession,
    loadConsentState: loadConsentState,
    signInWithPassword: signInWithPassword,
    submitDecision: submitDecision
  };

  global.BCFieldOAuthConsent = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (typeof document === "undefined" || !document.getElementById || !document.getElementById("consent-app")) {
    return;
  }

  var busy = false;

  function show(id) {
    ["consent-error", "consent-login", "consent-details"].forEach(function (key) {
      var node = document.getElementById(key);
      if (node) node.hidden = key !== id;
    });
  }

  function setStatus(text) {
    var node = document.getElementById("consent-status");
    if (node) node.textContent = text;
  }

  function showError(text) {
    var node = document.getElementById("consent-error");
    if (node) node.textContent = text;
    show("consent-error");
    setStatus("");
  }

  function configOrNull() {
    var cfg = global.BC_FIELD_CASES_CONFIG || {};
    var supabase = cfg.supabase || {};
    var url = String(supabase.url || "").trim();
    var key = String(supabase.publishableKey || "").trim();
    if (!url || !key) return null;
    return {
      url: url,
      key: key,
      sessionStorageKey: cfg.sessionStorageKey || "ai-bantou.auth.v1.session"
    };
  }

  async function createSupabase(cfg) {
    var mod = await import("https://esm.sh/@supabase/supabase-js@2");
    return mod.createClient(cfg.url, cfg.key, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        flowType: "pkce"
      }
    });
  }

  function renderConsent(state) {
    document.getElementById("client-name").textContent = state.clientName || "名称未設定のアプリ";
    document.getElementById("redirect-uri").textContent = state.redirectUri || "表示できない戻り先です";
    document.getElementById("user-email").textContent = state.email || "ログイン済み";
    var list = document.getElementById("scope-list");
    list.replaceChildren();
    if (!state.scopes.length) {
      var empty = document.createElement("li");
      empty.textContent = "要求されたスコープはありません。";
      list.appendChild(empty);
    } else {
      state.scopes.forEach(function (scope) {
        var item = document.createElement("li");
        item.textContent = scope;
        list.appendChild(item);
      });
    }
    show("consent-details");
    setStatus(state.clientName + " への接続を確認してください。");
  }

  async function boot() {
    var cfg = configOrNull();
    if (!cfg) {
      showError("接続設定を読み込めませんでした。");
      return;
    }
    var supabase;
    try {
      supabase = await createSupabase(cfg);
    } catch (err) {
      showError("認証SDKを読み込めませんでした。");
      return;
    }
    var search = global.location.search;
    var returnUrl = loginReturnHref(global.location.href);

    async function refresh() {
      var state = await loadConsentState({
        search: search,
        returnUrl: returnUrl,
        supabase: supabase,
        adoptSession: async function () {
          var shared = readSharedSession(global.sessionStorage, cfg.sessionStorageKey);
          if (!shared) return { ok: false };
          var setResult = await supabase.auth.setSession(shared);
          return { ok: !(setResult && setResult.error) };
        }
      });
      if (state.view === "error" && state.code === "missing_authorization_id") {
        showError("このページには authorization_id が必要です。直接開いた場合は表示できません。");
        return;
      }
      if (state.view === "error" && state.code === "invalid_authorization_id") {
        showError("認可IDが無効か、期限切れです。" + (state.message ? " " + state.message : ""));
        return;
      }
      if (state.view === "redirect") {
        if (safeRedirectUrl(state.redirectUrl)) global.location.assign(state.redirectUrl);
        else showError("戻り先URLが不正なため移動しません。");
        return;
      }
      if (state.view === "error" && state.code === "unsafe_redirect") {
        showError("戻り先URLが不正なため移動しません。");
        return;
      }
      if (state.view === "login") {
        show("consent-login");
        setStatus("ログインすると、この認可画面に戻ります。");
        return;
      }
      renderConsent(state);
    }

    document.getElementById("consent-login").addEventListener("submit", async function (event) {
      event.preventDefault();
      if (busy) return;
      busy = true;
      var email = document.getElementById("login-email").value;
      var password = document.getElementById("login-password").value;
      var result = await signInWithPassword(supabase, email, password);
      busy = false;
      if (!result.ok) {
        showError(result.message || "ログインできませんでした。");
        document.getElementById("consent-login").hidden = false;
        return;
      }
      await refresh();
    });

    async function decide(decision) {
      if (busy) return;
      busy = true;
      document.getElementById("approve-btn").disabled = true;
      document.getElementById("deny-btn").disabled = true;
      var state = await submitDecision({
        supabase: supabase,
        decision: decision,
        authorizationId: readAuthorizationId(search)
      });
      if (state.view === "redirect" && safeRedirectUrl(state.redirectUrl)) {
        global.location.assign(state.redirectUrl);
        return;
      }
      if (state.code === "unsafe_redirect") {
        busy = false;
        document.getElementById("approve-btn").disabled = false;
        document.getElementById("deny-btn").disabled = false;
        showError("戻り先URLが不正なため移動しません。");
        document.getElementById("consent-details").hidden = false;
        return;
      }
      busy = false;
      document.getElementById("approve-btn").disabled = false;
      document.getElementById("deny-btn").disabled = false;
      showError("認可の確定に失敗しました。" + (state.message ? " " + state.message : ""));
      document.getElementById("consent-details").hidden = false;
    }

    document.getElementById("approve-btn").addEventListener("click", function () {
      decide("approve");
    });
    document.getElementById("deny-btn").addEventListener("click", function () {
      decide("deny");
    });

    try {
      await refresh();
    } catch (err) {
      showError("認可内容を確認できませんでした。");
    }
  }

  boot();
})(typeof window !== "undefined" ? window : globalThis);
