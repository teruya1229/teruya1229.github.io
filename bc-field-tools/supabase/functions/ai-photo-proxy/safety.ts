/** Pure validators / safety filter for AI photo reading (no I/O, no secrets). */

export const MAX_JPEG_BYTES = 4 * 1024 * 1024;
/** Reject Content-Length above this before reading multipart. */
export const MAX_REQUEST_BYTES = MAX_JPEG_BYTES + 256 * 1024;
/** OpenAI wall-clock budget covering fetch + body read + JSON parse + extract. */
export const OPENAI_OPERATION_TIMEOUT_MS = 45_000;
export const MAX_OUTPUT_TOKENS = 1200;

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

export const SLOT_GUIDANCE: Record<string, { title: string; purpose: string; expected: string; forbid: string }> = {
  "panel-overview": {
    title: "分電盤",
    purpose: "分電盤全体・主幹・分岐・空き・見える電圧/回路表示・焦げ破損の候補",
    expected: "全体が写っているか、追加アップが要るか",
    forbid: "施工可否・回路使用可否は確定しない",
  },
  "main-breaker": {
    title: "主幹ブレーカー",
    purpose: "メーカー・型式・定格・電圧/相の見える表示と判読可否",
    expected: "文字が読めなければ再撮影指示",
    forbid: "施工可否・遮断器定格の確定はしない",
  },
  "branch-labels": {
    title: "分岐・回路表示",
    purpose: "回路名称・エアコン回路らしき表示・空き回路/スペース候補",
    expected: "読めなければ追加アップ",
    forbid: "空き回路の使用可否は確定しない",
  },
  "ac-nameplate": {
    title: "エアコン銘板",
    purpose: "見えるメーカー・型番・電圧・能力・冷媒。型番は推測しない",
    expected: "型番がぼけていれば正面近距離を要求",
    forbid: "配管サイズを見た目だけで確定しない。型番根拠が無ければ仕様確認必要",
  },
  "indoor-place": {
    title: "室内機",
    purpose: "位置・既存穴・配管出口・カバー・露出・高所・障害物",
    expected: "出口や穴が見えなければ別角度",
    forbid: "隠蔽物は断定しない",
  },
  "outdoor-place": {
    title: "室外機",
    purpose: "床/屋根/壁面/天吊り/二段/別階・架台・アクセス・ドレン・カバー",
    expected: "全景と取り出しが見えるか",
    forbid: "再利用可否は人間確認",
  },
  "existing-outlet": {
    title: "設置場所",
    purpose: "コンセント形状・見える電圧表示・壁面・穴・カバー",
    expected: "差込口全体と表示が読める距離",
    forbid: "接続方法は決めない",
  },
  "route-plan": {
    title: "配線・配管ルート",
    purpose: "配管/配線/ドレンルート・露出隠蔽・階跨ぎ・距離推定の可否",
    expected: "室内〜貫通〜室外の欠けを具体的に要求",
    forbid: "根拠が弱い距離は推定不可。課金mは出さない",
  },
};

