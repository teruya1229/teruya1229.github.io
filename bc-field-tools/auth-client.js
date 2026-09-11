(() => {
  "use strict";

  /** BC専用 Supabase Auth（公開可能な anon key のみ。特権キーは使用しない） */
  const SUPABASE_URL = "https://ahtmiobqemzrpqxowevc.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFodG1pb2JxZW16cnBxeG93ZXZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNzE3MTEsImV4cCI6MjA5OTg0NzcxMX0.rtOtISU6UvH7Lue7pxW5dTQ5Jy0XWuBflSknuyiFtE4";
  const SESSION_KEY = "bcfd_ai_auth_session_v1";
  const PKCE_VERIFIER_KEY = "bcfd_ai_auth_pkce_verifier_v1";
  const PENDING_RECOVERY_KEY = "bcfd_ai_auth_pending_recovery_v1";
  const PENDING_MAGIC_KEY = "bcfd_ai_auth_pending_magic_v1";
  /** Auth UI 表示切替（将来販売時は true に戻す）。表示できるだけで認証突破はできない。 */
  const AUTH_UI_VISIBLE = false;
  /**
   * Owner-only persistent session (IndexedDB)。案件DB (bc-field-diagnosis) とは分離。
   * Edge の AI_ALLOWED_EMAILS が最終権限。ここは端末保持の可否だけ。
   */
  const IDB_NAME = "bcfd-ai-auth-v1";
  const IDB_STORE = "sessions";
  const OWNER_PERSIST_EMAILS = ["bc.teruya@gmail.com"];
  const OWNER_EMAIL = OWNER_PERSIST_EMAILS[0];
  /** パスワード再設定メールの戻り先（固定） */
  const PASSWORD_RECOVERY_REDIRECT = "https://teruya1229.github.io/bc-field-tools/";
  const MAGIC_LINK_REDIRECT = "https://teruya1229.github.io/bc-field-tools/";
  const GENERIC_RESET_SENT =
    "入力されたメールアドレス宛に、再設定手順をお送りしました。届かない場合は入力内容をご確認ください。";
  const GENERIC_MAGIC_SENT =
    "本人用のログイン用リンクを送りました。この端末のメールアプリで最新のリンクを開いてください（別の端末では認証できません）。";
  const ACCESS_SKEW_SEC = 60;
  const MSG_AUTH_EXPIRED = "AIの認証が切れています";
  const MSG_OWNER_ONLY = "このアカウントではAI認証を保存できません。";
  const MSG_MAGIC_SAME_DEVICE =
    "ログイン用リンクは、この端末の「AIを再認証」から送った最新メールを、同じ端末で開いてください。";
  const MSG_MAGIC_NEED_APP_FLOW =
    "認証リンクを確認できませんでした。メニューの「AIを再認証」から、この端末で送り直してください。";
  const MAGIC_LINK_TYPES = { magiclink: true, email: true, signup: true };
  const AUTH_CALLBACK_QUERY_KEYS = [
    "code",
    "token_hash",
    "type",
    "error",
    "error_description",
    "error_code",
  ];

  /** @type {null | { access_token: string, refresh_token: string, expires_at: number, email: string }} */
  let session = null;
  /**
   * Recovery session tokens are memory-only (never persisted).
   * @type {null | { access_token: string, refresh_token: string, email: string }}
   */
  let recoverySession = null;
  /**
   * Sync snapshot of Auth callback URL taken before app.js rewrites ?view=.
   * Dashboard / Magic Link callbacks are otherwise lost to switchView().
   * @type {null | { searchParams: Record<string, string>, hash: string }}
   */
  let bootAuthCallback = null;
  /** @type {Array<() => void>} */
  const listeners = [];
  /** @type {Promise<{ ok: boolean, message?: string }> | null} */
  let refreshInFlight = null;
  /** @type {Promise<boolean> | null} */
  let recoveryDetectInFlight = null;

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

  function logAuthEvent(event, detail) {
    try {
      const safe = detail && typeof detail === "object" ? detail : {};
      console.info("[BCFDAiAuth]", event, safe);
    } catch (_) {
      /* ignore */
    }
  }

  function nowSec() {
    return Math.floor(Date.now() / 1000);
  }

  function base64UrlEncode(bytes) {
    let binary = "";
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  async function createPkcePair() {
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    const verifier = base64UrlEncode(raw);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return { verifier, challenge: base64UrlEncode(digest) };
  }

  function storePkceVerifier(verifier, kind) {
    try {
      sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
      if (kind === "recovery") {
        sessionStorage.setItem(PENDING_RECOVERY_KEY, "1");
        sessionStorage.removeItem(PENDING_MAGIC_KEY);
      } else if (kind === "magic") {
        sessionStorage.setItem(PENDING_MAGIC_KEY, "1");
        sessionStorage.removeItem(PENDING_RECOVERY_KEY);
      }
    } catch (_) {
      /* ignore */
    }
  }

  function readPkceVerifier() {
    try {
      return sessionStorage.getItem(PKCE_VERIFIER_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function clearPkceState() {
    try {
      sessionStorage.removeItem(PKCE_VERIFIER_KEY);
      sessionStorage.removeItem(PENDING_RECOVERY_KEY);
      sessionStorage.removeItem(PENDING_MAGIC_KEY);
    } catch (_) {
      /* ignore */
    }
  }

  function hasPendingRecoveryPkce() {
    try {
      return sessionStorage.getItem(PENDING_RECOVERY_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function hasPendingMagicPkce() {
    try {
      return sessionStorage.getItem(PENDING_MAGIC_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function isOwnerEmail(email) {
    return normalizeEmail(email) === normalizeEmail(OWNER_EMAIL);
  }

  function emailFromAccessToken(accessToken) {
    try {
      const parts = String(accessToken || "").split(".");
      if (parts.length < 2) return "";
      const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64 + "===".slice((b64.length + 3) % 4);
      const json = JSON.parse(atob(padded));
      return (json && (json.email || (json.user_metadata && json.user_metadata.email))) || "";
    } catch (_) {
      return "";
    }
  }

  async function resolveSessionEmail(accessToken, hintEmail) {
    const hinted = String(hintEmail || "").trim();
    if (hinted) return hinted;
    const fromJwt = emailFromAccessToken(accessToken);
    if (fromJwt) return fromJwt;
    try {
      const res = await fetch(SUPABASE_URL + "/auth/v1/user", {
        method: "GET",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: "Bearer " + accessToken,
        },
      });
      let data = null;
      try {
        data = await res.json();
      } catch (_) {
        data = null;
      }
      if (res.ok && data && data.email) return String(data.email);
    } catch (_) {
      /* ignore */
    }
    return "";
  }

  async function establishOwnerSession(accessToken, refreshToken, emailHint, expiresAt) {
    if (!accessToken || !refreshToken) {
      return { ok: false, message: MSG_AUTH_EXPIRED };
    }
    const email = await resolveSessionEmail(accessToken, emailHint);
    if (!isOwnerEmail(email)) {
      logAuthEvent("owner_email_rejected", { hasEmail: Boolean(email) });
      clearPkceState();
      clearAuthParamsFromUrl();
      return { ok: false, message: MSG_OWNER_ONLY };
    }
    clearRecovery();
    clearPkceState();
    saveSession({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: Number(expiresAt) || nowSec() + 3600,
      email: normalizeEmail(email) === normalizeEmail(OWNER_EMAIL) ? OWNER_EMAIL : String(email),
    });
    clearAuthParamsFromUrl();
    try {
      sessionStorage.removeItem("bcfd_auth_ui_force_v1");
    } catch (_) {
      /* ignore */
    }
    logAuthEvent("owner_session_established", { persistent: true });
    return { ok: true, email: OWNER_EMAIL };
  }

  /** @type {Promise<{ ok: boolean }> | null} */
  let bootstrapPromise = null;

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function canPersistOwnerSession(email) {
    return OWNER_PERSIST_EMAILS.indexOf(normalizeEmail(email)) >= 0;
  }

  function captureAuthUiForceFlag() {
    try {
      if (new URL(window.location.href).searchParams.get("bcfd_auth") === "1") {
        sessionStorage.setItem("bcfd_auth_ui_force_v1", "1");
      }
    } catch (_) {
      /* ignore */
    }
  }

  function isAuthUiForcedByUrl() {
    try {
      if (new URL(window.location.href).searchParams.get("bcfd_auth") === "1") return true;
    } catch (_) {
      /* ignore */
    }
    try {
      return sessionStorage.getItem("bcfd_auth_ui_force_v1") === "1";
    } catch (_) {
      return false;
    }
  }

  function isAuthUiVisible() {
    return AUTH_UI_VISIBLE === true || isAuthUiForcedByUrl();
  }

  function openIdb() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined" || !indexedDB) {
        reject(new Error("indexedDB_unavailable"));
        return;
      }
      let req;
      try {
        req = indexedDB.open(IDB_NAME, 1);
      } catch (err) {
        reject(err);
        return;
      }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("indexedDB_open_failed"));
      req.onblocked = () => reject(new Error("indexedDB_blocked"));
    });
  }

  function idbGet() {
    return openIdb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, "readonly");
          const store = tx.objectStore(IDB_STORE);
          const req = store.get(SESSION_KEY);
          req.onsuccess = () => {
            const value = req.result;
            db.close();
            if (!value || typeof value !== "object") {
              resolve(null);
              return;
            }
            if (typeof value.access_token !== "string" || typeof value.refresh_token !== "string") {
              resolve(null);
              return;
            }
            if (!canPersistOwnerSession(value.email)) {
              resolve(null);
              return;
            }
            resolve({
              access_token: value.access_token,
              refresh_token: value.refresh_token,
              expires_at: Number(value.expires_at) || 0,
              email: String(value.email || ""),
            });
          };
          req.onerror = () => {
            db.close();
            reject(req.error || new Error("indexedDB_get_failed"));
          };
        })
    );
  }

  function idbSet(next) {
    if (!next || !canPersistOwnerSession(next.email) || !next.refresh_token) {
      return idbClear();
    }
    const payload = {
      access_token: next.access_token,
      refresh_token: next.refresh_token || "",
      expires_at: next.expires_at || 0,
      email: next.email,
    };
    return openIdb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, "readwrite");
          const store = tx.objectStore(IDB_STORE);
          const req = store.put(payload, SESSION_KEY);
          req.onsuccess = () => {
            db.close();
            resolve(true);
          };
          req.onerror = () => {
            db.close();
            reject(req.error || new Error("indexedDB_put_failed"));
          };
        })
    );
  }

  function idbClear() {
    return openIdb()
      .then(
        (db) =>
          new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, "readwrite");
            const store = tx.objectStore(IDB_STORE);
            const req = store.delete(SESSION_KEY);
            req.onsuccess = () => {
              db.close();
              resolve(true);
            };
            req.onerror = () => {
              db.close();
              reject(req.error || new Error("indexedDB_delete_failed"));
            };
          })
      )
      .catch(() => false);
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
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch (_) {
        /* ignore */
      }
      idbClear().catch(() => {});
    } else {
      try {
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            access_token: next.access_token,
            refresh_token: next.refresh_token || "",
            expires_at: next.expires_at || 0,
            email: next.email,
          })
        );
      } catch (_) {
        /* ignore */
      }
      if (canPersistOwnerSession(next.email) && next.refresh_token) {
        idbSet(next).catch(() => {
          logAuthEvent("idb_persist_failed", {});
        });
      } else {
        idbClear().catch(() => {});
      }
    }
    notify();
  }

  async function restoreFromPersistentStore() {
    if (session && session.refresh_token) return true;
    try {
      const stored = await idbGet();
      if (!stored || !stored.refresh_token) return false;
      session = stored;
      try {
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            access_token: stored.access_token,
            refresh_token: stored.refresh_token || "",
            expires_at: stored.expires_at || 0,
            email: stored.email,
          })
        );
      } catch (_) {
        /* ignore */
      }
      logAuthEvent("idb_restore_ok", { hasExpires: Boolean(stored.expires_at) });
      return true;
    } catch (_) {
      logAuthEvent("idb_restore_failed", {});
      return false;
    }
  }

  function getSession() {
    return session;
  }

  function isAccessTokenFresh(s) {
    if (!s || typeof s.access_token !== "string" || !s.access_token) return false;
    const exp = Number(s.expires_at) || 0;
    if (!exp) return false;
    return nowSec() < exp - ACCESS_SKEW_SEC;
  }

  function isLoggedIn() {
    return Boolean(session && session.email && isAccessTokenFresh(session));
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
      AUTH_CALLBACK_QUERY_KEYS.forEach((k) => {
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
    bootAuthCallback = null;
  }

  function snapshotAuthCallbackFromLocation() {
    try {
      const url = new URL(window.location.href);
      const hash = String(url.hash || "").replace(/^#/, "");
      const searchParams = {};
      let searchHas = false;
      AUTH_CALLBACK_QUERY_KEYS.forEach((k) => {
        if (url.searchParams.has(k)) {
          searchParams[k] = String(url.searchParams.get(k) || "");
          searchHas = true;
        }
      });
      const hashHas = /(?:^|&)(access_token|refresh_token|error|error_code)=/.test(hash);
      if (!searchHas && !hashHas) return null;
      logAuthEvent("auth_callback_snapshot", {
        hasCode: Boolean(searchParams.code),
        hasTokenHash: Boolean(searchParams.token_hash),
        hasHashAccess: /(?:^|&)access_token=/.test(hash),
        type: String(searchParams.type || "").toLowerCase(),
      });
      return { searchParams, hash };
    } catch (_) {
      return null;
    }
  }

  function parseHashString(hashRaw) {
    const hash = String(hashRaw || "").replace(/^#/, "");
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

  function resolveAuthCallbackContext() {
    try {
      const liveUrl = new URL(window.location.href);
      const liveHash = String(liveUrl.hash || "").replace(/^#/, "");
      const liveParams = {};
      let liveSearchHas = false;
      AUTH_CALLBACK_QUERY_KEYS.forEach((k) => {
        if (liveUrl.searchParams.has(k)) {
          liveParams[k] = String(liveUrl.searchParams.get(k) || "");
          liveSearchHas = true;
        }
      });
      const liveHashHas = /(?:^|&)(access_token|refresh_token|error|error_code)=/.test(liveHash);
      if (liveSearchHas || liveHashHas) {
        return { searchParams: liveParams, hash: liveHash, source: "live" };
      }
    } catch (_) {
      /* ignore */
    }
    if (bootAuthCallback) {
      logAuthEvent("auth_callback_recovered_from_snapshot", {
        hasCode: Boolean(bootAuthCallback.searchParams && bootAuthCallback.searchParams.code),
        hasTokenHash: Boolean(bootAuthCallback.searchParams && bootAuthCallback.searchParams.token_hash),
        hasHashAccess: /(?:^|&)access_token=/.test(bootAuthCallback.hash || ""),
      });
      return {
        searchParams: bootAuthCallback.searchParams || {},
        hash: bootAuthCallback.hash || "",
        source: "snapshot",
      };
    }
    return { searchParams: {}, hash: "", source: "none" };
  }

  function parseHashParams() {
    return parseHashString(window.location.hash || "");
  }

  function readUrlAuthError() {
    try {
      const ctx = resolveAuthCallbackContext();
      const hash = parseHashString(ctx.hash);
      const error =
        ctx.searchParams.error ||
        hash.error ||
        ctx.searchParams.error_code ||
        hash.error_code ||
        "";
      const desc =
        ctx.searchParams.error_description || hash.error_description || "";
      if (!error && !desc) return null;
      return { error: String(error || ""), description: String(desc || "") };
    } catch (_) {
      return null;
    }
  }

  function recoveryErrorMessage(errInfo) {
    const blob = ((errInfo && (errInfo.error + " " + errInfo.description)) || "").toLowerCase();
    if (
      /expir|otp_expired|flow_state_expired|token.*expired|link.*expired/.test(blob)
    ) {
      return "再設定リンクの有効期限が切れています。新しい再設定メールを送ってください。";
    }
    return "再設定リンクを確認できませんでした。新しいメールからもう一度お試しください。";
  }

  function setRecoveryFromTokens(accessToken, refreshToken, email) {
    if (!accessToken) return false;
    recoverySession = {
      access_token: accessToken,
      refresh_token: refreshToken || "",
      email: email || "",
    };
    // Do not persist recovery tokens or passwords.
    clearPkceState();
    clearAuthParamsFromUrl();
    notify();
    return true;
  }

  function sessionFromTokenResponse(data, fallbackEmail) {
    const access = data && data.access_token;
    if (!access) return null;
    const expiresIn = Number(data.expires_in) || 3600;
    const email =
      (data.user && data.user.email) ||
      (data.email && String(data.email)) ||
      fallbackEmail ||
      "";
    return {
      access_token: access,
      refresh_token: (data && data.refresh_token) || "",
      expires_at: nowSec() + expiresIn,
      email: String(email || ""),
    };
  }

  async function verifyTokenHash(tokenHash, type) {
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
      logAuthEvent("token_hash_exchange_failed", {
        status: res.status,
        error: data && (data.error_code || data.error || data.msg),
        type: type || "",
      });
      return { ok: false };
    }
    return {
      ok: true,
      access_token: data.access_token,
      refresh_token: data.refresh_token || "",
      email: (data.user && data.user.email) || "",
      expires_at: nowSec() + (Number(data.expires_in) || 3600),
    };
  }

  async function exchangeTokenHash(tokenHash, type) {
    const verified = await verifyTokenHash(tokenHash, type);
    if (!verified.ok) return { ok: false };
    setRecoveryFromTokens(verified.access_token, verified.refresh_token, verified.email);
    return { ok: true };
  }

  async function exchangePkceCode(code) {
    const verifier = readPkceVerifier();
    if (!code || !verifier) {
      logAuthEvent("pkce_exchange_skipped", {
        hasCode: Boolean(code),
        hasVerifier: Boolean(verifier),
        pendingMagic: hasPendingMagicPkce(),
        pendingRecovery: hasPendingRecoveryPkce(),
      });
      return {
        ok: false,
        reason: "missing_verifier",
        message: MSG_MAGIC_SAME_DEVICE,
      };
    }
    const res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=pkce", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        auth_code: code,
        code_verifier: verifier,
      }),
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    if (!res.ok || !data || !data.access_token) {
      logAuthEvent("pkce_exchange_failed", {
        status: res.status,
        error: data && (data.error_code || data.error || data.error_description || data.msg),
      });
      return { ok: false, reason: "exchange_failed", message: MSG_MAGIC_NEED_APP_FLOW };
    }
    const email = (data.user && data.user.email) || "";
    const expiresAt = nowSec() + (Number(data.expires_in) || 3600);
    if (hasPendingRecoveryPkce()) {
      setRecoveryFromTokens(data.access_token, data.refresh_token || "", email);
      return { ok: true, kind: "recovery" };
    }
    const established = await establishOwnerSession(
      data.access_token,
      data.refresh_token || "",
      email,
      expiresAt
    );
    return established.ok
      ? { ok: true, kind: "magic" }
      : { ok: false, reason: "owner_rejected", message: established.message };
  }

  function expiresAtFromHash(hash) {
    if (hash.expires_at) return Number(hash.expires_at) || 0;
    const expiresIn = Number(hash.expires_in) || 0;
    if (expiresIn > 0) return nowSec() + expiresIn;
    return nowSec() + 3600;
  }

  async function detectAuthCallbackFromUrl() {
    if (recoveryDetectInFlight) return recoveryDetectInFlight;
    recoveryDetectInFlight = (async () => {
      const errInfo = readUrlAuthError();
      if (errInfo) {
        logAuthEvent("auth_url_error", {
          error: errInfo.error,
          hasDescription: Boolean(errInfo.description),
        });
        clearAuthParamsFromUrl();
        return { ok: false, kind: "error", message: MSG_MAGIC_NEED_APP_FLOW };
      }

      const ctx = resolveAuthCallbackContext();
      const hash = parseHashString(ctx.hash);
      if (hash.access_token) {
        const type = String(hash.type || "").toLowerCase();
        logAuthEvent("auth_callback_hash", {
          type: type || "(empty)",
          source: ctx.source,
          hasRefresh: Boolean(hash.refresh_token),
        });
        if (type === "recovery") {
          setRecoveryFromTokens(hash.access_token, hash.refresh_token || "", "");
          return { ok: true, kind: "recovery" };
        }
        if (!type || MAGIC_LINK_TYPES[type]) {
          const established = await establishOwnerSession(
            hash.access_token,
            hash.refresh_token || "",
            "",
            expiresAtFromHash(hash)
          );
          return established.ok
            ? { ok: true, kind: "magic" }
            : { ok: false, kind: "magic", message: established.message };
        }
      }

      try {
        const type = String(ctx.searchParams.type || "").toLowerCase();
        const tokenHash = ctx.searchParams.token_hash || "";
        const code = ctx.searchParams.code || "";

        if (tokenHash && type === "recovery") {
          const result = await exchangeTokenHash(tokenHash, "recovery");
          if (!result.ok) clearAuthParamsFromUrl();
          return { ok: result.ok, kind: "recovery" };
        }

        if (tokenHash && MAGIC_LINK_TYPES[type]) {
          logAuthEvent("auth_callback_token_hash", { type, source: ctx.source });
          const verified = await verifyTokenHash(tokenHash, type);
          if (!verified.ok) {
            clearAuthParamsFromUrl();
            return { ok: false, kind: "magic", message: MSG_MAGIC_NEED_APP_FLOW };
          }
          const established = await establishOwnerSession(
            verified.access_token,
            verified.refresh_token,
            verified.email,
            verified.expires_at
          );
          return established.ok
            ? { ok: true, kind: "magic" }
            : { ok: false, kind: "magic", message: established.message };
        }

        // PKCE callback: ?code=... (exchange BEFORE clearing URL params)
        if (code) {
          logAuthEvent("auth_callback_code", {
            source: ctx.source,
            hasVerifier: Boolean(readPkceVerifier()),
          });
          const result = await exchangePkceCode(code);
          if (!result.ok) {
            clearAuthParamsFromUrl();
            clearPkceState();
          }
          return result;
        }
      } catch (e) {
        logAuthEvent("auth_detect_exception", {
          name: e && e.name ? String(e.name) : "Error",
        });
      }
      return { ok: false, kind: "none" };
    })().finally(() => {
      recoveryDetectInFlight = null;
    });
    return recoveryDetectInFlight;
  }

  async function detectPasswordRecoveryFromUrl() {
    const result = await detectAuthCallbackFromUrl();
    return Boolean(result && result.ok && result.kind === "recovery");
  }

  async function refreshSession() {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      const current = session;
      if (!current || !current.refresh_token) {
        return { ok: false, message: MSG_AUTH_EXPIRED };
      }
      try {
        const res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ refresh_token: current.refresh_token }),
        });
        let data = null;
        try {
          data = await res.json();
        } catch (_) {
          data = null;
        }
        if (!res.ok || !data || !data.access_token) {
          logAuthEvent("refresh_failed", {
            status: res.status,
            error: data && (data.error_code || data.error || data.msg),
          });
          saveSession(null);
          return { ok: false, message: MSG_AUTH_EXPIRED };
        }
        const next = sessionFromTokenResponse(data, current.email);
        if (!next) {
          saveSession(null);
          return { ok: false, message: MSG_AUTH_EXPIRED };
        }
        saveSession(next);
        logAuthEvent("refresh_ok", { expires_at: next.expires_at });
        return { ok: true };
      } catch (_) {
        logAuthEvent("refresh_network_error", {});
        saveSession(null);
        return { ok: false, message: "通信できませんでした。接続を確認してもう一度お試しください。" };
      }
    })().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }

  async function ensureValidSession() {
    if (!session || !session.refresh_token) {
      await restoreFromPersistentStore();
    }
    if (isAccessTokenFresh(session)) {
      return { ok: true, session };
    }
    if (session && session.refresh_token) {
      const refreshed = await refreshSession();
      if (refreshed.ok && isAccessTokenFresh(session)) {
        return { ok: true, session };
      }
      return {
        ok: false,
        message: MSG_AUTH_EXPIRED,
      };
    }
    if (session) {
      saveSession(null);
      return { ok: false, message: MSG_AUTH_EXPIRED };
    }
    return { ok: false, message: MSG_AUTH_EXPIRED };
  }

  async function ensureValidAccessToken() {
    const ensured = await ensureValidSession();
    if (!ensured || !ensured.ok) {
      return { ok: false, message: (ensured && ensured.message) || MSG_AUTH_EXPIRED, token: "" };
    }
    const token = getAccessToken();
    if (!token) {
      return { ok: false, message: MSG_AUTH_EXPIRED, token: "" };
    }
    return { ok: true, token, session };
  }

  async function whenReady() {
    if (bootstrapPromise) return bootstrapPromise;
    bootstrapPromise = (async () => {
      loadSession();
      if (!session || !session.refresh_token) {
        await restoreFromPersistentStore();
      }
      try {
        await detectAuthCallbackFromUrl();
      } catch (_) {
        /* ignore */
      }
      if (!isPasswordRecovery()) {
        if (session && session.refresh_token) {
          await ensureValidSession();
        }
      }
      notify();
      return { ok: isLoggedIn() };
    })();
    return bootstrapPromise;
  }

  async function signInWithPassword(email, password) {
    const em = String(email || "").trim();
    const pw = String(password || "");
    if (!em || !pw) {
      return { ok: false, message: "メールアドレスとパスワードを入力してください。" };
    }
    try {
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
      const next = sessionFromTokenResponse(data, em);
      if (!next || !next.access_token) {
        return { ok: false, message: "ログイン応答が不正です。" };
      }
      clearRecovery();
      clearPkceState();
      saveSession(next);
      return { ok: true, email: next.email };
    } catch (_) {
      return {
        ok: false,
        message: "通信できませんでした。接続を確認してもう一度お試しください。",
      };
    }
  }

  function mapRecoverFailure(status, data, networkError) {
    if (networkError) {
      return {
        ok: false,
        message: "通信できませんでした。接続を確認してもう一度お試しください。",
        reason: "network_error",
      };
    }
    const code = String(
      (data && (data.error_code || data.error || data.msg || data.message)) || ""
    ).toLowerCase();
    if (status === 429 || /rate.?limit|over_request|too_many/.test(code)) {
      return {
        ok: false,
        message: "しばらく時間をおいてから、もう一度お試しください。",
        reason: "rate_limit",
      };
    }
    if (status === 400 && /redirect/.test(code)) {
      return {
        ok: false,
        message: "再設定メールを送れませんでした。しばらくしてからもう一度お試しください。",
        reason: "redirect_not_allowed",
      };
    }
    if (status >= 500) {
      return {
        ok: false,
        message: "再設定メールを送れませんでした。しばらくしてからもう一度お試しください。",
        reason: "server_error",
      };
    }
    if (status >= 400) {
      return {
        ok: false,
        message: "再設定メールを送れませんでした。しばらくしてからもう一度お試しください。",
        reason: "client_error",
      };
    }
    return null;
  }

  async function requestPasswordReset(email) {
    const em = String(email || "").trim();
    if (!em) {
      return { ok: false, message: "メールアドレスを入力してください。" };
    }
    const redirect = encodeURIComponent(PASSWORD_RECOVERY_REDIRECT);
    let pkce;
    try {
      pkce = await createPkcePair();
      storePkceVerifier(pkce.verifier, "recovery");
    } catch (_) {
      clearPkceState();
      return {
        ok: false,
        message: "再設定の準備に失敗しました。ページを再読み込みしてもう一度お試しください。",
      };
    }

    try {
      const res = await fetch(SUPABASE_URL + "/auth/v1/recover?redirect_to=" + redirect, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          email: em,
          code_challenge: pkce.challenge,
          code_challenge_method: "s256",
        }),
      });
      let data = null;
      try {
        data = await res.json();
      } catch (_) {
        data = null;
      }

      const failure = mapRecoverFailure(res.status, data, false);
      if (failure) {
        logAuthEvent("recover_failed", {
          status: res.status,
          reason: failure.reason,
          error: data && (data.error_code || data.error || data.msg),
        });
        clearPkceState();
        return { ok: false, message: failure.message };
      }

      // Success (including cases where Supabase does not reveal whether the email exists).
      logAuthEvent("recover_accepted", { status: res.status });
      return { ok: true, message: GENERIC_RESET_SENT };
    } catch (_) {
      logAuthEvent("recover_network_error", {});
      clearPkceState();
      return {
        ok: false,
        message: "通信できませんでした。接続を確認してもう一度お試しください。",
      };
    }
  }

  async function requestMagicLink(email) {
    const em = String(email || OWNER_EMAIL).trim() || OWNER_EMAIL;
    if (!isOwnerEmail(em)) {
      return { ok: false, message: MSG_OWNER_ONLY };
    }
    const redirect = encodeURIComponent(MAGIC_LINK_REDIRECT);
    let pkce;
    try {
      pkce = await createPkcePair();
      storePkceVerifier(pkce.verifier, "magic");
    } catch (_) {
      clearPkceState();
      return {
        ok: false,
        message: "再認証の準備に失敗しました。ページを再読み込みしてもう一度お試しください。",
      };
    }
    try {
      const res = await fetch(SUPABASE_URL + "/auth/v1/magiclink?redirect_to=" + redirect, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          email: OWNER_EMAIL,
          code_challenge: pkce.challenge,
          code_challenge_method: "s256",
        }),
      });
      let data = null;
      try {
        data = await res.json();
      } catch (_) {
        data = null;
      }
      const failure = mapRecoverFailure(res.status, data, false);
      if (failure) {
        logAuthEvent("magiclink_failed", {
          status: res.status,
          reason: failure.reason,
          error: data && (data.error_code || data.error || data.msg),
        });
        clearPkceState();
        return {
          ok: false,
          message:
            failure.reason === "rate_limit"
              ? failure.message
              : "ログイン用リンクを送れませんでした。しばらくしてからもう一度お試しください。",
        };
      }
      logAuthEvent("magiclink_accepted", { status: res.status });
      return { ok: true, message: GENERIC_MAGIC_SENT };
    } catch (_) {
      logAuthEvent("magiclink_network_error", {});
      clearPkceState();
      return {
        ok: false,
        message: "通信できませんでした。接続を確認してもう一度お試しください。",
      };
    }
  }

  async function updatePasswordWithRecovery(newPassword) {
    const pw = String(newPassword || "");
    if (!recoverySession || !recoverySession.access_token) {
      return {
        ok: false,
        message: "再設定リンクを確認できませんでした。新しいメールからもう一度お試しください。",
      };
    }
    if (!pw) {
      return { ok: false, message: "新しいパスワードを入力してください。" };
    }
    try {
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
        const blob = String((data && (data.error_code || data.msg || data.message || data.error)) || "").toLowerCase();
        logAuthEvent("password_update_failed", {
          status: res.status,
          error: data && (data.error_code || data.error || data.msg),
        });
        if (/expir|otp_expired|session/.test(blob) || res.status === 401) {
          clearRecovery();
          return {
            ok: false,
            message: "再設定リンクの有効期限が切れています。新しい再設定メールを送ってください。",
          };
        }
        return {
          ok: false,
          message: "パスワードの更新に失敗しました。もう一度お試しください。",
        };
      }
      clearRecovery();
      clearPkceState();
      // Stay signed out; user logs in with the new password.
      saveSession(null);
      return {
        ok: true,
        message: "パスワードを更新しました。新しいパスワードでログインしてください。",
      };
    } catch (_) {
      return {
        ok: false,
        message: "通信できませんでした。接続を確認してもう一度お試しください。",
      };
    }
  }

  async function updatePassword(newPassword, confirmPassword) {
    const pw = String(newPassword || "");
    const pw2 = String(confirmPassword || "");
    if (!pw || !pw2) {
      return { ok: false, message: "新しいパスワードと確認用パスワードを入力してください。" };
    }
    if (pw !== pw2) {
      return { ok: false, message: "確認用パスワードが一致しません。" };
    }
    return updatePasswordWithRecovery(pw);
  }

  async function signOut() {
    const token = session && session.access_token;
    clearRecovery();
    clearPkceState();
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
  captureAuthUiForceFlag();
  // Must run synchronously before app.js switchView() rewrites ?view= and drops Auth callback params.
  bootAuthCallback = snapshotAuthCallbackFromLocation();
  // Boot: restore persistent session (owner IndexedDB) then detect recovery/magic URL.
  whenReady().catch(() => {});

  function getAccessToken() {
    if (!isAccessTokenFresh(session)) return "";
    return session && typeof session.access_token === "string" ? session.access_token : "";
  }

  window.BCFDAiAuth = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    AI_PHOTO_PROXY_URL: SUPABASE_URL + "/functions/v1/ai-photo-proxy",
    PASSWORD_RECOVERY_REDIRECT,
    MAGIC_LINK_REDIRECT,
    OWNER_EMAIL,
    AUTH_UI_VISIBLE,
    SESSION_KEY,
    IDB_NAME,
    getSession,
    getAccessToken,
    isLoggedIn,
    isAuthUiVisible,
    isPasswordRecovery,
    getRecoveryEmail,
    clearRecovery,
    onChange,
    signInWithPassword,
    signOut,
    requestPasswordReset,
    requestMagicLink,
    updatePassword,
    updatePasswordWithRecovery,
    detectPasswordRecoveryFromUrl,
    detectAuthCallbackFromUrl,
    ensureValidSession,
    ensureValidAccessToken,
    refreshSession,
    whenReady,
    recoveryErrorMessage,
    readUrlAuthError,
    MSG_AUTH_EXPIRED,
    MSG_MAGIC_SAME_DEVICE,
    MSG_MAGIC_NEED_APP_FLOW,
  };
})();
