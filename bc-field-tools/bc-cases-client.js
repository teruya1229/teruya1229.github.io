/**
 * Phase1: load shared case by ?case_id= via secure cases API.
 * Auth: reuse AI番頭 session (sessionStorage / owner IndexedDB). Never trust client tenant_id.
 */
(function (global) {
  "use strict";

  var CANONICAL_UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  var DEFAULT_TIMEOUT_MS = 30000;

  function getConfig() {
    var cfg = global.BC_FIELD_CASES_CONFIG || {};
    var supabase = cfg.supabase || {};
    var url = String(supabase.url || "").trim().replace(/\/$/, "");
    var key = String(supabase.publishableKey || "").trim();
    if (!url || !key) return null;
    return {
      url: url,
      publishableKey: key,
      sessionStorageKey: cfg.sessionStorageKey || "ai-bantou.auth.v1.session",
      idbName: cfg.idbName || "ai-bantou.auth.v1",
      idbStore: cfg.idbStore || "sessions",
      idbSessionKey: cfg.idbSessionKey || "current"
    };
  }

  function normalizeCaseId(value) {
    var key = String(value || "").trim().toLowerCase();
    if (!CANONICAL_UUID_RE.test(key)) return null;
    return key;
  }

  function readSessionStorage(cfg) {
    try {
      var raw = global.sessionStorage.getItem(cfg.sessionStorageKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.access_token) return null;
      return {
        access_token: String(parsed.access_token || ""),
        refresh_token: String(parsed.refresh_token || ""),
        expires_at: Number(parsed.expires_at) || 0
      };
    } catch (_e) {
      return null;
    }
  }

  function idbGet(cfg) {
    return new Promise(function (resolve) {
      try {
        var req = global.indexedDB.open(cfg.idbName, 1);
        req.onerror = function () {
          resolve(null);
        };
        req.onupgradeneeded = function () {
          /* do not create schema from field-tools */
        };
        req.onsuccess = function () {
          var db = req.result;
          try {
            if (!db.objectStoreNames.contains(cfg.idbStore)) {
              db.close();
              resolve(null);
              return;
            }
            var tx = db.transaction(cfg.idbStore, "readonly");
            var store = tx.objectStore(cfg.idbStore);
            var getReq = store.get(cfg.idbSessionKey);
            getReq.onsuccess = function () {
              var row = getReq.result;
              db.close();
              if (!row || !row.access_token) {
                resolve(null);
                return;
              }
              resolve({
                access_token: String(row.access_token || ""),
                refresh_token: String(row.refresh_token || ""),
                expires_at: Number(row.expires_at) || 0
              });
            };
            getReq.onerror = function () {
              db.close();
              resolve(null);
            };
          } catch (_e) {
            try {
              db.close();
            } catch (_e2) {
              /* ignore */
            }
            resolve(null);
          }
        };
      } catch (_e) {
        resolve(null);
      }
    });
  }

  function isExpired(session, skewSeconds) {
    if (!session || !session.expires_at) return true;
    var skew = typeof skewSeconds === "number" ? skewSeconds : 30;
    return Math.floor(Date.now() / 1000) >= session.expires_at - skew;
  }

  function refreshSession(cfg, session) {
    if (!session || !session.refresh_token) {
      return Promise.resolve(null);
    }
    return fetch(cfg.url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: {
        apikey: cfg.publishableKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    })
      .then(function (resp) {
        return resp.json().then(function (body) {
          return { ok: resp.ok, body: body };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.body || !result.body.access_token) {
          return null;
        }
        return {
          access_token: String(result.body.access_token),
          refresh_token: String(
            result.body.refresh_token || session.refresh_token
          ),
          expires_at: Number(result.body.expires_at) || 0
        };
      })
      .catch(function () {
        return null;
      });
  }

  function resolveAccessToken(cfg) {
    var fromSs = readSessionStorage(cfg);
    var chain = fromSs
      ? Promise.resolve(fromSs)
      : idbGet(cfg).then(function (fromIdb) {
          return fromIdb;
        });
    return chain.then(function (session) {
      if (!session || !session.access_token) {
        return null;
      }
      if (!isExpired(session, 30)) {
        return session.access_token;
      }
      return refreshSession(cfg, session).then(function (next) {
        return next && next.access_token ? next.access_token : null;
      });
    });
  }

  function getCaseById(caseId) {
    var cfg = getConfig();
    if (!cfg) {
      return Promise.resolve({
        ok: false,
        code: "config_error",
        case: null
      });
    }
    var normalized = normalizeCaseId(caseId);
    if (!normalized) {
      return Promise.resolve({
        ok: false,
        code: "invalid_case_id",
        case: null
      });
    }

    return resolveAccessToken(cfg).then(function (accessToken) {
      if (!accessToken) {
        return {
          ok: false,
          code: "unauthorized",
          case: null
        };
      }
      var controller =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = null;
      if (controller) {
        timer = setTimeout(function () {
          controller.abort();
        }, DEFAULT_TIMEOUT_MS);
      }
      var apiUrl =
        cfg.url +
        "/functions/v1/cases?case_id=" +
        encodeURIComponent(normalized);
      var init = {
        method: "GET",
        headers: {
          Authorization: "Bearer " + accessToken,
          apikey: cfg.publishableKey,
          "Content-Type": "application/json"
        }
      };
      if (controller) init.signal = controller.signal;
      return fetch(apiUrl, init)
        .then(function (resp) {
          return resp.text().then(function (text) {
            var body = null;
            try {
              body = text ? JSON.parse(text) : null;
            } catch (_e) {
              body = null;
            }
            return { status: resp.status, body: body };
          });
        })
        .catch(function () {
          return { status: 0, body: null };
        })
        .then(function (result) {
          if (timer) clearTimeout(timer);
          if (result.status === 401) {
            return { ok: false, code: "unauthorized", case: null };
          }
          if (result.status === 404) {
            return { ok: false, code: "CASE_NOT_ACCESSIBLE", case: null };
          }
          if (
            result.status >= 200 &&
            result.status < 300 &&
            result.body &&
            result.body.ok &&
            result.body.case
          ) {
            return { ok: true, code: "ok", case: result.body.case };
          }
          var code =
            result.body && result.body.code
              ? String(result.body.code)
              : "CASE_NOT_ACCESSIBLE";
          return { ok: false, code: code, case: null };
        });
    });
  }

  function buildAiBantouReturnUrl(caseId) {
    var normalized = normalizeCaseId(caseId);
    if (!normalized) return "";
    return "/ai-bantou-app/?case_id=" + encodeURIComponent(normalized);
  }

  global.BCFieldCases = {
    normalizeCaseId: normalizeCaseId,
    getCaseById: getCaseById,
    buildAiBantouReturnUrl: buildAiBantouReturnUrl
  };
})(typeof window !== "undefined" ? window : globalThis);
