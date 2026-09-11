/** Pure validators / safety filter for AI photo reading (no I/O, no secrets). */

export const MAX_JPEG_BYTES = 4 * 1024 * 1024;
/** Reject Content-Length above this before reading multipart. */
export const MAX_REQUEST_BYTES = MAX_JPEG_BYTES + 256 * 1024;
/** OpenAI wall-clock budget covering fetch + body read + JSON parse + extract. */
export const OPENAI_OPERATION_TIMEOUT_MS = 45_000;
export const MAX_OUTPUT_TOKENS = 400;

/** Per-client sliding window (in-memory, best-effort). */
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const RATE_LIMIT_MAX_PER_WINDOW = 12;
/** Soft global OpenAI call cap per UTC day (in-memory, best-effort). */
export const DAILY_GLOBAL_MAX = 200;

export function utcDayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/**
 * Sliding-window rate check. Mutates `buckets` on success.
 * @returns ok or retryAfterSec
 */
export function checkClientRateLimit(
  buckets: Map<string, number[]>,
  clientKey: string,
  nowMs: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
  maxPerWindow: number = RATE_LIMIT_MAX_PER_WINDOW,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const key = String(clientKey || "unknown").slice(0, 128);
  const cutoff = nowMs - windowMs;
  const prev = buckets.get(key) || [];
  const recent = prev.filter((t) => t > cutoff);
  if (recent.length >= maxPerWindow) {
    const oldest = recent[0] || nowMs;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
    buckets.set(key, recent);
    return { ok: false, retryAfterSec };
  }
  recent.push(nowMs);
  buckets.set(key, recent);
  return { ok: true };
}

/**
 * Daily global OpenAI call budget. Mutates `state` on success.
 */
export function checkDailyGlobalBudget(
  state: { day: string; count: number },
  nowMs: number,
  maxPerDay: number = DAILY_GLOBAL_MAX,
): { ok: true } | { ok: false } {
  const day = utcDayKey(nowMs);
  if (state.day !== day) {
    state.day = day;
    state.count = 0;
  }
  if (state.count >= maxPerDay) return { ok: false };
  state.count += 1;
  return { ok: true };
}

export function clientKeyFromRequest(req: Request): string {
  const cf = (req.headers.get("cf-connecting-ip") || "").trim();
  if (cf) return "cf:" + cf;
  const xff = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (xff) return "xff:" + xff;
  const realIp = (req.headers.get("x-real-ip") || "").trim();
  if (realIp) return "rip:" + realIp;
  return "unknown";
}

export function classifyOpenAIFetchError(
  err: unknown,
): { status: number; code: string; message: string } | null {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name?: unknown }).name || "")
      : "";
  if (name === "AbortError") {
    return {
      status: 504,
      code: "model_timeout",
      message:
        "AIの読取りが45秒以内に完了しませんでした。写真は保存されていません。",
    };
  }
  return null;
}

export const SURVEY_SLOT_KEYS = new Set([
  "panel-overview",
  "main-breaker",
  "branch-labels",
  "ac-nameplate",
  "existing-outlet",
  "indoor-place",
  "outdoor-place",
  "route-plan",
]);

export const CATEGORIES = new Set([
  "panel_label",
  "breaker_label",
  "outlet_label",
  "route_observation",
  "other_visible_observation",
]);

export const CONFIDENCE = new Set(["low", "medium", "high"]);

export const EVIDENCE_KINDS = new Set([
  "visible_text",
  "visible_mark",
  "visible_condition",
]);

/** Phrases that must never appear in model output shown to users. */
const UNSAFE_PATTERNS: RegExp[] = [
  /施工可能/,
  /施工不可/,
  /工事可能/,
  /工事不可/,
  /安全です/,
  /問題なし/,
  /問題無い/,
  /活線ではない/,
  /活線でない/,
  /非充電/,
  /配線サイズ/,
  /\d+\s*sq/i,
  /sq\s*線/,
  /ブレーカー接続先/,
  /接続方法を確定/,
  /カバーを外/,
  /分電盤カバーを外/,
  /内部を開け/,
  /取り外して確認/,
  /工程を進めて/,
  /停止を解除/,
  /見積を確定/,
  /承認します/,
  /署名/,
  /safe to work/i,
  /energized/i,
  /de-energized/i,
];

export function containsUnsafePhrase(text: string): boolean {
  const s = String(text || "");
  if (!s) return false;
  for (let i = 0; i < UNSAFE_PATTERNS.length; i++) {
    if (UNSAFE_PATTERNS[i].test(s)) return true;
  }
  return false;
}

function isShortString(v: unknown): v is string {
  return typeof v === "string" && v.length <= 300;
}

function isStringArray(v: unknown, maxLen: number): v is string[] {
  if (!Array.isArray(v) || v.length > maxLen) return false;
  return v.every((item) => isShortString(item));
}

/**
 * Validate structured reading payload. Returns null if invalid.
 * Does not rewrite unsafe content — caller must reject via containsUnsafePhrase.
 */
export function parseReadingPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  if (typeof o.category !== "string" || !CATEGORIES.has(o.category)) return null;
  if (!isShortString(o.summary) || o.summary.length === 0) return null;

  if (!Array.isArray(o.candidates) || o.candidates.length > 6) return null;
  for (let i = 0; i < o.candidates.length; i++) {
    const c = o.candidates[i];
    if (!c || typeof c !== "object") return null;
    const cand = c as Record<string, unknown>;
    if (!isShortString(cand.label) || cand.label.length === 0) return null;
    if (!isShortString(cand.value) || cand.value.length === 0) return null;
    if (typeof cand.confidence !== "string" || !CONFIDENCE.has(cand.confidence)) {
      return null;
    }
  }

  if (!Array.isArray(o.evidence) || o.evidence.length > 6) return null;
  for (let i = 0; i < o.evidence.length; i++) {
    const e = o.evidence[i];
    if (!e || typeof e !== "object") return null;
    const ev = e as Record<string, unknown>;
    if (typeof ev.kind !== "string" || !EVIDENCE_KINDS.has(ev.kind)) return null;
    if (!isShortString(ev.text) || ev.text.length === 0) return null;
  }

  if (!isStringArray(o.uncertainty, 6)) return null;
  if (!isStringArray(o.requiredFollowUp, 6)) return null;
  if (!isStringArray(o.disclaimers, 6)) return null;

  return {
    category: o.category,
    summary: o.summary,
    candidates: o.candidates,
    evidence: o.evidence,
    uncertainty: o.uncertainty,
    requiredFollowUp: o.requiredFollowUp,
    disclaimers: o.disclaimers,
  };
}

/** Flatten reading fields for unsafe-phrase scan. */
export function readingToScanText(reading: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof reading.summary === "string") parts.push(reading.summary);
  const pushArr = (arr: unknown, keys?: string[]) => {
    if (!Array.isArray(arr)) return;
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (typeof item === "string") parts.push(item);
      else if (item && typeof item === "object" && keys) {
        const o = item as Record<string, unknown>;
        for (let k = 0; k < keys.length; k++) {
          if (typeof o[keys[k]] === "string") parts.push(o[keys[k]] as string);
        }
      }
    }
  };
  pushArr(reading.candidates, ["label", "value"]);
  pushArr(reading.evidence, ["text"]);
  pushArr(reading.uncertainty);
  pushArr(reading.requiredFollowUp);
  pushArr(reading.disclaimers);
  return parts.join("\n");
}

export function isSurveySlotKey(slotKey: string): boolean {
  return SURVEY_SLOT_KEYS.has(slotKey);
}
