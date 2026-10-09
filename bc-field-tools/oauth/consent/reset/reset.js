/* Isolated password recovery for the YouTube OAuth consent project. */
(function (global) {
  "use strict";
  var CALLBACK_URL = "https://teruya1229.github.io/bc-field-tools/oauth/consent/reset/";
  var STORAGE_KEY = "bc-oauth-consent.auth.v1";

  function isRecoveryCallback(href) {
    var u = new URL(href);
    var params = new URLSearchParams(u.hash.replace(/^#/, ""));
    return Boolean(u.searchParams.get("code")) ||
      (params.get("type") === "recovery" &&
       Boolean(params.get("access_token")) &&
       Boolean(params.get("refresh_token")));
  }

  function readConfig() {
    var cfg = global.BC_OAUTH_CONSENT_CONFIG;
    if (!cfg || !cfg.supabase) return null;
    var url = String(cfg.supabase.url || "").trim();
    var key = String(cfg.supabase.publishableKey || "").trim();
    if (url !== "https://ahtmiobqemzrpqxowevc.supabase.co" ||
        !key.startsWith("sb_publishable_")) return null;
    return { url: url, key: key };
  }

  function validatePasswords(a, b) {
    if (typeof a !== "string" || a.length < 8) return "新しいパスワードは8文字以上にしてください。";
    if (a !== b) return "確認用のパスワードが一致しません。";
    return "";
  }

  async function consumeRecovery(supabase, href) {
    var u = new URL(href);
    var err = u.searchParams.get("error_description") || u.searchParams.get("error");
    if (err) return { ok: false, message: "リンクが無効か期限切れです。もう一度メールを送信してください。" };
    var code = u.searchParams.get("code");
    if (code) {
      var exchanged = await supabase.auth.exchangeCodeForSession(code);
      if (exchanged.error || !exchanged.data || !exchanged.data.session) {
        return { ok: false, message: "認証リンクを確認できませんでした。新しいメールを送信してください。" };
      }
      return { ok: true };
    }
    var hash = new URLSearchParams(u.hash.replace(/^#/, ""));
    if (hash.get("type") !== "recovery" || !hash.get("access_token") || !hash.get("refresh_token")) {
      return { ok: false, message: "有効な再設定リンクではありません。" };
    }
    var session = await supabase.auth.setSession({
      access_token: hash.get("access_token"),
      refresh_token: hash.get("refresh_token")
    });
    if (session.error || !session.data || !session.data.session) {
      return { ok: false, message: "再設定リンクの認証に失敗しました。もう一度メールを送信してください。" };
    }
    return { ok: true };
  }

  var api = { CALLBACK_URL: CALLBACK_URL, STORAGE_KEY: STORAGE_KEY,
    isRecoveryCallback: isRecoveryCallback, validatePasswords: validatePasswords,
    consumeRecovery: consumeRecovery };
  global.BCConsentPasswordRecovery = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (!global.document || !global.document.getElementById("request-form")) return;
  var doc = global.document;
  var requestForm = doc.getElementById("request-form");
  var updateForm = doc.getElementById("update-form");
  var status = doc.getElementById("recovery-status");
  var error = doc.getElementById("recovery-error");
  var done = doc.getElementById("recovery-done");
  var busy = false;

  function message(value, isError) {
    if (isError) {
      error.textContent = value;
      error.hidden = false;
      status.textContent = "";
    } else {
      error.hidden = true;
      error.textContent = "";
      status.textContent = value;
    }
  }
  function show(form) {
    requestForm.hidden = form !== "request";
    updateForm.hidden = form !== "update";
    done.hidden = form !== "done";
  }

  async function boot() {
    var cfg = readConfig();
    if (!cfg) {
      message("認証用の接続設定がありません。ページを更新してください。", true);
      return;
    }
    var mod;
    try {
      mod = await import("https://esm.sh/@supabase/supabase-js@2");
    } catch (_) {
      message("認証ライブラリを読み込めませんでした。ページを更新してください。", true);
      return;
    }
    var supabase = mod.createClient(cfg.url, cfg.key, {
      auth: { persistSession: true, detectSessionInUrl: false, flowType: "pkce", storageKey: STORAGE_KEY }
    });
    var currentHref = global.location.href;
    if (isRecoveryCallback(currentHref) ||
        new URL(currentHref).searchParams.has("error")) {
      show("none");
      message("再設定リンクを確認しています。", false);
      var recovered;
      try {
        recovered = await consumeRecovery(supabase, currentHref);
      } catch (_) {
        recovered = { ok: false, message: "リンクの確認に失敗しました。再設定メールからやり直してください。" };
      }
      if (recovered.ok) {
        global.history.replaceState(null, "", global.location.pathname);
        show("update");
        message("新しいパスワードを入力してください。", false);
      } else {
        show("request");
        message(recovered.message, true);
      }
    } else {
      show("request");
      message("登録済みメールアドレスへ再設定リンクを送信できます。", false);
    }

    requestForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (busy) return;
      busy = true;
      var btn = requestForm.querySelector("button[type=submit]");
      btn.disabled = true;
      var email = doc.getElementById("reset-email").value.trim();
      try {
        var result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: CALLBACK_URL });
        if (result.error) {
          message("メールを送信できませんでした。しばらくしてからもう一度お試しください。", true);
        } else {
          message("再設定メールを送信しました。受信したリンクを同じブラウザで開いてください。", false);
        }
      } catch (_) {
        message("通信に失敗しました。しばらくしてからもう一度お試しください。", true);
      } finally {
        busy = false;
        btn.disabled = false;
      }
    });

    updateForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (busy) return;
      var password = doc.getElementById("reset-new").value;
      var confirm = doc.getElementById("reset-confirm").value;
      var issue = validatePasswords(password, confirm);
      if (issue) { message(issue, true); return; }
      busy = true;
      var btn = updateForm.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        var result = await supabase.auth.updateUser({ password: password });
        if (result.error) {
          message("更新できませんでした。認証リンクが期限切れの可能性があります。", true);
        } else {
          doc.getElementById("reset-new").value = "";
          doc.getElementById("reset-confirm").value = "";
          show("done");
          message("パスワードの変更が完了しました。", false);
        }
      } catch (_) {
        message("通信に失敗しました。もう一度お試しください。", true);
      } finally {
        busy = false;
        btn.disabled = false;
      }
    });
  }
  boot();
})(typeof window !== "undefined" ? window : globalThis);
