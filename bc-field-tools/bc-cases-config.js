/**
 * Phase1 shared cases config (same Supabase project as AI番頭).
 * tenant_id is never supplied by the client.
 */
(function (global) {
  "use strict";

  global.BC_FIELD_CASES_CONFIG = {
    supabase: {
      url: "https://xvrrlwlgoxbrkhlfyznx.supabase.co",
      publishableKey: "sb_publishable_dkTnfxy8pA8qcuJeVcrf1w_8ieMQEw1"
    },
    // Same keys as ai-bantou-auth-client so same-origin session can be reused.
    sessionStorageKey: "ai-bantou.auth.v1.session",
    idbName: "ai-bantou.auth.v1",
    idbStore: "sessions",
    idbSessionKey: "current"
  };
})(typeof window !== "undefined" ? window : globalThis);
