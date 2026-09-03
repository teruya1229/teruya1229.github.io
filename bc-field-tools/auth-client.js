(() => {
  "use strict";

  /** BC専用 Supabase Auth（公開可能な anon key のみ。特権キーは使用しない） */
  const SUPABASE_URL = "https://ahtmiobqemzrpqxowevc.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFodG1pb2JxZW16cnBxeG93ZXZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNzE3MTEsImV4cCI6MjA5OTg0NzcxMX0.rtOtISU6UvH7Lue7pxW5dTQ5Jy0XWuBflSknuyiFtE4";
  const SESSION_KEY = "bcfd_ai_auth_session_v1";
  /** パスワード再設定メールの戻り先（固定） */
  const PASSWORD_RECOVERY_REDIRECT = "https://teruya1229.github.io/bc-field-diagnosis/";
  const GENERIC_RESET_SENT =
    "入力されたメールアドレス宛に、再設定手順をお送りしました。届かない場合は入力内容をご確認ください。";

  /** @type {null | { access_token: string, refresh_token: string, expires_at: number, email: string }} */
  let session = null;
  /**
   * Recovery session tokens are memory-only (never persisted).
   * @type {null | { access_token: string, refresh_token: string, email: string }}
   */
  let recoverySession = null;
  /** @type {Array<() => void>} */
  const listeners = [];

  function notify() {
    listeners.forEach((fn) => {
      try {
        fn();
      } catch (_) {
        /* ignore */
      }
    });
  }

  function authHeaders(extra) {
    const headers = {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY,
    };
    if (extra && typeof extra === "object") {
      Object.keys(extra).forEach((k) => {
        headers[k] = extra[k];
      });
    }
    return headers;
  }

  function loadSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) {
        session = null;
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.access_token !== "string" || typeof parsed.email !== "string") {
        session = null;
        sessionStorage.removeItem(SESSION_KEY);
        return;
      }
      session = {
        access_token: parsed.access_token,
        refresh_token: typeof parsed.refresh_token === "string" ? parsed.refresh_token : "",
        expires_at: Number(parsed.expires_at) || 0,
        email: parsed.email,
      };
    } catch (_) {
      session = null;
    }
  }

  function saveSession(next) {
    session = next;
    if (!next) {
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          access_token: next.access_token,
          refresh_token: next.refresh_token || "",
          expires_at: next.expires_at || 0,
          email: next.email,
        })
      );
    }
    notify();
  }

  function getSession() {
    return session;
  }

  function isPasswordRecovery() {
    return Boolean(recoverySession && recoverySession.access_token);
  }

  function getRecoveryEmail() {
    return recoverySession && recoverySession.email ? recoverySession.email : "";
  }

  function clearRecovery() {
    recoverySession = null;
    notify();
  }

  function onChange(fn) {
    if (typeof fn === "function") listeners.push(fn);
  }

  function clearAuthParamsFromUrl() {
    try {
      const url = new URL(window.location.href);
      ["code", "token_hash", "type", "error", "error_description", "error_code"].forEach((k) => {
        url.searchParams.delete(k);
      });
      // Drop fragment so #access_token=... recovery links never remain in the address bar.
      url.hash = "";
      const search = url.searchParams.toString();
      const clean = url.pathname + (search ? "?" + search : "");
      window.history.replaceState({}, document.title, clean);
    } catch (_) {
      /* ignore */
    }
  }

  function parseHashParams() {
    const hash = String(window.location.hash || "").replace(/^#/, "");
    if (!hash) return {};
    const out = {};
    hash.split("&").forEach((pair) => {
      const i = pair.indexOf("=");
      if (i < 0) return;
      const k = decodeURIComponent(pair.slice(0, i));
      const v = decodeURIComponent(pair.slice(i + 1) || "");
      out[k] = v;
    });
    return out;
  }

  function setRecoveryFromTokens(accessToken, refreshToken, email) {
    if (!accessToken) return false;
    recoverySession = {
      access_token: accessToken,
      refresh_token: refreshToken || "",
      email: email || "",
    };
    // Do not persist recovery tokens or passwords.
    clearAuthParamsFromUrl();
    notify();
    return true;
  }

  async function exchangeTokenHash(tokenHash, type) {
    const res = await fetch(SUPABASE_URL + "/auth/v1/verify", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        type: type || "recovery",
        token_hash: tokenHash,
      }),
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    if (!res.ok || !data || !data.access_token) {
      return { ok: false };
    }
    const email = (data.user && data.user.email) || "";
    setRecoveryFromTokens(data.access_token, data.refresh_token || "", email);
    return { ok: true };
  }

  async function detectPasswordRecoveryFromUrl() {
    const hash = parseHashParams();
    if (hash.type === "recovery" && hash.access_token) {
      setRecoveryFromTokens(hash.access_token, hash.refresh_token || "", "");
      return true;
    }

    try {
      const url = new URL(window.location.href);
      const type = url.searchParams.get("type") || "";
      const tokenHash = url.searchParams.get("token_hash") || "";
      if (type === "recovery" && tokenHash) {
        const result = await exchangeTokenHash(tokenHash, "recovery");
        return result.ok;
      }
    } catch (_) {
      /* ignore */
    }
    return false;
  }

  async function signInWithPassword(email, password) {
    const em = String(email || "").trim();
    const pw = String(password || "");
    if (!em || !pw) {
      return { ok: false, message: "メールアドレスとパスワードを入力してください。" };
    }
    const res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email: em, password: pw }),
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    if (!res.ok) {
      return {
        ok: false,
        message:
          "ログインに失敗しました。メールアドレスまたはパスワードを確認するか、パスワードを再設定してください。",
      };
    }
    const access = data && data.access_token;
    const refresh = data && data.refresh_token;
    const userEmail = (data && data.user && data.user.email) || em;
    if (!access) {
      return { ok: false, message: "ログイン応答が不正です。" };
    }
    const expiresIn = Number(data.expires_in) || 3600;
    clearRecovery();
    saveSession({
      access_token: access,
      refresh_token: refresh || "",
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      email: String(userEmail),
    });
    return { ok: true, email: String(userEmail) };
  }

  async function requestPasswordReset(email) {
    const em = String(email || "").trim();
    if (!em) {
      return { ok: false, message: "メールアドレスを入力してください。" };
    }
    const redirect = encodeURIComponent(PASSWORD_RECOVERY_REDIRECT);
    try {
      await fetch(SUPABASE_URL + "/auth/v1/recover?redirect_to=" + redirect, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ email: em }),
      });
    } catch (_) {
      /* still return generic message */
    }
    // Never reveal whether the email exists.
    return { ok: true, message: GENERIC_RESET_SENT };
  }

  async function updatePasswordWithRecovery(newPassword) {
    const pw = String(newPassword || "");
    if (!recoverySession || !recoverySession.access_token) {
      return { ok: false, message: "再設定セッションが無効です。メールのリンクから再度お試しください。" };
    }
    if (!pw) {
      return { ok: false, message: "新しいパスワードを入力してください。" };
    }
    const res = await fetch(SUPABASE_URL + "/auth/v1/user", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + recoverySession.access_token,
      },
      body: JSON.stringify({ password: pw }),
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    if (!res.ok) {
      return {
        ok: false,
        message: "パスワードの更新に失敗しました。リンクの有効期限切れの可能性があります。",
      };
    }
    clearRecovery();
    // Stay signed out; user logs in with the new password.
    saveSession(null);
    return { ok: true, message: "パスワードを更新しました。新しいパスワードでログインしてください。" };
  }

  async function signOut() {
    const token = session && session.access_token;
    clearRecovery();
    saveSession(null);
    if (!token) return { ok: true };
    try {
      await fetch(SUPABASE_URL + "/auth/v1/logout", {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: "Bearer " + token,
        },
      });
    } catch (_) {
      /* ignore */
    }
    return { ok: true };
  }

  loadSession();
  // Fire-and-forget URL detection; UI listens via onChange.
  detectPasswordRecoveryFromUrl().catch(() => {});

  function getAccessToken() {
    return session && typeof session.access_token === "string" ? session.access_token : "";
  }

  window.BCFDAiAuth = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    AI_PHOTO_PROXY_URL: SUPABASE_URL + "/functions/v1/ai-photo-proxy",
    PASSWORD_RECOVERY_REDIRECT,
    getSession,
    getAccessToken,
    isPasswordRecovery,
    getRecoveryEmail,
    clearRecovery,
    onChange,
    signInWithPassword,
    signOut,
    requestPasswordReset,
    updatePasswordWithRecovery,
    detectPasswordRecoveryFromUrl,
  };
})();