const TARGET_FIELDS = new Set([
  "acVoltage",
  "dedicatedCircuit",
  "outdoorPlace",
  "hole",
  "cover",
  "wiringRoute",
  "voltChange",
  "spareCircuit",
  "other",
]);
const WORK_KEYS = new Set([
  "install",
  "remove",
  "dedicated",
  "volt_change",
  "hole",
  "cover",
  "pipe_ext",
  "wire_ext",
  "roof_wall",
  "other",
]);
const MATERIAL_KEYS = new Set([
  "refrigerant_pipe",
  "insulated_drain",
  "drain_hose",
  "power_cable",
  "interconnect",
  "cover",
  "sleeve",
  "putty",
  "stand",
  "bend",
  "terminal",
  "joint",
  "drain_fitting",
  "other",
]);
const MATERIAL_ROLES = new Set(["indoor", "outdoor", "prep", "unknown"]);
const ESTIMATE_CATALOG = new Set([
  "install_std",
  "remove_std",
  "remove_floor",
  "roof_wall",
  "pipe_ext",
  "cover",
  "dedicated",
  "volt_change",
  "hole",
  "wire_ext",
  "angle",
  "none",
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

function parseLegacyReading(o: Record<string, unknown>): Record<string, unknown> | null {
  if (typeof o.category !== "string" || !CATEGORIES.has(o.category)) return null;
  if (!isShortString(o.summary) || o.summary.length === 0) return null;
  if (!Array.isArray(o.candidates) || o.candidates.length > 6) return null;
  for (let i = 0; i < o.candidates.length; i++) {
    const c = o.candidates[i];
    if (!c || typeof c !== "object") return null;
    const cand = c as Record<string, unknown>;
    if (!isShortString(cand.label) || cand.label.length === 0) return null;
    if (!isShortString(cand.value) || cand.value.length === 0) return null;
    if (typeof cand.confidence !== "string" || !CONFIDENCE.has(cand.confidence)) return null;
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
    visibleFacts: [],
    fieldCandidates: [],
    workCandidates: [],
    estimateCandidates: [],
    materialPlanCandidates: [],
    warnings: [],
    missingInformation: o.requiredFollowUp,
    nextPhotos: [],
    evidence: o.evidence,
    uncertainty: o.uncertainty,
    requiredMeasurements: [],
    candidates: o.candidates,
    requiredFollowUp: o.requiredFollowUp,
    disclaimers: o.disclaimers,
  };
}

function parseNewReading(o: Record<string, unknown>): Record<string, unknown> | null {
  if (typeof o.category !== "string" || !CATEGORIES.has(o.category)) return null;
  if (!isShortString(o.summary) || o.summary.length === 0) return null;
  if (!isStringArray(o.visibleFacts, 8)) return null;
  if (!isStringArray(o.warnings, 6)) return null;
  if (!isStringArray(o.missingInformation, 6)) return null;
  if (!isStringArray(o.uncertainty, 6)) return null;
  if (!isStringArray(o.requiredMeasurements, 6)) return null;

  if (!Array.isArray(o.fieldCandidates) || o.fieldCandidates.length > 6) return null;
  for (let i = 0; i < o.fieldCandidates.length; i++) {
    const c = o.fieldCandidates[i];
    if (!c || typeof c !== "object") return null;
    const cand = c as Record<string, unknown>;
    if (typeof cand.targetField !== "string" || !TARGET_FIELDS.has(cand.targetField)) return null;
    if (!isShortString(cand.proposedValue) || cand.proposedValue.length === 0) return null;
    if (typeof cand.confidence !== "string" || !CONFIDENCE.has(cand.confidence)) return null;
    if (!isShortString(cand.reason)) return null;
    if (!isShortString(cand.evidence)) return null;
    if (typeof cand.requiresHumanConfirmation !== "boolean") return null;
  }

  if (!Array.isArray(o.workCandidates) || o.workCandidates.length > 6) return null;
  for (let i = 0; i < o.workCandidates.length; i++) {
    const c = o.workCandidates[i];
    if (!c || typeof c !== "object") return null;
    const w = c as Record<string, unknown>;
    if (typeof w.key !== "string" || !WORK_KEYS.has(w.key)) return null;
    if (!isShortString(w.label) || w.label.length === 0) return null;
    if (!isShortString(w.reason)) return null;
    if (typeof w.confidence !== "string" || !CONFIDENCE.has(w.confidence)) return null;
  }

  if (!Array.isArray(o.estimateCandidates) || o.estimateCandidates.length > 6) return null;
  for (let i = 0; i < o.estimateCandidates.length; i++) {
    const c = o.estimateCandidates[i];
    if (!c || typeof c !== "object") return null;
    const e = c as Record<string, unknown>;
    if (typeof e.catalogId !== "string" || !ESTIMATE_CATALOG.has(e.catalogId)) return null;
    if (!isShortString(e.label) || e.label.length === 0) return null;
    if (!isShortString(e.reason)) return null;
  }

  if (!Array.isArray(o.materialPlanCandidates) || o.materialPlanCandidates.length > 8) return null;
  for (let i = 0; i < o.materialPlanCandidates.length; i++) {
    const c = o.materialPlanCandidates[i];
    if (!c || typeof c !== "object") return null;
    const m = c as Record<string, unknown>;
    if (typeof m.material !== "string" || !MATERIAL_KEYS.has(m.material)) return null;
    if (typeof m.role !== "string" || !MATERIAL_ROLES.has(m.role)) return null;
    if (!isShortString(m.label) || m.label.length === 0) return null;
    if (typeof m.estimatedMin !== "number" || !Number.isFinite(m.estimatedMin)) return null;
    if (typeof m.estimatedMax !== "number" || !Number.isFinite(m.estimatedMax)) return null;
    if (!isShortString(m.unit) || m.unit.length === 0) return null;
    if (typeof m.confidence !== "string" || !CONFIDENCE.has(m.confidence)) return null;
    if (typeof m.requiresMeasurement !== "boolean") return null;
    if (!isShortString(m.basis)) return null;
  }

  if (!Array.isArray(o.nextPhotos) || o.nextPhotos.length > 4) return null;
  for (let i = 0; i < o.nextPhotos.length; i++) {
    const n = o.nextPhotos[i];
    if (!n || typeof n !== "object") return null;
    const np = n as Record<string, unknown>;
    if (!isShortString(np.instruction) || np.instruction.length === 0) return null;
  }

  if (!Array.isArray(o.evidence) || o.evidence.length > 6) return null;
  for (let i = 0; i < o.evidence.length; i++) {
    const e = o.evidence[i];
    if (!e || typeof e !== "object") return null;
    const ev = e as Record<string, unknown>;
    if (typeof ev.kind !== "string" || !EVIDENCE_KINDS.has(ev.kind)) return null;
    if (!isShortString(ev.text) || ev.text.length === 0) return null;
  }

  return {
    category: o.category,
    summary: o.summary,
    visibleFacts: o.visibleFacts,
    fieldCandidates: (o.fieldCandidates as Record<string, unknown>[]).map((c) => ({
      ...c,
      requiresHumanConfirmation: true,
    })),
    workCandidates: o.workCandidates,
    estimateCandidates: o.estimateCandidates,
    materialPlanCandidates: o.materialPlanCandidates,
    warnings: o.warnings,
    missingInformation: o.missingInformation,
    nextPhotos: o.nextPhotos,
    evidence: o.evidence,
    uncertainty: o.uncertainty,
    requiredMeasurements: o.requiredMeasurements,
    candidates: [],
    requiredFollowUp: o.missingInformation,
    disclaimers: [],
  };
}

/**
 * Validate structured reading payload. Returns null if invalid.
 * Field-ops schema first, then legacy visible-label schema.
 */
export function parseReadingPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.fieldCandidates) || Array.isArray(o.visibleFacts) || Array.isArray(o.materialPlanCandidates)) {
    return parseNewReading(o);
  }
  return parseLegacyReading(o);
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
        const rec = item as Record<string, unknown>;
        for (let k = 0; k < keys.length; k++) {
          if (typeof rec[keys[k]] === "string") parts.push(rec[keys[k]] as string);
        }
      }
    }
  };
  pushArr(reading.visibleFacts);
  pushArr(reading.candidates, ["label", "value"]);
  pushArr(reading.fieldCandidates, ["proposedValue", "reason", "evidence"]);
  pushArr(reading.workCandidates, ["label", "reason"]);
  pushArr(reading.estimateCandidates, ["label", "reason"]);
  pushArr(reading.materialPlanCandidates, ["label", "basis"]);
  pushArr(reading.evidence, ["text"]);
  pushArr(reading.warnings);
  pushArr(reading.missingInformation);
  pushArr(reading.nextPhotos, ["instruction"]);
  pushArr(reading.uncertainty);
  pushArr(reading.requiredMeasurements);
  pushArr(reading.requiredFollowUp);
  pushArr(reading.disclaimers);
  return parts.join("\n");
}

export function isSurveySlotKey(slotKey: string): boolean {
  return SURVEY_SLOT_KEYS.has(slotKey);
}
